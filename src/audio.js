// audio.js — tiny synthesised WebAudio only, no audio files.
// Engine hum whose pitch follows the throttle, a two-note chime per ring,
// a low thud on a hit. Everything starts on the first user gesture.
export function createAudio() {
  let ctx = null, engineOsc = null, engineGain = null, master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 70;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter).connect(engineGain).connect(master);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, at, dur, type = 'sine', vol = 0.5) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime + at);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + dur);
    o.connect(g).connect(master);
    o.start(ctx.currentTime + at);
    o.stop(ctx.currentTime + at + dur + 0.05);
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    update(throttle, flying, boost) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(58 + throttle * 95 + (boost ? 30 : 0), t, 0.08);
      engineGain.gain.setTargetAtTime(flying ? 0.05 + throttle * 0.06 : 0, t, 0.1);
    },
    ring() { blip(880, 0, 0.22); blip(1318, 0.09, 0.3); },
    hit() { blip(70, 0, 0.3, 'sine', 0.9); blip(48, 0.05, 0.35, 'triangle', 0.7); },
    crash() { blip(60, 0, 0.7, 'sawtooth', 0.6); blip(40, 0.15, 0.8, 'sine', 0.8); },
    click() { blip(660, 0, 0.08, 'square', 0.2); },
  };
}
