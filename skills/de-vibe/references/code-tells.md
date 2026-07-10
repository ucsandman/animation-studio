# Code-Level Vibe-Coding Tells

Every item is a concrete check. Run the checks (Grep tool / shell commands); don't skim files and guess. Patterns below are ripgrep syntax. Adapt file globs to the detected stack.

Context on why this matters: scans of vibe-coded apps at scale (Escape.tech, 5,600 apps) found 2,000+ vulnerabilities, 400+ secrets exposed in JS bundles, and 175 PII exposures. Real shutdowns/breaches: EnrichLead (API keys in client code, maxed out in 2 days), Tea app (open storage bucket → 72K selfies + 13K government IDs leaked; open Firebase → 1.1M private DMs), Lovable platform (missing Supabase RLS exposed 170+ production apps). These weren't exotic attacks — they were the default output nobody reviewed.

## 1. CRITICAL — Security

| Tell | Check |
|---|---|
| Wildcard CORS in production | `Access-Control-Allow-Origin.*\*` ; `origin:\s*['"]\*` ; bare `app.use(cors())` in Express |
| Wildcard CORS + credentials together | `credentials:\s*true` near wildcard origin — should never coexist |
| Hardcoded secrets / API keys | `(sk-[a-zA-Z0-9]|sk_live_|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9])` ; `(api_?key|secret|password|token)\s*[:=]\s*['"][^'"$\{]{8,}` |
| Placeholder creds left live | `(admin123|changeme|test_key|replace_this|your-api-key)` |
| `.env` tracked in git | `git ls-files \| rg '(^\|/)\.env(\..+)?$'` (allow `.env.example`) |
| Secrets anywhere in git history | `git log --all --diff-filter=A --name-only \| rg '\.env$'` ; if hit → the credential is burned, rotate it now |
| Tokens in localStorage | `localStorage\.(set\|get)Item\(.*[Tt]oken` — should be httpOnly cookies |
| Client-side-only authorization | role/permission checks (`user.role ===`, `isAdmin`) in frontend code; verify each has a server-side counterpart on the route it gates |
| SQL built by string concat | `(SELECT\|INSERT\|UPDATE\|DELETE).*(\+\s*\w\|\$\{\|%s.*%\|f["'].*\{)` in query strings — want parameterized queries |
| No rate limiting on auth routes | inspect `/login`, `/register`, `/password-reset`, OTP endpoints for a limiter middleware; AI almost never adds one |
| TLS verification disabled | `verify\s*=\s*False` ; `rejectUnauthorized:\s*false` ; `InsecureSkipVerify` |
| Weak crypto | `(md5\|sha1)\(` for anything security-relevant; hardcoded IVs/keys; `Math.random()` for tokens/IDs |
| Missing CSRF protection | state-changing POST/PUT/DELETE routes with cookie auth and no CSRF token/middleware |
| Supabase/Firebase misconfig | service-role key referenced in client-bundled code; tables without RLS policies; Firebase rules `allow read, write: if true` |
| Missing security headers | no helmet/CSP/HSTS setup anywhere in the server entrypoint |
| Debug/stack traces to clients | error handlers returning `err.stack` or raw exception messages in responses |
| Public storage buckets in IaC | `"PublicRead"`, `public-read`, `allUsers` in bucket/IaC config |

## 2. Reliability

| Tell | Check |
|---|---|
| Empty catch blocks | `catch\s*(\([^)]*\))?\s*\{\s*\}` ; Python `except.*:\s*\n\s*pass` |
| Catch-log-return-null | catch blocks that log and return `null`/`undefined`/`[]` — masks failures; decide per site: rethrow, or fail loudly |
| Broad exception swallowing | `except Exception:` without re-raise; `catch (e)` that doesn't distinguish error types where it matters |
| console/print debris | `console\.(log\|debug)\(` ; stray `print(` in non-CLI Python. Keep intentional structured logging. |
| TODO/FIXME/HACK density | `(TODO\|FIXME\|HACK\|XXX):` — each one is either done now or becomes a tracked issue; none ship silently |
| Hallucinated dependencies | for each dependency, confirm it exists on the registry AND is imported somewhere. Fake-but-plausible names are a real attack vector (slopsquatting). |
| No idempotency / concurrency story | endpoints that write on retry-able operations (payments, signups) with no idempotency key, lock, or unique constraint |
| Unhandled promise rejections | Node entrypoints missing an `unhandledRejection` handler that exits non-zero |

