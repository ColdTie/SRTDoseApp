# Claude Code prompts

## Session 1: set up the repo (paste this first)

I'm moving my teaching app "Under the cone" into this repo. The current app is the attached single HTML file. Read CLAUDE.md first; it's the ground truth for the physics, design and rules.

Do this, in order, and stop after step 7:

1. Put the attached file in the repo root as `index.html`. Commit it unchanged as the baseline.
2. Take screenshots of the baseline at the three sizes in CLAUDE.md (Verification step 2) and keep them as `screenshots/baseline/`.
3. Move the physics into `physics.js` as an ES module: the cone table, PCHIP, attenuation grid, `doseAt`, `prof`, isodose depth search. `index.html` imports it. No behavior change.
4. Write `tests/physics.test.mjs` with `node:test` covering every row of the Expected values table for all five cones where it applies. Add a `package.json` with `"test": "node --test"` and Playwright as a dev dependency for screenshots.
5. Run the tests. Take new screenshots and compare them with the baseline. They should look the same. Tell me about any difference.
6. Add `.gitignore` (node_modules, screenshots), a short `README.md` (what it is, the teaching only disclaimer, how to run tests), and turn on GitHub Pages from `main` at the root.
7. Commit, push, and give me the Pages link.

Keep your replies short. Don't start the roadmap yet.

## Session 2: lesion inputs from ultrasound

Read CLAUDE.md. Build Roadmap item 1 (lesion inputs from daily ultrasound) exactly as written there. Add tests for the beam on time interpolation and the cone coverage rule. Run the full Verification list, show me the iPhone screenshots, then commit and push.

## Session 3: body site presets

Read CLAUDE.md. Build Roadmap item 2. Research the tissue thickness for each site first and show me the numbers with sources before writing code. Mark anything you estimate. Wait for my OK, then build it, verify, commit and push.

## Session 4: patient mode

Read CLAUDE.md. Build Roadmap item 3. Show me iPhone and iPad screenshots in both modes before committing.

## Any session: small fixes

Read CLAUDE.md. [Describe the change or attach a screenshot.] Make only that change. Run the tests and the screenshot check, show me the before and after, then commit and push.
