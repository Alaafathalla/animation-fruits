import * as THREE from 'three';

/**
 * Jelly Garden — Knife
 *
 * Matches the reference screenshot exactly:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │  ●   ●   ●          dark grey slab blade      \
 *   └──────────────────────────────────────────────/
 *
 *  - Long flat horizontal dark-grey rectangular slab
 *  - Three rivets / dots on the face
 *  - Right end tapers to a point (angled cut, not rounded)
 *  - Left end is straight/flat
 *  - Very shallow height compared to width (looks like a bar)
 *  - Floats as a 3D object tracking the mouse horizontally
 *
 * Local space layout:
 *   X  — length direction, tip points RIGHT (+X)
 *   Y  — height (small), top = +Y, bottom = 0
 *   Z  — thickness (very thin, ~0.06)
 *
 * baseRotZ = 0 → knife horizontal, matching reference.
 */

export function createKnife(scene) {

  // ── Hierarchy ────────────────────────────────────────────────
  const group = new THREE.Group();   // world-position + rotation
  const tilt  = new THREE.Group();   // velocity-driven tilt layer
  group.add(tilt);

  // ── Config ───────────────────────────────────────────────────
  const _cfg = {
    depth:       0.5,
    smoothing:   0.07,
    baseRotX:    0.0,
    baseRotY:    0.0,
    baseRotZ:    0.0,     // 0 = horizontal blade
    tiltAmount:  0.30,
    size:        1.0,
    trailLength: 14,
  };

  // ── Dimensions ───────────────────────────────────────────────
  // Reference: very wide and shallow, right end has angled tip
  const BL  = 3.60;   // total blade length
  const BH  = 0.38;   // blade height (short — it's a slab)
  const BT  = 0.055;  // half-thickness (thicker than a kitchen knife — it's a bar)
  const TIP = 0.28;   // how far back the right taper starts from the right edge

  // ── Materials ────────────────────────────────────────────────

  // Body — dark charcoal gunmetal, slight sheen
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color:              0x2e3138,
    roughness:          0.28,
    metalness:          0.88,
    clearcoat:          0.70,
    clearcoatRoughness: 0.10,
    side: THREE.DoubleSide,
  });

  // Top + bottom thin bright strip (edge/spine lines)
  const stripMat = new THREE.MeshStandardMaterial({
    color:    0x8899aa,
    roughness: 0.12,
    metalness: 0.98,
    emissive:  new THREE.Color(0x334455),
    emissiveIntensity: 0.0,
  });

  // Rivet material — slightly lighter metallic circles
  const rivetMat = new THREE.MeshStandardMaterial({
    color:    0x4a5260,
    roughness: 0.20,
    metalness: 0.96,
  });

  // Glint — white flash plane on face
  const glintMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false,
  });

  // ── Blade shape (XY plane, extruded on Z) ────────────────────
  //
  // Shape:
  //   bottom-left → bottom-right(near tip) → TIP POINT → top-right → top-left → close
  //
  //   y = BH  ┌─────────────────────────────────────────┐  top-left   top-right
  //            │                                          \
  //   y = 0   └──────────────────────────────────────────'  tip point (right, mid-height)
  //
  //   x:  -BL/2 (left)   ...   +BL/2 - TIP (taper start)  ... +BL/2 (tip point)

  const shape = new THREE.Shape();

  const x0 = -BL / 2;           // left edge
  const x1 =  BL / 2 - TIP;    // taper start
  const x2 =  BL / 2;           // tip point (rightmost)
  const tipY = BH * 0.5;        // tip is at mid-height

  shape.moveTo(x0, 0);                      // bottom-left
  shape.lineTo(x1, 0);                      // bottom → taper start
  shape.lineTo(x2, tipY);                   // taper down to tip point
  shape.lineTo(x1, BH);                     // tip back up to top-right
  shape.lineTo(x0, BH);                     // top-left
  shape.closePath();

  const bladeGeo = new THREE.ExtrudeGeometry(shape, {
    depth:          BT * 2,
    bevelEnabled:   true,
    bevelThickness: 0.004,
    bevelSize:      0.005,
    bevelSegments:  2,
  });
  bladeGeo.translate(0, 0, -BT);  // centre on z=0

  const bladeMesh = new THREE.Mesh(bladeGeo, bodyMat);
  bladeMesh.castShadow = true;
  tilt.add(bladeMesh);

  // ── Top + bottom edge strips ──────────────────────────────────
  // Top strip
  const topStrip = new THREE.Mesh(
    new THREE.BoxGeometry(BL * 0.72, 0.010, BT * 0.5),
    stripMat
  );
  topStrip.position.set(x0 + BL * 0.36, BH - 0.005, 0);
  tilt.add(topStrip);

  // Bottom strip
  const botStrip = new THREE.Mesh(
    new THREE.BoxGeometry(BL * 0.72, 0.010, BT * 0.5),
    stripMat
  );
  botStrip.position.set(x0 + BL * 0.36, 0.005, 0);
  tilt.add(botStrip);

  // ── Three rivets on the face ──────────────────────────────────
  // Evenly spaced on the left 60% of the blade, vertically centred
  const rivetPositions = [-BL * 0.22, -BL * 0.08, BL * 0.06];
  rivetPositions.forEach(rx => {
    // Front face rivet
    const riv = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, BT * 0.4, 16),
      rivetMat
    );
    riv.rotation.x = Math.PI / 2;
    riv.position.set(rx, BH * 0.5, BT + 0.012);
    tilt.add(riv);

    // Subtle rivet shadow ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.038, 0.058, 16),
      new THREE.MeshBasicMaterial({ color: 0x1a1d22, transparent: true, opacity: 0.35, depthWrite: false })
    );
    ring.position.set(rx, BH * 0.5, BT + 0.013);
    tilt.add(ring);
  });

  // ── Glint plane (flash on cut) ────────────────────────────────
  const glintMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(BL * 0.55, BH * 0.70),
    glintMat
  );
  glintMesh.position.set(-BL * 0.05, BH * 0.5, BT + 0.001);
  tilt.add(glintMesh);

  // ── Edge light (flashes on cut) ───────────────────────────────
  const edgeLight = new THREE.PointLight(0xaaccff, 0, 5, 2);
  group.add(edgeLight);

  // ── Motion trail ─────────────────────────────────────────────
  const MAX_TRAIL = 28;
  const trailBuf  = new Float32Array(MAX_TRAIL * 3);
  const trailGeo  = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailBuf, 3));
  const trailMat = new THREE.LineBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0,
  });
  const trailLine = new THREE.Line(trailGeo, trailMat);
  scene.add(trailLine);
  const trailHistory = [];

  // ── Animation state ───────────────────────────────────────────
  let chopState   = 'idle';
  let chopTimer   = 0;
  let isHovering  = false;
  let isSlicing   = false;
  let chopOffsetY = 0;
  let chopTiltX   = 0;
  let chopFlash   = 0;

  function setHovering(val) { isHovering = val; }
  function setSlicing(val)  { isSlicing  = val; }

  function triggerChop() {
    chopState = 'chopping';
    chopTimer = 0;
    chopFlash = 1.0;
  }

  // ── Smooth-follow ─────────────────────────────────────────────
  const currentPos = new THREE.Vector3();
  const targetPos  = new THREE.Vector3();
  const prevPos    = new THREE.Vector3();
  let speed       = 0;
  let initialized = false;

  // ── update ────────────────────────────────────────────────────
  function update(worldPt, dt) {
    if (!worldPt) return;

    targetPos.copy(worldPt);

    if (!initialized) {
      currentPos.copy(targetPos);
      prevPos.copy(targetPos);
      initialized = true;
    }

    prevPos.copy(currentPos);

    const smth  = chopState === 'chopping' ? 0.012 : _cfg.smoothing;
    const alpha = 1.0 - Math.pow(smth, dt * 60);
    currentPos.lerp(targetPos, Math.max(alpha, 0.055));

    // ── State machine ─────────────────────────────────────────
    chopTimer += dt;

    switch (chopState) {
      case 'idle':
        if (isHovering && !isSlicing) { chopState = 'hovering'; chopTimer = 0; }
        chopOffsetY = 0;
        chopTiltX   = 0;
        break;

      case 'hovering': {
        if (!isHovering) { chopState = 'idle'; chopTimer = 0; break; }
        chopOffsetY = 0.06 + Math.sin(chopTimer * 3.8) * 0.035;
        chopTiltX   = -0.03;
        break;
      }

      case 'chopping': {
        const t    = Math.min(chopTimer / 0.14, 1.0);
        const ease = t * t * (3 - 2 * t);
        chopOffsetY = -ease * 0.80;
        chopTiltX   =  ease * 0.10;
        if (chopTimer >= 0.14) { chopState = 'exit'; chopTimer = 0; }
        break;
      }

      case 'exit': {
        const t    = Math.min(chopTimer / 0.26, 1.0);
        const ease = 1 - Math.pow(1 - t, 3);
        chopOffsetY = -0.80 + ease * 0.88;
        chopTiltX   =  0.10 * (1 - ease);
        if (chopTimer >= 0.26) {
          chopOffsetY = 0; chopTiltX = 0;
          chopState   = isHovering ? 'hovering' : 'idle';
          chopTimer   = 0;
        }
        break;
      }
    }

    // Apply chop offset
    const dp = currentPos.clone();
    dp.y += chopOffsetY;

    group.position.copy(dp);
    group.scale.setScalar(_cfg.size);

    // ── Velocity tilt ─────────────────────────────────────────
    const vel        = new THREE.Vector3().subVectors(currentPos, prevPos);
    speed            = vel.length() / Math.max(dt, 0.001);
    const swipeAngle = vel.length() > 0.002 ? Math.atan2(vel.x, vel.y) : 0;
    const tiltFwd    = Math.min(speed * 0.0020, 0.28) * _cfg.tiltAmount;
    const tiltSide   = swipeAngle * 0.14 * _cfg.tiltAmount;

    tilt.rotation.set(
      _cfg.baseRotX + chopTiltX - tiltFwd,
      _cfg.baseRotY + tiltSide,
      0
    );
    group.rotation.set(0, 0, _cfg.baseRotZ + swipeAngle * 0.10 * _cfg.tiltAmount);

    // ── Flash ─────────────────────────────────────────────────
    chopFlash                 = Math.max(0, chopFlash - dt * 4.5);
    glintMat.opacity          = chopFlash * 0.40;
    stripMat.emissiveIntensity = chopFlash * 0.90;
    edgeLight.intensity       = chopFlash * 5.0;

    // ── Trail ─────────────────────────────────────────────────
    trailHistory.unshift(dp.clone());
    const len = Math.round(_cfg.trailLength);
    if (trailHistory.length > Math.max(len, 1)) trailHistory.length = Math.max(len, 1);

    for (let i = 0; i < MAX_TRAIL; i++) {
      const p             = trailHistory[i] || dp;
      trailBuf[i * 3]     = p.x;
      trailBuf[i * 3 + 1] = p.y + 0.010;
      trailBuf[i * 3 + 2] = p.z;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.setDrawRange(0, trailHistory.length);

    const sn         = Math.min(speed / 10, 1);
    const chopBoost  = chopState === 'chopping' ? 1 : 0;
    trailMat.opacity = Math.max(sn * 0.38, chopBoost * 0.72) * (len > 0 ? 1 : 0);
    trailMat.color.setRGB(0.78 + chopBoost * 0.22, 0.86 + chopBoost * 0.10, 1.0);
  }

  // ── Public API ────────────────────────────────────────────────
  function setVisible(v) {
    group.visible     = v;
    trailLine.visible = v;
    if (!v) {
      initialized = false;
      chopState   = 'idle';
      chopTimer   = 0;
      chopFlash   = 0;
      isHovering  = false;
      isSlicing   = false;
    }
  }

  function setConfig(patch) { if (patch) Object.assign(_cfg, patch); }

  function rotateAngle(deltaRad) {
    _cfg.baseRotZ = (_cfg.baseRotZ + deltaRad) % (Math.PI * 2);
    if (_cfg.baseRotZ < 0) _cfg.baseRotZ += Math.PI * 2;
    return _cfg.baseRotZ;
  }

  function getSpeed() { return speed; }

  scene.add(group);
  setVisible(false);

  return {
    group, update, setVisible, setConfig,
    getConfig: () => ({ ..._cfg }),
    rotateAngle,
    applyPreset: () => null,
    getSpeed,
    setHovering,
    setSlicing,
    triggerChop,
    _cfg,
    PRESETS: {},
  };
}