## 3. Code smells

| Tell | Check |
|---|---|
| Scaffolding comments | `//\s*Step \d` ; `#\s*Step \d` ; comments that restate the next line ("// increment counter") |
| Commented-out code blocks | multi-line commented code (not prose) — delete |
| Duplicated logic | run `jscpd` (JS/TS) or eyeball copy-paste variants of the same function with slightly different names (`getUserData` / `fetchUserData` / `loadUser`) |
| Single-use abstractions | wrapper classes/helpers with exactly one call site that add no behavior — inline them |
| Unused imports/exports/deps | `depcheck` / `ts-prune` (JS/TS); `vulture` (Python — already in the global git hooks); `npx knip` |
| Dependency bloat | a dep pulled in for something doable in a few lines (left-pad energy); flag, confirm before removing |
| Giant files | any single source file > ~500 lines that mixes concerns (routes + db + templates in one) |
| Uniform "textbook" style drift | not fixable by grep — note it only if it obscures logic; do NOT churn working code for style alone |

## 4. Missing pieces

| Tell | Check |
|---|---|
| No tests, or tautological tests | test files exist? Do assertions test behavior, or assert a mock returns what it was mocked to return? Count real assertions. |
| `.env.example` missing/stale | diff actual env usage (`process\.env\.\w+` / `os.environ` / `os.getenv`) against `.env.example` keys |
| No input validation on endpoints | request bodies used directly without schema validation (zod/joi/pydantic) on public routes |
| README/reality gap | do the README's run steps actually work from a clean clone? Do documented features exist? |
| Unpinned dependencies | `*` or missing lockfile; `latest` tags |
| No error/loading/empty states | UI components that only render the happy path (see design-tells.md §3 for the UX side) |
| No migrations story | schema changed by hand / `synchronize: true` in production config instead of migration files |

## 5. Repo / git tells

| Tell | Check |
|---|---|
| AI tooling artifacts tracked | `git ls-files \| rg '(^\|/)(\.claude/\|CLAUDE\.md\|\.cursorrules\|\.cursor/\|\.windsurfrules\|\.aider\|\.github/copilot-instructions)'` |
| AI attribution in commits | `git log --format='%B' \| rg -i '(generated with claude\|co-authored-by: claude\|copilot\|cursor)'` — can't remove from history without a rewrite (out of scope); stop it going forward |
| Future trailers not disabled | project `.claude/settings.json` should set `"includeCoAuthoredBy": false` (sufficient by itself; don't add the `attribution` key as a boolean — it's an object and will fail schema validation) |
| `node_modules`/build output tracked | `git ls-files \| rg '(node_modules/\|dist/\|build/\|__pycache__\|\.next/)'` |
| No/late `.gitignore` | does `.gitignore` exist, and was it in the first commit (`git log --diff-filter=A --format=%H -- .gitignore`)? Late = check history for leaked files |
| Giant single "initial commit" | whole app in one commit — can't fix, but combined with other tells it's provenance; note it, don't rewrite |

## Fix policy reminders

- Auto-fix: debris, comments, gitignore/env.example, untracking artifacts (`git rm --cached`, never delete local), empty catches (surface the error), trailer settings.
- Confirm-first: anything in §1 that touches auth/billing/data-access logic, dependency removals, committed-secret rotation steps.
- Pre-existing dead code (predating the AI sessions): flag, don't delete — per the global working agreement.
