/* ==========================================================================
   9e. ENTITY KINDS (wave 3d) — what NOVA, HOOK and TWIN put into the world,
       plus the CPU's notes on how to use their specials

   Same contract as 08a: { update(e, fighters) -> gone?, draw(g, e, color),
   end?(e, fighters) }, and every draw() works from the fields the netcode
   ships (x, y, r, life, max, dir, landed, w) plus e.owner.
   ========================================================================== */

/** Twin's clone hits with a weaker copy of whatever move she threw. One copy
    per move object, so stale-move tracking sees a stable name. */
const TWIN_ECHO_MOVES = new WeakMap();
function twinEchoMove(m) {
  let e = TWIN_ECHO_MOVES.get(m);
  if (!e) {
    e = hitMove(m.name, { dmg: m.dmg * 0.6, base: (m.base || 2) * 0.8, scale: (m.scale || 0.5) * 0.85, angle: m.angle });
    TWIN_ECHO_MOVES.set(m, e);
  }
  return e;
}

/** Draw one of Twin's mirror images: her own art, faded, with a shimmer.
    It borrows her current swing when she is attacking (guests rebuild her
    attack from the snapshot too), so the copy visibly moves with her. */
function twinMirrorDraw(g, e, alpha) {
  const o = e.owner, atk = o.state === ST.ATTACK && o.attack &&
    (o.attack.kind === "light" || o.attack.kind === "heavy") ? o.attack : null;
  g.save(); g.globalCompositeOperation = "source-over";
  g.globalAlpha = alpha * (0.8 + 0.2 * Math.sin(e.life * 0.3));
  g.translate(e.x + Math.sin(e.life * 0.7) * 1.2, e.y); g.scale(e.dir || 1, 1);
  o.ch.draw(g, {
    time: e.life, runPhase: 0, running: false, air: false, vx: 0, vy: 0, state: ST.IDLE, flash: false,
    atkPhase: atk ? clamp(atk.t / Math.max(1, atk.total), 0, 1) : -1, atkKind: atk ? atk.kind : null,
    atkT: atk ? atk.t : 0, atkStartup: atk ? atk.data.startup : 0, atkActive: atk ? atk.data.active : 0,
    atkTotal: atk ? atk.total : 0, move: atk ? atk.data : null, v: { clone: 1 }, percent: 0,
  });
  g.restore();
  // scanlines across the image, so it reads as a reflection, not a fighter
  g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = alpha * 0.5;
  g.fillStyle = o.ch.accent;
  for (let i = 0; i < 4; i++) {
    const yy = e.y - 30 + ((e.life * 1.6 + i * 16) % 60);
    g.fillRect(e.x - 14, yy, 28, 1.2);
  }
  g.restore();
}

