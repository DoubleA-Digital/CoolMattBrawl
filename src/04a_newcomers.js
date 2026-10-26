/* ==========================================================================
   5a. NEWCOMERS — nine fighters, each built on a mechanic nobody else has

     RIME    freezing        chill slows; a freeze is shattered by the next hit
     HEX     curses          cursed foes fly further; Doom calls lightning
     SHADE   stealth         fades out; the first hit from hiding is an ambush
     VEX     lifesteal       every hit heals her; Siphon drains a foe directly
     FUSE    explosives      sticky bombs and a countdown Payload (replaces Ballast)
     RICO    ricochet        a disc that hits going out and coming back
     SPROUT  healing/roots   a flower that heals her; roots every grounded foe
     ECHO    time            Recall rewinds her; Deja Vu makes damage land twice
     TEMPO   rhythm          hits on the music's beat pay more; waves break shields

   Their numbers sit inside the original roster's ranges: lights 3-5%, heavies
   13-17%, supers worth roughly 18-26% when they fully land. The status effects
   live on Fighter (07_fighter.js) and the things they spawn in 08a_kinds.js.
   ========================================================================== */

/** A move object for an entity's hit, named so stale-move tracking works. */
function hitMove(name, o) { return Object.assign({ name, base: 2, scale: 0.5, angle: 45 }, o); }

