# Design, Copy, UX & Product Tells + Identity Playbook

Why everything AI-built looks the same: LLMs output the statistical median of their training data — "the average of every Tailwind tutorial on GitHub". Tailwind UI's `bg-indigo-500` era saturated that data, so absent explicit constraints, the model reaches for indigo gradients, Inter, and a three-column feature grid every time. Distinctiveness is therefore mostly *refusal*: reject the median defaults, then add exactly one signature.

## 1. Visual tells

**Color**
- Purple/indigo/violet gradient as the primary accent — the single most cited tell. Also: cyan-on-dark + purple, and the newer "cream/beige default" that replaced it once purple got called out.
- Decorative dark-mode glow (radial gradients / glowing box-shadows behind content with no function).
- Gradient text on headings used purely decoratively.
- Multiple full-saturation colors competing with no hierarchy; or the opposite — a timid, evenly-washed palette with no real contrast.
- Gray-on-white body text below WCAG AA (4.5:1). Check computed contrast, not vibes.

**Typography**
- Inter everywhere (next tier once Inter got called out: Geist, Space Grotesk, Instrument Serif) — one font, no pairing, no personality.
- Flat hierarchy: heading and body sizes too close; oversized full-sentence hero headline as display type.
- The eyebrow pattern: tiny uppercase tracked label above every oversized heading; "01 / 02 / 03" numbered section markers.
- Line length > ~80ch, line-height < 1.3, body < 12px, justified text with rivers.

**Layout / components**
- The hero: centered headline + subhead + two CTAs, three feature boxes below. Or hero-left/text-right.
- Three-column feature grid, each cell = rounded icon tile + heading + one sentence, uniform heights.
- shadcn fingerprint: slate/zinc neutrals, default 8px radius, components styled exactly like the docs.
- Cards-within-cards nesting; rounded-2xl+ on everything ("soft blobs"); colored left-border accent strips on content blocks (one of the most reliable tells, especially multicolored ones).
- Meaningless colored status dots; decorative glassmorphism; hairline border + wide diffuse shadow together (redundant depth cues); one spacing value reused everywhere instead of a scale; shadows at exactly 0.1 opacity.
- Emoji as UI icons (nav, headers, bullets) instead of an icon set.

**Motion**
- Bounce/elastic easing on interface elements; uniform fade-in-on-scroll applied to every element identically; animating width/height/padding instead of transform/opacity; reflexive scale-on-hover on images. Or zero interaction feedback at all — hover states that do nothing.

## 2. Copy tells

- Buzzword stack: elevate, seamless(ly), unlock, supercharge, streamline, empower, revolutionize, effortless, world-class, enterprise-grade, cutting-edge, best-in-class, "stay competitive", "drive growth". Grep the marketing surfaces for these.
- Em dashes in outward-facing copy (also a standing rule in the user's global CLAUDE.md — zero em dashes in outward copy).
- "It's not X, it's Y" aphoristic cadence; hedging ("can potentially help"); superlatives with no specifics.
- Headline that never says who it's for or what problem it solves.
- Placeholder text: lorem ipsum, "Your headline here", links to nowhere.
- Fake social proof: "Trusted by 10,000+ users" on a day-old product; testimonials with no specific outcome; ambiguous logo rows. **Fix by deletion, never fabrication** — research finding: no testimonials outperform weak/fake ones. Unverifiable stats get removed or replaced with something true.

## 3. UX tells

- Only the happy path exists: no empty states, no error states, no loading states, no validation feedback on forms.
- Buttons/links that do nothing; Privacy/Terms links that 404; broken mobile layout (test a narrow viewport, don't assume).
- Accessibility gaps: missing alt text, icon-only buttons without aria-label, skipped heading levels (h1→h3), keyboard traps.
- Bloated bundles / poor Core Web Vitals — AI ships more JS/CSS than needed. Lighthouse if it's a web app.

## 4. Product metadata tells

- Default favicon (Next.js triangle, Vite logo). Note the Next.js footgun: it re-injects its default icon unless fully overridden (app/icon.png or explicit metadata) — verify in the rendered page, not just the file tree.
- `<title>` = "Create Next App" / "Vite + React"; missing/default meta description; no OG image (link previews look broken in Slack/social); duplicate titles across routes.
- localhost/`example.com` URLs, placeholder emails, or test keys surfacing in production HTML/config.

## 5. Identity Playbook — the "hint of uniqueness"

Goal: a small, deliberate identity, not a redesign. Derive it, commit it to tokens, document it so future AI generations inherit it instead of regressing to the median.

**Step 1 — Derive.** From the product itself: what domain is it in, who uses it, and pick ONE adjective the product should feel like (e.g. "surgical", "warm", "industrial", "editorial"). If the user has stated brand feelings anywhere (README, existing copy), use those. Propose the direction in one short paragraph and get a nod before applying.

**Step 2 — Five token commitments** (adapted from the shadcn-trap fix; apply at the token/theme level so every component inherits):
1. **Neutral scale:** replace slate/zinc with an intentional one — warm bone + cool gray text (editorial), taupe + deep brown (premium), pure gray + near-black (industrial).
2. **Radius stance:** commit to an extreme — 0px (sharp, serious) or full pill (playful). The default 8px middle is the fingerprint.
3. **Type pairing:** two fonts with a relationship — serif display + clean sans body, or geometric + humanist sans. Not Inter-alone, and not the "next tier" defaults either. Self-host or system-stack; check the license.
4. **One accent:** a single saturated accent color, used consistently and sparingly. Not in the indigo/violet band. Everything else stays neutral.
5. **One signature token:** one element the framework doesn't ship — a grain/noise texture, a distinctive shadow stack, a custom easing curve, an unusual border treatment, a signature focus ring. Exactly one. This is the fingerprint that makes it *this* product.

**Step 3 — Voice.** Rewrite outward copy in the derived direction: plain sentences, concrete nouns, says who it's for and what it does. Read it aloud test: would a human founder say this sentence to another human? Keep it consistent — one voice across landing, empty states, and errors.

**Step 4 — Persist.** Write the choices into the actual theme (CSS variables / tailwind config / token file) AND a short `docs/DESIGN.md`: the adjective, the five commitments, the voice rules. That file is what stops the next AI session from regressing everything to indigo.

**Step 5 — Metadata.** Real favicon (derive a simple mark from the identity — a letterform in the accent color beats a default triangle), real title/description per route, OG image, correct theme-color.

If the user wants to push further than tokens, hand off to the frontend-design or impeccable skill with the derived identity as the brief — don't improvise a full redesign inside this skill.

## Severity note

Design tells are LOW severity next to §1 of code-tells.md — but they're the most *visible*, so they dominate perception. In the report, keep them in their own section so a "looks fine, ships tomorrow" call can be made on security grounds alone.
