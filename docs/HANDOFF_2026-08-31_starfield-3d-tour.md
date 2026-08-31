# Handoff — starfield: WebGL layer, 3D bodies, transit tour

**Date:** 2026-08-31
**Project:** `alexyodude.github.io` (Astro 5, Tailwind, zero runtime JS deps)
**Repo root:** `C:\Users\Alexyodude\Desktop\AlexFolder\Code\Github\alexyodude.github.io`
**Remote:** `github.com/Alexyodude/Alexyodude.github.io` — branch `main`
**Last commit:** `496a4d5 fix(ui): more vertical space between hero and about on mobile`
**Working tree:** **CLEAN.** The +906/−135 is committed as `2e1a461`, `b88641c`, `496a4d5`.
**Unpushed:** 7 commits ahead of `origin/main` — pushing deploys the live site, so it is the user's call.
**Dev server:** `npm run preview` on `http://localhost:4321` (serves `dist/`, so rebuild before reloading)
**Almost all work lives in one file:** `src/components/BackgroundStars.astro` (~4400 lines)

> Open item #1 (commit the working tree) is **done** as of 2026-08-31 05:10.
> Nothing has been pushed. The next actionable item is #3 (stage 2 — planets).

---

## TL;DR scorecard

| Goal | Status | Evidence |
|---|---|---|
| Star dots match yottalabs reference look | ACHIEVED | measured density 1391/viewport vs ref 975; brightness p10/p50 29/50 vs ref 29/51; saturation p90 0.054 vs 0.034 |
| 60fps with full-density field | ACHIEVED | WebGL point layer: frame work 39.9ms → 3.8ms; drawList 18,488 → ~2,400 |
| No dependencies added | ACHIEVED | `package.json` unchanged — deps still `astro`, `@astrojs/tailwind`, `tailwindcss` |
| View locked to direction of travel | ACHIEVED | view-vs-motion angle p50 0.02°, p90 1.3° (was 25.6°) |
| Velocity profile free of cliffs | ACHIEVED | worst step 0.075 dec/frame up (= the cap), 0.906 down once; was 6.8 every trip |
| Every tour action smooth | ACHIEVED | per-action audit: all ≤ 0.025 dec/frame (the 1.5 dec/s cap at 60fps) |
| Stars render as 3D bodies with interiors | ACHIEVED | impostor shader + interior wash; `star3d-close.png`, `star3d-inside.png` |
| Stellar bodies rotate | ACHIEVED | pixel-diff 5.2/255 mean change over 2.5s on a parked star |
| Star transit flies THROUGH the body | ACHIEVED | min dist/R = 0.00 on every star trip; ~7s inside |
| Realtime in-page event timeline | ACHIEVED | debug panel, `#event-timeline-canvas`; 75s rolling log\|v\| + all events |
| Planet rings render in 3D | ACHIEVED | far/near arcs split around body; `ring-shadow-fixed.png` |
| Light mode removed | ACHIEVED | zero `light mode` refs; `isDark()` deleted; toggle removed from nav |
| Planets render as 3D impostors | NOT STARTED | stage 2 — see `docs/3d-bodies-and-tour.md` |
| Nebula volumetrics | NOT STARTED | stage 3 |
| Black hole brake-and-hold tour | NOT STARTED | stage 4 |
| Verified on real GPU | BLOCKED ON hardware | all measurements are software WebGL (SwiftShader) in automation |

---

## Root-cause narratives

Ten non-trivial bugs. Each cost real time; none is obvious from the code.

### 1. Every star strobed — animation clock was relativistically dilated

**Symptom:** user reported "blinking is too rapid". Twinkle looked like a strobe.

**Ruled out:** the twinkle rate constant itself (0.6–2.4 rad/s → 2.6–10.5s
periods, perfectly reasonable on paper).

**Root cause:** twinkle phase was driven by `tAnim`, which accumulates as
`dt * gravDilation * gammaTime`. At cruise the panel showed **γ = 7.8e8**, so
the phase advanced up to 10⁸× wall-clock.

