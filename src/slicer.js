import * as THREE from 'three';
import { splitGeometry } from './geometryCut.js';

/**
 * Jelly Garden Slicer
 *
 * Additions over the original:
 *  - Hover detection → knife.setHovering(), fruit outline glow (PointLight)
 *  - knife.setSlicing() on pointerdown/up
 *  - knife.triggerChop() each time a fruit is actually cut
 *  - Animated SVG arc stroke instead of a plain line
 *  - Bigger, coloured juice burst (colour from fruit)
 *  - Screen-space impact ring flash (CSS div)
 */
export function createSlicer(canvas, camera, scene, physics, knife, onScore, onBomb) {

  const raycaster = new THREE.Raycaster();
  const mouse     = new THREE.Vector2();
  const juice     = [];
  const flashes   = [];
  const strokes   = [];
  const svg       = document.getElementById('slice-svg');

  let active      = false;
  let slicing     = false;
  let lastPoint   = null;
  let lastPointer = null;
  let juiceEnabled = true;

  const consumed  = new WeakSet();
  const tmp       = new THREE.Vector3();
  const camRight  = new THREE.Vector3();
  const camUp     = new THREE.Vector3();
  const cutNormal = new THREE.Vector3();

  // ── Hover glow lights (one per body, pooled) ──────────────────
  const hoverLights = new Map();   // body → PointLight
  let   hoveredBody = null;

  function getHoverLight(body) {
    if (!hoverLights.has(body)) {
      const l = new THREE.PointLight(0xffffff, 0, 2.5, 2);
      scene.add(l);
      hoverLights.set(body, l);
    }
    return hoverLights.get(body);
  }

  function removeHoverLight(body) {
    if (hoverLights.has(body)) {
      scene.remove(hoverLights.get(body));
      hoverLights.delete(body);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function ndc(x, y) {
    const r = canvas.getBoundingClientRect();
    mouse.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    return mouse;
  }

  function screenPt(pos3) {
    const v = pos3.clone().project(camera);
    const r = canvas.getBoundingClientRect();
    return {
      x: r.left + (v.x + 1) * r.width  / 2,
      y: r.top  + (1 - v.y) * r.height / 2,
      z: v.z,
    };
  }

  // ── Juice burst ───────────────────────────────────────────────
  const spriteGeo = new THREE.SphereGeometry(1, 7, 6);

  function spawnJuice(pos, color, count = 36) {
    if (!juiceEnabled) return;
    for (let i = 0; i < count; i++) {
      const r    = 0.016 + Math.random() * 0.042;
      const mesh = new THREE.Mesh(
        spriteGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, depthWrite: false })
      );
      mesh.scale.setScalar(r);
      mesh.position.copy(pos);
      const spd  = 4 + Math.random() * 7;
      const a    = Math.random() * Math.PI * 2;
      const vy   = 2 + Math.random() * 5;
      const vel  = new THREE.Vector3(
        Math.cos(a) * spd, vy, Math.sin(a) * spd * 0.4
      );
      const life = 0.35 + Math.random() * 0.55;
      scene.add(mesh);
      juice.push({ mesh, vel, life, maxLife: life });
    }
  }

  // ── Impact ring (CSS overlay) ─────────────────────────────────
  function spawnImpactRing(screenX, screenY, color) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; pointer-events:none; z-index:50;
      left:${screenX}px; top:${screenY}px;
      width:0; height:0;
      border-radius:50%;
      border: 3px solid ${color};
      transform:translate(-50%,-50%) scale(0);
      animation: jellyRing 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 520);
  }

  // Inject ring keyframe once
  if (!document.getElementById('jelly-ring-style')) {
    const st = document.createElement('style');
    st.id = 'jelly-ring-style';
    st.textContent = `
      @keyframes jellyRing {
        0%   { width:0;    height:0;    opacity:1; }
        100% { width:120px; height:120px; opacity:0; }
      }
    `;
    document.head.appendChild(st);
  }

  // ── Slice a single body ───────────────────────────────────────
  const effectMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide });

  function sliceFruit(body, worldNormal, velocity) {
    if (consumed.has(body) || body.isHalf || (!body.fruitData?.outer && !body.isBomb)) return false;

    if (body.isBomb) {
      consumed.add(body);
      const pos = body.group.position.clone();
      scene.remove(body.group);
      physics.remove(body);
      spawnJuice(pos, 0xff4422, 55);
      onBomb?.(pos);
      return true;
    }

    consumed.add(body);
    const fruit    = body.fruitData;
    const position = body.group.position.clone();
    const quat     = body.group.quaternion.clone();

    const localNormal = worldNormal.clone()
      .applyQuaternion(quat.clone().invert()).normalize();

    const source = fruit.outer.geometry;
    const split  = splitGeometry(source, localNormal);
    if (!split.outline.length || split.halves.some(g => g.getAttribute('position').count < 3))
      return false;

    removeHoverLight(body);
    if (hoveredBody === body) {
      hoveredBody = null;
      knife.setHovering(false);
    }

    const oldMat = fruit.outer.material;

    const insideColors = {
      watermelon: 0xff394c, orange: 0xffae35, apple: 0xffeed0,
      lemon: 0xfff4a0, strawberry: 0xfa667a, grape: 0xc58bf2,
      kiwi: 0x8bc34a, tulip: 0xffccbc,
    };
    const rindColors = {
      watermelon: 0xd7e7a2, orange: 0xffe7b3, apple: 0xffe7b0,
      lemon: 0xfff9c9, strawberry: 0xffd3ce, grape: 0xe6cdf5,
      kiwi: 0x5a9e38, tulip: 0xf5a07a,
    };

    const inside = effectMat(insideColors[fruit.type] ?? fruit.juiceColor);
    const rind   = effectMat(rindColors[fruit.type]   ?? 0xffffff);
    const sep    = worldNormal.clone().multiplyScalar(1.6);

    for (let side = 0; side < 2; side++) {
      const sign  = side === 0 ? 1 : -1;
      const hGroup = new THREE.Group();

      const outer = new THREE.Mesh(split.halves[side], oldMat.clone());
      outer.castShadow = true; outer.receiveShadow = true;
      outer.material.side = THREE.DoubleSide;
      hGroup.add(outer);

      const face = new THREE.Mesh(split.cap,  inside); face.material.side = THREE.DoubleSide;
      hGroup.add(face);
      const edge = new THREE.Mesh(split.rind, rind);
      hGroup.add(edge);

      // Seeds / segments on cut face
      const r = fruit.radius;
      if (fruit.type === 'watermelon' || fruit.type === 'strawberry') {
        const sMat = effectMat(fruit.type === 'watermelon' ? 0x1a0d10 : 0xfff3a0);
        for (let i = 0; i < 8; i++) {
          const a   = i * Math.PI * 2 / 8 + 0.13;
          const loc = split.center.clone()
            .addScaledVector(split.axisU, Math.cos(a) * r * 0.50)
            .addScaledVector(split.axisV, Math.sin(a) * r * 0.50)
            .addScaledVector(localNormal, sign * 0.009);
          const seed = new THREE.Mesh(new THREE.SphereGeometry(r * 0.055, 8, 7), sMat);
          seed.position.copy(loc);
          seed.scale.set(0.6, 1.3, 0.38);
          seed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), localNormal);
          hGroup.add(seed);
        }
      } else if (fruit.type === 'orange' || fruit.type === 'lemon') {
        const segMat = effectMat(0xfff8d8);
        for (let i = 0; i < 9; i++) {
          const a      = i * Math.PI * 2 / 9;
          const radial = split.axisU.clone().multiplyScalar(Math.cos(a))
            .addScaledVector(split.axisV, Math.sin(a));
          const line = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.016, r * 0.76, 5), segMat);
          line.position.copy(split.center).addScaledVector(radial, r * 0.4)
            .addScaledVector(localNormal, sign * 0.014);
          line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial);
          hGroup.add(line);
        }
      } else if (fruit.type === 'kiwi') {
        // Radial segments
        const segMat = effectMat(0x6a9e30);
        for (let i = 0; i < 12; i++) {
          const a      = i * Math.PI * 2 / 12;
          const radial = split.axisU.clone().multiplyScalar(Math.cos(a))
            .addScaledVector(split.axisV, Math.sin(a));
          const line = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.012, r * 0.68, 4), segMat);
          line.position.copy(split.center).addScaledVector(radial, r * 0.36)
            .addScaledVector(localNormal, sign * 0.012);
          line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial);
          hGroup.add(line);
        }
      }

      hGroup.position.copy(position).addScaledVector(worldNormal, sign * 0.04);
      hGroup.quaternion.copy(quat);
      scene.add(hGroup);

      // Half physics — kick sideways + inherit velocity
      const kick = body.velocity.clone()
        .addScaledVector(sep, sign * (2.6 + Math.min(velocity * 0.10, 1.9)));
      kick.y += 0.9;
      physics.add({
        group:      hGroup,
        velocity:   kick,
        angularVel: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 7,
          (Math.random() - 0.5) * 6
        ),
        radius:    fruit.radius * 0.72,
        bounce:    body.bounce * 0.60,
        sleeping:  false,
        isHalf:    true,
        age:       0,
        fruitData: null,
      });
    }

    scene.remove(body.group);
    physics.remove(body);

    // Juice + light flash
    spawnJuice(position, fruit.juiceColor, 44);
    const fl = new THREE.PointLight(fruit.juiceColor, 16, 5.5);
    fl.position.copy(position);
    scene.add(fl);
    flashes.push({ light: fl, life: 0.26 });

    // Screen-space impact ring
    const sp    = screenPt(position);
    const hex   = '#' + new THREE.Color(fruit.juiceColor).getHexString();
    spawnImpactRing(sp.x, sp.y, hex);

    // Notify knife — triggers chop animation
    knife.triggerChop?.();

    onScore?.(position, fruit.type);
    return true;
  }

  // ── Stroke on SVG ─────────────────────────────────────────────
  function drawStroke(a, b) {
    if (!svg) return;
    const ns   = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('stroke', 'rgba(255,255,255,0.75)');
    line.setAttribute('stroke-width', '2.5');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('filter', 'drop-shadow(0 0 6px rgba(200,230,255,0.9))');
    svg.appendChild(line);
    strokes.push({ el: line, life: 0.20 });
  }

  // ── Segment distance helper ───────────────────────────────────
  function segDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t  = THREE.MathUtils.clamp(
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1
    );
    return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
  }

  // ── Cut segment ───────────────────────────────────────────────
  function cutSegment(a, b) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 7) return;

    camera.updateMatrixWorld();
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    camUp.setFromMatrixColumn(camera.matrixWorld, 1);
    cutNormal.copy(camRight).multiplyScalar(-(b.y - a.y) / length)
      .addScaledVector(camUp, -(b.x - a.x) / length).normalize();

    for (const body of [...physics.getBodies()]) {
      if (body.isHalf || (!body.fruitData && !body.isBomb) || consumed.has(body)) continue;
      const centre = screenPt(body.group.position);
      if (centre.z < -1 || centre.z > 1) continue;
      const offset  = body.group.position.clone().addScaledVector(camRight, body.radius);
      const radiusPx = Math.hypot(screenPt(offset).x - centre.x, screenPt(offset).y - centre.y);
      if (segDist(centre, a, b) <= Math.max(12, radiusPx * 0.88)) {
        sliceFruit(body, cutNormal, length);
      }
    }
  }

  // ── Hover detection ───────────────────────────────────────────
  function updateHover() {
    if (!active || slicing) {
      if (hoveredBody) {
        const l = hoverLights.get(hoveredBody);
        if (l) l.intensity = 0;
        hoveredBody = null;
        knife.setHovering?.(false);
      }
      return;
    }
    if (!lastPointer) return;

    ndc(lastPointer.x, lastPointer.y);
    raycaster.setFromCamera(mouse, camera);

    const meshes = [];
    physics.getBodies().forEach(b => {
      if (!b.isHalf && !b.isBomb && b.fruitData)
        b.group.traverse(c => { if (c.isMesh) meshes.push(c); });
    });

    const hits = raycaster.intersectObjects(meshes, false);
    let newHovered = null;

    if (hits.length) {
      const hitMesh = hits[0].object;
      newHovered = physics.getBodies().find(b => {
        let found = false;
        b.group.traverse(c => { if (c === hitMesh) found = true; });
        return found;
      }) ?? null;
    }

    if (newHovered !== hoveredBody) {
      // Fade out old
      if (hoveredBody) {
        const l = hoverLights.get(hoveredBody);
        if (l) l.intensity = 0;
      }
      hoveredBody = newHovered;
      knife.setHovering?.(!!newHovered);
    }

    // Drive hover light
    if (hoveredBody) {
      const l = getHoverLight(hoveredBody);
      l.position.copy(hoveredBody.group.position);
      l.intensity = 1.8 + Math.sin(Date.now() * 0.006) * 0.4;
      l.color.set(hoveredBody.fruitData?.juiceColor ?? 0xffffff);
      l.distance = hoveredBody.radius * 3.0;
    }
  }

  // ── Pointer handlers ──────────────────────────────────────────
  function onPointerDown(e) {
    if (!active) return;
    slicing   = true;
    lastPoint = { x: e.clientX, y: e.clientY };
    lastPointer = lastPoint;
    knife.setSlicing?.(true);
    canvas.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    const next = { x: e.clientX, y: e.clientY };
    lastPointer = next;
    if (active && slicing && lastPoint) {
      cutSegment(lastPoint, next);
      drawStroke(lastPoint, next);
    }
    lastPoint = next;
  }

  function onPointerUp(e) {
    slicing   = false;
    lastPoint = null;
    knife.setSlicing?.(false);
    if (e && canvas.hasPointerCapture?.(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
  }

  // ── setActive ─────────────────────────────────────────────────
  function setActive(value) {
    active = value;
    knife.setVisible(value);
    if (!value) {
      slicing   = false;
      lastPoint = null;
      if (hoveredBody) {
        const l = hoverLights.get(hoveredBody);
        if (l) l.intensity = 0;
        hoveredBody = null;
      }
      knife.setHovering?.(false);
      knife.setSlicing?.(false);
    }
  }

  function setJuiceEnabled(value) { juiceEnabled = value; }

  // ── Per-frame update ──────────────────────────────────────────
  function update(dt) {
    // Move knife to mouse world position
    if (active && lastPointer) {
      ndc(lastPointer.x, lastPointer.y);
      raycaster.setFromCamera(mouse, camera);
      const depth = knife._cfg ? knife._cfg.depth : 0.5;
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -depth);
      const world = raycaster.ray.intersectPlane(plane, tmp);
      if (world) knife.update(world, dt);
    }

    // Hover glow
    updateHover();

    // Juice particles
    for (let i = juice.length - 1; i >= 0; i--) {
      const p = juice[i];
      p.life -= dt;
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) { scene.remove(p.mesh); p.mesh.material.dispose(); juice.splice(i, 1); }
    }

    // Light flashes
    for (let i = flashes.length - 1; i >= 0; i--) {
      const p = flashes[i];
      p.life -= dt;
      p.light.intensity = Math.max(0, p.life / 0.26) * 16;
      if (p.life <= 0) { scene.remove(p.light); flashes.splice(i, 1); }
    }

    // SVG strokes fade
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      s.life -= dt;
      s.el.setAttribute('opacity', Math.max(0, s.life / 0.20));
      if (s.life <= 0) { s.el.remove(); strokes.splice(i, 1); }
    }
  }

  // (depth helper removed — knife._cfg.depth used directly above)

  return { onPointerDown, onPointerMove, onPointerUp, update, setActive, setJuiceEnabled, spawnJuice };
}
