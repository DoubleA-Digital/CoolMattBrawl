/* ==========================================================================
   9c. ENTITY KINDS, WAVE 3B — what VOLT, WARDEN, MAGMA and JINX put into
       the world, plus the CPU habits that let them use it

     volt_link     one arc of chain lightning between two points (visual)
     volt_ball     Ball Lightning: a slow orb that zaps whoever is near it
     warden_wall   Bulwark: a wall foes can't pass and projectiles die on
     warden_cage   Lockdown: a box of bars around one foe that slams shut
     magma_glob    Lava Lob: an arcing glob that pools where it lands
     magma_pool    a burning puddle: standing in it sets you on fire
     magma_vent    Eruption: a rumble under a foe, then a column of lava
     jinx_card     a thrown playing card
     jinx_die      a giant die that drops on a spot, face = the roll

   Same contract as 08a: only x, y, r, life, max, dir, landed, storm and w
   reach online guests, so every draw() below reads nothing else (plus
   e.owner). Host-only fields (tgt, move, vx...) are used in update/end only.
   ========================================================================== */

/** The fighter in a given slot, for kinds that point at someone via e.w. */
function w3bBySlot(slot) {
  const m = Match.current;
  return m ? m.fighters.find(f => f.slot === slot) || null : null;
}

/** A jagged bolt from (x1,y1) to (x2,y2). The zigzag is seeded, so it
    crackles frame to frame without being pure static, and looks the same on
    every screen. */
function w3bArc(g, x1, y1, x2, y2, col, seed, w, jag) {
  const segs = 7, nx = -(y2 - y1), ny = x2 - x1, nl = Math.hypot(nx, ny) || 1;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, off = (i === 0 || i === segs) ? 0 : (hash(seed * 7.3 + i) - 0.5) * 2 * (jag || 14);
    pts.push(lerp(x1, x2, t) + nx / nl * off, lerp(y1, y2, t) + ny / nl * off);
  }
  const path = () => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); };
  g.save();
  g.lineJoin = "round"; g.lineCap = "round";
  g.shadowColor = col; g.shadowBlur = 16;
  path(); g.strokeStyle = col; g.lineWidth = w || 4; g.stroke();
  path(); g.strokeStyle = "#ffffff"; g.lineWidth = (w || 4) * 0.4; g.stroke();
  g.restore();
}

/** A die face: rounded white block with n pips. Pip layouts are symmetric
    enough that a mirrored (facing-left) fighter still reads correctly. */
const W3B_PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function w3bDie(g, x, y, s, n, pipCol, rot) {
  g.save(); g.translate(x, y); g.rotate(rot || 0);
  plateRect(g, -s, -s, s * 2, s * 2, s * 0.35, "#fbf7ee", { up: 0.15, down: 0.25, ink: Math.max(1.6, s * 0.18) });
  g.fillStyle = n === 6 ? "#e0283c" : (pipCol || INK);
  for (const [px, py] of W3B_PIPS[n] || []) { g.beginPath(); g.arc(px * s * 0.5, py * s * 0.5, s * 0.17, 0, 7); g.fill(); }
  g.restore();
}

/** A glob of lava falling onto the floor below (x, y) leaves a pool there. */
function magmaPool(owner, x, y, life) {
  const fl = Stage.floorBelow(x, y - 20);
  if (fl === null || fl - y > 260) return;
  Entities.add("magma_pool", owner, { x, y: fl, r: 8, w: 62, life: life || 180 });
}

/** Ignite a fighter on Magma's behalf. */
function magmaIgnite(by, o, t) {
  if (o.burnT <= 0) FX.damageText(o.x, o.y - 50, "BURNING", "#ffb04a");
  o.burnT = Math.max(o.burnT, t || 150); o.burnBy = by;
}

