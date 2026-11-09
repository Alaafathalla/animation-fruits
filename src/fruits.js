import * as THREE from 'three';

/**
 * Procedural 3D fruit factory.
 * Each fruit returns { outer, inner, juiceColor, label, radius }
 * where outer/inner are THREE.Mesh objects ready to add to a group.
 *
 * Supported types: watermelon | orange | apple | lemon | strawberry | grape
 */

// ── Shared helpers ─────────────────────────────────────────────────
function smoothMat(color, roughness = 0.55, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.FrontSide });
}
function innerMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
}

// ── Watermelon ─────────────────────────────────────────────────────
function makeWatermelon() {
  const group = new THREE.Group();
  const r = 0.7;

  // Outer shell — sphere with green stripe shader
  const geo = new THREE.SphereGeometry(r, 48, 32);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vNorm;
      void main(){ vUv=uv; vNorm=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
    `,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying vec3 vNorm;
      void main(){
        float stripe = smoothstep(0.48,0.52, fract(vUv.x*9.0));
        vec3 dark  = vec3(0.1,0.36,0.06);
        vec3 light = vec3(0.22,0.58,0.10);
        vec3 col   = mix(dark, light, stripe);
        // Basic lighting
        vec3 L = normalize(vec3(1,2,1));
        float d = max(dot(vNorm,L),0.0)*0.7+0.3;
        gl_FragColor = vec4(col*d,1.);
      }
    `,
    side: THREE.FrontSide,
  });
  const outer = new THREE.Mesh(geo, mat);
  outer.castShadow = true;
  group.add(outer);

  // Inner flesh (shown after cut) — deep red circle
  const innerGeo = new THREE.CircleGeometry(r, 48);
  const innerM   = innerMat(0xcc2200);
  // Seed dots via texture-like approach — handled at slice time
  const inner = new THREE.Mesh(innerGeo, innerM);
  inner.visible = false;
  group.add(inner);

  return { group, outer, inner, juiceColor: 0xff3322, label: 'watermelon', radius: r };
}

// ── Orange ─────────────────────────────────────────────────────────
function makeOrange() {
  const group = new THREE.Group();
  const r = 0.55;

  const geo = new THREE.SphereGeometry(r, 40, 32);
  // Dimple the surface
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i)/r, ny = pos.getY(i)/r, nz = pos.getZ(i)/r;
    const bump = (Math.sin(nx*18)*Math.cos(ny*16)*Math.sin(nz*14)) * 0.018;
    pos.setXYZ(i, pos.getX(i)+nx*bump, pos.getY(i)+ny*bump, pos.getZ(i)+nz*bump);
  }
  geo.computeVertexNormals();
  const mat   = smoothMat(0xff8c1a, 0.7);
  const outer = new THREE.Mesh(geo, mat);
  outer.castShadow = true;
  group.add(outer);

  // Inner — orange segment colour
  const innerGeo = new THREE.CircleGeometry(r*0.96, 40);
  const inner    = new THREE.Mesh(innerGeo, innerMat(0xff6600));
  inner.visible  = false;
  group.add(inner);

  // Top nub
  const nub = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    smoothMat(0x2d5a10, 0.9)
  );
  nub.position.y = r + 0.02;
  group.add(nub);

  return { group, outer, inner, juiceColor: 0xff7700, label: 'orange', radius: r };
}

// ── Apple ──────────────────────────────────────────────────────────
function makeApple() {
  const group = new THREE.Group();
  const r = 0.55;

  const geo = new THREE.SphereGeometry(r, 40, 32);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y  = pos.getY(i) / r; // -1..1
    // Indent top and bottom
    const indent = Math.pow(Math.abs(y), 2.5) * 0.12;
    const scale  = 1 - indent * 0.3;
    pos.setX(i, pos.getX(i) * scale);
    pos.setZ(i, pos.getZ(i) * scale);
    // Slight heart-shape ridge
    const angle = Math.atan2(pos.getZ(i), pos.getX(i));
    const ridge = Math.sin(angle * 2) * 0.025 * (1 - Math.abs(y));
    const nx = pos.getX(i)/r, nz = pos.getZ(i)/r;
    pos.setX(i, pos.getX(i) + nx * ridge);
    pos.setZ(i, pos.getZ(i) + nz * ridge);
  }
  geo.computeVertexNormals();
  const mat   = smoothMat(0xcc1111, 0.45);
  const outer = new THREE.Mesh(geo, mat);
  outer.castShadow = true;
  group.add(outer);

  // Stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.015, 0.22, 8),
    smoothMat(0x3d2010, 0.9)
  );
  stem.position.y = r + 0.07;
  stem.rotation.z = 0.2;
  group.add(stem);

  // Leaf
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0,0); leafShape.bezierCurveTo(0.1,0.08, 0.18,0.04, 0.22,0);
  leafShape.bezierCurveTo(0.18,-0.04, 0.1,-0.08, 0,0);
  const leaf = new THREE.Mesh(
    new THREE.ShapeGeometry(leafShape),
    smoothMat(0x228822, 0.7)
  );
  leaf.position.set(0.04, r+0.18, 0); leaf.rotation.z = -0.4;
  group.add(leaf);

  // Inner
  const inner = new THREE.Mesh(new THREE.CircleGeometry(r*0.9, 40), innerMat(0xffe8d0));
  inner.visible = false;
  group.add(inner);

  return { group, outer, inner, juiceColor: 0xffddcc, label: 'apple', radius: r };
}

