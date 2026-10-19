/* ==========================================================================
   6. STAGES — four maps that each play and read differently

   Platforms are authored in stage-local space around the pivot and rotated by
   the live tilt, so sloped ground needs no special case anywhere else.

   Every stage retunes the pivot: the Foundry swings like a wrecking ball, the
   Drift snaps back almost instantly, the Vault leans much further before it
   lets go. Blast zones move too, so some maps kill far earlier than others.
   ========================================================================== */

const TILT_BASE = {
  limit: 0.42, torque: 0.0000035, spring: 0.0070, damp: 0.962,
  maxAngVel: 0.055, hitNudge: 0.0008, snapVel: 0.062, snapLaunch: 17.5,
  snapDamage: 6, anchorFrames: 180, crankTorque: 3400, stompTorque: 6,
};

const STAGES = [

/* ------------------------------------------------------------------ 1 --- */
{
  id: "YARD", name: "PIVOT YARD", tag: "NEON · BALANCED",
  blurb: "The proving ground. Even tilt, generous ledges, room to learn the swing.",
  pivot: { x: 800, y: 580 },
  blast: { left: -420, right: 2020, top: -520, bottom: 1420 },
  tilt: Object.assign({}, TILT_BASE),
  pal: { a: "#00e5ff", b: "#ff2e88", plat: "#1b1536", platEdge: "#00e5ff",
         soft: "#8a7fff", ink: "#07060f" },
  music: { bpm: 124, root: 196, scale: [0, 3, 5, 7, 10], wave: "triangle", hats: true,
           seq: [0, -1, 2, -1, 4, -1, 2, 3, 0, -1, 5, -1, 4, 2, -1, -1] },
  layout: [
    { x1: -310, y1: 0,    x2: 310,  y2: 0,    solid: true,  main: true,  thick: 26 },
    { x1: -322, y1: -186, x2: -150, y2: -186, solid: false, thick: 12 },
    { x1:  150, y1: -186, x2:  322, y2: -186, solid: false, thick: 12 },
    { x1:  -82, y1: -316, x2:   82, y2: -316, solid: false, thick: 12 },
  ],

  drawBg(g, t) {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0b0820"); grad.addColorStop(0.55, "#0a0718"); grad.addColorStop(1, "#15062a");
    g.fillStyle = grad; g.fillRect(0, 0, W, H);

    const rg = g.createRadialGradient(W / 2, H * 0.72, 40, W / 2, H * 0.72, W * 0.72);
    rg.addColorStop(0, "rgba(255,46,136,.17)");
    rg.addColorStop(0.5, "rgba(0,229,255,.07)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, H);

    // perspective grid
    g.save();
    g.strokeStyle = "rgba(0,229,255,.12)"; g.lineWidth = 1;
    const hz = H * 0.56;
    for (let i = -14; i <= 14; i++) {
      g.beginPath(); g.moveTo(W / 2 + i * 26, hz);
      g.lineTo(W / 2 + i * 120 + Math.sin(t * 0.3 + i) * 8, H); g.stroke();
    }
    for (let j = 1; j < 16; j++) {
      const p = j / 16, y = hz + Math.pow(p, 2.3) * (H - hz);
      g.globalAlpha = 0.10 + p * 0.14;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.restore();

    // drifting motes
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 30; i++) {
      const p = (t * 24 + i * 97) % (H + 120);
      g.globalAlpha = 0.2;
      g.fillStyle = i % 3 === 0 ? "#ff2e88" : i % 3 === 1 ? "#00e5ff" : "#b6ff3b";
      g.beginPath(); g.arc(hash(i) * W, H - p, 1.6 + (i % 3), 0, 7); g.fill();
    }
    g.restore();
  },
},

/* ------------------------------------------------------------------ 2 --- */
{
  id: "FOUNDRY", name: "CINDER FOUNDRY", tag: "MOLTEN · HEAVY SWING",
  blurb: "A casting beam over an open crucible. It swings like a wrecking ball and the floor is very close.",
  pivot: { x: 800, y: 560 },
  // the crucible is right below: far less room to recover underneath
  blast: { left: -360, right: 1960, top: -520, bottom: 1080 },
  tilt: Object.assign({}, TILT_BASE, {
    torque: 0.0000052,    // heavier beam, leans further under weight
    spring: 0.0048,       // and is slow to right itself
    damp: 0.975,
    limit: 0.46,
    snapLaunch: 19.5,
    snapDamage: 8,
  }),
  pal: { a: "#ff8a1f", b: "#ff3b1f", plat: "#241711", platEdge: "#ff8a1f",
         soft: "#c2683a", ink: "#140a06" },
  music: { bpm: 104, root: 147, scale: [0, 2, 3, 7, 8], wave: "sawtooth", hats: false,
           seq: [0, -1, -1, 1, 3, -1, 0, -1, 4, -1, 3, 1, 0, -1, -1, -1] },
  layout: [
    // narrower main beam, and the side platforms are high and short
    { x1: -258, y1: 0,    x2: 258,  y2: 0,    solid: true,  main: true, thick: 30 },
    { x1: -300, y1: -162, x2: -186, y2: -162, solid: false, thick: 11 },
    { x1:  186, y1: -162, x2:  300, y2: -162, solid: false, thick: 11 },
  ],

  drawBg(g, t) {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#160b06"); grad.addColorStop(0.5, "#1d0d06"); grad.addColorStop(1, "#3d1205");
    g.fillStyle = grad; g.fillRect(0, 0, W, H);

    // the crucible glow from below, breathing
    const pulse = 0.72 + Math.sin(t * 1.1) * 0.12;
    const rg = g.createRadialGradient(W / 2, H * 1.04, 20, W / 2, H * 1.04, W * 0.78 * pulse);
    rg.addColorStop(0, "rgba(255,196,60,.55)");
    rg.addColorStop(0.35, "rgba(255,90,25,.30)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, H);

    // back wall: furnace bays
    g.save();
    g.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      const x = 90 + i * 190;
      g.fillStyle = "#0e0603";
      roundRect(g, x, H * 0.30, 112, 180, 8); g.fill();
      const f = 0.5 + Math.sin(t * 2 + i * 1.7) * 0.5;
      g.fillStyle = `rgba(255,${110 + f * 90},30,${0.22 + f * 0.3})`;
      roundRect(g, x + 14, H * 0.30 + 20, 84, 140, 6); g.fill();
    }
    g.restore();

    // hanging chains
    g.save();
    g.strokeStyle = "rgba(120,84,56,.5)"; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const x = 60 + i * 150 + Math.sin(t * 0.5 + i) * 5;
      const len = 120 + hash(i * 3) * 180;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + Math.sin(t * 0.6 + i) * 9, len); g.stroke();
      g.fillStyle = "rgba(90,62,42,.6)";
      g.beginPath(); g.arc(x + Math.sin(t * 0.6 + i) * 9, len, 5, 0, 7); g.fill();
    }
    g.restore();

    // rising embers
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 54; i++) {
      const sp = 26 + hash(i) * 50;
      const p = (t * sp + i * 131) % (H + 180);
      const x = hash(i * 7) * W + Math.sin(t * 1.4 + i) * 22;
      const a = 0.65 * (1 - p / (H + 180));
      g.globalAlpha = Math.max(0, a);
      g.fillStyle = i % 4 === 0 ? "#ffe9a8" : "#ff7a1f";
      g.beginPath(); g.arc(x, H + 60 - p, 1 + hash(i * 11) * 2.4, 0, 7); g.fill();
    }
    g.restore();

    // heat haze band
    g.save(); g.globalAlpha = 0.12; g.fillStyle = "#ff6a18";
    g.fillRect(0, H * 0.86, W, H * 0.14); g.restore();
  },
},

