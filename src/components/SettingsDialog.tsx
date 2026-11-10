import { useState } from 'react';
import {
  CheckCircle2,
  Database,
  Heart,
  Info,
  Loader2,
  Monitor,
  Moon,
  Palette,
  Plug,
  RefreshCw,
  SlidersHorizontal,
  Sun,
  XCircle,
} from 'lucide-react';
import type { ImageQuality, ThemePreference } from '../../shared/types';
import { ASPECT_RATIOS } from '../../shared/types';
import { fetchHealth } from '../lib/api';
import { apiBase, isBrowserBuild, setApiBase } from '../lib/apiBase';
import { useApp } from '../store/useApp';
import { cx, downloadJson } from '../lib/utils';
import { Modal } from './ui/Modal';

type TabId = 'provider' | 'models' | 'appearance' | 'data' | 'credits' | 'about';

const TABS: { id: TabId; label: string; icon: typeof Plug }[] = [
  { id: 'provider', label: 'Provider', icon: Plug },
  { id: 'models', label: 'Models', icon: SlidersHorizontal },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'data', label: 'Data & privacy', icon: Database },
  { id: 'credits', label: 'Credits', icon: Heart },
  { id: 'about', label: 'About', icon: Info },
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

  const [tab, setTab] = useState<TabId>('provider');
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
    const state = useApp.getState();
    downloadJson('movaryn-export.json', {
      exportedAt: new Date().toISOString(),
      version: provider?.version ?? '1.0.0',
      settings: state.settings,
      conversations: state.order.map((id) => state.conversations[id]).filter(Boolean),
      projects: state.projectOrder.map((id) => state.projects[id]).filter(Boolean),
    });
    pushToast('Export downloaded.', 'success');
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Settings"
      description="Provider connection, models, appearance and local data."
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

          {tab === 'appearance' ? (
            <div className="flex flex-col gap-4">
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
                      >
                        <Icon size={15} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>
              <p className="text-[11.5px] leading-relaxed text-ink-muted">
                Movaryn defaults to the dark interface. The layout, contrast and focus states are the same in
                both themes.
              </p>
            </div>
          ) : null}

          {tab === 'data' ? (
            <div className="flex flex-col gap-4">
              <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
                <h3 className="text-[12.5px] font-semibold text-ink">Stored on this device</h3>
                <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                  <li>Conversations, move text, projects, settings and generated images live in IndexedDB.</li>
                  <li>Nothing is stored on a Movaryn account — there are no accounts.</li>
                  <li>Deleting a chat or project removes its record and its images.</li>
                </ul>
              </section>
              <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
                <h3 className="text-[12.5px] font-semibold text-ink">Sent to your provider</h3>
                <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-ink-muted">
                  <li>Your messages, the project brief, and recent reference images you attach.</li>
                  <li>Image prompts and reference images when you generate concept art.</li>
                  <li>
                    Nothing else. Check your provider&apos;s retention policy — Movaryn does not upload your
                    work anywhere it was not explicitly sent.
                  </li>
                </ul>
              </section>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary" onClick={exportAll}>
                  Export all data
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() =>
                    requestConfirm({
                      title: 'Delete all local data?',
                      body: 'Every conversation, project, saved move and generated image on this device will be removed. This cannot be undone.',
                      confirmLabel: 'Delete everything',
                      danger: true,
                      onConfirm: () => void resetAllData(),
                    })
                  }
                >
                  Delete everything
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
                  Version {provider?.version ?? '1.0.0'}
                  {window.movarynDesktop ? ' · Desktop app' : ' · Web app'}
                </p>
              </section>
              <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
                <h3 className="text-[12px] font-semibold text-ink">Keyboard</h3>
                <ul className="mt-2 space-y-1">
                  <li>
                    <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px]">
                      Ctrl/⌘ K
                    </kbd>{' '}
                    search chats
                  </li>
                  <li>
                    <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px]">
                      Ctrl/⌘ B
                    </kbd>{' '}
                    collapse the sidebar
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
