/* ==========================================================================
   7. UI KIT — the fighters' drawing language, applied to panels and gauges

   The roster got ink outlines, top-lit gradients and a clipped rim light, and
   that is what made it stop looking like flat shapes. The HUD was still plain
   translucent rounded rectangles, so it read as a different, cheaper game
   sitting on top of a good-looking one. Everything here exists so a panel is
   built the same way a pauldron is.

   Shared with the roster: INK, ink(), rim(), vol(), plate(). Those are plain
   function declarations in one concatenated script, so load order is moot.
   ========================================================================== */

const UI = {
  ink:   "#07050f",
  panel: "#15122b",
  panel2:"#0c0a1c",
  line:  "#2c2745",
  text:  "#f2f0ff",
  dim:   "#8f8cb5",
  dimmer:"#6b6a85",
};

/* --------------------------------------------------------------- shapes */

/** Rectangle with its corners cut off — stamped plate rather than a web card.
    `cut` is the size of the chamfer; `only` picks which corners get one. */
function notchPath(g, x, y, w, h, cut, only) {
  const o = only || { tl: 1, tr: 1, br: 1, bl: 1 };
  const c = cut;
  g.beginPath();
  g.moveTo(x + (o.tl ? c : 0), y);
  g.lineTo(x + w - (o.tr ? c : 0), y);
  if (o.tr) g.lineTo(x + w, y + c);
  g.lineTo(x + w, y + h - (o.br ? c : 0));
  if (o.br) g.lineTo(x + w - c, y + h);
  g.lineTo(x + (o.bl ? c : 0), y + h);
  if (o.bl) g.lineTo(x, y + h - c);
  g.lineTo(x, y + (o.tl ? c : 0));
  g.closePath();
}

/** A machined panel: cast shadow, ink edge, top-lit face, rim light, and an
    optional accent hairline just inside the border. */
function panel(g, x, y, w, h, opts) {
  const o = opts || {};
  const cut = o.cut === undefined ? 10 : o.cut;
  const path = () => (cut > 0 ? notchPath(g, x, y, w, h, cut, o.only)
                              : roundRect(g, x, y, w, h, o.r || 12));
  const accent = o.accent || UI.line;

  g.save();

  // 1. a real cast shadow, so panels sit above the stage instead of in it
  if (o.shadow !== false) {
    g.save();
    g.globalAlpha = 0.5; g.fillStyle = "#000";
    g.translate(0, 4); path(); g.fill();
    g.restore();
  }

  // 2. ink edge + top-lit face
  const base = o.fill || UI.panel;
  const q = g.createLinearGradient(0, y, 0, y + h);
  q.addColorStop(0, shade(base, 0.12));
  q.addColorStop(0.5, base);
  q.addColorStop(1, shade(base, -0.42));
  path();
  g.strokeStyle = UI.ink; g.lineWidth = o.inkW || 4; g.lineJoin = "round"; g.stroke();
  g.fillStyle = q; g.fill();

  // 3. rim light along the top edge, clipped inside the panel
  g.save(); path(); g.clip();
  g.translate(0, 2.4); path();
  g.strokeStyle = "#ffffff"; g.lineWidth = 3; g.globalAlpha = 0.14; g.stroke();
  g.restore();

  // 4. accent hairline, glowing when the panel wants attention
  g.save(); path(); g.clip();
  g.translate(0, 1.4); path();
  g.strokeStyle = accent; g.lineWidth = o.accentW || 2;
  g.globalAlpha = o.accentA === undefined ? 0.75 : o.accentA;
  if (o.glow) { g.shadowColor = accent; g.shadowBlur = o.glow; }
  g.stroke();
  g.restore();

  g.restore();
}

/** Diagonal hazard hatching, clipped to a shape. Used for danger zones. */
function hatch(g, x, y, w, h, col, step, a) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.globalAlpha = a === undefined ? 0.3 : a;
  g.strokeStyle = col; g.lineWidth = (step || 10) * 0.45;
  for (let i = -h; i < w + h; i += step || 10) {
    g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + h, y); g.stroke();
  }
  g.restore();
}

/** A recessed slot: the inverse of a panel, for bars and readouts to sit in. */
function slot(g, x, y, w, h, r) {
  const path = () => roundRect(g, x, y, w, h, r === undefined ? h / 2 : r);
  path();
  g.fillStyle = "rgba(0,0,0,.55)"; g.fill();
  // inner shadow at the top sells the depth
  g.save(); path(); g.clip();
  g.translate(0, 2); path();
  g.strokeStyle = "#000"; g.lineWidth = 3; g.globalAlpha = 0.5; g.stroke();
  g.restore();
}

/** A filled bar inside a slot, lit along its own top edge. */
function bar(g, x, y, w, h, frac, col, opts) {
  const o = opts || {};
  const fw = Math.max(0, w * clamp(frac, 0, 1));
  if (fw < 0.6) return;
  const r = o.r === undefined ? h / 2 : o.r;
  const path = () => roundRect(g, x, y, fw, h, Math.min(r, fw / 2));
  g.save();
  if (o.glow) { g.shadowColor = col; g.shadowBlur = o.glow; }
  path(); g.fillStyle = col; g.fill();
  g.shadowBlur = 0;
  // highlight stripe across the top third
  path(); g.clip();
  g.fillStyle = "rgba(255,255,255,.26)";
  g.fillRect(x, y, fw, Math.max(1, h * 0.34));
  g.restore();
}

/** Evenly spaced tick marks — turns a bar into an instrument. */
function ticks(g, x, y, w, h, n, col, a) {
  g.save();
  g.globalAlpha = a === undefined ? 0.4 : a;
  g.strokeStyle = col; g.lineWidth = 1;
  for (let i = 1; i < n; i++) {
    const tx = Math.round(x + (w * i) / n) + 0.5;
    g.beginPath(); g.moveTo(tx, y); g.lineTo(tx, y + h); g.stroke();
  }
  g.restore();
}

/** Small bolt head, for the corners of metal panels. */
function screw(g, x, y, r, col) {
  g.save();
  g.fillStyle = "rgba(0,0,0,.6)";
  g.beginPath(); g.arc(x, y + 0.8, r, 0, 7); g.fill();
  g.fillStyle = col || UI.line;
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x - r * 0.55, y); g.lineTo(x + r * 0.55, y); g.stroke();
  g.restore();
}

/** A small label chip — stage names, counts, tags. */
function chip(g, text, x, y, col, opts) {
  const o = opts || {};
  g.save();
  g.font = o.font || `700 10px ${FONT_MONO}`;
  const tw = g.measureText(text).width;
  const padX = o.padX || 9, h = o.h || 20;
  const w = tw + padX * 2;
  const bx = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
  notchPath(g, bx, y, w, h, 5);
  g.fillStyle = "rgba(6,5,14,.88)"; g.fill();
  g.strokeStyle = hexA(col, 0.65); g.lineWidth = 1.5; g.stroke();
  g.fillStyle = col; g.textAlign = "left"; g.textBaseline = "middle";
  g.fillText(text, bx + padX, y + h / 2 + 0.5);
  g.textBaseline = "alphabetic";
  g.restore();
  return w;
}
