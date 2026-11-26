// plane.js — the stunt plane, built from three.js primitives only:
// a tapered fuselage, bubble canopy, straight wings, tail, and a spinning
// two-blade propeller. Orange over white, with a dark stripe and wingtips.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createPlane() {
  const group = new THREE.Group();
  const orange = new THREE.MeshLambertMaterial({ color: CONFIG.planeOrange });
  const white = new THREE.MeshLambertMaterial({ color: CONFIG.planeWhite });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8ef });
  const stripe = new THREE.MeshLambertMaterial({ color: 0x14324a });

  // Fuselage: a cylinder tapered toward the tail, nose pointing -Z.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.45, 5.6, 10), orange);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  // Belly stripe along the fuselage.
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.47, 3.4, 10, 1, true, 0, Math.PI), stripe);
  belly.rotation.x = Math.PI / 2;
  belly.rotation.z = Math.PI;
  belly.position.y = -0.08;
  group.add(belly);
  // Nose cone + spinner.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.2, 10), white);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.4;
  group.add(nose);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 8), dark);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -4.2;
  group.add(spinner);
  // Canopy: a squashed glass dome.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), glass);
  canopy.scale.set(0.85, 0.62, 1.5);
  canopy.position.set(0, 0.62, -0.7);
  group.add(canopy);
  // Main wings: one wide slab with orange tips and a white centre.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.22, 1.7), white);
  wing.position.set(0, -0.05, -0.4);
  group.add(wing);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 1.7), orange);
    tip.position.set(s * 4.15, -0.05, -0.4);
    group.add(tip);
    // Wingtip nav light.
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color: s < 0 ? 0xff2222 : 0x22ff66 }),
    );
    lamp.position.set(s * 4.7, -0.05, -0.4);
    group.add(lamp);
  }
  // Tail: horizontal stabiliser + vertical fin, orange.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 1.0), orange);
  stab.position.set(0, 0.15, 2.5);
  group.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 1.2), orange);
  fin.position.set(0, 0.75, 2.5);
  group.add(fin);
  // Propeller: hub + two blades, spun by update().
  const prop = new THREE.Group();
  prop.position.z = -4.55;
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.4, 0.08), dark);
    blade.rotation.z = a;
    blade.position.y = 0;
    prop.add(blade);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), dark);
  prop.add(hub);
  group.add(prop);
  // Landing gear: two fixed wheels, visible on the runway.
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), dark);
    leg.position.set(s * 0.8, -0.85, -1.2);
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 0.8, -1.25, -1.2);
    group.add(wheel);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });

  let spin = 0;
  return {
    group,
    update(dt, throttle, flying) {
      spin += dt * (flying ? 18 + throttle * 42 : 2);
      prop.rotation.z = spin;
    },
  };
}
