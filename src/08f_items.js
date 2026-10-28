/* ==========================================================================
   9b. ITEMS — power-ups that drop onto the stage mid-match

   Every so often a capsule floats down onto a random platform. Touching it
   uses it at once (there is no pick-up button to learn), so items change who
   wins a scramble rather than adding inputs. They can be switched off on the
   stage-select screen and in the online lobby.

   Only the host simulates items. Guests get the list in every snapshot and
   the buff on each fighter in its status array, so nothing here needs its
   own network message.
   ========================================================================== */

const ITEMS = {
  heart:  { name: "HEART",  color: "#ff4f7a", note: "Heals 35% damage on the spot." },
  boost:  { name: "BOOST",  color: "#4fe8ff", note: "Run and jump faster for 8 seconds." },
  power:  { name: "POWER",  color: "#ff8a1a", note: "Your hits do 30% more for 8 seconds." },
  star:   { name: "STAR",   color: "#ffd23d", note: "Invincible for 6 seconds, and touching a foe hurts them." },
  charge: { name: "CHARGE", color: "#b6ff3b", note: "Half a super meter, instantly." },
  bomb:   { name: "BOMB",   color: "#ff2e88", note: "Lobbed at the nearest foe. It sticks, then blows." },
};
const ITEM_IDS = Object.keys(ITEMS);
/* How often each one turns up. Star is the rare one. */
const ITEM_WEIGHT = { heart: 2, boost: 2, power: 2, star: 1, charge: 2, bomb: 2 };
/* Timed buffs ride on the fighter; index 0 is "none". Order is wire format. */
const BUFF_IDS = ["", "boost", "power", "star"];

const ITEM_CFG = {
  first:  6 * 60,          // the first drop, after the countdown
  gapMin: 8 * 60, gapMax: 13 * 60,
  max:    2,               // never more than this many on the stage at once
  life:   14 * 60,         // an ignored item fades away
  fall:   2.6,             // capsules drift down under a little parachute
  reach:  20,              // pick-up radius beyond the fighter's hurtbox
  buff:   { boost: 8 * 60, power: 8 * 60, star: 6 * 60 },
  heal:   35,
  boostMul: 1.3,
  powerMul: 1.3,
};
const ITEM_BOMB = { name: "Item Bomb", dmg: 14, base: 4.5, scale: 1.0, angle: 55, unblockable: true };
const STAR_TOUCH = { name: "Star", dmg: 8, base: 5.2, scale: 0.75, angle: 48 };

