---
name: frontend-verify
description: >
  Verify frontend changes end to end after editing a web app, instead of
  manually clicking through pages. Use this whenever you have changed UI code
  and need to confirm nothing broke: "verify my frontend", "check the site
  after these edits", "did my UI break", "did my changes break anything",
  "make sure these routes still work", "smoke test the app", "check for console
  errors", "validate the pages I touched". Works with Next.js (app and pages
  router), React, Vite, and any local dev server. Built to be token cheap: it
  reads console errors and failed network requests first and writes full page
  state to disk, so it only pulls a snapshot or a screenshot into context when a
  route actually fails. Use it before saying a frontend change is done.
---

# Frontend Verify

## What this replaces

The slow loop is: edit code, start the dev server, open a browser, click each
page, watch the console, eyeball the layout, repeat. This skill does that pass
programmatically with `@playwright/cli` running headless, and it does it without
dumping every page state into the model context.

## The one principle that matters

Reading a full accessibility snapshot or a screenshot into context on every
route is the expensive part, not running the browser. So the order of operations
is always cheapest signal first:

1. Console errors and failed network requests. Tiny text, catches most real
   breakage (crashed component, bad fetch, 500 from an API route).
2. Targeted text assertions. Ask the page "is the word Dashboard on screen",
   not "give me the whole DOM".
3. A snapshot written to disk, read back only for a route that already failed.
4. A screenshot, only as a last resort.

`verify-routes.mjs` runs steps 1 and 2 across all changed routes in one browser
pass, writes the detail to disk, and prints a compact PASS / WARN / FAIL table.
You read the table, then open detail files for flagged routes only. Do not read
detail for routes that passed.

## When to take a screenshot

Almost never. Reach for one only when:

- A route is canvas, WebGL, or PixiJS. The accessibility tree is blind to pixels
  drawn on a canvas, so text and console checks cannot see the actual render.
- You are chasing a visual or layout regression (overlap, spacing, z-index,
  styling) that text cannot describe.
- The user explicitly asks to see the page.

For everything else, the console plus a text assertion tells you whether the page
works. A screenshot tells you how it looks, which is a different and more
expensive question.

## Setup check

Confirm the CLI is installed before running anything:

```
playwright-cli --help
```

If that fails, the user installs it once with (PowerShell):

```
npm install -g @playwright/cli@latest
playwright-cli install-browser chrome-for-testing
```

It runs headless by default, so no window opens during a verify run.

## The flow

### 1. Find what changed

```
git diff --name-only
git diff --name-only --staged
```

Keep the files under the frontend (for Next.js that is `app/`, `pages/`,
`components/`, `src/`). Ignore server only, config, and test files unless they
back a route you are checking.

### 2. Derive the affected routes

This is the judgment step. Map changed files to URLs:

- Next.js app router: `app/dashboard/page.tsx` serves `/dashboard`.
  `app/page.tsx` serves `/`. Strip route groups in parentheses, so
  `app/(marketing)/pricing/page.tsx` serves `/pricing`. A `[slug]` segment needs
  a real value, so pick one that exists (for example `/blog/hello-world`).
- Next.js pages router: `pages/about.tsx` serves `/about`,
  `pages/index.tsx` serves `/`.
- A changed shared component does not map to a route on its own. Find the pages
  that import it and check those:
  ```
  git grep -l "PricingCard" -- "*.tsx" "*.jsx"
  ```
  Then map those importing files to routes the same way. Walk up until you reach
  files that are actual routes.

If the route set is unclear, ask the user which routes the change should affect
rather than crawling the whole site. Verify only what changed.

### 3. Make sure the dev server is running

The config points at a base URL like `http://localhost:3000`. If nothing is
serving there, start the dev server (for example `npm run dev`) in a separate
terminal first, or ask the user to. `verify-routes.mjs` will report a navigation
failure if the server is down, which is the signal to start it.

### 4. Write a config and run

Create a small JSON config (shape below) listing the affected routes, then:

```
node <skill-path>/scripts/verify-routes.mjs verify.json
```

The script exits non zero if any route fails, so it slots into a chain that
should stop on failure.

### 5. Read the summary, not the world

The script prints something like:

```
[PASS] /
[FAIL] /pricing    2 JS console error(s); 1 request failure(s)
[WARN] /play       canvas route: accessibility tree is blind
```

That table plus `report.json` is usually all you need. Only open
`.frontend-verify/<route>/detail.json` for a route marked FAIL or WARN. That file
has the exact error lines and the failed request log. `console.txt` and
`requests.txt` sit next to it if you want the raw capture.

