/* ==========================================================================
   5e. WAVE 3D — four fighters built on input and timing, not on statuses

     NOVA    charge shot    hold special to build a star; let go to throw it
     HOOK    grapple        a hook on a chain that reels whoever it catches in
     BLITZ   combo counter  every chained hit makes the next one hit harder
     TWIN    mirror clone   a copy of her that throws every attack she does

   Same balance bands as 04a: lights 3-5%, heavies 13-17%, supers ~18-26%
   when they fully land. Per-fighter scratch state lives in f.v (shipped in
   every snapshot); the things they spawn are in 08e_kinds_d.js, along with
   the CPU's notes on how to use each special.
   ========================================================================== */

/** Frames Blitz has to land his next hit before the combo drops. */
const BLITZ_WINDOW = 70;
/** Frames of charge for a full Star Charge. */
const NOVA_MAX_CHARGE = 60;

/** Blitz's combo bookkeeping, run from every one of his moves' onHit. The
    bonus is paid as extra damage (and a little extra launch) on top of the
    hit that just landed, using the combo count from *before* this hit. Moves
    flagged noBonus (the Ultra Combo, which scales on its own) still count. */
function blitzComboHit(f, d, m) {
  const v = f.v, now = Match.current ? Match.current.frames : 0;
  if (!v.combo || now - (v.at || 0) > BLITZ_WINDOW || v.stk !== f.stocks) v.combo = 0;
  const bonus = Math.min(0.48, v.combo * 0.06);
  if (bonus > 0 && !m.noBonus && d.state === ST.HITSTUN) {
    const extra = m.dmg * bonus;
    d.percent = Math.min(999, d.percent + extra);
    f.stats.damageDealt += extra;
    d.vx *= 1 + bonus * 0.5; d.vy *= 1 + bonus * 0.5;
    FX.damageText(d.x, d.y - 66, "+" + extra.toFixed(1), f.ch.accent);
  }
  v.combo = Math.min(99, v.combo + 1); v.at = now; v.stk = f.stocks;
  if (v.combo % 5 === 0) {
    FX.ring(f.x, f.y - 50, 6, 46, f.ch.accent, 3);
    Snd.tone(600 + v.combo * 40, 0.08, "square", 0.08, 1400);
  }
}

/** Live combo count for draw(): zero once the window has lapsed. */
function blitzComboNow(v) {
  if (!v || !v.combo) return 0;
  const now = Match.current ? Match.current.frames : 0;
  return now - (v.at || 0) <= BLITZ_WINDOW ? v.combo : 0;
}

/** Undo the canvas's facing flip so text reads the right way round. */
function w3dUnflip(g) { if (g.getTransform && g.getTransform().a < 0) g.scale(-1, 1); }

/** A five-point star path, centred on the origin. */
function w3dStarPath(g, ro, ri, rot) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const an = rot + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? ri : ro;
    g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
  }
  g.closePath();
}

