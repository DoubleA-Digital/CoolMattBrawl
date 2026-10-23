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

/* The underside of a platform, drawn differently per stage. This is where a
   map stops being "the same deck in another colour": the Foundry's beam is
   cast iron with molten seams, the Drift's is weathered stone, the Vault's is
   bolted grating. Called already clipped to the platform body and rotated
   into its local space, so x runs along the deck and y down into it. */
function drawDeckDetail(kind, len, th, depth, pal, main, flare, t) {
  const bot = th / 2 + depth;

  if (kind === "cast") {
    // ribs, then molten seams that flare when the deck is struck
    g.strokeStyle = hexA("#000000", 0.5); g.lineWidth = 7;
    for (let x = 18; x < len; x += 46) {
      g.beginPath(); g.moveTo(x, th / 2); g.lineTo(x - 7, bot); g.stroke();
    }
    g.save();
    g.globalCompositeOperation = "lighter";
    const heat = 0.3 + flare * 0.5 + Math.sin(t * 1.4) * 0.08;
    g.strokeStyle = hexA("#ff7a1f", heat); g.lineWidth = 2.5;
    g.beginPath();
    for (let x = 0; x <= len; x += 16)
      g.lineTo(x, th / 2 + 10 + Math.sin(x * 0.07 + t) * 5);
    g.stroke();
    g.strokeStyle = hexA("#ffd27a", heat * 0.7); g.lineWidth = 1;
    g.stroke();
    g.restore();
    // drips
    g.fillStyle = hexA("#ff8a1f", 0.5);
    for (let i = 0; i < 5; i++) {
      const x = ((i * 137) % len);
      const d = 6 + (Math.sin(t * 1.1 + i * 2) * 0.5 + 0.5) * 16;
      g.beginPath(); g.ellipse(x, bot - 6, 2.4, d * 0.5, 0, 0, 7); g.fill();
    }

  } else if (kind === "cloud") {
    // weathered stone: soft strata and a mossy lip, no neon at all
    for (let i = 0; i < 3; i++) {
      g.fillStyle = hexA("#8e79b4", 0.18 - i * 0.04);
      g.fillRect(0, th / 2 + 4 + i * 11, len, 5);
    }
    g.fillStyle = hexA("#c9a7e8", 0.3);
    for (let i = 0; i < 14; i++) {
      const x = (i * 97) % len;
      g.beginPath(); g.ellipse(x, th / 2 + 2, 10 + (i % 4) * 5, 3, 0, 0, 7); g.fill();
    }
    // the stone tapers, hinting it is floating
    g.fillStyle = hexA(pal.ink, 0.5);
    poly(g, [0, bot - 22, len, bot - 22, len * 0.78, bot, len * 0.22, bot]); g.fill();

  } else if (kind === "grate") {
    // bolted plate: hazard stripes along the lip, a grille, rivet rows
    hatch(g, 0, th / 2, len, 9, "#39ff9e", 12, 0.3);
    g.strokeStyle = hexA("#000000", 0.55); g.lineWidth = 2;
    for (let x = 6; x < len; x += 11) {
      g.beginPath(); g.moveTo(x, th / 2 + 11); g.lineTo(x, bot); g.stroke();
    }
    g.strokeStyle = hexA(pal.platEdge, 0.2); g.lineWidth = 1;
    for (let y = th / 2 + 14; y < bot; y += 9) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(len, y); g.stroke();
    }
    for (let x = 14; x < len; x += 52) screw(g, x, th / 2 + 18, 2.4, "#1e7a56");

  } else {
    // "neon": a lit circuit substrate under a dark deck
    g.strokeStyle = hexA(pal.platEdge, 0.16 + flare * 0.3); g.lineWidth = 3;
    for (let x = 10; x < len; x += 26) {
      g.beginPath(); g.moveTo(x, th / 2 + 4); g.lineTo(x + 12, th / 2 + 30); g.stroke();
    }
    g.strokeStyle = hexA(pal.platEdge, 0.1); g.lineWidth = 1;
    for (let x = 22; x < len; x += 64) {
      g.beginPath();
      g.moveTo(x, th / 2 + 6); g.lineTo(x, bot - 14); g.lineTo(x + 18, bot - 14);
      g.stroke();
      g.fillStyle = hexA(pal.platEdge, 0.3);
      g.beginPath(); g.arc(x + 18, bot - 14, 2, 0, 7); g.fill();
    }
  }
}