/* ------------------------------------------------------------------ 3 --- */
{
  id: "DRIFT", name: "CIRRUS DRIFT", tag: "DAWN · TWITCHY",
  blurb: "Dawn above the cloud deck. The platform rights itself almost instantly, so tilts are jabs, not leans.",
  pivot: { x: 800, y: 600 },
  // open sky: still the most forgiving map, but not so wide it stalemates
  blast: { left: -500, right: 2100, top: -660, bottom: 1380 },
  tilt: Object.assign({}, TILT_BASE, {
    torque: 0.0000030,
    spring: 0.0138,      // snaps level fast
    damp: 0.930,         // and does not keep ringing
    maxAngVel: 0.072,
    limit: 0.36,
    snapLaunch: 15.5,
    snapDamage: 4,
  }),
  pal: { a: "#ffb4d6", b: "#8fd7ff", plat: "#efe3f3", platEdge: "#ff9ec7",
         soft: "#b89ede", ink: "#2b2140" },
  music: { bpm: 96, root: 262, scale: [0, 2, 4, 7, 9], wave: "sine", hats: false,
           seq: [0, 2, 4, -1, 2, 4, 5, -1, 4, 2, 0, -1, 2, -1, -1, -1] },
  layout: [
    // wide deck with far-out islands — lots of stage, few blast zones
    { x1: -340, y1: 0,    x2: 340,  y2: 0,    solid: true,  main: true, thick: 24 },
    { x1: -430, y1: -150, x2: -266, y2: -150, solid: false, thick: 12 },
    { x1:  266, y1: -150, x2:  430, y2: -150, solid: false, thick: 12 },
    { x1: -110, y1: -284, x2:  110, y2: -284, solid: false, thick: 12 },
  ],

  drawBg(g, t) {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#2a2a63"); grad.addColorStop(0.38, "#7d5e97");
    grad.addColorStop(0.68, "#eb9a96"); grad.addColorStop(1, "#ffd3a6");
    g.fillStyle = grad; g.fillRect(0, 0, W, H);

    // low sun
    const sx = W * 0.5, sy = H * 0.70;
    const sg = g.createRadialGradient(sx, sy, 10, sx, sy, 300);
    sg.addColorStop(0, "rgba(255,247,214,.95)");
    sg.addColorStop(0.3, "rgba(255,196,150,.45)");
    sg.addColorStop(1, "rgba(255,170,140,0)");
    g.fillStyle = sg; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,250,230,.9)";
    g.beginPath(); g.arc(sx, sy, 54, 0, 7); g.fill();

    // cloud decks at three parallax depths
    const deck = (yBase, speed, scale, alpha, col) => {
      g.save(); g.globalAlpha = alpha; g.fillStyle = col;
      for (let i = 0; i < 10; i++) {
        const seed = i * 13 + yBase;
        const span = W + 500;
        const x = ((hash(seed) * span) + t * speed) % span - 250;
        const y = yBase + hash(seed * 3) * 50;
        const w = (90 + hash(seed * 5) * 150) * scale;
        const h = (20 + hash(seed * 7) * 18) * scale;
        g.beginPath();
        g.ellipse(x, y, w, h, 0, 0, 7);
        g.ellipse(x - w * 0.45, y + h * 0.3, w * 0.55, h * 0.72, 0, 0, 7);
        g.ellipse(x + w * 0.5, y + h * 0.25, w * 0.5, h * 0.66, 0, 0, 7);
        g.fill();
      }
      g.restore();
    };
    deck(H * 0.30, 7, 0.8, 0.22, "#ffffff");
    deck(H * 0.52, 14, 1.0, 0.34, "#ffe9f2");
    deck(H * 0.86, 26, 1.5, 0.55, "#ffffff");

    // birds
    g.save();
    g.strokeStyle = "rgba(60,44,70,.45)"; g.lineWidth = 2; g.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const x = ((t * 34 + i * 260) % (W + 200)) - 100;
      const y = H * 0.24 + Math.sin(t * 0.8 + i) * 16 + i * 14;
      const f = Math.sin(t * 5 + i * 2) * 4;
      g.beginPath();
      g.moveTo(x - 8, y + f); g.lineTo(x, y - 2); g.lineTo(x + 8, y + f);
      g.stroke();
    }
    g.restore();
  },
},

