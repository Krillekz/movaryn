import { useMemo, useState } from 'react';
import { ClipboardCheck, Copy, CornerDownRight, LayoutTemplate, ListChecks, Sparkles } from 'lucide-react';
import type { ParsedMove, ParsedResponse } from '../../shared/moveset';
import { moveToText } from '../../shared/moveset';
import { Markdown } from './Markdown';
import { CopyButton } from './ui/CopyButton';
import { useApp } from '../store/useApp';
import { copyText, cx } from '../lib/utils';
import { auditKit } from '../../shared/kitAudit';
import { kitReviewPrompt } from '../../shared/promptIdeas';
import { CharacterCardDialog } from './CharacterCardDialog';

interface MovesetViewProps {
  parsed: ParsedResponse;
  content: string;
  conversationId: string;
}

const META_ROWS: { key: 'character' | 'theme' | 'game'; label: string }[] = [
  { key: 'character', label: 'Character' },
  { key: 'theme', label: 'Theme' },
  { key: 'game', label: 'Game' },
];

export function MovesetView({ parsed, content, conversationId }: MovesetViewProps) {
  const [raw, setRaw] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const setDraft = useApp((state) => state.setDraft);
  const audit = useMemo(() => auditKit(parsed.moves), [parsed.moves]);
  const hasMeta = META_ROWS.some((row) => parsed.meta[row.key]);

  const reviewKit = () => {
    setDraft(kitReviewPrompt(parsed.moves, parsed.meta.character));
    useApp.getState().pushToast('Review prompt added to the composer.', 'success');
    window.requestAnimationFrame(() => document.getElementById('movaryn-composer')?.focus());
  };

  if (raw) {
    return (
      <div className="mt-1">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-ink-faint">Raw text</span>
          <button
            type="button"
            className="btn btn-ghost h-7 px-2 text-[11.5px]"
            onClick={() => setRaw(false)}
          >
            Formatted view
          </button>
        </div>
        <pre className="scroll-thin max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-panel px-4 py-3 font-sans text-[13.5px] leading-relaxed text-ink-muted">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          <Sparkles size={12} className="text-accent" />
          Moveset
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost h-7 px-2 text-[11.5px]"
            onClick={() => setRaw(true)}
          >
            Raw text
          </button>
          <button
            type="button"
            className="btn btn-ghost h-7 px-2 text-[11.5px]"
            onClick={() => setCheckOpen((value) => !value)}
            title="Local checks on this kit — no provider request"
            aria-expanded={checkOpen}
          >
            <ListChecks size={12} />
            Kit check
          </button>
          <button
            type="button"
            className="btn btn-ghost h-7 px-2 text-[11.5px]"
            onClick={reviewKit}
            title="Draft a structured review of this kit"
          >
            <ClipboardCheck size={12} />
            Review kit
          </button>
          <button
            type="button"
            className="btn btn-secondary h-7 px-2 text-[11.5px]"
            onClick={() => setCardOpen(true)}
            title="Make a character card from this moveset"
          >
            <LayoutTemplate size={12} />
            Character card
          </button>
          <button
            type="button"
            className="btn btn-secondary h-7 px-2 text-[11.5px]"
            onClick={async () => {
              const ok = await copyText(content);
              useApp
                .getState()
                .pushToast(ok ? 'Full moveset copied.' : 'Copy failed — select the text manually.', ok ? 'success' : 'danger');
            }}
          >
            <Copy size={12} />
            Copy moveset
          </button>
        </div>
      </div>

      {hasMeta ? (
        <dl className="mb-4 grid gap-x-5 gap-y-2 rounded-xl border border-line bg-panel-2 px-4 py-3 sm:grid-cols-2">
          {META_ROWS.map((row) => {
            const value = parsed.meta[row.key];
            if (!value) return null;
            return (
              <div key={row.key} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  {row.label}
                </dt>
                <dd className="mt-0.5 whitespace-pre-line break-words text-[13.5px] leading-relaxed text-ink">
                  {value}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}

      {checkOpen ? (
        <div className="mb-4 rounded-xl border border-line bg-panel-2 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
              <ListChecks size={12} className="text-accent" />
              Kit check
            </span>
            <span
              className={cx(
                'text-[11px] font-medium tabular-nums',
                audit.score === 100 ? 'text-ok' : audit.score >= 60 ? 'text-warn' : 'text-danger',
              )}
            >
              {audit.passed}/{audit.items.length} checks · {audit.score}%
            </span>
          </div>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {audit.items.map((item) => (
              <li key={item.label} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
                <span
                  className={cx(
                    'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                    item.status === 'pass'
                      ? 'bg-ok'
                      : item.status === 'warn'
                        ? 'bg-warn'
                        : 'bg-danger',
                  )}
                  aria-hidden="true"
                />
                <span className="text-ink">{item.label}</span>
                <span className="min-w-0 text-ink-faint">{item.detail}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10.5px] text-ink-faint">
            Checked locally in the app. This looks at structure and naming, not whether the idea is fun.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {parsed.blocks.map((block, index) => {
          if (block.type === 'section') {
            return (
              <div key={`section-${index}`} className="mt-3 flex items-center gap-3 first:mt-0">
                <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                  {block.title}
                </h3>
                <span className="h-px flex-1 bg-line" />
              </div>
            );
          }
          if (block.type === 'move') {
            return <MoveCard key={`move-${index}-${block.move.name}`} move={block.move} />;
          }
          return <Markdown key={`text-${index}`} className="text-[14px] text-ink-muted">{block.text}</Markdown>;
        })}
      </div>

      <CharacterCardDialog
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        parsed={parsed}
        conversationId={conversationId}
      />
    </div>
  );
}

function MoveCard({ move }: { move: ParsedMove }) {
  const extraFields = move.fields.filter(
    (field) => !/^(description|action|sequence|purpose|role)$/i.test(field.label),
  );
  const description =
    move.description ||
    move.fields.find((field) => /^(description|action|sequence)$/i.test(field.label))?.value ||
    '';

  return (
    <article className="group relative rounded-xl border border-line bg-panel-2 px-4 py-3 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          {move.number ? (
            <span className="shrink-0 text-[11px] font-semibold tabular-nums leading-5 text-ink-faint">
              {String(move.number).padStart(2, '0')}
            </span>
          ) : (
            <CornerDownRight size={13} className="mt-1 shrink-0 text-ink-faint" />
          )}
          <h4 className="text-[15px] font-semibold leading-5 tracking-tight text-ink">{move.name}</h4>
        </div>
        <CopyButton
          text={moveToText(move)}
          label={`Copy ${move.name}`}
          className="h-7 w-7 shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
          onCopied={(ok) =>
            useApp
              .getState()
              .pushToast(ok ? `${move.name} copied.` : 'Copy failed.', ok ? 'success' : 'danger')
          }
        />
      </div>

      {move.purpose ? (
        <div className="mt-1.5">
          <span className="chip">{move.purpose}</span>
        </div>
      ) : null}

      {description ? (
        <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink-muted">
          {description}
        </p>
      ) : null}

      {extraFields.length > 0 ? (
        <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2">
          {extraFields.map((field, index) => (
            <div key={`${field.label}-${index}`} className="flex min-w-0 gap-1.5 text-[11.5px]">
              <dt className="text-ink-faint">{field.label}:</dt>
              <dd className={cx('text-ink-muted')}>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}
