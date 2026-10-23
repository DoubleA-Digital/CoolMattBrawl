/* ==========================================================================
   12b. NET — online play over WebRTC (see 11a_rtc.js), host-authoritative,
              2-4 players

   WHY THIS SHAPE
   The obvious choice for a fighting game is lockstep: every machine runs the
   same simulation and only inputs cross the wire. This simulation is not safe
   to run that way: the spec does not require Math.sin/cos and friends to be
   bit-identical between JS engines, so browsers would drift apart and the
   fight would silently diverge. Instead it is a star:

     host    runs the only real simulation and ships a state snapshot per frame
             to every guest
     guests  (up to three) run no simulation at all; each one sends its input
             to the host, and applies and renders the snapshots that come back

   That costs a guest one round trip of view latency but it cannot desync,
   which is the right trade for a game played between friends.

   ROOM STATE, NOT MESSAGES
   The data channels are unreliable, so nothing important is sent once and
   trusted to arrive. The host re-broadcasts the whole room — seats, picks,
   teams, stage, and which phase it is in (lobby / match / results) — several
   times a second, and a guest simply converges on whatever the latest copy
   says. A dropped "start" just means a guest joins the match a few frames
   later; it can never leave someone stuck on the wrong screen. Guests resend
   their own pick the same way until the room reflects it.

   PREDICTION
   Waiting for the host to echo every move back made a guest's own fighter
   feel a full round trip late. So a guest predicts its own fighter: it runs
   the same Fighter code locally on its own input the instant a key goes
   down. Every input is numbered; each snapshot says which number the host
   has applied, and the guest rewinds its fighter to the host's state and
   silently replays the inputs the host has not seen yet. Hits, damage and
   KOs still come only from the host — while the host says a guest is being
   hit, grabbed or is out, the prediction stands aside entirely.

   HIDING THE REST
   With their own fighter predicted, what a guest still waited on was hits,
   specials, and everyone else. So: their swing shows its spark and sound the
   instant it connects on their screen (the host still decides the damage);
   specials that only affect the user are predicted like movement; and every
   other fighter is drawn projected forward by half the round trip using its
   own velocity, so it appears where it is now rather than where it was.
   The host plays with no input delay at all.

   EFFECTS
   Most FX are not transmitted. A guest derives them from snapshot deltas — a
   percent that went up is a hit, a stock that went down is a KO. Banners are
   the exception: they carry the move names, so the host forwards them.
   ========================================================================== */

const NET = {
  Peer: null,             // transport override for the headless tests; RtcPeer otherwise
  netDelay: 0,            // frames the host delays its own input by (none)
  projectMax: 8,          // frames other fighters may be projected ahead
  inHistory: 10,          // inputs repeated in every message, so a lost one is never missed
  queueMax: 3,            // host: inputs a guest may be buffered behind before it catches up
  replayMax: 90,          // guest: never replay more frames than this; just adopt the host state
  maxGuests: 3,           // four fighters in all
  roomEvery: 15,          // frames between room-state rebroadcasts
  pickEvery: 20,          // frames between a guest's pick resends
  silence: 10000,         // ms without a word from a link before it is treated as gone
  seatTimeout: 8000,      // ms a linked guest waits for a seat before giving up
};

/** A Pad fed by the wire instead of a keyboard. Same surface as Pad, so a
    Fighter cannot tell the difference. */
class NetPad {
  constructor(slot) {
    this.slot = slot;
    this.cur = {}; this.prev = {};
    BUTTONS.forEach(b => { this.cur[b] = false; this.prev[b] = false; });
    this.ax = 0; this.ay = 0;
    this.mask = 0;
    this.latch = 0;           // buttons pressed since the last poll
    this.hasGamepad = false;
  }
  /* Presses are latched until the fighter next polls. The host can go several
     frames without polling (every hit-pause freezes the simulation), and a
     quick tap that was pressed and released inside that window used to
     vanish. Now it still lands as one press. */
  setMask(m) { this.mask = m | 0; this.latch |= this.mask; }

  /* Numbered inputs from a predicting guest. Applied strictly in order, one
     per fighter update, and `ack` records the last one applied so the guest
     knows where to replay from. If the guest is more than queueMax inputs
     ahead (the host just sat through a hit-pause), the oldest are skipped to
     catch up — but their presses are kept in the latch, never lost. */
  push(seq, hist) {
    this.queue = this.queue || [];
    this.lastSeq = this.lastSeq || 0;
    for (let i = 0; i < hist.length; i++) {
      const s = seq - (hist.length - 1 - i);
      if (s > this.lastSeq) { this.queue.push([s, hist[i] | 0]); this.lastSeq = s; }
    }
    // a fighter that is out polls nothing; don't let its queue grow forever
    if (this.queue.length > 60) this.queue.splice(0, this.queue.length - 60);
  }
  poll() {
    const q = this.queue;
    if (q && q.length) {
      while (q.length > NET.queueMax) { const [s, m] = q.shift(); this.latch |= m; this.ack = s; }
      const [s, m] = q.shift();
      this.mask = m; this.ack = s;
    }
    this.prev = Object.assign({}, this.cur);
    const eff = this.mask | this.latch;
    this.latch = 0;
    BUTTONS.forEach((b, i) => { this.cur[b] = !!(eff & (1 << i)); });
    this.ax = (this.cur.right ? 1 : 0) - (this.cur.left ? 1 : 0);
    this.ay = (this.cur.down ? 1 : 0) - (this.cur.up ? 1 : 0);
  }
  held(b) { return this.cur[b]; }
  hit(b) { return this.cur[b] && !this.prev[b]; }
  released(b) { return !this.cur[b] && this.prev[b]; }
}

