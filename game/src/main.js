// main.js — bootstrap and the frame loop for Sky Soar: Canyon Run.
// Wires world + plane + rings + sim + input + audio + HUD together, runs the
// smooth chase camera, and freezes the scene for deterministic ?shot= modes.
import * as THREE from 'three';
import { CONFIG, SHOT_SEED } from './config.js';
import { createWorld } from './world.js';
import { createPlane } from './plane.js';
import { createRings } from './rings.js';
import { createSim, PHASE } from './sim.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { parseShot, applyShot } from './shots.js';

const canvasHost = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 4000);

const shot = parseShot();
const seed = shot.mode ? shot.seed : SHOT_SEED;
const world = createWorld(scene, seed);
const plane = createPlane();
scene.add(plane.group);
const rings = createRings(scene, world, seed);
const sim = createSim(world, rings);
const hud = createHud();
const audio = createAudio();

let shotView = null;
if (shot.mode) {
  shotView = applyShot(shot.mode, { sim, rings, world, hud, plane });
  camera.position.set(...shotView.camPos);
  camera.lookAt(...shotView.camLook);
}

// ---- Input: click / Enter starts, P pauses, R restarts, M mutes. ----
const input = createInput({
  onConfirm() {
    audio.unlock();
    audio.click();
    if (shot.mode) return; // staged shots stay frozen
    if (sim.state.phase === PHASE.TITLE || sim.state.phase === PHASE.CRASHED || sim.state.phase === PHASE.ENDED) {
      sim.reset();
      hud.showScreen(null, sim.state);
    } else if (sim.state.phase === PHASE.PAUSED) {
      sim.state.phase = PHASE.PLAYING;
      hud.showScreen(null, sim.state);
    }
  },
  onPause() {
    if (shot.mode) return;
    if (sim.state.phase === PHASE.PLAYING) {
      sim.state.phase = PHASE.PAUSED;
      hud.showScreen('pause', sim.state);
    } else if (sim.state.phase === PHASE.PAUSED) {
      sim.state.phase = PHASE.PLAYING;
      hud.showScreen(null, sim.state);
    }
  },
  onRestart() {
    if (shot.mode) return;
    audio.unlock();
    sim.reset();
    hud.showScreen(null, sim.state);
  },
  onMute() { audio.toggleMute(); },
});

// Chase camera: trails behind and above the plane with lag, never snaps.
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
function updateCamera(dt, snap) {
  const s = sim.state;
  const cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
  const fx = Math.sin(s.yaw) * cp, fy = sp, fz = -Math.cos(s.yaw) * cp;
  camTarget.set(
    s.x - fx * 15 + 0,
    s.y - fy * 15 + 4.5,
    s.z - fz * 15,
  );
  if (snap) camPos.copy(camTarget);
  else camPos.lerp(camTarget, 1 - Math.exp(-dt * 4.5));
  camera.position.copy(camPos);
  lookTarget.set(s.x + fx * 22, s.y + fy * 22, s.z + fz * 22);
  camera.lookAt(lookTarget);
}

function syncPlane() {
  const s = sim.state;
  plane.group.position.set(s.x, s.y, s.z);
  plane.group.rotation.order = 'YXZ';
  plane.group.rotation.y = s.yaw;
  plane.group.rotation.x = s.pitch;
  plane.group.rotation.z = -s.roll;
  world.updateBlob(s.x, s.z, s.y - world.heightAt(s.x, s.z));
}

function handleEvents(events) {
  for (const e of events) {
    if (e.type === 'ring') {
      hud.banner(`RING ${e.index + 1}!`, `+${CONFIG.ringScore + e.bonus} PTS`);
      audio.ring();
    } else if (e.type === 'hit') {
      hud.flashDamage();
      hud.banner('TERRAIN HIT!', `${CONFIG.hitsToCrash - e.damage} HITS LEFT`);
      audio.hit();
    } else if (e.type === 'crash') {
      audio.crash();
      hud.showScreen('end', sim.state);
    } else if (e.type === 'end') {
      hud.showScreen('end', sim.state);
    }
  }
}

// ---- Frame loop: fixed-step sim (1/60 s), so sorties run at real speed
// even when SwiftShader renders slowly, then render. ----
const clock = new THREE.Clock();
const STEP = 1 / 60;
let acc = 0;
let firstFrame = true;
function frame() {
  requestAnimationFrame(frame);
  const rawDt = Math.min(clock.getDelta(), 0.25);
  // Altitude above ground level, for the HUD altimeter.
  sim.state.agl = sim.state.y - world.heightAt(sim.state.x, sim.state.z);
  if (shotView) {
    // Frozen staged shot: one fixed pose, prop still, clouds still.
    syncPlane();
    plane.update(0, sim.state.throttle, false);
    rings.update(0);
    hud.update(sim.state, sim, rings.nextRing());
    renderer.render(scene, camera);
  } else {
    acc += rawDt;
    let n = 0;
    while (acc >= STEP && n < 15) {
      handleEvents(sim.step(STEP, input));
      acc -= STEP;
      n++;
    }
    if (n === 15) acc = 0; // drop backlog after a long hitch, never spiral
    syncPlane();
    plane.update(rawDt, sim.state.throttle, sim.state.phase === PHASE.PLAYING);
    rings.update(rawDt);
    world.driftClouds(rawDt);
    audio.update(sim.state.throttle, sim.state.phase === PHASE.PLAYING, sim.state.boost);
    updateCamera(rawDt, firstFrame);
    hud.update(sim.state, sim, rings.nextRing());
    renderer.render(scene, camera);
  }
  if (firstFrame) {
    firstFrame = false;
    window.__skysoarReady = true;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Debug / test hook: live state for automated checks, no gameplay effect.
window.__skysoar = {
  get state() { return sim.state; },
  get phase() { return sim.state.phase; },
  get score() { return sim.state.score; },
  get ringsPassed() { return sim.state.ringsPassed; },
  get nextRing() {
    const r = rings.nextRing();
    return r ? { x: r.x, y: r.y, z: r.z } : null;
  },
  reset() { sim.reset(); hud.showScreen(null, sim.state); },
};

if (!shot.mode) hud.showScreen('title', sim.state);
syncPlane();
if (!shotView) updateCamera(1, true); // staged shots keep their own camera
frame();