/* ------------------------------------------------------------------ 4 --- */
{
  id: "VAULT", name: "NULL VAULT", tag: "CRAMPED · LETHAL",
  blurb: "A sealed test chamber. Tiny deck, walls right there, and the pivot leans a long way before it lets go.",
  pivot: { x: 800, y: 560 },
  // walls are close — everything kills much earlier here
  blast: { left: -120, right: 1720, top: -300, bottom: 1180 },
  tilt: Object.assign({}, TILT_BASE, {
    torque: 0.0000044,
    spring: 0.0052,
    limit: 0.60,         // leans dramatically far before snapping
    snapVel: 0.075,
    snapLaunch: 20,
    snapDamage: 9,
  }),
  pal: { a: "#39ff9e", b: "#17c0ff", plat: "#0a1a14", platEdge: "#39ff9e",
         soft: "#1e7a56", ink: "#030a07" },
  music: { bpm: 140, root: 165, scale: [0, 1, 5, 7, 8], wave: "square", hats: true,
           seq: [0, 0, -1, 1, 0, -1, 2, -1, 4, -1, 2, 1, 0, -1, 3, -1] },
  layout: [
    // short deck, one high centre platform, nothing to run to
    { x1: -210, y1: 0,    x2: 210,  y2: 0,    solid: true,  main: true, thick: 26 },
    { x1:  -96, y1: -168, x2:   96, y2: -168, solid: false, thick: 11 },
  ],

  drawBg(g, t) {
    g.fillStyle = "#030907"; g.fillRect(0, 0, W, H);

    // chamber shell
    g.save();
    const vg = g.createRadialGradient(W / 2, H * 0.5, 60, W / 2, H * 0.5, W * 0.62);
    vg.addColorStop(0, "rgba(57,255,158,.10)");
    vg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.restore();

    // falling glyph columns
    g.save();
    g.font = '13px ui-monospace, Menlo, monospace';
    g.textAlign = "center";
    const cols = 40;
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * (W / cols);
      const speed = 40 + hash(i) * 110;
      const head = ((t * speed + hash(i * 5) * 900) % (H + 420)) - 60;
      for (let j = 0; j < 9; j++) {
        const y = head - j * 17;
        if (y < -20 || y > H + 20) continue;
        const a = (1 - j / 9) * 0.5;
        g.fillStyle = j === 0 ? `rgba(220,255,240,${a + 0.4})` : `rgba(57,255,158,${a * 0.6})`;
        const ch = String.fromCharCode(0x30a0 + ((i * 7 + j * 13 + ((t * 6) | 0)) % 90));
        g.fillText(ch, x, y);
      }
    }
    g.restore();

    // wall ribs, marking how close the blast zones are
    g.save();
    g.strokeStyle = "rgba(57,255,158,.16)"; g.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const y = 40 + i * 72;
      g.beginPath(); g.moveTo(0, y); g.lineTo(58, y + 22); g.stroke();
      g.beginPath(); g.moveTo(W, y); g.lineTo(W - 58, y + 22); g.stroke();
    }
    g.strokeStyle = "rgba(57,255,158,.30)"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(24, 0); g.lineTo(24, H); g.moveTo(W - 24, 0); g.lineTo(W - 24, H); g.stroke();
    g.restore();

    // scanlines
    g.save(); g.globalAlpha = 0.16; g.fillStyle = "#000";
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
    g.restore();
    g.save();
    g.globalAlpha = 0.05 + Math.abs(Math.sin(t * 0.7)) * 0.05;
    g.fillStyle = "#39ff9e"; g.fillRect(0, (t * 180) % H, W, 60);
    g.restore();
  },
},
];