const Items = {
  list: [],
  on: true,
  timer: 0,
  nextId: 1,

  reset(on) {
    this.list.length = 0;
    this.on = on !== false;
    this.timer = ITEM_CFG.first;
  },

  pickKind() {
    let total = 0;
    for (const k of ITEM_IDS) total += ITEM_WEIGHT[k];
    let r = Math.random() * total;
    for (const k of ITEM_IDS) { r -= ITEM_WEIGHT[k]; if (r < 0) return k; }
    return "heart";
  },

  /** Drop one over a random platform, from well above the camera's view. */
  spawn() {
    const segs = Stage.segs.filter(s => Math.abs(s.bx - s.ax) > 60);
    if (!segs.length) return;
    const s = pick(segs);
    const x = lerp(s.ax, s.bx, rnd(0.15, 0.85));
    const y = Math.min(s.ay, s.by) - 520;
    this.list.push({ id: this.nextId++, kind: this.pickKind(), x, y, vy: 0,
                     landed: false, life: ITEM_CFG.life, t: 0 });
  },

  update(fighters) {
    if (!this.on) return;
    if (this.list.length < ITEM_CFG.max && --this.timer <= 0) {
      this.spawn();
      this.timer = rndi(ITEM_CFG.gapMin, ITEM_CFG.gapMax);
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i];
      it.t++; it.life--;
      // falls, or rides whatever it is sitting on (a lift, a drifting ledge)
      const fl = Stage.floorBelow(it.x, it.y - 18);
      if (fl !== null && it.y >= fl - 2 && it.y <= fl + 20) {
        if (!it.landed) { FX.burst(it.x, fl, 6, ITEMS[it.kind].color, 2); Snd.land(); }
        it.y = fl; it.vy = 0; it.landed = true;
      } else {
        it.landed = false;
        it.vy = Math.min(it.vy + 0.12, ITEM_CFG.fall);
        it.y += it.vy;
        if (fl !== null && it.y > fl) { it.y = fl; it.vy = 0; it.landed = true; }
      }
      if (it.life <= 0 || it.y > Stage.blast.bottom) { this.list.splice(i, 1); continue; }

      for (const f of fighters) {
        if (!f.alive || f.state === ST.DEAD || f.state === ST.RESPAWN) continue;
        // the capsule hangs 18 above the floor it sits on
        if (dist(f.x, f.y, it.x, it.y - 18) > f.ch.hurt + ITEM_CFG.reach) continue;
        this.list.splice(i, 1);
        this.apply(f, it.kind, it.x, it.y - 18);
        break;
      }
    }

    // a star makes its holder a weapon: running into a foe hits them
    for (const f of fighters) {
      if (f.buff !== "star" || !f.alive || f.state === ST.DEAD) continue;
      f._starHit = f._starHit || {};
      for (const o of fighters) {
        if (allies(o, f) || !o.alive || o.state === ST.DEAD || o.intangible()) continue;
        if ((f._starHit[o.slot] || 0) > f.animTime) continue;
        if (dist(f.x, f.y, o.x, o.y) > f.ch.hurt + o.ch.hurt) continue;
        f._starHit[o.slot] = f.animTime + 40;
        Combat.land(f, o, STAR_TOUCH, (f.x + o.x) / 2, (f.y + o.y) / 2);
      }
    }
  },

  /** f touched an item of this kind at (x, y). */
  apply(f, kind, x, y) {
    const def = ITEMS[kind];
    f.stats.items = (f.stats.items || 0) + 1;
    FX.ring(x, y, 8, 90, def.color, 4);
    FX.burst(x, y, 18, def.color, 6);
    FX.damageText(f.x, f.y - f.h * 0.7, def.name + "!", def.color);
    Snd.tone(660, 0.07, "square", 0.12, 1320);
    Snd.tone(990, 0.12, "triangle", 0.1, 1760, 0.06);

    switch (kind) {
      case "heart": {
        const heal = Math.min(f.percent, ITEM_CFG.heal);
        f.percent -= heal;
        FX.damageText(f.x, f.y - f.h * 0.7 - 22, "-" + Math.round(heal) + "%", "#7dff9a");
        break;
      }
      case "charge":
        f.addMeter(CFG.meter.max * 0.5);
        break;
      case "bomb": {
        const t = Combat.nearestFoe(f, 900);
        const dir = t ? Math.sign(t.x - f.x) || f.facing : f.facing;
        const dx = t ? Math.abs(t.x - f.x) : 260;
        Entities.add("bomb", f, { x: f.x, y: f.y - 30, vx: dir * clamp(dx / 34, 5, 13), vy: -8,
                                  r: 11, life: 150, move: ITEM_BOMB });
        break;
      }
      default:                       // boost, power, star: a timed buff
        f.buff = kind;
        f.buffT = ITEM_CFG.buff[kind];
        if (kind === "star") { FX.flash("#ffd23d", 0.18); f._starHit = {}; }
    }
  },

  /* ------------------------------------------------------------ drawing */
  draw(g) {
    for (const it of this.list) {
      // the last two seconds it blinks, so nobody walks to one that vanishes
      if (it.life < 120 && Math.floor(it.life / 6) % 2 === 0) continue;
      const bob = it.landed ? Math.sin(it.t * 0.08) * 3 : 0;
      const y = it.y - 18 + bob;
      g.save();
      g.translate(it.x, y);
      if (!it.landed) {
        // a little parachute while it drifts in
        g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(-12, -6); g.lineTo(-20, -38); g.moveTo(12, -6); g.lineTo(20, -38); g.stroke();
        g.fillStyle = hexA(ITEMS[it.kind].color, 0.85);
        g.beginPath(); g.arc(0, -38, 24, Math.PI, 0); g.closePath(); g.fill();
        g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
      }
      itemIcon(g, it.kind, 0, 0, 1, it.t);
      g.restore();
    }
  },
};

