/* ==========================================================================
   9d. ENTITY KINDS — wave 3c: Bulwark, Wraith, Drift and Quill

     bulwark_dome    Aegis: a mirrored bubble that throws projectiles back
     wraith_minion   Raise / Legion: a skeleton that walks to a foe and claws
     drift_trail     Kickflip: a strip of grind sparks that bites ankles
     drift_board     Drift's glide (a watcher, see below)
     quill_spike     Caltrops: lands on the floor and trips whoever steps on it
     quill_storm     Needle Storm: the cloud that drops the needles
     quill_needle    one falling needle
     quill_bristle   Quill's thorns passive (a watcher, see below)

   Watchers. Fighter has no per-character "every frame" hook, so the two
   passives that need one ride on an invisible entity that follows its owner:
   Entities.update runs right after Combat.resolve every frame, which is
   exactly when a fresh hit or a fresh release of the stick can be seen. The
   owner's own moves spawn it (w3cWatch) — one per fighter, never more.

   As with 08a, every draw() reads only what the netcode ships: x, y, r, life,
   max, dir, landed, storm, w, plus e.owner.
   ========================================================================== */

/** Can f's mirror take this? Only an enemy's moving, damaging projectile —
    never a planted thing, a stuck bomb or a walking minion. */
function w3cReflectable(e, f) {
  if (!e.owner || allies(e.owner, f) || !e.move || e.stuck) return false;
  const k = KINDS[e.kind];
  if (k && k.noReflect) return false;
  return Math.hypot(e.vx || 0, e.vy || 0) > 3.5;
}

/** Send a projectile back as f's own, 30% faster (capped). With a surface
    normal it bounces off a curve (the dome); without one it simply reverses. */
function w3cReflect(e, f, nx, ny) {
  let vx = e.vx, vy = e.vy;
  if (nx === undefined) { vx = -vx; vy = -vy; }
  else { const d = vx * nx + vy * ny; vx -= 2 * d * nx; vy -= 2 * d * ny; }
  const sp = Math.hypot(vx, vy) || 1, k = Math.min(sp * 1.3, 22) / sp;
  e.vx = vx * k; e.vy = vy * k;
  e.owner = f;
  e.hitIds = [];
  if (e.hitLog) e.hitLog = {};
  if (e.dir) e.dir = e.vx >= 0 ? 1 : -1;
  e.life = Math.max(e.life, 50);
  FX.ring(e.x, e.y, 6, 46, f.ch.accent, 3);
  FX.spark(e.x, e.y, "#ffffff");
  FX.damageText(e.x, e.y - 30, "REFLECT", f.ch.accent);
  Snd.tone(2100, 0.07, "triangle", 0.1, 3200);
}

/** One watcher of a kind per fighter; their own moves call this. */
function w3cWatch(f, kind) {
  for (const e of Entities.list) if (e.kind === kind && e.owner === f) return;
  Entities.add(kind, f, { r: 0, life: 9999999, pv: 0 });
}

