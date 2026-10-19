/* ==========================================================================
   3. AUDIO — everything synthesised with Web Audio, no files
   ========================================================================== */

const Snd = {
  ctx: null, master: null, musicGain: null, sfxGain: null,
  ready: false,
  musicTimer: null, musicStep: 0, musicStage: null,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1;
    this.sfxGain.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);

    // A short reverb gives hits weight without sounding like a click track.
    const len = this.ctx.sampleRate * 1.1;
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.verb = this.ctx.createConvolver(); this.verb.buffer = buf;
    this.verbGain = this.ctx.createGain(); this.verbGain.gain.value = 0.18;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    this.ready = true;
  },
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  get sfxOn() { return Settings.get("sfxOn"); },

  tone(freq, dur, type = "square", vol = 0.25, slideTo = null, delay = 0, send = 0) {
    if (!this.ready || !this.sfxOn) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    if (send > 0) g.connect(this.verb);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise(dur, vol = 0.3, freq = 900, q = 1.2, type = "lowpass", delay = 0, send = 0) {
    if (!this.ready || !this.sfxOn) return;
    const t = this.ctx.currentTime + delay;
    const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    if (send > 0) g.connect(this.verb);
    src.start(t);
  },

  /* ---------------- game events ---------------- */
  hit(dmg) {
    const p = clamp(dmg / 20, 0, 1);
    this.noise(0.07 + p * 0.1, 0.24 + p * 0.22, 1700 - p * 1200, 1.0, "lowpass", 0, p * 0.6);
    this.tone(230 - p * 100, 0.06 + p * 0.08, "square", 0.12 + p * 0.1, 70);
  },
  bigHit() { this.noise(0.3, 0.42, 300, 0.9, "lowpass", 0, 0.8); this.tone(92, 0.34, "sawtooth", 0.2, 36, 0, 0.5); },
  whoosh(p = 1) { this.noise(0.1 * p, 0.09, 2800, 0.7, "bandpass"); },
  jump() { this.tone(360, 0.09, "square", 0.09, 700); },
  land() { this.noise(0.06, 0.11, 420, 0.8); },
  shield() { this.tone(560, 0.13, "sine", 0.13, 780); this.tone(860, 0.09, "sine", 0.06, 1140); },
  shieldBreak() { this.noise(0.4, 0.4, 2200, 2.2, "bandpass", 0, 1); this.tone(1400, 0.5, "sawtooth", 0.18, 90); },
  dodge() { this.noise(0.09, 0.09, 3400, 1.6, "bandpass"); },
  grab() { this.tone(170, 0.08, "triangle", 0.18, 300); },
  throw_() { this.noise(0.13, 0.22, 700, 0.9); this.tone(150, 0.19, "sawtooth", 0.15, 420); },
  blip(f = 680) { this.tone(f, 0.05, "square", 0.1, f * 1.4); },
  ko() {
    this.noise(0.5, 0.4, 900, 0.7, "lowpass", 0, 1);
    [760, 570, 430, 300].forEach((f, i) => this.tone(f, 0.25, "square", 0.15, f * 0.6, i * 0.07, 0.5));
  },
  snapback() {
    this.noise(0.6, 0.5, 260, 0.8, "lowpass", 0, 1);
    [180, 260, 380, 520, 720].forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.13, f * 1.6, i * 0.045, 0.4));
  },
  superCharge() {
    [220, 330, 440, 660].forEach((f, i) => this.tone(f, 0.5, "sine", 0.1, f * 2, i * 0.06, 0.8));
    this.noise(0.6, 0.2, 400, 1, "highpass", 0, 1);
  },
  superHit() {
    this.noise(0.5, 0.5, 180, 0.8, "lowpass", 0, 1);
    this.tone(60, 0.6, "sawtooth", 0.28, 28, 0, 0.6);
    [330, 440, 550, 880].forEach((f, i) => this.tone(f, 0.35, "square", 0.1, f * 0.5, i * 0.05, 0.7));
  },
  ui() { this.tone(680, 0.05, "square", 0.1, 940); },
  uiBig() { this.tone(430, 0.09, "square", 0.14, 820); this.tone(820, 0.13, "square", 0.1, 1240, 0.06); },
  count(n) { this.tone(n === 0 ? 880 : 440, n === 0 ? 0.4 : 0.13, "square", 0.18, n === 0 ? 1320 : 440); },

  /* ---------------- stage music ----------------
     A tiny step sequencer. Each stage supplies a root note, a scale and a
     tempo, so every map has its own bed without any audio files. */
  startMusic(stage) {
    this.stopMusic();
    if (!this.ready || !Settings.get("musicOn") || !stage || !stage.music) return;
    this.musicStage = stage;
    this.musicStep = 0;
    const m = stage.music;
    const beat = 60000 / m.bpm / 2;
    this.musicTimer = setInterval(() => this._musicTick(), beat);
  },
  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  },
  _musicTick() {
    if (!this.ready || !Settings.get("musicOn")) return;
    const m = this.musicStage.music;
    const s = this.musicStep++;
    const t = this.ctx.currentTime;
    const note = f => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = m.wave || "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      o.connect(g); g.connect(this.musicGain); g.connect(this.verb);
      o.start(t); o.stop(t + 0.4);
    };
    // bass on the downbeat
    if (s % 4 === 0) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = "sawtooth";
      o.frequency.value = m.root / 2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
      o.connect(lp); lp.connect(g); g.connect(this.musicGain);
      o.start(t); o.stop(t + 0.55);
    }
    // arpeggio
    const seq = m.seq;
    const deg = seq[s % seq.length];
    if (deg >= 0) note(m.root * Math.pow(2, m.scale[deg % m.scale.length] / 12) * (deg >= m.scale.length ? 2 : 1));
    // hat
    if (m.hats && s % 2 === 1) this.noise(0.03, 0.05, 7000, 1, "highpass");
  },
};
