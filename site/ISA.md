---
project: farmers-iot-toolkit-site
task: "Plan and build the Farmers IoT Toolkit website"
effort: E3
phase: complete
progress: 36/36
mode: build
started: 2026-08-05
updated: 2026-08-05
---

# Ideal State — the Toolkit website

## Problem

Critical-path item 5 in `STATUS.md` — "build the Toolkit website and seed it with the four
module docs" — was the biggest unstarted knowledge-work piece, with the Float deadline close.
The four module documents exist and are good, but they are Markdown in a repo: unreachable by
the audience they were written for, and impossible to navigate as a system rather than four
separate files.

Worse, a website is a *fifth place for the wiring facts to rot.* `docs/deployment-wiring.md` §9
already records the failure mode: a pin assignment changed at the iron, the firmware followed,
and four prose files kept teaching the old order. Anyone rebuilding from the docs got two dead
buses. Hand-typing those tables into HTML would guarantee a repeat.

## Vision

A farmer opens the site on a phone in a field, on metered 4G, and can tell within ten seconds
what this is, what four things they could build, and roughly what each costs. When they commit
to one, the module page gives them a real parts list with links, a wiring diagram they can trust
against their own board, and a build walkthrough that tells them plainly which steps we have
actually done and which are still design.

The euphoric surprise is the honesty: a project site that says "this half is not built", "this
price is TBC", "this probe has an intermittent we are still chasing" — and is *more* credible
for it than any polished product page.

## Out of Scope

No CMS, no framework, no build pipeline beyond one bun script. No analytics, no cookies, no
third-party requests of any kind. Not a replacement for `docs/` — the Markdown stays the long
form and the site links to it. Not a dashboard: live telemetry belongs to `server/`. Not the
video itself — the site holds a slot for it. Not a hosting decision.

## Principles

- **Generated beats transcribed.** Any fact that exists in the firmware or hardware notes is
  rendered from data, never retyped into prose.
- **The flashed binary wins.** Where a doc and a `.ino` disagree, the `.ino` is right and the
  doc is a bug.
- **Say what is not known.** Unproven steps, unknown prices and open questions are marked, not
  smoothed over.
- **Cost the reader nothing.** One host, no tracking, minimum bytes.

## Constraints

- bun + TypeScript only; never npm/npx, never Python.
- Output must be static HTML with relative links, deployable to Float's site, GitHub Pages or
  the hetzner box without change — hosting is an open decision and must stay cheap to defer.
- Must survive a 390 px viewport and a metered connection.
- Must not contradict `STATUS.md` or the firmware.

## Goal

A six-page static site — hero, modules overview with an interaction diagram, video summary
slot, full wiring cheatsheet, and four module deep-dives with wiring, BOM-with-buy-links and
step-by-step walkthroughs — built by `bun site/build.ts` from a single typed source of truth,
with no third-party requests and no horizontal overflow on a phone.

## Criteria

**Build & structure**
- [x] ISC-1: `bun site/build.ts` exits 0
- [x] ISC-2: exactly six HTML pages are emitted into `site/dist/`
- [x] ISC-3: `site/dist/.nojekyll` exists for GitHub Pages
- [x] ISC-4: every internal `href` resolves to an emitted file
- [x] ISC-5: `--serve` returns HTTP 200 for `/index.html`
- [x] ISC-6: total `site/dist/` weight is under 1 MB

