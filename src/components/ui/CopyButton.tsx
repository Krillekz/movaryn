import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyText, cx } from '../../lib/utils';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  onCopied?: (ok: boolean) => void;
}

export function CopyButton({ text, label = 'Copy', className, onCopied }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <button
      type="button"
      className={cx('icon-btn', className)}
      title={label}
      aria-label={label}
      onClick={async () => {
        const ok = await copyText(text);
        onCopied?.(ok);
        if (!ok) return;
        setCopied(true);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1_600);
      }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}