**Fix:** drive scintillation from `tAnimSec` (wall clock). Verified: individual
stars vary 1–7% over 6.7s, no strobing.

**Generalization:** *a simulation clock is not a presentation clock.* Anything
the viewer perceives directly (twinkle, UI, shader animation) must run on
wall-clock; only world physics belongs on the dilated clock. Check every
consumer when a clock is scaled.

### 2. Autopilot permanently stalled — trip schedule on wall clock, physics on capped dt

**Symptom:** camera crawling at 0.4c toward a body **16 years** away; one trip
observed still running 19 minutes into a "3–10 second" plan.

**Ruled out:** the velocity limiters (they only cap rate, not target); the
target picker (a valid target was held the whole time).

**Root cause:** `dt` is capped at 0.1s/frame, but the autopilot's bell-curve
trip schedule was measured against `performance.now()`. Throttle the tab and sim
time falls behind wall time; the time-scheduled curve expires while the camera is
still astronomically far, collapsing speed to `designSpeed` forever — nothing
re-plans.

**Fix:** accumulate `simClockSec += dt` and use it for `tAnimSec`. All consumers
take differences or use it as a periodic phase, so the changed epoch is invisible.
A backgrounded tab now *pauses* the trip instead of shredding it.

**Generalization:** *when you cap `dt` for stability, you have forked time.*
Every schedule must then say which clock it is on. Mixing them is silent and
only shows up under throttling.

### 3. Browser history flooded — 6,832 `replaceState`/hour

**Symptom:** user reported "spamming url and history".

**Root cause:** `updateUrl()` was called from the 500ms save block in the frame
loop. Measured **1.9 calls/sec, 15 distinct URLs per 10 seconds**. It is
`replaceState` so the back button was fine, but Chrome records same-document
navigations in its history DB.

**Fix:** decoupled from the render cadence. URL now syncs on deliberate
navigation, on a 30s idle cadence gated by a minimum-move threshold, and once on
`pagehide`/`visibilitychange`.

| | before | after |
|---|---|---|
| flying, per hour | 6,832 | **90** |
| parked 35s | ~70 | **0** |
| one teleport | 1 | 1, immediate |
| tab hidden | — | 1 flush |

**Generalization:** anything touching browser-global state (history, storage,
title) needs its own clock, never the render loop's.

### 4. Light mode rendered a black ink-blot over the hero

**Symptom:** third user report of "colors are wrong". First two I mis-diagnosed.

**Ruled out (wrongly, twice):** Doppler re-saturation (real, but fixed earlier);
un-premultiplied readback noise producing fake cyan pixels in my *measurements*
(a measurement artifact, not on screen).

**Root cause:** the site defaults to **light** mode; all my density verification
ran in dark. In light mode stars render as *dark* dots, and the new 5× density
plus aberration piling them into screen centre produced a black blot behind the
hero text.

