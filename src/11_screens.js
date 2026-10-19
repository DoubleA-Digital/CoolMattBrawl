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
      g.translate(0, hov ? -4 : 0);
      panel(g, x, cy, cw, 284, {
        cut: 15, fill: "#110e24", accent: c.color,
        accentA: hov ? 1 : 0.5, glow: hov ? 22 : 6,
      });
      // a wash of the fighter's colour rising from the card's foot
      g.save();
      notchPath(g, x, cy, cw, 284, 15); g.clip();
      const wq = g.createLinearGradient(0, cy + 284, 0, cy + 120);
      wq.addColorStop(0, hexA(c.color, hov ? 0.22 : 0.12));
      wq.addColorStop(1, hexA(c.color, 0));
      g.fillStyle = wq; g.fillRect(x, cy, cw, 284);
      // The fighter's initial as a watermark, sitting high so the art covers
      // most of it — at name height its glyph box showed as a pale block
      // behind the lettering and muddied it.
      g.globalAlpha = 0.055;
      g.font = `900 190px ${FONT_DISPLAY}`; g.textAlign = "center";
      g.fillStyle = c.color;
      g.fillText(c.name[0], x + cw / 2, cy + 168);
      g.restore();

      // full-size fighter art
      g.save();
      // y places the fighter's feet just clear of the name plate below
      g.translate(x + cw / 2, cy + 100);
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
      panel(g, sx, sy2, sw, 104, {
        cut: 12, fill: sel ? mixColor("#14112a", PLAYER_TINT[i], 0.14) : "#110e22",
        accent: PLAYER_TINT[i], accentA: sel ? 1 : 0.45, glow: sel ? 20 : 0,
        only: { tl: 1, br: 1 },
      });
      // a tint strip down the left edge identifies the slot at a glance
      g.save();
      notchPath(g, sx, sy2, sw, 104, 12, { tl: 1, br: 1 }); g.clip();
      g.fillStyle = hexA(PLAYER_TINT[i], off ? 0.25 : 0.7);
      g.fillRect(sx, sy2, 4, 104);
      g.restore();
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
      const ta = Math.sin(performance.now() / 900 + i) * 0.14;
      g.rotate(ta);
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

    if (btn(W / 2 - 210, H - 76, 190, 44, "CONTROLS", { color: "#00e5ff" }))
      { this.returnTo = "howto"; this.screen = "controls"; Snd.ui(); }
    if (btn(W / 2 + 20, H - 76, 190, 44, "BACK", { color: "#ff2e88" })) { this.screen = "title"; Snd.ui(); }
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

    // live readout of the thing that matters while stopped: the pivot
    g.save();
    const pw = 420, px2 = W / 2 - pw / 2;
    panel(g, px2, 164, pw, 34, { cut: 9, fill: "#120f26", accent: "#00e5ff", accentA: 0.4 });
    g.textAlign = "center"; g.font = `700 11px ${FONT_MONO}`;
    g.fillStyle = UI.dim;
    g.fillText(`${Stage.def.name}   ·   BALANCE ${(Stage.balance() * 100).toFixed(0)}%   ·   SNAP-BACKS ${Stage.snapCount}`,
               W / 2, 185);
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

    // x positions kept inside the row plate, which ends at W-110
    const cols = [["KOs", 556], ["FALLS", 664], ["DAMAGE", 788], ["SUPERS", 902], ["SNAP-BACKS", 1024], ["STOCKS", 1134]];
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
