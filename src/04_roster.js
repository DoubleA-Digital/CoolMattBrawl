/* ==========================================================================
   5. ROSTER — four fighters, each with their own art and their own moveset

   Every character owns:
     stats    weight / speed / jump, which also decide how hard they tilt a stage
     moves    light, heavy, special and super — none of them shared templates
     draw()   a bespoke silhouette, not one body in four colours

   Move frame data:
     startup/active/recovery  frames
     dmg/base/scale/angle     knockback maths (angle in degrees, 0 = straight out)
     ox/oy/r                  hitbox offset from the fighter's centre, radius
     hits/hitGap              optional multi-hit
     onStart(f) / tick(f,a)   optional behaviour hooks
   ========================================================================== */

/* ---------- shared drawing kit (local space: origin = fighter centre,
               already flipped so +x is always "forward") ---------- */
function limb(g, x1, y1, x2, y2, w, col) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round";
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}
function jointLimb(g, x1, y1, x2, y2, bend, w, col) {
  const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2;
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(mx, my); g.lineTo(x2, y2); g.stroke();
}
function rivets(g, x, y, n, step, col) {
  g.fillStyle = col;
  for (let i = 0; i < n; i++) { g.beginPath(); g.arc(x + i * step, y, 1.3, 0, 7); g.fill(); }
}

/* Reach of a swing arm, eased so attacks snap out and drift back. */
function swing(A, back, out) {
  if (A.atkPhase < 0) return 0;
  const p = A.atkPhase;
  return p < 0.3 ? lerp(0, back, easeOut(p / 0.3))
       : p < 0.5 ? lerp(back, out, easeOut((p - 0.3) / 0.2))
       : lerp(out, 0, easeIn((p - 0.5) / 0.5));
}

