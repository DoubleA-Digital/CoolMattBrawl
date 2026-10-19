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
  id: "YARD", name: "PIVOT YARD", tag: "NEON · BALANCED", deck: "neon",
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
    { x1: -322, y1: -186, x2: -150, y2: -186, solid: false, thick: 12,
      drift: { range: 54, speed: 0.011 }, phase: 0 },
    { x1:  150, y1: -186, x2:  322, y2: -186, solid: false, thick: 12,
      drift: { range: 54, speed: 0.011 }, phase: 286 },
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

    // a slow rotating emblem ring, far back — gives the void a centre
    g.save();
    g.translate(W / 2, H * 0.46);
    g.rotate(t * 0.04);
    g.strokeStyle = "rgba(0,229,255,.07)"; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 230, 0, 7); g.stroke();
    g.beginPath(); g.arc(0, 0, 178, 0, 7); g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.strokeStyle = `rgba(255,46,136,${i % 3 === 0 ? 0.12 : 0.05})`;
      g.lineWidth = i % 3 === 0 ? 5 : 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 178, Math.sin(a) * 178);
      g.lineTo(Math.cos(a) * 230, Math.sin(a) * 230);
      g.stroke();
    }
    g.restore();

    // distant neon skyline on the horizon
    g.save();
    const hz = H * 0.56;
    for (let i = 0; i < 26; i++) {
      const bw = 34 + hash(i * 3) * 46;
      const bx = i * 52 - 20 + Math.sin(t * 0.05 + i) * 1.5;
      const bh = 40 + hash(i * 7) * 150;
      g.fillStyle = "rgba(9,6,24,.92)";
      g.fillRect(bx, hz - bh, bw, bh);
      g.fillStyle = i % 2 ? "rgba(0,229,255,.16)" : "rgba(255,46,136,.14)";
      g.fillRect(bx, hz - bh, bw, 2);
      // lit windows
      for (let k = 0; k < 4; k++) {
        if (hash(i * 13 + k) > 0.6) {
          g.fillStyle = i % 2 ? "rgba(0,229,255,.22)" : "rgba(255,46,136,.2)";
          g.fillRect(bx + 6 + k * 9, hz - bh + 14 + (k % 3) * 22, 4, 7);
        }
      }
    }
    g.restore();

    // perspective grid
    g.save();
    g.strokeStyle = "rgba(0,229,255,.12)"; g.lineWidth = 1;
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

    // foreground: gantry rails across the bottom corners, out of focus
    g.save();
    g.globalAlpha = 0.5;
    g.strokeStyle = "#06040f"; g.lineWidth = 16; g.lineCap = "round";
    g.beginPath(); g.moveTo(-20, H + 10); g.lineTo(150, H - 70); g.stroke();
    g.beginPath(); g.moveTo(W + 20, H + 10); g.lineTo(W - 150, H - 70); g.stroke();
    g.strokeStyle = "rgba(0,229,255,.1)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-20, H + 2); g.lineTo(150, H - 78); g.stroke();
    g.beginPath(); g.moveTo(W + 20, H + 2); g.lineTo(W - 150, H - 78); g.stroke();
    g.restore();
  },
},

