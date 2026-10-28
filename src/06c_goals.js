/* ==========================================================================
   6c. GOALS — daily challenges, achievements, and the toasts that announce them

   Three challenges a day, picked from the date so everyone gets the same
   three, each paying coins once. Achievements are one-off badges for
   milestones and stand-out matches. Both live in the profile blob, so an
   account carries them between devices like everything else.

   Everything is checked from Profile: after every match (with that match's
   numbers) and on every save (lifetime milestones only, which is how a
   tournament win or a shop purchase unlocks one).
   ========================================================================== */

/* m is the match summary built in Profile.recordMatch; p is the challenge's
   parameter (a fighter or stage id) when it has one. */
const DAILY_POOL = [
  { id: "win",      n: 3,   coins: 60, text: n => `Win ${n} matches`,            add: m => m.won ? 1 : 0 },
  { id: "play",     n: 4,   coins: 40, text: n => `Play ${n} matches`,           add: () => 1 },
  { id: "kos",      n: 8,   coins: 60, text: n => `Land ${n} KOs`,               add: m => m.kos },
  { id: "dmg",      n: 600, coins: 50, text: n => `Deal ${n}% damage`,           add: m => Math.round(m.damage) },
  { id: "supers",   n: 3,   coins: 50, text: n => `Land ${n} supers`,            add: m => m.supers },
  { id: "items",    n: 6,   coins: 50, text: n => `Grab ${n} items`,             add: m => m.items },
  { id: "smash",    n: 8,   coins: 50, text: n => `Land ${n} SMASH hits`,        add: m => m.smashes },
  { id: "combo",    n: 1,   coins: 60, text: () => "Land a 3-hit combo",         add: m => m.bestCombo >= 3 ? 1 : 0 },
  { id: "flawless", n: 1,   coins: 80, text: () => "Win without losing a stock", add: m => m.won && m.falls === 0 ? 1 : 0 },
  { id: "team",     n: 1,   coins: 50, text: () => "Win a 2v2 match",            add: m => m.won && m.teams ? 1 : 0 },
  { id: "char",     n: 1,   coins: 70, param: "fighter",
    text: (n, p) => `Win a match as ${CHAR_BY_ID[p].name}`,  add: (m, p) => m.won && m.charId === p ? 1 : 0 },
  { id: "stage",    n: 2,   coins: 40, param: "stage",
    text: (n, p) => `Play ${n} matches on ${(STAGES.find(s => s.id === p) || STAGES[0]).name}`,
    add: (m, p) => m.stage === p ? 1 : 0 },
];
const DAILY_COUNT = 3;

/* test(st, d, m): st is lifetime stats, d the whole profile, m this match's
   summary or null when checking outside a match. */