**Deliverables the user named**
- [x] ISC-7: a hero exists with the project name and a one-line lede
- [x] ISC-8: the hero states the project is funded by Float and implemented by Sunrise Labs, both linked
- [x] ISC-9: the hero's register matches float.ag — restrained, near-monochrome ground, essayistic copy, no stock imagery
- [x] ISC-10: a modules overview section renders all four modules as cards
- [x] ISC-11: each card shows difficulty, build time and an approximate parts cost
- [x] ISC-12: a "how they interact" section exists with a system diagram
- [x] ISC-13: the system diagram shows power, RS485, WiFi and 4G as visually distinct link types
- [x] ISC-14: the diagram marks the farm boundary and shows every crossing arrow pointing outward
- [x] ISC-15: a video summary section exists
- [x] ISC-16: with `VIDEO.id === null` the video section renders an honest placeholder, not a broken embed
- [x] ISC-17: a chapter list accompanies the video
- [x] ISC-18: a standalone wiring cheatsheet page exists, linked from the nav and the home page
- [x] ISC-19: the cheatsheet covers pin budget, both buses, wire colours, grounding, voltages, network, bring-up order and a merged symptom→cause table
- [x] ISC-20: each of the four modules has its own deep-dive page
- [x] ISC-21: every module page contains a wiring section
- [x] ISC-22: every module page contains a BOM table with per-part cost
- [x] ISC-23: every BOM part that has a purchase URL renders a working buy link
- [x] ISC-24: every module page contains a numbered step-by-step walkthrough

**Correctness — the reason this is data-driven**
- [x] ISC-25: the water bus pin set matches `firmware/water-level/water-level.ino` for the standalone build
- [x] ISC-26: the deployed pin set matches `firmware/farm-node/farm-node.ino`
- [x] ISC-27: the deep-sleep soil pin set matches `firmware/soil-node-sleep/soil-node-sleep.ino`
- [x] ISC-28: every rendered pin set names the file it was read from
- [x] ISC-29: the pin set a farmer should wire is visually distinguished from the others
- [x] ISC-30: the wiring SVG and the wiring table on a page are rendered from the same object
- [x] ISC-31: signed registers are labelled `signed int16` wherever they appear
- [x] ISC-32: steps that are design rather than report are marked as such on the page

**Anti-criteria**
- [x] ISC-33: Anti: no request to any third-party host — no Google Fonts, no analytics, no CDN
- [x] ISC-34: Anti: no page scrolls horizontally at a 390 px viewport
- [x] ISC-35: Anti: no `TBC` price is rendered as a made-up number
- [x] ISC-36: Anti: no circled numeral (U+2460–U+2473) survives anywhere in the rendered HTML

## Test Strategy

| isc | type | check | threshold | tool |
|---|---|---|---|---|
| 1–6 | build | run the builder, count and weigh output | 6 pages, <1 MB | `bun`, `du` |
| 4 | link | enumerate non-external `href`s, stat each target | zero misses | `agent-browser eval` |
| 7–24 | content | query the DOM for each required section/landmark | present | `agent-browser eval` |
| 9 | design | visual comparison against float.ag palette and register | judgement | screenshot |
| 25–27 | correctness | diff rendered pins against `grep` of each `.ino` | exact match | `grep`, `Read` |
| 33 | privacy | grep built HTML/CSS for external origins | zero | `grep -r` |
| 34 | layout | `document.body.scrollWidth > innerWidth` on every page at 390 px | false | `agent-browser` |
| 36 | encoding | grep built HTML for U+2460–2473 | zero | `grep -P` |

## Features

| name | satisfies | depends_on | parallelizable |
|---|---|---|---|
| `src/data.ts` — single source of truth | 25–32, 35 | firmware, `hardware/3S2P.md`, `STATUS.md` | no |
| `src/components.ts` — tables + SVG from one input | 13, 14, 22, 23, 30 | data.ts | no |
| `styles.css` — design system, light + dark | 9, 34 | — | yes |
| `src/pages/index.ts` | 7–17 | components | yes |
| `src/pages/cheatsheet.ts` | 18, 19 | components | yes |
| `src/pages/module.ts` | 20–24 | components | yes |
| `build.ts` + self-hosted fonts | 1–6, 33 | — | yes |

## Decisions

- **2026-08-05 — no generated raster art, despite `/Art` being invoked.** Two reasons.
  `~/.claude/PAI/.env` does not exist on this machine, so there is no image API key; and the
  Essay workflow's mandated register (charcoal sketch, burnt sienna + deep purple, KAI
  signature) is the principal's blog identity, not a farming toolkit's. Hand-authored inline SVG
  is strictly better for wiring anyway: scalable, theme-aware, and generated from the same pin
  data as the tables. Real bench photographs remain the right raster asset when we wire them in.