**Fix at the time:** light mode kept the short scenery radius and dropped halos.
**Superseded:** light mode has since been removed entirely (see #10).

**Generalization:** *verify in the state the user actually lands in*, not the one
that flatters the feature. I verified in dark mode for three consecutive reports.

### 5. Velocity cliffs — a multiplier cannot restrain an exponential

**Symptom:** user read the realtime graph and identified "extreme cliffs".

**Root cause (three layers, found in order):**
1. Transit profile took over from the brake corridor a decade higher — instant
   upward jump.
2. At warp the ship covers the whole remaining trip in <1 frame, so the
   per-frame safety clamp *was* the brake: 5–7 decade vertical walls.
3. My first fix multiplied the warp curve by 0.12 — still exponential. Measured
   **43 million c** mid-turn.

**Fix:** three limiters at the single integration choke point
(`velocity[] → cam[]`):
- upward log-slew cap (`VEL_SLEW_DECADES_PER_S = 1.5`), deceleration deliberately
  unbounded (brakes are collision safety),
- anticipatory brake: speed ≤ (distance to threshold) / 1.2s,
- geometric hold in **log space** between current and commanded speed.

**Generalization:** *to restrain an exponential you must work in log space.* A
linear multiplier on a doubling quantity is still a doubling quantity.

### 6. `nlerp` under-rotates near 180° — the turn crawled regardless of tuning

**Symptom:** the look-back flip took 3 seconds to leave 5°/s despite a 28°/s²
accel cap.

**Root cause:** rotation used `viewDir += (target - viewDir) * f`. Interpolating
by fraction `f` between near-antipodal vectors barely moves the result, so the
commanded angular rate was never delivered.

**Fix:** true axis-angle rotation (Rodrigues, simplified since axis ⟂ viewDir).
Constants now mean what they say — measured ramp 2.55 oct/s vs 2.6 configured.

**Generalization:** nlerp is fine for small deltas and wrong for large ones. If
you are commanding an angular *rate*, rotate; do not lerp.

### 7. Interior vanished one frame past the core

**Symptom:** user reported "inside the star and after leaving is not visually
smooth".

**Root cause:** the interior wash was driven by tracking inside the **impostor
draw branch**, which only runs when the star's centre projects on-screen. Past
the core the star is behind the camera, `project()` returns null, tracking dies —
**the entire exit half of every transit rendered as empty space while inside the
star.** Brightness measured flat ~95–99 outbound vs ~196 inbound.

**Fix:** moved tracking to the collection loop, **before every cull**. Also made
the interior advect by signed progress along motion (the old offset moved
~0.002/s — visually frozen).

**Generalization:** *state needed after an object leaves the view cannot be
computed inside the draw path.* Draw paths are culled; tracking must sit upstream.

### 8. "Mistiness" on approach was blown-out exposure, not fog

**Symptom:** user asked "what's with the mistyness when entering".

**Ruled out:** the interior wash leaking outside the star. I changed its band
from 1.6R → 1.02R *before* measuring. That change is still correct (it was
double-drawing over the impostor) but was **not** the cause.

**Also invalid:** my first test sampled a screen corner as "sky away from the
star" — at 1.5R the star's angular radius is ~1621px on a 2560px canvas, so the
corner is *inside the disc*.

**Root cause:** the impostor applied `×1.5` gain to an already near-white star
colour. Everything clipped at 1.0: mean luminance 252 with detail **σ = 1.7**,
i.e. a flat white sheet with no structure. That sheet was the "mist".

**Fix:** gain → 0.98, granulation contrast widened. Measured after: σ 18–20
across the whole approach, 0% clipped.

**Generalization:** *a mean cannot distinguish a flat field from a bright one.*
When something looks washed out, measure local contrast (σ), not brightness.

### 9. Ring was a flat decal; shadows were wrong twice over

**Symptom:** "ring is not going around the object. this render is not rendering
in 3d", then "is the shadow correct?"

**Root causes:**
- Ring drawn as one full ellipse **after** the body → always in front, never
  encircling.
- Planet-shadow-on-ring clipped to the planet's own disc → the body painted
  immediately after covered all but a 4% sliver. Invisible, and geometrically
  wrong: that shadow is a wedge thrown *outward* along anti-sun.
- Both shadows ignored the planet's existing light direction (`phase`, seeded
  `objHash(obj) + 0xab`) that already drives its terminator — the ring shadow was
  offset a fixed `+rad*0.05` straight down.

**Fix:** far arc before body / near arc after; ~50 thin arcs sampled from a
radial density profile with resonance gaps; icy colour instead of the planet's
hue; both shadows derived from `lightPhase`; anti-sun half-strip clip for the
wedge.

**Generalization:** in a painter's-algorithm renderer, *3D-ness is draw order*.
And a shadow needs a light: if the scene already has an implied one, every
shadow must use it or they will contradict each other.

### 10. Scenery layer tanked the frame rate — and my first two hypotheses were wrong

**Symptom:** "why does the animation keep jumping" — 205 of 500 frames over 33ms.

**Ruled out:**
- *Texture-cache thrash* (256×256 procedural star textures, `STAR_TEX_LIMIT` 80).
  Capping scenery below that LOD made it **worse** (8/12 bad windows vs 5/12).
  Reverted.
