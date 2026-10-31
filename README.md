# Under the cone

An interactive teaching app that shows how a 50 kV superficial x ray beam from an Xstrahl RADiant Aura deposits dose in skin. It's for patients, students and radiation therapists. The site is static: `index.html` plus `physics.js`, with no build step.

**This is a reference and teaching tool only. It is never used for prescription or treatment calculation.** Treatment uses the clinic's commissioned data and physicist.

`CLAUDE.md` is the ground truth for the physics, design and rules.

## Run it locally

The page loads `physics.js` as an ES module, so it needs a local web server. Opening `index.html` straight from disk won't work.

```bash
npx serve
```

Then open http://localhost:3000.

## Tests

Needs Node 20 or later.

```bash
npm install
npm test
```

`tests/physics.test.mjs` checks the cone table against `CLAUDE.md` and the physics module against every row of the Expected values table that applies to each cone. The isodose depth targets are given for the 20 mm cone only.

## Screenshot check

```bash
npx playwright install chromium
npm run shots -- baseline --ref HEAD
npm run shots
npm run compare
```

The first `shots` command photographs the last commit into `screenshots/baseline/`. The second photographs your working copy into `screenshots/current/`. Both cover iPhone (390 × 844), short phone (390 × 620) and iPad (1180 × 820): the Skin slice as it opens (20 mm cone), the Skin slice in all three looks with the 10 and 40 mm cones, the 3D room, three lesion cases (3.4 mm deep at 3 Gy, 5.0 mm deep past the clinic table, and a 3 mm lesion 0.5 mm deep), and patient mode (Skin slice with the 20 mm cone, photons with the 40 mm cone, and the 3D room). Photons and the clock are seeded, so unchanged code gives identical pixels. `npm run compare` lists any differences and saves diff images. The `screenshots/` folder is not committed.
