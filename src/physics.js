import * as THREE from 'three';

/**
 * Jelly Garden physics manager.
 *
 * Body shape:
 *   { group, velocity, angularVel, radius, bounce, sleeping, age, fruitData }
 *
 * jellyAmount (0–1) controls spring stiffness fed in from main.js.
 *   0 → rigid (no vertex wobble)
 *   1 → very soft jelly
 */

export function createPhysics() {
  const bodies  = [];
  const FLOOR_Y = -3.0;
  const WALL_X  =  5.8;
  const WALL_Z  =  5.0;

  // Spring constants
  const SPRING_K    = 220;   // stiffness
  const SPRING_DAMP = 14;    // damping  (critical ≈ 2√k·m, m=1 → ~30)
  const MAX_DISP    = 0.28;  // max vertex displacement from rest

  function add(body)    { bodies.push(body); }
  function remove(body) { const i = bodies.indexOf(body); if (i !== -1) bodies.splice(i, 1); }
  function clear()      { bodies.length = 0; }
  function getBodies()  { return bodies; }

  // ── Per-vertex spring wobble ───────────────────────────────────
  function updateJellyMeshes(fruitData, dt, jellyAmount) {
    if (!fruitData || !fruitData.jellyMeshes || jellyAmount <= 0) return;

    for (const mesh of fruitData.jellyMeshes) {
      const geo = mesh.geometry;
      if (!geo || !geo.userData.restPositions || !geo.userData.vertVelocity) continue;

      const rest  = geo.userData.restPositions;   // Float32Array — original positions
      const vv    = geo.userData.vertVelocity;    // Float32Array — per-vertex velocity
      const pos   = geo.attributes.position;
      const count = pos.count;

      for (let i = 0; i < count; i++) {
        const i3  = i * 3;
        const rx  = rest[i3],     ry  = rest[i3 + 1], rz  = rest[i3 + 2];
        const cx  = pos.getX(i),  cy  = pos.getY(i),  cz  = pos.getZ(i);

        // Displacement from rest
        const dx = cx - rx;
        const dy = cy - ry;
        const dz = cz - rz;

        // Spring force: F = -k*x - c*v
        const ax = (-SPRING_K * dx - SPRING_DAMP * vv[i3])     * jellyAmount;
        const ay = (-SPRING_K * dy - SPRING_DAMP * vv[i3 + 1]) * jellyAmount;
        const az = (-SPRING_K * dz - SPRING_DAMP * vv[i3 + 2]) * jellyAmount;

        vv[i3]     += ax * dt;
        vv[i3 + 1] += ay * dt;
        vv[i3 + 2] += az * dt;

        // Clamp displacement
        let nx = cx + vv[i3]     * dt;
        let ny = cy + vv[i3 + 1] * dt;
        let nz = cz + vv[i3 + 2] * dt;

        const dispX = nx - rx, dispY = ny - ry, dispZ = nz - rz;
        const disp  = Math.sqrt(dispX * dispX + dispY * dispY + dispZ * dispZ);
        if (disp > MAX_DISP) {
          const scale = MAX_DISP / disp;
          nx = rx + dispX * scale;
          ny = ry + dispY * scale;
          nz = rz + dispZ * scale;
        }

        pos.setXYZ(i, nx, ny, nz);
      }

      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }
  }

  // ── Main update ────────────────────────────────────────────────
  function update(dt, gravity = 9.0, friction = 0.97, jellyAmount = 0.7) {
    const dtC = Math.min(dt, 0.03);

    for (const b of bodies) {
      b.age = (b.age || 0) + dtC;

      // Per-vertex jelly spring
      if (b.fruitData) updateJellyMeshes(b.fruitData, dtC, jellyAmount);

      if (b.sleeping) continue;

      // Gravity
      b.velocity.y -= gravity * dtC;

      // Translate
      b.group.position.addScaledVector(b.velocity, dtC);

      // Rotate
      b.group.rotation.x += b.angularVel.x * dtC;
      b.group.rotation.y += b.angularVel.y * dtC;
      b.group.rotation.z += b.angularVel.z * dtC;

      // Angular damping
      b.angularVel.multiplyScalar(0.988);

      // ── Floor ────────────────────────────────────────────────
      const floorHit = FLOOR_Y + b.radius;
      if (b.group.position.y < floorHit) {
        b.group.position.y = floorHit;
        const vy = -b.velocity.y * b.bounce;
        b.velocity.y  = vy;
        b.velocity.x *= friction;
        b.velocity.z *= friction;
        b.angularVel.x *= 0.65;
        b.angularVel.z *= 0.65;

        // Landing squish — kick vertex velocities outward
        if (b.fruitData && jellyAmount > 0) {
          const squishStrength = Math.min(Math.abs(vy) * 0.18, 0.22) * jellyAmount;
          if (squishStrength > 0.01) _squishOnLand(b.fruitData, squishStrength);
        }

        if (Math.abs(b.velocity.y) < 0.06 && b.velocity.lengthSq() < 0.015) {
          b.velocity.set(0, 0, 0);
          b.angularVel.set(0, 0, 0);
          b.sleeping = true;
        }
      }

      // ── Walls ────────────────────────────────────────────────
      if (Math.abs(b.group.position.x) > WALL_X - b.radius) {
        b.group.position.x = Math.sign(b.group.position.x) * (WALL_X - b.radius);
        b.velocity.x *= -b.bounce;
      }
      if (Math.abs(b.group.position.z) > WALL_Z - b.radius) {
        b.group.position.z = Math.sign(b.group.position.z) * (WALL_Z - b.radius);
        b.velocity.z *= -b.bounce;
      }

      // ── Fruit–fruit collision ─────────────────────────────────
      for (const b2 of bodies) {
        if (b2 === b || b2.sleeping) continue;
        const diff = new THREE.Vector3().subVectors(b.group.position, b2.group.position);
        const dist = diff.length();
        const minD = b.radius + b2.radius;
        if (dist < minD && dist > 0.001) {
          const push = diff.normalize().multiplyScalar((minD - dist) * 0.5);
          b.group.position.add(push);
          b2.group.position.sub(push);
          const vDiff = new THREE.Vector3().subVectors(b.velocity, b2.velocity).multiplyScalar(0.28);
          b.velocity.sub(vDiff);
          b2.velocity.add(vDiff);
          // Squish both on collision
          const colStr = vDiff.length() * 0.08 * jellyAmount;
          if (colStr > 0.02) {
            if (b.fruitData)  _squishOnLand(b.fruitData,  colStr);
            if (b2.fruitData) _squishOnLand(b2.fruitData, colStr);
          }
        }
      }
    }
  }

  // ── Landing squish helper ──────────────────────────────────────
  function _squishOnLand(fruitData, strength) {
    fruitData.jellyMeshes.forEach(mesh => {
      const geo = mesh.geometry;
      if (!geo || !geo.userData.vertVelocity) return;
      const vv  = geo.userData.vertVelocity;
      const pos = geo.attributes.position;
      const rest = geo.userData.restPositions;
      for (let i = 0; i < pos.count; i++) {
        const i3 = i * 3;
        // Squish: push horizontally, compress vertically
        const rx = pos.getX(i);
        const ry = pos.getY(i);
        const rz = pos.getZ(i);
        const len = Math.sqrt(rx * rx + rz * rz) || 1;
        vv[i3]     += (rx / len) * strength * 1.4;
        vv[i3 + 1] -= strength * 0.9;
        vv[i3 + 2] += (rz / len) * strength * 1.4;
      }
    });
  }

  return { add, remove, clear, update, getBodies };
}

// ── Body factory ───────────────────────────────────────────────────
export function makeBody(fruitData, velocity, spin, bounce = 0.55) {
  return {
    group:      fruitData.group,
    velocity:   velocity.clone(),
    angularVel: spin.clone(),
    radius:     fruitData.radius,
    bounce,
    sleeping:   false,
    age:        0,
    fruitData,
  };
}
