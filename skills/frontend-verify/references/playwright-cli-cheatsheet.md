# playwright-cli cheatsheet (verification focused)

Condensed for frontend verification. For the full surface run
`playwright-cli --help` or see the official skill at
github.com/microsoft/playwright-cli.

## Mental model

- One persistent browser per named session. Use `-s=<name>` on every call so the
  calls share one warm browser. `verify-routes.mjs` uses `-s=fe-verify`.
- Runs HEADLESS by default. Add `--headed` only to watch it.
- Snapshots and screenshots are written to DISK and the command returns a path.
  Nothing large enters context unless you read the file back.

## Commands you actually use to verify

```
playwright-cli -s=v open                 # start the session browser (headless)
playwright-cli -s=v goto <url>           # navigate
playwright-cli -s=v console --clear      # console messages, then reset for next route
playwright-cli -s=v requests --clear     # network requests, then reset
playwright-cli -s=v --raw eval "<expr>"  # read one value from the page
playwright-cli -s=v snapshot --filename snap.yml   # a11y tree to disk
playwright-cli -s=v screenshot                     # last resort, to disk
playwright-cli -s=v state-save auth.json           # save login state
playwright-cli -s=v state-load auth.json           # restore login state
playwright-cli -s=v close                          # release the browser
playwright-cli kill-all                            # nuke all sessions if wedged
```

Useful flags:

- `console error` raises the minimum level so you only see errors and above.
  Plain `console` defaults to info and includes everything.
- `requests --filter "/api/"` lists only matching URLs.
- `requests --static` includes static assets (off by default, which is what you
  want, so leave it off).
- `snapshot --depth=N` limits tree depth. `snapshot --boxes` adds bounding boxes.

## Output-format gotchas (these bite)

These were verified by probing the live CLI. Get them wrong and parsing breaks.

1. Do NOT use `--raw` for `console` or `requests`. `--raw` strips the actual
   message lines and you get nothing back. Use plain output and parse it.

2. DO use `--raw` for `eval`. Without it you get wrapper text. With `--raw` you
   get the value serialized as JSON, so a string comes back wrapped in quotes
   with `\n` escapes. `JSON.parse` it, or just use `.includes()` which matches
   either way.

3. `goto` exits 0 even on `net::ERR_CONNECTION_REFUSED` or other navigation
   failures. It prints `### Error` and `Error: net::ERR_...` instead. Detect a
   failed navigation by scanning the OUTPUT for `### Error`, `net::ERR_`, or
   `ERR_[A-Z_]+`, not by the exit code.

4. console plain format is `[ERROR] message @ url:line`, `[WARNING] ...`,
   `[LOG] ...`, with a header `Total messages: N (Errors: X, Warnings: Y)`.

5. requests plain format is `N. [GET] <url> => [404] File not found`. Parse the
   status from the `=> [status]` suffix. Treat code >= 400, or words like fail /
   abort / refused / timeout, as a failure.

6. A console `[ERROR]` line containing "Failed to load resource" is a network
   error, already covered by `requests`. Exclude those from the genuine JS error
   count so favicon and asset noise does not create false failures.

7. `--json` only wraps the same text in `{ "result": "..." }`. It is not
   per-message structured data, so it does not help parsing. Skip it.

## Diffing snapshots cross platform

Unix `diff` is unreliable in PowerShell. Use git, which ships everywhere and
ignores whether the files are tracked:

```
git diff --no-index before.yml after.yml
```

## Auth in one shot

```
playwright-cli -s=v open
playwright-cli -s=v goto http://localhost:3000/login
playwright-cli -s=v find "email field"
playwright-cli -s=v form_input <ref> you@example.com
playwright-cli -s=v find "password field"
playwright-cli -s=v form_input <ref> secret
playwright-cli -s=v find "sign in button"
playwright-cli -s=v eval "(el)=>el.click()" <ref>
playwright-cli -s=v state-save auth.json
```

Reuse `auth.json` with `state-load` or the `stateFile` config field so you log in
once, not once per route.
