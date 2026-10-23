/* ==========================================================================
   COOL MATT BRAWL — 1. CONFIG
   Every tunable number in the game lives in this file.
   ========================================================================== */
"use strict";

const CFG = {
  // ---- canvas / world ----
  view:  { w: 1280, h: 720 },
  world: { w: 1600, h: 900 },

  // ---- simulation ----
  fps: 60,
  maxFrameSkip: 5,

  // ---- physics ----
  gravity:        0.62,
  maxFall:        14.0,
  fastFallMul:    1.75,
  airDrag:        0.955,
  groundFriction: 0.80,
  slideStrength:  0.70,
  slopeFrictionLoss: 0.85,
  landLag:        3,

  // ---- jumps ----
  jumpSquat:   3,
  airJumps:    1,
  shortHopMul: 0.62,

  // ---- knockback ----
  kbBase:         1.0,
  kbPercentScale: 0.105,
  kbDamageScale:  0.42,
  kbWeightRef:    1.0,
  hitstunPerKb:   2.10,
  hitstunMax:     60,
  hitPauseBase:   4,
  hitPausePerDmg: 0.42,
  diStrength:     0.22,

  // ---- shields / dodges ----
  shieldMax:       100,
  shieldRegen:     0.35,
  shieldDrainIdle: 0.22,
  shieldDamageMul: 1.15,
  shieldBreakStun: 110,
  rollFrames:      22,
  rollSpeed:       9.5,
  spotDodgeFrames: 20,
  airDodgeFrames:  26,
  airDodgeSpeed:   11,
  dodgeInvuln:     [4, 16],

  // ---- grabs ----
  grabStartup:  5,
  grabActive:   4,
  grabRecovery: 18,
  grabHoldBase: 48,
  pummelDamage: 2.2,
  throwDamage:  8,

  // ---- stocks / match ----
  stocks:        3,
  respawnFrames: 60,
  respawnInvuln: 110,
  matchSeconds:  180,
  /* The last stretch of the clock is a FRENZY: meter fills twice as fast, so
     the end of a close match is decided by supers instead of running down. */
  frenzySeconds: 30,
  /* A time-out with the stocks level is not a draw any more. The tied sides
     come back on one stock at suddenDeathPercent and fight it out. */
  suddenDeathPercent: 150,
  suddenDeathSeconds: 45,
  /* A hit with at least this much knockback is announced as a SMASH: it is
     very likely to take a stock, and the player should feel that. */
  smashKb: 15.5,

  // ---- SUPER METER ----
  /* ---- SUPER METER ----
     Tuned down from the first pass, where a super arrived roughly every 80
     damage dealt and the passive trickle alone filled the bar in under two
     minutes — so supers landed constantly and decided matches on their own.
     They are now something you earn by actually fighting. */
  meter: {
    max:          100,
    onDeal:       0.80,   // per point of damage dealt (was 1.25)
    onTake:       0.50,   // per point taken (comebacks) (was 0.75)
    passive:      0.004,  // a safety net, not a source (was 0.016)
    frenzyMul:    2.0,    // every gain is doubled in the final stretch
    superArmor:   true,   // supers resist knockback during their active window
    superArmorHp: 16,     // ...but that armour BREAKS above this much damage,
                          //    so a committed super can be contested
  },

  /* ---- SKILL ----
     Levers that reward precision and variety over mashing one good button. */
  skill: {
    // Repeating a move makes it weaker; rotating keeps your damage up.
    staleSteps:  [1.0, 0.90, 0.82, 0.75, 0.70],
    staleWindow: 6,      // how many recent connects are remembered
    staleRefresh: 600,   // frames before a stale entry freshens again
    // Connecting with the outer edge of a hitbox pays more than hugging.
    tipBonus:    1.16,
    tipZone:     0.60,   // fraction of hitbox radius that counts as the tip
    // A clean hit refunds some endlag; a whiff pays it all.
    hitConfirmCut: 0.25,
  },

  /* ---- CAMERA ----
     The v1 camera chased the exact midpoint of all fighters every frame, so it
     drifted side to side constantly. This one holds still until the action
     actually leaves a dead zone, then eases with a critically damped spring. */
  cam: {
    deadX:     190,   // half-width of the dead zone, in world units
    deadY:     120,   // half-height
    follow:    0.055, // how fast the camera closes on its target
    zoomLerp:  0.030,
    pad:       330,
    minZoom:   0.62,
    maxZoom:   1.04,
    zoomStep:  0.04,  // zoom quantisation — kills micro-breathing
    maxShake:  26,
    shakeDecay: 0.80,
  },

  // ---- feel ----
  maxParticles: 900,

  // ---- cpu ----
  cpu: { aggression: 0.95, dodgeChance: 0.012, superChance: 0.02 },

  // ---- player settings (persisted; see Settings) ----
  defaults: {
    shakeAmount: 1.0,   // 0 disables screen shake entirely
    cameraSway:  1.0,   // 0 pins the camera dead centre
    particles:   1.0,
    showHitboxGlow: true,
    musicOn:     true,
    sfxOn:       true,
    postFx:      1.0,   // bloom, chromatic aberration and vignette; 0 disables
  },
};

const W = CFG.view.w, H = CFG.view.h;

/* Per-player accent used for tags, stock pips and slot cards. */
const PLAYER_TINT = ["#ff5fa2", "#4fe8ff", "#caff6e", "#ffd76b"];

/* 2v2: in a team match every fighter's tag, ring and card wear their team's
   colour instead of their player colour, so sides read at a glance. */
const TEAM_TINT = ["#ff4f6a", "#3fa8ff"];
const TEAM_NAME = ["RED", "BLUE"];

/** True when two fighters are on the same side. Free-for-all has no teams,
    so there the only ally a fighter has is itself. */
function allies(a, b) {
  return a === b || (a.team != null && a.team === b.team);
}