Object.assign(KINDS, {

  /* ---- BULWARK: Aegis. Follows him; bounces every enemy projectile off
         its surface and braces him and his teammates inside it. ---- */
  bulwark_dome: {
    noReflect: true,
    update(e, fighters) {
      const o = e.owner;
      if (!o.alive || o.state === ST.DEAD) { e.dud = true; return true; }
      e.x = o.x; e.y = o.y;
      for (const p of Entities.list) {
        if (p === e || !w3cReflectable(p, o)) continue;
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (d > e.r + (p.r || 0)) continue;
        const nx = dx / d, ny = dy / d;
        if (p.vx * nx + p.vy * ny >= 0) continue;          // already heading out
        w3cReflect(p, o, nx, ny);
      }
      // the Keel Anchor brace (anchorGlow) is the engine's "half knockback"
      for (const f of fighters)
        if (allies(f, o) && f.alive && f.state !== ST.DEAD && dist(f.x, f.y, e.x, e.y) < e.r)
          f.anchorGlow = Math.max(f.anchorGlow, 2);
      if (e.life % 5 === 0) FX.spark(e.x + rnd(-e.r, e.r) * 0.7, e.y + rnd(-e.r, e.r) * 0.7, o.ch.accent);
      return false;
    },
    end(e, fighters) {
      if (e.dud) return;
      FX.ring(e.x, e.y, e.r * 0.6, e.r * 1.6, "#ffffff", 6);
      FX.burst(e.x, e.y, 36, e.owner.ch.accent, 10);
      FX.shake(18); FX.flash(e.owner.ch.accent, 0.25);
      Snd.superHit();
      Entities.blast(e.owner, e.x, e.y, e.r, e.move, fighters);
    },
    draw(g, e, c) {
      const ac = e.owner.ch.accent;
      const rise = clamp((e.max - e.life) / 10, 0, 1);
      const a = rise * (e.life < 40 ? 0.55 + 0.45 * Math.sin(e.life * 0.7) : 1);
      const R = e.r * (0.7 + 0.3 * rise);
      g.save();
      const q = g.createRadialGradient(e.x - R * 0.3, e.y - R * 0.4, 4, e.x, e.y, R);
      q.addColorStop(0, hexA("#ffffff", 0.16 * a)); q.addColorStop(0.7, hexA(ac, 0.06 * a));
      q.addColorStop(1, hexA(ac, 0.3 * a));
      g.fillStyle = q; g.beginPath(); g.arc(e.x, e.y, R, 0, 7); g.fill();
      g.globalAlpha = a; g.shadowColor = ac; g.shadowBlur = 18;
      g.strokeStyle = hexA(ac, 0.85); g.lineWidth = 3;
      g.beginPath(); g.arc(e.x, e.y, R, 0, 7); g.stroke();
      // mirror facets: three latitude bands and a turning meridian
      g.shadowBlur = 0; g.strokeStyle = hexA("#ffffff", 0.25); g.lineWidth = 1.2;
      for (const k of [-0.5, 0, 0.5]) {
        g.beginPath(); g.ellipse(e.x, e.y + k * R, R * Math.sqrt(1 - k * k), R * 0.16, 0, 0, 7); g.stroke();
      }
      const m = Math.sin(e.life * 0.04);
      g.beginPath(); g.ellipse(e.x, e.y, Math.abs(m) * R, R, 0, 0, 7); g.stroke();
      // the travelling glint
      g.strokeStyle = hexA("#ffffff", 0.8); g.lineWidth = 4;
      const ga = e.life * 0.05;
      g.beginPath(); g.arc(e.x, e.y, R - 4, ga, ga + 0.5); g.stroke();
      g.restore();
    },
  },

  /* ---- WRAITH: a raised skeleton. Claws out of the ground, walks the floor
         toward the nearest foe (it won't step off an edge), winds up and
         swipes. A few swings and it falls apart; any enemy hitbox shatters it.
         w = swing timer, storm = a Legion minion (faster, shares a hit log). */
  wraith_minion: {
    noReflect: true,
    update(e, fighters) {
      const o = e.owner;
      if ((!o.alive || o.state === ST.DEAD) && e.life > 14) e.life = 14;
      if (e.life <= 14) return false;                       // crumbling
      if (!e.landed) {
        e.vy = Math.min(e.vy + 0.6, 14); e.y += e.vy;
        const fl = Stage.floorBelow(e.x, e.y - e.vy - 1);
        if (fl !== null && e.y >= fl) { e.y = fl; e.vy = 0; e.landed = true; FX.dustLine(e.x, fl, 30, "#b9b6d8"); }
        return e.y > CFG.world.h + 200;
      }
      if (e.max - e.life < 18) return false;                // still clawing out
      // follow whatever floor is underfoot (platforms drift)
      const here = Stage.floorBelow(e.x, e.y - 18);
      if (here === null || here - e.y > 20) { e.landed = false; return false; }
      e.y = here;
      // any enemy hitbox that sweeps through it shatters it
      for (const f of fighters) {
        if (allies(f, o) || !f.alive || f.state === ST.DEAD || !f.attack || !f.hitboxActive()) continue;
        const hb = f.hitboxWorld();
        if (dist(hb.x, hb.y, e.x, e.y - 16) < hb.r + 12) {
          e.life = 14;
          FX.burst(e.x, e.y - 16, 12, o.ch.accent, 5);
          Snd.tone(700, 0.06, "square", 0.08, 260);
          return false;
        }
      }
      let t = null, bd = 900;
      for (const f of fighters) {
        if (allies(f, o) || !f.alive || f.state === ST.DEAD || f.stealthT > 0) continue;
        const d = dist(e.x, e.y - 16, f.x, f.y);
        if (d < bd) { bd = d; t = f; }
      }
      if (e.cd > 0) e.cd--;
      if (e.w > 0) {                                        // mid-swing
        if (--e.w === 4) {
          const ok = t && !t.intangible() && Math.abs(t.x - e.x) < 34 + t.ch.hurt &&
                     Math.abs(t.y - (e.y - 16)) < 48 && (!e.log || (e.log[t.slot] || 0) < 3);
          if (ok) {
            if (e.log) e.log[t.slot] = (e.log[t.slot] || 0) + 1;
            Combat.land(o, t, e.move, e.x + e.dir * 16, e.y - 18);
          } else Snd.noise(0.05, 0.05, 2400, 1, "bandpass");
          if (++e.hits >= e.cap) e.life = Math.min(e.life, 26);
        }
        return false;
      }
      if (!t) return false;
      const dx = t.x - e.x;
      e.dir = dx >= 0 ? 1 : -1;
      if (Math.abs(dx) < 26 + t.ch.hurt && Math.abs(t.y - (e.y - 16)) < 50) {
        if (e.cd <= 0) { e.w = 14; e.cd = 36; Snd.tone(240, 0.08, "sawtooth", 0.06, 120); }
        return false;
      }
      const nx = e.x + e.dir * e.spd, fl = Stage.floorBelow(nx, e.y - 18);
      if (fl !== null && Math.abs(fl - e.y) < 20) { e.x = nx; e.y = fl; }
      return false;
    },
    draw(g, e, c) {
      const bone = e.owner.ch.accent;
      const rise = e.landed ? clamp((e.max - e.life) / 18, 0, 1) : 1;
      const crumble = e.life < 14 ? e.life / 14 : 1;
      if (e.storm) aura(g, e.x, e.y - 16, 30, c, 0.22 * crumble);
      g.save(); g.globalCompositeOperation = "source-over";
      g.globalAlpha = crumble;
      // clip at the floor so it rises out of the ground
      g.beginPath(); g.rect(e.x - 60, e.y - 90, 120, 90); g.clip();
      g.translate(e.x, e.y + (1 - rise) * 34 + (1 - crumble) * 8);
      g.scale(e.dir || 1, 1);
      const walk = Math.sin(e.life * 0.3) * (e.w > 0 ? 0 : 6);
      const sw = e.w > 4 ? -1.4 + (14 - e.w) * 0.1 : e.w > 0 ? 0.9 : -0.3;
      g.lineCap = "round";
      const bones = (pts, w) => {
        g.beginPath(); g.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
        g.strokeStyle = INK; g.lineWidth = w + 2.4; g.stroke();
        g.strokeStyle = bone; g.lineWidth = w; g.stroke();
      };
      bones([-3, -12, -4 + walk, -5, -5 + walk * 1.3, 0], 2.6);       // legs
      bones([3, -12, 4 - walk, -5, 5 - walk * 1.3, 0], 2.6);
      bones([0, -12, 0, -26], 2.8);                                     // spine
      for (let i = 0; i < 3; i++) bones([-5 + i * 0.6, -24 + i * 4, 0, -23 + i * 4, 5 - i * 0.6, -24 + i * 4], 1.8);
      bones([-2, -24, -8, -16, -6, -10], 2.2);                          // back arm
      const hx = 2 + Math.cos(sw) * 12, hy = -24 + Math.sin(sw) * 12;   // claw arm
      bones([2, -24, hx, hy], 2.4);
      for (let i = -1; i <= 1; i++) bones([hx, hy, hx + Math.cos(sw + i * 0.4) * 6, hy + Math.sin(sw + i * 0.4) * 6], 1.4);
      // skull, with soulfire in the sockets
      ink(g, () => { g.beginPath(); g.ellipse(1, -31, 6, 5.6, 0, 0, 7); }, vol(g, -37, -25, bone, 0.2, 0.35), 2.4);
      lens(g, () => { g.beginPath(); g.arc(3.2, -31.5, 1.6, 0, 7); }, c, c, e.storm ? 14 : 8);
      lens(g, () => { g.beginPath(); g.arc(-0.8, -31.5, 1.3, 0, 7); }, c, c, e.storm ? 12 : 6);
      g.fillStyle = INK; g.fillRect(0, -27.6, 5, 1.2);
      g.restore();
    },
  },

  /* ---- DRIFT: the grind trail Kickflip leaves on the floor. w = its length;
         it bites each foe who stands on it once. ---- */
  drift_trail: {
    noReflect: true,
    update(e, fighters) {
      if (e.w < 6) return false;
      if (e.life % 3 === 0) FX.spark(e.x + rnd(-e.w, e.w) * 0.5, e.y - 2, e.owner.ch.accent);
      for (const f of fighters) {
        if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
        if (e.hitIds.includes(f.slot)) continue;
        if (Math.abs(f.x - e.x) < e.w / 2 + 8 && Math.abs(f.feetY - e.y) < 16) {
          e.hitIds.push(f.slot);
          Combat.land(e.owner, f, e.move, f.x, e.y - 8);
        }
      }
      return false;
    },
    draw(g, e, c) {
      if (e.w < 2) return;
      const a = clamp(e.life / 40, 0, 1), ac = e.owner.ch.accent;
      const x0 = e.x - e.w / 2, x1 = e.x + e.w / 2;
      g.save(); g.globalAlpha = a;
      g.shadowColor = c; g.shadowBlur = 16;
      g.strokeStyle = hexA(c, 0.8); g.lineWidth = 6; g.lineCap = "round";
      g.beginPath(); g.moveTo(x0, e.y - 2); g.lineTo(x1, e.y - 2); g.stroke();
      g.strokeStyle = ac; g.lineWidth = 2;
      g.setLineDash([8, 7]); g.lineDashOffset = e.life * 1.5;
      g.beginPath(); g.moveTo(x0, e.y - 3); g.lineTo(x1, e.y - 3); g.stroke();
      g.setLineDash([]);
      // flickering flames along it
      for (let x = x0 + 6; x < x1; x += 14) {
        const h = 5 + 4 * Math.abs(Math.sin(x * 0.3 + e.life * 0.4));
        g.fillStyle = hexA(ac, 0.7);
        poly(g, [x - 3, e.y - 2, x, e.y - 2 - h, x + 3, e.y - 2]); g.fill();
      }
      g.restore();
    },
  },

  /* ---- DRIFT: the board watcher. Out of an attack the engine bleeds speed
         the moment the stick is let go; a skater doesn't. While he's running
         or idling on the ground and hasn't turned around, speed decays only
         2.5% a frame instead — so a dash or a sprint carries on as a glide. */
  drift_board: {
    noReflect: true,
    update(e) {
      const o = e.owner;
      const free = o.alive && o.state !== ST.DEAD && o.grounded && o.rootT <= 0 &&
                   (o.state === ST.RUN || o.state === ST.IDLE);
      const pv = e.pv || 0;
      if (free && Math.abs(pv) > 1 && Math.sign(o.vx) === Math.sign(pv) && o.facing === Math.sign(pv) &&
          Math.abs(o.vx) < Math.abs(pv) * 0.975) {
        o.vx = pv * 0.975;
        if (o.state === ST.IDLE) o.setState(ST.RUN);
      }
      e.pv = o.vx; e.x = o.x; e.y = o.y;
      return false;
    },
    draw(g, e, c) {
      // speed lines streaming off the back of his board when he's flying
      const o = e.owner, v = o.vx;
      if (!o.alive || o.state === ST.DEAD || Math.abs(v) < 6.5) return;
      const k = clamp((Math.abs(v) - 6.5) / 6, 0, 1), s = -Math.sign(v);
      g.save(); g.globalAlpha = 0.5 * k;
      g.strokeStyle = o.ch.accent; g.lineWidth = 2; g.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const y = o.y + 4 + i * 9, x = o.x + s * (18 + i * 4);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * (20 + k * 26 - i * 4), y); g.stroke();
      }
      g.restore();
    },
  },

  /* ---- QUILL: a caltrop. Flies in a short arc (and pricks anyone it hits
         on the way), then sits on the floor until a foe steps on it. ---- */
  quill_spike: {
    update(e, fighters) {
      if (!e.landed) {
        e.vy = Math.min(e.vy + 0.5, 14); e.x += e.vx; e.y += e.vy; e.vx *= 0.99;
        if (e.vy > 0) {
          const fl = Stage.floorBelow(e.x, e.y - e.vy);
          if (fl !== null && e.y >= fl) {
            e.y = fl; e.landed = true; e.vx = 0; e.vy = 0;
            Snd.tone(1400, 0.03, "square", 0.04, 900);
            return false;
          }
        }
        if (e.y > CFG.world.h + 200) return true;
        return Entities._touch(e, fighters, true);
      }
      const fl = Stage.floorBelow(e.x, e.y - 8);
      if (fl === null || fl - e.y > 10) { e.landed = false; return false; }
      e.y = fl;
      for (const f of fighters) {
        if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD || !f.grounded || f.intangible()) continue;
        if (Math.abs(f.x - e.x) < f.w * 0.5 + 4 && Math.abs(f.feetY - e.y) < 12) {
          Combat.land(e.owner, f, e.move, e.x, e.y - 6);
          FX.burst(e.x, e.y - 4, 8, e.owner.ch.accent, 4);
          return true;                                   // spent
        }
      }
      return false;
    },
    draw(g, e, c) {
      const a = clamp(e.life / 30, 0, 1);
      g.save(); g.globalCompositeOperation = "source-over"; g.globalAlpha = a;
      g.translate(e.x, e.y - (e.landed ? 5 : 0));
      g.rotate(e.landed ? 0 : e.life * 0.4);
      const ac = e.owner.ch.accent;
      for (let i = 0; i < 4; i++) {
        g.save(); g.rotate(i * Math.PI / 2 + 0.6);
        plate(g, [-2.2, 0, 2.2, 0, 0, -8], ac, { ink: 1.8, rim: false });
        g.fillStyle = INK; poly(g, [-0.8, -5.5, 0.8, -5.5, 0, -8]); g.fill();
        g.restore();
      }
      g.fillStyle = c; g.beginPath(); g.arc(0, 0, 2.2, 0, 7); g.fill();
      g.restore();
    },
  },

  /* ---- QUILL: Needle Storm's cloud. Sits over the stage (w = half its
         width) and drops a needle every other frame: half fall anywhere, half
         fall on or near a foe, so standing still in it is what costs you. ---- */
  quill_storm: {
    noReflect: true,
    update(e, fighters) {
      if (e.life % 2 !== 0) return false;
      let x = e.x + rnd(-e.w, e.w);
      if (e.life % 4 === 0) {
        const foes = fighters.filter(f => !allies(f, e.owner) && f.alive && f.state !== ST.DEAD);
        if (foes.length) x = pick(foes).x + rnd(-40, 40);
      }
      Entities.add("quill_needle", e.owner, { x, y: e.y + 20, vx: rnd(-0.4, 0.4), vy: rnd(11, 13),
        r: 9, life: 90, log: e.log, move: e.move });
      return false;
    },
    draw(g, e, c) {
      const a = clamp((e.max - e.life) / 15, 0, 1) * clamp(e.life / 20, 0, 1);
      g.save(); g.globalCompositeOperation = "source-over"; g.globalAlpha = 0.5 * a;
      const q = g.createLinearGradient(0, e.y - 40, 0, e.y + 50);
      q.addColorStop(0, hexA("#2a1a10", 0)); q.addColorStop(0.5, hexA("#2a1a10", 0.9)); q.addColorStop(1, hexA("#2a1a10", 0));
      g.fillStyle = q; g.fillRect(e.x - e.w - 40, e.y - 40, e.w * 2 + 80, 90);
      g.restore();
      g.save(); g.globalAlpha = 0.6 * a; g.strokeStyle = c; g.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) {
        const x = e.x - e.w + ((i * 137 + e.life * 9) % (e.w * 2));
        g.beginPath(); g.moveTo(x, e.y + 10); g.lineTo(x - 2, e.y + 34); g.stroke();
      }
      g.restore();
    },
  },

  /* ---- QUILL: one falling needle. It drops straight through the thin
         platforms and sticks in solid floor; each foe can be stuck at most
         nine times, no faster than one every 7 frames. */
  quill_needle: {
    noReflect: true,
    update(e, fighters) {
      if (e.landed) return false;
      e.x += e.vx; e.y += e.vy;
      let fl = null;
      for (const s of Stage.segs) {
        if (!s.solid) continue;
        const sy = Stage.surfaceY(s, e.x);
        if (sy !== null && sy >= e.y - e.vy - 2 && (fl === null || sy < fl)) fl = sy;
      }
      if (fl !== null && e.y >= fl) { e.y = fl; e.landed = true; e.life = Math.min(e.life, 20); return false; }
      if (e.y > CFG.world.h + 100) return true;
      const fr = Match.current ? Match.current.frames : 0;
      for (const f of fighters) {
        if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
        if (dist(e.x, e.y, f.x, f.y) > e.r + f.ch.hurt) continue;
        const h = e.log[f.slot] || (e.log[f.slot] = { n: 0, at: -99 });
        if (h.n >= 9 || fr - h.at < 7) continue;
        h.n++; h.at = fr;
        Combat.land(e.owner, f, e.move, e.x, e.y);
        return true;
      }
      return false;
    },
    draw(g, e, c) {
      const ac = e.owner.ch.accent, a = e.landed ? clamp(e.life / 20, 0, 1) : 1;
      g.save(); g.globalCompositeOperation = "source-over"; g.globalAlpha = a;
      g.translate(e.x, e.y); g.rotate(e.landed ? 0.15 : 0.04);
      g.lineCap = "round";
      g.strokeStyle = INK; g.lineWidth = 4.2;
      g.beginPath(); g.moveTo(0, -20); g.lineTo(0, e.landed ? -2 : 4); g.stroke();
      g.strokeStyle = ac; g.lineWidth = 2.2; g.stroke();
      g.strokeStyle = c; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(0, -20); g.lineTo(0, -13); g.stroke();
      g.restore();
    },
  },

  /* ---- QUILL: the thorns watcher. A light attack that lands on him this
         frame costs the attacker 1% (once per swing). ---- */
  quill_bristle: {
    noReflect: true,
    update(e) {
      const o = e.owner;
      e.x = o.x; e.y = o.y;
      if (o.hitFlash !== 8 || o.state !== ST.HITSTUN) return false;
      const a = o.lastHitBy;
      // (no hitboxActive() test: the hit-confirm cut has already moved their
      // attack past its active frames by the time this runs)
      if (!a || a === o || allies(a, o) || !a.alive || !a.attack ||
          a.attack.kind !== "light" || e.lastId === a.attack.hitId) return false;
      e.lastId = a.attack.hitId;
      a.percent = Math.min(999, a.percent + 1); a.hitFlash = 4;
      o.stats.damageDealt += 1;
      FX.damageText(a.x, a.y - 40, "PRICKED", o.ch.accent);
      FX.burst(a.x, a.y, 6, o.ch.accent, 3);
      Snd.tone(1700, 0.04, "square", 0.06, 1100);
      return false;
    },
    draw() {},
  },
});
