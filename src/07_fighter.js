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

/* How long Orbit's Keel Anchor braces her. It used to borrow the stage's
   anchor timer; it is her own now. */
const ANCHOR_FRAMES = 180;

class Fighter {
  /** team is 0 or 1 in a 2v2, and null in free-for-all. look is the
      player's cosmetics ({ cos, name }); it changes nothing but the paint. */
  constructor(slot, charId, isCPU, team, look) {
    this.slot = slot;
    this.cos = Cosmetics.clean(look && look.cos);
    this.name = cleanName(look && look.name);
    this.ch = Cosmetics.skinned(CHAR_BY_ID[charId], this.cos && this.cos.s);
    this.isCPU = isCPU;
    this.team = team == null ? null : team;
    this.pad = new Pad(slot);
    this.tint = this.team == null ? PLAYER_TINT[slot] : TEAM_TINT[this.team];
    this.stats = { kos: 0, damageDealt: 0, falls: 0, supers: 0, bestHit: 0 };
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
    this.heavyStomp = 0;
    this.anchorGlow = 0; this.flipGlow = 0;
    this.launchFx = 0;        // frames of smoke trail after a SMASH-strength hit
    this.stealWait = 0;       // a CPU that is out counts this up before stealing
    /* ---- status effects. Each is a frame countdown; see STATUS below. ---- */
    this.slowT = 0;           // Rime's chill: moves and jumps slower
    this.frozenT = 0;         // Rime's Absolute Zero: encased, cannot act
    this.curseT = 0;          // Hex: takes more knockback
    this.rootT = 0;           // Sprout: feet held to the floor
    this.stealthT = 0;        // Shade: nearly invisible
    this.ambushT = 0;         // Shade: the next hit out of stealth is stronger
    this.echoT = 0;           // Echo's Deja Vu: damage taken now comes back later
    this.echoDmg = 0; this.echoBy = null;
    this.burnT = 0; this.burnBy = null;   // Magma: on fire, takes damage over time
    this.markT = 0; this.markBy = null;   // a generic "marked" status a fighter can own
    /* Scratch state the third wave of fighters keeps on themselves (charge,
       combo count, polarity...). Small and flat: it ships in every snapshot. */
    if (full || !this.v) this.v = {};
    this.posHist = [];        // Echo: where she has been, for Recall
    this.specialCD = 0;
    this.pinned = false;
    this.hotTick = 0;         // cooldown between burns from a hot platform
    this.weightMul = 1;       // Husk doubles his own mass while planted
    this.counter = 0;         // Mira's riposte window, in frames
    this.counterFlash = 0;    // purely cosmetic afterglow on a successful one
    this.hover = 0;           // Kite's remaining hover charge
    this.moveLog = [];        // recent connects, for stale-move negation
    this.armorDamage = 0;     // damage absorbed by the current super's armour
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
  /** Ground and air speed: chilled is slower, stealthed is a little faster. */
  get moveMul() { return (this.slowT > 0 ? 0.55 : 1) * (this.stealthT > 0 ? 1.15 : 1); }

  /* ----------------------------------------------------- status effects */
  tickStatus() {
    if (this.slowT > 0) {
      this.slowT--;
      if (this.slowT % 9 === 0) FX.spark(this.x + rnd(-14, 14), this.y + rnd(-20, 20), "#d4f1ff");
    }
    if (this.frozenT > 0 && --this.frozenT === 0) {
      FX.burst(this.x, this.y, 14, "#d4f1ff", 4);
      Snd.tone(1600, 0.08, "triangle", 0.08, 2400);
    }
    if (this.curseT > 0) this.curseT--;
    if (this.rootT > 0 && (--this.rootT === 0 || !this.grounded)) this.rootT = 0;
    if (this.stealthT > 0) this.stealthT--;
    if (this.ambushT > 0) this.ambushT--;
    if (this.burnT > 0) {
      this.burnT--;
      if (this.burnT % 6 === 0) FX.spark(this.x + rnd(-12, 12), this.y + rnd(-22, 14), pick(["#ff7a1a", "#ffd23d"]));
      if (this.burnT % 20 === 0 && this.alive && this.state !== ST.DEAD) {
        this.percent += 1; this.hitFlash = 2;
        if (this.burnBy) this.burnBy.stats.damageDealt += 1;
      }
      if (this.burnT === 0) this.burnBy = null;
    }
    if (this.markT > 0 && --this.markT === 0) this.markBy = null;
    if (this.echoT > 0 && --this.echoT === 0) this.echoBack();
    if (this.ch.recall) {
      this.posHist.push({ x: this.x, y: this.y, p: this.percent });
      if (this.posHist.length > this.ch.recall) this.posHist.shift();
    }
  }

  /** Echo's Deja Vu runs out: everything taken during it lands again. */
  echoBack() {
    const by = this.echoBy, dmg = Math.min(this.echoDmg, 24);
    this.echoBy = null; this.echoDmg = 0;
    if (!by || dmg < 1 || !this.alive || this.state === ST.DEAD) return;
    const dirX = this.x >= by.x ? 1 : -1;
    const rad = 50 * Math.PI / 180;
    const mag = (CFG.kbBase + 4.6 + dmg * CFG.kbDamageScale + this.percent * CFG.kbPercentScale * 1.0 * 1.9)
              * ((CFG.kbWeightRef + 0.55) / (this.ch.weight + 0.55));
    FX.ring(this.x, this.y, 8, 160, by.ch.color, 4);
    FX.damageText(this.x, this.y - 44, "ECHO", by.ch.accent);
    FX.burst(this.x, this.y, 20, by.ch.color, 7);
    Snd.superHit();
    this.applyKnockback(Math.cos(rad) * mag * dirX, -Math.sin(rad) * mag, dmg, mag, by);
    by.stats.damageDealt += dmg;
  }

  /** Leaving stealth by attacking primes an ambush for the next hit. */
  breakStealth() {
    if (this.stealthT <= 0) return;
    this.stealthT = 0;
    this.ambushT = 40;
    FX.ring(this.x, this.y, 6, 60, this.ch.accent, 2);
  }
  get inSuper() { return this.attack && this.attack.kind === "super"; }

  addMeter(v) {
    const m = Match.current;
    if (v > 0 && m && m.frenzy) v *= CFG.meter.frenzyMul;
    this.meter = clamp(this.meter + v, 0, CFG.meter.max);
  }

  /* ---------------------------------------------------- stale moves ----
     Every connect is remembered for a while. The more of the recent window a
     move occupies, the less it does — so leaning on one strong button costs
     you damage and mixing your options is worth something. Only connects
     count: whiffing a move never stales it. */
  recordMove(move) {
    if (!move || !move.name) return;
    this.moveLog.push({ name: move.name, at: this.animTime });
    if (this.moveLog.length > CFG.skill.staleWindow) this.moveLog.shift();
  }
  staleMul(move) {
    if (!move || !move.name) return 1;
    const K = CFG.skill;
    // entries older than the refresh window have freshened and no longer count
    const recent = this.moveLog.filter(e => this.animTime - e.at < K.staleRefresh);
    const n = recent.filter(e => e.name === move.name).length;
    return K.staleSteps[Math.min(n, K.staleSteps.length - 1)];
  }
  setState(s, t = 0) { this.state = s; this.stateTimer = t; }
  canAct() { return [ST.IDLE, ST.RUN, ST.AIR].includes(this.state); }

  /* ================================================================ update */
  update(match) {
    this.px = this.x; this.py = this.y;
    this.animTime++;

    if (this.state === ST.DEAD) {
      if (this.respawnTimer > 0) this.respawnTimer--;
      if (this.respawnTimer <= 0) {
        if (this.stocks > 0) this.respawn();
        else { this.alive = false; this.tryStockSteal(match); }
      }
      return;
    }
    if (!this.alive) return;

    this.pad.poll();
    const inp = this.buffered(this.isCPU ? CPU.think(this, match) : this.pad);

    if (this.invuln > 0) this.invuln--;
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.heavyStomp > 0) this.heavyStomp--;
    if (this.specialCD > 0) this.specialCD--;
    if (this.hotTick > 0) this.hotTick--;
    if (this.counter > 0) this.counter--;
    if (this.counterFlash > 0) this.counterFlash--;
    if (this.notReadyT > 0) this.notReadyT--;
    if (this.thornsT > 0) this.thornsT--;
    if (this.anchorGlow > 0) this.anchorGlow--;
    if (this.flipGlow > 0) this.flipGlow--;
    if (this.launchFx > 0) {
      this.launchFx--;
      if (this.launchFx % 2 === 0) FX.burst(this.x, this.y, 2, "#ffffff", 1.2);
    }
    this.tickStatus();

    /* Frozen solid: no input at all. The block still falls and slides, and
       the next hit shatters it (see applyKnockback). */
    if (this.frozenT > 0) {
      this.attack = null; this.pinned = false;
      if (this.grounded) this.vx *= 0.9;
      this.integrate();
      this.checkBlastZones(match);
      return;
    }
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
    if (inp.hit("up") && this.rootT <= 0) { this.setState(ST.JUMPSQUAT, CFG.jumpSquat); this.squatHeld = true; return; }

    if (inp.ay > 0 && this.groundSeg && !this.groundSeg.solid && this.rootT <= 0) {
      this.grounded = false; this.groundSeg = null;
      this.dropThrough = 10; this.setState(ST.AIR); this.y += 6;
      return;
    }

    // rooted: feet stay put (attacks, shield and turning still work)
    const target = this.rootT > 0 ? 0 : ax * ch.speed * this.moveMul;
    this.vx += (target - this.vx) * (ax !== 0 ? ch.accel * 0.45 : 0.35);
    this.setState(Math.abs(this.vx) > 0.6 ? ST.RUN : ST.IDLE);
    if (ax !== 0) this.facing = ax;
  }

