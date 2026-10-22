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
               already flipped so +x is always "forward")

   Three things make a flat canvas shape read as a character, and every
   fighter below uses all three:

     ink        a dark outline on every silhouette, so the art survives both
                the neon Pivot Yard and the near-white Cirrus Drift sky
     volume     a vertical gradient per plate — lit at the top, falling to
                shadow at the bottom — instead of one flat fill
     rim        a bright inner edge along the top, implying a single light
                source above and in front of the whole roster
   ---------- */

const INK = "#0a0613";          // the one outline colour, shared by all four

/** Mid tone between a fighter's body and shadow colours. Forearms and the
    hand that holds a weapon use this: pure shadow colour made them vanish on
    a dark stage and the weapon looked like it was floating alongside. */
function mid_(col, darkCol) { return mixColor(col, darkCol, 0.42); }

/** Build a path, outline it in ink, then fill — the base of every plate. */
function ink(g, pathFn, fill, w) {
  pathFn();
  if (w !== 0) {
    g.strokeStyle = INK; g.lineWidth = w || 3.2;
    g.lineJoin = "round"; g.lineCap = "round"; g.stroke();
  }
  g.fillStyle = fill; g.fill();
}

/** Top-lit vertical gradient for a plate spanning y0..y1.

   Cached: a gradient's stops are fixed in *local* space and every fighter is
   drawn in its own local space, so the same object is valid every frame. Without
   this, four fighters rebuilt ~40 gradients per frame for no reason. */
const _volCache = new Map();
function vol(g, y0, y1, col, up, down) {
  const key = y0 + "|" + y1 + "|" + col + "|" + up + "|" + down;
  let q = _volCache.get(key);
  if (q) return q;
  q = g.createLinearGradient(0, y0, 0, y1);
  q.addColorStop(0, shade(col, up === undefined ? 0.26 : up));
  q.addColorStop(0.55, col);
  q.addColorStop(1, shade(col, -(down === undefined ? 0.3 : down)));
  if (_volCache.size < 400) _volCache.set(key, q);
  return q;
}

/** Bright inner edge along a shape's top, clipped so it never leaks out. */
function rim(g, pathFn, col, w, a) {
  g.save();
  pathFn(); g.clip();
  g.translate(0.9, 2.2);                 // nudge down so only the top edge shows
  pathFn();
  g.strokeStyle = col; g.lineWidth = w || 3;
  g.lineJoin = "round"; g.globalAlpha = a === undefined ? 0.5 : a;
  g.stroke();
  g.restore();
}

/** Occlusion along a shape's bottom — the counterpart to rim(). */
function underShade(g, pathFn, a) {
  g.save();
  pathFn(); g.clip();
  g.translate(-0.6, -2.6);
  pathFn();
  g.strokeStyle = INK; g.lineWidth = 3.4; g.lineJoin = "round";
  g.globalAlpha = a === undefined ? 0.3 : a;
  g.stroke();
  g.restore();
}

/** A plate in one call: ink + volume + rim. pts is a flat [x,y,...] list. */
function plate(g, pts, col, opts) {
  const o = opts || {};
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 1; i < pts.length; i += 2) { if (pts[i] < y0) y0 = pts[i]; if (pts[i] > y1) y1 = pts[i]; }
  const path = () => poly(g, pts);
  ink(g, path, o.flat ? col : vol(g, y0, y1, col, o.up, o.down), o.ink);
  if (o.rim !== false) rim(g, path, o.rimCol || "#ffffff", o.rimW, o.rimA);
  if (o.under) underShade(g, path, o.underA);
}

/** Same, for a rounded box. */
function plateRect(g, x, y, w, h, r, col, opts) {
  const o = opts || {};
  const path = () => roundRect(g, x, y, w, h, r);
  ink(g, path, o.flat ? col : vol(g, y, y + h, col, o.up, o.down), o.ink);
  if (o.rim !== false) rim(g, path, o.rimCol || "#ffffff", o.rimW, o.rimA);
  if (o.under) underShade(g, path, o.underA);
}

/** Limb drawn as an inked capsule so it reads as a solid arm, not a stroke. */
function limb(g, x1, y1, x2, y2, w, col) {
  const path = () => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); };
  path(); g.strokeStyle = INK; g.lineWidth = w + 2.6; g.lineCap = "round"; g.stroke();
  path(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
  // highlight down the upper length of the limb
  path(); g.strokeStyle = hexA("#ffffff", 0.22); g.lineWidth = w * 0.3;
  g.save(); g.translate(0, -w * 0.26); g.stroke(); g.restore();
}