/* The support column under the deck. Same job on every map, four different machines. */
function drawPivotColumn(P, kind, pal, t) {
  g.save();
  g.translate(P.x, P.y);

  if (kind === "cast") {
    // a chain hoist, because the Foundry's beam hangs rather than stands
    g.strokeStyle = "rgba(120,84,56,.75)"; g.lineWidth = 9;
    g.beginPath(); g.moveTo(0, 14); g.lineTo(0, 330); g.stroke();
    g.strokeStyle = "rgba(60,38,22,.9)"; g.lineWidth = 3;
    for (let y = 26; y < 330; y += 18) {
      g.beginPath(); g.ellipse(0, y, 7, 9, 0, 0, 7); g.stroke();
    }
    g.save(); g.globalCompositeOperation = "lighter";
    g.strokeStyle = hexA("#ff8a1f", 0.3); g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 14); g.lineTo(0, 330); g.stroke();
    g.restore();

  } else if (kind === "cloud") {
    // a slender stone spire that frays into cloud
    const q = g.createLinearGradient(0, 10, 0, 340);
    q.addColorStop(0, hexA("#efe3f3", 0.9));
    q.addColorStop(0.55, hexA("#c9a7e8", 0.45));
    q.addColorStop(1, hexA("#c9a7e8", 0));
    g.fillStyle = q;
    poly(g, [-13, 10, 13, 10, 5, 340, -5, 340]); g.fill();
    g.strokeStyle = hexA("#8e79b4", 0.35); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-4, 20); g.lineTo(-2, 300); g.stroke();

  } else if (kind === "grate") {
    // a hydraulic piston, with a visible rod and collar
    g.fillStyle = "#0a1a14"; g.strokeStyle = pal.ink; g.lineWidth = 4;
    roundRect(g, -16, 12, 32, 330, 5); g.stroke(); g.fill();
    g.fillStyle = hexA("#1e7a56", 0.8);
    roundRect(g, -7, 12, 14, 330, 4); g.fill();
    g.fillStyle = hexA(pal.platEdge, 0.25);
    g.fillRect(-5, 12, 3, 330);
    for (let y = 40; y < 330; y += 54) {
      g.fillStyle = "#0a1a14"; g.strokeStyle = pal.ink; g.lineWidth = 3;
      roundRect(g, -19, y, 38, 12, 3); g.stroke(); g.fill();
      screw(g, -13, y + 6, 2.2, "#1e7a56");
      screw(g, 13, y + 6, 2.2, "#1e7a56");
    }

  } else {
    // "neon": a lit strut with energy running down it
    g.strokeStyle = hexA(pal.ink, 0.9); g.lineWidth = 14;
    g.beginPath(); g.moveTo(0, 12); g.lineTo(0, 340); g.stroke();
    g.strokeStyle = hexA(pal.soft, 0.5); g.lineWidth = 10;
    g.beginPath(); g.moveTo(0, 12); g.lineTo(0, 340); g.stroke();
    g.save(); g.globalCompositeOperation = "lighter";
    g.strokeStyle = hexA(pal.platEdge, 0.4); g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(0, 12); g.lineTo(0, 340); g.stroke();
    // a pulse travelling down the strut
    const py = 12 + ((t * 120) % 328);
    const pg = g.createLinearGradient(0, py - 40, 0, py + 40);
    pg.addColorStop(0, hexA(pal.platEdge, 0));
    pg.addColorStop(0.5, hexA("#ffffff", 0.5));
    pg.addColorStop(1, hexA(pal.platEdge, 0));
    g.strokeStyle = pg; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, py - 40); g.lineTo(0, py + 40); g.stroke();
    g.restore();
    // cross braces
    g.strokeStyle = hexA(pal.soft, 0.3); g.lineWidth = 3;
    for (let y = 60; y < 330; y += 70) {
      g.beginPath(); g.moveTo(-18, y + 18); g.lineTo(0, y); g.lineTo(18, y + 18); g.stroke();
    }
  }

  g.restore();
}

