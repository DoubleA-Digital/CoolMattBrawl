/* ==========================================================================
   12a. RTC — peer-to-peer links, introduced through Supabase, with a relay

   Online play used to lean on PeerJS's free public broker (0.peerjs.com) to
   introduce players to each other. When that broker went down, every room
   failed on the spot. This file replaces it with the browser's own
   RTCPeerConnection, and uses a Supabase Realtime broadcast channel (the same
   project Mini Golf uses) for the handshake: hello, offer, answer, ICE.

   DIRECT FIRST, RELAY IF IT MUST
   A direct link is fastest, but two separate computers often cannot make one:
   home routers, school Wi-Fi and firewalls block it, and there is no free
   public TURN server left to bounce through. So if the direct link has not
   opened within p2pTimeout, that one player is moved onto a RELAY: a private
   Supabase channel between them and the host. Supabase bills every relayed
   message twice (once sent, once received) against a 100/second quota, so the
   relay runs on a budget: the whole room spends about relayBudget billed
   messages a second, split between however many players are relayed. A lone
   relayed guest (the usual case: two friends on two computers) gets around
   20 snapshots a second; three share it. Inside that budget the relay spends
   messages where they matter: an input goes the moment a button changes, a
   snapshot goes the moment someone is hit, and idle traffic waits.
   Direct players still get every frame, unless their link is backing up, in
   which case snapshots are skipped rather than queued (a queue is lag).

   RtcPeer / RtcConn deliberately mirror the slice of the PeerJS API that Net
   uses — on("open" | "connection" | "error"), connect(), send(), close(),
   destroy() — so the netcode above it did not have to change shape.
   ========================================================================== */

const RTC = {
  lib: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js",
  url: "https://esogrnjilzxcmvgpieib.supabase.co",
  // publishable key: safe to ship, and broadcast channels touch no tables
  key: "sb_publishable__QUefxDt7tRi9Y943QK7yw_ivbRt71u",
  channel: "cmbrawl-room-",
  relayChannel: "cmbrawl-relay-",
  ice: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302",
             "stun:stun2.l.google.com:19302"] },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
  helloEvery: 1500,       // a guest repeats its hello until the host answers
  findTimeout: 8000,      // no host answered at all: wrong code
  p2pTimeout: 6000,       // host answered but no direct link yet: use the relay
  relayTimeout: 12000,    // even the relay never came up
  serverTimeout: 10000,   // the matchmaking channel itself never came up
  /* Relay budget. Supabase's free plan allows 100 realtime messages a
     second across the whole project, and bills a broadcast twice (sent and
     received), so a room keeps itself to relayBudget billed messages a second
     and leaves headroom for other rooms and games. */
  relayBudget: 76,
  relaySnapShare: 0.62,   // of a lone relayed player's share, how much goes to snapshots
  relaySnapShareMany: 0.42, // ...and when several share it: late inputs hurt more than sparse snapshots
  relayBurst: 3,          // messages that can be saved up for a flurry
  relayMinGap: 30,        // ms: even a burst is spaced at least this far
  relayRoomEvery: 500,    // lobby updates (every 2 seconds during a match)
  relayIdleEvery: 300,    // an unchanged input is still re-sent this often
  relayHistory: 30,       // inputs carried in each relayed input message
  directBacklog: 48000,   // bytes queued on a direct link before snapshots are skipped
  forceRelay: false,      // testing: skip the direct attempt entirely
};

let _supa = null;
function rtcClient() {
  if (!_supa) _supa = window.supabase.createClient(RTC.url, RTC.key, {
    realtime: { params: { eventsPerSecond: 60 } },   // ICE comes in bursts
  });
  return _supa;
}

/** Subscribe to a broadcast channel; resolves once it is live. */
function rtcSubscribe(name, opts, onMsg) {
  return new Promise((res, rej) => {
    const ch = rtcClient().channel(name, { config: Object.assign({ broadcast: { self: false } }, opts || {}) });
    ch.on("broadcast", { event: "m" }, m => onMsg(m.payload || {}));
    let settled = false;
    setTimeout(() => {
      if (!settled) { settled = true; rej(new Error("couldn't reach the matchmaking server — check your internet, or try a hotspot")); }
    }, RTC.serverTimeout);
    ch.subscribe(st => {
      if (settled) return;
      if (st === "SUBSCRIBED") { settled = true; res(ch); }
      else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") {
        settled = true; rej(new Error("couldn't reach the matchmaking server"));
      }
    });
  });
}
function rtcDrop(ch) { if (ch) { try { rtcClient().removeChannel(ch); } catch (e) {} } }

