# Fox Space

Desktop-first interactive web prototype for Fox Space. This repository is the working source of truth.

## Stack
- React + TypeScript
- Vite
- Lucide icons
- CSS variables for light/dark themes and accent colors
- Browser localStorage for prototype records/settings and IndexedDB for local file blobs
- read-excel-file for browser-side XLSX import

## Editable ready-made dashboards

The global `+` dialog includes eight local starter templates: **Мои финансы**, **Путешествия**, **Наши отношения**, **Здоровье и тренировки**, **Мои фанфики**, **Контент и статистика**, **Работа и проекты**, and **Книги и фильмы**. Each new screen receives editable Fox Editor widgets and maps to existing imported LISEA table names when possible. If matching tables have not been imported yet, an empty table schema is created locally; no personal values, health readings, dates, income or relationships are invented. Creating another screen does not erase existing screens. You can also import your LISEA workbook **after** creating the template: any matching empty template table is populated in place with its existing ID and widget links preserved; populated tables are never silently replaced.

The **Путешествия** screen includes an offline vector world map based on country boundaries and country metadata, supporting click/keyboard country selection, zoom, national flags, imported ISO A3 country codes, visit records and counts of distinct named cities. If no city names/count are provided, the UI reports zero cities in the data rather than guessing.

The **Наши отношения** screen has an independently editable start-date counter (with a blank date initially); its number of days is calculated from the local calendar. **Мои фанфики** contains character-dossier cards bound to the characters table, including work, role, traits, motivations and relationships.

The top search field is wider and centered on desktop, page margins and top spacing are reduced, and the Dock shows icons above short labels. Use a screen's Dock context menu → **Изменить значок** to select from the locally bundled Telegram, VK, YouTube, TikTok SVG marks, compact Kwork/Avito/HH badges, or decorative icons. Screen choices persist locally and are included in the backup.

## Review the web prototype

The frontend is ready for interactive review without a backend. It stores records locally in your browser. No Telegram or VK account is required to try navigation, tables, notes, tasks, notifications, files or Fox Editor.

