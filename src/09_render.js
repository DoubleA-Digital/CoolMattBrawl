/* ==========================================================================
   10. RENDER — stage, fighters and HUD

   Everything that moves is drawn at an interpolated position between the two
   most recent fixed-timestep frames, so motion stays smooth on 120Hz and
   144Hz displays instead of stepping at 60.
   ========================================================================== */

const cv = document.getElementById("cv");
const g = cv.getContext("2d", { alpha: false });
let RA = 1;   // render alpha: 0..1 between the previous and current sim step

function fitCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const scale = Math.min(window.innerWidth / W, (window.innerHeight - 18) / H);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.width = Math.floor(W * scale) + "px";
  cv.style.height = Math.floor(H * scale) + "px";
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", fitCanvas);

let bgT = 0;
function drawBackground() {
  bgT += 1 / 60;
  (Stage.def.drawBg || STAGES[0].drawBg).call(Stage.def, g, bgT);
}

/* ------------------------------------------------------------------ stage */
function drawStage(alpha) {
  const def = Stage.def, pal = def.pal;
  const tilt = lerp(Stage.prevTilt, Stage.tilt, alpha);
  const c = Math.cos(tilt), s = Math.sin(tilt);
  const P = Stage.pivot;
  const toW = (lx, ly) => ({ x: P.x + lx * c - ly * s, y: P.y + lx * s + ly * c });

  const anch = Stage.anchorTimer > 0;
  const snap = Stage.snapFlash > 0;
  const near = Math.abs(clamp(tilt / Stage.cfg.limit, -1, 1));

  // support column
  g.save();
  g.strokeStyle = hexA(pal.soft, 0.4); g.lineWidth = 11;
  g.beginPath(); g.moveTo(P.x, P.y + 10); g.lineTo(P.x, P.y + 340); g.stroke();
  g.strokeStyle = hexA(pal.platEdge, 0.3); g.lineWidth = 3;
  g.beginPath(); g.moveTo(P.x, P.y + 10); g.lineTo(P.x, P.y + 340); g.stroke();
  g.restore();

  for (const p of def.layout) {
    const a = toW(p.x1, p.y1), b = toW(p.x2, p.y2);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const th = p.thick, main = !!p.main;
    const edge = main
      ? (snap ? "#ffffff" : near > 0.8 ? "#ff2e88" : anch ? "#b6ff3b" : pal.platEdge)
      : pal.soft;

    g.save();
    g.translate(a.x, a.y);
    g.rotate(Math.atan2(dy, dx));

    const depth = main ? 48 : 15;
    const lg = g.createLinearGradient(0, -th / 2, 0, th / 2 + depth);
    lg.addColorStop(0, shade(pal.plat, 0.16));
    lg.addColorStop(0.35, pal.plat);
    lg.addColorStop(1, pal.ink);
    g.fillStyle = lg;
    roundRect(g, 0, -th / 2, len, th + depth, 6); g.fill();

    g.shadowColor = edge; g.shadowBlur = snap ? 36 : 20;
    g.strokeStyle = edge; g.lineWidth = main ? 5 : 3;
    g.beginPath(); g.moveTo(0, -th / 2); g.lineTo(len, -th / 2); g.stroke();
    g.shadowBlur = 0;

    if (!p.solid) {
      g.strokeStyle = hexA(pal.soft, 0.4); g.lineWidth = 2;
      g.setLineDash([8, 10]);
      g.beginPath(); g.moveTo(0, th / 2 + 11); g.lineTo(len, th / 2 + 11); g.stroke();
      g.setLineDash([]);
    }

    if (main) {
      g.globalAlpha = 0.16 + near * 0.36;
      g.strokeStyle = near > 0.8 ? "#ff2e88" : pal.platEdge;
      g.lineWidth = 3;
      for (let x = 10; x < len; x += 26) {
        g.beginPath(); g.moveTo(x, th / 2 + 4); g.lineTo(x + 12, th / 2 + 30); g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = edge; g.shadowColor = edge; g.shadowBlur = 16;
      g.beginPath(); g.arc(3, -th / 2, 5, 0, 7); g.fill();
      g.beginPath(); g.arc(len - 3, -th / 2, 5, 0, 7); g.fill();
      g.shadowBlur = 0;
    }
    g.restore();
  }

  // pivot hub
  g.save();
  g.translate(P.x, P.y); g.rotate(tilt);
  g.fillStyle = anch ? "#b6ff3b" : shade(pal.plat, 0.25);
  g.shadowColor = anch ? "#b6ff3b" : pal.platEdge; g.shadowBlur = anch ? 30 : 14;
  g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill();
  g.strokeStyle = pal.ink; g.lineWidth = 4;
  g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.stroke();
  g.restore();

  if (anch) {
    // soft wash, not a box — a hard-edged rect read as a UI artifact
    g.save(); g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.5 + 0.22 * Math.sin(Stage.anchorTimer * 0.3);
    const ag = g.createRadialGradient(P.x, P.y - 40, 20, P.x, P.y - 40, 430);
    ag.addColorStop(0, "rgba(182,255,59,.20)");
    ag.addColorStop(0.55, "rgba(182,255,59,.08)");
    ag.addColorStop(1, "rgba(182,255,59,0)");
    g.fillStyle = ag;
    g.beginPath(); g.arc(P.x, P.y - 40, 430, 0, 7); g.fill();
    g.restore();
  }
}

/* --------------------------------------------------------------- fighter */
function drawFighter(f, alpha) {
  if (f.state === ST.DEAD) return;
  const ch = f.ch;
  const rx = lerp(f.px, f.x, alpha);
  const ry = lerp(f.py, f.y, alpha);

  /* Contact shadow on the deck below. It tracks the fighter's own feet rather
     than a fixed offset, so it stays glued to a tilted surface, and it shrinks
     and fades with height — which is most of what sells a jump. */
  {
    let sy = null;
    if (f.grounded) sy = f.feetY;
    else {
      // nearest surface under him, so the shadow still reads mid-jump
      const feet = ry + ch.size.h / 2;
      for (const s of Stage.segs) {
        const y = Stage.surfaceY(s, rx);
        if (y != null && y >= feet - 4 && (sy === null || y < sy)) sy = y;
      }
    }
    if (sy != null && isFinite(sy)) {
      const drop = clamp((sy - (ry + ch.size.h / 2)) / 160, 0, 1);
      const k = 1 - drop;
      if (k > 0.05) {
        g.save();
        g.globalAlpha = 0.34 * k;
        g.fillStyle = "#000000";
        g.beginPath();
        g.ellipse(rx, sy - 1, ch.size.w * 0.48 * (0.55 + k * 0.45),
                  4.5 * (0.5 + k * 0.5), 0, 0, 7);
        g.fill();
        g.restore();
      }
    }
  }

  // afterimage trail
  if (f.trail.length) {
    g.save(); g.globalCompositeOperation = "lighter";
    for (const t of f.trail) {
      g.globalAlpha = (t.life / 10) * (f.inSuper ? 0.3 : 0.18);
      g.save();
      g.translate(t.x, t.y);
      g.scale(t.facing, 1);
      g.fillStyle = ch.color;
      roundRect(g, -ch.size.w / 2, -ch.size.h / 2, ch.size.w, ch.size.h, 9);
      g.fill();
      g.restore();
    }
    g.restore();
  }

  // --- anim context handed to the character's own draw() ---
  const atk = f.attack;
  const A = {
    time: f.animTime,
    runPhase: f.runPhase,
    running: f.state === ST.RUN && f.grounded,
    air: !f.grounded,
    vx: f.vx, vy: f.vy,
    state: f.state,
    flash: f.hitFlash > 0,
    atkPhase: (atk && atk.data.r) ? clamp(atk.t / Math.max(1, atk.total), 0, 1) : -1,
    atkKind: atk ? atk.kind : null,
  };

  g.save();
  g.translate(rx, ry);

  let lean;
  if (f.grounded && f.groundSeg) lean = f.groundSeg.angle * 0.85;
  else lean = clamp(f.vx * 0.016, -0.3, 0.3);
  if (f.state === ST.HITSTUN) lean = Math.sin(f.hitstun * 0.6) * 0.5;
  if (f.pinned) lean = 0;
  g.rotate(lean);

  const squash = f.state === ST.JUMPSQUAT ? 0.80
               : f.state === ST.LANDLAG ? 0.90
               : f.state === ST.SPOTDODGE ? 0.74 : 1;
  const stretch = (!f.grounded && f.vy < -4) ? 1.09 : 1;
  const breathe = (f.state === ST.IDLE && f.grounded) ? 1 + Math.sin(f.animTime * 0.055) * 0.015 : 1;
  g.scale(f.facing, squash * stretch * breathe);

  if (f.intangible()) g.globalAlpha = 0.42;
  ch.draw(g, A);
  g.restore();

  /* ---- world-space overlays ---- */
  if (f.shielding()) {
    const k = f.shield / CFG.shieldMax;
    g.save(); g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.22 + k * 0.3;
    const rr = ch.hurt * 1.5 * (0.6 + k * 0.5);
    const rgd = g.createRadialGradient(rx, ry, rr * 0.2, rx, ry, rr);
    rgd.addColorStop(0, "rgba(255,255,255,.5)"); rgd.addColorStop(1, f.tint);
    g.fillStyle = rgd;
    g.beginPath(); g.arc(rx, ry, rr, 0, 7); g.fill();
    g.globalAlpha = 0.5; g.strokeStyle = "#ffffff"; g.lineWidth = 2;
    g.beginPath(); g.arc(rx, ry, rr, 0, 7); g.stroke();
    g.restore();
  }

  if (f.state === ST.SHIELDBREAK) {
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {
      const a = f.animTime / 14 + i * Math.PI / 2;
      g.fillStyle = "#ffe36b";
      g.beginPath(); g.arc(rx + Math.cos(a) * 26, ry - ch.size.h * 0.6 + Math.sin(a) * 8, 4, 0, 7); g.fill();
    }
    g.restore();
  }

  if (f.state === ST.RESPAWN) {
    g.save();
    g.globalAlpha = 0.6 + 0.3 * Math.sin(f.animTime * 0.1);
    g.strokeStyle = f.tint; g.lineWidth = 4;
    g.shadowColor = f.tint; g.shadowBlur = 20;
    g.beginPath(); g.ellipse(rx, ry + ch.size.h * 0.55, 42, 9, 0, 0, 7); g.stroke();
    g.restore();
  }

  if (f.crankDir !== 0) {
    g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.5;
    g.strokeStyle = ch.color; g.lineWidth = 4;
    g.shadowColor = ch.color; g.shadowBlur = 18;
    g.beginPath(); g.moveTo(rx, ry);
    g.lineTo(Stage.pivot.x + f.crankDir * 300, Stage.pivot.y - 20); g.stroke();
    g.restore();
  }

  if (f.anchorGlow > 0) {
    g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.3;
    g.strokeStyle = ch.color; g.lineWidth = 3;
    g.beginPath(); g.arc(rx, ry, ch.hurt * 1.9 + Math.sin(f.animTime * 0.1) * 4, 0, 7); g.stroke();
    g.restore();
  }

  // super aura
  if (f.inSuper) {
    g.save(); g.globalCompositeOperation = "lighter";
    const p = f.attack.t * 0.2;
    for (let i = 0; i < 3; i++) {
      g.globalAlpha = 0.26 - i * 0.07;
      g.strokeStyle = ch.accent; g.lineWidth = 2.5;
      g.beginPath();
      g.ellipse(rx, ry, ch.hurt * (1.5 + i * 0.5), ch.hurt * (0.7 + i * 0.3), p + i, 0, 7);
      g.stroke();
    }
    g.restore();
  }

  if (f.attack && f.hitboxActive() && Settings.get("showHitboxGlow")) {
    const hb = f.hitboxWorld();
    g.save(); g.globalCompositeOperation = "lighter";
    const rgd = g.createRadialGradient(hb.x, hb.y, 1, hb.x, hb.y, hb.r);
    rgd.addColorStop(0, "rgba(255,255,255,.5)");
    rgd.addColorStop(0.5, hexA(ch.color, 0.32));
    rgd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rgd;
    g.beginPath(); g.arc(hb.x, hb.y, hb.r, 0, 7); g.fill();
    g.restore();
  }

  // player tag
  g.save();
  g.font = `700 12px ${FONT_MONO}`;
  g.textAlign = "center";
  g.globalAlpha = 0.85;
  g.fillStyle = f.tint;
  g.fillText(`P${f.slot + 1}${f.isCPU ? " CPU" : ""}`, rx, ry - ch.size.h * 0.82);
  g.restore();
}

function drawOffscreenMarkers(fighters, cam) {
  for (const f of fighters) {
    if (!f.alive || f.state === ST.DEAD) continue;
    const sx = (f.x - cam.x) * cam.z + W / 2, sy = (f.y - cam.y) * cam.z + H / 2;
    if (sx > 26 && sx < W - 26 && sy > 26 && sy < H - 26) continue;
    const cx = clamp(sx, 38, W - 38), cy = clamp(sy, 54, H - 40);
    g.save();
    g.translate(cx, cy);
    g.rotate(Math.atan2(sy - H / 2, sx - W / 2));
    g.fillStyle = f.tint; g.shadowColor = f.tint; g.shadowBlur = 16;
    g.beginPath(); g.moveTo(15, 0); g.lineTo(-10, -11); g.lineTo(-10, 11); g.closePath(); g.fill();
    g.restore();
    g.save();
    g.font = `700 16px ${FONT_MONO}`; g.textAlign = "center";
    g.fillStyle = f.tint;
    outlineText(g, `${Math.floor(f.percent)}%`, cx, cy + 30, f.tint, 4);
    g.restore();
  }
}

/* -------------------------------------------------------------------- HUD */
function drawBalanceBar() {
  const bw = 520, bh = 20, bx = (W - bw) / 2, by = 24;
  const b = Stage.balance();
  const anch = Stage.anchorTimer > 0;
  const danger = Math.abs(b) > 0.8;
  const col = anch ? "#b6ff3b" : danger ? "#ff2e88" : Stage.pal.platEdge;

  g.save();
  g.fillStyle = "rgba(8,6,18,.80)";
  roundRect(g, bx - 8, by - 8, bw + 16, bh + 16, 12); g.fill();
  g.strokeStyle = anch ? "#b6ff3b" : danger ? "#ff2e88" : hexA(Stage.pal.platEdge, 0.6);
  g.lineWidth = 2; g.shadowColor = col; g.shadowBlur = danger ? 24 : 10;
  roundRect(g, bx - 8, by - 8, bw + 16, bh + 16, 12); g.stroke();
  g.shadowBlur = 0;

  g.fillStyle = "rgba(255,255,255,.06)";
  roundRect(g, bx, by, bw, bh, 8); g.fill();
  g.fillStyle = "rgba(255,46,136,.22)";
  roundRect(g, bx, by, bw * 0.1, bh, 8); g.fill();
  roundRect(g, bx + bw * 0.9, by, bw * 0.1, bh, 8); g.fill();

  const cxp = bx + bw / 2, wFill = (bw / 2) * Math.abs(b);
  g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 16;
  if (b >= 0) roundRect(g, cxp, by + 2, wFill, bh - 4, 6);
  else roundRect(g, cxp - wFill, by + 2, wFill, bh - 4, 6);
  g.fill(); g.shadowBlur = 0;

  g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cxp, by - 4); g.lineTo(cxp, by + bh + 4); g.stroke();

  g.font = `700 11px ${FONT_MONO}`; g.textAlign = "center";
  g.fillStyle = anch ? "#b6ff3b" : danger ? "#ff2e88" : "#8f8cb5";
  g.fillText(anch ? `KEEL ANCHOR ${Math.ceil(Stage.anchorTimer / 60)}s`
                  : danger ? "SNAP-BACK IMMINENT" : "BALANCE", cxp, by + bh + 17);
  g.textAlign = "left"; g.fillStyle = "#6b6a85"; g.fillText("◀", bx - 2, by + bh + 17);
  g.textAlign = "right"; g.fillText("▶", bx + bw + 2, by + bh + 17);
  g.restore();
}

