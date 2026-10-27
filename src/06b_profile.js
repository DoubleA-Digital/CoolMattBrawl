/* ==========================================================================
   7b. PROFILE — lifetime stats, coins, cosmetics and the optional account

   Everything works as a guest, saved to this browser. Signing up uploads
   that progress to an account so it follows you to another device; the
   account lives in Supabase behind six RPCs (cmb_signup, cmb_login, cmb_load,
   cmb_save, cmb_logout, cmb_leaderboard). The tables themselves are closed to
   the public key, so the only way in is a username + password or a session
   token, and passwords are bcrypt-hashed in the database.

   Only the account holder earns: P1 on a shared screen, your own seat online.
   ========================================================================== */

/* --------------------------------------------------------------- catalog */
/* A skin is a palette for any fighter: every roster draw() reads its colours
   from this.color / color2 / color3 / accent, so swapping those four repaints
   the whole silhouette, its effects and its HUD card. */
const SKINS = [
  { id: "GOLD",    name: "GOLD RUSH", price: 250, pal: ["#ffc83d", "#8a5a00", "#3a2400", "#fff3c4"] },
  { id: "SHADOW",  name: "SHADOW",    price: 200, pal: ["#4a4466", "#221e38", "#0d0b18", "#b388ff"] },
  { id: "FROST",   name: "FROSTBITE", price: 200, pal: ["#8fe6ff", "#2a6a8a", "#0e2836", "#ffffff"] },
  { id: "TOXIC",   name: "TOXIC",     price: 200, pal: ["#b6ff3b", "#3f6b0d", "#182a05", "#f0ffd0"] },
  { id: "INFERNO", name: "INFERNO",   price: 250, pal: ["#ff5a1f", "#8a1a00", "#330800", "#ffe08a"] },
  { id: "ROYAL",   name: "ROYAL",     price: 300, pal: ["#8a5cff", "#3a1d8a", "#170a3a", "#ffd76b"] },
  { id: "CANDY",   name: "BUBBLEGUM", price: 300, pal: ["#ff8ad8", "#a03a86", "#3e0f33", "#c8fbff"] },
  { id: "GHOST",   name: "GHOST",     price: 400, pal: ["#e8e6f8", "#9a97b8", "#45425e", "#7df9ff"] },
  { id: "PRISM",   name: "PRISM",     price: 900, prism: true },
];
const HATS = [
  { id: "PARTY",  name: "PARTY HAT",  price: 100 },
  { id: "TOPHAT", name: "TOP HAT",    price: 150 },
  { id: "EARS",   name: "CAT EARS",   price: 150 },
  { id: "HORNS",  name: "DEVIL HORNS", price: 200 },
  { id: "CROWN",  name: "CROWN",      price: 300 },
  { id: "HALO",   name: "HALO",       price: 300 },
  { id: "VIKING", name: "VIKING HELM", price: 350 },
  { id: "WIZARD", name: "WIZARD HAT", price: 450 },
];
const TRAILS = [
  { id: "SPARK",   name: "SPARKS",    price: 200, col: "#ffe36b" },
  { id: "BUBBLE",  name: "BUBBLES",   price: 200, col: "#8fe6ff" },
  { id: "FLAME",   name: "FLAMES",    price: 300, col: "#ff7a1f" },
  { id: "STAR",    name: "STARDUST",  price: 400, col: "#ffffff" },
  { id: "RAINBOW", name: "RAINBOW",   price: 650, col: "#ff2e88" },
];
const COS_KINDS = { skin: SKINS, hat: HATS, trail: TRAILS };
const COS_BY_ID = {};
for (const k in COS_KINDS) for (const it of COS_KINDS[k]) { it.kind = k; COS_BY_ID[it.id] = it; }

function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
}

/** A display name off the wire: the same rules as an account username. */
function cleanName(n) {
  return typeof n === "string" ? n.replace(/[^A-Za-z0-9_]/g, "").slice(0, 14) : "";
}

