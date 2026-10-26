/* ==========================================================================
   9a. ENTITY KINDS — the things the newer fighters put into the world

   Each kind is { update(e, fighters) -> gone?, draw(g, e, color), end?(e) }.
   Entities.update/draw dispatch here for any kind listed, so a new fighter's
   projectile is one entry in this table rather than another branch in the
   loop. Everything a kind draws is derived from the fields the netcode ships
   (x, y, r, life, max, dir, landed), so guests render them identically.
   ========================================================================== */

/** Straight-line flight with a lifetime; returns true once it should go. */
function flyOff(e) {
  e.x += e.vx; e.y += e.vy;
  return e.x < -300 || e.x > CFG.world.w + 300 || e.y < -400 || e.y > CFG.world.h + 300;
}

/** A dashed circle — the telegraph every area attack below uses. */
function warnCircle(g, x, y, r, col, a) {
  g.save();
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = a;
  g.strokeStyle = col; g.lineWidth = 3;
  g.setLineDash([10, 9]);
  g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
  g.setLineDash([]);
  g.globalAlpha = a * 0.25; g.fillStyle = col;
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.restore();
}

const KINDS = {

  /* ---- RIME: Ice Lance. Straight, fast, chills whoever it hits. ---- */
  ice: {
    update(e, fighters) {
      if (e.life % 2 === 0) FX.spark(e.x - e.dir * 10, e.y, "#d4f1ff");
      return flyOff(e) || Entities._touch(e, fighters, true);
    },
    draw(g, e, c) {
      g.save(); g.translate(e.x, e.y); g.scale(e.dir || 1, 1);
      g.shadowColor = c; g.shadowBlur = 18;
      g.fillStyle = hexA("#d4f1ff", 0.9);
      poly(g, [22, 0, 4, -7, -18, -3, -24, 0, -18, 3, 4, 7]); g.fill();
      g.fillStyle = "#ffffff";
      poly(g, [22, 0, 6, -2.5, -10, 0, 6, 2.5]); g.fill();
      g.restore();
    },
  },

  /* ---- HEX: Hex Bolt. Slow, and bends toward the nearest foe. ---- */
  hex: {
    update(e, fighters) {
      const t = Combat.nearestFoe(e.owner, 420);
      if (t) {
        const a = Math.atan2(t.y - e.y, t.x - e.x), sp = Math.hypot(e.vx, e.vy);
        const cur = Math.atan2(e.vy, e.vx);
        let d = a - cur; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        const turn = cur + clamp(d, -0.05, 0.05);
        e.vx = Math.cos(turn) * sp; e.vy = Math.sin(turn) * sp;
      }
      if (e.life % 3 === 0) FX.spark(e.x, e.y, e.owner.ch.accent);
      return flyOff(e) || Entities._touch(e, fighters, true);
    },
    draw(g, e, c) {
      g.save(); g.translate(e.x, e.y); g.rotate(e.life * 0.12);
      g.shadowColor = c; g.shadowBlur = 20;
      g.strokeStyle = c; g.lineWidth = 3;
      g.beginPath();
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); }
      g.closePath(); g.stroke();
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill();
      g.restore();
    },
  },

  /* ---- FUSE: Sticky Charge. Sticks to the first foe it touches (or the
         floor) and goes off when its fuse runs out. ---- */
  bomb: {
    update(e, fighters) {
      if (e.stuck) {
        const s = e.stuck;
        if (!s.alive || s.state === ST.DEAD) { e.stuck = null; e.landed = false; e.vy = 0; }
        else { e.x = s.x + e.ox; e.y = s.y + e.oy; }
      } else if (!e.landed) {
        e.vy += 0.5; e.x += e.vx; e.y += e.vy; e.vx *= 0.99;
        for (const f of fighters) {
          if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
          if (dist(e.x, e.y, f.x, f.y) < e.r + f.ch.hurt) {
            e.stuck = f; e.ox = clamp(e.x - f.x, -14, 14); e.oy = -6; e.landed = true;
            FX.damageText(f.x, f.y - 50, "STUCK!", e.owner.ch.accent);
            Snd.tone(300, 0.08, "square", 0.1, 160);
            break;
          }
        }
        if (!e.stuck && e.vy > 0) {
          const fl = Stage.floorBelow(e.x, e.y - e.vy);
          if (fl !== null && e.y + e.r >= fl) { e.y = fl - e.r; e.landed = true; e.vx = 0; }
        }
        if (e.y > CFG.world.h + 300) { e.dud = true; return true; }
      }
      if (e.life < 40 && e.life % (e.life < 20 ? 4 : 8) === 0) Snd.tone(1200, 0.03, "square", 0.06);
      return false;
    },
    end(e, fighters) {
      if (e.dud) return;
      FX.ring(e.x, e.y, 10, 150, "#ffd27a", 5);
      FX.burst(e.x, e.y, 30, e.owner.ch.color, 9);
      FX.shake(14); Snd.bigHit();
      Entities.blast(e.owner, e.x, e.y, 70, e.move, fighters);
    },
    draw(g, e, c) {
      g.save(); g.globalCompositeOperation = "source-over";
      g.translate(e.x, e.y);
      const hot = e.life < 40 && Math.floor(e.life / (e.life < 20 ? 2 : 4)) % 2 === 0;
      ink(g, () => { g.beginPath(); g.arc(0, 0, e.r, 0, 7); }, hot ? "#ff3b1f" : "#2a2230");
      g.fillStyle = hexA("#ffffff", 0.35); g.beginPath(); g.arc(-3, -3, e.r * 0.35, 0, 7); g.fill();
      g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, e.r - 3, 0, 7); g.stroke();
      // the fuse
      g.strokeStyle = "#c8a070"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, -e.r); g.quadraticCurveTo(5, -e.r - 6, 2, -e.r - 10); g.stroke();
      g.fillStyle = "#ffe36b"; g.shadowColor = "#ff8a1f"; g.shadowBlur = 12;
      g.beginPath(); g.arc(2, -e.r - 10, 2.6 + Math.random() * 1.4, 0, 7); g.fill();
      g.restore();
    },
  },

  /* ---- FUSE: Payload. A huge countdown bomb, with its blast radius drawn
         on the floor the whole time, so it is a threat you can run from. ---- */
  payload: {
    update(e, fighters) {
      if (!e.landed) {
        e.vy += 0.6; e.y += e.vy;
        const fl = Stage.floorBelow(e.x, e.y - e.vy);
        if (fl !== null && e.y + e.r >= fl) { e.y = fl - e.r; e.vy = 0; e.landed = true; FX.shake(6); Snd.bigHit(); }
        if (e.y > CFG.world.h + 300) { e.dud = true; return true; }
      }
      const sec = Math.ceil(e.life / 40);
      if (e.life % 40 === 0 && sec > 0) {
        FX.damageText(e.x, e.y - 60, String(sec), "#ff3b1f");
        Snd.tone(sec === 1 ? 1300 : 880, 0.1, "square", 0.14);
      }
      return false;
    },
    end(e, fighters) {
      if (e.dud) return;
      FX.flash("#ffffff", 0.5); FX.punch(0.9);
      FX.ring(e.x, e.y, 20, e.w, "#ffffff", 7);
      FX.ring(e.x, e.y, 10, e.w * 0.8, e.owner.ch.color, 5);
      FX.burst(e.x, e.y, 60, e.owner.ch.color, 14);
      FX.shake(34); FX.hitPause(12);
      Snd.superHit();
      Entities.blast(e.owner, e.x, e.y, e.w, e.move, fighters);
    },
    draw(g, e, c) {
      const k = 1 - e.life / e.max;
      warnCircle(g, e.x, e.y, e.w, "#ff3b1f", 0.25 + k * 0.45 + (e.life < 40 ? 0.2 * Math.sin(e.life) : 0));
      g.save(); g.globalCompositeOperation = "source-over";
      g.translate(e.x, e.y);
      const pulse = 1 + (e.life < 40 ? Math.abs(Math.sin(e.life * 0.4)) * 0.08 : 0);
      g.scale(pulse, pulse);
      ink(g, () => { g.beginPath(); g.arc(0, 0, e.r, 0, 7); }, vol(g, -e.r, e.r, "#3a2f40", 0.2, 0.4), 4);
      g.fillStyle = hexA("#ffffff", 0.3); g.beginPath(); g.arc(-9, -10, e.r * 0.3, 0, 7); g.fill();
      // hazard band
      g.save(); g.beginPath(); g.arc(0, 0, e.r, 0, 7); g.clip();
      hatch(g, -e.r, -5, e.r * 2, 10, "#ffc83d", 9, 0.9);
      g.restore();
      g.font = `900 22px ${FONT_DISPLAY}`; g.textAlign = "center";
      outlineText(g, String(Math.max(1, Math.ceil(e.life / 40))), 0, 30 + e.r, "#ff3b1f", 5);
      g.restore();
    },
  },

  /* ---- RICO: Return Disc. Out, slows, turns, and comes home — it hits on
         both legs, and she catches it. ---- */
  disc: {
    update(e, fighters) {
      if (!e.turned) {
        e.vx -= e.dir * 0.62;
        if (Math.sign(e.vx) !== e.dir) { e.turned = true; e.hitIds = []; e.landed = true; }
      } else {
        const o = e.owner, dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy) || 1;
        const sp = Math.min(15, Math.hypot(e.vx, e.vy) + 0.7);
        e.vx = e.vx * 0.8 + dx / d * sp * 0.2; e.vy = e.vy * 0.8 + dy / d * sp * 0.2;
        if (d < 26 || !o.alive || o.state === ST.DEAD) {
          if (d < 26) { FX.ring(o.x, o.y, 4, 30, o.ch.accent, 2); Snd.tone(1500, 0.04, "square", 0.06); }
          return true;
        }
      }
      e.x += e.vx; e.y += e.vy;
      Entities._touch(e, fighters, false);
      return e.y > CFG.world.h + 300;
    },
    draw(g, e, c) {
      g.save(); g.translate(e.x, e.y); g.rotate(e.life * 0.5);
      g.shadowColor = c; g.shadowBlur = 16;
      g.strokeStyle = c; g.lineWidth = 4;
      g.beginPath(); g.ellipse(0, 0, e.r, e.r * 0.55, 0, 0, 7); g.stroke();
      g.strokeStyle = "#ffffff"; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-e.r * 0.7, 0); g.lineTo(e.r * 0.7, 0); g.stroke();
      g.restore();
    },
  },

  /* ---- RICO: Bank Shot. Bounces inside the stage's box; each disc may hit
         the same foe again after a breather, at most three times. ---- */
  rdisc: {
    update(e, fighters) {
      const P = Stage.pivot;
      if (e.seek) {
        const t = Combat.nearestFoe(e.owner);
        if (t) {
          const sp = Math.hypot(e.vx, e.vy), cur = Math.atan2(e.vy, e.vx);
          let d = Math.atan2(t.y - e.y, t.x - e.x) - cur;
          while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
          const a = cur + clamp(d, -0.035, 0.035);
          e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp;
        }
      }
      e.x += e.vx; e.y += e.vy;
      const L = P.x - 560, R = P.x + 560, T = P.y - 560, B = P.y - 14;
      if (e.x < L || e.x > R) { e.vx = -e.vx; e.x = clamp(e.x, L, R); Snd.tone(900, 0.03, "square", 0.05); }
      if (e.y < T || e.y > B) { e.vy = -e.vy; e.y = clamp(e.y, T, B); Snd.tone(700, 0.03, "square", 0.05); }
      e.hitLog = e.hitLog || {};
      for (const f of fighters) {
        if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
        const h = e.hitLog[f.slot] || (e.hitLog[f.slot] = { n: 0, at: -99 });
        if (h.n >= (e.cap || 3) || (h.at > 0 && e.life > h.at - 20)) continue;
        if (dist(e.x, e.y, f.x, f.y) < e.r + f.ch.hurt) { h.n++; h.at = e.life; Combat.land(e.owner, f, e.move, e.x, e.y); }
      }
      return false;
    },
    draw(g, e, c) { KINDS.disc.draw(g, e, c); },
  },

  /* ---- SPROUT: Bloom. Heals its planter (and teammates) standing in it;
         a foe who walks through takes one sting from the thorns. ---- */
  flower: {
    update(e, fighters) {
      if (!e.landed) {
        const fl = Stage.floorBelow(e.x, e.y);
        if (fl === null) return true;
        e.y = fl; e.landed = true;
      }
      for (const f of fighters) {
        if (!f.alive || f.state === ST.DEAD) continue;
        const d = Math.abs(f.x - e.x), dy = e.y - f.feetY;
        if (d > e.r || dy < -10 || dy > 90) continue;
        if (allies(f, e.owner)) {
          if (e.life % 15 === 0 && f.percent > 0) {
            f.percent = Math.max(0, f.percent - 1);
            FX.damageText(f.x, f.y - 46, "+1", "#7dff9a");
          }
        } else if (!e.hitIds.includes(f.slot) && d < 34 && !f.intangible()) {
          e.hitIds.push(f.slot);
          Combat.land(e.owner, f, e.move, e.x, e.y - 20);
        }
      }
      if (e.life % 6 === 0) FX.spark(e.x + rnd(-e.r, e.r), e.y - rnd(4, 40), "#9dffbd");
      return false;
    },
    draw(g, e, c) {
      const grow = clamp((e.max - e.life) / 30, 0, 1), fade = clamp(e.life / 30, 0, 1);
      // the healing patch on the floor
      g.save(); g.globalAlpha = 0.3 * fade;
      const q = g.createRadialGradient(e.x, e.y, 2, e.x, e.y, e.r);
      q.addColorStop(0, hexA("#7dff9a", 0.6)); q.addColorStop(1, hexA("#7dff9a", 0));
      g.fillStyle = q; g.beginPath(); g.ellipse(e.x, e.y, e.r, 14, 0, 0, 7); g.fill();
      g.restore();
      g.save(); g.globalCompositeOperation = "source-over"; g.globalAlpha = fade;
      g.translate(e.x, e.y);
      const h = 34 * grow, sway = Math.sin(e.life * 0.05) * 3;
      g.strokeStyle = INK; g.lineWidth = 5; g.lineCap = "round";
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(sway, -h * 0.5, sway, -h); g.stroke();
      g.strokeStyle = "#2f9a52"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(sway, -h * 0.5, sway, -h); g.stroke();
      g.translate(sway, -h);
      for (let i = 0; i < 6; i++) {
        g.save(); g.rotate(i / 6 * Math.PI * 2 + e.life * 0.01);
        ink(g, () => { g.beginPath(); g.ellipse(0, -8 * grow, 4.5 * grow, 8 * grow, 0, 0, 7); }, c, 2);
        g.restore();
      }
      g.fillStyle = "#ffe14d"; g.beginPath(); g.arc(0, 0, 4 * grow, 0, 7); g.fill();
      g.restore();
    },
  },

  /* ---- ECHO: the afterimage Recall leaves behind. It holds for a beat,
         then detonates on anyone who walked into where she was. ---- */
  ghost: {
    update() { return false; },
    end(e, fighters) {
      FX.ring(e.x, e.y, 8, 90, e.owner.ch.color, 4);
      FX.burst(e.x, e.y, 16, e.owner.ch.accent, 6);
      Snd.tone(500, 0.12, "triangle", 0.1, 1200);
      Entities.blast(e.owner, e.x, e.y, 62, e.move, fighters);
    },
    draw(g, e, c) {
      g.save(); g.globalCompositeOperation = "source-over";
      g.globalAlpha = 0.25 + 0.25 * Math.abs(Math.sin(e.life * 0.4));
      g.translate(e.x, e.y); g.scale(e.dir || 1, 1);
      e.owner.ch.draw(g, { time: e.life, runPhase: 0, running: false, air: false, vx: 0, vy: 0,
                           state: ST.IDLE, flash: true, atkPhase: -1 });
      g.restore();
      warnCircle(g, e.x, e.y, 62, c, 0.35);
    },
  },

  /* ---- TEMPO: a sound wave. An expanding ring that hits each foe once as
         it passes them; it shatters shields rather than chipping them. ---- */
  ring: {
    update(e, fighters) {
      e.r = e.maxR * (1 - e.life / e.max) + 10;
      for (const f of fighters) {
        if (allies(f, e.owner) || !f.alive || f.state === ST.DEAD || f.intangible()) continue;
        if (e.hitIds.includes(f.slot)) continue;
        if (Math.abs(dist(e.x, e.y, f.x, f.y) - e.r) < f.ch.hurt + 10) {
          e.hitIds.push(f.slot);
          Combat.land(e.owner, f, e.move, f.x, f.y);
        }
      }
      return false;
    },
    draw(g, e, c) {
      const a = clamp(e.life / e.max, 0, 1);
      g.save(); g.globalAlpha = a;
      g.strokeStyle = c; g.lineWidth = 5; g.shadowColor = c; g.shadowBlur = 20;
      g.beginPath(); g.arc(e.x, e.y, e.r, 0, 7); g.stroke();
      g.strokeStyle = "#ffffff"; g.lineWidth = 1.6;
      g.beginPath(); g.arc(e.x, e.y, e.r - 7, 0, 7); g.stroke();
      // notes riding the ring
      g.fillStyle = "#ffffff";
      for (let i = 0; i < 6; i++) {
        const an = i / 6 * Math.PI * 2 + e.life * 0.03;
        const nx = e.x + Math.cos(an) * e.r, ny = e.y + Math.sin(an) * e.r;
        g.beginPath(); g.ellipse(nx, ny, 3.4, 2.6, -0.4, 0, 7); g.fill();
        g.fillRect(nx + 2.4, ny - 10, 1.4, 10);
      }
      g.restore();
    },
  },

  /* ---- HEX: Doom. A mark over a cursed foe; when it closes, lightning. ---- */
  doom: {
    update(e) {
      const t = e.tgt;
      if (!t || !t.alive || t.state === ST.DEAD) { e.dud = true; return true; }
      e.x = t.x; e.y = t.y;
      return false;
    },
    end(e) {
      if (e.dud) return;
      const t = e.tgt;
      FX.bolt(t.x + rnd(-20, 20), t.y - 420, t.x, t.y, "#ffffff", { segs: 9, jag: 22, life: 14, w: 5 });
      FX.bolt(t.x, t.y - 420, t.x, t.y, e.owner.ch.color, { segs: 7, jag: 30, life: 12, w: 3 });
      FX.flash(e.owner.ch.color, 0.25); FX.shake(16);
      Snd.superHit();
      if (!t.intangible()) Combat.land(e.owner, t, e.move, t.x, t.y);
    },
    draw(g, e, c) {
      const k = e.life / e.max;
      g.save(); g.translate(e.x, e.y - 60);
      g.strokeStyle = c; g.lineWidth = 3; g.shadowColor = c; g.shadowBlur = 16;
      g.beginPath(); g.arc(0, 0, 12 + 30 * k, 0, 7); g.stroke();
      g.rotate(e.life * 0.08);
      g.beginPath();
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); }
      g.closePath(); g.stroke();
      g.restore();
    },
  },

  /* ---- VEX: the Siphon tether. The draining itself happens in her move;
         this is the line everyone can see, guests included. ---- */
  tether: {
    update(e) {
      const t = e.tgt, o = e.owner;
      if (!t || o.state !== ST.ATTACK || !o.attack || o.attack.kind !== "special" || !t.alive) return true;
      e.x = t.x; e.y = t.y;
      return false;
    },
    draw(g, e, c) {
      const o = e.owner;
      g.save();
      g.strokeStyle = hexA(c, 0.7); g.lineWidth = 3; g.shadowColor = c; g.shadowBlur = 14;
      g.setLineDash([6, 6]); g.lineDashOffset = -e.life * 2;
      g.beginPath(); g.moveTo(o.x, o.y - 8); g.lineTo(e.x, e.y); g.stroke();
      g.setLineDash([]);
      // drops of health running back along it
      for (let i = 0; i < 4; i++) {
        const t = ((e.life * 0.04 + i / 4) % 1);
        g.fillStyle = "#ff8fb0";
        g.beginPath(); g.arc(lerp(e.x, o.x, t), lerp(e.y, o.y - 8, t), 3.2, 0, 7); g.fill();
      }
      g.restore();
    },
  },
};
