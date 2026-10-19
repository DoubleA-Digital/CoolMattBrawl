# Cool Matt Brawl

A 2-4 player local platform fighter for Cool Matt Games. HTML5 Canvas, vanilla
JS, zero external assets.

**The twist:** the main stage sits on a pivot. It tilts toward whichever side
carries more total fighter weight, which changes footing and slides everyone
toward the low edge. Push it past its limit and it snaps back, launching
everyone on the deck — a "Snap-Back". You can set one off on purpose.

- 4 fighters: BOLDER (heavy bruiser), ZIP (fast lightweight), ORBIT
  (all-rounder), PIVOT (stage manipulator) — each with their own moveset,
  tilt special and super.
- 4 stages that play differently, not just look different: Pivot Yard
  (balanced), Cinder Foundry (swings hard over a short drop), Cirrus Drift
  (rights itself fast, forgiving), Null Vault (leans far, close walls).
- 3 stocks, damage-percent knockback, blast-zone KOs, shields, rolls, air
  dodges, grabs and throws.
- Rebindable controls for all four players, and CPU opponents.

Play it: open `index.html`, or https://doublea-digital.github.io/CoolMattBrawl/

## Development

`index.html` is **generated**. Edit the modules in `src/` and run:

    node build.js

That rebuilds `index.html` (standalone) and `artifact.html`.
