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

  // ---- SUPER METER ----
  meter: {
    max:          100,
    onDeal:       1.25,   // per point of damage dealt
    onTake:       0.75,   // per point taken (comebacks)
    onSnapback:   18,     // for causing a Snap-Back
    passive:      0.016,  // trickle per frame so supers always eventually come
    superArmor:   true,   // supers ignore knockback during their active window
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
  },
};

const W = CFG.view.w, H = CFG.view.h;

/* Per-player accent used for tags, stock pips and slot cards. */
const PLAYER_TINT = ["#ff5fa2", "#4fe8ff", "#caff6e", "#ffd76b"];
