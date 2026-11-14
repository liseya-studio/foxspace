# Fox Space

Desktop-first web prototype for Fox Space. This repository is the working source of truth.

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

## Current stage
- Desktop application shell and navigation
- Header: profile, search, notifications, messages, settings
- Bottom Dock: Files & Tables, Notes & Tasks, user-created screens, one add button
- Create and navigate user screens
- Rename screens from the Dock; screen metadata persists in localStorage
- Light, dark and system appearance modes
- Accent color selection
- Empty states for the first screen, files/tables and notes/tasks

## Not implemented yet
Real table engine, column types, filters, views, widgets, Fox Editor, backend, Telegram authorization, ChatGPT API, feed/multiposting and real notifications/messages.

The UI is intentionally being built before the full application logic.