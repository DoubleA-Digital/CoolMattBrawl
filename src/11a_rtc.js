/* ==========================================================================
   12a. RTC — direct peer-to-peer connections, introduced through Supabase

   Online play used to lean on PeerJS's free public broker (0.peerjs.com) to
   introduce players to each other. When that broker went down, every room
   failed on the spot with "Lost connection to server." — the game itself was
   fine, it just had nobody to make the introduction.

   This replaces PeerJS with the browser's own RTCPeerConnection, and uses a
   Supabase Realtime broadcast channel (the same project Mini Golf uses) only
   for the handshake: hello, offer, answer, and ICE candidates. Once the data
   channel opens, game traffic goes straight between the two browsers exactly
   as before; Supabase never carries a single frame of the match.

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
  ice: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
  helloEvery: 1500,       // a guest repeats its hello until the host answers
  findTimeout: 8000,      // no host answered at all: wrong code
  connectTimeout: 20000,  // a host answered but no direct link formed
  serverTimeout: 10000,   // the matchmaking channel itself never came up
};

let _supa = null;
function rtcClient() {
  if (!_supa) _supa = window.supabase.createClient(RTC.url, RTC.key, {
    realtime: { params: { eventsPerSecond: 40 } },   // ICE comes in bursts
  });
  return _supa;
}

class Emitter {
  constructor() { this._h = {}; }
  on(e, f) { (this._h[e] = this._h[e] || []).push(f); return this; }
  emit(e, ...a) { (this._h[e] || []).slice().forEach(f => { try { f(...a); } catch (err) { console.error(err); } }); }
}

/** One direct link to one other player. */
class RtcConn extends Emitter {
  constructor(peer, remoteId) {
    super();
    this.peer = peer; this.remoteId = remoteId;
    this.open = false; this.done = false;
    this.dc = null; this.pendingIce = [];
    this.pc = new RTCPeerConnection({ iceServers: RTC.ice });
    this.pc.onicecandidate = e => {
      if (e.candidate) peer.signal({ t: "ice", to: remoteId, c: e.candidate.toJSON() });
    };
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      if (s === "failed" || s === "closed") this.closed();
    };
    this.pc.ondatachannel = e => this.attach(e.channel);
  }
  attach(dc) {
    this.dc = dc;
    dc.onopen = () => { if (this.done) return; this.open = true; this.emit("open"); };
    dc.onmessage = m => { let d; try { d = JSON.parse(m.data); } catch (e) { return; } this.emit("data", d); };
    dc.onclose = () => this.closed();
  }
  async addIce(c) {
    if (!this.pc.remoteDescription) { this.pendingIce.push(c); return; }
    try { await this.pc.addIceCandidate(c); } catch (e) { /* stale candidate */ }
  }
  async flushIce() {
    const q = this.pendingIce; this.pendingIce = [];
    for (const c of q) { try { await this.pc.addIceCandidate(c); } catch (e) {} }
  }
  send(obj) {
    if (this.dc && this.dc.readyState === "open") this.dc.send(JSON.stringify(obj));
  }
  close() {
    try { if (this.dc) this.dc.close(); } catch (e) {}
    try { this.pc.close(); } catch (e) {}
    this.closed();
  }
  closed() {
    if (this.done) return;
    this.done = true; this.open = false;
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

  joinRoom(code) {
    return new Promise((res, rej) => {
      this.ch = rtcClient().channel(RTC.channel + code, {
        config: { broadcast: { self: false }, presence: { key: this.id } },
      });
      this.ch.on("broadcast", { event: "sig" }, m => this.onSignal(m.payload || {}));
      let settled = false;
      setTimeout(() => {
        if (!settled) { settled = true; rej(new Error("couldn't reach the matchmaking server — check your internet, or try a hotspot")); }
      }, RTC.serverTimeout);
      this.ch.subscribe(st => {
        if (settled) return;
        if (st === "SUBSCRIBED") { settled = true; res(); }
        else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") {
          settled = true; rej(new Error("couldn't reach the matchmaking server"));
        }
      });
    });
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
    this.ch.send({ type: "broadcast", event: "sig", payload: Object.assign({ from: this.id }, payload) });
  }

  forget(conn) { if (this.conns.get(conn.remoteId) === conn) this.conns.delete(conn.remoteId); }

  async onSignal(d) {
    if (this.destroyed || (d.to && d.to !== this.id) || !d.from) return;
    let c = this.conns.get(d.from);

    if (this.isHost && d.t === "hello") {
      if (c && !c.done) return;                            // a repeated hello
      c = new RtcConn(this, d.from);
      this.conns.set(d.from, c);
      // unordered and unretransmitted: the netcode resends whatever matters
      c.attach(c.pc.createDataChannel("game", { ordered: false, maxRetransmits: 0 }));
      this.emit("connection", c);
      const offer = await c.pc.createOffer();
      await c.pc.setLocalDescription(offer);
      this.signal({ t: "offer", to: d.from, sdp: c.pc.localDescription.toJSON() });
      return;
    }
    if (!c) return;
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
  }

  /** Guest: find the host of roomCode and open a direct link to it. */
  connect(roomCode) {
    const c = new RtcConn(this, "host");
    this.conns.set("host", c);
    this.joinRoom(roomCode).then(() => {
      let answered = false, tries = 0;
      const hello = () => {
        if (this.destroyed || c.open || c.done) return;
        if (c.pc.remoteDescription) answered = true;
        if (!answered) {
          if (++tries * RTC.helloEvery > RTC.findTimeout) return this.fail("peer-unavailable", "no game found with that code");
          this.signal({ t: "hello", to: "host" });
        }
        setTimeout(hello, RTC.helloEvery);
      };
      hello();
      setTimeout(() => {
        if (!c.open && !c.done && answered) {
          c.close();
          this.fail("p2p", "found the game, but your networks wouldn't link directly — try another Wi-Fi or a hotspot");
        }
      }, RTC.connectTimeout);
      // once the link is up, the introduction channel is no longer needed
      c.on("open", () => { try { rtcClient().removeChannel(this.ch); } catch (e) {} this.ch = null; });
    }).catch(e => this.fail("network", e));
    return c;
  }

  destroy() {
    this.destroyed = true;
    for (const c of [...this.conns.values()]) c.close();
    if (this.ch) { try { rtcClient().removeChannel(this.ch); } catch (e) {} this.ch = null; }
  }
}
