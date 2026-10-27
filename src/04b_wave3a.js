/* ==========================================================================
   5b. WAVE 3A — four more fighters, each on a mechanic nobody else has

     MAGNA   magnetism     her hits magnetise; Pulse yanks them in, Reversal hurls
     GLITCH  teleporting   Blink hops behind you; Stack Overflow hops five times
     GRUDGE  rage          hits harder the more hurt he is; bottles a hit for later
     PRISM   light beams   a beam that bounces off the floor; a sweeping spectrum

   Numbers sit inside the 04a ranges: lights 3-5%, heavies 13-17%, supers
   18-26% when they fully land. What they spawn lives in 08b_kinds_a.js, and
   every kind there is prefixed with its fighter's id.

   cpuSpecial(f, target, d) / cpuSuperRange are hints for CPU.think(): when to
   fire the special, and how close a foe should be before the super is worth it.
   ========================================================================== */

/** The six bands Prism splits light into — her art and her beams share them. */
const PRISM_RAINBOW = ["#ff3b5c", "#ff9f1c", "#ffe14d", "#3dff8a", "#3db8ff", "#b05bff"];

/** Magna: magnetise a foe for six seconds. The filings that swarm them are an
    entity, so guests see who is magnetised without a new Fighter field. */
function magnaMark(f, d) {
  if (!d.alive || d.state === ST.DEAD) return;
  d.markT = 360; d.markBy = f;
  if (Entities.list.some(e => e.kind === "magna_mark" && e.owner === f && e.tgt === d)) return;
  Entities.add("magna_mark", f, { tgt: d, x: d.x, y: d.y, r: 0, life: 361 });
  FX.damageText(d.x, d.y - 54, "MAGNETISED", f.ch.color);
}

/** Glitch: drop an afterimage where she was and reappear somewhere else. */
function glitchHop(f, x, y) {
  const b = Stage.blast;
  x = clamp(x, b.left + 90, b.right - 90);
  y = clamp(y, b.top + 90, b.bottom - 140);
  Entities.add("glitch_ghost", f, { x: f.x, y: f.y, dir: f.facing, r: 0, life: 22 });
  FX.streak(f.x - 2, f.y, x - 2, y, "#ff2b4a");
  FX.streak(f.x + 2, f.y, x + 2, y, "#2bd8ff");
  f.x = f.px = x; f.y = f.py = y;
  f.grounded = false; f.groundSeg = null;
  Snd.tone(rnd(900, 1500), 0.05, "square", 0.08, 200);
}

/** Grudge: 0 at 0%, 1 at 150% and beyond — how angry he is. */
function grudgeRage(f) { return clamp(f.percent / 150, 0, 1); }
const grudgeR1 = v => Math.round(v * 10) / 10;

/** Grudge's light and heavy: swap in a copy of the move scaled by his rage
    (up to +35% damage) and, if he bottled a hit, spend it on this swing. */
function grudgeArm(f, m) {
  const a = f.attack;
  if (!a || a.data !== m) return;
  const p = grudgeRage(f), d = Object.assign({}, m), v = f.v;
  d.dmg = m.dmg * (1 + 0.35 * p);
  d.kbMul = (m.kbMul || 1) * (1 + 0.18 * p);
  if (v.bt > 0 && v.sk === f.stocks) {
    d.dmg += Math.min(5, v.bt * 0.4);
    d.kbMul *= 1.2;
    FX.damageText(f.x, f.y - 62, "UNCORKED", "#ffb347");
    FX.ring(f.x, f.y, 8, 70, "#ff7a1a", 3);
  }
  v.bt = 0;
  d.dmg = grudgeR1(d.dmg);
  a.data = d;
}

