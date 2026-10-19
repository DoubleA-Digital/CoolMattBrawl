/* ==========================================================================
   12b. NET — online play over WebRTC (PeerJS), host-authoritative

   WHY THIS SHAPE
   The obvious choice for a fighting game is lockstep: both machines run the
   same simulation and only inputs cross the wire. This simulation is not safe
   to run that way. Stage.toWorld calls Math.cos/Math.sin every frame, and the
   spec does not require those to be bit-identical between JS engines, so two
   browsers would drift apart and the fight would silently diverge. Instead:

     host   runs the only real simulation and ships a state snapshot per frame
     guest  runs no simulation at all; it applies snapshots and renders them

   That costs the guest one round trip of view latency but it cannot desync,
   which is the right trade for a game played between friends.

   INPUT FAIRNESS
   A naive host-authoritative build gives the host zero input delay and the
   guest a full round trip, which is a real competitive advantage. The host
   therefore delays its OWN input by netDelay frames so both players act on
   roughly the same deadline.

   EFFECTS
   FX are not transmitted. The guest derives them from snapshot deltas — a
   percent that went up is a hit, a stock that went down is a KO, a snapCount
   that advanced is a Snap-Back. That keeps the protocol small and means a
   dropped packet costs a particle burst, never desync.
   ========================================================================== */