/* ------------------------------------------------------------- cosmetics */
const Cosmetics = {
  _skinned: Object.create(null),
  _anchor: Object.create(null),

  /** A loadout from the wire or from storage, reduced to known items only. */
  clean(c) {
    if (!c || typeof c !== "object") return null;
    const pick = (id, kind) => (typeof id === "string" && COS_BY_ID[id] && COS_BY_ID[id].kind === kind) ? id : "";
    const out = { s: pick(c.s, "skin"), h: pick(c.h, "hat"), t: pick(c.t, "trail") };
    return out.s || out.h || out.t ? out : null;
  },

  /** The character with a skin's palette laid over it. Everything else —
      moves, sizes, draw() itself — comes through the prototype. */
  skinned(ch, skinId) {
    const s = COS_BY_ID[skinId];
    if (!ch || !s || s.kind !== "skin") return ch;
    const key = ch.id + "/" + s.id;
    if (this._skinned[key]) return this._skinned[key];
    const o = Object.create(ch);
    if (s.prism) {
      // hue cycles with wall time; colours never feed the simulation
      const hue = off => performance.now() / 14 + off;
      Object.defineProperties(o, {
        color:  { get: () => hslHex(hue(0), 95, 62) },
        color2: { get: () => hslHex(hue(40), 80, 34) },
        color3: { get: () => hslHex(hue(80), 70, 15) },
        accent: { get: () => hslHex(hue(180), 100, 86) },
      });
    } else {
      [o.color, o.color2, o.color3, o.accent] = s.pal;
    }
    o.skin = s.id;
    return (this._skinned[key] = o);
  },

  /** Where a fighter's head tops out, found once by drawing the idle pose
      offscreen and scanning for the first solid row. Sixteen hand-tuned
      anchors would drift every time someone's art changed. */
  anchor(ch) {
    const id = ch.id;
    if (this._anchor[id]) return this._anchor[id];
    const fallback = { x: 0, y: -ch.size.h * 0.62 };
    let a = fallback;
    try {
      const S = 260, ox = 130, oy = 170;
      const c = document.createElement("canvas"); c.width = S; c.height = S;
      const q = c.getContext("2d");
      q.translate(ox, oy);
      ch.draw.call(CHAR_BY_ID[id], q, { time: 0, runPhase: 0, running: false, air: false, vx: 0, vy: 0,
                                        state: ST.IDLE, flash: false, atkPhase: -1 });
      const px = q.getImageData(0, 0, S, S).data;
      const band = Math.max(10, ch.size.w * 0.32);
      for (let y = 0; y < S; y++) {
        let n = 0, sx = 0;
        for (let x = Math.floor(ox - band); x <= ox + band; x++) {
          if (px[(y * S + x) * 4 + 3] > 90) { n++; sx += x; }
        }
        if (n >= 3) { a = { x: sx / n - ox, y: y - oy }; break; }
      }
    } catch (e) { a = fallback; }
    return (this._anchor[id] = a);
  },

  /** Hat, in the fighter's own space (already flipped and squashed). */
  drawHat(g, ch, hatId, t) {
    if (!hatId) return;
    const a = this.anchor(ch);
    const k = clamp(ch.size.w / 46, 0.8, 1.25);
    g.save();
    g.translate(a.x, a.y + 3);
    g.scale(k, k);
    g.lineJoin = "round";
    const ink = INK;
    const outline = (fill, w) => { g.strokeStyle = ink; g.lineWidth = w || 3; g.stroke(); g.fillStyle = fill; g.fill(); };
    switch (hatId) {
      case "PARTY": {
        g.beginPath(); g.moveTo(-11, 0); g.lineTo(0, -30); g.lineTo(11, 0); g.closePath();
        outline("#ff2e88");
        g.save(); g.clip();
        g.fillStyle = "#ffe36b";
        for (let i = 0; i < 3; i++) g.fillRect(-14, -24 + i * 9, 28, 3);
        g.restore();
        g.beginPath(); g.arc(0, -31, 4.5, 0, 7); outline("#00e5ff", 2.5);
        break;
      }
      case "TOPHAT": {
        g.beginPath(); g.ellipse(0, -1, 19, 4.5, 0, 0, 7); outline("#1a1730");
        roundRect(g, -11, -27, 22, 26, 3); outline("#1a1730");
        g.fillStyle = "#ff2e88"; g.fillRect(-11, -8, 22, 5);
        g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(-8, -25, 4, 16);
        break;
      }
      case "EARS": {
        for (const s of [-1, 1]) {
          g.beginPath(); g.moveTo(s * 4, 2); g.lineTo(s * 13, -17); g.lineTo(s * 18, 3); g.closePath();
          outline("#2b2540");
          g.beginPath(); g.moveTo(s * 8, 0); g.lineTo(s * 13, -10); g.lineTo(s * 15, 0); g.closePath();
          g.fillStyle = "#ff8ad8"; g.fill();
        }
        break;
      }
      case "HORNS": {
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(s * 5, 3);
          g.quadraticCurveTo(s * 9, -10, s * 19, -16);
          g.quadraticCurveTo(s * 15, -4, s * 14, 4);
          g.closePath();
          outline("#e0203a");
        }
        break;
      }
      case "CROWN": {
        g.beginPath();
        g.moveTo(-14, 2); g.lineTo(-14, -12); g.lineTo(-7, -5); g.lineTo(0, -17);
        g.lineTo(7, -5); g.lineTo(14, -12); g.lineTo(14, 2); g.closePath();
        outline("#ffc83d");
        g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(-12, -3, 24, 2);
        g.fillStyle = "#ff2e88"; g.beginPath(); g.arc(0, -4, 2.6, 0, 7); g.fill();
        g.fillStyle = "#00e5ff"; g.beginPath(); g.arc(-8, -2, 2, 0, 7); g.arc(8, -2, 2, 0, 7); g.fill();
        break;
      }
      case "HALO": {
        const bob = Math.sin(t * 0.06) * 2;
        g.save();
        g.translate(0, -12 + bob);
        g.shadowColor = "#fff3a0"; g.shadowBlur = 16;
        g.strokeStyle = "#fff3a0"; g.lineWidth = 4;
        g.beginPath(); g.ellipse(0, 0, 15, 4.5, 0, 0, 7); g.stroke();
        g.shadowBlur = 0;
        g.strokeStyle = "#ffffff"; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(0, -0.5, 15, 4.5, 0, Math.PI, Math.PI * 2); g.stroke();
        g.restore();
        break;
      }
      case "VIKING": {
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(s * 11, -5);
          g.quadraticCurveTo(s * 24, -8, s * 22, -24);
          g.quadraticCurveTo(s * 18, -12, s * 9, -11);
          g.closePath();
          outline("#f2ead2");
        }
        g.beginPath(); g.arc(0, 2, 14, Math.PI, 0); g.closePath(); outline("#8a93a8");
        g.fillStyle = "#c9a227"; g.fillRect(-14, -1, 28, 4);
        g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(-8, -9, 3, 7);
        break;
      }
      case "WIZARD": {
        g.beginPath(); g.ellipse(0, 0, 21, 5, 0, 0, 7); outline("#3a1d8a");
        g.beginPath(); g.moveTo(-12, -1); g.quadraticCurveTo(-2, -22, 6, -38);
        g.quadraticCurveTo(4, -18, 12, -1); g.closePath(); outline("#4b2aa8");
        g.fillStyle = "#ffe36b";
        for (const [sx, sy, r] of [[-3, -12, 2.4], [4, -22, 1.8], [-1, -4, 1.6]]) {
          g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill();
        }
        break;
      }
    }
    g.restore();
  },

  /** Trail, in world space, from a short history of where the fighter was.
      It is kept per draw rather than per tick: purely cosmetic, so it never
      has to agree between host and guest. */
  drawTrail(g, f, rx, ry, trailId) {
    const tr = COS_BY_ID[trailId];
    if (!tr) return;
    const now = performance.now();
    const h = f._ctrail || (f._ctrail = []);
    const last = h[h.length - 1];
    const moving = !last || Math.hypot(rx - last.x, ry - last.y) > 1.2;
    if (moving && f.state !== ST.DEAD) {
      h.push({ x: rx + (Math.random() - 0.5) * f.w * 0.5,
               y: ry + (Math.random() - 0.2) * f.h * 0.5, t: now, r: Math.random() });
    }
    const life = trailId === "RAINBOW" ? 420 : 520;
    while (h.length && now - h[0].t > life) h.shift();
    if (h.length > 60) h.splice(0, h.length - 60);

    g.save();
    if (trailId === "RAINBOW") {
      g.lineCap = "round"; g.lineJoin = "round";
      for (let i = 1; i < h.length; i++) {
        const k = 1 - (now - h[i].t) / life;
        g.globalAlpha = k * 0.7;
        g.strokeStyle = hslHex(h[i].t / 4, 95, 62);
        g.lineWidth = 3 + k * 9;
        g.beginPath(); g.moveTo(h[i - 1].x, h[i - 1].y); g.lineTo(h[i].x, h[i].y); g.stroke();
      }
      g.restore();
      return;
    }
    g.globalCompositeOperation = "lighter";
    for (const p of h) {
      const k = 1 - (now - p.t) / life;
      if (k <= 0) continue;
      const rise = (1 - k) * 18;
      switch (trailId) {
        case "SPARK":
          g.globalAlpha = k;
          g.fillStyle = p.r > 0.5 ? "#ffe36b" : "#ffffff";
          g.fillRect(p.x - 1.5, p.y + rise * 0.6 - 1.5, 3, 3);
          break;
        case "BUBBLE":
          g.globalAlpha = k * 0.8;
          g.strokeStyle = "#8fe6ff"; g.lineWidth = 1.6;
          g.beginPath(); g.arc(p.x, p.y - rise, 2 + (1 - k) * 6 + p.r * 2, 0, 7); g.stroke();
          break;
        case "FLAME": {
          g.globalAlpha = k * 0.75;
          const r = 3 + k * 7;
          const q = g.createRadialGradient(p.x, p.y - rise, 0, p.x, p.y - rise, r);
          q.addColorStop(0, "#fff0a0"); q.addColorStop(0.45, "#ff7a1f"); q.addColorStop(1, "rgba(255,40,0,0)");
          g.fillStyle = q;
          g.beginPath(); g.arc(p.x, p.y - rise, r, 0, 7); g.fill();
          break;
        }
        case "STAR": {
          g.globalAlpha = k;
          g.fillStyle = p.r > 0.66 ? "#ffe36b" : p.r > 0.33 ? "#8fe6ff" : "#ffffff";
          const s = 1.5 + k * 3;
          g.save(); g.translate(p.x, p.y + rise * 0.3); g.rotate(p.r * 6 + (now - p.t) / 200);
          g.beginPath();
          for (let i = 0; i < 8; i++) {
            const rr = i % 2 ? s * 0.4 : s * 1.6, a = i * Math.PI / 4;
            g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          g.closePath(); g.fill(); g.restore();
          break;
        }
      }
    }
    g.restore();
  },

  /** A fighter as a portrait: skin, hat, the lot. Used on every menu. */
  portrait(g, ch, cos, A) {
    const c = this.clean(cos);
    const sk = c ? this.skinned(ch, c.s) : ch;
    sk.draw(g, A);
    if (c && c.h) this.drawHat(g, ch, c.h, A.time || 0);
  },
};