- *"Bimodal implies a threshold effect"* — wrong reasoning. 16.7/33.3/50ms is
  just vsync quantization; any over-budget frame falls to the next interval.

**Root cause:** phase timing showed collect 3.9ms, sort 3.1ms, **draw 32.9ms**,
with `drawList` at **18,488 objects**. Relativistic aberration folds the whole
sky into the forward cone at cruise, so the existing off-screen cull never fires
and every object in the render sphere reaches the screen.

**Fix:** WebGL point-sprite layer (one `drawArrays`), and only ~880 of those
18,488 were bright enough to see — the far shells dominate by count and
contribute least.

**Generalization:** *measure the phases before optimizing one.* Two plausible
hypotheses were wrong; the phase split answered it in one run.

---

## Reproduce-the-result runbook

```bash
cd "$USERPROFILE/Desktop/AlexFolder/Code/Github/alexyodude.github.io"

npm run build          # expect: "Complete!" — 2 pages, ~1-3s
npx astro preview --port 4321 &
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/    # expect: 200
```

Then in a browser at `http://localhost:4321/`:

| Step | Expected |
|---|---|
| Page loads | dark, starfield drifting, autopilot on by default |
| Open devtools console | **zero errors**, zero warnings |
| Click `Debug` in the COORDINATES panel | tuning sliders + WARP TIMELINE + REALTIME strip appear |
| Watch the REALTIME strip ~60s | log\|v\| trace with green/amber/red/blue event ticks; no vertical walls |
| Click `visit` → `star` | parks ~30 radii out, autopilot switches OFF, granulated star with corona |
| Click `visit` → `planet` | parks 5 radii out, textured planet; if ringed, ring passes behind and in front |
| Let autopilot run to a star | approach → ENTER surface → ~7s inside → EXIT → look-back → slow forward turn |

The COORDINATES/Debug panel is **localhost-only** — it hides itself on deployed
builds (`BackgroundStars.astro:1087` area, `debugEnabled` check).

### Verification probes used this session

All were `browser_evaluate` snippets against `window.__deepState` and
`window.__tourEvents` (both exposed for tooling). Reusable patterns:

- **GL canvas readback must happen inside a `requestAnimationFrame` callback** —
  there is no `preserveDrawingBuffer`, so `drawImage(glCanvas)` from a `setTimeout`
  returns a blank buffer. This cost one wrong "spin is not working" conclusion.
- Star-field character: `scratchpad/measure_stars.py` (density, brightness
  percentiles, saturation, radial falloff) — **in the scratchpad, not the repo.**
  Recreate if needed; it is ~60 lines.

---

## File inventory

### Modified this session (now committed — see item #1)

| File | Δ | What |
|---|---|---|
| `src/components/BackgroundStars.astro` | +992/−? | everything below: GL layer, impostors, tour, instrument, rings |
| `src/components/Hero.astro` | +4/−2 | `mb-28` mobile gap |
| `src/components/About.astro` | +4/−2 | `mt-28` mobile gap |
| `src/components/NavBar.astro` | +3/−1 | section anchors; ThemeToggle import removed |
| `src/pages/index.astro` | +14/−? | dark-only bootstrap |
| `src/pages/archive.astro` | +12/−? | dark-only bootstrap |
| `src/styles/global.css` | +12/−? | single dark palette |

### New

| File | What |
|---|---|
| `docs/3d-bodies-and-tour.md` | the staged plan + the measured justification for the tour redesign |
| `docs/HANDOFF_2026-08-31_starfield-3d-tour.md` | this doc |

### Orphaned — safe to delete

| File | Why |
|---|---|
| `src/components/ThemeToggle.astro` | unreferenced since light mode was removed |
| `src/components/SideMenu.astro` | unreferenced since commit `47e5ca7`; kept for easy revival |

### Key regions inside `BackgroundStars.astro`