Object.assign(KINDS, {

  /* ---- NOVA: Star Charge. Its size is its charge (r ships to guests), so
         a full comet looks like one everywhere. ---- */
  nova_star: {
    update(e, fighters) {
      if (e.life % 2 === 0) FX.spark(e.x - e.dir * e.r, e.y + rnd(-e.r, e.r) * 0.5, e.r > 15 ? "#ffffff" : e.owner.ch.color);
      return flyOff(e) || Entities._touch(e, fighters, true);
    },
    end(e) {
      FX.burst(e.x, e.y, 6 + Math.round(e.r), e.owner.ch.color, 3 + e.r * 0.2);
      if (e.r > 15) FX.ring(e.x, e.y, 6, 70, "#ffffff", 3);
    },
    draw(g, e, c) {
      g.save(); g.translate(e.x, e.y);
      // comet tail, longer the bigger the star
      const tl = e.r * 3;
      const q = g.createLinearGradient(0, 0, -e.dir * tl, 0);
      q.addColorStop(0, hexA(c, 0.7)); q.addColorStop(1, hexA(c, 0));
      g.fillStyle = q;
      poly(g, [0, -e.r * 0.7, -(e.dir || 1) * tl, 0, 0, e.r * 0.7]); g.fill();
      g.rotate(e.life * 0.2);
      g.shadowColor = c; g.shadowBlur = 14 + e.r;
      g.fillStyle = c; w3dStarPath(g, e.r, e.r * 0.46, 0); g.fill();
      g.fillStyle = "#ffffff"; w3dStarPath(g, e.r * 0.55, e.r * 0.26, 0); g.fill();
      g.restore();
    },
  },

  /* ---- NOVA: Supernova's blast ring. Expands once, hits each foe once as
         it passes them. ---- */
  nova_ring: {
    update(e, fighters) {
      e.r = e.maxR * (1 - e.life / e.max) + 10;
      for (const f of fighters) {
        if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
        if (e.hitIds.includes(f.slot)) continue;
        if (Math.abs(dist(e.x, e.y, f.x, f.y) - e.r) < f.ch.hurt + 14) {
          e.hitIds.push(f.slot);
          Combat.land(e.owner, f, e.move, f.x, f.y);
        }
      }
      if (e.life % 2 === 0) {
        const an = Math.random() * 7;
        FX.spark(e.x + Math.cos(an) * e.r, e.y + Math.sin(an) * e.r, pick(["#ffffff", e.owner.ch.color]));
      }
      return false;
    },
    draw(g, e, c) {
      const a = clamp(e.life / e.max, 0, 1);
      g.save(); g.globalAlpha = a;
      g.strokeStyle = c; g.lineWidth = 10 * a + 3; g.shadowColor = c; g.shadowBlur = 26;
      g.beginPath(); g.arc(e.x, e.y, e.r, 0, 7); g.stroke();
      g.strokeStyle = "#ffffff"; g.lineWidth = 2;
      g.beginPath(); g.arc(e.x, e.y, Math.max(1, e.r - 8), 0, 7); g.stroke();
      // star points riding the front
      g.fillStyle = "#ffffff";
      for (let i = 0; i < 8; i++) {
        const an = i / 8 * Math.PI * 2 + e.life * 0.02;
        g.save(); g.translate(e.x + Math.cos(an) * e.r, e.y + Math.sin(an) * e.r);
        w3dStarPath(g, 6, 2.6, an); g.fill();
        g.restore();
      }
      g.restore();
    },
  },

  /* ---- HOOK: Cast Line / The Big Catch. Flies out on a chain; a foe it
         catches is reeled to her and handed over still stunned. A seeking
         hook (the super) homes on one foe and holds them until the slam.
         `landed` marks a catch, so guests can draw the line pulled taut. ---- */
  hook_line: {
    update(e, fighters) {
      const o = e.owner;
      if (!o.alive || o.state === ST.DEAD || o.state === ST.HITSTUN) return true;
      const t = e.tgt;

      if (t) {                                                     // reeling in
        const oa = o.attack;
        const holding = e.hold && o.state === ST.ATTACK && oa && oa.kind === "super" &&
                        oa.t < oa.data.startup + (oa.data.slamAt || 0);
        if (!t.alive || t.state === ST.DEAD || t.state !== ST.HITSTUN) return true;
        const gx = o.x + o.facing * 44, gy = o.y - 4;
        const dx = gx - t.x, dy = gy - t.y, d = Math.hypot(dx, dy);
        const sp = Math.min(22, d * 0.25);
        t.vx = d > 1 ? dx / d * sp : 0; t.vy = d > 1 ? dy / d * sp : 0;
        t.grounded = false; t.groundSeg = null;
        t.hitstun = Math.max(t.hitstun, 6);
        e.x = t.x; e.y = t.y;
        if (--e.reel > 0 && (d > 34 || holding)) return false;
        if (holding) return false;
        // the super lets go on the slam frame: leave the slam's launch alone
        if (e.hold) return true;
        // landed: dropped right in front of her, still reeling
        t.vx *= 0.15; t.vy = -1.5;
        t.hitstun = Math.max(t.hitstun, 16);
        FX.ring(t.x, t.y, 6, 44, o.ch.accent, 3);
        Snd.tone(300, 0.08, "square", 0.1, 600);
        return true;
      }

      if (!e.back) {                                               // flying out
        if (e.seek) {
          const s = e.seek;
          if (!s.alive || s.state === ST.DEAD) { e.back = true; return false; }
          const dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy) || 1;
          e.vx = dx / d * 24; e.vy = dy / d * 24;
        }
        e.x += e.vx; e.y += e.vy;
        if (e.vx) e.dir = e.vx > 0 ? 1 : -1;
        if (!e.seek && (Math.abs(e.x - e.ox0) > e.range || e.life < 50)) { e.back = true; return false; }
        if (e.seek && e.life < 12) { e.back = true; return false; }
        for (const f of fighters) {
          if (allies(f, o) || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
          if (e.seek && f !== e.seek) continue;
          if (dist(e.x, e.y, f.x, f.y) > e.r + f.ch.hurt) continue;
          Combat.land(o, f, e.move, e.x, e.y);
          if (f.state === ST.HITSTUN) {
            e.tgt = f; e.landed = true; e.reel = e.hold ? 999 : 28;
            FX.damageText(f.x, f.y - 50, "HOOKED!", o.ch.accent);
            Snd.tone(220, 0.1, "sawtooth", 0.1, 500);
          } else e.back = true;                                     // shielded: wind it in
          return false;
        }
        return false;
      }

      // winding back in, empty
      const dx = o.x - e.x, dy = o.y - 10 - e.y, d = Math.hypot(dx, dy) || 1;
      if (d < 26) return true;
      e.x += dx / d * Math.min(20, d); e.y += dy / d * Math.min(20, d);
      return false;
    },
    draw(g, e, c) {
      const o = e.owner, ac = o.ch.accent;
      const hx = o.x + o.facing * 30, hy = o.y - 14;
      g.save(); g.globalCompositeOperation = "source-over";
      // the line: taut and straight on a catch, sagging otherwise
      const sag = e.landed ? 0 : 18;
      const line = () => { g.beginPath(); g.moveTo(hx, hy);
        g.quadraticCurveTo((hx + e.x) / 2, (hy + e.y) / 2 + sag, e.x, e.y); };
      line(); g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
      line(); g.strokeStyle = e.landed ? ac : "#d8dee8"; g.lineWidth = 2;
      g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]);
      // the hook itself, pointing along the line
      g.translate(e.x, e.y);
      g.rotate(Math.atan2(e.y - hy, e.x - hx));
      g.lineCap = "round";
      const hook = () => { g.beginPath(); g.moveTo(-10, 0); g.lineTo(4, 0); g.arc(4, 6, 6, -Math.PI / 2, Math.PI * 0.85); };
      hook(); g.strokeStyle = INK; g.lineWidth = 5.4; g.stroke();
      hook(); g.strokeStyle = "#e8ecf2"; g.lineWidth = 2.8; g.stroke();
      g.fillStyle = ac; g.beginPath(); g.arc(-10, 0, 3, 0, 7); g.fill();
      if (e.landed) { g.globalCompositeOperation = "lighter"; g.shadowColor = ac; g.shadowBlur = 14;
        g.strokeStyle = hexA(ac, 0.7); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.stroke(); }
      g.restore();
    },
  },

  /* ---- TWIN: Split's mirror clone. Stands where she was, faces the
         opposite way to her, and throws every light and heavy she does —
         its hitbox is her move's ox/oy/r mirrored onto the clone. Each foe
         can be hit once per attack. ---- */
  twin_clone: {
    update(e, fighters) {
      const o = e.owner;
      if (!o.alive || o.state === ST.DEAD) return true;
      e.dir = -o.facing;
      const a = o.attack;
      if (o.state === ST.ATTACK && a && (a.kind === "light" || a.kind === "heavy") && o.hitboxActive()) {
        const m = a.data;
        const hx = e.x + (m.ox || 0) * e.dir, hy = e.y + (m.oy || 0);
        if (e.atk !== a.hitId) {
          e.atk = a.hitId; e.hitIds = [];
          FX.blade(e.x + e.dir * 8, hy, e.dir > 0 ? 0 : Math.PI, 20, (m.ox || 30) + m.r, 0.8, o.ch.accent, { w: 8, life: 9 });
        }
        for (const f of fighters) {
          if (allies(f, o) || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
          if (e.hitIds.includes(f.slot) || dist(hx, hy, f.x, f.y) > m.r + f.ch.hurt) continue;
          e.hitIds.push(f.slot);
          Combat.land(o, f, twinEchoMove(m), hx, hy, m.r, f.x >= e.x ? 1 : -1);
        }
      }
      if (e.life % 6 === 0) FX.spark(e.x + rnd(-14, 14), e.y + rnd(-26, 26), o.ch.accent);
      if (e.life === 1) FX.burst(e.x, e.y, 14, o.ch.accent, 4);
      return false;
    },
    draw(g, e) {
      const fade = clamp(e.life / 30, 0, 1) * clamp((e.max - e.life) / 10, 0, 1);
      twinMirrorDraw(g, e, 0.4 * fade);
    },
  },

  /* ---- TWIN: Doppelganger's clones. Hover in place around the target,
         lunge in for the last few frames, and strike together. ---- */
  twin_double: {
    update(e) {
      const t = e.tgt;
      if (t && t.alive && t.state !== ST.DEAD) {
        const k = e.life < 7 ? 0.35 : 1;                            // the lunge
        e.x = t.x + e.ox * k; e.y = t.y + e.oy * k;
        e.dir = t.x >= e.x ? 1 : -1;
        if (e.oy && !e.ox) e.dir = e.owner.facing;
      }
      if (e.life % 3 === 0) FX.spark(e.x + rnd(-12, 12), e.y + rnd(-20, 20), e.owner.ch.accent);
      return false;
    },
    end(e, fighters) {
      const o = e.owner, t = e.tgt;
      FX.blade(e.x, e.y - 4, Math.atan2((t ? t.y : e.y) - e.y, (t ? t.x : e.x + e.dir) - e.x), 20, 70, 0.5, o.ch.accent, { w: 12, life: 10 });
      FX.burst(e.x, e.y, 10, o.ch.color, 5);
      Snd.tone(1000, 0.08, "triangle", 0.1, 400);
      if (t && t.alive && t.state !== ST.DEAD && !t.intangible() && dist(e.x, e.y, t.x, t.y) < 160)
        Combat.land(o, t, e.move, t.x, t.y);
      else Entities.blast(o, e.x, e.y, 60, e.move, fighters);
    },
    draw(g, e) {
      const k = clamp((e.max - e.life) / 6, 0, 1);
      twinMirrorDraw(g, e, 0.6 * k);
    },
  },
});

