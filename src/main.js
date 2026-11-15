import * as THREE from 'three';
import { spawnFruit, FRUIT_CATALOG } from './fruits.js';
import { createPhysics, makeBody } from './physics.js';
import { createKnife } from './knife.js';
import { createSlicer } from './slicer.js';
import { createStudio } from './studio.js';

// ── Loader ────────────────────────────────────────────────────────
const loaderEl   = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderText = document.getElementById('loader-text');
function setP(p, t) { loaderFill.style.width = p + '%'; loaderText.textContent = t; }
function hideLoader() { loaderEl.classList.add('hidden'); setTimeout(() => loaderEl.remove(), 700); }

// ── Renderer ──────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
setP(10, 'Renderer…');

// ── Scene ─────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8e8e6);

// ── Camera ────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 11);
camera.lookAt(0, 0, 0);

setP(20, 'Lighting…');

// ── Lighting — bright studio ──────────────────────────────────────
// Strong top-left key
const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
keyLight.position.set(-4, 8, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far  = 40;
keyLight.shadow.camera.left   = -9;
keyLight.shadow.camera.right  =  9;
keyLight.shadow.camera.top    =  9;
keyLight.shadow.camera.bottom = -9;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

// Soft fill from the right
const fillLight = new THREE.DirectionalLight(0xddeeff, 1.8);
fillLight.position.set(6, 4, 2);
scene.add(fillLight);

// Rim from behind
const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
rimLight.position.set(0, 3, -8);
scene.add(rimLight);

// Ambient — warm neutral
scene.add(new THREE.AmbientLight(0xffffff, 1.6));
scene.add(new THREE.HemisphereLight(0xffffff, 0xd0cfc8, 0.9));

setP(32, 'Environment…');

// ── Studio / floor ────────────────────────────────────────────────
const studio = createStudio(scene);

setP(48, 'Physics…');

// ── Physics ───────────────────────────────────────────────────────
const physics = createPhysics();

// Jelly softness setting (0 = rigid, 1 = very soft)
let jellyAmount = 0.7;   // default "Soft"

setP(60, 'Knife…');

// ── Knife (hidden until "Knife" mode) ────────────────────────────
const knife = createKnife(scene);

setP(70, 'Fruits…');

// ── Fruit bodies ──────────────────────────────────────────────────
const bodies = [];   // { body, fruitData, labelEl, index }

function spawnFruitAt(type, pos, vel, spin) {
  const fd = spawnFruit(type, pos);
  scene.add(fd.group);
  const spinVec = spin || new THREE.Vector3(
    (Math.random() - 0.5) * 2.5,
    (Math.random() - 0.5) * 2.5,
    (Math.random() - 0.5) * 2.5
  );
  const body = makeBody(fd, vel || new THREE.Vector3(), spinVec, 0.55);
  physics.add(body);

  // Label pill
  const labelEl = createLabel(fd.label);
  const idx = bodies.filter(b => b.fruitData.type === type).length + 1;
  labelEl.querySelector('.label-text').textContent =
    `${fd.label} ${String(idx).padStart(2, '0')}`;

  bodies.push({ body, fruitData: fd, labelEl, index: idx });
  return { body, fruitData: fd };
}

function removeBody(entry) {
  physics.remove(entry.body);
  scene.remove(entry.fruitData.group);
  if (entry.labelEl && entry.labelEl.parentNode) entry.labelEl.remove();
  const i = bodies.indexOf(entry);
  if (i !== -1) bodies.splice(i, 1);
}

function clearAll() {
  for (const entry of [...bodies]) removeBody(entry);
}

// ── Label pills ───────────────────────────────────────────────────
function createLabel(text) {
  const el = document.createElement('div');
  el.className = 'fruit-label';
  el.innerHTML = `<span class="label-dot"></span><span class="label-text">${text}</span>`;
  el.style.opacity = '0';
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '1'; }, 100);
  return el;
}

let showTags = true;

function updateLabels() {
  const rect = canvas.getBoundingClientRect();
  for (const entry of bodies) {
    const el = entry.labelEl;
    if (!el) continue;
    if (!showTags) { el.style.display = 'none'; continue; }
    el.style.display = 'flex';

    // Project fruit centre to screen
    const wp = entry.fruitData.group.position.clone();
    wp.y += entry.fruitData.radius * 1.1; // anchor above fruit
    const proj = wp.project(camera);

    if (proj.z > 1) { el.style.opacity = '0'; continue; }

    const sx = (proj.x * 0.5 + 0.5) * rect.width  + rect.left;
    const sy = (-proj.y * 0.5 + 0.5) * rect.height + rect.top;

    el.style.left    = sx + 'px';
    el.style.top     = sy + 'px';
    el.style.opacity = entry.body.sleeping ? '0.9' : '0.75';
    el.style.transform = 'translateX(-50%)';
  }
}