// ── Lemon ──────────────────────────────────────────────────────────
function makeLemon() {
  const group = new THREE.Group();
  const r = 0.45;

  const geo = new THREE.SphereGeometry(r, 32, 32);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Elongate along Y
    pos.setY(i, y * 1.35);
    // Add bumpy peel
    const nx=x/r, ny=pos.getY(i)/(r*1.35), nz=z/r;
    const bump = Math.sin(nx*22)*Math.cos(nz*20)*0.012;
    pos.setX(i, x + nx*bump); pos.setZ(i, z + nz*bump);
  }
  geo.computeVertexNormals();
  const mat   = smoothMat(0xffe033, 0.6);
  const outer = new THREE.Mesh(geo, mat);
  outer.castShadow = true;
  group.add(outer);

  // Tips
  for (const ySign of [-1, 1]) {
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.14, 12),
      smoothMat(0xffd000, 0.7)
    );
    tip.position.y = ySign * (r * 1.35 - 0.02);
    tip.rotation.z = ySign < 0 ? Math.PI : 0;
    group.add(tip);
  }

  const inner = new THREE.Mesh(new THREE.CircleGeometry(r*0.88, 32), innerMat(0xffff99));
  inner.visible = false;
  group.add(inner);

  return { group, outer, inner, juiceColor: 0xffff00, label: 'lemon', radius: r * 1.35 };
}

// ── Strawberry ─────────────────────────────────────────────────────
function makeStrawberry() {
  const group = new THREE.Group();
  const r = 0.45;

  // Body — teardrop shape
  const geo = new THREE.SphereGeometry(r, 32, 32);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / r; // -1..1
    // Taper bottom
    const taper = y < 0 ? 1 + y * 0.55 : 1 - y * 0.08;
    pos.setX(i, pos.getX(i) * taper);
    pos.setZ(i, pos.getZ(i) * taper);
    // Seed bumps
    const nx=pos.getX(i)/r, nz=pos.getZ(i)/r;
    const seed = Math.sin(nx*24)*Math.sin(pos.getY(i)*18)*0.018;
    pos.setX(i, pos.getX(i) + nx*seed); pos.setZ(i, pos.getZ(i) + nz*seed);
  }
  geo.computeVertexNormals();
  const mat   = smoothMat(0xee1133, 0.55);
  const outer = new THREE.Mesh(geo, mat);
  outer.castShadow = true;
  group.add(outer);

  // Leaves (sepals)
  for (let k = 0; k < 5; k++) {
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0,0); leafShape.bezierCurveTo(0.06,0.1, 0.12,0.14, 0.14,0.22);
    leafShape.bezierCurveTo(0.08,0.14, 0.04,0.1, 0,0);
    const lm = new THREE.Mesh(new THREE.ShapeGeometry(leafShape), smoothMat(0x228800, 0.8));
    lm.position.y = r * 0.85;
    lm.rotation.y = (k / 5) * Math.PI * 2;
    lm.rotation.x = -0.5;
    group.add(lm);
  }

  const inner = new THREE.Mesh(new THREE.CircleGeometry(r*0.85, 32), innerMat(0xff9999));
  inner.visible = false;
  group.add(inner);

  return { group, outer, inner, juiceColor: 0xff2255, label: 'strawberry', radius: r };
}

// ── Grape ──────────────────────────────────────────────────────────
function makeGrape() {
  const group = new THREE.Group();
  const r = 0.14;
  const positions = [
    [0,0,0],[0.28,0,0],[-0.28,0,0],[0.14,0.24,0],[-0.14,0.24,0],[0,0.48,0],
    [0.14,-0.24,0],[-0.14,-0.24,0],[0,0,0.22],[0.14,0.12,0.18],[-0.14,0.12,0.18],
  ];
  const mat = smoothMat(0x5522aa, 0.4);
  for (const [x,y,z] of positions) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat);
    g.position.set(x, y, z);
    g.castShadow = true;
    group.add(g);
  }
  // Stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.01,0.3,8), smoothMat(0x3a1a00,0.9));
  stem.position.set(0, 0.62, 0);
  group.add(stem);

  // For grape we just return the group as outer (no inner slice needed)
  const outer = group.children[0];
  const inner = new THREE.Mesh(new THREE.CircleGeometry(r, 20), innerMat(0xdd99ff));
  inner.visible = false;
  group.add(inner);

  return { group, outer, inner, juiceColor: 0x8833dd, label: 'grape', radius: 0.55 };
}

// ── Public factory ─────────────────────────────────────────────────
export function spawnFruit(type, position = new THREE.Vector3()) {
  let data;
  switch (type) {
    case 'orange':     data = makeOrange();     break;
    case 'apple':      data = makeApple();      break;
    case 'lemon':      data = makeLemon();      break;
    case 'strawberry': data = makeStrawberry(); break;
    case 'grape':      data = makeGrape();      break;
    default:           data = makeWatermelon(); break;
  }
  data.group.position.copy(position);
  data.type = type;
  return data;
}
