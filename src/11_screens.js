/* ==========================================================================
   12. SCREENS — title, fighter select, stage select, controls, settings,
                 pause and results
   ========================================================================== */

/* Immediate-mode button. Returns true on the frame it is clicked.
   Built from the same panel() as the HUD, so menus and match share one look:
   a stamped plate that physically presses in when hovered. */
function btn(x, y, w, h, label, opts) {
  opts = opts || {};
  const hov = Mouse.x > x && Mouse.x < x + w && Mouse.y > y && Mouse.y < y + h;
  const col = opts.color || "#00e5ff";
  const on = opts.active;
  const dim = opts.disabled;
  const live = (on || hov) && !dim;
  const press = hov && Mouse.down && !dim ? 2 : 0;   // travel on click

  g.save();
  g.translate(0, press);
  panel(g, x, y, w, h, {
    cut: Math.min(10, h * 0.34),
    fill: dim ? "#0d0b1a" : on ? mixColor("#14112a", col, 0.22) : "#14112a",
    // idle buttons keep a hint of their own colour, or a menu of them all
    // reads as one grey stack with nothing to aim at
    accent: dim ? "#2c2745" : live ? col : mixColor(UI.line, col, 0.5),
    accentA: live ? 0.95 : 0.6,
    glow: live ? 16 : 0,
    shadow: !press,
  });
  // a hovered button lights from inside, not just at its border
  if (live) {
    g.save();
    notchPath(g, x, y, w, h, Math.min(10, h * 0.34)); g.clip();
    const q = g.createLinearGradient(0, y, 0, y + h);
    q.addColorStop(0, hexA(col, on ? 0.2 : 0.13));
    q.addColorStop(1, hexA(col, 0));
    g.fillStyle = q; g.fillRect(x, y, w, h);
    g.restore();
  }
  g.fillStyle = dim ? "#55536e" : live ? "#ffffff" : "#b7b4d4";
  g.font = opts.font || `700 15px ${FONT_MONO}`;
  g.textAlign = "center"; g.textBaseline = "middle";
  if (live) { g.shadowColor = col; g.shadowBlur = 10; }
  g.fillText(label, x + w / 2, y + h / 2 + 1);
  g.textBaseline = "alphabetic";
  g.restore();
  return hov && Mouse.click && !dim;
}

/* Screen header: a stamped banner plate rather than floating text, with the
   Cool Matt Games mark above it and rules running out to the margins. */
function screenTitleBar(sub, title, accent) {
  const col = accent || "#00e5ff";
  g.save();
  g.textAlign = "center";

  g.font = `900 44px ${FONT_DISPLAY}`;
  const tw = g.measureText(title).width;
  const bw = Math.max(360, tw + 110), bx = W / 2 - bw / 2;

  // rules out to the edges, stopping clear of the plate
  g.strokeStyle = hexA(col, 0.28); g.lineWidth = 2;
  g.beginPath(); g.moveTo(40, 66); g.lineTo(bx - 18, 66); g.stroke();
  g.beginPath(); g.moveTo(bx + bw + 18, 66); g.lineTo(W - 40, 66); g.stroke();
  g.fillStyle = hexA(col, 0.5);
  for (const dx of [-26, 26]) {
    g.save(); g.translate(W / 2 + (dx < 0 ? bx - 18 - W / 2 : bx + bw + 18 - W / 2), 66);
    g.rotate(Math.PI / 4); g.fillRect(-3, -3, 6, 6); g.restore();
  }

  panel(g, bx, 40, bw, 52, { cut: 16, fill: "#140f2c", accent: col, accentA: 0.8, glow: 14 });
  g.save();
  notchPath(g, bx, 40, bw, 52, 16); g.clip();
  hatch(g, bx, 40, 34, 52, col, 8, 0.2);
  hatch(g, bx + bw - 34, 40, 34, 52, col, 8, 0.2);
  g.restore();

  g.font = `900 44px ${FONT_DISPLAY}`;
  g.shadowColor = col; g.shadowBlur = 20;
  outlineText(g, title, W / 2, 81, "#ffffff", 7);
  g.shadowBlur = 0;

  g.font = `700 11px ${FONT_MONO}`;
  g.fillStyle = "#ff2e88";
  g.fillText(sub, W / 2, 26);
  g.restore();
}