function jointLimb(g, x1, y1, x2, y2, bend, w, col) {
  const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2;
  const path = () => {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(mx, my); g.lineTo(x2, y2);
  };
  path(); g.strokeStyle = INK; g.lineWidth = w + 2.6;
  g.lineCap = "round"; g.lineJoin = "round"; g.stroke();
  path(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
  path(); g.strokeStyle = hexA("#ffffff", 0.2); g.lineWidth = w * 0.28;
  g.save(); g.translate(0, -w * 0.24); g.stroke(); g.restore();
  // a joint cap, so the elbow/knee reads as a pivot rather than a kink
  g.fillStyle = shade(col, -0.2);
  g.beginPath(); g.arc(mx, my, w * 0.42, 0, 7); g.fill();
}

function rivets(g, x, y, n, step, col) {
  for (let i = 0; i < n; i++) {
    const rx = x + i * step;
    g.fillStyle = hexA(INK, 0.55);
    g.beginPath(); g.arc(rx, y + 0.9, 1.7, 0, 7); g.fill();
    g.fillStyle = col;
    g.beginPath(); g.arc(rx, y, 1.5, 0, 7); g.fill();
  }
}

/** A lit lens/visor: dark socket, glowing core, a hot specular dot.
    Still uses shadowBlur rather than a glow sprite: a sprite has to be stamped
    at a point, and these shapes sit at arbitrary offsets inside each
    fighter's local transform, so a sprite would light the fighter's centre
    rather than the visor. There are only a handful per fighter. */
function lens(g, pathFn, col, glowCol, blur) {
  g.save();
  pathFn(); g.fillStyle = INK; g.fill();
  g.shadowColor = glowCol || col; g.shadowBlur = blur === undefined ? 14 : blur;
  pathFn(); g.fillStyle = col; g.fill();
  pathFn(); g.fillStyle = col; g.fill();     // twice: the glow stacks, the core burns
  g.restore();
}

/** Faint energy wash behind a fighter — sells "this thing is powered". */
function aura(g, x, y, r, col, a) {
  Light.draw(g, x, y, r, col, a === undefined ? 0.3 : a, 0.05);
}

/* Reach of a swing arm.

   This is keyed to the move's real frame data, not to its total duration. The
   old version split the swing at fixed fractions (0.3 / 0.5) of the whole
   animation, so a jab with 4 startup frames out of 17 reached full extension
   at a different moment than a smash with 14 out of 42 — on most moves the arm
   was still travelling while the hitbox was already live, and had started
   coming back before the hitbox closed. Now the arm is fully out on the exact
   frame the hitbox opens and holds there until it shuts, which is what makes
   the hit land where the eye expects it. */
function swing(A, back, out) {
  if (A.atkPhase < 0) return 0;
  const su = A.atkStartup || 1, ac = A.atkActive || 1;
  const tot = A.atkTotal || (su + ac), t = A.atkT || 0;

  if (t <= su) return lerp(0, back, easeOut(t / su));          // wind up

  if (t <= su + ac) {
    /* A multi-hit move pumps instead of extending once and holding: the arm is
       furthest out on each tap and draws back slightly between them, so a
       three-hit flurry looks like three strikes rather than one long reach. */
    const mv = A.move;
    if (mv && mv.hits > 1) {
      const gap = mv.hitGap || 4;
      const local = ((t - su - 1) % gap) / gap;
      return out * (1 - 0.4 * Math.sin(local * Math.PI));
    }
    // otherwise: snap out within a couple of frames, then hold for the hitbox
    const k = Math.min(1, (t - su) / Math.max(1, Math.min(ac, 2)));
    return lerp(back, out, easeOut(k));
  }
  const k = clamp((t - su - ac) / Math.max(1, tot - su - ac), 0, 1);
  return lerp(out, 0, ease(k));                                // follow through
}

/* ---------- attack VFX helpers, shared by every move ---------- */

/** Where a move's hitbox actually sits in the world. Effects are drawn there
    rather than at a hand-tuned offset, so they can never drift out of sync
    with what the move actually hits. */
function hbAt(f, m) {
  return { x: f.x + (m.ox || 0) * f.facing, y: f.y + (m.oy || 0) };
}
/** Forward direction as an angle, for arcs that sweep away from the fighter. */
function faceAng(f) { return f.facing > 0 ? 0 : Math.PI; }

const ROSTER = [

/* ======================================================================== */
/* BOLDER — THE ANVIL                                                        */
/* ======================================================================== */
{
  id: "BOLDER", name: "BOLDER", tag: "THE ANVIL",
  blurb: "Walks like furniture, hits like a dropped engine. Heaviest body in the game.",
  power: "Heaviest body in the game. His heavy and super both hit the whole deck around him.",
  color: "#ff2e88", color2: "#6d1038", color3: "#2b0a1a", accent: "#ffd0e4",
  weight: 1.42, speed: 3.05, accel: 0.52, jump: 11.6, airSpeed: 2.9, fallMul: 1.12,
  size: { w: 46, h: 60 }, hurt: 31,
  specialCooldown: 70,

  /* A piston, so the effect is a straight thrust: a narrow wedge punched
     forward along the arm, not a sweep. */
  light: { name: "Piston Jab", startup: 4, active: 3, recovery: 11,
    dmg: 4.5, base: 2.2, scale: 0.55, angle: 42, ox: 42, oy: -6, r: 24,
    vfx(f) {
      const p = hbAt(f, this), ang = faceAng(f);
      FX.blade(f.x + f.facing * 14, f.y - 6, ang, 26, 62, 0.52, f.ch.color, { w: 15, life: 11 });
      FX.glyph(p.x + f.facing * 6, p.y, "wedge", 11, f.ch.accent, 12);
      for (let i = 0; i < 3; i++) FX.spark(p.x + rnd(-8, 8), p.y + rnd(-8, 8), f.ch.accent);
      Snd.tone(150, 0.05, "square", 0.08, 90);
    } },

  /* A full-body smash, so the effect is the widest arc in the game, plus the
     ground giving way under it. */
  heavy: { name: "Seismic Swing", startup: 16, active: 4, recovery: 30,
    dmg: 18, base: 5.2, scale: 1.14, angle: 32, ox: 58, oy: -2, r: 37,
    onStart(f) { Snd.whoosh(1.6); },
    vfx(f) {
      const ang = faceAng(f);
      // the arc sweeps from overhead down and forward
      FX.blade(f.x, f.y - 4, ang - 0.95 * f.facing, 54, 88, 1.9, f.ch.color,
               { w: 21, life: 17, spin: f.facing * 0.075 });
      FX.blade(f.x, f.y - 4, ang - 0.8 * f.facing, 50, 80, 1.6, "#ffffff",
               { w: 7, life: 11, core: false, spin: f.facing * 0.075 });
      FX.shake(7);
      if (f.grounded) {
        FX.dustLine(f.x + f.facing * 30, f.feetY, 120, f.ch.color2);
        FX.crack(f.x + f.facing * 26, f.feetY - 2, f.facing, 34, f.ch.color, 3);
      }
      Snd.tone(80, 0.18, "sawtooth", 0.16, 44, 0, 0.4);
    } },

  special: { name: "Quake Drop", startup: 8, active: 10, recovery: 20,
    dmg: 13, base: 4.0, scale: 0.86, angle: 78, ox: 0, oy: 30, r: 76,
    desc: "Drops like an anvil. The impact shakes the whole deck.",
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
        // the deck splits away from him in both directions
        FX.crack(f.x, f.feetY - 2, 1, 46, f.ch.color, 4);
        FX.crack(f.x, f.feetY - 2, -1, 46, f.ch.color, 4);
        FX.blade(f.x, f.feetY - 6, 0, 30, 130, 6.2, f.ch.color, { w: 9, life: 14, core: false });
        Stage.nudge(Math.sign(f.x - Stage.pivot.x || 1) * 0.034 * f.ch.weight);
        Stage.lastPusher = f;
        f.vy = -4;
      }
    } },

  super: { name: "Tectonic Verdict",
    desc: "Rears up and splits the stage. Two shockwaves run the whole deck.",
    startup: 24, active: 26, recovery: 40,
    dmg: 17, base: 5.8, scale: 1.12, angle: 50, ox: 0, oy: 26, r: 104,
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
          FX.crack(f.x, f.feetY - 2, 1, 90, "#ffffff", 5);
          FX.crack(f.x, f.feetY - 2, -1, 90, "#ffffff", 5);
          FX.blade(f.x, f.feetY - 10, 0, 40, 260, 6.28, "#ffffff", { w: 16, life: 20 });
          FX.glyph(f.x, f.feetY - 60, "wedge", 44, f.ch.accent, 26);
          Entities.shockwave(f, f.x, f.feetY, -1, m);
          Entities.shockwave(f, f.x, f.feetY, 1, m);
          Stage.nudge(Math.sign(f.x - Stage.pivot.x || 1) * 0.055);
          Stage.lastPusher = f;
        }
      }
    } },

  /* ---- art: industrial slab. Everything about him is wider at the top than
           the bottom, so he reads as top-heavy even standing still. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const sw = swing(A, -10, 46);
    const body = A.flash ? "#ffffff" : c;
    const dark = A.flash ? "#ffb9d4" : c2;
    const deep = A.flash ? "#ff8dbb" : c3;
    const wind = A.atkPhase >= 0 && A.atkPhase < 0.3;   // winding up

    // heat haze in the vents when he's about to swing
    if (wind) aura(g, 0, 4, 44, c, 0.22);

    /* --- legs: short, thick, braced wide; boots are slabs --- */
    const st = Math.sin(A.runPhase) * (A.running ? 9 : 0);
    const kneeL = A.air ? 5 : 0;
    jointLimb(g, -8, 10, -12 + st, 27 - kneeL, -3.5, 11, dark);
    jointLimb(g, 9, 10, 13 - st, 27 - kneeL, 3.5, 11, dark);
    // knee guards
    plate(g, [-17 + st * 0.5, 14, -7 + st * 0.5, 13, -7 + st * 0.5, 21, -17 + st * 0.5, 21], deep, { rimA: 0.3 });
    plate(g, [7 - st * 0.5, 13, 17 - st * 0.5, 14, 17 - st * 0.5, 21, 7 - st * 0.5, 21], deep, { rimA: 0.3 });
    // boots, with a toe cap that catches the light
    plateRect(g, -21 + st * 0.6, 25 - kneeL, 17, 9, 2.5, deep, { up: 0.18 });
    plateRect(g, 4 - st * 0.6, 25 - kneeL, 17, 9, 2.5, deep, { up: 0.18 });
    g.fillStyle = hexA(ac, 0.5);
    g.fillRect(-21 + st * 0.6, 25 - kneeL, 17, 1.6);
    g.fillRect(4 - st * 0.6, 25 - kneeL, 17, 1.6);

    /* --- torso: wide shoulders tapering hard to a narrow waist --- */
    plate(g, [-22, -16, 22, -16, 15, 13, -15, 13], body, { up: 0.3, down: 0.36, under: true });
    // sunken chest plate
    plate(g, [-16, -12, 16, -12, 12, 2, -12, 2], dark, { up: 0.14, down: 0.34, rimA: 0.26 });
    rivets(g, -12, -9, 7, 4, ac);
    // exhaust vents, lit from inside — gives the slab an interior
    for (let i = 0; i < 3; i++) {
      const vy = -6 + i * 3.4;
      g.fillStyle = INK; g.fillRect(-9, vy, 18, 2.2);
      g.fillStyle = hexA(c, wind ? 0.9 : 0.4); g.fillRect(-9, vy, 18, 1.2);
    }
    // waist belt with a buckle
    plateRect(g, -15, 3, 30, 6, 1.5, deep, { up: 0.1 });
    plate(g, [-5, 2, 5, 2, 4, 10, -4, 10], ac, { flat: true, ink: 2, rim: false });

    /* --- head: raised clear of the shoulders so he actually has one --- */
    // neck piston, drawn before the head
    plateRect(g, -5, -24, 10, 8, 2, deep, { up: 0.1, rim: false });
    plateRect(g, -10.5, -40, 21, 18, 5, body, { up: 0.32, down: 0.3 });
    // jaw grille
    g.fillStyle = INK; roundRect(g, -8.5, -27, 17, 4.5, 1.5); g.fill();
    g.strokeStyle = hexA(ac, 0.4); g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-6 + i * 4, -27); g.lineTo(-6 + i * 4, -22.5); g.stroke(); }
    // visor socket, then the lit slit inside it
    g.fillStyle = INK; roundRect(g, -11, -36, 22, 8, 2.5); g.fill();
    lens(g, () => roundRect(g, -3, -35, 12, 5.4, 2.4), A.flash ? "#ffffff" : ac, c, 15);
    // brow crest, above the skull rather than over the visor
    plate(g, [-11, -39, 11, -39, 9, -43, -8, -43], deep, { up: 0.24, rim: false });

    /* --- pauldrons: narrower and lower, so they frame the head
           instead of swallowing it --- */
    plate(g, [-26, -17, -9, -21, -7, -6, -24, -4], body, { up: 0.38, down: 0.3 });
    plate(g, [26, -17, 9, -21, 7, -6, 24, -4], body, { up: 0.4, down: 0.28 });
    // ridges on the forward pauldron
    g.strokeStyle = hexA(INK, 0.45); g.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(11 + i * 5, -20 + i * 0.6); g.lineTo(9 + i * 5, -6); g.stroke();
    }
    plate(g, [24, -16, 13, -19, 12, -13, 23, -11], dark, { up: 0.2, rimA: 0.4 });

    /* --- arms: a thick body-coloured forearm, so the anvil reads as held
           rather than floating next to him --- */
    const ax = 18 + sw, ay = -4 + (A.atkPhase >= 0 ? -3 : 0);
    // back arm first so the front one overlaps it
    jointLimb(g, -15, -11, -20 - (A.running ? st * 0.4 : 0), 2, -3.5, 9, dark);
    plateRect(g, -25, -2, 10, 10, 4.5, deep, { up: 0.14, rim: false });
    // upper arm in shadow, forearm in body colour and much thicker
    jointLimb(g, 15, -11, (15 + ax) / 2, ay - 1, 2, 10, dark);
    limb(g, (15 + ax) / 2, ay - 1, ax - 3, ay, 12, mid_(c, c2));
    // elbow/shoulder caps tie the limb to the torso
    g.fillStyle = shade(body, -0.1); g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.arc(15, -11, 5.5, 0, 7); g.stroke(); g.fill();

    /* The anvil. Shaped like one on purpose: narrow at the wrist, flaring to
       a flat face, with a horn off the back — as a plain bright rectangle it
       read as a briefcase he was carrying. */
    g.save(); g.translate(ax, ay);
    // wrist cuff, dark, so the head of the anvil starts somewhere
    plateRect(g, -12, -6, 9, 12, 2.5, deep, { up: 0.12, rim: false });
    // the horn, behind the head
    plate(g, [-4, -5, -12, -1, -4, 3], dark, { up: 0.2, ink: 2.4, rim: false });
    // the head: waisted, flaring forward
    plate(g, [-4, -11, 9, -13, 15, -10, 15, 8, 9, 11, -4, 9], dark,
          { up: 0.3, down: 0.34, under: true });
    // the striking face only — the one bright surface, kept thin
    plate(g, [12, -10, 15, -9.5, 15, 7.5, 12, 8], ac, { up: 0.1, down: 0.2, ink: 2.2 });
    // a seam line, not a pair of bright rivets -- two dots on the anvil read
    // as eyes and turned the weapon into a face
    g.strokeStyle = hexA(INK, 0.5); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(1, -9); g.lineTo(1, 7); g.stroke();
    g.restore();
  },
},

