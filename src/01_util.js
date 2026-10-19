/* ==========================================================================
   2. UTIL — math, colour and canvas helpers
   ========================================================================== */

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function rndi(a, b) { return Math.floor(rnd(a, b + 1)); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
/** Smooth 0..1 ease used all over the animation code. */
function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function easeIn(t) { return t * t * t; }

/** Deterministic per-seed noise — stable backgrounds that never re-randomise. */
function hash(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Rounded polygon from a flat [x,y,...] list — used for angular armour. */
function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function mixColor(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Shift a hex colour's lightness without leaving its hue. */
function shade(hex, amt) {
  return mixColor(hex, amt > 0 ? "#ffffff" : "#000000", Math.abs(amt));
}

/** Draw text with a knocked-out dark outline so it reads on any background. */
function outlineText(ctx, text, x, y, fill, lw) {
  ctx.lineJoin = "round";
  ctx.lineWidth = lw || 8;
  ctx.strokeStyle = "rgba(4,3,12,.92)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Glow helper that always restores shadow state. */
function glow(ctx, color, blur, fn) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

const FONT_DISPLAY = '"Archivo Black", Impact, "Arial Narrow Bold", sans-serif';
const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