/* ------------------------------------------------------------------ 2 --- */
{
  id: "FOUNDRY", name: "CINDER FOUNDRY", tag: "MOLTEN · HEAVY SWING", deck: "cast",
  blurb: "A casting beam over an open crucible. It swings like a wrecking ball and the floor is very close.",
  pivot: { x: 800, y: 560 },
  // the crucible is right below: far less room to recover underneath
  blast: { left: -430, right: 2030, top: -560, bottom: 1140 },
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
    { x1: -302, y1: 0,    x2: 302,  y2: 0,    solid: true,  main: true, thick: 30 },
    { x1: -348, y1: -168, x2: -214, y2: -168, solid: false, thick: 11,
      hot: { period: 320, on: 110, warn: 55, dmg: 1.8 }, phase: 0 },
    { x1:  214, y1: -168, x2:  348, y2: -168, solid: false, thick: 11,
      hot: { period: 320, on: 110, warn: 55, dmg: 1.8 }, phase: 160 },
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

    // the great furnace arch behind everything
    g.save();
    g.fillStyle = "#0d0604";
    g.beginPath();
    g.moveTo(W * 0.5 - 430, H);
    g.lineTo(W * 0.5 - 430, H * 0.42);
    g.arc(W * 0.5, H * 0.42, 430, Math.PI, 0);
    g.lineTo(W * 0.5 + 430, H);
    g.closePath(); g.fill();
    /* The arch as one continuous masonry band with joint lines cut across it.
       Drawn as separate bricks it read as a row of blocks floating in the
       dark, because the arch body behind them was nearly black on black. */
    g.save();
    g.lineWidth = 46;
    g.strokeStyle = "#2a1409";
    g.beginPath(); g.arc(W * 0.5, H * 0.42, 430, Math.PI, 0); g.stroke();
    // lit inner rim and a dark outer rim give the band thickness
    g.lineWidth = 4;
    g.strokeStyle = "rgba(255,138,31,.26)";
    g.beginPath(); g.arc(W * 0.5, H * 0.42, 408, Math.PI, 0); g.stroke();
    g.strokeStyle = "rgba(10,5,2,.9)";
    g.beginPath(); g.arc(W * 0.5, H * 0.42, 453, Math.PI, 0); g.stroke();
    // joints
    g.strokeStyle = "rgba(10,5,2,.75)"; g.lineWidth = 3;
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI + (i / 20) * Math.PI;
      g.beginPath();
      g.moveTo(W * 0.5 + Math.cos(a) * 407, H * 0.42 + Math.sin(a) * 407);
      g.lineTo(W * 0.5 + Math.cos(a) * 453, H * 0.42 + Math.sin(a) * 453);
      g.stroke();
    }
    g.restore();
    g.restore();

    // back wall: furnace bays
    // (kept dim: at half alpha over the crucible glow these came out a pale
    //  olive and read as lit windows rather than furnace mouths)
    g.save();
    for (let i = 0; i < 6; i++) {
      const x = 90 + i * 190;
      g.fillStyle = "#0b0402";
      roundRect(g, x, H * 0.30, 112, 180, 8); g.fill();
      const f = 0.5 + Math.sin(t * 2 + i * 1.7) * 0.5;
      g.fillStyle = `rgba(255,${72 + f * 60},18,${0.16 + f * 0.2})`;
      roundRect(g, x + 14, H * 0.30 + 20, 84, 140, 6); g.fill();
      // grate bars over each bay
      g.strokeStyle = "rgba(14,7,3,.92)"; g.lineWidth = 5;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.moveTo(x + 22 + k * 23, H * 0.30 + 20);
        g.lineTo(x + 22 + k * 23, H * 0.30 + 160); g.stroke();
      }
      g.strokeStyle = "rgba(255,138,31,.14)"; g.lineWidth = 2;
      roundRect(g, x, H * 0.30, 112, 180, 8); g.stroke();
    }
    g.restore();

    // A ladle pouring, hung far enough in that it is not clipped by the frame.
    g.save();
    const swing2 = Math.sin(t * 0.35) * 0.09;
    g.translate(W * 0.16, H * 0.055);
    g.rotate(swing2);
    g.strokeStyle = "rgba(80,54,36,.9)"; g.lineWidth = 7;
    g.beginPath(); g.moveTo(0, -H * 0.06); g.lineTo(0, 46); g.stroke();
    // the bucket, solid with a hot rim
    g.fillStyle = "#170b05";
    g.strokeStyle = "rgba(14,7,3,.95)"; g.lineWidth = 5;
    poly(g, [-36, 46, 36, 46, 25, 100, -25, 100]); g.stroke(); g.fill();
    g.strokeStyle = "rgba(255,150,40,.5)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-36, 48); g.lineTo(36, 48); g.stroke();
    g.fillStyle = "rgba(255,200,90,.5)";
    g.beginPath(); g.ellipse(0, 48, 34, 5, 0, 0, 7); g.fill();
    // the pour
    g.save(); g.globalCompositeOperation = "lighter";
    const pg = g.createLinearGradient(0, 100, 0, H);
    pg.addColorStop(0, "rgba(255,220,120,.7)");
    pg.addColorStop(0.4, "rgba(255,130,30,.28)");
    pg.addColorStop(1, "rgba(255,80,20,0)");
    g.fillStyle = pg;
    g.beginPath();
    g.moveTo(-5, 100); g.lineTo(5, 100);
    g.lineTo(13 + Math.sin(t * 3) * 4, H); g.lineTo(-13 + Math.sin(t * 3) * 4, H);
    g.closePath(); g.fill();
    g.restore();
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

    // foreground: pipework across the bottom, nearly black
    g.save();
    g.strokeStyle = "#0a0503"; g.lineWidth = 26; g.lineCap = "butt";
    g.beginPath(); g.moveTo(-10, H - 26); g.lineTo(W + 10, H - 40); g.stroke();
    g.strokeStyle = "rgba(255,138,31,.09)"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-10, H - 36); g.lineTo(W + 10, H - 50); g.stroke();
    for (let i = 0; i < 6; i++) {
      const x = 80 + i * 230;
      g.fillStyle = "#0a0503";
      roundRect(g, x, H - 48, 26, 48, 4); g.fill();
    }
    g.restore();
  },
},