/* ======================================================================== */
/* ZIP — THE SPARK                                                           */
/* ======================================================================== */
{
  id: "ZIP", name: "ZIP", tag: "THE SPARK",
  blurb: "Lightest, fastest fighter in the game. Dies to one clean read.",
  power: "Dashes clean through anyone standing in the way, dealing damage as she passes.",
  color: "#00e5ff", color2: "#07475a", color3: "#04232e", accent: "#eafdff",
  weight: 0.74, speed: 5.65, accel: 1.05, jump: 12.9, airSpeed: 5.3, fallMul: 0.9,
  size: { w: 30, h: 50 }, hurt: 24,
  specialCooldown: 60,

  /* Three fast taps instead of one poke — and each tap gets its own small arc
     at a different angle, so the flurry reads as three distinct strikes rather
     than one effect flickering. */
  light: { name: "Spark Flurry", startup: 3, active: 12, recovery: 10,
    dmg: 2.4, base: 1.1, scale: 0.26, angle: 52, ox: 32, oy: -8, r: 20,
    hits: 3, hitGap: 4,
    vfx(f, a) { this.vfxRehit(f, a); },
    vfxRehit(f, a) {
      const n = a.hitIndex || 0;
      const p = hbAt(f, this), ang = faceAng(f);
      const tilt = [-0.5, 0.15, -0.2][n % 3];
      FX.blade(f.x + f.facing * 8, f.y - 8, ang + tilt, 26, 46, 1.0, f.ch.color,
               { w: 7.5, life: 9 });
      FX.bolt(f.x + f.facing * 12, f.y - 8, p.x + f.facing * 10, p.y + tilt * 20,
              f.ch.color, { segs: 4, jag: 7, life: 6, w: 2 });
      FX.spark(p.x, p.y, f.ch.accent);
      Snd.tone(760 + n * 160, 0.04, "square", 0.08, 1500);
    } },

  /* A lance: one long narrow spike along the dash, not a sweep. */
  heavy: { name: "Volt Lance", startup: 11, active: 4, recovery: 24,
    dmg: 12, base: 3.6, scale: 0.98, angle: 38, ox: 52, oy: -6, r: 26,
    onStart(f) { f.vx += f.facing * 5.5; Snd.whoosh(1.2); },
    vfx(f) {
      const ang = faceAng(f);
      FX.blade(f.x + f.facing * 10, f.y - 6, ang, 36, 104, 0.34, f.ch.color,
               { w: 34, life: 13 });
      FX.bolt(f.x + f.facing * 10, f.y - 6, f.x + f.facing * 104, f.y - 6,
              f.ch.accent, { segs: 7, jag: 7, life: 10, w: 3.4 });
      FX.bolt(f.x + f.facing * 10, f.y - 6, f.x + f.facing * 70, f.y - 22,
              f.ch.accent, { segs: 5, jag: 9, life: 8, w: 2 });
      FX.glyph(f.x + f.facing * 54, f.y - 6, "bolt", 15, f.ch.accent, 14);
      FX.shake(4);
      Snd.tone(1200, 0.1, "sawtooth", 0.1, 260);
    } },

  special: { name: "Polarity Flip", startup: 4, active: 12, recovery: 12,
    dmg: 7, base: 2.6, scale: 0.6, angle: 58, ox: 24, oy: -6, r: 28,
    desc: "Dashes clean through anyone in the way.",
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
        // two arcs chasing opposite ways: the tilt reversing, made visible
        FX.blade(Stage.pivot.x, Stage.pivot.y, 0, 50, 180, 2.8, f.ch.color,
                 { w: 13, life: 20, spin: 0.07 });
        FX.blade(Stage.pivot.x, Stage.pivot.y, Math.PI, 50, 180, 2.8, f.ch.accent,
                 { w: 13, life: 20, spin: -0.07 });
        for (let i = 0; i < 5; i++)
          FX.bolt(Stage.pivot.x, Stage.pivot.y,
                  Stage.pivot.x + rnd(-240, 240), Stage.pivot.y + rnd(-60, 40),
                  f.ch.color, { segs: 5, jag: 16, life: 11, w: 2.4 });
        FX.banner("POLARITY FLIP", f.ch.color);
        FX.shake(9);
      }
    } },

  super: { name: "Lightspeed Gauntlet",
    desc: "Becomes a line of afterimages. Eight strikes on whoever is closest, then a launcher.",
    startup: 14, active: 42, recovery: 32,
    dmg: 2.5, base: 1.0, scale: 0.20, angle: 60, ox: 0, oy: -6, r: 36,
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
        // a cut at the target from whatever angle she arrived at
        FX.blade(tgt.x, tgt.y, ang + Math.PI, 16, 52, 1.5, f.ch.color, { w: 9, life: 9 });
        FX.bolt(f.x, f.y, tgt.x, tgt.y, f.ch.accent, { segs: 4, jag: 10, life: 5, w: 2 });
        Snd.tone(900 + n * 90, 0.05, "square", 0.12, 400);
        FX.hitPause(2);
      }
      f.vx = 0; f.vy = 0;                    // frozen mid-super
      if (step === m.active - 1) {           // the finisher
        a.data = Object.assign({}, m, { dmg: 10, base: 4.4, scale: 0.95, angle: 48, r: 62 });
        a.hitIds = null;
        Snd.superHit(); FX.shake(22); FX.hitPause(12);
        FX.ring(f.x, f.y, 14, 300, "#ffffff", 4);
      }
    } },

  /* ---- art: every line rakes forward, and nothing on her is ever fully
           still — the ribbons and arc-coil keep moving at idle. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c;
    const dark = A.flash ? "#bfefff" : c2;
    const deep = A.flash ? "#9ee6ff" : c3;
    const sw = swing(A, -8, 40);
    const fast = Math.min(1, Math.abs(A.vx) / 5);

    aura(g, 0, -6, 34, c, 0.16 + fast * 0.14);

    /* --- trailing ribbons. Each is drawn segment by segment, thinning and
           fading toward the tail, so they read as streamers coming off her
           rather than one closed loop hanging behind like a wing. --- */
    g.save();
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const at = (s) => [
        -8 - s * (7 + fast * 6),
        -13 + i * 6.5 + Math.sin(A.time * 0.14 + s * 0.8 + i) * (3 + s * 1.4),
      ];
      for (let s = 0; s < 4; s++) {
        const [x1, y1] = at(s), [x2, y2] = at(s + 1);
        g.globalAlpha = (0.30 - i * 0.07) * (1 - s * 0.24);
        g.strokeStyle = c; g.lineWidth = (2.6 - i * 0.5) * (1 - s * 0.2);
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      }
    }
    g.restore();

    /* --- arc-coil on her back: two beads chasing each other --- */
    g.save();
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = hexA(c, 0.5); g.lineWidth = 1.6;
    g.beginPath(); g.arc(-7, -8, 9, -0.6, 2.4); g.stroke();
    for (let i = 0; i < 2; i++) {
      const an = -0.6 + ((A.time * 0.07 + i * 1.5) % 3.0);
      g.fillStyle = ac; g.shadowColor = c; g.shadowBlur = 10;
      g.beginPath(); g.arc(-7 + Math.cos(an) * 9, -8 + Math.sin(an) * 9, 2, 0, 7); g.fill();
    }
    g.restore();

    /* --- legs: long, thin, sprinter's blade feet --- */
    const st = Math.sin(A.runPhase) * (A.running ? 14 : 0);
    jointLimb(g, -4, 8, -7 + st, 24, -4.5, 5.5, dark);
    jointLimb(g, 5, 8, 8 - st, 24, 4.5, 5.5, dark);
    plate(g, [-12 + st, 22, -2 + st, 22, -5 + st, 28], ac, { up: 0.1, ink: 2.2, rim: false });
    plate(g, [3 - st, 22, 13 - st, 22, 10 - st, 28], ac, { up: 0.1, ink: 2.2, rim: false });

    /* --- torso: narrow wedge, raked harder the faster she goes --- */
    g.save(); g.rotate(A.running ? 0.12 : 0.05 + Math.sin(A.time * 0.06) * 0.015);
    plate(g, [-10, -14, 12, -16, 9, 10, -8, 9], body, { up: 0.3, down: 0.34, under: true });
    plate(g, [-7, -11, 9, -12, 7, 0, -6, 0], dark, { up: 0.12, down: 0.3, rimA: 0.3 });
    // shoulder flare
    plate(g, [4, -16, 14, -17, 13, -10, 5, -11], body, { up: 0.4, rimA: 0.6 });
    // lightning emblem, burning
    lens(g, () => poly(g, [2, -10, -3, -2, 1, -2, -3, 6, 5, -3, 1, -3]), ac, c, 12);
    // thin circuit traces on the flank
    g.strokeStyle = hexA(ac, 0.35); g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-6, 2); g.lineTo(-2, 2); g.lineTo(-2, 7); g.lineTo(5, 7); g.stroke();
    g.restore();

    /* --- neck, so the helmet doesn't sit straight on the chest --- */
    plateRect(g, -3, -20, 6.5, 6, 2, dark, { up: 0.1, rim: false });

    /* --- head: swept wedge helmet, smaller than it was — it was reading as
           a bobblehead at match scale --- */
    g.save(); g.translate(1, -24); g.rotate(0.06);
    plate(g, [-8, -6, 7, -8, 10.5, 2, -7, 5.5], body, { up: 0.34, down: 0.3 });
    // swept back fin
    plate(g, [-7, -5, -16, -1.5, -7, 3.5], dark, { up: 0.2, ink: 2.4, rimA: 0.4 });
    // jaw shadow under the visor
    g.fillStyle = hexA(INK, 0.45); poly(g, [-6, 1.5, 10, 1.5, 9, 4.5, -6, 4.5]); g.fill();
    lens(g, () => poly(g, [-1.5, -4, 9.5, -2, 9.5, 1.6, -2.5, 0.8]),
         A.flash ? "#ff2e88" : ac, c, 14);
    // crest spark
    g.fillStyle = hexA(ac, 0.6); poly(g, [-2, -7, 3.5, -8, 1.5, -5.5]); g.fill();
    g.restore();

    /* --- arms: forearm in a mid tone so the glove reads as held --- */
    jointLimb(g, -7, -10, -14 - (A.running ? st * 0.3 : 0), -1, -3.5, 5, dark);
    g.fillStyle = dark; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.arc(-15, 0, 4.2, 0, 7); g.stroke(); g.fill();

    const ax = 14 + sw, ay = -6;
    jointLimb(g, 8, -10, (8 + ax) / 2, ay - 1, 2.5, 5.5, dark);
    limb(g, (8 + ax) / 2, ay - 1, ax - 2, ay, 6.5, mid_(c, c2));
    g.fillStyle = shade(body, -0.1); g.strokeStyle = INK; g.lineWidth = 1.8;
    g.beginPath(); g.arc(8, -10, 4, 0, 7); g.stroke(); g.fill();
    const hot = A.atkPhase >= 0;
    if (hot) {
      // crackle arcs off the glove mid-swing
      g.save(); g.globalCompositeOperation = "lighter";
      g.strokeStyle = hexA(ac, 0.75); g.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const a0 = A.time * 0.5 + i * 2.1;
        g.beginPath(); g.moveTo(ax, ay);
        g.lineTo(ax + Math.cos(a0) * 11, ay + Math.sin(a0) * 11);
        g.stroke();
      }
      g.restore();
    }
    // the arc glove: a cyan core, not a white ball
    g.fillStyle = INK; g.beginPath(); g.arc(ax, ay, 4.6, 0, 7); g.fill();
    lens(g, () => { g.beginPath(); g.arc(ax, ay, 3.4, 0, 7); }, c, c, hot ? 20 : 9);
    g.fillStyle = hexA(ac, 0.9);
    g.beginPath(); g.arc(ax - 1, ay - 1.2, 1.3, 0, 7); g.fill();
  },
},

