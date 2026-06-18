# Content CRM Design

## Goal

Build a small browser workspace for two people who plan Instagram-style music videos together. One person can add a reference link, track, script, notes, storyboard images, and production status; the other person can open the same workspace, take an idea into work, mark whether it was tried, and record whether it landed.

## Product Shape

The app is a static browser app with a dense CRM-like board. Each idea is a self-contained card with title, status, reference link, track, script, description, attachments, owner, dates, and quick action buttons. The main screen has a creation form, status filters, search, strategy counters, and a grid of cards.

## Storage

The default mode is local-first using `localStorage`, so the app works immediately from a static host and does not need a local server. For 24/7 shared data, the app includes Firebase configuration support. When Firebase is configured, the same UI reads and writes a shared room in Firestore; the friend only needs the final site link and room code.

Privacy is link-based rather than account-based. Anyone with the deployed site, Firebase room id, and optional room label can technically access the workspace if Firestore rules allow it. This matches the user's low sensitivity requirement while avoiding login for the friend.

## Architecture

Core idea logic lives in `public/app-core.mjs` and is tested with Node's built-in test runner. Browser rendering and storage integration live in `public/app.js`. The page and styles are split into `public/index.html` and `public/styles.css`.

## Testing

Automated tests cover idea creation, status transitions, filtering, summary counts, and import/export. Manual verification covers the browser UI, image attachment previews, and Firebase settings flow.