const ROSTER = [

/* ======================================================================== */
/* BOLDER — THE ANVIL                                                        */
/* ======================================================================== */
{
  id: "BOLDER", name: "BOLDER", tag: "THE ANVIL",
  blurb: "Walks like furniture, hits like a dropped engine. His weight alone bends the stage.",
  color: "#ff2e88", color2: "#6d1038", color3: "#2b0a1a", accent: "#ffd0e4",
  weight: 1.42, speed: 3.05, accel: 0.52, jump: 11.6, airSpeed: 2.9, fallMul: 1.12,
  size: { w: 46, h: 60 }, hurt: 31,
  specialCooldown: 70,

  light: { name: "Piston Jab", startup: 4, active: 4, recovery: 9,
    dmg: 4.5, base: 2.2, scale: 0.55, angle: 42, ox: 42, oy: -6, r: 28 },

  heavy: { name: "Seismic Swing", startup: 14, active: 5, recovery: 23,
    dmg: 18, base: 5.2, scale: 1.14, angle: 32, ox: 58, oy: -2, r: 44,
    onStart(f) { Snd.whoosh(1.6); } },

  special: { name: "Quake Drop", startup: 8, active: 10, recovery: 20,
    dmg: 13, base: 4.0, scale: 0.86, angle: 78, ox: 0, oy: 30, r: 76,
    desc: "Drops like an anvil. The impact hammers the stage's tilt toward his side.",
    onStart(f) { f.vy = f.grounded ? -3 : 4; },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) f.vy = Math.min(f.vy + 1.7, 22);
      if (a.t === m.startup) {
        f.heavyStomp = 26;
        Snd.bigHit(); FX.shake(16); FX.hitPause(5);
        FX.ring(f.x, f.feetY, 14, 200, f.ch.color, 3);
        FX.burst(f.x, f.feetY, 24, f.ch.color, 7);
        FX.dustLine(f.x, f.feetY, 220, f.ch.color);
        Stage.nudge(Math.sign(f.x - Stage.pivot.x || 1) * 0.034 * f.ch.weight);
        Stage.lastPusher = f;
        f.vy = -4;
      }
    } },

  super: { name: "Tectonic Verdict",
    desc: "Rears up and splits the stage. Two shockwaves run the whole deck and the pivot takes everything.",
    startup: 22, active: 26, recovery: 28,
    dmg: 26, base: 7.5, scale: 1.5, angle: 50, ox: 0, oy: 26, r: 120,
    onStart(f) { f.vy = -9; Snd.superCharge(); FX.flash("#ff2e88", 0.35); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.8; f.vy = Math.max(f.vy, -9) + 0.35; FX.spark(f.x + rnd(-30, 30), f.y + rnd(-40, 40), f.ch.color); }
      if (a.t === m.startup) {
        f.vy = 32;                                    // the drop
        FX.flash("#ffffff", 0.5);
      }
      if (a.t > m.startup && a.t < m.startup + 10 && !a.landed) {
        if (f.grounded || f.y > Stage.pivot.y) {
          a.landed = true;
          Snd.superHit(); FX.shake(34); FX.hitPause(14);
          FX.ring(f.x, f.feetY, 20, 520, "#ffffff", 5);
          FX.ring(f.x, f.feetY, 10, 340, f.ch.color, 4);
          FX.burst(f.x, f.feetY, 46, f.ch.color, 13);
          Entities.shockwave(f, f.x, f.feetY, -1, m);
          Entities.shockwave(f, f.x, f.feetY, 1, m);
          Stage.nudge(Math.sign(f.x - Stage.pivot.x || 1) * 0.055);
          Stage.lastPusher = f;
        }
      }
    } },

  /* ---- art: wide trapezoid chassis, head sunk into the shoulders, anvil fists ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const sw = swing(A, -10, 46);
    const body = A.flash ? "#ffffff" : c;
    const dark = A.flash ? "#ffb9d4" : c2;

    // --- legs: short, thick, planted wide ---
    const st = Math.sin(A.runPhase) * (A.running ? 9 : 0);
    const kneeL = A.air ? 5 : 0;
    jointLimb(g, -8, 10, -12 + st, 29 - kneeL, -3, 11, dark);
    jointLimb(g, 9, 10, 13 - st, 29 - kneeL, 3, 11, dark);
    g.fillStyle = c3;
    roundRect(g, -19 + st * 0.6, 26 - kneeL, 15, 7, 2); g.fill();
    roundRect(g, 5 - st * 0.6, 26 - kneeL, 15, 7, 2); g.fill();

    // --- torso: wide shoulders tapering to a narrow waist ---
    g.fillStyle = body;
    poly(g, [-22, -16, 22, -16, 15, 13, -15, 13]); g.fill();
    // chest plate + rivets
    g.fillStyle = dark;
    poly(g, [-16, -12, 16, -12, 12, 2, -12, 2]); g.fill();
    rivets(g, -12, -9, 7, 4, ac);
    // waist belt
    g.fillStyle = c3; g.fillRect(-15, 4, 30, 5);
    g.fillStyle = ac; g.fillRect(-4, 4, 8, 5);

    // --- pauldrons ---
    g.fillStyle = body;
    poly(g, [-26, -20, -10, -22, -8, -8, -24, -6]); g.fill();
    poly(g, [26, -20, 10, -22, 8, -8, 24, -6]); g.fill();
    g.fillStyle = dark;
    poly(g, [24, -19, 12, -20, 11, -14, 23, -13]); g.fill();

    // --- head: small, low, single visor slit ---
    g.fillStyle = body;
    roundRect(g, -9, -30, 18, 15, 5); g.fill();
    g.fillStyle = c3; roundRect(g, -10, -24, 20, 5, 2); g.fill();
    glow(g, ac, 12, () => { g.fillStyle = ac; g.fillRect(-1, -24, 9, 4); });

    // --- arms: stubby, ending in anvil gauntlets ---
    const ax = 18 + sw, ay = -4 + (A.atkPhase >= 0 ? -3 : 0);
    jointLimb(g, 16, -12, ax, ay, 2, 9, dark);
    jointLimb(g, -16, -12, -20 - (A.running ? st * 0.4 : 0), 2, -3, 9, dark);
    // the anvil fist
    g.save(); g.translate(ax, ay);
    g.fillStyle = body;
    poly(g, [-9, -11, 13, -13, 15, 10, -7, 12]); g.fill();
    g.fillStyle = c3; g.fillRect(-7, -4, 18, 4);
    g.fillStyle = ac; g.fillRect(9, -9, 5, 16);
    g.restore();
    // back fist
    g.fillStyle = dark;
    g.beginPath(); g.arc(-21, 3, 7, 0, 7); g.fill();
  },
},

/* ======================================================================== */
/* ZIP — THE SPARK                                                           */
/* ======================================================================== */
{
  id: "ZIP", name: "ZIP", tag: "THE SPARK",
  blurb: "Barely registers on the pivot and barely stays still. Dies to one clean read.",
  color: "#00e5ff", color2: "#07475a", color3: "#04232e", accent: "#eafdff",
  weight: 0.74, speed: 5.65, accel: 1.05, jump: 12.9, airSpeed: 5.3, fallMul: 0.9,
  size: { w: 30, h: 50 }, hurt: 24,
  specialCooldown: 60,

  // three fast taps instead of one poke
  light: { name: "Spark Flurry", startup: 2, active: 12, recovery: 7,
    dmg: 2.4, base: 1.1, scale: 0.26, angle: 52, ox: 32, oy: -8, r: 23,
    hits: 3, hitGap: 4 },

  heavy: { name: "Volt Lance", startup: 9, active: 5, recovery: 18,
    dmg: 12, base: 3.6, scale: 0.98, angle: 38, ox: 52, oy: -6, r: 30,
    onStart(f) { f.vx += f.facing * 5.5; Snd.whoosh(1.2); } },

  special: { name: "Polarity Flip", startup: 4, active: 12, recovery: 12,
    dmg: 7, base: 2.6, scale: 0.6, angle: 58, ox: 24, oy: -6, r: 28,
    desc: "Dashes clean through anyone in the way and inverts the stage's tilt on the spot.",
    onStart(f) { f.vx = f.facing * 15; f.vy *= 0.2; },
    tick(f, a) {
      const m = a.data;
      if (a.t <= m.startup + m.active) {
        f.vx = f.facing * 15 * (1 - (a.t / (m.startup + m.active)) * 0.5);
        f.vy *= 0.6;
        FX.spark(f.x, f.y, f.ch.color);
      }
      if (a.t === m.startup + 1 && !a.fired) {
        a.fired = true;
        Stage.flip(); Stage.lastPusher = f;
        f.flipGlow = 30; Snd.tone(300, 0.22, "square", 0.17, 1200);
        FX.ring(Stage.pivot.x, Stage.pivot.y, 30, 440, f.ch.color, 3);
        FX.banner("POLARITY FLIP", f.ch.color);
        FX.shake(9);
      }
    } },

  super: { name: "Lightspeed Gauntlet",
    desc: "Becomes a line of afterimages. Eight strikes on whoever is closest, then a launcher.",
    startup: 12, active: 56, recovery: 20,
    dmg: 4.2, base: 1.2, scale: 0.24, angle: 60, ox: 0, oy: -6, r: 40,
    onStart(f) { Snd.superCharge(); FX.flash("#00e5ff", 0.3); f.vy = -3; },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.7; f.vy *= 0.7; FX.spark(f.x + rnd(-24, 24), f.y + rnd(-26, 26), f.ch.color); }
      if (a.t < m.startup || a.t > m.startup + m.active) return;

      const tgt = Combat.nearestFoe(f);
      if (!tgt) return;
      const step = a.t - m.startup;
      // teleport to a new angle around the target every 7 frames, and strike
      if (step % 7 === 0) {
        const n = step / 7;
        const ang = n * 2.3;
        const rad = 56;
        f.x = tgt.x + Math.cos(ang) * rad;
        f.y = tgt.y + Math.sin(ang) * rad * 0.6;
        f.vx = 0; f.vy = 0;
        f.facing = tgt.x >= f.x ? 1 : -1;
        a.hitIds = null;                     // each blink is a fresh hit
        FX.streak(f.x, f.y, tgt.x, tgt.y, f.ch.color);
        FX.burst(f.x, f.y, 6, f.ch.color, 4);
        Snd.tone(900 + n * 90, 0.05, "square", 0.12, 400);
        FX.hitPause(2);
      }
      f.vx = 0; f.vy = 0;                    // frozen mid-super
      if (step === m.active - 1) {           // the finisher
        a.data = Object.assign({}, m, { dmg: 16, base: 5.5, scale: 1.25, angle: 48, r: 70 });
        a.hitIds = null;
        Snd.superHit(); FX.shake(22); FX.hitPause(12);
        FX.ring(f.x, f.y, 14, 300, "#ffffff", 4);
      }
    } },

  /* ---- art: thin, forward-raked, trailing energy ribbons ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c;
    const dark = A.flash ? "#bfefff" : c2;
    const sw = swing(A, -8, 40);

    // --- trailing ribbons (behind everything) ---
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      g.globalAlpha = 0.30 - i * 0.07;
      g.strokeStyle = c; g.lineWidth = 3 - i * 0.6; g.lineCap = "round";
      g.beginPath();
      g.moveTo(-8, -14 + i * 7);
      for (let s = 1; s <= 4; s++) {
        const px = -8 - s * 9;
        const py = -14 + i * 7 + Math.sin(A.time * 0.14 + s * 0.8 + i) * (4 + s * 1.6);
        g.lineTo(px, py);
      }
      g.stroke();
    }
    g.restore();

    // --- legs: long, thin, sharp ---
    const st = Math.sin(A.runPhase) * (A.running ? 14 : 0);
    jointLimb(g, -4, 8, -7 + st, 25, -4, 5.5, dark);
    jointLimb(g, 5, 8, 8 - st, 25, 4, 5.5, dark);
    g.fillStyle = ac;
    poly(g, [-11 + st, 23, -3 + st, 23, -5 + st, 27]); g.fill();
    poly(g, [4 - st, 23, 12 - st, 23, 10 - st, 27]); g.fill();

    // --- torso: narrow wedge, raked forward ---
    g.save(); g.rotate(A.running ? 0.12 : 0.05);
    g.fillStyle = body;
    poly(g, [-10, -14, 12, -16, 9, 10, -8, 9]); g.fill();
    g.fillStyle = dark;
    poly(g, [-7, -11, 9, -12, 7, 0, -6, 0]); g.fill();
    // lightning emblem
    glow(g, ac, 10, () => {
      g.fillStyle = ac;
      poly(g, [2, -10, -3, -2, 1, -2, -3, 6, 5, -3, 1, -3]); g.fill();
    });
    g.restore();

    // --- head: swept wedge helmet with a long visor ---
    g.save(); g.translate(1, -25); g.rotate(0.06);
    g.fillStyle = body;
    poly(g, [-9, -7, 8, -9, 12, 2, -8, 6]); g.fill();
    // back fin
    g.fillStyle = dark;
    poly(g, [-8, -6, -17, -2, -8, 3]); g.fill();
    glow(g, c, 14, () => {
      g.fillStyle = A.flash ? "#ff2e88" : ac;
      poly(g, [-2, -4, 10, -2, 10, 2, -3, 1]); g.fill();
    });
    g.restore();

    // --- arms: thin, with spark gloves ---
    const ax = 14 + sw, ay = -6;
    jointLimb(g, 8, -10, ax, ay, 3, 5, dark);
    jointLimb(g, -7, -10, -14 - (A.running ? st * 0.3 : 0), -1, -3, 5, dark);
    glow(g, c, A.atkPhase >= 0 ? 18 : 8, () => {
      g.fillStyle = ac;
      g.beginPath(); g.arc(ax, ay, 4.6, 0, 7); g.fill();
    });
    g.fillStyle = dark;
    g.beginPath(); g.arc(-15, 0, 4, 0, 7); g.fill();
  },
},

/* ======================================================================== */
/* ORBIT — THE KEEL                                                          */
/* ======================================================================== */
{
  id: "ORBIT", name: "ORBIT", tag: "THE KEEL",
  blurb: "Fights at arm's length and can bolt the pivot flat when the stage stops cooperating.",
  color: "#b6ff3b", color2: "#2f5410", color3: "#152806", accent: "#f4ffdd",
  weight: 1.02, speed: 4.25, accel: 0.78, jump: 12.1, airSpeed: 4.0, fallMul: 1.0,
  size: { w: 36, h: 54 }, hurt: 27,
  specialCooldown: 480,

  light: { name: "Ring Cut", startup: 3, active: 4, recovery: 7,
    dmg: 3.8, base: 1.8, scale: 0.44, angle: 46, ox: 38, oy: -8, r: 27 },

  heavy: { name: "Satellite Slam", startup: 12, active: 4, recovery: 20,
    dmg: 15.5, base: 4.4, scale: 1.06, angle: 70, ox: 40, oy: -14, r: 38,
    onStart(f) { Snd.whoosh(1.3); } },

  special: { name: "Keel Anchor", startup: 7, active: 6, recovery: 16,
    dmg: 6, base: 2.4, scale: 0.5, angle: 20, ox: 34, oy: -10, r: 24,
    desc: "Bolts the stage dead level for three seconds and fires an orb down the flat deck.",
    tick(f, a) {
      const m = a.data;
      if (a.t === m.startup && !a.fired) {
        a.fired = true;
        // The orb always fires; the lock only takes if the stage is free, so
        // two Orbits can't chain anchors and flatten the pivot all match.
        if (Stage.anchorTimer <= 0) {
          Stage.anchor();
          f.anchorGlow = Stage.anchorFrames;
          Snd.tone(120, 0.5, "sine", 0.2, 90); Snd.tone(240, 0.4, "triangle", 0.1, 180);
          FX.ring(Stage.pivot.x, Stage.pivot.y, 20, 380, f.ch.color, 3);
          FX.banner("KEEL ANCHOR", f.ch.color);
        }
        Entities.orb(f, f.x + f.facing * 30, f.y - 10, f.facing * 11, -1.2, m);
      }
    } },

  super: { name: "Event Horizon",
    desc: "Opens a well that drags every fighter in, holds them there, then collapses.",
    startup: 16, active: 74, recovery: 24,
    dmg: 30, base: 8, scale: 1.4, angle: 62, ox: 0, oy: 0, r: 0,
    onStart(f) { Snd.superCharge(); FX.flash("#b6ff3b", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.8; FX.spark(f.x + rnd(-30, 30), f.y + rnd(-30, 30), f.ch.color); }
      if (a.t === m.startup && !a.fired) {
        a.fired = true;
        const wx = f.x + f.facing * 150, wy = f.y - 40;
        Entities.well(f, wx, wy, m);
        FX.banner("EVENT HORIZON", f.ch.color);
        FX.shake(10);
      }
      f.vx *= 0.86;
    } },

  /* ---- art: calm, symmetrical, with a real orbiting halo ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c;
    const dark = A.flash ? "#e4ffb9" : c2;
    const sw = swing(A, -8, 40);
    const spin = A.time * 0.05;

    // --- back half of the halo ring ---
    const ringR = 27, tiltY = 0.36;
    g.save();
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = hexA(c, 0.55); g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, -2, ringR, ringR * tiltY, 0.22, Math.PI, Math.PI * 2); g.stroke();
    g.restore();

    // --- lower body: a keel skirt instead of legs ---
    const sway = Math.sin(A.runPhase * 0.5) * (A.running ? 3 : 1);
    g.fillStyle = dark;
    poly(g, [-10, 2, 10, 2, 15 + sway, 27, -15 + sway, 27]); g.fill();
    g.fillStyle = c3;
    poly(g, [-13 + sway, 22, 13 + sway, 22, 15 + sway, 27, -15 + sway, 27]); g.fill();
    g.strokeStyle = hexA(ac, 0.5); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(0, 3); g.lineTo(sway, 26); g.stroke();

    // --- torso: rounded, centred gem ---
    g.fillStyle = body;
    roundRect(g, -14, -16, 28, 22, 10); g.fill();
    g.fillStyle = dark;
    roundRect(g, -10, -12, 20, 14, 7); g.fill();
    glow(g, ac, 14, () => {
      g.fillStyle = ac;
      g.beginPath(); g.arc(0, -5, 4.4, 0, 7); g.fill();
    });

    // --- arms ---
    const ax = 16 + sw, ay = -8;
    jointLimb(g, 11, -12, ax, ay, 3, 6.5, dark);
    jointLimb(g, -11, -12, -17, -2, -3, 6.5, dark);
    g.fillStyle = body;
    g.beginPath(); g.arc(ax, ay, 5.4, 0, 7); g.fill();
    g.beginPath(); g.arc(-17, -2, 5, 0, 7); g.fill();

    // --- head: smooth dome, horizontal band ---
    g.fillStyle = body;
    g.beginPath(); g.arc(0, -27, 11.5, 0, 7); g.fill();
    g.fillStyle = c3;
    roundRect(g, -12, -30, 24, 7, 3); g.fill();
    glow(g, ac, 12, () => {
      g.fillStyle = A.flash ? "#ff2e88" : ac;
      roundRect(g, -7, -29, 14, 4, 2); g.fill();
    });

    // --- front half of the halo + two orbiting beads ---
    g.save();
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = hexA(c, 0.85); g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, -2, ringR, ringR * tiltY, 0.22, 0, Math.PI); g.stroke();
    for (let i = 0; i < 2; i++) {
      const an = spin + i * Math.PI;
      const bx = Math.cos(an) * ringR, by = -2 + Math.sin(an) * ringR * tiltY;
      g.fillStyle = ac; g.shadowColor = c; g.shadowBlur = 12;
      g.beginPath(); g.arc(bx, by, 3.2, 0, 7); g.fill();
    }
    g.restore();
  },
},

/* ======================================================================== */
/* PIVOT — THE TRICKSTER                                                     */
/* ======================================================================== */
{
  id: "PIVOT", name: "PIVOT", tag: "THE TRICKSTER",
  blurb: "Does not fight you so much as fight the floor you are standing on.",
  color: "#ffc83d", color2: "#5e3c05", color3: "#2c1c02", accent: "#fff6dc",
  weight: 0.88, speed: 4.6, accel: 0.9, jump: 12.4, airSpeed: 4.5, fallMul: 0.96,
  size: { w: 34, h: 52 }, hurt: 26,
  specialCooldown: 110,

  light: { name: "Fan Slice", startup: 3, active: 3, recovery: 6,
    dmg: 3.2, base: 1.6, scale: 0.4, angle: 48, ox: 36, oy: -8, r: 25 },

  // hitting with this also shoves the pivot, so her neutral feeds her gimmick
  heavy: { name: "Scale Breaker", startup: 11, active: 5, recovery: 20,
    dmg: 13.5, base: 4.0, scale: 1.0, angle: 44, ox: 48, oy: -8, r: 34,
    onHit(f, def) {
      Stage.nudge(Math.sign(def.x - Stage.pivot.x || 1) * 0.016);
      Stage.lastPusher = f;
      FX.ring(def.x, def.y, 8, 90, f.ch.color, 2);
    } },

  special: { name: "Hand on the Scale", startup: 5, active: 40, recovery: 14,
    dmg: 5, base: 2.0, scale: 0.42, angle: 90, ox: 20, oy: -14, r: 26,
    desc: "Hold to crank the tilt wherever she leans. Let go near the limit to force a Snap-Back.",
    tick(f, a, inp) {
      const m = a.data;
      const lean = inp.ax !== 0 ? inp.ax : f.facing;
      if (a.t > m.startup && a.t <= m.startup + m.active) {
        f.crankDir = lean;
        Stage.lastPusher = f;
        f.vx *= 0.6; f.vy *= 0.8;
        if (a.t % 3 === 0) FX.spark(f.x + lean * 26, f.y - 10, f.ch.color);
        if (!inp.held("special")) a.t = m.startup + m.active + 1;
      }
    } },

  super: { name: "Full Tilt",
    desc: "Seizes the pivot outright and forces a Snap-Back. She is the only one bolted down for it.",
    startup: 14, active: 54, recovery: 22,
    dmg: 18, base: 5.5, scale: 1.1, angle: 72, ox: 0, oy: 0, r: 90,
    onStart(f) { Snd.superCharge(); FX.flash("#ffc83d", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.8; FX.spark(f.x + rnd(-26, 26), f.y + rnd(-30, 30), f.ch.color); }
      if (a.t === m.startup) {
        FX.banner("FULL TILT", f.ch.color);
        Stage.lastPusher = f;
        Snd.superHit();
        a.snapMark = Stage.snapCount;     // stop forcing once she's caused one
      }
      if (a.t >= m.startup && a.t < m.startup + m.active) {
        // ram the tilt to the limit; she is pinned to the pivot and immune
        f.pinned = true;
        f.x = lerp(f.x, Stage.pivot.x, 0.12);
        f.y = lerp(f.y, Stage.pivot.y - 70, 0.12);
        f.vx = 0; f.vy = 0;
        const dir = a.superDir || (a.superDir = Math.sign(f.facing) || 1);
        // One Snap-Back, not a stream of them.
        if (Stage.snapCount === a.snapMark) Stage.forceTilt(dir, 0.0075);
        if (a.t % 4 === 0) {
          FX.spark(Stage.pivot.x + rnd(-300, 300), Stage.pivot.y + rnd(-10, 20), f.ch.color);
          FX.ring(Stage.pivot.x, Stage.pivot.y, 10, 160, f.ch.color, 2);
        }
        FX.shake(4);
      }
      if (a.t === m.startup + m.active) f.pinned = false;
    } },

  /* ---- art: asymmetric, hooded, with a scarf that actually trails ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c;
    const dark = A.flash ? "#ffe9b4" : c2;
    const sw = swing(A, -9, 42);

    // --- scarf, trailing behind on a lagging sine ---
    g.save();
    g.strokeStyle = dark; g.lineWidth = 7; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(-4, -18);
    for (let s = 1; s <= 5; s++) {
      const px = -4 - s * 8 - Math.abs(A.vx) * 0.9 * s * 0.35;
      const py = -18 + Math.sin(A.time * 0.1 + s * 0.7) * (3 + s * 2.1) + s * 1.4;
      g.lineTo(px, py);
    }
    g.stroke();
    g.strokeStyle = hexA(ac, 0.5); g.lineWidth = 2;
    g.stroke();
    g.restore();

    // --- legs: thin, one bent ---
    const st = Math.sin(A.runPhase) * (A.running ? 12 : 0);
    jointLimb(g, -5, 9, -9 + st, 26, -4, 6, dark);
    jointLimb(g, 6, 9, 10 - st, 26, 4, 6, dark);
    g.fillStyle = c3;
    roundRect(g, -14 + st, 24, 11, 5, 2); g.fill();
    roundRect(g, 5 - st, 24, 11, 5, 2); g.fill();

    // --- torso: slim wedge with a balance-scale mark ---
    g.fillStyle = body;
    poly(g, [-11, -15, 11, -15, 9, 11, -9, 11]); g.fill();
    g.fillStyle = dark;
    poly(g, [-8, -11, 8, -11, 6, 1, -6, 1]); g.fill();
    glow(g, ac, 10, () => {
      g.strokeStyle = ac; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-6, -6); g.lineTo(6, -6); g.moveTo(0, -8); g.lineTo(0, -2); g.stroke();
      g.beginPath(); g.arc(-6, -4, 2.2, 0, Math.PI); g.stroke();
      g.beginPath(); g.arc(6, -4, 2.2, 0, Math.PI); g.stroke();
    });

    // --- asymmetric arms: slim back arm, oversized front gauntlet ---
    jointLimb(g, -9, -11, -16, 0, -3, 5, dark);
    g.fillStyle = dark;
    g.beginPath(); g.arc(-17, 1, 4, 0, 7); g.fill();

    const ax = 17 + sw, ay = -7;
    jointLimb(g, 9, -11, ax - 4, ay, 3, 6, dark);
    g.save(); g.translate(ax, ay); g.rotate(A.atkPhase >= 0 ? -0.3 : 0.1);
    g.fillStyle = body;
    poly(g, [-8, -9, 11, -7, 12, 8, -7, 9]); g.fill();
    g.fillStyle = c3; g.fillRect(-5, -3, 14, 3);
    glow(g, ac, 12, () => { g.fillStyle = ac; poly(g, [6, -6, 13, 0, 6, 6]); g.fill(); });
    g.restore();

    // --- head: pointed hood over a slim visor ---
    g.fillStyle = body;
    poly(g, [-10, -22, 10, -22, 7, -36, -2, -40, -11, -33]); g.fill();
    g.fillStyle = dark;
    poly(g, [-10, -22, 10, -22, 8, -27, -10, -27]); g.fill();
    glow(g, ac, 12, () => {
      g.fillStyle = A.flash ? "#ff2e88" : ac;
      poly(g, [-5, -30, 8, -28, 8, -24, -5, -26]); g.fill();
    });
  },
},
];

const CHAR_BY_ID = {};
ROSTER.forEach(c => { CHAR_BY_ID[c.id] = c; });
