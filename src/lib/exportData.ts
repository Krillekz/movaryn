import { useApp } from '../store/useApp';
import { APP_VERSION } from './appVersion';
import { downloadJson } from './utils';

/** Downloads every conversation, project and setting as one JSON backup. */
export function exportAllData(): void {
  const state = useApp.getState();
  downloadJson('movaryn-export.json', {
    exportedAt: new Date().toISOString(),
    version: state.provider?.version ?? APP_VERSION,
    settings: state.settings,
    conversations: state.order.map((id) => state.conversations[id]).filter(Boolean),
    projects: state.projectOrder.map((id) => state.projects[id]).filter(Boolean),
  });
}