const ACHIEVEMENTS = [
  { id: "FIRST_WIN", name: "FIRST BLOOD",    coins: 25,  desc: "Win your first match",           test: st => st.wins >= 1 },
  { id: "WINS_10",   name: "CONTENDER",      coins: 50,  desc: "Win 10 matches",                 test: st => st.wins >= 10 },
  { id: "WINS_50",   name: "CHAMPION",       coins: 150, desc: "Win 50 matches",                 test: st => st.wins >= 50 },
  { id: "PLAY_25",   name: "REGULAR",        coins: 40,  desc: "Play 25 matches",                test: st => st.matches >= 25 },
  { id: "PLAY_100",  name: "LIFER",          coins: 120, desc: "Play 100 matches",               test: st => st.matches >= 100 },
  { id: "KO_25",     name: "KNOCKOUT ARTIST", coins: 40, desc: "Land 25 KOs",                    test: st => st.kos >= 25 },
  { id: "KO_250",    name: "WRECKING BALL",  coins: 150, desc: "Land 250 KOs",                   test: st => st.kos >= 250 },
  { id: "DMG_5K",    name: "HEAVY HITTER",   coins: 60,  desc: "Deal 5,000% damage in total",    test: st => st.damage >= 5000 },
  { id: "SUPER_25",  name: "SUPERNOVA",      coins: 60,  desc: "Land 25 supers",                 test: st => st.supers >= 25 },
  { id: "ITEMS_25",  name: "SCAVENGER",      coins: 40,  desc: "Grab 25 items",                  test: st => st.items >= 25 },
  { id: "FLAWLESS",  name: "UNTOUCHABLE",    coins: 40,  desc: "Win without losing a stock",     test: (st, d, m) => m && m.won && m.falls === 0 },
  { id: "TRIPLE",    name: "HAT TRICK",      coins: 30,  desc: "Land 3 KOs in one match",        test: (st, d, m) => m && m.kos >= 3 },
  { id: "COMBO5",    name: "COMBO KING",     coins: 60,  desc: "Land a 5-hit combo",             test: (st, d, m) => m && m.bestCombo >= 5 },
  { id: "BIGHIT",    name: "HAYMAKER",       coins: 40,  desc: "Deal 30% or more in one hit",    test: (st, d, m) => m && m.bestHit >= 30 },
  { id: "CLUTCH",    name: "CLUTCH",         coins: 40,  desc: "Win on your last stock",         test: (st, d, m) => m && m.won && m.lastStock },
  { id: "SPEED",     name: "SPEEDRUN",       coins: 50,  desc: "Win a match in under a minute",  test: (st, d, m) => m && m.won && m.secs < 60 },
  { id: "SUDDEN",    name: "SURVIVOR",       coins: 40,  desc: "Win in Sudden Death",            test: (st, d, m) => m && m.won && m.sudden },
  { id: "FFA4",      name: "LAST ONE UP",    coins: 50,  desc: "Win a 4-fighter free-for-all",   test: (st, d, m) => m && m.won && !m.teams && m.size >= 4 },
  { id: "TEAM",      name: "TEAMWORK",       coins: 30,  desc: "Win a 2v2 match",                test: (st, d, m) => m && m.won && m.teams },
  { id: "LOOT",      name: "POWER HUNGRY",   coins: 40,  desc: "Grab 5 items in one match",      test: (st, d, m) => m && m.items >= 5 },
  { id: "ONLINE",    name: "CONNECTED",      coins: 30,  desc: "Play a match online",            test: st => st.online >= 1 },
  { id: "TROPHY",    name: "TROPHY",         coins: 100, desc: "Win a tournament",               test: st => st.tourneyWins >= 1 },
  { id: "DYNASTY",   name: "DYNASTY",        coins: 250, desc: "Win 5 tournaments",              test: st => st.tourneyWins >= 5 },
  { id: "ROSTER10",  name: "EXPLORER",       coins: 50,  desc: "Play 10 different fighters",     test: (st, d) => Object.keys(d.chars).length >= 10 },
  { id: "ROSTERALL", name: "FULL ROSTER",    coins: 200, desc: `Play every fighter`,            test: (st, d) => Object.keys(d.chars).length >= ROSTER.length },
  { id: "COLLECTOR", name: "COLLECTOR",      coins: 60,  desc: "Own 5 cosmetics",                test: (st, d) => d.owned.length >= 5 },
  { id: "SAVER",     name: "BIG SAVER",      coins: 50,  desc: "Hold 1,000 coins at once",       test: (st, d) => d.coins >= 1000 },
  { id: "DAILY10",   name: "DEDICATED",      coins: 100, desc: "Complete 10 daily challenges",   test: st => st.dailies >= 10 },
];
const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

