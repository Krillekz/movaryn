import { useState, type FormEvent } from 'react';
import { Plug, X } from 'lucide-react';
import { apiBase, isBrowserBuild, setApiBase } from '../lib/apiBase';
import { useApp } from '../store/useApp';

/**
 * Shown only in the static browser build before a server URL is saved. The page
 * has no API of its own, so this is configured instead of faked.
 */
export function ApiSetupBanner() {
  const connected = useApp((state) => Boolean(state.provider));
  const [value, setValue] = useState(apiBase);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  // A same-origin API (dev server or Node host) needs no setup bar.
  if (!isBrowserBuild || apiBase || connected || dismissed) return null;

  const connect = (event: FormEvent) => {
    event.preventDefault();
    const saved = setApiBase(value);
    if (!saved) {
      setError(
        'Enter the full http(s) URL of your Movaryn API, for example https://movaryn-api.example.com.',
      );
      return;
    }
    window.location.reload();
  };

  return (
    <div className="border-b border-warn/30 bg-warn/5 px-3 py-2.5 md:px-5">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex items-start gap-2">
          <Plug size={14} className="mt-0.5 shrink-0 text-warn" />
          <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-ink-muted">
            <span className="font-semibold text-ink">Browser build.</span> Connect it to a Movaryn API
            you run — provider keys stay on that server, never in this page.{' '}
            <a
              className="text-accent underline underline-offset-2"
              href="https://github.com/Krillekz/movaryn#browser-build"
              target="_blank"
              rel="noreferrer"
            >
              How to host it
            </a>
          </p>
          <button
            type="button"
            className="icon-btn"
            aria-label="Hide the API setup bar"
            title="Hide"
            onClick={() => setDismissed(true)}
          >
            <X size={14} />
          </button>
        </div>
        <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={connect}>
          <input
            className="field h-8 sm:flex-1"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError('');
            }}
            placeholder="https://your-movaryn-api.example.com"
            aria-label="Movaryn API URL"
            spellCheck={false}
            inputMode="url"
          />
          <button type="submit" className="btn btn-primary h-8 shrink-0 text-[12px]">
            Connect
          </button>
        </form>
        {error ? <p className="text-[11px] text-danger">{error}</p> : null}
      </div>
    </div>
  );
}
