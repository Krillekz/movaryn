import { useMemo } from 'react';
import changelogRaw from '../../CHANGELOG.md?raw';
import { APP_VERSION, WHATS_NEW_KEY } from '../lib/appVersion';
import { splitChangelog } from '../lib/changelog';
import { CHANGELOG_URL, ROADMAP_URL, openExternal } from '../lib/links';
import { useApp } from '../store/useApp';
import { Markdown } from './Markdown';
import { Modal } from './ui/Modal';

export function WhatsNewDialog() {
  const open = useApp((state) => state.ui.whatsNewOpen);
  const close = useApp((state) => state.closeWhatsNew);
  const sections = useMemo(() => splitChangelog(changelogRaw, 3), []);

  const acknowledge = () => {
    try {
      localStorage.setItem(WHATS_NEW_KEY, APP_VERSION);
    } catch {
      // A blocked storage write only means the notes open again next launch.
    }
    close();
  };

  return (
    <Modal
      open={open}
      onClose={acknowledge}
      title="What's new"
      description={`Movaryn ${APP_VERSION} — the newest changes, straight from the update log.`}
      width="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost h-8 text-[12px]"
              onClick={() => openExternal(CHANGELOG_URL)}
            >
              Full update log
            </button>
            <button
              type="button"
              className="btn btn-ghost h-8 text-[12px]"
              onClick={() => openExternal(ROADMAP_URL)}
            >
              Roadmap
            </button>
          </div>
          <button type="button" className="btn btn-primary h-8 text-[12px]" onClick={acknowledge}>
            Done
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {sections.map((section, index) => (
          <article
            key={section.version}
            className="rounded-xl border border-line bg-panel px-4 py-3.5"
          >
            <header className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                {section.version}
              </h3>
              <span className="text-[12px] text-ink-muted">{section.title}</span>
              {index === 0 ? (
                <span className="chip ml-auto border-accent/40 text-accent">Latest</span>
              ) : null}
            </header>
            <Markdown className="mt-2 text-[12px]">{section.body}</Markdown>
          </article>
        ))}
        <p className="px-1 text-[11px] leading-relaxed text-ink-faint">
          Notes are generated from the same CHANGELOG.md as the public update log, so they cannot
          drift apart.
        </p>
      </div>
    </Modal>
  );
}
