# Under the cone

An interactive teaching app that shows how a 50 kV superficial x ray beam from an Xstrahl RADiant Aura deposits dose in skin. Built for patients, students and the treating radiation therapist (Steve). It runs as a static site on GitHub Pages.

**This is a reference and teaching tool. It is never used for prescription or treatment calculation.** The disclaimer in the panel must always stay visible.

## How to work in this repo

- Read this whole file before every session. It is the ground truth. If code and this file disagree, ask Steve before changing either.
- Keep changes small and focused. One feature or fix per session, then commit.
- Do not change physics numbers without a cited source or Steve's table. Add the source to the Sources section.
- After any change, run the tests and the screenshot check (see Verification). Do not commit if the accuracy tests fail.
- Ask before adding dependencies, frameworks or a build step. The site must stay static with no build.
- Steve wants short, plain answers. No hype, no selling ideas back to him, no long explanations.

## Stack

- Static HTML, CSS and plain JavaScript (ES modules are fine). No bundler, no framework.
- three.js r128 UMD from `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` and OrbitControls from `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js`. Keep versions pinned.
- Fonts: Pixelify Sans (headings, view buttons) and Atkinson Hyperlegible (body and all numbers, bold, tabular figures).
- Hosting: GitHub Pages from the `main` branch root. `index.html` is the entry point.
- Tests: Node's built in test runner (`node --test`). Screenshots: Playwright (dev only).

## Machine and treatment (Steve's clinic)

- Xstrahl RADiant Aura (FDA K230611): 10 to 80 kV, Varex VF-80 tube (transmission target, nearly symmetric beam).
- SRT applicators: closed clear acrylic (PMMA) cones at 6 cm focal spot distance, sizes 10, 15, 20, 30, 40 mm.
- Typical treatment: 50 kV, Filter 2, 20 mm cone, 2.5 Gy per visit, 20 visits (50 Gy), prescribed to 2 mm. Daily ultrasound sets the depth.
- The only other fractionation is 3 Gy per visit, 15 visits (45 Gy).

## Physics model (current, verified)

All distances in mm. Dose is relative, normalized to the central axis skin surface with the applicator touching.

### Clinic table (source of truth for 0 to 4 mm)

Beam on time in minutes for 6 Gy, depths 0.0 to 4.0 mm in 0.5 mm steps. Depth dose at a depth = time at surface / time at that depth. `beam` is minutes for 2.5 Gy at 2 mm.

| Cone | 0.0 | 0.5 | 1.0 | 1.5 | 2.0 | 2.5 | 3.0 | 3.5 | 4.0 | beam | mu | tail |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 2.70 | 2.81 | 2.93 | 3.07 | 3.30 | 3.44 | 3.59 | 3.74 | 3.92 | 1.37 | 0.0640 | 0.55 |
| 15 | 2.59 | 2.69 | 2.81 | 2.93 | 3.11 | 3.23 | 3.37 | 3.54 | 3.74 | 1.29 | 0.0591 | 0.70 |
| 20 | 2.51 | 2.61 | 2.71 | 2.83 | 3.01 | 3.12 | 3.24 | 3.42 | 3.60 | 1.26 | 0.0574 | 1.00 |
| 30 | 2.44 | 2.53 | 2.64 | 2.75 | 2.92 | 3.03 | 3.14 | 3.30 | 3.48 | 1.21 | 0.0561 | 1.35 |
| 40 | 2.40 | 2.50 | 2.59 | 2.71 | 2.87 | 2.98 | 3.10 | 3.25 | 3.40 | 1.20 | 0.0560 | 1.70 |

