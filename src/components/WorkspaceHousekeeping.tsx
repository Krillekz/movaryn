import { useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useApp } from '../store/useApp';
import { listAccountWorkspaceOwners } from '../lib/account';
import {
  deleteWorkspaceDb,
  listAccountWorkspaceDatabases,
  workspaceSummary,
  type WorkspaceSummary,
} from '../lib/db';

interface LeftoverWorkspace {
  id: string;
  summary: WorkspaceSummary;
}

type ScanState = 'idle' | 'scanning' | 'done' | 'unsupported';

function countLabel(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function contents(summary: WorkspaceSummary): string {
  return `${countLabel(summary.conversations, 'chat')} · ${countLabel(summary.projects, 'project')} · ${countLabel(summary.notebooks, 'notebook')}`;
}

export function WorkspaceHousekeeping() {
  const workspaceOwner = useApp((state) => state.workspaceOwner);
  const pushToast = useApp((state) => state.pushToast);
  const requestConfirm = useApp((state) => state.requestConfirm);

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [leftovers, setLeftovers] = useState<LeftoverWorkspace[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);

  const scan = async () => {
    setScanState('scanning');
    try {
      const [owners, listing] = await Promise.all([
        listAccountWorkspaceOwners(),
        listAccountWorkspaceDatabases(),
      ]);
      if (!listing.supported) {
        setLeftovers([]);
        setScanState('unsupported');
        return;
      }
      const orphaned = listing.workspaces.filter(
        (workspace) => workspace.ownerId !== workspaceOwner && !owners.includes(workspace.ownerId),
      );
      const found = await Promise.all(
        orphaned.map(async (workspace) => ({
          id: workspace.ownerId,
          summary: await workspaceSummary(workspace.ownerId),
        })),
      );
      setLeftovers(found.sort((a, b) => b.summary.total - a.summary.total));
      setScanState('done');
    } catch {
      setScanState('idle');
      pushToast('Could not check local accounts. Nothing was removed.', 'danger');
    }
  };

  const performRemove = async (targets: LeftoverWorkspace[]) => {
    const ids = targets.map((target) => target.id);
    setRemoving(ids.length === 1 ? ids[0] : 'all');
    try {
      const removed: string[] = [];
      for (const id of ids) {
        if (await deleteWorkspaceDb(id)) removed.push(id);
      }
      setLeftovers((current) => current.filter((item) => !removed.includes(item.id)));
      if (removed.length > 0) {
        pushToast(
          `${removed.length} leftover workspace${removed.length === 1 ? '' : 's'} removed.`,
          'success',
        );
      }
      if (removed.length < ids.length) {
        pushToast(
          'Some workspaces could not be removed. Close other Movaryn tabs, then scan and try again.',
          'danger',
        );
      }
    } catch {
      pushToast('A leftover workspace could not be removed. Rescan and try again.', 'danger');
    } finally {
      setRemoving(null);
    }
  };

  const remove = (targets: LeftoverWorkspace[]) => {
    const chats = targets.reduce((sum, target) => sum + target.summary.conversations, 0);
    const projects = targets.reduce((sum, target) => sum + target.summary.projects, 0);
    const notebooks = targets.reduce((sum, target) => sum + target.summary.notebooks, 0);
    const one = targets.length === 1;
    requestConfirm({
      title: one ? 'Remove this leftover workspace?' : `Remove ${targets.length} leftover workspaces?`,
      body: `${one ? `Workspace ${targets[0].id} has` : `${targets.length} workspaces have`} no local sign-in, so Movaryn cannot open ${one ? 'it' : 'them'}. Removing ${one ? 'it' : 'them'} deletes ${countLabel(chats, 'chat')}, ${countLabel(projects, 'project')} and ${countLabel(notebooks, 'notebook')}. This cannot be undone.`,
      confirmLabel: one ? 'Remove workspace' : 'Remove all leftovers',
      danger: true,
      onConfirm: () => void performRemove(targets),
    });
  };

  return (
    <section className="rounded-xl border border-line bg-panel px-3.5 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
        <div className="min-w-0">
          <h3 className="text-[12.5px] font-semibold text-ink">Workspace housekeeping</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
            A workspace can be left behind when an account is removed outside Movaryn or a cleanup is
            interrupted. Scanning compares local workspaces with the accounts that still exist. Live
            accounts are never listed or removed.
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary h-8 text-[11.5px]"
          onClick={() => void scan()}
          disabled={scanState === 'scanning' || Boolean(removing)}
        >
          {scanState === 'scanning' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          {scanState === 'scanning' ? 'Scanning…' : scanState === 'done' ? 'Scan again' : 'Scan for leftovers'}
        </button>
        {leftovers.length > 1 ? (
          <button
            type="button"
            className="btn btn-danger h-8 text-[11.5px]"
            onClick={() => remove(leftovers)}
            disabled={Boolean(removing)}
          >
            {removing === 'all' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Remove all
          </button>
        ) : null}
      </div>

      {scanState === 'unsupported' ? (
        <p className="mt-2 rounded-lg border border-warn/30 bg-warn/10 px-2.5 py-2 text-[10.5px] leading-relaxed text-warn">
          This build cannot list browser workspace databases, so housekeeping is unavailable here.
          Nothing was removed.
        </p>
      ) : null}

      {scanState === 'done' && leftovers.length === 0 ? (
        <p className="mt-2 rounded-lg border border-line bg-panel-2 px-2.5 py-2 text-[10.5px] leading-relaxed text-ink-muted">
          No leftover workspaces found. Every account workspace on this device has a local sign-in.
        </p>
      ) : null}

      {leftovers.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {leftovers.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[10.5px] text-ink">{item.id}</p>
                <p className="mt-0.5 text-[10px] text-ink-faint">{contents(item.summary)}</p>
              </div>
              <button
                type="button"
                className="icon-btn h-7 w-7 shrink-0 text-danger"
                onClick={() => remove([item])}
                disabled={Boolean(removing)}
                title="Remove leftover workspace"
                aria-label={`Remove leftover workspace ${item.id}`}
              >
                {removing === item.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
