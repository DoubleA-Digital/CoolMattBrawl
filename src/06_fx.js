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
  shakeMag: 0, shakeX: 0, shakeY: 0,
  pause: 0,
  flashCol: null, flashAmt: 0,
  bannerText: "", bannerTimer: 0, bannerColor: "#fff",

  cam: {
    x: 800, y: 440, zoom: 0.9,
    px: 800, py: 440, pz: 0.9,   // previous step, for render interpolation
    tz: 0.9,
  },

  reset() {
    this.parts.length = 0; this.rings.length = 0; this.marks.length = 0;
    this.streaks.length = 0; this.texts.length = 0;
    this.shakeMag = 0; this.pause = 0; this.bannerTimer = 0;
    this.flashAmt = 0;
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
  banner(text, color) {
    if (!text) return;
    this.bannerText = text; this.bannerTimer = 72; this.bannerColor = color || "#fff";
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
  hitmark(x, y, dmg) { this.marks.push({ x, y, life: 11, max: 11, size: 14 + dmg * 2.6 }); },
  /** Floating damage number at the point of impact. */
  damageText(x, y, dmg, color) {
    this.texts.push({ x, y, vy: -1.2, life: 42, max: 42,
      text: Math.round(dmg).toString(), color });
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
  drawWorld(g) {
    g.save();
    g.globalCompositeOperation = "lighter";

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
    }
    for (const p of this.parts) {
      const a = p.life / p.max;
      g.globalAlpha = Math.min(1, a * 1.4); g.fillStyle = p.color;
      g.beginPath(); g.arc(p.x, p.y, p.size * (0.4 + a * 0.8), 0, 7); g.fill();
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
    g.restore();

    // damage numbers draw normally so they stay readable
    g.save();
    g.textAlign = "center";
    for (const t of this.texts) {
      const a = Math.min(1, t.life / t.max * 1.8);
      g.globalAlpha = a;
      g.font = `900 ${20 + (1 - t.life / t.max) * 6}px ${FONT_DISPLAY}`;
      outlineText(g, t.text, t.x, t.y, t.color, 5);
    }
    g.restore();
  },

  drawOverlay(g) {
    if (this.flashAmt > 0.01) {
      g.save();
      g.globalAlpha = Math.min(0.75, this.flashAmt);
      g.fillStyle = this.flashCol || "#fff";
      g.fillRect(0, 0, W, H);
      g.restore();
    }
  },
};