/* ======================================================================== */
/* ORBIT — THE KEEL                                                          */
/* ======================================================================== */
{
  id: "ORBIT", name: "ORBIT", tag: "THE KEEL",
  blurb: "Fights at arm's length with orbs and a pull-everyone-in super.",
  power: "Fires an orb down the deck on her special, and opens a well that drags fighters in for her super.",
  color: "#b6ff3b", color2: "#2f5410", color3: "#152806", accent: "#f4ffdd",
  weight: 1.02, speed: 4.25, accel: 0.78, jump: 12.1, airSpeed: 4.0, fallMul: 1.0,
  size: { w: 36, h: 54 }, hurt: 27,
  specialCooldown: 480,

  /* Everything Orbit does is circular, so its attacks are rings and ellipses
     where the others get crescents. */
  light: { name: "Ring Cut", startup: 3, active: 3, recovery: 9,
    dmg: 3.8, base: 1.8, scale: 0.44, angle: 46, ox: 38, oy: -8, r: 23,
    vfx(f) {
      const p = hbAt(f, this);
      // a closed ring rather than a slash
      FX.blade(p.x, p.y, 0, 12, 34, 6.28, f.ch.color, { w: 5, life: 12, spin: 0.09 });
      FX.ring(p.x, p.y, 8, 40, f.ch.accent, 2);
      FX.glyph(p.x, p.y, "orbit", 15, f.ch.accent, 13);
      Snd.tone(900, 0.05, "sine", 0.07, 1500);
    } },

  /* An overhead orbital drop: the arc comes down from above and a bead falls
     in with it. */
  heavy: { name: "Satellite Slam", startup: 14, active: 3, recovery: 27,
    dmg: 15.5, base: 4.4, scale: 1.06, angle: 70, ox: 40, oy: -14, r: 32,
    onStart(f) { Snd.whoosh(1.3); },
    vfx(f) {
      const p = hbAt(f, this), ang = faceAng(f);
      FX.blade(f.x, f.y - 10, ang - 1.25 * f.facing, 42, 78, 1.7, f.ch.color,
               { w: 16, life: 15, spin: f.facing * 0.065 });
      FX.ring(p.x, p.y, 10, 66, f.ch.color, 3);
      FX.glyph(p.x, p.y, "orbit", 26, f.ch.accent, 18);
      // the satellite itself, streaking in
      FX.streak(f.x + f.facing * 10, f.y - 70, p.x, p.y, f.ch.accent);
      FX.burst(p.x, p.y, 10, f.ch.accent, 5);
      FX.shake(5);
      Snd.tone(300, 0.14, "triangle", 0.12, 110);
    } },

  special: { name: "Keel Anchor", startup: 7, active: 6, recovery: 16,
    dmg: 6, base: 2.4, scale: 0.5, angle: 20, ox: 34, oy: -10, r: 24,
    desc: "Fires an orb down the deck and throws up a three-second warning pulse where she's standing.",
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
          /* A horizon snapping into place: straight lines out along the level.
             A narrow arc at that radius just rendered as a blob at each end of
             the deck, because a blade's thickness is radial. */
          for (const d of [-1, 1]) {
            FX.streak(Stage.pivot.x, Stage.pivot.y,
                      Stage.pivot.x + d * 340, Stage.pivot.y, f.ch.color);
            FX.streak(Stage.pivot.x, Stage.pivot.y - 3,
                      Stage.pivot.x + d * 300, Stage.pivot.y - 3, f.ch.accent);
          }
          FX.glyph(Stage.pivot.x, Stage.pivot.y - 40, "orbit", 40, f.ch.accent, 30);
        }
        Entities.orb(f, f.x + f.facing * 30, f.y - 10, f.facing * 11, -1.2, m);
      }
    } },

  super: { name: "Event Horizon",
    desc: "Opens a well that drags every fighter in, holds them there, then collapses.",
    startup: 18, active: 74, recovery: 36,
    dmg: 19, base: 6.0, scale: 1.05, angle: 62, ox: 0, oy: 0, r: 0,
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

  /* ---- art: the only symmetrical fighter. No legs — a hovering keel, so
           it reads as machinery holding itself level on purpose. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c;
    const dark = A.flash ? "#e4ffb9" : c2;
    const deep = A.flash ? "#cdf58d" : c3;
    const sw = swing(A, -8, 40);
    const spin = A.time * 0.05;
    const bob = Math.sin(A.time * 0.045) * 1.6;      // it never quite touches down

    aura(g, 0, -4, 34, c, 0.1);

    g.save(); g.translate(0, bob);

    /* --- halo: sits low around the hips, not through the arms, where its
           beads were being misread as a second pair of hands --- */
    const ringR = 29, tiltY = 0.34, ringY = 12;
    const ringPath = (a0, a1) => {
      g.beginPath(); g.ellipse(0, ringY, ringR, ringR * tiltY, 0.18, a0, a1);
    };
    g.save();
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = hexA(c, 0.4); g.lineWidth = 3.4;
    ringPath(Math.PI, Math.PI * 2); g.stroke();
    g.restore();

    /* --- keel skirt: a hull, with thruster slots in the underside --- */
    const sway = Math.sin(A.runPhase * 0.5) * (A.running ? 3 : 1);
    plate(g, [-10, 2, 10, 2, 15 + sway, 26, -15 + sway, 26], dark, { up: 0.18, down: 0.4, under: true });
    plate(g, [-13 + sway, 21, 13 + sway, 21, 15 + sway, 26, -15 + sway, 26], deep, { up: 0.12, rimA: 0.3 });
    // the keel fin, lit along its spine
    g.strokeStyle = hexA(ac, 0.55); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(0, 3); g.lineTo(sway, 25); g.stroke();
    // thruster glow beneath — brighter while airborne
    // (kept in the body colour and soft-edged — in the bright accent these
    //  read as a row of white teeth under the skirt)
    g.save(); g.globalCompositeOperation = "lighter";
    const flen = A.air ? 14 : 5;
    for (let i = -1; i <= 1; i++) {
      const q = g.createLinearGradient(0, 24, 0, 24 + flen);
      q.addColorStop(0, hexA(c, A.air ? 0.5 : 0.28)); q.addColorStop(1, hexA(c, 0));
      g.fillStyle = q;
      g.beginPath();
      g.moveTo(i * 7 - 2.4 + sway, 24); g.lineTo(i * 7 + 2.4 + sway, 24);
      g.lineTo(i * 7 + sway, 24 + flen);
      g.closePath(); g.fill();
    }
    g.restore();

    /* --- torso: a smooth capsule with a seam and a core gem --- */
    plateRect(g, -14, -16, 28, 22, 10, body, { up: 0.3, down: 0.36, under: true });
    plateRect(g, -10, -12, 20, 14, 7, dark, { up: 0.12, down: 0.3, rimA: 0.28 });
    // panel seam across the chest
    g.strokeStyle = hexA(INK, 0.4); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-13, -2); g.lineTo(13, -2); g.stroke();
    // the core, with a bright ring around it
    g.strokeStyle = hexA(ac, 0.45); g.lineWidth = 1.3;
    g.beginPath(); g.arc(0, -5, 7, 0, 7); g.stroke();
    lens(g, () => { g.beginPath(); g.arc(0, -5, 4.6, 0, 7); }, ac, c, 16);

    /* --- arms: back then front, with ring-cutter emitters for hands --- */
    jointLimb(g, -11, -12, -17, -2, -3.5, 6.5, dark);
    plateRect(g, -22, -7, 10, 10, 5, body, { up: 0.26 });
    const ax = 16 + sw, ay = -8;
    jointLimb(g, 11, -12, (11 + ax) / 2, ay - 1, 2.5, 7, dark);
    limb(g, (11 + ax) / 2, ay - 1, ax - 2, ay, 8, mid_(c, c2));
    g.fillStyle = shade(body, -0.1); g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.arc(11, -12, 4.6, 0, 7); g.stroke(); g.fill();
    g.save(); g.translate(ax, ay);
    plateRect(g, -5.5, -5.5, 11, 11, 5.5, body, { up: 0.3 });
    // the emitter disc spins, and flares during an attack
    g.save(); g.rotate(spin * 3);
    g.strokeStyle = hexA(ac, A.atkPhase >= 0 ? 0.95 : 0.5);
    g.lineWidth = 1.6; g.shadowColor = c; g.shadowBlur = A.atkPhase >= 0 ? 14 : 5;
    g.beginPath(); g.arc(0, 0, 7.5, 0.4, 2.6); g.stroke();
    g.beginPath(); g.arc(0, 0, 7.5, 3.6, 5.8); g.stroke();
    g.restore();
    g.restore();

    /* --- head: smooth dome, wide sensor band, antenna --- */
    // antenna first, behind the dome
    limb(g, 0, -34, 2, -42, 2.2, dark);
    g.fillStyle = ac; g.shadowColor = c; g.shadowBlur = 8;
    g.beginPath(); g.arc(2, -43, 2.1, 0, 7); g.fill(); g.shadowBlur = 0;

    const domePath = () => { g.beginPath(); g.arc(0, -27, 11.5, 0, 7); };
    ink(g, domePath, vol(g, -38, -16, body, 0.32, 0.3));
    rim(g, domePath, "#ffffff", 3, 0.55);
    // sensor band, sunk into the dome
    g.fillStyle = INK; roundRect(g, -12, -30.5, 24, 8, 3.5); g.fill();
    lens(g, () => roundRect(g, -7.5, -29.5, 15, 5, 2.5),
         A.flash ? "#ff2e88" : ac, c, 14);
    // two small status pips on the cheek
    g.fillStyle = hexA(ac, 0.55);
    g.beginPath(); g.arc(-6, -20.5, 1.2, 0, 7); g.fill();
    g.beginPath(); g.arc(-2, -20.5, 1.2, 0, 7); g.fill();

    /* --- front half of the halo + beads, over everything --- */
    g.save();
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = hexA(c, 0.9); g.lineWidth = 3.4;
    ringPath(0, Math.PI); g.stroke();
    g.strokeStyle = hexA("#ffffff", 0.35); g.lineWidth = 1.2;
    ringPath(0, Math.PI); g.stroke();
    for (let i = 0; i < 2; i++) {
      const an = spin + i * Math.PI;
      const bx = Math.cos(an) * ringR, by = -2 + Math.sin(an) * ringR * tiltY;
      const front = Math.sin(an) > 0;                 // nearer beads are bigger
      g.fillStyle = ac; g.shadowColor = c; g.shadowBlur = 12;
      g.beginPath(); g.arc(bx, by, front ? 3.6 : 2.4, 0, 7); g.fill();
    }
    g.restore();

    g.restore();
  },
},

/* ======================================================================== */
/* PIVOT — THE TRICKSTER                                                     */
/* ======================================================================== */
{
  id: "PIVOT", name: "PIVOT", tag: "THE TRICKSTER",
  blurb: "Does not fight you so much as fight the floor you are standing on.",
  power: "A sustained swipe she can hold and aim, and a planted point-blank AoE for her super.",
  color: "#ffc83d", color2: "#5e3c05", color3: "#2c1c02", accent: "#fff6dc",
  weight: 0.88, speed: 4.6, accel: 0.9, jump: 12.4, airSpeed: 4.5, fallMul: 0.96,
  size: { w: 34, h: 52 }, hurt: 26,
  specialCooldown: 110,

  /* A fan, so the effect is three thin leaves opening at once. */
  light: { name: "Fan Slice", startup: 3, active: 3, recovery: 9,
    dmg: 3.2, base: 1.6, scale: 0.4, angle: 48, ox: 36, oy: -8, r: 22,
    vfx(f) {
      const ang = faceAng(f);
      for (let i = 0; i < 3; i++) {
        FX.blade(f.x + f.facing * 8, f.y - 8, ang + (i - 1) * 0.5 * f.facing, 22, 58 - i * 4, 0.8,
                 i === 1 ? f.ch.accent : f.ch.color, { w: 6.5, life: 10 + i, core: i === 1 });
      }
      Snd.tone(1100, 0.04, "triangle", 0.07, 1700);
    } },

  /* A crescent plus a balance stamped on the victim — her whole kit still
     reads as "the scale" even with the stage itself no longer tilting. */
  heavy: { name: "Scale Breaker", startup: 13, active: 4, recovery: 26,
    dmg: 13.5, base: 4.0, scale: 1.0, angle: 44, ox: 48, oy: -8, r: 29,
    vfx(f) {
      const ang = faceAng(f);
      FX.blade(f.x + f.facing * 6, f.y - 8, ang - 0.85 * f.facing, 46, 82, 1.8, f.ch.color,
               { w: 15, life: 15, spin: f.facing * 0.07 });
      FX.blade(f.x + f.facing * 6, f.y - 8, ang - 0.7 * f.facing, 42, 74, 1.5, f.ch.accent,
               { w: 5, life: 10, core: false, spin: f.facing * 0.07 });
      FX.shake(4);
      Snd.tone(420, 0.1, "triangle", 0.11, 180);
    },
    onHit(f, def) {
      FX.ring(def.x, def.y, 8, 90, f.ch.color, 2);
      FX.glyph(def.x, def.y - 16, "scale", 20, f.ch.accent, 22);
    } },

  special: { name: "Hand on the Scale", startup: 5, active: 40, recovery: 14,
    dmg: 5, base: 2.0, scale: 0.42, angle: 90, ox: 20, oy: -14, r: 26,
    desc: "Hold to lean into a sustained swipe wherever she's pointed.",
    tick(f, a, inp) {
      const m = a.data;
      const lean = inp.ax !== 0 ? inp.ax : f.facing;
      if (a.t > m.startup && a.t <= m.startup + m.active) {
        f.vx *= 0.6; f.vy *= 0.8;
        if (a.t % 3 === 0) FX.spark(f.x + lean * 26, f.y - 10, f.ch.color);
        /* A lever arm miming the old crank — drawn out in front of her now
           instead of toward the stage pivot, which no longer moves. */
        if (a.t % 7 === 0) {
          FX.streak(f.x, f.y - 10,
                    f.x + lean * 230, f.y - 20, f.ch.color);
          FX.streak(f.x, f.y - 10,
                    f.x + lean * 180, f.y - 4, f.ch.accent);
          FX.glyph(f.x + lean * 34, f.y - 14, "scale", 15, f.ch.accent, 14);
        }
        if (!inp.held("special")) a.t = m.startup + m.active + 1;
      }
    } },

  super: { name: "Dead Weight",
    desc: "Drops every ounce of her weight into one spot and holds the floor there, immune and growing.",
    startup: 16, active: 54, recovery: 34,
    dmg: 12, base: 4.4, scale: 0.9, angle: 72, ox: 0, oy: 0, r: 82,
    onStart(f) { Snd.superCharge(); FX.flash("#ffc83d", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.8; FX.spark(f.x + rnd(-26, 26), f.y + rnd(-30, 30), f.ch.color); }
      if (a.t === m.startup) {
        FX.banner("DEAD WEIGHT", f.ch.color);
        Snd.superHit();
        FX.shake(10);
      }
      if (a.t >= m.startup && a.t < m.startup + m.active) {
        // planted and immune; she doesn't move, the hitbox does the work
        f.pinned = true;
        f.vx = 0; f.vy = 0;
        if (a.t % 4 === 0) FX.spark(f.x + rnd(-80, 80), f.y + rnd(-10, 20), f.ch.color);
        if (a.t % 9 === 0) {
          FX.ring(f.x, f.y, 10, 160, f.ch.color, 2);
          FX.glyph(f.x, f.y - 90, "scale", 34, f.ch.accent, 18);
        }
      }
      if (a.t === m.startup + m.active) f.pinned = false;
    } },

  /* ---- art: deliberately lopsided — one huge gauntlet, one bare hand, a
           hood with no face in it. The scarf does the acting. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c;
    const dark = A.flash ? "#ffe9b4" : c2;
    const deep = A.flash ? "#ffd98a" : c3;
    const sw = swing(A, -9, 42);

    aura(g, 6, -8, 30, c, 0.14);

    /* --- scarf: two tails on offset sines, tapering to a point. Kept in the
           body colour rather than the shadow colour — in shadow brown it read
           as a pair of antlers instead of cloth, and it was wide enough to
           outweigh the character it belongs to. --- */
    const scarf = mid_(c, c2);
    for (let t = 0; t < 2; t++) {
      g.save();
      const spread = t === 0 ? 0 : 4;
      const seg = (s) => [
        -4 - s * 7.2 - Math.abs(A.vx) * 0.8 * s * 0.35,
        // trails DOWN behind her: curling upward made it read as a hook
        -17 + spread + Math.sin(A.time * 0.1 + s * 0.7 + t * 1.3) * (2.2 + s * 1.3) + s * 3.4,
      ];
      g.lineCap = "round"; g.lineJoin = "round";
      // taper: each segment drawn thinner than the last
      for (let s = 0; s < 5; s++) {
        const [x1, y1] = seg(s), [x2, y2] = seg(s + 1);
        const w = (t ? 4.2 : 6.0) * (1 - s * 0.19);
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
        g.strokeStyle = INK; g.lineWidth = w + 1.8; g.stroke();
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
        g.strokeStyle = t ? shade(scarf, -0.22) : scarf; g.lineWidth = w; g.stroke();
      }
      g.restore();
    }

    /* --- legs: thin, with wrapped shins --- */
    const st = Math.sin(A.runPhase) * (A.running ? 12 : 0);
    jointLimb(g, -5, 9, -9 + st, 25, -4.5, 6, dark);
    jointLimb(g, 6, 9, 10 - st, 25, 4.5, 6, dark);
    // shin wraps
    g.strokeStyle = hexA(deep, 0.85); g.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(-12 + st, 15 + i * 3); g.lineTo(-6 + st, 14 + i * 3); g.stroke();
      g.beginPath(); g.moveTo(7 - st, 14 + i * 3); g.lineTo(13 - st, 15 + i * 3); g.stroke();
    }
    plateRect(g, -15 + st, 23, 12, 6, 2, deep, { up: 0.16 });
    plateRect(g, 4 - st, 23, 12, 6, 2, deep, { up: 0.16 });

    /* --- torso: slim wedge, a sash, and the balance-scale brand --- */
    plate(g, [-11, -15, 11, -15, 9, 11, -9, 11], body, { up: 0.3, down: 0.34, under: true });
    plate(g, [-8, -11, 8, -11, 6, 1, -6, 1], dark, { up: 0.12, down: 0.3, rimA: 0.28 });
    // sash across the body — asymmetry again
    plate(g, [-10, -4, 10, -13, 11, -8, -9, 1], mid_(c, c2), { up: 0.2, ink: 2.2, rimA: 0.35 });
    // The scale, tipped: one pan always hangs lower. Kept to three strokes —
    // with a centre post as well it turned into a scribble at match scale.
    const tip = Math.sin(A.time * 0.035) * 1.8;
    glow(g, ac, 9, () => {
      g.strokeStyle = ac; g.lineWidth = 1.9; g.lineCap = "round";
      g.beginPath(); g.moveTo(-6, -6.5 - tip); g.lineTo(6, -6.5 + tip); g.stroke();
      g.beginPath(); g.moveTo(-6, -6.5 - tip); g.lineTo(-6, -4 - tip); g.stroke();
      g.beginPath(); g.moveTo(6, -6.5 + tip); g.lineTo(6, -4 + tip); g.stroke();
    });

    /* --- back arm: slim, bare-handed --- */
    jointLimb(g, -9, -11, -16, 0, -3.5, 5, dark);
    g.fillStyle = body; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.arc(-17, 1, 4.2, 0, 7); g.stroke(); g.fill();

    /* --- front arm: the oversized gauntlet, braced by a shoulder cowl --- */
    plate(g, [6, -16, 16, -14, 15, -7, 7, -9], body, { up: 0.4, rimA: 0.6 });
    const ax = 17 + sw, ay = -7;
    jointLimb(g, 9, -11, (9 + ax) / 2, ay - 1, 2.5, 6.5, dark);
    limb(g, (9 + ax) / 2, ay - 1, ax - 4, ay, 8, mid_(c, c2));
    g.fillStyle = shade(body, -0.1); g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.arc(9, -11, 4.4, 0, 7); g.stroke(); g.fill();
    /* The lever gauntlet: a wedge that tapers to its point, with a dark
       knuckle bar. As a bright slab it read as a briefcase too. */
    g.save(); g.translate(ax, ay); g.rotate(A.atkPhase >= 0 ? -0.3 : 0.1);
    plateRect(g, -10, -6, 7, 11, 2.5, deep, { up: 0.12, rim: false });
    plate(g, [-3, -9, 8, -7.5, 14, -1, 14, 1, 8, 8, -3, 9], body,
          { up: 0.34, down: 0.34, under: true });
    g.fillStyle = INK; g.fillRect(-2, -3, 11, 3.4);
    g.fillStyle = hexA(c, 0.5); g.fillRect(-2, -3, 11, 1.2);
    g.strokeStyle = hexA(INK, 0.45); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(2, -7); g.lineTo(2, 6); g.stroke();
    // the edge the stage actually gets levered with
    lens(g, () => poly(g, [9, -5.5, 14, -0.6, 14, 0.6, 9, 6]), ac, c, 13);
    g.restore();

    /* --- head: pointed hood, no face — just a visor in the shadow --- */
    const hoodPath = () => poly(g, [-10, -22, 10, -22, 7, -36, -2, -40, -11, -33]);
    ink(g, hoodPath, vol(g, -40, -22, body, 0.3, 0.3));
    rim(g, hoodPath, "#ffffff", 3, 0.5);
    // the inside of the hood is genuinely dark
    g.fillStyle = INK; poly(g, [-10, -22, 10, -22, 8, -28, -10, -28]); g.fill();
    g.fillStyle = hexA(deep, 0.5); poly(g, [-10, -22, 10, -22, 9.4, -24, -10, -24]); g.fill();
    lens(g, () => poly(g, [-5, -30, 8, -28, 8, -24.5, -5, -26]),
         A.flash ? "#ff2e88" : ac, c, 15);
    // hood fold + the point
    g.strokeStyle = hexA(INK, 0.4); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-7, -32); g.lineTo(2, -35); g.stroke();
  },
},

