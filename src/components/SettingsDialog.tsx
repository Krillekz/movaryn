import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Database,
  Heart,
  Info,
  LayoutPanelLeft,
  Lightbulb,
  Loader2,
  Monitor,
  Moon,
  Palette,
  Plug,
  RefreshCw,
  SlidersHorizontal,
  Sun,
  UserRound,
  XCircle,
} from 'lucide-react';
import type {
  AccentId,
  AmbienceId,
  CornerStyle,
  ImageQuality,
  ReadingFont,
  ThemePreference,
} from '../../shared/types';
import { ASPECT_RATIOS } from '../../shared/types';
import { fetchHealth } from '../lib/api';
import { apiBase, isBrowserBuild, setApiBase } from '../lib/apiBase';
import { useApp, type SettingsTabId } from '../store/useApp';
import { APP_VERSION } from '../lib/appVersion';
import { exportAllData } from '../lib/exportData';
import { CHANGELOG_URL, ROADMAP_URL } from '../lib/links';
import { cx } from '../lib/utils';
import { Modal } from './ui/Modal';

const TABS: { id: SettingsTabId; label: string; icon: typeof Plug }[] = [
  { id: 'account', label: 'Account', icon: UserRound },
  { id: 'provider', label: 'Provider', icon: Plug },
  { id: 'models', label: 'Models', icon: SlidersHorizontal },
  { id: 'prompts', label: 'Prompts', icon: Lightbulb },
  { id: 'layout', label: 'Layout & replies', icon: LayoutPanelLeft },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'data', label: 'Data & privacy', icon: Database },
  { id: 'credits', label: 'Credits', icon: Heart },
  { id: 'about', label: 'About', icon: Info },
];

const LAYOUT_PRESETS = [
  { id: 'focus', label: 'Focus', detail: 'Narrow, tight, less to scan', width: 'narrow', density: 'compact' },
  { id: 'classic', label: 'Classic', detail: 'The default reading rhythm', width: 'standard', density: 'comfortable' },
  { id: 'studio', label: 'Studio', detail: 'Wide canvas, room to breathe', width: 'wide', density: 'spacious' },
] as const;

const ACCENTS: { value: AccentId; label: string; color: string }[] = [
  { value: 'violet', label: 'Violet', color: '#9b8afa' },
  { value: 'emerald', label: 'Emerald', color: '#35c39a' },
  { value: 'amber', label: 'Amber', color: '#e8b35c' },
  { value: 'rose', label: 'Rose', color: '#f27c9c' },
  { value: 'sky', label: 'Sky', color: '#64b5f6' },
  { value: 'mono', label: 'Mono', color: '#c3c4cf' },
];

const AMBIENCES: { value: AmbienceId; label: string; detail: string }[] = [
  { value: 'plain', label: 'Plain', detail: 'Clean, flat surfaces' },
  { value: 'grid', label: 'Grid', detail: 'Faint studio grid' },
  { value: 'glow', label: 'Glow', detail: 'Soft accent light' },
];

const CORNERS: { value: CornerStyle; label: string; radius: string }[] = [
  { value: 'sharp', label: 'Sharp', radius: '2px' },
  { value: 'soft', label: 'Soft', radius: '8px' },
  { value: 'round', label: 'Round', radius: '16px' },
];

const READING_FONTS: { value: ReadingFont; label: string; detail: string; className: string }[] = [
  { value: 'sans', label: 'Sans', detail: 'Inter, crisp and neutral', className: 'font-sans' },
  { value: 'serif', label: 'Serif', detail: 'Warmer long-form reading', className: 'font-serif' },
];

