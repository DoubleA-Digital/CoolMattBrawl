# Cool Matt Brawl

A 2-4 player platform fighter for Cool Matt Games, local or online. HTML5
Canvas, vanilla JS, zero external assets.

- 8 fighters — BOLDER, ZIP, ORBIT, PIVOT, BALLAST, KITE, HUSK, MIRA — each
  with their own moveset, special and super.
- **Free-for-all or 2v2 teams.** Teams have no friendly fire, and a player who
  runs out of stocks can steal one from a teammate who has two (press Special).
- **Online for up to 4.** One player hosts and reads out a 4-letter code; up to
  three friends join with it. Everyone picks in a shared lobby, and the host
  fills empty seats with CPUs, picks the mode and stage, and starts. If someone
  drops mid-match a CPU takes over their fighter.
- 4 stages with live platforms: Neon Yard's ledges drift, Cinder Foundry's
  shelves heat up, Cirrus Drift's clouds crumble, Null Vault's shelf retracts.
- 3 stocks, damage-percent knockback, blast-zone KOs, shields, rolls, air
  dodges, grabs and throws. Hits strong enough to take a stock land as a SMASH.
- The last 30 seconds are a **Frenzy** (meter fills twice as fast), and a
  time-out with the stocks level goes to **Sudden Death** at 150%.
- Rebindable controls for all four players, gamepads, and CPU opponents.

Play it: open `index.html`, or https://doublea-digital.github.io/CoolMattBrawl/

## Development

`index.html` is **generated**. Edit the modules in `src/` and run:

    node build.js

That rebuilds `index.html` (standalone) and `artifact.html`.

Online play is host-authoritative over WebRTC (PeerJS, loaded on demand): the
host simulates, guests send input and render snapshots. See `src/11b_net.js`.
