/* ==========================================================================
   8. FIGHTER — state machine, movement, attacks, meter
   ========================================================================== */

const ST = {
  IDLE: "idle", RUN: "run", JUMPSQUAT: "jumpsquat", AIR: "air", LANDLAG: "landlag",
  ATTACK: "attack", SHIELD: "shield", ROLL: "roll", SPOTDODGE: "spotdodge",
  AIRDODGE: "airdodge", HITSTUN: "hitstun", GRABBING: "grabbing", GRABBED: "grabbed",
  SHIELDBREAK: "shieldbreak", DEAD: "dead", RESPAWN: "respawn",
};

let HITID = 1;

class Fighter {
  constructor(slot, charId, isCPU) {
    this.slot = slot;
    this.ch = CHAR_BY_ID[charId];
    this.isCPU = isCPU;
    this.pad = new Pad(slot);
    this.tint = PLAYER_TINT[slot];
    this.stats = { kos: 0, damageDealt: 0, snapbacks: 0, falls: 0, supers: 0 };
    this.reset(true);
  }

  reset(full) {
    this.x = CFG.world.w / 2 + (this.slot - 1.5) * 150;
    this.y = 160;
    this.px = this.x; this.py = this.y;
    this.vx = 0; this.vy = 0;
    this.facing = this.x < Stage.pivot.x ? 1 : -1;
    this.percent = 0;
    this.state = ST.AIR; this.stateTimer = 0;
    this.grounded = false; this.groundSeg = null;
    this.airJumps = CFG.airJumps;
    this.shield = CFG.shieldMax;
    this.invuln = 0; this.hitstun = 0;
    this.attack = null;
    this.fastFalling = false; this.dropThrough = 0;
    this.lastHitBy = null;
    this.grabTarget = null; this.grabHold = 0; this.grabbedBy = null;
    this.heavyStomp = 0; this.crankDir = 0;
    this.anchorGlow = 0; this.flipGlow = 0;
    this.specialCD = 0;
    this.pinned = false;
    this.trail = [];
    this.alive = true; this.respawnTimer = 0;
    this.squatHeld = false; this.hitFlash = 0;
    this.runPhase = 0;
    this.animTime = Math.random() * 1000;
    if (full) { this.stocks = CFG.stocks; this.meter = 0; }
  }

  get h() { return this.ch.size.h; }
  get w() { return this.ch.size.w; }
  get feetY() { return this.y + this.h * 0.5; }
  get meterFull() { return this.meter >= CFG.meter.max; }
  get inSuper() { return this.attack && this.attack.kind === "super"; }

  addMeter(v) { this.meter = clamp(this.meter + v, 0, CFG.meter.max); }
  setState(s, t = 0) { this.state = s; this.stateTimer = t; }
  canAct() { return [ST.IDLE, ST.RUN, ST.AIR].includes(this.state); }

  /* ================================================================ update */
  update(match) {
    this.px = this.x; this.py = this.y;
    this.animTime++;

    if (this.state === ST.DEAD) {
      this.respawnTimer--;
      if (this.respawnTimer <= 0) {
        if (this.stocks > 0) this.respawn(); else this.alive = false;
      }
      return;
    }
    if (!this.alive) return;

    this.pad.poll();
    const inp = this.isCPU ? CPU.think(this, match) : this.pad;

    if (this.invuln > 0) this.invuln--;
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.heavyStomp > 0) this.heavyStomp--;
    if (this.specialCD > 0) this.specialCD--;
    if (this.anchorGlow > 0) this.anchorGlow--;
    if (this.flipGlow > 0) this.flipGlow--;
    this.crankDir = 0;
    this.addMeter(CFG.meter.passive);

    switch (this.state) {
      case ST.IDLE: case ST.RUN: this.updateGroundFree(inp); break;
      case ST.AIR:               this.updateAirFree(inp); break;
      case ST.JUMPSQUAT:         this.updateJumpSquat(inp); break;
      case ST.LANDLAG:           this.tickTimer(ST.IDLE); break;
      case ST.ATTACK:            this.updateAttack(inp); break;
      case ST.SHIELD:            this.updateShield(inp); break;
      case ST.ROLL:              this.updateRoll(); break;
      case ST.SPOTDODGE:         this.tickTimer(ST.IDLE); break;
      case ST.AIRDODGE:          this.updateAirDodge(); break;
      case ST.HITSTUN:           this.updateHitstun(inp); break;
      case ST.GRABBING:          this.updateGrabbing(inp); break;
      case ST.GRABBED:           this.updateGrabbed(inp); break;
      case ST.SHIELDBREAK:       this.tickTimer(ST.IDLE); break;
      case ST.RESPAWN:           this.updateRespawn(inp); break;
    }

