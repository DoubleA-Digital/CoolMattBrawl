/* ==========================================================================
   4. INPUT — rebindable keyboard, gamepads, and persisted settings
   ========================================================================== */

/* Every bindable action, in the order the controls table lists them. */
const ACTIONS = [
  { id: "left",    name: "Move Left",      desc: "Walk / run left. Also steers your launch while in hitstun." },
  { id: "right",   name: "Move Right",     desc: "Walk / run right." },
  { id: "up",      name: "Jump",           desc: "Tap on the ground to jump, again in the air to double jump." },
  { id: "down",    name: "Crouch / Drop",  desc: "Drop through a soft platform. In the air, fast-fall." },
  { id: "light",   name: "Light Attack",   desc: "Fast, low commitment. Your bread and butter at low damage." },
  { id: "heavy",   name: "Heavy Attack",   desc: "Slow smash with big knockback. This is what closes stocks." },
  { id: "special", name: "Special",        desc: "Your signature move. Every fighter's special works differently." },
  { id: "super",   name: "Super",          desc: "Costs a full meter. One huge, character-defining move." },
  { id: "shield",  name: "Shield",         desc: "Hold to block. With a direction, roll. With down, spot dodge. In air, air dodge." },
  { id: "grab",    name: "Grab",           desc: "Beats shields. Then press a direction to throw, or Light to pummel." },
];
const BUTTONS = ACTIONS.map(a => a.id);
// the buttons a fighter remembers if pressed a moment too early (Fighter.buffered)
const BUFFERED = ["light", "heavy", "special", "super", "grab"];

/* Factory defaults. P1/P2 on the keyboard halves, P3 on the numpad,
   P4 on the number row. All of it is rebindable in the Controls screen. */
const DEFAULT_BINDS = [
  { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS",
    light: "KeyF", heavy: "KeyG", special: "KeyH", super: "KeyR",
    shield: "KeyQ", grab: "KeyE" },
  { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown",
    light: "KeyK", heavy: "KeyL", special: "Semicolon", super: "Quote",
    shield: "KeyO", grab: "KeyP" },
  { left: "Numpad4", right: "Numpad6", up: "Numpad8", down: "Numpad5",
    light: "Numpad7", heavy: "Numpad9", special: "NumpadAdd", super: "NumpadEnter",
    shield: "NumpadSubtract", grab: "NumpadMultiply" },
  { left: "Digit4", right: "Digit6", up: "Digit8", down: "Digit5",
    light: "Digit7", heavy: "Digit9", special: "Digit0", super: "Minus",
    shield: "Digit1", grab: "Digit3" },
];

/* -------------------------------------------------------------- settings */
const Settings = {
  data: Object.assign({}, CFG.defaults),
  binds: DEFAULT_BINDS.map(b => Object.assign({}, b)),

  load() {
    try {
      const raw = localStorage.getItem("cmb_settings");
      if (raw) {
        const o = JSON.parse(raw);
        if (o && o.data) Object.assign(this.data, o.data);
        if (o && Array.isArray(o.binds)) {
          o.binds.forEach((b, i) => { if (b && this.binds[i]) Object.assign(this.binds[i], b); });
        }
      }
    } catch (e) { /* private window or blocked storage — defaults are fine */ }
  },
  save() {
    try {
      localStorage.setItem("cmb_settings", JSON.stringify({ data: this.data, binds: this.binds }));
    } catch (e) { /* non-fatal */ }
  },
  get(k) { return this.data[k]; },
  set(k, v) { this.data[k] = v; this.save(); },
  toggle(k) { this.data[k] = !this.data[k]; this.save(); return this.data[k]; },

  resetBinds() {
    this.binds = DEFAULT_BINDS.map(b => Object.assign({}, b));
    this.save();
  },
  /** Returns the [player, action] already using a code, or null. */
  conflict(code, player, action) {
    for (let p = 0; p < this.binds.length; p++)
      for (const a of BUTTONS)
        if (this.binds[p][a] === code && !(p === player && a === action)) return [p, a];
    return null;
  },
  bind(player, action, code) {
    const c = this.conflict(code, player, action);
    if (c) this.binds[c[0]][c[1]] = null;   // a key can only drive one action
    this.binds[player][action] = code;
    this.save();
  },
};

