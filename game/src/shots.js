// shots.js — deterministic staged shots for the dossier screenshots.
// Each mode pins the plane, the camera, the light and the overlays to one
// fixed state, then freezes the sim, so the same URL renders the same frame
// on every load. Modes: start | play | ring | end.
import { CONFIG } from './config.js';
import { PHASE } from './sim.js';
import { valleyX } from './world.js';

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  const mode = q.get('shot');
  const seed = Number.parseInt(q.get('seed') || '1', 10) || 1;
  if (mode === 'start' || mode === 'play' || mode === 'ring' || mode === 'end') {
    return { mode, seed };
  }
  return { mode: null, seed };
}

// Chase framing: camera trails the plane along its forward vector, the same
// geometry the live chase camera uses, so staged shots frame like gameplay.
function chaseView(s, dist = 15, height = 4.5, lookDist = 30) {
  const cp = Math.cos(s.pitch);
  const fx = Math.sin(s.yaw) * cp, fy = Math.sin(s.pitch), fz = -Math.cos(s.yaw) * cp;
  return {
    camPos: [s.x - fx * dist, s.y - fy * dist + height, s.z - fz * dist],
    camLook: [s.x + fx * lookDist, s.y + fy * lookDist, s.z + fz * lookDist],
    frozen: true,
  };
}

export function applyShot(mode, ctx) {
  const { sim, rings, world, hud, plane } = ctx;
  const s = sim.state;
  const ringAt = (i) => rings.rings[Math.min(i, rings.rings.length - 1)];

  if (mode === 'start') {
    world.setDawn();
    sim.reset();
    s.phase = PHASE.TITLE;
    s.throttle = 0.35;
    s.speed = 0;
    s.x = valleyX(0); s.y = 14.2; s.z = 40;
    s.yaw = 0; s.pitch = 0; s.roll = 0;
    hud.showScreen('title', s);
    return {
      camPos: [s.x + 10, s.y + 4, s.z + 15],
      camLook: [s.x + 2, s.y + 2, s.z - 30],
      frozen: true,
    };
  }

  if (mode === 'play') {
    world.setDay();
    sim.reset();
    s.phase = PHASE.PLAYING;
    // Mid-course: three rings banked, fourth dead ahead, throttle high.
    const r = ringAt(3);
    s.x = r.x - 14; s.y = r.y + 4; s.z = r.z + 175;
    s.yaw = 0.1; s.pitch = 0.06; s.roll = -0.18;
    s.speed = 62; s.throttle = 0.8; s.fuel = 71;
    s.score = 300; s.ringsPassed = 3; s.timeLeft = 82;
    rings.setPassed(3);
    hud.showScreen(null, s);
    return chaseView(s, 16, 5, 60);
  }

  if (mode === 'ring') {
    world.setDay();
    sim.reset();
    s.phase = PHASE.PLAYING;
    const r = ringAt(5);
    s.x = r.x; s.y = r.y; s.z = r.z + 26;
    s.yaw = 0; s.pitch = 0.02; s.roll = 0.1;
    s.speed = 68; s.throttle = 0.9; s.fuel = 58;
    s.score = 500; s.ringsPassed = 5; s.timeLeft = 64;
    rings.setPassed(5);
    hud.showScreen(null, s);
    hud.banner('RING 6!', '+100 PTS', true);
    return chaseView(s, 13, 3.5, 50);
  }

  // end: game-over screen over the canyon, score tallied.
  world.setDay();
  sim.reset();
  s.phase = PHASE.ENDED;
  s.score = 1200; s.ringsPassed = 12; s.timeLeft = 0;
  s.fuel = 12; s.best = 1200; s.damage = 1;
  s.x = valleyX(-2400); s.y = world.heightAt(valleyX(-2400), -2400) + 3; s.z = -2400;
  s.yaw = 0.4; s.pitch = 0; s.roll = 0;
  rings.setPassed(12);
  hud.showScreen('end', s);
  plane.group.position.set(s.x, s.y, s.z);
  plane.group.rotation.set(0, s.yaw, 0);
  return chaseView(s, 18, 7, 60);
}