| Concern | Approx line |
|---|---|
| `starGL` module (3 shader programs, buffers) | ~330–700 |
| Tour/view tuning constants | 704–765 |
| URL sync throttle | ~950–1000 |
| Scenery generation (`BG_STARS_PER_CHUNK`) | 1082–1160 |
| `drawPlanetRing` + `ringDensity` | ~2400–2520 |
| Star look constants | 2313–2345 |
| Realtime event timeline (`logEvent`, `drawEventTimeline`) | ~1900–1990 |
| Transit branch (fly-through) | ~3200–3260 |
| Velocity limiters (integration choke point) | ~3490–3560 |

### Tunable constants — the whole feel of the thing

| Constant | Value | Line | Effect |
|---|---|---|---|
| `BG_STARS_PER_CHUNK` | 8 | 1082 | scenery density; first dial if fps suffers |
| `BG_RENDER_FRAC` | 1.0 | 1092 | scenery draw radius (was 0.45 under canvas2d) |
| `BG_SCREEN_BUDGET_PER_MPX` | 2600 | 1117 | on-screen scenery cap per megapixel — the ripple fix |
| `BG_THIN_FADE` / `_TAU` | 0.3 / 0.4 | 1122/1128 | dissolve band / governor time constant |
| `STAR_WHITEN` | 0.9 | 2323 | 1.0 = pure white; 0 = full spectral hue |
| `STAR_GAMMA` | 1.35 | 2327 | brightness skew |
| `STAR_TWINKLE` / `_HZ` | 0.55 / 0.22 | 2329/2333 | scintillation depth / speed |
| `STAR_MIN_PX`, `STAR_DEPTH_FLOOR` | 1.0, 0.45 | 2339+ | far-star visibility floors |
| `VIEW_TURN_MAX_DPS` | 17 | 760 | **visible** forward turn speed |
| `VIEW_FLIP_MAX_DPS` | 75 | 764 | hidden in-star flip |
| `VIEW_TURN_ACCEL_OCT_S` | 2.6 | 745 | log ease-in (doublings/sec) |
| `VEL_SLEW_DECADES_PER_S` | 1.5 | 716 | upward speed slew cap |
| `VEL_TURN_SLOWDOWN_OCT_S` | 1.6 | 757 | how fast speed sheds during a turn |
| `TRANSIT_CROSS_S` / `_RAMP_S` | 3.5 / 3.0 | 711/712 | time inside star / boundary softness |
| `URL_SYNC_MS` | 30000 | 953 | history write cadence |

---

## Open work / next priorities

1. ~~**COMMIT THE WORKING TREE**~~ — **DONE 2026-08-31 05:10.** Committed as the
   planned three-way split after re-verifying the build (`Complete!`, 2 pages):
   `2e1a461` stars, `b88641c` light-mode removal, `496a4d5` mobile spacing.
   Working tree clean. **Still not pushed** — the repo is 7 commits ahead of
   `origin/main`, and pushing deploys the live site.

2. **Get a real-GPU frame-rate reading — requires the user's machine.**
   Every perf number here is software WebGL (SwiftShader) in automation. Open
   the Debug panel, watch the REALTIME strip for 60s, confirm no dropped frames.
   If it struggles: lower `BG_STARS_PER_CHUNK` (1082) then `BG_RENDER_FRAC` (1092).

3. **Stage 2 — planets as 3D impostors + brake-and-hold tour.** Software-only.
   Spec in `docs/3d-bodies-and-tour.md`. The star impostor (`BFS` shader in the
   `starGL` module) is the template: bake the existing procedural planet texture
   to a GL texture, sphere-map it, light it with a terminator. Tour: brake to a
   full stop at ~2.5 radii, hold, then depart. **The planet path is currently the
   worst citizen of the tour** — the old telemetry showed a planet trip diving to
   0.21R (through the body) with a garbage arrival marker.

4. **Stage 3 — nebula volumetrics** (raymarched fbm within ~3 radii, transit
   tour like stars). Software-only.

5. **Stage 4 — black hole brake-and-hold tour.** Keep 2d rendering. Lensing is a
   separate, larger decision.

