import * as THREE from 'three';

/**
 * Jelly Garden — high-quality procedural fruit & bloom factory.
 *
 * Returns: { group, outer, inner, juiceColor, label, radius, category, jellyMeshes }
 * Types: kiwi | strawberry | tulip | orange | lemon | apple | grape | watermelon
 */

// ─── Material helpers ─────────────────────────────────────────────

/** Jelly: glassy clearcoat + subsurface-ish depth */
function jelly(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness:           opts.roughness          ?? 0.12,
    metalness:           opts.metalness          ?? 0.0,
    clearcoat:           opts.clearcoat          ?? 1.0,
    clearcoatRoughness:  opts.clearcoatRoughness ?? 0.06,
    reflectivity:        0.7,
    envMapIntensity:     1.2,
    transparent:         (opts.opacity ?? 1) < 1,
    opacity:             opts.opacity ?? 1,
    side: THREE.FrontSide,
  });
}

function matte(color, roughness = 0.75) {
  return new THREE.MeshStandardMaterial({ color, roughness, side: THREE.DoubleSide });
}

function glossy(color, roughness = 0.35) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness,
    clearcoat: 0.5, clearcoatRoughness: 0.2,
    side: THREE.FrontSide,
  });
}

// Soft specular highlight (white blinn spot painted on a disc)
function addHighlight(group, x, y, z, r = 0.14) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false })
  );
  m.position.set(x, y, z);
  group.add(m);
}

// ─── KIWI ─────────────────────────────────────────────────────────
// Thick coin / disc — green jelly shell, cross-section face always visible
function makeKiwi() {
  const group = new THREE.Group();
  const R = 0.78;   // disc radius
  const D = 0.30;   // half-depth (thick coin)

  // Outer shell — sphere squashed on Z
  const geo = new THREE.SphereGeometry(R, 64, 40);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, pos.getZ(i) * (D / R));
  }
  geo.computeVertexNormals();

  const outerMat = jelly(0x3d8b37, { roughness: 0.14, clearcoat: 1.0 });
  const outer = new THREE.Mesh(geo, outerMat);
  outer.castShadow = true;
  group.add(outer);

  // ── Front face ────────────────────────────────────────────────
  // Background flesh — creamy white ring
  const bg = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.97, 64),
    matte(0xf5f0e0)
  );
  bg.position.z = D + 0.001;
  group.add(bg);

  // Outer peel ring
  const peelRing = new THREE.Mesh(
    new THREE.RingGeometry(R * 0.86, R * 0.97, 64),
    matte(0x5d9e35)
  );
  peelRing.position.z = D + 0.002;
  group.add(peelRing);

  // Flesh segments — alternating lime/green wedges
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2;
    const a1 = ((i + 0.88) / 12) * Math.PI * 2;
    const shape = new THREE.Shape();
    shape.moveTo(R * 0.12 * Math.cos(a0), R * 0.12 * Math.sin(a0));
    shape.absarc(0, 0, R * 0.78, a0, a1, false);
    shape.lineTo(R * 0.12 * Math.cos(a1), R * 0.12 * Math.sin(a1));
    shape.absarc(0, 0, R * 0.12, a1, a0, true);
    const seg = new THREE.Mesh(
      new THREE.ShapeGeometry(shape, 8),
      matte(i % 2 === 0 ? 0x7bbc3f : 0x5aa52b)
    );
    seg.position.z = D + 0.003;
    group.add(seg);
  }

  // Centre circle
  const ctr = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.12, 32),
    matte(0xf5f0e0)
  );
  ctr.position.z = D + 0.004;
  group.add(ctr);

  // Black seeds — oval dots
  const seedMat = matte(0x1a1a1a);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    const seed = new THREE.Mesh(new THREE.CircleGeometry(0.042, 10), seedMat);
    seed.scale.set(0.55, 1.0, 1.0);
    seed.position.set(Math.cos(a) * R * 0.60, Math.sin(a) * R * 0.60, D + 0.005);
    group.add(seed);
  }

  // Specular highlight
  addHighlight(group, -R * 0.3, R * 0.3, D + 0.006, R * 0.22);

  // Inner (cut)
  const inner = new THREE.Mesh(new THREE.CircleGeometry(R * 0.9, 48), matte(0x8bc34a));
  inner.visible = false;
  group.add(inner);

  return { group, outer, inner, juiceColor: 0x66bb6a, label: 'KIWI', radius: R * 0.72, category: 'melon', jellyMeshes: [outer] };
}