class Emitter {
  constructor() { this._h = {}; }
  on(e, f) { (this._h[e] = this._h[e] || []).push(f); return this; }
  emit(e, ...a) { (this._h[e] || []).slice().forEach(f => { try { f(...a); } catch (err) { console.error(err); } }); }
}

/** One link to one other player: direct if possible, relayed if not. */
class RtcConn extends Emitter {
  constructor(peer, remoteId, guestId) {
    super();
    this.peer = peer; this.remoteId = remoteId;
    this.guestId = guestId;          // names the private relay channel
    this.open = false; this.done = false;
    this.relay = false; this.relayCh = null;
    this.dc = null; this.pendingIce = [];
    this.pace = {};                  // relay throttling state, per message kind
    this.pc = new RTCPeerConnection({ iceServers: RTC.ice });
    this.pc.onicecandidate = e => {
      if (e.candidate) peer.signal({ t: "ice", to: remoteId, c: e.candidate.toJSON() });
    };
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      if (s !== "failed" && s !== "closed") return;
      // a direct attempt failing before it ever opened is what the relay is for
      if (!this.open && !this.relay) { if (!peer.isHost) peer.useRelay(this); return; }
      if (!this.relay) this.closed();
    };
    this.pc.ondatachannel = e => this.attach(e.channel);
  }
  attach(dc) {
    this.dc = dc;
    dc.onopen = () => {
      if (this.done || this.relay) { try { dc.close(); } catch (e) {} return; }
      this.markOpen("direct");
    };
    dc.onmessage = m => { let d; try { d = JSON.parse(m.data); } catch (e) { return; } this.emit("data", d); };
    dc.onclose = () => { if (!this.relay) this.closed(); };
  }
  markOpen(how) {
    if (this.open || this.done) return;
    this.open = true; this.via = how;
    this.emit("open");
  }
  async addIce(c) {
    if (this.relay) return;
    if (!this.pc.remoteDescription) { this.pendingIce.push(c); return; }
    try { await this.pc.addIceCandidate(c); } catch (e) { /* stale candidate */ }
  }
  async flushIce() {
    const q = this.pendingIce; this.pendingIce = [];
    for (const c of q) { try { await this.pc.addIceCandidate(c); } catch (e) {} }
  }

  /* ----------------------------------------------------------- relay */
  async startRelay() {
    if (this.relay || this.done) return;
    this.relay = true;
    try { if (this.dc) this.dc.close(); } catch (e) {}
    try { this.pc.close(); } catch (e) {}
    try {
      this.relayCh = await rtcSubscribe(RTC.relayChannel + this.peer.room + "-" + this.guestId, null, d => {
        if (d.from === this.peer.id) return;
        if (d.hi) { this.markOpen("relay"); if (d.hi === 1) this.relayRaw({ hi: 2 }); return; }
        this.markOpen("relay");
        this.emit("data", d.d);
      });
    } catch (e) { this.closed(); return; }
    // knock until the other side answers; whoever arrives second gets the reply
    const knock = () => {
      if (this.open || this.done) return;
      this.relayRaw({ hi: 1 });
      setTimeout(knock, 400);
    };
    knock();
  }
  relayRaw(payload) {
    if (!this.relayCh || this.done) return;
    this.relayCh.send({ type: "broadcast", event: "m", payload: Object.assign({ from: this.peer.id }, payload) });
  }
  /** How many messages a second this link may send of one kind. The host
      knows how many of its guests are relayed; a guest is told in the room. */
  relayRate(kind) {
    const n = Math.max(1, this.peer.isHost
      ? [...this.peer.conns.values()].filter(c => c.relay && c.open).length
      : (this.relayPeers || 1));
    const each = RTC.relayBudget / 2 / n;                // a broadcast is billed twice
    const share = n === 1 ? RTC.relaySnapShare : RTC.relaySnapShareMany;
    return kind === "s" ? each * share : each * (1 - share);
  }
  /** A token bucket per kind: refills at rate/s, holds up to relayBurst. */
  relayTake(kind, now) {
    const b = this.pace[kind] || (this.pace[kind] = { tokens: RTC.relayBurst, at: now, last: 0 });
    b.tokens = Math.min(RTC.relayBurst, b.tokens + (now - b.at) / 1000 * this.relayRate(kind));
    b.at = now;
    return b;
  }
  /** Relay sends are budgeted so a match stays inside Supabase's message
      quota, and spent on what the players would notice first. */
  relaySend(obj) {
    const now = performance.now();
    if (obj.t === "s") {
      // on a schedule, or right away when a hit landed (obj.u)
      const b = this.relayTake("s", now), gap = now - b.last;
      if (obj.u) b.urgent = true;          // held until a snapshot actually goes
      const due = gap >= 1000 / this.relayRate("s") || (b.urgent && gap >= RTC.relayMinGap);
      if (!due || b.tokens < 1) return;
      b.tokens--; b.last = now; b.urgent = false;
    } else if (obj.t === "room") {
      const every = Game.screen === "match" ? 2000 : RTC.relayRoomEvery;
      if (now - (this.pace.room || 0) < every) return;
      this.pace.room = now;
    } else if (obj.t === "in" && obj.h) {
      /* Every input message carries the last relayHistory frames, so no press
         is lost however the sends below are spaced. A change goes at once;
         an unchanged input is only re-sent now and then, so the host's ack
         keeps moving. If the budget runs dry the window still forces a send
         before any frame could fall out of it. */
      const b = this.relayTake("in", now), p = this.pace;
      const fresh = obj.s - (p.inSeq || 0);
      const recent = fresh > 0 ? obj.h.slice(-Math.min(fresh, obj.h.length)) : [];
      const dirty = recent.some(k => k !== p.inK);
      const gap = now - b.last;
      const must = fresh >= obj.h.length - 4;
      const go = must || (b.tokens >= 1 && (dirty ? gap >= RTC.relayMinGap : gap >= RTC.relayIdleEvery));
      if (!go) return;
      b.tokens = Math.max(-1, b.tokens - 1); b.last = now;
      p.inSeq = obj.s; p.inK = obj.h[obj.h.length - 1];
    } else if (obj.t === "ping" || obj.t === "pong") {
      // pings are a luxury on the relay: one every few seconds is plenty
      if (obj.t === "ping") {
        if (now - (this.pace.ping || 0) < 3000) return;
        this.pace.ping = now;
      }
    }
    this.relayRaw({ d: obj });
  }

  send(obj) {
    if (this.relay) { if (this.open) this.relaySend(obj); return; }
    if (!this.dc || this.dc.readyState !== "open") return;
    /* A slow link fills the send buffer, and everything queued behind it
       arrives later and later. Snapshots are replaced by the next one every
       frame anyway, so while the link is backed up they are simply dropped. */
    if (obj.t === "s" && this.dc.bufferedAmount > RTC.directBacklog) return;
    this.dc.send(JSON.stringify(obj));
  }
  close() {
    try { if (this.dc) this.dc.close(); } catch (e) {}
    try { this.pc.close(); } catch (e) {}
    rtcDrop(this.relayCh); this.relayCh = null;
    this.closed();
  }
  closed() {
    if (this.done) return;
    this.done = true; this.open = false;
    rtcDrop(this.relayCh); this.relayCh = null;
    this.peer.forget(this);
    this.emit("close");
  }
}