const LOOKS: {
  label: string;
  detail: string;
  theme: ThemePreference;
  accent: AccentId;
  ambience: AmbienceId;
  corners: CornerStyle;
  readingFont: ReadingFont;
}[] = [
  {
    label: 'Signature',
    detail: 'Violet glow',
    theme: 'dark',
    accent: 'violet',
    ambience: 'glow',
    corners: 'soft',
    readingFont: 'sans',
  },
  {
    label: 'Arcade',
    detail: 'Rose grid, sharp',
    theme: 'dark',
    accent: 'rose',
    ambience: 'grid',
    corners: 'sharp',
    readingFont: 'sans',
  },
  {
    label: 'Quiet',
    detail: 'Mono serif',
    theme: 'light',
    accent: 'mono',
    ambience: 'plain',
    corners: 'round',
    readingFont: 'serif',
  },
  {
    label: 'Atlas',
    detail: 'Sky grid',
    theme: 'dark',
    accent: 'sky',
    ambience: 'grid',
    corners: 'soft',
    readingFont: 'sans',
  },
  {
    label: 'Ember',
    detail: 'Amber glow, serif',
    theme: 'dark',
    accent: 'amber',
    ambience: 'glow',
    corners: 'round',
    readingFont: 'serif',
  },
  {
    label: 'Mint',
    detail: 'Emerald daylight',
    theme: 'light',
    accent: 'emerald',
    ambience: 'plain',
    corners: 'soft',
    readingFont: 'sans',
  },
];

const ENV_SAMPLE = `AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=your-key
AI_MODEL=gpt-4.1-mini
IMAGE_API_KEY=your-key
IMAGE_MODEL=gpt-image-1

# or a free daily image allowance:
# IMAGE_PROVIDER=cloudflare
# IMAGE_ACCOUNT_ID=your-account-id
# IMAGE_API_KEY=your-workers-ai-token`;

