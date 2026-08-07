/**
 * Builds the Farmers IoT Toolkit website into `site/dist/`.
 *
 *   bun site/build.ts            # build once
 *   bun site/build.ts --serve    # build, then serve on :4321 and rebuild on request
 *
 * No dependencies, no framework, no bundler. The output is plain static HTML that
 * will sit happily on GitHub Pages, on the hetzner box, or inside somebody else's
 * site — which matters, because where this ends up hosted is still an open question.
 */

import { mkdir, readdir, rm, copyFile, stat } from "node:fs/promises";
import { join, dirname, relative } from "node:path";

const ROOT = dirname(new URL(import.meta.url).pathname);
const DIST = join(ROOT, "dist");

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
  stroke="#C77C1E" stroke-width="2" stroke-linecap="round">
  <rect width="24" height="24" rx="5" fill="#12110F" stroke="none"/>
  <path d="M4 19h16"/>
  <path d="M12 19V9"/>
  <path d="M12 9c0-3 2.6-5.4 5.6-5.4C17.6 7 15 9 12 9Z" fill="#4A7A3B" stroke="#4A7A3B"/>
  <path d="M12 13c0-2.4-2.1-4.3-4.6-4.3C7.4 11.4 9.5 13 12 13Z" fill="#2B6E7A" stroke="#2B6E7A"/>
</svg>`;

async function copyTree(from: string, to: string) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) await copyTree(src, dst);
    else await copyFile(src, dst);
  }
}

export async function build() {
  const t0 = performance.now();
  await rm(DIST, { recursive: true, force: true });
  await mkdir(join(DIST, "assets"), { recursive: true });
  await mkdir(join(DIST, "modules"), { recursive: true });

  // Pages are imported fresh each build so --serve picks up edits.
  const bust = `?v=${Date.now()}`;
  const home = await import(`./src/pages/index.ts${bust}`);
  const sheet = await import(`./src/pages/cheatsheet.ts${bust}`);
  const mods = await import(`./src/pages/module.ts${bust}`);
  const missing = await import(`./src/pages/notfound.ts${bust}`);

  const written: string[] = [];
  const write = async (path: string, html: string) => {
    await Bun.write(join(DIST, path), html);
    written.push(path);
  };

  await write("index.html", home.page);
  await write("cheatsheet.html", sheet.page);
  for (const p of mods.pages) await write(p.path, p.html);
  // GitHub Pages serves /404.html for any unknown path, so it lives at the root
  // and carries its own inline styles — see src/pages/notfound.ts.
  await write("404.html", missing.page);

  // Assets
  await copyFile(join(ROOT, "styles.css"), join(DIST, "assets", "styles.css"));
  await copyTree(join(ROOT, "assets", "fonts"), join(DIST, "assets", "fonts"));
  await Bun.write(join(DIST, "assets", "favicon.svg"), FAVICON);

  const imgSrc = join(ROOT, "assets", "img");
  if (await stat(imgSrc).catch(() => null)) {
    await copyTree(imgSrc, join(DIST, "assets", "img"));
  }

  // GitHub Pages serves /docs and _-prefixed paths oddly without this.
  await Bun.write(join(DIST, ".nojekyll"), "");

  const ms = Math.round(performance.now() - t0);
  console.log(`built ${written.length} pages in ${ms}ms → ${relative(process.cwd(), DIST)}/`);
  for (const p of written) console.log(`  · ${p}`);
  return written;
}

await build();

if (process.argv.includes("--serve")) {
  const port = 4321;
  Bun.serve({
    port,
    async fetch(req) {
      let path = new URL(req.url).pathname;
      if (path.endsWith("/")) path += "index.html";
      const file = Bun.file(join(DIST, path));
      if (await file.exists()) return new Response(file);
      return new Response("Not found", { status: 404 });
    },
  });
  console.log(`\nserving http://localhost:${port}  (re-run to rebuild)`);
}
