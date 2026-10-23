/* ==========================================================================
   7. FX — particles, impact feedback, and the camera

   The camera is the part that was wrong in v1: it chased the exact midpoint of
   every fighter on every frame, so it drifted left and right constantly even
   when nothing was happening. This one holds completely still until the action
   leaves a dead zone, eases rather than snaps, and quantises its zoom so it
   never breathes in and out. Screen shake is short, capped, and switchable off.
   ========================================================================== */

const FX = {
  parts: [], rings: [], marks: [], streaks: [], texts: [],
  blades: [], bolts: [], cracks: [], glyphs: [],
  shakeMag: 0, shakeX: 0, shakeY: 0,
  pause: 0,
  flashCol: null, flashAmt: 0,
  chroma: 0,                 // red/blue separation, decays every frame
  bannerText: "", bannerTimer: 0, bannerColor: "#fff",

  cam: {
    x: 800, y: 440, zoom: 0.9,
    px: 800, py: 440, pz: 0.9,   // previous step, for render interpolation
    tz: 0.9,
  },

  reset() {
    this.parts.length = 0; this.rings.length = 0; this.marks.length = 0;
    this.streaks.length = 0; this.texts.length = 0;
    this.blades.length = 0; this.bolts.length = 0;
    this.cracks.length = 0; this.glyphs.length = 0;
    this.shakeMag = 0; this.pause = 0; this.bannerTimer = 0;
    this.flashAmt = 0; this.chroma = 0;
    const c = this.cam;
    c.x = c.px = Stage.pivot.x;
    c.y = c.py = Stage.pivot.y - 150;
    c.zoom = c.pz = c.tz = 0.88;
  },

  /* ----------------------------------------------------------- feedback */
  shake(m) {
    const amt = Settings.get("shakeAmount");
    if (amt <= 0) return;
    this.shakeMag = Math.min(CFG.cam.maxShake, this.shakeMag + m * amt);
  },
  hitPause(f) { this.pause = Math.max(this.pause, f); },
  flash(col, amt) { this.flashCol = col; this.flashAmt = Math.max(this.flashAmt, amt); },
  /** Kick the chromatic aberration. Heavy hits, KOs and supers. */
  punch(amt) { this.chroma = Math.min(1, this.chroma + amt); },
  banner(text, color) {
    if (!text) return;
    this.bannerText = text; this.bannerTimer = 72; this.bannerColor = color || "#fff";
    Net.forwardBanner(text, this.bannerColor);    // online guests see it too
  },

  get density() { return Settings.get("particles"); },

  burst(x, y, n, color, speed) {
    n = Math.min(40, Math.round(n * this.density));
    for (let i = 0; i < n; i++) {
      if (this.parts.length > CFG.maxParticles) break;
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
        life: 16 + Math.random() * 22, max: 38, size: 1.6 + Math.random() * 3.4,
        color, grav: 0.22, drag: 0.985 });
    }
  },
  spark(x, y, color) {
    if (this.parts.length > CFG.maxParticles || this.density <= 0) return;
    this.parts.push({ x, y, vx: rnd(-1.2, 1.2), vy: rnd(-1.2, 1.2),
      life: 10 + Math.random() * 12, max: 22, size: 1.2 + Math.random() * 2,
      color, grav: 0.02, drag: 0.96 });
  },
  /** A fan of dust along the ground — used by heavy ground impacts. */
  dustLine(x, y, width, color) {
    const n = Math.round(14 * this.density);
    for (let i = 0; i < n; i++) {
      const s = (Math.random() * 2 - 1);
      this.parts.push({ x: x + s * width * 0.5, y: y - 2,
        vx: s * rnd(2, 7), vy: rnd(-4.5, -1),
        life: 18 + Math.random() * 18, max: 36, size: 2 + Math.random() * 3.6,
        color, grav: 0.16, drag: 0.97 });
    }
  },
  ring(x, y, r0, r1, color, lw) {
    this.rings.push({ x, y, r: r0, r1, cur: r0, life: 24, max: 24, color, lw: lw || 3 });
  },
  streak(x1, y1, x2, y2, color) {
    this.streaks.push({ x1, y1, x2, y2, color, life: 10, max: 10 });
  },
  /* ------------------------------------------------- attack primitives

     These exist so each move can have a signature rather than every attack
     producing the same puff of sparks. A blade is the workhorse: a crescent
     that sweeps outward and thins as it goes, which is what reads as "a thing
     was swung through here".

       rot     centre angle of the arc, radians, 0 = +x
       spread  how much of a circle it covers
       r0,r1   radius at birth and death — the sweep
       w       half-thickness at the middle of the crescent  */
  blade(x, y, rot, r0, r1, spread, color, opts) {
    if (this.density <= 0) return;
    const o = opts || {};
    this.blades.push({
      x, y, rot, r0, r1, spread, color,
      w: o.w || 10, life: o.life || 14, max: o.life || 14,
      spin: o.spin || 0, follow: o.follow || null,
      core: o.core !== false,
    });
  },

  /** Jagged lightning between two points. The zigzag is generated once and
      kept, so it reads as a bolt holding still rather than static noise. */
  bolt(x1, y1, x2, y2, color, opts) {
    if (this.density <= 0) return;
    const o = opts || {};
    const segs = o.segs || 6, jag = o.jag || 14;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const px = lerp(x1, x2, t), py = lerp(y1, y2, t);
      const off = (i === 0 || i === segs) ? 0 : rnd(-jag, jag);
      const nx = -(y2 - y1), ny = (x2 - x1);
      const nl = Math.hypot(nx, ny) || 1;
      pts.push({ x: px + (nx / nl) * off, y: py + (ny / nl) * off });
    }
    this.bolts.push({ pts, color, life: o.life || 9, max: o.life || 9, w: o.w || 3,
                      branch: o.branch !== false });
  },

  /** Cracks radiating along a surface from an impact. */
  crack(x, y, dir, len, color, n) {
    if (this.density <= 0) return;
    n = n || 3;
    const steps = 4;
    for (let i = 0; i < n; i++) {
      const pts = [{ x, y }];
      for (let s = 0; s < steps; s++) {
        const prev = pts[pts.length - 1];
        pts.push({
          x: prev.x + dir * (len / steps) * (0.6 + Math.random() * 0.7),
          y: prev.y + rnd(-5, 5),
        });
      }
      this.cracks.push({ pts, color, life: 26, max: 26, w: 2.6 - i * 0.5 });
    }
  },

  /** A brief symbol stamped in the world — scale marks, orbit rings, etc. */
  glyph(x, y, kind, size, color, life) {
    if (this.density <= 0) return;
    this.glyphs.push({ x, y, kind, size, color, life: life || 20, max: life || 20, rot: 0 });
  },

  /** Radial impact lines. Short, bright, and gone in a few frames — the thing
      that makes a heavy connect read as a BLOW rather than a touch. */
  impactLines(x, y, dir, n, color, len) {
    if (this.density <= 0) return;
    n = Math.round(n * Math.min(1, this.density));
    for (let i = 0; i < n; i++) {
      const spread = 1.5;
      const a = dir + rnd(-spread, spread);
      const r0 = 16 + Math.random() * 14;
      const l = (len || 42) * (0.55 + Math.random() * 0.8);
      this.streaks.push({
        x1: x + Math.cos(a) * r0, y1: y + Math.sin(a) * r0,
        x2: x + Math.cos(a) * (r0 + l), y2: y + Math.sin(a) * (r0 + l),
        color, life: 7 + (Math.random() * 4 | 0), max: 11,
      });
    }
  },

  hitmark(x, y, dmg) { this.marks.push({ x, y, life: 11, max: 11, size: 14 + dmg * 2.6 }); },
  /** Floating text at the point of impact — a damage number, or a short label
      like TIP/STALE when something modified that number. */
  damageText(x, y, dmg, color) {
    const text = typeof dmg === "number" ? Math.round(dmg).toString() : String(dmg);
    this.texts.push({ x, y, vy: -1.2, life: 42, max: 42, text, color,
                      small: typeof dmg !== "number" });
  },

  /* ------------------------------------------------------------- update */
  update(fighters) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= p.drag;
      if (--p.life <= 0) this.parts.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.cur = r.r + (r.r1 - r.r) * easeOut(1 - r.life / r.max);
      if (--r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.blades.length - 1; i >= 0; i--) {
      const b = this.blades[i];
      b.rot += b.spin;
      // a blade attached to a fighter tracks them, so a swing stays on the arm
      if (b.follow) { b.x = b.follow.x; b.y = b.follow.y + (b.follow.oy || 0); }
      if (--b.life <= 0) this.blades.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) if (--this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    for (let i = this.cracks.length - 1; i >= 0; i--) if (--this.cracks[i].life <= 0) this.cracks.splice(i, 1);
    for (let i = this.glyphs.length - 1; i >= 0; i--) {
      const gl = this.glyphs[i];
      gl.rot += 0.04;
      if (--gl.life <= 0) this.glyphs.splice(i, 1);
    }
    for (let i = this.marks.length - 1; i >= 0; i--) if (--this.marks[i].life <= 0) this.marks.splice(i, 1);
    for (let i = this.streaks.length - 1; i >= 0; i--) if (--this.streaks[i].life <= 0) this.streaks.splice(i, 1);
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.y += t.vy; t.vy *= 0.94;
      if (--t.life <= 0) this.texts.splice(i, 1);
    }

    this.shakeMag *= CFG.cam.shakeDecay;
    if (this.shakeMag < 0.2) this.shakeMag = 0;
    this.shakeX = (Math.random() - 0.5) * this.shakeMag * 2;
    this.shakeY = (Math.random() - 0.5) * this.shakeMag * 2;

    this.flashAmt *= 0.84;
    if (this.flashAmt < 0.01) this.flashAmt = 0;
    this.chroma *= 0.80;
    if (this.chroma < 0.01) this.chroma = 0;
    if (this.bannerTimer > 0) this.bannerTimer--;

    this.updateCamera(fighters);
  },

  /* ------------------------------------------------------------- camera */
  updateCamera(fighters) {
    const c = this.cam, K = CFG.cam;
    c.px = c.x; c.py = c.y; c.pz = c.zoom;

    const live = fighters.filter(f => f.alive && f.state !== ST.DEAD);
    const home = { x: Stage.pivot.x, y: Stage.pivot.y - 150 };

    if (!live.length || Settings.get("cameraSway") <= 0) {
      // Pinned mode: sit over the stage and only change zoom.
      c.x += (home.x - c.x) * 0.08;
      c.y += (home.y - c.y) * 0.08;
      c.zoom += (0.86 - c.zoom) * K.zoomLerp;
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const f of live) {
      minX = Math.min(minX, f.x); maxX = Math.max(maxX, f.x);
      minY = Math.min(minY, f.y); maxY = Math.max(maxY, f.y);
    }
    // Always keep the stage itself in frame so the camera has an anchor.
    minX = Math.min(minX, home.x - 170); maxX = Math.max(maxX, home.x + 170);
    minY = Math.min(minY, home.y - 90);  maxY = Math.max(maxY, home.y + 110);

    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

    /* Dead zone: do nothing at all while the action's centre stays inside the
       box. Only the amount that pokes out of the box moves the camera, which
       is what stops the constant left-right drift. */
    const sway = Settings.get("cameraSway");
    const dx = cx - c.x, dy = cy - c.y;
    const dzX = K.deadX / sway, dzY = K.deadY / sway;
    let tx = c.x, ty = c.y;
    if (dx > dzX) tx = cx - dzX; else if (dx < -dzX) tx = cx + dzX;
    if (dy > dzY) ty = cy - dzY; else if (dy < -dzY) ty = cy + dzY;

    c.x += (tx - c.x) * K.follow;
    c.y += (ty - c.y) * K.follow;

    /* Zoom is quantised to discrete steps with hysteresis, so it settles on a
       value and stays there instead of micro-adjusting every frame. */
    const bw = (maxX - minX) + K.pad * 2, bh = (maxY - minY) + K.pad * 1.5;
    const want = clamp(Math.min(W / bw, H / bh), K.minZoom, K.maxZoom);
    const stepped = Math.round(want / K.zoomStep) * K.zoomStep;
    if (Math.abs(stepped - c.tz) > K.zoomStep * 0.75) c.tz = stepped;
    c.zoom += (c.tz - c.zoom) * K.zoomLerp;
  },

  /** Camera transform, interpolated between fixed steps for smooth motion. */
  applyCamera(g, alpha) {
    const c = this.cam;
    const x = lerp(c.px, c.x, alpha);
    const y = lerp(c.py, c.y, alpha);
    const z = lerp(c.pz, c.zoom, alpha);
    g.translate(W / 2 + this.shakeX, H / 2 + this.shakeY);
    g.scale(z, z);
    g.translate(-x, -y);
    return { x, y, z };
  },

  /* ------------------------------------------------------------ drawing */
  /** Crescent path: thickest in the middle, pointed at both tips. Canvas can't
      taper a stroke, so the arc is built as a polygon instead. */
  _bladePath(g, b, r, w) {
    const N = 14, a0 = b.rot - b.spread / 2;
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = a0 + b.spread * t;
      const th = w * Math.sin(Math.PI * t);
      g.lineTo(b.x + Math.cos(a) * (r + th), b.y + Math.sin(a) * (r + th));
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N, a = a0 + b.spread * t;
      const th = w * Math.sin(Math.PI * t);
      g.lineTo(b.x + Math.cos(a) * (r - th), b.y + Math.sin(a) * (r - th));
    }
    g.closePath();
  },

  drawWorld(g) {
    const litParts = Settings.get("postFx") > 0;
    g.save();
    g.globalCompositeOperation = "lighter";

    /* ---- swept blades: the signature of a melee swing ---- */
    for (const b of this.blades) {
      const k = 1 - b.life / b.max;              // 0 at birth, 1 at death
      const a = b.life / b.max;
      const r = lerp(b.r0, b.r1, easeOut(k));
      const w = b.w * (1 - k * 0.72);
      /* Hold near full brightness for the first half of the life, then fade.
         Squaring the alpha instead made the arc dimmest exactly when it was
         widest, so a swing read as a faint expanding ring rather than a swipe. */
      g.globalAlpha = Math.min(1, a * 1.9) * 0.9;
      g.fillStyle = b.color;
      this._bladePath(g, b, r, w);
      g.fill();
      if (b.core) {                               // hot inner edge
        g.globalAlpha = Math.min(1, a * 1.6) * 0.95;
        g.fillStyle = "#ffffff";
        this._bladePath(g, b, r, w * 0.32);
        g.fill();
      }
    }

    /* ---- lightning ---- */
    for (const b of this.bolts) {
      const a = b.life / b.max;
      g.globalAlpha = a;
      g.lineCap = "round"; g.lineJoin = "round";
      for (const pass of [[b.w * 2.4, b.color, 0.5], [b.w, "#ffffff", 1]]) {
        g.lineWidth = pass[0]; g.strokeStyle = pass[1];
        g.globalAlpha = a * pass[2];
        g.beginPath();
        g.moveTo(b.pts[0].x, b.pts[0].y);
        for (let i = 1; i < b.pts.length; i++) g.lineTo(b.pts[i].x, b.pts[i].y);
        g.stroke();
      }
    }

    for (const s of this.streaks) {
      const a = s.life / s.max;
      g.globalAlpha = a * 0.8; g.strokeStyle = s.color;
      g.lineWidth = 1 + a * 5; g.lineCap = "round";
      g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke();
    }
    for (const r of this.rings) {
      const a = r.life / r.max;
      g.globalAlpha = a * 0.85; g.strokeStyle = r.color;
      g.lineWidth = r.lw * (0.4 + a);
      g.beginPath(); g.arc(r.x, r.y, r.cur, 0, 7); g.stroke();
      // a soft bloom core inside a young ring, so impacts flare
      if (a > 0.55 && litParts)
        Light.draw(g, r.x, r.y, r.cur * 0.9, r.color, (a - 0.55) * 0.7, 0.02);
    }
    /* Particles cast light rather than being flat discs, so a burst reads as
       sparks instead of confetti. Measured at ~1.3us per halo, so only the
       larger particles get one: a 1px spark gains nothing visually from a
       halo, and at the 900-particle cap the difference is ~1ms a frame. */
    for (const p of this.parts) {
      const a = p.life / p.max;
      const r = p.size * (0.4 + a * 0.8);
      if (litParts && p.size > 2.1)
        Light.draw(g, p.x, p.y, r * 3.2, p.color, Math.min(1, a * 1.1) * 0.55, 0.12);
      g.globalAlpha = Math.min(1, a * 1.4); g.fillStyle = p.color;
      g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
    }
    for (const m of this.marks) {
      const a = m.life / m.max;
      g.globalAlpha = a; g.fillStyle = "#ffffff";
      const s = m.size * (1.4 - a * 0.5);
      g.save(); g.translate(m.x, m.y); g.rotate(a * 2);
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const rr = i % 2 ? s * 0.34 : s;
        g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      g.closePath(); g.fill(); g.restore();
    }

    /* ---- stamped glyphs: a move's identity, left briefly in the world ---- */
    for (const gl of this.glyphs) {
      const a = gl.life / gl.max;
      const s = gl.size * (0.8 + (1 - a) * 0.5);
      g.save();
      g.translate(gl.x, gl.y);
      g.globalAlpha = a * 0.8;
      g.strokeStyle = gl.color; g.lineWidth = 2.4; g.lineCap = "round";
      if (gl.kind === "scale") {
        // Pivot: a tipping balance
        g.rotate(Math.sin(gl.rot * 2) * 0.3);
        g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();
        g.beginPath(); g.moveTo(0, -s * 0.5); g.lineTo(0, s * 0.3); g.stroke();
        g.beginPath(); g.arc(-s, s * 0.3, s * 0.3, 0, Math.PI); g.stroke();
        g.beginPath(); g.arc(s, s * 0.3, s * 0.3, 0, Math.PI); g.stroke();
      } else if (gl.kind === "orbit") {
        // Orbit: concentric rings at a tilt
        g.rotate(gl.rot);
        g.beginPath(); g.ellipse(0, 0, s, s * 0.38, 0, 0, 7); g.stroke();
        g.beginPath(); g.ellipse(0, 0, s * 0.6, s * 0.22, 0, 0, 7); g.stroke();
      } else if (gl.kind === "bolt") {
        // Zip: a chevron stack
        for (let i = 0; i < 3; i++) {
          g.globalAlpha = a * (0.8 - i * 0.2);
          g.beginPath();
          g.moveTo(-s * 0.6, -s * 0.4 + i * s * 0.4);
          g.lineTo(0, i * s * 0.4);
          g.lineTo(-s * 0.6, s * 0.4 + i * s * 0.4);
          g.stroke();
        }
      } else {
        // Bolder: an impact wedge
        g.beginPath();
        g.moveTo(-s, -s * 0.5); g.lineTo(s * 0.4, 0); g.lineTo(-s, s * 0.5);
        g.stroke();
      }
      g.restore();
    }
    g.restore();

    /* ---- cracks draw normally: they are in the surface, not glowing ---- */
    g.save();
    for (const c of this.cracks) {
      const a = c.life / c.max;
      g.globalAlpha = a * 0.75;
      g.lineCap = "round"; g.lineJoin = "round";
      g.strokeStyle = "#07050f"; g.lineWidth = c.w + 1.8;
      g.beginPath();
      g.moveTo(c.pts[0].x, c.pts[0].y);
      for (let i = 1; i < c.pts.length; i++) g.lineTo(c.pts[i].x, c.pts[i].y);
      g.stroke();
      g.strokeStyle = c.color; g.lineWidth = c.w;
      g.stroke();
    }
    g.restore();

    // damage numbers draw normally so they stay readable
    g.save();
    g.textAlign = "center";
    for (const t of this.texts) {
      const a = Math.min(1, t.life / t.max * 1.8);
      g.globalAlpha = a;
      g.font = t.small ? `900 12px ${FONT_MONO}`
                       : `900 ${20 + (1 - t.life / t.max) * 6}px ${FONT_DISPLAY}`;
      outlineText(g, t.text, t.x, t.y, t.color, t.small ? 4 : 5);
    }
    g.restore();
  },

  /** Kept for the menu screens, which do not run the post pass. */
  drawOverlay(g) {
    if (Settings.get("postFx") > 0) return;   // the post pass draws it instead
    if (this.flashAmt > 0.01) {
      g.save();
      g.globalAlpha = Math.min(0.75, this.flashAmt);
      g.fillStyle = this.flashCol || "#fff";
      g.fillRect(0, 0, W, H);
      g.restore();
    }
  },
};