const NET = {
  lib: "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js",
  prefix: "cmbrawl-",     // namespaces our room codes on the public broker
  netDelay: 3,            // frames the host delays its own input by
  snapshotEvery: 1,       // send a snapshot every N simulated frames
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
    this.hasGamepad = false;
  }
  setMask(m) { this.mask = m | 0; }
  poll() {
    this.prev = Object.assign({}, this.cur);
    BUTTONS.forEach((b, i) => { this.cur[b] = !!(this.mask & (1 << i)); });
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

const Net = {
  mode: "off",            // off | hosting | joining | connected | error
  role: null,             // "host" | "guest"
  code: "",
  peer: null, conn: null,
  status: "",
  error: "",
  ping: 0, lastPingAt: 0,
  guestPick: null,        // character the guest chose
  hostReady: false,
  frame: 0,
  /* host: its own input, delayed so the guest is not at a disadvantage */
  delayBuf: [],
  /* guest: the two most recent snapshots, for render interpolation */
  snapPrev: null, snapCur: null,
  /* guest: what the last snapshot said, so deltas can become effects */
  lastSeen: null,
  pendingStart: null,
  libLoaded: false,

  get active() { return this.mode === "connected"; },
  get isHost() { return this.role === "host"; },
  get isGuest() { return this.role === "guest"; },

  /* ---------------------------------------------------------- lifecycle */
  loadLib() {
    if (this.libLoaded) return Promise.resolve();
    if (window.Peer) { this.libLoaded = true; return Promise.resolve(); }
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = NET.lib;
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
    try { if (this.conn) this.conn.close(); } catch (e) {}
    try { if (this.peer) this.peer.destroy(); } catch (e) {}
    this.peer = null; this.conn = null;
    this.mode = "off"; this.role = null; this.code = "";
    this.status = ""; this.error = "";
    this.guestPick = null; this.hostReady = false;
    this.frame = 0; this.delayBuf = [];
    this.snapPrev = this.snapCur = this.lastSeen = null;
    this.pendingStart = null;
  },

  fail(msg) {
    this.error = String(msg || "connection failed");
    this.mode = "error";
    this.status = "";
  },

  host() {
    this.reset();
    this.role = "host"; this.mode = "hosting";
    this.code = this.newCode();
    this.status = "starting up...";
    this.loadLib().then(() => {
      this.peer = new window.Peer(NET.prefix + this.code);
      this.peer.on("open", () => { this.status = "waiting for a player to join"; });
      this.peer.on("error", e => this.fail(
        (e && e.type === "unavailable-id") ? "that room code is taken — try again"
                                           : (e && e.message) || "connection error"));
      this.peer.on("connection", c => {
        if (this.conn) { try { c.close(); } catch (e) {} return; }  // one guest only
        this.conn = c;
        c.on("open", () => {
          this.mode = "connected";
          this.status = "player connected";
          Snd.uiBig();
        });
        c.on("data", d => this.onData(d));
        c.on("close", () => this.onPeerGone());
        c.on("error", () => this.onPeerGone());
      });
    }).catch(e => this.fail(e.message));
  },

  join(code) {
    this.reset();
    this.role = "guest"; this.mode = "joining";
    this.code = (code || "").toUpperCase();
    this.status = "connecting to " + this.code + "...";
    this.loadLib().then(() => {
      this.peer = new window.Peer();
      this.peer.on("error", e => this.fail(
        (e && e.type === "peer-unavailable") ? "no game found with that code"
                                             : (e && e.message) || "connection error"));
      this.peer.on("open", () => {
        const c = this.peer.connect(NET.prefix + this.code, { reliable: false });
        this.conn = c;
        c.on("open", () => {
          this.mode = "connected";
          this.status = "connected — waiting for the host";
          Snd.uiBig();
          this.send({ t: "pick", charId: Game.slots[0].charId });
        });
        c.on("data", d => this.onData(d));
        c.on("close", () => this.onPeerGone());
        c.on("error", () => this.onPeerGone());
      });
    }).catch(e => this.fail(e.message));
  },

  onPeerGone() {
    if (this.mode === "off") return;
    const wasPlaying = Game.screen === "match" || Game.screen === "pause";
    this.fail("the other player disconnected");
    if (wasPlaying) {
      Game.match = null;
      Game.screen = "online";
    }
  },

  send(obj) {
    if (!this.conn) return;
    try { this.conn.send(obj); } catch (e) { /* a dropped frame is survivable */ }
  },

  /* ------------------------------------------------------------ messages */
  onData(d) {
    if (!d || typeof d !== "object") return;
    switch (d.t) {
      case "pick":
        // guest told us which fighter it wants
        if (this.isHost && typeof d.charId === "string" && CHAR_BY_ID[d.charId])
          this.guestPick = d.charId;
        break;
      case "start":
        // host is starting the match; mirror its setup exactly
        if (this.isGuest) this.pendingStart = d;
        break;
      case "in":
        // guest input for the host to apply
        if (this.isHost && this.guestPad) this.guestPad.setMask(d.k);
        break;
      case "s":
        if (this.isGuest) {
          this.snapPrev = this.snapCur;
          this.snapCur = d;
        }
        break;
      case "end":
        if (this.isGuest && Game.match) {
          Game.toResults(Game.match);
          Game.screen = "results";
        }
        break;
      case "ping": this.send({ t: "pong", ts: d.ts }); break;
      case "pong": this.ping = Math.round(performance.now() - d.ts); break;
    }
  },

  measurePing() {
    const now = performance.now();
    if (now - this.lastPingAt < 1000) return;
    this.lastPingAt = now;
    this.send({ t: "ping", ts: now });
  },

  /* --------------------------------------------------------- match setup */
  /** Host: announce and start. Both sides build the same Match. */
  startMatch() {
    const payload = {
      t: "start",
      slots: Game.slots.map(s => ({ charId: s.charId, mode: s.mode })),
      stageIndex: Game.stageIndex,
    };
    this.send(payload);
    this.frame = 0;
    this.delayBuf = [];
    this.beginLocal(payload);
  },

  /** Both roles: construct the match described by a start payload. */
  beginLocal(payload) {
    Game.slots = payload.slots.map(s => ({ charId: s.charId, mode: s.mode }));
    Game.stageIndex = payload.stageIndex;
    Game.match = new Match(Game.slots, STAGES[Game.stageIndex]);
    Game.screen = "match";
    this.snapPrev = this.snapCur = this.lastSeen = null;

    /* Slot 0 is the host's fighter, slot 1 is the guest's. Whichever one is
       not ours is driven by the wire rather than by a keyboard. */
    const remoteSlot = this.isHost ? 1 : 0;
    for (const f of Game.match.fighters) {
      if (f.slot === remoteSlot && !f.isCPU) {
        f.pad = new NetPad(f.slot);
        if (this.isHost) this.guestPad = f.pad;
      }
    }
    if (this.isGuest) {
      // the guest simulates nothing, so its music/FX start but its sim never runs
      this.localSlot = 1;
    } else {
      this.localSlot = 0;
    }
  },

  /* ----------------------------------------------------------- per frame */
  /** Called from Game.update() instead of match.update() when online. */
  update() {
    if (!this.active || !Game.match) return false;
    this.measurePing();

    if (this.isHost) {
      /* Delay our own input by netDelay frames so the guest, whose input
         needs a round trip to arrive, is not systematically late. */
      const me = Game.match.fighters.find(f => f.slot === 0 && !f.isCPU);
      if (me) {
        const live = new Pad(0); live.poll();
        this.delayBuf.push(maskFromPad(live));
        while (this.delayBuf.length > NET.netDelay) {
          const m = this.delayBuf.shift();
          if (!(me.pad instanceof NetPad)) { me.pad = new NetPad(0); }
          me.pad.setMask(m);
        }
      }
      Game.match.update();
      this.frame++;
      if (this.frame % NET.snapshotEvery === 0) this.send(this.snapshot());
      if (Game.match.over && Game.match.endTimer <= 1) this.send({ t: "end" });
      return true;
    }

    // guest: no simulation at all, just present what the host sent
    const pad = new Pad(0); pad.poll();
    this.send({ t: "in", k: maskFromPad(pad) });
    this.applySnapshot();
    FX.update(Game.match.fighters);
    return true;
  },

  /* -------------------------------------------------------- the protocol */
  snapshot() {
    const m = Game.match;
    const r2 = v => Math.round(v * 100) / 100;
    return {
      t: "s",
      f: this.frame,
      // stage
      st: [r2(Stage.tilt), r2(Stage.angVel), Stage.anchorTimer,
           Stage.snapFlash, Stage.snapCount, Stage.platT],
      // live platform state, only the fields that can change
      pf: Stage.pfx.map(s => [r2(s.dx), s.present ? 1 : 0, r2(s.heat),
                              r2(s.alpha), s.stood, s.gone]),
      // match
      mt: [m.countdown, m.timeLeft, m.over ? 1 : 0, m.endTimer],
      // fighters
      fs: m.fighters.map(f => ({
        s: f.slot,
        x: r2(f.x), y: r2(f.y), vx: r2(f.vx), vy: r2(f.vy),
        fa: f.facing, st: f.state, sp: f.percent, sk: f.stocks,
        sh: r2(f.shield), mr: r2(f.meter), hs: f.hitstun, iv: f.invuln,
        gr: f.grounded ? 1 : 0, al: f.alive ? 1 : 0, rt: f.respawnTimer,
        hf: f.hitFlash, cd: f.specialCD, rp: r2(f.runPhase), at: f.animTime,
        ak: f.attack ? f.attack.kind : null,
        an: f.attack ? f.attack.data.name : null,
        att: f.attack ? f.attack.t : 0,
        ato: f.attack ? f.attack.total : 0,
      })),
    };
  },

  /** Guest: write the newest snapshot onto the local objects, then turn any
      meaningful change since the previous one into effects. */
  applySnapshot() {
    const snap = this.snapCur;
    if (!snap || !Game.match) return;
    const m = Game.match;

    // ---- stage ----
    Stage.prevTilt = Stage.tilt;
    Stage.tilt = snap.st[0]; Stage.angVel = snap.st[1];
    Stage.anchorTimer = snap.st[2]; Stage.snapFlash = snap.st[3];
    const prevSnaps = Stage.snapCount;
    Stage.snapCount = snap.st[4]; Stage.platT = snap.st[5];
    if (snap.pf) snap.pf.forEach((p, i) => {
      const s = Stage.pfx[i]; if (!s) return;
      s.dx = p[0]; s.present = !!p[1]; s.heat = p[2];
      s.alpha = p[3]; s.stood = p[4]; s.gone = p[5];
    });
    Stage.rebuild();

    // ---- match ----
    m.countdown = snap.mt[0]; m.timeLeft = snap.mt[1];
    m.over = !!snap.mt[2]; m.endTimer = snap.mt[3];

    // ---- fighters ----
    for (const fd of snap.fs) {
      const f = m.fighters.find(x => x.slot === fd.s);
      if (!f) continue;
      const before = this.lastSeen && this.lastSeen[fd.s];
      f.px = f.x; f.py = f.y;                       // keep render interpolation
      f.x = fd.x; f.y = fd.y; f.vx = fd.vx; f.vy = fd.vy;
      f.facing = fd.fa; f.state = fd.st;
      f.percent = fd.sp; f.stocks = fd.sk;
      f.shield = fd.sh; f.meter = fd.mr;
      f.hitstun = fd.hs; f.invuln = fd.iv;
      f.grounded = !!fd.gr; f.alive = !!fd.al;
      f.respawnTimer = fd.rt; f.hitFlash = fd.hf;
      f.specialCD = fd.cd; f.runPhase = fd.rp; f.animTime = fd.at;

      // rebuild just enough of the attack for the renderer to pose correctly
      if (fd.ak) {
        const move = fd.ak === "light" ? f.ch.light : fd.ak === "heavy" ? f.ch.heavy
                   : fd.ak === "special" ? f.ch.special : f.ch.super;
        f.attack = { kind: fd.ak, data: move, t: fd.att, total: fd.ato,
                     hitIds: null, hitId: 0 };
      } else f.attack = null;

      /* ---- effects from deltas ---- */
      if (before) {
        const dmg = f.percent - before.sp;
        if (dmg > 0.4) {
          FX.hitmark(f.x, f.y, dmg);
          FX.burst(f.x, f.y, Math.round(6 + dmg * 1.1), f.ch.color, 3 + dmg * 0.35);
          FX.damageText(f.x, f.y - 24, dmg, f.ch.accent);
          FX.shake(3 + dmg * 0.6);
          Snd.hit(dmg);
        }
        if (f.stocks < before.sk) {
          FX.banner(f.stocks > 0 ? "KO!" : `${f.ch.name} OUT!`, f.tint);
          FX.burst(f.x, f.y, 26, f.tint, 9);
          FX.flash("#ffffff", 0.25);
          Snd.ko();
        }
        if (fd.ak === "super" && before.ak !== "super") {
          FX.banner(f.ch.super.name.toUpperCase(), f.ch.color);
          Snd.superCharge();
        }
      }
      if (f.hitstun > 0 || fd.ak === "super")
        f.trail.push({ x: f.x, y: f.y, facing: f.facing, life: 10 });
      for (let i = f.trail.length - 1; i >= 0; i--)
        if (--f.trail[i].life <= 0) f.trail.splice(i, 1);
    }

    if (Stage.snapCount > prevSnaps) {
      FX.banner("SNAP-BACK!", "#ffffff");
      FX.ring(Stage.pivot.x, Stage.pivot.y, 60, 560, "#ffffff", 5);
      FX.shake(26); FX.flash("#ffffff", 0.25);
      Snd.snapback();
    }

    // remember this frame so the next one can diff against it
    this.lastSeen = {};
    for (const fd of snap.fs) this.lastSeen[fd.s] = fd;
  },
};
