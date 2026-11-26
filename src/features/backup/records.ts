// Device-specific secrets and the file index live outside portable backups.
const defaults = {
  "fox-screens": [],
  "fox-theme": "light",
  "fox-accent": "#f06432",
  "fox-tables-v1": [],
  "fox-notes-tasks-v1": { tasks: [], notes: [] },
  "fox-editor-widgets-v1": {},
  "fox-widget-table-columns-v1": {},
  "fox-screen-grid-v1": {},
  "fox-custom-screen-templates-v1": [],
  "fox-projects-v1": { version: 1, projects: [] },
  "fox-operations-v1": { version: 1, transactions: [], publications: [], budgets: [], ledger: [], audience: [] },
  "fox-trackers-v1": { version: 1, trackers: [] },
  "fox-agent-policies-v1": [],
  "fox-audit-log-v1": [],
  "fox-automations-v1": { version: 1, items: [], history: [], notificationsEnabled: false },
  "fox-agent-pending-v1": [],
  "fox-notification-state-v1": { read: [], snoozed: {} },
  "fox-desktop-reminders-v1": { enabled: false, notified: [] },
  "fox-page-tree-collapsed": false,
  "fox-feed-hidden-sources-v1": [],
  "fox-publishing-deliveries-v1": {},
};

export const backupKeys = Object.keys(defaults) as (keyof typeof defaults)[];

export function readBackupRecords(): Record<string, unknown> {
  return Object.fromEntries(backupKeys.map(key => {
    const raw = localStorage.getItem(key);
    return [key, raw === null ? defaults[key] : JSON.parse(raw)];
  }));
}

export function withBackupDefaults(records: Record<string, unknown>) {
  return { ...defaults, ...records };
}
