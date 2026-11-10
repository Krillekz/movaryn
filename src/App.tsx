import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ApiSetupBanner } from './components/ApiSetupBanner';
import { ChatView } from './components/ChatView';
import { SettingsDialog } from './components/SettingsDialog';
import { ProjectDrawer } from './components/ProjectDrawer';
import { ImageBriefDialog } from './components/ImageBriefDialog';
import { IdeaLibraryDialog } from './components/IdeaLibraryDialog';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { Toasts } from './components/ui/Toasts';
import { LogoMark } from './components/Logo';
import { fetchHealth } from './lib/api';
import { apiBase, isBrowserBuild } from './lib/apiBase';
import { useApp } from './store/useApp';

export default function App() {
  const hydrated = useApp((state) => state.hydrated);
  const theme = useApp((state) => state.settings.theme);

  useEffect(() => {
    void useApp.getState().hydrate();
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = resolved;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', resolved === 'light' ? '#f4f4f7' : '#08080b');
    };
    apply();
    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      // One retry keeps a server restart from flashing a false offline banner.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const status = await fetchHealth();
          if (!cancelled) useApp.getState().setProvider(status, null);
          return;
        } catch (error) {
          if (attempt === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 1_500));
            continue;
          }
          if (!cancelled) {
            useApp.getState().setProvider(
              null,
              isBrowserBuild && !apiBase
                ? 'Connect this browser build to a Movaryn API to start.'
                : error instanceof Error
                  ? error.message
                  : 'The API is unreachable.',
            );
          }
        }
      }
    };
    void check();
    const interval = window.setInterval(() => {
      const state = useApp.getState();
      // A static page with no API configured has nothing to poll for.
      if (isBrowserBuild && !apiBase) return;
      if (!state.provider || !state.provider.chat.configured) void check();
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        const state = useApp.getState();
        if (state.ui.sidebarCollapsed) state.setSidebarCollapsed(false);
        window.setTimeout(() => document.getElementById('movaryn-search')?.focus(), 60);
      } else if (key === 'b') {
        event.preventDefault();
        const state = useApp.getState();
        state.setSidebarCollapsed(!state.ui.sidebarCollapsed);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <LogoMark className="h-6 w-6" />
          </span>
          <p className="text-[12px] text-ink-faint">Opening your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-canvas text-ink">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <ApiSetupBanner />
        <ChatView />
      </main>
      <SettingsDialog />
      <ProjectDrawer />
      <ImageBriefDialog />
      <IdeaLibraryDialog />
      <ConfirmDialog />
      <Toasts />
    </div>
  );
}
