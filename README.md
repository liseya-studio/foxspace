# Fox Space

Desktop-first interactive web prototype for Fox Space. This repository is the working source of truth.

## Stack
- React + TypeScript
- Vite
- Lucide icons
- CSS variables for light/dark themes and accent colors
- Browser localStorage for prototype records/settings and IndexedDB for local file blobs
- read-excel-file for browser-side XLSX import

## Run locally
```bash
npm install
npm run dev
```

## Implemented
### Application shell
- Desktop-first application shell and top navigation
- Bottom Dock: Files & Tables, Notes & Tasks, user-created screens, one add button
- Create, open, rename and delete user screens
- Light, dark and system appearance choices
- Accent color selection
- Global quick-search dialog (`Cmd/Ctrl + K`) across screens, tables, table-row values, tasks and notes (results open their section)
- Persistent prototype preferences and user screens in localStorage

### Files & Tables
- Unified **All / Files / Tables** tabs; no workbooks or fake storage quotas
- IndexedDB file and folder manager: upload, download, search, rename, move and recursive deletion
- Drag-and-drop file uploading; file sizes reflect actual stored file metadata
- Import CSV/TSV and XLSX workbooks into editable local tables; each populated XLSX sheet becomes a separate table
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
- Seeded finance table for interface testing

### Notes & Tasks (interactive prototype)
- Empty by default; creates tasks and notes with local browser persistence
- Tasks: title, description, status, priority, due date, important/urgent flags, tags, checklists with completed subtasks
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

## Not implemented yet
Advanced relational aggregation, arbitrary formulas, nested multi-condition filters, table permissions, full in-widget editing, WYSIWYG rich-text (Markdown is supported), recurring tasks/reminders, notifications, remote sync, backup/restore for IndexedDB files, full widget catalog, native macOS file access, Telegram authorization, ChatGPT API, feed and multiposting.

The current build is an interactive UI prototype. Browser localStorage is temporary prototype storage, not the final data architecture.

## Build verification

GitHub Actions `.github/workflows/build.yml` runs `npm install` and `npm run build` for changes to `main` and pull requests. It is the primary CI check; check the Actions tab for pass/fail status.

### Prototype constraints
- JSON layout import restores the widgets and saved table IDs, but does not import table records. Missing source tables show an empty-state hint.
- The timeline uses a single chronological line rather than a Gantt grid.
- This is still a browser-only UI prototype; no remote synchronization or native macOS integration is included.

### Local data safety
- The file manager persists blobs in browser IndexedDB; it does **not** access the macOS filesystem directly. Clearing site data, private-browsing expiry or browser storage eviction may delete local files.
- Notes, tables and widgets still use localStorage; attachments reference IndexedDB file IDs. Removing a file from the file manager can leave a missing attachment in notes.
- Workbook import reads the cached values of formulas, not live Excel formulas; its current conversion does not preserve workbook styling or formulas. Import is capped at 8 MB and each populated sheet at 10,000 rows / 100 columns.
