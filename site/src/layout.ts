import { MODULES, SITE } from "./data.ts";

export type PageMeta = {
  title: string;
  description: string;
  /** "" for pages at the root, "../" for pages one directory down. */
  base: string;
  /** Adds the module accent colour to the page root. */
  accent?: string;
  accentDark?: string;
  bodyClass?: string;
};

export function shell(meta: PageMeta, body: string): string {
  const b = meta.base;
  const accentVars = meta.accent
    ? ` style="--accent:${meta.accent};--accent-dark:${meta.accentDark ?? meta.accent}"`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${meta.title}</title>
<meta name="description" content="${meta.description}">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="${meta.title}">
<meta property="og:description" content="${meta.description}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="${b}assets/fonts/fonts.css">
<link rel="stylesheet" href="${b}assets/styles.css">
<link rel="icon" href="${b}assets/favicon.svg" type="image/svg+xml">
</head>
<body class="${meta.bodyClass ?? ""}"${accentVars}>
<a class="skip" href="#main">Skip to content</a>

<header class="topbar">
  <a class="brand" href="${b}index.html">
    <span class="brand__mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M3 20h18" stroke-linecap="round"/>
        <path d="M12 20V9"/>
        <path d="M12 9c0-3 2.6-5.4 5.6-5.4C17.6 7 15 9 12 9Z"/>
        <path d="M12 12.5c0-2.4-2.1-4.3-4.6-4.3C7.4 11.4 9.5 12.5 12 12.5Z"/>
      </svg>
    </span>
    <span class="brand__name">Farmers IoT Toolkit</span>
  </a>
  <nav class="topnav" aria-label="Main">
    <a href="${b}index.html#modules">Modules</a>
    <a href="${b}index.html#system">How it fits</a>
    <a href="${b}index.html#video">Video</a>
    <a href="${b}cheatsheet.html">Wiring cheatsheet</a>
    <a class="topnav__ext" href="${SITE.repo}" rel="noopener">Source ↗</a>
  </nav>
  <button class="themetoggle" type="button" aria-label="Switch between light and dark" data-theme-toggle>
    <span aria-hidden="true">◐</span>
  </button>
</header>

<main id="main">
${body}
</main>

<footer class="foot">
  <div class="foot__grid">
    <div class="foot__col">
      <h2 class="foot__h">Farmers IoT Toolkit</h2>
      <p>${SITE.description}</p>
      <p class="foot__lic">${SITE.license}</p>
    </div>
    <div class="foot__col">
      <h3 class="foot__h">Modules</h3>
      <ul>
        ${MODULES.map(
          (m) => `<li><a href="${b}modules/${m.slug}.html">${m.n} · ${m.short}</a></li>`,
        ).join("\n        ")}
      </ul>
    </div>
    <div class="foot__col">
      <h3 class="foot__h">Go deeper</h3>
      <ul>
        <li><a href="${b}cheatsheet.html">Full wiring cheatsheet</a></li>
        <li><a href="${SITE.repo}" rel="noopener">Firmware &amp; flows ↗</a></li>
        <li><a href="${SITE.repo}/blob/main/devlog.md" rel="noopener">Build journal ↗</a></li>
        <li><a href="${SITE.repo}/blob/main/STATUS.md" rel="noopener">Live status ↗</a></li>
      </ul>
    </div>
    <div class="foot__col">
      <h3 class="foot__h">The project</h3>
      <p>A discovery project funded by
        <a href="${SITE.funder.url}" rel="noopener">${SITE.funder.name}</a>,
        implemented by
        <a href="${SITE.builder.url}" rel="noopener">${SITE.builder.name}</a>
        in ${SITE.builder.place}.</p>
      <p class="foot__note">Contributions welcome — a fifth module, a correction, a photo of
      yours in the field. Open an issue.</p>
    </div>
  </div>
</footer>

<script>
// Theme: follow the system unless the reader has said otherwise. No cookies, no
// analytics, no third-party requests anywhere on this site.
(function () {
  var KEY = "fit-theme";
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved) document.documentElement.dataset.theme = saved;
  var btn = document.querySelector("[data-theme-toggle]");
  if (!btn) return;
  btn.addEventListener("click", function () {
    var dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    var next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });
})();
</script>
</body>
</html>`;
}