### 6. Drill in only when flagged

For a failing route, after reading its `detail.json`:

- Need to see the rendered structure: write a snapshot to disk and read that one
  file, do not stream it inline.
  ```
  playwright-cli -s=fe-verify goto http://localhost:3000/pricing
  playwright-cli -s=fe-verify snapshot --filename snap.yml
  ```
- Need one specific value: use a targeted eval instead of a whole snapshot.
  ```
  playwright-cli -s=fe-verify --raw eval "document.querySelector('h1')?.innerText"
  ```

### 7. Decide on a screenshot

Apply the rule above. If the route is canvas or PixiJS, or the bug is visual,
take one screenshot and look. Otherwise stop, you already know if it works.

### 8. Report

State, per route, PASS or FAIL and the reason, then a one line verdict. Do not
restate passing detail. See the report template at the end.

## Config shape

```json
{
  "baseUrl": "http://localhost:3000",
  "session": "fe-verify",
  "settleMs": 800,
  "apiFilter": "/api/",
  "checkWarnings": false,
  "outDir": ".frontend-verify",
  "routes": [
    {
      "path": "/",
      "expectText": ["Dashboard"],
      "expectNoText": ["NaN", "undefined"]
    },
    {
      "path": "/pricing",
      "waitForText": "Pro plan"
    },
    {
      "path": "/play",
      "canvas": true
    }
  ]
}
```

Field notes:

- `expectText`: substrings that must appear in the page body. Missing one is a
  FAIL.
- `expectNoText`: substrings that must not appear. `"NaN"` and `"undefined"` are
  cheap catches for broken data binding.
- `waitForText`: for async or client rendered routes, poll until this text shows
  before checking. Use it when content arrives after a fetch.
- `canvas`: marks a canvas / WebGL / PixiJS route so a clean text pass is
  reported as WARN, not a false PASS, since the checks cannot see the canvas.
- `settleMs`: pause after load so client side fetches fire and failed API calls
  register. Raise it for slow pages.
- `apiFilter`: regex, only list requests whose URL matches. `/api/` keeps the
  request log focused on your own calls.
- `checkWarnings`: set true to surface console warnings as WARN. Off by default
  so warning noise does not bury real failures.

## Auth protected routes

Log in once and save the browser state, then point the config at it:

```
playwright-cli -s=fe-verify open
playwright-cli -s=fe-verify goto http://localhost:3000/login
# drive the login with find / form_input / eval, then:
playwright-cli -s=fe-verify state-save auth.json
```

Add `"stateFile": "auth.json"` to the config. The script loads it before
visiting routes, so protected pages render as a logged in user.

## Token rules

Do:

- Run `verify-routes.mjs` once over the changed routes and read the summary.
- Open detail files only for flagged routes.
- Use `--filter` on requests and targeted `eval` to pull single values.
- Write snapshots and screenshots to disk; read a file back only when needed.

Do not:

- Crawl or verify routes the change did not touch.
- Read a full snapshot or screenshot into context just to confirm a page loaded.
- Screenshot a route the console and text checks already cleared.
- Re-snapshot a route on every small edit when the console is already clean.

## Caveats

- Canvas, WebGL, and PixiJS render to pixels the accessibility tree cannot read.
  Verify those by evaluating app state on `window` (for example a game store or a
  ready flag) or by taking one screenshot.
- Web components using shadow DOM can hide content from the snapshot. Standard
  Next.js, React, and Tailwind are not affected. If a Lit or web component route
  reads empty, fall back to a screenshot.
- `playwright-cli goto` exits 0 even when navigation fails (connection refused,
  DNS error). The script already detects this from the command output, so trust
  its navigation-failed result over a raw exit code if you run goto yourself.

## Report template

```
Frontend verify: <branch or change summary>

[PASS] /                ok
[FAIL] /pricing         2 JS console errors, 1 failed /api/plans (500)
[WARN] /play            canvas route, screenshot checked: renders correctly

Verdict: 1 route broken. /pricing throws in PricingCard and its plans
fetch returns 500. Fix before shipping.
```

## Files

- `scripts/verify-routes.mjs`: the verification driver. Reads a JSON config,
  runs one headless pass, writes detail to disk, prints the summary, exits non
  zero on any failure.
- `references/playwright-cli-cheatsheet.md`: the verification focused command
  list and the output-format gotchas. Read it before driving `playwright-cli`
  by hand.
