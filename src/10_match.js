/* ==========================================================================
   11. MATCH — one bout from countdown to results
   ========================================================================== */

class Match {
  constructor(slots, stageDef) {
    Match.current = this;
    Stage.select(stageDef);
    this.fighters = [];
    slots.forEach((s, i) => {
      if (s.mode === "off") return;
      this.fighters.push(new Fighter(i, s.charId, s.mode === "cpu"));
    });
    Entities.reset();
    FX.reset();
    this.countdown = 170;
    this.over = false; this.endTimer = 0;
    this.frames = 0; this.lastCount = -1;
    this.timeLeft = CFG.matchSeconds * 60;
    this.endedBy = null; this.winner = null;
    Snd.startMusic(stageDef);
  }

  onKO() {
    const standing = this.fighters.filter(x => x.stocks > 0);
    if (standing.length <= 1) this.endMatch(standing[0] || null, "ko");
  }

  endOnTime() {
    const live = this.fighters.filter(f => f.stocks > 0);
    let best = null, tie = false;
    for (const f of live) {
      if (!best) { best = f; continue; }
      if (f.stocks > best.stocks) { best = f; tie = false; }
      else if (f.stocks === best.stocks) {
        if (f.percent < best.percent) { best = f; tie = false; }
        else if (f.percent === best.percent) tie = true;
      }
    }
    this.endMatch(tie ? null : best, "time");
  }

  endMatch(winner, reason) {
    if (this.over) return;
    this.over = true; this.endTimer = 120;
    this.winner = winner; this.endedBy = reason;
    Snd.stopMusic();
    FX.flash("#ffffff", 0.3);
    if (reason === "time") FX.banner("TIME!", "#ffc83d");
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
    else if (this.timeLeft === 10 * 60) FX.banner("10 SECONDS", "#ffc83d");

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

    FX.drawOverlay(g);
    drawOffscreenMarkers(this.fighters, cam);
    drawBalanceBar();
    drawClock(this.timeLeft);
    drawPlayerHUD(this.fighters);
    drawBanner();

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

    g.save();
    g.font = `700 10px ${FONT_MONO}`;
    g.textAlign = "right"; g.fillStyle = "rgba(255,255,255,.16)";
    g.fillText("COOL MATT GAMES", W - 16, H - 10);
    g.restore();
  }
}
Match.current = null;