**Public preview (one-time GitHub Pages setup):**
1. Open [repository Pages settings](https://github.com/liseya-studio/foxspace/settings/pages).
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open [Actions → Deploy Fox Space web preview](https://github.com/liseya-studio/foxspace/actions/workflows/preview.yml) and use **Run workflow** on `main`.
4. When deployment succeeds, open the URL from the run's `github-pages` environment (normally `https://liseya-studio.github.io/foxspace/`).

The deployment workflow already typechecks and builds the correct `/foxspace/` base path. GitHub Pages must first be enabled by a repository administrator; the workflow's default token cannot enable Pages itself. Until then, Actions uploads a standalone static build artifact.

**Local preview (Mac):**
```bash
git clone https://github.com/liseya-studio/foxspace.git
cd foxspace
npm install
npm run dev
```
Open the local URL printed by Vite (typically `http://localhost:5173/`).

**What to review:** start with the home empty state; use the bottom `+` for screens, tables, notes, tasks, folders and uploads; verify Fox Editor widgets, themes, calendar, search, file preview, notifications and backup. Feed and Messages deliberately show disconnected states until real integrations are built. No fabricated account data is loaded on a fresh browser.

**Automated checks:** `npm run build` checks TypeScript/Vite. `npm run test:e2e` runs Chromium smoke tests and captures screenshots. Screenshots and traces are available as artifacts of [Browser smoke tests and screenshots](https://github.com/liseya-studio/foxspace/actions/workflows/browser.yml).

## Run locally
```bash
npm install
npm run dev
```

## Implemented
### Application shell
- Desktop-first application shell and top navigation
- Bottom Dock: Files & Tables, Notes & Tasks, user-created screens, universal plus action (screen/table/task/note/folder/file upload)
- Create, open, rename and delete user screens
- Light, dark and system appearance choices
- Accent color selection
- Global quick-search dialog (`Cmd/Ctrl + K`) across screens, tables, table-row values, tasks and notes (results open their section)
- Persistent prototype preferences and user screens in localStorage
- Dedicated topbar entry points for Feed, Messages and Notifications (not additional fixed Dock items)
- Notification bell shows unread task deadline count; task notifications open the exact task
- Global task search also opens the matching task editor

### Files & Tables
- Unified **All / Files / Tables** tabs; no workbooks or fake storage quotas
- IndexedDB file and folder manager: upload, download, search, rename, move, recursive deletion, and in-app preview for images/video/audio/text/PDF
- Drag-and-drop file uploading; file sizes reflect actual stored file metadata
- Import CSV/TSV and XLSX workbooks into editable local tables; each populated XLSX sheet becomes a separate table
- Direct **Import Excel into tables** action in Files & Tables: reads the selected local workbook without uploading the workbook to GitHub or any application server; all tables are saved together only after the workbook parses successfully; existing table names are protected against accidental replacement
- Supports XLSX worksheets up to 200 columns and 10,000 rows each; empty and header-only sheets are skipped
- CSV parser supports quoted delimiters and multiline fields; imported columns infer basic data types
- Table library and table switching
- Create new tables
- Editable cells
- Column types: text, number, date, select, checkbox, relation, formula
- Relation columns can reference records in another local table
- Formula columns support a numeric source field with multiply/divide/add/subtract by a constant
- Add and remove columns
- Add and remove rows
- Search across table values
- Filter by select-column values and two column-specific conditions with AND/OR logic and numeric/empty operators
- Sort by clicking column headers
- Group table records by a selected field
- Save, reopen and delete table views (filter/sort/group/layout settings)
- Drag columns to reorder; adjust and persist their widths
- Attach an existing table to a custom screen and preview the first records
- Table and compact list views
- CSV export with UTF-8 BOM
- Automatic localStorage persistence
- Empty by default; no fabricated finance records

### Notes & Tasks (interactive prototype)
- Empty by default; creates tasks and notes with local browser persistence
- Tasks: title, description, status, priority, due date, important/urgent flags, tags, checklists with completed subtasks
- Optional daily, weekly or monthly recurrence: completion generates the next task with a fresh due date and reset checklist
- Today, upcoming 7 days, overdue, active and completed task filters
- Views: Kanban board (drag/drop status), sortable list, Eisenhower matrix (drag/drop urgency/importance), a single horizontal timeline, and calendar with day/week/month/schedule modes
- Drag task cards between calendar days to change due dates
- Filters for all/active/completed/overdue tasks, text search and priority sorting
- Notes: Markdown formatting toolbar (bold, italic, headings, lists, checklists, links and quotes), safe rendered preview, tags, pinning and auto-save
- Notes can attach actual local files stored in IndexedDB; attachments may be downloaded or unlinked
- Shared local data model; Fox Editor task counter, task list and notes list widgets reflect current organizer records
- Tasks and notes can be deleted with confirmation

### Fox Editor (interactive prototype)
- Custom screens have a configurable grid canvas with locally persisted widgets
- Right-side library for widget types and ready-to-bind templates
- All data widget types and templates can be placed on a blank screen before any table exists; new widgets prompt the user to select a source or create a table from the inspector
- Widgets without a source show a clear empty state with a direct "Choose source" action; layouts persist even before data is linked
- Widget inspector with Data, Appearance and Behavior tabs
- Data widgets: metric, row counter, progress, bar, line, donut, single horizontal timeline, table and list
- Additional widgets: task counter, task list and notes list connected to organizer records
- Free text, heading and divider widgets do not require a table
- Per-widget source table, field selection, typed row filters and configurable aggregation (sum/average/min/max/count)
- Formula and relation columns are resolved in widget previews from actual linked records
- Configurable record limits (1–30) for table, list, timeline and chart widgets
- Drag-to-reorder, column-span resizing, width/height settings, duplication and widget removal
- Editor/preview toggle, responsive grid, JSON screen layout export and validated import
- Automatic localStorage persistence for each custom screen
- Templates display user table records rather than fabricated dashboard values

### Notifications, messages and feed
- Notifications are derived from local tasks with due dates: overdue, today and within the next three days
- Read/unread state and one-day snoozing persist locally; a task can be opened directly from its notification
- Optional browser desktop reminders for due-today tasks, with explicit permission and a local deduplication record; these work only while the app is open
- Messages remains a disconnected state; Feed has two configured public sources (Telegram @bulotkaff and VK btsah). Only verified retrieved posts are displayed.

### Public feed sources
- Registered Telegram [@bulotkaff](https://t.me/bulotkaff) and VK [btsah](https://vk.ru/btsah) as the first two sources in the Feed screen.
- The scheduled GitHub Actions workflow `.github/workflows/feed-sync.yml` runs every six hours and can be started manually. It writes verified posts into `public/feed.json` and the public site is redeployed after updates.
- Telegram public preview is fetched at `https://t.me/s/bulotkaff`, preserving post URLs, dates, text and public image links. The public page may expose only a subset of the channel history.
- VK public posts are retrieved through the official `wall.get` API only if a repository secret named `VK_SERVICE_TOKEN` is configured. Without this secret the VK source is registered but honestly marked unavailable; the user may still open the group directly.
- Neither source requires login to the user's personal account for read-only viewing. No personal account authorization, posting or message permissions are implemented.
- Source sync failures retain previously retrieved posts and label them stale instead of inventing data.

### Backups and restore
- Settings contain a full workspace export to a single local JSON backup (screens, tables, notes/tasks, editor widgets, preferences, and IndexedDB files with their binary contents encoded)
- Backup restore validates the format, metadata, file lengths and structural record keys; user confirmation is required before replacing current data
- One transaction replaces the IndexedDB collection; localStorage data is updated and the app reloads to refresh all mounted views
- Current backup limits: 150 MB per archive, 60 MB per stored file; this is intended for small/local prototype workspaces, not huge media collections
- Backups are unencrypted local downloads; users should store them securely and avoid importing untrusted archives

## Not implemented yet
Advanced relational aggregation, arbitrary formulas, nested multi-condition filters, table permissions, full in-widget editing, WYSIWYG rich-text (Markdown is supported), advanced recurring rules, server-side push notifications, remote sync, automatic backup scheduling, incremental archives, full widget catalog, native macOS file access, Telegram and VK authorization, ChatGPT API, actual feed data and multiposting.

The current build is an interactive UI prototype. Browser localStorage is temporary prototype storage, not the final data architecture.

## Build verification

GitHub Actions `.github/workflows/build.yml` runs `npm install` and `npm run build` for changes to `main` and pull requests. It is the primary CI check; check the Actions tab for pass/fail status.

### Prototype constraints
- JSON layout import restores the widgets and saved table IDs, but does not import table records. Missing source tables show an empty-state hint.
- The timeline uses a single chronological line rather than a Gantt grid.
- This is still a browser-only UI prototype; no remote synchronization or native macOS integration is included.

### Local data safety
- The file manager persists blobs in browser IndexedDB; it does **not** access the macOS filesystem directly. Clearing site data, private-browsing expiry or browser storage eviction may delete local files. Export regular backups.
- Notes, tables and widgets still use localStorage; attachments reference IndexedDB file IDs. Removing a file from the file manager can leave a missing attachment in notes.
- Workbook import reads the cached values of formulas, not live Excel formulas; its current conversion does not preserve workbook styling or formulas. Import is capped at 8 MB and each populated sheet at 10,000 rows / 200 columns.

### Notification limitations
- In-app notifications are calculated on screen from task deadlines and do not require a server. Browser desktop reminders are opt-in, run while the web application is open, and depend on browser notification permission; they are not push notifications.
- Updating a task due date changes its notification identity so earlier read status does not accidentally hide the new deadline.
