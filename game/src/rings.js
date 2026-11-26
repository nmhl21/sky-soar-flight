// rings.js — the ring course: glowing torus gates hung over the river,
// one at a time the "next" gate, bright gold; passed gates go green and dim.
// checkPass() spots the plane crossing a gate's plane inside its radius.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { valleyX } from './world.js';

export function createRings(scene, world, seed) {
  const rings = [];
  const group = new THREE.Group();
  scene.add(group);

  for (let i = 0; i < CONFIG.ringCount; i++) {
    const z = CONFIG.firstRingZ - i * CONFIG.ringSpacing;
    const x = valleyX(z) + Math.sin(i * 1.3 + seed) * 26;
    const y = world.heightAt(x, z) + 24 + Math.sin(i * 0.9) * 6;
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(CONFIG.ringRadius, 1.1, 10, 40),
      new THREE.MeshBasicMaterial({ color: CONFIG.ringNext }),
    );
    torus.position.set(x, y, z);
    // Face the gate down the course (toward +z, where the plane comes from).
    torus.rotation.y = Math.atan2(valleyX(z - 60) - valleyX(z + 60), 120);
    group.add(torus);
    // Outer glow halo, same centre, slightly larger and translucent.
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(CONFIG.ringRadius + 2.2, 0.55, 8, 40),
      new THREE.MeshBasicMaterial({ color: CONFIG.ringNext, transparent: true, opacity: 0.4 }),
    );
    halo.position.copy(torus.position);
    halo.rotation.copy(torus.rotation);
    group.add(halo);
    // A faint light pillar so the next gate is visible from far away.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 90, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: CONFIG.ringNext, transparent: true, opacity: 0.10,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    beam.position.set(x, y + 45, z);
    group.add(beam);
    rings.push({
      index: i, x, y, z, torus, halo, beam,
      passed: false, prevSide: null,
    });
  }

  let nextIndex = 0;
  let pulse = 0;

  function markNext() {
    rings.forEach((r, i) => {
      if (r.passed) {
        r.torus.material.color.set(CONFIG.ringGlow);
        r.halo.material.color.set(CONFIG.ringGlow);
        r.halo.material.opacity = 0.18;
        r.beam.visible = false;
      } else if (i === nextIndex) {
        r.torus.material.color.set(CONFIG.ringNext);
        r.halo.material.color.set(CONFIG.ringNext);
        r.halo.material.opacity = 0.45;
        r.beam.visible = true;
      } else {
        r.torus.material.color.set(0xffffff);
        r.halo.material.color.set(0xffffff);
        r.halo.material.opacity = 0.25;
        r.beam.visible = false;
      }
    });
  }
  markNext();

  return {
    rings,
    get nextIndex() { return nextIndex; },
    get count() { return CONFIG.ringCount; },
    get passedCount() { return rings.filter((r) => r.passed).length; },
    nextRing() { return rings[nextIndex] ?? null; },
    reset() {
      nextIndex = 0;
      rings.forEach((r) => { r.passed = false; r.prevSide = null; });
      markNext();
    },
    // Stage helper for screenshots: mark the first n gates as flown.
    setPassed(n) {
      rings.forEach((r, i) => { r.passed = i < n; r.prevSide = null; });
      nextIndex = Math.min(n, rings.length);
      markNext();
    },
    update(dt) {
      pulse += dt * 3;
      const s = 1 + Math.sin(pulse) * 0.05;
      const next = rings[nextIndex];
      if (next) next.halo.scale.setScalar(s);
    },
    // Returns the ring index just flown through, or -1.
    checkPass(px, py, pz) {
      for (const r of rings) {
        if (r.passed) continue;
        const side = pz - r.z; // plane approaches from +z
        if (r.prevSide !== null && r.prevSide > 0 && side <= 0) {
          const dx = px - r.x, dy = py - r.y;
          if (Math.hypot(dx, dy) < CONFIG.ringRadius - 1) {
            r.passed = true;
            if (r.index === nextIndex) nextIndex = Math.min(nextIndex + 1, rings.length);
            markNext();
            return r.index;
          }
        }
        r.prevSide = side;
      }
      return -1;
    },
  };
}