/** Turn a KeyboardEvent.code into something a human can read on a key cap. */
function keyLabel(code) {
  if (!code) return "—";
  const map = {
    ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
    Space: "SPACE", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/",
    Backslash: "\\", BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=",
    Backquote: "`", Enter: "ENTER", ShiftLeft: "L SHIFT", ShiftRight: "R SHIFT",
    ControlLeft: "L CTRL", ControlRight: "R CTRL", AltLeft: "L ALT", AltRight: "R ALT",
    Tab: "TAB", Backspace: "BKSP", CapsLock: "CAPS",
    NumpadAdd: "NUM +", NumpadSubtract: "NUM -", NumpadMultiply: "NUM *",
    NumpadDivide: "NUM /", NumpadDecimal: "NUM .", NumpadEnter: "NUM ⏎",
  };
  if (map[code]) return map[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "NUM " + code.slice(6);
  if (code.startsWith("F") && code.length <= 3) return code;
  return code.toUpperCase();
}

/* ------------------------------------------------------------- raw keys */
const Keys = {
  down: Object.create(null),
  pressed: Object.create(null),
  /* Keys pressed since the last simulation step, even if already released.
     Fighters read this as well as `down`, so a tap shorter than one frame —
     or one that lands between two frames on a 30Hz tab — still counts. */
  tapped: Object.create(null),
  capture: null,          // set to a callback while the Controls screen listens
};

addEventListener("keydown", e => {
  if (Keys.capture) {                      // rebinding: swallow the key
    e.preventDefault();
    const cb = Keys.capture; Keys.capture = null;
    cb(e.code);
    return;
  }
  if (!Keys.down[e.code]) { Keys.pressed[e.code] = true; Keys.tapped[e.code] = true; }
  Keys.down[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "Quote", "Slash"].includes(e.code))
    e.preventDefault();
  Snd.init(); Snd.resume();
});
addEventListener("keyup", e => { Keys.down[e.code] = false; });
addEventListener("blur", () => { Keys.down = Object.create(null); });

/* ------------------------------------------------------- per-player pad */
class Pad {
  constructor(slot) {
    this.slot = slot;
    this.cur = {}; this.prev = {};
    BUTTONS.forEach(b => { this.cur[b] = false; this.prev[b] = false; });
    this.ax = 0; this.ay = 0;
    this.hasGamepad = false;
  }
  poll() {
    const m = Settings.binds[this.slot];
    this.prev = Object.assign({}, this.cur);
    for (const b of BUTTONS) this.cur[b] = m[b] ? !!(Keys.down[m[b]] || Keys.tapped[m[b]]) : false;

    const gps = navigator.getGamepads ? navigator.getGamepads() : null;
    const gp = gps && gps[this.slot];
    if (gp && gp.connected) {
      const a = gp.axes, bt = gp.buttons, dz = 0.35;
      const B = i => bt[i] && bt[i].pressed;
      if ((a[0] || 0) < -dz || B(14)) this.cur.left = true;
      if ((a[0] || 0) > dz || B(15)) this.cur.right = true;
      if ((a[1] || 0) < -dz || B(12)) this.cur.up = true;
      if ((a[1] || 0) > dz || B(13)) this.cur.down = true;
      if (B(0)) this.cur.up = true;
      if (B(2)) this.cur.light = true;
      if (B(3)) this.cur.heavy = true;
      if (B(1)) this.cur.special = true;
      if (B(5) || B(7)) this.cur.shield = true;
      if (B(4) || B(6)) this.cur.grab = true;
      if (B(9)) this.cur.super = true;
      this.hasGamepad = true;
    } else this.hasGamepad = false;

    this.ax = (this.cur.right ? 1 : 0) - (this.cur.left ? 1 : 0);
    this.ay = (this.cur.down ? 1 : 0) - (this.cur.up ? 1 : 0);
  }
  held(b) { return this.cur[b]; }
  hit(b) { return this.cur[b] && !this.prev[b]; }
  released(b) { return !this.cur[b] && this.prev[b]; }
}

/* ------------------------------------------------------------- pointer */
const Mouse = { x: 0, y: 0, click: false, down: false, wheel: 0 };