    if (this.state !== ST.SHIELD && this.state !== ST.SHIELDBREAK)
      this.shield = Math.min(CFG.shieldMax, this.shield + CFG.shieldRegen);

    this.integrate();
    this.checkBlastZones(match);

    // run-cycle phase drives the leg animation in every character's draw()
    if (this.grounded && Math.abs(this.vx) > 0.5) this.runPhase += Math.abs(this.vx) * 0.09;
    else this.runPhase *= 0.85;

    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 9 || this.inSuper) {
      this.trail.push({ x: this.x, y: this.y, life: 10, facing: this.facing });
      if (this.trail.length > 12) this.trail.shift();
    }
    for (let i = this.trail.length - 1; i >= 0; i--)
      if (--this.trail[i].life <= 0) this.trail.splice(i, 1);
  }

  tickTimer(next) { if (--this.stateTimer <= 0) this.setState(next); }

  /* ------------------------------------------------------------- grounded */
  updateGroundFree(inp) {
    const ch = this.ch, ax = inp.ax;

    if (inp.hit("super") && this.meterFull) { this.startSuper(); return; }
    if (inp.hit("shield")) {
      if (ax !== 0) { this.startRoll(ax); return; }
      if (inp.ay > 0) { this.setState(ST.SPOTDODGE, CFG.spotDodgeFrames); Snd.dodge(); return; }
      this.setState(ST.SHIELD); Snd.shield(); return;
    }
    if (inp.held("shield")) { this.setState(ST.SHIELD); return; }
    if (inp.hit("grab")) { this.startGrab(); return; }
    if (inp.hit("heavy")) { this.startAttack("heavy"); return; }
    if (inp.hit("light")) { this.startAttack("light"); return; }
    if (inp.hit("special")) { this.startSpecial(); return; }
    if (inp.hit("up")) { this.setState(ST.JUMPSQUAT, CFG.jumpSquat); this.squatHeld = true; return; }

    if (inp.ay > 0 && this.groundSeg && !this.groundSeg.solid) {
      this.grounded = false; this.groundSeg = null;
      this.dropThrough = 10; this.setState(ST.AIR); this.y += 6;
      return;
    }

    const target = ax * ch.speed;
    this.vx += (target - this.vx) * (ax !== 0 ? ch.accel * 0.45 : 0.35);
    this.setState(Math.abs(this.vx) > 0.6 ? ST.RUN : ST.IDLE);
    if (ax !== 0) this.facing = ax;
  }

  updateJumpSquat(inp) {
    this.squatHeld = this.squatHeld && inp.held("up");
    if (--this.stateTimer <= 0) {
      this.vy = -this.ch.jump * (this.squatHeld ? 1 : CFG.shortHopMul);
      this.grounded = false; this.groundSeg = null;
      this.setState(ST.AIR); this.fastFalling = false;
      Snd.jump();
      FX.burst(this.x, this.feetY, 7, this.ch.color, 3);
    }
  }

  /* ---------------------------------------------------------------- air */
  updateAirFree(inp) {
    const ch = this.ch;
    if (inp.hit("super") && this.meterFull) { this.startSuper(); return; }
    if (inp.hit("shield")) { this.startAirDodge(inp); return; }
    if (inp.hit("grab") || inp.hit("light")) { this.startAttack("light"); return; }
    if (inp.hit("heavy")) { this.startAttack("heavy"); return; }
    if (inp.hit("special")) { this.startSpecial(); return; }

    if (inp.hit("up") && this.airJumps > 0) {
      this.airJumps--;
      this.vy = -ch.jump * 0.94;
      this.vx += inp.ax * ch.airSpeed * 0.5;
      this.fastFalling = false;
      Snd.jump();
      FX.ring(this.x, this.y, 10, 56, ch.color, 2);
      return;
    }
    if (inp.hit("down") && this.vy > -1) this.fastFalling = true;
    if (inp.ax !== 0) {
      this.vx = clamp(this.vx + inp.ax * ch.accel * 0.42, -ch.airSpeed * 1.6, ch.airSpeed * 1.6);
      this.facing = inp.ax;
    }
  }

  startAirDodge(inp) {
    this.setState(ST.AIRDODGE, CFG.airDodgeFrames);
    this.invuln = Math.max(this.invuln, CFG.dodgeInvuln[1]);
    const a = Math.hypot(inp.ax, inp.ay);
    if (a > 0) { this.vx = (inp.ax / a) * CFG.airDodgeSpeed; this.vy = (inp.ay / a) * CFG.airDodgeSpeed; }
    else { this.vx *= 0.3; this.vy = -1; }
    Snd.dodge();
    FX.ring(this.x, this.y, 8, 50, "#ffffff", 2);
  }
  updateAirDodge() {
    this.vx *= 0.93; this.vy *= 0.93;
    if (--this.stateTimer <= 0) this.setState(ST.AIR);
  }

  /* ------------------------------------------------------------- shield */
  updateShield(inp) {
    this.vx *= 0.7;
    if (!this.grounded) { this.setState(ST.AIR); return; }
    this.shield -= CFG.shieldDrainIdle;
    if (this.shield <= 0) { this.breakShield(); return; }
    if (inp.hit("super") && this.meterFull) { this.startSuper(); return; }
    if (inp.hit("grab")) { this.startGrab(); return; }
    if (inp.ax !== 0 && inp.hit("shield")) { this.startRoll(inp.ax); return; }
    if (inp.hit("up")) { this.setState(ST.JUMPSQUAT, CFG.jumpSquat); this.squatHeld = true; return; }
    if (!inp.held("shield")) this.setState(ST.IDLE);
  }
  breakShield() {
    this.shield = 0;
    this.setState(ST.SHIELDBREAK, CFG.shieldBreakStun);
    this.vy = -6;
    Snd.shieldBreak(); FX.shake(14);
    FX.burst(this.x, this.y, 26, "#7fd9ff", 8);
    FX.banner("SHIELD BREAK", this.tint);
  }
  startRoll(dir) {
    this.setState(ST.ROLL, CFG.rollFrames);
    this.rollDir = dir;
    this.invuln = Math.max(this.invuln, CFG.dodgeInvuln[1]);
    Snd.dodge();
  }
  updateRoll() {
    this.vx = this.rollDir * CFG.rollSpeed * Math.sin(Math.PI * (this.stateTimer / CFG.rollFrames));
    if (--this.stateTimer <= 0) { this.facing = -this.rollDir; this.setState(ST.IDLE); }
  }

  /* ------------------------------------------------------------ attacks */
  startAttack(kind) {
    const m = this.ch[kind];
    this.attack = {
      kind, data: m, t: 0,
      total: m.startup + m.active + m.recovery,
      hitId: HITID++, hitIds: null, lastHitFrame: -99,
    };
    this.setState(ST.ATTACK);
    if (this.grounded) this.vx *= 0.42;
    if (m.onStart) m.onStart(this);
    Snd.whoosh();
  }

  startSpecial() {
    if (this.specialCD > 0) return;    // the HUD diamond shows readiness
    this.specialCD = this.ch.specialCooldown;
    const m = this.ch.special;
    this.attack = {
      kind: "special", data: m, t: 0,
      total: m.startup + m.active + m.recovery,
      hitId: HITID++, hitIds: null, fired: false,
    };
    this.setState(ST.ATTACK);
    if (m.onStart) m.onStart(this);
    Snd.whoosh(1.2);
  }

  startSuper() {
    const m = this.ch.super;
    this.meter = 0;
    this.stats.supers++;
    this.attack = {
      kind: "super", data: Object.assign({}, m), t: 0,
      total: m.startup + m.active + m.recovery,
      hitId: HITID++, hitIds: null, fired: false, landed: false,
    };
    this.setState(ST.ATTACK);
    this.invuln = Math.max(this.invuln, m.startup + 4);
    if (m.onStart) m.onStart(this);
    FX.banner(m.name.toUpperCase(), this.ch.color);
    FX.hitPause(10);
  }

  updateAttack(inp) {
    const a = this.attack;
    if (!a) { this.setState(this.grounded ? ST.IDLE : ST.AIR); return; }
    a.t++;

    if (a.data.tick) a.data.tick(this, a, inp);

    const m = a.data;

    /* Signature effects. vfx fires once, on the frame the hitbox opens, so the
       flourish and the hit are the same event; vfxTick runs every active frame
       for moves that need a continuous effect. */
    if (m.vfx && a.t === m.startup + 1) m.vfx(this, a);
    if (m.vfxTick && this.hitboxActive()) m.vfxTick(this, a);

    // multi-hit: re-arm the hitbox every hitGap frames
    if (m.hits && m.hits > 1 && this.hitboxActive()) {
      if (a.t - a.lastHitFrame >= (m.hitGap || 4)) {
        a.hitIds = null; a.lastHitFrame = a.t;
        a.hitIndex = (a.hitIndex || 0) + 1;
        if (m.vfxRehit) m.vfxRehit(this, a);
      }
    }

    if (this.grounded) this.vx *= 0.86;

    if (a.t >= a.total) {
      this.attack = null;
      this.pinned = false;
      this.setState(this.grounded ? ST.LANDLAG : ST.AIR, CFG.landLag);
    }
  }

  hitboxActive() {
    const a = this.attack;
    if (!a) return false;
    const m = a.data;
    if (!m.r) return false;
    return a.t > m.startup && a.t <= m.startup + m.active;
  }
  hitboxWorld() {
    const a = this.attack, m = a.data;
    let ox = m.ox || 0, oy = m.oy || 0;
    if (this.ch.id === "BOLDER" && (a.kind === "special" || a.kind === "super")) ox = 0;
    return { x: this.x + ox * this.facing, y: this.y + oy, r: m.r };
  }

  /* -------------------------------------------------------------- grabs */
  startGrab() {
    this.attack = {
      kind: "grab",
      data: { startup: CFG.grabStartup, active: CFG.grabActive,
              recovery: CFG.grabRecovery, ox: 34, oy: -6, r: 28, dmg: 0 },
      t: 0, total: CFG.grabStartup + CFG.grabActive + CFG.grabRecovery,
      hitId: HITID++, hitIds: null,
    };
    this.setState(ST.ATTACK);
    this.vx *= 0.3;
    Snd.whoosh(0.8);
  }
  lockGrab(target) {
    this.attack = null;
    this.grabTarget = target; this.grabHold = CFG.grabHoldBase;
    this.setState(ST.GRABBING);
    target.grabbedBy = this;
    target.setState(ST.GRABBED, CFG.grabHoldBase);
    target.vx = 0; target.vy = 0;
    Snd.grab();
    FX.burst(target.x, target.y, 10, this.ch.color, 4);
  }
  updateGrabbing(inp) {
    const t = this.grabTarget;
    if (!t || t.state !== ST.GRABBED || !t.alive) { this.releaseGrab(); return; }
    this.vx *= 0.5;
    t.x = this.x + this.facing * (this.w * 0.5 + t.w * 0.4);
    t.y = this.y - 2; t.vx = 0; t.vy = 0;

    if (inp.hit("light")) {
      t.percent += CFG.pummelDamage;
      this.stats.damageDealt += CFG.pummelDamage;
      this.addMeter(CFG.pummelDamage * CFG.meter.onDeal);
      t.hitFlash = 5;
      Snd.hit(4);
      FX.spark(t.x, t.y, "#ffffff");
      this.grabHold -= 4;
    }
    let thrown = null;
    if (inp.hit("right"))     thrown = { x:  0.98, y: -0.22 };
    else if (inp.hit("left")) thrown = { x: -0.98, y: -0.22 };
    else if (inp.hit("up"))   thrown = { x:  0.10, y: -0.99 };
    else if (inp.hit("down")) thrown = { x:  0.34, y:  0.94 };
    if (thrown) { this.doThrow(t, thrown); return; }

    if (--this.grabHold <= 0) this.releaseGrab();
  }
  doThrow(t, dir) {
    const kb = CFG.kbBase + CFG.throwDamage * CFG.kbDamageScale + t.percent * CFG.kbPercentScale * 1.1;
    const weightFix = (CFG.kbWeightRef + 0.55) / (t.ch.weight + 0.55);
    const mag = kb * weightFix * 0.9 + 4;
    t.applyKnockback(dir.x * mag, dir.y * mag, CFG.throwDamage, mag, this);
    this.stats.damageDealt += CFG.throwDamage;
    this.addMeter(CFG.throwDamage * CFG.meter.onDeal);
    Stage.nudge(Math.sign(t.x - Stage.pivot.x || 1) * mag * Stage.cfg.hitNudge * 0.6);
    Stage.lastPusher = this;
    Snd.throw_(); FX.shake(7);
    FX.burst(t.x, t.y, 14, this.ch.color, 6);
    this.releaseGrab();
    this.setState(ST.LANDLAG, 12);
  }
  releaseGrab() {
    const t = this.grabTarget;
    if (t) { t.grabbedBy = null; if (t.state === ST.GRABBED) t.setState(ST.AIR); }
    this.grabTarget = null;
    this.setState(this.grounded ? ST.IDLE : ST.AIR);
  }
  updateGrabbed(inp) {
    let mash = 0;
    for (const b of BUTTONS) if (inp.hit(b)) mash++;
    this.stateTimer -= 1 + mash * 5;
    if (this.stateTimer <= 0) {
      if (this.grabbedBy) this.grabbedBy.releaseGrab();
      this.setState(ST.AIR);
    }
  }

  /* ------------------------------------------------------------ hitstun */
  updateHitstun(inp) {
    this.hitstun--;
    if (inp.ax !== 0) this.vx += inp.ax * CFG.diStrength;
    if (inp.ay !== 0) this.vy += inp.ay * CFG.diStrength * 0.7;
    if (this.hitstun <= 0) {
      this.setState(this.grounded ? ST.IDLE : ST.AIR);
      this.airJumps = Math.max(this.airJumps, CFG.airJumps);
    }
  }

  applyKnockback(vx, vy, dmg, mag, from) {
    // Supers have armour during their active window so they can't be poked out.
    if (CFG.meter.superArmor && this.inSuper && this.attack.t > this.attack.data.startup) {
      this.percent = Math.min(999, this.percent + dmg * 0.5);
      this.hitFlash = 4;
      this.addMeter(dmg * CFG.meter.onTake);
      return;
    }
    if (this.pinned) { this.percent += dmg * 0.4; this.hitFlash = 4; return; }

    this.percent = Math.min(999, this.percent + dmg);
    this.addMeter(dmg * CFG.meter.onTake);
    this.vx = vx; this.vy = vy;
    this.grounded = false; this.groundSeg = null;
    this.hitstun = Math.min(CFG.hitstunMax, Math.round(mag * CFG.hitstunPerKb) + 4);
    this.setState(ST.HITSTUN);
    this.hitFlash = 8;
    this.airJumps = CFG.airJumps;
    if (from) this.lastHitBy = from;
    if (this.grabbedBy) this.grabbedBy.releaseGrab();
  }

  /* ---------------------------------------------------------- integrate */
  integrate() {
    const ch = this.ch;
    if (this.dropThrough > 0) this.dropThrough--;
    const noGrav = this.state === ST.AIRDODGE || this.state === ST.RESPAWN || this.pinned;

    if (!this.grounded && !noGrav) {
      let g = CFG.gravity * ch.fallMul;
      if (this.fastFalling) g *= CFG.fastFallMul;
      this.vy = Math.min(this.vy + g, CFG.maxFall * (this.fastFalling ? CFG.fastFallMul : 1) * ch.fallMul);
      this.vx *= CFG.airDrag;
    }

    const prevFeet = this.feetY;
    this.x += this.vx;
    this.y += this.vy;

    /* Ground collision against the rotated segments. A fighter already riding a
       segment gets a wider capture band so a fast-tilting stage carries them
       along instead of dropping them through. */
    const wasSeg = this.groundSeg;
    this.grounded = false; this.groundSeg = null;
    let best = null, bestY = Infinity;
    for (const seg of Stage.segs) {
      if (!seg.solid && this.dropThrough > 0) continue;
      const sy = Stage.surfaceY(seg, this.x);
      if (sy === null) continue;
      const half = seg.thick * 0.5;
      const feet = this.feetY;
      const riding = seg === wasSeg;
      const up = riding ? 16 : 2;
      const tol = Math.max(10, Math.abs(this.vy) + 8) + (riding ? 10 : 0);
      const wasAbove = riding || prevFeet <= sy + half + 1;
      if (this.vy >= -0.5 && feet >= sy - up && feet <= sy + half + tol && wasAbove) {
        if (sy < bestY) { bestY = sy; best = seg; }
      }
    }

    if (best) {
      this.y = bestY - this.h * 0.5;
      this.vy = 0;
      this.grounded = true; this.groundSeg = best;
      this.airJumps = CFG.airJumps;
      this.fastFalling = false;

      if (this.state === ST.HITSTUN && this.hitstun > 0) {
        this.vy = -Math.abs(this.vy) * 0.2; this.vx *= 0.7;
      } else if (this.state === ST.AIR || this.state === ST.AIRDODGE) {
        this.setState(ST.LANDLAG, CFG.landLag);
        Snd.land();
        FX.burst(this.x, this.feetY, 5, "#b9b6d8", 2.4);
      }

      // slope: slide downhill, lose traction as it steepens
      const sA = Math.sin(best.angle);
      this.vx += sA * CFG.slideStrength;
      const loss = Math.abs(sA) * CFG.slopeFrictionLoss;
      if ([ST.IDLE, ST.LANDLAG, ST.SHIELD, ST.SHIELDBREAK].includes(this.state))
        this.vx *= (CFG.groundFriction + loss * (1 - CFG.groundFriction));
      this.vx = clamp(this.vx, -ch.speed * 2.4, ch.speed * 2.4);
    }

    if (Math.abs(this.vx) < 0.02) this.vx = 0;
  }

  /* --------------------------------------------------------- blast zones */
  checkBlastZones(match) {
    const b = Stage.blast;
    if (this.x < b.left || this.x > b.right || this.y < b.top || this.y > b.bottom) this.ko(match);
  }

  ko(match) {
    this.stocks--;
    this.stats.falls++;
    const killer = this.lastHitBy;
    if (killer && killer !== this && killer.alive) { killer.stats.kos++; killer.addMeter(14); }
    Snd.ko();
    FX.shake(20); FX.hitPause(10); FX.flash(this.ch.color, 0.22);
    const ex = clamp(this.x, 40, CFG.world.w - 40), ey = clamp(this.y, 40, CFG.world.h - 40);
    FX.burst(ex, ey, 34, this.ch.color, 11);
    FX.ring(ex, ey, 16, 280, this.ch.color, 4);
    FX.banner(this.stocks > 0 ? "KO!" : `${this.ch.name} OUT!`, this.tint);
    this.setState(ST.DEAD);
    this.respawnTimer = CFG.respawnFrames;
    this.percent = 0; this.vx = 0; this.vy = 0;
    this.lastHitBy = null; this.pinned = false; this.attack = null;
    if (this.grabTarget) this.releaseGrab();
    if (this.grabbedBy) this.grabbedBy.releaseGrab();
    match.onKO(this);
  }

  respawn() {
    this.x = Stage.pivot.x + (this.slot - 1.5) * 90;
    this.y = Stage.pivot.y - 420;
    this.px = this.x; this.py = this.y;
    this.vx = 0; this.vy = 0; this.percent = 0;
    this.shield = CFG.shieldMax;
    this.airJumps = CFG.airJumps;
    this.setState(ST.RESPAWN, CFG.respawnInvuln);
    this.invuln = CFG.respawnInvuln;
    this.alive = true; this.trail.length = 0;
  }
  updateRespawn(inp) {
    this.vy = 0; this.vx *= 0.9;
    if (inp.ax !== 0) { this.x += inp.ax * 3; this.facing = inp.ax; }
    if (--this.stateTimer <= 0 || inp.hit("down") || inp.hit("light")) {
      this.invuln = 40; this.setState(ST.AIR);
    }
  }

  intangible() {
    if (this.invuln > 0) return true;
    if (this.state === ST.AIRDODGE || this.state === ST.ROLL || this.state === ST.SPOTDODGE) {
      const total = this.state === ST.ROLL ? CFG.rollFrames
                  : this.state === ST.SPOTDODGE ? CFG.spotDodgeFrames : CFG.airDodgeFrames;
      const used = total - this.stateTimer;
      return used >= CFG.dodgeInvuln[0] && used <= CFG.dodgeInvuln[1];
    }
    return false;
  }
  shielding() { return this.state === ST.SHIELD; }
}
