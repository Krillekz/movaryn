import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ApiSetupBanner } from './components/ApiSetupBanner';
import { ChatView } from './components/ChatView';
import { SettingsDialog } from './components/SettingsDialog';
import { ProjectDrawer } from './components/ProjectDrawer';
import { KitToolsDialog } from './components/KitToolsDialog';
import { SharedKitView } from './components/SharedKitView';
import { ImageBriefDialog } from './components/ImageBriefDialog';
import { IdeaLibraryDialog } from './components/IdeaLibraryDialog';
import { CommandPalette } from './components/CommandPalette';
import { WhatsNewDialog } from './components/WhatsNewDialog';
import { NotebookDialog } from './components/NotebookDialog';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { Toasts } from './components/ui/Toasts';
import { LogoMark } from './components/Logo';
import { fetchHealth } from './lib/api';
import { apiBase, isBrowserBuild } from './lib/apiBase';
import { APP_VERSION, WHATS_NEW_KEY } from './lib/appVersion';
import { useApp } from './store/useApp';
import { sharedKitFromLocation } from '../shared/shareKit';

export default function App() {
  const hydrated = useApp((state) => state.hydrated);
  const theme = useApp((state) => state.settings.theme);
  const layoutWidth = useApp((state) => state.settings.layoutWidth);
  const layoutDensity = useApp((state) => state.settings.layoutDensity);
  // A shared kit opens read-only and never touches the local workspace.
  const [sharedKit] = useState(() =>
    typeof window === 'undefined' ? null : sharedKitFromLocation(window.location.hash),
  );

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
    document.documentElement.dataset.chatWidth = layoutWidth;
    document.documentElement.dataset.chatDensity = layoutDensity;
  }, [layoutWidth, layoutDensity]);

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
    if (!hydrated) return;
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(WHATS_NEW_KEY);
    } catch {
      return;
    }
    if (seen === APP_VERSION) return;
    const timer = window.setTimeout(() => useApp.getState().openWhatsNew(), 800);
    return () => window.clearTimeout(timer);
  }, [hydrated]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        useApp.getState().openPalette();
      } else if (key === 'b') {
        event.preventDefault();
        const state = useApp.getState();
        state.setSidebarCollapsed(!state.ui.sidebarCollapsed);
      } else if (key === 'n' && event.shiftKey) {
        event.preventDefault();
        useApp.getState().openNotebook();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (sharedKit) {
    return <SharedKitView kit={sharedKit} />;
  }

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
      <KitToolsDialog />
      <ImageBriefDialog />
      <IdeaLibraryDialog />
      <CommandPalette />
      <WhatsNewDialog />
      <NotebookDialog />
      <ConfirmDialog />
      <Toasts />
    </div>
  );
}
