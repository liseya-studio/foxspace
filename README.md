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
- Global quick-search dialog (`Cmd/Ctrl + K`)
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

### Fox Editor (interactive prototype)
- Custom screens have a configurable grid canvas with locally persisted widgets
- Right-side library for widget types and ready-to-bind templates
- Widget inspector with Data, Appearance and Behavior tabs
- Data widgets: metric, progress, bar, line, donut, single horizontal timeline, table and list
- Free-text widget does not require a table
- Per-widget source table and field selection, and primary screen data source
- Drag-to-reorder, column-span resizing, width/height settings and widget removal
- Templates display user table records rather than fabricated dashboard values

## Not implemented yet
File browser and upload, advanced relational aggregation, arbitrary formula expressions, nested multi-condition filter trees, table permissions, fully embedded table editing on custom screens, advanced widgets, backend, Telegram authorization, ChatGPT API, feed/multiposting and real notifications/messages.

The current build is an interactive UI prototype. Browser localStorage is temporary prototype storage, not the final data architecture.

## Build verification

GitHub Actions `.github/workflows/build.yml` runs `npm install` and `npm run build` for changes to `main` and pull requests. It is the primary CI check; check the Actions tab for pass/fail status.
