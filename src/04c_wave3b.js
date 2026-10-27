/* ==========================================================================
   5c. WAVE 3B — four more fighters, each on a mechanic nobody else has

     VOLT    chain lightning   every hit arcs on to the next nearest foe
     WARDEN  walls             a wall nobody passes; a cage that slams shut
     MAGMA   burn              heavies and lava set foes on fire
     JINX    luck              a die decides what her special does

   Numbers follow 04a's ranges: lights 3-5%, heavies 13-17%, supers 18-26%
   when they fully land. What they spawn lives in 08c_kinds_b.js (with the
   CPU habits for all four); per-fighter scratch state lives in f.v.
   ========================================================================== */

/** Volt's passive: arc a fraction of a hit on to the nearest OTHER foe
    within 220px of whoever was just struck. */
function voltChain(f, from, dmg) {
  let best = null, bd = 220;
  for (const o of Combat.foes(f)) {
    if (o === from || o.intangible()) continue;
    const d = dist(from.x, from.y, o.x, o.y);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return;
  Entities.add("volt_link", f, { x: from.x, y: from.y - 6, r: 0, w: best.slot + 1, life: 10 });
  Combat.land(f, best, hitMove("Chain Arc", { dmg, base: 1.6, scale: 0.32, angle: 50 }), best.x, best.y);
  Snd.tone(2200, 0.05, "sawtooth", 0.07, 900);
}

const WAVE3B = [

/* ======================================================================== */
/* VOLT — THE CONDUCTOR                                                      */
/* ======================================================================== */
{
  id: "VOLT", name: "VOLT", tag: "THE CONDUCTOR",
  blurb: "Hit one of you, and the rest of you feel it.",
  power: "Chain lightning: his punches arc on to the next nearest foe for part of the damage. Overload threads a bolt through every foe, each link stronger than the last.",
  color: "#3d8bff", color2: "#0b3266", color3: "#051833", accent: "#fff59a",
  weight: 0.96, speed: 4.6, accel: 0.9, jump: 12.4, airSpeed: 4.4, fallMul: 0.96,
  size: { w: 32, h: 56 }, hurt: 25,
  specialCooldown: 240,

  light: { name: "Static Jab", startup: 3, active: 3, recovery: 9,
    dmg: 3.8, base: 1.8, scale: 0.44, angle: 45, ox: 36, oy: -8, r: 22,
    onHit(f, d) { voltChain(f, d, 1.6); },
    vfx(f) {
      const p = hbAt(f, this);
      FX.blade(f.x + f.facing * 10, f.y - 8, faceAng(f), 22, 52, 0.3, f.ch.color, { w: 9, life: 9 });
      FX.bolt(f.x + f.facing * 14, f.y - 8, p.x + f.facing * 10, p.y + rnd(-8, 8), f.ch.accent, { segs: 4, jag: 6, life: 6, w: 2 });
      Snd.tone(2400, 0.035, "sawtooth", 0.06, 1200);
    } },

  heavy: { name: "Thunderclap", startup: 13, active: 4, recovery: 26,
    dmg: 14.5, base: 4.4, scale: 1.04, angle: 50, ox: 42, oy: -6, r: 33,
    onHit(f, d) { voltChain(f, d, 5.5); },
    onStart() { Snd.tone(300, 0.2, "sawtooth", 0.06, 1400); },
    vfx(f) {
      const p = hbAt(f, this);
      FX.ring(p.x, p.y, 8, 80, f.ch.accent, 4);
      for (let i = 0; i < 4; i++)
        FX.bolt(p.x, p.y, p.x + rnd(-60, 60), p.y + rnd(-60, 40), i % 2 ? "#ffffff" : f.ch.color, { segs: 5, jag: 10, life: 9, w: 3 });
      FX.burst(p.x, p.y, 14, f.ch.accent, 6);
      FX.flash(f.ch.color, 0.1); FX.shake(7);
      Snd.noise(0.18, 0.22, 3000, 1.4, "bandpass");
    } },

  special: { name: "Ball Lightning", startup: 12, active: 2, recovery: 20,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Lets go of a slow, crackling orb that drifts forward for over three seconds. Every third of a second it zaps every foe near it for 2.5%.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      const y = f.y - 10;
      Entities.add("volt_ball", f, { x: f.x + f.facing * 30, y, y0: y, vx: f.facing * 2.2, r: 14, w: 100, life: 200,
        move: hitMove("Ball Lightning", { dmg: 2.5, base: 1.6, scale: 0.18, angle: 70, kbMul: 0.7 }) });
      Snd.tone(180, 0.3, "sawtooth", 0.1, 900);
    } },

  super: { name: "Overload",
    desc: "A bolt leaves him and threads through every foe in turn, nearest first, each link harder than the last (6%, 8.5%, 11%...). With fewer than three foes it loops back through them; the final link launches.",
    startup: 16, active: 40, recovery: 28,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    onStart(f) { Snd.superCharge(); FX.flash("#3d8bff", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.7; f.vy *= 0.7; FX.spark(f.x + rnd(-30, 30), f.y + rnd(-40, 20), f.ch.accent); return; }
      const s = a.t - m.startup;
      if (s === 0) {
        // the route: nearest foe to Volt, then nearest unvisited foe to that one...
        const left = Combat.foes(f).filter(o => !o.intangible()), seq = [];
        let at = f;
        while (left.length) {
          left.sort((p, q) => dist(at.x, at.y, p.x, p.y) - dist(at.x, at.y, q.x, q.y));
          at = left.shift(); seq.push(at);
        }
        a.seq = seq; a.links = Math.max(3, seq.length);
        FX.shake(10);
      }
      f.vx = 0; f.vy = 0;
      if (!a.seq || !a.seq.length || s % 12 !== 0) return;
      const i = s / 12;
      if (i >= a.links) return;
      const t = a.seq[i % a.seq.length];
      if (!t.alive || t.state === ST.DEAD) return;
      const prev = i === 0 ? f : a.seq[(i - 1) % a.seq.length];
      const from = prev === t ? f : prev, last = i === a.links - 1;
      Entities.add("volt_link", f, { x: from.x, y: from.y - 10, r: 1, w: t.slot + 1, life: 14 });
      FX.flash(f.ch.color, 0.12); FX.shake(8 + i * 3);
      Snd.tone(600 + i * 300, 0.12, "sawtooth", 0.14, 200);
      if (t.intangible()) return;
      Combat.land(f, t, hitMove("Overload " + (i + 1), {
        dmg: 6 + i * 2.5, base: last ? 5.6 : 1.4, scale: last ? 1.05 : 0.2, angle: last ? 45 : 80,
        kbMul: last ? 1 : 0.4, unblockable: true }), t.x, t.y);
    } },

  /* ---- art: a lanky lineman in an insulated jumpsuit. Two copper coils
           on his back with an arc jumping between them, goggles, hair stood
           straight up with static, and a coil-wound gauntlet. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#cfe2ff" : c2, deep = A.flash ? "#a8c8ff" : c3;
    const sw = swing(A, -10, 42), t = A.time || 0;
    aura(g, 0, -6, 34, c, 0.16);

    // the tesla pack: two coils with an arc between their tips
    for (const bx of [-17, -9]) {
      plateRect(g, bx - 3, -34, 6, 26, 2.5, "#c27a3e", { up: 0.4, down: 0.3, ink: 2 });
      g.fillStyle = hexA("#ffe0b0", 0.6);
      for (let i = 0; i < 4; i++) g.fillRect(bx - 3, -31 + i * 5.5, 6, 1.5);
      lens(g, () => { g.beginPath(); g.arc(bx, -36, 3, 0, 7); }, ac, c, 12);
    }
    if (Math.floor(t / 3) % 3 !== 0) w3bArc(g, -17, -36, -9, -36, ac, Math.floor(t / 2), 1.6, 4);

    const st = Math.sin(A.runPhase) * (A.running ? 11 : 0);
    jointLimb(g, -5, 10, -8 + st, 25, -3, 6, deep);
    jointLimb(g, 5, 10, 9 - st, 25, 3, 6, deep);
    plateRect(g, -14 + st, 23, 12, 6, 2.5, "#2a2a33", { up: 0.25 });
    plateRect(g, 4 - st, 23, 12, 6, 2.5, "#2a2a33", { up: 0.25 });

    // jumpsuit, with a lightning stripe down the chest
    plate(g, [-10, -16, 10, -16, 9, 12, -9, 12], dark, { up: 0.24, down: 0.4, under: true });
    plate(g, [-7, -14, 7, -14, 6, 6, -6, 6], body, { up: 0.36, down: 0.3 });
    g.fillStyle = ac; poly(g, [1, -13, -4, -3, 0, -3, -2, 6, 5, -6, 1, -6, 4, -13]); g.fill();
    plateRect(g, -10, 6, 20, 5, 1.5, "#2a2a33", { rim: false, ink: 2 });

    // head: hair on end, goggles, a grin
    g.save(); g.translate(1, -25);
    for (let i = 0; i < 5; i++) {
      const hx = -7 + i * 3.5, hh = 10 + (i % 2) * 5 + Math.sin(t * 0.3 + i) * 1.5;
      plate(g, [hx - 3, -4, hx + 3, -4, hx + (i - 2) * 1.4, -4 - hh], "#fff6c8", { ink: 1.8, rimA: 0.2, up: 0.1 });
    }
    ink(g, () => { g.beginPath(); g.ellipse(0, 0, 7, 7.6, 0, 0, 7); }, vol(g, -8, 8, "#f0c8a4", 0.2, 0.3));
    plateRect(g, -7, -3.5, 15, 5, 2, deep, { rim: false, ink: 1.8 });
    lens(g, () => { g.beginPath(); g.arc(4.5, -1, 2.3, 0, 7); }, ac, c, 12);
    lens(g, () => { g.beginPath(); g.arc(-1, -1, 2, 0, 7); }, ac, c, 8);
    g.fillStyle = INK; poly(g, [0, 4, 6, 3.4, 5, 5.2]); g.fill();
    g.restore();

    jointLimb(g, -8, -12, -14, 0, -3, 4.6, dark);

    // gauntlet arm: a copper coil fist that throws an arc on the swing
    const ax = 14 + sw, ay = -6;
    jointLimb(g, 8, -12, (8 + ax) / 2, ay - 1, 2.5, 5, dark);
    limb(g, (8 + ax) / 2, ay - 1, ax - 2, ay, 6, mid_(c, c2));
    g.save(); g.translate(ax, ay);
    plateRect(g, -4, -6, 12, 12, 3.5, "#c27a3e", { up: 0.4, ink: 2.2 });
    g.fillStyle = hexA("#ffe0b0", 0.6);
    for (let i = 0; i < 3; i++) g.fillRect(-2 + i * 3.5, -6, 1.4, 12);
    lens(g, () => { g.beginPath(); g.arc(9, 0, 2.6, 0, 7); }, "#ffffff", c, A.atkPhase >= 0 ? 22 : 10);
    if (A.atkPhase >= 0) w3bArc(g, 9, 0, 26, (hash(t) - 0.5) * 16, ac, Math.floor(t), 2, 6);
    g.restore();
  },
},

/* ======================================================================== */
/* WARDEN — THE GATEKEEPER                                                   */
/* ======================================================================== */
{
  id: "WARDEN", name: "WARDEN", tag: "THE GATEKEEPER",
  blurb: "None shall pass. He means it literally.",
  power: "Bulwark plants a wall nobody gets through: foes are stopped dead, launched foes bounce off it, enemy projectiles die on it. Lockdown cages a foe, then slams the cage shut.",
  color: "#8e9bb3", color2: "#2e3546", color3: "#151922", accent: "#ffcf5a",
  weight: 1.34, speed: 3.6, accel: 0.6, jump: 11.6, airSpeed: 3.3, fallMul: 1.12,
  size: { w: 44, h: 62 }, hurt: 31,
  specialCooldown: 270,

  light: { name: "Key Thrust", startup: 4, active: 3, recovery: 11,
    dmg: 4.6, base: 2.2, scale: 0.52, angle: 38, ox: 44, oy: -4, r: 24,
    vfx(f) {
      FX.blade(f.x + f.facing * 12, f.y - 4, faceAng(f), 30, 66, 0.16, "#e7bd5a", { w: 10, life: 8 });
      Snd.tone(220, 0.05, "square", 0.08, 160);
    } },

  heavy: { name: "Portcullis", startup: 15, active: 4, recovery: 28,
    dmg: 16, base: 5.0, scale: 1.08, angle: 74, ox: 46, oy: -4, r: 34,
    onStart() { Snd.tone(120, 0.25, "square", 0.08, 240); },
    vfx(f) {
      const p = hbAt(f, this);
      // a gate of bars drops out of nowhere onto the spot in front of him
      for (let i = 0; i < 4; i++)
        FX.streak(p.x + (i - 1.5) * 13, p.y - 70, p.x + (i - 1.5) * 13, p.y + 30, i % 2 ? "#ffffff" : f.ch.color);
      FX.dustLine(p.x, f.feetY, 80, "#b9b6d8");
      FX.burst(p.x, p.y + 20, 14, f.ch.accent, 5);
      FX.shake(9);
      Snd.bigHit();
    } },

  special: { name: "Bulwark", startup: 10, active: 2, recovery: 18,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Plants his tower shield as a stone wall just ahead for three seconds. Foes can't walk or fly through it (launched ones bounce off), and enemy projectiles that touch it are destroyed. He and his team pass freely.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      const x = f.x + f.facing * 52;
      let fl = Stage.floorBelow(x, f.y);
      if (fl === null || fl - f.feetY > 160) fl = f.feetY + 30;
      Entities.add("warden_wall", f, { x, y: fl, r: 110, w: 12, life: 180 });
      FX.dustLine(x, fl, 70, "#b9b6d8"); FX.shake(8);
      Snd.bigHit();
    } },

  super: { name: "Lockdown",
    desc: "Drops a cage over the nearest foe. For two seconds they can't get out, and the bars close in; then it slams shut for 22% and a big launch that can't be shielded.",
    startup: 16, active: 6, recovery: 30,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    slam: { name: "Lockdown", dmg: 22, base: 6.2, scale: 1.1, angle: 62, unblockable: true },
    onStart(f) { Snd.superCharge(); FX.flash("#ffcf5a", 0.25); },
    tick(f, a) {
      const m = a.data;
      if (a.t !== m.startup) { if (a.t < m.startup) f.vx *= 0.7; return; }
      const t = Combat.nearestFoe(f, 560);
      if (!t || t.intangible()) { FX.ring(f.x, f.y, 10, 80, f.ch.accent, 3); return; }
      Entities.add("warden_cage", f, { tgt: t, x: t.x, y: t.y, w: 66, r: 0, life: 120, move: m.slam });
      FX.streak(f.x, f.y - 20, t.x, t.y, f.ch.accent);
      FX.damageText(t.x, t.y - 80, "LOCKED", f.ch.accent);
      FX.shake(14); Snd.shieldBreak();
    } },

  /* ---- art: a broad jailer in plate under a tabard, a great helm with a
           T-slit, a giant iron key for a weapon and a tower shield slung on
           his back — which is missing while it stands as a Bulwark. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#dfe5f2" : c2, deep = A.flash ? "#c2cbe0" : c3;
    const v = A.v || {}, sw = swing(A, -12, 40);
    aura(g, 0, -4, 38, c, 0.1);

    if (!v.wall) {
      plateRect(g, -27, -28, 17, 48, 4, dark, { up: 0.3, down: 0.4, ink: 3 });
      plateRect(g, -24, -24, 11, 40, 3, body, { up: 0.4, rimA: 0.3 });
      lens(g, () => roundRect(g, -20.5, -9, 4, 10, 2), ac, ac, 8);
    }

    const st = Math.sin(A.runPhase) * (A.running ? 8 : 0);
    jointLimb(g, -8, 12, -11 + st, 27, -3, 10, deep);
    jointLimb(g, 8, 12, 12 - st, 27, 3, 10, deep);
    plateRect(g, -19 + st * 0.6, 25, 15, 7, 2.5, dark, { up: 0.3 });
    plateRect(g, 5 - st * 0.6, 25, 15, 7, 2.5, dark, { up: 0.3 });

    // plate torso, tabard, keyhole sigil, pauldrons
    plate(g, [-16, -16, 16, -16, 15, 14, -15, 14], body, { up: 0.3, down: 0.36, under: true });
    plate(g, [-7, -12, 7, -12, 7, 20, 0, 24, -7, 20], dark, { up: 0.15, down: 0.3, rimA: 0.25 });
    g.fillStyle = ac;
    g.beginPath(); g.arc(0, -3, 2.6, 0, 7); g.fill();
    poly(g, [-1.4, -2, 1.4, -2, 2.6, 5, -2.6, 5]); g.fill();
    plate(g, [-16, -17, -23, -10, -21, -1, -12, -6], dark, { up: 0.4, ink: 2.4 });
    plate(g, [16, -17, 23, -10, 21, -1, 12, -6], dark, { up: 0.4, ink: 2.4 });
    rivets(g, -11, 11, 5, 5.5, ac);

    // head: a great helm with a glowing T-slit and a short crest
    g.save(); g.translate(0, -27);
    plate(g, [-6, -9, 4, -9, -2, -16], "#c4ccdb", { ink: 2, up: 0.3 });
    plateRect(g, -9, -9, 18, 18, 4, body, { up: 0.45, down: 0.3 });
    lens(g, () => poly(g, [-1, -3, 8, -3, 8, -1, 4.4, -1, 4.4, 5, 2.6, 5, 2.6, -1, -1, -1]), ac, ac, 12);
    g.restore();

    jointLimb(g, -12, -12, -16, 2, -3, 7, dark);

    // key arm: a giant iron key, bit forward
    const ax = 18 + sw, ay = -4;
    jointLimb(g, 13, -12, (13 + ax) / 2, ay - 1, 2, 8, dark);
    limb(g, (13 + ax) / 2, ay - 1, ax - 3, ay, 9, mid_(c, c2));
    g.save(); g.translate(ax, ay); g.rotate(A.atkPhase >= 0 ? 0 : -0.9);
    g.lineCap = "round";
    g.strokeStyle = INK; g.lineWidth = 6.4; g.beginPath(); g.arc(-7, 0, 6, 0, 7); g.stroke();
    g.strokeStyle = "#d9a441"; g.lineWidth = 3.2; g.stroke();
    g.strokeStyle = INK; g.lineWidth = 6.4; g.beginPath(); g.moveTo(-1, 0); g.lineTo(30, 0); g.stroke();
    g.strokeStyle = "#d9a441"; g.lineWidth = 3.4; g.stroke();
    plate(g, [23, 0, 32, 0, 32, 10, 28, 10, 28, 6, 23, 6], "#e7bd5a", { ink: 2, up: 0.3 });
    g.restore();
  },
},

/* ======================================================================== */
/* MAGMA — THE FORGE                                                         */
/* ======================================================================== */
{
  id: "MAGMA", name: "MAGMA", tag: "THE FORGE",
  blurb: "She doesn't hit you twice. The fire does that for her.",
  power: "Her heavy and Lava Lob set foes on fire (+1% every third of a second). Eruption blows the floor up under every grounded foe — burning ones take far more.",
  color: "#ff6a22", color2: "#3b1d16", color3: "#1a0b08", accent: "#ffd36b",
  weight: 1.2, speed: 3.8, accel: 0.7, jump: 11.7, airSpeed: 3.6, fallMul: 1.1,
  size: { w: 42, h: 58 }, hurt: 29,
  specialCooldown: 210,

  light: { name: "Ember Jab", startup: 4, active: 3, recovery: 10,
    dmg: 4.2, base: 2.0, scale: 0.5, angle: 42, ox: 38, oy: -6, r: 23,
    vfx(f) {
      FX.blade(f.x + f.facing * 10, f.y - 6, faceAng(f), 24, 56, 0.5, f.ch.color, { w: 10, life: 9 });
      FX.spark(hbAt(f, this).x, f.y - 6, f.ch.accent);
      Snd.noise(0.06, 0.08, 900, 0.9);
    } },

  heavy: { name: "Forge Hammer", startup: 14, active: 4, recovery: 27,
    dmg: 15.5, base: 4.8, scale: 1.06, angle: 55, ox: 44, oy: -2, r: 34,
    onHit(f, d) { magmaIgnite(f, d, 150); },
    onStart() { Snd.whoosh(1.4); },
    vfx(f) {
      const p = hbAt(f, this);
      FX.blade(f.x, f.y - 10, faceAng(f) - 1.2 * f.facing, 36, 80, 1.6, f.ch.color, { w: 14, life: 14, spin: f.facing * 0.07 });
      FX.burst(p.x, p.y, 22, "#ff7a1a", 8);
      FX.burst(p.x, p.y, 10, "#ffe27a", 4);
      FX.shake(9); FX.flash("#ff7a1a", 0.1);
      Snd.bigHit();
    } },

  special: { name: "Lava Lob", startup: 12, active: 2, recovery: 20,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Lobs a glob of lava in an arc. A foe it hits takes 6% and catches fire; wherever it ends up, it leaves a burning pool on the floor for three seconds — anyone standing in it ignites.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      Entities.add("magma_glob", f, { x: f.x + f.facing * 20, y: f.y - 26, vx: f.facing * 6.2, vy: -8.5, r: 10, life: 140,
        move: hitMove("Lava Lob", { dmg: 6, base: 2.6, scale: 0.5, angle: 55, onHit(o, d) { magmaIgnite(o, d, 150); } }) });
      Snd.noise(0.2, 0.14, 500, 0.8);
    } },

  super: { name: "Eruption",
    desc: "The floor cracks under every foe standing on something, one after another; a moment later each crack erupts in a column of lava for 18% and sets them on fire. A foe who was already burning takes 25% instead.",
    startup: 18, active: 50, recovery: 28,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    blast: { name: "Eruption", dmg: 18, base: 5.6, scale: 1.02, angle: 84, unblockable: true },
    hot:   { name: "Eruption", dmg: 25, base: 6.4, scale: 1.1, angle: 84, unblockable: true },
    onStart(f) { Snd.superCharge(); FX.flash("#ff6a22", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.7; f.vy *= 0.7; FX.spark(f.x + rnd(-30, 30), f.feetY - rnd(0, 20), "#ffb04a"); return; }
      const s = a.t - m.startup;
      if (s === 0) {
        a.queue = Combat.foes(f).sort((p, q) => dist(f.x, f.y, p.x, p.y) - dist(f.x, f.y, q.x, q.y));
        FX.shake(16);
      }
      f.vx *= 0.8;
      if (!a.queue || s % 14 !== 0) return;
      const o = a.queue[s / 14];
      if (!o || !o.alive || o.state === ST.DEAD) return;
      const fl = Stage.floorBelow(o.x, o.y);
      if (fl === null || fl - o.feetY > 260) return;     // nothing under them to erupt
      Entities.add("magma_vent", f, { tgt: o, x: o.x, y: fl, w: 46, r: 0, life: 32, move: m.blast, hot: m.hot });
      Snd.noise(0.4, 0.2, 160, 0.7);
    } },

  /* ---- art: a stocky smith built of basalt plates with lava showing in
           the seams, a leather apron, hair of flame and a hammer whose face
           glows white-hot. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#ffd8c0" : c2, deep = A.flash ? "#ffc0a0" : c3;
    const sw = swing(A, -12, 42), t = A.time || 0, heat = 0.6 + 0.4 * Math.sin(t * 0.12);
    aura(g, 0, -4, 38, c, 0.14 + heat * 0.08);

    const st = Math.sin(A.runPhase) * (A.running ? 9 : 0);
    jointLimb(g, -8, 10, -11 + st, 26, -3, 10, dark);
    jointLimb(g, 8, 10, 12 - st, 26, 3, 10, dark);
    plateRect(g, -19 + st * 0.6, 24, 15, 7, 2.5, deep, { up: 0.2 });
    plateRect(g, 5 - st * 0.6, 24, 15, 7, 2.5, deep, { up: 0.2 });

    // a molten core, with basalt plates over it — the seams glow
    plate(g, [-17, -14, 17, -14, 15, 13, -15, 13], body, { up: 0.5, down: 0.2, under: true });
    for (const p of [[-16, -13, -2, -13, -3, -1, -15, 0], [2, -13, 16, -13, 15, 0, 3, -2],
                     [-15, 3, -1, 1, -1, 12, -14, 12], [2, 1, 15, 2, 14, 12, 1, 12]])
      plate(g, p, dark, { up: 0.3, down: 0.4, ink: 2, rimA: 0.25 });
    plate(g, [-8, -6, 8, -6, 10, 18, -10, 18], "#6b3a22", { up: 0.25, down: 0.35, ink: 2.2, rimA: 0.25 });
    g.strokeStyle = hexA(ac, 0.5); g.lineWidth = 1;
    g.beginPath(); g.moveTo(-6, 2); g.lineTo(6, 2); g.stroke();

    // head: a rock face, ember eyes, hair of flame
    g.save(); g.translate(0, -24);
    glow(g, c, 14, () => {
      for (let i = 0; i < 4; i++) {
        const hx = -6 + i * 4, hh = 9 + hash(Math.floor(t / 4) + i) * 6;
        g.fillStyle = i % 2 ? ac : body;
        poly(g, [hx - 3.5, -4, hx + 3.5, -4, hx + Math.sin(t * 0.2 + i) * 2 - 1, -4 - hh]); g.fill();
      }
    });
    ink(g, () => roundRect(g, -8, -7, 16, 15, 5), vol(g, -7, 8, "#5a2e22", 0.25, 0.35));
    lens(g, () => poly(g, [1, -1, 6, -1.6, 6, 0.4, 1, 0.6]), ac, c, 10 + heat * 6);
    lens(g, () => poly(g, [-4, -0.8, -1, -1.2, -1, 0.6, -4, 0.6]), ac, c, 8);
    g.restore();

    jointLimb(g, -13, -10, -17, 3, -3, 8, dark);

    // hammer arm
    const ax = 18 + sw, ay = -4;
    jointLimb(g, 13, -10, (13 + ax) / 2, ay - 1, 2, 9, dark);
    limb(g, (13 + ax) / 2, ay - 1, ax - 3, ay, 10, mid_(c, c2));
    g.save(); g.translate(ax, ay); g.rotate(A.atkPhase >= 0 ? 0.1 : -1.1);
    g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = "round";
    g.beginPath(); g.moveTo(-4, 0); g.lineTo(24, 0); g.stroke();
    g.strokeStyle = "#7a4a2a"; g.lineWidth = 3.4; g.stroke();
    plateRect(g, 20, -10, 13, 20, 2.5, "#4a4550", { up: 0.35, ink: 2.4 });
    lens(g, () => roundRect(g, 30, -9, 4, 18, 1.5), ac, "#ff7a1a", 10 + heat * 10);
    g.restore();
  },
},

/* ======================================================================== */
/* JINX — THE GAMBLER                                                        */
/* ======================================================================== */
{
  id: "JINX", name: "JINX", tag: "THE GAMBLER",
  blurb: "The house always wins. She's the house.",
  power: "Roll the Dice: a 1 busts and hurts her, 2-3 deals cards, 4-5 drops a loaded die, 6 is a JACKPOT that heals her. All In spins three reels whose payouts stack — a pair pays again.",
  color: "#5be04a", color2: "#1a4d1a", color3: "#0b240c", accent: "#ffd34d",
  weight: 0.86, speed: 4.8, accel: 0.95, jump: 12.8, airSpeed: 4.6, fallMul: 0.94,
  size: { w: 30, h: 54 }, hurt: 24,
  specialCooldown: 170,

  light: { name: "Card Flick", startup: 3, active: 3, recovery: 9,
    dmg: 3.5, base: 1.6, scale: 0.42, angle: 44, ox: 36, oy: -8, r: 22,
    vfx(f) {
      FX.blade(f.x + f.facing * 8, f.y - 8, faceAng(f) + 0.2 * f.facing, 22, 52, 0.6, "#fbf7ee", { w: 7, life: 9 });
      FX.spark(hbAt(f, this).x, f.y - 8, f.ch.accent);
      Snd.tone(1700, 0.03, "square", 0.06, 2300);
    } },

  heavy: { name: "Croupier's Rake", startup: 13, active: 5, recovery: 25,
    dmg: 13.5, base: 4.2, scale: 1.02, angle: 35, ox: 48, oy: 6, r: 30,
    onStart() { Snd.whoosh(1.2); },
    vfx(f) {
      FX.blade(f.x, f.y + 4, faceAng(f) + 0.5 * f.facing, 36, 82, 1.4, f.ch.color, { w: 12, life: 14, spin: -f.facing * 0.06 });
      FX.blade(f.x, f.y + 4, faceAng(f) + 0.5 * f.facing, 32, 76, 1.1, f.ch.accent, { w: 3, life: 10, core: false, spin: -f.facing * 0.06 });
      FX.shake(5);
      Snd.tone(500, 0.1, "square", 0.08, 250);
    } },

  special: { name: "Roll the Dice", startup: 16, active: 2, recovery: 20,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Rolls a die. 1: bust — she takes 3%. 2: deals a card (4%). 3: deals two (5% each). 4-5: a giant die drops on the nearest foe (9% / 11%). 6: JACKPOT — a huge die for 15% and she heals 6%.",
    tick(f, a) {
      const m = a.data;
      if (a.t === 1) {                                   // host only: the move isn't predicted online
        f.v.roll = rndi(1, 6);
        f.v.rollF = Match.current ? Match.current.frames : 0;
      }
      if (a.t < m.startup && a.t % 4 === 0) Snd.tone(700 + a.t * 30, 0.03, "square", 0.05);
      if (a.t !== m.startup || a.fired) return;
      a.fired = true;
      f.ch.payout(f, f.v.roll, false, "");
    } },

  super: { name: "All In",
    desc: "Pulls a three-reel slot machine. Each reel pays out as she stops it, the same as a roll (cards, dice, jackpots — or a small bust), and every payout can't be shielded. A pair pays its number once more; three of a kind pays it twice more.",
    startup: 20, active: 52, recovery: 26,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    onStart(f) { Snd.superCharge(); FX.flash("#ffd34d", 0.3); },
    tick(f, a) {
      const m = a.data, v = f.v;
      if (a.t === 1) {
        v.s1 = rndi(1, 6); v.s2 = rndi(1, 6); v.s3 = rndi(1, 6);
        v.slotF = Match.current ? Match.current.frames : 0;
      }
      if (a.t < m.startup) { f.vx *= 0.7; f.vy *= 0.7; if (a.t % 3 === 0) Snd.tone(900 + (a.t % 9) * 80, 0.03, "square", 0.05); return; }
      f.vx *= 0.8;
      const s = a.t - m.startup;
      if (s % 16 !== 0) return;
      const i = s / 16, r = [v.s1, v.s2, v.s3];
      if (i < 3) { Snd.tone(500 + r[i] * 120, 0.1, "square", 0.1); f.ch.payout(f, r[i], true, " " + (i + 1)); return; }
      if (i !== 3) return;
      const triple = r[0] === r[1] && r[1] === r[2];
      const pair = triple ? r[0] : r[0] === r[1] || r[0] === r[2] ? r[0] : r[1] === r[2] ? r[1] : 0;
      if (!pair) return;
      FX.banner(triple ? "TRIPLE " + pair + "S!" : "PAIR OF " + pair + "S", "#ffd34d");
      f.ch.payout(f, pair, true, " bonus");
      if (triple) f.ch.payout(f, pair, true, " bonus 2");
    } },

  /** What a rolled number does. sup: from All In (unblockable, smaller bust).
      tag keeps repeated payouts from going stale against each other. */
  payout(f, n, sup, tag) {
    FX.damageText(f.x, f.y - 74, String(n), n === 6 ? "#ffd34d" : "#ffffff");
    if (!sup) FX.banner(n === 6 ? "JACKPOT!" : n === 1 ? "BUST" : "ROLLED " + n, n === 6 ? "#ffd34d" : n === 1 ? "#8f8cb5" : this.color);
    if (n === 1) {
      const hurt = sup ? 2 : 3;
      f.percent = Math.min(999, f.percent + hurt); f.hitFlash = 6;
      FX.burst(f.x, f.y - 10, 12, "#8f8cb5", 3);
      FX.damageText(f.x, f.y - 54, "+" + hurt, "#8f8cb5");
      Snd.tone(300, 0.25, "sawtooth", 0.1, 80);
      return;
    }
    if (n <= 3) {
      const k = sup ? 3 : n - 1;              // a card on a 2, two on a 3, a fan of three in the super
      for (let i = 0; i < k; i++) {
        const spread = k === 1 ? 0 : (i / (k - 1) - 0.5) * 3.2;
        Entities.add("jinx_card", f, { x: f.x + f.facing * 20, y: f.y - 10, vx: f.facing * 11, vy: spread, dir: f.facing,
          r: 10, life: 60, move: hitMove("Dealt Card" + tag, { dmg: sup ? 4 : n + 2, base: 1.8, scale: 0.4, angle: 40, unblockable: sup }) });
      }
      Snd.tone(1400, 0.05, "square", 0.07, 2000);
      return;
    }
    // 4-6: a giant die drops on the nearest foe, or just ahead of her
    const t = Combat.nearestFoe(f, sup ? 1400 : 320), jack = n === 6;
    const x = t ? t.x : f.x + f.facing * 70, ty = t ? t.y : f.y;
    Entities.add("jinx_die", f, { x, y: ty - 170, ty, vy: 3, r: jack ? 22 : 16, w: n, life: 60,
      move: jack ? hitMove("Jackpot" + tag, { dmg: 15, base: 5.6, scale: 1.08, angle: 50, unblockable: sup })
                 : hitMove("Loaded Die" + tag, { dmg: n === 4 ? 9 : 11, base: 3.8, scale: 0.86, angle: 55, unblockable: sup }) });
    if (jack) {
      const heal = Math.min(f.percent, sup ? 4 : 6);
      f.percent -= heal;
      FX.damageText(f.x, f.y - 54, "+" + heal.toFixed(0), "#7dff9a");
      FX.burst(f.x, f.y - 20, 24, "#ffd34d", 7);
      Snd.tone(1320, 0.3, "triangle", 0.12, 1980);
    }
  },

  /* ---- art: a card dealer. Felt-green visor, white shirt and a black
           vest, a red bow tie, a fan of cards in one hand and a deck in the
           other. Her last roll hangs over her head as a die; All In shows
           the slot machine's three reels. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#d8ffd0" : c2;
    const v = A.v || {}, fr = Match.current ? Match.current.frames : -1e9;
    const sw = swing(A, -10, 42), t = A.time || 0;
    const shirt = A.flash ? "#ffffff" : "#f4f1ea", vest = A.flash ? "#e0e0e0" : "#1c1a24";
    aura(g, 0, -4, 32, c, 0.14);

    const st = Math.sin(A.runPhase) * (A.running ? 11 : 0);
    jointLimb(g, -4, 9, -8 + st, 25, -3, 5.4, vest);
    jointLimb(g, 5, 9, 9 - st, 25, 3, 5.4, vest);
    plateRect(g, -13 + st, 23, 11, 5, 2, "#3a2030", { up: 0.3 });
    plateRect(g, 4 - st, 23, 11, 5, 2, "#3a2030", { up: 0.3 });

    // shirt, vest with gold buttons, bow tie
    plate(g, [-9, -15, 9, -15, 8, 11, -8, 11], shirt, { up: 0.2, down: 0.3, under: true });
    plate(g, [-9, -14, -2, -14, 0, 2, -1, 11, -8, 11], vest, { up: 0.3, down: 0.3, ink: 2, rimA: 0.25 });
    plate(g, [9, -14, 2, -14, 0, 2, 1, 11, 8, 11], vest, { up: 0.3, down: 0.3, ink: 2, rimA: 0.25 });
    g.fillStyle = ac;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(2.4, 3 + i * 3, 1.1, 0, 7); g.fill(); }
    plate(g, [-4, -15, 0, -13, -4, -11], "#e0283c", { ink: 1.6, rim: false });
    plate(g, [4, -15, 0, -13, 4, -11], "#e0283c", { ink: 1.6, rim: false });

    // head: slick bob, a wink, a dice earring, the dealer's visor
    g.save(); g.translate(1, -24);
    plate(g, [-8, 4, -9, -4, -4, -9, 5, -9, 8, -4, 6, -2, -4, -3, -5, 5], "#2a1a2a", { ink: 2, up: 0.3 });
    ink(g, () => { g.beginPath(); g.ellipse(1, 0, 6.4, 7.2, 0, 0, 7); }, vol(g, -7, 7, "#f2d0b0", 0.2, 0.3));
    g.fillStyle = INK; g.beginPath(); g.arc(4.6, 0, 1.3, 0, 7); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-0.5, 0.3); g.lineTo(2, 0); g.stroke();
    g.beginPath(); g.moveTo(1, 4); g.quadraticCurveTo(4, 5.4, 6, 3.4); g.stroke();
    w3bDie(g, -3.5, 7, 1.8, 6, INK, 0.3);
    plate(g, [-7, -4, 12, -5.5, 14, -2.5, -7, -1.5], body, { up: 0.3, ink: 2 });
    g.fillStyle = hexA(c, 0.25); poly(g, [-5, -2, 12, -3, 9, 2, -5, 1]); g.fill();
    g.restore();

    // back arm with the deck
    jointLimb(g, -7, -11, -13, -1, -3, 4.6, shirt);
    plateRect(g, -17, -5, 7, 10, 1.5, "#fbf7ee", { up: 0.1, ink: 1.8, rimA: 0.2 });
    g.fillStyle = "#e0283c"; g.fillRect(-16, -4, 5, 8);

    // card arm: sleeve garter, then a fan of three cards
    const ax = 14 + sw, ay = -6, mx = (7 + ax) / 2;
    jointLimb(g, 7, -11, mx, ay - 1, 2.5, 5, shirt);
    limb(g, mx, ay - 1, ax - 2, ay, 5.4, shirt);
    g.strokeStyle = body; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(mx - 1, ay - 5); g.lineTo(mx + 1, ay + 3); g.stroke();
    g.save(); g.translate(ax, ay); g.rotate(A.atkPhase >= 0 ? 0 : -0.5);
    for (let i = -1; i <= 1; i++) {
      g.save(); g.rotate(i * 0.3);
      plateRect(g, 2, -15, 10, 15, 2, "#fbf7ee", { up: 0.1, ink: 1.6, rimA: 0.2 });
      g.fillStyle = i === 0 ? INK : "#e0283c";
      poly(g, [7, -11, 9.5, -7.5, 7, -4, 4.5, -7.5]); g.fill();
      g.restore();
    }
    g.restore();

    // the last roll, over her head: tumbling while it rolls, then the result
    const age = fr - (v.rollF || 0);
    if (v.roll && age >= 0 && age < 100) {
      const rolling = age < 15, n = rolling ? 1 + Math.floor(t / 3) % 6 : v.roll;
      const pop = rolling ? 1 : 1 + Math.max(0, 0.5 - (age - 15) * 0.05);
      g.save(); g.globalAlpha = clamp((100 - age) / 15, 0, 1);
      if (n === 6 && !rolling) aura(g, 0, -60, 30, ac, 0.45);
      w3bDie(g, 0, -60 - (rolling ? Math.abs(Math.sin(age * 0.4)) * 8 : 0), 9 * pop, n, INK, rolling ? age * 0.5 : 0);
      g.restore();
    }
    // All In: the slot machine's window, each reel stopping in turn
    const sAge = fr - (v.slotF || 0);
    if (v.s1 && sAge >= 0 && sAge < 120) {
      g.save(); g.globalAlpha = clamp((120 - sAge) / 15, 0, 1);
      plateRect(g, -35, -80, 70, 28, 5, "#2a2030", { up: 0.3, ink: 2.6, rimCol: ac });
      const r = [v.s1, v.s2, v.s3];
      for (let i = 0; i < 3; i++) {
        const stopped = sAge >= 19 + i * 16;
        w3bDie(g, -22 + i * 22, -66, 8, stopped ? r[i] : 1 + Math.floor((t + i * 2) / 2) % 6, INK, 0);
      }
      g.restore();
    }
  },
},
];

WAVE3B.forEach(c => { CHAR_BY_ID[c.id] = c; });
ROSTER.push(...WAVE3B);
