/* ==========================================================================
   12. SCREENS — title, fighter select, stage select, controls, settings,
                 pause and results
   ========================================================================== */

/* Immediate-mode button. Returns true on the frame it is clicked. */
function btn(x, y, w, h, label, opts) {
  opts = opts || {};
  const hov = Mouse.x > x && Mouse.x < x + w && Mouse.y > y && Mouse.y < y + h;
  const col = opts.color || "#00e5ff";
  const on = opts.active;
  const dim = opts.disabled;
  g.save();
  g.fillStyle = on ? hexA(col, 0.22) : (hov && !dim) ? "rgba(255,255,255,.10)" : "rgba(8,6,18,.72)";
  roundRect(g, x, y, w, h, 10); g.fill();
  g.strokeStyle = dim ? "rgba(255,255,255,.12)" : (on || hov) ? col : "rgba(255,255,255,.22)";
  g.lineWidth = 2;
  if ((on || hov) && !dim) { g.shadowColor = col; g.shadowBlur = 16; }
  roundRect(g, x, y, w, h, 10); g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = dim ? "#55536e" : (on || hov) ? "#ffffff" : "#b7b4d4";
  g.font = opts.font || `700 15px ${FONT_MONO}`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(label, x + w / 2, y + h / 2 + 1);
  g.textBaseline = "alphabetic";
  g.restore();
  return hov && Mouse.click && !dim;
}

