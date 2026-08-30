# 3D bodies + tour redesign

Decisions (approved 2026-08-30): dependency-free — sphere impostors + raymarched
volumetrics inside the existing WebGL layer. Tour per body type: fly-THROUGH
transit for stars and nebulae; brake-and-hold for planets and black holes.

## Why (measured)

45s of the old tour, per trip: the target exceeded 10px on screen for **one
frame** (peak 57px), and during linger the camera sat *inside* a star's
6,394px angular radius pointing away from it. Three deliberate mechanisms
conspire: arrival triggers many radii out, velocity redirects tangentially at
arrival (bodies were flat sprites you couldn't enter), and the view follows
velocity. Giving bodies real interiors removes the reason the tangential dodge
exists; the fly-through keeps the body centred from acquisition to exit with
the view never leaving the travel direction.

## Stages

1. **Star 3D** — impostor quad shader (limb-darkened sphere, time-advected
   granulation, corona) replacing the 2d textured/gradient tiers when GL is
   available; fullscreen interior pass (emissive convection fog keyed to
   camera position) when dist < ~1.2R. Tour: transit phase for stars —
   brake to a transit speed, pass through centre, accelerate out the far side.
2. **Planet 3D** — impostor with the existing procedural texture baked to a GL
   texture, sphere-mapped, lit with terminator. Tour: brake to full stop at
   ~2.5 radii, hold, then depart toward next target (the 50°/s velocity
   limiter provides the pan away).
3. **Nebula volumetrics** — raymarched fbm within ~3 radii (billboard stays
   for distance); transit tour like stars.
4. **Black hole** — keep 2d rendering initially; brake-and-hold tour at ~8 rs.
   Lensing is a future, separate decision.

2d canvas remains the no-WebGL fallback for everything.

## Verification per stage

Visit button screenshot; tour telemetry (pct of trip with target >10px —
should go from ~0% to >60%); fps windows; both themes.