Beam on time scales linearly with dose (the table's 2 Gy column is one third of the 6 Gy column), so time for any dose = t6(depth) × dose / 6.

Known table quirks, do not "fix" them in the data: every cone drops slightly more between 1.5 and 2.0 mm than between its neighbors (under 1.5%). The 20 mm cone 2 Gy column has a likely typo at 0.5 mm (0.97, should be about 0.87). The 15 mm cone 5.5 Gy column at 0.5 mm (2.74) looks like a typo too.

### Central axis

- Source distance `SSD = 60`. Field radius at the applicator end `FR = cone / 2`.
- Attenuation part `A(d) = PDD(d) / (60 / (60 + d))²`.
  - 0 to 4 mm: monotone cubic (PCHIP, Fritsch Carlson) through the table points.
  - Past 4 mm: `A(d) = A(4) × exp(−(g(d) − g(4)))`, `g(d) = mu × d / (1 + 0.015 × d)` (beam hardening, mu per cone from the table above).
- Precompute `A` on a 0.05 mm grid to 80 mm.

### Any point

`doseAt(r, L, dd)` where r = lateral distance from the axis, L = vertical distance below the source, dd = depth under the skin:

```
Lr = sqrt(L² + r²)
R  = FR × L / SSD                       // field edge grows with divergence
dose = (SSD / Lr)² × A(dd × Lr / L) × prof(r, R, dd)
```

`prof(r, R, dd)`:

```
s    = 0.28 + 0.025 × dd                // logistic edge scale
core = 1 / (1 + exp((r − R) / s))
cdef = min(0.12, 0.04 + 0.004 × dd)     // side scatter loss near the edge
edge = r < R ? 1 − cdef × exp(−(R − r) / 2) : 1 − cdef
amp  = 0.022 × (1 + 0.1 × dd) × tail(cone)
lam  = 7.6 + 0.2 × dd
out  = r > R ? amp × exp(−(r − R) / lam) : amp
prof = core × edge + (1 − core) × out
```

- Air gap: lifting the applicator by g moves the source up by g. Nothing else changes.
- Prescription: `DSURF = doseGy / doseAt(0, SSD + rxDepth, rxDepth)`. Dose in Gy anywhere = relative dose × DSURF.

### Expected values (regression targets, 20 mm cone, touching)

| Check | Value | Tolerance |
|---|---|---|
| Model vs table, all cones, all 9 depths | 0% | ≤ 0.1% |
| 90% isodose depth | 1.35 mm | ± 0.05 |
| 80% | 2.58 mm | ± 0.05 |
| 50% | 8.24 mm | ± 0.1 |
| 20% | 22.4 mm | ± 0.2 |
| Dose at 2 mm with 2.5 Gy prescription | 2.50 Gy | exact |
| Skin surface dose | 3.00 Gy | ± 0.01 |
| 80 to 20% edge width at 5 mm | 1.3 mm | 1.1 to 1.7 for all cones |
| Out of field at skin, 1 cm past the edge | about 0.6% | under 1% |

### Photon view

Visual only. Photons aim from the source through the applicator opening. Interaction distance is exponential with mean 1/0.055 mm. At each interaction: 50% absorb (amber flash), otherwise scatter in a random direction (75% absorb after a scatter). Do not present photon counts as dose.

### Not modeled yet

Bone dose enhancement, fat vs muscle differences, heel effect, applicator internals. Do not imply they are modeled.

## Anatomy (Skin slice view)

Lengthwise cut of the mid forearm, beam on the back of the forearm. Skin surface is a very gentle curve (radius 420 mm).

| Layer | Depth below skin |
|---|---|
| Epidermis | 0 to 0.12 mm |
| Dermis | to 1.4 mm |
| Fat | to 6.4 mm |
| Fascia | to 6.8 mm |
| Muscle | to 20 mm |
| Bone | below 20 mm (one solid layer, no marrow shown) |

Sources: forearm skin about 1.2 to 1.7 mm by ultrasound; forearm subcutaneous fat about 5.6 to 6.3 mm.

Tumor: nodular basal cell carcinoma, 12 mm wide, lobulated base, deepest point just above 2 mm. Pink with darker purple nests. Outline is a toggle, off by default.

## Visual design rules

- Default view: Skin slice. 3D room is the second tab.
- Stage background dark navy `#0e1b2c`. Panel follows light and dark mode.
- Heat map: Turbo colormap, stepped in 10% bands, color = `turbo(0.1 + 0.85 × band)`. Alpha ramps from 4% to 16% dose. Tissue colors muted (55% desaturated) in heat mode so color means dose.
- Isodose lines 90, 80, 50, 20 drawn at screen resolution (marching squares), thin white with a dark edge, small boxed number labels on each line. Labels slide up their line if they would land on the color key.
- Dashed line at the prescription depth.
- Thin dark lines at layer boundaries (not pixel thick).
- Depth ruler on the left: ticks and numbers at 1 to 5 mm only.
- Color key: small stepped bar, bottom left of the slice, heat map only.
- Tap readout: top right, just below the view buttons, small. Crosshair marks the tapped point.
- Applicator walls: smooth angled vector lines with acrylic shading, semi transparent in X ray glasses and Photons.
- No "Applicator" label, no "Tap the slice" hint on the slice.
- No title or subtitle at the top of the panel, and no "Gap above skin" control (Steve removed both, October 2026). The model still supports an air gap; the app always shows the applicator touching.
- Pixel art feel: dose and tissue drawn on a low resolution buffer (0.4 mm pixels) scaled up with no smoothing. Lines, labels and walls drawn crisp on top.

## Copy rules

- Plain language a patient can follow. Sentence case.
- No hyphens in any UI text. Write "x ray", "out of field", "beam on time".
- Typographic apostrophes and quotes in visible text.
- Numbers: Gy to 2 decimals, mm to 1 decimal.

## Verification (every session)

1. `node --test` must pass. Tests live in `tests/` and import the physics module directly. They must cover every row of the Expected values table above, for all five cones where it applies.
2. Screenshot check with Playwright at three sizes: iPhone portrait 390 × 844, short phone 390 × 620, iPad landscape 1180 × 820. For each: Skin slice in all three looks, 10 mm and 40 mm cones, and the 3D room. Save to `screenshots/` (git ignored) and look at them before committing. Check for overlapping labels, text covering the beam, and anything cut off.
3. The in app Accuracy check charts must still show the model line through every table dot.
4. Open the page with the browser console visible. No errors.

## Roadmap

Work in this order. One item per session unless Steve says otherwise.

### 1. Lesion inputs from daily ultrasound (next)

- Inputs in the panel: ultrasound depth (0.5 to 6.0 mm, 0.1 steps), lesion diameter (3 to 40 mm), margin (default 5 mm, 3 to 10 mm), and dose as a two way choice: 2.5 Gy × 20 visits (50 Gy, default) or 3 Gy × 15 visits (45 Gy). No separate visits input.
- Prescription depth follows the ultrasound depth. The dashed line, tumor base, readout and isodose normalization all update.
- Tumor shape scales to the diameter and depth while keeping the lobulated look.
- Beam on time: interpolate the 6 Gy table linearly between 0.5 mm rows, scale by dose / 6. Past 4.0 mm, show "Beyond the clinic table" instead of a time, and mark depth dose there as estimated.
- Cone coverage: lesion + 2 × margin compared with each cone diameter. Mark each cone button that covers it, and highlight the smallest cone that does. Show the field edge and margin on the slice.
- Keep the disclaimer next to these inputs: "Reference only. Treatment uses the clinic's commissioned data and physicist."

### 2. Body site presets

- Presets: forearm (current), scalp, forehead, nose, ear, shin, back. Each sets skin, fat and bone depth and surface curvature.
- Research thickness values from published ultrasound or MRI studies, cite each in Sources, and mark any estimate as an estimate.
- Optional bone dose toggle using published 50 kV Monte Carlo values: bone dose about 4 to 6 times water at the same depth; tissue beyond bone shadowed about 5 times faster than water. Label it as approximate.

### 3. Patient mode

- One switch that hides isodose numbers, ruler, color key and the accuracy charts. Keeps colors, tumor and a single plain sentence such as "Most of the dose stays in the top few millimeters."
- Larger text, fewer controls.

### 4. Later

- Play button that fills the dose in over the beam on time.
- Slow motion photon view with fewer photons.
- Second normalization mode: 100% at the prescription depth, surface shown as about 120%.

## Sources

- Xstrahl RADiant Aura FDA 510(k) K230611 (applicators, filters, tube).
- Garcia-Martinez et al. 2014, J Contemp Brachytherapy: Esteya 69.5 kV, 6 cm SSD, PDD and penumbra (0.86 to 1.31 mm at 5 mm).
- Fulkerson et al. 2014, Med Phys: Xoft Axxent surface applicators, depth dose.
- Sheu et al. 2015, JACMP: 50 to 100 kV unit commissioning, out of field dose (0.57% at 1 cm, 0.16% at 2 cm, 2 cm cone at 50 kV).
- Zeeshan et al. 2025, JACMP: Varex VF-80 with open PMMA applicators, air gap loss, leakage beside the wall.
- Barghash et al. 2025, JACMP: Monte Carlo bone dose at 50 kVp.
- Davey et al. 2019, JACMP: stand in and stand off off axis dose.
- AAPM / GEC-ESTRO TG-253 (2020): surface brachytherapy dosimetry and normalization conventions.
- Lam et al. 2014, Transl Cancer Res: INTRABEAM surface applicator off axis ratios.
- Forearm skin thickness by high frequency ultrasound (dorsal about 1.44 mm, volar about 1.19 mm).
- Clinic SRT treatment time table (Appendix page 6), photographed October 2026.
