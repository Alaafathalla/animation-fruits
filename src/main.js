import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { spawnFruit } from './fruits.js';
import { createPhysics, makeBody } from './physics.js';
import { createKnife } from './knife.js';
import { createSlicer } from './slicer.js';
import { createStudio } from './studio.js';

// ── Loader ────────────────────────────────────────────────────────
const loaderEl = document.getElementById('loader');
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
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
setP(10, 'Renderer…');

// ── Scene ─────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070c16);
scene.fog = new THREE.FogExp2(0x070c16, 0.028);

// ── Camera ────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 10.5);

// ── Orbit Controls ────────────────────────────────────────────────
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.dampingFactor = 0.07;
orbit.enablePan = false;
orbit.minDistance = 3;
orbit.maxDistance = 18;
orbit.maxPolarAngle = Math.PI * 0.80;
orbit.target.set(0, 0, 0);
setP(20, 'Lighting…');

// ── Lighting ──────────────────────────────────────────────────────
const keyLight = new THREE.DirectionalLight(0xfff8f0, 4.5);
keyLight.position.set(4, 8, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 40;
keyLight.shadow.camera.left = -8;
keyLight.shadow.camera.right = 8;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -8;
keyLight.shadow.bias = -0.001;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xb0d8ff, 1.6);
fillLight.position.set(-5, 3, -3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffeecc, 2.0);
rimLight.position.set(0, 5, -7);
scene.add(rimLight);

scene.add(new THREE.AmbientLight(0x14121e, 3));
scene.add(new THREE.HemisphereLight(0x1a1030, 0x080808, 1.0));

const spot = new THREE.SpotLight(0xffffff, 6, 20, Math.PI * 0.22, 0.5, 1.5);
spot.position.set(0, 10, 0);
scene.add(spot);
scene.add(spot.target);
setP(32, 'Environment…');

// ── Floor ─────────────────────────────────────────────────────────
const floorMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(22, 22),
  new THREE.MeshStandardMaterial({ color: 0x111018, roughness: 0.95, metalness: 0.1 })
);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.position.y = -3.2;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

const studio = createStudio(scene);

const glowMat = new THREE.MeshBasicMaterial({ color: 0xe8c96a, transparent: true, opacity: 0.04, depthWrite: false });
const glowMesh = new THREE.Mesh(new THREE.CircleGeometry(3.5, 64), glowMat);
glowMesh.rotation.x = -Math.PI / 2;
glowMesh.position.y = -3.19;
scene.add(glowMesh);

const grid = new THREE.GridHelper(22, 22, 0x1a1830, 0x1a1830);
grid.position.y = -3.19;
scene.add(grid);

setP(44, 'Physics…');

// ── Physics ───────────────────────────────────────────────────────
const physics = createPhysics();
const simState = { gravity: 9.8, bounce: 0.45, friction: 0.98, throwSpeed: 8, spin: 3, spread: 1 };

setP(56, 'Knife…');

// ── Knife ─────────────────────────────────────────────────────────
const knife = createKnife(scene);

setP(64, 'Slicer…');

// ── Score ─────────────────────────────────────────────────────────
let score = 0, combo = 1, comboTimer = 0;
const scoreEl = document.getElementById('score');
const comboBox = document.getElementById('combo-box');
const comboTxt = document.getElementById('combo-text');

function addScore(worldPos) {
  score += 10 * combo;
  if (scoreEl) scoreEl.textContent = score;
  combo++;
  comboTimer = 1.8;
  if (comboTxt) comboTxt.textContent = `×${combo}`;
  if (comboBox) { comboBox.classList.add('show', 'pop'); setTimeout(() => comboBox.classList.remove('pop'), 200); }
  // Floating text
  const div = document.createElement('div');
  div.className = 'score-pop';
  div.textContent = `+${10 * (combo - 1)}`;
  const proj = worldPos.clone().project(camera);
  const r = canvas.getBoundingClientRect();
  div.style.left = ((proj.x * 0.5 + 0.5) * r.width + r.left) + 'px';
  div.style.top = ((-proj.y * 0.5 + 0.5) * r.height + r.top) + 'px';
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 1100);
}

// ── Slicer ────────────────────────────────────────────────────────
const slicer = createSlicer(canvas, camera, scene, physics, knife, addScore);

// ── Fruit helpers ─────────────────────────────────────────────────
function spawnFruitAt(type, pos, vel) {
  const fd = spawnFruit(type, pos);
  scene.add(fd.group);
  const spin = new THREE.Vector3(
    (Math.random() - 0.5) * simState.spin,
    (Math.random() - 0.5) * simState.spin,
    (Math.random() - 0.5) * simState.spin
  );
  const body = makeBody(fd, vel || new THREE.Vector3(), spin, simState.bounce);
  physics.add(body);
  return body;
}

