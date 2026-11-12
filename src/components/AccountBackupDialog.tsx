import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';
import { exportLocalAccount, importLocalAccount } from '../lib/account';
import { decryptBackup, encryptBackup } from '../lib/backup';
import { exportWorkspaceSnapshot, importWorkspaceSnapshot } from '../lib/db';
import { useApp } from '../store/useApp';
import { downloadJson, slugify } from '../lib/utils';
import { Modal } from './ui/Modal';

interface AccountBackupDialogProps {
  open: boolean;
  initialMode: 'export' | 'import';
  onClose: () => void;
}

export function AccountBackupDialog({ open, initialMode, onClose }: AccountBackupDialogProps) {
  const account = useApp((state) => state.account);
  const setAccount = useApp((state) => state.setAccount);
  const setAccountState = useApp((state) => state.setAccountState);
  const setHasLocalAccounts = useApp((state) => state.setHasLocalAccounts);
  const switchWorkspace = useApp((state) => state.switchWorkspace);
  const pushToast = useApp((state) => state.pushToast);

  const [mode, setMode] = useState<'export' | 'import'>(initialMode);
  const [accountPassword, setAccountPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode(account ? initialMode : 'import');
    setAccountPassword('');
    setPassphrase('');
    setConfirm('');
    setFile(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  }, [open, initialMode, account]);

  const createBackup = async () => {
    if (busy || !account) return;
    setError(null);
    if (passphrase.length < 8) {
      setError('Use a backup passphrase of at least 8 characters.');
      return;
    }
    if (passphrase !== confirm) {
      setError('The backup passphrases do not match.');
      return;
    }
    setBusy(true);
    try {
      const credentials = await exportLocalAccount(accountPassword);
      const workspace = await exportWorkspaceSnapshot();
      const encrypted = await encryptBackup(credentials, workspace, passphrase);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`movaryn-${slugify(account.username)}-${stamp}.backup.json`, encrypted);
      pushToast('Encrypted account backup downloaded.', 'success');
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The backup could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async () => {
    if (busy || !file) return;
    setError(null);
    if (!passphrase) {
      setError('Enter the backup passphrase.');
      return;
    }
    setBusy(true);
    let accountCreated = false;
    try {
      let raw: unknown;
      try {
        raw = JSON.parse(await file.text());
      } catch {
        throw new Error('That file is not valid JSON.');
      }
      const backup = await decryptBackup(raw, passphrase);
      const session = await importLocalAccount(backup.account);
      accountCreated = true;
      setAccount(session.user);
      setAccountState('ready');
      setHasLocalAccounts(true);
      await switchWorkspace(session.user.id);
      await importWorkspaceSnapshot(backup.workspace);
      await switchWorkspace(session.user.id, true);
      pushToast(
        `Restored @${session.user.username} with ${backup.workspace.conversations.length} chat${backup.workspace.conversations.length === 1 ? '' : 's'}.`,
        'success',
      );
      onClose();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The backup could not be restored.';
      setError(message);
      // The dialog unmounts when the account switch reloads the app, so surface
      // failures that happen after the account was created as a toast too.
      if (accountCreated) pushToast(message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Back up or restore"
      description="One encrypted file carries the account and its workspace to another installation."
      width="max-w-lg"
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {account ? (
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-[12.5px] transition-colors ${
                mode === 'export'
                  ? 'border-accent bg-accent-soft text-ink'
                  : 'border-line bg-panel text-ink-muted hover:text-ink'
              }`}
              onClick={() => {
                setMode('export');
                setError(null);
              }}
            >
              Back up this account
            </button>
          ) : null}
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-[12.5px] transition-colors ${
              mode === 'import'
                ? 'border-accent bg-accent-soft text-ink'
                : 'border-line bg-panel text-ink-muted hover:text-ink'
            } ${account ? '' : 'col-span-2'}`}
            onClick={() => {
              setMode('import');
              setError(null);
            }}
          >
            Restore a backup
          </button>
        </div>

        {mode === 'export' ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createBackup();
            }}
          >
            <p className="rounded-xl border border-line bg-panel px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-muted">
              The file includes your login credential and this workspace's chats, projects, notebooks,
              versions and settings. It is encrypted in this browser; without the backup passphrase the
              file cannot be opened or recovered.
            </p>
            <div>
              <label className="field-label" htmlFor="backup-account-password">
                Current account password
              </label>
              <input
                id="backup-account-password"
                type="password"
                value={accountPassword}
                onChange={(event) => setAccountPassword(event.target.value)}
                autoComplete="current-password"
                className="field"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="backup-passphrase">
                Backup passphrase
              </label>
              <input
                id="backup-passphrase"
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                autoComplete="new-password"
                className="field"
              />
              <p className="mt-1 text-[10.5px] text-ink-faint">
                At least 8 characters. This is separate from your account password.
              </p>
            </div>
            <div>
              <label className="field-label" htmlFor="backup-confirm">
                Confirm passphrase
              </label>
              <input
                id="backup-confirm"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                className="field"
              />
            </div>
            {error ? <p className="text-[11.5px] text-danger">{error}</p> : null}
            <button type="submit" className="btn btn-primary mt-1" disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Create encrypted backup
            </button>
          </form>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void restoreBackup();
            }}
          >
            <p className="rounded-xl border border-line bg-panel px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-muted">
              Restoring creates a local account from the file and opens the workspace inside it. If the
              username already exists on this installation, choose another installation or rename the
              existing account first.
            </p>
            <div>
              <label className="field-label" htmlFor="backup-file">
                Backup file
              </label>
              <input
                ref={fileRef}
                id="backup-file"
                type="file"
                accept=".json,application/json"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="field file:mr-3 file:rounded-md file:border-0 file:bg-panel-3 file:px-2.5 file:py-1 file:text-[11px] file:text-ink-muted"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="restore-passphrase">
                Backup passphrase
              </label>
              <input
                id="restore-passphrase"
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                autoComplete="off"
                className="field"
              />
            </div>
            {error ? <p className="text-[11.5px] text-danger">{error}</p> : null}
            <button type="submit" className="btn btn-primary mt-1" disabled={busy || !file}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Restore and open workspace
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