/* ======================================================================== */
/* BALLAST — THE LOADER                                                      */
/* The only fighter who can tilt the stage from somewhere they are not       */
/* standing: its cubes are real weight on the pivot until they expire.       */
/* ======================================================================== */
{
  id: "BALLAST", name: "BALLAST", tag: "THE LOADER",
  blurb: "Dockyard loader. Drops cubes of real weight onto the deck as obstacles and zoning tools.",
  power: "Places cubes remotely — they sit as obstacles and hazards even with nobody standing near them.",
  color: "#ffa424", color2: "#5a3708", color3: "#241502", accent: "#ffe6b0",
  weight: 1.18, speed: 3.40, accel: 0.60, jump: 11.4, airSpeed: 3.2, fallMul: 1.08,
  size: { w: 42, h: 58 }, hurt: 29,
  specialCooldown: 200,

  light: { name: "Load Arm", startup: 4, active: 3, recovery: 11,
    dmg: 4.2, base: 2.1, scale: 0.52, angle: 40, ox: 40, oy: -6, r: 24,
    vfx(f) {
      const ang = faceAng(f);
      FX.blade(f.x + f.facing * 12, f.y - 6, ang, 28, 58, 0.44, f.ch.color, { w: 13, life: 10 });
      FX.glyph(hbAt(f, this).x, f.y - 6, "wedge", 11, f.ch.accent, 11);
      Snd.tone(190, 0.05, "square", 0.08, 120);
    } },

  heavy: { name: "Counterweight", startup: 15, active: 4, recovery: 29,
    dmg: 17, base: 5.0, scale: 1.10, angle: 36, ox: 56, oy: -4, r: 36,
    onStart(f) { Snd.whoosh(1.5); },
    vfx(f) {
      const ang = faceAng(f);
      // a cube on a chain, so the arc is a long low sweep with a heavy tip
      FX.blade(f.x, f.y - 6, ang - 0.8 * f.facing, 58, 92, 1.7, f.ch.color,
               { w: 20, life: 16, spin: f.facing * 0.07 });
      FX.streak(f.x + f.facing * 10, f.y - 14,
                f.x + f.facing * 78, f.y - 2, f.ch.accent);
      if (f.grounded) FX.dustLine(f.x + f.facing * 34, f.feetY, 110, f.ch.color2);
      FX.shake(7);
      Snd.tone(96, 0.16, "sawtooth", 0.15, 50, 0, 0.4);
    } },

  special: { name: "Drop Anchor", startup: 10, active: 6, recovery: 22,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Lobs a ballast cube that sits where it lands as an obstacle for eight seconds.",
    onStart(f) { Snd.whoosh(1.1); },
    tick(f, a) {
      const m = a.data;
      if (a.t === m.startup && !a.fired) {
        a.fired = true;
        Entities.ballast(f, f.x + f.facing * 34, f.y - 40, f.facing * 7.2, 2.4, 480, m);
        Stage.lastPusher = f;
        FX.banner("DROP ANCHOR", f.ch.color);
        FX.ring(f.x + f.facing * 34, f.y - 40, 10, 90, f.ch.accent, 3);
        Snd.tone(150, 0.2, "triangle", 0.14, 70);
      }
    } },

  super: { name: "Overload",
    desc: "Buries the deck under three cubes at once.",
    startup: 22, active: 30, recovery: 38,
    dmg: 10, base: 3.4, scale: 0.8, angle: 60, ox: 0, oy: -20, r: 60,
    onStart(f) { Snd.superCharge(); FX.flash("#ffa424", 0.3); f.vy = -6; },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.82; FX.spark(f.x + rnd(-30, 30), f.y + rnd(-40, 20), f.ch.color); }
      if (a.t >= m.startup && (a.t - m.startup) % 9 === 0 && (a.dropped || 0) < 3) {
        a.dropped = (a.dropped || 0) + 1;
        const off = (a.dropped - 2) * 150;
        Entities.ballast(f, Stage.pivot.x + off, Stage.pivot.y - 320, 0, 3.1, 420, m);
        FX.shake(9);
        Snd.tone(120 - a.dropped * 14, 0.2, "sawtooth", 0.14, 48);
      }
      if (a.t === m.startup) {
        FX.banner("OVERLOAD", f.ch.color);
        Stage.lastPusher = f;
      }
    } },

  /* ---- art: a dockyard loader. Boxy chassis, a shoulder jib with a hook,
           hazard striping, and treads instead of feet. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c;
    const dark = A.flash ? "#ffe2ad" : c2;
    const deep = A.flash ? "#ffcf80" : c3;
    const sw = swing(A, -10, 44);

    /* --- the jib arm and its hanging cube, behind the body --- */
    const jibA = -0.5 + (A.atkPhase >= 0 ? sw * 0.012 : 0);
    g.save();
    g.translate(-10, -12); g.rotate(jibA + 0.25);
    limb(g, 0, 0, 34, 0, 6.5, mid_(c, c2));
    // the chain and the counterweight cube on the end
    g.strokeStyle = INK; g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(34, 0); g.lineTo(34, 13); g.stroke();
    g.strokeStyle = hexA(ac, 0.55); g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(34, 0); g.lineTo(34, 13); g.stroke();
    g.save(); g.translate(34, 19); g.rotate(-jibA * 0.6);
    plate(g, [-6, -6, 6, -6, 6, 6, -6, 6], deep, { up: 0.2, rim: false });
    g.fillStyle = hexA(ac, 0.6); g.fillRect(-6, -1.2, 12, 1.4);
    g.restore();
    g.restore();

    /* --- treads instead of feet: he rolls, he does not walk --- */
    const roll = A.running ? A.runPhase * 2 : 0;
    for (const sx of [-1, 1]) {
      g.save(); g.translate(sx * 12, 25);
      plateRect(g, -11, -6, 22, 13, 5, deep, { up: 0.16 });
      g.strokeStyle = hexA(INK, 0.6); g.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        const tx = -8 + ((i * 5.5 + roll * 2) % 17);
        g.beginPath(); g.moveTo(tx, -5); g.lineTo(tx, 6); g.stroke();
      }
      g.restore();
    }
    jointLimb(g, -8, 10, -11, 20, -3, 9, dark);
    jointLimb(g, 9, 10, 12, 20, 3, 9, dark);

    /* --- torso: a loader cab, wider at the base than the shoulders --- */
    plate(g, [-17, -18, 17, -18, 20, 12, -20, 12], body, { up: 0.3, down: 0.36, under: true });
    plate(g, [-13, -14, 13, -14, 15, 4, -15, 4], dark, { up: 0.12, down: 0.3, rimA: 0.26 });
    // hazard stripe across the chest — the one piece of pure signage on him
    g.save();
    poly(g, [-13, -2, 13, -2, 13, 4, -13, 4]); g.clip();
    g.fillStyle = deep; g.fillRect(-13, -2, 26, 6);
    hatch(g, -13, -2, 26, 6, ac, 7, 0.5);
    g.restore();
    g.strokeStyle = INK; g.lineWidth = 2;
    g.strokeRect(-13, -2, 26, 6);
    rivets(g, -11, -10, 6, 4, ac);

    /* --- shoulders: one bare mount for the jib, one armoured --- */
    plate(g, [-22, -22, -6, -24, -4, -10, -20, -8], deep, { up: 0.24 });
    plate(g, [22, -22, 6, -24, 4, -10, 20, -8], body, { up: 0.4, down: 0.28 });
    screw(g, -13, -16, 2.4, ac);

    /* --- head: a low cab with a wide window and a lamp --- */
    plateRect(g, -9, -34, 18, 15, 4, body, { up: 0.3, down: 0.3 });
    g.fillStyle = INK; roundRect(g, -10.5, -31, 21, 7, 2.5); g.fill();
    lens(g, () => roundRect(g, -3, -30, 11, 4.6, 2), A.flash ? "#ffffff" : ac, c, 14);
    // work lamp on top, actually lit
    g.save();
    plate(g, [-3, -34, 5, -34, 4, -39, -2, -39], deep, { up: 0.2, rim: false });
    g.globalCompositeOperation = "lighter";
    const lq = g.createLinearGradient(0, -38, 22, -26);
    lq.addColorStop(0, hexA(ac, 0.2)); lq.addColorStop(1, hexA(ac, 0));
    g.fillStyle = lq;
    poly(g, [3, -38, 24, -33, 24, -22, 3, -34]); g.fill();
    g.restore();

    /* --- arms: a short fixed arm, and the loading ram --- */
    jointLimb(g, -15, -13, -21, 2, -3.5, 9, dark);
    plateRect(g, -27, -2, 12, 12, 4, dark, { up: 0.2 });
    const ax = 26 + sw, ay = -5;
    jointLimb(g, 15, -13, (15 + ax) / 2, ay - 1, 2, 9.5, dark);
    limb(g, (15 + ax) / 2, ay - 1, ax - 3, ay, 11, mid_(c, c2));
    g.save(); g.translate(ax, ay);
    // a ram head: narrow at the wrist, flaring to a flat striking face
    plateRect(g, -11, -5, 8, 10, 2.5, deep, { up: 0.12, rim: false });
    plate(g, [-4, -8, 8, -9, 11, -6, 11, 6, 8, 9, -4, 8], body,
          { up: 0.3, down: 0.36, under: true });
    g.fillStyle = INK; g.fillRect(-3, -2.4, 13, 3.4);
    plate(g, [8, -8, 11, -6.5, 11, 6, 8, 7.5], ac, { up: 0.1, ink: 2 });
    g.restore();
  },
},