const WAVE3A = [

/* ======================================================================== */
/* MAGNA — THE LODESTONE                                                     */
/* ======================================================================== */
{
  id: "MAGNA", name: "MAGNA", tag: "THE LODESTONE",
  blurb: "Everything she touches ends up stuck to her. Then nothing can stay near her.",
  power: "Her light and heavy magnetise foes for six seconds. Magnet Pulse yanks every magnetised foe straight to her; Polar Reversal flips the field and hurls everyone away — magnetised foes hardest of all.",
  color: "#e0243c", color2: "#560c18", color3: "#26050b", accent: "#d9e2f0",
  weight: 1.1, speed: 4.2, accel: 0.84, jump: 12.0, airSpeed: 4.0, fallMul: 1.04,
  size: { w: 36, h: 56 }, hurt: 27,
  specialCooldown: 150,
  cpuSuperRange: 300,
  cpuSpecial(f, t, d) { return d > 110 && Combat.foes(f).some(o => o.markBy === f && o.markT > 0); },

  light: { name: "Polar Jab", startup: 4, active: 3, recovery: 10,
    dmg: 3.8, base: 1.8, scale: 0.44, angle: 44, ox: 38, oy: -8, r: 23,
    onHit(f, d) { magnaMark(f, d); },
    vfx(f) {
      FX.blade(f.x + f.facing * 10, f.y - 8, faceAng(f), 24, 56, 0.5, f.ch.color, { w: 8, life: 10 });
      FX.spark(hbAt(f, this).x, f.y - 8, f.ch.accent);
      Snd.tone(420, 0.05, "square", 0.07, 840);
    } },

  heavy: { name: "Lodestone Slam", startup: 14, active: 4, recovery: 27,
    dmg: 15, base: 4.6, scale: 1.04, angle: 50, ox: 44, oy: -2, r: 33,
    onHit(f, d) { magnaMark(f, d); },
    onStart() { Snd.whoosh(1.3); },
    vfx(f) {
      const p = hbAt(f, this);
      // field lines bowing out between the poles of her hand magnet
      for (let i = 0; i < 3; i++) FX.ring(p.x, p.y, 6 + i * 6, 46 + i * 22, i === 1 ? "#5fb4ff" : f.ch.color, 3 - i * 0.6);
      FX.burst(p.x, p.y, 14, f.ch.accent, 5);
      FX.shake(6);
      Snd.tone(120, 0.18, "sawtooth", 0.12, 60);
    } },

  special: { name: "Magnet Pulse", startup: 10, active: 4, recovery: 14,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    reach: 600, tug: 170,
    yank: hitMove("Magnet Pulse", { dmg: 3, base: 3, scale: 0, angle: 20, unblockable: true }),
    desc: "A pulse that yanks every magnetised foe (up to 600 away) straight to her for 3%, ending the mark. Unmagnetised foes close by get a weaker tug.",
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.8; FX.spark(f.x + rnd(-26, 26), f.y + rnd(-30, 20), f.ch.accent); return; }
      if (a.t !== m.startup) return;
      FX.ring(f.x, f.y, 10, m.tug, f.ch.color, 4);
      FX.ring(f.x, f.y, 6, m.tug * 0.7, "#5fb4ff", 2);
      Snd.tone(180, 0.22, "sawtooth", 0.12, 520);
      for (const o of Combat.foes(f)) {
        if (o.intangible()) continue;
        const d = dist(f.x, f.y, o.x, o.y), toward = o.x >= f.x ? -1 : 1;
        if (o.markT > 0 && o.markBy === f && d < m.reach) {
          o.markT = 0; o.markBy = null;
          FX.bolt(o.x, o.y, f.x, f.y, f.ch.accent, { segs: 6, jag: 10, life: 10, w: 2 });
          Combat.land(f, o, m.yank, o.x, o.y, 0, toward);
          // reeled in: the velocity is set so they end up about at her feet
          if (o.state === ST.HITSTUN && o.lastHitBy === f) {
            o.vx = toward * clamp(d * 0.075 + 1, 4, 18);
            o.vy = clamp((f.y - o.y) * 0.05 - 3, -12, 4);
          }
        } else if (d < m.tug) {
          o.vx += toward * 4.5;
          if (!o.grounded) o.vy -= 1;
          FX.streak(o.x, o.y, lerp(o.x, f.x, 0.4), lerp(o.y, f.y, 0.4), f.ch.color);
        }
      }
    } },

  super: { name: "Polar Reversal",
    desc: "Flips her field: a repulsion blast hurls every foe within reach away for 14%. Magnetised foes are caught from much further out and take 22% with extra knockback.",
    startup: 18, active: 6, recovery: 30,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0, radius: 300, magRadius: 520,
    push: { name: "Polar Reversal", dmg: 14, base: 5.2, scale: 0.95, angle: 40, unblockable: true },
    hard: { name: "Polar Reversal", dmg: 22, base: 6.4, scale: 1.12, angle: 38, kbMul: 1.15, unblockable: true },
    onStart(f) { Snd.superCharge(); FX.flash("#e0243c", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) {
        // the field draws in before it flips
        f.vx *= 0.7; f.vy *= 0.7;
        const an = Math.random() * 7, rr = rnd(60, 160);
        FX.streak(f.x + Math.cos(an) * rr, f.y + Math.sin(an) * rr, f.x, f.y, pick([f.ch.color, "#5fb4ff"]));
        return;
      }
      if (a.t !== m.startup) return;
      FX.banner("POLAR REVERSAL", f.ch.color);
      FX.ring(f.x, f.y, 20, m.magRadius, "#5fb4ff", 5);
      FX.ring(f.x, f.y, 14, m.radius, f.ch.color, 7);
      FX.burst(f.x, f.y, 46, f.ch.accent, 13);
      FX.shake(24); FX.punch(0.8); Snd.superHit();
      for (const o of Combat.foes(f)) {
        if (o.intangible()) continue;
        const mag = o.markT > 0 && o.markBy === f;
        if (dist(f.x, f.y, o.x, o.y) > (mag ? m.magRadius : m.radius)) continue;
        if (mag) { o.markT = 0; o.markBy = null; FX.damageText(o.x, o.y - 60, "REPELLED", "#5fb4ff"); }
        Combat.land(f, o, mag ? m.hard : m.push, o.x, o.y);
      }
    } },

  /* ---- art: a long red coat over steel. A horseshoe magnet worn over her
           head like a crest, poles at her ears; iron filings orbiting her,
           and a hand magnet held open-end forward. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#ffc8d0" : c2, deep = A.flash ? "#ffa8b4" : c3;
    const steel = A.flash ? "#ffffff" : "#aab6c8", south = "#5fb4ff";
    const sw = swing(A, -10, 44);
    const live = A.atkKind === "special" || A.atkKind === "super";
    aura(g, 0, -4, 34, c, 0.14 + (live ? 0.14 : 0));

    // iron filings on an orbit around her; they pull in tight when she pulses
    const orb = live ? 22 : 31;
    for (let i = 0; i < 8; i++) {
      const an = A.time * 0.045 + i / 8 * Math.PI * 2;
      g.save(); g.translate(Math.cos(an) * orb * 1.1, -4 + Math.sin(an) * orb * 0.45); g.rotate(an + Math.PI / 2);
      g.fillStyle = INK; g.fillRect(-4, -1.6, 8, 3.2);
      g.fillStyle = i % 3 ? steel : body; g.fillRect(-3, -0.8, 6, 1.6);
      g.restore();
    }

    const st = Math.sin(A.runPhase) * (A.running ? 11 : 0);
    jointLimb(g, -6, 10, -9 + st, 25, -3.5, 6.5, dark);
    jointLimb(g, 6, 10, 10 - st, 25, 3.5, 6.5, dark);
    plateRect(g, -15 + st, 23, 12, 6, 2, steel, { up: 0.3 });
    plateRect(g, 4 - st, 23, 12, 6, 2, steel, { up: 0.3 });

    // the coat, split at the back, and a fitted red jacket over it
    plate(g, [-11, -15, 11, -15, 14, 14, 3, 10, -3, 10, -14, 14], dark, { up: 0.2, down: 0.4, under: true });
    plate(g, [-8, -14, 8, -14, 7, 5, -7, 5], body, { up: 0.36, down: 0.3 });
    // copper coil wound round her waist
    for (let i = 0; i < 4; i++) {
      g.beginPath(); g.ellipse(0, 1 + i * 2.4, 9, 1.6, 0, 0, Math.PI);
      g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
      g.strokeStyle = "#e08a3c"; g.lineWidth = 1.5; g.stroke();
    }
    // a pole badge on the chest: north red, south blue
    g.save(); g.translate(0, -7);
    ink(g, () => { g.beginPath(); g.arc(0, 0, 4.4, 0, 7); }, steel, 2);
    g.fillStyle = "#ff4a5e"; g.beginPath(); g.arc(0, 0, 3, -Math.PI / 2, Math.PI / 2); g.fill();
    g.fillStyle = south; g.beginPath(); g.arc(0, 0, 3, Math.PI / 2, Math.PI * 1.5); g.fill();
    g.restore();
    plate(g, [-9, -16, -17, -14, -15, -7, -9, -8], steel, { up: 0.4, ink: 2.4 });
    plate(g, [9, -16, 17, -14, 15, -7, 9, -8], steel, { up: 0.4, ink: 2.4 });

    // head: a dark bob, a blue visor, and the horseshoe crest
    g.save(); g.translate(1, -25);
    ink(g, () => { g.beginPath(); g.ellipse(0, 0, 7, 7.6, 0, 0, 7); }, vol(g, -8, 8, "#f0cdb4", 0.2, 0.3));
    plate(g, [-8, 3, -8, -6, 0, -9, 7, -6, 8, -1, 3, -4, -3, -3, -5, 5], "#2a1418", { ink: 2, up: 0.3 });
    lens(g, () => roundRect(g, 0.5, -1.4, 6.5, 2.4, 1.1), south, south, 10);
    const crest = () => { g.beginPath(); g.moveTo(-12, 4); g.lineTo(-12, -2); g.arc(0, -2, 12, Math.PI, Math.PI * 2); g.lineTo(12, 4); };
    g.lineCap = "butt";
    crest(); g.strokeStyle = INK; g.lineWidth = 7.4; g.stroke();
    crest(); g.strokeStyle = body; g.lineWidth = 4.6; g.stroke();
    crest(); g.strokeStyle = hexA("#ffffff", 0.3); g.lineWidth = 1.2; g.stroke();
    plateRect(g, -14.4, 2, 4.8, 4.4, 1, steel, { ink: 2, rim: false });
    plateRect(g, 9.6, 2, 4.8, 4.4, 1, steel, { ink: 2, rim: false });
    if (live) glow(g, south, 12, () => {
      g.strokeStyle = hexA(south, 0.8); g.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 6, 9 + i * 3, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
    });
    g.restore();

    jointLimb(g, -9, -11, -15, 0, -3, 5, dark);

    // magnet arm: a steel gauntlet holding a horseshoe, open end forward
    const ax = 14 + sw, ay = -6;
    jointLimb(g, 9, -11, (9 + ax) / 2, ay - 1, 2.5, 5.4, dark);
    limb(g, (9 + ax) / 2, ay - 1, ax - 2, ay, 6.4, mid_(c, c2));
    g.save(); g.translate(ax, ay);
    const hm = () => { g.beginPath(); g.moveTo(14, -6); g.lineTo(6, -6); g.arc(6, 0, 6, -Math.PI / 2, Math.PI / 2, true); g.lineTo(14, 6); };
    g.lineCap = "butt";
    hm(); g.strokeStyle = INK; g.lineWidth = 6.4; g.stroke();
    hm(); g.strokeStyle = body; g.lineWidth = 3.8; g.stroke();
    plateRect(g, 12, -8.2, 4.4, 4.4, 1, steel, { ink: 1.8, rim: false });
    plateRect(g, 12, 3.8, 4.4, 4.4, 1, steel, { ink: 1.8, rim: false });
    plateRect(g, -4, -4.5, 8, 9, 3, steel, { up: 0.3 });
    if (A.atkPhase >= 0 || live) glow(g, south, 10, () => {
      g.strokeStyle = hexA(ac, 0.75); g.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(17, 0, 3 + i * 3, 6 + i * 2.5, 0, -Math.PI / 2, Math.PI / 2); g.stroke(); }
    });
    g.restore();
  },
},

/* ======================================================================== */
/* GLITCH — THE BUG                                                          */
/* ======================================================================== */
{
  id: "GLITCH", name: "GLITCH", tag: "THE BUG",
  blurb: "Not a feature. Shows up where you aren't looking, then crashes your game.",
  power: "Blink teleports her — behind the nearest foe if one is close, otherwise forward — and she's untouchable for a moment. Stack Overflow is five blink-strikes in a row, hopping between foes.",
  color: "#2bff6a", color2: "#0b4a22", color3: "#04200e", accent: "#eafff0",
  weight: 0.82, speed: 5.0, accel: 1.0, jump: 12.9, airSpeed: 4.8, fallMul: 0.96,
  size: { w: 30, h: 52 }, hurt: 24,
  specialCooldown: 90,
  cpuSuperRange: 700,
  cpuSpecial(f, t, d) { return d > 70 && d < 260; },

  light: { name: "Bitflip", startup: 3, active: 3, recovery: 9,
    dmg: 3.4, base: 1.6, scale: 0.42, angle: 46, ox: 36, oy: -8, r: 22,
    vfx(f) {
      const p = hbAt(f, this);
      FX.blade(f.x + f.facing * 8, f.y - 8, faceAng(f), 22, 52, 0.6, f.ch.color, { w: 7, life: 8 });
      FX.spark(p.x - 3, p.y, "#ff2b4a"); FX.spark(p.x + 3, p.y, "#2bd8ff");
      Snd.tone(2200, 0.03, "square", 0.06, 400);
    } },

  heavy: { name: "Segfault", startup: 13, active: 4, recovery: 26,
    dmg: 14, base: 4.4, scale: 1.04, angle: 42, ox: 44, oy: -6, r: 32,
    onStart() { Snd.whoosh(1.2); },
    vfx(f) {
      const p = hbAt(f, this);
      // the memory she wasn't allowed to touch, scattering as blocks
      for (let i = 0; i < 6; i++)
        FX.blade(p.x + rnd(-14, 14), p.y + rnd(-14, 14), faceAng(f) + rnd(-0.6, 0.6), 4, 40, 0.12,
                 pick([f.ch.color, "#ff2b4a", "#2bd8ff"]), { w: 7, life: 10 });
      FX.ring(p.x, p.y, 6, 64, f.ch.color, 3);
      FX.punch(0.4); FX.shake(6);
      Snd.noise(0.14, 0.16, 1800, 3, "bandpass"); Snd.tone(90, 0.12, "square", 0.12, 45);
    } },

  special: { name: "Blink", startup: 5, active: 3, recovery: 12,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0, reach: 280, hop: 150,
    desc: "Teleports: behind the nearest foe within reach, facing their back — or 150 forward if nobody is close. Untouchable for a moment either way, and it leaves a torn afterimage behind.",
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.6; f.vy *= 0.6; return; }
      if (a.t !== m.startup || a.fired) return;
      a.fired = true;
      const t = Combat.nearestFoe(f, m.reach);
      if (t && !t.intangible()) {
        const side = t.x >= f.x ? 1 : -1;
        glitchHop(f, t.x + side * 46, t.y + (t.h - f.h) * 0.5);
        f.facing = -side;
      } else glitchHop(f, f.x + f.facing * m.hop, f.y - (f.grounded ? 4 : 0));
      f.vx = 0; f.vy = Math.min(0, f.vy) * 0.3;
      f.invuln = Math.max(f.invuln, 14);
      FX.ring(f.x, f.y, 4, 46, f.ch.color, 2);
    } },

  super: { name: "Stack Overflow",
    desc: "Five blink-strikes in a row, each one from a different side and hopping between foes: four quick 3.6% hits and a fifth for 8% that launches.",
    startup: 12, active: 58, recovery: 26,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    strike: { name: "Stack Overflow", dmg: 3.6, base: 2.2, scale: 0.3, angle: 70, unblockable: true },
    finale: { name: "Stack Overflow", dmg: 8, base: 4.8, scale: 1.02, angle: 40, unblockable: true },
    onStart(f) { Snd.superCharge(); FX.flash("#2bff6a", 0.3); FX.punch(0.6); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.7; f.vy *= 0.7; return; }
      if (a.t === m.startup) FX.banner("STACK OVERFLOW", f.ch.color);
      const s = a.t - m.startup;
      if (s > 48) return;                         // done hopping: let her fall
      f.vx = 0; f.vy = 0;
      if (s % 11 !== 0) return;
      const foes = Combat.foes(f).filter(o => !o.intangible()).sort((p, q) => p.slot - q.slot);
      if (!foes.length) return;
      const n = s / 11, t = foes[n % foes.length], side = n % 2 ? 1 : -1;
      glitchHop(f, t.x + side * 42, t.y + (t.h - f.h) * 0.5);
      f.facing = -side;
      f.invuln = Math.max(f.invuln, 8);
      FX.blade(t.x, t.y, faceAng(f), 20, 56, 1.4, pick([f.ch.color, "#ff2b4a", "#2bd8ff"]), { w: 9, life: 9 });
      FX.punch(0.3);
      Combat.land(f, t, n === 4 ? m.finale : m.strike, t.x, t.y);
    } },

  /* ---- art: a sprite that doesn't belong in this game. Built from hard
           pixel blocks, drawn three times with its red and blue channels
           torn apart, a slice of her occasionally shearing sideways, and a
           mouse cursor for a weapon. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#d0ffe0" : c2, deep = A.flash ? "#b0f0c8" : c3;
    const sw = swing(A, -10, 42);
    const tk = Math.floor(A.time / 5);
    const tear = hash(tk) > 0.78 ? (hash(tk + 7) - 0.5) * 10 : 0;
    const tearY = -32 + Math.floor(hash(tk + 3) * 7) * 8;
    const shift = y => (y >= tearY && y < tearY + 8 ? tear : 0);
    const st = A.running ? Math.round(Math.sin(A.runPhase) * 2) * 3 : 0;   // stepped, like a sprite
    aura(g, 0, -4, 30, c, 0.12);

    // dead pixels shedding off behind her
    for (let i = 0; i < 5; i++) {
      const h = hash(i * 13 + Math.floor(A.time / 8));
      g.fillStyle = hexA(i % 2 ? c : "#2bd8ff", 0.5 - i * 0.08);
      g.fillRect(-16 - i * 5 - Math.abs(A.vx) * i * 0.8, -26 + h * 40, 3, 3);
    }

    // one list of blocks makes her; it is drawn once per colour channel
    const R = [
      [-9 + st, 10, 6, 13, dark], [3 - st, 10, 6, 13, dark],
      [-11 + st, 21, 9, 5, deep], [2 - st, 21, 9, 5, deep],
      [-15, -12, 5, 13, dark],
      [-10, -14, 20, 25, dark], [-7, -12, 14, 14, body],
      [-8, -32, 16, 15, deep], [-1, -38, 2, 6, deep],
    ];
    g.save(); g.globalCompositeOperation = "lighter";
    const sp = 2 + (A.atkPhase >= 0 ? 1.5 : 0) + Math.abs(tear) * 0.2;
    for (const [col, dx] of [["#ff2b4a", -sp], ["#2bd8ff", sp]]) {
      g.fillStyle = hexA(col, 0.5);
      for (const r of R) g.fillRect(r[0] + dx + shift(r[1]), r[1], r[2], r[3]);
    }
    g.restore();
    for (const r of R) {
      const x = r[0] + shift(r[1]);
      ink(g, () => { g.beginPath(); g.rect(x, r[1], r[2], r[3]); }, r[4], 2.4);
      g.fillStyle = hexA("#ffffff", 0.22); g.fillRect(x, r[1], r[2], 1.5);
    }
    // scanlines and a few lit data bits on the chest
    g.fillStyle = hexA(INK, 0.3);
    for (let y = -11; y < 10; y += 3) g.fillRect(-10 + shift(y), y, 20, 1);
    for (let i = 0; i < 6; i++) if (hash(tk * 0.5 + i * 3.1) > 0.5) {
      g.fillStyle = ac; g.fillRect(-6 + (i % 3) * 4 + shift(-8), -9 + Math.floor(i / 3) * 4, 2.5, 2.5);
    }
    // the face, a little screen: square eyes that sometimes crash to X X
    const hx = shift(-28), crash = hash(tk + 11) > 0.92;
    g.fillStyle = INK; g.fillRect(-6 + hx, -30, 13, 11);
    if (crash) {
      g.strokeStyle = "#ff2b4a"; g.lineWidth = 1.4;
      for (const ex of [0, 5]) { g.beginPath(); g.moveTo(ex + hx, -28); g.lineTo(ex + 3 + hx, -25); g.moveTo(ex + 3 + hx, -28); g.lineTo(ex + hx, -25); g.stroke(); }
    } else {
      lens(g, () => { g.beginPath(); g.rect(0 + hx, -28, 3, 3); }, body, c, 8);
      lens(g, () => { g.beginPath(); g.rect(5 + hx, -28, 3, 3); }, body, c, 8);
    }
    g.fillStyle = body; g.fillRect(1 + hx, -23, 2, 1.5); g.fillRect(3 + hx, -22, 3, 1.5);
    lens(g, () => { g.beginPath(); g.rect(-1.5, -40, 3, 3); }, ac, c, 10);

    // cursor arm: a straight blocky arm, and the pointer at the end of it
    const ax = 14 + sw, ay = -6;
    g.save(); g.translate(7, -10); g.rotate(Math.atan2(ay + 10, ax - 7));
    const len = Math.hypot(ax - 7, ay + 10);
    ink(g, () => { g.beginPath(); g.rect(0, -3, len, 6); }, dark, 2.4);
    g.fillStyle = hexA("#ffffff", 0.2); g.fillRect(0, -3, len, 1.4);
    g.restore();
    g.save(); g.translate(ax + 17, ay - 1); g.rotate(Math.PI / 2 + (A.atkPhase >= 0 ? 0 : 0.5));
    const cur = [0, 0, 0, 16, 4, 12.5, 7, 18.5, 9.5, 17.5, 6.5, 11.5, 11.5, 11.5];
    if (A.atkPhase >= 0) glow(g, c, 14, () => { g.fillStyle = hexA(c, 0.6); poly(g, cur); g.fill(); });
    ink(g, () => poly(g, cur), A.flash ? c : "#ffffff", 2.2);
    g.restore();
  },
},

/* ======================================================================== */
/* GRUDGE — THE BERSERKER                                                    */
/* ======================================================================== */
{
  id: "GRUDGE", name: "GRUDGE", tag: "THE BERSERKER",
  blurb: "Every hit you land is a hit he remembers. He gives them all back.",
  power: "Rage: the more damage he has taken, the harder he hits — up to +35% at 150%. Bottle It Up absorbs a hit and pours it into his next swing.",
  color: "#c26a2e", color2: "#4e2410", color3: "#221006", accent: "#ffd9b8",
  weight: 1.3, speed: 3.9, accel: 0.74, jump: 11.6, airSpeed: 3.6, fallMul: 1.1,
  size: { w: 44, h: 58 }, hurt: 30,
  specialCooldown: 180,
  cpuSuperRange: 260,
  cpuSpecial(f, t, d) { return d < 110 && t.state === ST.ATTACK; },

  light: { name: "Knuckle", startup: 4, active: 3, recovery: 11,
    dmg: 4.2, base: 2.0, scale: 0.5, angle: 40, ox: 40, oy: -6, r: 24,
    onStart(f) { grudgeArm(f, this); },
    vfx(f) {
      const p = hbAt(f, this);
      FX.blade(f.x + f.facing * 12, f.y - 6, faceAng(f), 20, 50, 0.3, f.ch.color, { w: 12, life: 8 });
      if (grudgeRage(f) > 0.4) FX.spark(p.x, p.y, "#ff3b1f");
      Snd.tone(160, 0.05, "square", 0.09, 90);
    } },

  heavy: { name: "Grudge Hammer", startup: 15, active: 4, recovery: 28,
    dmg: 15.5, base: 4.8, scale: 1.06, angle: 55, ox: 42, oy: 2, r: 34,
    onStart(f) { grudgeArm(f, this); Snd.whoosh(1.4); },
    vfx(f) {
      const p = hbAt(f, this), k = grudgeRage(f);
      // a double-fisted overhead smash: the arc comes down, the floor answers
      FX.blade(f.x, f.y - 20, faceAng(f) - 0.9 * f.facing, 34, 74, 1.6, f.ch.color, { w: 14, life: 14, spin: f.facing * 0.1 });
      FX.ring(p.x, p.y + 18, 8, 70 + k * 40, k > 0.4 ? "#ff3b1f" : f.ch.accent, 4);
      FX.burst(p.x, p.y + 14, 16 + Math.round(k * 14), f.ch.color, 6);
      FX.shake(8 + k * 8);
      Snd.bigHit();
    } },

  special: { name: "Bottle It Up", startup: 4, active: 45, recovery: 18,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Braces for up to three quarters of a second. A hit that lands on the brace doesn't move him and does only 40% — and 40% of its full damage (up to +5%) goes into his next light or heavy, with extra knockback.",
    tick(f, a) {
      const m = a.data, v = f.v, end = m.startup + m.active;
      if (a.t === m.startup) {
        v.bp = f.percent;
        for (const e of Entities.list) if (e.kind === "grudge_jar" && e.owner === f) e.dud = true;
        Entities.add("grudge_jar", f, { x: f.x, y: f.y, r: 38, life: m.active + 30 });
        FX.ring(f.x, f.y, 6, 60, "#ffb347", 3);
        Snd.tone(110, 0.2, "sawtooth", 0.1, 160);
      }
      if (a.t >= m.startup && a.t < end) {
        f.pinned = true;                    // see applyKnockback: 40% damage, no knockback
        f.vx *= 0.5;
        if (!f.grounded) f.vy = Math.min(f.vy + 0.5, 6);
        const took = f.percent - v.bp;
        if (took > 1.01) {                  // burn ticks are exactly 1: those don't count
          v.bt = grudgeR1(Math.min(14, (v.bt || 0) + took / 0.4));
          v.sk = f.stocks;
          f.pinned = false;
          a.t = end + 6;                    // he lets go of the brace early
          FX.damageText(f.x, f.y - 60, "BOTTLED", "#ffb347");
          FX.ring(f.x, f.y, 40, 8, "#ff7a1a", 4);
          FX.flash("#ff7a1a", 0.12);
          Snd.tone(70, 0.3, "sawtooth", 0.16, 140);
          return;
        }
      }
      if (a.t >= end) f.pinned = false;
    } },

  super: { name: "Last Straw",
    desc: "He snaps and charges: six pummelling hits that carry whoever is in front of him, then a launcher. About 20% in all — and up to 40% more the more damage he has taken. He won't charge off a ledge.",
    startup: 14, active: 40, recovery: 26,
    dmg: 2.6, base: 1.4, scale: 0.12, angle: 18, ox: 30, oy: -4, r: 38, hits: 6, hitGap: 7, charge: 8.5,
    finale: { dmg: 7, base: 5.4, scale: 1.05, angle: 40 },
    onStart(f) {
      const a = f.attack, k = 1 + 0.4 * grudgeRage(f);
      a.lastHitFrame = -99;                 // re-arms the multi-hit from its first frame
      a.rage = k;
      a.data.dmg = grudgeR1(a.data.dmg * k);
      Snd.superCharge(); FX.flash("#ff3b1f", 0.35);
    },
    vfxRehit(f) {
      FX.blade(f.x + f.facing * 18, f.y + rnd(-14, 6), faceAng(f) + rnd(-0.5, 0.5), 18, 48, 0.4,
               pick([f.ch.color, "#ff3b1f"]), { w: 10, life: 7 });
      Snd.tone(rnd(110, 160), 0.05, "square", 0.1, 70);
    },
    tick(f, a) {
      const m = a.data, su = m.startup;
      if (a.t < su) { f.vx *= 0.6; FX.spark(f.x + rnd(-26, 26), f.y + rnd(-30, 20), "#ff3b1f"); return; }
      if (a.t === su) { FX.banner("LAST STRAW", "#ff3b1f"); FX.shake(12); Snd.bigHit(); }
      if (a.t > su + m.active) return;
      // the last window is the launcher
      if (!a.fin && a.t >= su + m.active - 4) {
        a.fin = true;
        Object.assign(m, m.finale, { dmg: grudgeR1(m.finale.dmg * (a.rage || 1)) });
        f.vx *= 0.3;
        return;
      }
      if (a.fin) return;
      // charge — but never off a ledge
      const ahead = Stage.floorBelow(f.x + f.facing * 46, f.y);
      f.vx = f.grounded && ahead === null ? f.vx * 0.5 : f.facing * m.charge;
      // whoever he's pummelling gets carried along in front of him
      for (const o of Combat.foes(f)) {
        if (o.state !== ST.HITSTUN || o.lastHitBy !== f) continue;
        if (Math.abs(o.x - f.x) > 110 || Math.abs(o.y - f.y) > 80) continue;
        o.vx = f.vx * 1.02; o.vy = -0.6;
      }
      if (a.t % 3 === 0) FX.burst(f.x - f.facing * 16, f.feetY, 3, "#b9b6d8", 2);
    } },

  /* ---- art: a hunched brute in a wolf pelt. A horned helm, a beard, eyes
           that burn hotter the more he is hurt, skin that flushes red, and a
           jug at his hip that fills with whatever he has bottled up. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const rage = clamp((A.percent || 0) / 150, 0, 1), hot = "#ff3b1f";
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#ffd8c0" : c2, deep = A.flash ? "#ffc0a0" : c3;
    const skin = A.flash ? "#ffffff" : mixColor("#c98b62", "#d9483a", rage * 0.55);
    const sw = swing(A, -12, 46);
    const brace = A.atkKind === "special";
    aura(g, 0, -6, 34 + rage * 28, rage > 0.05 ? hot : c, 0.08 + rage * 0.3);

    // rage licks up off his shoulders
    if (rage > 0.25) {
      g.save(); g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i++) {
        const x = -18 + i * 12, h = 8 + rage * 14 + Math.sin(A.time * 0.4 + i * 2) * 4;
        g.fillStyle = hexA(i % 2 ? "#ffb347" : hot, 0.35 + rage * 0.35);
        poly(g, [x - 4, -16, x + 4, -16, x + Math.sin(A.time * 0.2 + i) * 3, -16 - h]); g.fill();
      }
      g.restore();
    }

    const st = Math.sin(A.runPhase) * (A.running ? 9 : 0);
    jointLimb(g, -9, 10, -13 + st, 25, -4, 10, dark);
    jointLimb(g, 9, 10, 13 - st, 25, 4, 10, dark);
    plateRect(g, -20 + st * 0.6, 23, 15, 7, 2.5, deep, { up: 0.2 });
    plateRect(g, 5 - st * 0.6, 23, 15, 7, 2.5, deep, { up: 0.2 });

    // bare barrel chest, scarred; a belt and a hide kilt
    plate(g, [-17, -16, 17, -16, 14, 6, -14, 6], skin, { up: 0.3, down: 0.36, under: true });
    g.strokeStyle = hexA(INK, 0.35); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 4); g.stroke();
    g.beginPath(); g.arc(-6, -8, 6, 0.2, 2.6); g.stroke(); g.beginPath(); g.arc(6, -8, 6, 0.5, 2.9); g.stroke();
    g.strokeStyle = hexA("#ffe0d0", 0.55); g.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-10 + i * 4, -6 + i); g.lineTo(-4 + i * 4, -12 + i); g.stroke(); }
    plate(g, [-14, 9, 14, 9, 17, 21, 6, 18, 0, 22, -6, 18, -17, 21], body, { up: 0.2, down: 0.4 });
    plate(g, [-15, 4, 15, 4, 15, 9, -15, 9], deep, { ink: 2.2, rim: false });
    plateRect(g, -3, 3.5, 6, 6, 1.5, "#c9a24a", { ink: 1.8, up: 0.3 });

    // the jug: fills with whatever he has bottled, and glows while it's full
    const bt = clamp(((A.v && A.v.bt) || 0) / 14, 0, 1);
    g.save(); g.translate(-17, 10);
    if (bt > 0) aura(g, 0, 4, 18, "#ff7a1a", 0.3 + bt * 0.3);
    ink(g, () => roundRect(g, -5, -1, 10, 12, 4), "#5a4636", 2.2);
    if (bt > 0) {
      g.save(); roundRect(g, -4, 0, 8, 10, 3); g.clip();
      g.fillStyle = "#ffb347"; g.fillRect(-4, 10 - bt * 10, 8, bt * 10);
      g.restore();
    }
    plateRect(g, -2, -4, 4, 3.4, 1, "#a07850", { ink: 1.6, rim: false });   // the cork
    g.restore();

    // the wolf pelt over his shoulders
    plate(g, [-22, -12, -18, -20, -8, -22, 0, -19, 8, -22, 18, -20, 22, -12, 17, -8, 12, -12, 6, -9,
              0, -13, -6, -9, -12, -12, -17, -8], "#5a3a22", { up: 0.3, down: 0.3, ink: 2.6 });

    // head set low between the shoulders: helm, horns, beard, burning eyes
    g.save(); g.translate(2, -26);
    ink(g, () => roundRect(g, -7, -7, 14, 13, 5), vol(g, -7, 6, skin, 0.2, 0.3));
    plate(g, [-7, 1, 8, 1, 6, 9, 1, 12, -4, 9], "#3a2418", { ink: 2, up: 0.2 });
    lens(g, () => roundRect(g, 1, -3, 5.4, 2, 1), mixColor("#ffffff", hot, rage), hot, 4 + rage * 16);
    g.fillStyle = INK; poly(g, [-1, -5.4, 8, -3.8, 8, -2.6, -1, -3.8]); g.fill();
    plate(g, [-8, -4, 8, -4, 7, -9, 0, -12, -7, -9], "#6b6f7a", { up: 0.4 });
    plate(g, [-6, -8, -11, -10, -15, -19, -11, -15, -8, -12], "#efe3c8", { ink: 2, up: 0.3 });
    plate(g, [6, -8, 11, -10, 14, -19, 11, -15, 8, -12], "#efe3c8", { ink: 2, up: 0.3 });
    g.restore();

    if (brace) {
      // arms crossed in a guard: he's taking it
      limb(g, -15, -12, 9, -4, 9, skin);
      limb(g, 15, -12, -9, -4, 9, shade(skin, -0.1));
      plateRect(g, 6, -9, 10, 10, 4, "#e8dcc4", { up: 0.3 });
      plateRect(g, -16, -9, 10, 10, 4, "#e8dcc4", { up: 0.3 });
      return;
    }
    jointLimb(g, -15, -12, -21, 4, -4, 9, skin);
    plateRect(g, -26, 2, 10, 10, 4, "#e8dcc4", { up: 0.3 });

    // punching arm, a bandaged fist that glows while a hit is bottled
    const ax = 18 + sw, ay = -4;
    jointLimb(g, 14, -12, (14 + ax) / 2, ay - 2, 2, 9, skin);
    limb(g, (14 + ax) / 2, ay - 2, ax - 3, ay, 10, shade(skin, -0.12));
    if (bt > 0) aura(g, ax + 1, ay, 16, "#ff7a1a", 0.5);
    plateRect(g, ax - 5, ay - 6, 12, 12, 4, "#e8dcc4", { up: 0.3 });
    g.strokeStyle = hexA("#8a7a60", 0.8); g.lineWidth = 1;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(ax - 4, ay - 4 + i * 4); g.lineTo(ax + 6, ay - 2 + i * 4); g.stroke(); }
  },
},

/* ======================================================================== */
/* PRISM — THE REFRACTOR                                                     */
/* ======================================================================== */
{
  id: "PRISM", name: "PRISM", tag: "THE REFRACTOR",
  blurb: "Bends light for a living. Every angle is the right one.",
  power: "Refract fires a beam down at an angle that bounces off the floor and back up — it hits from below. Spectrum sweeps a huge beam over the top of the stage, hitting each foe once.",
  color: "#7ae7ff", color2: "#1b3f66", color3: "#0a1a2e", accent: "#ffffff",
  weight: 0.9, speed: 4.4, accel: 0.9, jump: 12.4, airSpeed: 4.4, fallMul: 0.98,
  size: { w: 32, h: 56 }, hurt: 25,
  specialCooldown: 100,
  cpuSuperRange: 900,
  cpuSpecial(f, t, d) { return Math.sign(t.x - f.x) === f.facing && d > 110 && d < 460; },

  light: { name: "Facet Jab", startup: 3, active: 3, recovery: 9,
    dmg: 3.6, base: 1.7, scale: 0.43, angle: 45, ox: 38, oy: -8, r: 22,
    vfx(f) {
      FX.blade(f.x + f.facing * 10, f.y - 8, faceAng(f), 24, 54, 0.35, f.ch.color, { w: 7, life: 9 });
      FX.spark(hbAt(f, this).x, f.y - 8, pick(PRISM_RAINBOW));
      Snd.tone(2600, 0.04, "triangle", 0.06, 3200);
    } },

  heavy: { name: "Focal Point", startup: 14, active: 4, recovery: 26,
    dmg: 15, base: 4.6, scale: 1.05, angle: 38, ox: 50, oy: -6, r: 30,
    onStart() { Snd.tone(900, 0.24, "sine", 0.08, 2400); },
    vfx(f) {
      const p = hbAt(f, this);
      // six coloured rays converge on the point, and it bursts white
      for (let i = 0; i < 6; i++) {
        const an = (i / 6) * Math.PI * 2;
        FX.streak(p.x + Math.cos(an) * 60, p.y + Math.sin(an) * 60, p.x, p.y, PRISM_RAINBOW[i]);
      }
      FX.ring(p.x, p.y, 6, 70, "#ffffff", 4);
      FX.burst(p.x, p.y, 18, f.ch.color, 6);
      FX.flash("#ffffff", 0.08); FX.shake(6);
      Snd.tone(2400, 0.1, "triangle", 0.1, 600);
    } },

  special: { name: "Refract", startup: 9, active: 2, recovery: 18,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Fires a beam down at an angle. It bounces once off the first floor or platform it meets and carries on upward, piercing — 7% to anyone it passes through.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      Entities.add("prism_ray", f, { x: f.x + f.facing * 20, y: f.y - 12, vx: f.facing * 12, vy: 5.5, dir: f.facing,
        r: 12, life: 90, move: hitMove("Refract", { dmg: 7, base: 2.8, scale: 0.55, angle: 55 }) });
      FX.ring(f.x + f.facing * 20, f.y - 12, 4, 30, "#ffffff", 2);
      Snd.tone(1800, 0.12, "triangle", 0.09, 3000);
    } },

  super: { name: "Spectrum",
    desc: "Splits a beam the width of the stage and sweeps it from behind her, over the top, to the floor in front. Anyone it touches takes 21% — once each.",
    startup: 16, active: 72, recovery: 24,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    beam: { name: "Spectrum", dmg: 21, base: 6.2, scale: 1.08, angle: 50, unblockable: true },
    onStart(f) { Snd.superCharge(); FX.flash("#7ae7ff", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) {
        f.vx *= 0.7; f.vy *= 0.7;
        FX.spark(f.x + rnd(-30, 30), f.y + rnd(-40, 20), pick(PRISM_RAINBOW));
        return;
      }
      if (a.t === m.startup) {
        FX.banner("SPECTRUM", f.ch.color);
        Entities.add("prism_sweep", f, { x: f.x, y: f.y - 14, dir: f.facing, r: 24, w: 1100, life: m.active,
          move: m.beam });
        FX.shake(10); Snd.superHit();
      }
      f.vx *= 0.6; f.vy *= 0.5;            // she holds still while the beam turns
      if (a.t % 8 === 0) Snd.tone(600 + (a.t - m.startup) * 12, 0.08, "sine", 0.06);
    } },

  /* ---- art: a crystal figure. A triangular prism for a head with a white
           beam going in one side and a rainbow fanning out the other,
           faceted glass for a body, and a diamond held at the fingertips. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#d8f6ff" : c2, deep = A.flash ? "#b8eaff" : c3;
    const sw = swing(A, -8, 42);
    aura(g, 0, -6, 34, c, 0.16);

    // shards orbiting her
    for (let i = 0; i < 3; i++) {
      const an = A.time * 0.04 + i * 2.09;
      g.save(); g.translate(Math.cos(an) * 24, -8 + Math.sin(an) * 10); g.rotate(an);
      plate(g, [0, -4, 2.6, 0, 0, 4, -2.6, 0], i === 1 ? "#ffffff" : body, { ink: 1.6, up: 0.3, rim: false });
      g.restore();
    }

    // legs: two tapering crystal shards
    const st = Math.sin(A.runPhase) * (A.running ? 11 : 0);
    plate(g, [-8, 7, -2, 7, -4 + st, 27, -9 + st, 27], dark, { up: 0.3, ink: 2.4 });
    plate(g, [2, 7, 8, 7, 10 - st, 27, 5 - st, 27], dark, { up: 0.3, ink: 2.4 });

    // body: a cut gem, with a rainbow glint sliding across its facets
    const gem = [-11, -15, 11, -15, 7, 0, 0, 10, -7, 0];
    plate(g, gem, body, { up: 0.4, down: 0.3, under: true });
    g.save(); poly(g, gem); g.clip();
    const gl = (A.time * 0.8) % 50 - 25;
    for (let i = 0; i < 6; i++) { g.fillStyle = hexA(PRISM_RAINBOW[i], 0.4); g.fillRect(gl + i * 2.4, -16, 2.4, 28); }
    g.strokeStyle = hexA("#ffffff", 0.55); g.lineWidth = 1;
    g.beginPath(); g.moveTo(-11, -15); g.lineTo(0, -4); g.lineTo(11, -15);
    g.moveTo(-7, 0); g.lineTo(0, -4); g.lineTo(7, 0); g.moveTo(0, -4); g.lineTo(0, 10); g.stroke();
    g.restore();
    plate(g, [-12, -16, -19, -19, -15, -9], "#ffffff", { ink: 2, up: 0.2, rim: false });
    plate(g, [12, -16, 19, -19, 15, -9], "#ffffff", { ink: 2, up: 0.2, rim: false });

    // head: the prism. White light in the back, a spectrum out the front.
    g.save(); g.translate(1, -28);
    g.save(); g.globalCompositeOperation = "lighter";
    g.strokeStyle = hexA("#ffffff", 0.7); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-20, 2); g.lineTo(-4, -1); g.stroke();
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = hexA(PRISM_RAINBOW[i], 0.8); g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(4, -1); g.lineTo(20, -6 + i * 2.6 + (A.atkPhase >= 0 ? (i - 2.5) * 1.4 : 0)); g.stroke();
    }
    g.restore();
    plate(g, [0, -11, 10, 7, -10, 7], body, { up: 0.5, down: 0.2, ink: 2.6 });
    g.fillStyle = hexA("#ffffff", 0.45); poly(g, [0, -11, -10, 7, -3, 7]); g.fill();
    lens(g, () => { g.beginPath(); g.arc(1, 1.5, 2, 0, 7); }, "#ffffff", c, 12);
    g.restore();

    jointLimb(g, -8, -12, -14, -1, -3, 4.4, dark);

    // casting arm: a diamond spinning at the fingertips
    const ax = 13 + sw, ay = -6;
    jointLimb(g, 8, -12, (8 + ax) / 2, ay - 1, 2.5, 4.6, dark);
    limb(g, (8 + ax) / 2, ay - 1, ax - 2, ay, 5.2, mid_(c, c2));
    g.save(); g.translate(ax + 6, ay); g.rotate(A.time * 0.06);
    plate(g, [0, -6, 4, 0, 0, 6, -4, 0], "#ffffff", { ink: 2, up: 0.2 });
    g.restore();
    if (A.atkPhase >= 0) {
      g.save(); g.globalCompositeOperation = "lighter"; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        g.strokeStyle = hexA(PRISM_RAINBOW[i], 0.8);
        g.beginPath(); g.moveTo(ax + 8, ay); g.lineTo(ax + 32, ay - 9 + i * 3.6); g.stroke();
      }
      g.restore();
    }
    ink(g, () => { g.beginPath(); g.arc(ax, ay, 3, 0, 7); }, deep, 1.6);
  },
},
];

WAVE3A.forEach(c => { CHAR_BY_ID[c.id] = c; });
ROSTER.push(...WAVE3A);
