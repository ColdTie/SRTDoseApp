// Regression targets from CLAUDE.md, "Expected values" (20 mm cone, touching), checked for all five cones where they apply.
import { test } from 'node:test';
import assert from 'node:assert/strict';
// DSURF and FR are live bindings: they follow setCone.
import { SSD, CONES, DSURF, FR, setCone, pchip, doseAt, isoDepth, offAxis, edgeAt } from '../physics.js';

// Clinic table copied from CLAUDE.md on its own, so a typo in physics.js (or here) fails the tests.
// t: beam on time in minutes for 6 Gy at 0.0 to 4.0 mm. beam: minutes for 2.5 Gy at 2 mm.
const TABLE = {
  10: { t: [2.70, 2.81, 2.93, 3.07, 3.30, 3.44, 3.59, 3.74, 3.92], beam: 1.37, mu: 0.0640, tail: 0.55 },
  15: { t: [2.59, 2.69, 2.81, 2.93, 3.11, 3.23, 3.37, 3.54, 3.74], beam: 1.29, mu: 0.0591, tail: 0.70 },
  20: { t: [2.51, 2.61, 2.71, 2.83, 3.01, 3.12, 3.24, 3.42, 3.60], beam: 1.26, mu: 0.0574, tail: 1.00 },
  30: { t: [2.44, 2.53, 2.64, 2.75, 2.92, 3.03, 3.14, 3.30, 3.48], beam: 1.21, mu: 0.0561, tail: 1.35 },
  40: { t: [2.40, 2.50, 2.59, 2.71, 2.87, 2.98, 3.10, 3.25, 3.40], beam: 1.20, mu: 0.0560, tail: 1.70 },
};
const SIZES = [10, 15, 20, 30, 40];
const DEPTHS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
const FINE = 0.0005; // isodose search step for tests (the panel uses 0.05 mm)
const near = (actual, expected, tol, what) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: ${actual} not within ${tol} of ${expected}`);
// Relative depth dose on the central axis from the clinic table: time at surface / time at depth.
const tablePdd = (c, i) => TABLE[c].t[0] / TABLE[c].t[i];

test('cone table in physics.js matches CLAUDE.md', () => {
  assert.deepEqual(CONES, TABLE);
});

test('PCHIP reproduces straight line data exactly, and axis dose falls steadily from 0 to 4 mm', () => {
  const xs = [0, 0.5, 1, 1.5, 2], f = pchip(xs, xs.map(x => 1 - 0.1 * x));
  for (let x = 0; x <= 2; x += 0.05) near(f(x), 1 - 0.1 * x, 1e-12, `line at ${x.toFixed(2)} mm`);
  for (const c of SIZES) {
    setCone(c);
    let prev = Infinity;
    for (let d = 0; d <= 4.0001; d += 0.01) {
      const v = doseAt(0, SSD + d, d);
      assert.ok(v < prev, `${c} mm cone: dose rises at ${d.toFixed(2)} mm`);
      prev = v;
    }
  }
});
// Depth where the table depth dose falls to frac, linear between 0.5 mm rows.
const tableDepth = (c, frac) => {
  for (let i = 1; i < 9; i++) {
    const a = tablePdd(c, i - 1), b = tablePdd(c, i);
    if (b <= frac) return DEPTHS[i - 1] + 0.5 * (a - frac) / (a - b);
  }
  return NaN;
};

for (const c of SIZES) {
  test(`${c} mm cone: model matches the clinic table at all 9 depths (within 0.1%)`, () => {
    setCone(c);
    const surf = doseAt(0, SSD, 0);
    DEPTHS.forEach((d, i) => {
      const model = doseAt(0, SSD + d, d) / surf;
      const rel = Math.abs(model / tablePdd(c, i) - 1) * 100;
      assert.ok(rel <= 0.1, `${d} mm: model ${model.toFixed(5)}, table ${tablePdd(c, i).toFixed(5)}, off by ${rel.toFixed(3)}%`);
    });
  });

  test(`${c} mm cone: 2.5 Gy prescription gives exactly 2.50 Gy at 2 mm`, () => {
    setCone(c);
    const gy = doseAt(0, SSD + 2, 2) * DSURF;
    near(gy, 2.5, 1e-9, 'dose at 2 mm');
    assert.equal(gy.toFixed(2), '2.50');
  });

  test(`${c} mm cone: skin surface dose follows the table (2.5 Gy × time at 2 mm / time at skin, ± 0.01)`, () => {
    setCone(c);
    near(doseAt(0, SSD, 0) * DSURF, 2.5 * TABLE[c].t[4] / TABLE[c].t[0], 0.01, 'skin surface dose');
  });

  test(`${c} mm cone: 90% and 80% isodose depths match the clinic table (± 0.05 mm)`, () => {
    setCone(c);
    near(isoDepth(0.9, 0, FINE), tableDepth(c, 0.9), 0.05, '90% depth');
    near(isoDepth(0.8, 0, FINE), tableDepth(c, 0.8), 0.05, '80% depth');
  });

  test(`${c} mm cone: 80 to 20% edge width at 5 mm is 1.1 to 1.7 mm`, () => {
    setCone(c);
    const span = FR + 12, w = edgeAt(0.2, 5, span) - edgeAt(0.8, 5, span);
    assert.ok(w >= 1.1 && w <= 1.7, `edge width ${w.toFixed(2)} mm`);
  });

  test(`${c} mm cone: out of field at the skin, 1 cm past the edge, is under 1%`, () => {
    setCone(c);
    const out = 100 * offAxis(edgeAt(0.5, 0, FR + 12) + 10, 0);
    assert.ok(out < 1, `out of field ${out.toFixed(2)}%`);
  });
}

test('20 mm cone: isodose depths 90% 1.35, 80% 2.58 (± 0.05), 50% 8.24 (± 0.1), 20% 22.4 mm (± 0.2)', () => {
  setCone(20);
  near(isoDepth(0.9, 0, FINE), 1.35, 0.05, '90% depth');
  near(isoDepth(0.8, 0, FINE), 2.58, 0.05, '80% depth');
  near(isoDepth(0.5, 0, FINE), 8.24, 0.1, '50% depth');
  near(isoDepth(0.2, 0, FINE), 22.4, 0.2, '20% depth');
});

test('20 mm cone: skin surface dose 3.00 Gy (± 0.01)', () => {
  setCone(20);
  near(doseAt(0, SSD, 0) * DSURF, 3.0, 0.01, 'skin surface dose');
});

test('20 mm cone: edge width at 5 mm reads 1.3 mm', () => {
  setCone(20);
  const span = FR + 12;
  assert.equal((edgeAt(0.2, 5, span) - edgeAt(0.8, 5, span)).toFixed(1), '1.3');
});

test('20 mm cone: out of field at the skin, 1 cm past the edge, is about 0.6% (± 0.1)', () => {
  setCone(20);
  near(100 * offAxis(edgeAt(0.5, 0, FR + 12) + 10, 0), 0.6, 0.1, 'out of field');
});
