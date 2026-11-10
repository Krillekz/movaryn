import { useMemo } from 'react';
import { Copy, Download, ExternalLink } from 'lucide-react';
import type { SharedKit } from '../../shared/shareKit';
import { presetForGame, runSandbox } from '../../shared/sandbox';
import { copyText, downloadText, slugify } from '../lib/utils';
import { LogoMark } from './Logo';
import { briefModeLabel } from '../../shared/brief';

export function SharedKitView({ kit }: { kit: SharedKit }) {
  const report = useMemo(
    () =>
      runSandbox(
        kit.moves.map((move, index) => ({
          id: `shared_${index}`,
          name: move.n,
          description: move.d,
          purpose: move.p,
        })),
        presetForGame(kit.game),
      ),
    [kit],
  );

  const movesetText = [
    `CHARACTER: ${kit.name}`,
    kit.game ? `GAME: ${kit.game}` : '',
    kit.theme ? `THEME: ${kit.theme}` : '',
    '',
    ...kit.moves.map(
      (move, index) =>
        `${index + 1}. ${move.n}${move.p ? ` (${move.p})` : ''}\nDescription: ${move.d}`,
    ),
  ]
    .join('\n')
    .trim();

  return (
    <div className="min-h-full bg-canvas text-ink">
      <header className="border-b border-line bg-panel/70">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <LogoMark className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold leading-tight">Movaryn</p>
              <p className="text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
                Shared kit · read only
              </p>
            </div>
          </div>
          <a className="btn btn-ghost h-8 text-[12px]" href="./">
            Open Movaryn
            <ExternalLink size={13} />
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-accent">
          Character kit
        </p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight">{kit.name}</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          {[kit.game, kit.theme].filter(Boolean).join(' · ') || 'No game named'}
        </p>
        {kit.constraints ? (
          <p className="mt-3 rounded-lg border border-line bg-panel px-3 py-2 text-[12.5px] leading-relaxed text-ink-muted">
            {kit.constraints}
          </p>
        ) : null}

        {kit.brief ? (
          <section className="mt-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Character brief — {briefModeLabel(kit.brief.mode)}
            </h2>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {[kit.brief.series, kit.brief.version].filter(Boolean).join(' · ') ||
                'No series recorded'}
            </p>
            {kit.brief.facts.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-muted">
                {kit.brief.facts.map((fact, index) => (
                  <li key={index} className="flex gap-1.5">
                    <span className="text-ink-faint">•</span>
                    <span>
                      {fact.t}
                      {fact.s ? <span className="text-ink-faint"> [{fact.s}]</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <section className="mt-7">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Moves ({kit.moves.length})
          </h2>
          <div className="mt-2 space-y-2">
            {kit.moves.map((move, index) => (
              <article key={index} className="rounded-xl border border-line bg-panel px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[14px] font-medium">
                    {index + 1}. {move.n}
                  </h3>
                  {move.p ? <span className="chip">{move.p}</span> : null}
                </div>
                <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-ink-muted">
                  {move.d}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-7">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Sandbox estimates — {report.presetName}
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
            Estimated from the written moves and a game preset. Not measured frame data.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {report.counterplay.map((line) => (
              <div key={line.answer} className="rounded-lg border border-line bg-panel px-3 py-2">
                <p className="flex items-center justify-between gap-2 text-[12px] font-medium">
                  {line.answer}
                  <span
                    className={
                      line.verdict === 'holds'
                        ? 'text-[10.5px] uppercase tracking-wide text-accent'
                        : line.verdict === 'even'
                          ? 'text-[10.5px] uppercase tracking-wide text-warn'
                          : 'text-[10.5px] uppercase tracking-wide text-danger'
                    }
                  >
                    {line.verdict === 'holds' ? 'Covered' : line.verdict === 'even' ? 'Even' : 'Open'}
                  </span>
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">{line.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-7 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary h-8 text-[12px]"
            onClick={() => void copyText(movesetText)}
          >
            <Copy size={13} />
            Copy moveset
          </button>
          <button
            type="button"
            className="btn btn-ghost h-8 text-[12px]"
            onClick={() =>
              downloadText(
                `movaryn-${slugify(kit.name, 40)}-shared.md`,
                `# ${kit.name}\n\n${movesetText}`,
                'text/markdown',
              )
            }
          >
            <Download size={13} />
            Download Markdown
          </button>
        </div>
      </main>

      <footer className="border-t border-line px-5 py-5 text-center text-[10.5px] text-ink-faint">
        Read-only kit shared from Movaryn. It travelled in the link — nothing was uploaded, and no
        provider key is part of it.
      </footer>
    </div>
  );
}