const Game = {
  screen: "title",
  match: null,
  results: null,
  titleT: 0,
  returnTo: "title",      // where Controls/Settings go back to
  rebind: null,           // { player, action } while capturing a key
  stageIndex: 0,
  hoverAction: null,
  joinEntry: null,        // the code being typed on the online screen

  /* team is only read when teams is on. P1/P3 start red, P2/P4 blue. */
  slots: [
    { charId: "BOLDER", mode: "human", team: 0 },
    { charId: "ZIP",    mode: "cpu",   team: 1 },
    { charId: "ORBIT",  mode: "off",   team: 0 },
    { charId: "PIVOT",  mode: "off",   team: 1 },
  ],
  teams: false,           // 2v2 team battle instead of free-for-all
  selIndex: 0,

  /** Why a lineup cannot start yet, or null when it can. */
  startProblem(slots, teams) {
    const on = slots.filter(s => s.mode !== "off");
    if (on.length < 2) return "NEED AT LEAST 2 FIGHTERS";
    if (teams && new Set(on.map(s => s.team || 0)).size < 2)
      return "BOTH TEAMS NEED A FIGHTER";
    return null;
  },

  start() {
    if (this.startProblem(this.slots, this.teams)) return;
    if (Net.active && Net.isHost) { Net.startMatch(); Snd.uiBig(); return; }
    if (Net.active && Net.isGuest) return;          // only the host may start
    this.match = new Match(this.slots, STAGES[this.stageIndex], { teams: this.teams });
    this.screen = "match";
    Snd.uiBig();
  },

  toResults(match) {
    this.results = {
      fighters: match.fighters.slice(),
      winner: match.winner,
      winTeam: match.winTeam,
      teams: match.teams,
      suddenDeath: match.suddenDeath,
      frames: match.frames,
      endedBy: match.endedBy,
      stage: Stage.def,
    };
    this.screen = "results";
    if (Net.active && Net.isHost) Net.setPhase("results");
    Snd.uiBig();
  },

  /* ------------------------------------------------------------- update */
  update() {
    /* Online housekeeping runs whatever screen we are on: the host keeps the
       room state flowing to everyone, and a guest follows it — which is how a
       guest gets pulled into a match, onto the results, or back to the lobby. */
    Net.tick();
    switch (this.screen) {
      case "title":    this.updateTitle(); break;
      case "select":   if (Keys.pressed["Escape"]) { this.screen = "title"; Snd.ui(); }
                       else if (Keys.pressed["Enter"]) this.screen = "stage";
                       break;
      case "stage":    if (Keys.pressed["Escape"]) { this.screen = "select"; Snd.ui(); }
                       else if (Keys.pressed["Enter"]) this.start();
                       break;
      case "controls": if (Keys.pressed["Escape"] && !this.rebind) { this.screen = this.returnTo; Snd.ui(); } break;
      case "settings": if (Keys.pressed["Escape"]) { this.screen = this.returnTo; Snd.ui(); } break;
      case "howto":    if (Keys.pressed["Escape"] || Keys.pressed["Enter"]) { this.screen = "title"; Snd.ui(); } break;
      case "guide":
        if (Keys.pressed["Escape"]) { this.screen = "title"; Snd.ui(); break; }
        if (Keys.pressed["ArrowLeft"])  { this.guidePage = Math.max(0, (this.guidePage || 0) - 1); Snd.ui(); }
        if (Keys.pressed["ArrowRight"]) { this.guidePage = Math.min(ROSTER.length, (this.guidePage || 0) + 1); Snd.ui(); }
        break;
      case "online":   this.updateOnline(); break;
      case "lobby":    this.updateLobby(); break;
      case "match":
        /* Online play pauses nobody: the other player is still fighting, so
           Escape leaves the match instead of freezing a fight they can see. */
        if (Keys.pressed["Escape"]) {
          if (Net.active) { Net.reset(); this.match = null; this.screen = "title"; Snd.ui(); }
          else { this.screen = "pause"; Snd.ui(); }
          break;
        }
        if (Net.active) Net.update(); else this.match.update();
        break;
      case "pause":    if (Keys.pressed["Escape"]) { this.screen = "match"; Snd.ui(); } break;
      case "results":
        if (Net.active) {
          if (Net.isHost && Keys.pressed["Enter"]) this.start();
          if (Keys.pressed["Escape"]) {
            if (Net.isHost) { Net.setPhase("lobby"); this.screen = "lobby"; }
            else { Net.reset(); this.screen = "title"; }
            Snd.ui();
          }
          break;
        }
        if (Keys.pressed["Enter"]) this.start();
        if (Keys.pressed["Escape"]) { this.screen = "select"; Snd.ui(); }
        break;
    }
  },

  draw(alpha) {
    switch (this.screen) {
      case "title":    this.drawTitle(); Light.post(g, cv, W, H); break;
      case "select":   this.drawSelect(); break;
      case "stage":    this.drawStageSelect(); break;
      case "controls": this.drawControls(); break;
      case "settings": this.drawSettings(); break;
      case "howto":    this.drawHowto(); break;
      case "guide":    this.drawGuide(); break;
      case "online":   this.drawOnline(); break;
      case "lobby":    this.drawLobby(); break;
      case "match":    this.match.draw(alpha); break;
      case "pause":    this.match.draw(alpha); this.drawPause(); break;
      case "results":  this.drawResults(); break;
    }
  },

  /* ================================================================ TITLE */
  updateTitle() {
    this.titleT++;
    if (Keys.pressed["Enter"] || Keys.pressed["Space"]) { this.screen = "select"; Snd.uiBig(); }
  },
  drawTitle() {
    Stage.def = STAGES[0];
    drawBackground();

    // decorative beam with the roster lined up on it — flat, like every
    // stage's deck now is, instead of rocking back and forth
    const a = 0;
    /* The beam and the roster share one half-width so they can never disagree.
       This used to be a hard-coded 340 with fighters placed every 156 units
       from -234, which fitted a roster of four exactly -- at eight, the last
       four stood on thin air past the end of the beam. */
    const beamHalf = 430;
    g.save();
    g.translate(W / 2, H * 0.84); g.rotate(a);
    g.fillStyle = "#15102b";
    roundRect(g, -beamHalf, -12, beamHalf * 2, 52, 8); g.fill();
    g.strokeStyle = "#00e5ff"; g.lineWidth = 5;
    g.shadowColor = "#00e5ff"; g.shadowBlur = 24;
    g.beginPath(); g.moveTo(-beamHalf, -12); g.lineTo(beamHalf, -12); g.stroke();
    g.restore();
    g.save();
    g.strokeStyle = "rgba(120,110,170,.4)"; g.lineWidth = 10;
    g.beginPath(); g.moveTo(W / 2, H * 0.84); g.lineTo(W / 2, H); g.stroke();
    g.fillStyle = "#2a2250"; g.shadowColor = "#00e5ff"; g.shadowBlur = 16;
    g.beginPath(); g.arc(W / 2, H * 0.84, 15, 0, 7); g.fill();
    g.restore();

    // spread whatever the roster is evenly along the beam, inside its ends
    const inset = 52, n = ROSTER.length;
    const span = (beamHalf - inset) * 2;
    const step = n > 1 ? span / (n - 1) : 0;
    ROSTER.forEach((c, i) => {
      const lx = -(beamHalf - inset) + i * step;
      const x = W / 2 + lx * Math.cos(a), y = H * 0.84 + lx * Math.sin(a);
      g.save();
      g.translate(x, y - 28); g.rotate(a);
      g.scale(0.78, 0.78);
      c.draw(g, { time: this.titleT + i * 40, runPhase: 0, running: false, air: false,
                  vx: 0, vy: 0, state: ST.IDLE, flash: false, atkPhase: -1 });
      g.restore();
    });

    g.save();
    g.textAlign = "center";
    g.font = `700 14px ${FONT_MONO}`;
    g.fillStyle = "#ff2e88"; g.shadowColor = "#ff2e88"; g.shadowBlur = 18;
    g.fillText("C O O L   M A T T   G A M E S", W / 2, 96);
    g.shadowBlur = 0;

    const bob = Math.sin(this.titleT * 0.028) * 4;
    /* Fit the wordmark to the canvas rather than trusting a fixed size: at
       104px Archivo Black it ran past both edges. */
    let logoPx = 104;
    g.font = `900 ${logoPx}px ${FONT_DISPLAY}`;
    const maxLogoW = W - 120;
    const measured = g.measureText("COOL MATT BRAWL").width;
    if (measured > maxLogoW) {
      logoPx = Math.floor(logoPx * (maxLogoW / measured));
      g.font = `900 ${logoPx}px ${FONT_DISPLAY}`;
    }
    const lg = g.createLinearGradient(W / 2 - 400, 140, W / 2 + 400, 220);
    lg.addColorStop(0, "#00e5ff"); lg.addColorStop(0.5, "#ffffff"); lg.addColorStop(1, "#ff2e88");
    g.shadowColor = "#00e5ff"; g.shadowBlur = 32;
    outlineText(g, "COOL MATT BRAWL", W / 2, 196 + bob, lg, 12);
    g.shadowBlur = 0;

    g.restore();

    /* Two real decisions (START BRAWL, PLAY ONLINE), then the reference
       screens as one tidy row underneath instead of a five-deep stack —
       the menu reads as "the two things you came here to do" at a glance,
       not a list of equally-weighted options. */
    const bw = 300, bx = W / 2 - bw / 2;
    if (btn(bx, 266, bw, 54, "START BRAWL", { color: "#b6ff3b", font: `700 20px ${FONT_MONO}` }))
      { this.screen = "select"; Snd.uiBig(); }
    if (btn(bx, 328, bw, 46, "PLAY ONLINE", { color: "#ff2e88", font: `700 17px ${FONT_MONO}` }))
      { Net.reset(); this.joinEntry = null; this.screen = "online"; Snd.uiBig(); }

    const sw = 96, sgap = 6, sy = 384;
    if (btn(bx, sy, sw, 38, "CONTROLS", { color: "#00e5ff", font: `700 12px ${FONT_MONO}` }))
      { this.returnTo = "title"; this.screen = "controls"; Snd.ui(); }
    if (btn(bx + sw + sgap, sy, sw, 38, "SETTINGS", { color: "#ffc83d", font: `700 12px ${FONT_MONO}` }))
      { this.returnTo = "title"; this.screen = "settings"; Snd.ui(); }
    if (btn(bx + (sw + sgap) * 2, sy, sw, 38, "HOW TO PLAY", { color: "#8a7fff", font: `700 12px ${FONT_MONO}` }))
      { this.screen = "howto"; Snd.ui(); }

    g.save();
    g.textAlign = "center"; g.font = `700 11px ${FONT_MONO}`;
    g.fillStyle = "#6b6a85";
    g.fillText("2-4 PLAYERS LOCAL OR ONLINE  ·  FREE-FOR-ALL OR 2v2  ·  GAMEPADS SUPPORTED", W / 2, 243);
    g.restore();
  },

  /* ======================================================= FIGHTER SELECT */
  drawSelect() {
    Stage.def = STAGES[this.stageIndex];
    drawBackground();
    g.save(); g.fillStyle = "rgba(6,5,14,.68)"; g.fillRect(0, 0, W, H); g.restore();
    screenTitleBar("COOL MATT GAMES", "CHOOSE YOUR FIGHTERS");

    /* Eight fighters will not fit in one row, so the roster is a 4x2 grid of
       compact cards. The full write-up for whichever one you are pointing at
       goes in the panel underneath, which is where there is actually room to
       explain what a character does. */
    const cols = 4, cw = 236, chh = 136, gapX = 18, gapY = 14;
    const gridW = cols * cw + (cols - 1) * gapX;
    const gx0 = (W - gridW) / 2, gy0 = 104;
    let hoverChar = null;

    ROSTER.forEach((c, i) => {
      const col = i % cols, row = (i / cols) | 0;
      const x = gx0 + col * (cw + gapX);
      const cy = gy0 + row * (chh + gapY);
      const hov = Mouse.x > x && Mouse.x < x + cw && Mouse.y > cy && Mouse.y < cy + chh;
      if (hov) hoverChar = c;
      const picked = this.slots.map((s, k) => (s.mode !== "off" && s.charId === c.id) ? k : -1)
                               .filter(k => k >= 0);

      g.save();
      g.translate(0, hov ? -3 : 0);
      panel(g, x, cy, cw, chh, {
        cut: 13, fill: "#110e24", accent: c.color,
        accentA: hov ? 1 : picked.length ? 0.7 : 0.4,
        glow: hov ? 20 : picked.length ? 10 : 0,
      });
      // colour wash + initial watermark
      g.save();
      notchPath(g, x, cy, cw, chh, 13); g.clip();
      const wq = g.createLinearGradient(0, cy + chh, 0, cy + 30);
      wq.addColorStop(0, hexA(c.color, hov ? 0.22 : 0.1));
      wq.addColorStop(1, hexA(c.color, 0));
      g.fillStyle = wq; g.fillRect(x, cy, cw, chh);
      g.globalAlpha = 0.06;
      g.font = `900 120px ${FONT_DISPLAY}`; g.textAlign = "center";
      g.fillStyle = c.color;
      g.fillText(c.name[0], x + cw - 44, cy + 112);
      g.restore();

      /* Art on the left, text on the right. Clipped to the card: several
         fighters are wider than their hurtbox (Kite's sail, Ballast's jib)
         and spilled over the neighbouring card without this. */
      g.save();
      notchPath(g, x + 2, cy + 2, cw - 4, chh - 4, 12); g.clip();
      g.translate(x + 58, cy + chh - 30);
      const sc2 = hov ? 1.20 : 1.12;
      g.scale(sc2, sc2);
      c.draw(g, { time: performance.now() / 16, runPhase: 0, running: false,
                  air: false, vx: 0, vy: 0, state: ST.IDLE, flash: false, atkPhase: -1 });
      g.restore();

      g.textAlign = "left";
      g.font = `900 24px ${FONT_DISPLAY}`;
      g.shadowColor = c.color; g.shadowBlur = hov ? 14 : 8;
      outlineText(g, c.name, x + 104, cy + 40, c.color, 6);
      g.shadowBlur = 0;
      g.font = `700 8px ${FONT_MONO}`;
      g.fillStyle = "#8f8cb5"; g.fillText(c.tag, x + 104, cy + 54);

      const stats = [["WGT", c.weight / 1.5], ["SPD", c.speed / 6], ["JMP", (c.jump - 10.5) / 3.2]];
      let sy = cy + 68;
      stats.forEach(([label, v]) => {
        g.font = `700 8px ${FONT_MONO}`;
        g.fillStyle = "#6b6a85"; g.fillText(label, x + 104, sy + 7);
        slot(g, x + 130, sy + 1, cw - 146, 6, 3);
        bar(g, x + 130, sy + 1, cw - 146, 6, clamp(v, 0.08, 1), c.color, { r: 3 });
        sy += 13;
      });

      picked.forEach((pi, k) => {
        g.save();
        notchPath(g, x + cw - 34 - k * 32, cy + 8, 28, 17, 5);
        g.fillStyle = PLAYER_TINT[pi];
        g.shadowColor = PLAYER_TINT[pi]; g.shadowBlur = 12; g.fill();
        g.restore();
        g.fillStyle = "#07060f"; g.font = `700 10px ${FONT_MONO}`; g.textAlign = "center";
        g.fillText("P" + (pi + 1), x + cw - 20 - k * 32, cy + 20.5);
        g.textAlign = "left";
      });
      g.restore();

      if (hov && Mouse.click) {
        const sl = this.slots[this.selIndex];
        if (sl.mode === "off") sl.mode = this.selIndex === 0 ? "human" : "cpu";
        sl.charId = c.id;
        Snd.ui();
      }
    });

    // ---- slot row ----
    const sw = 268, sgap = 16;
    let sx = (W - (4 * sw + 3 * sgap)) / 2;
    const sy2 = gy0 + 2 * (chh + gapY) + 6;
    this.slots.forEach((s, i) => {
      const c = CHAR_BY_ID[s.charId];
      const sel = this.selIndex === i, off = s.mode === "off";
      g.save();
      g.globalAlpha = off ? 0.5 : 1;
      panel(g, sx, sy2, sw, 92, {
        cut: 12, fill: sel ? mixColor("#14112a", PLAYER_TINT[i], 0.14) : "#110e22",
        accent: PLAYER_TINT[i], accentA: sel ? 1 : 0.45, glow: sel ? 20 : 0,
        only: { tl: 1, br: 1 },
      });
      g.save();
      notchPath(g, sx, sy2, sw, 92, 12, { tl: 1, br: 1 }); g.clip();
      g.fillStyle = hexA(PLAYER_TINT[i], off ? 0.25 : 0.7);
      g.fillRect(sx, sy2, 4, 92);
      g.restore();
      g.textAlign = "left";
      g.font = `700 12px ${FONT_MONO}`; g.fillStyle = PLAYER_TINT[i];
      g.fillText(`PLAYER ${i + 1}`, sx + 14, sy2 + 19);
      g.font = `900 21px ${FONT_DISPLAY}`;
      g.fillStyle = off ? "#4a4866" : c.color;
      g.fillText(off ? "— EMPTY —" : c.name, sx + 14, sy2 + 42);
      if (this.teams && !off) {
        const tc = TEAM_TINT[s.team || 0];
        if (btn(sx + sw - 74, sy2 + 8, 62, 22, TEAM_NAME[s.team || 0],
                { active: true, color: tc, font: `700 10px ${FONT_MONO}` })) {
          s.team = 1 - (s.team || 0); this.selIndex = i; Snd.ui();
        }
      }
      g.font = `400 8px ${FONT_MONO}`; g.fillStyle = "#6b6a85";
      const b = Settings.binds[i];
      g.fillText(`${keyLabel(b.left)}${keyLabel(b.right)} move · ${keyLabel(b.light)} ${keyLabel(b.heavy)} ${keyLabel(b.special)} · ${keyLabel(b.super)} super`,
                 sx + 14, sy2 + 55);
      g.restore();

      [["OFF", "off"], ["HUMAN", "human"], ["CPU", "cpu"]].forEach(([lab, m], k) => {
        if (btn(sx + 12 + k * 80, sy2 + 62, 74, 22, lab, {
          active: s.mode === m,
          color: m === "cpu" ? "#ffc83d" : m === "human" ? "#b6ff3b" : "#6b6a85",
          font: `700 10px ${FONT_MONO}`,
        })) { s.mode = m; this.selIndex = i; Snd.ui(); }
      });
      if (Mouse.x > sx && Mouse.x < sx + sw - 80 && Mouse.y > sy2 && Mouse.y < sy2 + 58 && Mouse.click) {
        this.selIndex = i; Snd.ui();
      }
      sx += sw + sgap;
    });

    /* ---- the write-up: whoever you are pointing at, else your own slot ---- */
    const sc = hoverChar || CHAR_BY_ID[this.slots[this.selIndex].charId];
    const dy = sy2 + 104;
    panel(g, 90, dy, W - 180, 112, {
      cut: 14, fill: "#100d20", accent: sc.color, accentA: 0.6, glow: 8,
    });
    g.save();
    g.textAlign = "left";
    g.font = `900 20px ${FONT_DISPLAY}`; g.fillStyle = sc.color;
    g.fillText(sc.name, 110, dy + 27);
    const nameW = g.measureText(sc.name).width;      // measured in THIS font
    g.font = `700 9px ${FONT_MONO}`; g.fillStyle = "#8f8cb5";
    g.fillText(sc.tag, 110 + nameW + 14, dy + 26);

    g.font = `400 12px ${FONT_MONO}`; g.fillStyle = "#b7b4d4";
    g.fillText(sc.blurb, 110, dy + 48);
    if (sc.power) {
      g.font = `700 8px ${FONT_MONO}`; g.fillStyle = "#6b6a85";
      g.fillText("POWER", 110, dy + 66);
      g.font = `400 12px ${FONT_MONO}`; g.fillStyle = sc.accent;
      g.fillText(sc.power, 158, dy + 66);
    }

    const moves = [
      ["LIGHT", sc.light.name, "#b7b4d4"],
      ["HEAVY", sc.heavy.name, "#b7b4d4"],
      ["SPECIAL", sc.special.name, sc.accent],
      ["SUPER", sc.super.name, "#ffffff"],
    ];
    let mx = 110;
    moves.forEach(([lab, nm, col]) => {
      g.font = `700 8px ${FONT_MONO}`; g.fillStyle = "#6b6a85";
      g.fillText(lab, mx, dy + 88);
      g.font = `700 12px ${FONT_MONO}`; g.fillStyle = col;
      g.fillText(nm.toUpperCase(), mx, dy + 103);
      mx += 268;
    });
    g.restore();

    const problem = this.startProblem(this.slots, this.teams);
    g.save();
    g.textAlign = "center";
    g.font = `700 10px ${FONT_MONO}`;
    g.fillStyle = problem ? "#ff2e88" : "#b6ff3b";
    g.fillText(problem || `SELECTED SLOT: PLAYER ${this.selIndex + 1} — click a fighter to assign`
      + (this.teams ? " · click RED / BLUE to switch team" : ""), W / 2, dy + 128);
    g.restore();

    if (btn(W / 2 - 480, H - 62, 150, 42, "◀ BACK", { color: "#ff2e88" }))
      { this.screen = "title"; Snd.ui(); }
    if (btn(W / 2 - 318, H - 62, 170, 42, "FIGHTER GUIDE", { color: "#ffc83d" }))
      { this.guidePage = ROSTER.indexOf(sc) + 1; this.screen = "guide"; Snd.ui(); }
    if (btn(W / 2 - 136, H - 62, 250, 42, this.teams ? "MODE: 2v2 TEAMS" : "MODE: FREE-FOR-ALL",
        { color: this.teams ? "#ff4f6a" : "#8a7fff", active: this.teams }))
      { this.teams = !this.teams; Snd.ui(); }
    if (btn(W / 2 + 126, H - 62, 230, 42, "PICK STAGE ▶",
        { color: problem ? "#444" : "#b6ff3b", disabled: !!problem, font: `700 16px ${FONT_MONO}` }))
      { this.screen = "stage"; Snd.uiBig(); }
  },

  /* ========================================================= STAGE SELECT */
  drawStageSelect() {
    Stage.def = STAGES[this.stageIndex];
    drawBackground();
    g.save(); g.fillStyle = "rgba(6,5,14,.55)"; g.fillRect(0, 0, W, H); g.restore();
    screenTitleBar("COOL MATT GAMES", "PICK YOUR STAGE");

    const cw = 282, gap = 18;
    let x = (W - (STAGES.length * cw + (STAGES.length - 1) * gap)) / 2;
    const cy = 124, chh = 320;

    STAGES.forEach((s, i) => {
      const hov = Mouse.x > x && Mouse.x < x + cw && Mouse.y > cy && Mouse.y < cy + chh;
      const sel = this.stageIndex === i;
      g.save();
      // the card as a stamped plate, lifting on hover
      const lift = hov && !sel ? -3 : 0;
      g.translate(0, lift);
      panel(g, x, cy, cw, chh, {
        cut: 15, fill: "#100d22", accent: s.pal.platEdge,
        accentA: sel ? 1 : hov ? 0.8 : 0.42,
        glow: sel ? 24 : hov ? 14 : 0,
      });

      // live thumbnail of the stage's own background + deck, in a recessed well
      g.save();
      notchPath(g, x + 10, cy + 10, cw - 20, 150, 9); g.clip();
      g.save();
      g.translate(x + 10, cy + 10);
      g.scale((cw - 20) / W, 150 / H * 2.0);
      g.translate(0, -H * 0.18);
      s.drawBg.call(s, g, performance.now() / 1000 + i * 7);
      g.restore();
      // mini deck line, drawn inside the clip so it can't escape the well
      g.save();
      g.translate(x + cw / 2, cy + 128);
      const half = Math.abs(s.layout[0].x2) * 0.30;
      g.strokeStyle = s.pal.platEdge; g.lineWidth = 4;
      g.shadowColor = s.pal.platEdge; g.shadowBlur = 14;
      g.beginPath(); g.moveTo(-half, 0); g.lineTo(half, 0); g.stroke();
      g.restore();
      // a scanline wash sells it as a monitor feed rather than a picture
      g.globalAlpha = 0.14; g.fillStyle = "#000";
      for (let sy = cy + 10; sy < cy + 160; sy += 4) g.fillRect(x + 10, sy, cw - 20, 2);
      g.restore();
      notchPath(g, x + 10, cy + 10, cw - 20, 150, 9);
      g.strokeStyle = UI.ink; g.lineWidth = 3; g.stroke();
      screw(g, x + 19, cy + 19, 2.2, UI.line);
      screw(g, x + cw - 19, cy + 19, 2.2, UI.line);

      g.textAlign = "center";
      g.font = `900 26px ${FONT_DISPLAY}`;
      outlineText(g, s.name, x + cw / 2, cy + 192, s.pal.platEdge, 6);
      g.font = `700 9px ${FONT_MONO}`; g.fillStyle = "#8f8cb5";
      g.fillText(s.tag, x + cw / 2, cy + 208);
      // a divider rule under the title, in the stage's own colour
      g.strokeStyle = hexA(s.pal.platEdge, 0.3); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x + 34, cy + 218); g.lineTo(x + cw - 34, cy + 218); g.stroke();

      // wrapped blurb
      g.font = `400 11px ${FONT_MONO}`; g.fillStyle = "#b7b4d4";
      const words = s.blurb.split(" ");
      let line = "", ly = cy + 230;
      for (const wd of words) {
        if (g.measureText(line + wd).width > cw - 34) { g.fillText(line, x + cw / 2, ly); line = wd + " "; ly += 15; }
        else line += wd + " ";
      }
      g.fillText(line, x + cw / 2, ly);

      if (sel) {
        g.fillStyle = s.pal.platEdge;
        g.font = `700 10px ${FONT_MONO}`;
        g.fillText("● SELECTED", x + cw / 2, cy + chh - 14);
      }
      g.restore();

      if (hov && Mouse.click) { this.stageIndex = i; Snd.ui(); }
      x += cw + gap;
    });

    g.save();
    g.textAlign = "center"; g.font = `700 11px ${FONT_MONO}`; g.fillStyle = "#6b6a85";
    g.fillText("EVERY STAGE MOVES ITS BLAST ZONES AND PLAYS DIFFERENTLY — THEY ARE NOT RESKINS", W / 2, 474);
    g.restore();

    if (btn(W / 2 - 230, 500, 200, 48, "◀ FIGHTERS", { color: "#ff2e88" })) { this.screen = "select"; Snd.ui(); }
    if (btn(W / 2 + 30, 500, 200, 48, "BRAWL ▶", { color: "#b6ff3b", font: `700 19px ${FONT_MONO}` }))
      this.start();
  },

  /* ============================================================= CONTROLS */
  drawControls() {
    Stage.def = STAGES[0];
    drawBackground();
    g.save(); g.fillStyle = "rgba(5,4,12,.86)"; g.fillRect(0, 0, W, H); g.restore();
    screenTitleBar("COOL MATT GAMES", "CONTROLS");

    const colX = [330, 540, 750, 960];   // left edge of each player column
    const colW = 186;
    const rowH = 40, top = 148;

    // header
    g.save();
    g.textAlign = "left";
    g.font = `700 11px ${FONT_MONO}`; g.fillStyle = "#6b6a85";
    g.fillText("ACTION", 108, top - 14);
    g.textAlign = "center";
    for (let p = 0; p < 4; p++) {
      g.fillStyle = PLAYER_TINT[p];
      g.font = `700 13px ${FONT_MONO}`;
      g.fillText(`PLAYER ${p + 1}`, colX[p] + colW / 2, top - 14);
    }
    g.strokeStyle = "rgba(255,255,255,.14)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(96, top - 4); g.lineTo(W - 96, top - 4); g.stroke();
    g.restore();

    this.hoverAction = null;

    ACTIONS.forEach((act, r) => {
      const y = top + r * rowH;
      const rowHov = Mouse.y > y && Mouse.y < y + rowH - 4;
      if (rowHov) this.hoverAction = act;

      g.save();
      if (r % 2 === 0) { g.fillStyle = "rgba(255,255,255,.028)"; roundRect(g, 96, y, W - 192, rowH - 4, 6); g.fill(); }
      g.textAlign = "left";
      g.font = `700 13px ${FONT_MONO}`;
      g.fillStyle = rowHov ? "#ffffff" : "#d6d3ec";
      g.fillText(act.name, 108, y + rowH / 2 + 1);
      g.restore();

      for (let p = 0; p < 4; p++) {
        const cx = colX[p], cy = y + 3;
        const ch = rowH - 10;
        const capturing = this.rebind && this.rebind.player === p && this.rebind.action === act.id;
        const code = Settings.binds[p][act.id];
        const label = capturing ? "PRESS A KEY…" : keyLabel(code);
        const hov = Mouse.x > cx && Mouse.x < cx + colW && Mouse.y > cy && Mouse.y < cy + ch;

        /* Drawn as an actual keycap: a dark well, a raised cap sitting in it
           with a lit top face, and the cap pressing down when hovered. It
           makes the table read as a keyboard rather than a spreadsheet. */
        g.save();
        const press2 = hov && !capturing ? 1.5 : 0;
        const tint = PLAYER_TINT[p];

        // the well the cap sits in
        roundRect(g, cx, cy, colW, ch, 6);
        g.fillStyle = "rgba(0,0,0,.5)"; g.fill();

        const capY = cy + 1.5 + press2, capH = ch - 4;
        const capPath = () => roundRect(g, cx + 2, capY, colW - 4, capH, 5);
        const capBase = capturing ? mixColor("#1c1838", tint, 0.4)
                      : hov ? mixColor("#1c1838", tint, 0.18) : "#1a1733";
        const cq = g.createLinearGradient(0, capY, 0, capY + capH);
        cq.addColorStop(0, shade(capBase, 0.2));
        cq.addColorStop(1, shade(capBase, -0.3));
        capPath();
        g.strokeStyle = UI.ink; g.lineWidth = 2.5; g.stroke();
        g.fillStyle = cq; g.fill();
        // lit top face
        g.save(); capPath(); g.clip();
        g.fillStyle = hexA("#ffffff", press2 ? 0.07 : 0.13);
        g.fillRect(cx + 2, capY, colW - 4, capH * 0.42);
        g.restore();
        // accent edge while capturing or hovered
        if (capturing || hov) {
          capPath();
          g.strokeStyle = tint; g.lineWidth = capturing ? 2 : 1.4;
          if (capturing) { g.shadowColor = tint; g.shadowBlur = 14; }
          g.stroke(); g.shadowBlur = 0;
        }

        g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `700 ${capturing ? 10 : 12}px ${FONT_MONO}`;
        g.fillStyle = capturing ? "#ffffff" : code ? "#e8e6f8" : "#ff2e88";
        g.fillText(label, cx + colW / 2, capY + capH / 2 + 0.5);
        g.textBaseline = "alphabetic";
        g.restore();

        if (hov && Mouse.click && !this.rebind) {
          this.rebind = { player: p, action: act.id };
          Snd.blip(900);
          Keys.capture = (newCode) => {
            if (newCode !== "Escape") {
              Settings.bind(p, act.id, newCode);
              Snd.uiBig();
            } else Snd.ui();
            this.rebind = null;
          };
        }
      }
    });

    // description of whatever row the mouse is on
    g.save();
    g.textAlign = "center";
    g.font = `400 12px ${FONT_MONO}`;
    g.fillStyle = "#8f8cb5";
    const d = this.hoverAction ? this.hoverAction.desc
      : "Hover a row for what it does. Click any key cell to rebind it — a key can only drive one action.";
    g.fillText(d, W / 2, top + ACTIONS.length * rowH + 22);
    g.font = `400 11px ${FONT_MONO}`; g.fillStyle = "#5d5b78";
    g.fillText("Gamepads work too and need no setup: A jump · X light · Y heavy · B special · R3 super · LB grab · RB shield.",
               W / 2, top + ACTIONS.length * rowH + 44);
    g.restore();

    if (btn(W / 2 - 230, H - 72, 200, 44, "RESET DEFAULTS", { color: "#ffc83d" })) {
      Settings.resetBinds(); Snd.uiBig();
    }
    if (btn(W / 2 + 30, H - 72, 200, 44, "DONE", { color: "#b6ff3b", font: `700 17px ${FONT_MONO}` })) {
      this.screen = this.returnTo; Snd.ui();
    }
  },

  /* ============================================================= SETTINGS */
  drawSettings() {
    Stage.def = STAGES[0];
    drawBackground();
    g.save(); g.fillStyle = "rgba(5,4,12,.86)"; g.fillRect(0, 0, W, H); g.restore();
    screenTitleBar("COOL MATT GAMES", "SETTINGS", "#ffc83d");

    const rows = [
      { key: "cameraSway", label: "Camera Movement",
        note: "How far the camera follows the fighters. OFF locks it over the stage — no side-to-side drift at all.",
        steps: [["OFF", 0], ["LOW", 0.6], ["NORMAL", 1.0], ["HIGH", 1.5]] },
      { key: "shakeAmount", label: "Screen Shake",
        note: "Impact shake on hits, KOs and supers.",
        steps: [["OFF", 0], ["LOW", 0.5], ["NORMAL", 1.0], ["HIGH", 1.6]] },
      { key: "postFx", label: "Lighting & Bloom",
        note: "Glow bleed, impact colour-split and the darkened corners. Turn down if the game ever feels heavy.",
        steps: [["OFF", 0], ["LOW", 0.5], ["NORMAL", 1.0], ["HIGH", 1.4]] },
      { key: "particles", label: "Particle Density",
        note: "Lower this if the game ever drops frames in a big 4-player pile-up.",
        steps: [["LOW", 0.4], ["NORMAL", 1.0], ["HIGH", 1.6]] },
      { key: "showHitboxGlow", label: "Attack Glow",
        note: "The soft light showing where an attack actually reaches. Helpful while learning the spacing.",
        steps: [["OFF", false], ["ON", true]] },
      { key: "musicOn", label: "Music",
        note: "Each stage has its own synthesised bed.",
        steps: [["OFF", false], ["ON", true]] },
      { key: "sfxOn", label: "Sound Effects",
        note: "Hits, KOs, menus.",
        steps: [["OFF", false], ["ON", true]] },
    ];

    let y = 150;
    let note = null;
    for (const row of rows) {
      const hov = Mouse.y > y - 10 && Mouse.y < y + 34;
      if (hov) note = row.note;
      g.save();
      g.textAlign = "left";
      g.font = `700 15px ${FONT_MONO}`;
      g.fillStyle = hov ? "#ffffff" : "#d6d3ec";
      g.fillText(row.label, 190, y + 16);
      g.restore();

      let bx = 560;
      for (const [lab, val] of row.steps) {
        const on = Settings.get(row.key) === val;
        if (btn(bx, y - 4, 118, 34, lab, { active: on, color: "#ffc83d", font: `700 12px ${FONT_MONO}` })) {
          Settings.set(row.key, val);
          Snd.ui();
          if (row.key === "musicOn") {
            if (val && Game.match) Snd.startMusic(Stage.def); else Snd.stopMusic();
          }
        }
        bx += 126;
      }
      y += 58;
    }

    g.save();
    g.textAlign = "center";
    g.font = `400 12px ${FONT_MONO}`; g.fillStyle = "#8f8cb5";
    g.fillText(note || "Settings save to this browser automatically.", W / 2, y + 16);
    g.restore();

    if (btn(W / 2 - 230, H - 86, 200, 46, "CONTROLS", { color: "#00e5ff" }))
      { this.returnTo = this.returnTo; this.screen = "controls"; Snd.ui(); }
    if (btn(W / 2 + 30, H - 86, 200, 46, "DONE", { color: "#b6ff3b", font: `700 17px ${FONT_MONO}` }))
      { this.screen = this.returnTo; Snd.ui(); }
  },

  /* ================================================================ HOWTO */
  drawHowto() {
    Stage.def = STAGES[0];
    drawBackground();
    g.save(); g.fillStyle = "rgba(5,4,12,.88)"; g.fillRect(0, 0, W, H); g.restore();
    screenTitleBar("COOL MATT GAMES", "HOW TO PLAY");

    const lines = [
      ["h", "THE RULES"],
      ["b", "No health bars. Getting hit raises your damage %, and a higher % means you fly further."],
      ["b", "Knock opponents past the blast zones. Three stocks each. Last fighter standing wins."],
      ["", ""],
      ["h2", "MODES & THE CLOCK"],
      ["b", "2v2 TEAMS — no friendly fire. Out of stocks? Press Special to steal one from a teammate who has two."],
      ["b", "FRENZY — in the last 30 seconds, super meter fills twice as fast. Tied on stocks at time? SUDDEN DEATH at 150%."],
      ["", ""],
      ["h3", "SKILL"],
      ["b", "TIP — connect with the outer edge of your swing and it hits harder. Spacing pays."],
      ["b", "STALE — repeating one move makes it weaker. Rotate your attacks to keep your damage up."],
      ["b", "Landing a hit refunds some of your recovery; whiffing pays all of it, so you stay open."],
      ["", ""],
      ["h3", "SUPERS"],
      ["b", "Dealing and taking damage fills your super meter — the bar across the foot of your card."],
      ["b", "At full, your Super button fires a move only your fighter has. You have armour while it runs,"],
      ["w", "but that armour BREAKS under enough damage. A super can be contested, not just dodged."],
      ["", ""],
      ["h4", "STAGES"],
      ["b", "Four maps, not reskins — and their platforms do things. The Yard's side ledges drift in and out."],
      ["b", "The Foundry's shelves go red-hot on a cycle and burn you; they flicker before they do."],
      ["b", "The Drift's cloud islands sag and dissolve under your weight, then reform. Don't camp them."],
      ["b", "The Vault's one shelf retracts on a timer, leaving the rails empty and nowhere to land."],
    ];
    let y = 112;
    g.save();
    g.textAlign = "left";
    for (const [k, t] of lines) {
      if (!t) { y += 8; continue; }
      if (k === "b") { g.font = `400 13px ${FONT_MONO}`; g.fillStyle = "#b7b4d4"; }
      else if (k === "w") { g.font = `700 13px ${FONT_MONO}`; g.fillStyle = "#ff2e88"; }
      else {
        g.font = `700 16px ${FONT_MONO}`;
        g.fillStyle = k === "h" ? "#ffffff" : k === "h2" ? "#b6ff3b" : k === "h3" ? "#ffc83d" : "#00e5ff";
      }
      g.fillText(t, 150, y);
      y += (k === "b" || k === "w") ? 20 : 24;
    }
    g.restore();

    if (btn(W / 2 - 320, H - 76, 190, 44, "CONTROLS", { color: "#00e5ff" }))
      { this.returnTo = "howto"; this.screen = "controls"; Snd.ui(); }
    if (btn(W / 2 - 100, H - 76, 200, 44, "FIGHTER GUIDE", { color: "#ffc83d" }))
      { this.guidePage = 0; this.screen = "guide"; Snd.ui(); }
    if (btn(W / 2 + 130, H - 76, 190, 44, "BACK", { color: "#ff2e88" })) { this.screen = "title"; Snd.ui(); }
  },

  /* ================================================================ GUIDE
     Page 0 is the mechanics explainer; pages 1..ROSTER.length are one
     fighter each, built straight from their own move data so it can never
     drift out of sync with what the move actually does. */
  drawGuide() {
    Stage.def = STAGES[0];
    drawBackground();
    g.save(); g.fillStyle = "rgba(5,4,12,.88)"; g.fillRect(0, 0, W, H); g.restore();

    const page = this.guidePage || 0;
    const lines = [];

    if (page === 0) {
      screenTitleBar("COOL MATT GAMES", "BASIC MECHANICS", "#ffc83d");
      lines.push(
        ["h", "DAMAGE & STOCKS"],
        ["b", "No health bars. Getting hit raises your damage %; a higher % means you fly further on the next hit."],
        ["b", "Three stocks each. Get knocked past a blast zone and you lose one. Last fighter standing wins."],
        ["", ""],
        ["h2", "OFFENSE"],
        ["b", "TIP — connect with the outer edge of a swing and it hits harder. Spacing pays."],
        ["b", "STALE — repeating one move makes it weaker. Rotate your attacks to keep your damage up."],
        ["b", "Landing a hit refunds some of your recovery; whiffing pays all of it, so you stay open."],
        ["", ""],
        ["h3", "DEFENSE"],
        ["b", "Shield — hold to block. Add a direction to roll, hold Down to spot dodge, or air-dodge in the air."],
        ["b", "Grab — beats a held shield. Press a direction to throw, or Light to pummel."],
        ["b", "A few moves (Husk's Dead Weight, Mira's Riposte/Perfect Answer) make you immune to knockback"],
        ["b", "outright while they're active — those are the exception, not the rule."],
        ["", ""],
        ["h4", "METER & SUPERS"],
        ["b", "Dealing and taking damage fills your super meter — the bar across the foot of your card."],
        ["b", "At full, Super fires a move only your fighter has. You have armor while it runs,"],
        ["w", "but that armor BREAKS under enough damage. A super can be contested, not just dodged."],
        ["", ""],
        ["h3", "WEIGHT"],
        ["b", "Heavier fighters fly less far from the same hit, but take more time to get moving in the first place."],
        ["", ""],
        ["h2", "TEAMS & THE CLOCK"],
        ["b", "2v2: no friendly fire, last team standing wins. Out of stocks? Special steals one from a teammate with two."],
        ["b", "FRENZY: the last 30 seconds double all meter gain. A time-out level on stocks goes to SUDDEN DEATH."],
      );
    } else {
      const ch = ROSTER[page - 1];
      screenTitleBar(ch.tag, ch.name, ch.color);
      lines.push(
        ["b", ch.blurb],
        ["", ""],
        ["h2", "KIT"],
        ["b", ch.power],
        ["", ""],
      );
      for (const slot of ["light", "heavy", "special", "super"]) {
        const m = ch[slot];
        if (!m) continue;
        const label = slot.toUpperCase();
        lines.push(["h3", `${label} — ${m.name}`]);
        if (m.desc) {
          lines.push(["b", m.desc]);
        } else if (m.dmg) {
          lines.push(["b", `Deals ${m.dmg} damage. Startup ${m.startup} / active ${m.active} / recovery ${m.recovery} frames.`]);
        } else {
          lines.push(["b", `Startup ${m.startup} / active ${m.active} / recovery ${m.recovery} frames.`]);
        }
        lines.push(["", ""]);
      }
    }

    let y = 112;
    g.save();
    g.textAlign = "left";
    for (const [k, t] of lines) {
      if (!t) { y += 8; continue; }
      if (k === "b") { g.font = `400 13px ${FONT_MONO}`; g.fillStyle = "#b7b4d4"; }
      else if (k === "w") { g.font = `700 13px ${FONT_MONO}`; g.fillStyle = "#ff2e88"; }
      else {
        g.font = `700 16px ${FONT_MONO}`;
        g.fillStyle = k === "h" ? "#ffffff" : k === "h2" ? "#b6ff3b" : k === "h3" ? "#ffc83d" : "#00e5ff";
      }
      g.fillText(t, 150, y);
      y += (k === "b" || k === "w") ? 20 : 24;
    }
    g.restore();

    // page dots
    g.save();
    g.textAlign = "center"; g.font = `700 11px ${FONT_MONO}`; g.fillStyle = "#6b6a85";
    g.fillText(page === 0 ? "MECHANICS" : `${page} / ${ROSTER.length}  ·  ◀ / ▶ TO PAGE`, W / 2, H - 94);
    g.restore();

    if (btn(W / 2 - 320, H - 76, 150, 44, "◀ PREV", { color: "#00e5ff", disabled: page === 0 }))
      { this.guidePage = Math.max(0, page - 1); Snd.ui(); }
    if (btn(W / 2 - 160, H - 76, 150, 44, "NEXT ▶", { color: "#00e5ff", disabled: page === ROSTER.length }))
      { this.guidePage = Math.min(ROSTER.length, page + 1); Snd.ui(); }
    if (btn(W / 2 + 30, H - 76, 290, 44, "BACK", { color: "#ff2e88" })) { this.screen = "howto"; Snd.ui(); }
  },

  /* =============================================================== ONLINE */
  updateOnline() {
    if (Keys.pressed["Escape"]) { Net.reset(); this.screen = "title"; Snd.ui(); return; }
    // typing a room code to join
    if (this.joinEntry !== null) {
      for (const k in Keys.pressed) {
        if (/^Key[A-Z]$/.test(k) && this.joinEntry.length < 4) this.joinEntry += k.slice(3);
        else if (/^Digit[2-9]$/.test(k) && this.joinEntry.length < 4) this.joinEntry += k.slice(5);
        else if (k === "Backspace") this.joinEntry = this.joinEntry.slice(0, -1);
        else if (k === "Enter" && this.joinEntry.length === 4) {
          Net.join(this.joinEntry); this.joinEntry = null; Snd.uiBig();
        }
      }
    }
    // the room is open (host) or we have been seated (guest): into the lobby
    if (Net.active && (Net.isHost || Net.seated)) { this.screen = "lobby"; Snd.uiBig(); }
  },

  drawOnline() {
    Stage.def = STAGES[0];
    drawBackground();
    g.save(); g.fillStyle = "rgba(5,4,12,.86)"; g.fillRect(0, 0, W, H); g.restore();
    screenTitleBar("COOL MATT GAMES", "PLAY ONLINE");

    const cx = W / 2;
    g.save();
    g.textAlign = "center";

    if (Net.mode === "off") {
      g.font = `400 14px ${FONT_MONO}`; g.fillStyle = UI.dim;
      g.fillText("One of you hosts and reads out the code. Up to three friends join with it.",
                 cx, 152);
      g.fillText("Free-for-all or 2v2 teams — the host can fill empty seats with CPUs.", cx, 174);
      g.restore();

      if (this.joinEntry === null) {
        if (btn(cx - 300, 220, 280, 64, "HOST A GAME", { color: "#b6ff3b", font: `700 18px ${FONT_MONO}` }))
          { Net.host(); Snd.uiBig(); }
        if (btn(cx + 20, 220, 280, 64, "JOIN A GAME", { color: "#00e5ff", font: `700 18px ${FONT_MONO}` }))
          { this.joinEntry = ""; Snd.ui(); }
      } else {
        g.save(); g.textAlign = "center";
        g.font = `700 13px ${FONT_MONO}`; g.fillStyle = UI.dim;
        g.fillText("TYPE THE 4-CHARACTER CODE, THEN PRESS ENTER", cx, 212);
        g.restore();
        for (let i = 0; i < 4; i++) {
          const bx = cx - 150 + i * 76;
          const ch = this.joinEntry[i] || "";
          panel(g, bx, 232, 64, 76, { cut: 10, fill: "#14112a",
            accent: ch ? "#00e5ff" : UI.line, accentA: ch ? 0.9 : 0.5, glow: ch ? 14 : 0 });
          g.save(); g.textAlign = "center";
          g.font = `900 40px ${FONT_DISPLAY}`; g.fillStyle = "#ffffff";
          g.fillText(ch, bx + 32, 285);
          g.restore();
        }
        if (btn(cx - 90, 334, 180, 42, "CANCEL", { color: "#ff2e88" }))
          { this.joinEntry = null; Snd.ui(); }
      }
      g.save(); g.textAlign = "center";
      g.font = `400 12px ${FONT_MONO}`; g.fillStyle = UI.dimmer;
      g.fillText("Runs peer-to-peer in the browser. No account, nothing to install.", cx, H - 150);
      g.restore();

    } else if (Net.mode === "error") {
      g.font = `900 26px ${FONT_DISPLAY}`; g.fillStyle = "#ff2e88";
      g.fillText("COULDN'T CONNECT", cx, 210);
      g.font = `400 14px ${FONT_MONO}`; g.fillStyle = "#b7b4d4";
      g.fillText(Net.error, cx, 244);
      g.restore();
      if (btn(cx - 110, 290, 220, 48, "TRY AGAIN", { color: "#00e5ff" }))
        { Net.reset(); Snd.ui(); }

    } else {
      // hosting / joining / connected
      if (Net.isHost && Net.code) {
        g.font = `700 13px ${FONT_MONO}`; g.fillStyle = UI.dim;
        g.fillText("YOUR ROOM CODE — READ THIS OUT", cx, 168);
        g.restore();
        for (let i = 0; i < Net.code.length; i++) {
          const bx = cx - 152 + i * 76;
          panel(g, bx, 186, 64, 80, { cut: 10, fill: "#14112a",
            accent: "#b6ff3b", accentA: 0.95, glow: 18 });
          g.save(); g.textAlign = "center";
          g.font = `900 42px ${FONT_DISPLAY}`;
          g.shadowColor = "#b6ff3b"; g.shadowBlur = 12; g.fillStyle = "#ffffff";
          g.fillText(Net.code[i], bx + 32, 243);
          g.restore();
        }
        g.save(); g.textAlign = "center";
      }

      const dots = ".".repeat(1 + (Math.floor(performance.now() / 400) % 3));
      g.font = `400 15px ${FONT_MONO}`; g.fillStyle = "#b7b4d4";
      g.fillText(Net.status + (Net.mode === "connected" ? "" : dots), cx, 310);

      if (Net.mode === "connected") {
        g.font = `700 13px ${FONT_MONO}`; g.fillStyle = "#b6ff3b";
        g.fillText(Net.ping ? `CONNECTED  ·  ${Net.ping} ms round trip` : "CONNECTED", cx, 338);
        if (Net.isGuest) {
          g.font = `400 13px ${FONT_MONO}`; g.fillStyle = UI.dim;
          g.fillText("Taking a seat in the lobby…", cx, 366);
        }
      }
      g.restore();

      if (btn(cx - 110, H - 150, 220, 46, "CANCEL", { color: "#ff2e88" }))
        { Net.reset(); Snd.ui(); }
    }

    if (btn(24, H - 76, 170, 44, "BACK", { color: "#8f8cb5" }))
      { Net.reset(); this.screen = "title"; Snd.ui(); }
  },

  /* ================================================================ LOBBY
     The online room, shared by host and guests. Everyone picks their own
     fighter; the host also fills or empties the remaining seats with CPUs,
     chooses free-for-all or 2v2, picks the stage, and starts. Guests see the
     same screen read-only, driven by the room state the host broadcasts. */
  updateLobby() {
    if (Keys.pressed["Escape"]) { Net.reset(); this.screen = "title"; Snd.ui(); return; }
    if (!Net.active) { this.screen = "online"; return; }
    if (Net.isHost && Keys.pressed["Enter"]) this.start();
  },

  drawLobby() {
    Stage.def = STAGES[this.stageIndex];
    drawBackground();
    g.save(); g.fillStyle = "rgba(6,5,14,.74)"; g.fillRect(0, 0, W, H); g.restore();
    screenTitleBar(`ROOM ${Net.code}  ·  ${Net.isHost ? "YOU ARE HOSTING" : "YOU ARE P" + (Net.slot + 1)}`,
                   "ONLINE LOBBY", "#ff2e88");

    const host = Net.isHost;
    const mine = Net.slot;
    // which seat a roster click assigns to: the host may set CPU seats too
    if (this.lobbySeat == null || !this.canEditSeat(this.lobbySeat)) this.lobbySeat = mine;

    /* ---- the four seats ---- */
    const sw = 286, sgap = 14, sh = 150, sy = 108;
    let sx = (W - (4 * sw + 3 * sgap)) / 2;
    let hoverChar = null;
    this.slots.forEach((s, i) => {
      const who = Net.seatOf(i);                      // "host" | "guest" | null
      const off = s.mode === "off";
      const c = CHAR_BY_ID[s.charId];
      const tint = this.teams ? TEAM_TINT[s.team || 0] : PLAYER_TINT[i];
      const sel = this.lobbySeat === i;
      g.save();
      g.globalAlpha = off ? 0.55 : 1;
      panel(g, sx, sy, sw, sh, {
        cut: 12, fill: sel ? mixColor("#14112a", tint, 0.16) : "#110e22",
        accent: tint, accentA: sel ? 1 : 0.45, glow: sel ? 18 : 0,
      });
      g.save();
      notchPath(g, sx, sy, sw, sh, 12); g.clip();
      g.fillStyle = hexA(tint, off ? 0.25 : 0.75); g.fillRect(sx, sy, 4, sh);
      if (!off) {
        g.translate(sx + 62, sy + sh - 22); g.scale(1.05, 1.05);
        c.draw(g, { time: performance.now() / 16 + i * 30, runPhase: 0, running: false, air: false,
                    vx: 0, vy: 0, state: ST.IDLE, flash: false, atkPhase: -1 });
      }
      g.restore();

      g.textAlign = "left";
      g.font = `700 12px ${FONT_MONO}`; g.fillStyle = tint;
      const role = i === mine ? "YOU" : who === "host" ? "HOST" : who === "guest" ? "PLAYER"
                 : s.mode === "cpu" ? "CPU" : "OPEN";
      g.fillText(`P${i + 1} · ${role}`, sx + 14, sy + 22);
      const ping = Net.pingOf(i);
      if (ping) {
        g.font = `400 9px ${FONT_MONO}`; g.fillStyle = "#6b6a85"; g.textAlign = "right";
        g.fillText(`${ping} ms`, sx + sw - 12, sy + 20);
        g.textAlign = "left";
      }
      g.font = `900 22px ${FONT_DISPLAY}`;
      g.fillStyle = off ? "#4a4866" : c.color;
      g.fillText(off ? "— EMPTY —" : c.name, sx + 122, sy + 62);
      if (!off) {
        g.font = `700 8px ${FONT_MONO}`; g.fillStyle = "#8f8cb5";
        g.fillText(c.tag, sx + 122, sy + 76);
      }
      g.restore();

      // team badge: the host can switch anyone, a guest only themself
      if (this.teams && !off) {
        const canTeam = host || i === mine;
        if (btn(sx + 122, sy + 88, 74, 22, TEAM_NAME[s.team || 0],
                { active: true, color: TEAM_TINT[s.team || 0], disabled: !canTeam,
                  font: `700 10px ${FONT_MONO}` }) && canTeam) {
          Net.setTeam(i, 1 - (s.team || 0)); Snd.ui();
        }
      }
      // the host fills or empties any seat a person is not sitting in
      if (host && !who) {
        [["OPEN", "off"], ["CPU", "cpu"]].forEach(([lab, m], k) => {
          if (btn(sx + 122 + k * 78, sy + 118, 72, 22, lab, {
            active: s.mode === m, color: m === "cpu" ? "#ffc83d" : "#6b6a85",
            font: `700 10px ${FONT_MONO}`,
          })) { Net.setSeatMode(i, m); if (m === "cpu") this.lobbySeat = i; Snd.ui(); }
        });
      } else if (who === "guest" && i !== mine && !host) {
        g.save(); g.font = `400 9px ${FONT_MONO}`; g.fillStyle = "#6b6a85"; g.textAlign = "left";
        g.fillText("connected", sx + 122, sy + 132); g.restore();
      }
      if (Mouse.click && Mouse.x > sx && Mouse.x < sx + 116 && Mouse.y > sy && Mouse.y < sy + sh
          && this.canEditSeat(i)) { this.lobbySeat = i; Snd.ui(); }
      sx += sw + sgap;
    });

    /* ---- the roster: click to give the selected seat that fighter ---- */
    const n = ROSTER.length, cw = 140, cgap = 8, ch = 118, cy = 274;
    let cx = (W - (n * cw + (n - 1) * cgap)) / 2;
    const seatChar = this.slots[this.lobbySeat].charId;
    ROSTER.forEach(c => {
      const hov = Mouse.x > cx && Mouse.x < cx + cw && Mouse.y > cy && Mouse.y < cy + ch;
      if (hov) hoverChar = c;
      const on = c.id === seatChar;
      g.save();
      g.translate(0, hov ? -3 : 0);
      panel(g, cx, cy, cw, ch, { cut: 10, fill: "#110e24", accent: c.color,
        accentA: on ? 1 : hov ? 0.8 : 0.35, glow: on ? 16 : hov ? 10 : 0 });
      g.save();
      notchPath(g, cx + 2, cy + 2, cw - 4, ch - 4, 9); g.clip();
      g.translate(cx + cw / 2, cy + ch - 34); g.scale(0.95, 0.95);
      c.draw(g, { time: performance.now() / 16, runPhase: 0, running: false, air: false,
                  vx: 0, vy: 0, state: ST.IDLE, flash: false, atkPhase: -1 });
      g.restore();
      g.textAlign = "center"; g.font = `900 15px ${FONT_DISPLAY}`;
      outlineText(g, c.name, cx + cw / 2, cy + ch - 10, c.color, 4);
      g.restore();
      if (hov && Mouse.click) { Net.pick(this.lobbySeat, c.id); Snd.ui(); }
      cx += cw + cgap;
    });

    /* ---- write-up of whoever is pointed at, else the selected seat ---- */
    const sc = hoverChar || CHAR_BY_ID[seatChar];
    g.save();
    g.textAlign = "center";
    g.font = `700 12px ${FONT_MONO}`; g.fillStyle = sc.color;
    g.fillText(`${sc.name} — ${sc.tag}`, W / 2, 418);
    g.font = `400 12px ${FONT_MONO}`; g.fillStyle = "#b7b4d4";
    g.fillText(sc.power || sc.blurb, W / 2, 438);
    g.font = `400 11px ${FONT_MONO}`; g.fillStyle = "#8f8cb5";
    g.fillText(`SPECIAL  ${sc.special.name.toUpperCase()}   ·   SUPER  ${sc.super.name.toUpperCase()}`, W / 2, 458);
    g.restore();

    /* ---- match settings: the host sets them, guests read them ---- */
    const py = 478;
    panel(g, 150, py, W - 300, 92, { cut: 12, fill: "#100d20", accent: "#ff2e88", accentA: 0.35 });
    g.save();
    g.textAlign = "left"; g.font = `700 9px ${FONT_MONO}`; g.fillStyle = "#6b6a85";
    g.fillText("MODE", 176, py + 24);
    g.fillText("STAGE", 640, py + 24);
    g.restore();
    if (host) {
      if (btn(176, py + 34, 220, 40, this.teams ? "2v2 TEAMS" : "FREE-FOR-ALL",
          { active: this.teams, color: this.teams ? "#ff4f6a" : "#8a7fff" }))
        { Net.setTeams(!this.teams); Snd.ui(); }
      if (btn(640, py + 34, 44, 40, "◀", { color: "#00e5ff" }))
        { Net.setStage((this.stageIndex + STAGES.length - 1) % STAGES.length); Snd.ui(); }
      if (btn(906, py + 34, 44, 40, "▶", { color: "#00e5ff" }))
        { Net.setStage((this.stageIndex + 1) % STAGES.length); Snd.ui(); }
    } else {
      g.save(); g.textAlign = "left"; g.font = `700 16px ${FONT_MONO}`;
      g.fillStyle = this.teams ? "#ff4f6a" : "#8a7fff";
      g.fillText(this.teams ? "2v2 TEAMS" : "FREE-FOR-ALL", 176, py + 60);
      g.restore();
    }
    g.save();
    g.textAlign = "center"; g.font = `900 20px ${FONT_DISPLAY}`;
    const st = STAGES[this.stageIndex];
    outlineText(g, st.name, host ? 795 : 740, py + 61, st.pal.platEdge, 5);
    g.restore();

    /* ---- status line, under the settings ---- */
    const problem = this.startProblem(this.slots, this.teams);
    g.save();
    g.textAlign = "center"; g.font = `700 11px ${FONT_MONO}`;
    g.fillStyle = problem ? "#ff2e88" : "#b6ff3b";
    g.fillText(host ? (problem || `${Net.guestCount()} FRIEND${Net.guestCount() === 1 ? "" : "S"} CONNECTED — READY`)
                    : "THE HOST STARTS THE MATCH", W / 2, py + 112);
    g.restore();

    /* ---- the room code, big, with a one-click invite ----
       It used to live only in the small print at the top of the screen, so a
       host landing here had no idea what to tell their friends. */
    const code = Net.code || "";
    const bx0 = 352, by0 = H - 92;
    g.save();
    g.textAlign = "left"; g.font = `700 9px ${FONT_MONO}`; g.fillStyle = "#b6ff3b";
    g.fillText("ROOM CODE — FRIENDS TYPE THIS UNDER JOIN", bx0, by0 - 6);
    g.restore();
    for (let i = 0; i < 4; i++) {
      const bx = bx0 + i * 58;
      panel(g, bx, by0, 50, 60, { cut: 8, fill: "#14112a", accent: "#b6ff3b", accentA: 0.95, glow: 14 });
      g.save(); g.textAlign = "center";
      g.font = `900 34px ${FONT_DISPLAY}`;
      g.shadowColor = "#b6ff3b"; g.shadowBlur = 10; g.fillStyle = "#ffffff";
      g.fillText(code[i] || "", bx + 25, by0 + 44);
      g.restore();
    }
    const copied = this.copiedAt && performance.now() - this.copiedAt < 2000;
    if (btn(bx0 + 4 * 58 + 10, by0 + 8, 220, 44, copied ? "LINK COPIED!" : "COPY INVITE LINK",
        { color: "#b6ff3b", active: copied, font: `700 13px ${FONT_MONO}` })) {
      const link = location.origin + location.pathname + "?join=" + code;
      try {
        navigator.clipboard.writeText(link).then(() => { this.copiedAt = performance.now(); },
                                                  () => { this.copiedAt = 0; });
      } catch (e) { /* no clipboard: the code is on screen anyway */ }
      Snd.uiBig();
    }

    /* ---- leave / start ---- */
    if (btn(150, H - 72, 170, 46, "◀ LEAVE", { color: "#ff2e88" }))
      { Net.reset(); this.screen = "title"; Snd.ui(); }
    if (host && btn(W - 330, H - 72, 180, 46, "START ▶",
        { color: problem ? "#444" : "#b6ff3b", disabled: !!problem, font: `700 18px ${FONT_MONO}` }))
      this.start();
  },

  /** In the lobby: may this screen change seat i's fighter? */
  canEditSeat(i) {
    if (i === Net.slot) return true;
    return Net.isHost && !Net.seatOf(i) && this.slots[i].mode === "cpu";
  },

  /* ================================================================ PAUSE */
  drawPause() {
    g.save();
    g.fillStyle = "rgba(6,5,14,.80)"; g.fillRect(0, 0, W, H);
    // hazard bars top and bottom — this is a stopped machine, not a web modal
    hatch(g, 0, 0, W, 16, "#ffc83d", 22, 0.3);
    hatch(g, 0, H - 16, W, 16, "#ffc83d", 22, 0.3);
    g.textAlign = "center";
    g.font = `900 76px ${FONT_DISPLAY}`;
    g.shadowColor = "#00e5ff"; g.shadowBlur = 30;
    outlineText(g, "PAUSED", W / 2, 150, "#ffffff", 10);
    g.shadowBlur = 0;
    g.restore();

    // live readout of the stage, while stopped
    g.save();
    const pw = 420, px2 = W / 2 - pw / 2;
    panel(g, px2, 164, pw, 34, { cut: 9, fill: "#120f26", accent: "#00e5ff", accentA: 0.4 });
    g.textAlign = "center"; g.font = `700 11px ${FONT_MONO}`;
    g.fillStyle = UI.dim;
    g.fillText(Stage.def.name, W / 2, 185);
    g.restore();

    const bx = W / 2 - 130;
    if (btn(bx, 220, 260, 48, "RESUME", { color: "#b6ff3b" })) { this.screen = "match"; Snd.ui(); }
    if (btn(bx, 278, 260, 42, "RESTART MATCH", { color: "#00e5ff" })) this.start();
    if (btn(bx, 328, 260, 42, "CONTROLS", { color: "#8a7fff" }))
      { this.returnTo = "pause"; this.screen = "controls"; Snd.ui(); }
    if (btn(bx, 378, 260, 42, "SETTINGS", { color: "#ffc83d" }))
      { this.returnTo = "pause"; this.screen = "settings"; Snd.ui(); }
    if (btn(bx, 428, 260, 42, "CHANGE STAGE", { color: "#00e5ff" })) { this.screen = "stage"; Snd.ui(); }
    if (btn(bx, 478, 260, 42, "QUIT TO TITLE", { color: "#ff2e88" }))
      { Snd.stopMusic(); this.screen = "title"; Snd.ui(); }

    g.save();
    g.textAlign = "center"; g.font = `700 11px ${FONT_MONO}`;
    g.fillStyle = "#6b6a85"; g.fillText("ESC TO RESUME", W / 2, 546);
    g.restore();
  },

  /* ============================================================== RESULTS */
  drawResults() {
    drawBackground();
    g.save(); g.fillStyle = "rgba(6,5,14,.74)"; g.fillRect(0, 0, W, H); g.restore();
    const r = this.results, wn = r.winner;

    g.save();
    g.textAlign = "center";
    g.font = `700 12px ${FONT_MONO}`; g.fillStyle = "#ff2e88";
    g.fillText("COOL MATT GAMES", W / 2, 40);
    g.font = `900 70px ${FONT_DISPLAY}`;
    const teamWin = r.winTeam != null;
    const winCol = teamWin ? TEAM_TINT[r.winTeam] : wn ? wn.ch.color : "#ffffff";
    const title = teamWin ? `${TEAM_NAME[r.winTeam]} TEAM WINS`
                : wn ? `${wn.ch.name} WINS` : (r.endedBy === "time" ? "TIME — DRAW" : "DRAW");
    g.shadowColor = winCol; g.shadowBlur = 34;
    outlineText(g, title, W / 2, 112, winCol, 11);
    g.shadowBlur = 0;
    g.font = `700 12px ${FONT_MONO}`; g.fillStyle = "#8f8cb5";
    const how = r.suddenDeath ? "SUDDEN DEATH" : r.endedBy === "time" ? "TIME LIMIT"
              : r.teams ? "LAST TEAM STANDING" : "LAST FIGHTER STANDING";
    g.fillText(`${how}  ·  ${r.teams ? "2v2  ·  " : ""}${r.stage.name}`
      + `  ·  ${(r.frames / 60).toFixed(1)}s`, W / 2, 140);
    g.restore();

    // x positions kept inside the row plate, which ends at W-110
    const cols = [["KOs", 556], ["FALLS", 664], ["DAMAGE", 788], ["SUPERS", 902], ["BEST HIT", 1024], ["STOCKS", 1134]];
    g.save();
    g.font = `700 10px ${FONT_MONO}`; g.fillStyle = "#6b6a85";
    g.textAlign = "left"; g.fillText("FIGHTER", 140, 182);
    g.textAlign = "center";
    cols.forEach(([t, cx]) => g.fillText(t, cx, 182));
    g.strokeStyle = "rgba(255,255,255,.14)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(130, 192); g.lineTo(W - 110, 192); g.stroke();
    g.restore();

    // the winning side first, then by how each fighter actually did
    const won = f => r.winTeam != null ? f.team === r.winTeam : f === wn;
    const sorted = r.fighters.slice().sort((a, b) =>
      (won(b) - won(a)) || (b.stocks - a.stocks) || (b.stats.kos - a.stats.kos)
      || (b.stats.damageDealt - a.stats.damageDealt));

    let y = 228;
    sorted.forEach(f => {
      const win = won(f);
      g.save();
      // every row gets a plate; the winner's is in their colour and glows
      panel(g, 130, y - 28, W - 240, 54, {
        cut: 12, fill: win ? mixColor("#110e24", f.ch.color, 0.16) : "#100d20",
        accent: f.ch.color, accentA: win ? 0.95 : 0.3,
        glow: win ? 18 : 0, shadow: win,
      });
      if (win) {
        g.save();
        notchPath(g, 130, y - 28, W - 240, 54, 12); g.clip();
        hatch(g, 130, y - 28, 40, 54, f.ch.color, 9, 0.25);
        g.restore();
        // a winner's tab hanging off the left edge
        g.save();
        g.fillStyle = f.ch.color;
        poly(g, [118, y - 20, 132, y - 20, 132, y + 18, 118, y + 18, 124, y - 1]); g.fill();
        g.restore();
      }
      // portrait
      g.save();
      g.translate(168, y + 14); g.scale(0.56, 0.56);
      f.ch.draw(g, { time: performance.now() / 16, runPhase: 0, running: false, air: false,
                     vx: 0, vy: 0, state: ST.IDLE, flash: false, atkPhase: -1 });
      g.restore();

      g.textAlign = "left";
      g.font = `900 26px ${FONT_DISPLAY}`; g.fillStyle = f.ch.color;
      g.fillText(f.ch.name, 196, y + 2);
      g.font = `700 10px ${FONT_MONO}`; g.fillStyle = f.tint;
      g.fillText(`P${f.slot + 1}${f.isCPU ? " · CPU" : ""}`
        + (f.team != null ? ` · ${TEAM_NAME[f.team]}` : ""), 196, y + 16);
      if (win) {
        g.font = `700 11px ${FONT_MONO}`; g.fillStyle = "#b6ff3b";
        g.fillText("★ WINNER", 330, y + 2);
      }

      const vals = [f.stats.kos, f.stats.falls, f.stats.damageDealt.toFixed(0) + "%",
                    f.stats.supers, f.stats.bestHit.toFixed(0) + "%", Math.max(0, f.stocks)];
      g.textAlign = "center";
      g.font = `900 28px ${FONT_DISPLAY}`; g.fillStyle = "#f2f0ff";
      vals.forEach((v, i) => g.fillText(String(v), cols[i][1], y + 6));
      g.restore();
      y += 64;
    });

    if (Net.active) {
      // online: only the host drives what happens next
      if (Net.isHost) {
        if (btn(W / 2 - 230, H - 82, 200, 46, "REMATCH", { color: "#b6ff3b", font: `700 17px ${FONT_MONO}` }))
          this.start();
        if (btn(W / 2 + 30, H - 82, 200, 46, "LOBBY", { color: "#ffc83d" }))
          { Net.setPhase("lobby"); this.screen = "lobby"; Snd.ui(); }
      } else {
        if (btn(W / 2 - 100, H - 82, 200, 46, "LEAVE", { color: "#ff2e88" }))
          { Net.reset(); this.screen = "title"; Snd.ui(); }
      }
      g.save();
      g.textAlign = "center"; g.font = `700 10px ${FONT_MONO}`; g.fillStyle = "#6b6a85";
      g.fillText(Net.isHost ? "ENTER = REMATCH  ·  ESC = LOBBY"
                            : "WAITING FOR THE HOST — REMATCH OR BACK TO THE LOBBY", W / 2, H - 16);
      g.restore();
      return;
    }
    if (btn(W / 2 - 330, H - 82, 200, 46, "REMATCH", { color: "#b6ff3b", font: `700 17px ${FONT_MONO}` }))
      this.start();
    if (btn(W / 2 - 100, H - 82, 200, 46, "CHANGE STAGE", { color: "#00e5ff" })) { this.screen = "stage"; Snd.ui(); }
    if (btn(W / 2 + 130, H - 82, 200, 46, "FIGHTERS", { color: "#ffc83d" })) { this.screen = "select"; Snd.ui(); }
    g.save();
    g.textAlign = "center"; g.font = `700 10px ${FONT_MONO}`; g.fillStyle = "#6b6a85";
    g.fillText("ENTER = REMATCH  ·  ESC = FIGHTER SELECT", W / 2, H - 16);
    g.restore();
  },
};
