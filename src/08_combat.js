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
  /** A shockwave runs along the platform it was born on and dies at that
      platform's edge — it no longer snaps down to the main deck. */
  shockwave(owner, x, y, dir, move, plat) {
    this.list.push({ kind: "wave", owner, x, y, dir, move, plat: plat || null,
                     life: 70, r: 46, hitIds: [] });
  },
  well(owner, x, y, move) {
    this.list.push({ kind: "well", owner, x, y, move, life: 62, r: 38, pull: 180, hitIds: [] });
  },
  /** Kite's updraft: a rising column that carries anyone inside it upward.
      A storm column (her super) lifts only her foes, and lifts them hard. */
  updraft(owner, x, y, life, storm) {
    this.list.push({ kind: "draft", owner, x, y, life, max: life, storm: !!storm,
                     r: storm ? 54 : 62, hitIds: [] });
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

      } else if (KINDS[e.kind]) {
        if (KINDS[e.kind].update(e, fighters)) gone = true;

      } else if (e.kind === "draft") {
        e.y -= 1.2;
        if (e.life % 2 === 0)
          FX.spark(e.x + rnd(-e.r, e.r), e.y + rnd(-40, 60), e.owner.ch.accent);
        for (const f of fighters) {
          if (!f.alive || f.state === ST.DEAD) continue;
          if (e.storm && allies(f, e.owner)) continue;
          if (Math.abs(f.x - e.x) > e.r + f.ch.hurt) continue;
          if (Math.abs(f.y - e.y) > 150) continue;
          if (e.storm) {
            // caught in the storm: carried up and held over the column
            if (f.intangible()) continue;
            f.vy = Math.max(f.vy - 1.05, -9);
            f.vx = f.vx * 0.86 + (e.x - f.x) * 0.02;
          } else {
            // her own lift is stronger: this is Kite's recovery tool
            const lift = f === e.owner ? -1.15 : -0.6;
            f.vy = Math.max(f.vy + lift, -13);
          }
          f.grounded = false; f.groundSeg = null;
        }

      } else if (e.kind === "wave") {
        // runs along its own platform and stops dead at that platform's edge
        e.x += e.dir * 13;
        let best = null;
        for (const seg of Stage.segs) {
          if (e.plat ? seg.local !== e.plat : !seg.main) continue;
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
          if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD) continue;
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
            if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
            if (dist(e.x, e.y, f.x, f.y) < 190) Combat.land(e.owner, f, e.move, e.x, e.y);
          }
        }
      }

      if (gone) {
        if (e.kind === "orb") FX.burst(e.x, e.y, 8, e.owner.ch.color, 4);
        if (KINDS[e.kind] && KINDS[e.kind].end) KINDS[e.kind].end(e, fighters);
        const k = this.list.indexOf(e);
        if (k >= 0) this.list.splice(k, 1);
      }
    }
  },

  /** Spawn any of the newer kinds below: fields are kind-specific. */
  add(kind, owner, fields) {
    const e = Object.assign({ kind, owner, x: owner.x, y: owner.y, vx: 0, vy: 0,
                              r: 14, life: 60, hitIds: [] }, fields);
    e.max = e.max || e.life;
    this.list.push(e);
    return e;
  },

  /** Hit every foe of owner within r of (x, y) once. Used by explosions. */
  blast(owner, x, y, r, move, fighters) {
    for (const f of fighters) {
      if (allies(f, owner) || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
      if (dist(x, y, f.x, f.y) < r + f.ch.hurt) Combat.land(owner, f, move, x, y);
    }
  },

  /** Returns true if the entity should be consumed by the hit. */
  _touch(e, fighters, consume) {
    for (const f of fighters) {
      if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD) continue;
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

      } else if (KINDS[e.kind]) {
        KINDS[e.kind].draw(g, e, c);

      } else if (e.kind === "draft") {
        const a = clamp(e.life / 110, 0, 1) * (e.storm ? 1.5 : 1);
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
  /** Every live fighter that f is allowed to hit. */
  foes(f) {
    return Match.current.fighters.filter(o =>
      !allies(o, f) && o.alive && o.state !== ST.DEAD);
  },
  /** Within a few frames of the stage music's beat? Tempo's hits pay more. */
  onBeat() {
    const p = this.beatPeriod();
    const ph = (Match.current ? Match.current.frames : 0) % p;
    return Math.min(ph, p - ph) <= 4;
  },
  beatPeriod() { return 3600 / ((Stage.def.music && Stage.def.music.bpm) || 120); },
  /** The closest foe, optionally only within range. Teammates never count. */
  nearestFoe(f, range) {
    let best = null, bd = range || Infinity;
    for (const o of this.foes(f)) {
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
        if (allies(def, atk) || !def.alive || def.state === ST.DEAD) continue;
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

  /** dirOverride sends the hit a fixed way (-1 or 1) instead of away from
      the attacker — Pivot's Tipping Point throws foes off their own side. */
  land(atk, def, move, hx, hy, hbR, dirOverride) {
    const dirX = dirOverride || (def.x >= atk.x ? 1 : -1);
    // delayed super hits (a bomb, a curse, an echo) carry `unblockable`
    const isSuper = move.unblockable || move === (atk.ch.super) ||
                    (atk.attack && atk.attack.kind === "super" && atk.attack.data === move);
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
    let dmg = move.dmg * staleMul * (tip ? K.tipBonus : 1);
    let kbMul = move.kbMul || 1;

    /* ---- fighter-specific bonuses ---- */
    // Shade: the first hit out of stealth is an ambush
    const ambush = atk.ambushT > 0;
    if (ambush) { atk.ambushT = 0; dmg *= 1.35; kbMul *= 1.2; }
    // Tempo: a hit that lands on the stage music's beat
    const onBeat = atk.ch.rhythm && this.onBeat();
    if (onBeat) { dmg *= 1.2; atk.addMeter(4); }
    // a POWER item
    if (atk.buff === "power") { dmg *= ITEM_CFG.powerMul; kbMul *= 1.1; }

    // ---------------- shield ----------------
    // Tempo's sound waves shatter a held shield outright
    if (def.shielding() && move.breaksShield) {
      def.breakShield();
      FX.ring(def.x, def.y, 10, 90, atk.ch.color, 3);
      return;
    }
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

    /* ---- combo: a hit on someone still reeling from the last one ----
       Counted per attack, not per hitbox frame, so one multi-hit move is one
       link in the chain. */
    const comboKey = atk.attack || move;
    const chained = def.state === ST.HITSTUN && def.hitstun > 0 && def.lastHitBy === atk;

    // ---------------- knockback ----------------
    const base = move.base || 2, scale = move.scale || 0.5;
    const kb = CFG.kbBase + base + dmg * CFG.kbDamageScale
             + def.percent * CFG.kbPercentScale * scale * 1.9;
    const mag = kb * kbMul * ((CFG.kbWeightRef + 0.55) / (def.ch.weight + 0.55));
    const rad = (move.angle != null ? move.angle : 45) * Math.PI / 180;

    def.applyKnockback(Math.cos(rad) * mag * dirX, -Math.sin(rad) * mag, dmg, mag, atk);
    if (def.state === ST.HITSTUN) {
      if (!chained) { def.comboN = 1; def.comboKey = comboKey; }
      else if (def.comboKey !== comboKey) {
        def.comboN++; def.comboKey = comboKey;
        atk.stats.bestCombo = Math.max(atk.stats.bestCombo, def.comboN);
        if (def.comboN >= 3) FX.combo(def.x, def.y - def.h * 0.9, def.comboN, atk.ch.accent);
      }
    }
    atk.stats.damageDealt += dmg;
    atk.stats.bestHit = Math.max(atk.stats.bestHit, dmg);
    // Vex: her hits heal her own damage
    const steal = move.lifesteal != null ? move.lifesteal : (atk.ch.lifesteal || 0);
    if (steal > 0 && atk.percent > 0) {
      const heal = Math.min(atk.percent, dmg * steal);
      atk.percent -= heal;
      FX.damageText(atk.x, atk.y - 50, "+" + heal.toFixed(1), "#7dff9a");
    }
    if (ambush) { FX.damageText(hx, hy - 62, "AMBUSH!", atk.ch.accent); FX.flash(atk.ch.color, 0.15); }
    if (onBeat) { FX.damageText(hx, hy - 62, "ON BEAT", atk.ch.accent); FX.ring(hx, hy, 8, 90, atk.ch.color, 3); }
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

    /* SMASH: a hit strong enough that it will probably take the stock gets a
       beat of its own — longer freeze, a white pop, and a smoke trail behind
       whoever is flying. Countered, armoured and planted hits never set it
       off, because they never set the victim flying. */
    if (mag >= CFG.smashKb && def.state === ST.HITSTUN && def.lastHitBy === atk) {
      FX.hitPause(pause + 7);
      FX.flash("#ffffff", 0.22);
      FX.punch(0.6);
      FX.ring(hx, hy, 10, 160, "#ffffff", 4);
      FX.damageText(hx, hy - 62, "SMASH!", "#ffffff");
      Snd.bigHit();
      def.launchFx = 40;
      atk.stats.smashes++;
      FX.kick(hx, hy, 0.09);
      /* Possibly the hit that ends the match: their last stock, and nobody
         else left to beat. Slow the world down and let everyone watch. */
      const m = Match.current;
      if (m && def.stocks === 1 && !m.over &&
          m.sides().filter(side => side.some(f => f !== def && f.stocks > 0)).length <= 1) {
        FX.slowmo(48);
        FX.kick(def.x, def.y, 0.22);
      }
    }
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

    // a stealthed Shade is lost to the CPU unless she is close enough to
    // catch the shimmer -- about what a person watching the screen can manage
    const foes = Combat.foes(f).filter(o => o.stealthT <= 0 || dist(f.x, f.y, o.x, o.y) < 200);
    if (!foes.length) {
      // nobody visible: drift back toward the middle of the stage and wait
      const home = Stage.pivot.x - f.x;
      if (Math.abs(home) > 80) { const dir = home > 0 ? "right" : "left"; press(dir); inp.ax = home > 0 ? 1 : -1; }
      return inp;
    }
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
      // Echo can simply rewind to where she was standing
      const back = f.posHist[0];
      if (f.ch.id === "ECHO" && f.specialCD <= 0 && back && Math.abs(back.x - centerX) < halfDeck &&
          back.y < Stage.pivot.y) press("special");
      return inp;
    }

    const dx = target.x - f.x, dy = target.y - f.y, adx = Math.abs(dx);

    // --- get out of anything about to go off ---
    for (const e of Entities.list) {
      if (allies(e.owner, f)) continue;
      const danger = e.kind === "payload" ? e.w + 30 : e.kind === "ghost" ? 80 : 0;
      if (!danger || dist(e.x, e.y, f.x, f.y) > danger) continue;
      const dir = f.x < e.x ? "left" : "right";
      press(dir); inp.ax = dir === "right" ? 1 : -1;
      if (f.grounded && ai.t % 20 < 2) press("up");
      return inp;
    }
    // Vex keeps her siphon going by holding the button
    if (f.ch.id === "VEX" && f.state === ST.ATTACK && f.attack && f.attack.kind === "special") {
      press("special"); return inp;
    }

    // --- grab a power-up lying nearby, unless someone is right on top of us ---
    let item = null, id = 380;
    for (const it of Items.list) {
      if (!it.landed) continue;
      const d = dist(f.x, f.y, it.x, it.y - 18);
      if (d < id) { id = d; item = it; }
    }
    if (item && bd > 150) {
      const ix = item.x - f.x, iy = item.y - 18 - f.y;
      if (Math.abs(ix) > 8) { const dir = ix > 0 ? "right" : "left"; press(dir); inp.ax = ix > 0 ? 1 : -1; }
      if (iy < -60 && f.grounded && ai.t % 24 < 2) press("up");
      if (iy < -40 && !f.grounded && f.airJumps > 0 && ai.t % 20 < 2) press("up");
      return inp;
    }

    // --- super when it's up and the target is worth it ---
    /* Supers have different ideal ranges: some reach across the stage, some
       only touch whoever is close. A CPU that fires them blind wastes them. */
    const superRange = { ZIP: 900, KITE: 900, HUSK: 460, PIVOT: 260, ORBIT: 300, MIRA: 120,
                         BOLDER: 200, RIME: 220, HEX: 1200, SHADE: 1200, VEX: 150, FUSE: 150,
                         RICO: 600, SPROUT: 1200, ECHO: 400, TEMPO: 190 }[f.ch.id] || f.ch.cpuSuperRange || 320;
    // Overgrowth only catches foes who are standing on something
    const superOk = f.ch.id === "SPROUT" ? foes.some(o => o.grounded)
                  : f.ch.id === "BOLDER" ? f.grounded : true;
    if (f.meterFull && Math.random() < CFG.cpu.superChance && bd < superRange && superOk) {
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
      const facingFoe = Math.sign(dx) === f.facing;
      const nearEdge = Math.abs(target.x - centerX) > halfDeck * 0.6;
      switch (f.ch.id) {
        case "BOLDER": if (adx < 120) press("special"); break;
        case "ZIP":    if (adx < 170) press("special"); break;
        case "ORBIT":  if (adx < 260) press("special"); break;
        // swap when the foe is the one closer to the edge
        case "PIVOT":  if (facingFoe && adx < 260 && Math.abs(dy) < 40 && nearEdge) press("special"); break;
        case "KITE":    if (!f.grounded) press("special"); break;
        case "HUSK":    if (adx < 150) press("special"); break;
        // hold the counter when someone is in swinging range
        case "MIRA":    if (adx < 90) press("special"); break;
        case "RIME":    if (facingFoe && adx < 420 && Math.abs(dy) < 50 && target.slowT <= 0) press("special"); break;
        case "HEX":     if (adx < 420 && target.curseT <= 0) press("special"); break;
        // fade on the approach, so the ambush lands
        case "SHADE":   if (adx > 220 && adx < 600) press("special"); break;
        case "VEX":     if (bd < 280 && f.percent > 20) press("special"); break;
        case "FUSE":    if (facingFoe && adx < 280) press("special"); break;
        case "RICO":    if (facingFoe && adx < 380 && Math.abs(dy) < 50) press("special"); break;
        case "SPROUT":  if (f.grounded && f.percent > 25 && adx > 160) press("special"); break;
        // rewind out of trouble: high damage, or off the stage
        case "ECHO":    if (f.percent > 60 || !onStage && f.y > Stage.pivot.y) press("special"); break;
        case "TEMPO":   if (adx < 150 || (target.shielding() && adx < 170)) press("special"); break;
        // the third wave carries its own hint
        default:        if (f.ch.cpuSpecial && f.ch.cpuSpecial(f, target, bd)) press("special");
      }
    }
    if (f.state === ST.GRABBED && ai.t % 3 === 0) press("light");
    return inp;
  },
};