function screenTitleBar(sub, title, accent) {
  g.save();
  g.textAlign = "center";
  g.font = `700 12px ${FONT_MONO}`;
  g.fillStyle = "#ff2e88";
  g.fillText(sub, W / 2, 38);
  g.font = `900 48px ${FONT_DISPLAY}`;
  g.shadowColor = accent || "#00e5ff"; g.shadowBlur = 22;
  outlineText(g, title, W / 2, 82, "#ffffff", 8);
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

  slots: [
    { charId: "BOLDER", mode: "human" },
    { charId: "ZIP",    mode: "cpu" },
    { charId: "ORBIT",  mode: "off" },
    { charId: "PIVOT",  mode: "off" },
  ],
  selIndex: 0,

  start() {
    if (this.slots.filter(s => s.mode !== "off").length < 2) return;
    this.match = new Match(this.slots, STAGES[this.stageIndex]);
    this.screen = "match";
    Snd.uiBig();
  },

  toResults(match) {
    this.results = {
      fighters: match.fighters.slice(),
      winner: match.winner,
      snapbacks: Stage.snapCount,
      frames: match.frames,
      endedBy: match.endedBy,
      stage: Stage.def,
    };
    this.screen = "results";
    Snd.uiBig();
  },

  /* ------------------------------------------------------------- update */
  update() {
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
      case "match":
        if (Keys.pressed["Escape"]) { this.screen = "pause"; Snd.ui(); break; }
        this.match.update();
        break;
      case "pause":    if (Keys.pressed["Escape"]) { this.screen = "match"; Snd.ui(); } break;
      case "results":
        if (Keys.pressed["Enter"]) this.start();
        if (Keys.pressed["Escape"]) { this.screen = "select"; Snd.ui(); }
        break;
    }
  },

  draw(alpha) {
    switch (this.screen) {
      case "title":    this.drawTitle(); break;
      case "select":   this.drawSelect(); break;
      case "stage":    this.drawStageSelect(); break;
      case "controls": this.drawControls(); break;
      case "settings": this.drawSettings(); break;
      case "howto":    this.drawHowto(); break;
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

    // decorative tilting beam with the roster riding it
    const a = Math.sin(this.titleT * 0.011) * 0.15;
    g.save();
    g.translate(W / 2, H * 0.84); g.rotate(a);
    g.fillStyle = "#15102b"; roundRect(g, -340, -12, 680, 52, 8); g.fill();
    g.strokeStyle = "#00e5ff"; g.lineWidth = 5;
    g.shadowColor = "#00e5ff"; g.shadowBlur = 24;
    g.beginPath(); g.moveTo(-340, -12); g.lineTo(340, -12); g.stroke();
    g.restore();
    g.save();
    g.strokeStyle = "rgba(120,110,170,.4)"; g.lineWidth = 10;
    g.beginPath(); g.moveTo(W / 2, H * 0.84); g.lineTo(W / 2, H); g.stroke();
    g.fillStyle = "#2a2250"; g.shadowColor = "#00e5ff"; g.shadowBlur = 16;
    g.beginPath(); g.arc(W / 2, H * 0.84, 15, 0, 7); g.fill();
    g.restore();

    ROSTER.forEach((c, i) => {
      const lx = -234 + i * 156;
      const x = W / 2 + lx * Math.cos(a), y = H * 0.84 + lx * Math.sin(a);
      g.save();
      g.translate(x, y - 32); g.rotate(a);
      g.scale(0.95, 0.95);
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
    g.font = `900 104px ${FONT_DISPLAY}`;
    const lg = g.createLinearGradient(W / 2 - 400, 140, W / 2 + 400, 220);
    lg.addColorStop(0, "#00e5ff"); lg.addColorStop(0.5, "#ffffff"); lg.addColorStop(1, "#ff2e88");
    g.shadowColor = "#00e5ff"; g.shadowBlur = 32;
    outlineText(g, "COOL MATT BRAWL", W / 2, 196 + bob, lg, 12);
    g.shadowBlur = 0;

    g.font = `700 16px ${FONT_MONO}`;
    g.fillStyle = "#b6ff3b";
    g.fillText("THE STAGE IS ON A PIVOT. SO IS YOUR LIFE.", W / 2, 236);
    g.restore();

    const bx = W / 2 - 130;
    if (btn(bx, 282, 260, 50, "START BRAWL", { color: "#b6ff3b", font: `700 19px ${FONT_MONO}` }))
      { this.screen = "select"; Snd.uiBig(); }
    if (btn(bx, 342, 260, 42, "CONTROLS", { color: "#00e5ff" }))
      { this.returnTo = "title"; this.screen = "controls"; Snd.ui(); }
    if (btn(bx, 392, 260, 42, "SETTINGS", { color: "#ffc83d" }))
      { this.returnTo = "title"; this.screen = "settings"; Snd.ui(); }
    if (btn(bx, 442, 260, 42, "HOW TO PLAY", { color: "#8a7fff" }))
      { this.screen = "howto"; Snd.ui(); }

    g.save();
    g.textAlign = "center"; g.font = `700 11px ${FONT_MONO}`;
    g.fillStyle = "#6b6a85";
    g.fillText("PRESS ENTER  ·  2-4 PLAYERS LOCAL  ·  GAMEPADS SUPPORTED", W / 2, 508);
    g.restore();
  },

  /* ======================================================= FIGHTER SELECT */
  drawSelect() {
    Stage.def = STAGES[this.stageIndex];
    drawBackground();
    g.save(); g.fillStyle = "rgba(6,5,14,.62)"; g.fillRect(0, 0, W, H); g.restore();
    screenTitleBar("COOL MATT GAMES", "CHOOSE YOUR FIGHTERS");

    const cw = 232, gap = 20;
    let x = (W - (ROSTER.length * cw + (ROSTER.length - 1) * gap)) / 2;
    const cy = 108;

    ROSTER.forEach(c => {
      const hov = Mouse.x > x && Mouse.x < x + cw && Mouse.y > cy && Mouse.y < cy + 284;
      const picked = this.slots.map((s, i) => (s.mode !== "off" && s.charId === c.id) ? i : -1).filter(i => i >= 0);

      g.save();
      g.fillStyle = "rgba(8,6,18,.84)";
      roundRect(g, x, cy, cw, 284, 14); g.fill();
      g.strokeStyle = hov ? c.color : hexA(c.color, 0.45);
      g.lineWidth = hov ? 3 : 2;
      g.shadowColor = c.color; g.shadowBlur = hov ? 26 : 10;
      roundRect(g, x, cy, cw, 284, 14); g.stroke();
      g.shadowBlur = 0;

      // full-size fighter art
      g.save();
      g.translate(x + cw / 2, cy + 128);
      const s = hov ? 2.1 : 1.95;
      g.scale(s, s);
      c.draw(g, { time: this.titleT * 0 + performance.now() / 16, runPhase: 0, running: false,
                  air: false, vx: 0, vy: 0, state: ST.IDLE, flash: false, atkPhase: -1 });
      g.restore();

      g.textAlign = "center";
      g.font = `900 32px ${FONT_DISPLAY}`;
      g.shadowColor = c.color; g.shadowBlur = 14;
      outlineText(g, c.name, x + cw / 2, cy + 190, c.color, 7);
      g.shadowBlur = 0;
      g.font = `700 10px ${FONT_MONO}`;
      g.fillStyle = "#8f8cb5"; g.fillText(c.tag, x + cw / 2, cy + 206);

      const stats = [["WEIGHT", c.weight / 1.5], ["SPEED", c.speed / 6], ["JUMP", (c.jump - 11) / 2.2]];
      let sy = cy + 220;
      g.textAlign = "left";
      stats.forEach(([label, v]) => {
        g.font = `700 9px ${FONT_MONO}`;
        g.fillStyle = "#6b6a85"; g.fillText(label, x + 16, sy + 8);
        g.fillStyle = "rgba(255,255,255,.1)";
        roundRect(g, x + 74, sy + 1, cw - 92, 7, 3); g.fill();
        g.fillStyle = c.color;
        roundRect(g, x + 74, sy + 1, (cw - 92) * clamp(v, 0.08, 1), 7, 3); g.fill();
        sy += 15;
      });

      picked.forEach((pi, k) => {
        g.fillStyle = PLAYER_TINT[pi];
        g.shadowColor = PLAYER_TINT[pi]; g.shadowBlur = 12;
        roundRect(g, x + 10 + k * 34, cy + 10, 28, 18, 5); g.fill();
        g.shadowBlur = 0;
        g.fillStyle = "#07060f"; g.font = `700 11px ${FONT_MONO}`; g.textAlign = "center";
        g.fillText("P" + (pi + 1), x + 24 + k * 34, cy + 23);
      });
      g.restore();

      if (hov && Mouse.click) {
        const sl = this.slots[this.selIndex];
        if (sl.mode === "off") sl.mode = this.selIndex === 0 ? "human" : "cpu";
        sl.charId = c.id;
        Snd.ui();
      }
      x += cw + gap;
    });

    // ---- slot row ----
    const sw = 268, sgap = 16;
    let sx = (W - (4 * sw + 3 * sgap)) / 2;
    const sy2 = 404;
    this.slots.forEach((s, i) => {
      const c = CHAR_BY_ID[s.charId];
      const sel = this.selIndex === i, off = s.mode === "off";
      g.save();
      g.globalAlpha = off ? 0.5 : 1;
      g.fillStyle = sel ? "rgba(255,255,255,.08)" : "rgba(8,6,18,.82)";
      roundRect(g, sx, sy2, sw, 104, 12); g.fill();
      g.strokeStyle = sel ? PLAYER_TINT[i] : "rgba(255,255,255,.2)";
      g.lineWidth = sel ? 3 : 2;
      if (sel) { g.shadowColor = PLAYER_TINT[i]; g.shadowBlur = 20; }
      roundRect(g, sx, sy2, sw, 104, 12); g.stroke();
      g.shadowBlur = 0;
      g.textAlign = "left";
      g.font = `700 14px ${FONT_MONO}`; g.fillStyle = PLAYER_TINT[i];
      g.fillText(`PLAYER ${i + 1}`, sx + 14, sy2 + 22);
      g.font = `900 24px ${FONT_DISPLAY}`;
      g.fillStyle = off ? "#4a4866" : c.color;
      g.fillText(off ? "— EMPTY —" : c.name, sx + 14, sy2 + 48);
      g.font = `400 9px ${FONT_MONO}`; g.fillStyle = "#6b6a85";
      const b = Settings.binds[i];
      g.fillText(`${keyLabel(b.left)}${keyLabel(b.right)} move · ${keyLabel(b.light)} ${keyLabel(b.heavy)} ${keyLabel(b.special)} · ${keyLabel(b.super)} super`,
                 sx + 14, sy2 + 63);
      g.restore();

      [["OFF", "off"], ["HUMAN", "human"], ["CPU", "cpu"]].forEach(([lab, m], k) => {
        if (btn(sx + 12 + k * 80, sy2 + 70, 74, 24, lab, {
          active: s.mode === m,
          color: m === "cpu" ? "#ffc83d" : m === "human" ? "#b6ff3b" : "#6b6a85",
          font: `700 11px ${FONT_MONO}`,
        })) { s.mode = m; this.selIndex = i; Snd.ui(); }
      });
      if (Mouse.x > sx && Mouse.x < sx + sw && Mouse.y > sy2 && Mouse.y < sy2 + 66 && Mouse.click) {
        this.selIndex = i; Snd.ui();
      }
      sx += sw + sgap;
    });

    // ---- moveset readout for the highlighted fighter ----
    const sc = CHAR_BY_ID[this.slots[this.selIndex].charId];
    g.save();
    g.textAlign = "center";
    g.font = `700 11px ${FONT_MONO}`;
    const active = this.slots.filter(s => s.mode !== "off").length;
    g.fillStyle = active >= 2 ? "#b6ff3b" : "#ff2e88";
    g.fillText(active >= 2
      ? `SELECTED SLOT: PLAYER ${this.selIndex + 1} — click a fighter card to assign`
      : "NEED AT LEAST 2 FIGHTERS", W / 2, 532);

    const moves = [
      ["LIGHT", sc.light.name, sc.color],
      ["HEAVY", sc.heavy.name, sc.color],
      ["SPECIAL", sc.special.name, sc.accent],
      ["SUPER", sc.super.name, "#ffffff"],
    ];
    let mx = W / 2 - 480;
    moves.forEach(([lab, nm, col]) => {
      g.textAlign = "left";
      g.font = `700 9px ${FONT_MONO}`; g.fillStyle = "#6b6a85";
      g.fillText(lab, mx, 558);
      g.font = `700 13px ${FONT_MONO}`; g.fillStyle = col;
      g.fillText(nm.toUpperCase(), mx, 574);
      mx += 240;
    });
    g.textAlign = "center";
    g.font = `400 11px ${FONT_MONO}`; g.fillStyle = "#8f8cb5";
    g.fillText(sc.super.desc, W / 2, 598);
    g.restore();

    if (btn(W / 2 - 230, 620, 200, 44, "◀ BACK", { color: "#ff2e88" })) { this.screen = "title"; Snd.ui(); }
    if (btn(W / 2 + 30, 620, 200, 44, "PICK STAGE ▶",
        { color: active >= 2 ? "#b6ff3b" : "#444", disabled: active < 2, font: `700 17px ${FONT_MONO}` }))
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
      g.fillStyle = "rgba(8,6,18,.88)";
      roundRect(g, x, cy, cw, chh, 14); g.fill();

      // live thumbnail of the stage's own background + deck
      g.save();
      g.beginPath(); roundRect(g, x + 10, cy + 10, cw - 20, 150, 9); g.clip();
      g.translate(x + 10, cy + 10);
      g.scale((cw - 20) / W, 150 / H * 2.0);
      g.translate(0, -H * 0.18);
      s.drawBg.call(s, g, performance.now() / 1000 + i * 7);
      g.restore();
      // mini deck line
      g.save();
      g.translate(x + cw / 2, cy + 128);
      const ta = Math.sin(performance.now() / 900 + i) * 0.14;
      g.rotate(ta);
      const half = Math.abs(s.layout[0].x2) * 0.30;
      g.strokeStyle = s.pal.platEdge; g.lineWidth = 4;
      g.shadowColor = s.pal.platEdge; g.shadowBlur = 14;
      g.beginPath(); g.moveTo(-half, 0); g.lineTo(half, 0); g.stroke();
      g.restore();

      g.strokeStyle = sel ? s.pal.platEdge : hov ? hexA(s.pal.platEdge, 0.7) : "rgba(255,255,255,.18)";
      g.lineWidth = sel ? 3 : 2;
      if (sel || hov) { g.shadowColor = s.pal.platEdge; g.shadowBlur = sel ? 26 : 14; }
      roundRect(g, x, cy, cw, chh, 14); g.stroke();
      g.shadowBlur = 0;

      g.textAlign = "center";
      g.font = `900 26px ${FONT_DISPLAY}`;
      outlineText(g, s.name, x + cw / 2, cy + 192, s.pal.platEdge, 6);
      g.font = `700 9px ${FONT_MONO}`; g.fillStyle = "#8f8cb5";
      g.fillText(s.tag, x + cw / 2, cy + 208);

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
    g.fillText("EVERY STAGE RETUNES THE PIVOT AND MOVES THE BLAST ZONES — THEY ARE NOT RESKINS", W / 2, 474);
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

        g.save();
        g.fillStyle = capturing ? hexA(PLAYER_TINT[p], 0.25)
                    : hov ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.045)";
        roundRect(g, cx, cy, colW, ch, 6); g.fill();
        g.strokeStyle = capturing ? PLAYER_TINT[p] : hov ? hexA(PLAYER_TINT[p], 0.7) : "rgba(255,255,255,.12)";
        g.lineWidth = capturing ? 2 : 1;
        if (capturing) { g.shadowColor = PLAYER_TINT[p]; g.shadowBlur = 14; }
        roundRect(g, cx, cy, colW, ch, 6); g.stroke();
        g.shadowBlur = 0;
        g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `700 ${capturing ? 10 : 12}px ${FONT_MONO}`;
        g.fillStyle = capturing ? "#ffffff" : code ? "#e8e6f8" : "#ff2e88";
        g.fillText(label, cx + colW / 2, cy + ch / 2);
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
        note: "Impact shake on hits, KOs and Snap-Backs.",
        steps: [["OFF", 0], ["LOW", 0.5], ["NORMAL", 1.0], ["HIGH", 1.6]] },
      { key: "particles", label: "Particle Density",
        note: "Lower this if the game ever drops frames on a big 4-player Snap-Back.",
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
      ["h2", "THE TILT STAGE"],
      ["b", "The main platform balances on a pivot and leans toward whichever side holds more fighter weight."],
      ["b", "Tilted ground slides you downhill and robs your traction, so camping a ledge is a gamble."],
      ["b", "Big hits shove the pivot too. Watch the BALANCE BAR across the top of the screen."],
      ["w", "If the stage tips past its limit it SNAPS BACK and launches everyone riding it. Weaponise that."],
      ["", ""],
      ["h3", "SUPERS"],
      ["b", "Dealing and taking damage fills your super meter — the bar under your damage %."],
      ["b", "At full, your Super button fires a move only your fighter has. You have armour while it runs."],
      ["", ""],
      ["h4", "STAGES"],
      ["b", "Four maps, and they are not reskins. The Foundry swings like a wrecking ball over a short drop."],
      ["b", "The Drift rights itself almost instantly and is very hard to die on. The Vault leans much further"],
      ["b", "before it lets go, and its walls are close enough to kill you at low percent."],
    ];
    let y = 136;
    g.save();
    g.textAlign = "left";
    for (const [k, t] of lines) {
      if (!t) { y += 10; continue; }
      if (k === "b") { g.font = `400 14px ${FONT_MONO}`; g.fillStyle = "#b7b4d4"; }
      else if (k === "w") { g.font = `700 14px ${FONT_MONO}`; g.fillStyle = "#ff2e88"; }
      else {
        g.font = `700 17px ${FONT_MONO}`;
        g.fillStyle = k === "h" ? "#ffffff" : k === "h2" ? "#b6ff3b" : k === "h3" ? "#ffc83d" : "#00e5ff";
      }
      g.fillText(t, 150, y);
      y += (k === "b" || k === "w") ? 23 : 28;
    }
    g.restore();

    if (btn(W / 2 - 210, H - 76, 190, 44, "CONTROLS", { color: "#00e5ff" }))
      { this.returnTo = "howto"; this.screen = "controls"; Snd.ui(); }
    if (btn(W / 2 + 20, H - 76, 190, 44, "BACK", { color: "#ff2e88" })) { this.screen = "title"; Snd.ui(); }
  },

  /* ================================================================ PAUSE */
  drawPause() {
    g.save();
    g.fillStyle = "rgba(6,5,14,.80)"; g.fillRect(0, 0, W, H);
    g.textAlign = "center";
    g.font = `900 76px ${FONT_DISPLAY}`;
    g.shadowColor = "#00e5ff"; g.shadowBlur = 30;
    outlineText(g, "PAUSED", W / 2, 150, "#ffffff", 10);
    g.shadowBlur = 0;
    g.font = `700 12px ${FONT_MONO}`; g.fillStyle = "#8f8cb5";
    g.fillText(`${Stage.def.name}  ·  BALANCE ${(Stage.balance() * 100).toFixed(0)}%  ·  SNAP-BACKS ${Stage.snapCount}`,
               W / 2, 182);
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
    const title = wn ? `${wn.ch.name} WINS` : (r.endedBy === "time" ? "TIME — DRAW" : "DRAW");
    g.shadowColor = wn ? wn.ch.color : "#ffffff"; g.shadowBlur = 34;
    outlineText(g, title, W / 2, 112, wn ? wn.ch.color : "#ffffff", 11);
    g.shadowBlur = 0;
    g.font = `700 12px ${FONT_MONO}`; g.fillStyle = "#8f8cb5";
    g.fillText(`${r.endedBy === "time" ? "TIME LIMIT" : "LAST FIGHTER STANDING"}  ·  ${r.stage.name}`
      + `  ·  ${(r.frames / 60).toFixed(1)}s  ·  SNAP-BACKS ${r.snapbacks}`, W / 2, 140);
    g.restore();

    const cols = [["KOs", 560], ["FALLS", 672], ["DAMAGE", 800], ["SUPERS", 920], ["SNAP-BACKS", 1046], ["STOCKS", 1160]];
    g.save();
    g.font = `700 10px ${FONT_MONO}`; g.fillStyle = "#6b6a85";
    g.textAlign = "left"; g.fillText("FIGHTER", 140, 182);
    g.textAlign = "center";
    cols.forEach(([t, cx]) => g.fillText(t, cx, 182));
    g.strokeStyle = "rgba(255,255,255,.14)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(130, 192); g.lineTo(W - 110, 192); g.stroke();
    g.restore();

    const sorted = r.fighters.slice().sort((a, b) =>
      (b.stocks - a.stocks) || (b.stats.kos - a.stats.kos) || (b.stats.damageDealt - a.stats.damageDealt));

    let y = 228;
    sorted.forEach(f => {
      const win = f === wn;
      g.save();
      if (win) {
        g.fillStyle = hexA(f.ch.color, 0.12);
        roundRect(g, 130, y - 28, W - 240, 54, 10); g.fill();
        g.strokeStyle = hexA(f.ch.color, 0.5); g.lineWidth = 2;
        roundRect(g, 130, y - 28, W - 240, 54, 10); g.stroke();
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
      g.fillText(`P${f.slot + 1}${f.isCPU ? " · CPU" : ""}`, 196, y + 16);
      if (win) {
        g.font = `700 11px ${FONT_MONO}`; g.fillStyle = "#b6ff3b";
        g.fillText("★ WINNER", 330, y + 2);
      }

      const vals = [f.stats.kos, f.stats.falls, f.stats.damageDealt.toFixed(0) + "%",
                    f.stats.supers, f.stats.snapbacks, Math.max(0, f.stocks)];
      g.textAlign = "center";
      g.font = `900 28px ${FONT_DISPLAY}`; g.fillStyle = "#f2f0ff";
      vals.forEach((v, i) => g.fillText(String(v), cols[i][1], y + 6));
      g.restore();
      y += 64;
    });

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
