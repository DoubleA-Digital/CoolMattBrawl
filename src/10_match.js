/* ==========================================================================
   11. MATCH — one bout from countdown to results
   ========================================================================== */

class Match {
  /** opts.teams turns on 2v2: each slot's team field picks its side. */
  constructor(slots, stageDef, opts) {
    Match.current = this;
    Stage.select(stageDef);
    this.teams = !!(opts && opts.teams);
    this.fighters = [];
    slots.forEach((s, i) => {
      if (s.mode === "off") return;
      this.fighters.push(new Fighter(i, s.charId, s.mode === "cpu",
                                     this.teams ? (s.team || 0) : null, s));
    });
    Entities.reset();
    FX.reset();
    this.countdown = 170;
    this.over = false; this.endTimer = 0;
    this.frames = 0; this.lastCount = -1;
    this.timeLeft = CFG.matchSeconds * 60;
    this.endedBy = null; this.winner = null; this.winTeam = null;
    this.frenzy = false; this.suddenDeath = false;
    this.darkT = 0;             // Shade's Nightfall: frames of darkness left
    Snd.startMusic(stageDef);
  }

  /* A "side" is a team in 2v2 and a single fighter in free-for-all, so the
     win checks below are written once for both modes. */
  sideOf(f) { return this.teams ? "t" + f.team : "p" + f.slot; }
  sides() {
    const map = new Map();
    for (const f of this.fighters) {
      const k = this.sideOf(f);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(f);
    }
    return [...map.values()];
  }

  onKO() {
    const standing = this.sides().filter(side => side.some(f => f.stocks > 0));
    if (standing.length <= 1) {
      const side = standing[0];
      this.endMatch(side ? side.find(f => f.stocks > 0) : null, "ko");
    }
  }

  endOnTime() {
    const live = this.sides().filter(side => side.some(f => f.stocks > 0));

    if (this.suddenDeath) {
      // sudden death ran out too: the least damaged side takes it
      const pct = side => Math.min(...side.filter(f => f.stocks > 0).map(f => f.percent));
      live.sort((a, b) => pct(a) - pct(b));
      const tie = live.length > 1 && pct(live[0]) === pct(live[1]);
      this.endMatch(tie || !live.length ? null : live[0].find(f => f.stocks > 0), "time");
      return;
    }

    if (!live.length) { this.endMatch(null, "time"); return; }
    const stocks = side => side.reduce((n, f) => n + Math.max(0, f.stocks), 0);
    const top = Math.max(...live.map(stocks));
    const leaders = live.filter(side => stocks(side) === top);
    if (leaders.length === 1) this.endMatch(leaders[0].find(f => f.stocks > 0), "time");
    else this.startSuddenDeath(leaders);
  }

  /* Level on stocks at the buzzer: everyone still standing on a tied side
     comes back on one stock at high damage, and the next KO ends it. */
  startSuddenDeath(sides) {
    const tied = new Set(sides.flat());
    for (const f of this.fighters) {
      if (f.stocks <= 0) continue;
      if (tied.has(f)) {
        f.stocks = 1;
        f.respawn();
        f.percent = CFG.suddenDeathPercent;
        f.attack = null;
      } else {
        f.stocks = 0; f.alive = false; f.setState(ST.DEAD); f.respawnTimer = 0;
      }
    }
    Entities.reset();
    this.suddenDeath = true; this.frenzy = false;
    this.timeLeft = CFG.suddenDeathSeconds * 60;
    FX.banner("SUDDEN DEATH", "#ff2e88");
    FX.flash("#ff2e88", 0.35); FX.shake(18);
    Snd.superCharge();
  }

  endMatch(winner, reason) {
    if (this.over) return;
    this.over = true; this.endTimer = 120;
    this.winner = winner; this.endedBy = reason;
    this.winTeam = winner && this.teams ? winner.team : null;
    Snd.stopMusic();
    FX.flash("#ffffff", 0.3);
    if (reason === "time" && !winner) FX.banner("TIME — DRAW", "#ffc83d");
    else if (this.winTeam != null) FX.banner(`${TEAM_NAME[this.winTeam]} TEAM WINS`, TEAM_TINT[this.winTeam]);
    else FX.banner(winner ? `${winner.ch.name} WINS` : "DRAW", winner ? winner.tint : "#fff");
  }