// ─── STRAWBERRY ───────────────────────────────────────────────────
function makeStrawberry() {
  const group = new THREE.Group();
  const R = 0.54;

  // Body — heart / teardrop, vivid red
  const geo = new THREE.SphereGeometry(R, 48, 48);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y  = pos.getY(i) / R;   // -1 .. 1
    // Taper: narrow at bottom, wider at top
    const taper = y < 0 ? 1 + y * 0.70 : 1 - y * 0.04;
    // Slight heart indent on top
    const angle = Math.atan2(pos.getZ(i), pos.getX(i));
    const heart  = y > 0.6 ? Math.sin(angle * 2) * (y - 0.6) * 0.09 : 0;
    pos.setX(i, pos.getX(i) * taper + pos.getX(i) * heart);
    pos.setZ(i, pos.getZ(i) * taper + pos.getZ(i) * heart);
    // Seed bumps
    const nx = pos.getX(i) / R, nz = pos.getZ(i) / R;
    const seed = Math.sin(nx * 28) * Math.sin(pos.getY(i) * 24) * 0.015;
    pos.setX(i, pos.getX(i) + nx * seed);
    pos.setZ(i, pos.getZ(i) + nz * seed);
  }
  geo.computeVertexNormals();

  const mat = jelly(0xe8192c, { roughness: 0.14, clearcoat: 1.0 });
  const outer = new THREE.Mesh(geo, mat);
  outer.castShadow = true;
  group.add(outer);

  // Specular highlight
  addHighlight(group, -R * 0.28, R * 0.35, R * 0.88, R * 0.18);

  // Achene (seed) dots — tiny yellow ovals on surface
  const sMat = matte(0xfff176, 0.4);
  for (let row = 0; row < 5; row++) {
    const yPos  = -0.28 + row * 0.14;
    const count = 5 + row;
    for (let c = 0; c < count; c++) {
      const a = (c / count) * Math.PI * 2;
      const nx = Math.cos(a), nz = Math.sin(a);
      const nLen = Math.sqrt(1 - yPos * yPos / (R * R));
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.028, 8), sMat);
      dot.position.set(nx * R * 0.9 * nLen, yPos, nz * R * 0.9 * nLen);
      dot.lookAt(nx * 2, yPos, nz * 2);
      group.add(dot);
    }
  }

  // Sepals — 5 curved green leaves
  const leafMat = jelly(0x2e7d32, { roughness: 0.5, clearcoat: 0.4 });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const ls = new THREE.Shape();
    ls.moveTo(0, 0);
    ls.bezierCurveTo(0.04, 0.09, 0.09, 0.14, 0.08, 0.26);
    ls.bezierCurveTo(0.04, 0.16, 0.0, 0.08, 0, 0);
    const leaf = new THREE.Mesh(new THREE.ShapeGeometry(ls, 8), leafMat);
    leaf.position.set(Math.cos(a) * 0.06, R * 0.80, Math.sin(a) * 0.06);
    leaf.rotation.set(-0.44, a, 0);
    group.add(leaf);
  }

  // Stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.016, 0.22, 8),
    matte(0x1b5e20, 0.8)
  );
  stem.position.y = R + 0.10;
  stem.rotation.z = 0.20;
  group.add(stem);

  const inner = new THREE.Mesh(new THREE.CircleGeometry(R * 0.84, 32), matte(0xffcdd2));
  inner.visible = false;
  group.add(inner);

  return { group, outer, inner, juiceColor: 0xef9a9a, label: 'STRAWBERRY', radius: R, category: 'berry', jellyMeshes: [outer] };
}

