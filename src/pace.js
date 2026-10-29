// Frame pacing. While something is happening (you're moving the camera, an agent is
// walking or teleporting) the office draws at full speed. When it's over, it draws one
// last frame and then stops completely until something changes: an idle office is a
// still picture and costs (almost) nothing.
//
// The one exception is "ambient" motion that carries meaning (a pulsing "needs you"
// ring): that keeps a gentle 15 fps while it's showing.
//
//   ?idlefps=20  keeps decorative motion (candles, starfields…) running while idle
export function makePacer(dom, controls, { linger = 1500 } = {}) {
  const idleFps = Math.max(0, Number(new URLSearchParams(location.search).get('idlefps')) || 0);
  let lastActive = performance.now(), lastDraw = 0, dirty = true;
  const poke = () => { lastActive = performance.now(); dirty = true; };
  for (const ev of ['pointerdown', 'wheel', 'keydown', 'touchstart']) dom.addEventListener(ev, poke, { passive: true });
  dom.addEventListener('pointermove', (e) => { if (e.buttons) poke(); }, { passive: true });
  controls?.addEventListener('change', poke);        // includes the damping glide after you let go
  addEventListener('resize', poke);
  document.addEventListener('visibilitychange', poke);
  return {
    poke,
    // something changed that should be shown once (a status, a usage reading, a new look…)
    invalidate() { dirty = true; },
    active(moving) { if (moving) poke(); return performance.now() - lastActive < linger; },
    // call once per animation frame; true when this frame should be drawn
    due(moving, ambient = false) {
      const now = performance.now();
      if (this.active(moving)) { lastDraw = now; dirty = true; return true; }   // dirty: one settling frame after
      const rate = ambient ? Math.max(idleFps, 15) : idleFps;
      if (rate > 0 && now - lastDraw >= 1000 / rate - 4) { lastDraw = now; dirty = false; return true; }
      if (dirty) { dirty = false; lastDraw = now; return true; }
      return false;
    },
  };
}