// ── Slicer (knife drag) ───────────────────────────────────────────
const slicer = createSlicer(canvas, camera, scene, physics, knife, onSlice, () => {});

function onSlice(worldPos, fruitType) {
  // small juice flash — no score UI needed
}

setP(80, 'Layout…');

// ── World-space helper: visible half-width at z=0 for current camera ──
function visibleWidth() {
  // half-width in world units at z=0 (camera at z=11, looking at origin)
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const dist   = camera.position.z;        // 11
  const halfH  = Math.tan(fovRad / 2) * dist;
  const halfW  = halfH * camera.aspect;
  return { halfW, halfH };
}

// ── Initial fruit layout — centred in the visible viewport ───────
function spawnInitialFruits() {
  const { halfW, halfH } = visibleWidth();
  // usable area: keep fruits within 85% of half-width, 70% of half-height
  const W = halfW * 0.82;   // ≈ 3.9 at default camera
  const H = halfH * 0.68;   // ≈ 2.6

  // --- fixed 6-fruit layout scaled to viewport ---
  // Kiwi — left-centre, large disc (sits still immediately)
  spawnFruitAt('kiwi',
    new THREE.Vector3(-W * 0.70, -H * 0.05, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0)
  );

  // Strawberry 01 — centre-left, slightly high
  spawnFruitAt('strawberry',
    new THREE.Vector3(-W * 0.14, H * 0.42, 0.2),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.25, 0)
  );

  // Strawberry 02 — centre, slightly low
  spawnFruitAt('strawberry',
    new THREE.Vector3(W * 0.12, -H * 0.26, 0.15),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -0.18, 0)
  );

  // Tulip 01 — upper right
  spawnFruitAt('tulip',
    new THREE.Vector3(W * 0.56, H * 0.72, -0.2),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.3, 0)
  );

  // Tulip 02 — right, mid
  spawnFruitAt('tulip',
    new THREE.Vector3(W * 0.82, H * 0.10, -0.3),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -0.22, 0)
  );

  // Tulip 03 — right, lower
  spawnFruitAt('tulip',
    new THREE.Vector3(W * 0.50, -H * 0.52, 0.0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.18, 0)
  );
}

// ── Raycaster / drag ──────────────────────────────────────────────
const raycaster   = new THREE.Raycaster();
const ndcMouse    = new THREE.Vector2();
const dragPlane   = new THREE.Plane();
const dragHit     = new THREE.Vector3();
let   dragBody    = null;
const dragOffset  = new THREE.Vector3();
const dragVel     = new THREE.Vector3();
const dragPrevPos = new THREE.Vector3();

function getNDC(e) {
  const r = canvas.getBoundingClientRect();
  ndcMouse.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
  ndcMouse.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
}

function startDrag(e) {
  if (currentMode === 'knife') return;
  getNDC(e);
  raycaster.setFromCamera(ndcMouse, camera);
  const meshes = [];
  physics.getBodies().forEach(b => b.group.traverse(c => { if (c.isMesh) meshes.push(c); }));
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) return;

  const hitMesh = hits[0].object;
  const entry = bodies.find(en => {
    let found = false;
    en.fruitData.group.traverse(c => { if (c === hitMesh) found = true; });
    return found;
  });
  if (!entry) return;

  dragBody = entry.body;
  dragBody.sleeping = true;
  dragBody.velocity.set(0, 0, 0);
  dragBody.angularVel.set(0, 0, 0);

  const normal = new THREE.Vector3().subVectors(camera.position, dragBody.group.position).normalize();
  dragPlane.setFromNormalAndCoplanarPoint(normal, dragBody.group.position);
  raycaster.ray.intersectPlane(dragPlane, dragHit);
  dragOffset.subVectors(dragBody.group.position, dragHit);
  dragPrevPos.copy(dragBody.group.position);
  canvas.style.cursor = 'grabbing';

  // Jelly squish on pick-up
  triggerJellySquish(entry.fruitData, 0.22);
}