// ─── TULIP ────────────────────────────────────────────────────────
// 3D cupped tulip — coral/salmon, fully volumetric petals
function makeTulip() {
  const group = new THREE.Group();

  const coral    = jelly(0xe86040, { roughness: 0.12, clearcoat: 1.0 });
  const corLight = jelly(0xf07d5c, { roughness: 0.18, clearcoat: 0.7 });

  // ── 3D petal via lathe ───────────────────────────────────────
  function makePetal(mat, scaleX, scaleY, rotX) {
    // Profile — narrow base, broad belly, curled tip
    const pts = [];
    for (let t = 0; t <= 20; t++) {
      const u  = t / 20;                             // 0..1 from base to tip
      const r  = 0.22 * Math.sin(u * Math.PI)        // width bell curve
                 * (1 + 0.15 * Math.sin(u * Math.PI * 2)); // slight waist
      pts.push(new THREE.Vector2(r, u * 0.95));
    }
    const geo = new THREE.LatheGeometry(pts, 14);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(scaleX, scaleY, scaleX);
    mesh.rotation.x = rotX;
    mesh.castShadow = true;
    return mesh;
  }

  // Outer 3 petals — spread wide
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const p = makePetal(coral, 1.0, 1.0, 0.72);
    p.rotation.y = a;
    p.position.set(Math.sin(a) * 0.08, 0.14, Math.cos(a) * 0.08);
    group.add(p);
  }

  // Inner 3 petals — slightly smaller, offset rotation
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 3;
    const p = makePetal(corLight, 0.84, 0.90, 0.56);
    p.rotation.y = a;
    p.position.set(Math.sin(a) * 0.05, 0.22, Math.cos(a) * 0.05);
    group.add(p);
  }

  // Jagged tip spikes — dark coral triangles at petal tops
  const jagMat = jelly(0xc0442c, { roughness: 0.2 });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    const js = new THREE.Shape();
    js.moveTo(-0.07, 0);
    js.lineTo(-0.055, 0.14);
    js.lineTo(-0.015, 0.09);
    js.lineTo(0, 0.21);
    js.lineTo(0.015, 0.09);
    js.lineTo(0.055, 0.14);
    js.lineTo(0.07, 0);
    js.closePath();
    const jag = new THREE.Mesh(new THREE.ShapeGeometry(js, 4), jagMat);
    jag.rotation.y = a;
    jag.rotation.x = -0.9;
    jag.position.set(Math.sin(a) * 0.18, 0.84, Math.cos(a) * 0.18);
    group.add(jag);
  }

  // Stem — tapering cylinder
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.038, 1.0, 12),
    matte(0x558b2f, 0.75)
  );
  stem.position.y = -0.50;
  stem.castShadow = true;
  group.add(stem);

  // Leaf — broad curved shape
  const lsh = new THREE.Shape();
  lsh.moveTo(0, 0);
  lsh.bezierCurveTo( 0.18,  0.12,  0.28,  0.42,  0.22,  0.72);
  lsh.bezierCurveTo( 0.10,  0.52,  0.02,  0.28,  0,     0);
  const leaf = new THREE.Mesh(new THREE.ShapeGeometry(lsh, 8), matte(0x33691e, 0.7));
  leaf.position.set(0.12, -0.14, 0.06);
  leaf.rotation.set(-0.1, 0.5, -0.55);
  group.add(leaf);

  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), matte(0xffccbc));
  inner.visible = false;
  group.add(inner);

  const outer = group.children[0];
  return {
    group, outer, inner,
    juiceColor: 0xffab91, label: 'TULIP', radius: 0.56,
    category: 'bloom',
    jellyMeshes: group.children.filter(c => c.isMesh && c !== inner),
  };
}

// ─── ORANGE ───────────────────────────────────────────────────────
function makeOrange() {
  const group = new THREE.Group();
  const R = 0.60;

  const geo = new THREE.SphereGeometry(R, 56, 40);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / R, ny = pos.getY(i) / R, nz = pos.getZ(i) / R;
    // Fine peel texture
    const bump = (Math.sin(nx * 18) * Math.cos(ny * 16) * Math.sin(nz * 15)) * 0.018;
    pos.setXYZ(i, pos.getX(i) + nx * bump, pos.getY(i) + ny * bump, pos.getZ(i) + nz * bump);
  }
  geo.computeVertexNormals();

  const mat = jelly(0xff6d2a, { roughness: 0.20, clearcoat: 0.9 });
  const outer = new THREE.Mesh(geo, mat);
  outer.castShadow = true;
  group.add(outer);

  addHighlight(group, -R * 0.3, R * 0.38, R * 0.86, R * 0.2);

  // Nub + calyx
  const nub = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), matte(0x2e7d32, 0.9));
  nub.position.y = R + 0.025;
  group.add(nub);

  const inner = new THREE.Mesh(new THREE.CircleGeometry(R * 0.95, 40), matte(0xffe0b2));
  inner.visible = false;
  group.add(inner);

  return { group, outer, inner, juiceColor: 0xffb74d, label: 'ORANGE', radius: R, category: 'citrus', jellyMeshes: [outer] };
}

