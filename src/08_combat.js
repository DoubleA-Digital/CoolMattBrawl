/* ==========================================================================
   9. COMBAT — hitbox resolution, super entities, and the CPU
   ========================================================================== */

/* ---------------------------------------------------------------- entities
   Orbs, shockwaves and gravity wells all live here so supers can put things
   into the world that outlive the move that spawned them. */
const Entities = {
  list: [],
  reset() { this.list.length = 0; },

  orb(owner, x, y, vx, vy, move) {
    this.list.push({ kind: "orb", owner, x, y, vx, vy, move, life: 90, r: 16, hitIds: [] });
  },
  shockwave(owner, x, y, dir, move) {
    this.list.push({ kind: "wave", owner, x, y, dir, move, life: 70, r: 46, hitIds: [] });
  },
  well(owner, x, y, move) {
    this.list.push({ kind: "well", owner, x, y, move, life: 62, r: 38, pull: 180, hitIds: [] });
  },
  /** Ballast's cube: falls, lands on the deck, then sits there as real weight
      on the pivot until it expires. The only way in the game to tilt a stage
      from somewhere you are not standing. */
  ballast(owner, x, y, vx, w, life, move) {
    this.list.push({ kind: "ballast", owner, x, y, vx, vy: -2, w, move,
                     life, r: 22, landed: false, hitIds: [] });
  },
  /** Kite's updraft: a rising column that carries anyone inside it upward. */
  updraft(owner, x, y, life) {
    this.list.push({ kind: "draft", owner, x, y, life, r: 62, hitIds: [] });
  },

  update(fighters) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.life--;
      let gone = e.life <= 0;

      if (e.kind === "orb") {
        e.x += e.vx; e.y += e.vy; e.vy += 0.04;
        if (e.life % 3 === 0) FX.spark(e.x, e.y, e.owner.ch.color);
        if (e.x < -300 || e.x > CFG.world.w + 300 || e.y > CFG.world.h + 300) gone = true;
        if (!gone) gone = this._touch(e, fighters, true);

      } else if (e.kind === "ballast") {
        if (!e.landed) {
          e.x += e.vx; e.y += e.vy; e.vy += 0.72; e.vx *= 0.995;
          for (const seg of Stage.segs) {
            const sy = Stage.surfaceY(seg, e.x);
            if (sy != null && e.y + e.r >= sy && e.y + e.r <= sy + 46 && e.vy > 0) {
              e.y = sy - e.r; e.vy = 0; e.vx = 0; e.landed = true;
              FX.burst(e.x, e.y + e.r, 16, e.owner.ch.color, 6);
              FX.dustLine(e.x, e.y + e.r, 90, e.owner.ch.color2);
              FX.crack(e.x, e.y + e.r - 2, 1, 22, e.owner.ch.color, 2);
              FX.shake(8); Snd.bigHit();
              break;
            }
          }
          if (e.y > CFG.world.h + 400) gone = true;
          if (!gone && !e.landed) gone = this._touch(e, fighters, false);
        } else {
          /* Resting: ride the deck as it tilts, and press on the pivot. */
          let sy = null, slope = 0;
          for (const seg of Stage.segs) {
            const y2 = Stage.surfaceY(seg, e.x);
            if (y2 != null && (sy === null || y2 < sy)) { sy = y2; slope = seg.angle; }
          }
          if (sy === null) { e.landed = false; e.vy = 0; }   // the deck moved away
          else {
            e.y = sy - e.r;
            Stage.addWeight(e.x, e.y, e.w);
            e.x += Math.sin(slope) * 1.6;                    // slides downhill
          }
        }

      } else if (e.kind === "draft") {
        e.y -= 1.2;
        if (e.life % 2 === 0)
          FX.spark(e.x + rnd(-e.r, e.r), e.y + rnd(-40, 60), e.owner.ch.accent);
        for (const f of fighters) {
          if (!f.alive || f.state === ST.DEAD) continue;
          if (Math.abs(f.x - e.x) > e.r + f.ch.hurt) continue;
          if (Math.abs(f.y - e.y) > 150) continue;
          // her own lift is stronger: this is Kite's recovery tool
          const lift = f === e.owner ? -1.15 : -0.6;
          f.vy = Math.max(f.vy + lift, -13);
          f.grounded = false; f.groundSeg = null;
        }

      } else if (e.kind === "wave") {
        // rides the deck, following the tilted surface
        e.x += e.dir * 13;
        let best = null;
        for (const seg of Stage.segs) {
          if (!seg.main) continue;
          const sy = Stage.surfaceY(seg, e.x);
          if (sy !== null) best = sy;
        }
        if (best !== null) e.y = best - 10; else gone = true;
        e.r = 46 * (0.5 + e.life / 70);
        if (e.life % 2 === 0) {
          FX.spark(e.x + rnd(-14, 14), e.y + rnd(-10, 6), e.owner.ch.color);
          FX.spark(e.x, e.y - rnd(0, 30), "#ffffff");
        }
        if (!gone) this._touch(e, fighters, false);

      } else if (e.kind === "well") {
        const t = 1 - e.life / 62;
        e.r = 38 + Math.sin(t * Math.PI) * 54;
        // drag everyone toward the singularity
        for (const f of fighters) {
          if (f === e.owner || !f.alive || f.state === ST.DEAD) continue;
          const d = dist(e.x, e.y, f.x, f.y);
          if (d < e.pull && d > 1) {
            const k = (1 - d / e.pull) * 0.9;
            f.vx += (e.x - f.x) / d * k;
            f.vy += (e.y - f.y) / d * k;
            if (f.grounded && Math.abs(e.y - f.y) > 30) { f.grounded = false; f.groundSeg = null; }
          }
        }
        for (let k = 0; k < 2; k++) {
          const a = Math.random() * 7, rr = e.pull * (0.4 + Math.random() * 0.6);
          FX.parts.push({ x: e.x + Math.cos(a) * rr, y: e.y + Math.sin(a) * rr,
            vx: -Math.cos(a) * 3.4, vy: -Math.sin(a) * 3.4,
            life: 18, max: 18, size: 2.2, color: e.owner.ch.color, grav: 0, drag: 1 });
        }
        if (e.life === 1) {                       // collapse
          Snd.superHit(); FX.shake(28); FX.hitPause(12);
          FX.flash("#ffffff", 0.4);
          FX.ring(e.x, e.y, 10, 420, "#ffffff", 6);
          FX.ring(e.x, e.y, 10, 300, e.owner.ch.color, 4);
          FX.burst(e.x, e.y, 50, e.owner.ch.color, 14);
          for (const f of fighters) {
            if (f === e.owner || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
            if (dist(e.x, e.y, f.x, f.y) < 190) Combat.land(e.owner, f, e.move, e.x, e.y);
          }
        }
      }

      if (gone) {
        if (e.kind === "orb") FX.burst(e.x, e.y, 8, e.owner.ch.color, 4);
        this.list.splice(i, 1);
      }
    }
  },

  /** Returns true if the entity should be consumed by the hit. */
  _touch(e, fighters, consume) {
    for (const f of fighters) {
      if (f === e.owner || !f.alive || f.state === ST.DEAD) continue;
      if (f.intangible() || e.hitIds.includes(f.slot)) continue;
      if (dist(e.x, e.y, f.x, f.y) < e.r + f.ch.hurt) {
        e.hitIds.push(f.slot);
        Combat.land(e.owner, f, e.move, e.x, e.y);
        if (consume) return true;
      }
    }
    return false;
  },

  draw(g) {
    for (const e of this.list) {
      const c = e.owner.ch.color;
      g.save();
      g.globalCompositeOperation = "lighter";

      if (e.kind === "orb") {
        g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 24;
        g.beginPath(); g.arc(e.x, e.y, e.r, 0, 7); g.fill();
        g.fillStyle = "#fff"; g.shadowBlur = 8;
        g.beginPath(); g.arc(e.x, e.y, e.r * 0.45, 0, 7); g.fill();

      } else if (e.kind === "ballast") {
        /* A solid object, not an energy effect — so it draws normally with an
           ink outline like the fighters, not additively like a projectile. */
        g.globalCompositeOperation = "source-over";
        const blink = e.life < 40 && Math.floor(e.life / 4) % 2 === 0;
        g.globalAlpha = blink ? 0.45 : 1;
        g.save();
        g.translate(e.x, e.y);
        if (!e.landed) g.rotate(e.life * 0.09);
        plate(g, [-e.r, -e.r, e.r, -e.r, e.r, e.r, -e.r, e.r], e.owner.ch.color,
              { up: 0.3, down: 0.4, under: true });
        g.fillStyle = hexA("#000000", 0.35);
        g.fillRect(-e.r + 5, -3, e.r * 2 - 10, 6);
        g.fillStyle = hexA(e.owner.ch.accent, 0.8);
        g.fillRect(-e.r + 5, -3, e.r * 2 - 10, 2);
        rivets(g, -e.r + 7, -e.r + 7, 3, (e.r * 2 - 14) / 2, e.owner.ch.accent);
        g.restore();
        // a weight gauge under a resting cube, so its pull on the pivot is legible
        if (e.landed) {
          g.globalCompositeOperation = "lighter";
          g.strokeStyle = hexA(c, 0.5); g.lineWidth = 2;
          g.beginPath(); g.moveTo(e.x - e.r, e.y + e.r + 5);
          g.lineTo(e.x - e.r + (e.r * 2) * clamp(e.life / 480, 0, 1), e.y + e.r + 5);
          g.stroke();
        }

      } else if (e.kind === "draft") {
        const a = clamp(e.life / 110, 0, 1);
        const q = g.createLinearGradient(0, e.y + 90, 0, e.y - 120);
        q.addColorStop(0, hexA(e.owner.ch.accent, 0));
        q.addColorStop(0.4, hexA(c, 0.26 * a));
        q.addColorStop(1, hexA(e.owner.ch.accent, 0));
        g.fillStyle = q;
        g.fillRect(e.x - e.r, e.y - 120, e.r * 2, 210);
        g.strokeStyle = hexA(e.owner.ch.accent, 0.4 * a); g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const ox = -e.r + 10 + i * ((e.r * 2 - 20) / 3);
          const wob = Math.sin(e.life * 0.18 + i) * 7;
          g.beginPath();
          g.moveTo(e.x + ox + wob, e.y + 80);
          g.quadraticCurveTo(e.x + ox - wob, e.y - 10, e.x + ox + wob, e.y - 110);
          g.stroke();
        }

      } else if (e.kind === "wave") {
        const a = clamp(e.life / 70, 0, 1);
        g.globalAlpha = a;
        g.strokeStyle = c; g.lineWidth = 5; g.shadowColor = c; g.shadowBlur = 22;
        g.beginPath();
        g.moveTo(e.x - e.dir * 26, e.y + 12);
        g.quadraticCurveTo(e.x, e.y - 52 * a, e.x + e.dir * 26, e.y + 12);
        g.stroke();
        g.strokeStyle = "#fff"; g.lineWidth = 2;
        g.beginPath();
        g.moveTo(e.x - e.dir * 16, e.y + 10);
        g.quadraticCurveTo(e.x, e.y - 34 * a, e.x + e.dir * 16, e.y + 10);
        g.stroke();

      } else if (e.kind === "well") {
        const t = 1 - e.life / 62;
        const rg = g.createRadialGradient(e.x, e.y, 2, e.x, e.y, e.r * 1.7);
        rg.addColorStop(0, "rgba(0,0,0,1)");
        rg.addColorStop(0.45, hexA(c, 0.5));
        rg.addColorStop(1, "rgba(0,0,0,0)");
        g.globalCompositeOperation = "source-over";
        g.fillStyle = rg;
        g.beginPath(); g.arc(e.x, e.y, e.r * 1.7, 0, 7); g.fill();
        g.globalCompositeOperation = "lighter";
        g.strokeStyle = c; g.lineWidth = 3; g.shadowColor = c; g.shadowBlur = 20;
        for (let i = 0; i < 3; i++) {
          const rr = e.r * (0.6 + i * 0.28);
          g.globalAlpha = 0.7 - i * 0.18;
          g.beginPath();
          g.ellipse(e.x, e.y, rr, rr * 0.42, t * 5 + i, 0, 7);
          g.stroke();
        }
      }
      g.restore();
    }
  },
};