/* ------------------------------------------------------------------ 3 --- */
{
  id: "DRIFT", name: "CIRRUS DRIFT", tag: "DAWN · TWITCHY", deck: "cloud",
  blurb: "Dawn above the cloud deck. The platform rights itself almost instantly, so tilts are jabs, not leans.",
  pivot: { x: 800, y: 600 },
  // open sky: still the most forgiving map, but not so wide it stalemates
  // Tightened again: with damage output down across the board (stale moves,
  // smaller hitboxes, nerfed supers) the most forgiving stage started running
  // to the clock -- 3 of 12 test matches timed out at 106s average.
  blast: { left: -430, right: 2030, top: -640, bottom: 1300 },
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
    { x1: -430, y1: -150, x2: -266, y2: -150, solid: false, thick: 12,
      crumble: { delay: 54, gone: 150 } },
    { x1:  266, y1: -150, x2:  430, y2: -150, solid: false, thick: 12,
      crumble: { delay: 54, gone: 150 } },
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
    /* Distant peaks. Drawn before any cloud deck and fairly opaque: at low
       alpha over a bright sky they read as ghostly triangles hanging in the
       air rather than mountains behind the weather. Their bases sit low
       enough that the lower cloud decks cover them. */
    g.save();
    {
      const base = H * 0.68;
      const peaks = [];
      for (let i = 0; i < 7; i++)
        peaks.push({ x: i * 230 - 90 + Math.sin(i) * 40, h: 80 + hash(i * 17) * 130 });

      /* Each layer is ONE path containing every peak, filled once. Filling
         them one at a time stacked the translucency wherever two peaks
         overlapped, which painted a hard dark V into the middle of the
         range that looked like an upside-down mountain. */
      const fillAll = (alpha, col, build) => {
        g.globalAlpha = alpha; g.fillStyle = col;
        g.beginPath();
        for (const p of peaks) build(p);
        g.fill();
      };
      fillAll(0.6, "#64487d", p => {
        g.moveTo(p.x - 160, base); g.lineTo(p.x, base - p.h);
        g.lineTo(p.x + 160, base); g.closePath();
      });
      // sunward faces, catching the dawn
      fillAll(0.3, "#c98ba0", p => {
        g.moveTo(p.x, base - p.h); g.lineTo(p.x + 160, base);
        g.lineTo(p.x + 20, base); g.closePath();
      });
      // snow caps, following the ridge so they do not float
      fillAll(0.5, "#fff0f6", p => {
        const cw2 = 36, ch2 = p.h * 0.2;
        g.moveTo(p.x, base - p.h);
        g.lineTo(p.x + cw2, base - p.h + ch2);
        g.lineTo(p.x + 12, base - p.h + ch2 * 0.7);
        g.lineTo(p.x - 10, base - p.h + ch2);
        g.lineTo(p.x - cw2, base - p.h + ch2 * 0.85);
        g.closePath();
      });
    }
    g.restore();

    deck(H * 0.30, 7, 0.8, 0.22, "#ffffff");
    deck(H * 0.52, 14, 1.0, 0.34, "#ffe9f2");

    // floating stone islands, drifting slowly past
    g.save();
    for (let i = 0; i < 4; i++) {
      const span = W + 700;
      const ix = ((hash(i * 23) * span) + t * (9 + i * 4)) % span - 350;
      const iy = H * (0.34 + hash(i * 29) * 0.22) + Math.sin(t * 0.4 + i) * 7;
      const s = 0.45 + hash(i * 31) * 0.5;
      g.save(); g.translate(ix, iy); g.scale(s, s);
      g.globalAlpha = 0.55;
      g.fillStyle = "#9a7fb8";
      poly(g, [-60, 0, 60, 0, 34, 30, -30, 30]); g.fill();
      g.fillStyle = "#7a5f98";
      poly(g, [-30, 30, 34, 30, 6, 72, -8, 72]); g.fill();
      g.fillStyle = "rgba(190,255,200,.5)";
      g.beginPath(); g.ellipse(0, -2, 58, 7, 0, 0, 7); g.fill();
      g.restore();
    }
    g.restore();

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

    // foreground wisps blowing across the camera
    g.save();
    g.globalAlpha = 0.3; g.fillStyle = "#ffffff";
    for (let i = 0; i < 4; i++) {
      const span = W + 900;
      const x = ((hash(i * 41) * span) + t * 70) % span - 450;
      const y = H * (0.78 + hash(i * 43) * 0.2);
      g.beginPath();
      g.ellipse(x, y, 260, 26, 0, 0, 7);
      g.ellipse(x - 150, y + 12, 140, 18, 0, 0, 7);
      g.fill();
    }
    g.restore();
  },
},