const STAGE_BY_ID = {};
STAGES.forEach(s => { STAGE_BY_ID[s.id] = s; });

/* ========================================================================== */
/* Stage runtime                                                              */
/* ========================================================================== */
const Stage = {
  def: STAGES[0],
  pivot: { x: 800, y: 580 },
  tilt: 0, prevTilt: 0, angVel: 0,
  anchorTimer: 0, snapFlash: 0, snapCount: 0, snapCooldown: 0,
  lastPusher: null,
  segs: [],
  forcing: 0,

  get cfg() { return this.def.tilt; },
  get anchorFrames() { return this.def.tilt.anchorFrames; },
  get blast() { return this.def.blast; },
  get pal() { return this.def.pal; },

  select(def) {
    this.def = def;
    this.pivot = { x: def.pivot.x, y: def.pivot.y };
    this.reset();
  },
  reset() {
    this.tilt = 0; this.prevTilt = 0; this.angVel = 0;
    this.anchorTimer = 0; this.snapFlash = 0; this.snapCount = 0; this.snapCooldown = 0;
    this.lastPusher = null; this.forcing = 0;
    this.rebuild();
  },

  toWorld(lx, ly) {
    const c = Math.cos(this.tilt), s = Math.sin(this.tilt);
    return { x: this.pivot.x + lx * c - ly * s, y: this.pivot.y + lx * s + ly * c };
  },

  rebuild() {
    this.segs = this.def.layout.map(p => {
      const a = this.toWorld(p.x1, p.y1), b = this.toWorld(p.x2, p.y2);
      return {
        ax: a.x, ay: a.y, bx: b.x, by: b.y,
        solid: !!p.solid, main: !!p.main, thick: p.thick,
        angle: Math.atan2(b.y - a.y, b.x - a.x), local: p,
      };
    });
  },

  surfaceY(seg, x) {
    const lo = Math.min(seg.ax, seg.bx), hi = Math.max(seg.ax, seg.bx);
    if (x < lo - 2 || x > hi + 2) return null;
    const t = (x - seg.ax) / (seg.bx - seg.ax || 1e-6);
    return seg.ay + t * (seg.by - seg.ay);
  },

  nudge(amount) {
    if (this.anchorTimer > 0) return;
    this.angVel = clamp(this.angVel + amount, -this.cfg.maxAngVel, this.cfg.maxAngVel);
  },
  anchor() { this.anchorTimer = this.cfg.anchorFrames; this.angVel = 0; },
  flip() {
    if (this.anchorTimer > 0) return;
    this.tilt = -this.tilt; this.angVel = -this.angVel;
  },
  /** Pivot's super: drive the tilt one way regardless of who is standing where. */
  forceTilt(dir, power) {
    this.anchorTimer = 0;
    this.forcing = dir;
    this.angVel = clamp(this.angVel + dir * power, -this.cfg.maxAngVel * 1.5, this.cfg.maxAngVel * 1.5);
  },
  balance() { return clamp(this.tilt / this.cfg.limit, -1, 1); },

  update(fighters) {
    this.prevTilt = this.tilt;
    const C = this.cfg;

    if (this.anchorTimer > 0) {
      this.anchorTimer--;
      this.tilt += (0 - this.tilt) * 0.22;
      this.angVel = 0;
      this.rebuild();
      if (this.snapFlash > 0) this.snapFlash--;
      return;
    }

    let torque = 0;
    for (const f of fighters) {
      if (!f.alive || !f.grounded || !f.groundSeg || !f.groundSeg.main) continue;
      const arm = (f.x - this.pivot.x) * Math.cos(this.tilt) + (f.y - this.pivot.y) * Math.sin(this.tilt);
      torque += f.ch.weight * arm;
      if (f.heavyStomp > 0) torque += f.ch.weight * arm * C.stompTorque;
    }
    for (const f of fighters) if (f.alive && f.crankDir !== 0) torque += f.crankDir * C.crankTorque;
    if (this.forcing) { torque += this.forcing * C.crankTorque * 2.4; this.forcing = 0; }

    let acc = torque * C.torque - this.tilt * C.spring;
    this.angVel = clamp((this.angVel + acc) * C.damp, -C.maxAngVel, C.maxAngVel);
    this.tilt += this.angVel;

    if (this.snapCooldown > 0) this.snapCooldown--;
    if (Math.abs(this.tilt) > C.limit) {
      if (this.snapCooldown > 0) {
        // Still recovering from the last one: the deck just jams at its stop.
        this.tilt = Math.sign(this.tilt) * C.limit;
        this.angVel *= 0.5;
      } else this.snapBack(fighters);
    }
    if (this.snapFlash > 0) this.snapFlash--;
    this.rebuild();
  },

  snapBack(fighters) {
    const C = this.cfg;
    const sign = Math.sign(this.tilt);
    /* The rebound has to BLEED energy. At full strength it carried the deck
       clean across to the opposite limit, which snapped again, forever. It now
       keeps less than half its swing and can't re-trigger for a moment. */
    this.tilt = sign * C.limit * 0.9;
    this.angVel = -sign * C.snapVel * 0.45;
    this.snapCooldown = 48;
    this.snapFlash = 26;
    this.snapCount++;
    Snd.snapback();
    FX.shake(26); FX.hitPause(8);
    FX.flash("#ffffff", 0.25);

    for (const f of fighters) {
      if (!f.alive || !f.grounded || !f.groundSeg || f.pinned) continue;
      const lean = clamp((f.x - this.pivot.x) / 310, -1, 1);
      f.applyKnockback(lean * 7.5 - sign * 3.0,
        -C.snapLaunch * (1.15 - Math.abs(lean) * 0.3), C.snapDamage, 26, null);
      FX.burst(f.x, f.y + f.ch.size.h * 0.5, 16, "#ffffff", 7);
    }
    const culprit = this.lastPusher;
    if (culprit && culprit.alive) { culprit.stats.snapbacks++; culprit.addMeter(CFG.meter.onSnapback); }
    FX.banner("SNAP-BACK!", "#ffffff");
    FX.ring(this.pivot.x, this.pivot.y, 60, 560, "#ffffff", 5);
  },
};
