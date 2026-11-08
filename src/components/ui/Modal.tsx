import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  placement?: 'center' | 'right';
  /** Keeps the header compact and lets the body own its own padding. */
  bodyClassName?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-2xl',
  placement = 'center',
  bodyClassName,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const firstField = panel.querySelector<HTMLElement>('input, textarea, select');
      const first = firstField ?? panel.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 40);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
      previousActive?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleTab = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className={cx(
        'fixed inset-0 z-50 flex',
        placement === 'right' ? 'justify-end' : 'items-end justify-center sm:items-center sm:p-6',
      )}
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={handleTab}
        className={cx(
          'relative flex w-full flex-col overflow-hidden border border-line bg-panel-2 shadow-2xl animate-in',
          placement === 'right'
            ? 'h-full max-w-xl border-y-0 border-r-0'
            : cx('max-h-[92dvh] rounded-t-2xl sm:rounded-2xl', width),
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
            {description ? (
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{description}</p>
            ) : null}
          </div>
          <button type="button" className="icon-btn -mr-1 -mt-1" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className={cx('scroll-thin flex-1 overflow-y-auto', bodyClassName ?? 'px-5 py-4')}>
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-line bg-panel px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
