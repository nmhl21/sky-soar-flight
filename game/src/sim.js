// sim.js — the flight model and the sortie rules. No rendering here:
// step() advances position, speed, fuel, timer and damage from the input,
// and reports events (ring, hit, crash, time-up) for the HUD and audio.
import { CONFIG } from './config.js';
import { valleyX } from './world.js';

export const PHASE = {
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  CRASHED: 'crashed',
  ENDED: 'ended',
};

export function createSim(world, rings) {
  const startX = valleyX(0);
  const startY = 12 + 2.2; // on the runway

  const state = {
    phase: PHASE.TITLE,
    x: startX, y: startY, z: 40,
    yaw: 0, pitch: 0, roll: 0,
    speed: 0, throttle: 0.55,
    fuel: CONFIG.fuelMax,
    score: 0,
    ringsPassed: 0,
    timeLeft: CONFIG.timeLimit,
    damage: 0,
    best: 0,
    boost: false,
    invulnerable: 0,
    message: '',
  };
  let events = [];

  function reset() {
    Object.assign(state, {
      phase: PHASE.PLAYING,
      x: startX, y: startY, z: 40,
      yaw: 0, pitch: 0, roll: 0,
      speed: CONFIG.minSpeed, throttle: 0.55,
      fuel: CONFIG.fuelMax, score: 0, ringsPassed: 0,
      timeLeft: CONFIG.timeLimit, damage: 0, boost: false,
      invulnerable: 0, message: '',
    });
    rings.reset();
    events = [];
  }

  function step(dt, input) {
    if (state.phase !== PHASE.PLAYING) return events.splice(0);
    events = [];

    // Throttle: Shift up, Ctrl down, clamped 0..1.
    if (input.throttleUp) state.throttle = Math.min(1, state.throttle + dt * 0.7);
    if (input.throttleDown) state.throttle = Math.max(0, state.throttle - dt * 0.7);
    state.boost = input.boost && state.fuel > 0;

    // Stick: W/S pitch, A/D roll; the wings level themselves when free.
    const pitchIn = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
    const rollIn = (input.rollRight ? 1 : 0) - (input.rollLeft ? 1 : 0);
    state.pitch = clamp(state.pitch + pitchIn * CONFIG.pitchRate * dt, -CONFIG.maxPitch, CONFIG.maxPitch);
    state.roll = clamp(state.roll + rollIn * CONFIG.rollRate * dt, -CONFIG.maxRoll, CONFIG.maxRoll);
    if (rollIn === 0) state.roll = approach(state.roll, 0, dt * 0.9);
    if (pitchIn === 0) state.pitch = approach(state.pitch, 0, dt * 0.5);

    // Bank turns the plane; pitch trades speed for altitude and back.
    state.yaw += state.roll * CONFIG.turnRate * dt * (0.5 + state.speed / CONFIG.maxSpeed);
    const targetSpeed = CONFIG.minSpeed + state.throttle * (CONFIG.maxSpeed - CONFIG.minSpeed)
      + (state.boost ? CONFIG.boostSpeed : 0);
    state.speed = approach(state.speed, targetSpeed, dt * 14);
    const cp = Math.cos(state.pitch);
    const fx = Math.sin(state.yaw) * cp;
    const fy = Math.sin(state.pitch);
    const fz = -Math.cos(state.yaw) * cp;
    state.x += fx * state.speed * dt;
    state.z += fz * state.speed * dt;
    // Climb costs speed, diving gains it; idle throttle makes you sink.
    state.y += (fy * state.speed - (1 - state.throttle) * CONFIG.climbSink * 0.4) * dt;
    if (state.y < 4) state.y = 4;

    // Fuel: throttle burns it, boost burns it fast, empty means idle only.
    const drain = CONFIG.fuelIdleDrain + state.throttle * CONFIG.fuelDrain
      + (state.boost ? CONFIG.fuelBoostDrain : 0);
    state.fuel = Math.max(0, state.fuel - drain * dt);
    if (state.fuel <= 0) state.throttle = Math.min(state.throttle, 0.15);

    // Timer.
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.phase = PHASE.ENDED;
      state.best = Math.max(state.best, state.score);
      events.push({ type: 'end', reason: 'time' });
      return events;
    }

    // Rings.
    const hit = rings.checkPass(state.x, state.y, state.z);
    if (hit >= 0) {
      state.ringsPassed++;
      const bonus = state.speed > 55 ? 25 : 0;
      state.score += CONFIG.ringScore + bonus;
      events.push({ type: 'ring', index: hit, bonus });
    }
    if (state.ringsPassed >= rings.count) {
      state.phase = PHASE.ENDED;
      state.best = Math.max(state.best, state.score);
      events.push({ type: 'end', reason: 'course' });
      return events;
    }

    // Terrain collision: 3 hits and the sortie is over.
    if (state.invulnerable > 0) state.invulnerable -= dt;
    const ground = world.heightAt(state.x, state.z);
    if (state.y < ground + 2.0 && state.invulnerable <= 0) {
      state.damage++;
      state.invulnerable = 1.6;
      state.y = ground + 7;
      state.speed *= 0.55;
      state.pitch = Math.abs(state.pitch) * 0.4;
      events.push({ type: 'hit', damage: state.damage });
      if (state.damage >= CONFIG.hitsToCrash) {
        state.phase = PHASE.CRASHED;
        state.best = Math.max(state.best, state.score);
        events.push({ type: 'crash' });
      }
    }
    return events;
  }

  function headingDeg() {
    let deg = (-state.yaw * 180) / Math.PI;
    deg = ((deg % 360) + 360) % 360;
    return Math.round(deg);
  }

  return { state, reset, step, headingDeg };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function approach(v, target, delta) {
  if (v < target) return Math.min(target, v + delta);
  if (v > target) return Math.max(target, v - delta);
  return v;
}