function drawClock(framesLeft) {
  const secs = Math.max(0, Math.ceil(framesLeft / 60));
  const mm = Math.floor(secs / 60), ss = secs % 60;
  const low = secs <= 10;
  g.save();
  g.textAlign = "center";
  g.font = `900 32px ${FONT_DISPLAY}`;
  g.globalAlpha = low && Math.floor(framesLeft / 8) % 2 === 0 ? 0.55 : 1;
  if (low) { g.shadowColor = "#ff2e88"; g.shadowBlur = 20; }
  outlineText(g, `${mm}:${String(ss).padStart(2, "0")}`, W / 2, 104, low ? "#ff2e88" : "#f2f0ff", 6);
  g.restore();

  // stage name chip
  g.save();
  g.textAlign = "right";
  g.font = `700 10px ${FONT_MONO}`;
  g.fillStyle = "rgba(255,255,255,.3)";
  g.fillText(Stage.def.name, W - 16, 30);
  g.restore();
}

function drawPlayerHUD(fighters) {
  const n = fighters.length;
  const cardW = 198, gap = 16;
  let x = (W - (n * cardW + (n - 1) * gap)) / 2;
  const y = H - 104;

  for (const f of fighters) {
    const dead = f.stocks <= 0;
    g.save();
    g.globalAlpha = dead ? 0.32 : 1;

    g.fillStyle = "rgba(8,6,18,.84)";
    roundRect(g, x, y, cardW, 88, 14); g.fill();
    g.strokeStyle = hexA(f.ch.color, f.meterFull ? 0.95 : 0.6);
    g.lineWidth = f.meterFull ? 3 : 2;
    g.shadowColor = f.ch.color; g.shadowBlur = f.meterFull ? 22 : 12;
    roundRect(g, x, y, cardW, 88, 14); g.stroke();
    g.shadowBlur = 0;

    // tiny portrait
    g.save();
    g.beginPath(); roundRect(g, x + 9, y + 9, 36, 36, 9); g.clip();
    g.fillStyle = shade(f.ch.color2, -0.25); g.fillRect(x + 9, y + 9, 36, 36);
    g.translate(x + 27, y + 46); g.scale(0.62, 0.62);
    f.ch.draw(g, { time: f.animTime, runPhase: 0, running: false, air: false,
                   vx: 0, vy: 0, state: ST.IDLE, flash: false, atkPhase: -1 });
    g.restore();

    g.font = `700 15px ${FONT_MONO}`; g.textAlign = "left";
    g.fillStyle = "#f2f0ff"; g.fillText(f.ch.name, x + 52, y + 23);
    g.font = `700 10px ${FONT_MONO}`; g.fillStyle = f.tint;
    g.fillText(`P${f.slot + 1}${f.isCPU ? " · CPU" : ""}`, x + 52, y + 37);

    const p = Math.floor(f.percent);
    const heat = clamp(p / 160, 0, 1);
    const pc = mixColor("#ffffff", "#ff2e88", heat);
    g.font = `900 ${32 + heat * 10}px ${FONT_DISPLAY}`;
    g.textAlign = "right";
    g.shadowColor = pc; g.shadowBlur = 10 + heat * 18;
    g.fillStyle = pc; g.fillText(`${p}%`, x + cardW - 12, y + 74);
    g.shadowBlur = 0;

    // stocks
    for (let i = 0; i < CFG.stocks; i++) {
      const on = i < f.stocks;
      g.beginPath(); g.arc(x + 18 + i * 17, y + 58, 5.5, 0, 7);
      g.fillStyle = on ? f.ch.color : "rgba(255,255,255,.14)";
      if (on) { g.shadowColor = f.ch.color; g.shadowBlur = 10; }
      g.fill(); g.shadowBlur = 0;
    }

    // special-ready diamond
    const ready = f.specialCD <= 0;
    g.save();
    g.translate(x + 78, y + 58); g.rotate(Math.PI / 4);
    g.fillStyle = ready ? f.ch.accent : "rgba(255,255,255,.12)";
    if (ready) { g.shadowColor = f.ch.accent; g.shadowBlur = 10; }
    g.fillRect(-4.5, -4.5, 9, 9);
    g.restore();

    // shield rail + super meter
    const sw = cardW - 24;
    g.fillStyle = "rgba(255,255,255,.1)";
    roundRect(g, x + 12, y + 68, sw, 3, 2); g.fill();
    g.fillStyle = f.shield < 30 ? "#ff2e88" : "#7fd9ff";
    roundRect(g, x + 12, y + 68, sw * (f.shield / CFG.shieldMax), 3, 2); g.fill();

    const mk = f.meter / CFG.meter.max;
    g.fillStyle = "rgba(255,255,255,.08)";
    roundRect(g, x + 12, y + 76, sw, 7, 3.5); g.fill();
    if (f.meterFull) {
      const pulse = 0.65 + Math.sin(f.animTime * 0.18) * 0.35;
      g.globalAlpha = pulse;
      g.fillStyle = f.ch.accent; g.shadowColor = f.ch.accent; g.shadowBlur = 16;
    } else {
      g.fillStyle = f.ch.color;
    }
    roundRect(g, x + 12, y + 76, sw * mk, 7, 3.5); g.fill();
    g.shadowBlur = 0; g.globalAlpha = dead ? 0.32 : 1;
    if (f.meterFull) {
      g.font = `700 8px ${FONT_MONO}`; g.textAlign = "center";
      g.fillStyle = "#07060f";
      g.fillText("SUPER READY", x + 12 + sw / 2, y + 82);
    }

    g.restore();
    x += cardW + gap;
  }
}

function drawBanner() {
  if (FX.bannerTimer <= 0 || !FX.bannerText) return;
  const t = FX.bannerTimer / 72;
  g.save();
  g.translate(W / 2, H * 0.29);
  const pop = 1 + (1 - t) * 0.12;
  g.scale(pop, pop);
  g.globalAlpha = Math.min(1, t * 2.4);
  g.textAlign = "center";
  g.font = `900 66px ${FONT_DISPLAY}`;
  g.shadowColor = FX.bannerColor; g.shadowBlur = 30;
  outlineText(g, FX.bannerText, 0, 0, FX.bannerColor, 9);
  g.restore();
}