/* ======================================================================== */
/* KITE — THE DRIFTER                                                        */
/* Barely registers on the pivot and barely slides on it either: her sail    */
/* grips slopes everyone else falls down.                                    */
/* ======================================================================== */
{
  id: "KITE", name: "KITE", tag: "THE DRIFTER",
  blurb: "Rides the air instead of the floor. Almost weightless, and a nightmare to pin down.",
  power: "Keeps her footing on slopes that slide everyone else, and makes updrafts that lift every fighter on stage.",
  color: "#5ff2d0", color2: "#0d5a4c", color3: "#042a23", accent: "#eafffa",
  weight: 0.62, speed: 4.90, accel: 1.00, jump: 13.6, airSpeed: 5.6, fallMul: 0.74,
  slopeGrip: 0.85,
  size: { w: 30, h: 50 }, hurt: 23,
  specialCooldown: 150,

  light: { name: "Sail Cut", startup: 3, active: 3, recovery: 9,
    dmg: 3.0, base: 1.5, scale: 0.38, angle: 50, ox: 34, oy: -8, r: 22,
    vfx(f) {
      const ang = faceAng(f);
      // two thin feathers of wind rather than a blade
      for (let i = 0; i < 2; i++)
        FX.blade(f.x + f.facing * 8, f.y - 8, ang + (i ? 0.34 : -0.34) * f.facing,
                 24, 52, 0.62, i ? f.ch.accent : f.ch.color, { w: 5.5, life: 10, core: !i });
      Snd.noise(0.05, 0.07, 4200, 1.2, "bandpass");
    } },

  heavy: { name: "Dive Stall", startup: 10, active: 5, recovery: 26,
    dmg: 12.5, base: 4.2, scale: 1.14, angle: 64, ox: 30, oy: 16, r: 28,
    onStart(f) { f.vy = 13; f.vx += f.facing * 3.4; Snd.whoosh(1.3); },
    vfx(f) {
      const ang = faceAng(f);
      FX.blade(f.x + f.facing * 6, f.y + 6, ang + 0.9 * f.facing, 26, 72, 1.5, f.ch.color,
               { w: 14, life: 14, spin: -f.facing * 0.06 });
      FX.ring(f.x, f.y + 14, 8, 60, f.ch.accent, 2);
      for (let i = 0; i < 4; i++)
        FX.spark(f.x + rnd(-20, 20), f.y + rnd(0, 26), f.ch.accent);
      FX.shake(4);
      Snd.noise(0.12, 0.16, 2200, 0.9, "bandpass");
    } },

  special: { name: "Updraft", startup: 7, active: 10, recovery: 18,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Opens a rising column of air. It lifts her hard and everyone else gently — her recovery, and your problem.",
    tick(f, a) {
      const m = a.data;
      if (a.t === m.startup && !a.fired) {
        a.fired = true;
        Entities.updraft(f, f.x, f.y + 20, 110);
        f.vy = Math.min(f.vy, -6);
        FX.banner("UPDRAFT", f.ch.color);
        FX.ring(f.x, f.y + 20, 14, 120, f.ch.accent, 3);
        Snd.tone(420, 0.3, "sine", 0.12, 1500);
        Snd.noise(0.4, 0.12, 2600, 0.8, "bandpass");
      }
    } },

  super: { name: "Monsoon",
    desc: "Turns the whole deck into rising air, then rides it down as a real hit — unlike Updraft, this one is built to land.",
    startup: 16, active: 70, recovery: 30,
    dmg: 19, base: 6.2, scale: 1.05, angle: 78, ox: 0, oy: 0, r: 92,
    onStart(f) { Snd.superCharge(); FX.flash("#5ff2d0", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vy *= 0.8; FX.spark(f.x + rnd(-30, 30), f.y + rnd(-40, 40), f.ch.color); }
      if (a.t === m.startup) {
        FX.banner("MONSOON", f.ch.color);
        for (let i = -1; i <= 1; i++)
          Entities.updraft(f, Stage.pivot.x + i * 190, Stage.pivot.y, 150);
        FX.shake(12);
      }
      if (a.t > m.startup) {
        f.vy = Math.max(f.vy - 0.5, -9);                 // she rides her own storm
        if (a.t % 5 === 0) FX.spark(f.x + rnd(-40, 40), f.y + rnd(-10, 50), f.ch.accent);
      }
    } },

  /* ---- art: a slender glider. A sail-wing frames her, streamers trail off
           it, and she stands on taloned feet — which is what the slope grip
           is, made visible. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c;
    const dark = A.flash ? "#c8fff2" : c2;
    const deep = A.flash ? "#9dffe9" : c3;
    const sw = swing(A, -8, 40);
    const breeze = Math.sin(A.time * 0.07);

    aura(g, 0, -8, 40, c, 0.13);

    /* --- the sail: a wing on a spar, behind everything --- */
    g.save();
    g.translate(-7, -22);
    g.rotate(-0.3 + breeze * 0.07 + (A.air ? -0.22 : 0));
    /* Kept deliberately small. At its first size the sail was wider than her
       whole body and she read as a flag with legs instead of a flier. */
    const span = A.air ? 27 : 21;
    const sailPath = () => poly(g, [0, 0, -span, -15, -span * 1.08, 7, -8, 14]);
    ink(g, sailPath, vol(g, -26, 24, dark, 0.3, 0.3), 3);
    rim(g, sailPath, "#ffffff", 3, 0.35);
    // spars
    g.strokeStyle = hexA(ac, 0.28); g.lineWidth = 1.1;
    for (let i = 1; i <= 2; i++) {
      g.beginPath(); g.moveTo(0, 0);
      g.lineTo(-span * (0.6 + i * 0.22), -11 + i * 9); g.stroke();
    }
    // streamers off the trailing edge
    g.lineCap = "round";
    /* Short ripples hugging the trailing edge. Long ones in any colour stuck
       out sideways and read as antennae rather than cloth. */
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = hexA(c, 0.45 - i * 0.12); g.lineWidth = 2;
      const ey = -9 + i * 8;
      g.beginPath();
      g.moveTo(-span * 0.98, ey);
      g.quadraticCurveTo(-span * 1.1, ey + 3 + Math.sin(A.time * 0.18 + i) * 2.5,
                         -span * 1.16, ey + 1);
      g.stroke();
    }
    g.restore();

    /* --- legs: long and thin, ending in gripping talons --- */
    const st = Math.sin(A.runPhase) * (A.running ? 13 : 0);
    jointLimb(g, -4, 8, -7 + st, 24, -4, 5, dark);
    jointLimb(g, 5, 8, 8 - st, 24, 4, 5, dark);
    for (const [fx2, dir] of [[-7 + st, -1], [8 - st, 1]]) {
      g.save(); g.translate(fx2, 25);
      g.strokeStyle = INK; g.lineWidth = 3.4; g.lineCap = "round";
      for (let i = -1; i <= 1; i++) {
        g.beginPath(); g.moveTo(0, 0); g.lineTo(i * 4 + dir * 2, 5); g.stroke();
      }
      g.strokeStyle = ac; g.lineWidth = 1.8;
      for (let i = -1; i <= 1; i++) {
        g.beginPath(); g.moveTo(0, 0); g.lineTo(i * 4 + dir * 2, 5); g.stroke();
      }
      g.restore();
    }

    /* --- torso: narrow, upright, a wind-vane crest on the chest --- */
    g.save(); g.rotate(A.running ? 0.08 : 0.02 + breeze * 0.02);
    plate(g, [-8, -14, 9, -15, 8, 10, -7, 9], body, { up: 0.3, down: 0.32, under: true });
    plate(g, [-6, -11, 7, -12, 6, 0, -5, 0], dark, { up: 0.12, down: 0.28, rimA: 0.3 });
    // one small chevron: stacked pairs read as a capital W on her chest
    glow(g, ac, 10, () => {
      g.strokeStyle = ac; g.lineWidth = 1.6; g.lineCap = "round";
      g.beginPath();
      g.moveTo(-3.5, -7); g.lineTo(2, -3.5); g.lineTo(-3.5, 0);
      g.stroke();
    });
    g.restore();

    /* --- head: a small hooded skull with a long trailing crest --- */
    g.save(); g.translate(1, -24);
    const headPath = () => poly(g, [-7, -5, 7, -7, 10, 2, -6, 5]);
    ink(g, headPath, vol(g, -8, 6, body, 0.34, 0.3));
    rim(g, headPath, "#ffffff", 3, 0.5);
    // crest streaming backward
    g.strokeStyle = hexA(ac, 0.6); g.lineWidth = 2.6; g.lineCap = "round";
    g.beginPath(); g.moveTo(-5, -5);
    for (let i = 1; i <= 3; i++)
      g.lineTo(-5 - i * 9, -6 + Math.sin(A.time * 0.13 + i) * (2 + i * 2));
    g.stroke();
    g.fillStyle = hexA(INK, 0.4); poly(g, [-6, 2, 9, 2, 8, 4.5, -6, 4.5]); g.fill();
    lens(g, () => poly(g, [-1, -3.4, 9, -1.6, 9, 1.4, -2, 0.6]),
         A.flash ? "#ff2e88" : ac, c, 13);
    g.restore();

    /* --- arms: thin, with a wind-blade that opens on the swing --- */
    jointLimb(g, -6, -10, -13 - (A.running ? st * 0.3 : 0), -2, -3, 4.5, dark);
    const ax = 13 + sw, ay = -7;
    jointLimb(g, 7, -10, (7 + ax) / 2, ay - 1, 2.5, 5, dark);
    limb(g, (7 + ax) / 2, ay - 1, ax - 2, ay, 6, mid_(c, c2));
    g.save(); g.translate(ax, ay);
    const open = A.atkPhase >= 0 ? 1 : 0.22;
    for (let i = 0; i < 3; i++) {
      g.save(); g.rotate((i - 1) * 0.36 * open);
      plate(g, [0, -1.6, 12, -3.6, 14, 0, 12, 3.6, 0, 1.6], i === 1 ? ac : body,
            { up: 0.2, ink: 1.8, rim: false });
      g.restore();
    }
    g.restore();
  },
},