/* ---------------------------------------------------------------- CPU
   The base CPU only knows the specials it was written for. This runs after
   it and adds presses for these four; it only ever presses buttons, so it
   composes with any other wave that wraps CPU.think the same way. */
const W3D_CPU = {
  // charge to suit the range: tap up close, a full comet across the stage
  NOVA(f, ai, t, adx, ady, facing) {
    const a = f.attack;
    if (f.state === ST.ATTACK && a && a.kind === "special") {
      const want = adx > 320 ? NOVA_MAX_CHARGE : adx > 160 ? 34 : 8;
      if ((f.v.charge || 0) < want) ai.cur.special = true;
      return;
    }
    if (facing && ady < 60 && adx > 70 && Math.random() < 0.02) ai.cur.special = true;
  },
  HOOK(f, ai, t, adx, ady, facing) {
    if (facing && adx > 110 && adx < 340 && ady < 50 && Math.random() < 0.025) ai.cur.special = true;
  },
  BLITZ(f, ai, t, adx, ady, facing) {
    if (facing && adx < 120 && ady < 40 && Math.random() < 0.03) ai.cur.special = true;
  },
  TWIN(f, ai, t, adx, ady, facing) {
    const hasClone = Entities.list.some(e => e.kind === "twin_clone" && e.owner === f);
    if (!hasClone && adx < 220 && Math.random() < 0.015) ai.cur.special = true;
  },
};
const W3D_SUPER_RANGE = { NOVA: 260, HOOK: 1000, BLITZ: 300, TWIN: 700 };

const w3dBaseThink = CPU.think;
CPU.think = function (f, match) {
  const inp = w3dBaseThink.call(this, f, match);
  const fn = W3D_CPU[f.ch.id];
  if (!fn || !f._ai) return inp;
  const ai = f._ai, t = Combat.nearestFoe(f);
  if (!t) return inp;
  const charging = f.state === ST.ATTACK && f.attack && f.attack.kind === "special";
  // only add a press when she is free to act (or mid-charge) and on stage
  if (!charging && (![ST.IDLE, ST.RUN, ST.AIR].includes(f.state) || f.groundSeg === null && !f.grounded &&
      Math.abs(f.x - Stage.pivot.x) > Math.abs(Stage.def.layout[0].x2))) return inp;
  const dx = t.x - f.x, adx = Math.abs(dx), ady = Math.abs(t.y - f.y);
  if (!charging && f.meterFull && adx < W3D_SUPER_RANGE[f.ch.id] && Math.random() < CFG.cpu.superChance) {
    ai.cur.super = true; return inp;
  }
  if (charging || f.specialCD <= 0) fn(f, ai, t, adx, ady, Math.sign(dx) === f.facing);
  return inp;
};
