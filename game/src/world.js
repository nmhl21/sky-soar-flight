// world.js — the canyon: terrain, winding river, runway, trees, mountains,
// clouds, sun and sky. One height function (heightAt) rules the mesh, the
// river, the ring heights and terrain collision, so they can never disagree.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeNoise2D, mulberry32 } from './random.js';

// The valley centreline wanders as the course runs south (-z).
export function valleyX(z) {
  return 55 * Math.sin(z * 0.0035) + 25 * Math.sin(z * 0.0013 + 1.7);
}

export function createWorld(scene, seed) {
  const noise = makeNoise2D(seed * 7919 + 13);
  const noise2 = makeNoise2D(seed * 104729 + 7);
  const rand = mulberry32(seed * 31 + 5);

  function heightAt(x, z) {
    const d = Math.abs(x - valleyX(z));
    const n = noise(x * 0.004, z * 0.004);
    const n2 = noise2(x * 0.016 + 7.3, z * 0.016);
    let h = 20 + n * 15 + n2 * 5;
    // Carve the valley floor out of the hills.
    h -= 30 * Math.exp(-(d * d) / (2 * 75 * 75));
    // Rocky mountains rise beyond the valley walls.
    const edge = Math.max(0, (d - 330) / 320);
    h += edge * edge * 120 + Math.max(0, n) * edge * 36;
    // Flatten an apron around the runway so the start is level ground.
    if (z > -110 && z < 130) {
      const fx = Math.max(0, 1 - Math.abs(x - valleyX(0)) / 70);
      const fz = Math.max(0, 1 - Math.max(0, -z - 60) / 60) * Math.max(0, 1 - Math.max(0, z - 90) / 60);
      const f = Math.min(fx, 1) * Math.min(fz + (z <= 60 ? 1 : 0), 1);
      h = h * (1 - f) + 12 * f;
    }
    return h;
  }

  // ---- Sky, fog, lights: one directional sun, one ambient fill. ----
  const sun = new THREE.DirectionalLight(CONFIG.sunDay, 2.6);
  sun.position.set(180, 320, 120);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfd9ff, 0.85));
  scene.background = new THREE.Color(CONFIG.skyDay);
  scene.fog = new THREE.Fog(CONFIG.fogDay, CONFIG.fogNear, CONFIG.fogFar);

  // ---- Terrain: 120x150 segments, vertex-coloured by height and slope. ----
  const W = 2600, L = 3800, SX = 120, SZ = 150;
  const geo = new THREE.PlaneGeometry(W, L, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0x58a83c), cDry = new THREE.Color(0x9a7b46);
  const cRock = new THREE.Color(0x8d7d6b), cSnow = new THREE.Color(0xf2f5f7);
  const cSand = new THREE.Color(0xd9c27a), cValley = new THREE.Color(0x3f8f3a);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) - 1500; // centre the mesh on the course
    const h = heightAt(x, z);
    pos.setY(i, h);
    pos.setZ(i, z);
    const d = Math.abs(x - valleyX(z));
    if (h > 78) tmp.copy(cSnow).lerp(cRock, Math.min(1, (h - 78) / 22));
    else if (h > 52) tmp.copy(cRock);
    else if (d < 26) tmp.copy(cSand).lerp(cValley, 0.45);
    else if (d < 130) tmp.copy(cValley).lerp(cGrass, d / 130);
    else tmp.copy(cGrass).lerp(cDry, Math.min(1, (h - 18) / 34));
    // Speckle so the slopes read at a glance.
    const sp = (noise(x * 0.11, z * 0.11) * 0.5 + 0.5) * 0.12;
    colors[i * 3] = tmp.r * (1 - sp) + sp * 0.4;
    colors[i * 3 + 1] = tmp.g * (1 - sp) + sp * 0.4;
    colors[i * 3 + 2] = tmp.b * (1 - sp) + sp * 0.35;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  scene.add(terrain);

  // ---- River: a blue ribbon following the valley floor. ----
  const riverPts = [];
  for (let z = 120; z >= -3050; z -= 40) {
    riverPts.push(new THREE.Vector3(valleyX(z), heightAt(valleyX(z), z) + 0.7, z));
  }
  const riverCurve = new THREE.CatmullRomCurve3(riverPts);
  const riverGeo = new THREE.PlaneGeometry(20, 1, 1, 160);
  riverGeo.rotateX(-Math.PI / 2);
  const rp = riverGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const t = (rp.getZ(i) + 0.5); // 0..1 along the ribbon
    const p = riverCurve.getPoint(t);
    const side = rp.getX(i);
    rp.setXYZ(i, p.x + side, p.y, p.z);
  }
  riverGeo.computeVertexNormals();
  const river = new THREE.Mesh(
    riverGeo,
    new THREE.MeshLambertMaterial({ color: 0x2fa8dd, transparent: true, opacity: 0.92 }),
  );
  scene.add(river);

  // ---- Runway: dark strip with white dashes and threshold bars. ----
  const runwayY = 12.55;
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 150),
    new THREE.MeshLambertMaterial({ color: 0x3a3f45 }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(valleyX(0), runwayY, 10);
  scene.add(runway);
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let z = -50; z <= 70; z += 15) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 7), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(valleyX(0), runwayY + 0.05, z);
    scene.add(dash);
  }
  for (const dz of [-62, 78]) {
    for (const dx of [-6, 0, 6]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(valleyX(0) + dx, runwayY + 0.05, dz);
      scene.add(bar);
    }
  }

  // ---- Trees: two InstancedMeshes (trunks + canopies), ~340 trees. ----
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 340 && guard++ < 6000) {
    const z = 120 - rand() * 3150;
    const side = rand() > 0.5 ? 1 : -1;
    const x = valleyX(z) + side * (45 + rand() * 260);
    const h = heightAt(x, z);
    if (h > 46) continue; // no trees on the rock
    treeSpots.push([x, h, z, 0.7 + rand() * 0.9]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const coneGeo = new THREE.ConeGeometry(3.4, 10, 6);
  const coneMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
  const canopies = new THREE.InstancedMesh(coneGeo, coneMat, treeSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  treeSpots.forEach(([x, h, z, sc], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
    s.set(sc, sc, sc);
    m4.compose(new THREE.Vector3(x, h + 2 * sc, z), q, s);
    trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, h + (4 + 5) * sc, z), q, s);
    canopies.setMatrixAt(i, m4);
  });
  scene.add(trunks); scene.add(canopies);

  // ---- Rocky peaks on the horizon, snow-capped. ----
  const peakMat = new THREE.MeshLambertMaterial({ color: 0x7d7468 });
  const snowMat = new THREE.MeshLambertMaterial({ color: 0xf4f7f9 });
  for (let i = 0; i < 16; i++) {
    const z = 200 - rand() * 3300;
    const side = i % 2 === 0 ? -1 : 1;
    const x = valleyX(z) + side * (720 + rand() * 420);
    const h = 150 + rand() * 130;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(150 + rand() * 90, h, 7), peakMat);
    peak.position.set(x, h / 2 - 8, z);
    scene.add(peak);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(52 + rand() * 26, h * 0.34, 7), snowMat);
    cap.position.set(x, h - 8 - h * 0.17, z);
    scene.add(cap);
  }

  // ---- Clouds: flat clusters of white spheres, drifting slowly. ----
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const clouds = [];
  for (let i = 0; i < 15; i++) {
    const g = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p++) {
      const r = 9 + rand() * 12;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
      puff.position.set((p - puffs / 2) * 11 + rand() * 5, rand() * 3, rand() * 8 - 4);
      puff.scale.y = 0.45;
      g.add(puff);
    }
    g.position.set(valleyX(-rand() * 3000) + (rand() - 0.5) * 700, 130 + rand() * 60, 100 - rand() * 3100);
    scene.add(g);
    clouds.push(g);
  }

  // ---- Sun disc in the sky, so the light has a visible source. ----
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, fog: false }),
  );
  sunDisc.position.set(360, 300, -900);
  sunDisc.lookAt(0, 40, -1400);
  scene.add(sunDisc);

  // ---- Blob shadow: a cheap dark ellipse that tracks the plane. ----
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(6, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  scene.add(blob);

  function setDawn() {
    scene.background.set(CONFIG.skyDawn);
    scene.fog.color.set(0xf7c9a0);
    sun.color.set(CONFIG.sunDawn);
    sun.position.set(-260, 90, 220);
    sun.intensity = 2.0;
    sunDisc.material.color.set(0xffd27a);
    sunDisc.position.set(-420, 110, -800);
  }
  function setDay() {
    scene.background.set(CONFIG.skyDay);
    scene.fog.color.set(CONFIG.fogDay);
    sun.color.set(CONFIG.sunDay);
    sun.position.set(180, 320, 120);
    sun.intensity = 2.6;
    sunDisc.material.color.set(0xfff6c9);
    sunDisc.position.set(360, 300, -900);
  }
  function updateBlob(x, z, altitude) {
    blob.position.set(x, heightAt(x, z) + 0.4, z);
    const k = Math.max(0.25, 1 - altitude / 160);
    blob.scale.setScalar(k);
    blob.material.opacity = 0.30 * k;
  }
  function driftClouds(dt) {
    for (const c of clouds) {
      c.position.x += dt * 1.5;
      if (c.position.x > 900) c.position.x = -900;
    }
  }
  return { heightAt, setDawn, setDay, updateBlob, driftClouds };
}
