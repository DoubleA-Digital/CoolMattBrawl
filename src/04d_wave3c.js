/* ==========================================================================
   5d. WAVE 3C — four more fighters, each on a mechanic nobody else has

     BULWARK  reflection    Reflector sends projectiles back as his; Aegis domes
     WRAITH   summoning     skeletons that walk to a foe and claw; Legion of four
     DRIFT    momentum      glides instead of stopping; faster = harder (+40%)
     QUILL    traps         caltrops that trip; a needle storm; light hits prick

   Numbers sit in the roster's ranges (lights 3-5%, heavies 13-17%, supers
   ~18-26% when they fully land). What they spawn lives in 08d_kinds_c.js,
   together with the reflect helpers and the two passive "watchers".
   ========================================================================== */

/* ---- Drift: momentum. Each attack remembers how fast he was going when he
        started it (f.v.spd); that speed pays out as bonus damage and knockback
        on the hit, up to +40% at a full Kickflip. ---- */
function w3cDriftBonus(f) { return clamp(((f.v.spd || 0) - 1.5) / 9, 0, 1) * 0.4; }
/** startAttack bleeds 58% of a grounded fighter's speed; a skater keeps 80%. */
function w3cDriftStart(f, keep) {
  w3cWatch(f, "drift_board");
  if (keep && f.grounded) f.vx *= 0.8 / 0.42;
  f.v.spd = Math.round(Math.abs(f.vx) * 10) / 10;
}
/** During his own attacks he rolls on: 5% decay a frame instead of 14%. */
function w3cDriftGlide(f) { if (f.grounded) f.vx *= 0.95 / 0.86; }
function w3cDriftHit(f, d, move) {
  if (d.state !== ST.HITSTUN || d.lastHitBy !== f) return;      // shielded, countered, armoured
  const b = w3cDriftBonus(f);
  if (b < 0.03) return;
  const extra = Math.round(move.dmg * b * 10) / 10;
  d.percent = Math.min(999, d.percent + extra);
  d.vx *= 1 + b * 0.5; d.vy *= 1 + b * 0.5;
  f.stats.damageDealt += extra;
  FX.damageText(d.x, d.y - 62, "+" + Math.round(b * 100) + "% SPEED", f.ch.accent);
}

/** Wraith: put a skeleton on the floor at (x, y). */
function w3cRaise(f, x, y, legion, log) {
  const fl = Stage.floorBelow(x, y - 30);
  const landed = fl !== null && fl - y < 60;
  return Entities.add("wraith_minion", f, { x, y: landed ? fl : y, vy: 0, landed, dir: f.facing,
    r: 14, w: 0, storm: !!legion, life: legion ? 300 : 360, cap: legion ? 2 : 3, hits: 0, cd: 0,
    spd: legion ? 3.4 : 2.4, log: log || null,
    move: legion ? hitMove("Legion", { dmg: 4, base: 2.4, scale: 0.5, angle: 50 })
                 : hitMove("Raise", { dmg: 3.2, base: 1.8, scale: 0.4, angle: 48 }) });
}

