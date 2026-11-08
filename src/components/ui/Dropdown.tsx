import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../lib/utils';

interface DropdownProps {
  label: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  buttonClassName?: string;
  className?: string;
}

export function Dropdown({
  label,
  trigger,
  children,
  align = 'right',
  buttonClassName,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={cx('relative', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
        className={buttonClassName ?? 'icon-btn'}
      >
        {trigger}
      </button>
      {open ? (
        <div
          role="menu"
          className={cx(
            'absolute z-40 mt-1 min-w-[196px] overflow-hidden rounded-xl border border-line bg-panel-2 p-1 shadow-xl animate-in',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

interface DropdownItemProps {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function DropdownItem({ children, onClick, danger, disabled }: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors disabled:opacity-40',
        danger ? 'text-danger hover:bg-danger/10' : 'text-ink hover:bg-surface',
      )}
    >
      {children}
    </button>
  );
}