const WAVE3D = [

/* ======================================================================== */
/* NOVA — THE STARFIRE                                                       */
/* ======================================================================== */
{
  id: "NOVA", name: "NOVA", tag: "THE STARFIRE",
  blurb: "Carries a star in her hand. Waits for the right moment to let it go.",
  power: "Hold special to charge Star Charge: a tap throws a 4% spark, a full charge a 16% comet. Shield mid-charge to bank it for later. Supernova turns her into a star that detonates.",
  color: "#ffcf8a", color2: "#3b2a6b", color3: "#170f33", accent: "#fff7e6",
  weight: 0.9, speed: 4.3, accel: 0.88, jump: 12.4, airSpeed: 4.4, fallMul: 0.92,
  size: { w: 32, h: 54 }, hurt: 25,
  specialCooldown: 36,

  light: { name: "Stardust Jab", startup: 3, active: 3, recovery: 9,
    dmg: 3.6, base: 1.7, scale: 0.43, angle: 44, ox: 37, oy: -8, r: 22,
    vfx(f) {
      FX.blade(f.x + f.facing * 8, f.y - 8, faceAng(f), 22, 54, 0.5, f.ch.color, { w: 7, life: 9 });
      FX.spark(hbAt(f, this).x, f.y - 8, f.ch.accent);
      Snd.tone(1500, 0.04, "sine", 0.07, 2100);
    } },

  heavy: { name: "Corona Burst", startup: 13, active: 5, recovery: 26,
    dmg: 14.5, base: 4.4, scale: 1.04, angle: 48, ox: 40, oy: -6, r: 33,
    onStart() { Snd.whoosh(1.2); },
    vfx(f) {
      const p = hbAt(f, this);
      FX.ring(p.x, p.y, 8, 80, f.ch.color, 4);
      FX.ring(p.x, p.y, 4, 50, "#ffffff", 2);
      FX.burst(p.x, p.y, 18, f.ch.color, 6);
      FX.shake(6);
      Snd.tone(320, 0.16, "sawtooth", 0.1, 900);
    } },

  special: { name: "Star Charge", startup: 6, active: 2, recovery: 16,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Hold to charge a star in her hand; let go (or hit full charge) to throw it. A tap is a 4% spark, a full one-second charge a 16% comet. Shield while charging to bank the charge — the next Star Charge starts from it.",
    tick(f, a, inp) {
      const m = a.data;
      if (a.fired) return;
      if (a.t === 1 && f.v.stk !== f.stocks) { f.v.charge = 0; f.v.stk = f.stocks; }   // lost on a KO
      const c = f.v.charge = Math.min(NOVA_MAX_CHARGE, (f.v.charge || 0) + 1);
      f.vx *= 0.82;
      if (!f.grounded && c < NOVA_MAX_CHARGE) f.vy = Math.min(f.vy, 3);        // drifts down while charging
      if (c % 5 === 0) FX.spark(f.x + f.facing * 16 + rnd(-14, 14), f.y - 6 + rnd(-14, 14), f.ch.color);
      if (c === NOVA_MAX_CHARGE && !a.full) {
        a.full = true;
        FX.ring(f.x + f.facing * 16, f.y - 6, 4, 46, "#ffffff", 3);
        Snd.tone(1800, 0.1, "sine", 0.1, 2600);
      }
      // bank it: shield cancels the throw and she keeps what she built
      if (inp.hit("shield")) { a.t = a.total; FX.ring(f.x, f.y, 6, 40, f.ch.accent, 2); return; }
      if (a.t < m.startup) return;
      if (inp.held("special") && c < NOVA_MAX_CHARGE) { a.t = m.startup - 1; return; }   // keep charging

      a.fired = true;
      const k = clamp((c - m.startup) / (NOVA_MAX_CHARGE - m.startup), 0, 1);
      f.v.charge = 0;
      Entities.add("nova_star", f, { x: f.x + f.facing * 26, y: f.y - 6, vx: f.facing * (8.5 + 6 * k), vy: 0,
        dir: f.facing, r: 8 + 12 * k, life: 80 + Math.round(30 * k),
        move: hitMove("Star Charge", { dmg: 4 + 12 * k, base: 1.6 + 3.6 * k, scale: 0.35 + 0.72 * k, angle: 38 + 8 * k }) });
      if (k > 0.9) { f.vx -= f.facing * 3; FX.shake(6); FX.flash(f.ch.color, 0.12); }
      FX.burst(f.x + f.facing * 26, f.y - 6, 6 + Math.round(14 * k), f.ch.color, 3 + 5 * k);
      Snd.tone(700 + 900 * k, 0.12 + 0.1 * k, "triangle", 0.1 + 0.06 * k, 300);
    } },

  super: { name: "Supernova",
    desc: "She burns into a star, then detonates: 6% to anyone touching her and a blast ring that rolls out across the stage for 16% more.",
    startup: 22, active: 26, recovery: 28,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    core: { name: "Supernova Core", dmg: 6, base: 2.0, scale: 0.2, angle: 80, kbMul: 0.5, unblockable: true },
    wave: { name: "Supernova", dmg: 16, base: 5.6, scale: 1.08, angle: 55, unblockable: true },
    onStart(f) { Snd.superCharge(); FX.flash("#ffcf8a", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) {
        f.vx *= 0.6; f.vy = Math.min(f.vy * 0.6, -0.4);
        FX.spark(f.x + rnd(-40, 40), f.y + rnd(-40, 30), pick(["#ffffff", f.ch.color]));
        return;
      }
      f.vx *= 0.7; f.vy *= 0.7;
      if (a.t !== m.startup) return;
      FX.banner("SUPERNOVA", f.ch.color);
      FX.flash("#ffffff", 0.45); FX.punch(0.8); FX.shake(24);
      FX.ring(f.x, f.y, 10, 120, "#ffffff", 7);
      FX.burst(f.x, f.y, 60, f.ch.color, 13);
      Snd.superHit();
      Entities.blast(f, f.x, f.y, 70, m.core, Match.current.fighters);
      Entities.add("nova_ring", f, { x: f.x, y: f.y, r: 10, maxR: 280, life: 30, move: m.wave });
    } },

  /* ---- art: a star-mage. A comet of hair streaming behind her, a star on
           her brow, a cape of night sky with real stars in it, and a hand
           that holds whatever charge she has built. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#d8ccff" : c2, deep = A.flash ? "#b8a8f0" : c3;
    const v = A.v || {}, sw = swing(A, -8, 40);
    const starring = A.atkKind === "super";
    aura(g, 0, -6, 34 + (starring ? 30 : 0), c, starring ? 0.4 : 0.16);

    // comet hair: a long tapering flame swept back from the head
    g.save(); g.lineCap = "round";
    const fl = Math.sin(A.time * 0.14) * 3 - (A.vx || 0) * 0.8;
    const hair = () => { g.beginPath(); g.moveTo(-2, -32); g.quadraticCurveTo(-18, -34 + fl, -30, -22 + fl * 1.5);
                         g.quadraticCurveTo(-18, -24, -4, -18); g.closePath(); };
    ink(g, hair, vol(g, -36, -16, "#ff9e5e", 0.3, 0.2), 2.6);
    glow(g, c, 12, () => { g.fillStyle = hexA("#ffffff", 0.5); poly(g, [-4, -30, -20, -29 + fl, -10, -24]); g.fill(); });
    g.restore();

    // the cape of night, with a few stars that twinkle
    plate(g, [-8, -16, 8, -16, 6, 6, -2, 22, -16, 20, -14, 2], deep, { up: 0.2, down: 0.3 });
    for (let i = 0; i < 5; i++) {
      const sx = -12 + (i * 5) % 14, sy = -8 + i * 5, tw = 0.4 + 0.6 * Math.abs(Math.sin(A.time * 0.08 + i * 1.7));
      g.fillStyle = hexA("#ffffff", tw); g.fillRect(sx, sy, 1.6, 1.6);
    }

    const st = Math.sin(A.runPhase) * (A.running ? 11 : 0);
    jointLimb(g, -4, 9, -8 + st, 25, -4, 5.4, dark);
    jointLimb(g, 5, 9, 9 - st, 25, 4, 5.4, dark);
    plateRect(g, -13 + st, 23, 10, 6, 2.5, body, { up: 0.3 });
    plateRect(g, 4 - st, 23, 10, 6, 2.5, body, { up: 0.3 });

    // tunic: violet with a starfire sash
    plate(g, [-8, -15, 8, -15, 10, 10, -10, 10], dark, { up: 0.3, down: 0.36, under: true });
    plate(g, [-8, -2, 8, -5, 9, -1, -8, 2], body, { ink: 2, up: 0.4 });

    // head: a small face, a star on the brow
    g.save(); g.translate(1, -25);
    ink(g, () => { g.beginPath(); g.ellipse(0, 0, 6.8, 7.4, 0, 0, 7); }, vol(g, -8, 8, "#f6d8c0", 0.2, 0.3));
    lens(g, () => { g.beginPath(); g.ellipse(4, 0, 1.4, 2, 0, 0, 7); }, ac, c, 8);
    g.fillStyle = INK; g.fillRect(-1, 3.4, 4, 1.2);
    plate(g, [-7, -3, -3, -8, 5, -8, 7, -4, 2, -6, -4, -5], "#ff9e5e", { ink: 2, up: 0.4 });   // fringe
    g.save(); g.translate(2, -7);
    lens(g, () => w3dStarPath(g, 4, 1.8, A.time * 0.02), "#ffffff", c, 12);
    g.restore();
    g.restore();

    jointLimb(g, -7, -11, -13, -1, -3, 4.6, dark);

    // star hand: open palm forward, holding the charge
    const ax = 13 + sw, ay = -6;
    jointLimb(g, 7, -11, (7 + ax) / 2, ay - 1, 2.5, 4.8, dark);
    limb(g, (7 + ax) / 2, ay - 1, ax - 1, ay, 5.4, "#f6d8c0");
    const ch = clamp((v.charge || 0) / NOVA_MAX_CHARGE, 0, 1);
    const charging = A.atkKind === "special";
    if (ch > 0 || charging) {
      const rr = 3 + ch * 9 + (ch >= 1 ? Math.sin(A.time * 0.6) * 1.2 : 0);
      aura(g, ax + 5, ay, 14 + ch * 26, c, 0.25 + ch * 0.35);
      g.save(); g.translate(ax + 5, ay);
      lens(g, () => w3dStarPath(g, rr, rr * 0.48, A.time * 0.08), "#ffffff", c, 8 + ch * 20);
      g.restore();
    }

    // Supernova: she *is* the star for the length of the super
    if (starring) {
      const k = clamp(A.atkT / Math.max(1, A.atkStartup), 0, 1);
      const rr = 14 + k * 22;
      g.save(); g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.35 + 0.4 * k;
      g.fillStyle = "#ffffff"; g.shadowColor = c; g.shadowBlur = 30;
      w3dStarPath(g, rr, rr * 0.45, A.time * 0.05); g.fill();
      g.fillStyle = c; w3dStarPath(g, rr * 1.4, rr * 0.4, -A.time * 0.03); g.globalAlpha *= 0.5; g.fill();
      g.restore();
    }
  },
},

/* ======================================================================== */
/* HOOK — THE ANGLER                                                         */
/* ======================================================================== */
{
  id: "HOOK", name: "HOOK", tag: "THE ANGLER",
  blurb: "Casts once. Reels in. You arrive exactly where she wants you.",
  power: "Cast Line throws a hook on a chain. A foe it catches is reeled straight into her, still reeling, for a free follow-up. The Big Catch hooks every foe on stage at once and slams them all down together.",
  color: "#3d8fc4", color2: "#0f3550", color3: "#061a28", accent: "#ffb347",
  weight: 1.12, speed: 4.1, accel: 0.8, jump: 11.9, airSpeed: 3.9, fallMul: 1.04,
  size: { w: 36, h: 56 }, hurt: 27,
  specialCooldown: 120,

  light: { name: "Bobber Pop", startup: 4, active: 3, recovery: 10,
    dmg: 4.2, base: 2.0, scale: 0.46, angle: 50, ox: 38, oy: -6, r: 23,
    vfx(f) {
      FX.blade(f.x + f.facing * 8, f.y - 6, faceAng(f) - 0.3 * f.facing, 24, 56, 0.9, f.ch.color, { w: 9, life: 10 });
      FX.spark(hbAt(f, this).x, f.y - 6, f.ch.accent);
      Snd.tone(420, 0.05, "triangle", 0.08, 260);
    } },

  heavy: { name: "Gaff Swing", startup: 14, active: 5, recovery: 27,
    dmg: 15.5, base: 4.7, scale: 1.06, angle: 40, ox: 48, oy: -4, r: 32,
    onStart() { Snd.whoosh(1.4); },
    vfx(f) {
      FX.blade(f.x, f.y - 10, faceAng(f) - 1.2 * f.facing, 40, 88, 2.1, f.ch.color, { w: 14, life: 15, spin: f.facing * 0.07 });
      FX.blade(f.x, f.y - 10, faceAng(f) - 1.1 * f.facing, 38, 82, 1.8, f.ch.accent, { w: 4, life: 11, core: false, spin: f.facing * 0.07 });
      FX.shake(6);
      Snd.tone(140, 0.18, "sawtooth", 0.12, 70);
    } },

  special: { name: "Cast Line", startup: 10, active: 2, recovery: 22,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Throws a hook on a chain straight ahead. A foe it catches takes 3% and is reeled right into her, still stunned — a free follow-up. Whiff, or hit a shield, and the line just winds back in.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      Entities.add("hook_line", f, { x: f.x + f.facing * 20, y: f.y - 10, vx: f.facing * 15, vy: 0, dir: f.facing,
        r: 12, life: 90, range: 340, ox0: f.x,
        move: hitMove("Cast Line", { dmg: 3, base: 0.8, scale: 0.05, angle: 20, kbMul: 0.3 }) });
      Snd.tone(900, 0.12, "sawtooth", 0.06, 300);
    } },

  super: { name: "The Big Catch",
    desc: "A hook flies out at every foe on stage at once (4% each). Everyone caught is dragged to her and held — then one huge two-handed swing slams the lot for 17%.",
    startup: 14, active: 62, recovery: 30, slamAt: 50,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    slam: { name: "Big Catch Slam", dmg: 17, base: 6.2, scale: 1.1, angle: 48, unblockable: true },
    onStart(f) { Snd.superCharge(); FX.flash("#3d8fc4", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.7; return; }
      f.vx *= 0.8;
      const s = a.t - m.startup;
      if (s === 0) {
        FX.banner("THE BIG CATCH", f.ch.accent);
        for (const o of Combat.foes(f)) {
          if (o.intangible()) continue;
          const an = Math.atan2(o.y - f.y, o.x - f.x);
          Entities.add("hook_line", f, { x: f.x, y: f.y - 10, vx: Math.cos(an) * 24, vy: Math.sin(an) * 24,
            dir: o.x >= f.x ? 1 : -1, r: 14, life: m.active, seek: o, hold: true,
            move: hitMove("The Big Catch", { dmg: 4, base: 0.6, scale: 0.02, angle: 20, kbMul: 0.2, unblockable: true }) });
        }
        Snd.tone(700, 0.3, "sawtooth", 0.1, 200);
      }
      if (s === m.slamAt - 10) Snd.whoosh(2);
      if (s !== m.slamAt) return;
      FX.blade(f.x, f.y - 20, -Math.PI / 2, 40, 120, 2.6, f.ch.accent, { w: 18, life: 16, spin: f.facing * 0.12 });
      FX.ring(f.x + f.facing * 40, f.y + 20, 10, 160, "#ffffff", 6);
      FX.shake(26); FX.punch(0.8);
      Snd.superHit();
      for (const o of Combat.foes(f)) {
        if (o.intangible() || dist(f.x, f.y, o.x, o.y) > 150) continue;
        Combat.land(f, o, m.slam, o.x, o.y);
      }
    } },

  /* ---- art: a deep-sea angler in a rain slicker. Bucket hat, an orange
           life vest, a tackle box on her hip, and a rod over her shoulder
           with the hook swinging off the tip. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#c4e4ff" : c2, deep = A.flash ? "#a0ccf0" : c3;
    const sw = swing(A, -10, 42);
    const casting = A.atkKind === "special" || A.atkKind === "super";
    aura(g, 0, -4, 32, c, 0.12);

    // the rod over the back shoulder, line and hook swinging from its tip
    if (!casting) {
      g.save(); g.lineCap = "round";
      g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-10, -4); g.lineTo(-24, -46); g.stroke();
      g.strokeStyle = "#8a5a32"; g.lineWidth = 2.2; g.stroke();
      const sx = -24 + Math.sin(A.time * 0.07) * 4;
      g.strokeStyle = hexA("#ffffff", 0.6); g.lineWidth = 1;
      g.beginPath(); g.moveTo(-24, -46); g.lineTo(sx, -26); g.stroke();
      g.strokeStyle = INK; g.lineWidth = 3;
      g.beginPath(); g.arc(sx + 2.5, -24, 3, Math.PI, Math.PI * 2.6); g.stroke();
      g.strokeStyle = "#d8dee8"; g.lineWidth = 1.5; g.stroke();
      g.restore();
    }

    const st = Math.sin(A.runPhase) * (A.running ? 9 : 0);
    jointLimb(g, -6, 10, -10 + st, 26, -3.5, 7, deep);
    jointLimb(g, 7, 10, 11 - st, 26, 3.5, 7, deep);
    // rubber boots
    plateRect(g, -16 + st, 21, 12, 8, 2.5, "#f2c230", { up: 0.3 });
    plateRect(g, 4 - st, 21, 12, 8, 2.5, "#f2c230", { up: 0.3 });

    // the slicker, flared, and the life vest over it
    plate(g, [-12, -15, 12, -15, 15, 14, -15, 14], body, { up: 0.3, down: 0.4, under: true });
    plate(g, [-10, -13, 10, -13, 9, 4, -9, 4], ac, { up: 0.3, down: 0.3 });
    g.fillStyle = INK; g.fillRect(-0.8, -12, 1.6, 15);
    for (let i = 0; i < 2; i++) { g.fillStyle = "#e8ecf2"; g.fillRect(-8, -9 + i * 7, 16, 1.8); }
    // tackle box on the hip
    plateRect(g, -17, 4, 9, 8, 1.5, "#d24a3a", { up: 0.3, ink: 2 });

    // head: weathered face, bucket hat
    g.save(); g.translate(1, -24);
    ink(g, () => { g.beginPath(); g.ellipse(0, 0, 7, 7.4, 0, 0, 7); }, vol(g, -8, 8, "#e9bd94", 0.2, 0.3));
    g.fillStyle = INK; g.fillRect(2, -1, 4.6, 2); g.fillRect(0, 3.6, 5, 1.2);
    plate(g, [-13, -3, 14, -3, 10, 0, -10, 0], dark, { up: 0.3, ink: 2.4 });
    plate(g, [-8, -3, 9, -3, 7, -11, -6, -11], body, { up: 0.4, down: 0.2 });
    plate(g, [-8, -5, 9, -5, 8.5, -7, -7.5, -7], ac, { ink: 1.6, rim: false });
    g.restore();

    jointLimb(g, -9, -11, -15, 0, -3, 5.4, dark);

    // rod arm: when casting, the rod points out along the line
    const ax = 15 + sw, ay = -6;
    jointLimb(g, 9, -11, (9 + ax) / 2, ay - 1, 2.5, 5.6, dark);
    limb(g, (9 + ax) / 2, ay - 1, ax - 2, ay, 6.2, mid_(c, c2));
    g.save(); g.translate(ax, ay); g.rotate(casting ? -0.25 : A.atkPhase >= 0 ? 0.1 : -0.9);
    g.strokeStyle = INK; g.lineWidth = 5; g.lineCap = "round";
    g.beginPath(); g.moveTo(-6, 0); g.lineTo(casting ? 34 : 20, 0); g.stroke();
    g.strokeStyle = casting ? "#8a5a32" : "#9aa3b5"; g.lineWidth = 2.8; g.stroke();
    if (!casting) {
      // the gaff: a hooked steel tip
      g.strokeStyle = INK; g.lineWidth = 4.4;
      g.beginPath(); g.arc(22, 5, 5, -Math.PI / 2, Math.PI * 0.8); g.stroke();
      g.strokeStyle = "#d8dee8"; g.lineWidth = 2.2; g.stroke();
    } else {
      g.fillStyle = INK; g.beginPath(); g.arc(4, 3, 3.6, 0, 7); g.fill();           // the reel
      g.fillStyle = ac; g.beginPath(); g.arc(4, 3, 2.2, 0, 7); g.fill();
    }
    g.restore();
  },
},

/* ======================================================================== */
/* BLITZ — THE COMBO KING                                                    */
/* ======================================================================== */
{
  id: "BLITZ", name: "BLITZ", tag: "THE COMBO KING",
  blurb: "Never stops swinging. Every hit makes the next one worse.",
  power: "Each hit he lands within about a second of the last builds his COMBO, and every step adds 6% to his damage (up to +48%). Let it drop and it's gone. Ultra Combo's finisher grows with the count.",
  color: "#e8202f", color2: "#5a0a12", color3: "#28040a", accent: "#ffd23d",
  weight: 0.98, speed: 5.2, accel: 1.05, jump: 12.6, airSpeed: 4.6, fallMul: 1.06,
  size: { w: 34, h: 54 }, hurt: 25,
  specialCooldown: 150,

  light: { name: "One-Two", startup: 3, active: 3, recovery: 8,
    dmg: 3.2, base: 1.5, scale: 0.4, angle: 40, ox: 36, oy: -8, r: 22,
    onHit(f, d) { blitzComboHit(f, d, this); },
    vfx(f) {
      FX.blade(f.x + f.facing * 10, f.y - 8, faceAng(f), 26, 54, 0.22, f.ch.accent, { w: 12, life: 7 });
      Snd.noise(0.04, 0.08, 1800, 1.2, "bandpass");
    } },

  heavy: { name: "Haymaker", startup: 14, active: 4, recovery: 26,
    dmg: 14, base: 4.4, scale: 1.04, angle: 38, ox: 44, oy: -8, r: 31,
    onHit(f, d) { blitzComboHit(f, d, this); },
    onStart() { Snd.whoosh(1.3); },
    vfx(f) {
      const p = hbAt(f, this);
      FX.blade(f.x, f.y - 8, faceAng(f) - 0.9 * f.facing, 34, 80, 1.6, f.ch.color, { w: 14, life: 13, spin: f.facing * 0.1 });
      FX.ring(p.x, p.y, 8, 70, f.ch.accent, 3);
      FX.shake(6);
      Snd.tone(110, 0.16, "square", 0.12, 60);
    } },

  special: { name: "Flurry Rush", startup: 6, active: 20, recovery: 20,
    dmg: 1.8, base: 0.8, scale: 0.06, angle: 22, kbMul: 0.45, ox: 30, oy: -6, r: 26, hits: 5, hitGap: 4,
    finisher: { name: "Flurry Finish", dmg: 3.5, base: 3.4, scale: 0.72, angle: 40 },
    desc: "Dashes forward throwing five rapid punches (1.8% each) and caps it with a 3.5% straight. Every punch counts toward his combo.",
    onHit(f, d) {
      blitzComboHit(f, d, this);
      // carry whoever is caught along with the rush instead of running through them
      if (f.attack && f.attack.kind === "special" && d.state === ST.HITSTUN) {
        f.attack.caught = true; d.vx = f.facing * 3.2; d.vy = Math.min(d.vy, -1.2);
      }
    },
    tick(f, a) {
      const m = a.data;
      // startSpecial() doesn't seed this the way startAttack() does, and the
      // multi-hit re-arm compares against it — without it only one hit lands
      if (a.lastHitFrame == null) a.lastHitFrame = -99;
      if (a.t <= m.startup) { f.vx *= 0.6; return; }
      if (a.t <= m.startup + m.active) {
        f.vx = f.facing * (a.caught ? 3.7 : 7.5);
        if ((a.t - m.startup) % m.hitGap === 1)
          FX.blade(f.x + f.facing * 14, f.y - 6 + rnd(-8, 8), faceAng(f), 20, 46, 0.2, pick([f.ch.color, f.ch.accent]), { w: 9, life: 6 });
      }
      if (a.t !== m.startup + m.active) return;
      // the straight that ends it
      const hx = f.x + f.facing * (m.ox + 8), hy = f.y + m.oy;
      FX.ring(hx, hy, 6, 56, f.ch.accent, 3);
      Snd.tone(160, 0.12, "square", 0.12, 80);
      for (const o of Combat.foes(f)) {
        if (o.intangible() || dist(hx, hy, o.x, o.y) > m.r + 6 + o.ch.hurt) continue;
        Combat.land(f, o, m.finisher, hx, hy);
        blitzComboHit(f, o, m.finisher);
      }
    } },

  super: { name: "Ultra Combo",
    desc: "Locks onto the nearest foe and runs a five-hit chain (2.2% each), then a finisher that grows with his combo count: 7% plus 0.9% per hit in the chain, up to 15%.",
    startup: 10, active: 60, recovery: 26,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    strike: { name: "Ultra Combo", dmg: 2.2, base: 1.0, scale: 0.05, angle: 70, kbMul: 0.15, unblockable: true, noBonus: true },
    onStart(f) { Snd.superCharge(); FX.flash("#e8202f", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.6; f.vy *= 0.6; return; }
      if (a.t === m.startup) {
        FX.banner("ULTRA COMBO", f.ch.accent);
        const t = Combat.nearestFoe(f, 320);
        a.tgt = t && !t.intangible() ? t : null;
        if (!a.tgt) { a.t = m.startup + m.active; FX.ring(f.x, f.y, 6, 60, f.ch.color, 3); return; }
      }
      const t = a.tgt, s = a.t - m.startup;
      if (!t) return;
      if (!t.alive || t.state === ST.DEAD) { a.t = m.startup + m.active; return; }
      f.vx = 0; f.vy = 0; f.invuln = Math.max(f.invuln, 4);
      t.vx *= 0.3; t.vy *= 0.3;
      if (s > 0 && s < 46 && t.state === ST.HITSTUN) t.hitstun = Math.max(t.hitstun, 10);
      if (s % 8 === 0 && s <= 32) {
        // weave from side to side between punches
        const side = (s / 8) % 2 ? 1 : -1;
        f.x = t.x + side * 36; f.y = t.y; f.facing = t.x >= f.x ? 1 : -1;
        FX.blade(t.x, t.y - 6, faceAng(f) + rnd(-0.4, 0.4), 18, 52, 0.4, pick([f.ch.color, f.ch.accent]), { w: 10, life: 8 });
        Combat.land(f, t, m.strike, t.x, t.y);
        blitzComboHit(f, t, m.strike);
        Snd.tone(300 + s * 12, 0.06, "square", 0.1, 160);
      }
      if (s !== 46) return;
      const n = blitzComboNow(f.v);
      const fin = hitMove("Ultra Finish", { dmg: Math.min(15, 7 + 0.9 * n), base: 5.6, scale: 1.08, angle: 40, unblockable: true, noBonus: true });
      f.x = t.x - f.facing * 38;
      FX.damageText(t.x, t.y - 80, n + " HIT FINISH", f.ch.accent);
      FX.ring(t.x, t.y, 10, 140, "#ffffff", 6);
      FX.shake(22); FX.punch(0.7); Snd.superHit();
      Combat.land(f, t, fin, t.x, t.y);
      blitzComboHit(f, t, fin);
    } },

  /* ---- art: a prizefighter. Padded headgear, a gold title belt, taped
           wrists and gloves twice the size of his fists — and his running
           combo count burning over his head. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#ffc8cc" : c2, deep = A.flash ? "#ffa8b0" : c3;
    const sw = swing(A, -12, 46);
    const combo = blitzComboNow(A.v);
    aura(g, 0, -4, 30 + Math.min(combo, 8) * 3, c, 0.12 + Math.min(combo, 8) * 0.03);
    const bob = A.state === ST.IDLE ? Math.sin(A.time * 0.16) * 1.4 : 0;

    const st = Math.sin(A.runPhase) * (A.running ? 13 : 0);
    jointLimb(g, -5, 8, -10 + st, 25, -4, 6, "#c98e62");
    jointLimb(g, 6, 8, 10 - st, 25, 4, 6, "#c98e62");
    plateRect(g, -15 + st, 22, 12, 6, 2.5, "#ffffff", { up: 0.1 });
    plateRect(g, 3 - st, 22, 12, 6, 2.5, "#ffffff", { up: 0.1 });
    // trunks
    plate(g, [-10, 0, 10, 0, 11, 12, 1, 12, 0, 8, -1, 12, -11, 12], body, { up: 0.3, ink: 2.4 });

    g.save(); g.translate(0, bob);
    // bare torso and the title belt
    plate(g, [-10, -15, 10, -15, 9, 2, -9, 2], "#d9a074", { up: 0.3, down: 0.3, under: true });
    plate(g, [-11, -2, 11, -2, 11, 3, -11, 3], ac, { ink: 2, up: 0.4 });
    ink(g, () => roundRect(g, -4, -4, 8, 8, 2), vol(g, -4, 4, "#ffe98a", 0.4, 0.3), 2);

    // head in padded headgear
    g.save(); g.translate(1, -24);
    ink(g, () => { g.beginPath(); g.ellipse(0, 0, 7.4, 8, 0, 0, 7); }, vol(g, -9, 9, body, 0.3, 0.3));
    ink(g, () => roundRect(g, -1, -4, 8.4, 9, 3), "#d9a074", 2);
    g.fillStyle = INK; g.fillRect(3, -1.6, 4, 1.8); g.fillRect(2, 2.6, 4.4, 1.2);
    plate(g, [-6, -7, 6, -8, 7, -4, -6, -3], dark, { ink: 1.8, rim: false });
    g.restore();

    // back glove, held up guarding
    jointLimb(g, -8, -11, -2, -4, -4, 5, "#d9a074");
    ink(g, () => { g.beginPath(); g.arc(1, -10, 6.5, 0, 7); }, vol(g, -16, -4, body, 0.4, 0.3));

    // lead glove: punches out along the swing
    const ax = 13 + sw, ay = -8;
    jointLimb(g, 8, -11, (8 + ax) / 2, ay - 1, 2, 5.4, "#d9a074");
    g.fillStyle = "#ffffff"; g.fillRect(ax - 6, ay - 3.5, 3, 7);                 // tape
    ink(g, () => { g.beginPath(); g.ellipse(ax + 2, ay, 8.4, 7.2, 0, 0, 7); }, vol(g, ay - 7, ay + 7, body, 0.4, 0.3));
    rim(g, () => { g.beginPath(); g.ellipse(ax + 2, ay, 8.4, 7.2, 0, 0, 7); }, "#ffffff", 3, 0.5);
    g.restore();

    // the running combo count, over his head
    if (combo >= 2) {
      g.save(); g.translate(0, -50); w3dUnflip(g);
      const hot = Math.min(1, combo / 8);
      g.font = `900 ${13 + Math.round(hot * 6)}px ${FONT_DISPLAY}`; g.textAlign = "center";
      glow(g, combo >= 8 ? "#ffffff" : ac, 8 + hot * 12, () =>
        outlineText(g, combo + " HIT" + (combo >= 8 ? "S MAX" : "S"), 0, 0, combo >= 8 ? "#ffffff" : ac, 5));
      g.restore();
    }
  },
},

/* ======================================================================== */
/* TWIN — THE DOUBLE                                                         */
/* ======================================================================== */
{
  id: "TWIN", name: "TWIN", tag: "THE DOUBLE",
  blurb: "There are two of her. Neither one will tell you which is the copy.",
  power: "Split leaves a mirror clone where she stood for five seconds. Facing the other way, it throws every light and heavy she does at 60% power. Doppelganger surrounds the nearest foe with three clones that strike at once.",
  color: "#ffb4c8", color2: "#5c1f3a", color3: "#2a0c1b", accent: "#9ff7ff",
  weight: 0.86, speed: 4.7, accel: 0.95, jump: 12.9, airSpeed: 4.6, fallMul: 0.96,
  size: { w: 30, h: 52 }, hurt: 24,
  specialCooldown: 330,

  light: { name: "Mirror Tap", startup: 3, active: 3, recovery: 9,
    dmg: 3.6, base: 1.6, scale: 0.42, angle: 45, ox: 36, oy: -8, r: 22,
    vfx(f) {
      FX.blade(f.x + f.facing * 8, f.y - 8, faceAng(f), 22, 52, 0.6, f.ch.color, { w: 7, life: 9 });
      Snd.tone(1400, 0.04, "triangle", 0.07, 1900);
    } },

  heavy: { name: "Reflection Kick", startup: 13, active: 4, recovery: 26,
    dmg: 14, base: 4.3, scale: 1.04, angle: 42, ox: 42, oy: 4, r: 31,
    onStart() { Snd.whoosh(1.3); },
    vfx(f) {
      FX.blade(f.x, f.y + 4, faceAng(f) + 0.8 * f.facing, 30, 76, 1.5, f.ch.color, { w: 12, life: 13, spin: -f.facing * 0.08 });
      FX.blade(f.x, f.y + 4, faceAng(f) + 0.7 * f.facing, 28, 70, 1.2, f.ch.accent, { w: 3, life: 10, core: false, spin: -f.facing * 0.08 });
      FX.shake(5);
      Snd.tone(600, 0.12, "triangle", 0.1, 300);
    } },

  special: { name: "Split", startup: 8, active: 2, recovery: 14,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Steps out of herself, leaving a mirror clone in place for five seconds. It faces the opposite way to her and throws every light and heavy she does at 60% power — catch a foe between the two of you.",
    tick(f, a) {
      if (a.t !== a.data.startup || a.fired) return;
      a.fired = true;
      for (const e of Entities.list) if (e.kind === "twin_clone" && e.owner === f) e.life = 1;
      Entities.add("twin_clone", f, { x: f.x, y: f.y, dir: -f.facing, r: 0, life: 300 });
      FX.ring(f.x, f.y, 6, 60, f.ch.accent, 3);
      FX.burst(f.x, f.y, 14, f.ch.accent, 4);
      f.vx = f.facing * 7;
      Snd.tone(1200, 0.14, "sine", 0.1, 600); Snd.tone(600, 0.14, "sine", 0.08, 1200, 0.05);
    } },

  super: { name: "Doppelganger",
    desc: "Three clones blink in around the nearest foe — left, right and above — and strike together for 7% each.",
    startup: 14, active: 30, recovery: 26,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    strike: { name: "Doppelganger", dmg: 7, base: 3.4, scale: 0.78, angle: 55, unblockable: true },
    onStart(f) { Snd.superCharge(); FX.flash("#9ff7ff", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t !== m.startup) { if (a.t < m.startup) f.vx *= 0.7; return; }
      FX.banner("DOPPELGANGER", f.ch.accent);
      const t = Combat.nearestFoe(f, 700);
      const cx = t ? t.x : f.x, cy = t ? t.y : f.y;
      [[-78, 0], [78, 0], [0, -86]].forEach(([dx, dy], i) => {
        Entities.add("twin_double", f, { x: cx + dx, y: cy + dy, dir: dx > 0 ? -1 : dx < 0 ? 1 : f.facing,
          r: 0, life: 24, tgt: t && !t.intangible() ? t : null, ox: dx, oy: dy,
          move: Object.assign({}, m.strike, { name: m.strike.name + " " + (i + 1) }) });   // own names: no staling each other
        FX.ring(cx + dx, cy + dy, 4, 44, f.ch.accent, 2);
      });
      Snd.tone(900, 0.2, "sine", 0.1, 1800);
    } },

  /* ---- art: a mime-sharp duelist split down the middle — one half rose,
           one half mirror-cyan — with a cracked hand mirror for a weapon.
           Her clones are this same drawing, faded. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c, dark = A.flash ? "#ffd4e0" : c2, deep = A.flash ? "#ffb8cc" : c3;
    const half = A.flash ? "#ffffff" : ac;
    const v = A.v || {}, sw = swing(A, -10, 42);
    if (!v.clone) aura(g, 0, -4, 30, c, 0.14);

    // twin ribbons trailing from the back of the head, one of each colour
    g.save(); g.lineCap = "round";
    for (let i = 0; i < 2; i++) {
      const wv = Math.sin(A.time * 0.12 + i * 2) * 3 - (A.vx || 0) * 0.6;
      g.strokeStyle = INK; g.lineWidth = 5;
      g.beginPath(); g.moveTo(-5, -30 + i * 3); g.quadraticCurveTo(-14, -30 + wv + i * 4, -20, -20 + wv + i * 3); g.stroke();
      g.strokeStyle = i ? half : body; g.lineWidth = 2.8; g.stroke();
    }
    g.restore();

    const st = Math.sin(A.runPhase) * (A.running ? 12 : 0);
    jointLimb(g, -4, 8, -8 + st, 24, -4, 5, dark);
    jointLimb(g, 5, 8, 9 - st, 24, 4, 5, deep);
    plateRect(g, -13 + st, 22, 10, 6, 2.5, body, { up: 0.3 });
    plateRect(g, 4 - st, 22, 10, 6, 2.5, half, { up: 0.3 });

    // bodysuit, split down the middle: rose behind, mirror in front
    plate(g, [-8, -15, 0, -15, 0, 9, -9, 9], body, { up: 0.3, down: 0.36, under: true });
    plate(g, [0, -15, 8, -15, 9, 9, 0, 9], half, { up: 0.3, down: 0.36, under: true });
    // a diamond ruff at the collar
    plate(g, [-9, -15, 0, -11, 9, -15, 0, -18], dark, { ink: 2, up: 0.3 });

    // head: a half-and-half mask
    g.save(); g.translate(1, -25);
    const head = () => { g.beginPath(); g.ellipse(0, 0, 6.6, 7.4, 0, 0, 7); };
    ink(g, head, vol(g, -8, 8, "#fbeef2", 0.2, 0.3));
    g.save(); head(); g.clip();
    g.fillStyle = hexA(ac, 0.5); g.fillRect(0, -8, 8, 16);
    g.restore();
    lens(g, () => poly(g, [1.5, -1.5, 5.5, -2, 5.5, 0, 1.5, 0.4]), A.flash ? c : "#ffffff", ac, 10);
    g.fillStyle = INK; g.fillRect(1, 3.6, 4, 1.1);
    plate(g, [-7, -3, -4, -9, 5, -9, 7, -4, 0, -6], dark, { ink: 2, up: 0.4 });   // bob cut
    g.restore();

    jointLimb(g, -7, -11, -13, -1, -3, 4.4, dark);

    // mirror arm: a hand mirror held out, its glass catching the light
    const ax = 13 + sw, ay = -6;
    jointLimb(g, 7, -11, (7 + ax) / 2, ay - 1, 2.5, 4.6, deep);
    limb(g, (7 + ax) / 2, ay - 1, ax - 2, ay, 5.2, "#fbeef2");
    g.save(); g.translate(ax + 2, ay); g.rotate(A.atkPhase >= 0 ? 0 : -0.5);
    g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = "round";
    g.beginPath(); g.moveTo(0, 0); g.lineTo(8, 0); g.stroke();
    g.strokeStyle = "#c9a24a"; g.lineWidth = 2; g.stroke();
    ink(g, () => { g.beginPath(); g.ellipse(15, 0, 7, 9, 0, 0, 7); }, "#c9a24a", 2.4);
    lens(g, () => { g.beginPath(); g.ellipse(15, 0, 5, 7, 0, 0, 7); }, hexA(ac, 0.9), ac, 8);
    g.strokeStyle = hexA("#ffffff", 0.8); g.lineWidth = 1;
    g.beginPath(); g.moveTo(12, -4); g.lineTo(16, 1); g.lineTo(14, 5); g.stroke();      // the crack
    g.restore();
  },
},
];

WAVE3D.forEach(c => { CHAR_BY_ID[c.id] = c; });
ROSTER.push(...WAVE3D);