/** The local calendar day, as YYYY-MM-DD. Challenges turn over at midnight. */
function dayKey(t) {
  const d = t ? new Date(t) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** A small seeded generator, so a given day always deals the same challenges. */
function seededRng(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const Daily = {
  /** Today's three challenges: [{ def, p, n, text }]. Same for everyone. */
  deal(day) {
    const rng = seededRng("cmb-" + day);
    const pool = DAILY_POOL.slice(), out = [];
    while (out.length < DAILY_COUNT && pool.length) {
      const def = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      let p = null;
      if (def.param === "fighter") p = ROSTER[Math.floor(rng() * ROSTER.length)].id;
      if (def.param === "stage") p = STAGES[Math.floor(rng() * STAGES.length)].id;
      out.push({ def, p, n: def.n, text: def.text(def.n, p) });
    }
    return out;
  },
  /** Today's challenges with this profile's progress, rolling over at midnight. */
  today(d) {
    const day = dayKey();
    if (!d.daily || d.daily.day !== day) d.daily = { day, prog: [0, 0, 0], done: [0, 0, 0] };
    if (this._for !== day) { this._for = day; this._list = this.deal(day); }
    return this._list.map((c, i) => Object.assign({}, c, { prog: d.daily.prog[i] || 0, done: !!d.daily.done[i] }));
  },
  /** Milliseconds until the next set. */
  msLeft() {
    const now = new Date(), next = new Date(now);
    next.setHours(24, 0, 0, 0);
    return next - now;
  },
};

const Goals = {
  busy: false,

  /** After a match: advance today's challenges and check every achievement.
      Credits the coins and returns what paid, for the results screen. */
  onMatch(d, m) {
    const paid = [];
    const list = Daily.today(d);
    list.forEach((c, i) => {
      if (c.done) return;
      const add = c.def.add(m, c.p) || 0;
      if (!add) return;
      d.daily.prog[i] = Math.min(c.n, (d.daily.prog[i] || 0) + add);
      if (d.daily.prog[i] >= c.n) {
        d.daily.done[i] = 1;
        d.stats.dailies++;
        paid.push({ kind: "daily", label: c.text, coins: c.def.coins });
        Toast.push("DAILY CHALLENGE COMPLETE", c.text, "#b6ff3b", c.def.coins);
      }
    });
    paid.push(...this.unlock(d, m));
    for (const p of paid) { d.coins += p.coins; d.stats.earned += p.coins; }
    return paid;
  },

  /** Anything newly earned. Pays for itself when called outside a match. */
  unlock(d, m, pay) {
    const got = [];
    for (const a of ACHIEVEMENTS) {
      if (d.ach.includes(a.id)) continue;
      let hit = false;
      try { hit = !!a.test(d.stats, d, m); } catch (e) { hit = false; }
      if (!hit) continue;
      d.ach.push(a.id);
      got.push({ kind: "ach", label: a.name, coins: a.coins });
      Toast.push("ACHIEVEMENT UNLOCKED", a.name, "#ffc83d", a.coins);
      if (pay) { d.coins += a.coins; d.stats.earned += a.coins; }
    }
    return got;
  },

  /** On every save: lifetime milestones only (a tournament win, a purchase,
      a pile of coins). Guarded, since paying out saves again. */
  sweep(d) {
    if (this.busy) return false;
    this.busy = true;
    const got = this.unlock(d, null, true);
    this.busy = false;
    return got.length > 0;
  },
};

/* ------------------------------------------------------------- toasts
   A small card that slides down at the top right of any screen, so an unlock is
   seen wherever it happened. */
const Toast = {
  list: [],
  push(title, text, color, coins) {
    if (this.list.length > 6) return;
    this.list.push({ title, text, color, coins, at: null });
    Snd.uiBig();
  },
  draw(g) {
    if (!this.list.length) return;
    const now = performance.now(), LIFE = 3800;
    // one at a time, each waiting for the last to leave
    const t = this.list[0];
    if (t.at === null) t.at = now;
    const age = now - t.at;
    if (age > LIFE) { this.list.shift(); return; }
    const k = Math.min(1, age / 260, (LIFE - age) / 260);
    // top right, clear of the big centred titles on the results screen
    const w = 400, h = 58, x = W - w - 20, y = -h + (h + 62) * easeOut(Math.max(0, k));
    g.save();
    panel(g, x, y, w, h, { cut: 10, fill: "#15112b", accent: t.color, accentA: 1, glow: 18, shadow: true });
    g.textAlign = "left"; g.textBaseline = "middle";
    // a trophy or a tick
    g.save(); g.translate(x + 30, y + h / 2);
    g.fillStyle = t.color; g.strokeStyle = INK; g.lineWidth = 2.5;
    if (t.title.startsWith("ACH")) {
      g.beginPath(); g.moveTo(-10, -12); g.lineTo(10, -12); g.lineTo(8, 0); g.quadraticCurveTo(0, 8, -8, 0); g.closePath();
      g.stroke(); g.fill();
      g.fillRect(-2, 4, 4, 6); g.fillRect(-7, 10, 14, 4);
    } else {
      g.lineWidth = 5; g.strokeStyle = t.color; g.lineCap = "round";
      g.beginPath(); g.moveTo(-9, 0); g.lineTo(-3, 7); g.lineTo(10, -8); g.stroke();
    }
    g.restore();
    g.font = `700 10px ${FONT_MONO}`; g.fillStyle = t.color;
    g.fillText(t.title, x + 56, y + 19);
    g.font = `900 17px ${FONT_DISPLAY}`; g.fillStyle = "#ffffff";
    let text = t.text;
    while (g.measureText(text).width > w - 150 && text.length > 4) text = text.slice(0, -2);
    if (text !== t.text) text = text.trimEnd() + "…";
    g.fillText(text, x + 56, y + 39);
    if (t.coins) coinChip(g, t.coins, x + w - 14, y + 13, "right", "+");
    g.restore();
  },
};