/* ---------------------------------------------------------------- combat */
const Combat = {
  nearestFoe(f) {
    let best = null, bd = Infinity;
    for (const o of Match.current.fighters) {
      if (o === f || !o.alive || o.state === ST.DEAD) continue;
      const d = dist(f.x, f.y, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  },

  resolve(fighters) {
    for (const atk of fighters) {
      if (!atk.alive || atk.state === ST.DEAD) continue;
      if (!atk.attack || !atk.hitboxActive()) continue;
      const a = atk.attack;
      const hb = atk.hitboxWorld();

      for (const def of fighters) {
        if (def === atk || !def.alive || def.state === ST.DEAD) continue;
        if (def.state === ST.GRABBED && def.grabbedBy === atk) continue;
        if (a.hitIds && a.hitIds.includes(def.slot)) continue;
        if (dist(hb.x, hb.y, def.x, def.y) > hb.r + def.ch.hurt) continue;

        if (a.kind === "grab") {
          if (def.intangible() || def.state === ST.HITSTUN) continue;
          atk.lockGrab(def);
          return;
        }
        if (def.intangible()) { FX.spark(def.x, def.y, "#ffffff"); continue; }

        a.hitIds = a.hitIds || [];
        a.hitIds.push(def.slot);
        this.land(atk, def, a.data, hb.x, hb.y, hb.r);
      }
    }
  },

  land(atk, def, move, hx, hy, hbR) {
    const dirX = def.x >= atk.x ? 1 : -1;
    const isSuper = move === (atk.ch.super) || (atk.attack && atk.attack.kind === "super" && atk.attack.data === move);
    const K = CFG.skill;

    /* ---- skill modifiers, applied before anything reads move.dmg ----
       Spacing: connecting with the outer edge of the hitbox pays a bonus, so
       there is a reason to measure a strike instead of walking into the
       opponent. Staleness: repeating the same move weakens it, so the strong
       button is not simply the best button. Neither applies to throws. */
    let tip = false, staleMul = 1;
    if (hbR) {
      const d = dist(hx, hy, def.x, def.y);
      tip = d > hbR * K.tipZone;
    }
    staleMul = atk.staleMul(move);
    const dmg = move.dmg * staleMul * (tip ? K.tipBonus : 1);

    // ---------------- shield ----------------
    if (def.shielding() && !isSuper) {
      const facingHit = (def.facing === -dirX) || Math.abs(def.x - atk.x) < 8;
      if (facingHit) {
        def.shield -= dmg * CFG.shieldDamageMul + 4;
        def.vx += dirX * dmg * 0.12;
        Snd.shield();
        FX.ring(def.x, def.y, 10, def.ch.hurt * 2.2, "#7fd9ff", 2);
        FX.hitPause(3); FX.shake(3);
        if (def.shield <= 0) def.breakShield();
        return;
      }
    }

    // ---------------- knockback ----------------
    const base = move.base || 2, scale = move.scale || 0.5;
    const kb = CFG.kbBase + base + dmg * CFG.kbDamageScale
             + def.percent * CFG.kbPercentScale * scale * 1.9;
    const mag = kb * ((CFG.kbWeightRef + 0.55) / (def.ch.weight + 0.55));
    const rad = (move.angle != null ? move.angle : 45) * Math.PI / 180;

    def.applyKnockback(Math.cos(rad) * mag * dirX, -Math.sin(rad) * mag, dmg, mag, atk);
    atk.stats.damageDealt += dmg;
    atk.addMeter(dmg * CFG.meter.onDeal);
    atk.recordMove(move);
    if (move.onHit) move.onHit(atk, def);

    /* Hit confirm: a clean connect refunds part of the remaining endlag, so
       landing a commital move leaves you safer than whiffing it. Multi-hit
       moves and supers are excluded — cutting their recovery would truncate
       the move itself. */
    const a2 = atk.attack;
    if (a2 && a2.kind !== "super" && !(move.hits > 1)) {
      const left = a2.total - a2.t;
      if (left > 0) a2.t += Math.round(left * K.hitConfirmCut);
    }

    // the pivot feels every hit
    Stage.nudge(clamp((def.x - Stage.pivot.x) / 310, -1, 1) * mag * Stage.cfg.hitNudge);
    Stage.lastPusher = atk;

    // ---------------- feel ----------------
    const pause = Math.round(CFG.hitPauseBase + dmg * CFG.hitPausePerDmg);
    FX.hitPause(pause);
    FX.shake(3 + dmg * 0.85);
    FX.burst(hx, hy, Math.round(6 + dmg * 1.1), atk.ch.color, 3 + dmg * 0.35);
    FX.ring(hx, hy, 6, 30 + dmg * 5, "#ffffff", 2);
    FX.hitmark(hx, hy, dmg);
    // the bigger the hit, the more it throws off
    if (dmg >= 6) {
      const away = Math.atan2(-Math.sin(rad), Math.cos(rad) * dirX);
      FX.impactLines(hx, hy, away, Math.round(3 + dmg * 0.45),
                     dmg >= 13 ? "#ffffff" : atk.ch.accent, 30 + dmg * 2.4);
    }
    FX.damageText(hx, hy - 24, dmg, tip ? "#ffffff" : atk.ch.accent);
    Snd.hit(dmg);
    if (dmg >= 13) { Snd.bigHit(); FX.flash(atk.ch.color, 0.12); FX.punch(0.5); }
    else if (dmg >= 7) FX.punch(0.22);

    /* Tell the player why the number was what it was — a skill mechanic the
       player cannot see is just inconsistency. */
    if (tip) {
      FX.ring(hx, hy, 4, 44, "#ffffff", 3);
      FX.damageText(hx, hy - 44, "TIP", "#ffffff");
      Snd.tone(1500, 0.05, "square", 0.09, 2300);
    }
    if (staleMul < 0.95) FX.damageText(hx, hy - 44, "STALE", "#8f8cb5");
  },
};

/* ------------------------------------------------------------------- CPU */
const CPU = {
  think(f, match) {
    f._ai = f._ai || { t: 0, cur: {}, prev: {} };
    const ai = f._ai;
    ai.prev = Object.assign({}, ai.cur);
    ai.cur = {}; BUTTONS.forEach(b => ai.cur[b] = false);
    ai.t++;

    const inp = {
      ax: 0, ay: 0,
      held: b => !!ai.cur[b],
      hit: b => !!ai.cur[b] && !ai.prev[b],
      released: b => !ai.cur[b] && !!ai.prev[b],
    };
    const press = b => { ai.cur[b] = true; };

    const foes = match.fighters.filter(o => o !== f && o.alive && o.state !== ST.DEAD);
    if (!foes.length) return inp;
    let target = foes[0], bd = Infinity;
    for (const o of foes) { const d = dist(f.x, f.y, o.x, o.y); if (d < bd) { bd = d; target = o; } }

    const centerX = Stage.pivot.x;
    const onStage = f.groundSeg !== null;
    const halfDeck = Math.abs(Stage.def.layout[0].x2);

    // --- recovery first ---
    if (!onStage && (Math.abs(f.x - centerX) > halfDeck || f.y > Stage.pivot.y + 70)) {
      const dir = f.x < centerX ? "right" : "left";
      press(dir); inp.ax = dir === "right" ? 1 : -1;
      if (f.vy > 1 && f.airJumps > 0 && ai.t % 14 < 2) press("up");
      if (f.y > Stage.pivot.y + 20 && ai.t % 10 < 2) press("up");
      return inp;
    }

    // --- climb uphill when the deck is steep ---
    const tiltSign = Math.sign(Stage.tilt);
    if (Math.abs(Stage.tilt) > Stage.cfg.limit * 0.62 && onStage &&
        Math.sign(f.x - centerX) === tiltSign && Math.abs(f.x - centerX) > halfDeck * 0.55) {
      const dir = tiltSign > 0 ? "left" : "right";
      press(dir); inp.ax = dir === "right" ? 1 : -1;
      if (ai.t % 30 < 2 && f.ch.id !== "BOLDER") press("up");
      return inp;
    }

    const dx = target.x - f.x, dy = target.y - f.y, adx = Math.abs(dx);

    // --- super when it's up and the target is worth it ---
    if (f.meterFull && Math.random() < CFG.cpu.superChance && (adx < 320 || f.ch.id === "PIVOT")) {
      press("super"); return inp;
    }

    if (Math.random() < CFG.cpu.dodgeChance && f.grounded) { press("shield"); return inp; }

    if (adx > 54) { const dir = dx > 0 ? "right" : "left"; press(dir); inp.ax = dx > 0 ? 1 : -1; }
    if (dy < -70 && f.grounded && ai.t % 24 < 2) press("up");
    if (dy < -50 && !f.grounded && f.airJumps > 0 && ai.t % 20 < 2) press("up");
    if (dy > 90 && !f.grounded) { press("down"); inp.ay = 1; }

    const inLight = adx < 58 && Math.abs(dy) < 52;
    const inHeavy = adx < 76 && Math.abs(dy) < 58;
    if (inLight && Math.random() < CFG.cpu.aggression * 0.3) {
      if (target.percent > 70 && Math.random() < 0.5) press("heavy");
      else if (Math.random() < 0.18) press("grab");
      else press("light");
    } else if (inHeavy && Math.random() < 0.16) press("heavy");

    if (f.specialCD <= 0 && Math.random() < 0.012) {
      const t = Math.abs(Stage.balance());
      switch (f.ch.id) {
        case "BOLDER": if (adx < 120) press("special"); break;
        case "ZIP":    if (t > 0.4 || adx < 170) press("special"); break;
        case "ORBIT":  if (t > 0.45 || adx < 260) press("special"); break;
        case "PIVOT":  if (t > 0.2) press("special"); break;
        // drop a cube on whichever side is already heavy, to push it over
        case "BALLAST": if (adx < 340) press("special"); break;
        // ride an updraft when recovering, or to escape a steep deck
        case "KITE":    if (!f.grounded || t > 0.5) press("special"); break;
        // plant only when the deck is leaning his way and a foe is close
        case "HUSK":    if (adx < 150 && t > 0.15) press("special"); break;
        // hold the counter when someone is in swinging range
        case "MIRA":    if (adx < 90) press("special"); break;
      }
    }
    if (f.state === ST.ATTACK && f.ch.id === "PIVOT" && f.attack && f.attack.kind === "special") {
      press("special");
      const side = Math.sign(target.x - centerX) || 1;
      if (side > 0) { press("right"); inp.ax = 1; } else { press("left"); inp.ax = -1; }
    }
    if (f.state === ST.GRABBED && ai.t % 3 === 0) press("light");
    return inp;
  },
};