function moveDrag(e) {
  if (!dragBody) return;
  getNDC(e);
  raycaster.setFromCamera(ndcMouse, camera);
  if (raycaster.ray.intersectPlane(dragPlane, dragHit)) {
    const newPos = dragHit.clone().add(dragOffset);
    dragVel.subVectors(newPos, dragBody.group.position).multiplyScalar(60);
    dragPrevPos.copy(dragBody.group.position);
    dragBody.group.position.copy(newPos);
  }
}

function endDrag() {
  if (!dragBody) return;
  dragBody.sleeping = false;
  dragBody.velocity.copy(dragVel).clampLength(0, 16);
  dragBody.angularVel.set(
    (Math.random() - 0.5) * dragVel.length() * 0.9,
    (Math.random() - 0.5) * dragVel.length() * 0.9,
    (Math.random() - 0.5) * dragVel.length() * 0.9
  );
  // Find entry and trigger landing wobble
  const entry = bodies.find(en => en.body === dragBody);
  if (entry) triggerJellySquish(entry.fruitData, 0.14);
  dragBody = null;
  canvas.style.cursor = currentMode === 'knife' ? 'none' : 'grab';
}

// ── Jelly wobble ─────────────────────────────────────────────────
function triggerJellySquish(fruitData, strength) {
  fruitData.jellyMeshes.forEach(mesh => {
    const geo = mesh.geometry;
    if (!geo || !geo.userData.vertVelocity) return;
    const vv  = geo.userData.vertVelocity;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      // Kick each vertex outward from centre
      const nx = pos.getX(i);
      const ny = pos.getY(i);
      const nz = pos.getZ(i);
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      vv[i * 3]     += (nx / len) * strength * (0.7 + Math.random() * 0.6);
      vv[i * 3 + 1] += (ny / len) * strength * (0.7 + Math.random() * 0.6);
      vv[i * 3 + 2] += (nz / len) * strength * (0.7 + Math.random() * 0.6);
    }
  });
}

function triggerShake(strength = 0.3) {
  for (const entry of bodies) triggerJellySquish(entry.fruitData, strength);
}

// ── Toolbar actions ───────────────────────────────────────────────
let currentMode = 'soft'; // soft | hard | knife | scale | view

const knifHintEl = document.getElementById('knife-hint');

document.querySelectorAll('.tb-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;

    // Toggle active on mode buttons
    if (['hard', 'soft', 'knife', 'scale', 'view'].includes(action)) {
      document.querySelectorAll('.tb-btn').forEach(b => {
        if (['hard','soft','knife','scale','view'].includes(b.dataset.action))
          b.classList.remove('active');
      });
      btn.classList.add('active');
      currentMode = action;
    }

    switch (action) {
      case 'hard':
        jellyAmount = 0.0;
        slicer.setActive(false);
        knife.setVisible(false);
        canvas.style.cursor = 'grab';
        knifHintEl.classList.remove('visible');
        break;

      case 'soft':
        jellyAmount = 0.7;
        slicer.setActive(false);
        knife.setVisible(false);
        canvas.style.cursor = 'grab';
        knifHintEl.classList.remove('visible');
        break;

      case 'knife':
        jellyAmount = 0.7;
        slicer.setActive(true);
        canvas.style.cursor = 'none';
        knifHintEl.classList.add('visible');
        break;

      case 'scale': {
        // Random scale pulse on all fruits
        for (const entry of bodies) {
          const s = 0.6 + Math.random() * 0.9;
          entry.fruitData.group.scale.set(s, s, s);
          triggerJellySquish(entry.fruitData, 0.25);
        }
        break;
      }

      case 'shake':
        triggerShake(0.35);
        for (const entry of bodies) {
          if (entry.body.sleeping) {
            entry.body.sleeping = false;
            entry.body.velocity.set(
              (Math.random() - 0.5) * 3,
              1.5 + Math.random() * 2,
              (Math.random() - 0.5) * 3
            );
          } else {
            entry.body.velocity.addScaledVector(
              new THREE.Vector3((Math.random() - 0.5), 0.5, (Math.random() - 0.5)), 3
            );
          }
        }
        break;

      case 'reset':
        if (currentMode === 'knife') {
          slicer.setActive(false);
          knife.setVisible(false);
          canvas.style.cursor = 'grab';
          knifHintEl.classList.remove('visible');
        }
        currentMode = 'soft';
        jellyAmount = 0.7;
        document.querySelectorAll('.tb-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.tb-btn[data-action="soft"]').classList.add('active');
        clearAll();
        spawnInitialFruits();
        break;

      case 'tags':
        showTags = !showTags;
        btn.classList.toggle('active', showTags);
        break;

      case 'view':
        // Cycle through preset camera angles
        cycleCameraView();
        break;
    }
  });
});

