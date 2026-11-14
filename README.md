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
- Filter by select-column values
- Sort by clicking column headers
- Table and compact list views
- CSV export with UTF-8 BOM
- Automatic localStorage persistence
- Seeded finance table for interface testing

## Not implemented yet
File browser and upload, advanced relational fields, formulas, grouped and saved views, multi-condition filter builder, table permissions, widgets, Fox Editor, backend, Telegram authorization, ChatGPT API, feed/multiposting and real notifications/messages.

The current build is an interactive UI prototype. Browser localStorage is temporary prototype storage, not the final data architecture.