export function SettingsDialog() {
  const open = useApp((state) => state.ui.settingsOpen);
  const close = useApp((state) => state.closeSettings);
  const provider = useApp((state) => state.provider);
  const providerError = useApp((state) => state.providerError);
  const settings = useApp((state) => state.settings);
  const updateSettings = useApp((state) => state.updateSettings);
  const requestConfirm = useApp((state) => state.requestConfirm);
  const resetAllData = useApp((state) => state.resetAllData);
  const pushToast = useApp((state) => state.pushToast);
  const account = useApp((state) => state.account);
  const accountState = useApp((state) => state.accountState);
  const hasLocalAccounts = useApp((state) => state.hasLocalAccounts);
  const openAccount = useApp((state) => state.openAccount);

  const tab = useApp((state) => state.ui.settingsTab);
  const setTab = useApp((state) => state.setSettingsTab);
  const [rechecking, setRechecking] = useState(false);

  const recheck = async () => {
    setRechecking(true);
    try {
      const status = await fetchHealth();
      useApp.getState().setProvider(status, null);
      pushToast(
        status.chat.configured ? 'Provider connected.' : 'API is running, but credentials are incomplete.',
        status.chat.configured ? 'success' : 'danger',
      );
    } catch (error) {
      useApp
        .getState()
        .setProvider(null, error instanceof Error ? error.message : 'The API is unreachable.');
      pushToast('The API is still unreachable.', 'danger');
    } finally {
      setRechecking(false);
    }
  };

  const exportAll = () => {
    exportAllData();
    pushToast('Export downloaded.', 'success');
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Settings"
      description="Account, provider connection, models, design and local data."
      width="max-w-3xl"
      bodyClassName="px-0 py-0"
    >
      <div className="flex min-h-[440px] flex-col sm:flex-row">
        <nav className="shrink-0 border-b border-line p-2 sm:w-44 sm:border-b-0 sm:border-r">
          <div className="flex gap-1 overflow-x-auto sm:flex-col">
            {TABS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cx(
                    'flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors',
                    tab === item.id
                      ? 'bg-surface text-ink'
                      : 'text-ink-muted hover:bg-surface/70 hover:text-ink',
                  )}
                  aria-current={tab === item.id ? 'page' : undefined}
                >
                  <Icon size={14} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="scroll-thin min-w-0 flex-1 p-5">
          {tab === 'account' ? (
            <div className="flex flex-col gap-4">
              {account ? (
                <section className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[18px] font-semibold text-accent">
                    {(account.displayName || account.username).charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold tracking-tight text-ink">
                      {account.displayName}
                    </h3>
                    <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">
                      @{account.username}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-ink-faint">
                      Signed in on this installation
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary ml-auto h-8 shrink-0 text-[12px]"
                    onClick={openAccount}
                  >
                    Manage
                  </button>
                </section>
              ) : (
                <section className="rounded-xl border border-line bg-panel px-4 py-5 text-center">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <UserRound size={20} />
                  </span>
                  <h3 className="mt-2.5 text-[14px] font-semibold text-ink">
                    {accountState === 'offline' ? 'Account service offline' : 'No local account yet'}
                  </h3>
                  <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-ink-muted">
                    {accountState === 'offline'
                      ? 'Start the Movaryn API to create or sign in to an account.'
                      : hasLocalAccounts
                        ? 'Sign in with an account already stored on this installation, or create another.'
                        : 'Create a username and password for this installation. It keeps working across updates.'}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary mt-3 h-8 text-[12px]"
                    onClick={openAccount}
                  >
                    {accountState === 'offline'
                      ? 'Open account'
                      : hasLocalAccounts
                        ? 'Sign in or create account'
                        : 'Create the first account'}
                  </button>
                </section>
              )}

              <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
                <h3 className="text-[12px] font-semibold text-ink">Local by design</h3>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                  Accounts live in Movaryn&apos;s data folder, outside the install directory, so the same
                  username and password survive app updates. Passwords are stored only as salted scrypt
                  hashes. There is no cloud sync, no email sign-in, and no password recovery — keep the
                  password somewhere safe.
                </p>
              </section>

              <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
                <h3 className="text-[12px] font-semibold text-ink">What an account does not do</h3>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                  It does not upload conversations, projects, notebooks or provider keys, and it does not
                  sync your workspace between devices. Each account keeps a separate local workspace;
                  guest work stays in the guest workspace until you copy it. Encrypted account backups
                  are the supported way to move a workspace to another installation.
                </p>
              </section>
            </div>
          ) : null}

          {tab === 'provider' ? (
            <div className="flex flex-col gap-5">
              <section>
                <h3 className="text-[12.5px] font-semibold text-ink">Connection</h3>
                <div className="mt-2 divide-y divide-line rounded-xl border border-line bg-panel">
                  <StatusRow
                    label="API server"
                    ok={Boolean(provider)}
                    detail={provider ? `Connected · v${provider.version}` : providerError ?? 'Unreachable'}
                  />
                  <StatusRow
                    label="Chat"
                    ok={Boolean(provider?.chat.configured)}
                    detail={
                      provider
                        ? `${provider.chat.model} · ${provider.chat.endpoint}`
                        : 'Waiting for the API'
                    }
                  />
                  <StatusRow
                    label="Images"
                    ok={Boolean(provider?.image.configured)}
                    detail={
                      provider
                        ? `${provider.image.model} · ${provider.image.endpoint}`
                        : 'Waiting for the API'
                    }
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {provider ? (
                    <>
                      <span className="chip">{provider.chat.stream ? 'Streaming' : 'Non-streaming'}</span>
                      <span className="chip">{provider.chat.vision ? 'Image input on' : 'Image input off'}</span>
                      <span className="chip">
                        {provider.image.reference ? 'Reference conditioning' : 'Reference disabled'}
                      </span>
                    </>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary mt-3 h-8 text-[12px]"
                  onClick={() => void recheck()}
                  disabled={rechecking}
                >
                  {rechecking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Recheck connection
                </button>
                {isBrowserBuild ? (
                  <div className="mt-3 rounded-xl border border-line bg-panel px-3.5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[12px] text-ink">Browser API endpoint</p>
                        <p className="mt-0.5 break-words font-mono text-[11px] text-ink-faint">
                          {apiBase || 'Not set — the page shows a setup bar until one is saved.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary h-8 shrink-0 text-[12px]"
                        onClick={() => {
                          setApiBase('');
                          window.location.reload();
                        }}
                      >
                        {apiBase ? 'Change' : 'Set endpoint'}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
                      Requests go only to this server. No provider key is stored or sent by the page.
                    </p>
                  </div>
                ) : null}
              </section>

              <section>
                <h3 className="text-[12.5px] font-semibold text-ink">How to connect a provider</h3>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[12px] leading-relaxed text-ink-muted">
                  <li>
                    Copy <code className="rounded bg-surface px-1 font-mono text-[11px]">.env.example</code>{' '}
                    to <code className="rounded bg-surface px-1 font-mono text-[11px]">.env</code> in the
                    project root.
                  </li>
                  <li>Fill in an OpenAI-compatible endpoint, key and model.</li>
                  <li>Restart the API (stop and run npm run dev again).</li>
                  <li>Press Recheck connection above.</li>
                </ol>
                <pre className="scroll-thin mt-2 overflow-x-auto rounded-xl border border-line bg-panel px-3 py-2.5 font-mono text-[11px] leading-relaxed text-ink-muted">
                  {ENV_SAMPLE}
                </pre>
                {provider?.setup.length ? (
                  <p className="mt-2 text-[11.5px] leading-relaxed text-warn">
                    Missing: {provider.setup.join(', ')}
                  </p>
                ) : null}
              </section>

              <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
                <h3 className="text-[12px] font-semibold text-ink">Where the keys live</h3>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                  Keys are read only by the local API server and are never bundled into the browser code.
                  Requests go server-to-provider. In the desktop app, the main process passes them to the
                  local API without exposing them to the window. `.env` is git-ignored.
                </p>
              </section>
            </div>
          ) : null}

          {tab === 'models' ? (
            <div className="flex flex-col gap-5">
              <section className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="settings-chat-model">
                    Chat model override
                  </label>
                  <input
                    id="settings-chat-model"
                    value={settings.chatModel}
                    onChange={(event) => updateSettings({ chatModel: event.target.value })}
                    placeholder={provider?.chat.model ?? 'Server default'}
                    className="field"
                  />
                  <p className="mt-1 text-[10.5px] text-ink-faint">
                    Leave empty to use the model configured on the server.
                  </p>
                </div>
                <div>
                  <label className="field-label" htmlFor="settings-image-model">
                    Image model override
                  </label>
                  <input
                    id="settings-image-model"
                    value={settings.imageModel}
                    onChange={(event) => updateSettings({ imageModel: event.target.value })}
                    placeholder={provider?.image.model ?? 'Server default'}
                    className="field"
                  />
                  <p className="mt-1 text-[10.5px] text-ink-faint">
                    Must be an image model supported by your provider.
                  </p>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="settings-quality">
                    Image quality
                  </label>
                  <select
                    id="settings-quality"
                    value={settings.imageQuality}
                    onChange={(event) =>
                      updateSettings({ imageQuality: event.target.value as ImageQuality })
                    }
                    className="field h-9"
                  >
                    <option value="">Server default</option>
                    <option value="low">Low (fastest)</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="settings-aspect">
                    Default aspect ratio
                  </label>
                  <select
                    id="settings-aspect"
                    value={settings.aspect}
                    onChange={(event) =>
                      updateSettings({ aspect: event.target.value as typeof settings.aspect })
                    }
                    className="field h-9"
                  >
                    {ASPECT_RATIOS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} · {option.value}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section>
                <label className="field-label" htmlFor="settings-window">
                  Recent messages sent verbatim: {settings.contextWindow}
                </label>
                <input
                  id="settings-window"
                  type="range"
                  min={4}
                  max={60}
                  step={2}
                  value={settings.contextWindow}
                  onChange={(event) =>
                    updateSettings({ contextWindow: Number(event.target.value) })
                  }
                  className="w-full accent-[var(--accent)]"
                />
                <p className="mt-1 text-[10.5px] leading-relaxed text-ink-faint">
                  Older turns are folded into a compact project memory automatically, so long chats keep
                  their constraints without resending everything. There is no app-imposed message cap.
                </p>
              </section>

              <section className="flex items-start justify-between gap-4 rounded-xl border border-line bg-panel px-3.5 py-3">
                <div>
                  <p className="text-[12px] font-medium text-ink">Send reference images to the chat model</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                    Uses vision input from the last two attachments. Turn this off if your model rejects
                    images.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.attachReferences}
                  onChange={(event) => updateSettings({ attachReferences: event.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  aria-label="Send reference images to the chat model"
                />
              </section>
            </div>
          ) : null}

          {tab === 'prompts' ? (
            <div className="flex flex-col gap-5">
              <section>
                <label className="field-label" htmlFor="settings-house-rules">
                  House rules sent with every chat
                </label>
                <textarea
                  id="settings-house-rules"
                  value={settings.houseRules}
                  onChange={(event) => updateSettings({ houseRules: event.target.value })}
                  rows={6}
                  maxLength={4000}
                  placeholder="For example: always end with a one-line gameplan; prefer one-word names; keep every move buildable with animations and hitboxes only."
                  className="field resize-y"
                />
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
                  {settings.houseRules.length}/4000 · Applied on this device alongside the project brief.
                  Hard constraints and your explicit request still win if they conflict.
                </p>
              </section>

              <section>
                <h3 className="text-[12.5px] font-semibold text-ink">Quick additions</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    'Always end a full kit with a one-line gameplan.',
                    'Prefer one-word move names unless I ask otherwise.',
                    'Keep every move buildable with animations, hitboxes, sounds and basic effects.',
                    'No counters, domains or passives unless I ask for them.',
                    'State counterplay for every move in one short line.',
                  ].map((rule) => (
                    <button
                      key={rule}
                      type="button"
                      className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-left text-[11.5px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                      onClick={() =>
                        updateSettings({
                          houseRules: settings.houseRules.trim()
                            ? `${settings.houseRules.trimEnd()}\n- ${rule}`
                            : `- ${rule}`,
                        })
                      }
                    >
                      + {rule}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
                <h3 className="text-[12px] font-semibold text-ink">Where these go</h3>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                  House rules are stored with your settings and sent as a separate section of the system
                  prompt on each chat request. They are preferences, not a way to override the project brief,
                  and they never leave the API server except to your configured provider.
                </p>
              </section>

              <p className="text-[11px] leading-relaxed text-ink-faint">
                Looking for prompts rather than rules? Open the idea library from the lightbulb button in
                the composer, or from the welcome screen.
              </p>
            </div>
          ) : null}

          {tab === 'layout' ? (
            <div className="flex flex-col gap-6">
              <section>
                <h3 className="text-[12.5px] font-semibold text-ink">Workspace presets</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
                  Set the reading width and message spacing everywhere: chat, composer and notebook.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {LAYOUT_PRESETS.map((preset) => {
                    const selected =
                      settings.layoutWidth === preset.width &&
                      settings.layoutDensity === preset.density;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          updateSettings({
                            layoutWidth: preset.width,
                            layoutDensity: preset.density,
                          })
                        }
                        className={cx(
                          'flex flex-col items-start gap-2 rounded-xl border px-3 py-3 text-left transition-colors',
                          selected
                            ? 'border-accent bg-accent-soft'
                            : 'border-line bg-panel hover:border-line-strong',
                        )}
                        aria-pressed={selected}
                      >
                        <span className="flex w-full flex-col items-center gap-1 rounded-lg border border-line bg-canvas px-2 py-2">
                          <span
                            className={cx(
                              'h-1.5 rounded-full bg-line-strong',
                              preset.width === 'narrow' && 'w-8',
                              preset.width === 'standard' && 'w-12',
                              preset.width === 'wide' && 'w-full',
                            )}
                          />
                          <span className="h-1 w-10 rounded-full bg-line" />
                          <span
                            className={cx(
                              'h-1.5 rounded-full bg-accent/70',
                              preset.density === 'compact' ? 'mt-0.5 w-9' : 'mt-1.5 w-9',
                            )}
                          />
                        </span>
                        <span className="text-[12px] font-medium text-ink">{preset.label}</span>
                        <span className="text-[10.5px] leading-snug text-ink-faint">
                          {preset.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="settings-layout-width">
                    Reading width
                  </label>
                  <select
                    id="settings-layout-width"
                    value={settings.layoutWidth}
                    onChange={(event) =>
                      updateSettings({ layoutWidth: event.target.value as typeof settings.layoutWidth })
                    }
                    className="field h-9 text-[12.5px]"
                  >
                    <option value="narrow">Narrow · 680px</option>
                    <option value="standard">Standard · 820px</option>
                    <option value="wide">Wide · 1080px</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="settings-layout-density">
                    Message spacing
                  </label>
                  <select
                    id="settings-layout-density"
                    value={settings.layoutDensity}
                    onChange={(event) =>
                      updateSettings({
                        layoutDensity: event.target.value as typeof settings.layoutDensity,
                      })
                    }
                    className="field h-9 text-[12.5px]"
                  >
                    <option value="compact">Compact</option>
                    <option value="comfortable">Comfortable</option>
                    <option value="spacious">Spacious</option>
                  </select>
                </div>
              </section>

              <section>
                <h3 className="text-[12.5px] font-semibold text-ink">How Movaryn answers</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
                  Sent with every chat request. Project briefs and your explicit request still win.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      { value: 'concise', label: 'Concise', detail: 'Answer first, minimal explanation' },
                      { value: 'balanced', label: 'Balanced', detail: 'Full answers without filler' },
                      { value: 'detailed', label: 'Detailed', detail: 'Reasoning and trade-offs included' },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateSettings({ responseStyle: option.value })}
                      className={cx(
                        'rounded-xl border px-3 py-2.5 text-left transition-colors',
                        settings.responseStyle === option.value
                          ? 'border-accent bg-accent-soft'
                          : 'border-line bg-panel hover:border-line-strong',
                      )}
                      aria-pressed={settings.responseStyle === option.value}
                    >
                      <span className="block text-[12px] font-medium text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-[10.5px] leading-snug text-ink-faint">
                        {option.detail}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <label className="field-label" htmlFor="settings-response-format">
                  Reply format
                </label>
                <select
                  id="settings-response-format"
                  value={settings.responseFormat}
                  onChange={(event) =>
                    updateSettings({
                      responseFormat: event.target.value as typeof settings.responseFormat,
                    })
                  }
                  className="field h-9 text-[12.5px]"
                >
                  <option value="prose">Prose · short paragraphs</option>
                  <option value="mixed">Mixed · prose with lists where useful</option>
                  <option value="bullets">Bullets · short scannable points</option>
                </select>
              </section>

              <section className="flex items-start justify-between gap-4 rounded-xl border border-line bg-panel px-3.5 py-3">
                <div>
                  <p className="text-[12px] font-medium text-ink">Explain design choices</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                    Ask for a short reason and cost behind significant choices, instead of only the result.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.explainChoices}
                  onChange={(event) => updateSettings({ explainChoices: event.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  aria-label="Explain design choices"
                />
              </section>

              <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
                <h3 className="text-[12px] font-semibold text-ink">Notebook layout</h3>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                  The notebook uses the same width and spacing. Open it from the sidebar, the command
                  palette, or{' '}
                  <kbd className="rounded border border-line bg-surface px-1 py-0.5 text-[10px]">
                    Ctrl/⌘ + Shift + N
                  </kbd>
                  .
                </p>
              </section>
            </div>
          ) : null}

          {tab === 'appearance' ? (
            <div className="flex flex-col gap-6">
              <section>
                <h3 className="text-[12.5px] font-semibold text-ink">Theme</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      { value: 'dark', label: 'Dark', icon: Moon },
                      { value: 'light', label: 'Light', icon: Sun },
                      { value: 'system', label: 'System', icon: Monitor },
                    ] as { value: ThemePreference; label: string; icon: typeof Moon }[]
                  ).map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateSettings({ theme: option.value })}
                        className={cx(
                          'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] transition-colors',
                          settings.theme === option.value
                            ? 'border-accent bg-accent-soft text-ink'
                            : 'border-line bg-panel text-ink-muted hover:border-line-strong hover:text-ink',
                        )}
                        aria-pressed={settings.theme === option.value}
                      >
                        <Icon size={15} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[12.5px] font-semibold text-ink">Quick looks</h3>
                  <span className="text-[10px] text-ink-faint">Theme + accent + finish</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {LOOKS.map((look) => {
                    const active =
                      settings.theme === look.theme &&
                      settings.accent === look.accent &&
                      settings.ambience === look.ambience &&
                      settings.corners === look.corners &&
                      settings.readingFont === look.readingFont;
                    return (
                      <button
                        key={look.label}
                        type="button"
                        className={cx(
                          'rounded-lg border px-2.5 py-2 text-left transition-colors',
                          active
                            ? 'border-accent bg-accent-soft text-ink'
                            : 'border-line bg-panel text-ink-muted hover:border-line-strong hover:text-ink',
                        )}
                        aria-pressed={active}
                        onClick={() =>
                          updateSettings({
                            theme: look.theme,
                            accent: look.accent,
                            ambience: look.ambience,
                            corners: look.corners,
                            readingFont: look.readingFont,
                          })
                        }
                      >
                        <span className="block text-[11.5px] font-medium">{look.label}</span>
                        <span className="mt-0.5 block text-[10px] text-ink-faint">{look.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-[12.5px] font-semibold text-ink">Accent</h3>
                <p className="mt-1 text-[11px] text-ink-faint">
                  Buttons, links, focus rings and the active selection follow this colour.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACCENTS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateSettings({ accent: option.value })}
                      className={cx(
                        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] transition-colors',
                        settings.accent === option.value
                          ? 'border-accent bg-accent-soft text-ink'
                          : 'border-line bg-panel text-ink-muted hover:border-line-strong',
                      )}
                      aria-pressed={settings.accent === option.value}
                    >
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded-full"
                        style={{ backgroundColor: option.color }}
                      >
                        {settings.accent === option.value ? (
                          <Check size={10} className="text-[#0b0b10]" />
                        ) : null}
                      </span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-[12.5px] font-semibold text-ink">Atmosphere</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {AMBIENCES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateSettings({ ambience: option.value })}
                      className={cx(
                        'rounded-xl border px-3 py-2.5 text-left transition-colors',
                        settings.ambience === option.value
                          ? 'border-accent bg-accent-soft'
                          : 'border-line bg-panel hover:border-line-strong',
                      )}
                      aria-pressed={settings.ambience === option.value}
                    >
                      <span
                        className={cx(
                          'mb-2 block h-7 rounded-md border border-line bg-canvas',
                          option.value === 'grid' && 'site-preview-grid',
                          option.value === 'glow' && 'site-preview-glow',
                        )}
                      />
                      <span className="block text-[11.5px] font-medium text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-[10px] text-ink-faint">{option.detail}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-[12.5px] font-semibold text-ink">Corners</h3>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {CORNERS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateSettings({ corners: option.value })}
                        className={cx(
                          'border px-1 py-2 text-[10.5px] transition-colors',
                          settings.corners === option.value
                            ? 'border-accent bg-accent-soft text-ink'
                            : 'border-line bg-panel text-ink-muted hover:border-line-strong',
                        )}
                        style={{ borderRadius: option.radius }}
                        aria-pressed={settings.corners === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[12.5px] font-semibold text-ink">Reading font</h3>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {READING_FONTS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateSettings({ readingFont: option.value })}
                        className={cx(
                          'rounded-lg border px-2 py-1.5 text-left transition-colors',
                          settings.readingFont === option.value
                            ? 'border-accent bg-accent-soft'
                            : 'border-line bg-panel hover:border-line-strong',
                        )}
                        aria-pressed={settings.readingFont === option.value}
                      >
                        <span className={cx('block text-[15px] text-ink', option.className)}>Aa</span>
                        <span className="block text-[10px] text-ink-faint">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid gap-2.5 sm:grid-cols-2">
                <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-panel px-3.5 py-3">
                  <div>
                    <p className="text-[12px] font-medium text-ink">Compact sidebar</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                      Narrow the conversation rail and keep more room for the page.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.sidebarCompact}
                    onChange={(event) => updateSettings({ sidebarCompact: event.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                    aria-label="Compact sidebar"
                  />
                </div>
                <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-panel px-3.5 py-3">
                  <div>
                    <p className="text-[12px] font-medium text-ink">Reduce motion</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                      Turn off fade and caret animations across the interface.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.reduceMotion}
                    onChange={(event) => updateSettings({ reduceMotion: event.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                    aria-label="Reduce motion"
                  />
                </div>
              </section>

              <section>
                <h3 className="text-[12.5px] font-semibold text-ink">Preview</h3>
                <div className="mt-2 rounded-xl border border-line bg-canvas p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                      M
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-ink">Movaryn</p>
                      <p className="prose-movaryn mt-1 text-[12.5px]">
                        The kit reads cleanly: one way in, one extension, one finish. This preview follows
                        your accent, corners and reading font.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="btn btn-primary h-7 px-2.5 text-[11px]">Primary</span>
                    <span className="btn btn-secondary h-7 px-2.5 text-[11px]">Secondary</span>
                    <span className="chip">Chip</span>
                  </div>
                </div>
              </section>

              <p className="text-[11px] leading-relaxed text-ink-faint">
                Design settings belong to the current account workspace and do not leave this device.
              </p>
            </div>
          ) : null}

          {tab === 'data' ? (
            <div className="flex flex-col gap-4">
              <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
                <h3 className="text-[12.5px] font-semibold text-ink">Stored on this device</h3>
                <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                  <li>
                    Conversations, move text, projects, notebook sources and generated images live in
                    IndexedDB.
                  </li>
                  <li>
                    Each account has its own local workspace. Accounts do not sync conversations,
                    projects or notebooks between devices; encrypted account backups move them.
                  </li>
                  <li>Deleting a chat or project removes its record and its images.</li>
                </ul>
              </section>
              <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
                <h3 className="text-[12.5px] font-semibold text-ink">Sent to your provider</h3>
                <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                  <li>
                    Your messages, the project brief, recent reference images you attach, and notebook
                    sources when you ask the notebook a question.
                  </li>
                  <li>Image prompts and reference images when you generate concept art.</li>
                  <li>
                    Nothing else. Check your provider&apos;s retention policy — Movaryn does not upload your
                    work anywhere it was not explicitly sent.
                  </li>
                </ul>
              </section>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary" onClick={exportAll}>
                  Export this workspace
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() =>
                    requestConfirm({
                      title: 'Delete this workspace?',
                      body: 'Every conversation, project, saved move and generated image in the current workspace will be removed. Other accounts and the guest workspace are untouched. This cannot be undone.',
                      confirmLabel: 'Delete workspace',
                      danger: true,
                      onConfirm: () => void resetAllData(),
                    })
                  }
                >
                  Delete workspace
                </button>
              </div>
            </div>
          ) : null}

          {tab === 'credits' ? (
            <div className="flex flex-col gap-4">
              <section className="rounded-xl border border-line bg-panel px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-[17px] font-semibold text-accent">
                    R
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold tracking-tight text-ink">Raevik</h3>
                    <p className="mt-0.5 text-[11.5px] text-ink-muted">Creator of Movaryn</p>
                  </div>
                  <Heart size={16} className="ml-auto shrink-0 text-accent" />
                </div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">
                  Movaryn is designed and built by Raevik — the moveset studio, the concept art briefs and
                  the character cards all come from that work.
                </p>
              </section>

              <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
                <h3 className="text-[12px] font-semibold text-ink">Built with</h3>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                  React, Vite, Tailwind CSS and Electron, with icons from lucide. Moveset text is drawn on
                  your device, so cards and exports stay readable without a provider.
                </p>
              </section>

              <p className="text-[11px] leading-relaxed text-ink-faint">
                Thanks for building movesets with it. If you make something with Movaryn, that is the
                credit worth having.
              </p>
            </div>
          ) : null}

          {tab === 'about' ? (
            <div className="flex flex-col gap-4 text-[11.5px] leading-relaxed text-ink-muted">
              <section>
                <h3 className="text-[14px] font-semibold tracking-tight text-ink">Movaryn</h3>
                <p className="mt-1">Better ideas. Better movesets. Built for creators.</p>
                <p className="mt-2">
                  Version {provider?.version ?? APP_VERSION}
                  {window.movarynDesktop ? ' · Desktop app' : ' · Web app'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary h-8 text-[12px]"
                    onClick={() => {
                      close();
                      useApp.getState().openWhatsNew();
                    }}
                  >
                    What&apos;s new
                  </button>
                  <a
                    className="btn btn-secondary h-8 text-[12px]"
                    href={ROADMAP_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Roadmap
                  </a>
                  <a
                    className="btn btn-ghost h-8 text-[12px]"
                    href={CHANGELOG_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Update log
                  </a>
                </div>
              </section>
              <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
                <h3 className="text-[12px] font-semibold text-ink">Keyboard</h3>
                <ul className="mt-2 space-y-1">
                  <li>
                    <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px]">
                      Ctrl/⌘ K
                    </kbd>{' '}
                    open the command palette
                  </li>
                  <li>
                    <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px]">
                      Ctrl/⌘ B
                    </kbd>{' '}
                    collapse the sidebar
                  </li>
                  <li>
                    <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px]">
                      Ctrl/⌘ + Shift + N
                    </kbd>{' '}
                    open the notebook
                  </li>
                  <li>
                    <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px]">
                      Enter
                    </kbd>{' '}
                    send ·{' '}
                    <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px]">
                      Shift + Enter
                    </kbd>{' '}
                    new line
                  </li>
                </ul>
              </section>
              <p>
                Movaryn is an independent tool. It is not affiliated with Roblox, Jujutsu Shenanigans, The
                Strongest Battlegrounds, or any other game or studio mentioned. Game mechanics change between
                updates — always check the current version.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-2.5">
      {ok ? (
        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-ok" />
      ) : (
        <XCircle size={14} className="mt-0.5 shrink-0 text-warn" />
      )}
      <div className="min-w-0">
        <p className="text-[12px] text-ink">{label}</p>
        <p className="mt-0.5 break-words text-[11px] text-ink-faint">{detail}</p>
      </div>
    </div>
  );
}
