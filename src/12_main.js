/* ==========================================================================
   13. MAIN — fixed-timestep loop with interpolated rendering

   The simulation always runs at exactly 60Hz so the fight is deterministic,
   but drawing happens as often as the display allows and interpolates between
   the last two simulated frames. That is what makes it feel smooth on a 120Hz
   or 144Hz screen instead of visibly stepping.
   ========================================================================== */

const STEP = 1000 / CFG.fps;
let acc = 0, last = performance.now();

cv.addEventListener("mousemove", e => {
  const r = cv.getBoundingClientRect();
  Mouse.x = (e.clientX - r.left) / r.width * W;
  Mouse.y = (e.clientY - r.top) / r.height * H;
});
cv.addEventListener("mousedown", () => {
  Mouse.down = true; Mouse.click = true;
  Snd.init(); Snd.resume();
});
cv.addEventListener("mouseup", () => { Mouse.down = false; });
cv.addEventListener("contextmenu", e => e.preventDefault());

function frame(now) {
  let dt = now - last;
  last = now;
  if (dt > 250) dt = STEP;        // tab was hidden; don't fast-forward
  acc += dt;

  let steps = 0;
  while (acc >= STEP && steps < CFG.maxFrameSkip) {
    Game.update();
    acc -= STEP;
    steps++;
  }
  if (steps === CFG.maxFrameSkip) acc = 0;

  RA = clamp(acc / STEP, 0, 1);
  Game.draw(RA);

  /* Menu screens hit-test inside draw(), so one-shot edges are consumed only
     after drawing — otherwise a click would never reach a button. */
  if (steps > 0) {
    Keys.pressed = Object.create(null);
    Mouse.click = false;
  }
  requestAnimationFrame(frame);
}

Settings.load();
Stage.select(STAGES[0]);

/* An invite link (?join=ABCD) skips the menus and joins that room. The code
   is stripped from the address bar so a refresh doesn't rejoin a dead room. */
{
  const code = (new URLSearchParams(location.search).get("join") || "").toUpperCase();
  if (/^[A-Z0-9]{4}$/.test(code)) {
    history.replaceState(null, "", location.pathname);
    Game.screen = "online";
    Net.join(code);
  }
}
fitCanvas();
Snd.init();
requestAnimationFrame(frame);
