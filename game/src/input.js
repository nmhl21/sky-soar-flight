// input.js — keyboard + mouse + touch. Arrow keys mirror W/S/A/D so either
// hand flies. Shift/Ctrl ride the throttle, Space boosts, P pauses, R
// restarts, M mutes, click starts or restarts. On touch devices a virtual
// joystick (left) steers and THR/BOOST buttons (right) ride the throttle;
// on desktop, dragging the mouse on the canvas steers the same way. Keys
// are tracked as a held set so the sim can read them every frame.
export function createInput(callbacks) {
  const keys = new Set();
  // Touch / drag-steer state: stick deflection -1..1, plus held buttons.
  // The sim only reads booleans, so analog deflection is thresholded.
  const touch = { pitch: 0, roll: 0, thrUp: false, thrDown: false, boost: false };
  const DEAD = 0.3;
  const input = {
    get pitchUp() { return keys.has('KeyW') || keys.has('ArrowUp') || touch.pitch < -DEAD; },
    get pitchDown() { return keys.has('KeyS') || keys.has('ArrowDown') || touch.pitch > DEAD; },
    get rollLeft() { return keys.has('KeyA') || keys.has('ArrowLeft') || touch.roll < -DEAD; },
    get rollRight() { return keys.has('KeyD') || keys.has('ArrowRight') || touch.roll > DEAD; },
    get throttleUp() { return keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.thrUp; },
    get throttleDown() { return keys.has('ControlLeft') || keys.has('ControlRight') || touch.thrDown; },
    get boost() { return keys.has('Space') || touch.boost; },
  };
  // Test/debug hook (no gameplay effect): live touch state.
  input.touch = touch;

  function onKeyDown(e) {
    if (e.code === 'Space') e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyP') callbacks.onPause();
    else if (e.code === 'KeyR') callbacks.onRestart();
    else if (e.code === 'KeyM') callbacks.onMute();
    else if (e.code === 'Enter' || e.code === 'Space') callbacks.onConfirm();
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseDown() { callbacks.onConfirm(); }
  function onBlur() { keys.clear(); }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('blur', onBlur);

  // ---- Touch UI: only on coarse-pointer devices, never in staged shots. ----
  const isShot = new URLSearchParams(window.location.search).has('shot');
  const isTouch = !isShot && (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
  if (isTouch) buildTouchUI();
  buildDragSteer();

  function buildTouchUI() {
    const ui = document.createElement('div');
    ui.id = 'touch-ui';
    ui.innerHTML =
      '<div id="stick-base"><div id="stick-knob"></div></div>' +
      '<div id="touch-btns">' +
      '<button type="button" id="btn-thr-down" aria-label="Throttle down">THR&minus;</button>' +
      '<button type="button" id="btn-boost" aria-label="Boost">BOOST</button>' +
      '<button type="button" id="btn-thr-up" aria-label="Throttle up">THR+</button>' +
      '</div>';
    document.body.appendChild(ui);

    const base = ui.querySelector('#stick-base');
    const knob = ui.querySelector('#stick-knob');
    const R = 40; // max knob travel in px
    let stickId = null;
    function stickCenter() {
      const r = base.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    function stickMove(e) {
      const c = stickCenter();
      let dx = e.clientX - c.x, dy = e.clientY - c.y;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      touch.roll = dx / R;
      touch.pitch = dy / R; // up on screen (dy<0) = pitch up, same as W
    }
    function stickEnd(e) {
      if (e.pointerId !== stickId) return;
      stickId = null;
      touch.pitch = 0; touch.roll = 0;
      knob.style.transform = 'translate(-50%, -50%)';
      try { base.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
    }
    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stickId = e.pointerId;
      try { base.setPointerCapture(e.pointerId); } catch (_) { /* no capture */ }
      stickMove(e);
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId === stickId) { e.preventDefault(); stickMove(e); }
    });
    base.addEventListener('pointerup', stickEnd);
    base.addEventListener('pointercancel', stickEnd);

    // Hold-to-run buttons: pointerdown sets, pointerup/cancel clears.
    function holdButton(el, prop) {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        touch[prop] = true;
        el.classList.add('held');
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* no capture */ }
      });
      const release = () => { touch[prop] = false; el.classList.remove('held'); };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
    }
    holdButton(ui.querySelector('#btn-thr-up'), 'thrUp');
    holdButton(ui.querySelector('#btn-thr-down'), 'thrDown');
    holdButton(ui.querySelector('#btn-boost'), 'boost');
  }

  // ---- Mouse drag-steer on desktop: drag on the canvas steers, a plain
  // click still starts/restarts via the existing mousedown handler. ----
  function buildDragSteer() {
    const canvas = document.querySelector('#game canvas');
    if (!canvas) return;
    let dragId = null, startX = 0, startY = 0, dragging = false;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragId = e.pointerId; startX = e.clientX; startY = e.clientY; dragging = false;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== dragId) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) > 8) dragging = true;
      if (dragging) {
        touch.roll = Math.max(-1, Math.min(1, dx / 60));
        touch.pitch = Math.max(-1, Math.min(1, dy / 60));
      }
    });
    const end = (e) => {
      if (e.pointerId !== dragId) return;
      dragId = null;
      if (dragging) { touch.pitch = 0; touch.roll = 0; }
      dragging = false;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  return input;
}
