import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '../../store/useApp';
import { cx } from '../../lib/utils';

export function Toasts() {
  const toasts = useApp((state) => state.toasts);
  const dismiss = useApp((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
      {toasts.map((toast) => {
        const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'danger' ? AlertTriangle : Info;
        return (
          <div
            key={toast.id}
            role="status"
            className={cx(
              'pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border bg-panel-2 px-3.5 py-2.5 text-[13px] shadow-xl animate-in',
              toast.tone === 'danger'
                ? 'border-danger/30 text-danger'
                : toast.tone === 'success'
                  ? 'border-ok/30 text-ink'
                  : 'border-line text-ink',
            )}
          >
            <Icon
              size={16}
              className={cx(
                'mt-0.5 shrink-0',
                toast.tone === 'success' ? 'text-ok' : toast.tone === 'danger' ? 'text-danger' : 'text-accent',
              )}
            />
            <p className="flex-1 leading-relaxed">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="icon-btn -mr-1 -mt-1 h-6 w-6 shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