/* ---------------------------------------------------------------- profile */
function freshProfile() {
  return {
    v: 1, coins: 0,
    stats: { matches: 0, wins: 0, kos: 0, falls: 0, damage: 0, supers: 0, bestHit: 0,
             tourneys: 0, tourneyWins: 0, earned: 0, online: 0 },
    chars: {},              // id -> { p: played, w: won, k: KOs }
    favs: [],               // fighter ids, most favourite first
    owned: [],              // cosmetic ids
    equip: { skin: {}, hat: "", trail: "" },
  };
}

/** Whatever came out of storage or the cloud, coerced to the current shape. */
function normProfile(d) {
  const p = freshProfile();
  if (!d || typeof d !== "object") return p;
  const num = v => (typeof v === "number" && isFinite(v) && v >= 0) ? v : 0;
  p.coins = Math.floor(num(d.coins));
  if (d.stats && typeof d.stats === "object") for (const k in p.stats) p.stats[k] = num(d.stats[k]);
  if (d.chars && typeof d.chars === "object") {
    for (const id in d.chars) {
      if (!CHAR_BY_ID[id]) continue;
      const c = d.chars[id] || {};
      p.chars[id] = { p: num(c.p), w: num(c.w), k: num(c.k) };
    }
  }
  if (Array.isArray(d.favs)) p.favs = d.favs.filter(id => CHAR_BY_ID[id]).slice(0, ROSTER.length);
  if (Array.isArray(d.owned)) p.owned = [...new Set(d.owned.filter(id => COS_BY_ID[id]))];
  const e = d.equip || {};
  if (e.skin && typeof e.skin === "object") {
    for (const id in e.skin) {
      if (CHAR_BY_ID[id] && p.owned.includes(e.skin[id]) && COS_BY_ID[e.skin[id]].kind === "skin")
        p.equip.skin[id] = e.skin[id];
    }
  }
  if (p.owned.includes(e.hat) && COS_BY_ID[e.hat].kind === "hat") p.equip.hat = e.hat;
  if (p.owned.includes(e.trail) && COS_BY_ID[e.trail].kind === "trail") p.equip.trail = e.trail;
  return p;
}

