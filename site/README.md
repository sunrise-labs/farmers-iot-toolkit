# `site/` — the Toolkit website

The public face of the toolkit: a hero, the four modules and how they interact, a video
summary slot, the full wiring cheatsheet, and a deep-dive page per module with wiring
diagrams, a BOM with buy links, and a step-by-step build walkthrough.

```bash
bun site/build.ts            # build → site/dist/
bun site/build.ts --serve    # build, then serve on http://localhost:4321
```

No framework, no bundler, no dependencies. The output is plain static HTML, which is
deliberate: **where this gets hosted is still an open question** (Float's site vs our own
domain — see `STATUS.md`), and `site/dist/` drops unchanged onto GitHub Pages, the hetzner
box, or inside somebody else's site.

## Why the content lives in TypeScript and not Markdown

`docs/deployment-wiring.md` §9 records a real failure. The combined node's pin assignment was
changed at the soldering iron on 2026-07-19, the firmware was updated to match, and four prose
files kept teaching the old order. Anyone rebuilding from the docs wired it wrong and got two
dead buses.

A website is a fifth place for that to rot. So the site isn't prose with tables typed into it —
every pin table, bus parameter, BOM row and wiring SVG is **rendered from `src/data.ts`**. The
diagram and the table beside it cannot disagree, because they are one input.

`data.ts` also carries the thing the old docs were missing: a bus has **more than one correct
pin assignment** (standalone module build vs our deployed node vs the deep-sleep variant), and
every `PinSet` names the `.ino` it was read out of. The one a farmer should wire is flagged
`teaching: true` and rendered as *wire this one*.

## Layout

| Path | What it is |
|---|---|
| `build.ts` | Renders every page into `dist/`, copies assets. `--serve` to preview. |
| `src/data.ts` | **Single source of truth** — parts, prices, buses, pin sets, power, steps, faults. |
| `src/components.ts` | HTML + SVG rendering helpers. Tables and diagrams share their input. |
| `src/layout.ts` | The page shell: head, nav, footer, theme toggle. |
| `src/pages/` | `index`, `cheatsheet`, and `module` (which emits all four module pages). |
| `styles.css` | The whole design system. Light and dark are both first-class. |
| `assets/fonts/` | Self-hosted Fraunces / Instrument Sans / DM Mono (~230 KB). |
| `tools/fetch-fonts.ts` | Re-downloads and re-subsets those fonts. Run once; output is committed. |
| `dist/` | Build output. Committed, so it can be served from anywhere without a build step. |

## Things worth keeping true

- **Fonts are self-hosted on purpose.** A farmer on a metered 4G connection should make requests
  to exactly one host. There is no Google Fonts link, no analytics, no third-party request of any
  kind, and no cookie — the theme preference is `localStorage` and nothing else.
- **The status badges must track `STATUS.md`.** The site says which steps are *design, not
  report*, and that honesty is the point. If a module gets finished, update `statusLine` and the
  `proven` flag on its steps in the same commit.
- **The video is a slot.** `VIDEO.id` is `null`, so the section renders an honest placeholder.
  Drop a YouTube ID in and it becomes a click-to-load facade — nothing loads from YouTube until
  the reader presses play.
- **Prices marked `usd: null` render as `TBC`,** not as a guess. Two probe prices are genuinely
  unknown until the invoices are found.
- Module numerals are drawn as circles, never typeset. The characters ①–④ are not in any font the
  site ships and render as tofu boxes on most devices.

## Deploying

`site/dist/` is a complete static site with relative links throughout, so it works from a domain
root or a subdirectory. A `.nojekyll` file is emitted for GitHub Pages. There are no third-party
requests of any kind, so nothing needs to be reachable but the host itself.

**GitHub Pages** is wired up in `.github/workflows/pages.yml`. It runs on any push to `main` that
touches `site/`, builds with `bun site/build.ts`, and uploads `site/dist/` as the Pages artifact.
It builds rather than uploading the committed `dist/` so a forgotten rebuild can't put a stale
page in front of a farmer; if the committed copy has drifted, the run says so in its job summary
instead of failing.

Pages must be switched on once before the first deploy succeeds — **Settings → Pages → Source:
GitHub Actions**. Until then the deploy step fails rather than publishing, which is deliberate:
where this is hosted is still an open decision (see `STATUS.md`). The published URL would be
`https://sunrise-labs.github.io/farmers-iot-toolkit/`; the subdirectory is fine, because every
link and asset reference in `dist/` is relative.