  updateJumpSquat(inp) {
    this.squatHeld = this.squatHeld && inp.held("up");
    if (--this.stateTimer <= 0) {
      this.vy = -this.ch.jump * (this.squatHeld ? 1 : CFG.shortHopMul) * (this.slowT > 0 ? 0.86 : 1);
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
      const am = this.moveMul;
      this.vx = clamp(this.vx + inp.ax * ch.accel * 0.42 * am, -ch.airSpeed * 1.6 * am, ch.airSpeed * 1.6 * am);
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
    this.breakStealth();
    this.clearBuffer();
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

  /* Input buffer. A button pressed a few frames before the fighter can act
     on it (landing lag, the tail of an attack, a jump's squat) is remembered
     and fires on the first frame it can, instead of being silently dropped —
     which read as "my special did nothing". */
  buffered(raw) {
    const b = this.buf || (this.buf = {});
    for (const k of BUFFERED) {
      if (raw.hit(k)) b[k] = CFG.inputBuffer;
      else if (b[k] > 0) b[k]--;
    }
    return {
      ax: raw.ax, ay: raw.ay,
      held: k => raw.held(k),
      hit: k => raw.hit(k) || (b[k] > 0 && BUFFERED.includes(k)),
    };
  }
  clearBuffer() { this.buf = null; }

  startSpecial() {
    if (this.specialCD > 0) {
      // say so, rather than doing nothing (once per press, not every buffered frame)
      if (!this.notReadyT) {
        this.notReadyT = 30;
        FX.damageText(this.x, this.y - this.h * 0.7, "NOT READY", "#8f8cb5");
        Snd.tone(150, 0.06, "square", 0.06, 110);
      }
      return;
    }
    this.clearBuffer();
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
    this.breakStealth();
    this.clearBuffer();
    const m = this.ch.super;
    this.meter = 0;
    this.armorDamage = 0;
    this.stats.supers++;
    this.attack = {
      kind: "super", data: Object.assign({}, m), t: 0,
      total: m.startup + m.active + m.recovery,
      hitId: HITID++, hitIds: null, fired: false, landed: false,
    };
    this.setState(ST.ATTACK);
    this.invuln = Math.max(this.invuln, m.startup + 4);
    FX.punch(0.6);
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
    this.breakStealth();
    this.clearBuffer();
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
    /* A live counter window eats the hit outright and answers it. Checked
       before armour and before `pinned` so a counter beats everything except
       being already dead. */
    if (this.counter > 0 && from && from.alive) {
      this.counter = 0;
      this.counterFlash = 24;
      this.invuln = Math.max(this.invuln, 14);
      const ripo = this.ch.riposte || { dmg: 11, base: 5.5, scale: 1.1, angle: 40 };
      const dirX = from.x >= this.x ? 1 : -1;
      const kb = CFG.kbBase + ripo.base + ripo.dmg * CFG.kbDamageScale
               + from.percent * CFG.kbPercentScale * ripo.scale * 1.9;
      const m2 = kb * ((CFG.kbWeightRef + 0.55) / (from.ch.weight + 0.55));
      const rad = ripo.angle * Math.PI / 180;
      from.applyKnockback(Math.cos(rad) * m2 * dirX, -Math.sin(rad) * m2,
                          ripo.dmg, m2, this);
      this.stats.damageDealt += ripo.dmg;
      this.addMeter(ripo.dmg * CFG.meter.onDeal);
      FX.banner("RIPOSTE", this.ch.accent);
      FX.hitPause(12); FX.shake(13);
      FX.flash(this.ch.color, 0.2);
      FX.ring(this.x, this.y, 10, 150, this.ch.accent, 4);
      FX.blade(this.x, this.y - 6, dirX > 0 ? 0 : Math.PI, 30, 96, 2.4,
               this.ch.accent, { w: 16, life: 16, spin: dirX * 0.08 });
      Snd.superHit();
      return;
    }
    /* Supers have armour during their active window, but it is no longer
       unconditional: enough damage breaks through and interrupts the super.
       Unbreakable armour meant a super, once started, could never be
       contested — the opponent's only option was to run. */
    if (CFG.meter.superArmor && this.inSuper && this.attack.t > this.attack.data.startup) {
      this.armorDamage = (this.armorDamage || 0) + dmg;
      if (this.armorDamage < CFG.meter.superArmorHp) {
        this.percent = Math.min(999, this.percent + dmg * 0.5);
        this.hitFlash = 4;
        this.addMeter(dmg * CFG.meter.onTake);
        FX.ring(this.x, this.y, 8, this.ch.hurt * 2, "#ffffff", 2);
        return;
      }
      // armour broken: the super is cancelled and the hit lands in full
      this.attack = null;
      this.pinned = false;
      this.armorDamage = 0;
      FX.banner("ARMOUR BREAK", "#ffffff");
      FX.burst(this.x, this.y, 22, "#ffffff", 8);
      FX.shake(14);
      Snd.shieldBreak();
    }
    // Husk planted with Dead Weight: whoever hits it takes half back
    if (this.thornsT > 0 && from && from !== this && from.alive && !allies(this, from)) {
      from.percent = Math.min(999, from.percent + dmg * 0.5);
      from.hitFlash = 6;
      this.stats.damageDealt += dmg * 0.5;
      FX.damageText(from.x, from.y - 30, Math.round(dmg * 5) / 10, this.ch.accent);
      FX.burst(from.x, from.y, 10, this.ch.accent, 4);
      Snd.tone(220, 0.08, "square", 0.1, 90);
    }
    if (this.pinned) { this.percent += dmg * 0.4; this.hitFlash = 4; return; }

    // frozen: the hit shatters the ice and lands harder for it
    if (this.frozenT > 0) {
      this.frozenT = 0;
      dmg += 7; vx *= 1.25; vy *= 1.25; mag *= 1.25;
      FX.burst(this.x, this.y, 30, "#d4f1ff", 9);
      FX.ring(this.x, this.y, 8, 120, "#ffffff", 4);
      FX.damageText(this.x, this.y - 44, "SHATTER", "#d4f1ff");
      Snd.shieldBreak();
    }
    // cursed: flies further from everything
    if (this.curseT > 0) { vx *= 1.22; vy *= 1.22; mag *= 1.22; }
    // marked by Deja Vu: remember it, it comes back
    if (this.echoT > 0) this.echoDmg += dmg;
    // any hit knocks a hidden fighter out of hiding
    if (this.stealthT > 0) this.stealthT = 0;

    // Orbit's Keel Anchor: full damage still lands, but the brace halves
    // how far it sends her — survivability, not immunity.
    if (this.anchorGlow > 0) { vx *= 0.55; vy *= 0.55; mag *= 0.55; }

    // Kite's footing: she doesn't fly as far or stay stunned as long.
    if (this.ch.footing) {
      const k = 1 - this.ch.footing * 0.18;
      vx *= k; vy *= k; mag *= k;
    }

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
    const fallV = this.vy;
    this.x += this.vx;
    this.y += this.vy;

    /* Howling Peak's gusts. A push on position rather than velocity, so it
       can't stack with air drag into a runaway; grounded fighters dig in and
       take half, and Kite's footing shrugs off most of it. */
    const wind = Stage.def.wind ? Stage.windNow().x : 0;
    if (wind && this.state !== ST.RESPAWN && !this.pinned)
      this.x += wind * (this.grounded ? 0.5 : 1) * (1 - (ch.footing || 0) * 0.6);

    /* Ground collision. A fighter already riding a segment gets a wider
       capture band so a drifting platform carries them along instead of
       dropping them through. */
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

    /* Spore Hollow's caps: arriving from the air launches you straight back
       up with your jumps refreshed. Dropping through still works. */
    if (best && best.local.bounce && best !== wasSeg && fallV > 1) {
      this.y = bestY - this.h * 0.5;
      this.vy = -best.local.bounce;
      this.airJumps = CFG.airJumps;
      this.fastFalling = false;
      if (best.fx) best.fx.squash = 14;
      Snd.tone(180, 0.16, "sine", 0.14, 520);
      FX.ring(this.x, this.feetY, 6, 50, Stage.pal.soft, 2);
      best = null;
      if (this.state === ST.LANDLAG) this.setState(ST.AIR);
    }

    if (best) {
      this.y = bestY - this.h * 0.5;
      this.vy = 0;
      // Rust Line: the belt carries whoever is standing on it
      if (best.local.belt && best.fx) this.x += best.fx.belt;
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

      if ([ST.IDLE, ST.LANDLAG, ST.SHIELD, ST.SHIELDBREAK].includes(this.state))
        this.vx *= CFG.groundFriction;
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
    FX.punch(0.9);
    FX.banner(this.stocks > 0 ? "KO!" : `${this.ch.name} OUT!`, this.tint);
    this.setState(ST.DEAD);
    this.respawnTimer = CFG.respawnFrames;
    this.percent = 0; this.vx = 0; this.vy = 0;
    this.lastHitBy = null; this.pinned = false; this.attack = null;
    this.moveLog = []; this.armorDamage = 0; this.launchFx = 0;
    this.slowT = this.frozenT = this.curseT = this.rootT = 0;
    this.stealthT = this.ambushT = this.echoT = 0; this.echoDmg = 0; this.posHist.length = 0;
    this.burnT = this.markT = 0; this.burnBy = this.markBy = null;
    if (this.grabTarget) this.releaseGrab();
    if (this.grabbedBy) this.grabbedBy.releaseGrab();
    match.onKO(this);
  }

  /* ------------------------------------------------------- stock steal ----
     2v2 only. A fighter who is out of stocks can take one from a teammate who
     has two or more and come straight back in, so one bad stock does not bench
     a player for the rest of the match. */
  canStealStock() {
    const m = Match.current;
    if (!m || !m.teams || m.over || this.stocks > 0) return false;
    return m.fighters.some(o => o !== this && o.team === this.team && o.stocks >= 2);
  }
  tryStockSteal(match) {
    if (!this.canStealStock()) { this.stealWait = 0; return; }
    let want;
    if (this.isCPU) want = ++this.stealWait > 150;
    else { this.pad.poll(); want = this.pad.hit("special") || this.pad.hit("super"); }
    if (!want) return;
    const mate = match.fighters.find(o => o !== this && o.team === this.team && o.stocks >= 2);
    mate.stocks--;
    this.stocks = 1; this.stealWait = 0;
    FX.banner("STOCK STEAL", this.tint);
    Snd.uiBig();
    this.respawn();
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
