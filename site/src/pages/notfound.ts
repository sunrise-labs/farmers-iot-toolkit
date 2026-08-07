import { MODULES, SITE } from "../data.ts";
import { esc } from "../components.ts";

/**
 * The 404 page.
 *
 * This one page cannot use `shell()`, and the reason is worth writing down.
 *
 * GitHub Pages serves the CONTENT of `/404.html` at whatever URL actually 404'd,
 * without redirecting. So a request for `/modules/typo.html` renders this file
 * while the browser still thinks it is one directory down — and every relative
 * `assets/...` link would resolve against that wrong directory and break, which
 * is a particularly bad look on the page whose whole job is to recover from a
 * broken link.
 *
 * So: no external stylesheet, no webfont, no image. Everything is inline, using
 * the same tokens as `styles.css` and a system font stack that sits close to
 * Instrument Sans. The nav links are written relative (correct for the common
 * case, a 404 at the site root) and then corrected at load time for the one
 * subdirectory the site has. They work without JavaScript from the root; the
 * script only fixes the deeper case.
 */

const CSS = `
:root {
  --paper:#F6F2E9; --paper-2:#EEE9DC; --ink:#1B1815; --ink-2:#524B41; --ink-3:#857D6E;
  --rule:#DBD3C1; --rule-soft:#E7E1D2; --accent:#C77C1E;
  --body:"Instrument Sans","Helvetica Neue",system-ui,sans-serif;
  --display:"Fraunces","Iowan Old Style",Georgia,serif;
  --mono:"DM Mono",ui-monospace,"SF Mono",Menlo,monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper:#131210; --paper-2:#1A1815; --ink:#EFE9DC; --ink-2:#B2AA9A; --ink-3:#7E7666;
    --rule:#2F2B24; --rule-soft:#262219; --accent:#E8A94A;
  }
}
:root[data-theme="dark"] {
  --paper:#131210; --paper-2:#1A1815; --ink:#EFE9DC; --ink-2:#B2AA9A; --ink-3:#7E7666;
  --rule:#2F2B24; --rule-soft:#262219; --accent:#E8A94A;
}
* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100vh; display: grid; place-items: center;
  padding: clamp(1.5rem, 6vw, 4rem);
  background: var(--paper); color: var(--ink);
  font-family: var(--body); line-height: 1.6;
  background-image:
    linear-gradient(var(--rule-soft) 1px, transparent 1px),
    linear-gradient(90deg, var(--rule-soft) 1px, transparent 1px);
  background-size: 22px 22px;
}
.wrap { width: min(56rem, 100%); }
.card {
  background: var(--paper); border: 1px solid var(--rule); border-radius: 12px;
  padding: clamp(1.6rem, 5vw, 3rem);
}
.rule { width: 3.5rem; height: 3px; background: var(--accent); border-radius: 2px; margin-bottom: 1.6rem; }
.code {
  font-family: var(--mono); font-size: .8rem; letter-spacing: .18em;
  text-transform: uppercase; color: var(--ink-3); margin: 0 0 .6rem;
}
h1 {
  font-family: var(--display); font-weight: 600; line-height: 1.08;
  font-size: clamp(2rem, 6vw, 3.2rem); margin: 0 0 1rem; letter-spacing: -.02em;
}
p.lede { font-size: 1.06rem; color: var(--ink-2); max-width: 52ch; margin: 0 0 1.8rem; }
.links { display: grid; gap: .7rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); margin: 0; padding: 0; list-style: none; }
.links a {
  display: block; padding: .85rem 1rem; text-decoration: none;
  border: 1px solid var(--rule); border-left: 3px solid var(--accent);
  border-radius: 0 9px 9px 0; background: var(--paper-2);
  color: var(--ink); font-weight: 600; font-size: .95rem;
}
.links a span { display: block; font-weight: 400; font-size: .85rem; color: var(--ink-3); margin-top: .15rem; }
.links a:hover { border-color: var(--accent); }
.links a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.foot { margin-top: 2rem; padding-top: 1.2rem; border-top: 1px solid var(--rule-soft); font-size: .87rem; color: var(--ink-3); }
.foot a { color: var(--ink-2); }
`;

const links = [
  { href: "index.html", label: "The four modules", sub: "Start here" },
  { href: "cheatsheet.html", label: "Wiring cheatsheet", sub: "Every pin and voltage on one page" },
  ...MODULES.slice(0, 2).map((m) => ({
    href: `modules/${m.slug}.html`,
    label: `${m.n} · ${m.title}`,
    sub: m.short,
  })),
];

export const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found — ${SITE.name}</title>
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <main class="card">
    <div class="rule" aria-hidden="true"></div>
    <p class="code">Error 404</p>
    <h1>This page isn't wired&nbsp;up</h1>
    <p class="lede">There's nothing at that address. It may have moved when the modules were
    renumbered — the toolkit is now <b>1 Power</b>, <b>2 Water</b>, <b>3 Soil</b> and
    <b>4 Phone</b>. Everything below still works.</p>
    <ul class="links" data-nav>
      ${links
        .map(
          (l) => `<li><a href="${l.href}">${esc(l.label)}<span>${esc(l.sub)}</span></a></li>`,
        )
        .join("\n      ")}
    </ul>
    <p class="foot">If a link on this site brought you here, that's our bug —
    <a href="${SITE.repo}/issues" rel="noopener">tell us about it</a>.</p>
  </main>
</div>
<script>
// GitHub Pages renders this file at whatever URL 404'd rather than redirecting,
// so from /modules/typo.html a relative "index.html" would point at
// /modules/index.html. The links above are correct from the site root; this
// walks them back up when we are one directory down. Without JS, a root-level
// 404 (the common case) still works.
(function () {
  var dir = location.pathname.slice(0, location.pathname.lastIndexOf("/") + 1);
  if (!/\\/modules\\/$/.test(dir)) return;
  var nav = document.querySelector("[data-nav]");
  if (!nav) return;
  nav.querySelectorAll("a").forEach(function (a) {
    a.setAttribute("href", "../" + a.getAttribute("href"));
  });
})();
</script>
</body>
</html>`;
