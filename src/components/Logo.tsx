import { cx } from '../lib/utils';

export function LogoMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M15 44 L23.5 19 L32 35 L40.5 19 L49 44"
        stroke="currentColor"
        strokeWidth="5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="49.5" r="3.1" fill="currentColor" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <LogoMark className="h-5 w-5" />
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <LogoMark className="h-5 w-5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-ink">Movaryn</span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Moveset studio
        </span>
      </span>
    </span>
  );
}

export function WelcomeMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={cx(
        'flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-panel-2 text-accent shadow-sm',
        className,
      )}
    >
      <LogoMark className="h-7 w-7" />
    </span>
  );
}