// Mark "Soft" active on start
document.querySelector('.tb-btn[data-action="soft"]')?.classList.add('active');

// ── Camera views ──────────────────────────────────────────────────
const cameraViews = [
  { pos: new THREE.Vector3(0, 1.2, 11),   target: new THREE.Vector3(0, 0, 0) },
  { pos: new THREE.Vector3(-2, 3.5, 8),   target: new THREE.Vector3(0, 0, 0) },
  { pos: new THREE.Vector3(5, 1.0, 7),    target: new THREE.Vector3(0, 0, 0) },
  { pos: new THREE.Vector3(0, 6.5, 6),    target: new THREE.Vector3(0, 0, 0) },
];
let cameraViewIdx = 0;
let cameraLerpTarget = null;

function cycleCameraView() {
  cameraViewIdx = (cameraViewIdx + 1) % cameraViews.length;
  cameraLerpTarget = cameraViews[cameraViewIdx];
}

// ── Category filter ───────────────────────────────────────────────
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.category;

    // Remove current fruits and respawn matching category
    clearAll();

    const pool = cat === 'all'
      ? FRUIT_CATALOG
      : FRUIT_CATALOG.filter(f => f.category === cat);

    if (!pool.length) { spawnInitialFruits(); return; }

    // Place up to 6 fruits centred in visible viewport
    const count = Math.min(pool.length, 6);
    const { halfW, halfH } = visibleWidth();
    const W = halfW * 0.80;
    const H = halfH * 0.65;
    // Staggered grid: 3 columns × 2 rows, offset every other column
    const cols = 3, rows = 2;
    for (let i = 0; i < count; i++) {
      const item  = pool[i % pool.length];
      const col   = i % cols;
      const row   = Math.floor(i / cols);
      const ox    = (col / (cols - 1) - 0.5) * 2 * W;
      const oy    = (row === 0 ? H * 0.35 : -H * 0.35) + (col % 2 === 0 ? 0.18 : -0.18);
      const pos   = new THREE.Vector3(ox, oy, (Math.random() - 0.5) * 0.3);
      spawnFruitAt(item.type, pos, new THREE.Vector3(), new THREE.Vector3());
    }
  });
});

// ── Pointer events ────────────────────────────────────────────────
canvas.addEventListener('pointerdown', e => {
  if (currentMode === 'knife') { slicer.onPointerDown(e); return; }
  startDrag(e);
});

canvas.addEventListener('pointermove', e => {
  slicer.onPointerMove(e);
  if (currentMode !== 'knife') moveDrag(e);
});

canvas.addEventListener('pointerup', e => {
  slicer.onPointerUp(e);
  endDrag();
});

window.addEventListener('pointerup', e => {
  if (currentMode === 'knife') slicer.onPointerUp(e);
  endDrag();
});

canvas.addEventListener('pointerleave', e => {
  slicer.onPointerUp(e);
  endDrag();
});

// Knife angle — scroll wheel
canvas.addEventListener('wheel', e => {
  if (currentMode !== 'knife') return;
  e.preventDefault();
  knife.rotateAngle(Math.sign(e.deltaY) * 0.08);
}, { passive: false });

// ── Resize ────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ── Clock ─────────────────────────────────────────────────────────
const clock = new THREE.Clock();

// ── Render loop ───────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const dt      = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  // Camera lerp
  if (cameraLerpTarget) {
    camera.position.lerp(cameraLerpTarget.pos, 0.04);
    if (camera.position.distanceTo(cameraLerpTarget.pos) < 0.01) cameraLerpTarget = null;
    camera.lookAt(0, 0, 0);
  }

  // Physics step
  physics.update(dt, 9.0, 0.97, jellyAmount);

  // Remove fallen / old bodies
  for (const entry of [...bodies]) {
    if (entry.body.group.position.y < -6 || entry.body.age > 30) {
      removeBody(entry);
    }
  }

  // Studio update
  studio.update(elapsed);

  // Slicer / knife
  slicer.update(dt);

  // Label overlay
  updateLabels();

  renderer.render(scene, camera);
}

// ── Boot ──────────────────────────────────────────────────────────
setP(100, 'Ready!');
setTimeout(() => {
  hideLoader();
  spawnInitialFruits();
  animate();
}, 500);