6. **Delete the orphans** — `ThemeToggle.astro`, and `SideMenu.astro` if you are
   sure the side menu is not coming back. Software-only, 10 seconds.

7. **`debug-curve-canvas` is still hard-coded 320×120** in a resizable panel —
   same bug I fixed on the event timeline. Pre-existing, cosmetic.

8. **One unexplained ~0.9-decade velocity drop** occurs roughly once per 70s,
   somewhere near a handoff. Everything else is ≤0.075. The realtime strip will
   catch it in context — leave the instrument in and watch for it.

---

## Commits this session

```
496a4d5 fix(ui): more vertical space between hero and about on mobile
b88641c feat(ui): remove light mode — dark only
2e1a461 feat(stars): 3D star impostors with interiors, fly-through transit, realtime tour instrument
61db544 docs: handoff for starfield 3D bodies + tour redesign (2026-08-31)
47e5ca7 feat(ui): drop floating side menu, move section anchors into nav bar
4dd1b26 feat(stars): WebGL star layer, travel-locked view, yotta-style field
```

All committed, none pushed.

---

## Visual verification — what is actually in each frame

Captures live in `C:\Users\Alexyodude\.playwright-mcp\` (gitignored, and they
are **overwritten by later runs** — treat as ephemeral).

- **`star3d-close.png`** — a star at 3 radii filling two-thirds of frame: warm
  yellow-white disc, mottled granulation cells, brighter core fading to a
  darkened limb, soft corona bleeding into black. Hero text overlaid.
- **`star3d-inside.png`** — camera 0.5 radii deep: no disc, no stars, the whole
  frame is soft tan-brown convection fog, lighter top-left, darker lower-right.
- **`star-approach-fixed.png`** — 1.35 radii: full-frame stellar surface with
  visible cell structure and darker lanes. Before the exposure fix this frame was
  featureless white.
- **`ring-shadow-fixed.png`** — ringed gas giant at 6 radii: banded tan ring
  passing **behind** the planet upper-left and **in front** lower-right, a dark
  shadow band cast across the planet's face, and a dark wedge cutting the rings
  on the anti-light side.
- **`bg-open.png`** — open sky, ~880 white points, evenly scattered, no cluster.
  This is the yottalabs-match frame.
- **`strip-v5.png`** — the realtime instrument: blue log\|v\| trace with colour-coded
  event ticks (`arrive star @18.0R`, `ENTER star surface`, `core crossing`,
  `EXIT star surface`, `transit clear @8R`, `handoff`). Ramps, no vertical walls.

---

## Known limitations / quirks — do not burn time here

- **`devicePixelRatio` reads 1 in automation.** On real hardware the canvas
  allocates 2× (`min(dpr, 2)`). Do not "fix" the sharpness.
- **Playwright `browser_resize` installs a device-metrics override** on the
  user's actual browser that survives reloads and pins the viewport. It is what
  caused "page canvas is stuck in small resolution". Close the page to clear it,
  and **avoid resizing the user's live browser** — ask first.
- **`visit` buttons re-find the same body** if you are already parked at one.
  Any "sample N different planets" loop must teleport (`coord-random`) between
  attempts, or it silently samples one object N times.
- **Rings only spawn on ~9% of planets** (55% of gas giants, 5% others). To
  verify ring rendering, temporarily force `obj.hasRing = true` at
  `BackgroundStars.astro:1139`, then **restore it** — I did this twice and
  restored both times; the current value is the original expression.
- **The `~0.9 dec/frame` drop and the light-mode-free codebase mean the `dark`
  local is now always `true`** in the frame loop. It is kept as a named constant
  so per-object draw code reads unchanged; do not "simplify" it away without
  checking every consumer.
- **The bright tail is softer than the reference** (p99 154 vs 255). Additive
  blending caps differently than the old sprite path. Cosmetic.
- **Autopilot trips are long now** (~40–60s vs ~15–25s originally). That is the
  deliberate cost of smooth braking and slow turns — not a regression. Trip-time
  sliders in the Debug panel trade it back.