const ACCOUNT_ERRORS = {
  bad_username: "Usernames are 3-14 letters, numbers or _",
  bad_password: "Passwords need 4-72 characters",
  taken: "That username is taken",
  bad_login: "Wrong username or password",
  bad_session: "You were signed out — log in again",
  too_big: "Profile too large to save",
};

const Profile = {
  d: freshProfile(),
  user: null,             // account username, null as a guest
  token: null,
  status: "",             // last account message, for the screens
  busy: false,
  saveTimer: 0,
  board: null,            // leaderboard rows once fetched

  get signedIn() { return !!this.token; },
  get name() { return this.user || ""; },

  boot() {
    let acct = null, guest = null;
    try { acct = JSON.parse(localStorage.getItem("cmb_acct") || "null"); } catch (e) {}
    try { guest = JSON.parse(localStorage.getItem("cmb_guest") || "null"); } catch (e) {}
    if (acct && acct.token && acct.user) {
      this.user = acct.user; this.token = acct.token;
      this.d = normProfile(acct.data);
      this.refresh();
    } else {
      this.d = normProfile(guest);
    }
  },

  /** Write locally now; push to the account shortly after (changes batch). */
  persist() {
    try {
      if (this.signedIn) localStorage.setItem("cmb_acct", JSON.stringify({ user: this.user, token: this.token, data: this.d }));
      else localStorage.setItem("cmb_guest", JSON.stringify(this.d));
    } catch (e) { /* storage blocked: progress lasts the session */ }
    if (this.signedIn) {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.pushCloud(), 1200);
    }
  },

  rpc(fn, body) {
    return fetch(`${RTC.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: RTC.key, Authorization: "Bearer " + RTC.key, "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(async r => {
      let j = null;
      try { j = await r.json(); } catch (e) {}
      if (!r.ok) {
        const code = j && j.message;
        const err = new Error(ACCOUNT_ERRORS[code] || "Couldn't reach the server — try again");
        err.code = code;
        throw err;
      }
      return j;
    });
  },

  pushCloud() {
    if (!this.signedIn) return;
    this.rpc("cmb_save", { p_token: this.token, p_data: this.d })
      .catch(e => { if (e.code === "bad_session") this.dropSession(e.message); });
  },

  /** Signed in already: pull the account copy, which wins over the cache. */
  refresh() {
    if (!this.signedIn) return;
    this.rpc("cmb_load", { p_token: this.token }).then(r => {
      if (!r) return;
      this.user = r.username || this.user;
      this.d = normProfile(r.data);
      this.persist();
    }).catch(e => { if (e.code === "bad_session") this.dropSession(e.message); });
  },

  /** A dead token: back to guest, keeping nothing of the account here. */
  dropSession(msg) {
    this.user = this.token = null;
    try { localStorage.removeItem("cmb_acct"); } catch (e) {}
    let guest = null;
    try { guest = JSON.parse(localStorage.getItem("cmb_guest") || "null"); } catch (e) {}
    this.d = normProfile(guest);
    this.status = msg || "";
  },

  /** Signing up turns this browser's guest progress into the account. */
  signup(user, pass) {
    return this.auth("cmb_signup", { p_user: user, p_pass: pass, p_data: this.d }, "Account created — progress saved");
  },
  /** Logging in loads the account; the guest progress stays with the guest. */
  login(user, pass) {
    return this.auth("cmb_login", { p_user: user, p_pass: pass }, "Logged in");
  },
  auth(fn, body, okMsg) {
    if (this.busy) return Promise.resolve(false);
    this.busy = true; this.status = "";
    return this.rpc(fn, body).then(r => {
      this.busy = false;
      if (!r || !r.token) throw new Error("Couldn't reach the server — try again");
      this.user = r.username; this.token = r.token;
      this.d = normProfile(r.data);
      this.status = okMsg;
      this.persist();
      this.applyFavourite();
      return true;
    }).catch(e => { this.busy = false; this.status = e.message; return false; });
  },
  logout() {
    const tok = this.token;
    clearTimeout(this.saveTimer);
    if (tok) this.rpc("cmb_save", { p_token: tok, p_data: this.d })
      .finally(() => this.rpc("cmb_logout", { p_token: tok }).catch(() => {}));
    this.dropSession("Logged out");
  },

  fetchBoard() {
    this.rpc("cmb_leaderboard", {}).then(rows => { this.board = Array.isArray(rows) ? rows : []; })
      .catch(() => { this.board = this.board || []; });
  },

  /* ------------------------------------------------------- favourites */
  isFav(id) { return this.d.favs.includes(id); },
  toggleFav(id) {
    const f = this.d.favs;
    if (f.includes(id)) f.splice(f.indexOf(id), 1); else f.push(id);
    this.persist();
  },
  /** P1 starts on your top favourite. */
  applyFavourite() {
    if (this.d.favs.length && typeof Game !== "undefined") Game.slots[0].charId = this.d.favs[0];
  },

  /* ------------------------------------------------------------ shop */
  owns(id) { return this.d.owned.includes(id); },
  buy(id) {
    const it = COS_BY_ID[id];
    if (!it || this.owns(id) || this.d.coins < it.price) return false;
    this.d.coins -= it.price;
    this.d.owned.push(id);
    this.persist();
    return true;
  },
  equipped(it, charId) {
    return it.kind === "skin" ? this.d.equip.skin[charId] === it.id : this.d.equip[it.kind] === it.id;
  },
  /** Equip, or take off again if it was already on. Skins are per fighter. */
  toggleEquip(it, charId) {
    if (!this.owns(it.id)) return;
    if (it.kind === "skin") {
      if (this.d.equip.skin[charId] === it.id) delete this.d.equip.skin[charId];
      else this.d.equip.skin[charId] = it.id;
    } else {
      this.d.equip[it.kind] = this.d.equip[it.kind] === it.id ? "" : it.id;
    }
    this.persist();
  },
  /** The loadout this player wears on a given fighter. */
  cosFor(charId) {
    return Cosmetics.clean({ s: this.d.equip.skin[charId], h: this.d.equip.hat, t: this.d.equip.trail });
  },

  /* ---------------------------------------------------------- earning */
  /** Called once per finished match. Returns the coin breakdown for the
      results screen, or null when nobody on this machine was playing. */
  recordMatch(match, extra) {
    if (!match || match._recorded) return match && match._reward;
    match._recorded = true;
    const mineSlot = Net.active ? Net.slot : 0;
    const me = match.fighters.find(f => f.slot === mineSlot && !f.isCPU);
    if (!me || match.fighters.length < 2) return null;

    const won = match.winTeam != null ? me.team === match.winTeam : match.winner === me;
    const s = me.stats, st = this.d.stats;
    st.matches++; if (won) st.wins++;
    st.kos += s.kos; st.falls += s.falls;
    st.damage = Math.round(st.damage + s.damageDealt);
    st.supers += s.supers;
    st.bestHit = Math.max(st.bestHit, Math.round(s.bestHit));
    if (Net.active) st.online++;
    const c = this.d.chars[me.ch.id] || (this.d.chars[me.ch.id] = { p: 0, w: 0, k: 0 });
    c.p++; if (won) c.w++; c.k += s.kos;

    const lines = [["MATCH PLAYED", 10]];
    if (won) lines.push(["VICTORY", 25]);
    if (won && s.falls === 0) lines.push(["FLAWLESS", 15]);
    if (s.kos) lines.push([`${s.kos} KO${s.kos > 1 ? "s" : ""}`, s.kos * 8]);
    const dmg = Math.min(30, Math.floor(s.damageDealt / 25));
    if (dmg) lines.push([`${Math.round(s.damageDealt)}% DEALT`, dmg]);
    if (s.supers) lines.push([`${s.supers} SUPER${s.supers > 1 ? "S" : ""}`, Math.min(12, s.supers * 3)]);
    if (Net.active) lines.push(["ONLINE", 5]);
    if (extra) lines.push(...extra);

    const total = lines.reduce((n, l) => n + l[1], 0);
    this.d.coins += total; st.earned += total;
    this.persist();
    match._reward = { total, lines, won };
    return match._reward;
  },

  /** Coins outside a match (tournament placings). */
  award(n) {
    if (n <= 0) return;
    this.d.coins += n; this.d.stats.earned += n;
    this.persist();
  },
};

/* --------------------------------------------------------- text entry
   The canvas cannot take typing on its own, and a phone will not show a
   keyboard for one, so a real (invisible) input carries the text and the
   canvas just paints it. */
const TextIn = {
  el: null, field: null,
  ensure() {
    if (this.el) return this.el;
    const el = document.createElement("input");
    el.setAttribute("autocomplete", "off");
    el.setAttribute("autocapitalize", "off");
    el.spellcheck = false;
    Object.assign(el.style, { position: "fixed", left: "0", top: "0", width: "1px", height: "1px",
                              opacity: "0", border: "0", padding: "0", zIndex: "-1" });
    el.addEventListener("input", () => {
      if (!this.field) return;
      let v = el.value;
      if (this.field.filter) v = v.replace(this.field.filter, "");
      v = v.slice(0, this.field.max);
      if (v !== el.value) el.value = v;
      this.field.value = v;
    });
    document.body.appendChild(el);
    return (this.el = el);
  },
  focus(field) {
    const el = this.ensure();
    if (this.field !== field) {
      this.field = field;
      el.type = field.secret ? "password" : "text";
      el.maxLength = field.max;
      el.value = field.value;
    }
    if (document.activeElement !== el) el.focus({ preventScroll: true });
  },
  blur() {
    if (this.el) { this.el.blur(); this.el.value = ""; }
    this.field = null;
  },
};
