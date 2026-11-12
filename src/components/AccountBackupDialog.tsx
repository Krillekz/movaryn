import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Eye, Loader2, Upload } from 'lucide-react';
import {
  exportLocalAccount,
  importLocalAccount,
  isLocalUsernameAvailable,
} from '../lib/account';
import { decryptBackup, encryptBackup, type BackupDocument } from '../lib/backup';
import { exportWorkspaceSnapshot, importWorkspaceSnapshot } from '../lib/db';
import { useApp } from '../store/useApp';
import { APP_VERSION } from '../lib/appVersion';
import { downloadJson, slugify } from '../lib/utils';
import { Modal } from './ui/Modal';

interface AccountBackupDialogProps {
  open: boolean;
  initialMode: 'export' | 'import';
  onClose: () => void;
}

function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (value: string): number[] | null => {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
  };
  const next = parse(candidate);
  const running = parse(current);
  if (!next || !running) return false;
  for (let index = 0; index < 3; index += 1) {
    if (next[index] !== running[index]) return next[index] > running[index];
  }
  return false;
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
  const [pendingBackup, setPendingBackup] = useState<BackupDocument | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<
    'checking' | 'available' | 'taken' | 'unknown'
  >('checking');
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
    setPendingBackup(null);
    setUsernameStatus('checking');
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

  const previewBackup = async () => {
    if (busy || !file) return;
    setError(null);
    if (!passphrase) {
      setError('Enter the backup passphrase.');
      return;
    }
    setBusy(true);
    try {
      let raw: unknown;
      try {
        raw = JSON.parse(await file.text());
      } catch {
        throw new Error('That file is not valid JSON.');
      }
      const backup = await decryptBackup(raw, passphrase);
      setPendingBackup(backup);
      setUsernameStatus('checking');
      try {
        const available = await isLocalUsernameAvailable(backup.account.username);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('unknown');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The backup could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async () => {
    const backup = pendingBackup;
    if (busy || !backup) return;
    setError(null);
    setBusy(true);
    let accountCreated = false;
    try {
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

  const backToFile = () => {
    setPendingBackup(null);
    setUsernameStatus('checking');
    setFile(null);
    setPassphrase('');
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const backupAccount = pendingBackup?.account;
  const backupWorkspace = pendingBackup?.workspace;
  const backupInitial = (backupAccount?.displayName || backupAccount?.username || '?')
    .trim()
    .charAt(0)
    .toUpperCase();
  const backupDate = pendingBackup ? new Date(pendingBackup.exportedAt).toLocaleDateString() : '';
  const backupIsNewer = pendingBackup
    ? isNewerVersion(pendingBackup.appVersion, APP_VERSION)
    : false;
  const backupStats = backupWorkspace
    ? [
        { label: 'Chats', value: backupWorkspace.conversations.length },
        { label: 'Projects', value: backupWorkspace.projects.length },
        { label: 'Notebooks', value: backupWorkspace.notebooks.length },
        { label: 'Saved versions', value: backupWorkspace.versions.length },
      ]
    : [];

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
                setPendingBackup(null);
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
              if (mode !== 'import') setPendingBackup(null);
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
        ) : pendingBackup && backupAccount && backupWorkspace ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-accent/35 bg-accent-soft px-4 py-3.5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[15px] font-semibold text-accent">
                  {backupInitial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink">
                    {backupAccount.displayName || backupAccount.username}
                  </p>
                  <p className="truncate text-[11.5px] text-ink-muted">@{backupAccount.username}</p>
                  <p className="mt-0.5 text-[10.5px] text-ink-faint">
                    Backup from {backupDate} · Movaryn {pendingBackup.appVersion || 'earlier version'}
                  </p>
                </div>
                <span className="ml-auto shrink-0 rounded-full border border-accent/35 px-2 py-0.5 text-[10px] text-accent">
                  Preview
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2">
                {backupStats.map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-line/70 bg-panel/70 px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{stat.label}</dt>
                    <dd className="mt-0.5 text-[15px] font-semibold text-ink">{stat.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[10.5px] text-ink-faint">
                {backupWorkspace.research.length} research fact
                {backupWorkspace.research.length === 1 ? '' : 's'} · Settings{' '}
                {backupWorkspace.settings ? 'included' : 'use defaults'}
              </p>
            </div>

            <p className="rounded-xl border border-line bg-panel px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-muted">
              Review only — nothing has been created or switched yet. Restoring creates a new local
              account with this name and opens its workspace; the current workspace stays open until the
              new account finishes loading.
            </p>

            {backupIsNewer ? (
              <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-[11.5px] leading-relaxed text-warn">
                This backup was created by Movaryn {pendingBackup.appVersion}, which is newer than this
                installation ({APP_VERSION}). Update Movaryn before restoring if possible; newer fields
                may otherwise be ignored.
              </p>
            ) : null}

            {usernameStatus === 'checking' ? (
              <p className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[11.5px] text-ink-muted">
                <Loader2 size={13} className="animate-spin" />
                Checking @{backupAccount.username} against every local account…
              </p>
            ) : null}
            {usernameStatus === 'available' ? (
              <p className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[11.5px] leading-relaxed text-ok">
                @{backupAccount.username} is available on this installation.
              </p>
            ) : null}
            {usernameStatus === 'taken' ? (
              <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-[11.5px] leading-relaxed text-warn">
                This installation already has @{backupAccount.username}. Delete or rename that account
                before restoring; nothing will change until then.
              </p>
            ) : null}
            {usernameStatus === 'unknown' ? (
              <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-[11.5px] leading-relaxed text-warn">
                The username could not be checked while the account service is unavailable. Restore will
                still verify it on the server before creating anything.
              </p>
            ) : null}
            {error ? <p className="text-[11.5px] text-danger">{error}</p> : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary h-9 text-[12px]"
                onClick={backToFile}
                disabled={busy}
              >
                <ArrowLeft size={14} />
                Choose another file
              </button>
              <button
                type="button"
                className="btn btn-primary h-9 text-[12px]"
                onClick={() => void restoreBackup()}
                disabled={busy || usernameStatus === 'checking' || usernameStatus === 'taken'}
              >
                {busy || usernameStatus === 'checking' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                {usernameStatus === 'checking'
                  ? 'Checking username…'
                  : busy
                    ? 'Restoring…'
                    : 'Restore and switch'}
              </button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void previewBackup();
            }}
          >
            <p className="rounded-xl border border-line bg-panel px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-muted">
              Unlock the file and review the account and workspace inside before anything changes. If the
              username already exists on this installation, restore stops before switching.
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
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setPendingBackup(null);
                  setError(null);
                }}
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
                onChange={(event) => {
                  setPassphrase(event.target.value);
                  setPendingBackup(null);
                  setError(null);
                }}
                autoComplete="off"
                className="field"
              />
            </div>
            {error ? <p className="text-[11.5px] text-danger">{error}</p> : null}
            <button type="submit" className="btn btn-primary mt-1" disabled={busy || !file}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
              Preview backup
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