  update() {
    // Hit pause freezes the simulation but keeps FX alive. Inputs are not
    // polled here, so a press during the freeze still lands on the next frame.
    if (FX.pause > 0) { FX.pause--; FX.update(this.fighters); return; }

    if (this.countdown > 0) {
      this.countdown--;
      const step = Math.floor(this.countdown / 40);
      if (step !== this.lastCount) { this.lastCount = step; Snd.count(step); }
      for (const f of this.fighters) { f.pad.poll(); f.px = f.x; f.py = f.y; f.integrate(); }
      Stage.update(this.fighters);
      FX.update(this.fighters);
      return;
    }

    /* Once the match is decided the fighters freeze for the victory beat.
       Letting them keep playing would also let the winner lose their last
       stock during the flourish, which would corrupt the final standings. */
    if (this.over) {
      FX.update(this.fighters);
      Stage.update(this.fighters);
      if (--this.endTimer <= 0) Game.toResults(this);
      return;
    }

    this.frames++;
    if (--this.timeLeft <= 0) { this.timeLeft = 0; this.endOnTime(); }
    else if (!this.suddenDeath && this.timeLeft === CFG.frenzySeconds * 60) {
      this.frenzy = true;
      FX.banner("FRENZY!", "#ffc83d");
      FX.flash("#ffc83d", 0.25);
      Snd.superCharge();
    }
    else if (this.timeLeft === 10 * 60) FX.banner("10 SECONDS", "#ffc83d");

    if (this.darkT > 0) this.darkT--;
    for (const f of this.fighters) f.update(this);
    Combat.resolve(this.fighters);
    Entities.update(this.fighters);
    Stage.update(this.fighters);
    FX.update(this.fighters);
  }

  draw(alpha) {
    drawBackground();
    g.save();
    const cam = FX.applyCamera(g, alpha);
    drawStage(alpha);
    Entities.draw(g);
    for (const f of this.fighters) drawFighter(f, alpha);
    FX.drawWorld(g);
    g.restore();

    /* The banner and the countdown are drawn before the post pass rather than
       after it, so the banners and BRAWL! bloom like everything else in the
       world. The HUD stays after it and therefore stays crisp. */
    drawBanner();
    this.drawCountdown();

    /* Post-processing runs on the world only: bloom, chroma, flash and
       vignette land here, underneath the HUD, so the readouts stay legible. */
    Light.post(g, cv, W, H);

    FX.drawOverlay(g);
    if (this.darkT > 0) drawDarkness(this, cam, alpha);
    if (Net.hostStalled) {
      g.save();
      g.fillStyle = "rgba(6,5,14,.55)"; g.fillRect(0, H / 2 - 44, W, 70);
      g.textAlign = "center"; g.font = `900 26px ${FONT_DISPLAY}`;
      outlineText(g, "WAITING FOR THE HOST", W / 2, H / 2 - 6, "#ffc83d", 6);
      g.font = `400 12px ${FONT_MONO}`; g.fillStyle = "#b7b4d4";
      g.fillText("The match pauses while the host's game tab is in the background.", W / 2, H / 2 + 16);
      g.restore();
    }
    drawOffscreenMarkers(this.fighters, cam);
    drawClock(this.timeLeft);
    drawPlayerHUD(this.fighters);

    g.save();
    g.font = `700 10px ${FONT_MONO}`;
    g.textAlign = "right"; g.fillStyle = "rgba(255,255,255,.16)";
    g.fillText("COOL MATT GAMES", W - 16, H - 10);
    g.restore();
  }

  drawCountdown() {
    if (this.countdown > 0) {
      const step = Math.floor(this.countdown / 40);
      const txt = step >= 3 ? "READY" : step >= 2 ? "SET" : step >= 1 ? "..." : "BRAWL!";
      const sub = (this.countdown % 40) / 40;
      g.save();
      g.translate(W / 2, H / 2 - 40);
      const s = 1 + (1 - sub) * 0.16;
      g.scale(s, s);
      g.textAlign = "center";
      g.font = `900 92px ${FONT_DISPLAY}`;
      g.shadowColor = step === 0 ? "#b6ff3b" : Stage.pal.platEdge;
      g.shadowBlur = 34;
      outlineText(g, txt, 0, 0, step === 0 ? "#b6ff3b" : Stage.pal.platEdge, 11);
      g.restore();
    }
  }
}
Match.current = null;
