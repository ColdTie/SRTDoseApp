// Compare two screenshot folders pixel by pixel.
// Usage: node scripts/compare.mjs [a] [b]   (defaults: baseline current)
// Prints the share of changed pixels per file and writes a diff image (changes in red) to screenshots/diff-<a>-<b>/.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SHOTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'screenshots');
const [A, B] = [process.argv[2] || 'baseline', process.argv[3] || 'current'];
const OUT = join(SHOTS, `diff-${A}-${B}`);
await mkdir(OUT, { recursive: true });

const files = (await readdir(join(SHOTS, A))).filter(f => f.endsWith('.png'));
const browser = await chromium.launch();
const page = await browser.newPage();
let changed = 0;
for (const f of files) {
  let b64b;
  try { b64b = (await readFile(join(SHOTS, B, f))).toString('base64'); } catch { console.log(`${f}: missing in ${B}`); changed++; continue; }
  const b64a = (await readFile(join(SHOTS, A, f))).toString('base64');
  const r = await page.evaluate(async ([a, b]) => {
    const load = s => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { size: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height);
    x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height);
    let n = 0, max = 0; const o = x.createImageData(c.width, c.height);
    for (let i = 0; i < da.data.length; i += 4) {
      const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
      const g = (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 12;
      if (d > 0) { n++; max = Math.max(max, d); o.data[i] = 255; o.data[i + 1] = 0; o.data[i + 2] = 0; }
      else { o.data[i] = o.data[i + 1] = o.data[i + 2] = g; }
      o.data[i + 3] = 255;
    }
    if (!n) return { n };
    x.putImageData(o, 0, 0);
    return { n, max, pct: 100 * n / (c.width * c.height), png: c.toDataURL('image/png').split(',')[1] };
  }, [b64a, b64b]);
  if (r.size) { console.log(`${f}: size differs (${r.size})`); changed++; continue; }
  if (!r.n) continue;
  changed++;
  console.log(`${f}: ${r.n} pixels differ (${r.pct.toFixed(3)}%), largest channel change ${r.max}`);
  await writeFile(join(OUT, f), Buffer.from(r.png, 'base64'));
}
await browser.close();
console.log(changed ? `${changed} of ${files.length} differ. Diff images in ${OUT}` : `All ${files.length} screenshots identical.`);