/** One item's capsule, centred on (x, y). Also used by the menus. */
function itemIcon(g, kind, x, y, s, t) {
  const def = ITEMS[kind], c = def.color;
  t = t || 0;
  g.save();
  g.translate(x, y); g.scale(s, s);
  // halo
  g.save(); g.globalCompositeOperation = "lighter";
  g.globalAlpha = 0.35 + Math.sin(t * 0.12) * 0.12;
  const q = g.createRadialGradient(0, 0, 4, 0, 0, 30);
  q.addColorStop(0, c); q.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = q; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill();
  g.restore();
  // capsule
  ink(g, () => { g.beginPath(); g.arc(0, 0, 16, 0, 7); }, vol(g, -16, 16, c, 0.3, -0.35));
  g.fillStyle = "rgba(255,255,255,.35)";
  g.beginPath(); g.ellipse(-5, -8, 7, 4, -0.5, 0, 7); g.fill();
  // glyph
  g.fillStyle = "#ffffff"; g.strokeStyle = INK; g.lineWidth = 2; g.lineJoin = "round";
  switch (kind) {
    case "heart":
      g.beginPath();
      g.moveTo(0, 8); g.bezierCurveTo(-12, -1, -7, -11, 0, -4);
      g.bezierCurveTo(7, -11, 12, -1, 0, 8); g.closePath();
      g.stroke(); g.fill(); break;
    case "boost":
      poly(g, [-8, -7, 0, 0, -8, 7, -4, 7, 4, 0, -4, -7]); g.stroke(); g.fill();
      poly(g, [0, -7, 8, 0, 0, 7, 4, 7, 12, 0, 4, -7]); g.stroke(); g.fill(); break;
    case "power":
      g.beginPath(); roundRect(g, -8, -4, 16, 10, 3); g.stroke(); g.fill();
      g.beginPath();
      for (let i = 0; i < 3; i++) { g.rect(-8 + i * 5.5, -9, 4.5, 6); }
      g.stroke(); g.fill(); break;
    case "star": {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.5 : 10;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath(); g.stroke(); g.fill(); break;
    }
    case "charge":
      poly(g, [2, -11, -7, 2, -1, 2, -3, 11, 7, -2, 1, -2]); g.stroke(); g.fill(); break;
    case "bomb":
      g.beginPath(); g.arc(0, 2, 7.5, 0, 7); g.stroke(); g.fill();
      g.beginPath(); g.moveTo(3, -4); g.quadraticCurveTo(6, -10, 10, -9); g.stroke();
      g.fillStyle = "#ffd23d"; g.beginPath(); g.arc(10, -9, 2.4, 0, 7); g.fill(); break;
  }
  g.restore();
}

/** What a timed buff looks like on whoever has it. */
function drawBuff(f, rx, ry) {
  if (!f.buff || f.buffT <= 0) return;
  const c = ITEMS[f.buff].color, hurt = f.ch.hurt;
  // the last two seconds flicker so the holder knows it is running out
  if (f.buffT < 120 && Math.floor(f.buffT / 5) % 2 === 0) return;
  g.save();
  g.globalCompositeOperation = "lighter";
  if (f.buff === "star") {
    const hue = (f.animTime * 8) % 360;
    g.globalAlpha = 0.5;
    g.strokeStyle = `hsl(${hue},100%,65%)`; g.lineWidth = 4;
    g.shadowColor = g.strokeStyle; g.shadowBlur = 22;
    g.beginPath(); g.arc(rx, ry, hurt * 1.45, 0, 7); g.stroke();
    for (let i = 0; i < 5; i++) {
      const a = f.animTime * 0.09 + i * Math.PI * 0.4;
      g.fillStyle = `hsl(${(hue + i * 72) % 360},100%,70%)`;
      g.beginPath(); g.arc(rx + Math.cos(a) * hurt * 1.45, ry + Math.sin(a) * hurt * 1.45, 3, 0, 7); g.fill();
    }
  } else if (f.buff === "power") {
    g.globalAlpha = 0.28 + Math.sin(f.animTime * 0.25) * 0.1;
    const q = g.createRadialGradient(rx, ry, hurt * 0.4, rx, ry, hurt * 1.6);
    q.addColorStop(0, hexA(c, 0.9)); q.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = q; g.beginPath(); g.arc(rx, ry, hurt * 1.6, 0, 7); g.fill();
    // flames licking up off the shoulders
    g.globalAlpha = 0.7; g.fillStyle = c;
    for (let i = -1; i <= 1; i++) {
      const fl = 8 + Math.sin(f.animTime * 0.4 + i * 2) * 5;
      poly(g, [rx + i * 12 - 5, ry - f.h * 0.35, rx + i * 12, ry - f.h * 0.35 - fl, rx + i * 12 + 5, ry - f.h * 0.35]);
      g.fill();
    }
  } else if (f.buff === "boost") {
    g.globalAlpha = 0.55; g.strokeStyle = c; g.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      const yy = ry - 10 + i * 12, back = -Math.sign(f.vx || f.facing);
      const len = 10 + Math.min(26, Math.abs(f.vx) * 3);
      g.beginPath(); g.moveTo(rx + back * (hurt * 0.8), yy); g.lineTo(rx + back * (hurt * 0.8 + len), yy); g.stroke();
    }
  }
  g.restore();
}