- **2026-08-05 — no framework.** The toolkit's whole ethos is "download one file, no install
  preamble". A zero-dependency bun script producing static HTML matches that, and keeps the
  hosting decision free.
- **2026-08-05 — content as typed data, not Markdown.** Markdown would have fought the BOM
  tables, the SVG generation and the shared pin data, and it would have re-created the §9 drift.
- **2026-08-05 — fonts self-hosted.** Article IV (Tino Rangatiratanga): a farmer on metered 4G
  should make requests to exactly one host. 230 KB, three families, latin + latin-ext only.
- **2026-08-05 — show-your-math on the delegation floor.** E3's soft floor is ≥2 delegations;
  zero were used. The session's harness rules forbid spawning agents unless the user asks, and
  the user asked for two *skills* (`frontend-design`, `Art`), both of which were invoked. A
  delegated sub-agent would have added review capacity on copy, not correctness — and
  correctness here came from reading the four `.ino` files directly, which no delegate could do
  better.
- **2026-08-05 — `refined:` ISC-36 added during EXECUTE.** The circled numerals ①–④ used
  throughout the repo are not present in Fraunces, Instrument Sans or DM Mono and rendered as
  tofu boxes. They were replaced with plain digits and drawn circles. The anti-criterion was
  added after the failure was seen on screen, not predicted.

## Changelog

- **conjectured:** rendering the module docs faithfully was the whole job, so the site's risk was
  presentational.
  **refuted_by:** reading `firmware/water-level/water-level.ino`, `farm-node.ino` and
  `soil-node-sleep.ino` during BUILD showed three *different, all-correct* pin assignments for the
  same two buses — and the module docs, `CLAUDE.md` and `STATUS.md` each flatten them to one.
  **learned:** the drift `docs/deployment-wiring.md` §9 recorded is not a one-off; it is structural,
  because the docs have no way to express "this bus has several correct wirings, and which one you
  want depends on the sketch you are about to flash".
  **criterion_now:** every rendered pin set names its `.ino` (ISC-28) and flags the one a farmer
  should wire (ISC-29); ISC-25–27 assert each against its source file.

## Verification

- ISC-1,2,5: `bun site/build.ts` → `built 6 pages in 11ms`; `curl -sI localhost:4321/index.html` → `HTTP/1.1 200 OK`.
- ISC-6: `du -sh site/dist` → **520K**, of which ~230K is fonts.
- ISC-4: `agent-browser eval` over all non-external `href`s → 10 distinct targets, all emitted.
- ISC-9: screenshots in light and dark; palette drawn from float.ag's own tokens (#131415 ink,
  #F7F7F7 paper, warm accent), with a per-module accent added.
- ISC-25: `grep RS485_RX firmware/water-level/water-level.ino` → `D5 // GPIO14`; rendered `D5 GPIO14`. Match.
- ISC-26: `grep WATER_RX firmware/farm-node/farm-node.ino` → `D7 // GPIO13`; rendered `D7 GPIO13`. Match.
- ISC-27: `grep SOIL_RX firmware/soil-node-sleep/soil-node-sleep.ino` → `D6 // GPIO12`; rendered `D6 GPIO12`. Match.
- ISC-34: `document.body.scrollWidth > innerWidth` at 390 px → `false` on all six pages, after
  fixing three `min-width: auto` grid blowouts (`.videowrap`, `.step`, `.cols`).
- ISC-33: `grep -roE '(src|href)="https?://...` over `site/dist` → every off-origin URL is an
  anchor `href` the reader chooses to follow. The only `<link>` elements are `assets/fonts/fonts.css`,
  `assets/styles.css` and `assets/favicon.svg`, all same-origin; there is no `<script src>`, no
  `@import`, and no off-origin `url()`. Passed.
- ISC-36: `grep -roP '[\x{2460}-\x{2473}]' site/dist --include='*.html'` → no matches; same grep
  over `site/src` → no matches. Passed.
- ISC-35: the two probes with no confirmed invoice render as a dotted-underline `TBC` with a
  tooltip, and the BOM footer shows `~$18` + `+1 TBC` rather than inventing a total.