/** Pack a Pad's current buttons into a bitmask, in BUTTONS order. */
function maskFromPad(pad) {
  let m = 0;
  BUTTONS.forEach((b, i) => { if (pad.held(b)) m |= (1 << i); });
  return m;
}

const ENT_KINDS = ["orb", "wave", "well", "ballast", "draft"];

const Net = {
  mode: "off",            // off | hosting | joining | connected | error
  role: null,             // "host" | "guest"
  code: "",
  peer: null,
  status: "", error: "",
  slot: 0,                // the seat this screen plays: 0 for the host
  frame: 0,
  libLoaded: false,

  /* ---- host ---- */
  guests: [],             // { conn, slot, ping, lastPingAt }
  phase: "lobby",         // lobby | match | results
  mid: 0,                 // match id: a repeated start is the same match
  setup: null,            // the start payload of the current match
  dirty: false,           // room changed: rebroadcast now rather than later
  roomTick: 0,
  delayBuf: [],
  events: [],             // banners raised this frame, forwarded to guests

  /* ---- guest ---- */
  conn: null,
  seated: false,          // the host has given us a seat
  room: null,             // the newest room state, applied in tick()
  snapCur: null, lastSeen: null,
  want: null,             // { charId, team } we asked for; resent until the room agrees
  pickTick: 0,
  ping: 0, lastPingAt: 0,

  get active() { return this.mode === "connected"; },
  get isHost() { return this.role === "host"; },
  get isGuest() { return this.role === "guest"; },

  /* ---------------------------------------------------------- lifecycle */
  makePeer(code) { return new (NET.Peer || RtcPeer)(code); },

  /** The Supabase client, loaded on first use; only needed for the handshake. */
  loadLib() {
    if (this.libLoaded || NET.Peer) return Promise.resolve();
    if (window.supabase) { this.libLoaded = true; return Promise.resolve(); }
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = RTC.lib;
      s.onload = () => { this.libLoaded = true; res(); };
      s.onerror = () => rej(new Error("could not load the networking library"));
      document.head.appendChild(s);
    });
  },

  newCode() {
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no look-alikes
    let c = "";
    for (let i = 0; i < 4; i++) c += A[(Math.random() * A.length) | 0];
    return c;
  },

  reset() {
    clearInterval(this.hb);
    for (const gu of this.guests) { try { gu.conn.close(); } catch (e) {} }
    try { if (this.conn) this.conn.close(); } catch (e) {}
    try { if (this.peer) this.peer.destroy(); } catch (e) {}
    const wasOnline = this.mode !== "off";
    this.peer = null; this.conn = null; this.guests = [];
    this.mode = "off"; this.role = null; this.code = "";
    this.status = ""; this.error = "";
    this.slot = 0; this.frame = 0; this.delayBuf = []; this.events = [];
    this.phase = "lobby"; this.mid = 0; this.setup = null; this.dirty = false;
    this.seated = false; this.room = null; this.want = null;
    this.snapCur = this.lastSeen = null; this.snapAt = 0;
    this.ping = 0; this.heard = 0; this.linkedAt = 0;
    if (wasOnline && Game.screen !== "match") Game.match = null;
  },

  fail(msg) {
    this.error = String(msg || "connection failed");
    this.mode = "error";
    this.status = "";
  },

  /* ---------------------------------------------------------------- host */
  host() {
    this.reset();
    this.role = "host"; this.mode = "hosting";
    this.code = this.newCode();
    this.status = "opening the room...";
    this.slot = 0;
    // a fresh room: the host in seat 1, the rest open until people arrive
    Game.slots = Game.slots.map((s, i) => ({
      charId: s.charId, mode: i === 0 ? "human" : "off", team: i % 2,
    }));
    this.loadLib().then(() => {
      this.peer = this.makePeer(this.code);
      this.peer.on("open", () => {
        this.mode = "connected";
        this.status = "room open";
        this.startHeartbeat();
        this.dirty = true;
      });
      this.peer.on("error", e => {
        /* Once the room is open, a hiccup on the introduction channel only
           affects new joins; everyone already connected plays on. */
        if (this.mode === "connected") return;
        this.fail((e && e.type === "unavailable-id") ? "that room code is taken — try again"
                                                     : (e && e.message) || "connection error");
      });
      this.peer.on("connection", c => this.onGuestConnect(c));
    }).catch(e => this.fail(e.message));
  },

  freeSeat() {
    for (let i = 1; i < 4; i++)
      if (!this.guests.some(gu => gu.slot === i)) return i;
    return -1;
  },

  onGuestConnect(c) {
    c.on("open", () => {
      const slot = this.freeSeat();
      if (slot < 0 || this.guests.length >= NET.maxGuests) {
        // said three times: the channel may drop any single message
        for (let i = 0; i < 3; i++) setTimeout(() => { try { c.send({ t: "full" }); } catch (e) {} }, i * 100);
        setTimeout(() => { try { c.close(); } catch (e) {} }, 600);
        return;
      }
      const gu = { conn: c, slot, ping: 0, lastPingAt: 0, heard: performance.now() };
      this.guests.push(gu);
      const s = Game.slots[slot];
      Game.slots[slot] = { charId: s.mode === "off" ? ROSTER[slot % ROSTER.length].id : s.charId,
                           mode: "human", team: s.team == null ? slot % 2 : s.team };
      /* Seat them right now, from this event, rather than waiting for the
         next frame: the host has usually switched away to send the code, and
         a background tab runs no frames at all. */
      this.dirty = false;
      this.broadcastRoom();
      FX.banner(`P${slot + 1} JOINED`, PLAYER_TINT[slot]);
      Snd.uiBig();
    });
    c.on("data", d => {
      const gu = this.guests.find(x => x.conn === c);
      if (gu) { gu.heard = performance.now(); this.onGuestData(gu, d); }
    });
    c.on("close", () => this.dropGuest(c));
    c.on("error", () => this.dropGuest(c));
  },

  dropGuest(c) {
    const gu = this.guests.find(x => x.conn === c);
    if (!gu) return;
    this.guests.splice(this.guests.indexOf(gu), 1);
    Game.slots[gu.slot].mode = "off";
    this.dirty = true;
    /* Mid-match, their fighter does not vanish — that would hand the match
       to whoever they were fighting. A CPU takes it over. */
    const f = Game.match && this.phase === "match" &&
              Game.match.fighters.find(x => x.slot === gu.slot);
    if (f && !f.isCPU) {
      f.isCPU = true;
      f.pad = new NetPad(f.slot);
      FX.banner(`P${gu.slot + 1} LEFT — CPU TAKES OVER`, f.tint);
    } else if (Game.screen === "lobby") {
      FX.banner(`P${gu.slot + 1} LEFT`, PLAYER_TINT[gu.slot]);
    }
  },

  guestCount() { return this.isHost ? this.guests.length : 0; },

  /** Who occupies seat i: "host", "guest", or null for an empty/CPU seat. */
  seatOf(i) {
    if (this.isHost) return i === 0 ? "host" : this.guests.some(gu => gu.slot === i) ? "guest" : null;
    const r = this.room;
    return r && r.seats ? r.seats[i] : null;
  },
  /** True when seat i reaches the host over the relay rather than directly. */
  relayOf(i) {
    if (this.isHost) { const gu = this.guests.find(x => x.slot === i); return !!(gu && gu.conn.relay); }
    return i === this.slot && !!(this.conn && this.conn.relay);
  },
  pingOf(i) {
    if (this.isHost) { const gu = this.guests.find(x => x.slot === i); return gu ? gu.ping : 0; }
    return i === this.slot ? this.ping : 0;
  },

  onGuestData(gu, d) {
    if (!d || typeof d !== "object") return;
    switch (d.t) {
      case "pick":
        // seat changes only between matches
        if (this.phase === "match") break;
        if (typeof d.charId === "string" && CHAR_BY_ID[d.charId] &&
            Game.slots[gu.slot].charId !== d.charId) {
          Game.slots[gu.slot].charId = d.charId; this.dirty = true;
        }
        if ((d.team === 0 || d.team === 1) && Game.slots[gu.slot].team !== d.team) {
          Game.slots[gu.slot].team = d.team; this.dirty = true;
        }
        if (this.dirty && document.hidden) { this.dirty = false; this.broadcastRoom(); }
        break;
      case "in": {
        if (this.phase !== "match" || !Game.match || d.m !== this.mid) break;
        const f = Game.match.fighters.find(x => x.slot === gu.slot);
        if (!f || !(f.pad instanceof NetPad) || f.isCPU) break;
        if (Array.isArray(d.h)) f.pad.push(d.s | 0, d.h);
        else f.pad.setMask(d.k);
        break;
      }
      case "ping": try { gu.conn.send({ t: "pong", ts: d.ts }); } catch (e) {} break;
      case "pong": gu.ping = Math.round(performance.now() - d.ts); break;
    }
  },

  /* ---- host-side lobby edits (the lobby screen calls these) ---- */
  pick(i, charId) {
    if (this.isGuest) {
      if (i !== this.slot) return;
      Game.slots[i].charId = charId;                  // optimistic; the room confirms
      this.want = Object.assign({}, this.want, { charId });
      this.sendPick();
      return;
    }
    Game.slots[i].charId = charId;
    if (i !== 0 && !this.seatOf(i)) Game.slots[i].mode = "cpu";
    this.dirty = true;
  },
  setTeam(i, team) {
    if (this.isGuest) {
      if (i !== this.slot) return;
      Game.slots[i].team = team;
      this.want = Object.assign({}, this.want, { team });
      this.sendPick();
      return;
    }
    Game.slots[i].team = team; this.dirty = true;
  },
  setSeatMode(i, mode) {
    if (!this.isHost || i === 0 || this.seatOf(i)) return;
    Game.slots[i].mode = mode; this.dirty = true;
  },
  setTeams(on) { if (this.isHost) { Game.teams = on; this.dirty = true; } },
  setStage(i) { if (this.isHost) { Game.stageIndex = i; this.dirty = true; } },
  setPhase(p) { if (this.isHost) { this.phase = p; this.dirty = true; } },

  roomFor(gu) {
    return {
      t: "room", you: gu.slot, phase: this.phase, mid: this.mid,
      slots: Game.slots.map(s => [s.charId, s.mode, s.team || 0]),
      seats: [0, 1, 2, 3].map(i => this.seatOf(i)),
      teams: Game.teams, stage: Game.stageIndex,
      setup: this.phase === "lobby" ? null : this.setup,
    };
  },
  broadcastRoom() {
    for (const gu of this.guests) {
      try { gu.conn.send(this.roomFor(gu)); } catch (e) {}
    }
  },
  sendAll(obj) {
    for (const gu of this.guests) { try { gu.conn.send(obj); } catch (e) {} }
  },

  /** Host: announce and start. Everyone builds the same Match from setup. */
  startMatch() {
    this.mid++;
    this.setup = {
      mid: this.mid,
      slots: Game.slots.map(s => ({ charId: s.charId, mode: s.mode, team: s.team || 0 })),
      stage: Game.stageIndex,
      teams: Game.teams,
    };
    this.phase = "match";
    this.frame = 0;
    this.delayBuf = [];
    this.beginLocal(this.setup);
    this.broadcastRoom();
  },

  /* --------------------------------------------------------------- guest */
  join(code) {
    this.reset();
    this.role = "guest"; this.mode = "joining";
    this.code = (code || "").toUpperCase();
    this.status = "looking for room " + this.code;
    this.want = { charId: Game.slots[0].charId };
    this.loadLib().then(() => {
      this.peer = this.makePeer();
      this.peer.on("error", e => {
        if (this.mode === "connected") return;     // already linked to the host
        this.fail((e && e.type === "peer-unavailable") ? "no game found with that code"
                                                       : (e && e.message) || "connection error");
      });
      this.peer.on("found", () => { if (this.mode === "joining") this.status = "found the room — linking up"; });
      this.peer.on("open", () => {
        const c = this.peer.connect(this.code);
        this.conn = c;
        c.on("open", () => {
          this.mode = "connected";
          this.status = "linked up — waiting for the host to seat you";
          this.heard = this.linkedAt = performance.now();
          this.startHeartbeat();
          Snd.uiBig();
        });
        c.on("data", d => { this.heard = performance.now(); this.onHostData(d); });
        c.on("close", () => this.onHostGone());
        c.on("error", () => this.onHostGone());
      });
    }).catch(e => this.fail(e.message));
  },

  onHostGone() {
    if (this.mode === "off" || this.mode === "error") return;
    this.fail(this.error || "the host closed the room");
    Game.match = null;
    Game.screen = "online";
  },

  send(obj) {
    if (!this.conn) return;
    try { this.conn.send(obj); } catch (e) { /* a dropped frame is survivable */ }
  },
  sendPick() {
    if (!this.want) return;
    this.send({ t: "pick", charId: this.want.charId, team: this.want.team });
  },

  onHostData(d) {
    if (!d || typeof d !== "object") return;
    switch (d.t) {
      case "room": this.room = d; break;           // applied in tick(), on the game loop
      case "full": this.error = "that room is full (4 players)"; this.onHostGone(); break;
      case "s":
        // unordered channel: never step backwards
        if (d.m !== this.mid) break;
        if (this.snapCur && this.snapCur.f >= d.f) break;
        this.snapCur = d;
        this.snapAt = performance.now();
        break;
      case "ping": this.send({ t: "pong", ts: d.ts }); break;
      case "pong": this.ping = Math.round(performance.now() - d.ts); break;
    }
  },

  /** Guest: converge on the newest room state the host sent. */
  applyRoom() {
    const r = this.room;
    if (!r) return;
    this.slot = r.you;
    this.seated = true;
    Game.teams = !!r.teams;
    Game.stageIndex = r.stage;
    Game.slots = r.slots.map(([charId, mode, team], i) => {
      // keep our own optimistic pick until the host has caught up with it
      if (i === this.slot && this.want) {
        return { charId: this.want.charId || charId, mode,
                 team: this.want.team == null ? team : this.want.team };
      }
      return { charId, mode, team };
    });
    const mine = r.slots[this.slot];
    if (this.want && (!this.want.charId || this.want.charId === mine[0]) &&
        (this.want.team == null || this.want.team === mine[2])) this.want = null;

    if (r.phase === "match" && r.setup && (this.mid !== r.setup.mid || !Game.match)) {
      if (Game.screen !== "match" || this.mid !== r.setup.mid) this.beginLocal(r.setup);
    } else if (r.phase === "results" && Game.screen === "match" && Game.match && this.mid === r.mid) {
      Game.toResults(Game.match);
    } else if (r.phase === "lobby" && ["match", "results", "pause", "online"].includes(Game.screen)) {
      Game.match = null;
      Game.screen = "lobby";
      Snd.stopMusic();
    }
  },

  /* ---------------------------------------------------------- both roles */
  /** Construct the match described by a start payload. */
  beginLocal(setup) {
    this.mid = setup.mid;
    this.setup = setup;
    Game.slots = setup.slots.map(s => ({ charId: s.charId, mode: s.mode, team: s.team }));
    Game.stageIndex = setup.stage;
    Game.teams = !!setup.teams;
    Game.match = new Match(Game.slots, STAGES[setup.stage], { teams: setup.teams });
    Game.screen = "match";
    this.snapCur = this.lastSeen = null;
    this.snapAt = performance.now();
    this.seq = 0; this.hist = []; this.predicting = false;
    this.ease = {}; this.hitShownAt = {}; this.lagFrames = null;
    /* Every human fighter on the host is driven by a NetPad: the guests' by
       their input messages, the host's own by its delayed local input. */
    for (const f of Game.match.fighters) if (!f.isCPU) f.pad = new NetPad(f.slot);
  },

  measurePing() {
    const now = performance.now();
    if (this.isHost) {
      for (const gu of this.guests) {
        if (now - gu.lastPingAt < 1000) continue;
        gu.lastPingAt = now;
        try { gu.conn.send({ t: "ping", ts: now }); } catch (e) {}
      }
    } else if (now - this.lastPingAt >= 1000) {
      this.lastPingAt = now;
      this.send({ t: "ping", ts: now });
    }
  },

  /** Every frame, whatever screen is up. */
  /* Pings and the silence check run on a timer rather than the frame loop:
     browsers stop animation frames in a background tab, and a player who
     alt-tabs to read out the code must not be dropped for it. */
  startHeartbeat() {
    clearInterval(this.hb);
    this.hb = setInterval(() => this.heartbeat(), 1000);
  },
  heartbeat() {
    if (!this.active) return;
    this.measurePing();
    // a backgrounded host still keeps everyone's lobby up to date
    if (this.isHost && document.hidden) { this.dirty = false; this.broadcastRoom(); }
    /* A closed tab or a dead Wi-Fi does not always close the data channel
       promptly, so a link that has gone silent is dropped by timeout. */
    const now = performance.now();
    if (this.isHost) {
      for (const gu of this.guests.slice())
        if (now - gu.heard > NET.silence) { try { gu.conn.close(); } catch (e) {} this.dropGuest(gu.conn); }
    } else if (!this.seated && this.linkedAt && now - this.linkedAt > NET.seatTimeout) {
      // linked, yet never seated: never leave someone on the connecting screen
      this.error = "connected, but the host never seated you — the room may be full, or the host closed the game";
      try { this.conn.close(); } catch (e) {}
      this.onHostGone();
    } else if (this.heard && now - this.heard > NET.silence) {
      this.error = "lost the connection to the host";
      try { this.conn.close(); } catch (e) {}
      this.onHostGone();
    }
  },

  tick() {
    if (!this.active) return;
    if (this.isHost) {
      if (this.dirty || ++this.roomTick >= NET.roomEvery) {
        this.dirty = false; this.roomTick = 0;
        this.broadcastRoom();
      }
    } else {
      this.applyRoom();
      // keep asking for our pick until the room shows it
      if (this.want && ++this.pickTick >= NET.pickEvery) { this.pickTick = 0; this.sendPick(); }
    }
  },

  /* ----------------------------------------------------------- per frame */
  /** Called from Game.update() instead of match.update() when online. */
  update() {
    if (!this.active || !Game.match) return false;

    if (this.isHost) {
      /* Delay our own input by netDelay frames so the guests, whose input
         needs a round trip to arrive, are not systematically late. */
      const me = Game.match.fighters.find(f => f.slot === 0 && !f.isCPU);
      if (me) {
        const live = new Pad(0); live.poll();
        this.delayBuf.push(maskFromPad(live));
        while (this.delayBuf.length > NET.netDelay) me.pad.setMask(this.delayBuf.shift());
      }
      Game.match.update();
      this.frame++;
      if (this.guests.length) this.sendAll(this.snapshot());
      this.events.length = 0;
      return true;
    }

    // guest: number this frame's input, send it with recent history, predict
    const pad = new Pad(0); pad.poll();
    const mask = maskFromPad(pad);
    this.seq = (this.seq || 0) + 1;
    this.hist = this.hist || [];
    this.hist.push([this.seq, mask]);
    if (this.hist.length > 120) this.hist.shift();
    this.send({ t: "in", m: this.mid, s: this.seq,
                h: this.hist.slice(-NET.inHistory).map(e => e[1]) });
    this.liveMask = mask;
    this.applySnapshot();
    FX.update(Game.match.fighters);
    return true;
  },

  /** Guest: true while the host's match has stopped arriving — almost always
      because the host switched away from the game tab, which freezes it. */
  get hostStalled() {
    return this.isGuest && this.active && Game.screen === "match" &&
           this.snapAt && performance.now() - this.snapAt > 1200;
  },

  /** Host: FX.banner calls this so the text reaches the guests too. */
  forwardBanner(text, color) {
    if (this.isHost && this.active && this.phase === "match" && this.events.length < 6)
      this.events.push([text, color]);
  },

  /* -------------------------------------------------------- the protocol */
  snapshot() {
    const m = Game.match;
    const r2 = v => Math.round(v * 100) / 100;
    return {
      t: "s", m: this.mid, f: this.frame,
      st: [Stage.platT, Stage.flashT],
      // live platform state, only the fields that can change
      pf: Stage.pfx.map(s => [r2(s.dx), s.present ? 1 : 0, r2(s.heat),
                              r2(s.alpha), s.stood, s.gone]),
      mt: [m.countdown, m.timeLeft, m.over ? 1 : 0, m.endTimer,
           m.suddenDeath ? 1 : 0, m.frenzy ? 1 : 0,
           m.winner ? m.winner.slot : -1, m.winTeam == null ? -1 : m.winTeam,
           m.endedBy, m.frames, FX.pause],
      en: Entities.list.map(e => [ENT_KINDS.indexOf(e.kind), e.owner.slot,
                                  Math.round(e.x), Math.round(e.y), r2(e.r), e.life,
                                  e.dir || 0, e.landed ? 1 : 0, e.storm ? 1 : 0, e.max || 0]),
      ev: this.events.length ? this.events.slice() : undefined,
      fs: m.fighters.map(f => ({
        s: f.slot,
        x: r2(f.x), y: r2(f.y), vx: r2(f.vx), vy: r2(f.vy),
        fa: f.facing, st: f.state, tt: f.stateTimer, sp: r2(f.percent), sk: f.stocks,
        sh: r2(f.shield), mr: r2(f.meter), hs: f.hitstun, iv: f.invuln,
        gr: f.grounded ? 1 : 0, al: f.alive ? 1 : 0, rt: f.respawnTimer,
        hf: f.hitFlash, cd: f.specialCD, rp: r2(f.runPhase), at: f.animTime,
        ag: f.anchorGlow, pn: f.pinned ? 1 : 0, cpu: f.isCPU ? 1 : 0,
        ak: f.attack ? f.attack.kind : null,
        att: f.attack ? f.attack.t : 0,
        ato: f.attack ? f.attack.total : 0,
        // for the owning guest's prediction: the last input applied, and the
        // movement state that is not otherwise visible
        aq: (f.pad && f.pad.ack) || 0,
        aj: f.airJumps, ff: f.fastFalling ? 1 : 0, dt: f.dropThrough,
        sq: f.squatHeld ? 1 : 0, rd: f.rollDir || 0, lh: f.attack ? f.attack.lastHitFrame : 0,
        sx: [f.stats.kos, f.stats.falls, r2(f.stats.damageDealt), f.stats.supers, r2(f.stats.bestHit)],
      })),
    };
  },

  /** Guest: write the newest snapshot onto the local objects, then turn any
      meaningful change since the previous one into effects. */
  applySnapshot() {
    const snap = this.snapCur;
    if (!snap || !Game.match) return;
    const m = Game.match;
    const fresh = !this.lastSeen || this.lastSeen.f !== snap.f;

    // ---- stage ----
    Stage.platT = snap.st[0]; Stage.flashT = snap.st[1];
    if (snap.pf) snap.pf.forEach((p, i) => {
      const s = Stage.pfx[i]; if (!s) return;
      s.dx = p[0]; s.present = !!p[1]; s.heat = p[2];
      s.alpha = p[3]; s.stood = p[4]; s.gone = p[5];
    });
    Stage.rebuild();

    // ---- match ----
    const mt = snap.mt;
    m.countdown = mt[0]; m.timeLeft = mt[1];
    m.over = !!mt[2]; m.endTimer = mt[3];
    m.suddenDeath = !!mt[4]; m.frenzy = !!mt[5];
    m.winner = mt[6] >= 0 ? m.fighters.find(f => f.slot === mt[6]) || null : null;
    m.winTeam = mt[7] >= 0 ? mt[7] : null;
    m.endedBy = mt[8]; m.frames = mt[9];
    this.hostPause = mt[10] || 0;

    // ---- entities: rebuilt wholesale, they are only drawn here ----
    const bySlot = s => m.fighters.find(f => f.slot === s);
    /* Every snapshot is already half a round trip old when it lands, and over
       the relay the next one is up to 125 ms away. Other fighters are drawn
       projected forward from their snapshot by that age, using their own
       velocity and gravity, so they appear where they are now. When a new
       snapshot disagrees with the projection, the difference is eased out
       over a few frames instead of popping. */
    /* How stale the snapshot is. The best live measure is our own input
       stream: inputs sent minus inputs the host reports applied is the round
       trip in frames, refreshed every snapshot (the ping only updates once a
       second). Half of it is how far behind the snapshot already is. */
    const mine = snap.fs.find(x => x.s === this.slot);
    if (fresh && mine && mine.aq) {
      const rtt = clamp(this.seq - mine.aq, 0, 40);
      this.lagFrames = this.lagFrames == null ? rtt : lerp(this.lagFrames, rtt, 0.1);
    }
    const halfTrip = this.lagFrames != null ? this.lagFrames / 2 : (this.ping || 0) / 33.3;
    const age = clamp(halfTrip + (performance.now() - (this.snapAt || 0)) / 16.67, 0, NET.projectMax);
    this.ease = this.ease || {};
    Entities.list = (snap.en || []).map(e => ({
      kind: ENT_KINDS[e[0]], owner: bySlot(e[1]), x: e[2], y: e[3], r: e[4],
      life: e[5], dir: e[6], landed: !!e[7], storm: !!e[8], max: e[9], hitIds: [],
    })).filter(e => e.owner && e.kind);

    // ---- banners the host raised (a predicted special already showed its own) ----
    if (fresh && snap.ev) for (const [text, color] of snap.ev)
      if (!(FX.bannerText === text && FX.bannerTimer > 40)) FX.banner(text, color);

    // ---- fighters ----
    for (const fd of snap.fs) {
      const f = bySlot(fd.s);
      if (!f) continue;
      const before = this.lastSeen && this.lastSeen.fs[fd.s];
      if (fd.s === this.slot && this.predictOwn(f, fd, fresh, m)) {
        this.applyStats(f, fd);
        this.deltaFx(f, fd, before, fresh);
        continue;
      }
      if (fd.s === this.slot) this.predicting = false;
      f.px = f.x; f.py = f.y;                       // keep render interpolation
      const p = this.project(f, fd, age);
      const e = this.ease[fd.s] || (this.ease[fd.s] = { x: 0, y: 0, px: null, py: null, vx: 0, vy: 0 });
      if (fresh && e.px !== null) {
        /* Only the SURPRISE is eased: where the last projection would have
           carried the fighter this frame, versus where the new one puts it.
           Ordinary motion passes straight through, so easing adds no lag. */
        const jx = e.px + e.vx - p.x, jy = e.py + e.vy - p.y;
        if (Math.hypot(jx, jy) > 120) e.x = e.y = 0;      // a teleport or respawn: snap
        else { e.x += jx; e.y += jy; }
      }
      e.x *= 0.72; e.y *= 0.72;
      e.px = p.x; e.py = p.y; e.vx = fd.vx; e.vy = fd.vy;
      f.x = p.x + e.x; f.y = p.y + e.y;
      f.vx = fd.vx; f.vy = fd.vy;
      f.facing = fd.fa; f.state = fd.st; f.stateTimer = fd.tt;
      f.percent = fd.sp; f.stocks = fd.sk;
      f.shield = fd.sh; f.meter = fd.mr;
      f.hitstun = fd.hs; f.invuln = fd.iv;
      f.grounded = !!fd.gr; f.alive = !!fd.al;
      f.respawnTimer = fd.rt; f.hitFlash = fd.hf;
      f.specialCD = fd.cd; f.runPhase = fd.rp; f.animTime = fd.at;
      f.anchorGlow = fd.ag; f.pinned = !!fd.pn; f.isCPU = !!fd.cpu;
      this.applyStats(f, fd);
      this.findGround(f);
      this.applyAttack(f, fd);
      this.deltaFx(f, fd, before, fresh);
      if (f.hitstun > 0 || fd.ak === "super")
        f.trail.push({ x: f.x, y: f.y, facing: f.facing, life: 10 });
      for (let i = f.trail.length - 1; i >= 0; i--)
        if (--f.trail[i].life <= 0) f.trail.splice(i, 1);
    }

    // remember this frame so the next one can diff against it
    if (fresh) {
      this.lastSeen = { f: snap.f, fs: {} };
      for (const fd of snap.fs) this.lastSeen.fs[fd.s] = fd;
    }
  },

  applyStats(f, fd) {
    f.stats.kos = fd.sx[0]; f.stats.falls = fd.sx[1]; f.stats.damageDealt = fd.sx[2];
    f.stats.supers = fd.sx[3]; f.stats.bestHit = fd.sx[4];
  },
  /** The renderer, and the predicted physics, need the floor a grounded fighter is on. */
  findGround(f) {
    if (f.grounded) {
      let gs = null;
      for (const s of Stage.segs) { const y = Stage.surfaceY(s, f.x); if (y !== null && Math.abs(y - f.feetY) < 4) gs = s; }
      f.groundSeg = gs;
      if (!gs) f.grounded = false;
    } else f.groundSeg = null;
  },
  /** Rebuild enough of an attack to pose it, or to keep simulating it. */
  applyAttack(f, fd) {
    if (fd.ak) {
      const move = fd.ak === "grab" ? { startup: CFG.grabStartup, active: CFG.grabActive, r: 0 }
                 : f.ch[fd.ak];
      f.attack = { kind: fd.ak, data: move, t: fd.att, total: fd.ato,
                   hitIds: null, hitId: 0, lastHitFrame: fd.lh || -99 };
    } else f.attack = null;
  },

  /* ---------------------------------------------------------- prediction */
  /** Host-side states the guest cannot foresee: while any of these hold, the
      host's word is final and the guest simply shows it. */
  canPredict(fd, m) {
    if (m.countdown > 0 || m.over || !fd.al) return false;
    if (["hitstun", "grabbed", "grabbing", "dead", "respawn", "shieldbreak"].includes(fd.st)) return false;
    if (fd.ak === "super") return false;
    if (fd.ak === "special" && !this.ownSpecialSafe()) return false;
    return true;
  },
  /** Specials that only touch their user (and spawn things the host will
      send anyway) are safe to predict. Pivot's swap moves another fighter. */
  ownSpecialSafe() {
    const f = Game.match && Game.match.fighters.find(x => x.slot === this.slot);
    return !!f && SAFE_SPECIALS.includes(f.ch.id);
  },
  noPredictMask() { return this.ownSpecialSafe() ? SUPER_MASK : SUPER_MASK | SPECIAL_MASK; },

  /** Where a fighter is now, projected forward `frames` from its snapshot. */
  project(f, fd, frames) {
    const n = Math.round(frames);
    const moving = !fd.pn && fd.al && ["idle", "run", "air", "hitstun", "airdodge", "attack", "roll"].includes(fd.st);
    if (!n || !moving) return { x: fd.x, y: fd.y };
    const ch = f.ch;
    let x = fd.x, y = fd.y, vx = fd.vx, vy = fd.vy;
    const air = !fd.gr;
    for (let i = 0; i < n; i++) {
      if (air && fd.st !== "airdodge") {
        vy = Math.min(vy + CFG.gravity * ch.fallMul, CFG.maxFall * ch.fallMul * (fd.ff ? CFG.fastFallMul : 1));
        vx *= CFG.airDrag;
      }
      x += vx; y += vy;
    }
    if (air && vy >= 0) {
      // don't project anyone through the floor they are about to land on
      const floor = Stage.floorBelow(fd.x, fd.y + ch.size.h / 2);
      if (floor !== null && y + ch.size.h / 2 > floor) y = floor - ch.size.h / 2;
    } else if (!air) {
      // grounded: stay on this platform, at its height
      y = fd.y;
      let seg = null;
      for (const s of Stage.segs) { const sy = Stage.surfaceY(s, fd.x); if (sy !== null && Math.abs(sy - (fd.y + ch.size.h / 2)) < 4) seg = s; }
      if (seg) x = clamp(x, Math.min(seg.ax, seg.bx), Math.max(seg.ax, seg.bx));
    }
    return { x, y };
  },

  /** Returns true when it has taken care of this fighter for the frame. */
  predictOwn(f, fd, fresh, m) {
    if (!this.canPredict(fd, m)) return false;
    // a super (or an unsafe special) the guest just pressed is the host's to start
    if (f.attack && (f.attack.kind === "super" ||
        (f.attack.kind === "special" && !this.ownSpecialSafe()))) return false;

    /* The host is frozen in a hit-pause: it is applying no inputs, so neither
       does the prediction — the fighter holds where the host has it. */
    if (this.hostPause > 0) {
      if (fresh || !this.predicting) { f.px = f.x; f.py = f.y; this.loadOwn(f, fd); }
      this.predicting = true;
      return true;
    }

    if (fresh || !this.predicting) {
      const ack = fd.aq || 0;
      const pending = this.hist.filter(e => e[0] > ack && e[0] < this.seq);
      if (pending.length > NET.replayMax) return false;
      // rewind to what the host has, then catch up on what it has not seen
      this.loadOwn(f, fd);
      const at = this.hist.find(e => e[0] === ack);
      this.predictPad().cur = this.maskToCur(at ? at[1] : 0);
      this.silently(() => { for (const e of pending) this.stepOwn(f, e[1]); });
    }
    this.stepOwn(f, this.liveMask);                  // this frame, with sound and FX
    this.predictHits(f);
    this.predicting = true;
    return true;
  },

  /* The instant a predicted swing overlaps someone on this screen, show the
     impact — spark, ring, sound, shake. The host still decides whether it
     really hit and for how much; its confirmation then shows only the damage
     number, so a hit never plays twice. */
  predictHits(f) {
    const a = f.attack;
    if (!a || !f.hitboxActive() || a.kind === "grab") return;
    const hb = f.hitboxWorld();
    const now = performance.now();
    this.hitShownAt = this.hitShownAt || {};
    const again = a.data.hits > 1 ? 55 : 320;          // multi-hit moves re-hit
    for (const d of Game.match.fighters) {
      if (allies(d, f) || !d.alive || d.state === ST.DEAD) continue;
      if (now - (this.hitShownAt[d.slot] || 0) < again) continue;
      if (d.invuln > 0 || [ST.ROLL, ST.SPOTDODGE, ST.AIRDODGE, ST.RESPAWN].includes(d.state)) continue;
      if (dist(hb.x, hb.y, d.x, d.y) > hb.r + d.ch.hurt) continue;
      this.hitShownAt[d.slot] = now;
      const dmg = a.data.dmg || 4;
      if (d.state === ST.SHIELD) {
        Snd.shield();
        FX.ring(d.x, d.y, 10, d.ch.hurt * 2.2, "#7fd9ff", 2);
        continue;
      }
      FX.hitmark(hb.x, hb.y, dmg);
      FX.burst(hb.x, hb.y, Math.round(6 + dmg * 1.1), f.ch.color, 3 + dmg * 0.35);
      FX.ring(hb.x, hb.y, 6, 30 + dmg * 5, "#ffffff", 2);
      FX.shake(3 + dmg * 0.6);
      Snd.hit(dmg);
      if (dmg >= 13) Snd.bigHit();
    }
  },

  loadOwn(f, fd) {
    f.x = fd.x; f.y = fd.y; f.vx = fd.vx; f.vy = fd.vy;
    f.facing = fd.fa; f.state = fd.st; f.stateTimer = fd.tt;
    f.percent = fd.sp; f.stocks = fd.sk;
    f.shield = fd.sh; f.meter = fd.mr;
    f.hitstun = fd.hs; f.invuln = fd.iv;
    f.grounded = !!fd.gr; f.alive = !!fd.al;
    f.respawnTimer = fd.rt; f.hitFlash = fd.hf;
    f.specialCD = fd.cd; f.anchorGlow = fd.ag; f.pinned = !!fd.pn;
    f.airJumps = fd.aj; f.fastFalling = !!fd.ff; f.dropThrough = fd.dt || 0;
    f.squatHeld = !!fd.sq; f.rollDir = fd.rd || 0;
    this.findGround(f);
    this.applyAttack(f, fd);
  },

  predictPad() { return this._ppad || (this._ppad = new NetPad(this.slot)); },
  maskToCur(mask) {
    const cur = {};
    BUTTONS.forEach((b, i) => { cur[b] = !!(mask & (1 << i)); });
    return cur;
  },

  /** One frame of the guest's own fighter. Supers (and Pivot's swap) are
      left out: they reach into other fighters, and only the host can play
      them. KOs are the host's call. Anything a predicted special would spawn
      (an orb, a cube, an updraft) is left to the host too — it arrives in
      the next snapshot — so nothing appears twice. */
  stepOwn(f, mask) {
    const pad = this.predictPad();
    pad.queue = null;
    pad.setMask(mask & ~this.noPredictMask());
    f.pad = pad;
    f.checkBlastZones = noop_;
    const spawns = ["orb", "shockwave", "well", "ballast", "updraft"].map(k => [k, Entities[k]]);
    for (const [k] of spawns) Entities[k] = noop_;
    try { f.update(Game.match); }
    finally {
      delete f.checkBlastZones;
      for (const [k, fn] of spawns) Entities[k] = fn;
    }
  },

  /** Run fn with every sound and effect muted: replayed frames already
      played their sounds when they were first predicted. */
  silently(fn) {
    const saved = [];
    for (const o of [FX, Snd]) for (const k of Object.keys(o)) {
      const d = Object.getOwnPropertyDescriptor(o, k);
      if (d && typeof d.value === "function") { saved.push([o, k, d.value]); o[k] = noop_; }
    }
    try { fn(); } finally { for (const [o, k, v] of saved) o[k] = v; }
  },

  deltaFx(f, fd, before, fresh) {
      /* ---- effects from deltas ---- */
      if (before && fresh) {
        const dmg = f.percent - before.sp;
        const shown = this.hitShownAt && performance.now() - (this.hitShownAt[f.slot] || 0) < 600;
        if (dmg > 0.4 && shown) {
          // the impact already played when the swing landed on this screen
          FX.damageText(f.x, f.y - 24, dmg, f.ch.accent);
        } else if (dmg > 0.4) {
          FX.hitmark(f.x, f.y, dmg);
          FX.burst(f.x, f.y, Math.round(6 + dmg * 1.1), f.ch.color, 3 + dmg * 0.35);
          FX.damageText(f.x, f.y - 24, dmg, f.ch.accent);
          FX.shake(3 + dmg * 0.6);
          Snd.hit(dmg);
          if (dmg >= 13) Snd.bigHit();
        }
        if (f.stocks < before.sk) {
          FX.burst(f.x, f.y, 26, f.tint, 9);
          FX.flash("#ffffff", 0.25);
          Snd.ko();
        }
        if (fd.ak === "super" && before.ak !== "super") Snd.superCharge();
      }
  },
};

function noop_() {}
/* Buttons the guest may hold back from its prediction (see stepOwn). */
const SUPER_MASK = 1 << BUTTONS.indexOf("super");
const SPECIAL_MASK = 1 << BUTTONS.indexOf("special");
/* Fighters whose special only moves themselves (spawned entities come from
   the host's snapshot), so a guest can predict it like any other move. */
const SAFE_SPECIALS = ["BOLDER", "ZIP", "ORBIT", "BALLAST", "KITE", "HUSK", "MIRA"];
