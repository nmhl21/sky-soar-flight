// input.js — keyboard + mouse. Arrow keys mirror W/S/A/D so either hand
// flies. Shift/Ctrl ride the throttle, Space boosts, P pauses, R restarts,
// M mutes, click starts or restarts. Keys are tracked as a held set so the
// sim can read them every frame.
export function createInput(callbacks) {
  const keys = new Set();
  const input = {
    get pitchUp() { return keys.has('KeyW') || keys.has('ArrowUp'); },
    get pitchDown() { return keys.has('KeyS') || keys.has('ArrowDown'); },
    get rollLeft() { return keys.has('KeyA') || keys.has('ArrowLeft'); },
    get rollRight() { return keys.has('KeyD') || keys.has('ArrowRight'); },
    get throttleUp() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    get throttleDown() { return keys.has('ControlLeft') || keys.has('ControlRight'); },
    get boost() { return keys.has('Space'); },
  };

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
  return input;
}
