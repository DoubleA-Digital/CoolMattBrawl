/* ==========================================================================
   12c. META — tournament, cosmetics shop, profile and account screens

   These hang off Game like every other screen; 11_screens.js routes to them.
   ========================================================================== */

function shuffled(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A gold coin, for prices and balances. */
function coinIcon(g, x, y, r) {
  g.save();
  g.fillStyle = UI.ink; g.beginPath(); g.arc(x, y + 1, r + 1.5, 0, 7); g.fill();
  const q = g.createLinearGradient(0, y - r, 0, y + r);
  q.addColorStop(0, "#fff0a0"); q.addColorStop(0.5, "#ffc83d"); q.addColorStop(1, "#b07a00");
  g.fillStyle = q; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.strokeStyle = "rgba(120,70,0,.7)"; g.lineWidth = Math.max(1, r * 0.18);
  g.beginPath(); g.arc(x, y, r * 0.62, 0, 7); g.stroke();
  g.restore();
}

/** Coin balance chip. Returns its width. */
/** prefix goes in front of the number ("+" for a payout). */
function coinChip(g, n, x, y, align, prefix) {
  g.save();
  g.font = `700 15px ${FONT_MONO}`;
  const txt = (prefix || "") + Math.floor(n).toLocaleString();
  const w = g.measureText(txt).width + 46;
  const bx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  panel(g, bx, y, w, 32, { cut: 8, fill: "#17122a", accent: "#ffc83d", accentA: 0.8, glow: 8 });
  coinIcon(g, bx + 18, y + 16, 8);
  g.fillStyle = "#ffe9a8"; g.textAlign = "left"; g.textBaseline = "middle";
  g.fillText(txt, bx + 33, y + 17);
  g.restore();
  return w;
}

const IDLE_POSE = () => ({ time: performance.now() / 16, runPhase: 0, running: false, air: false,
                           vx: 0, vy: 0, state: ST.IDLE, flash: false, atkPhase: -1 });

/* ============================================================ TOURNAMENT
   Eight entrants, single elimination. Local players take their own seats
   and controls; CPUs fill the bracket. Any match with a human in it is
   played; CPU-vs-CPU matches are called instantly so nobody sits through
   them. */
const Tourney = {
  ROUND_NAMES: ["QUARTERFINALS", "SEMIFINALS", "FINAL"],
  /** Coins for how far P1 got, paid when their run ends. */
  PLACING: [10, 30, 60, 150],

  create(humanChars) {
    const taken = new Set(humanChars);
    const pool = shuffled(ROSTER.map(c => c.id).filter(id => !taken.has(id)));
    const entrants = humanChars.map((id, i) => ({ charId: id, human: i }));
    while (entrants.length < 8) entrants.push({ charId: pool.pop(), human: null });
    const order = shuffled(entrants.map((_, i) => i));
    return {
      entrants,
      rounds: [order, [null, null, null, null], [null, null], [null]],
      stocks: {},             // "r-m" -> stocks the winner had left
      stage: {},              // "r-m" -> stage index, rolled when it comes up
      cur: null,              // the human match in progress
      paid: false,
      lastReward: 0,
    };
  },

  next(t) {
    for (let r = 0; r < 3; r++) {
      for (let m = 0; m < t.rounds[r].length / 2; m++) {
        const a = t.rounds[r][2 * m], b = t.rounds[r][2 * m + 1];
        if (a != null && b != null && t.rounds[r + 1][m] == null) return { r, m, a, b };
      }
    }
    return null;
  },
  isHuman(t, nm) { return t.entrants[nm.a].human != null || t.entrants[nm.b].human != null; },
  done(t) { return t.rounds[3][0] != null; },
  /** Round P1 is still alive in, or -1 once they are out. */
  p1Alive(t) {
    const me = t.entrants.findIndex(e => e.human === 0);
    for (let r = 0; r < 3; r++) {
      const m = t.rounds[r].indexOf(me) >> 1;
      const w = t.rounds[r + 1][m];
      if (w == null) return r;          // still waiting to play this round
      if (w !== me) return -1;          // lost it
    }
    return 3;                           // won the final
  },

  stageFor(t, nm) {
    const k = nm.r + "-" + nm.m;
    if (t.stage[k] == null) t.stage[k] = Math.floor(Math.random() * STAGES.length);
    return t.stage[k];
  },

  resolve(t, nm, winner, stocksLeft) {
    t.rounds[nm.r + 1][nm.m] = winner;
    t.stocks[nm.r + "-" + nm.m] = stocksLeft;
    this.settle(t);
  },

  /** P1's run is over (out, or champion): pay the placing once. */
  settle(t) {
    if (t.paid) return;
    const me = t.entrants.findIndex(e => e.human === 0);
    let reached = -1;
    for (let r = 3; r >= 0; r--) if (t.rounds[r].includes(me)) { reached = r; break; }
    const out = this.p1Alive(t) === -1;
    const champ = this.done(t) && t.rounds[3][0] === me;
    if (!out && !champ) return;
    t.paid = true;
    t.lastReward = this.PLACING[Math.max(0, reached)];
    Profile.award(t.lastReward);
    if (champ) { Profile.d.stats.tourneyWins++; Profile.persist(); }
  },

  simulate(t, nm) {
    const winner = Math.random() < 0.5 ? nm.a : nm.b;
    this.resolve(t, nm, winner, 1 + Math.floor(Math.random() * 3));
  },

  /** Build and start the human match. Each human sits in their own seat so
      they keep their own controls; the CPU takes the first free one. */
  play(t, nm) {
    const slots = [0, 1, 2, 3].map(i => ({ charId: ROSTER[i].id, mode: "off", team: i % 2 }));
    const bySlot = {};
    const humans = [nm.a, nm.b].filter(e => t.entrants[e].human != null);
    const cpus = [nm.a, nm.b].filter(e => t.entrants[e].human == null);
    for (const e of humans) {
      const h = t.entrants[e].human;
      slots[h] = { charId: t.entrants[e].charId, mode: "human", team: 0 };
      if (h === 0) Object.assign(slots[h], { cos: Profile.cosFor(slots[h].charId), name: Profile.name });
      bySlot[h] = e;
    }
    for (const e of cpus) {
      const i = slots.findIndex(s => s.mode === "off");
      slots[i] = { charId: t.entrants[e].charId, mode: "cpu", team: 0 };
      bySlot[i] = e;
    }
    t.cur = { nm, slots, bySlot, stage: this.stageFor(t, nm) };
    Game.startTourneyMatch();
  },

  /** Results of the human match: advance the winner, or replay a draw. */
  onResults(t, match) {
    if (!t.cur || match !== t.cur.match) return null;
    const w = match.winner;
    if (!w) return { draw: true };
    const e = t.cur.bySlot[w.slot];
    const nm = t.cur.nm;
    t.cur = null;
    this.resolve(t, nm, e, Math.max(1, w.stocks));
    return { winner: e, p1Won: t.entrants[e].human === 0, round: nm.r };
  },
};

Object.assign(Game, {
  /* ================================================ TOURNAMENT: SETUP */
  openTourney() {
    if (this.tourney && !Tourney.done(this.tourney)) { this.screen = "tourney"; return; }
    this.tourney = null;
    const n = Math.max(1, this.slots.filter(s => s.mode === "human").length);
    this.tsetup = { humans: Math.min(4, n), chars: this.slots.map(s => s.charId) };
    if (Profile.d.favs.length) this.tsetup.chars[0] = Profile.d.favs[0];
    this.screen = "tsetup";
  },

  updateTsetup() {
    if (Keys.pressed["Escape"]) { this.screen = "title"; Snd.ui(); }
    else if (Keys.pressed["Enter"]) this.beginTourney();
  },

  beginTourney() {
    const ts = this.tsetup;
    const chars = ts.chars.slice(0, ts.humans);
    this.tourney = Tourney.create(chars);
    Profile.d.stats.tourneys++; Profile.persist();
    this.screen = "tourney";
    Snd.uiBig();
  },

  drawTsetup() {
    Stage.def = STAGES[2];
    drawBackground();
    g.save(); g.fillStyle = "rgba(6,5,14,.74)"; g.fillRect(0, 0, W, H); g.restore();
    screenTitleBar("8-FIGHTER BRACKET", "TOURNAMENT", "#ffc83d");
    const ts = this.tsetup;

    g.save();
    g.textAlign = "center"; g.font = `500 13px ${FONT_MONO}`; g.fillStyle = "#d6d3ee";
    g.fillText("Single elimination: three wins takes the trophy. CPUs fill the rest of the bracket.", W / 2, 128);
    g.fillText("Win matches for coins, plus a payout for how far you get — 150 for the champion.", W / 2, 148);
    g.restore();

    // how many people on this keyboard
    g.save(); g.textAlign = "right"; g.font = `700 11px ${FONT_MONO}`; g.fillStyle = "#8e8bb2";
    g.fillText("LOCAL PLAYERS", W / 2 - 150, 194); g.restore();
    for (let n = 1; n <= 4; n++) {
      if (btn(W / 2 - 136 + (n - 1) * 72, 172, 64, 34, String(n),
              { active: ts.humans === n, color: "#ffc83d", font: `700 15px ${FONT_MONO}` }))
        { ts.humans = n; Snd.ui(); }
    }

    // one card per local player, with ◀ ▶ to change fighter
    const cw = 250, gap = 20, total = ts.humans * cw + (ts.humans - 1) * gap;
    let x = (W - total) / 2;
    for (let i = 0; i < ts.humans; i++) {
      const c = CHAR_BY_ID[ts.chars[i]];
      const y = 228;
      panel(g, x, y, cw, 300, { cut: 14, fill: "#110e24", accent: PLAYER_TINT[i], accentA: 0.9, glow: 12 });
      g.save();
      notchPath(g, x, y, cw, 300, 14); g.clip();
      const q = g.createLinearGradient(0, y + 300, 0, y + 60);
      q.addColorStop(0, hexA(c.color, 0.22)); q.addColorStop(1, hexA(c.color, 0));
      g.fillStyle = q; g.fillRect(x, y, cw, 300);
      g.translate(x + cw / 2, y + 190); g.scale(1.9, 1.9);
      Cosmetics.portrait(g, c, i === 0 ? Profile.cosFor(c.id) : null, IDLE_POSE());
      g.restore();
      g.save();
      g.textAlign = "center";
      g.font = `700 12px ${FONT_MONO}`; g.fillStyle = PLAYER_TINT[i];
      g.fillText(i === 0 && Profile.name ? `P1 · ${Profile.name}` : `PLAYER ${i + 1}`, x + cw / 2, y + 26);
      g.font = `900 26px ${FONT_DISPLAY}`;
      outlineText(g, c.name, x + cw / 2, y + 238, c.color, 6);
      g.font = `700 10px ${FONT_MONO}`; g.fillStyle = "#aeabd4";
      g.fillText(c.tag, x + cw / 2, y + 254);
      g.restore();
      const step = d => {
        let k = ROSTER.indexOf(c);
        k = (k + d + ROSTER.length) % ROSTER.length;
        ts.chars[i] = ROSTER[k].id; Snd.ui();
      };
      if (btn(x + 14, y + 262, 60, 28, "◀", { color: PLAYER_TINT[i] })) step(-1);
      if (btn(x + cw - 74, y + 262, 60, 28, "▶", { color: PLAYER_TINT[i] })) step(1);
      x += cw + gap;
    }

    if (btn(W / 2 - 230, H - 72, 200, 48, "◀ BACK", { color: "#ff2e88" })) { this.screen = "title"; Snd.ui(); }
    if (btn(W / 2 + 30, H - 72, 200, 48, "START ▶", { color: "#b6ff3b", font: `700 18px ${FONT_MONO}` }))
      this.beginTourney();
  },

  /* ============================================== TOURNAMENT: BRACKET */
  updateTourney() {
    if (Keys.pressed["Escape"]) { this.screen = "title"; Snd.ui(); return; }
    if (Keys.pressed["Enter"] || Keys.pressed["Space"]) this.tourneyAdvance();
  },

  /** The one button on the bracket: play your match, or call the next CPU one. */
  tourneyAdvance() {
    const t = this.tourney;
    if (!t) return;
    if (Tourney.done(t)) { this.tourney = null; this.openTourney(); return; }
    const nm = Tourney.next(t);
    if (!nm) return;
    if (Tourney.isHuman(t, nm)) { Tourney.play(t, nm); return; }
    Tourney.simulate(t, nm);
    this.tFlash = { key: nm.r + "-" + nm.m, at: performance.now() };
    Snd.blip(720);
    if (Tourney.done(t)) Snd.uiBig();
  },

  /** Sim through every CPU match up to the next one that needs a person. */
  tourneySkip() {
    const t = this.tourney;
    let nm;
    while (t && (nm = Tourney.next(t)) && !Tourney.isHuman(t, nm)) Tourney.simulate(t, nm);
    Snd.uiBig();
  },

  startTourneyMatch() {
    const cur = this.tourney && this.tourney.cur;
    if (!cur) return;
    this.match = new Match(cur.slots, STAGES[cur.stage], { teams: false, items: this.items });
    cur.match = this.match;
    this.screen = "match";
    Snd.uiBig();
  },

  drawTourney() {
    const t = this.tourney;
    Stage.def = STAGES[2];
    drawBackground();
    g.save(); g.fillStyle = "rgba(6,5,14,.78)"; g.fillRect(0, 0, W, H); g.restore();
    const nm = Tourney.next(t);
    const done = Tourney.done(t);
    screenTitleBar(done ? "TOURNAMENT OVER" : Tourney.ROUND_NAMES[nm.r], "TOURNAMENT", "#ffc83d");
    coinChip(g, Profile.d.coins, W - 40, 30, "right");

    const colX = [70, 360, 650, 940];
    const boxW = 250, boxH = 40;
    const ys = [[], [], [], []];
    for (let i = 0; i < 8; i++) ys[0][i] = 118 + i * 56 + (i >> 1) * 6;
    for (let r = 1; r < 4; r++)
      for (let i = 0; i < t.rounds[r].length; i++) ys[r][i] = (ys[r - 1][2 * i] + ys[r - 1][2 * i + 1]) / 2;

    // connectors
    g.save();
    for (let r = 0; r < 3; r++) {
      for (let m = 0; m < t.rounds[r].length / 2; m++) {
        const y1 = ys[r][2 * m] + boxH / 2, y2 = ys[r][2 * m + 1] + boxH / 2, yo = ys[r + 1][m] + boxH / 2;
        const x1 = colX[r] + boxW, xm = (x1 + colX[r + 1]) / 2, x2 = colX[r + 1];
        const live = nm && nm.r === r && nm.m === m;
        const decided = t.rounds[r + 1][m] != null;
        g.strokeStyle = live ? "#ffc83d" : decided ? "rgba(182,255,59,.5)" : "rgba(255,255,255,.16)";
        g.lineWidth = live ? 3 : 2;
        if (live) { g.shadowColor = "#ffc83d"; g.shadowBlur = 12; } else g.shadowBlur = 0;
        g.beginPath();
        g.moveTo(x1, y1); g.lineTo(xm, y1); g.lineTo(xm, y2); g.lineTo(x1, y2);
        g.moveTo(xm, yo); g.lineTo(x2, yo);
        g.stroke();
      }
    }
    g.restore();

    const flashOn = this.tFlash && performance.now() - this.tFlash.at < 700;
    for (let r = 0; r < 4; r++) {
      t.rounds[r].forEach((e, i) => {
        const x = colX[r], y = ys[r][i];
        const ent = e == null ? null : t.entrants[e];
        const c = ent && CHAR_BY_ID[ent.charId];
        const m = i >> 1;
        const lost = r < 3 && e != null && t.rounds[r + 1][m] != null && t.rounds[r + 1][m] !== e;
        const live = nm && nm.r === r && (nm.a === e || nm.b === e) && e != null;
        const champ = r === 3 && e != null;
        const isP1 = ent && ent.human === 0;
        const accent = champ ? "#ffc83d" : c ? c.color : UI.line;
        g.save();
        g.globalAlpha = lost ? 0.38 : 1;
        panel(g, x, y, boxW, boxH, {
          cut: 9, fill: live ? mixColor("#14112a", accent, 0.18) : "#110e22",
          accent, accentA: live || champ ? 1 : 0.5, glow: live || champ ? 14 : 0, shadow: !lost,
        });
        if (c) {
          g.save();
          notchPath(g, x + 2, y + 2, boxW - 4, boxH - 4, 8); g.clip();
          g.translate(x + 28, y + 23); g.scale(0.46, 0.46);
          Cosmetics.portrait(g, c, isP1 ? Profile.cosFor(c.id) : null, IDLE_POSE());
          g.restore();
          g.textAlign = "left";
          g.font = `900 16px ${FONT_DISPLAY}`; g.fillStyle = c.color;
          g.fillText(c.name, x + 54, y + 26);
          g.font = `700 10px ${FONT_MONO}`; g.textAlign = "right";
          if (ent.human != null) {
            g.fillStyle = PLAYER_TINT[ent.human];
            g.fillText(ent.human === 0 && Profile.name ? Profile.name : `P${ent.human + 1}`, x + boxW - 12, y + 17);
          } else { g.fillStyle = "#8e8bb2"; g.fillText("CPU", x + boxW - 12, y + 17); }
          const sk = (r - 1) + "-" + (i);   // stocks shown on the winner's box
          if (r > 0 && t.stocks[sk] != null) {
            g.fillStyle = "#b6ff3b";
            g.fillText("●".repeat(t.stocks[sk]), x + boxW - 12, y + 31);
          }
          if (flashOn && r > 0 && this.tFlash.key === sk) {
            g.globalAlpha = 1 - (performance.now() - this.tFlash.at) / 700;
            notchPath(g, x, y, boxW, boxH, 9); g.fillStyle = "#ffffff"; g.fill();
          }
        } else {
          g.textAlign = "left"; g.font = `700 11px ${FONT_MONO}`; g.fillStyle = "#4a4866";
          g.fillText("—", x + 18, y + 25);
        }
        g.restore();
      });
    }
    // trophy over the final slot
    g.save();
    g.textAlign = "center"; g.font = `700 11px ${FONT_MONO}`; g.fillStyle = "#ffc83d";
    g.fillText("★ CHAMPION ★", colX[3] + boxW / 2, ys[3][0] - 12);
    g.restore();

    /* ---- status and the buttons ---- */
    const alive = Tourney.p1Alive(t);
    let msg, label;
    if (done) {
      const ch = t.entrants[t.rounds[3][0]];
      msg = ch.human === 0 ? "YOU ARE THE CHAMPION!" : ch.human != null ? `P${ch.human + 1} IS THE CHAMPION!`
          : `${CHAR_BY_ID[ch.charId].name} (CPU) WINS THE TOURNAMENT`;
      label = "NEW TOURNAMENT";
    } else if (Tourney.isHuman(t, nm)) {
      const ea = t.entrants[nm.a], eb = t.entrants[nm.b];
      msg = `UP NEXT: ${CHAR_BY_ID[ea.charId].name} vs ${CHAR_BY_ID[eb.charId].name}  ·  ${STAGES[Tourney.stageFor(t, nm)].name}`;
      label = "PLAY MATCH ▶";
    } else {
      const ea = t.entrants[nm.a], eb = t.entrants[nm.b];
      msg = `CPU MATCH: ${CHAR_BY_ID[ea.charId].name} vs ${CHAR_BY_ID[eb.charId].name}`;
      label = "NEXT RESULT ▶";
    }
    g.save();
    g.textAlign = "center"; g.font = `700 14px ${FONT_MONO}`;
    g.fillStyle = done ? "#ffc83d" : "#f2f0ff";
    g.fillText(msg, W / 2 + 140, H - 108);
    if (t.paid && t.lastReward) {
      g.font = `700 12px ${FONT_MONO}`; g.fillStyle = "#ffe9a8";
      g.fillText(alive === 3 ? `+${t.lastReward} COINS FOR WINNING THE TOURNAMENT`
                             : `ELIMINATED — +${t.lastReward} COINS FOR YOUR RUN`, W / 2 + 140, H - 88);
    }
    g.restore();

    if (btn(70, H - 72, 180, 48, "◀ TITLE", { color: "#ff2e88" })) { this.screen = "title"; Snd.ui(); }
    if (!done && btn(270, H - 72, 200, 48, "QUIT BRACKET", { color: "#8e8bb2" }))
      { this.tourney = null; this.screen = "title"; Snd.ui(); }
    if (!done && !Tourney.isHuman(t, nm) &&
        btn(W - 520, H - 72, 220, 48, alive >= 0 ? "SKIP TO MY MATCH" : "SIM TO THE END", { color: "#00e5ff" }))
      this.tourneySkip();
    if (btn(W - 280, H - 72, 240, 48, label, { color: "#b6ff3b", font: `700 17px ${FONT_MONO}` }))
      this.tourneyAdvance();
  },

  /* ================================================================ SHOP */
  openShop() {
    this.shopTab = this.shopTab || "skin";
    this.shopChar = this.slots[0].charId;
    this.shopMsg = null;
    this.screen = "shop";
  },
  updateShop() {
    if (Keys.pressed["Escape"]) { this.screen = this.shopBack || "title"; Snd.ui(); }
    const step = d => {
      const k = ROSTER.findIndex(c => c.id === this.shopChar);
      this.shopChar = ROSTER[(k + d + ROSTER.length) % ROSTER.length].id;
    };
    if (Keys.pressed["ArrowLeft"]) { step(-1); Snd.ui(); }
    if (Keys.pressed["ArrowRight"]) { step(1); Snd.ui(); }
  },

  drawShop() {
    Stage.def = STAGES[6];
    drawBackground();
    g.save(); g.fillStyle = "rgba(6,5,14,.8)"; g.fillRect(0, 0, W, H); g.restore();
    screenTitleBar("SPEND YOUR WINNINGS", "COSMETICS SHOP", "#ffc83d");
    coinChip(g, Profile.d.coins, W - 40, 30, "right");

    const c = CHAR_BY_ID[this.shopChar];
    const items = COS_KINDS[this.shopTab];
    let hover = null;

    /* ---- the grid ---- */
    const gx = 478, gy = 166, cw = 236, chh = 116, gap = 14;
    [["skin", "SKINS"], ["hat", "HATS"], ["trail", "TRAILS"]].forEach(([k, lab], i) => {
      if (btn(gx + i * (cw + gap), 112, cw, 38, lab,
              { active: this.shopTab === k, color: "#ffc83d", font: `700 14px ${FONT_MONO}` }))
        { this.shopTab = k; this.shopMsg = null; Snd.ui(); }
    });
    items.forEach((it, i) => {
      const x = gx + (i % 3) * (cw + gap), y = gy + Math.floor(i / 3) * (chh + gap);
      const own = Profile.owns(it.id), on = own && Profile.equipped(it, c.id);
      const afford = Profile.d.coins >= it.price;
      const hov = Mouse.x > x && Mouse.x < x + cw && Mouse.y > y && Mouse.y < y + chh;
      if (hov) hover = it;
      const accent = on ? "#b6ff3b" : own ? "#00e5ff" : afford ? "#ffc83d" : "#4a4866";
      panel(g, x, y, cw, chh, { cut: 11, fill: hov ? "#18142e" : "#110e22", accent,
                                accentA: on || hov ? 1 : 0.5, glow: on ? 14 : hov ? 8 : 0 });
      // icon well
      g.save();
      notchPath(g, x + 8, y + 8, 92, chh - 16, 8); g.clip();
      g.fillStyle = "#0a0817"; g.fillRect(x + 8, y + 8, 92, chh - 16);
      this.drawItemIcon(it, c, x + 54, y + chh - 26);
      g.restore();

      g.save();
      g.textAlign = "left";
      g.font = `900 15px ${FONT_DISPLAY}`; g.fillStyle = "#f2f0ff";
      g.fillText(it.name, x + 110, y + 30);
      g.font = `700 10px ${FONT_MONO}`; g.fillStyle = "#aeabd4";
      g.fillText(it.kind === "skin" ? (it.prism ? "SHIFTS THROUGH EVERY COLOUR" : "PALETTE · ANY FIGHTER")
               : it.kind === "hat" ? "WORN ON EVERY FIGHTER" : "FOLLOWS YOU AROUND", x + 110, y + 46);
      if (!own) {
        coinIcon(g, x + 118, y + 64, 6);
        g.font = `700 13px ${FONT_MONO}`; g.fillStyle = afford ? "#ffe9a8" : "#8e8bb2";
        g.fillText(String(it.price), x + 130, y + 69);
      }
      g.restore();

      const label = on ? "EQUIPPED ✓" : own ? "EQUIP" : afford ? "BUY" : "NEED " + (it.price - Profile.d.coins);
      if (btn(x + 110, y + chh - 40, cw - 122, 28, label, {
        color: on ? "#b6ff3b" : own ? "#00e5ff" : "#ffc83d", active: on,
        disabled: !own && !afford, font: `700 11px ${FONT_MONO}` })) {
        if (own) { Profile.toggleEquip(it, c.id); Snd.ui(); }
        else if (Profile.buy(it.id)) {
          Profile.toggleEquip(it, c.id);
          this.shopMsg = { text: `BOUGHT ${it.name}`, at: performance.now() };
          Snd.uiBig();
        }
      }
    });

    /* ---- preview: the selected fighter wearing what you point at ---- */
    const px = 60, py = 112, pw = 390, ph = 440;
    panel(g, px, py, pw, ph, { cut: 16, fill: "#0f0c20", accent: c.color, accentA: 0.7, glow: 10 });
    const eq = Profile.d.equip;
    const look = {
      s: hover && hover.kind === "skin" ? hover.id : eq.skin[c.id],
      h: hover && hover.kind === "hat" ? hover.id : eq.hat,
      t: hover && hover.kind === "trail" ? hover.id : eq.trail,
    };
    g.save();
    notchPath(g, px, py, pw, ph, 16); g.clip();
    const q = g.createRadialGradient(px + pw / 2, py + 270, 10, px + pw / 2, py + 270, 220);
    q.addColorStop(0, hexA(c.color, 0.25)); q.addColorStop(1, hexA(c.color, 0));
    g.fillStyle = q; g.fillRect(px, py, pw, ph);
    // a little floor to stand on
    g.fillStyle = "rgba(255,255,255,.06)";
    g.beginPath(); g.ellipse(px + pw / 2, py + 336, 120, 14, 0, 0, 7); g.fill();
    if (look.t) {
      // the trail chases a point orbiting the fighter
      const ph2 = performance.now() / 420;
      const phantom = this._shopTrail || (this._shopTrail = { w: 40, h: 50, state: ST.IDLE });
      if (phantom.id !== look.t) { phantom._ctrail = []; phantom.id = look.t; }
      Cosmetics.drawTrail(g, phantom, px + pw / 2 + Math.cos(ph2) * 130, py + 250 + Math.sin(ph2 * 2) * 50, look.t);
    }
    g.translate(px + pw / 2, py + 300); g.scale(2.6, 2.6);
    Cosmetics.portrait(g, c, look, IDLE_POSE());
    g.restore();

    g.save();
    g.textAlign = "center";
    g.font = `900 28px ${FONT_DISPLAY}`;
    outlineText(g, c.name, px + pw / 2, py + 384, c.color, 6);
    g.font = `700 10px ${FONT_MONO}`; g.fillStyle = "#aeabd4";
    g.fillText("◀ ▶ TRY IT ON ANOTHER FIGHTER", px + pw / 2, py + 404);
    g.restore();
    const step = d => {
      const k = ROSTER.indexOf(c);
      this.shopChar = ROSTER[(k + d + ROSTER.length) % ROSTER.length].id; Snd.ui();
    };
    if (btn(px + 16, py + ph - 46, 54, 32, "◀", { color: c.color })) step(-1);
    if (btn(px + pw - 70, py + ph - 46, 54, 32, "▶", { color: c.color })) step(1);
    if (btn(px + 80, py + ph - 46, pw - 160, 32, Profile.isFav(c.id) ? "★ FAVOURITE" : "☆ ADD FAVOURITE",
            { color: "#ffc83d", active: Profile.isFav(c.id), font: `700 11px ${FONT_MONO}` }))
      { Profile.toggleFav(c.id); Snd.ui(); }

    /* ---- footer ---- */
    g.save();
    g.textAlign = "center"; g.font = `500 12px ${FONT_MONO}`;
    const m = this.shopMsg && performance.now() - this.shopMsg.at < 2200 ? this.shopMsg.text : null;
    g.fillStyle = m ? "#b6ff3b" : "#aeabd4";
    g.fillText(m || (this.shopTab === "skin"
      ? "Skins are equipped per fighter — pick a fighter on the left, then EQUIP."
      : "Earn coins by playing: wins, KOs, damage dealt, supers and tournament runs all pay."),
      W / 2 + 200, H - 108);
    g.restore();
    if (btn(60, H - 72, 180, 48, "◀ BACK", { color: "#ff2e88" })) { this.screen = this.shopBack || "title"; Snd.ui(); }
    if (btn(256, H - 72, 180, 48, "PROFILE", { color: "#00e5ff" })) this.openProfile();
  },

  drawItemIcon(it, c, cx, cy) {
    g.save();
    if (it.kind === "skin") {
      g.translate(cx, cy); g.scale(0.95, 0.95);
      Cosmetics.portrait(g, c, { s: it.id }, IDLE_POSE());
    } else if (it.kind === "hat") {
      Cosmetics._anchor._icon = { x: 0, y: 0 };
      g.translate(cx, cy - 8); g.scale(1.6, 1.6);
      Cosmetics.drawHat(g, { id: "_icon", size: { w: 46, h: 60 } }, it.id, performance.now() / 16);
    } else {
      const ph = performance.now() / 260;
      const p = this._iconTrails || (this._iconTrails = {});
      const ph0 = p[it.id] || (p[it.id] = { w: 20, h: 20, state: ST.IDLE });
      Cosmetics.drawTrail(g, ph0, cx + Math.cos(ph) * 28, cy - 30 + Math.sin(ph * 2) * 14, it.id);
      g.fillStyle = it.col; g.shadowColor = it.col; g.shadowBlur = 12;
      g.beginPath(); g.arc(cx + Math.cos(ph) * 28, cy - 30 + Math.sin(ph * 2) * 14, 5, 0, 7); g.fill();
    }
    g.restore();
  },

  /* ============================================================= PROFILE */
  openProfile() {
    Profile.fetchBoard();
    Profile.refresh();
    this.screen = "profile";
    Snd.ui();
  },
  updateProfile() {
    if (Keys.pressed["Escape"]) { this.screen = "title"; Snd.ui(); }
  },

  drawProfile() {
    Stage.def = STAGES[3];
    drawBackground();
    g.save(); g.fillStyle = "rgba(6,5,14,.82)"; g.fillRect(0, 0, W, H); g.restore();
    screenTitleBar(Profile.signedIn ? "ONLINE ACCOUNT" : "PLAYING AS GUEST", "PROFILE", "#00e5ff");
    const d = Profile.d, st = d.stats;

    /* ---- identity card ---- */
    const ix = 50, iy = 112, iw = 370, ih = 470;
    panel(g, ix, iy, iw, ih, { cut: 16, fill: "#100d22", accent: "#00e5ff", accentA: 0.7, glow: 8 });
    const top = (Object.entries(d.chars).sort((a, b) => b[1].p - a[1].p)[0] || [])[0];
    const mainId = d.favs[0] || top || this.slots[0].charId;
    const mc = CHAR_BY_ID[mainId];
    g.save();
    notchPath(g, ix, iy, iw, ih, 16); g.clip();
    const q = g.createRadialGradient(ix + iw / 2, iy + 150, 10, ix + iw / 2, iy + 150, 170);
    q.addColorStop(0, hexA(mc.color, 0.28)); q.addColorStop(1, hexA(mc.color, 0));
    g.fillStyle = q; g.fillRect(ix, iy, iw, ih);
    g.translate(ix + iw / 2, iy + 168); g.scale(1.8, 1.8);
    Cosmetics.portrait(g, mc, Profile.cosFor(mc.id), IDLE_POSE());
    g.restore();

    g.save();
    g.textAlign = "center";
    g.font = `900 34px ${FONT_DISPLAY}`;
    outlineText(g, Profile.name || "GUEST", ix + iw / 2, iy + 250, Profile.signedIn ? "#ffffff" : "#aeabd4", 7);
    g.font = `700 10px ${FONT_MONO}`; g.fillStyle = Profile.signedIn ? "#b6ff3b" : "#ffc83d";
    g.fillText(Profile.signedIn ? "● SAVED TO YOUR ACCOUNT" : "SAVED ON THIS BROWSER ONLY", ix + iw / 2, iy + 268);
    g.restore();
    coinChip(g, d.coins, ix + iw / 2, iy + 280, "center");

    g.save();
    g.textAlign = "center"; g.font = `500 11px ${FONT_MONO}`; g.fillStyle = "#aeabd4";
    if (Profile.status) { g.fillStyle = "#ffc83d"; g.fillText(Profile.status, ix + iw / 2, iy + 336); }
    else if (!Profile.signedIn) {
      g.fillText("Make an account to keep your coins, stats", ix + iw / 2, iy + 330);
      g.fillText("and cosmetics on any device.", ix + iw / 2, iy + 346);
    }
    g.restore();
    if (Profile.signedIn) {
      if (btn(ix + 24, iy + ih - 108, iw - 48, 40, "LOG OUT", { color: "#ff2e88" }))
        { Profile.logout(); Snd.ui(); }
    } else {
      if (btn(ix + 24, iy + ih - 108, (iw - 58) / 2, 40, "SIGN UP", { color: "#b6ff3b" })) this.openAccount("signup");
      if (btn(ix + 34 + (iw - 58) / 2, iy + ih - 108, (iw - 58) / 2, 40, "LOG IN", { color: "#00e5ff" }))
        this.openAccount("login");
    }
    if (btn(ix + 24, iy + ih - 58, iw - 48, 40, "COSMETICS SHOP", { color: "#ffc83d" }))
      { this.shopBack = "profile"; this.openShop(); Snd.ui(); }

    /* ---- lifetime stats ---- */
    const sx = 440, sy = 112, sw = 400, sh = 470;
    panel(g, sx, sy, sw, sh, { cut: 16, fill: "#100d22", accent: "#b6ff3b", accentA: 0.5 });
    const pct = st.matches ? Math.round(st.wins / st.matches * 100) + "%" : "—";
    const rows = [
      ["MATCHES", st.matches], ["WINS", st.wins], ["WIN RATE", pct],
      ["KOs", st.kos], ["FALLS", st.falls], ["DAMAGE DEALT", Math.round(st.damage).toLocaleString() + "%"],
      ["SUPERS FIRED", st.supers], ["BEST HIT", st.bestHit + "%"], ["ONLINE MATCHES", st.online],
      ["TOURNAMENTS", st.tourneys], ["TOURNAMENT WINS", st.tourneyWins], ["COINS EARNED", st.earned.toLocaleString()],
    ];
    g.save();
    g.textAlign = "left"; g.font = `700 12px ${FONT_MONO}`; g.fillStyle = "#b6ff3b";
    g.fillText("LIFETIME STATS", sx + 22, sy + 30);
    rows.forEach(([k, v], i) => {
      const y = sy + 62 + i * 33;
      if (i % 2 === 0) { g.fillStyle = "rgba(255,255,255,.03)"; g.fillRect(sx + 14, y - 20, sw - 28, 30); }
      g.font = `700 12px ${FONT_MONO}`; g.fillStyle = "#aeabd4"; g.textAlign = "left";
      g.fillText(k, sx + 24, y);
      g.font = `900 20px ${FONT_DISPLAY}`; g.fillStyle = "#f2f0ff"; g.textAlign = "right";
      g.fillText(String(v), sx + sw - 24, y + 2);
    });
    g.restore();

    /* ---- fighters + leaderboard ---- */
    const fx = 860, fy = 112, fw = 370;
    panel(g, fx, fy, fw, 226, { cut: 14, fill: "#100d22", accent: "#ff2e88", accentA: 0.5 });
    g.save();
    g.textAlign = "left"; g.font = `700 12px ${FONT_MONO}`; g.fillStyle = "#ff2e88";
    g.fillText("YOUR FIGHTERS", fx + 20, fy + 28);
    g.font = `700 10px ${FONT_MONO}`; g.fillStyle = "#8e8bb2"; g.textAlign = "right";
    g.fillText("PLAYED  WINS  KOs", fx + fw - 20, fy + 28);
    const mine = Object.entries(d.chars).sort((a, b) => b[1].p - a[1].p).slice(0, 5);
    if (!mine.length) {
      g.textAlign = "left"; g.font = `500 12px ${FONT_MONO}`; g.fillStyle = "#8e8bb2";
      g.fillText("Play a match to start your record.", fx + 20, fy + 64);
    }
    mine.forEach(([id, r], i) => {
      const ch = CHAR_BY_ID[id], y = fy + 58 + i * 34;
      g.textAlign = "left"; g.font = `900 16px ${FONT_DISPLAY}`; g.fillStyle = ch.color;
      g.fillText((Profile.isFav(id) ? "★ " : "") + ch.name, fx + 20, y);
      g.font = `700 13px ${FONT_MONO}`; g.fillStyle = "#f2f0ff"; g.textAlign = "right";
      g.fillText(`${r.p}`, fx + fw - 128, y);
      g.fillText(`${r.w}`, fx + fw - 74, y);
      g.fillText(`${r.k}`, fx + fw - 22, y);
    });
    g.restore();

    const ly = fy + 240;
    panel(g, fx, ly, fw, 230, { cut: 14, fill: "#100d22", accent: "#ffc83d", accentA: 0.5 });
    g.save();
    g.textAlign = "left"; g.font = `700 12px ${FONT_MONO}`; g.fillStyle = "#ffc83d";
    g.fillText("LEADERBOARD · MOST WINS", fx + 20, ly + 28);
    const board = Profile.board;
    if (!board) { g.font = `500 12px ${FONT_MONO}`; g.fillStyle = "#8e8bb2"; g.fillText("Loading…", fx + 20, ly + 60); }
    else if (!board.length) {
      g.font = `500 12px ${FONT_MONO}`; g.fillStyle = "#8e8bb2";
      g.fillText("No accounts yet — be the first.", fx + 20, ly + 60);
    }
    (board || []).slice(0, 8).forEach((row, i) => {
      const y = ly + 56 + i * 22;
      const me = Profile.name && row.username.toLowerCase() === Profile.name.toLowerCase();
      g.textAlign = "left"; g.font = `700 12px ${FONT_MONO}`;
      g.fillStyle = me ? "#b6ff3b" : i === 0 ? "#ffc83d" : "#d6d3ec";
      g.fillText(`${i + 1}. ${row.username}`, fx + 20, y);
      g.textAlign = "right"; g.fillStyle = "#aeabd4";
      g.fillText(`${row.wins} W`, fx + fw - 20, y);
    });
    g.restore();

    if (btn(50, H - 72, 180, 48, "◀ BACK", { color: "#ff2e88" })) { this.screen = "title"; Snd.ui(); }
  },

  /* ============================================================= ACCOUNT */
  openAccount(mode) {
    const keep = this.acct && this.acct.user.value;
    this.acct = {
      mode,
      user: { value: keep || "", max: 14, filter: /[^A-Za-z0-9_]/g },
      pass: { value: "", max: 72, secret: true },
      focus: "user",
    };
    Profile.status = "";
    this.screen = "account";
    Snd.ui();
  },
  closeAccount(to) {
    TextIn.blur();
    this.screen = to || "profile";
  },
  submitAccount() {
    const a = this.acct;
    if (Profile.busy) return;
    const u = a.user.value, p = a.pass.value;
    if (!/^[A-Za-z0-9_]{3,14}$/.test(u)) { Profile.status = ACCOUNT_ERRORS.bad_username; return; }
    if (p.length < 4) { Profile.status = ACCOUNT_ERRORS.bad_password; return; }
    (a.mode === "signup" ? Profile.signup(u, p) : Profile.login(u, p)).then(ok => {
      if (ok && this.screen === "account") { this.closeAccount("profile"); Profile.fetchBoard(); }
    });
    Snd.uiBig();
  },
  updateAccount() {
    const a = this.acct;
    if (Keys.pressed["Escape"]) { this.closeAccount("profile"); Snd.ui(); return; }
    if (Keys.pressed["Tab"]) { a.focus = a.focus === "user" ? "pass" : "user"; }
    if (Keys.pressed["Enter"] || Keys.pressed["NumpadEnter"]) {
      if (a.focus === "user" && !a.pass.value) a.focus = "pass";
      else this.submitAccount();
    }
  },

  drawAccount() {
    Stage.def = STAGES[3];
    drawBackground();
    g.save(); g.fillStyle = "rgba(6,5,14,.86)"; g.fillRect(0, 0, W, H); g.restore();
    const a = this.acct, signup = a.mode === "signup";
    screenTitleBar("COOL MATT BRAWL ACCOUNT", signup ? "SIGN UP" : "LOG IN", signup ? "#b6ff3b" : "#00e5ff");
    const col = signup ? "#b6ff3b" : "#00e5ff";
    TextIn.focus(a[a.focus]);

    const cx = W / 2, fw = 440, fx = cx - fw / 2;
    if (btn(fx, 118, fw / 2 - 6, 36, "SIGN UP", { active: signup, color: "#b6ff3b" }))
      { a.mode = "signup"; Profile.status = ""; Snd.ui(); }
    if (btn(fx + fw / 2 + 6, 118, fw / 2 - 6, 36, "LOG IN", { active: !signup, color: "#00e5ff" }))
      { a.mode = "login"; Profile.status = ""; Snd.ui(); }

    const field = (key, label, y) => {
      const f = a[key], on = a.focus === key;
      g.save();
      g.textAlign = "left"; g.font = `700 11px ${FONT_MONO}`; g.fillStyle = on ? col : "#aeabd4";
      g.fillText(label, fx, y - 10);
      g.restore();
      panel(g, fx, y, fw, 52, { cut: 10, fill: on ? "#17132e" : "#100d20", accent: on ? col : UI.line,
                                accentA: on ? 1 : 0.6, glow: on ? 12 : 0 });
      const shown = f.secret ? "•".repeat(f.value.length) : f.value;
      g.save();
      g.textAlign = "left"; g.textBaseline = "middle";
      g.font = `700 22px ${FONT_MONO}`; g.fillStyle = "#ffffff";
      g.fillText(shown, fx + 18, y + 27);
      if (on && Math.floor(performance.now() / 500) % 2 === 0) {
        const tw = g.measureText(shown).width;
        g.fillStyle = col; g.fillRect(fx + 20 + tw, y + 14, 3, 26);
      }
      g.restore();
      if (Mouse.click && Mouse.x > fx && Mouse.x < fx + fw && Mouse.y > y && Mouse.y < y + 52)
        { a.focus = key; Mouse.click = false; }
    };
    field("user", "USERNAME", 204);
    field("pass", "PASSWORD", 300);

    g.save();
    g.textAlign = "center"; g.font = `500 12px ${FONT_MONO}`; g.fillStyle = "#aeabd4";
    g.fillText("3-14 letters, numbers or _   ·   password at least 4 characters", cx, 378);
    g.fillText(signup ? "Your guest coins, stats and cosmetics move into the new account."
                      : "Logging in loads that account. Your guest progress stays on this browser.", cx, 398);
    if (Profile.busy) { g.fillStyle = "#ffc83d"; g.fillText("Talking to the server…", cx, 430); }
    else if (Profile.status) { g.font = `700 13px ${FONT_MONO}`; g.fillStyle = "#ff2e88"; g.fillText(Profile.status, cx, 430); }
    g.restore();

    if (btn(fx, 452, fw, 52, signup ? "CREATE ACCOUNT" : "LOG IN",
            { color: col, disabled: Profile.busy, font: `700 18px ${FONT_MONO}` }))
      this.submitAccount();
    if (btn(fx, 516, fw, 40, "CANCEL", { color: "#ff2e88" })) { this.closeAccount("profile"); Snd.ui(); }

    g.save();
    g.textAlign = "center"; g.font = `500 11px ${FONT_MONO}`; g.fillStyle = "#7f7ca3";
    g.fillText("Don't reuse a password from another site. Passwords are stored hashed, never as text.", cx, H - 40);
    g.restore();
  },
  /* ================================================================ GOALS
     Today's three challenges across the top, every achievement underneath. */
  openGoals(back) {
    this.goalsBack = back || "title";
    Daily.today(Profile.d);
    this.screen = "goals";
    Snd.ui();
  },
  updateGoals() {
    if (Keys.pressed["Escape"]) { this.screen = this.goalsBack || "title"; Snd.ui(); }
  },
  drawGoals() {
    Stage.def = STAGES[5];
    drawBackground();
    g.save(); g.fillStyle = "rgba(6,5,14,.84)"; g.fillRect(0, 0, W, H); g.restore();
    screenTitleBar("COOL MATT GAMES", "CHALLENGES", "#b6ff3b");
    const d = Profile.d, t = performance.now() / 16;

    /* ---- today's challenges ---- */
    const list = Daily.today(d);
    const left = Daily.msLeft(), hh = Math.floor(left / 3600000), mm = Math.floor(left / 60000) % 60;
    g.save();
    g.textAlign = "left"; g.font = `700 12px ${FONT_MONO}`; g.fillStyle = "#b6ff3b";
    g.fillText("TODAY'S CHALLENGES", 60, 126);
    g.textAlign = "right"; g.fillStyle = "#aeabd4";
    g.fillText(`NEW SET IN ${hh}h ${String(mm).padStart(2, "0")}m`, W - 60, 126);
    g.restore();
    const cw = (W - 120 - 40) / 3;
    list.forEach((c, i) => {
      const x = 60 + i * (cw + 20), y = 138, h = 104;
      const col = c.done ? "#b6ff3b" : "#00e5ff";
      panel(g, x, y, cw, h, { cut: 12, fill: c.done ? "#14221a" : "#110e24", accent: col,
                               accentA: c.done ? 0.95 : 0.55, glow: c.done ? 12 : 0 });
      g.save();
      g.textAlign = "left"; g.textBaseline = "alphabetic";
      g.font = `900 19px ${FONT_DISPLAY}`; g.fillStyle = "#ffffff";
      const lines = wrapLines(g, c.text, cw - 130);
      lines.slice(0, 2).forEach((ln, k) => g.fillText(ln, x + 18, y + 34 + k * 22));
      g.restore();
      coinChip(g, c.def.coins, x + cw - 14, y + 14, "right", "+");
      // progress
      const k = clamp(c.prog / c.n, 0, 1);
      slot(g, x + 18, y + h - 30, cw - 36, 14, 4);
      bar(g, x + 19, y + h - 29, cw - 38, 12, k, col, { glow: 8, r: 3 });
      g.save();
      g.textAlign = "right"; g.font = `700 11px ${FONT_MONO}`;
      g.fillStyle = c.done ? "#b6ff3b" : "#d6d3ee";
      g.fillText(c.done ? "✓ COMPLETE" : `${c.prog} / ${c.n}`, x + cw - 18, y + h - 38);
      g.restore();
    });

    /* ---- achievements ---- */
    const got = new Set(d.ach);
    g.save();
    g.textAlign = "left"; g.font = `700 12px ${FONT_MONO}`; g.fillStyle = "#ffc83d";
    g.fillText(`ACHIEVEMENTS  ·  ${got.size} / ${ACHIEVEMENTS.length}`, 60, 276);
    g.textAlign = "right"; g.fillStyle = "#aeabd4";
    const worth = ACHIEVEMENTS.reduce((n, a) => n + (got.has(a.id) ? 0 : a.coins), 0);
    g.fillText(worth ? `${worth.toLocaleString()} COINS STILL TO EARN` : "EVERY ACHIEVEMENT UNLOCKED", W - 60, 276);
    g.restore();
    const cols = 7, gap = 10, tw = (W - 120 - gap * (cols - 1)) / cols, th = 70;
    let hover = null;
    ACHIEVEMENTS.forEach((a, i) => {
      const x = 60 + (i % cols) * (tw + gap), y = 288 + Math.floor(i / cols) * (th + gap);
      const on = got.has(a.id);
      const hov = Mouse.x > x && Mouse.x < x + tw && Mouse.y > y && Mouse.y < y + th;
      if (hov) hover = a;
      panel(g, x, y, tw, th, { cut: 9, fill: on ? "#221a0c" : "#0f0c1d", accent: on ? "#ffc83d" : "#3a3560",
                                accentA: on ? 0.9 : hov ? 0.9 : 0.6, glow: on ? 8 : 0 });
      g.save();
      g.translate(x + 22, y + 26);
      if (on) {
        // a trophy
        g.fillStyle = "#ffc83d"; g.strokeStyle = UI.ink; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(-10, -12); g.lineTo(10, -12); g.lineTo(8, 0); g.quadraticCurveTo(0, 8, -8, 0); g.closePath();
        g.stroke(); g.fill();
        g.fillRect(-2, 4, 4, 6); g.fillRect(-7, 10, 14, 4);
        g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(-6, -9, 3, 7);
      } else {
        // a padlock
        g.strokeStyle = "#6e6b8c"; g.lineWidth = 3;
        g.beginPath(); g.arc(0, -4, 6, Math.PI, 0); g.stroke();
        g.fillStyle = "#6e6b8c"; g.fillRect(-9, -4, 18, 14);
      }
      g.restore();
      g.save();
      g.textAlign = "left";
      g.font = `700 12px ${FONT_MONO}`; g.fillStyle = on ? "#ffffff" : "#aeabd4";
      g.fillText(a.name, x + 42, y + 24);
      g.font = `500 10px ${FONT_MONO}`; g.fillStyle = on ? "#ffe9a8" : "#8e8bb2";
      wrapLines(g, a.desc, tw - 52).slice(0, 2).forEach((ln, k) => g.fillText(ln, x + 42, y + 40 + k * 12));
      g.restore();
      g.save();
      g.textAlign = "right"; g.font = `700 10px ${FONT_MONO}`;
      g.fillStyle = on ? "#b6ff3b" : "#ffc83d";
      g.fillText(on ? "✓" : `+${a.coins}`, x + tw - 10, y + th - 10);
      g.restore();
    });

    g.save();
    g.textAlign = "center"; g.font = `500 12px ${FONT_MONO}`; g.fillStyle = "#d6d3ee";
    g.fillText(hover ? `${hover.name} — ${hover.desc}  ·  ${got.has(hover.id) ? "UNLOCKED" : "+" + hover.coins + " COINS"}`
                     : "Challenges and achievements pay coins the moment you earn them. Only P1's matches count.",
               W / 2, 630);
    g.restore();

    if (btn(50, H - 72, 180, 48, "◀ BACK", { color: "#ff2e88" })) { this.screen = this.goalsBack || "title"; Snd.ui(); }
    if (btn(W - 230, H - 72, 180, 48, "PLAY ▶", { color: "#b6ff3b" })) { this.screen = "select"; Snd.uiBig(); }
  },
});
