/* ==========================================================================
   3b. LIGHT — cached glow sprites and the screen post-processing pass

   WHY SPRITES INSTEAD OF shadowBlur
   Canvas `shadowBlur` re-blurs its source on every single draw call. The game
   was using it for every lit visor, every ring, every particle flourish, which
   meant re-blurring dozens of shapes per frame. A radial-gradient sprite baked
   once and then stamped with additive blending looks the same or better and is
   a plain drawImage. Cheap enough that light can be used liberally, which is
   what makes a neon game actually glow instead of merely having bright colours.

   THE POST PASS
   Everything that makes a frame feel finished rather than merely drawn:
     bloom      bright areas bleed into their surroundings
     chroma     red/blue separation on heavy impacts
     flash      full-screen colour on a super or a KO
     vignette   darkened corners so the eye goes to the middle
   It runs on the world, underneath the HUD, so readouts stay crisp.
   ========================================================================== */

const Light = {
  cache: new Map(),
  sizes: [8, 16, 32, 64, 128, 256],
  bloomCv: null, bloomCtx: null,

  _bucket(r) {
    for (const s of this.sizes) if (r <= s) return s;
    return 256;
  },

  /** A soft radial sprite: white hot centre, the colour, then out to nothing. */
  sprite(color, radius, core) {
    core = core === undefined ? 0.18 : core;
    const r = this._bucket(radius);
    const key = color + "|" + r + "|" + core;
    let c = this.cache.get(key);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = r * 2;
    const cx = c.getContext("2d");
    const q = cx.createRadialGradient(r, r, 0, r, r, r);
    q.addColorStop(0, "#ffffff");
    q.addColorStop(core, color);
    q.addColorStop(0.45, hexA(color, 0.35));
    q.addColorStop(1, hexA(color, 0));
    cx.fillStyle = q;
    cx.fillRect(0, 0, r * 2, r * 2);
    if (this.cache.size < 220) this.cache.set(key, c);
    return c;
  },

  /** Stamp a glow centred on (x,y). Additive, so overlapping lights build up. */
  draw(ctx, x, y, radius, color, alpha, core) {
    if (alpha !== undefined && alpha <= 0.01) return;
    if (radius <= 0.5) return;
    const s = this.sprite(color, radius, core);
    const pa = ctx.globalAlpha, po = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = pa * Math.min(1, alpha === undefined ? 1 : alpha);
    ctx.drawImage(s, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = pa;
    ctx.globalCompositeOperation = po;
  },

  /* ------------------------------------------------------------- post ---- */

  /** Cheap thresholded bloom.

      Downsampling and adding the result straight back lifts EVERY pixel by a
      fraction of its neighbourhood, which washed the whole frame out — the
      background is dark blue, not black, so it bloomed too. Multiplying the
      downsample by itself squares each channel first: a dark 0.2 becomes 0.04
      while a hot 0.9 stays 0.81, so only genuinely bright things bleed. Three
      drawImages and no pixel reads. */
  bloom(ctx, canvas, w, h, amount) {
    if (amount <= 0.01) return;
    const bw = Math.max(1, (w / 8) | 0), bh = Math.max(1, (h / 8) | 0);
    if (!this.bloomCv) {
      this.bloomCv = document.createElement("canvas");
      this.bloomCtx = this.bloomCv.getContext("2d");
    }
    if (this.bloomCv.width !== bw || this.bloomCv.height !== bh) {
      this.bloomCv.width = bw; this.bloomCv.height = bh;
    }
    const b = this.bloomCtx;
    b.globalCompositeOperation = "source-over";
    b.clearRect(0, 0, bw, bh);
    b.drawImage(canvas, 0, 0, bw, bh);
    // square it against the same source, never against itself
    b.globalCompositeOperation = "multiply";
    b.drawImage(canvas, 0, 0, bw, bh);
    b.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = amount;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.bloomCv, 0, 0, w, h);
    ctx.restore();
  },

  /** Red/blue separation. Used on heavy impacts, supers and KOs. */
  chroma(ctx, canvas, w, h, amount) {
    if (amount <= 0.02) return;
    const shift = amount * 7;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.3 * amount;
    ctx.drawImage(canvas, -shift, 0);
    ctx.drawImage(canvas, shift, 0);
    ctx.restore();
  },

  vignette(ctx, w, h, amount) {
    const q = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34,
                                       w / 2, h / 2, Math.max(w, h) * 0.76);
    q.addColorStop(0, "rgba(0,0,0,0)");
    q.addColorStop(1, "rgba(0,0,8," + amount + ")");
    ctx.fillStyle = q;
    ctx.fillRect(0, 0, w, h);
  },

  /** The whole pass, in screen space. Call after the world, before the HUD. */
  post(ctx, canvas, w, h) {
    const q = Settings.get("postFx");
    if (q <= 0) return;
    this.chroma(ctx, canvas, w, h, FX.chroma * q);
    this.bloom(ctx, canvas, w, h, 0.62 * q);
    if (FX.flashAmt > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.7, FX.flashAmt);
      ctx.fillStyle = FX.flashCol || "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    this.vignette(ctx, w, h, 0.5 * q);
  },
};
