// Screenshot check (CLAUDE.md, Verification step 2).
// Usage: node scripts/shots.mjs [name] [filter] [--ref <git ref>]   -> screenshots/<name>/ (default "current")
// filter: only take shots whose file name contains this text, e.g. "ipad" or "photons".
// --ref: serve the site as committed at that git ref instead of the working tree, e.g. --ref HEAD for a baseline.
// Serves the repo root on a local port, seeds Math.random and fakes the clock so photons and the 3D room
// draw the same way on every run, then saves one PNG per size and view. Console errors go to errors.txt.
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), at = args.indexOf('--ref');
const REF = at >= 0 ? args.splice(at, 2)[1] : null;
const OUT = join(ROOT, 'screenshots', args[0] || 'current');
const FILTER = args[1] || '';

const SIZES = [
  { name: 'iphone', width: 390, height: 844 },
  { name: 'shortphone', width: 390, height: 620 },
  { name: 'ipad', width: 1180, height: 820 },
];
const LOOKS = ['heat', 'glow', 'photons'];
const STATES = [{ id: 'slice-heat-c20-g0', look: 'heat', cone: 20, gap: 0 }];
for (const look of LOOKS) for (const cone of [10, 40]) for (const gap of [0, 10])
  STATES.push({ id: `slice-${look}-c${cone}-g${gap}`, look, cone, gap });
STATES.push({ id: 'room-3d', view: '3d' });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  try {
    const file = path || 'index.html';
    const body = REF ? execFileSync('git', ['show', `${REF}:${file.replace(/\\/g, '/')}`], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      : await readFile(join(ROOT, file));
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

// Seeded random (mulberry32) so photon paths and voxel shading repeat run to run.
const seed = () => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const errors = [];
for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2 });
  for (const st of STATES) {
    if (!`${size.name}-${st.id}`.includes(FILTER)) continue;
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(`${size.name} ${st.id}: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`${size.name} ${st.id}: ${e.message}`));
    await page.addInitScript(seed);
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
    // The fake performance.now() can start 1 ms off between runs, which shifts the first photon step. Pin it to the fake clock.
    await page.addInitScript(() => { const now = Date.now; performance.now = () => now() - 1000; });
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // Redraw once the fonts are in, as a resize would, so chart text does not depend on load timing.
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    if (st.view === '3d') {
      await page.click('#v3d');
    } else {
      if (st.cone !== 20) await page.click(`[data-cone="${st.cone}"]`);
      if (st.gap) await page.evaluate(g => { const s = document.getElementById('contact'); s.value = g; s.dispatchEvent(new Event('input')); }, st.gap);
      if (st.look !== 'heat') await page.click(`[data-look="${st.look}"]`);
    }
    await page.clock.runFor(st.look === 'photons' ? 3000 : 1000);
    await page.screenshot({ path: join(OUT, `${size.name}-${st.id}.png`), fullPage: true });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
server.close();
await writeFile(join(OUT, 'errors.txt'), errors.join('\n'));
console.log(`Screenshots in ${OUT}`);
console.log(errors.length ? `Console errors:\n${errors.join('\n')}` : 'No console errors.');