Object.assign(KINDS, {

  /* ---- VOLT: a single arc. x,y is where it starts; w is the target's
         slot + 1, so it stays stuck to them for its few frames of life. ---- */
  volt_link: {
    update() { return false; },
    draw(g, e, c) {
      const t = w3bBySlot(e.w - 1);
      if (!t) return;
      const k = clamp(e.life / e.max, 0, 1), big = e.r > 0;
      g.save(); g.globalAlpha = 0.4 + 0.6 * k;
      w3bArc(g, e.x, e.y, t.x, t.y, c, e.life, big ? 6 : 3.6, big ? 22 : 14);
      w3bArc(g, e.x, e.y, t.x, t.y, e.owner.ch.accent, e.life + 31, big ? 2.4 : 1.6, big ? 30 : 18);
      g.restore();
    },
  },

  /* ---- VOLT: Ball Lightning. Drifts forward, bobbing; every 20 frames it
         zaps every foe within w of it. ---- */
  volt_ball: {
    update(e, fighters) {
      e.x += e.vx;
      e.y = e.y0 + Math.sin(e.life * 0.09) * 7;
      if (e.life % 3 === 0) FX.spark(e.x + rnd(-14, 14), e.y + rnd(-14, 14), e.owner.ch.accent);
      if (e.life % 20 === 0) {
        let zapped = false;
        for (const f of fighters) {
          if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
          if (dist(e.x, e.y, f.x, f.y) > e.w + f.ch.hurt) continue;
          Entities.add("volt_link", e.owner, { x: e.x, y: e.y, r: 0, w: f.slot + 1, life: 8 });
          Combat.land(e.owner, f, e.move, f.x, f.y);
          zapped = true;
        }
        if (zapped) Snd.tone(1900, 0.06, "sawtooth", 0.08, 600);
      }
      return e.x < -300 || e.x > CFG.world.w + 300;
    },
    end(e) { FX.burst(e.x, e.y, 14, e.owner.ch.accent, 5); Snd.tone(900, 0.1, "square", 0.06, 200); },
    draw(g, e, c) {
      const ac = e.owner.ch.accent, pulse = 1 + Math.sin(e.life * 0.6) * 0.08;
      warnCircle(g, e.x, e.y, e.w, c, 0.12 + (e.life % 20 < 4 ? 0.2 : 0));
      g.save(); g.translate(e.x, e.y);
      g.shadowColor = c; g.shadowBlur = 26;
      g.fillStyle = hexA(c, 0.55); g.beginPath(); g.arc(0, 0, e.r * pulse, 0, 7); g.fill();
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0, 0, e.r * 0.42, 0, 7); g.fill();
      g.restore();
      // tendrils licking out of the core
      for (let i = 0; i < 4; i++) {
        const a = hash(e.life * 3 + i) * 7, L = e.r * (1.4 + hash(e.life + i * 9));
        w3bArc(g, e.x, e.y, e.x + Math.cos(a) * L, e.y + Math.sin(a) * L, ac, e.life + i * 5, 1.8, 6);
      }
    },
  },

  /* ---- WARDEN: Bulwark. x is the wall's centre, y its foot, r its height,
         w its half-thickness. Foes are put back on the side they came from
         (flying ones bounce off it); enemy projectiles that touch it die. ---- */
  warden_wall: {
    update(e, fighters) {
      if (e.owner.v) e.owner.v.wall = 1;
      const top = e.y - e.r;
      for (const f of fighters) {
        if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD) continue;
        if (f.y + f.h * 0.5 < top || f.y - f.h * 0.5 > e.y) continue;
        const hw = e.w + f.ch.hurt * 0.7;
        if (Math.abs(f.x - e.x) >= hw) continue;
        const side = Math.sign(f.px - e.x) || Math.sign(f.x - e.x) || 1;
        f.x = e.x + side * hw;
        if (Math.sign(f.vx) === -side) {
          if (f.state === ST.HITSTUN && Math.abs(f.vx) > 4) {
            // launched into it: a wall bounce
            f.vx = -f.vx * 0.45;
            FX.burst(e.x, f.y, 12, "#d8dde8", 5); FX.shake(6);
            FX.damageText(f.x, f.y - 50, "WALLED", e.owner.ch.accent);
            Snd.tone(140, 0.12, "square", 0.12, 70);
          } else f.vx = 0;
        }
      }
      for (const p of Entities.list) {
        if (p === e || !p.owner || allies(p.owner, e.owner) || p.life <= 1) continue;
        if (p.kind === "payload" || p.kind.indexOf("warden_") === 0) continue;
        const sp = Math.hypot(p.vx || 0, p.vy || 0);
        const flying = p.kind === "wave" || p.kind === "orb" ||
                       (!p.stuck && !(p.landed && p.kind === "bomb") && sp > 1);
        if (!flying) continue;
        if (Math.abs(p.x - e.x) > e.w + (p.r || 10) || p.y < top - 10 || p.y > e.y + 10) continue;
        p.dud = true; p.life = 1;
        FX.burst(p.x, p.y, 12, e.owner.ch.accent, 5);
        FX.ring(p.x, p.y, 6, 40, "#ffffff", 2);
        Snd.tone(600, 0.06, "square", 0.1, 240);
      }
      return false;
    },
    end(e) {
      if (e.owner.v) e.owner.v.wall = 0;
      FX.burst(e.x, e.y - e.r * 0.5, 22, "#8e9bb3", 6);
      FX.dustLine(e.x, e.y, 60, "#b9b6d8");
      Snd.noise(0.25, 0.2, 500, 0.8, "lowpass");
    },
    draw(g, e, c) {
      const grow = clamp((e.max - e.life) / 8, 0, 1), fade = clamp(e.life / 14, 0, 1);
      const h = e.r * grow, x0 = e.x - e.w;
      g.save(); g.globalCompositeOperation = "source-over"; g.globalAlpha = fade;
      // stacked stone blocks with a steel cap
      const rows = Math.max(1, Math.round(h / 22)), bh = h / rows;
      for (let i = 0; i < rows; i++) {
        const y = e.y - (i + 1) * bh;
        plateRect(g, x0, y, e.w * 2, bh, 2, i % 2 ? "#6d7891" : "#7c88a2", { up: 0.2, down: 0.35, ink: 2.4, rimA: 0.3 });
        g.strokeStyle = hexA(INK, 0.5); g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(e.x + (i % 2 ? -3 : 4), y + 2); g.lineTo(e.x + (i % 2 ? -3 : 4), y + bh - 2); g.stroke();
      }
      plateRect(g, x0 - 3, e.y - h - 6, e.w * 2 + 6, 8, 2, "#c4ccdb", { up: 0.4, ink: 2.4 });
      // the warden's sigil glowing on its face
      g.globalCompositeOperation = "lighter";
      lens(g, () => roundRect(g, e.x - 3, e.y - h * 0.62, 6, 14, 3), e.owner.ch.accent, e.owner.ch.accent, 12);
      g.restore();
    },
  },

  /* ---- WARDEN: Lockdown. A square cage of half-size w around one foe. It
         holds them inside, squeezes in for its last 24 frames, then slams. ---- */
  warden_cage: {
    update(e) {
      const t = e.tgt;
      if (!t || !t.alive || t.state === ST.DEAD) { e.dud = true; return true; }
      if (e.life < 24) e.w = lerp(30, 66, e.life / 24);
      const ix = Math.max(4, e.w - t.ch.hurt * 0.6), iy = Math.max(4, e.w - t.h * 0.5 + 4);
      if (Math.abs(t.x - e.x) > ix) { t.x = e.x + Math.sign(t.x - e.x) * ix; t.vx *= -0.3; }
      if (t.y < e.y - iy) { t.y = e.y - iy; t.vy = Math.max(t.vy, 0); }
      if (t.y > e.y + iy) { t.y = e.y + iy; t.vy = Math.min(t.vy, 0); }
      if (e.life % 10 === 0) FX.spark(e.x + rnd(-e.w, e.w), e.y + rnd(-e.w, e.w), e.owner.ch.accent);
      return false;
    },
    end(e) {
      if (e.dud) return;
      const t = e.tgt;
      FX.ring(e.x, e.y, 10, 150, "#ffffff", 5);
      FX.burst(e.x, e.y, 34, e.owner.ch.accent, 10);
      FX.flash(e.owner.ch.accent, 0.25); FX.shake(24); FX.punch(0.6);
      Snd.superHit();
      if (!t.intangible()) Combat.land(e.owner, t, e.move, t.x, t.y);
    },
    draw(g, e, c) {
      const ac = e.owner.ch.accent, k = 1 - e.life / e.max, s = e.w;
      g.save(); g.globalCompositeOperation = "source-over";
      g.globalAlpha = 0.25; g.fillStyle = c; g.fillRect(e.x - s, e.y - s, s * 2, s * 2);
      g.globalAlpha = 1;
      // bars
      for (let i = 0; i <= 4; i++) {
        const x = e.x - s + i * (s / 2);
        plateRect(g, x - 2.5, e.y - s, 5, s * 2, 2, "#c4ccdb", { up: 0.3, ink: 1.8, rimA: 0.3 });
      }
      plateRect(g, e.x - s - 4, e.y - s - 6, s * 2 + 8, 8, 2, "#7c88a2", { up: 0.4, ink: 2.4 });
      plateRect(g, e.x - s - 4, e.y + s - 2, s * 2 + 8, 8, 2, "#7c88a2", { up: 0.3, ink: 2.4 });
      // a padlock that heats up as the slam nears
      g.globalCompositeOperation = "lighter";
      lens(g, () => { g.beginPath(); g.arc(e.x, e.y - s - 2, 5 + k * 3, 0, 7); }, ac, k > 0.75 ? "#ffffff" : ac, 10 + k * 18);
      g.restore();
    },
  },

  /* ---- MAGMA: Lava Lob. Arcs; a foe it touches is burned, and wherever it
         ends up, a pool of lava is left on the floor below. ---- */
  magma_glob: {
    update(e, fighters) {
      e.vy += 0.42; e.x += e.vx; e.y += e.vy;
      if (e.life % 2 === 0) FX.spark(e.x, e.y, pick(["#ff7a1a", "#ffd23d"]));
      if (Entities._touch(e, fighters, true)) { magmaPool(e.owner, e.x, e.y, 150); return true; }
      if (e.vy > 0) {
        const fl = Stage.floorBelow(e.x, e.y - e.vy);
        if (fl !== null && e.y + e.r >= fl) { magmaPool(e.owner, e.x, fl); FX.burst(e.x, fl, 14, "#ff7a1a", 5); Snd.noise(0.2, 0.18, 400, 0.8); return true; }
      }
      return e.y > CFG.world.h + 300;
    },
    draw(g, e, c) {
      g.save(); g.translate(e.x, e.y);
      g.shadowColor = "#ff7a1a"; g.shadowBlur = 22;
      const wob = Math.sin(e.life * 0.5) * 1.5;
      g.fillStyle = "#ff5a14"; g.beginPath(); g.ellipse(0, 0, e.r + wob, e.r - wob, e.life * 0.2, 0, 7); g.fill();
      g.fillStyle = "#ffd36b"; g.beginPath(); g.arc(-2, -2, e.r * 0.5, 0, 7); g.fill();
      g.restore();
    },
  },

  /* ---- MAGMA: a burning puddle, half-width w, sitting on the floor at y. ---- */
  magma_pool: {
    update(e, fighters) {
      for (const f of fighters) {
        if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
        if (Math.abs(f.x - e.x) > e.w + f.ch.hurt * 0.3 || Math.abs(f.feetY - e.y) > 14) continue;
        magmaIgnite(e.owner, f, 120);
      }
      if (e.life % 5 === 0) FX.spark(e.x + rnd(-e.w, e.w), e.y - rnd(2, 14), pick(["#ff7a1a", "#ffd23d"]));
      return false;
    },
    draw(g, e, c) {
      const grow = clamp((e.max - e.life) / 10, 0, 1), fade = clamp(e.life / 30, 0, 1);
      const w = e.w * grow;
      g.save(); g.globalAlpha = fade;
      const q = g.createRadialGradient(e.x, e.y, 2, e.x, e.y, Math.max(4, w));
      q.addColorStop(0, "rgba(255,226,120,0.95)"); q.addColorStop(0.5, "rgba(255,90,20,0.75)"); q.addColorStop(1, "rgba(120,20,0,0)");
      g.fillStyle = q; g.beginPath(); g.ellipse(e.x, e.y - 2, Math.max(4, w), 9, 0, 0, 7); g.fill();
      // bubbles that rise and pop
      g.fillStyle = "#ffd36b";
      for (let i = 0; i < 5; i++) {
        const t = ((e.life * 0.03 + hash(i)) % 1), bx = e.x + (hash(i + 4) - 0.5) * w * 1.6;
        g.globalAlpha = fade * (1 - t);
        g.beginPath(); g.arc(bx, e.y - 3 - t * 16, 2 + t * 2, 0, 7); g.fill();
      }
      g.restore();
    },
  },

  /* ---- MAGMA: Eruption vent. Tracks its foe while the floor cracks, locks
         for its last 14 frames, then a column of lava hits everything over it.
         Burning foes take the hotter move. ---- */
  magma_vent: {
    update(e) {
      const t = e.tgt;
      if (e.life > 14 && t && t.alive && t.state !== ST.DEAD) {
        const fl = Stage.floorBelow(t.x, t.y);
        if (fl !== null) { e.x = t.x; e.y = fl; }
      }
      if (e.life % 3 === 0) FX.spark(e.x + rnd(-e.w, e.w), e.y - rnd(0, 10), "#ffb04a");
      if (e.life % 8 === 0) Snd.noise(0.08, 0.1, 200, 0.8);
      return false;
    },
    end(e, fighters) {
      FX.blade(e.x, e.y, -Math.PI / 2, 20, 230, 0.35, "#ff7a1a", { w: 26, life: 20 });
      FX.blade(e.x, e.y, -Math.PI / 2, 10, 200, 0.2, "#ffe27a", { w: 10, life: 16 });
      FX.burst(e.x, e.y - 40, 34, "#ff5a14", 11);
      FX.shake(18); Snd.bigHit();
      for (const f of fighters) {
        if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
        if (Math.abs(f.x - e.x) > e.w + f.ch.hurt || f.y < e.y - 250 || f.y > e.y + 20) continue;
        const hot = f.burnT > 0;
        Combat.land(e.owner, f, hot ? e.hot : e.move, f.x, f.y);
        if (hot) FX.damageText(f.x, f.y - 66, "MELTDOWN", "#ffe27a");
        magmaIgnite(e.owner, f, 180);
      }
      magmaPool(e.owner, e.x, e.y - 4, 90);
    },
    draw(g, e, c) {
      const k = 1 - e.life / e.max;
      g.save();
      g.strokeStyle = "#ff7a1a"; g.lineWidth = 2 + k * 3; g.shadowColor = "#ff5a14"; g.shadowBlur = 14 + k * 20;
      g.beginPath();
      for (let i = 0; i <= 8; i++) g.lineTo(e.x - e.w + i * e.w / 4, e.y - 2 - (i % 2) * 4 * k);
      g.stroke();
      g.globalAlpha = 0.15 + k * 0.4; g.fillStyle = "#ff5a14";
      g.beginPath(); g.ellipse(e.x, e.y - 3, e.w, 6 + k * 8, 0, 0, 7); g.fill();
      g.restore();
    },
  },

  /* ---- JINX: a playing card, thrown flat and spinning. ---- */
  jinx_card: {
    update(e, fighters) {
      if (e.life % 3 === 0) FX.spark(e.x - e.dir * 8, e.y, e.owner.ch.accent);
      return flyOff(e) || Entities._touch(e, fighters, true);
    },
    draw(g, e, c) {
      g.save(); g.globalCompositeOperation = "source-over";
      g.translate(e.x, e.y); g.rotate(e.life * 0.45 * (e.dir || 1)); g.scale(1, 0.7 + 0.3 * Math.cos(e.life * 0.3));
      plateRect(g, -7, -10, 14, 20, 2.5, "#fbf7ee", { up: 0.1, ink: 1.8, rimA: 0.2 });
      g.fillStyle = "#e0283c";
      poly(g, [0, -5, 4, 0, 0, 5, -4, 0]); g.fill();
      g.restore();
    },
  },

  /* ---- JINX: a giant die that drops onto a spot and blasts on impact.
         w is the face it shows; r its half-size. ty (the landing point) is
         host-only, so on guests the warning circle just follows the die. ---- */
  jinx_die: {
    update(e, fighters) {
      e.vy += 1.1; e.y += e.vy;
      if (e.y >= e.ty) { e.y = e.ty; return true; }
      return e.y > CFG.world.h + 300;
    },
    end(e, fighters) {
      if (e.y > CFG.world.h + 200) return;
      const big = e.w === 6;
      FX.ring(e.x, e.y, 10, big ? 150 : 100, big ? "#ffe14d" : "#ffffff", big ? 6 : 4);
      FX.burst(e.x, e.y, big ? 34 : 18, big ? "#ffe14d" : e.owner.ch.color, big ? 10 : 6);
      FX.shake(big ? 18 : 10);
      Snd.bigHit();
      Entities.blast(e.owner, e.x, e.y, e.r + (big ? 58 : 40), e.move, fighters);
    },
    draw(g, e, c) {
      const fall = clamp(1 - e.life / e.max, 0, 1);
      warnCircle(g, e.x, e.ty || e.y, e.r + 30, c, 0.15 + fall * 0.3);
      g.save(); g.globalCompositeOperation = "source-over";
      w3bDie(g, e.x, e.y, e.r, e.w, INK, e.life * 0.25);
      g.restore();
    },
  },
});

