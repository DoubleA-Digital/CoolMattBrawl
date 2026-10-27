/* ==========================================================================
   9b. ENTITY KINDS — what the wave 3A fighters (04b_wave3a.js) put into the
       world. Same contract as 08a: { update(e, fighters) -> gone?,
       draw(g, e, color), end?(e, fighters) }, and every draw() derives its
       look from the fields the netcode ships (x, y, r, life, max, dir,
       landed, storm, w) plus e.owner, so guests see the same thing.
   ========================================================================== */

/** Prism's Spectrum: which way the beam points right now. It starts behind
    her, a little below level, swings over the top, and ends a little below
    level in front — read from life/max/dir only, so guests agree. */
function prismSweepAng(e) {
  const k = ease(clamp(1 - e.life / (e.max || 1), 0, 1));
  const a = lerp(-Math.PI - 0.2, 0.2, k);
  return (e.dir || 1) >= 0 ? a : Math.PI - a;
}

/** Distance from point (px, py) to the segment (x1, y1)-(x2, y2). */
function prismSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / L2, 0, 1);
  return dist(px, py, x1 + dx * t, y1 + dy * t);
}

Object.assign(KINDS, {

  /* ---- MAGNA: the filings swarming a magnetised foe. It rides them for as
         long as her mark lasts and goes the moment it is spent or stolen. ---- */
  magna_mark: {
    update(e) {
      const t = e.tgt;
      if (!t || !t.alive || t.state === ST.DEAD || t.markBy !== e.owner || t.markT <= 0) return true;
      e.x = t.x; e.y = t.y; e.life = t.markT + 1;
      return false;
    },
    draw(g, e, c) {
      const fade = clamp(e.life / 40, 0, 1);
      g.save(); g.globalAlpha = 0.85 * fade;
      for (let i = 0; i < 7; i++) {
        const an = e.life * 0.09 + i / 7 * Math.PI * 2, rr = 30 + Math.sin(e.life * 0.13 + i) * 4;
        g.save(); g.translate(e.x + Math.cos(an) * rr, e.y + Math.sin(an) * rr * 0.6); g.rotate(an + Math.PI / 2);
        g.fillStyle = i % 2 ? c : "#cfd8e6"; g.fillRect(-3.5, -1, 7, 2);
        g.restore();
      }
      // a little horseshoe over their head, poles down
      g.translate(e.x, e.y - 50);
      g.lineWidth = 3.4; g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = 12;
      g.beginPath(); g.moveTo(-6, 5); g.lineTo(-6, 0); g.arc(0, 0, 6, Math.PI, Math.PI * 2); g.lineTo(6, 5); g.stroke();
      g.fillStyle = "#ffffff"; g.fillRect(-7.7, 4, 3.4, 3); g.fillRect(4.3, 4, 3.4, 3);
      g.restore();
    },
  },

  /* ---- GLITCH: the afterimage a blink leaves. Purely visual — torn
         horizontal slices of her, split into red and blue, that scatter
         further apart as it fades. ---- */
  glitch_ghost: {
    update() { return false; },
    draw(g, e, c) {
      const sz = e.owner.ch.size, w = sz.w, h = sz.h, k = clamp(e.life / (e.max || 1), 0, 1);
      const n = 7, sh = h / n;
      g.save();
      for (let i = 0; i < n; i++) {
        const j = (hash(i * 7.3 + e.life * 0.37) - 0.5) * 22 * (1.2 - k);
        const y = e.y - h / 2 + i * sh;
        g.globalAlpha = 0.5 * k;
        g.fillStyle = "#ff2b4a"; g.fillRect(e.x - w / 2 + j - 3, y, w, sh - 1);
        g.fillStyle = "#2bd8ff"; g.fillRect(e.x - w / 2 - j + 3, y, w, sh - 1);
        g.globalAlpha = 0.6 * k;
        g.fillStyle = c; g.fillRect(e.x - w / 2 + j * 0.3, y + 1, w, sh - 3);
      }
      g.restore();
    },
  },

  /* ---- GRUDGE: Bottle It Up. While he braces it is the barrier you can
         see; once he has bottled a hit it turns into the steam coming off him
         until he spends it. It is also the watchdog that lets go of his brace
         if anything (a grab, a KO) takes him out of the move early. ---- */
  grudge_jar: {
    update(e) {
      const o = e.owner;
      if (e.dud) return true;
      e.x = o.x; e.y = o.y;
      if (!e.landed) {
        const a = o.attack;
        const bracing = o.state === ST.ATTACK && a && a.kind === "special" &&
                        a.t < a.data.startup + a.data.active;
        if (bracing) return false;
        o.pinned = false;
        if (!(o.v.bt > 0)) return true;
        e.landed = true; e.life = e.max = 36000;
      }
      if (!o.alive || o.state === ST.DEAD || o.v.sk !== o.stocks) { o.v.bt = 0; return true; }
      return !(o.v.bt > 0);
    },
    draw(g, e, c) {
      g.save();
      if (!e.landed) {
        const pulse = 1 + Math.sin(e.life * 0.5) * 0.04;
        g.translate(e.x, e.y); g.scale(pulse, pulse);
        g.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2 + Math.PI / 8;
          g.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r * 1.15);
        }
        g.closePath();
        g.globalAlpha = 0.14; g.fillStyle = "#ff9a3d"; g.fill();
        g.globalAlpha = 0.85; g.strokeStyle = "#ffb347"; g.lineWidth = 3;
        g.shadowColor = "#ff7a1a"; g.shadowBlur = 16; g.stroke();
      } else {
        for (let i = 0; i < 3; i++) {
          const t = (e.life * 0.03 + i / 3) % 1;
          g.globalAlpha = 0.5 * (1 - t);
          g.fillStyle = i % 2 ? "#ffb347" : "#ff7a1a";
          g.beginPath(); g.arc(e.x + Math.sin(t * 6 + i) * 8, e.y - 40 - t * 30, 3 + t * 5, 0, 7); g.fill();
        }
      }
      g.restore();
    },
  },

  /* ---- PRISM: Refract. A beam that travels diagonally down, bounces once
         off the first floor or platform it meets, and carries on upward. It
         pierces: everyone it passes through is hit once. ---- */
  prism_ray: {
    update(e, fighters) {
      e.x += e.vx; e.y += e.vy;
      if (!e.landed && e.vy > 0) {
        const fl = Stage.floorBelow(e.x, e.y - e.vy);
        if (fl !== null && e.y >= fl - 2) {
          e.y = fl - 2; e.vy = -e.vy; e.landed = true;
          FX.ring(e.x, fl, 4, 46, "#ffffff", 2);
          FX.burst(e.x, fl, 10, e.owner.ch.color, 4);
          Snd.tone(1800, 0.06, "triangle", 0.08, 2600);
        }
      }
      if (e.life % 2 === 0) FX.spark(e.x, e.y, pick(PRISM_RAINBOW));
      Entities._touch(e, fighters, false);
      return e.x < -300 || e.x > CFG.world.w + 300 || e.y < -400 || e.y > CFG.world.h + 300;
    },
    draw(g, e, c) {
      // the heading is fixed before and after the bounce, so dir + landed give it
      const ux = 12 * (e.dir || 1), uy = e.landed ? -5.5 : 5.5, n = Math.hypot(ux, uy);
      const dx = ux / n, dy = uy / n, L = Math.min(70, (e.max - e.life) * 14 + 10);
      g.save(); g.lineCap = "round";
      // dispersion: the colours fan apart toward the tail
      g.lineWidth = 3; g.globalAlpha = 0.7;
      for (let i = 0; i < PRISM_RAINBOW.length; i++) {
        const off = (i - 2.5) * 2.4;
        g.strokeStyle = PRISM_RAINBOW[i];
        g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x - dx * L - dy * off, e.y - dy * L + dx * off); g.stroke();
      }
      g.globalAlpha = 1; g.strokeStyle = "#ffffff"; g.lineWidth = 3.4; g.shadowColor = c; g.shadowBlur = 16;
      g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x - dx * L * 0.6, e.y - dy * L * 0.6); g.stroke();
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(e.x, e.y, 4.5, 0, 7); g.fill();
      g.restore();
    },
  },

  /* ---- PRISM: Spectrum. A beam the width of the stage, anchored on her,
         sweeping over the top from behind her to in front. Each foe it
         touches is hit once. It ends if her super is cut short. ---- */
  prism_sweep: {
    update(e, fighters) {
      const o = e.owner;
      if (!o.alive || o.state === ST.DEAD || !o.attack || o.attack.kind !== "super") return true;
      e.x = o.x; e.y = o.y - 14;
      const an = prismSweepAng(e), x2 = e.x + Math.cos(an) * e.w, y2 = e.y + Math.sin(an) * e.w;
      for (const f of fighters) {
        if (allies(f, o) || !f.alive || f.state === ST.DEAD || f.intangible() || e.hitIds.includes(f.slot)) continue;
        if (prismSegDist(f.x, f.y, e.x, e.y, x2, y2) < e.r + f.ch.hurt) {
          e.hitIds.push(f.slot);
          Combat.land(o, f, e.move, f.x, f.y);
        }
      }
      if (e.life % 2 === 0) {
        const t = rnd(0.1, 0.9);
        FX.spark(lerp(e.x, x2, t), lerp(e.y, y2, t), pick(PRISM_RAINBOW));
      }
      return false;
    },
    draw(g, e, c) {
      const an = prismSweepAng(e), L = e.w || 1100;
      const fade = clamp(Math.min((e.max - e.life) / 6, e.life / 6), 0, 1);
      g.save(); g.translate(e.x, e.y); g.rotate(an); g.globalAlpha = fade;
      // a wide soft glow, the six bands fanning out, and a white-hot core
      g.fillStyle = hexA(c, 0.16);
      poly(g, [0, -6, L, -e.r * 1.8, L, e.r * 1.8, 0, 6]); g.fill();
      for (let i = 0; i < PRISM_RAINBOW.length; i++) {
        const o = (i - 2.5) * 14;
        g.fillStyle = hexA(PRISM_RAINBOW[i], 0.5);
        poly(g, [0, -1.5, L, o - 7, L, o + 7, 0, 1.5]); g.fill();
      }
      g.shadowColor = c; g.shadowBlur = 22;
      g.fillStyle = hexA("#ffffff", 0.85);
      poly(g, [0, -5, L, -e.r * 0.5, L, e.r * 0.5, 0, 5]); g.fill();
      // the flare where it leaves her hand
      g.beginPath(); g.arc(0, 0, 12 + Math.sin(e.life * 0.6) * 3, 0, 7); g.fill();
      g.restore();
    },
  },
});