// ─── LEMON ────────────────────────────────────────────────────────
function makeLemon() {
  const group = new THREE.Group();
  const R = 0.46;

  const geo = new THREE.SphereGeometry(R, 40, 32);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    // Elongate Y
    pos.setY(i, pos.getY(i) * 1.42);
    const nx = pos.getX(i) / R, nz = pos.getZ(i) / R;
    const bump = Math.sin(nx * 22) * Math.cos(nz * 20) * 0.012;
    pos.setX(i, pos.getX(i) + nx * bump);
    pos.setZ(i, pos.getZ(i) + nz * bump);
  }
  geo.computeVertexNormals();

  const mat = jelly(0xfff044, { roughness: 0.14, clearcoat: 1.0 });
  const outer = new THREE.Mesh(geo, mat);
  outer.castShadow = true;
  group.add(outer);

  addHighlight(group, -R * 0.25, R * 0.5, R * 0.88, R * 0.17);

  for (const ys of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 12), jelly(0xfdd835, { roughness: 0.25 }));
    tip.position.y = ys * (R * 1.42 - 0.03);
    if (ys < 0) tip.rotation.z = Math.PI;
    group.add(tip);
  }

  const inner = new THREE.Mesh(new THREE.CircleGeometry(R * 0.88, 32), matte(0xfff9c4));
  inner.visible = false;
  group.add(inner);

  return { group, outer, inner, juiceColor: 0xfff176, label: 'LEMON', radius: R * 1.42, category: 'citrus', jellyMeshes: [outer] };
}

// ─── APPLE ────────────────────────────────────────────────────────
function makeApple() {
  const group = new THREE.Group();
  const R = 0.60;

  const geo = new THREE.SphereGeometry(R, 56, 40);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / R;
    // Indent top/bottom dimple
    const dimple = Math.pow(1 - Math.abs(y), 0.3) * -0.08 * Math.abs(y);
    const sc = 1 + dimple;
    pos.setX(i, pos.getX(i) * sc);
    pos.setZ(i, pos.getZ(i) * sc);
    // Heart ridge
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    const ridge = Math.sin(a * 2) * 0.025 * Math.max(0, 1 - Math.abs(y) * 1.6);
    const nx = pos.getX(i) / R, nz = pos.getZ(i) / R;
    pos.setX(i, pos.getX(i) + nx * ridge);
    pos.setZ(i, pos.getZ(i) + nz * ridge);
  }
  geo.computeVertexNormals();

  const mat = jelly(0xe31c24, { roughness: 0.14, clearcoat: 1.0 });
  const outer = new THREE.Mesh(geo, mat);
  outer.castShadow = true;
  group.add(outer);

  addHighlight(group, -R * 0.32, R * 0.38, R * 0.88, R * 0.22);

  // Stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.24, 8), matte(0x3e2723, 0.9));
  stem.position.y = R + 0.08; stem.rotation.z = 0.18;
  group.add(stem);

  // Leaf
  const ls = new THREE.Shape();
  ls.moveTo(0, 0);
  ls.bezierCurveTo(0.09, 0.07, 0.18, 0.04, 0.22, 0);
  ls.bezierCurveTo(0.18, -0.04, 0.09, -0.07, 0, 0);
  const leaf = new THREE.Mesh(new THREE.ShapeGeometry(ls), matte(0x388e3c, 0.7));
  leaf.position.set(0.04, R + 0.19, 0); leaf.rotation.z = -0.38;
  group.add(leaf);

  const inner = new THREE.Mesh(new THREE.CircleGeometry(R * 0.9, 40), matte(0xfff8e1));
  inner.visible = false;
  group.add(inner);

  return { group, outer, inner, juiceColor: 0xffccbc, label: 'APPLE', radius: R, category: 'fruit', jellyMeshes: [outer] };
}

// ─── GRAPE ────────────────────────────────────────────────────────
function makeGrape() {
  const group = new THREE.Group();
  const r = 0.16;
  const layout = [
    [0, 0, 0], [0.30, 0.04, 0], [-0.30, 0.04, 0],
    [0.15, 0.27, 0.04], [-0.15, 0.27, 0.04],
    [0, 0.52, 0.06],
    [0.15, -0.26, 0.04], [-0.15, -0.26, 0.04],
    [0.08, 0.14, 0.24], [-0.08, 0.14, 0.24],
    [0, -0.1, 0.26],
  ];
  const mat = jelly(0x7b1fa2, { roughness: 0.12, clearcoat: 1.0 });
  const meshes = [];
  for (const [x, y, z] of layout) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 20), mat);
    g.position.set(x, y, z);
    g.castShadow = true;
    group.add(g);
    meshes.push(g);
  }

  // Specular highlight on each berry
  meshes.forEach(m => {
    const h = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.3, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.26, depthWrite: false })
    );
    h.position.copy(m.position).addScaledVector(new THREE.Vector3(-0.6, 0.6, 1).normalize(), r * 0.9);
    h.lookAt(m.position.clone().add(new THREE.Vector3(-2, 2, 4)));
    group.add(h);
  });

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.009, 0.3, 8), matte(0x33691e));
  stem.position.set(0, 0.65, 0.06);
  group.add(stem);

  const outer = meshes[0];
  const inner = new THREE.Mesh(new THREE.CircleGeometry(r, 20), matte(0xce93d8));
  inner.visible = false;
  group.add(inner);

  return { group, outer, inner, juiceColor: 0xab47bc, label: 'GRAPE', radius: 0.52, category: 'berry', jellyMeshes: meshes };
}

