import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Loader2, LogOut, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import {
  changeLocalPassword,
  deleteLocalAccount,
  loadAccountStatus,
  loginLocalAccount,
  logoutLocalAccount,
  registerLocalAccount,
  updateLocalAccount,
} from '../lib/account';
import { useApp } from '../store/useApp';
import { cx } from '../lib/utils';
import { Modal } from './ui/Modal';

export function AccountDialog() {
  const open = useApp((state) => state.ui.accountOpen);
  const close = useApp((state) => state.closeAccount);
  const account = useApp((state) => state.account);
  const accountState = useApp((state) => state.accountState);
  const hasLocalAccounts = useApp((state) => state.hasLocalAccounts);
  const setAccount = useApp((state) => state.setAccount);
  const setAccountState = useApp((state) => state.setAccountState);
  const setHasLocalAccounts = useApp((state) => state.setHasLocalAccounts);
  const pushToast = useApp((state) => state.pushToast);
  const requestConfirm = useApp((state) => state.requestConfirm);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profileName, setProfileName] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [nextConfirm, setNextConfirm] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMode(hasLocalAccounts ? 'login' : 'register');
    setUsername('');
    setPassword('');
    setConfirm('');
    setDisplayName('');
    setCurrentPassword('');
    setNextPassword('');
    setNextConfirm('');
    setPasswordMessage(null);
    setDeletePassword('');
    setDeleteError(null);
  }, [open, hasLocalAccounts]);

  useEffect(() => {
    setProfileName(account?.displayName ?? '');
  }, [account?.displayName]);

  const initials = useMemo(
    () => (account?.displayName || account?.username || '?').trim().charAt(0).toUpperCase(),
    [account?.displayName, account?.username],
  );

  const signedIn = Boolean(account);

  const submitAuth = async () => {
    if (busy) return;
    setError(null);
    if (!username.trim() || !password) {
      setError('Enter a username and password.');
      return;
    }
    if (mode === 'register' && password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const session =
        mode === 'register'
          ? await registerLocalAccount({
              username: username.trim(),
              password,
              displayName: displayName.trim() || undefined,
            })
          : await loginLocalAccount({ username: username.trim(), password });
      setAccount(session.user);
      setAccountState('ready');
      if (mode === 'register') setHasLocalAccounts(true);
      setPassword('');
      setConfirm('');
      pushToast(
        mode === 'register' ? 'Account created on this installation.' : `Signed in as ${session.user.displayName}.`,
        'success',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The account request failed.');
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!account || profileBusy) return;
    setProfileBusy(true);
    try {
      const user = await updateLocalAccount(profileName.trim() || account.username);
      setAccount(user);
      pushToast('Display name updated.', 'success');
    } catch (caught) {
      pushToast(caught instanceof Error ? caught.message : 'Could not update the profile.', 'danger');
    } finally {
      setProfileBusy(false);
    }
  };

  const savePassword = async () => {
    if (passwordBusy) return;
    setPasswordMessage(null);
    if (nextPassword.length < 8) {
      setPasswordMessage('The new password must be at least 8 characters.');
      return;
    }
    if (nextPassword !== nextConfirm) {
      setPasswordMessage('The new passwords do not match.');
      return;
    }
    setPasswordBusy(true);
    try {
      const session = await changeLocalPassword(currentPassword, nextPassword);
      setAccount(session.user);
      setCurrentPassword('');
      setNextPassword('');
      setNextConfirm('');
      setPasswordMessage('Password changed. Other signed-in sessions were ended.');
      pushToast('Password changed.', 'success');
    } catch (caught) {
      setPasswordMessage(caught instanceof Error ? caught.message : 'Could not change the password.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const signOut = async () => {
    await logoutLocalAccount().catch(() => undefined);
    setAccount(null);
    setMode('login');
    pushToast('Signed out on this device.', 'success');
  };

  const removeAccount = () => {
    if (!account || deleteBusy || !deletePassword) return;
    setDeleteError(null);
    requestConfirm({
      title: 'Delete this local account?',
      body: `The account @${account.username} and its saved sessions will be removed. Your conversations, projects and notebooks stay on this device.`,
      confirmLabel: 'Delete account',
      danger: true,
      onConfirm: () => {
        setDeleteBusy(true);
        void deleteLocalAccount(deletePassword)
          .then(() => {
            setAccount(null);
            setDeletePassword('');
            void loadAccountStatus()
              .then((status) => setHasLocalAccounts(status.hasAccounts))
              .catch(() => undefined);
            pushToast('Account deleted. Your local workspace is untouched.', 'success');
            close();
          })
          .catch((caught) => {
            setDeleteError(caught instanceof Error ? caught.message : 'Could not delete the account.');
          })
          .finally(() => setDeleteBusy(false));
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={signedIn ? 'Your account' : 'Local account'}
      description={
        signedIn
          ? 'Your identity on this installation.'
          : 'Create or sign in to a Movaryn account. No email, no cloud.'
      }
      width="max-w-lg"
    >
      {accountState === 'offline' ? (
        <div className="mb-4 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-[11.5px] leading-relaxed text-warn">
          The account service is offline. Start the Movaryn API to sign in.
        </div>
      ) : null}

      {!signedIn ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: 'login', label: 'Sign in' },
                { value: 'register', label: 'Create account' },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                className={cx(
                  'rounded-lg border px-3 py-2 text-[12.5px] transition-colors',
                  mode === item.value
                    ? 'border-accent bg-accent-soft text-ink'
                    : 'border-line bg-panel text-ink-muted hover:text-ink',
                )}
                onClick={() => {
                  setMode(item.value);
                  setError(null);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitAuth();
            }}
          >
            <div>
              <label className="field-label" htmlFor="account-username">
                Username
              </label>
              <input
                id="account-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoFocus
                maxLength={24}
                placeholder="e.g. raevik"
                className="field"
              />
            </div>
            {mode === 'register' ? (
              <div>
                <label className="field-label" htmlFor="account-display-name">
                  Display name <span className="normal-case tracking-normal">(optional)</span>
                </label>
                <input
                  id="account-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={40}
                  placeholder="How your name appears in the app"
                  className="field"
                />
              </div>
            ) : null}
            <div>
              <label className="field-label" htmlFor="account-password">
                Password
              </label>
              <input
                id="account-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                maxLength={128}
                className="field"
              />
              {mode === 'register' ? (
                <p className="mt-1 text-[10.5px] text-ink-faint">
                  8–128 characters. Stored only as a salted scrypt hash.
                </p>
              ) : null}
            </div>
            {mode === 'register' ? (
              <div>
                <label className="field-label" htmlFor="account-confirm">
                  Confirm password
                </label>
                <input
                  id="account-confirm"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  maxLength={128}
                  className="field"
                />
              </div>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[11.5px] leading-relaxed text-danger">
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn btn-primary h-9" disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <UserRound size={14} />}
              {mode === 'register' ? 'Create local account' : 'Sign in'}
            </button>
          </form>

          <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
            <h3 className="text-[12px] font-semibold text-ink">What this account is</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
              A local identity stored in Movaryn&apos;s data folder, outside the install directory. Your
              username and password keep working after app updates. There is no email recovery and no
              cloud sync. Accounts are an identity layer for now: they do not yet separate one local
              workspace from another, and they do not move your work between devices.
            </p>
          </section>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <section className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[18px] font-semibold text-accent">
              {initials}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold tracking-tight text-ink">
                {account?.displayName}
              </h3>
              <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">@{account?.username}</p>
              <p className="mt-0.5 text-[10.5px] text-ink-faint">
                Local account · created {account ? new Date(account.createdAt).toLocaleDateString() : ''}
              </p>
            </div>
            <ShieldCheck size={18} className="ml-auto shrink-0 text-ok" />
          </section>

          <section>
            <h3 className="text-[12.5px] font-semibold text-ink">Profile</h3>
            <div className="mt-2 flex gap-2">
              <input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                maxLength={40}
                className="field h-9"
                aria-label="Display name"
              />
              <button
                type="button"
                className="btn btn-secondary h-9 shrink-0"
                onClick={() => void saveProfile()}
                disabled={profileBusy || !profileName.trim()}
              >
                {profileBusy ? <Loader2 size={13} className="animate-spin" /> : null}
                Save
              </button>
            </div>
            <p className="mt-1 text-[10.5px] text-ink-faint">
              Your username is fixed; the display name can change.
            </p>
          </section>

          <section className="border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <KeyRound size={14} className="text-ink-faint" />
              <h3 className="text-[12.5px] font-semibold text-ink">Change password</h3>
            </div>
            <div className="mt-2 grid gap-2">
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
                maxLength={128}
                className="field h-9 text-[12.5px]"
                aria-label="Current password"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="password"
                  value={nextPassword}
                  onChange={(event) => setNextPassword(event.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  maxLength={128}
                  className="field h-9 text-[12.5px]"
                  aria-label="New password"
                />
                <input
                  type="password"
                  value={nextConfirm}
                  onChange={(event) => setNextConfirm(event.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  maxLength={128}
                  className="field h-9 text-[12.5px]"
                  aria-label="Confirm new password"
                />
              </div>
              {passwordMessage ? (
                <p className={cx('text-[11px]', passwordMessage.startsWith('Password changed') ? 'text-ok' : 'text-danger')}>
                  {passwordMessage}
                </p>
              ) : null}
              <button
                type="button"
                className="btn btn-secondary h-8 self-start text-[12px]"
                onClick={() => void savePassword()}
                disabled={passwordBusy || !currentPassword || !nextPassword || !nextConfirm}
              >
                {passwordBusy ? <Loader2 size={13} className="animate-spin" /> : null}
                Update password
              </button>
            </div>
          </section>

          <section className="border-t border-line pt-4">
            <button
              type="button"
              className="btn btn-ghost h-8 text-[12px]"
              onClick={() => void signOut()}
            >
              <LogOut size={13} />
              Sign out
            </button>
            <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">
              Signing out does not delete your chats, projects or notebooks.
            </p>
          </section>

          <section className="border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <Trash2 size={14} className="text-danger" />
              <h3 className="text-[12.5px] font-semibold text-ink">Delete this account</h3>
            </div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-ink-faint">
              Removes only the local sign-in. Your workspace stays on this device.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                placeholder="Password to confirm"
                maxLength={128}
                className="field h-8 text-[12px]"
                aria-label="Password to confirm account deletion"
              />
              <button
                type="button"
                className="btn btn-danger h-8 shrink-0 text-[12px]"
                onClick={removeAccount}
                disabled={!deletePassword || deleteBusy}
              >
                {deleteBusy ? <Loader2 size={13} className="animate-spin" /> : null}
                Delete
              </button>
            </div>
            {deleteError ? <p className="mt-1 text-[11px] text-danger">{deleteError}</p> : null}
          </section>
        </div>
      )}
    </Modal>
  );
}