/** This browser's presence in a room: the host's, or a guest's. */
class RtcPeer extends Emitter {
  /** roomCode given: host that room. Omitted: a guest, who then connect()s. */
  constructor(roomCode) {
    super();
    this.id = roomCode ? "host" : "g" + Math.random().toString(36).slice(2, 10);
    this.isHost = !!roomCode;
    this.room = roomCode || "";
    this.conns = new Map();     // remoteId -> RtcConn
    this.ch = null;
    this.destroyed = false;
    if (this.isHost) this.joinRoom(roomCode).then(() => this.claimRoom()).catch(e => this.fail("network", e));
    else setTimeout(() => this.emit("open", this.id), 0);
  }

  fail(type, e) {
    if (this.destroyed) return;
    this.emit("error", { type, message: (e && e.message) || String(e || type) });
  }

  async joinRoom(code) {
    this.room = code;
    this.ch = await rtcSubscribe(RTC.channel + code, { presence: { key: this.id } },
                                 d => this.onSignal(d));
  }

  /* Codes are random from ~1M, but two hosts on one code would split the
     room, so a host checks nobody else is already hosting it. */
  async claimRoom() {
    const at = Date.now() + Math.random();
    await this.ch.track({ role: "host", at });
    await new Promise(r => setTimeout(r, 600));
    // every host tracks under the key "host"; the earliest one keeps the room
    const hosts = this.ch.presenceState().host || [];
    if (hosts.some(h => h.at < at)) return this.fail("unavailable-id", "that room code is taken");
    this.emit("open", this.id);
  }

