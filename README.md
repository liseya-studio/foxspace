# Fox Space

Desktop-first interactive web prototype for Fox Space. This repository is the working source of truth.

## Stack
- React + TypeScript
- Vite
- Lucide icons
- CSS variables for light/dark themes and accent colors
- Browser localStorage for prototype persistence

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
- Views: Kanban board (drag/drop status), sortable list, Eisenhower matrix (drag/drop urgency/importance), a single horizontal timeline, and monthly calendar with navigation
- Filters for all/active/completed/overdue tasks, text search and priority sorting
- Notes: editable title and continuous plain-text body, tags, pinning, auto-save and read mode; rich-text formatting is not yet supported
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
File browser and upload, advanced relational aggregation, arbitrary formula expressions, nested multi-condition filter trees, table permissions, fully embedded table editing on custom screens, rich-text formatting, recurring tasks/reminders, attachments, full widget catalog, fine-grained widget actions, backend, Telegram authorization, ChatGPT API, feed/multiposting and real notifications/messages.

The current build is an interactive UI prototype. Browser localStorage is temporary prototype storage, not the final data architecture.

## Build verification

GitHub Actions `.github/workflows/build.yml` runs `npm install` and `npm run build` for changes to `main` and pull requests. It is the primary CI check; check the Actions tab for pass/fail status.

### Prototype constraints
- JSON layout import restores the widgets and saved table IDs, but does not import table records. Missing source tables show an empty-state hint.
- The timeline uses a single chronological line rather than a Gantt grid.
- This is still a browser-only UI prototype; no remote synchronization or native macOS integration is included.
