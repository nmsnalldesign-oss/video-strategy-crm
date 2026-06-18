# Content CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static browser CRM for two collaborators planning short-form video ideas.

**Architecture:** Keep tested domain logic in a small module, then wire a browser UI around it. Use localStorage by default and an optional Firebase adapter for online shared data.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Node built-in test runner, optional Firebase CDN modules.

---

### Task 1: Tested Idea Domain

**Files:**
- Create: `package.json`
- Create: `tests/app-core.test.mjs`
- Create: `public/app-core.mjs`

- [ ] **Step 1: Write failing tests**

Create tests that import `createIdea`, `updateIdeaStatus`, `filterIdeas`, `getBoardSummary`, `serializeBoard`, and `parseBoard`.

- [ ] **Step 2: Verify red**

Run: `npm test`
Expected: FAIL because `public/app-core.mjs` does not exist yet.

- [ ] **Step 3: Implement app core**

Implement the exported functions with deterministic ids, allowed statuses, date fields, filtering, and safe JSON import/export.

- [ ] **Step 4: Verify green**

Run: `npm test`
Expected: PASS.

### Task 2: Static Browser UI

**Files:**
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `public/app.js`

- [ ] **Step 1: Build UI shell**

Add a two-column layout with composer, filters, counters, settings, import/export, and idea grid.

- [ ] **Step 2: Wire local storage**

Load ideas from localStorage, render cards, save changes after create/edit/status updates, and support JSON import/export.

- [ ] **Step 3: Add attachment previews**

Convert selected images to data URLs and render them inside the idea card.

- [ ] **Step 4: Verify**

Run: `npm test`
Expected: PASS. Open the HTML file manually or through a static server if desired.

### Task 3: Optional Firebase Sync

**Files:**
- Modify: `public/app.js`
- Modify: `public/index.html`

- [ ] **Step 1: Add settings fields**

Provide inputs for Firebase config JSON and room id.

- [ ] **Step 2: Add Firestore adapter**

Load Firebase modules from CDN only when config exists. Subscribe to `rooms/{roomId}` and save ideas back to that document.

- [ ] **Step 3: Verify graceful fallback**

Run: `npm test`
Expected: PASS. With no Firebase config, app remains fully usable in local mode.

### Task 4: Operator Docs

**Files:**
- Create: `README.md`

- [ ] **Step 1: Document usage**

Explain how to open the app locally, deploy the static `public` folder, configure Firebase, and share the link with a friend.

- [ ] **Step 2: Verify docs match files**

Run: `npm test`
Expected: PASS. Confirm docs mention the exact files and no local server requirement for end users.