/* ======================================================================== */
/* HUSK — THE MILLSTONE                                                      */
/* Can plant himself: immovable, and twice his own weight on the pivot.      */
/* ======================================================================== */
{
  id: "HUSK", name: "HUSK", tag: "THE MILLSTONE",
  blurb: "Something old and heavy wearing cracked stone. Slow everywhere, and impossible to move when it decides to stop.",
  power: "Plants itself: cannot be knocked back at all while anchored, no matter what hits it.",
  color: "#a764ff", color2: "#361a5e", color3: "#160a28", accent: "#e8d6ff",
  weight: 1.30, speed: 3.25, accel: 0.58, jump: 10.8, airSpeed: 3.0, fallMul: 1.20,
  size: { w: 46, h: 62 }, hurt: 32,
  specialCooldown: 170,

  light: { name: "Knuckle", startup: 5, active: 3, recovery: 12,
    dmg: 5.0, base: 2.4, scale: 0.56, angle: 44, ox: 42, oy: -6, r: 25,
    vfx(f) {
      const ang = faceAng(f);
      FX.blade(f.x + f.facing * 12, f.y - 6, ang, 28, 60, 0.5, f.ch.color, { w: 14, life: 11 });
      FX.glyph(hbAt(f, this).x, f.y - 8, "wedge", 12, f.ch.accent, 12);
      Snd.tone(140, 0.06, "sawtooth", 0.09, 80);
    } },

  heavy: { name: "Millstone Drop", startup: 17, active: 4, recovery: 31,
    dmg: 19, base: 5.4, scale: 1.16, angle: 74, ox: 36, oy: 10, r: 38,
    onStart(f) { Snd.whoosh(1.7); },
    vfx(f) {
      const ang = faceAng(f);
      // straight down and forward, like something being dropped rather than swung
      FX.blade(f.x, f.y - 10, ang - 1.35 * f.facing, 40, 84, 1.5, f.ch.color,
               { w: 22, life: 17, spin: f.facing * 0.05 });
      FX.blade(f.x, f.y - 10, ang - 1.2 * f.facing, 36, 70, 1.2, "#ffffff",
               { w: 6, life: 10, core: false, spin: f.facing * 0.05 });
      if (f.grounded) {
        FX.dustLine(f.x + f.facing * 28, f.feetY, 130, f.ch.color2);
        FX.crack(f.x + f.facing * 24, f.feetY - 2, f.facing, 36, f.ch.color, 3);
      }
      FX.shake(9);
      Snd.tone(70, 0.22, "sawtooth", 0.17, 36, 0, 0.5);
    } },

  special: { name: "Dead Weight", startup: 6, active: 150, recovery: 20,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "Plants itself. Cannot be knocked back at all while this is active — stand your ground and tank it.",
    tick(f, a) {
      const m = a.data;
      if (a.t === m.startup) {
        FX.banner("DEAD WEIGHT", f.ch.color);
        FX.ring(f.x, f.feetY, 16, 180, f.ch.color, 4);
        if (f.grounded) FX.crack(f.x, f.feetY - 2, 1, 40, f.ch.color, 3);
        if (f.grounded) FX.crack(f.x, f.feetY - 2, -1, 40, f.ch.color, 3);
        FX.shake(12); Snd.bigHit();
        Stage.lastPusher = f;
      }
      if (a.t >= m.startup && a.t < m.startup + m.active) {
        f.pinned = true;                 // nothing shifts it — knockback, pushes, anything
        f.weightMul = 2.4;
        f.vx = 0;
        if (!f.grounded) f.vy = Math.min(f.vy + 1.4, 20);   // it still falls
        Stage.lastPusher = f;
        if (a.t % 10 === 0) {
          FX.spark(f.x + rnd(-24, 24), f.feetY - rnd(0, 10), f.ch.accent);
          FX.ring(f.x, f.feetY, 6, 48, f.ch.color, 2);
        }
        // let go early
        if (a.t > m.startup + 24 && !f.pad.held("special")) a.t = m.startup + m.active;
      }
      if (a.t >= m.startup + m.active) { f.pinned = false; f.weightMul = 1; }
    } },

  super: { name: "Mortal Coil",
    desc: "Throws a chain, drags the nearest fighter in, and puts them through the deck.",
    startup: 18, active: 46, recovery: 34,
    dmg: 21, base: 6.4, scale: 1.1, angle: 68, ox: 0, oy: 0, r: 74,
    onStart(f) { Snd.superCharge(); FX.flash("#a764ff", 0.32); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.8; FX.spark(f.x + rnd(-30, 30), f.y + rnd(-40, 30), f.ch.color); }
      if (a.t === m.startup) {
        a.grabbed = Combat.nearestFoe(f) || null;
        FX.banner("MORTAL COIL", f.ch.color);
        Stage.lastPusher = f;
        Snd.grab();
      }
      const t = a.grabbed;
      if (t && t.alive && a.t > m.startup && a.t < m.startup + m.active) {
        const phase = (a.t - m.startup) / m.active;
        // reel them in, hold them, then drive them down
        if (phase < 0.55) {
          t.x = lerp(t.x, f.x + f.facing * 46, 0.16);
          t.y = lerp(t.y, f.y - 36, 0.16);
          t.vx = 0; t.vy = 0; t.hitstun = 6;
          if (a.t % 4 === 0) FX.spark(t.x, t.y, f.ch.accent);
        } else if (!a.slammed) {
          a.slammed = true;
          t.applyKnockback(f.facing * 7, 20, m.dmg, 16, f);
          f.stats.damageDealt += m.dmg;
          f.addMeter(m.dmg * CFG.meter.onDeal);
          FX.hitPause(14); FX.shake(26);
          FX.burst(t.x, t.y, 34, f.ch.color, 11);
          FX.ring(t.x, t.y, 14, 240, "#ffffff", 5);
          if (f.grounded) FX.crack(t.x, f.feetY - 2, 1, 60, f.ch.color, 4);
          Snd.superHit();
        }
        // the chain itself
        if (a.t % 2 === 0)
          FX.streak(f.x + f.facing * 14, f.y - 10, t.x, t.y, f.ch.accent);
      }
    } },

  /* ---- art: cracked stone over something lit. No face — just a gap in the
           shroud with light coming out of it. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c2;      // the SHELL is the dark colour:
    const lit = A.flash ? "#ffffff" : c;        // the light inside is the bright one
    const deep = A.flash ? "#cdb3ff" : c3;
    const sw = swing(A, -11, 44);
    const planted = A.state === ST.ATTACK && A.atkKind === "special";
    const pulse = 0.55 + Math.sin(A.time * 0.06) * 0.45;

    aura(g, 0, 0, 46, c, 0.1 + (planted ? 0.2 : 0) + pulse * 0.05);

    /* --- legs: squat, planted wide, wrapped in shroud --- */
    const st = Math.sin(A.runPhase) * (A.running ? 7 : 0);
    jointLimb(g, -9, 12, -14 + st, 29, -4, 12, body);
    jointLimb(g, 10, 12, 15 - st, 29, 4, 12, body);
    plateRect(g, -22 + st * 0.5, 26, 17, 9, 2.5, deep, { up: 0.14 });
    plateRect(g, 5 - st * 0.5, 26, 17, 9, 2.5, deep, { up: 0.14 });

    /* --- the shroud: a heavy mantle over the whole upper body --- */
    const mantle = () => poly(g, [-24, -14, 24, -14, 28, 16, -28, 16]);
    ink(g, mantle, vol(g, -16, 18, body, 0.24, 0.4));
    rim(g, mantle, "#ffffff", 3, 0.22);
    // cracks with light coming through them
    g.save();
    mantle(); g.clip();
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = hexA(lit, 0.35 + pulse * 0.45); g.lineWidth = 2.2;
    g.lineCap = "round"; g.lineJoin = "round";
    const seams = [[-16, -12, -9, -2, -13, 12], [4, -13, 9, 0, 3, 14], [16, -10, 21, 4]];
    for (const sm of seams) {
      g.beginPath(); g.moveTo(sm[0], sm[1]);
      for (let i = 2; i < sm.length; i += 2) g.lineTo(sm[i], sm[i + 1]);
      g.stroke();
    }
    g.restore();

    /* --- the core, burning behind the shroud's gap --- */
    g.fillStyle = INK;
    poly(g, [-8, -7, 8, -7, 6, 9, -6, 9]); g.fill();
    lens(g, () => { g.beginPath(); g.ellipse(0, 1, 5.2, 6.6, 0, 0, 7); },
         lit, lit, 18 + pulse * 14);

    /* A heavy collar yoke across the shoulders. Drawn as a full ellipse it
       sat under the hood like a grin, so it is a flattened band with raised
       shoulder bosses instead. */
    g.save();
    plate(g, [-20, -17, 20, -17, 17, -11, -17, -11], deep, { up: 0.26, rimA: 0.4 });
    for (const bx of [-13, 13]) screw(g, bx, -14, 2.2, ac);
    plate(g, [-25, -15, -14, -17, -13, -9, -23, -8], deep, { up: 0.3, rim: false });
    plate(g, [25, -15, 14, -17, 13, -9, 23, -8], deep, { up: 0.3, rim: false });
    g.restore();

    /* --- head: a hood with nothing in it but two lights --- */
    const hood = () => poly(g, [-12, -20, 12, -20, 9, -38, 0, -43, -10, -36]);
    ink(g, hood, vol(g, -43, -20, body, 0.26, 0.34));
    rim(g, hood, "#ffffff", 3, 0.3);
    g.fillStyle = INK; poly(g, [-11, -20, 11, -20, 9, -29, -10, -29]); g.fill();
    for (const ex of [-4.5, 4.5])
      lens(g, () => { g.beginPath(); g.arc(ex, -24.5, 2.4, 0, 7); },
           A.flash ? "#ff2e88" : lit, lit, 12 + pulse * 10);

    /* --- arms: long, heavy, ending in stone fists --- */
    jointLimb(g, -18, -10, -25 - (A.running ? st * 0.4 : 0), 6, -4, 11, body);
    g.fillStyle = deep; g.strokeStyle = INK; g.lineWidth = 2.6;
    g.beginPath(); g.arc(-28, 9, 8, 0, 7); g.stroke(); g.fill();
    const ax = 20 + sw, ay = -3;
    jointLimb(g, 18, -10, (18 + ax) / 2, ay - 1, 2.5, 11, body);
    limb(g, (18 + ax) / 2, ay - 1, ax - 3, ay, 13, mid_(c2, c3));
    /* A fist, not a slab: knuckles that step down toward the front, with a
       dark wrist behind them so the hand reads as held rather than carried. */
    g.save(); g.translate(ax, ay);
    plateRect(g, -12, -7, 8, 14, 3, deep, { up: 0.12, rim: false });
    // the back of the hand
    const fistPts = [-5, -9, 6, -11, 11, -7, 12, 4, 8, 10, -4, 10];
    plate(g, fistPts, body, { up: 0.3, down: 0.38, under: true });
    // three curled fingers stepping down the front, so it reads as a fist
    for (let i = 0; i < 3; i++) {
      const fy = -7 + i * 6;
      plateRect(g, 8, fy, 7, 5.4, 2.6, shade(body, 0.08 - i * 0.04),
                { up: 0.2, rim: false, ink: 2.2 });
    }
    // and a thumb across the near side
    plate(g, [-4, 0, 4, -2, 6, 4, -3, 7], shade(body, -0.12),
          { up: 0.16, rim: false, ink: 2.2 });
    g.save();
    poly(g, fistPts); g.clip();
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = hexA(lit, 0.3 + pulse * 0.4); g.lineWidth = 2;
    g.beginPath(); g.moveTo(-2, -7); g.lineTo(3, -1); g.stroke();
    g.restore();
    g.restore();

    /* --- when planted, show the ground giving up --- */
    if (planted) {
      g.save();
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = hexA(lit, 0.5); g.lineWidth = 2.4;
      for (let i = -2; i <= 2; i++) {
        if (!i) continue;
        g.beginPath(); g.moveTo(i * 8, 30); g.lineTo(i * 17, 38); g.stroke();
      }
      g.restore();
    }
  },
},