  signal(payload) {
    if (!this.ch || this.destroyed) return;
    this.ch.send({ type: "broadcast", event: "m", payload: Object.assign({ from: this.id }, payload) });
  }

  forget(conn) { if (this.conns.get(conn.remoteId) === conn) this.conns.delete(conn.remoteId); }

  /** Guest: give up on the direct link and move onto the relay. */
  useRelay(c) {
    if (c.relay || c.open || c.done) return;
    this.signal({ t: "relay", to: "host" });
    c.startRelay();
  }

  async onSignal(d) {
    if (this.destroyed || (d.to && d.to !== this.id) || !d.from) return;
    let c = this.conns.get(d.from);

    if (this.isHost && d.t === "hello") {
      if (c && !c.done) return;                            // a repeated hello
      c = new RtcConn(this, d.from, d.from);
      this.conns.set(d.from, c);
      // unordered and unretransmitted: the netcode resends whatever matters
      c.attach(c.pc.createDataChannel("game", { ordered: false, maxRetransmits: 0 }));
      this.emit("connection", c);
      if (d.relay) { c.startRelay(); return; }
      const offer = await c.pc.createOffer();
      await c.pc.setLocalDescription(offer);
      this.signal({ t: "offer", to: d.from, sdp: c.pc.localDescription.toJSON() });
      return;
    }
    if (!c) return;
    if (d.t === "relay" && this.isHost) { c.startRelay(); return; }
    if (c.relay) return;
    try {
      if (d.t === "offer" && !this.isHost) {
        this.emit("found");
        await c.pc.setRemoteDescription(d.sdp);
        await c.flushIce();
        const ans = await c.pc.createAnswer();
        await c.pc.setLocalDescription(ans);
        this.signal({ t: "answer", to: d.from, sdp: c.pc.localDescription.toJSON() });
      } else if (d.t === "answer" && this.isHost) {
        await c.pc.setRemoteDescription(d.sdp);
        await c.flushIce();
      } else if (d.t === "ice") {
        c.addIce(d.c);
      }
    } catch (e) {
      // a broken negotiation is just another reason to relay
      if (!this.isHost) this.useRelay(c);
    }
  }

  /** Guest: find the host of roomCode and link to it. */
  connect(roomCode) {
    const c = new RtcConn(this, "host", this.id);
    this.conns.set("host", c);
    this.joinRoom(roomCode).then(() => {
      let found = false, tries = 0;
      const hello = () => {
        if (this.destroyed || c.open || c.done || found) return;
        if (++tries * RTC.helloEvery > RTC.findTimeout) return this.fail("peer-unavailable", "no game found with that code");
        this.signal({ t: "hello", to: "host", relay: RTC.forceRelay || undefined });
        setTimeout(hello, RTC.helloEvery);
      };
      this.on("found", () => {
        found = true;
        // the host answered: give the direct link a fair chance, then relay
        setTimeout(() => this.useRelay(c), RTC.p2pTimeout);
      });
      if (RTC.forceRelay) {
        // the host relays as soon as it sees the hello; mark found once it does
        c.on("open", () => { found = true; });
        c.startRelay();
      }
      hello();
      setTimeout(() => {
        if (!c.open && !c.done) {
          c.close();
          this.fail("p2p", "found the game but couldn't connect — check both of you are online, then try again");
        }
      }, RTC.p2pTimeout + RTC.relayTimeout);
      // once linked, the introduction channel is no longer needed
      c.on("open", () => { rtcDrop(this.ch); this.ch = null; });
    }).catch(e => this.fail("network", e));
    return c;
  }

  destroy() {
    this.destroyed = true;
    for (const c of [...this.conns.values()]) c.close();
    rtcDrop(this.ch); this.ch = null;
  }
}
