---
name: de-vibe
description: Audit and fix the tells that software was vibe-coded / AI-generated, then give it a small distinctive identity, so it ships looking handcrafted and professional. Use whenever the user says "de-vibe", "does this look AI-generated / vibe coded?", "make this look shippable / handcrafted / professional", "remove the AI slop", "polish before launch", asks why their site "looks like every other AI site", or is about to ship/demo/hand off a project that was built largely with AI assistance — even if they don't use the word "vibe". Pairs naturally before /ship.
---

# De-Vibe

Vibe-coded software has a recognizable fingerprint: security holes nobody checked (wildcard CORS, committed `.env`, client-side-only auth), reliability debris (empty catches, console.log spam, tautological tests), the "AI slop" aesthetic (indigo gradients, Inter everywhere, untouched shadcn defaults, "Elevate your workflow" copy), and repo artifacts that announce how it was built. This skill removes that fingerprint and replaces the generic defaults with a small, deliberate identity — so the shipped product reads as handcrafted, and more importantly, doesn't ship with the real defects that make vibe-coded apps break in public.

Two things this skill is NOT:
- **Not a deception tool.** The point is closing the actual quality gap (the security holes and missing pieces ARE the tells), plus removing tool-attribution noise from what ships. It never fakes provenance, testimonials, stats, or history.
- **Not a full redesign.** The identity pass is bounded: token-level design changes and copy rewrites, not new layouts or features.

## Workflow

Run as four phases: **Audit → Report → Fix → Verify**. Never skip the report — the user decides on the confirm-first items before you touch them.

### Phase 1 — Audit (read-only)

Detect the stack first (package.json / pyproject.toml / framework config), then sweep every category in the two reference catalogs:

- `references/code-tells.md` — security, reliability, code smells, missing pieces, repo/git tells. Each item has a concrete check (grep pattern or command). Run the checks; don't eyeball.
- `references/design-tells.md` — visual, copy, UX, and product-metadata tells, plus the identity playbook for Phase 3.

For repos over ~50 source files, fan the audit out to 2–3 parallel subagents (one for code/security, one for design/copy/metadata, one for repo/git hygiene) so the raw grep output stays out of the main context — each returns only its findings list. Set an explicit model on every subagent spawn.

Also run whatever the repo already has: linter, `depcheck`/`vulture`, `npm audit`, test suite. Existing tooling output counts as audit evidence.

### Phase 2 — Report

The report lives in the conversation — present it as a message, not a file (write a file copy only if the user asks or a handoff needs it). Use this exact structure before fixing anything:

```
DE-VIBE AUDIT: <project>

CRITICAL (security — fix before anything ships)
- [finding] — file:line — evidence

RELIABILITY
- ...

CODE SMELLS
- ...

MISSING PIECES
- ...

REPO / GIT TELLS
- ...

DESIGN / COPY / PRODUCT TELLS
- ...

CLEAN: [categories checked that came back clean — say so explicitly]

PLAN: auto-fixing [list]; need your call on [list].
```

Every finding needs file:line evidence. A category with zero findings gets listed under CLEAN — silence reads as "not checked".

### Phase 3 — Fix

**Auto-fix (safe, mechanical — proceed without asking):**
- console.log/print debris, commented-out code blocks, unused imports and dead code *introduced by the AI sessions* (leave pre-existing dead code flagged, not deleted)
- "Step 1/Step 2" scaffolding comments and comments that restate the code
- Placeholder text, lorem ipsum, default page titles ("Create Next App", "Vite + React"), default favicons, missing/default meta tags and OG images
- `.gitignore` gaps (`.env`, `node_modules/`, build output); create/complete `.env.example` from actual env-var usage
- Untrack (but keep locally) AI-tooling artifacts: `.claude/`, `CLAUDE.md`, `.cursorrules`, `.cursor/`, `.windsurfrules`, `.aider*` — `git rm --cached` + gitignore. Never delete the local files.
- Stop future attribution trailers: project `.claude/settings.json` with `"includeCoAuthoredBy": false` (that key alone is enough; the newer `attribution` setting is an object, not a boolean — skip it unless you know the schema)
- Empty catch blocks → surface the error (rethrow or log-and-fail-loudly); pick per call site, don't blanket-replace
- Copy de-slop: strip the buzzword stack ("elevate", "seamlessly", "unlock", "supercharge", "revolutionize"), em dashes in outward-facing copy, fake-sounding unverifiable stats, "It's not X, it's Y" cadence. Rewrite in plain, specific language that names who it's for and what it does — then check the rewrite against the actual feature set. Swapping buzzwords for a concrete claim the app can't back ("browse, add to cart, check out" when there is no cart) reintroduces the exact dishonesty you just deleted. Every capability named in the new copy must exist in the code.

**Confirm first (present the finding + proposed fix, wait for the user):**
- Anything whose fix **changes auth, billing, session, or data-access behavior** (client-side-only role checks, missing RLS, localStorage token storage, CORS policy changes, missing rate limiting) — these are real fixes, not cosmetic, and they hit the user's hard-stop list. The line is behavior, not topic: moving a hardcoded secret into `process.env` or stopping a stack trace from reaching clients doesn't change how auth works, so those are auto-fix even though they're security findings. Tightening a CORS origin or swapping token storage changes what requests succeed — confirm those.
- Removing dependencies (a "bloated" dep might be load-bearing)
- Deleting any file the user may have created deliberately
- Secrets already committed to git history: rotate the credential NOW (that part isn't optional — the key is burned), but history rewrite is out of scope; say so and point at the rotation.
- The identity pass (below) — show the proposed direction before applying

**Identity pass** — the "hint of uniqueness". Follow `references/design-tells.md` § Identity Playbook. In short: derive a small identity from what the product actually is (domain, audience, one adjective), then make five token-level commitments — a non-default neutral scale, a radius stance (sharp or pill, not default-8px), a deliberate type pairing, one saturated accent that is not indigo/violet, and one signature token (grain, shadow stack, easing curve). Write them to the project's design tokens and a short `docs/DESIGN.md` so future AI generations inherit the identity instead of regressing to slop. If the frontend-design or impeccable skill is available and the user wants to go further, hand the visual work to it with the chosen identity as the brief.

### Phase 4 — Verify

- Re-run the audit greps that had findings — they must come back clean.
- Run the project's tests, lint, and build; read the output. A de-vibe pass that breaks the build is worse than the slop.
- For web apps, load the changed pages (frontend-verify skill or Playwright) — check title, favicon, meta, and that copy/design changes rendered.
- Close with the standard CHANGES MADE / DIDN'T TOUCH / VERIFICATION summary, and list any confirm-first items still awaiting a decision.

## Judgment notes

- **The catalogs are evidence menus, not verdicts.** A purple gradient on a synthwave music app is a choice; on a B2B dashboard it's a default. An 80-dep project might be a monorepo. Flag by evidence, weigh by context.
- **Severity order is fixed:** committed secrets and auth holes outrank everything aesthetic. If time-boxed, do CRITICAL + repo tells and report the rest.
- **Match the repo's voice when rewriting copy** — the goal is that a stranger can't tell a machine wrote it, which also means it shouldn't read like a different machine rewrote it. Short sentences, concrete nouns, no hype.
- **Uniqueness is subtraction plus one signature.** Most of "distinctive" is refusing the median (no Inter, no indigo, no three-column icon grid), then adding exactly one memorable element. Two signatures compete; five is slop with extra steps.