/* ---------------------------------------------------------------- CPU
   CPU.think only knows the specials of the fighters it was written with.
   This wraps it (other waves may wrap it too — each layer just adds) so a
   CPU playing one of these four fires its special and super on sensible
   cues instead of never. It only adds a button press; it never overrides
   what the base brain chose to do. */
const W3B_CPU = {
  VOLT:   (f, t, d) => ({ sp: d.facing && d.adx < 380 && d.ady < 90, su: true }),
  WARDEN: (f, t, d) => ({ sp: d.facing && d.adx > 50 && d.adx < 200 && d.ady < 60 && f.grounded, su: d.bd < 520 }),
  MAGMA:  (f, t, d) => ({ sp: d.facing && d.adx > 110 && d.adx < 420, su: Combat.foes(f).some(o => o.grounded) }),
  JINX:   (f, t, d) => ({ sp: d.adx < 320 && d.ady < 80, su: d.bd < 700 }),
};
(function () {
  const baseThink = CPU.think;
  CPU.think = function (f, match) {
    const inp = baseThink.call(this, f, match);
    const brain = W3B_CPU[f.ch.id], ai = f._ai;
    if (!brain || !ai || f.state === ST.ATTACK) return inp;
    const cur = ai.cur;
    if (cur.super || cur.special || cur.shield || cur.up) return inp;
    const t = Combat.nearestFoe(f);
    if (!t || t.intangible()) return inp;
    // never while recovering: the base brain owns that
    const onStage = f.groundSeg !== null ||
      (Math.abs(f.x - Stage.pivot.x) < Math.abs(Stage.def.layout[0].x2) && f.y < Stage.pivot.y);
    if (!onStage) return inp;
    const dx = t.x - f.x;
    const d = { adx: Math.abs(dx), ady: Math.abs(t.y - f.y), bd: dist(f.x, f.y, t.x, t.y),
                facing: Math.sign(dx) === f.facing };
    const want = brain(f, t, d);
    if (f.meterFull && want.su && Math.random() < CFG.cpu.superChance) cur.super = true;
    else if (f.specialCD <= 0 && want.sp && Math.random() < 0.014) cur.special = true;
    return inp;
  };
})();