function clearAll() {
  physics.getBodies().forEach(b => scene.remove(b.group));
  physics.clear();
  score = 0; combo = 1; comboTimer = 0;
  if (scoreEl) scoreEl.textContent = '0';
  if (comboBox) comboBox.classList.remove('show');
}

// Starter fruits
['watermelon', 'orange', 'apple', 'lemon'].forEach((t, i) =>
  spawnFruitAt(t, new THREE.Vector3((i - 1.5) * 1.75, 1.8 + i * .12, 0), new THREE.Vector3())
);

setP(78, 'Wiring UI…');

// ── Drag / drop state ─────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const ndcMouse = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const dragHit = new THREE.Vector3();
let dragBody = null;
let dragOffset = new THREE.Vector3();
let dragDepth = 0;
// velocity estimation for throw-on-release
let dragPrevPos = new THREE.Vector3();
let dragVel = new THREE.Vector3();

function getNDC(e) {
  const r = canvas.getBoundingClientRect();
  ndcMouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndcMouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

function startDrag(e) {
  getNDC(e);
  raycaster.setFromCamera(ndcMouse, camera);
  const meshes = [];
  physics.getBodies().forEach(b => b.group.traverse(c => { if (c.isMesh) meshes.push(c); }));
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) return;

  const hitMesh = hits[0].object;
  dragBody = physics.getBodies().find(b => {
    let found = false;
    b.group.traverse(c => { if (c === hitMesh) found = true; });
    return found;
  });
  if (!dragBody) return;

  dragBody.sleeping = true;
  dragBody.velocity.set(0, 0, 0);
  dragBody.angularVel.set(0, 0, 0);

  // Drag plane faces camera at fruit depth
  const normal = new THREE.Vector3().subVectors(camera.position, dragBody.group.position).normalize();
  dragPlane.setFromNormalAndCoplanarPoint(normal, dragBody.group.position);

  raycaster.ray.intersectPlane(dragPlane, dragHit);
  dragOffset.subVectors(dragBody.group.position, dragHit);
  dragPrevPos.copy(dragBody.group.position);
  canvas.style.cursor = 'grabbing';
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
  // Release with the velocity we were dragging at
  dragBody.sleeping = false;
  dragBody.velocity.copy(dragVel).clampLength(0, 18);
  dragBody.angularVel.set(
    (Math.random() - 0.5) * dragVel.length() * 0.8,
    (Math.random() - 0.5) * dragVel.length() * 0.8,
    (Math.random() - 0.5) * dragVel.length() * 0.8
  );
  dragBody = null;
  canvas.style.cursor = 'grab';
}

// ── Mode ──────────────────────────────────────────────────────────
let mode = 'slice';
const hint = document.getElementById('hint');
const statusMode = document.getElementById('status-mode');
const hintMap = {
  slice: 'Hold & drag to slice fruit • Scroll wheel or Q / E to rotate knife handle',
  drag: 'Click & drag a fruit — release to throw it',
  throw: 'Click anywhere to throw the selected fruit',
  explode: 'Click a fruit to explode it',
  orbit: 'Drag to rotate the camera • Scroll to zoom',
};
const hintColors = {
  slice: ['rgba(255,77,109,0.08)', 'rgba(255,77,109,0.25)', '#ff4d6d'],
  drag: ['rgba(168,200,255,0.08)', 'rgba(168,200,255,0.25)', '#a8c8ff'],
  throw: ['rgba(77,170,255,0.08)', 'rgba(77,170,255,0.25)', '#4daaff'],
  explode: ['rgba(255,140,66,0.08)', 'rgba(255,140,66,0.25)', '#ff8c42'],
  orbit: ['rgba(168,200,160,0.08)', 'rgba(168,200,160,0.25)', '#a8c8a0'],
};

function applyMode(m) {
  mode = m;
  if (statusMode) statusMode.textContent = m.toUpperCase();
  orbit.enabled = (m === 'orbit');
  slicer.setActive(m === 'slice');

  const [bg, border, color] = hintColors[m] || hintColors.orbit;
  if (hint) {
    hint.textContent = hintMap[m] || '';
    hint.style.background = bg;
    hint.style.borderColor = border;
    hint.style.color = color;
  }
  canvas.style.cursor =
    m === 'slice' ? 'none' :   // knife replaces cursor
      m === 'drag' ? 'grab' :
        m === 'throw' ? 'cell' :
          m === 'explode' ? 'pointer' : 'default';
}

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyMode(btn.dataset.mode);
  });
});
applyMode('slice'); // default