/* ------------------------------------------------------------------ 4 --- */
{
  id: "VAULT", name: "NULL VAULT", tag: "CRAMPED · LETHAL", deck: "grate",
  blurb: "A sealed test chamber. Tiny deck, walls right there, and the pivot leans a long way before it lets go.",
  pivot: { x: 800, y: 560 },
  // walls are close — everything kills much earlier here
  blast: { left: -215, right: 1815, top: -360, bottom: 1250 },
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
    { x1: -256, y1: 0,    x2: 256,  y2: 0,    solid: true,  main: true, thick: 26 },
    { x1: -118, y1: -172, x2:  118, y2: -172, solid: false, thick: 11,
      retract: { period: 420, on: 260 } },
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

    // the containment ring behind the deck: this is a test chamber, and
    // something is clearly meant to be held in the middle of it
    g.save();
    g.translate(W / 2, H * 0.52);
    g.strokeStyle = "rgba(57,255,158,.12)"; g.lineWidth = 20;
    g.beginPath(); g.arc(0, 0, 250, 0, 7); g.stroke();
    g.strokeStyle = "rgba(57,255,158,.22)"; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 260, 0, 7); g.stroke();
    g.beginPath(); g.arc(0, 0, 240, 0, 7); g.stroke();
    // emitter blocks at the cardinals, pulsing in sequence
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 0.12;
      const lit = (Math.sin(t * 2.4 - i * 0.7) + 1) / 2;
      g.save();
      g.translate(Math.cos(a) * 250, Math.sin(a) * 250);
      g.rotate(a);
      g.fillStyle = "#061a12";
      g.strokeStyle = `rgba(57,255,158,${0.2 + lit * 0.4})`; g.lineWidth = 2;
      roundRect(g, -14, -20, 28, 40, 4); g.fill(); g.stroke();
      g.fillStyle = `rgba(57,255,158,${0.15 + lit * 0.5})`;
      roundRect(g, -7, -13, 14, 26, 3); g.fill();
      g.restore();
    }
    g.restore();

    // stencilled chamber markings
    g.save();
    g.globalAlpha = 0.14;
    g.font = `900 72px ${FONT_DISPLAY}`;
    g.textAlign = "center"; g.fillStyle = "#39ff9e";
    g.fillText("VAULT 04", W / 2, H * 0.26);
    g.font = `700 13px ${FONT_MONO}`;
    g.fillText("PIVOT TOLERANCE EXCEEDED · CONTAINMENT ADVISED", W / 2, H * 0.30);
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

    // foreground: the chamber's own window frame, hard black, hugging the edges
    g.save();
    g.fillStyle = "#020705";
    g.fillRect(0, 0, 14, H); g.fillRect(W - 14, 0, 14, H);
    g.fillRect(0, 0, W, 10); g.fillRect(0, H - 10, W, 10);
    // corner gussets
    g.fillStyle = "#04120c";
    for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) {
      g.save(); g.translate(cx, cy); g.scale(sx, sy);
      poly(g, [0, 0, 74, 0, 0, 74]); g.fill();
      g.strokeStyle = "rgba(57,255,158,.18)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(74, 0); g.lineTo(0, 74); g.stroke();
      g.restore();
    }
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
  pfx: [], platT: 0,
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
    this.resetPlatforms();
    this.anchorTimer = 0; this.snapFlash = 0; this.snapCount = 0; this.snapCooldown = 0;
    this.lastPusher = null; this.forcing = 0;
    this.rebuild();
  },

  toWorld(lx, ly) {
    const c = Math.cos(this.tilt), s = Math.sin(this.tilt);
    return { x: this.pivot.x + lx * c - ly * s, y: this.pivot.y + lx * s + ly * c };
  },

  /* ---------------------------------------------------- platform state ----
     The side platforms are no longer inert scenery. Each stage gives its own
     a behaviour, and the live state of each one lives in pfx[i], parallel to
     def.layout. Absent platforms are simply left out of segs, so collision,
     combat's ground test and the contact shadows all respect them without
     any of those three needing to know this system exists. */
  resetPlatforms() {
    this.platT = 0;
    this.pfx = this.def.layout.map(() => ({
      dx: 0, present: true, heat: 0, stood: 0, gone: 0, alpha: 1,
    }));
  },

  platformTick(fighters) {
    this.platT++;
    const T = this.platT;

    this.def.layout.forEach((p, i) => {
      const s = this.pfx[i];
      if (p.main) return;                       // the deck itself never changes
      const ph = p.phase || 0;

      if (p.drift) {
        s.dx = Math.sin((T + ph) * p.drift.speed) * p.drift.range;
      }

      if (p.hot) {
        // cold → a warning flicker → hot. The warning is what makes it fair.
        const cyc = (T + ph) % p.hot.period;
        if (cyc < p.hot.on) s.heat = 1;
        else if (cyc < p.hot.on + p.hot.warn) s.heat = 0;
        else s.heat = (cyc > p.hot.period - p.hot.warn) ? 0.5 : 0;
      }

      if (p.crumble) {
        if (s.gone > 0) {
          s.gone--;
          s.present = false;
          s.alpha = s.gone < 20 ? 1 - s.gone / 20 : 0;   // fades back in
          if (s.gone === 0) { s.present = true; s.stood = 0; s.alpha = 1; }
        } else {
          const loaded = fighters.some(f =>
            f.alive && f.grounded && f.groundSeg && f.groundSeg.local === p);
          s.stood = loaded ? s.stood + 1 : Math.max(0, s.stood - 1);
          s.alpha = 1 - (s.stood / p.crumble.delay) * 0.55;
          if (s.stood >= p.crumble.delay) {
            s.gone = p.crumble.gone;
            s.present = false; s.alpha = 0;
            const a = this.toWorld(p.x1 + s.dx, p.y1), b = this.toWorld(p.x2 + s.dx, p.y2);
            FX.burst((a.x + b.x) / 2, (a.y + b.y) / 2, 18, this.pal.soft, 5);
            Snd.noise(0.25, 0.2, 700, 0.9);
          }
        }
      }

      if (p.retract) {
        const cyc = (T + ph) % p.retract.period;
        const open = cyc < p.retract.on;
        if (open !== s.present) {
          const a = this.toWorld(p.x1, p.y1), b = this.toWorld(p.x2, p.y2);
          FX.ring((a.x + b.x) / 2, (a.y + b.y) / 2, 8, 60, this.pal.platEdge, 2);
          Snd.tone(open ? 220 : 160, 0.14, "square", 0.1, open ? 420 : 90);
        }
        s.present = open;
        // the last 40 frames before it pulls back are telegraphed
        s.alpha = open ? (cyc > p.retract.on - 40 ? 0.45 + 0.4 * Math.abs(Math.sin(T * 0.4)) : 1) : 0;
      }
    });
  },

  /** Burn anyone standing on a hot platform. Called after collision resolves. */
  platformDamage(fighters) {
    this.def.layout.forEach((p, i) => {
      if (!p.hot || this.pfx[i].heat < 1) return;
      for (const f of fighters) {
        if (!f.alive || !f.grounded || !f.groundSeg || f.groundSeg.local !== p) continue;
        if (f.invuln > 0 || f.hotTick > 0) continue;
        f.hotTick = 14;
        f.applyKnockback(0, -5.5, p.hot.dmg || 1.6, 4, null);
        FX.burst(f.x, f.feetY, 8, "#ff8a1f", 4);
        Snd.tone(300, 0.06, "sawtooth", 0.09, 120);
      }
    });
  },

  rebuild() {
    this.segs = [];
    this.def.layout.forEach((p, i) => {
      const s = this.pfx[i];
      if (s && !s.present) return;              // retracted / crumbled away
      const dx = s ? s.dx : 0;
      const a = this.toWorld(p.x1 + dx, p.y1), b = this.toWorld(p.x2 + dx, p.y2);
      this.segs.push({
        ax: a.x, ay: a.y, bx: b.x, by: b.y,
        solid: !!p.solid, main: !!p.main, thick: p.thick,
        angle: Math.atan2(b.y - a.y, b.x - a.x), local: p, fx: s,
      });
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
      this.platformTick(fighters);
      this.rebuild();
      this.platformDamage(fighters);
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
    this.platformTick(fighters);
    this.rebuild();
    this.platformDamage(fighters);
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
