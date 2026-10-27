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
    /* A key press belongs to exactly one simulation step. When a display
       frame runs two steps (common at 60Hz with any jitter), clearing only
       after the frame let both steps see the same press -- one keystroke in
       the room-code box typed its letter twice. */
    Keys.pressed = Object.create(null);
    Keys.tapped = Object.create(null);
    acc -= STEP;
    steps++;
  }
  if (steps === CFG.maxFrameSkip) acc = 0;

  RA = clamp(acc / STEP, 0, 1);
  Game.draw(RA);

  /* Menu screens hit-test inside draw(), so a click is consumed only after
     drawing — otherwise it would never reach a button. It used to be kept on
     frames that ran no simulation step, and on a 120Hz screen those are every
     other frame: the click survived onto the NEXT screen and pressed whatever
     sat under the cursor there (PICK STAGE fell straight through to BRAWL). */
  Mouse.click = false;
  requestAnimationFrame(frame);
}

Settings.load();
/* Canvas text never asks for a web font by itself, so fetch the UI weights up
   front; until they land the fallback face is drawn. */
try { for (const w of [500, 600, 700]) document.fonts.load(`${w} 16px "Chakra Petch"`); } catch (e) {}
Profile.boot();
Profile.applyFavourite();
Stage.select(STAGES[0]);

/* Pasting into the join box takes a bare code or a whole invite link. */
addEventListener("paste", e => {
  if (Game.screen !== "online" || Game.joinEntry === null) return;
  const text = ((e.clipboardData && e.clipboardData.getData("text")) || "").toUpperCase();
  const m = text.match(/JOIN=([A-Z0-9]{4})/) || text.match(/\b([A-Z0-9]{4})\b/);
  if (!m) return;
  e.preventDefault();
  Game.joinEntry = m[1];
  Snd.ui();
});

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