/* ------------------------------------------------------------------ stage */
function drawStage(alpha) {
  const def = Stage.def, pal = def.pal;
  const P = Stage.pivot;
  const toW = (lx, ly) => Stage.toWorld(lx, ly);

  // the deck edge flares white while a Tipping Point goes off
  const snap = Stage.flashT > 0;
  const flare = clamp(Stage.flashT / 20, 0, 1);
  const kind = def.deck || "neon";

  /* ---- the support column, built differently per stage ---- */
  drawPivotColumn(P, kind, pal, bgT);

  def.layout.forEach((p, pi) => {
    /* Live platform state: drifting offset, how hot it is, and how solid it
       currently is. A platform that has crumbled or retracted draws nothing,
       matching the fact that it is also absent from Stage.segs. */
    const st = Stage.pfx[pi] || { dx: 0, present: true, heat: 0, alpha: 1 };
    const hidden = !st.present && st.alpha <= 0.02;
    if (hidden && !p.retract) return;
    if (hidden) {
      /* A retracted shelf still shows its empty rails, so the gap reads as
         "the platform is away" rather than "there was never one here". */
      const ra = toW(p.x1, p.y1), rb = toW(p.x2, p.y2);
      g.save();
      g.translate(ra.x, ra.y);
      g.rotate(Math.atan2(rb.y - ra.y, rb.x - ra.x));
      const rl = Math.hypot(rb.x - ra.x, rb.y - ra.y);
      g.globalAlpha = 0.35; g.strokeStyle = hexA(pal.platEdge, 0.6); g.lineWidth = 2;
      g.setLineDash([5, 6]);
      g.beginPath(); g.moveTo(-18, 0); g.lineTo(rl + 18, 0); g.stroke();
      g.setLineDash([]);
      g.restore();
      return;
    }

    const a = toW(p.x1 + st.dx, p.y1), b = toW(p.x2 + st.dx, p.y2);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const th = p.thick, main = !!p.main;
    let edge = main
      ? (snap ? "#ffffff" : pal.platEdge)
      : pal.soft;
    // a heating shelf shifts toward molten, and flashes while it warns
    if (st.heat >= 1) edge = "#ff5a19";
    else if (st.heat > 0) edge = Math.floor(bgT * 10) % 2 ? "#ffb347" : pal.soft;

    g.save();
    g.globalAlpha = clamp(st.alpha, 0, 1);
    g.translate(a.x, a.y);
    g.rotate(Math.atan2(dy, dx));

    const depth = main ? 48 : 15;
    const top = -th / 2, bot = th / 2 + depth;
    const round = kind === "cloud" ? Math.min(16, th) : 5;

    // cast shadow under the deck, so it floats above the background
    g.save();
    g.globalAlpha = 0.4; g.fillStyle = "#000";
    roundRect(g, 2, top + 5, len, th + depth, round); g.fill();
    g.restore();

    // the body: ink edge, then a top-lit gradient
    const lg = g.createLinearGradient(0, top, 0, bot);
    lg.addColorStop(0, shade(pal.plat, 0.3));
    lg.addColorStop(0.22, shade(pal.plat, 0.06));
    lg.addColorStop(1, pal.ink);
    roundRect(g, 0, top, len, th + depth, round);
    g.strokeStyle = pal.ink; g.lineWidth = 4; g.lineJoin = "round"; g.stroke();
    g.fillStyle = lg; g.fill();

    /* ---- per-stage underside construction ---- */
    g.save();
    roundRect(g, 0, top, len, th + depth, round); g.clip();
    drawDeckDetail(kind, len, th, depth, pal, main, main ? flare : 0, bgT);
    g.restore();

    // the walking surface, lit
    g.shadowColor = edge; g.shadowBlur = snap ? 36 : kind === "cloud" ? 10 : 20;
    g.strokeStyle = edge; g.lineWidth = main ? 5 : 3;
    g.beginPath(); g.moveTo(0, top); g.lineTo(len, top); g.stroke();
    g.shadowBlur = 0;
    // a thin bright bevel just below it reads as a machined lip
    g.strokeStyle = hexA("#ffffff", kind === "cloud" ? 0.5 : 0.28); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(1, top + 3.5); g.lineTo(len - 1, top + 3.5); g.stroke();

    if (!p.solid) {
      g.strokeStyle = hexA(pal.soft, 0.45); g.lineWidth = 2;
      g.setLineDash([8, 10]);
      g.beginPath(); g.moveTo(0, th / 2 + 11); g.lineTo(len, th / 2 + 11); g.stroke();
      g.setLineDash([]);
    }

    if (main) {
      // ledge caps — the thing you are actually aiming for when recovering
      g.fillStyle = edge; g.shadowColor = edge; g.shadowBlur = 16;
      g.beginPath(); g.arc(3, top, 5, 0, 7); g.fill();
      g.beginPath(); g.arc(len - 3, top, 5, 0, 7); g.fill();
      g.shadowBlur = 0;
    }

    /* ---- the platform's own state, drawn on top of its body ---- */
    if (st.heat > 0) {
      // molten glow rising off a hot shelf
      g.save();
      g.globalCompositeOperation = "lighter";
      const q = g.createLinearGradient(0, top - 22, 0, top + 6);
      const k = st.heat >= 1 ? 0.75 : 0.3;
      q.addColorStop(0, hexA("#ff5a19", 0)); q.addColorStop(1, hexA("#ffb347", k));
      g.fillStyle = q; g.fillRect(0, top - 22, len, 28);
      if (st.heat >= 1 && Math.random() < 0.5)
        FX.spark(a.x + Math.random() * dx, a.y - 4 + Math.random() * dy, "#ff8a1f");
      g.restore();
    }
    if (p.crumble && st.present && st.stood > 0) {
      // stress cracks appear as a cloud shelf takes weight
      g.save();
      g.globalAlpha = Math.min(0.8, st.stood / p.crumble.delay);
      g.strokeStyle = "#6b5a85"; g.lineWidth = 1.6; g.lineCap = "round";
      for (let i = 1; i < 5; i++) {
        const cx2 = (len * i) / 5;
        g.beginPath(); g.moveTo(cx2, top + 1); g.lineTo(cx2 + 5, top + th + 3); g.stroke();
      }
      g.restore();
    }
    if (p.retract) {
      // guide rails the shelf slides back into
      g.save();
      g.globalAlpha = 0.5; g.strokeStyle = hexA(pal.platEdge, 0.5); g.lineWidth = 2;
      g.setLineDash([5, 6]);
      g.beginPath(); g.moveTo(-18, top + th / 2); g.lineTo(len + 18, top + th / 2); g.stroke();
      g.setLineDash([]);
      g.restore();
    }
    g.restore();
  });

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

  /* Team ring: in a 2v2 a coloured ellipse under the feet says which side a
     fighter is on even when the tags are lost in a pile-up. */
  if (f.team != null && f.grounded) {
    g.save();
    g.globalAlpha = 0.55;
    g.strokeStyle = f.tint; g.lineWidth = 2.5;
    g.shadowColor = f.tint; g.shadowBlur = 10;
    g.beginPath(); g.ellipse(rx, f.feetY - 1, ch.size.w * 0.62, 6, 0, 0, 7); g.stroke();
    g.restore();
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
    // real frame data, so swing() can line the pose up with the hitbox
    atkT: atk ? atk.t : 0,
    atkStartup: atk ? atk.data.startup : 0,
    atkActive: atk ? atk.data.active : 0,
    atkTotal: atk ? atk.total : 0,
    move: atk ? atk.data : null,
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

  /* Player tag. Online, the fighter this screen controls is marked YOU with
     a pointer, because with four players on one stage "which one am I" is
     the first question after every respawn. */
  const mine = Net.active && f.slot === Net.slot;
  const tagY = ry - ch.size.h * 0.82;
  g.save();
  g.font = `700 12px ${FONT_MONO}`;
  g.textAlign = "center";
  g.globalAlpha = 0.9;
  g.fillStyle = f.tint;
  const label = mine ? "YOU" : `P${f.slot + 1}${f.isCPU ? " CPU" : ""}`;
  if (mine) { g.shadowColor = f.tint; g.shadowBlur = 10; }
  g.fillText(label, rx, tagY);
  if (mine) {
    const bob = Math.sin(f.animTime * 0.12) * 2;
    poly(g, [rx - 6, tagY + 4 + bob, rx + 6, tagY + 4 + bob, rx, tagY + 10 + bob]);
    g.fill();
  }
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

function drawClock(framesLeft) {
  const secs = Math.max(0, Math.ceil(framesLeft / 60));
  const mm = Math.floor(secs / 60), ss = secs % 60;
  const low = secs <= 10;
  const col = low ? "#ff2e88" : UI.text;

  // the clock sits in its own hanging plate under the gauge
  g.save();
  const cw = 132, cx = W / 2 - cw / 2, cy = 82;
  panel(g, cx, cy, cw, 36, {
    cut: 9, fill: "#120f26", accent: col,
    accentA: low ? 0.95 : 0.4, glow: low ? 18 : 0,
    only: { bl: 1, br: 1 },
  });
  g.textAlign = "center";
  g.font = `900 26px ${FONT_DISPLAY}`;
  g.globalAlpha = low && Math.floor(framesLeft / 8) % 2 === 0 ? 0.55 : 1;
  if (low) { g.shadowColor = "#ff2e88"; g.shadowBlur = 18; }
  g.fillStyle = col;
  g.fillText(`${mm}:${String(ss).padStart(2, "0")}`, W / 2, cy + 27);
  g.restore();

  // stage name, plus whatever special state the clock is in, top right
  const m = Match.current;
  g.save();
  chip(g, Stage.def.name, W - 16, 22, Stage.pal.platEdge, { align: "right" });
  if (m && m.suddenDeath)
    chip(g, "SUDDEN DEATH", W - 16, 46, "#ff2e88", { align: "right" });
  else if (m && m.frenzy)
    chip(g, `FRENZY · METER x${CFG.meter.frenzyMul}`, W - 16, 46, "#ffc83d", { align: "right" });
  if (m && m.teams)
    chip(g, "2v2 TEAMS", 16, 22, "#ffffff", { align: "left" });
  g.restore();
}

/* Player cards. Each one is a stamped plate in that fighter's colour, with a
   coloured header bar carrying the name, a recessed well for the damage
   readout, stock pips as diamonds and the meter as a segmented charge rail.
   The percentage is the single most-read number on screen, so it gets the
   deepest recess and the most contrast. */
function drawPlayerHUD(fighters) {
  const n = fighters.length;
  const cardW = 206, gap = 14, cardH = 92;
  let x = (W - (n * cardW + (n - 1) * gap)) / 2;
  const y = H - 108;

  for (const f of fighters) {
    const dead = f.stocks <= 0;
    const col = f.ch.color;
    g.save();
    g.globalAlpha = dead ? 0.3 : 1;

    // the plate, with the top corners cut toward the centre of the screen
    panel(g, x, y, cardW, cardH, {
      cut: 12, fill: "#14112a", accent: col,
      accentA: f.meterFull ? 1 : 0.6,
      glow: f.meterFull ? 20 : 6,
      only: { tl: 1, tr: 1 },
    });

    // header bar in the fighter's colour
    g.save();
    notchPath(g, x, y, cardW, 24, 12, { tl: 1, tr: 1 });
    g.clip();
    const hq = g.createLinearGradient(0, y, 0, y + 24);
    hq.addColorStop(0, shade(col, 0.1));
    hq.addColorStop(1, shade(col, -0.4));
    g.fillStyle = hq; g.fillRect(x, y, cardW, 24);
    hatch(g, x + cardW - 48, y, 48, 24, "#000000", 7, 0.18);
    g.restore();

    g.font = `700 13px ${FONT_MONO}`; g.textAlign = "left";
    g.fillStyle = "rgba(0,0,0,.45)"; g.fillText(f.ch.name, x + 44.5, y + 17.5);
    g.fillStyle = "#ffffff"; g.fillText(f.ch.name, x + 44, y + 17);
    g.font = `700 9px ${FONT_MONO}`; g.textAlign = "right";
    g.fillStyle = "rgba(255,255,255,.75)";
    g.fillText(`P${f.slot + 1}${f.isCPU ? "·CPU" : ""}`, x + cardW - 10, y + 17);
    if (f.team != null) {
      // a team-coloured lip along the card's top edge
      g.save();
      g.fillStyle = TEAM_TINT[f.team];
      g.shadowColor = TEAM_TINT[f.team]; g.shadowBlur = 10;
      g.fillRect(x + 14, y - 4, cardW - 28, 3);
      g.restore();
    }

    // portrait, inset into the header so it breaks the bar's line
    g.save();
    const px0 = x + 7, py0 = y + 5;
    notchPath(g, px0, py0, 32, 32, 7); g.clip();
    g.fillStyle = shade(f.ch.color2, -0.4); g.fillRect(px0, py0, 32, 32);
    g.translate(px0 + 16, py0 + 30); g.scale(0.52, 0.52);
    f.ch.draw(g, { time: f.animTime, runPhase: 0, running: false, air: false,
                   vx: 0, vy: 0, state: ST.IDLE, flash: false, atkPhase: -1 });
    g.restore();
    notchPath(g, px0, py0, 32, 32, 7);
    g.strokeStyle = UI.ink; g.lineWidth = 2.5; g.stroke();

    /* ---- damage readout, in a recessed well ---- */
    const p = Math.floor(f.percent);
    const heat = clamp(p / 160, 0, 1);
    const pc = mixColor("#ffffff", "#ff2e88", heat);
    const wx = x + cardW - 96, wy = y + 30;
    slot(g, wx, wy, 88, 34, 6);
    g.save();
    g.beginPath(); roundRect(g, wx, wy, 88, 34, 6); g.clip();
    if (heat > 0.4) hatch(g, wx, wy, 88, 34, "#ff2e88", 11, (heat - 0.4) * 0.28);
    g.font = `900 ${29 + heat * 7}px ${FONT_DISPLAY}`;
    g.textAlign = "right";
    g.shadowColor = pc; g.shadowBlur = 8 + heat * 16;
    g.fillStyle = pc;
    g.fillText(`${p}%`, wx + 83, wy + 28);
    g.restore();

    /* ---- stocks as diamonds ---- */
    for (let i = 0; i < CFG.stocks; i++) {
      const on = i < f.stocks;
      g.save();
      g.translate(x + 18 + i * 16, y + 40); g.rotate(Math.PI / 4);
      g.strokeStyle = UI.ink; g.lineWidth = 2.5;
      g.strokeRect(-4.5, -4.5, 9, 9);
      g.fillStyle = on ? col : "rgba(255,255,255,.10)";
      if (on) { g.shadowColor = col; g.shadowBlur = 9; }
      g.fillRect(-4.5, -4.5, 9, 9);
      g.restore();
    }

    /* ---- special-ready pip ---- */
    const ready = f.specialCD <= 0;
    g.save();
    g.translate(x + 18 + CFG.stocks * 16 + 4, y + 40);
    g.rotate(Math.PI / 4 + (ready ? f.animTime * 0.02 : 0));
    g.strokeStyle = UI.ink; g.lineWidth = 2.5; g.strokeRect(-4, -4, 8, 8);
    g.fillStyle = ready ? f.ch.accent : "rgba(255,255,255,.10)";
    if (ready) { g.shadowColor = f.ch.accent; g.shadowBlur = 10; }
    g.fillRect(-4, -4, 8, 8);
    g.restore();

    /* ---- shield rail ---- */
    const sw = 96;
    slot(g, x + 12, y + 52, sw, 5, 2.5);
    bar(g, x + 12, y + 52, sw, 5, f.shield / CFG.shieldMax,
        f.shield < 30 ? "#ff2e88" : "#7fd9ff", { r: 2.5 });

    /* ---- super meter: a segmented charge rail across the card's foot ---- */
    const mw = cardW - 24, mx = x + 12, my = y + 66;
    slot(g, mx, my, mw, 14, 4);
    const mk = f.meter / CFG.meter.max;
    if (f.meterFull) {
      const pulse = 0.72 + Math.sin(f.animTime * 0.18) * 0.28;
      g.globalAlpha = (dead ? 0.3 : 1) * pulse;
      bar(g, mx + 1, my + 1, mw - 2, 12, 1, f.ch.accent, { glow: 18, r: 3 });
      g.globalAlpha = dead ? 0.3 : 1;
    } else {
      bar(g, mx + 1, my + 1, mw - 2, 12, mk, col, { glow: 8, r: 3 });
    }
    ticks(g, mx, my + 1, mw, 12, 8, "#000000", 0.45);
    g.font = `700 8px ${FONT_MONO}`; g.textAlign = "center";
    if (f.meterFull) {
      g.fillStyle = "#07060f";
      g.fillText("SUPER READY", mx + mw / 2, my + 10);
    } else {
      g.fillStyle = "rgba(255,255,255,.4)";
      g.fillText(`${Math.floor(mk * 100)}%`, mx + mw / 2, my + 10);
    }

    if (dead) {
      // a struck-out card reads faster than a faded one
      g.save();
      g.strokeStyle = "#ff2e88"; g.lineWidth = 3; g.globalAlpha = 0.5;
      g.beginPath(); g.moveTo(x + 6, y + cardH - 6); g.lineTo(x + cardW - 6, y + 6); g.stroke();
      g.restore();
      // out, but a teammate can spare a stock: say so on the card
      if (f.canStealStock && f.canStealStock()) {
        g.save();
        g.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(f.animTime * 0.08));
        chip(g, f.isCPU ? "STEALING A STOCK…" : "SPECIAL: STEAL A STOCK",
             x + cardW / 2, y - 26, f.tint, { align: "center" });
        g.restore();
      }
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