/* ======================================================================== */
/* MIRA — THE ANSWER                                                         */
/* The only fighter who wins by being hit: a live counter eats the blow and  */
/* answers it, and the answer shoves the pivot toward whoever swung.          */
/* ======================================================================== */
{
  id: "MIRA", name: "MIRA", tag: "THE ANSWER",
  blurb: "A duelist who would rather you swung first. Reads the attack, eats it, and sends it back harder.",
  power: "Counters: a hit during her stance is cancelled and answered on the spot, hard.",
  color: "#ff4d6d", color2: "#5e1024", color3: "#2a0710", accent: "#ffe3ea",
  weight: 0.94, speed: 4.40, accel: 0.92, jump: 12.0, airSpeed: 4.2, fallMul: 1.00,
  riposte: { dmg: 12, base: 5.8, scale: 1.15, angle: 42 },
  size: { w: 32, h: 52 }, hurt: 25,
  specialCooldown: 210,

  light: { name: "Feint", startup: 3, active: 3, recovery: 8,
    dmg: 3.4, base: 1.6, scale: 0.42, angle: 46, ox: 38, oy: -8, r: 22,
    vfx(f) {
      const ang = faceAng(f);
      // a thin, fast line — a fencer's point, not a slash
      FX.blade(f.x + f.facing * 10, f.y - 8, ang, 30, 62, 0.22, f.ch.color,
               { w: 16, life: 9 });
      FX.spark(hbAt(f, this).x, f.y - 8, f.ch.accent);
      Snd.tone(1400, 0.035, "square", 0.06, 2100);
    } },

  heavy: { name: "Lunge", startup: 12, active: 4, recovery: 27,
    dmg: 14, base: 4.2, scale: 1.02, angle: 40, ox: 56, oy: -6, r: 28,
    onStart(f) { f.vx += f.facing * 6.2; Snd.whoosh(1.2); },
    vfx(f) {
      const ang = faceAng(f);
      FX.blade(f.x + f.facing * 8, f.y - 6, ang, 36, 98, 0.3, f.ch.color,
               { w: 26, life: 13 });
      FX.blade(f.x + f.facing * 8, f.y - 6, ang, 34, 88, 0.16, "#ffffff",
               { w: 12, life: 9, core: false });
      FX.streak(f.x, f.y - 6, f.x + f.facing * 100, f.y - 6, f.ch.accent);
      FX.shake(5);
      Snd.tone(900, 0.08, "sawtooth", 0.1, 240);
    } },

  special: { name: "Riposte", startup: 4, active: 26, recovery: 26,
    dmg: 0, base: 0, scale: 0, angle: 0, ox: 0, oy: 0, r: 0,
    desc: "A stance. Anything that hits her during it is cancelled and answered on the spot.",
    onStart(f) { Snd.tone(600, 0.14, "sine", 0.1, 1100); },
    tick(f, a) {
      const m = a.data;
      if (a.t >= m.startup && a.t < m.startup + m.active) {
        f.counter = 2;                       // re-armed every frame of the window
        f.vx *= 0.7;
        if (a.t % 6 === 0) {
          FX.ring(f.x, f.y, 4, 34, f.ch.accent, 2);
          FX.spark(f.x + rnd(-16, 16), f.y + rnd(-18, 18), f.ch.color);
        }
      }
    } },

  super: { name: "Perfect Answer",
    desc: "A long stance that answers everything. One hit during it and they pay for it hard.",
    startup: 12, active: 60, recovery: 34,
    dmg: 16, base: 5.4, scale: 1.05, angle: 46, ox: 0, oy: 0, r: 150,
    onStart(f) { Snd.superCharge(); FX.flash("#ff4d6d", 0.3); },
    tick(f, a) {
      const m = a.data;
      if (a.t < m.startup) { f.vx *= 0.82; FX.spark(f.x + rnd(-26, 26), f.y + rnd(-30, 30), f.ch.color); }
      if (a.t === m.startup) {
        FX.banner("PERFECT ANSWER", f.ch.color);
        a.answered = false;
      }
      if (a.t >= m.startup && a.t < m.startup + m.active && !a.answered) {
        f.counter = 2;
        f.vx *= 0.86;
        if (a.t % 4 === 0) {
          FX.ring(f.x, f.y, 6, 70, f.ch.accent, 2);
          FX.spark(f.x + rnd(-30, 30), f.y + rnd(-30, 30), f.ch.accent);
        }
        /* counterFlash is set by the riposte in applyKnockback, so it is how
           the super learns that its counter actually fired */
        if (f.counterFlash > 20) {
          a.answered = true;
          for (const o of Match.current.fighters) {
            if (o === f || !o.alive || o.state === ST.DEAD) continue;
            if (dist(o.x, o.y, f.x, f.y) > m.r) continue;
            const dirX = o.x >= f.x ? 1 : -1;
            const rad = m.angle * Math.PI / 180;
            const mag = CFG.kbBase + m.base + m.dmg * CFG.kbDamageScale
                      + o.percent * CFG.kbPercentScale * m.scale * 1.9;
            o.applyKnockback(Math.cos(rad) * mag * dirX, -Math.sin(rad) * mag,
                             m.dmg, mag, f);
            f.stats.damageDealt += m.dmg;
          }
          FX.flash("#ffffff", 0.45);
          FX.hitPause(16); FX.shake(28);
          FX.ring(f.x, f.y, 20, 420, "#ffffff", 6);
          FX.blade(f.x, f.y, 0, 40, 220, 6.28, f.ch.color, { w: 18, life: 20 });
          Snd.superHit();
        }
      }
    } },

  /* ---- art: a duelist. Long coat tails, a faceted mirror mask, and a thin
           blade she holds point-forward rather than swung. ---- */
  draw(g, A) {
    const c = this.color, c2 = this.color2, c3 = this.color3, ac = this.accent;
    const body = A.flash ? "#ffffff" : c;
    const dark = A.flash ? "#ffd3dc" : c2;
    const deep = A.flash ? "#ffb3c2" : c3;
    const sw = swing(A, -14, 46);
    const guard = A.state === ST.ATTACK && (A.atkKind === "special" || A.atkKind === "super");

    if (guard) aura(g, 0, -6, 44, ac, 0.3);
    else aura(g, 0, -6, 30, c, 0.12);

    /* --- coat tails, behind, lagging the motion --- */
    for (let t = 0; t < 2; t++) {
      g.save();
      const path = () => {
        g.beginPath(); g.moveTo(-4, -6 + t * 4);
        for (let s = 1; s <= 4; s++)
          g.lineTo(-4 - s * 7 - Math.abs(A.vx) * 0.7 * s * 0.3,
                   -6 + t * 4 + Math.sin(A.time * 0.11 + s * 0.8 + t) * (2 + s * 1.7) + s * 4.5);
      };
      g.lineCap = "round"; g.lineJoin = "round";
      path(); g.strokeStyle = INK; g.lineWidth = (t ? 2.8 : 4.6) + 1.6; g.stroke();
      path(); g.strokeStyle = t ? deep : dark; g.lineWidth = t ? 2.8 : 4.6; g.stroke();
      path(); g.strokeStyle = hexA(ac, 0.28); g.lineWidth = 1.3; g.stroke();
      g.restore();
    }

    /* --- legs: a fencer's stance, front leg forward --- */
    const st = Math.sin(A.runPhase) * (A.running ? 12 : 0);
    jointLimb(g, -5, 9, -11 + st, 26, -4, 5.5, dark);
    jointLimb(g, 6, 9, 13 - st, 26, 5, 5.5, dark);
    plateRect(g, -17 + st, 24, 12, 6, 2, deep, { up: 0.16 });
    plateRect(g, 8 - st, 24, 13, 6, 2, deep, { up: 0.16 });

    /* --- torso: slim, with a sash and a high collar --- */
    plate(g, [-9, -15, 10, -15, 8, 11, -8, 11], body, { up: 0.3, down: 0.34, under: true });
    plate(g, [-7, -11, 8, -11, 6, 1, -6, 1], dark, { up: 0.12, down: 0.3, rimA: 0.28 });
    plate(g, [-9, -3, 10, -11, 11, -6, -8, 2], deep, { up: 0.2, ink: 2.2, rimA: 0.35 });
    // collar
    plate(g, [-10, -15, 10, -15, 7, -21, -7, -21], deep, { up: 0.24, rim: false });

    /* --- head: a faceted mirror mask. Reflective, not lit --- */
    g.save(); g.translate(1, -26);
    const maskPath = () => poly(g, [-6.5, -5, 6.5, -6.5, 8.5, 2.5, -6, 5]);
    ink(g, maskPath, vol(g, -9, 7, body, 0.34, 0.3));
    // the facets: hard-edged highlights that read as polished metal
    g.save(); maskPath(); g.clip();
    g.fillStyle = hexA("#ffffff", 0.42); poly(g, [-6.5, -5, 0.5, -6, -2.5, 5, -6, 4]); g.fill();
    g.fillStyle = hexA("#ffffff", 0.18); poly(g, [2.5, -6, 6.5, -6, 7.5, 1, 3.5, 1.5]); g.fill();
    g.fillStyle = hexA(INK, 0.4); poly(g, [-2, -1.5, 8.5, 0, 8.5, 2.5, -2.5, 3.5]); g.fill();
    g.restore();
    rim(g, maskPath, "#ffffff", 3, 0.6);
    // one visor slit, dimmer than the others' — she is reading, not glowing
    lens(g, () => poly(g, [0, -2.6, 7.6, -1.3, 7.6, 0.7, -1, 0]), ac, c, guard ? 18 : 9);
    g.restore();

    /* --- back arm tucked behind, as a fencer holds it --- */
    jointLimb(g, -8, -11, -16, -15, -3, 5, dark);
    g.fillStyle = shade(c2, 0.1); g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.arc(-17, -15.5, 3, 0, 7); g.stroke(); g.fill();

    /* --- sword arm: the blade is a line, held point-forward --- */
    const ax = 16 + sw, ay = -8;
    jointLimb(g, 8, -11, (8 + ax) / 2, ay - 1, 2.5, 5.5, dark);
    limb(g, (8 + ax) / 2, ay - 1, ax - 2, ay, 7, mid_(c, c2));
    g.save(); g.translate(ax, ay);
    g.rotate(guard ? -0.5 : A.atkPhase >= 0 ? 0.06 : 0.18);
    // guard and grip
    plateRect(g, -5, -5, 9, 10, 3, deep, { up: 0.2, rim: false });
    g.strokeStyle = INK; g.lineWidth = 4.5; g.lineCap = "round";
    g.beginPath(); g.moveTo(4, -7); g.lineTo(4, 7); g.stroke();
    g.strokeStyle = ac; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(4, -7); g.lineTo(4, 7); g.stroke();
    // the blade: ink line, bright core, hot tip
    g.strokeStyle = INK; g.lineWidth = 5.5; g.lineCap = "butt";
    g.beginPath(); g.moveTo(5, 0); g.lineTo(52, 0); g.stroke();
    g.strokeStyle = mid_(c, "#ffffff"); g.lineWidth = 3;
    g.beginPath(); g.moveTo(5, 0); g.lineTo(52, 0); g.stroke();
    glow(g, ac, guard ? 16 : 7, () => {
      g.strokeStyle = ac; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(16, -0.6); g.lineTo(54, -0.6); g.stroke();
    });
    g.restore();

    /* --- the counter window, drawn as a mirror shell around her --- */
    if (guard) {
      g.save();
      g.globalCompositeOperation = "lighter";
      const k = 0.5 + Math.sin(A.time * 0.4) * 0.3;
      g.strokeStyle = hexA(ac, 0.5 * k); g.lineWidth = 2.4;
      for (let i = 0; i < 6; i++) {
        const a2 = (i / 6) * Math.PI * 2 + A.time * 0.05;
        g.save(); g.rotate(a2);
        g.beginPath(); g.moveTo(26, -7); g.lineTo(32, 0); g.lineTo(26, 7); g.stroke();
        g.restore();
      }
      g.restore();
    }
  },
},
];

const CHAR_BY_ID = {};
ROSTER.forEach(c => { CHAR_BY_ID[c.id] = c; });