// ── Fruit selector ────────────────────────────────────────────────
let selectedFruit = 'watermelon';
document.querySelectorAll('.fruit-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fruit-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedFruit = btn.dataset.fruit;
  });
});
document.getElementById('btn-spawn')?.addEventListener('click', () => {
  spawnFruitAt(
    selectedFruit,
    new THREE.Vector3((Math.random() - 0.5) * 1.5, 3.5, 0),
    new THREE.Vector3((Math.random() - 0.5) * simState.spread, 0.5, 0)
  );
});

// ── Pointer events ────────────────────────────────────────────────
canvas.addEventListener('pointerdown', e => {
  if (mode === 'slice') { slicer.onPointerDown(e); return; }
  if (mode === 'drag') { startDrag(e); return; }

  if (mode === 'throw') {
    getNDC(e);
    raycaster.setFromCamera(ndcMouse, camera);
    const dir = raycaster.ray.direction.clone().multiplyScalar(simState.throwSpeed);
    dir.x += (Math.random() - 0.5) * simState.spread;
    dir.z += (Math.random() - 0.5) * simState.spread;
    const spawnPos = camera.position.clone()
      .add(raycaster.ray.direction.clone().multiplyScalar(0.8))
      .add(new THREE.Vector3(0, -0.4, 0));
    spawnFruitAt(selectedFruit, spawnPos, dir);
    glowMat.opacity = 0.15;
    setTimeout(() => { glowMat.opacity = 0.04; }, 400);
    return;
  }

  if (mode === 'explode') {
    getNDC(e);
    raycaster.setFromCamera(ndcMouse, camera);
    const meshes = [];
    physics.getBodies().forEach(b => b.group.traverse(c => { if (c.isMesh) meshes.push(c); }));
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return;
    const hitMesh = hits[0].object;
    const body = physics.getBodies().find(b => {
      let f = false; b.group.traverse(c => { if (c === hitMesh) f = true; }); return f;
    });
    if (!body) return;
    const pos = body.group.position.clone();
    slicer.spawnJuice(pos, body.fruitData.juiceColor, 55);
    scene.remove(body.group);
    physics.remove(body);
    addScore(pos);
    physics.getBodies().forEach(b2 => {
      const d = b2.group.position.distanceTo(pos);
      if (d < 3.8) {
        const f = (3.8 - d) * 4.5;
        const pd = new THREE.Vector3().subVectors(b2.group.position, pos).normalize();
        b2.velocity.addScaledVector(pd, f);
        b2.velocity.y += f * 0.6;
        b2.angularVel.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
        b2.sleeping = false;
      }
    });
    return;
  }
});

canvas.addEventListener('pointermove', e => {
  slicer.onPointerMove(e);          // always feed mouse to slicer (drives knife position)
  if (mode === 'drag') moveDrag(e);
});

canvas.addEventListener('pointerup', e => {
  slicer.onPointerUp(e);
  if (mode === 'drag') endDrag();
});

window.addEventListener('pointerup', e => {
  if (mode === 'slice') slicer.onPointerUp(e);
  if (mode === 'drag') endDrag();
});

canvas.addEventListener('pointerleave', e => {
  slicer.onPointerUp(e);
  if (mode === 'drag') endDrag();
});

// ── Interactive Wheel & Keyboard Knife Control ────────────────────
canvas.addEventListener('wheel', e => {
  if (mode !== 'slice') return;
  e.preventDefault();
  const delta = Math.sign(e.deltaY) * 0.08;
  knife.rotateAngle(delta);
}, { passive: false });

window.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'q' || k === 'e') {
    const delta = (k === 'q' ? -8 : 8) * Math.PI / 180;
    knife.rotateAngle(delta);
  } else if (k === 'r') {
    knife.setConfig({ baseRotZ: 2.65 });
  }
});

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
  const dt = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  physics.update(dt, simState.gravity, simState.friction);
  studio.update(elapsed);
  slicer.update(dt);   // drives knife position + continuous cut check

  // Combo decay
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) { combo = 1; if (comboBox) comboBox.classList.remove('show'); }
  }

  glowMesh.material.opacity = 0.04 + Math.sin(elapsed * 1.4) * 0.012;

  orbit.update();
  renderer.render(scene, camera);
}

// ── Boot ──────────────────────────────────────────────────────────
setP(100, 'Ready!');
setTimeout(() => { hideLoader(); animate(); }, 500);