const NEWCOMERS = [

/* ======================================================================== */
/* RIME — THE FROSTBITE                                                      */
/* ======================================================================== */
{
  id: "RIME", name: "RIME", tag: "THE FROSTBITE",
  blurb: "A walking cold front. Slows you down, then stops you dead.",
  power: "Her hits chill (you move and jump slower). Absolute Zero freezes foes solid — the next hit shatters them for bonus damage.",
  color: "#a8e4ff", color2: "#1d4b66", color3: "#0b2233", accent: "#f2fbff",
  weight: 1.0, speed: 4.5, accel: 0.86, jump: 12.2, airSpeed: 4.2, fallMul: 1.0,
  size: { w: 34, h: 56 }, hurt: 26,
  specialCooldown: 85,

  light: { name: "Rime Jab", startup: 3, active: 3, recovery: 9,
    dmg: 4.2, base: 1.9, scale: 0.46, angle: 44, ox: 38, oy: -8, r: 23,
    onHit(f, d) { d.slowT = Math.max(d.slowT, 45); },
    vfx(f) {
      FX.blade(f.x + f.facing * 10, f.y - 8, faceAng(f), 24, 56, 0.4, f.ch.color, { w: 9, life: 10 });
      FX.spark(hbAt(f, this).x, f.y - 8, f.ch.accent);
      Snd.tone(1800, 0.04, "triangle", 0.07, 2600);
    } },

  heavy: { name: "Glacier Spike", startup: 13, active: 4, recovery: 26,
    dmg: 15.5, base: 4.7, scale: 1.06, angle: 58, ox: 46, oy: 0, r: 32,
    onHit(f, d) { d.slowT = Math.max(d.slowT, 90); },
    onStart() { Snd.whoosh(1.3); },
    vfx(f) {
      const p = hbAt(f, this);
      // a spike of ice punching up out of the floor in front of her
      for (let i = 0; i < 3; i++)
        FX.blade(p.x + f.facing * (i - 1) * 14, p.y + 22, -Math.PI / 2 + (i - 1) * 0.25, 10, 60 - i * 8, 0.18,
                 i === 1 ? "#ffffff" : f.ch.color, { w: 14 - i * 3, life: 16 });
      FX.burst(p.x, p.y + 16, 12, "#d4f1ff", 5);
      FX.shake(6);
      Snd.tone(2200, 0.12, "triangle", 0.1, 900);
    } },

  special: { name: "Ice Lance", startup: 9, active: 2, recovery: 18,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Fires a lance of ice straight ahead. Whoever it hits is chilled for 2.5 seconds — slower on the ground and in the air.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      Entities.add("ice", f, { x: f.x + f.facing * 26, y: f.y - 8, vx: f.facing * 12, dir: f.facing,
        r: 13, life: 70, move: hitMove("Ice Lance", { dmg: 6.5, base: 2.4, scale: 0.45, angle: 30,
          onHit(o, d) { d.slowT = Math.max(d.slowT, 150); } }) });
      Snd.tone(2400, 0.1, "triangle", 0.1, 1400);
    } },

  super: { name: "Absolute Zero",
    desc: "A burst of cold around her deals 10% and freezes every foe in range solid for almost two seconds. The next hit on a frozen foe shatters the ice for +7% and extra knockback.",
    startup: 18, active: 6, recovery: 30,
    dmg: 10, base: 1.2, scale: 0.1, angle: 85, kbMul: 0.4, ox: 0, oy: 0, r: 0, radius: 230,
    onStart(f) { Snd.superCharge(); FX.flash("#a8e4ff", 0.35); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.7; f.vy *= 0.7; FX.spark(f.x + rnd(-40, 40), f.y + rnd(-40, 30), "#ffffff"); return; }
      if (a.t !== m.startup) return;
      FX.banner("ABSOLUTE ZERO", f.ch.color);
      FX.ring(f.x, f.y, 20, m.radius, "#ffffff", 6);
      FX.ring(f.x, f.y, 10, m.radius * 0.8, f.ch.color, 4);
      FX.burst(f.x, f.y, 50, "#d4f1ff", 12);
      FX.shake(22); Snd.superHit();
      for (const o of Combat.foes(f)) {
        if (o.intangible() || dist(f.x, f.y, o.x, o.y) > m.radius) continue;
        Combat.land(f, o, m, o.x, o.y);
        if (o.state === ST.HITSTUN) { o.frozenT = 100; o.vx *= 0.2; }
      }
    } },

  /* ---- art: a cloaked figure of cut ice. A crown of three icicles, a
           smooth mask with one cold slit, and a hem that breaks into shards. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#e6f6ff" : c2, deep = A.flash ? "#cfeaff" : c3;
    const sw = swing(A, -10, 44);
    aura(g, 0, -4, 36, c, 0.16);

    // legs, mostly hidden by the cloak
    const st = Math.sin(A.runPhase) * (A.running ? 10 : 0);
    jointLimb(g, -5, 12, -8 + st, 26, -3, 5.5, deep);
    jointLimb(g, 5, 12, 9 - st, 26, 3, 5.5, deep);
    plateRect(g, -13 + st, 24, 10, 5, 2, dark, { up: 0.2 });
    plateRect(g, 4 - st, 24, 10, 5, 2, dark, { up: 0.2 });

    // the cloak: a long trapezoid whose hem breaks into shards
    plate(g, [-11, -16, 11, -16, 16, 16, -16, 16], dark, { up: 0.2, down: 0.4 });
    for (let i = 0; i < 6; i++) {
      const x0 = -16 + i * 5.4;
      plate(g, [x0, 15, x0 + 5.4, 15, x0 + 2.7, 22 + (i % 2) * 4], i % 2 ? deep : dark, { ink: 1.8, rimA: 0.3 });
    }
    // chest: a faceted breastplate of ice
    plate(g, [-9, -15, 9, -15, 7, 4, 0, 9, -7, 4], body, { up: 0.4, down: 0.3, under: true });
    g.fillStyle = hexA("#ffffff", 0.4); poly(g, [-9, -15, -1, -15, -4, 2]); g.fill();
    // shoulder shards
    plate(g, [-9, -16, -18, -24, -14, -10], body, { up: 0.5, ink: 2.4 });
    plate(g, [9, -16, 19, -25, 14, -10], body, { up: 0.5, ink: 2.4 });

    // head: smooth mask, one cold slit, a crown of icicles
    g.save(); g.translate(0, -26);
    ink(g, () => { g.beginPath(); g.ellipse(0, 0, 8, 9, 0, 0, 7); }, vol(g, -9, 9, body, 0.4, 0.3));
    rim(g, () => { g.beginPath(); g.ellipse(0, 0, 8, 9, 0, 0, 7); }, "#ffffff", 3, 0.6);
    lens(g, () => roundRect(g, -1, -2, 9, 2.6, 1.2), A.flash ? c : "#ffffff", c, 14);
    for (const [x, h] of [[-5, 9], [0, 14], [5, 9]])
      plate(g, [x - 2.6, -7, x + 2.6, -7, x, -7 - h], "#ffffff", { ink: 1.8, rimA: 0.2, up: 0.1 });
    g.restore();

    // back arm under the cloak
    jointLimb(g, -8, -12, -14, 2, -3, 4.6, deep);

    // spear arm: a long thin crystal held forward
    const ax = 14 + sw, ay = -6;
    jointLimb(g, 8, -12, (8 + ax) / 2, ay - 1, 2.5, 5, dark);
    limb(g, (8 + ax) / 2, ay - 1, ax - 2, ay, 6, mid_(c, c2));
    g.save(); g.translate(ax, ay); g.rotate(A.atkPhase >= 0 ? -0.05 : -0.4);
    g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = "round";
    g.beginPath(); g.moveTo(-14, 0); g.lineTo(24, 0); g.stroke();
    g.strokeStyle = mid_(c, c2); g.lineWidth = 2.2; g.stroke();
    plate(g, [22, -5, 36, 0, 22, 5, 25, 0], "#ffffff", { ink: 2, rimA: 0.3 });
    glow(g, c, 12, () => { g.fillStyle = hexA(c, 0.7); poly(g, [24, -2, 33, 0, 24, 2]); g.fill(); });
    g.restore();
  },
},

/* ======================================================================== */
/* HEX — THE WITCH                                                           */
/* ======================================================================== */
{
  id: "HEX", name: "HEX", tag: "THE WITCH",
  blurb: "Doesn't hit the hardest — just makes everything else hit harder.",
  power: "Hex Bolt curses a foe: for 5 seconds every hit sends them 22% further. Doom curses everyone, then calls lightning down on each of them.",
  color: "#e040fb", color2: "#4a0e57", color3: "#22052a", accent: "#fbd4ff",
  weight: 0.86, speed: 4.1, accel: 0.85, jump: 12.6, airSpeed: 4.6, fallMul: 0.85,
  size: { w: 32, h: 56 }, hurt: 25,
  specialCooldown: 230,

  light: { name: "Hexing Flick", startup: 3, active: 3, recovery: 9,
    dmg: 3.4, base: 1.6, scale: 0.42, angle: 48, ox: 36, oy: -10, r: 22,
    vfx(f) {
      FX.blade(f.x + f.facing * 8, f.y - 10, faceAng(f) - 0.3 * f.facing, 22, 52, 0.9, f.ch.color, { w: 6, life: 10 });
      FX.spark(hbAt(f, this).x, f.y - 10, f.ch.accent);
      Snd.tone(1300, 0.05, "sine", 0.07, 700);
    } },

  heavy: { name: "Cauldron Burst", startup: 14, active: 5, recovery: 26,
    dmg: 14, base: 4.4, scale: 1.02, angle: 72, ox: 34, oy: -4, r: 34,
    onStart() { Snd.whoosh(1.2); },
    vfx(f) {
      const p = hbAt(f, this);
      FX.ring(p.x, p.y + 10, 8, 70, f.ch.color, 3);
      for (let i = 0; i < 5; i++)
        FX.blade(p.x + rnd(-12, 12), p.y + 18, -Math.PI / 2 + rnd(-0.3, 0.3), 8, 60, 0.2, i % 2 ? f.ch.accent : f.ch.color, { w: 8, life: 14 });
      FX.burst(p.x, p.y, 14, f.ch.color, 5);
      FX.shake(5);
      Snd.tone(220, 0.16, "sawtooth", 0.12, 660);
    } },

  special: { name: "Hex Bolt", startup: 10, active: 2, recovery: 20,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "A slow bolt that bends toward the nearest foe. A hit curses them for five seconds: everything sends them 22% further.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      Entities.add("hex", f, { x: f.x + f.facing * 24, y: f.y - 14, vx: f.facing * 6.5, vy: 0,
        r: 12, life: 110, move: hitMove("Hex Bolt", { dmg: 4, base: 1.4, scale: 0.3, angle: 50,
          onHit(o, d) { d.curseT = Math.max(d.curseT, 300); FX.damageText(d.x, d.y - 50, "CURSED", o.ch.accent); } }) });
      Snd.tone(500, 0.18, "sine", 0.1, 1500);
    } },

  super: { name: "Doom",
    desc: "Curses every foe at once, and a second later lightning strikes each one for 15%. Cursed, that strike sends them a long way.",
    startup: 16, active: 8, recovery: 30,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    bolt: { name: "Doom", dmg: 15, base: 5.0, scale: 1.0, angle: 82, unblockable: true },
    onStart(f) { Snd.superCharge(); FX.flash("#e040fb", 0.32); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.8; f.vy *= 0.8; FX.spark(f.x + rnd(-30, 30), f.y + rnd(-50, 20), f.ch.color); return; }
      if (a.t !== m.startup) return;
      FX.banner("DOOM", f.ch.color);
      FX.shake(12);
      for (const o of Combat.foes(f)) {
        o.curseT = Math.max(o.curseT, 360);
        Entities.add("doom", f, { tgt: o, x: o.x, y: o.y, life: 60, r: 0, move: m.bolt });
        FX.streak(f.x, f.y - 30, o.x, o.y - 60, f.ch.accent);
      }
    } },

  /* ---- art: a witch in a crooked hat. Robe, glowing eyes under the brim,
           a staff with an eye in it, and a sigil that orbits her. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#f3c8ff" : c2, deep = A.flash ? "#e8a8ff" : c3;
    const sw = swing(A, -8, 40);
    aura(g, 0, -10, 34, c, 0.18);

    // the orbiting sigil, behind her
    g.save(); g.globalCompositeOperation = "lighter";
    const an = A.time * 0.05;
    g.strokeStyle = hexA(ac, 0.45); g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(0, -2, 26, 8, 0.2, 0, 7); g.stroke();
    g.fillStyle = ac; g.shadowColor = c; g.shadowBlur = 10;
    g.beginPath(); g.arc(Math.cos(an) * 26, -2 + Math.sin(an) * 8, 2.4, 0, 7); g.fill();
    g.restore();

    // robe: a bell to the floor, legs barely showing
    const st = Math.sin(A.runPhase) * (A.running ? 8 : 0);
    plateRect(g, -10 + st, 22, 9, 6, 2, deep, { up: 0.2 });
    plateRect(g, 2 - st, 22, 9, 6, 2, deep, { up: 0.2 });
    plate(g, [-8, -14, 8, -14, 15, 24, -15, 24], dark, { up: 0.2, down: 0.4, under: true });
    plate(g, [-5, -12, 5, -12, 8, 22, -8, 22], body, { up: 0.3, down: 0.4, rimA: 0.35 });
    // sash and stitched hem
    plate(g, [-9, 2, 10, 0, 10, 5, -9, 7], deep, { ink: 2, rim: false });
    g.strokeStyle = hexA(ac, 0.4); g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-13 + i * 5, 23); g.lineTo(-11 + i * 5, 20); g.stroke(); }

    // head: a face in shadow, two glowing eyes
    g.save(); g.translate(0, -22);
    ink(g, () => { g.beginPath(); g.ellipse(0, 0, 7, 7.5, 0, 0, 7); }, deep);
    lens(g, () => { g.beginPath(); g.ellipse(2, 0, 1.6, 2.2, 0, 0, 7); }, ac, c, 12);
    lens(g, () => { g.beginPath(); g.ellipse(6, 0.5, 1.4, 2, 0, 0, 7); }, ac, c, 12);
    // the hat: wide brim, tall crooked cone with a band and buckle
    plate(g, [-15, -5, 16, -6, 12, -2, -12, -1], dark, { up: 0.3, ink: 2.4 });
    const tip = Math.sin(A.time * 0.05) * 2;
    plate(g, [-8, -5, 9, -5, 4, -16, -6 + tip, -28, -2, -17], body, { up: 0.4, down: 0.3 });
    plate(g, [-8, -5, 9, -5, 8, -8.5, -7, -8.5], deep, { ink: 2, rim: false });
    g.fillStyle = "#ffe14d"; g.fillRect(-1.5, -8.5, 4, 3.6);
    g.restore();

    // back arm
    jointLimb(g, -7, -10, -13, 0, -3, 4.6, dark);

    // staff arm: the staff stands upright, with an eye in a crescent
    const ax = 13 + sw * 0.8, ay = -4;
    jointLimb(g, 7, -10, (7 + ax) / 2, ay - 1, 2.5, 5, dark);
    limb(g, (7 + ax) / 2, ay - 1, ax - 1, ay, 6, mid_(c, c2));
    g.save(); g.translate(ax, ay); g.rotate(A.atkPhase >= 0 ? 0.5 : 0.1);
    g.strokeStyle = INK; g.lineWidth = 4.4; g.lineCap = "round";
    g.beginPath(); g.moveTo(0, 22); g.lineTo(0, -26); g.stroke();
    g.strokeStyle = "#7a4a2a"; g.lineWidth = 2.4; g.stroke();
    g.translate(0, -30);
    g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.arc(0, 0, 7, 0.4, Math.PI * 2 - 0.4); g.stroke();
    g.strokeStyle = body; g.lineWidth = 2.2; g.stroke();
    lens(g, () => { g.beginPath(); g.arc(0, 0, 3.4, 0, 7); }, ac, c, A.atkPhase >= 0 ? 20 : 10);
    g.restore();
  },
},

/* ======================================================================== */
/* SHADE — THE PHANTOM                                                       */
/* ======================================================================== */
{
  id: "SHADE", name: "SHADE", tag: "THE PHANTOM",
  blurb: "You won't see it coming. That's the whole idea.",
  power: "Fade turns her nearly invisible and quicker; her first hit out of hiding is an AMBUSH for +35% damage and extra knockback.",
  color: "#5b6cff", color2: "#141a52", color3: "#080b26", accent: "#dfe3ff",
  weight: 0.8, speed: 5.0, accel: 1.0, jump: 12.8, airSpeed: 4.8, fallMul: 0.95,
  size: { w: 30, h: 52 }, hurt: 24,
  specialCooldown: 420,

  light: { name: "Shadow Cut", startup: 3, active: 3, recovery: 9,
    dmg: 3.6, base: 1.6, scale: 0.42, angle: 42, ox: 36, oy: -8, r: 22,
    vfx(f) {
      FX.blade(f.x + f.facing * 8, f.y - 8, faceAng(f) + 0.2 * f.facing, 22, 54, 0.7, f.ch.color, { w: 8, life: 9 });
      Snd.noise(0.05, 0.07, 3200, 1.1, "bandpass");
    } },

  heavy: { name: "Umbral Reap", startup: 13, active: 4, recovery: 27,
    dmg: 14, base: 4.2, scale: 1.04, angle: 36, ox: 50, oy: -6, r: 30,
    onStart() { Snd.whoosh(1.3); },
    vfx(f) {
      FX.blade(f.x, f.y - 6, faceAng(f) - 1.1 * f.facing, 44, 86, 2.0, f.ch.color, { w: 14, life: 16, spin: f.facing * 0.08 });
      FX.blade(f.x, f.y - 6, faceAng(f) - 1.0 * f.facing, 40, 80, 1.7, f.ch.accent, { w: 4, life: 11, core: false, spin: f.facing * 0.08 });
      FX.shake(5);
      Snd.tone(160, 0.18, "sawtooth", 0.12, 80);
    } },

  special: { name: "Fade", startup: 6, active: 4, recovery: 10,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Melts into the dark for two and a half seconds: almost invisible and 15% faster. Her first attack out of it is an AMBUSH (+35% damage, more knockback). Getting hit ends it.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      f.stealthT = 150;
      FX.burst(f.x, f.y, 18, f.ch.color2, 4);
      FX.ring(f.x, f.y, 8, 70, f.ch.color, 2);
      Snd.noise(0.4, 0.14, 600, 0.8, "lowpass");
    } },

  super: { name: "Nightfall",
    desc: "The lights go out for everyone. In the dark she blinks behind each foe in turn and strikes — three strikes, the last one a launcher.",
    startup: 14, active: 62, recovery: 30,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    strike: { name: "Nightfall", dmg: 6, base: 2.4, scale: 0.5, angle: 60 },
    finale: { name: "Nightfall", dmg: 9, base: 4.4, scale: 0.98, angle: 40 },
    onStart(f) { Snd.superCharge(); FX.flash("#000000", 0.5); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.7; f.vy *= 0.7; return; }
      if (a.t === m.startup) {
        FX.banner("NIGHTFALL", f.ch.color);
        if (Match.current) Match.current.darkT = 170;
      }
      const s = a.t - m.startup;
      f.vx = 0; f.vy = 0;
      if (s % 22 !== 0 || s > 44) return;
      const foes = Combat.foes(f).filter(o => !o.intangible());
      if (!foes.length) return;
      const t = foes[(s / 22) % foes.length];
      // blink behind them
      FX.burst(f.x, f.y, 10, f.ch.color2, 4);
      f.x = t.x - t.facing * 38; f.y = t.y; f.facing = t.x >= f.x ? 1 : -1;
      f.invuln = Math.max(f.invuln, 6);
      FX.streak(f.x, f.y, t.x, t.y, f.ch.accent);
      FX.blade(t.x, t.y, faceAng(f), 20, 60, 1.6, f.ch.color, { w: 10, life: 10 });
      Combat.land(f, t, s === 44 ? m.finale : m.strike, t.x, t.y);
      Snd.tone(300 + s * 8, 0.08, "square", 0.12, 120);
    } },

  /* ---- art: a ragged hood with nothing in it but two eyes, a body that
           thins to smoke instead of legs, and a curved blade. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#c9d0ff" : c2, deep = A.flash ? "#aab4ff" : c3;
    const sw = swing(A, -10, 42);
    aura(g, 0, -4, 34, c, 0.14);

    // smoke where the legs would be
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const yy = 10 + i * 4, ww = 12 - i * 2 + Math.sin(A.time * 0.15 + i) * 2;
      g.globalAlpha = 0.35 - i * 0.06;
      g.fillStyle = c;
      g.beginPath(); g.ellipse(Math.sin(A.time * 0.1 + i) * 3 - A.vx * i * 0.4, yy, ww, 3, 0, 0, 7); g.fill();
    }
    g.restore();

    // the cloak, tattered at the bottom
    plate(g, [-10, -18, 10, -18, 13, 6, 8, 12, 4, 7, 0, 14, -4, 8, -8, 13, -13, 6], dark,
          { up: 0.2, down: 0.4, under: true });
    plate(g, [-6, -16, 6, -16, 8, 2, -8, 2], deep, { up: 0.1, rimA: 0.2 });

    // the hood, and nothing in it but eyes
    g.save(); g.translate(1, -24);
    const hood = () => poly(g, [-9, 6, -10, -4, -4, -12, 4, -12, 10, -3, 10, 6]);
    ink(g, hood, vol(g, -12, 6, body, 0.3, 0.4));
    rim(g, hood, "#ffffff", 3, 0.4);
    g.fillStyle = INK; poly(g, [-6, 5, -7, -3, 0, -8, 7, -3, 7, 5]); g.fill();
    lens(g, () => poly(g, [0, -1, 5, -2, 5, 0, 0, 0.6]), ac, c, 14);
    lens(g, () => poly(g, [-4, -0.5, -1.5, -1, -1.5, 0.6, -4, 0.8]), ac, c, 10);
    g.restore();

    // back arm, a wisp
    jointLimb(g, -7, -12, -13, -2, -3, 4, dark);

    // blade arm: a thin curved knife, held low and forward
    const ax = 13 + sw, ay = -4;
    jointLimb(g, 7, -12, (7 + ax) / 2, ay - 1, 2.5, 4.6, dark);
    limb(g, (7 + ax) / 2, ay - 1, ax - 1, ay, 5.4, mid_(c, c2));
    g.save(); g.translate(ax, ay); g.rotate(A.atkPhase >= 0 ? 0.1 : 0.5);
    g.strokeStyle = INK; g.lineWidth = 5; g.lineCap = "round";
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(14, -10, 26, -2); g.stroke();
    g.strokeStyle = ac; g.lineWidth = 2.4; g.stroke();
    glow(g, c, 10, () => {
      g.strokeStyle = hexA(c, 0.8); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(4, -2); g.quadraticCurveTo(14, -9, 24, -2); g.stroke();
    });
    g.restore();
  },
},

/* ======================================================================== */
/* VEX — THE SIPHON                                                          */
/* ======================================================================== */
{
  id: "VEX", name: "VEX", tag: "THE SIPHON",
  blurb: "Every hit she lands is a hit she gets back.",
  power: "Lifesteal: every hit heals 20% of its damage off her own %. Siphon tethers a foe and drains them straight into her.",
  color: "#ff6fd8", color2: "#5a1048", color3: "#2a0722", accent: "#ffe0f6",
  weight: 0.92, speed: 4.5, accel: 0.92, jump: 12.2, airSpeed: 4.3, fallMul: 1.0,
  lifesteal: 0.2,
  size: { w: 32, h: 54 }, hurt: 25,
  specialCooldown: 320,

  light: { name: "Needle", startup: 3, active: 3, recovery: 9,
    dmg: 3.2, base: 1.5, scale: 0.4, angle: 44, ox: 38, oy: -8, r: 21,
    vfx(f) {
      FX.blade(f.x + f.facing * 10, f.y - 8, faceAng(f), 30, 60, 0.18, f.ch.color, { w: 12, life: 8 });
      Snd.tone(1600, 0.035, "square", 0.06, 2200);
    } },

  heavy: { name: "Draining Claw", startup: 13, active: 4, recovery: 26,
    dmg: 13, base: 4.0, scale: 1.0, angle: 40, ox: 44, oy: -6, r: 30,
    onStart() { Snd.whoosh(1.2); },
    vfx(f) {
      for (let i = 0; i < 3; i++)
        FX.blade(f.x + f.facing * 6, f.y - 14 + i * 8, faceAng(f) - 0.4 * f.facing, 30, 74, 1.0, i === 1 ? f.ch.accent : f.ch.color, { w: 5, life: 13 });
      FX.shake(5);
      Snd.tone(300, 0.12, "sawtooth", 0.1, 150);
    } },

  special: { name: "Siphon", startup: 6, active: 90, recovery: 18,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Latches a tether onto the nearest foe in range and drains them: 1.5% every sixth of a second moves from her damage onto theirs. Breaks if they get too far away, or when she lets go.",
    tick(f, a, inp) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.8; return; }
      if (a.t === m.startup) {
        const t = Combat.nearestFoe(f, 320);
        a.tgt = t && !t.intangible() ? t : null;
        if (!a.tgt) { a.t = m.startup + m.active; FX.ring(f.x, f.y, 6, 40, f.ch.color, 2); return; }
        Entities.add("tether", f, { tgt: a.tgt, x: a.tgt.x, y: a.tgt.y, life: m.active + 2, r: 0 });
        Snd.tone(220, 0.3, "sine", 0.12, 440);
      }
      const t = a.tgt;
      if (!t || a.t > m.startup + m.active) return;
      f.vx *= 0.7;
      const broke = !t.alive || t.state === ST.DEAD || t.intangible() || dist(f.x, f.y, t.x, t.y) > 380;
      if (broke || (a.t > m.startup + 20 && !inp.held("special"))) { a.t = m.startup + m.active; return; }
      if ((a.t - m.startup) % 10 === 9) {
        t.percent = Math.min(999, t.percent + 1.5); t.hitFlash = 3;
        t.lastHitBy = f;
        f.percent = Math.max(0, f.percent - 1.5);
        f.stats.damageDealt += 1.5;
        f.addMeter(1.5 * CFG.meter.onDeal);
        FX.spark(t.x, t.y, f.ch.color);
        Snd.tone(700, 0.04, "sine", 0.06, 500);
      }
    } },

  super: { name: "Eclipse Bite",
    desc: "A lunging bite that heals her for every point of damage it deals.",
    startup: 12, active: 8, recovery: 30,
    dmg: 17, base: 5.4, scale: 1.04, angle: 42, ox: 30, oy: -6, r: 40, lifesteal: 1.0,
    onStart(f) { Snd.superCharge(); FX.flash("#ff6fd8", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.6; FX.spark(f.x + rnd(-24, 24), f.y + rnd(-30, 20), f.ch.color); return; }
      if (a.t === m.startup) {
        FX.banner("ECLIPSE BITE", f.ch.color);
        f.vx = f.facing * 15; f.vy = Math.min(f.vy, -2);
        Snd.whoosh(1.8);
      }
      if (a.t <= m.startup + m.active) {
        FX.blade(f.x + f.facing * 20, f.y - 6, faceAng(f), 20, 56, 1.2, f.ch.color, { w: 10, life: 6 });
      }
    } },

  /* ---- art: a slim figure in a high-collared coat, a fanged mask, and a
           harness of glass vials on her back that fill as she drains. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#ffd0f0" : c2, deep = A.flash ? "#ffb0e4" : c3;
    const sw = swing(A, -10, 44);
    aura(g, 0, -4, 32, c, 0.14);

    // the vial harness, behind her
    for (let i = 0; i < 3; i++) {
      const vx = -14 - i * 3, vy = -16 + i * 7;
      plateRect(g, vx - 3, vy, 6, 9, 2.5, hexA("#ffffff", 0.25), { flat: true, rim: false, ink: 1.8 });
      g.fillStyle = hexA(c, 0.8); g.fillRect(vx - 2, vy + 3 + Math.sin(A.time * 0.08 + i) * 1.2, 4, 5);
    }

    const st = Math.sin(A.runPhase) * (A.running ? 12 : 0);
    jointLimb(g, -5, 9, -9 + st, 25, -4, 5.5, dark);
    jointLimb(g, 6, 9, 10 - st, 25, 4, 5.5, dark);
    plateRect(g, -14 + st, 23, 11, 6, 2, deep, { up: 0.16 });
    plateRect(g, 5 - st, 23, 11, 6, 2, deep, { up: 0.16 });

    // the coat, flared below the waist
    plate(g, [-9, -15, 9, -15, 12, 14, 4, 10, -4, 10, -12, 14], dark, { up: 0.2, down: 0.4, under: true });
    plate(g, [-7, -13, 7, -13, 6, 4, -6, 4], body, { up: 0.34, down: 0.3 });
    g.strokeStyle = hexA(ac, 0.5); g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 4); g.stroke();
    // the high collar
    plate(g, [-10, -15, -6, -26, -2, -16], deep, { ink: 2, up: 0.3 });
    plate(g, [10, -15, 6, -26, 2, -16], deep, { ink: 2, up: 0.3 });

    // head: a pale mask with a fanged grin
    g.save(); g.translate(1, -24);
    ink(g, () => { g.beginPath(); g.ellipse(0, 0, 6.6, 7.6, 0, 0, 7); }, vol(g, -8, 8, "#fbe6f3", 0.2, 0.3));
    lens(g, () => poly(g, [0, -3, 5.5, -2.5, 5.5, -1, 0, -1.4]), c, c, 12);
    g.fillStyle = INK; poly(g, [-2, 3, 6, 2.4, 5, 4.6, -1.5, 5]); g.fill();
    g.fillStyle = "#ffffff"; poly(g, [1, 3, 2.2, 3, 1.6, 5.4]); g.fill(); poly(g, [3.6, 2.8, 4.8, 2.8, 4.2, 5]); g.fill();
    // swept hair
    plate(g, [-7, -4, -2, -9, 6, -8, 3, -5, -6, 1], body, { up: 0.4, ink: 2.2 });
    g.restore();

    jointLimb(g, -7, -11, -14, -1, -3, 4.6, dark);

    // claw arm: three thin needles off the knuckles
    const ax = 14 + sw, ay = -6;
    jointLimb(g, 7, -11, (7 + ax) / 2, ay - 1, 2.5, 5, dark);
    limb(g, (7 + ax) / 2, ay - 1, ax - 2, ay, 6, mid_(c, c2));
    g.save(); g.translate(ax, ay);
    plateRect(g, -4, -4, 8, 8, 3, deep, { up: 0.2, rim: false });
    for (let i = 0; i < 3; i++) {
      const yy = -3 + i * 3;
      g.strokeStyle = INK; g.lineWidth = 2.6; g.lineCap = "round";
      g.beginPath(); g.moveTo(3, yy); g.lineTo(15, yy - 1 + i); g.stroke();
      g.strokeStyle = ac; g.lineWidth = 1.2; g.stroke();
    }
    g.restore();
  },
},

/* ======================================================================== */
/* FUSE — THE DEMOLITIONIST  (takes Ballast's place)                         */
/* ======================================================================== */
{
  id: "FUSE", name: "FUSE", tag: "THE DEMOLITIONIST",
  blurb: "Every problem has a blast radius. Hers are bigger.",
  power: "Sticky Charge clings to whoever it touches and blows. Payload is a giant countdown bomb — everyone sees the blast radius and has two seconds to get out.",
  color: "#ff9f1c", color2: "#5c3200", color3: "#261400", accent: "#fff0c4",
  weight: 1.2, speed: 4.0, accel: 0.76, jump: 11.7, airSpeed: 3.7, fallMul: 1.08,
  size: { w: 42, h: 56 }, hurt: 29,
  specialCooldown: 200,

  light: { name: "Wrench Swing", startup: 4, active: 3, recovery: 11,
    dmg: 4.4, base: 2.1, scale: 0.52, angle: 40, ox: 40, oy: -6, r: 24,
    vfx(f) {
      FX.blade(f.x + f.facing * 10, f.y - 8, faceAng(f) - 0.2 * f.facing, 26, 60, 0.9, f.ch.color, { w: 11, life: 10 });
      Snd.tone(200, 0.05, "square", 0.08, 120);
    } },

  heavy: { name: "Breaching Charge", startup: 14, active: 4, recovery: 27,
    dmg: 17, base: 5.0, scale: 1.1, angle: 45, ox: 50, oy: -2, r: 36,
    onStart() { Snd.tone(1200, 0.2, "square", 0.06, 1200); },
    vfx(f) {
      const p = hbAt(f, this);
      FX.ring(p.x, p.y, 10, 90, "#ffd27a", 4);
      FX.burst(p.x, p.y, 24, f.ch.color, 8);
      FX.burst(p.x, p.y, 10, "#3a2f40", 4);
      FX.shake(10); FX.flash("#ffd27a", 0.12);
      Snd.bigHit();
    } },

  special: { name: "Sticky Charge", startup: 10, active: 2, recovery: 20,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Lobs a bomb that sticks to the first foe it touches (or wherever it lands) and explodes a moment later for 13%.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      Entities.add("bomb", f, { x: f.x + f.facing * 20, y: f.y - 24, vx: f.facing * 7.5, vy: -6,
        r: 9, life: 105, move: hitMove("Sticky Charge", { dmg: 13, base: 4.8, scale: 0.98, angle: 55 }) });
      Snd.whoosh(1.1);
    } },

  super: { name: "Payload",
    desc: "Drops a giant bomb at her feet with a two-second countdown and its blast radius painted on the floor. Anyone still inside when it hits zero takes 22%. She's immune to her own blast.",
    startup: 14, active: 4, recovery: 26,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    boom: { name: "Payload", dmg: 22, base: 7.0, scale: 1.15, angle: 58, unblockable: true },
    onStart(f) { Snd.superCharge(); FX.flash("#ff9f1c", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t !== m.startup) { if (a.t < m.startup) f.vx *= 0.7; return; }
      FX.banner("PAYLOAD", f.ch.color);
      Entities.add("payload", f, { x: f.x, y: f.y, vy: 0, r: 24, life: 120, w: 250, move: m.boom });
      Snd.bigHit(); FX.shake(8);
    } },

  /* ---- art: stocky, hard hat with a lamp, goggles pushed up, a round bomb
           strapped to the back and a heavy wrench. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#ffe2b0" : c2, deep = A.flash ? "#ffcf80" : c3;
    const sw = swing(A, -10, 44);

    // the backpack bomb, with a lit fuse
    g.save(); g.translate(-16, -6);
    ink(g, () => { g.beginPath(); g.arc(0, 0, 11, 0, 7); }, vol(g, -11, 11, "#3a2f40", 0.3, 0.4));
    g.fillStyle = hexA("#ffffff", 0.3); g.beginPath(); g.arc(-3, -4, 3.5, 0, 7); g.fill();
    g.strokeStyle = "#c8a070"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -11); g.quadraticCurveTo(-6, -17, -3, -21); g.stroke();
    g.fillStyle = "#ffe36b"; g.shadowColor = "#ff8a1f"; g.shadowBlur = 10;
    g.beginPath(); g.arc(-3, -21, 2 + Math.abs(Math.sin(A.time * 0.5)) * 1.4, 0, 7); g.fill();
    g.restore();

    const st = Math.sin(A.runPhase) * (A.running ? 9 : 0);
    jointLimb(g, -8, 10, -12 + st, 26, -3.5, 10, dark);
    jointLimb(g, 9, 10, 13 - st, 26, 3.5, 10, dark);
    plateRect(g, -19 + st * 0.6, 24, 15, 8, 2.5, deep, { up: 0.18 });
    plateRect(g, 5 - st * 0.6, 24, 15, 8, 2.5, deep, { up: 0.18 });

    // torso: overalls with a hazard stripe
    plate(g, [-16, -14, 16, -14, 14, 14, -14, 14], body, { up: 0.3, down: 0.36, under: true });
    plate(g, [-11, -8, 11, -8, 10, 12, -10, 12], dark, { up: 0.12, down: 0.3, rimA: 0.26 });
    g.save(); poly(g, [-11, 2, 10, 2, 10, 7, -11, 7]); g.clip();
    hatch(g, -11, 2, 22, 5, "#ffe14d", 6, 0.9); g.restore();
    // bandolier of charges
    plate(g, [-14, -12, 14, 6, 14, 10, -14, -8], deep, { ink: 2, rim: false });
    for (let i = 0; i < 4; i++) { g.fillStyle = "#e0423a"; g.fillRect(-9 + i * 6, -7 + i * 4, 3.6, 6); }

    // head under a hard hat
    g.save(); g.translate(0, -22);
    ink(g, () => roundRect(g, -8, -7, 16, 14, 5), vol(g, -7, 7, "#f2c9a0", 0.2, 0.3));
    g.fillStyle = INK; g.fillRect(1, -1, 6, 2.2);
    // goggles pushed up
    plate(g, [-8, -7, 9, -7, 9, -3, -8, -3], deep, { ink: 2, rim: false });
    lens(g, () => { g.beginPath(); g.arc(4, -5, 2.4, 0, 7); }, "#9fd8ff", "#9fd8ff", 6);
    // the hard hat
    plate(g, [-11, -8, 12, -8, 9, -15, 0, -18, -8, -15], body, { up: 0.45, down: 0.2 });
    plateRect(g, -12, -9, 25, 3, 1.2, dark, { rim: false, ink: 2 });
    lens(g, () => roundRect(g, 6, -16, 5, 4, 1.5), "#fff6c2", "#ffe36b", 14);
    g.restore();

    // wrench arm
    const ax = 18 + sw, ay = -4;
    jointLimb(g, 13, -10, (13 + ax) / 2, ay - 1, 2, 9, dark);
    limb(g, (13 + ax) / 2, ay - 1, ax - 3, ay, 10, mid_(c, c2));
    g.save(); g.translate(ax, ay); g.rotate(A.atkPhase >= 0 ? 0 : -0.7);
    g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = "round";
    g.beginPath(); g.moveTo(-4, 0); g.lineTo(20, 0); g.stroke();
    g.strokeStyle = "#9aa3b5"; g.lineWidth = 3.4; g.stroke();
    plate(g, [18, -7, 27, -7, 27, -2, 23, -2, 23, 2, 27, 2, 27, 7, 18, 7], "#c4ccdb", { ink: 2.2, up: 0.3 });
    g.restore();
    jointLimb(g, -13, -10, -20, 2, -3.5, 8, dark);
  },
},

/* ======================================================================== */
/* RICO — THE RICOCHET                                                       */
/* ======================================================================== */
{
  id: "RICO", name: "RICO", tag: "THE RICOCHET",
  blurb: "Throws once, hits twice. Never misses the catch.",
  power: "Return Disc flies out, turns, and comes back to her hand — it hits on the way out AND on the way back. Bank Shot fills the stage with bouncing discs.",
  color: "#ff5a36", color2: "#5e1606", color3: "#2a0802", accent: "#ffe2d9",
  weight: 0.84, speed: 4.9, accel: 0.98, jump: 12.7, airSpeed: 4.7, fallMul: 0.95,
  size: { w: 32, h: 52 }, hurt: 25,
  specialCooldown: 110,

  light: { name: "Rim Strike", startup: 3, active: 3, recovery: 9,
    dmg: 3.4, base: 1.6, scale: 0.42, angle: 46, ox: 36, oy: -8, r: 22,
    vfx(f) {
      FX.blade(f.x + f.facing * 8, f.y - 8, faceAng(f), 22, 52, 0.9, f.ch.color, { w: 7, life: 9 });
      Snd.tone(1100, 0.04, "square", 0.07, 1500);
    } },

  heavy: { name: "Spin Volley", startup: 12, active: 5, recovery: 25,
    dmg: 14, base: 4.3, scale: 1.03, angle: 45, ox: 40, oy: -8, r: 33,
    onStart() { Snd.whoosh(1.2); },
    vfx(f) {
      FX.blade(f.x, f.y - 8, 0, 30, 70, 6.28, f.ch.color, { w: 9, life: 11, spin: f.facing * 0.22 });
      FX.blade(f.x, f.y - 8, 3, 34, 64, 6.28, f.ch.accent, { w: 3, life: 9, core: false, spin: f.facing * 0.22 });
      FX.shake(5);
      Snd.tone(900, 0.08, "square", 0.1, 1500);
    } },

  special: { name: "Return Disc", startup: 8, active: 2, recovery: 16,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Throws a disc that slows, turns, and flies back to her hand. It can hit on the way out and again on the way back.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      Entities.add("disc", f, { x: f.x + f.facing * 22, y: f.y - 8, vx: f.facing * 14, vy: 0, dir: f.facing,
        r: 15, life: 150, move: hitMove("Return Disc", { dmg: 7, base: 2.7, scale: 0.55, angle: 40 }) });
      Snd.tone(900, 0.1, "square", 0.08, 1400);
    } },

  super: { name: "Bank Shot",
    desc: "Hurls five discs that ricochet off the edges of the stage for three seconds. Each foe can be clipped up to four times in all.",
    startup: 14, active: 6, recovery: 26,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    onStart(f) { Snd.superCharge(); FX.flash("#ff5a36", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t !== m.startup) { if (a.t < m.startup) f.vx *= 0.7; return; }
      FX.banner("BANK SHOT", f.ch.color);
      // one hit log shared by all five discs, so they can't stack five times
      // the damage: four hits per foe in total, at most one every 20 frames
      const log = {};
      for (let i = 0; i < 5; i++) {
        const an = -1.0 + i * 0.45;
        Entities.add("rdisc", f, { x: f.x, y: f.y - 10, vx: Math.cos(an) * 11 * f.facing, vy: Math.sin(an) * 11,
          r: 15, life: 180, hitLog: log, cap: 4, seek: true,
          move: hitMove("Bank Shot", { dmg: 5, base: 2.6, scale: 0.6, angle: 48, unblockable: true }) });
      }
      Snd.bigHit();
    } },

  /* ---- art: an athlete. Sweatband, wraparound shades, a numbered jersey,
           a ponytail, and a disc ready at the hand. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#ffc8b8" : c2, deep = A.flash ? "#ffa894" : c3;
    const sw = swing(A, -10, 42);
    aura(g, 0, -6, 30, c, 0.14);

    // ponytail
    g.save(); g.lineCap = "round";
    const tail = Math.sin(A.time * 0.12) * 3 - A.vx * 0.6;
    g.strokeStyle = INK; g.lineWidth = 6.6;
    g.beginPath(); g.moveTo(-5, -30); g.quadraticCurveTo(-14, -28 + tail, -16, -20 + tail); g.stroke();
    g.strokeStyle = "#3a1f14"; g.lineWidth = 4; g.stroke();
    g.restore();

    const st = Math.sin(A.runPhase) * (A.running ? 13 : 0);
    jointLimb(g, -5, 8, -8 + st, 24, -4, 6, "#f2c9a0");
    jointLimb(g, 5, 8, 9 - st, 24, 4, 6, "#f2c9a0");
    plate(g, [-7, 2, 7, 2, 8, 12, -8, 12], dark, { up: 0.2, ink: 2.4 });     // shorts
    // sneakers with a stripe
    plateRect(g, -14 + st, 22, 12, 6, 2.5, "#ffffff", { up: 0.1 });
    plateRect(g, 3 - st, 22, 12, 6, 2.5, "#ffffff", { up: 0.1 });
    g.fillStyle = c; g.fillRect(-12 + st, 24, 8, 1.6); g.fillRect(5 - st, 24, 8, 1.6);

    // jersey with a number
    plate(g, [-9, -15, 9, -15, 8, 4, -8, 4], body, { up: 0.3, down: 0.34, under: true });
    g.font = `900 9px ${FONT_DISPLAY}`; g.textAlign = "center"; g.fillStyle = ac;
    g.fillText("7", 0, -2);
    plate(g, [-9, -15, -4, -15, -6, -11, -10, -11], dark, { ink: 1.8, rim: false });
    plate(g, [4, -15, 9, -15, 10, -11, 6, -11], dark, { ink: 1.8, rim: false });

    // head: sweatband and wraparound shades
    g.save(); g.translate(1, -24);
    ink(g, () => { g.beginPath(); g.ellipse(0, 0, 6.6, 7.4, 0, 0, 7); }, vol(g, -8, 8, "#f2c9a0", 0.2, 0.3));
    plate(g, [-7, -5, 7, -6, 7, -3, -7, -2], c, { ink: 2, rim: false });
    lens(g, () => poly(g, [-2, -1, 7.5, -1.5, 7, 2, -1.5, 2]), "#1a1020", c, 0);
    g.fillStyle = hexA("#ffffff", 0.5); g.fillRect(2, -0.8, 3, 0.9);
    plate(g, [-7, -6, -1, -10, 6, -9, 7, -6], "#3a1f14", { ink: 2, up: 0.3 });
    g.restore();

    jointLimb(g, -7, -12, -13, -1, -3, 4.6, "#f2c9a0");

    // throwing arm, disc held flat at the hand
    const ax = 13 + sw, ay = -6;
    jointLimb(g, 7, -12, (7 + ax) / 2, ay - 1, 2.5, 4.8, "#e8b98d");
    limb(g, (7 + ax) / 2, ay - 1, ax - 2, ay, 5.4, "#f2c9a0");
    if (A.atkKind !== "special" || A.atkPhase > 0.4) {
      g.save(); g.translate(ax + 4, ay); g.rotate(-0.2);
      ink(g, () => { g.beginPath(); g.ellipse(0, 0, 10, 4, 0, 0, 7); }, vol(g, -4, 4, c, 0.4, 0.3), 2.2);
      g.strokeStyle = ac; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, 0, 6, 2.2, 0, 0, 7); g.stroke();
      g.restore();
    }
  },
},

/* ======================================================================== */
/* SPROUT — THE GARDENER                                                     */
/* ======================================================================== */
{
  id: "SPROUT", name: "SPROUT", tag: "THE GARDENER",
  blurb: "Patient. Grows on you. Then grows over you.",
  power: "Bloom plants a flower that heals her (and teammates) standing in it. Overgrowth roots every grounded foe in place and heals her side.",
  color: "#3ddc84", color2: "#0f4d2a", color3: "#062614", accent: "#e3ffe9",
  weight: 1.08, speed: 4.25, accel: 0.84, jump: 12.0, airSpeed: 4.0, fallMul: 1.02,
  size: { w: 36, h: 54 }, hurt: 27,
  specialCooldown: 260,

  light: { name: "Vine Lash", startup: 3, active: 3, recovery: 9,
    dmg: 4.2, base: 1.9, scale: 0.44, angle: 46, ox: 44, oy: -6, r: 22,
    vfx(f) {
      FX.blade(f.x + f.facing * 10, f.y - 6, faceAng(f), 26, 64, 0.5, f.ch.color, { w: 6, life: 10 });
      FX.spark(hbAt(f, this).x, f.y - 6, "#9dffbd");
      Snd.noise(0.05, 0.07, 1800, 1, "bandpass");
    } },

  heavy: { name: "Thornburst", startup: 13, active: 5, recovery: 26,
    dmg: 16, base: 4.8, scale: 1.06, angle: 64, ox: 30, oy: 6, r: 36,
    onStart() { Snd.whoosh(1.3); },
    vfx(f) {
      const p = hbAt(f, this);
      for (let i = 0; i < 6; i++)
        FX.blade(p.x, p.y + 16, -Math.PI / 2 + (i - 2.5) * 0.35, 8, 56, 0.15, i % 2 ? f.ch.color : "#9a6a3a", { w: 7, life: 15 });
      FX.burst(p.x, p.y + 14, 14, f.ch.color2, 5);
      FX.shake(6);
      Snd.tone(140, 0.15, "sawtooth", 0.12, 70);
    } },

  special: { name: "Bloom", startup: 12, active: 2, recovery: 18,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Plants a flower at her feet for six seconds. Standing in it heals her (and teammates) 1% four times a second; a foe who walks through gets stung once. Planting a new one uproots the old.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      for (const e of Entities.list) if (e.kind === "flower" && e.owner === f) e.life = Math.min(e.life, 20);
      Entities.add("flower", f, { x: f.x, y: f.feetY, r: 70, life: 360,
        move: hitMove("Bloom", { dmg: 3, base: 1.5, scale: 0.2, angle: 70 }) });
      Snd.tone(660, 0.2, "sine", 0.1, 990);
    } },

  super: { name: "Overgrowth",
    desc: "Vines burst from every platform: every foe standing on the ground is rooted in place for 2.5 seconds and takes 8%, and she and her teammates heal 8%. Rooted foes can still attack and shield — they just can't move.",
    startup: 16, active: 6, recovery: 28,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    onStart(f) { Snd.superCharge(); FX.flash("#3ddc84", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t !== m.startup) { if (a.t < m.startup) f.vx *= 0.7; return; }
      FX.banner("OVERGROWTH", f.ch.color);
      FX.shake(16); Snd.superHit();
      for (const s of Stage.segs)
        for (let x = Math.min(s.ax, s.bx); x < Math.max(s.ax, s.bx); x += 34)
          FX.blade(x, Stage.surfaceY(s, x), -Math.PI / 2, 4, 30 + Math.random() * 30, 0.2, f.ch.color, { w: 5, life: 30 });
      for (const o of Match.current.fighters) {
        if (!o.alive || o.state === ST.DEAD) continue;
        if (allies(o, f)) {
          o.percent = Math.max(0, o.percent - 8);
          FX.damageText(o.x, o.y - 50, "+8", "#7dff9a");
          continue;
        }
        if (!o.grounded || o.intangible()) continue;
        o.rootT = 150;
        o.percent = Math.min(999, o.percent + 8); o.hitFlash = 6; o.lastHitBy = f;
        o.vx = 0;
        f.stats.damageDealt += 8; f.addMeter(8 * CFG.meter.onDeal);
        FX.damageText(o.x, o.y - 50, "ROOTED", f.ch.accent);
      }
    } },

  /* ---- art: a sapling of a fighter. Bark-plated body, a head of two big
           leaves with a flower, and roots for feet. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#c8ffd8" : c2, deep = A.flash ? "#a8f0c0" : c3;
    const bark = A.flash ? "#ffffff" : "#7a5230";
    const sw = swing(A, -10, 46);
    aura(g, 0, -4, 34, c, 0.12);

    const st = Math.sin(A.runPhase) * (A.running ? 9 : 0);
    jointLimb(g, -6, 10, -9 + st, 25, -3, 7, bark);
    jointLimb(g, 7, 10, 10 - st, 25, 3, 7, bark);
    // root feet
    for (const [x, d] of [[-9 + st, -1], [10 - st, 1]]) {
      g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = "round";
      g.beginPath(); g.moveTo(x, 25); g.lineTo(x + d * 8, 28); g.moveTo(x, 25); g.lineTo(x - d * 4, 28); g.stroke();
      g.strokeStyle = bark; g.lineWidth = 2.2; g.stroke();
    }

    // body: bark plates over green
    plate(g, [-12, -14, 12, -14, 10, 12, -10, 12], body, { up: 0.3, down: 0.36, under: true });
    for (let i = 0; i < 3; i++)
      plate(g, [-10, -10 + i * 7, 10, -12 + i * 7, 9, -6 + i * 7, -9, -4 + i * 7], bark, { up: 0.2, ink: 1.8, rimA: 0.25 });

    // head: two great leaves and a flower
    g.save(); g.translate(0, -24);
    ink(g, () => { g.beginPath(); g.ellipse(0, 0, 7.4, 7.4, 0, 0, 7); }, vol(g, -8, 8, body, 0.3, 0.3));
    lens(g, () => { g.beginPath(); g.arc(3, -0.5, 1.6, 0, 7); }, "#ffffff", c, 6);
    lens(g, () => { g.beginPath(); g.arc(-1.5, -0.5, 1.4, 0, 7); }, "#ffffff", c, 6);
    const flap = Math.sin(A.time * 0.07) * 0.12;
    g.save(); g.rotate(-0.6 + flap);
    plate(g, [0, -4, -6, -14, -2, -24, 4, -14], dark, { up: 0.3, ink: 2.2 }); g.restore();
    g.save(); g.rotate(0.5 - flap);
    plate(g, [0, -4, 6, -14, 3, -24, -3, -14], body, { up: 0.4, ink: 2.2 }); g.restore();
    g.translate(-5, -7);
    for (let i = 0; i < 5; i++) {
      g.save(); g.rotate(i / 5 * Math.PI * 2);
      ink(g, () => { g.beginPath(); g.ellipse(0, -3.2, 2, 3, 0, 0, 7); }, "#ff9ec7", 1.4); g.restore();
    }
    g.fillStyle = "#ffe14d"; g.beginPath(); g.arc(0, 0, 1.8, 0, 7); g.fill();
    g.restore();

    jointLimb(g, -10, -10, -16, 2, -3, 5, dark);

    // vine arm: the arm itself is the whip, trailing a leaf
    const ax = 16 + sw, ay = -4;
    g.save(); g.lineCap = "round";
    const path = () => { g.beginPath(); g.moveTo(10, -10); g.quadraticCurveTo((10 + ax) / 2, ay - 10, ax, ay); };
    path(); g.strokeStyle = INK; g.lineWidth = 7.5; g.stroke();
    path(); g.strokeStyle = dark; g.lineWidth = 5; g.stroke();
    path(); g.strokeStyle = hexA("#ffffff", 0.2); g.lineWidth = 1.4; g.stroke();
    g.restore();
    g.save(); g.translate(ax, ay); g.rotate(0.4);
    plate(g, [0, 0, 8, -4, 14, 0, 8, 4], body, { up: 0.3, ink: 2 });
    g.restore();
  },
},

/* ======================================================================== */
/* ECHO — THE REWIND                                                         */
/* ======================================================================== */
{
  id: "ECHO", name: "ECHO", tag: "THE REWIND",
  blurb: "She's been here before. She'll be here again.",
  power: "Recall snaps her back to where she was 1.5 seconds ago, undoing up to 7% damage. Deja Vu marks foes so every hit they take lands a second time.",
  color: "#e8ecff", color2: "#3a3f66", color3: "#1a1d33", accent: "#b9a6ff",
  weight: 0.9, speed: 4.4, accel: 0.9, jump: 12.3, airSpeed: 4.3, fallMul: 1.0,
  recall: 90,                // frames of position history Recall can rewind
  size: { w: 32, h: 54 }, hurt: 25,
  specialCooldown: 380,

  light: { name: "Tick", startup: 3, active: 3, recovery: 9,
    dmg: 3.5, base: 1.6, scale: 0.42, angle: 45, ox: 37, oy: -8, r: 22,
    vfx(f) {
      FX.blade(f.x + f.facing * 8, f.y - 8, faceAng(f), 22, 54, 0.6, f.ch.accent, { w: 7, life: 9 });
      Snd.tone(1900, 0.03, "square", 0.06);
    } },

  heavy: { name: "Pendulum", startup: 14, active: 5, recovery: 27,
    dmg: 14.5, base: 4.4, scale: 1.04, angle: 38, ox: 46, oy: -2, r: 32,
    onStart() { Snd.whoosh(1.3); },
    vfx(f) {
      FX.blade(f.x, f.y - 30, faceAng(f) + 1.2 * f.facing, 30, 70, 1.5, f.ch.accent, { w: 14, life: 15, spin: -f.facing * 0.07 });
      FX.ring(hbAt(f, this).x, f.y, 8, 60, f.ch.color, 3);
      FX.shake(5);
      Snd.tone(400, 0.12, "triangle", 0.11, 200);
    } },

  special: { name: "Recall", startup: 6, active: 2, recovery: 14,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Snaps back to wherever she stood 1.5 seconds ago, taking back up to 7% of the damage she took since. The afterimage she leaves detonates on anyone standing in it.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      const back = f.posHist[0];
      if (!back) return;
      Entities.add("ghost", f, { x: f.x, y: f.y, dir: f.facing, life: 26, r: 0,
        move: hitMove("Recall", { dmg: 7, base: 3.0, scale: 0.6, angle: 60 }) });
      FX.streak(f.x, f.y, back.x, back.y, f.ch.accent);
      f.x = f.px = back.x; f.y = f.py = back.y;
      f.vx = 0; f.vy = 0; f.grounded = false; f.groundSeg = null;
      f.percent = Math.max(back.p, f.percent - 7);
      f.airJumps = CFG.airJumps;
      f.invuln = Math.max(f.invuln, 10);
      f.posHist.length = 0;
      FX.ring(f.x, f.y, 6, 70, f.ch.accent, 3);
      Snd.tone(1600, 0.2, "sine", 0.1, 400);
    } },

  super: { name: "Deja Vu",
    desc: "Marks every foe within reach and hits them for 6%. For three seconds, every point of damage a marked foe takes is remembered — then it all lands again at once (up to 24%).",
    startup: 14, active: 6, recovery: 28,
    dmg: 6, base: 2.0, scale: 0.3, angle: 60, ox: 0, oy: 0, r: 0, radius: 420, unblockable: true,
    onStart(f) { Snd.superCharge(); FX.flash("#b9a6ff", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t !== m.startup) { if (a.t < m.startup) f.vx *= 0.7; return; }
      FX.banner("DEJA VU", f.ch.accent);
      FX.ring(f.x, f.y, 20, m.radius, f.ch.accent, 4);
      Snd.superHit();
      for (const o of Combat.foes(f)) {
        if (o.intangible() || dist(f.x, f.y, o.x, o.y) > m.radius) continue;
        o.echoT = 180; o.echoBy = f; o.echoDmg = 0;
        Combat.land(f, o, m, o.x, o.y);
      }
    } },

  /* ---- art: clockwork. A clock face for a head with real moving hands, a
           halo ring, a gear on the chest, and a pendulum for a weapon. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#d0d4f0" : c2, deep = A.flash ? "#b0b6e0" : c3;
    const sw = swing(A, -10, 44);
    aura(g, 0, -6, 34, ac, 0.16);

    // two faint afterimages trailing behind
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 1; i <= 2; i++) {
      g.globalAlpha = 0.12 / i;
      g.fillStyle = ac;
      roundRect(g, -12 - i * 6 - Math.abs(A.vx) * i, -30, 22, 56, 9); g.fill();
    }
    g.restore();

    const st = Math.sin(A.runPhase) * (A.running ? 12 : 0);
    jointLimb(g, -5, 9, -9 + st, 25, -4, 5.6, dark);
    jointLimb(g, 6, 9, 10 - st, 25, 4, 5.6, dark);
    plateRect(g, -14 + st, 23, 11, 6, 2, deep, { up: 0.16 });
    plateRect(g, 5 - st, 23, 11, 6, 2, deep, { up: 0.16 });

    // long coat, and a gear on the chest that turns
    plate(g, [-10, -15, 10, -15, 12, 14, -12, 14], dark, { up: 0.2, down: 0.4, under: true });
    plate(g, [-7, -13, 7, -13, 6, 6, -6, 6], body, { up: 0.34, down: 0.3 });
    g.save(); g.translate(0, -4); g.rotate(A.time * 0.03);
    g.fillStyle = INK; g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill();
    g.fillStyle = ac;
    for (let i = 0; i < 8; i++) { g.save(); g.rotate(i / 8 * Math.PI * 2); g.fillRect(-1, -5.6, 2, 2); g.restore(); }
    g.beginPath(); g.arc(0, 0, 3.4, 0, 7); g.fill();
    g.restore();

    // head: a clock face, hands telling real time
    g.save(); g.translate(0, -25);
    ink(g, () => { g.beginPath(); g.arc(0, 0, 8.4, 0, 7); }, vol(g, -9, 9, body, 0.3, 0.3));
    g.strokeStyle = hexA(INK, 0.6); g.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const an = i / 12 * Math.PI * 2;
      g.beginPath(); g.moveTo(Math.cos(an) * 6.4, Math.sin(an) * 6.4); g.lineTo(Math.cos(an) * 7.6, Math.sin(an) * 7.6); g.stroke();
    }
    const tm = A.time * 0.02;
    g.strokeStyle = INK; g.lineWidth = 1.8; g.lineCap = "round";
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(tm) * 6, Math.sin(tm) * 6); g.stroke();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(tm / 12) * 4, Math.sin(tm / 12) * 4); g.stroke();
    lens(g, () => { g.beginPath(); g.arc(0, 0, 1.4, 0, 7); }, ac, ac, 8);
    // the halo
    g.save(); g.globalCompositeOperation = "lighter";
    g.strokeStyle = hexA(ac, 0.7); g.lineWidth = 1.8; g.shadowColor = ac; g.shadowBlur = 10;
    g.beginPath(); g.ellipse(0, -11, 9, 2.6, 0, 0, 7); g.stroke();
    g.restore();
    g.restore();

    jointLimb(g, -8, -11, -14, -1, -3, 4.6, dark);

    // pendulum arm: a chain and a weight that swings
    const ax = 13 + sw * 0.6, ay = -6;
    jointLimb(g, 8, -11, (8 + ax) / 2, ay - 1, 2.5, 5, dark);
    limb(g, (8 + ax) / 2, ay - 1, ax - 2, ay, 6, mid_(c, c2));
    const sa = A.atkPhase >= 0 ? -1.2 + A.atkPhase * 2.4 : Math.sin(A.time * 0.06) * 0.35;
    const px = ax + Math.sin(sa) * 18 + (A.atkPhase >= 0 ? sw * 0.4 : 0), py = ay + Math.cos(sa) * 18;
    g.strokeStyle = INK; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(px, py); g.stroke();
    g.strokeStyle = ac; g.lineWidth = 1.2; g.stroke();
    ink(g, () => { g.beginPath(); g.arc(px, py, 5.4, 0, 7); }, vol(g, py - 6, py + 6, ac, 0.4, 0.3));
  },
},

/* ======================================================================== */
/* TEMPO — THE MAESTRO                                                       */
/* ======================================================================== */
{
  id: "TEMPO", name: "TEMPO", tag: "THE MAESTRO",
  blurb: "Fights to the music. Literally — stay on beat and she hits harder.",
  power: "Hits that land on the stage music's beat deal +20% and build extra meter (her speaker pulses with it). Crescendo's sound wave shatters shields outright.",
  color: "#ffe14d", color2: "#5c4a06", color3: "#2a2102", accent: "#fffbe0",
  weight: 0.96, speed: 4.3, accel: 0.88, jump: 12.2, airSpeed: 4.1, fallMul: 1.0,
  rhythm: true,
  size: { w: 34, h: 54 }, hurt: 26,
  specialCooldown: 160,

  light: { name: "Downbeat", startup: 4, active: 3, recovery: 9,
    dmg: 3.6, base: 1.7, scale: 0.43, angle: 46, ox: 38, oy: -8, r: 22,
    vfx(f) {
      FX.blade(f.x + f.facing * 10, f.y - 10, faceAng(f) - 0.5 * f.facing, 22, 52, 1.0, f.ch.color, { w: 6, life: 9 });
      Snd.tone(523, 0.06, "triangle", 0.08);
    } },

  heavy: { name: "Bass Drop", startup: 14, active: 5, recovery: 27,
    dmg: 14, base: 4.4, scale: 1.04, angle: 70, ox: 34, oy: 4, r: 36,
    onStart() { Snd.whoosh(1.2); },
    vfx(f) {
      const p = hbAt(f, this);
      FX.ring(p.x, p.y + 14, 10, 90, f.ch.color, 4);
      FX.ring(p.x, p.y + 14, 6, 60, "#ffffff", 2);
      FX.shake(8);
      Snd.tone(55, 0.3, "sine", 0.3, 40);
    } },

  special: { name: "Crescendo", startup: 10, active: 2, recovery: 20,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "A sound wave rings out around her. It hits everyone it passes for 5% — and a shield caught in it shatters on the spot.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      Entities.add("ring", f, { x: f.x, y: f.y, r: 10, maxR: 170, life: 26,
        move: hitMove("Crescendo", { dmg: 5, base: 2.6, scale: 0.45, angle: 55, breaksShield: true }) });
      Snd.tone(660, 0.12, "square", 0.1, 990); Snd.tone(990, 0.12, "square", 0.08, 1320, 0.06);
    } },

  super: { name: "Fortissimo",
    desc: "Three shockwaves, one per beat, each wider and harder than the last (6%, 7%, 11%). Every one of them shatters shields.",
    startup: 12, active: 70, recovery: 26,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    onStart(f) { Snd.superCharge(); FX.flash("#ffe14d", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.7; return; }
      if (a.t === m.startup) FX.banner("FORTISSIMO", f.ch.color);
      f.vx *= 0.8;
      // one wave per beat, capped so even the slowest stage fits all three
      const s = a.t - m.startup, beat = Math.min(32, Math.round(Combat.beatPeriod()));
      const n = s / beat;
      if (s % beat !== 0 || n > 2) return;
      const waves = [[200, 6, 3.0], [240, 7, 3.6], [290, 11, 6.0]];
      const [R, dmg, base] = waves[n];
      Entities.add("ring", f, { x: f.x, y: f.y, r: 10, maxR: R, life: 24,
        move: hitMove("Fortissimo", { dmg, base, scale: n === 2 ? 1.05 : 0.6, angle: 55,
                                      breaksShield: true, unblockable: true }) });
      FX.shake(10 + n * 6);
      Snd.tone([262, 330, 392][n], 0.3, "square", 0.16, [524, 660, 784][n]);
    } },

  /* ---- art: a conductor with a DJ's habits. Headphones, a tailcoat, a
           speaker for a chest that pulses on the stage's beat, and a baton. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#fff0b0" : c2, deep = A.flash ? "#ffe680" : c3;
    const sw = swing(A, -8, 42);
    // the beat, for the speaker pulse: the match clock when there is one
    const frames = Match.current ? Match.current.frames : A.time;
    const bp = 3600 / ((Stage.def.music && Stage.def.music.bpm) || 120);
    const beat = 1 - ((frames % bp) / bp);
    aura(g, 0, -4, 30 + beat * 8, c, 0.12 + beat * 0.12);

    // tailcoat tails
    for (let t = 0; t < 2; t++) {
      plate(g, [-6 + t * 4, 0, -2 + t * 4, 0, -10 + t * 3 - Math.abs(A.vx) * 0.8, 20 + Math.sin(A.time * 0.1 + t) * 2,
                -14 + t * 3 - Math.abs(A.vx) * 0.8, 18], t ? deep : dark, { ink: 2, rimA: 0.2 });
    }

    const st = Math.sin(A.runPhase) * (A.running ? 11 : 0);
    jointLimb(g, -5, 9, -9 + st, 25, -4, 5.6, deep);
    jointLimb(g, 6, 9, 10 - st, 25, 4, 5.6, deep);
    plateRect(g, -14 + st, 23, 11, 6, 2, INK, { up: 0.3 });
    plateRect(g, 5 - st, 23, 11, 6, 2, INK, { up: 0.3 });

    // jacket and the speaker chest
    plate(g, [-10, -15, 10, -15, 9, 10, -9, 10], dark, { up: 0.2, down: 0.4, under: true });
    g.save(); g.translate(0, -3);
    ink(g, () => { g.beginPath(); g.arc(0, 0, 7, 0, 7); }, deep);
    const cone = 4.6 + beat * 1.6;
    ink(g, () => { g.beginPath(); g.arc(0, 0, cone, 0, 7); }, vol(g, -cone, cone, body, 0.4, 0.3), 1.6);
    lens(g, () => { g.beginPath(); g.arc(0, 0, 1.6, 0, 7); }, ac, c, 6 + beat * 14);
    g.restore();
    // bow tie
    plate(g, [-4, -14, 0, -12, -4, -10], c, { ink: 1.6, rim: false });
    plate(g, [4, -14, 0, -12, 4, -10], c, { ink: 1.6, rim: false });

    // head with headphones
    g.save(); g.translate(1, -24);
    ink(g, () => { g.beginPath(); g.ellipse(0, 0, 6.8, 7.4, 0, 0, 7); }, vol(g, -8, 8, "#f2c9a0", 0.2, 0.3));
    g.fillStyle = INK; g.fillRect(1.5, -1.5, 5, 1.6);
    plate(g, [-7, -3, -2, -10, 4, -10, 7, -4, 4, -7, -3, -6], "#2a2030", { ink: 2, up: 0.4 });   // swept hair
    g.strokeStyle = INK; g.lineWidth = 3.4;
    g.beginPath(); g.arc(0, -1, 9, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.strokeStyle = body; g.lineWidth = 1.8; g.stroke();
    plateRect(g, -10, -3, 4.6, 8, 2, body, { up: 0.4, ink: 1.8 });
    plateRect(g, 6, -3, 4.6, 8, 2, body, { up: 0.4, ink: 1.8 });
    g.restore();

    jointLimb(g, -8, -11, -14, -2, -3, 4.6, dark);

    // baton arm: a thin white baton with a glowing tip
    const ax = 14 + sw, ay = -8;
    jointLimb(g, 8, -11, (8 + ax) / 2, ay - 1, 2.5, 5, dark);
    limb(g, (8 + ax) / 2, ay - 1, ax - 2, ay, 6, mid_(c, c2));
    g.save(); g.translate(ax, ay); g.rotate(A.atkPhase >= 0 ? 0.2 : -0.6 + Math.sin(A.time * 0.1) * 0.15);
    g.strokeStyle = INK; g.lineWidth = 3.6; g.lineCap = "round";
    g.beginPath(); g.moveTo(-2, 0); g.lineTo(22, 0); g.stroke();
    g.strokeStyle = "#ffffff"; g.lineWidth = 1.8; g.stroke();
    lens(g, () => { g.beginPath(); g.arc(22, 0, 2, 0, 7); }, ac, c, 12 + beat * 10);
    g.restore();
  },
},
];

/* Fuse takes Ballast's old place in the line-up; the rest follow on. */
NEWCOMERS.forEach(c => { CHAR_BY_ID[c.id] = c; });
ROSTER.splice(4, 0, CHAR_BY_ID.FUSE);
ROSTER.push(...NEWCOMERS.filter(c => c.id !== "FUSE"));