const WAVE3C = [

/* ======================================================================== */
/* BULWARK — THE MIRROR                                                      */
/* ======================================================================== */
{
  id: "BULWARK", name: "BULWARK", tag: "THE MIRROR",
  blurb: "Throw something at him. Go on. See what happens.",
  power: "Reflector sends any projectile that touches his mirror straight back, 30% faster and now his. Aegis raises a mirrored dome that bounces everything and braces his whole side.",
  color: "#9fb8d0", color2: "#34465c", color3: "#161f2c", accent: "#e6fdff",
  weight: 1.3, speed: 3.7, accel: 0.72, jump: 11.6, airSpeed: 3.6, fallMul: 1.1,
  size: { w: 42, h: 58 }, hurt: 29,
  specialCooldown: 110,
  cpuSuperRange: 260,
  // mirror up when an enemy projectile is on its way in
  cpuSpecial(f) { return Entities.list.some(e => !allies(e.owner, f) && e.move && dist(e.x, e.y, f.x, f.y) < 150); },

  light: { name: "Shield Bash", startup: 4, active: 3, recovery: 11,
    dmg: 4.6, base: 2.2, scale: 0.5, angle: 38, ox: 36, oy: -4, r: 24,
    vfx(f) {
      FX.blade(f.x + f.facing * 12, f.y - 4, faceAng(f), 18, 46, 0.25, f.ch.accent, { w: 14, life: 8 });
      Snd.tone(420, 0.05, "square", 0.09, 260);
    } },

  heavy: { name: "Sunburst", startup: 14, active: 4, recovery: 27,
    dmg: 15, base: 4.7, scale: 1.05, angle: 48, ox: 44, oy: -6, r: 34,
    onStart() { Snd.whoosh(1.2); },
    vfx(f) {
      const p = hbAt(f, this);
      // he tilts the mirror and catches the light: rays fan out of it
      for (let i = 0; i < 7; i++)
        FX.blade(p.x - f.facing * 10, p.y, faceAng(f) + (i - 3) * 0.22, 10, 70 + (i % 2) * 20, 0.06,
                 i % 2 ? "#ffffff" : f.ch.accent, { w: 4, life: 12 });
      FX.ring(p.x, p.y, 8, 80, "#ffffff", 4);
      FX.flash("#ffffff", 0.1); FX.shake(6);
      Snd.tone(1800, 0.14, "triangle", 0.1, 600);
    } },

  special: { name: "Reflector", startup: 3, active: 30, recovery: 16,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Plants the mirror for half a second. Any enemy projectile that touches it flies straight back 30% faster — and it's his now. Melee still lands during the stance, but knocks him only half as far.",
    onStart() { Snd.tone(1200, 0.12, "triangle", 0.08, 2400); },
    tick(f, a) {
      const m = a.data;
      if (a.t <= m.startup || a.t > m.startup + m.active) return;
      f.anchorGlow = Math.max(f.anchorGlow, 2);          // braced: half knockback
      if (!f.grounded) f.vy = Math.min(f.vy, 2.5);       // the stance hangs a little in the air
      for (const e of Entities.list)
        if (w3cReflectable(e, f) && dist(e.x, e.y, f.x, f.y) < f.ch.hurt + 46 + (e.r || 0)) w3cReflect(e, f);
      if (a.t % 6 === 0) FX.spark(f.x + f.facing * 26, f.y + rnd(-20, 14), "#ffffff");
    } },

  super: { name: "Aegis",
    desc: "A mirrored dome rises around him for four seconds. It bounces back every enemy projectile that reaches it, and he and any teammate inside are knocked back half as far. It shoves foes out for 8% as it rises and bursts for 12% when it falls.",
    startup: 14, active: 4, recovery: 22,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0, radius: 130,
    shove: { name: "Aegis", dmg: 8, base: 4.4, scale: 0.6, angle: 35, unblockable: true },
    burst: { name: "Aegis Burst", dmg: 12, base: 5.0, scale: 1.0, angle: 55, unblockable: true },
    onStart(f) { Snd.superCharge(); FX.flash("#e6fdff", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t !== m.startup) { if (a.t < m.startup) f.vx *= 0.7; return; }
      FX.banner("AEGIS", f.ch.accent);
      FX.ring(f.x, f.y, 20, m.radius + 30, "#ffffff", 6);
      FX.shake(12); Snd.superHit();
      Entities.add("bulwark_dome", f, { x: f.x, y: f.y, r: m.radius, life: 240, move: m.burst });
      for (const o of Combat.foes(f))
        if (!o.intangible() && dist(f.x, f.y, o.x, o.y) < m.radius + o.ch.hurt) Combat.land(f, o, m.shove, o.x, o.y);
    } },

  /* ---- art: a broad knight in a great helm with a T-visor and a crest fin,
           a short cape, and a huge round convex mirror for a shield. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#dfe9f4" : c2, deep = A.flash ? "#c4d2e0" : c3;
    const sw = swing(A, -8, 30);
    const guard = A.atkKind === "special";
    aura(g, 0, -4, 38, ac, guard ? 0.26 : 0.12);

    // cape, behind everything
    const flap = Math.sin(A.time * 0.08) * 2 - Math.abs(A.vx) * 0.8;
    plate(g, [-10, -18, -2, -18, -6, 16, -22 + flap, 19], deep, { up: 0.2, down: 0.4, rimA: 0.2 });

    const st = Math.sin(A.runPhase) * (A.running ? 8 : 0);
    jointLimb(g, -7, 10, -10 + st, 26, -3, 9, dark);
    jointLimb(g, 7, 10, 11 - st, 26, 3, 9, dark);
    plateRect(g, -18 + st * 0.6, 24, 15, 7, 2.5, deep, { up: 0.2 });
    plateRect(g, 4 - st * 0.6, 24, 15, 7, 2.5, deep, { up: 0.2 });

    // breastplate with a polished keel down the middle, belt, pauldrons
    plate(g, [-15, -17, 15, -17, 12, 12, -12, 12], body, { up: 0.42, down: 0.4, under: true });
    plate(g, [-5, -15, 5, -15, 3, 5, 0, 9, -3, 5], mixColor(body, "#ffffff", 0.45), { up: 0.5, ink: 1.8, rimA: 0.6 });
    plateRect(g, -13, 6, 26, 5, 2, deep, { rim: false, ink: 2 });
    g.fillStyle = ac; g.fillRect(-2, 7, 4, 3);
    plate(g, [-14, -18, -24, -13, -22, -4, -13, -8], body, { up: 0.5, ink: 2.4 });
    plate(g, [14, -18, 23, -14, 21, -5, 13, -8], body, { up: 0.5, ink: 2.4 });

    // head: a great helm, a T-shaped visor and a crest fin
    g.save(); g.translate(0, -27);
    const helm = () => roundRect(g, -8, -8, 17, 17, 5);
    ink(g, helm, vol(g, -8, 9, body, 0.45, 0.35));
    rim(g, helm, "#ffffff", 3, 0.6);
    lens(g, () => roundRect(g, 0, -2, 9, 2.6, 1), ac, ac, 12);
    lens(g, () => roundRect(g, 4, -2, 2.4, 8, 1), ac, ac, 8);
    plate(g, [-5, -8, 5, -8, 1, -17, -10, -14], ac, { up: 0.3, ink: 2 });
    g.restore();

    jointLimb(g, -12, -12, -18, 2, -3, 6, dark);

    // shield arm and the mirror: raised square-on during Reflector
    const sx = guard ? 22 : 15 + sw, sy = guard ? -8 : -2;
    jointLimb(g, 10, -12, sx - 6, sy, 3, 7, dark);
    g.save(); g.translate(sx, sy);
    const rx = guard ? 10 : 8, ry = guard ? 24 : 19;
    const disc = () => { g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); };
    ink(g, disc, vol(g, -ry, ry, mixColor(c, "#ffffff", 0.3), 0.5, 0.5), 3.4);
    // the mirror face: sky above, steel below, and a glint that sweeps it
    g.save(); disc(); g.clip();
    g.fillStyle = hexA("#ffffff", 0.35); g.fillRect(-rx, -ry, rx * 2, ry * 0.7);
    g.fillStyle = hexA(c2, 0.35); g.fillRect(-rx, ry * 0.25, rx * 2, ry);
    const gy = ((A.time * 1.2) % (ry * 4)) - ry * 2;
    g.strokeStyle = hexA("#ffffff", 0.9); g.lineWidth = 3;
    g.beginPath(); g.moveTo(-rx, gy + 6); g.lineTo(rx, gy - 6); g.stroke();
    g.restore();
    g.strokeStyle = dark; g.lineWidth = 2; disc(); g.stroke();
    if (guard) glow(g, ac, 18, () => {
      g.strokeStyle = hexA(ac, 0.8); g.lineWidth = 2.4;
      g.beginPath(); g.ellipse(4, 0, rx + 6, ry + 8, 0, -1.2, 1.2); g.stroke();
    });
    g.restore();
  },
},

/* ======================================================================== */
/* WRAITH — THE NECROMANCER                                                  */
/* ======================================================================== */
{
  id: "WRAITH", name: "WRAITH", tag: "THE NECROMANCER",
  blurb: "Never fights alone. Never fights fair. Never stays dead.",
  power: "Raise pulls a skeleton out of the floor that walks to the nearest foe and claws them (two at a time). Legion raises four across the stage and blasts everyone near him with souls.",
  color: "#3dfcc4", color2: "#1d2238", color3: "#0c0e1c", accent: "#e9e4cf",
  weight: 0.88, speed: 4.0, accel: 0.8, jump: 12.4, airSpeed: 4.4, fallMul: 0.88,
  size: { w: 32, h: 58 }, hurt: 25,
  specialCooldown: 170,
  cpuSuperRange: 1200,
  cpuSpecial(f) { return Entities.list.filter(e => e.kind === "wraith_minion" && e.owner === f).length < 2; },

  light: { name: "Grave Touch", startup: 3, active: 3, recovery: 9,
    dmg: 3.6, base: 1.6, scale: 0.42, angle: 46, ox: 36, oy: -8, r: 22,
    vfx(f) {
      FX.blade(f.x + f.facing * 8, f.y - 8, faceAng(f) + 0.2 * f.facing, 20, 50, 0.7, f.ch.color, { w: 7, life: 9 });
      FX.spark(hbAt(f, this).x, f.y - 8, f.ch.color);
      Snd.tone(330, 0.06, "sine", 0.07, 160);
    } },

  heavy: { name: "Reaping Arc", startup: 14, active: 5, recovery: 27,
    dmg: 15, base: 4.6, scale: 1.04, angle: 40, ox: 48, oy: -10, r: 34,
    onStart() { Snd.whoosh(1.4); },
    vfx(f) {
      FX.blade(f.x, f.y - 20, faceAng(f) - 1.3 * f.facing, 46, 92, 2.3, f.ch.color, { w: 12, life: 16, spin: f.facing * 0.09 });
      FX.blade(f.x, f.y - 20, faceAng(f) - 1.2 * f.facing, 42, 86, 2.0, f.ch.accent, { w: 3, life: 12, core: false, spin: f.facing * 0.09 });
      FX.shake(6);
      Snd.tone(110, 0.2, "sawtooth", 0.12, 55);
    } },

  special: { name: "Raise", startup: 12, active: 2, recovery: 20,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "A skeleton claws out of the floor in front of him and walks to the nearest foe, swiping three times (3% each) before it falls apart. Two can be up at once; a third crumbles the oldest. Any hit shatters one.",
    tick(f, a) {
      if (a.t < a.data.startup) { if (a.t % 3 === 0) FX.spark(f.x + f.facing * 34 + rnd(-10, 10), f.feetY - rnd(0, 10), f.ch.color); return; }
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      const mine = Entities.list.filter(e => e.kind === "wraith_minion" && e.owner === f && !e.storm && e.life > 14);
      if (mine.length >= 2) { mine.sort((p, q) => p.life - q.life); mine[0].life = 14; }
      w3cRaise(f, f.x + f.facing * 34, f.feetY, false);
      FX.burst(f.x + f.facing * 34, f.feetY, 12, f.ch.color, 4);
      Snd.tone(150, 0.25, "sawtooth", 0.1, 300);
    } },

  super: { name: "Legion",
    desc: "A blast of souls hits everyone near him for 9%, and four fast skeletons rise across the stage and rush his foes — up to 12% more on each foe.",
    startup: 16, active: 6, recovery: 28,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0, radius: 150,
    blast: { name: "Soul Blast", dmg: 9, base: 4.2, scale: 0.8, angle: 60, unblockable: true },
    onStart(f) { Snd.superCharge(); FX.flash("#3dfcc4", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.7; f.vy *= 0.7; FX.spark(f.x + rnd(-40, 40), f.y + rnd(-50, 20), f.ch.color); return; }
      if (a.t !== m.startup) return;
      FX.banner("LEGION", f.ch.color);
      FX.ring(f.x, f.y, 20, m.radius, f.ch.color, 6);
      FX.burst(f.x, f.y, 40, f.ch.color, 10);
      FX.shake(16); Snd.superHit();
      for (const o of Combat.foes(f))
        if (!o.intangible() && dist(f.x, f.y, o.x, o.y) < m.radius + o.ch.hurt) Combat.land(f, o, m.blast, o.x, o.y);
      // four across the stage, sharing one hit log so they can't pile on
      const log = {}, half = Math.abs(Stage.def.layout[0].x2);
      for (let i = 0; i < 4; i++) {
        const x = Stage.pivot.x + (i - 1.5) * half * 0.58;
        const fl = Stage.floorBelow(x, Stage.pivot.y - 400);
        w3cRaise(f, x, fl === null ? Stage.pivot.y : fl, true, log);
        FX.burst(x, fl === null ? Stage.pivot.y : fl, 14, f.ch.color, 5);
      }
    } },

  /* ---- art: a floating robe with no legs, a skull in a deep hood with
           soulfire in the sockets, ribs showing through, and a scythe. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#c8d0e8" : c2, deep = A.flash ? "#a8b0d0" : c3;
    const bone = A.flash ? "#ffffff" : ac;
    const sw = swing(A, -10, 40), bob = Math.sin(A.time * 0.08) * 2;
    aura(g, 0, -4, 36, c, 0.16);
    g.save(); g.translate(0, bob);

    // soul wisps trailing off the hem
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {
      g.globalAlpha = 0.3 - i * 0.06; g.fillStyle = c;
      g.beginPath(); g.ellipse(Math.sin(A.time * 0.12 + i) * 5 - A.vx * i * 0.5, 18 + i * 4, 9 - i * 2, 3, 0, 0, 7); g.fill();
    }
    g.restore();

    // the robe, ragged at the bottom and open at the chest
    plate(g, [-11, -18, 11, -18, 14, 10, 9, 18, 4, 12, 0, 20, -5, 12, -10, 18, -14, 10], dark,
          { up: 0.2, down: 0.4, under: true });
    plate(g, [-5, -16, 5, -16, 3, 2, -3, 2], deep, { rim: false, ink: 2 });
    g.strokeStyle = bone; g.lineWidth = 1.4; g.lineCap = "round";
    g.beginPath(); g.moveTo(0, -15); g.lineTo(0, 1); g.stroke();
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-3.4, -12 + i * 4); g.quadraticCurveTo(0, -14 + i * 4, 3.4, -12 + i * 4); g.stroke(); }
    // a soulfire clasp at the throat
    lens(g, () => { g.beginPath(); g.arc(0, -17, 2.2, 0, 7); }, body, c, 10);

    // hood and skull
    g.save(); g.translate(1, -26);
    const hood = () => poly(g, [-10, 7, -11, -4, -4, -13, 5, -12, 11, -3, 10, 7]);
    ink(g, hood, vol(g, -13, 7, dark, 0.3, 0.4));
    rim(g, hood, "#ffffff", 3, 0.25);
    ink(g, () => { g.beginPath(); g.ellipse(1.5, 0, 6, 6.6, 0, 0, 7); }, vol(g, -7, 7, bone, 0.2, 0.35), 2);
    lens(g, () => { g.beginPath(); g.arc(4.2, -1, 1.8, 0, 7); }, body, c, 14);
    lens(g, () => { g.beginPath(); g.arc(-0.6, -1, 1.5, 0, 7); }, body, c, 10);
    g.fillStyle = INK; g.fillRect(0, 3.4, 6, 1.3);
    for (let i = 0; i < 3; i++) g.fillRect(1 + i * 2, 2.6, 0.7, 2.8);
    g.restore();

    // bony back arm
    jointLimb(g, -8, -13, -14, -1, -3, 3.6, bone);

    // scythe arm: long shaft, held diagonally, blade over the top
    const ax = 12 + sw * 0.8, ay = -6;
    jointLimb(g, 8, -13, (8 + ax) / 2, ay - 1, 2.5, 3.6, bone);
    g.save(); g.translate(ax, ay); g.rotate(A.atkPhase >= 0 ? 0.9 : 0.25);
    g.strokeStyle = INK; g.lineWidth = 4.6; g.lineCap = "round";
    g.beginPath(); g.moveTo(0, 24); g.lineTo(0, -30); g.stroke();
    g.strokeStyle = "#4a3a30"; g.lineWidth = 2.6; g.stroke();
    plate(g, [0, -30, -26, -24, -36, -12, -22, -20, 0, -25], mixColor(bone, c, 0.25), { up: 0.4, ink: 2.4, rimA: 0.5 });
    glow(g, c, 12, () => {
      g.strokeStyle = hexA(c, 0.8); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-2, -27); g.quadraticCurveTo(-20, -24, -33, -13); g.stroke();
    });
    g.restore();
    g.restore();
  },
},

/* ======================================================================== */
/* DRIFT — THE SKATER                                                        */
/* ======================================================================== */
{
  id: "DRIFT", name: "DRIFT", tag: "THE SKATER",
  blurb: "Doesn't stop. Can't stop. Won't stop. Hits harder the faster he goes.",
  power: "Momentum: he glides instead of stopping and keeps rolling through his own attacks, and every hit deals up to 40% more the faster he was moving. Kickflip boosts him and leaves a grind trail that burns.",
  color: "#2f6bff", color2: "#0e2466", color3: "#06112e", accent: "#ffe14d",
  weight: 0.86, speed: 5.6, accel: 0.62, jump: 12.4, airSpeed: 4.9, fallMul: 1.0,
  size: { w: 30, h: 52 }, hurt: 24,
  specialCooldown: 120,
  cpuSuperRange: 1200,
  cpuSpecial(f, t, d) { return Math.sign(t.x - f.x) === f.facing && d < 300; },

  light: { name: "Ollie Kick", startup: 3, active: 3, recovery: 9,
    dmg: 3.4, base: 1.6, scale: 0.42, angle: 40, ox: 34, oy: 4, r: 22,
    onStart(f) { w3cDriftStart(f, true); },
    tick(f) { w3cDriftGlide(f); },
    onHit(f, d) { w3cDriftHit(f, d, this); },
    vfx(f) {
      FX.blade(f.x + f.facing * 8, f.y + 4, faceAng(f) + 0.3 * f.facing, 20, 50, 0.8, f.ch.color, { w: 8, life: 9 });
      Snd.tone(900, 0.04, "square", 0.07, 600);
    } },

  heavy: { name: "Board Slam", startup: 13, active: 4, recovery: 26,
    dmg: 13.5, base: 4.4, scale: 1.04, angle: 45, ox: 40, oy: -4, r: 32,
    onStart(f) { w3cDriftStart(f, true); Snd.whoosh(1.2); },
    tick(f) { w3cDriftGlide(f); },
    onHit(f, d) { w3cDriftHit(f, d, this); },
    vfx(f) {
      const p = hbAt(f, this);
      FX.blade(f.x, f.y - 10, faceAng(f) - 1.2 * f.facing, 30, 74, 2.2, f.ch.color, { w: 13, life: 14, spin: f.facing * 0.1 });
      FX.ring(p.x, p.y, 8, 70, f.ch.accent, 3);
      FX.shake(6);
      Snd.tone(180, 0.14, "square", 0.12, 90);
    } },

  special: { name: "Kickflip", startup: 5, active: 16, recovery: 14,
    dmg: 5, base: 2.2, scale: 0.5, angle: 55, ox: 12, oy: 6, r: 26,
    desc: "Flips the board and boosts forward at full speed, hitting what he plows into (with the full +40% speed bonus). On the ground he lays a grind trail behind him that burns foes standing on it for 4% for the next two and a half seconds.",
    onStart(f) { w3cDriftStart(f, false); },
    onHit(f, d) { w3cDriftHit(f, d, this); },
    tick(f, a) {
      const m = a.data;
      if (a.t === m.startup) {
        f.vx = f.facing * 13; f.v.spd = 13;
        if (!f.grounded) f.vy = Math.min(f.vy, -4);
        else a.trail = Entities.add("drift_trail", f, { x: f.x, y: f.feetY, sx: f.x, w: 0, r: 8, life: 150,
          move: hitMove("Grind Trail", { dmg: 4, base: 2.8, scale: 0.3, angle: 80 }) });
        FX.burst(f.x, f.feetY, 10, f.ch.accent, 4);
        Snd.tone(600, 0.1, "square", 0.08, 1400);
      }
      if (a.t <= m.startup || a.t > m.startup + m.active) return;
      if (f.grounded) f.vx = f.facing * Math.max(Math.abs(f.vx), 12) / 0.86;
      const t = a.trail;
      if (t && t.life > 0 && f.grounded && Math.abs(f.feetY - t.y) < 6) {
        t.x = (t.sx + f.x) / 2; t.w = Math.abs(f.x - t.sx);
      } else a.trail = null;
    } },

  super: { name: "Halfpipe",
    desc: "The whole stage becomes a halfpipe: he carves one huge loop across it — along the floor, up the far side, over the top and back — hitting every foe he passes for 19%. He can't be touched while he rides it.",
    startup: 12, active: 60, recovery: 22,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    carve: { name: "Halfpipe", dmg: 19, base: 5.6, scale: 1.05, angle: 62, unblockable: true },
    onStart(f) { w3cDriftStart(f, false); Snd.superCharge(); FX.flash("#2f6bff", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.7; f.vy *= 0.7; return; }
      const P = Stage.pivot, rx = Math.abs(Stage.def.layout[0].x2) + 40, ry = 170;
      const cy = P.y - f.h * 0.5 - ry;
      if (a.t === m.startup) {
        FX.banner("HALFPIPE", f.ch.color);
        a.dir = f.facing; a.log = {}; a.x0 = f.x; a.y0 = f.y;
        a.ph0 = Math.asin(clamp((f.x - P.x) / rx, -1, 1));
        Snd.whoosh(2);
      }
      const s = (a.t - m.startup) / m.active;
      if (s > 1) {
        if (a.t === m.startup + m.active + 1) { f.vx = a.dir * 7; f.v.hpa = 0; }
        return;
      }
      // one full revolution of an ellipse whose bottom is the main deck
      const ph = a.ph0 + a.dir * s * Math.PI * 2;
      const k = Math.min(1, (a.t - m.startup) / 8);          // ease in from wherever he was
      f.x = lerp(a.x0, P.x + rx * Math.sin(ph), k);
      f.y = lerp(a.y0, cy + ry * Math.cos(ph), k);
      f.vx = 0; f.vy = 0; f.facing = a.dir;
      f.invuln = Math.max(f.invuln, 3);
      const tx = rx * Math.cos(ph) * a.dir, ty = -ry * Math.sin(ph) * a.dir;
      f.v.hpa = Math.round(Math.atan2(ty, tx * a.dir) * 100) / 100;   // board angle, in his flipped space
      FX.spark(f.x, f.y + 20, f.ch.accent);
      if (a.t % 3 === 0) FX.blade(f.x, f.y, Math.atan2(ty, tx), 10, 40, 0.4, f.ch.color, { w: 8, life: 8 });
      for (const o of Combat.foes(f)) {
        if (a.log[o.slot] || o.intangible() || dist(f.x, f.y, o.x, o.y) > o.ch.hurt + 40) continue;
        a.log[o.slot] = 1;
        Combat.land(f, o, m.carve, o.x, o.y);
      }
    } },

  /* ---- art: a skater in a hoodie and beanie, knees bent over a board with
           a kicked-up tail. The board flips on Kickflip, and the whole rider
           rotates around the loop on Halfpipe. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#c8d6ff" : c2, deep = A.flash ? "#a8baff" : c3;
    const v = A.v || {};
    const sw = swing(A, -8, 40);
    g.save();
    if (A.atkKind === "super" && v.hpa) g.rotate(v.hpa);
    aura(g, 0, -2, 30, c, 0.14);

    // the board: deck, kicked tail, two wheels; it spins on Kickflip
    g.save(); g.translate(0, 28);
    if (A.atkKind === "special" && A.atkT < 14) g.rotate(A.atkT * 0.9);
    plate(g, [-18, -2, 14, -2, 19, -6, 20, -3, 15, 2, -17, 2, -22, -1, -21, -4], ac, { up: 0.3, ink: 2.2, rimA: 0.4 });
    g.fillStyle = INK; g.fillRect(-14, -1.2, 26, 1.2);
    for (const wx of [-11, 10]) ink(g, () => { g.beginPath(); g.arc(wx, 4, 2.8, 0, 7); }, "#ff5a8a", 1.8);
    g.restore();

    // legs in a skate stance: front foot forward, knees bent with speed
    const crouch = clamp(Math.abs(A.vx) * 0.6, 0, 5);
    const bob = A.running ? Math.sin(A.runPhase) * 1.5 : 0;
    jointLimb(g, -4, 8, -10, 25, -5 - crouch, 6, dark);
    jointLimb(g, 5, 8, 10, 25, 5 + crouch, 6, dark);
    plateRect(g, -15, 22, 10, 5, 2, "#ffffff", { up: 0.1 });
    plateRect(g, 6, 22, 10, 5, 2, "#ffffff", { up: 0.1 });

    // hoodie with a front pocket and drawstrings
    g.save(); g.translate(0, crouch * 0.5 + bob);
    plate(g, [-10, -15, 10, -15, 12, 10, -12, 10], body, { up: 0.3, down: 0.36, under: true });
    plate(g, [-6, 0, 6, 0, 7, 7, -7, 7], dark, { ink: 1.8, rim: false });
    g.strokeStyle = ac; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-2, -13); g.lineTo(-2, -6); g.moveTo(3, -13); g.lineTo(3, -6); g.stroke();
    plate(g, [-10, -15, -4, -19, 4, -19, 10, -15, 4, -13, -4, -13], dark, { ink: 2, up: 0.3 });   // hood down

    // head: a beanie with a pom, hair poking out, a plaster on the cheek
    g.save(); g.translate(1, -25);
    ink(g, () => { g.beginPath(); g.ellipse(0, 0, 6.6, 7.2, 0, 0, 7); }, vol(g, -8, 8, "#e8b98d", 0.2, 0.3));
    g.fillStyle = INK; g.fillRect(2, -1, 4, 1.8);
    g.fillStyle = "#fff2d0"; g.fillRect(-1, 2, 4, 2.2);
    plate(g, [-7, -2, -8, -8, -3, -12, 4, -12, 8, -6, 7, -2], ac, { up: 0.3, ink: 2 });
    g.fillStyle = INK; g.fillRect(-7, -3.4, 15, 1.6);
    ink(g, () => { g.beginPath(); g.arc(-5, -13, 3, 0, 7); }, ac, 1.8);
    plate(g, [-8, -2, -11, 3, -6, 0], "#3a2416", { ink: 1.6, rim: false });
    g.restore();

    // arms out for balance: the back one trails, the front one strikes
    jointLimb(g, -8, -11, -18 - crouch, -4, 3, 4.6, body);
    const ax = 13 + sw, ay = -6 - (A.atkPhase >= 0 ? 0 : crouch);
    jointLimb(g, 8, -11, (8 + ax) / 2, ay - 2, 2.5, 4.6, body);
    ink(g, () => { g.beginPath(); g.arc(ax, ay, 3, 0, 7); }, "#e8b98d", 2);
    g.restore();
    g.restore();
  },
},

/* ======================================================================== */
/* QUILL — THE PORCUPINE                                                     */
/* ======================================================================== */
{
  id: "QUILL", name: "QUILL", tag: "THE PORCUPINE",
  blurb: "Every step near him is a bad step. Every poke at him hurts you too.",
  power: "Caltrops scatter spikes that sit on the floor and trip whoever steps on them (up to six down at once). Needle Storm rains quills across the stage. Hitting him with a light attack costs you 1%.",
  color: "#c07a42", color2: "#4a2c16", color3: "#21130a", accent: "#fff1d6",
  weight: 1.1, speed: 3.9, accel: 0.8, jump: 11.9, airSpeed: 3.9, fallMul: 1.05,
  size: { w: 40, h: 50 }, hurt: 27,
  specialCooldown: 150,
  cpuSuperRange: 1200,
  cpuSpecial(f, t, d) { return f.grounded && d > 100 && d < 350; },

  light: { name: "Quill Jab", startup: 4, active: 3, recovery: 10,
    dmg: 3.8, base: 1.8, scale: 0.44, angle: 44, ox: 36, oy: -2, r: 22,
    onStart(f) { w3cWatch(f, "quill_bristle"); },
    vfx(f) {
      FX.blade(f.x + f.facing * 10, f.y - 2, faceAng(f), 26, 56, 0.16, f.ch.accent, { w: 10, life: 8 });
      Snd.tone(1500, 0.04, "square", 0.06, 2000);
    } },

  heavy: { name: "Bristle Burst", startup: 14, active: 5, recovery: 26,
    dmg: 15, base: 4.6, scale: 1.04, angle: 58, ox: 0, oy: -4, r: 46,
    onStart(f) { w3cWatch(f, "quill_bristle"); Snd.tone(300, 0.2, "sawtooth", 0.08, 600); },
    vfx(f) {
      // every quill on his back stands up at once
      for (let i = 0; i < 12; i++)
        FX.blade(f.x, f.y - 4, i / 12 * Math.PI * 2, 18, 60, 0.05, i % 2 ? f.ch.accent : f.ch.color, { w: 4, life: 12 });
      FX.ring(f.x, f.y, 10, 76, f.ch.accent, 3);
      FX.shake(6);
      Snd.noise(0.2, 0.14, 3000, 1.4, "bandpass");
    } },

  special: { name: "Caltrops", startup: 10, active: 2, recovery: 18,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Scatters three spikes ahead of him. They stay on the floor for five seconds; a foe who steps on one is tripped (3%, popped up) and the spike is used up. Six can be down at once — more retires the oldest.",
    onStart(f) { w3cWatch(f, "quill_bristle"); },
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      const mine = Entities.list.filter(e => e.kind === "quill_spike" && e.owner === f && e.life > 1)
                                .sort((p, q) => p.life - q.life);
      for (let i = 0; i < mine.length - 3; i++) mine[i].life = 1;
      for (let i = 0; i < 3; i++)
        Entities.add("quill_spike", f, { x: f.x + f.facing * 16, y: f.y - 10,
          vx: f.facing * (2.5 + i * 2.6), vy: -5 - i * 0.8, r: 9, life: 330,
          move: hitMove("Caltrops", { dmg: 3, base: 3.4, scale: 0.25, angle: 84, unblockable: true,
            onHit(o, d) { FX.damageText(d.x, d.y - 50, "TRIPPED", o.ch.accent); } }) });
      Snd.noise(0.12, 0.1, 2600, 1.2, "bandpass");
    } },

  super: { name: "Needle Storm",
    desc: "A cloud rolls over the stage and rains quills for two seconds — half of them fall right on top of his foes (2.8% a needle, up to nine per foe). Keep moving or take all of it.",
    startup: 14, active: 6, recovery: 20,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    needle: { name: "Needle Storm", dmg: 2.8, base: 1.3, scale: 0.14, angle: 70, unblockable: true },
    onStart(f) { w3cWatch(f, "quill_bristle"); Snd.superCharge(); FX.flash("#c07a42", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t !== m.startup) { if (a.t < m.startup) f.vx *= 0.7; return; }
      FX.banner("NEEDLE STORM", f.ch.color);
      FX.shake(10); Snd.superHit();
      Entities.add("quill_storm", f, { x: Stage.pivot.x, y: Stage.pivot.y - 440, r: 0, life: 120,
        w: Math.abs(Stage.def.layout[0].x2) + 80, log: {}, move: m.needle });
    } },

  /* ---- art: a round, low porcupine. A fan of cream quills with dark tips
           over the back (they stand up on Bristle Burst), a pointed snout, a
           pale belly and stubby clawed feet. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#f0d8c0" : c2, deep = A.flash ? "#e0c0a0" : c3;
    const sw = swing(A, -6, 30);
    const flare = A.atkKind === "heavy" ? 1.45 : A.atkKind === "super" ? 1.25 : 1;
    aura(g, 0, -2, 34, c, 0.12);

    // the quills: a fan over the back half, each one an inked spike
    const n = 13;
    for (let i = 0; i < n; i++) {
      const an = Math.PI * (0.62 + i / (n - 1) * 0.95) + Math.sin(A.time * 0.07 + i) * 0.03;
      const len = (16 + (i % 3) * 5) * flare, bx = -3 + Math.cos(an) * 12, by = -2 + Math.sin(an) * 11;
      const tx = bx + Math.cos(an) * len, ty = by + Math.sin(an) * len;
      const px = -Math.sin(an) * 2.6, py = Math.cos(an) * 2.6;
      plate(g, [bx - px, by - py, bx + px, by + py, tx, ty], i % 2 ? ac : mixColor(ac, c, 0.3), { ink: 1.8, rim: false });
      g.fillStyle = INK; poly(g, [lerp(bx, tx, 0.75) - px * 0.3, lerp(by, ty, 0.75) - py * 0.3,
                                  lerp(bx, tx, 0.75) + px * 0.3, lerp(by, ty, 0.75) + py * 0.3, tx, ty]); g.fill();
    }

    const st = Math.sin(A.runPhase) * (A.running ? 7 : 0);
    jointLimb(g, -8, 10, -10 + st, 23, -2, 6.5, dark);
    jointLimb(g, 8, 10, 10 - st, 23, 2, 6.5, dark);
    for (const x of [-10 + st, 10 - st]) {
      plateRect(g, x - 6, 21, 12, 4.4, 2, deep, { up: 0.2, rim: false });
      g.fillStyle = ac; for (let k = 0; k < 3; k++) g.fillRect(x + 1 + k * 2, 24, 1.2, 2);
    }

    // round body, pale belly
    const torso = () => { g.beginPath(); g.ellipse(0, 0, 18, 15, 0, 0, 7); };
    ink(g, torso, vol(g, -15, 15, body, 0.3, 0.4));
    rim(g, torso, "#ffffff", 3, 0.35);
    ink(g, () => { g.beginPath(); g.ellipse(6, 4, 9, 9, 0, 0, 7); }, vol(g, -5, 13, "#f3dcc0", 0.2, 0.3), 1.8);

    // head: low and forward, a pointed snout with a wet nose, round ear
    g.save(); g.translate(13, -10);
    ink(g, () => { g.beginPath(); g.arc(-5, -6, 3.4, 0, 7); }, dark, 1.8);
    plate(g, [-8, -6, 2, -9, 13, -1, 12, 3, 2, 5, -7, 4], body, { up: 0.35, ink: 2.4, rimA: 0.4 });
    ink(g, () => { g.beginPath(); g.arc(12.5, 0.5, 2.2, 0, 7); }, INK, 0);
    lens(g, () => { g.beginPath(); g.arc(3, -3, 1.7, 0, 7); }, "#1a0f08", "#ffffff", 0);
    g.fillStyle = "#ffffff"; g.fillRect(3.2, -4, 1, 1);
    g.restore();

    // paw: a short jab with three claws
    const ax = 16 + sw, ay = 4;
    limb(g, 10, 2, ax, ay, 5.4, dark);
    g.strokeStyle = ac; g.lineWidth = 1.4; g.lineCap = "round";
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(ax + 1, ay + k * 1.8); g.lineTo(ax + 5, ay + k * 2.4); g.stroke(); }
  },
},
];

WAVE3C.forEach(c => { CHAR_BY_ID[c.id] = c; });
ROSTER.push(...WAVE3C);