// ─── WATERMELON ───────────────────────────────────────────────────
function makeWatermelon() {
  const group = new THREE.Group();
  const R = 0.78;

  const geo = new THREE.SphereGeometry(R, 64, 40);
  // Slight vertical squash → more disc-like melon shape
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) * 0.86);
  }
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vNorm; varying vec3 vPos;
      void main(){
        vUv = uv; vNorm = normalize(normalMatrix * normal);
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying vec3 vNorm; varying vec3 vPos;
      void main(){
        // Dark / light green stripes
        float s   = fract(vUv.x * 10.0);
        float sw  = smoothstep(0.42, 0.50, s) - smoothstep(0.50, 0.58, s);
        vec3 dark = vec3(0.14, 0.42, 0.10);
        vec3 lite = vec3(0.36, 0.68, 0.22);
        vec3 col  = mix(dark, lite, sw);
        // Diffuse
        vec3 L = normalize(vec3(-1.0, 2.0, 1.5));
        float d = clamp(dot(vNorm, L), 0.0, 1.0) * 0.6 + 0.4;
        // Specular (clearcoat-like)
        vec3 V = vec3(0.0, 0.0, 1.0);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(vNorm, H), 0.0), 55.0) * 0.45;
        gl_FragColor = vec4(col * d + spec, 1.0);
      }`,
    side: THREE.FrontSide,
  });

  const outer = new THREE.Mesh(geo, mat);
  outer.castShadow = true;
  group.add(outer);

  addHighlight(group, -R * 0.3, R * 0.38, R * 0.82, R * 0.2);

  const inner = new THREE.Mesh(new THREE.CircleGeometry(R, 48), matte(0xef9a9a));
  inner.visible = false;
  group.add(inner);

  return { group, outer, inner, juiceColor: 0xf44336, label: 'WATERMELON', radius: R, category: 'melon', jellyMeshes: [outer] };
}

// ─── Public factory ───────────────────────────────────────────────
export function spawnFruit(type, position = new THREE.Vector3()) {
  let data;
  switch (type) {
    case 'strawberry':  data = makeStrawberry();  break;
    case 'tulip':       data = makeTulip();        break;
    case 'orange':      data = makeOrange();       break;
    case 'lemon':       data = makeLemon();        break;
    case 'apple':       data = makeApple();        break;
    case 'grape':       data = makeGrape();        break;
    case 'watermelon':  data = makeWatermelon();   break;
    default:            data = makeKiwi();         break;
  }
  data.group.position.copy(position);
  data.type = type;

  // Wire per-vertex spring state
  data.jellyMeshes.forEach(mesh => {
    if (!mesh.geometry?.attributes?.position) return;
    const geo = mesh.geometry;
    geo.userData.restPositions = Float32Array.from(geo.attributes.position.array);
    geo.userData.vertVelocity  = new Float32Array(geo.attributes.position.count * 3);
  });

  return data;
}

// ─── Category catalog ─────────────────────────────────────────────
export const FRUIT_CATALOG = [
  { type: 'kiwi',       category: 'melon',  label: 'KIWI'       },
  { type: 'strawberry', category: 'berry',  label: 'STRAWBERRY' },
  { type: 'tulip',      category: 'bloom',  label: 'TULIP'      },
  { type: 'orange',     category: 'citrus', label: 'ORANGE'     },
  { type: 'lemon',      category: 'citrus', label: 'LEMON'      },
  { type: 'apple',      category: 'fruit',  label: 'APPLE'      },
  { type: 'grape',      category: 'berry',  label: 'GRAPE'      },
  { type: 'watermelon', category: 'melon',  label: 'WATERMELON' },
];
