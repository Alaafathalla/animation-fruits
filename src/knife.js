import * as THREE from 'three';

/**
 * Procedural 3D Kitchen & Combat Knife System with Complete Handle & Blade Customization.
 *
 * Configurable properties:
 *   - Handle: length, thickness, angle, style (ergonomic, octagonal, cordwrap, tactical),
 *             material theme (walnut, ebony, carbon, ivory, ruby, cyber, gold, custom),
 *             custom color, guard style & metal, pommel style, rivets.
 *   - Blade:  type (chef, santoku, cleaver, katana, dagger), length, width,
 *             finish (damascus, mirror, gold, cyber, obsidian), edge glow.
 *   - Grip:   pivot mode ('handle', 'guard', 'tip'), stance angle (baseRotZ),
 *             pitch (baseRotX), yaw (baseRotY).
 *   - Motion: size, smoothing, tilt dynamics, depth, trail length, trail color.
 */

// ── Procedural Canvas Textures ──────────────────────────────────────
function createDamascusTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#cdd4dd');
  grad.addColorStop(1, '#8f9baa');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.lineWidth = 2.4;
  for (let y = -40; y < 560; y += 6) {
    ctx.beginPath();
    const dark = Math.sin(y * 0.16) > 0;
    ctx.strokeStyle = dark ? 'rgba(38, 44, 56, 0.46)' : 'rgba(240, 246, 255, 0.52)';
    for (let x = 0; x <= 512; x += 8) {
      const w1 = Math.sin(x * 0.04 + y * 0.055) * 14;
      const w2 = Math.cos(x * 0.08 - y * 0.03) * 7;
      const w3 = Math.sin((x + y) * 0.02) * 16;
      const py = y + w1 + w2 + w3;
      if (x === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2f140a';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 70; i++) {
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.48 ? 'rgba(18, 7, 3, 0.42)' : 'rgba(88, 40, 20, 0.38)';
    ctx.fillRect(0, y, 256, 1.5 + Math.random() * 5);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  return tex;
}

function createCarbonTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#14171d';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#1f242e';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillRect(32, 32, 32, 32);
  ctx.strokeStyle = '#29303c';
  ctx.lineWidth = 1;
  for (let i = 0; i < 64; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i + 16, 32); ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

// ── Trail color map ────────────────────────────────────────────────
const TRAIL_COLORS = {
  amber:   { base: 0xff9944, hot: 0xff4411 },
  cyan:    { base: 0x00f0ff, hot: 0x0088ff },
  gold:    { base: 0xffd700, hot: 0xff9900 },
  violet:  { base: 0xd946ef, hot: 0x8b5cf6 },
  silver:  { base: 0xffffff, hot: 0xa0aec0 },
  crimson: { base: 0xff2a55, hot: 0xaa0022 },
};

export function createKnife(scene) {
  const group = new THREE.Group();
  const knifePivot = new THREE.Group();
  group.add(knifePivot);

  // Subgroups
  const bladeGroup  = new THREE.Group();
  const handleGroup = new THREE.Group();
  knifePivot.add(bladeGroup);
  knifePivot.add(handleGroup);

  // Cached textures
  const damascusTex = createDamascusTexture();
  const woodTex     = createWoodTexture();
  const carbonTex   = createCarbonTexture();

  // ── Config ────────────────────────────────────────────────────────
  const cfg = {
    // Motion & Global
    size:            1.2,
    tiltAmount:      0.5,
    smoothing:       0.08,
    trailLength:     8,
    depth:           0.5,

    // Stance & Grip Pivot
    baseRotX:       -0.30,
    baseRotY:        0.00,
    baseRotZ:        2.65,      // ~151.8° default
    gripPivot:       'handle',  // 'handle' (natural hand hold), 'guard', 'tip'

    // Handle Controls
    handleLength:    1.0,       // 0.5 - 2.2 multiplier
    handleThickness: 1.0,       // 0.5 - 2.0 multiplier
    handleAngle:     0.0,       // -0.52 to 0.52 rad (-30° to +30°)
    handleStyle:     'ergonomic', // 'ergonomic', 'octagonal', 'cordwrap', 'tactical'
    handleTheme:     'rosewood',  // 'rosewood', 'ebony', 'carbon', 'ivory', 'ruby', 'cyber', 'gold', 'custom'
    handleColor:     '#2b1308',

    // Guard & Pommel Controls
    guardStyle:      'classic',  // 'classic', 'tsuba', 'crossguard', 'sleek', 'none'
    guardMaterial:   'brass',    // 'brass', 'steel', 'gold', 'dark'
    pommelStyle:     'sphere',   // 'sphere', 'ring', 'flat', 'spike', 'none'
    showRivets:      true,
    rivetStyle:      'brass',    // 'brass', 'silver', 'gold'

    // Blade Controls
    bladeType:       'chef',     // 'chef', 'santoku', 'cleaver', 'katana', 'dagger'
    bladeLength:     1.0,        // 0.6 - 1.8 multiplier
    bladeWidth:      1.0,        // 0.6 - 1.8 multiplier
    bladeFinish:     'damascus', // 'damascus', 'mirror', 'gold', 'cyber', 'obsidian'
    bladeGlow:       false,
    bladeGlowColor:  '#ff996a',

    // Trail
    trailColor:      'amber',
  };

  // ── Materials ─────────────────────────────────────────────────────
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xccd5e2, roughness: 0.12, metalness: 0.94, side: THREE.DoubleSide,
    map: damascusTex,
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.02, metalness: 1.0,
  });
  const spineMat = new THREE.MeshStandardMaterial({
    color: 0x99a3b2, roughness: 0.22, metalness: 0.88,
  });
  const guardMat = new THREE.MeshStandardMaterial({
    color: 0xbfa366, roughness: 0.28, metalness: 0.85,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0x2b1308, roughness: 0.55, metalness: 0.08, map: woodTex,
  });
  const rivetMat = new THREE.MeshStandardMaterial({
    color: 0xbfa366, roughness: 0.24, metalness: 0.88,
  });
  const pommelMat = new THREE.MeshStandardMaterial({
    color: 0xbfa366, roughness: 0.28, metalness: 0.85,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff996a, transparent: true, opacity: 0.0, depthWrite: false,
  });

  // ── Update Material Properties ────────────────────────────────────
  function updateMaterials() {
    // Handle theme
    switch (cfg.handleTheme) {
      case 'rosewood':
        handleMat.color.set(0x3a190e);
        handleMat.map = woodTex;
        handleMat.roughness = 0.52;
        handleMat.metalness = 0.05;
        handleMat.emissive.set(0x000000);
        break;
      case 'ebony':
        handleMat.color.set(0x131215);
        handleMat.map = null;
        handleMat.roughness = 0.38;
        handleMat.metalness = 0.08;
        handleMat.emissive.set(0x000000);
        break;
      case 'carbon':
        handleMat.color.set(0x1c212b);
        handleMat.map = carbonTex;
        handleMat.roughness = 0.28;
        handleMat.metalness = 0.48;
        handleMat.emissive.set(0x000000);
        break;
      case 'ivory':
        handleMat.color.set(0xf1ece2);
        handleMat.map = null;
        handleMat.roughness = 0.22;
        handleMat.metalness = 0.05;
        handleMat.emissive.set(0x000000);
        break;
      case 'ruby':
        handleMat.color.set(0x8a0c20);
        handleMat.map = null;
        handleMat.roughness = 0.14;
        handleMat.metalness = 0.22;
        handleMat.emissive.set(0x280208);
        break;
      case 'cyber':
        handleMat.color.set(0x0d1424);
        handleMat.map = carbonTex;
        handleMat.roughness = 0.25;
        handleMat.metalness = 0.70;
        handleMat.emissive.set(0x00d4ff);
        handleMat.emissiveIntensity = 0.25;
        break;
      case 'gold':
        handleMat.color.set(0xd4af37);
        handleMat.map = null;
        handleMat.roughness = 0.24;
        handleMat.metalness = 0.94;
        handleMat.emissive.set(0x000000);
        break;
      case 'custom':
        handleMat.color.set(cfg.handleColor || '#2b1308');
        handleMat.map = null;
        handleMat.roughness = 0.45;
        handleMat.metalness = 0.15;
        handleMat.emissive.set(0x000000);
        break;
    }
    handleMat.needsUpdate = true;

    // Guard & Pommel Metal
    const metalColors = {
      brass: { color: 0xbfa366, metal: 0.86, rough: 0.28 },
      steel: { color: 0xc4ccd6, metal: 0.95, rough: 0.16 },
      gold:  { color: 0xf5c542, metal: 0.96, rough: 0.20 },
      dark:  { color: 0x1f2229, metal: 0.75, rough: 0.40 },
    };
    const gm = metalColors[cfg.guardMaterial] || metalColors.brass;
    guardMat.color.set(gm.color);
    guardMat.metalness = gm.metal;
    guardMat.roughness = gm.rough;
    guardMat.needsUpdate = true;
    pommelMat.color.set(gm.color);
    pommelMat.metalness = gm.metal;
    pommelMat.roughness = gm.rough;
    pommelMat.needsUpdate = true;

    // Rivet metal
    const rm = metalColors[cfg.rivetStyle] || metalColors.brass;
    rivetMat.color.set(rm.color);
    rivetMat.metalness = rm.metal;
    rivetMat.roughness = rm.rough;
    rivetMat.needsUpdate = true;

    // Blade finish
    switch (cfg.bladeFinish) {
      case 'damascus':
        bladeMat.color.set(0xdde3ec);
        bladeMat.map = damascusTex;
        bladeMat.roughness = 0.12;
        bladeMat.metalness = 0.94;
        bladeMat.emissive.set(0x000000);
        break;
      case 'mirror':
        bladeMat.color.set(0xf0f4f9);
        bladeMat.map = null;
        bladeMat.roughness = 0.04;
        bladeMat.metalness = 0.98;
        bladeMat.emissive.set(0x000000);
        break;
      case 'gold':
        bladeMat.color.set(0xffcf4d);
        bladeMat.map = null;
        bladeMat.roughness = 0.10;
        bladeMat.metalness = 0.96;
        bladeMat.emissive.set(0x000000);
        break;
      case 'cyber':
        bladeMat.color.set(0x111624);
        bladeMat.map = null;
        bladeMat.roughness = 0.18;
        bladeMat.metalness = 0.85;
        bladeMat.emissive.set(0x00e5ff);
        bladeMat.emissiveIntensity = 0.35;
        break;
      case 'obsidian':
        bladeMat.color.set(0x171920);
        bladeMat.map = null;
        bladeMat.roughness = 0.32;
        bladeMat.metalness = 0.72;
        bladeMat.emissive.set(0x000000);
        break;
    }
    bladeMat.needsUpdate = true;

    // Edge glow
    if (cfg.bladeGlow || cfg.bladeFinish === 'cyber') {
      glowMat.color.set(cfg.bladeGlowColor || (cfg.bladeFinish === 'cyber' ? 0x00f0ff : 0xff996a));
      glowMat.opacity = 0.75;
      edgeMat.emissive.set(glowMat.color);
      edgeMat.emissiveIntensity = 0.6;
    } else {
      glowMat.opacity = 0.0;
      edgeMat.emissive.set(0x000000);
      edgeMat.emissiveIntensity = 0.0;
    }
    glowMat.needsUpdate = true;
    edgeMat.needsUpdate = true;
  }

  // ── Build Blade Shape ─────────────────────────────────────────────
  function getBladeShape(type) {
    const s = new THREE.Shape();
    switch (type) {
      case 'santoku':
        s.moveTo( 0.00, 0.00);        // tip
        s.lineTo(-0.08, 0.18);        // curved sheepsfoot spine
        s.lineTo(-0.085, 0.75);       // straight spine
        s.lineTo(-0.08, 1.12);        // spine heel
        s.lineTo( 0.00, 1.12);        // bolster
        s.lineTo( 0.085, 1.12);       // edge heel
        s.lineTo( 0.08, 0.50);        // straight cutting edge
        s.lineTo( 0.05, 0.10);        // sweep to tip
        s.closePath();
        break;

      case 'cleaver':
        s.moveTo( 0.08, 0.00);        // bottom corner
        s.lineTo(-0.11, 0.00);        // front flat edge top
        s.lineTo(-0.12, 1.12);        // spine
        s.lineTo( 0.00, 1.12);
        s.lineTo( 0.12, 1.12);        // back heel
        s.lineTo( 0.115, 0.55);       // cutting edge
        s.lineTo( 0.10, 0.10);
        s.closePath();
        break;

      case 'katana':
        s.moveTo( 0.00, 0.00);        // kissaki tip
        s.lineTo(-0.038, 0.18);       // angled tanto spine point
        s.lineTo(-0.046, 0.80);       // slender spine
        s.lineTo(-0.04, 1.15);        // habaki base
        s.lineTo( 0.00, 1.15);
        s.lineTo( 0.045, 1.15);       // edge base
        s.lineTo( 0.042, 0.60);       // edge
        s.lineTo( 0.035, 0.22);       // yokote transition
        s.lineTo( 0.012, 0.06);
        s.closePath();
        break;

      case 'dagger':
        s.moveTo( 0.00, 0.00);        // spear point
        s.lineTo(-0.045, 0.22);
        s.lineTo(-0.062, 0.70);
        s.lineTo(-0.052, 1.12);
        s.lineTo( 0.00, 1.12);
        s.lineTo( 0.052, 1.12);
        s.lineTo( 0.062, 0.70);
        s.lineTo( 0.045, 0.22);
        s.closePath();
        break;

      case 'chef':
      default:
        s.moveTo( 0.00,  0.00);       // tip
        s.lineTo(-0.04,  0.30);       // spine near tip
        s.lineTo(-0.07,  0.70);       // spine mid
        s.lineTo(-0.06,  1.00);       // spine shoulder
        s.lineTo( 0.00,  1.12);       // bolster top
        s.lineTo( 0.09,  0.90);       // edge shoulder
        s.lineTo( 0.11,  0.48);       // belly curve
        s.lineTo( 0.06,  0.14);       // near tip edge
        s.closePath();
        break;
    }
    return s;
  }

  // ── Build Blade Mesh ──────────────────────────────────────────────
  let bladeMesh = null;
  let edgeMesh = null;
  let spineMesh = null;
  let glowMesh = null;

  function rebuildBlade() {
    while (bladeGroup.children.length > 0) {
      const obj = bladeGroup.children[0];
      bladeGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
    }

    const shape = getBladeShape(cfg.bladeType);
    const bladeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.032, bevelEnabled: true,
      bevelSize: 0.009, bevelThickness: 0.007, bevelSegments: 3,
    });
    bladeGeo.computeVertexNormals();
    bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
    bladeMesh.castShadow = true;
    bladeGroup.add(bladeMesh);

    // Edge highlight
    const edgeWidth = cfg.bladeType === 'cleaver' ? 0.11 : 0.09;
    const edgeGeo = new THREE.BoxGeometry(0.008, 0.88, 0.004);
    edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
    edgeMesh.position.set(edgeWidth, 0.50, 0.016);
    bladeGroup.add(edgeMesh);

    // Edge glow strip
    const glowGeo = new THREE.BoxGeometry(0.018, 0.92, 0.012);
    glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.position.set(edgeWidth + 0.004, 0.50, 0.016);
    bladeGroup.add(glowMesh);

    // Spine highlight
    const spineWidth = cfg.bladeType === 'cleaver' ? -0.11 : (cfg.bladeType === 'katana' ? -0.042 : -0.06);
    const spineGeo = new THREE.BoxGeometry(0.006, 0.82, 0.003);
    spineMesh = new THREE.Mesh(spineGeo, spineMat);
    spineMesh.position.set(spineWidth, 0.50, 0.016);
    bladeGroup.add(spineMesh);

    bladeGroup.scale.set(cfg.bladeWidth, cfg.bladeLength, 1.0);
  }

  // ── Build Handle Mesh ─────────────────────────────────────────────
  function rebuildHandle() {
    while (handleGroup.children.length > 0) {
      const obj = handleGroup.children[0];
      handleGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
    }

    const baseLen = 0.76 * cfg.handleLength;
    const th      = cfg.handleThickness;

    // 1. Guard / Bolster
    if (cfg.guardStyle !== 'none') {
      const guardSub = new THREE.Group();

      if (cfg.guardStyle === 'tsuba') {
        // Japanese oval disc
        const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * th, 0.18 * th, 0.045, 32), guardMat);
        tsuba.scale.set(1.15, 1.0, 0.85);
        tsuba.position.set(0, 0.02, 0);
        tsuba.castShadow = true;
        guardSub.add(tsuba);
      } else if (cfg.guardStyle === 'crossguard') {
        // Wide medieval crossguard
        const cg = new THREE.Mesh(new THREE.BoxGeometry(0.48 * th, 0.075, 0.062), guardMat);
        cg.position.set(0, 0.02, 0);
        cg.castShadow = true;
        guardSub.add(cg);
        for (const sx of [-1, 1]) {
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.042 * th, 12, 10), guardMat);
          cap.position.set(sx * 0.24 * th, 0.02, 0);
          guardSub.add(cap);
        }
      } else if (cfg.guardStyle === 'sleek') {
        // Sleek minimal bolster collar
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.065 * th, 0.075 * th, 0.06, 24), guardMat);
        collar.position.set(0, 0.025, 0);
        collar.castShadow = true;
        guardSub.add(collar);
      } else {
        // Classic chef knife bolster bar
        const gm = new THREE.Mesh(new THREE.BoxGeometry(0.30 * th, 0.07, 0.058), guardMat);
        gm.position.set(0, 0.02, 0);
        gm.castShadow = true;
        guardSub.add(gm);
        for (const sx of [-1, 1]) {
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * th, 0.035 * th, 0.058, 12), guardMat);
          cap.rotation.x = Math.PI / 2;
          cap.position.set(sx * 0.15 * th, 0.02, 0);
          guardSub.add(cap);
        }
      }

      guardSub.position.set(0, 0, 0);
      handleGroup.add(guardSub);
    }

    // 2. Grip geometry based on handleStyle
    let gripGeo;
    const gripYOffset = 0.04;

    if (cfg.handleStyle === 'octagonal') {
      // Japanese Wa-handle: 8-sided faceted prism
      const rTop = 0.046 * th;
      const rBot = 0.056 * th;
      gripGeo = new THREE.CylinderGeometry(rBot, rTop, baseLen, 8);
      gripGeo.translate(0, baseLen / 2, 0);
    } else if (cfg.handleStyle === 'cordwrap') {
      // Samurai / tactical tsukamaki cord-wrap
      const pts = [];
      const steps = 36;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const groove = Math.abs(Math.sin(t * Math.PI * 12)) * 0.007;
        const r = (0.048 + Math.sin(t * Math.PI) * 0.016 - groove) * th;
        pts.push(new THREE.Vector2(Math.max(r, 0.022), t * baseLen));
      }
      gripGeo = new THREE.LatheGeometry(pts, 24);
    } else if (cfg.handleStyle === 'tactical') {
      // Sculpted finger-grooved tactical grip
      const pts = [];
      const steps = 30;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const notch = Math.sin(t * Math.PI * 6) * 0.007;
        const r = (0.046 + (t > 0.85 ? 0.016 : 0) + notch) * th;
        pts.push(new THREE.Vector2(Math.max(r, 0.025), t * baseLen));
      }
      gripGeo = new THREE.LatheGeometry(pts, 18);
    } else {
      // Ergonomic lathe swell
      const pts = [];
      const steps = 18;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const r = (0.042 + Math.sin(t * Math.PI) * 0.024 + Math.pow(t, 4) * 0.014) * th;
        pts.push(new THREE.Vector2(r, t * baseLen));
      }
      gripGeo = new THREE.LatheGeometry(pts, 20);
    }

    gripGeo.computeVertexNormals();
    const gripMesh = new THREE.Mesh(gripGeo, handleMat);
    gripMesh.position.set(0, gripYOffset, 0);
    gripMesh.castShadow = true;
    handleGroup.add(gripMesh);

    // 3. Rivets along handle length
    if (cfg.showRivets && cfg.handleStyle !== 'cordwrap') {
      const rivetGeo = new THREE.SphereGeometry(0.022 * th, 8, 8);
      const count = cfg.handleLength > 1.4 ? 4 : (cfg.handleLength < 0.8 ? 2 : 3);
      for (let i = 0; i < count; i++) {
        const t = (i + 1) / (count + 1);
        const ry = gripYOffset + t * baseLen;
        for (const sz of [0.054 * th, -0.054 * th]) {
          const rv = new THREE.Mesh(rivetGeo, rivetMat);
          rv.position.set(0, ry, sz);
          handleGroup.add(rv);
        }
      }
    }

    // 4. Pommel at the end of the grip
    const pommelY = gripYOffset + baseLen;
    if (cfg.pommelStyle === 'sphere') {
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.060 * th, 14, 12), pommelMat);
      pommel.position.set(0, pommelY + 0.02, 0);
      pommel.castShadow = true;
      handleGroup.add(pommel);
    } else if (cfg.pommelStyle === 'ring') {
      // Tactical Karambit / kunai retention ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075 * th, 0.020 * th, 12, 28), pommelMat);
      ring.position.set(0, pommelY + 0.08 * th, 0);
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = true;
      handleGroup.add(ring);
    } else if (cfg.pommelStyle === 'flat') {
      // Tactical flat buttcap
      const flat = new THREE.Mesh(new THREE.CylinderGeometry(0.058 * th, 0.054 * th, 0.038, 16), pommelMat);
      flat.position.set(0, pommelY + 0.02, 0);
      flat.castShadow = true;
      handleGroup.add(flat);
    } else if (cfg.pommelStyle === 'spike') {
      // Conical glass breaker / strike spike
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.048 * th, 0.11 * th, 14), pommelMat);
      spike.position.set(0, pommelY + 0.055 * th, 0);
      spike.castShadow = true;
      handleGroup.add(spike);
    }

    // Position handleGroup at the bolster of the blade
    const bolsterY = 1.14 * cfg.bladeLength;
    handleGroup.position.set(0, bolsterY, 0);
    handleGroup.rotation.z = cfg.handleAngle;
  }

  // ── Update Grip Pivot ─────────────────────────────────────────────
  function updatePivot() {
    const bLen = 1.14 * cfg.bladeLength;
    const hLen = 0.76 * cfg.handleLength;

    if (cfg.gripPivot === 'tip') {
      knifePivot.position.set(0, 0, 0);
    } else if (cfg.gripPivot === 'guard') {
      knifePivot.position.set(0, -bLen, 0);
    } else {
      // 'handle' — center of grip in player's hand
      knifePivot.position.set(0, -(bLen + hLen * 0.48), 0);
    }
  }

  // ── Full Rebuild ──────────────────────────────────────────────────
  function rebuild() {
    updateMaterials();
    rebuildBlade();
    rebuildHandle();
    updatePivot();
  }

  // Initial build
  rebuild();
  scene.add(group);

  // ── Motion Trail ──────────────────────────────────────────────────
  const MAX_TRAIL = 30;
  const trailPositions = new Float32Array(MAX_TRAIL * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trailMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  const trailLine = new THREE.Line(trailGeo, trailMat);
  scene.add(trailLine);

  const trailHistory = [];

  // ── State ─────────────────────────────────────────────────────────
  const currentPos = new THREE.Vector3();
  const targetPos  = new THREE.Vector3();
  const prevPos    = new THREE.Vector3();
  let speed = 0;
  let initialized = false;

  // ── Update Frame ──────────────────────────────────────────────────
  function update(worldPt, dt) {
    if (!worldPt) return;

    targetPos.copy(worldPt);

    if (!initialized) {
      currentPos.copy(targetPos);
      prevPos.copy(targetPos);
      initialized = true;
    }

    prevPos.copy(currentPos);

    const alpha = 1.0 - Math.pow(cfg.smoothing, dt * 60);
    currentPos.lerp(targetPos, Math.max(alpha, 0.05));

    group.position.copy(currentPos);
    group.scale.setScalar(cfg.size);

    // ── Tilting with velocity ──────────────────────────────────────
    const vel = new THREE.Vector3().subVectors(currentPos, prevPos);
    speed = vel.length() / Math.max(dt, 0.001);

    const swipeAngle = vel.length() > 0.002 ? Math.atan2(vel.x, vel.y) : 0;
    const tiltFwd    = Math.min(speed * 0.004, 0.5) * cfg.tiltAmount;
    const tiltSide   = swipeAngle * 0.28 * cfg.tiltAmount;

    group.rotation.set(
      cfg.baseRotX - tiltFwd,
      cfg.baseRotY + tiltSide,
      cfg.baseRotZ + swipeAngle * 0.22 * cfg.tiltAmount
    );

    // Pulse glow with speed
    if (glowMesh && cfg.bladeGlow) {
      glowMat.opacity = 0.5 + Math.min(speed / 15, 0.5);
    }

    // ── Trail ─────────────────────────────────────────────────────
    trailHistory.unshift(currentPos.clone());
    const len = Math.round(cfg.trailLength);
    if (trailHistory.length > Math.max(len, 1)) trailHistory.length = Math.max(len, 1);

    for (let i = 0; i < MAX_TRAIL; i++) {
      const p = trailHistory[i] || currentPos;
      trailPositions[i * 3]     = p.x;
      trailPositions[i * 3 + 1] = p.y + 0.04;
      trailPositions[i * 3 + 2] = p.z;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.setDrawRange(0, trailHistory.length);

    const tc = TRAIL_COLORS[cfg.trailColor] || TRAIL_COLORS.amber;
    const speedNorm = Math.min(speed / 14, 1);
    trailMat.opacity = speedNorm * 0.65 * (len > 0 ? 1 : 0);
    trailMat.color.set(speedNorm > 0.4 ? tc.hot : tc.base);
  }

  function setVisible(v) {
    group.visible     = v;
    trailLine.visible = v;
    if (!v) initialized = false;
  }

  function setConfig(patch) {
    let needsBladeRebuild  = false;
    let needsHandleRebuild = false;
    let needsMatUpdate     = false;
    let needsPivotUpdate   = false;

    for (const key of Object.keys(patch)) {
      if (patch[key] === undefined) continue;
      cfg[key] = patch[key];

      if (['bladeType', 'bladeLength', 'bladeWidth'].includes(key)) {
        needsBladeRebuild = true;
        needsPivotUpdate  = true;
      }
      if (['handleLength', 'handleThickness', 'handleAngle', 'handleStyle',
           'guardStyle', 'pommelStyle', 'showRivets'].includes(key)) {
        needsHandleRebuild = true;
        needsPivotUpdate   = true;
      }
      if (['handleTheme', 'handleColor', 'guardMaterial', 'pommelStyle',
           'rivetStyle', 'bladeFinish', 'bladeGlow', 'bladeGlowColor'].includes(key)) {
        needsMatUpdate = true;
      }
      if (key === 'gripPivot') {
        needsPivotUpdate = true;
      }
    }

    if (needsMatUpdate)     updateMaterials();
    if (needsBladeRebuild)  rebuildBlade();
    if (needsHandleRebuild) rebuildHandle();
    if (needsPivotUpdate)   updatePivot();
  }

  function rotateAngle(deltaRad) {
    cfg.baseRotZ = (cfg.baseRotZ + deltaRad) % (Math.PI * 2);
    if (cfg.baseRotZ < 0) cfg.baseRotZ += Math.PI * 2;
    return cfg.baseRotZ;
  }

  // ── Knife Presets ─────────────────────────────────────────────────
  const PRESETS = {
    chef: {
      bladeType: 'chef', bladeFinish: 'damascus', bladeLength: 1.0, bladeWidth: 1.0,
      handleTheme: 'rosewood', handleStyle: 'ergonomic', handleLength: 1.0, handleThickness: 1.0,
      handleAngle: 0.0, guardStyle: 'classic', guardMaterial: 'brass', pommelStyle: 'sphere',
      showRivets: true, rivetStyle: 'brass', bladeGlow: false, trailColor: 'amber',
      gripPivot: 'handle', baseRotZ: 2.65,
    },
    katana: {
      bladeType: 'katana', bladeFinish: 'cyber', bladeLength: 1.4, bladeWidth: 0.85,
      handleTheme: 'cyber', handleStyle: 'cordwrap', handleLength: 1.35, handleThickness: 0.95,
      handleAngle: -0.08, guardStyle: 'tsuba', guardMaterial: 'dark', pommelStyle: 'ring',
      showRivets: false, bladeGlow: true, bladeGlowColor: '#00f0ff', trailColor: 'cyan',
      gripPivot: 'handle', baseRotZ: 2.75,
    },
    cleaver: {
      bladeType: 'cleaver', bladeFinish: 'mirror', bladeLength: 0.95, bladeWidth: 1.35,
      handleTheme: 'ebony', handleStyle: 'octagonal', handleLength: 1.1, handleThickness: 1.15,
      handleAngle: 0.05, guardStyle: 'sleek', guardMaterial: 'steel', pommelStyle: 'flat',
      showRivets: true, rivetStyle: 'silver', bladeGlow: false, trailColor: 'silver',
      gripPivot: 'handle', baseRotZ: 2.60,
    },
    gold: {
      bladeType: 'dagger', bladeFinish: 'gold', bladeLength: 1.15, bladeWidth: 1.0,
      handleTheme: 'gold', handleStyle: 'ergonomic', handleLength: 1.0, handleThickness: 1.0,
      handleAngle: 0.0, guardStyle: 'crossguard', guardMaterial: 'gold', pommelStyle: 'sphere',
      showRivets: true, rivetStyle: 'gold', bladeGlow: true, bladeGlowColor: '#ffd700', trailColor: 'gold',
      gripPivot: 'handle', baseRotZ: 2.65,
    },
    tactical: {
      bladeType: 'santoku', bladeFinish: 'obsidian', bladeLength: 1.1, bladeWidth: 1.05,
      handleTheme: 'carbon', handleStyle: 'tactical', handleLength: 1.15, handleThickness: 1.08,
      handleAngle: -0.12, guardStyle: 'crossguard', guardMaterial: 'dark', pommelStyle: 'spike',
      showRivets: false, bladeGlow: false, trailColor: 'crimson',
      gripPivot: 'handle', baseRotZ: 2.55,
    },
    ruby: {
      bladeType: 'dagger', bladeFinish: 'damascus', bladeLength: 1.25, bladeWidth: 0.9,
      handleTheme: 'ruby', handleStyle: 'ergonomic', handleLength: 1.05, handleThickness: 0.95,
      handleAngle: 0.0, guardStyle: 'crossguard', guardMaterial: 'gold', pommelStyle: 'ring',
      showRivets: true, rivetStyle: 'gold', bladeGlow: true, bladeGlowColor: '#ff2a55', trailColor: 'crimson',
      gripPivot: 'handle', baseRotZ: 2.65,
    },
  };

  function applyPreset(name) {
    if (PRESETS[name]) {
      setConfig(PRESETS[name]);
      return PRESETS[name];
    }
    return null;
  }

  function getSpeed() { return speed; }

  setVisible(false);

  return {
    group,
    update,
    setVisible,
    setConfig,
    getConfig: () => ({ ...cfg }),
    rebuild,
    rotateAngle,
    applyPreset,
    getSpeed,
    _cfg: cfg,
    PRESETS,
  };
}
