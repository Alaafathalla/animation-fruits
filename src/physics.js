import * as THREE from 'three';

/**
 * Simple rigid-body physics manager.
 *
 * Each body:  { group, velocity, angularVel, radius, isHalf, sleeping, age }
 * Call  physics.add(body)   to register
 * Call  physics.update(dt)  every frame
 * Call  physics.remove(body)
 * Call  physics.clear()
 */
export function createPhysics() {
  const bodies = [];
  const FLOOR_Y  = -3.2;
  const WALL_X   =  5.5;
  const WALL_Z   =  5.5;

  function add(body) {
    bodies.push(body);
  }

  function remove(body) {
    const i = bodies.indexOf(body);
    if (i !== -1) bodies.splice(i, 1);
  }

  function clear() { bodies.length = 0; }

  function update(dt, gravity, friction) {
    const dtC = Math.min(dt, 0.03);

    for (const b of bodies) {
      if (b.sleeping) continue;
      b.age = (b.age || 0) + dtC;

      // Gravity
      b.velocity.y -= gravity * dtC;

      // Translate
      b.group.position.addScaledVector(b.velocity, dtC);

      // Rotate
      b.group.rotation.x += b.angularVel.x * dtC;
      b.group.rotation.y += b.angularVel.y * dtC;
      b.group.rotation.z += b.angularVel.z * dtC;

      // Angular damping
      b.angularVel.multiplyScalar(0.992);

      // ── Floor collision ──────────────────────────────────────
      const floorHit = FLOOR_Y + b.radius;
      if (b.group.position.y < floorHit) {
        b.group.position.y = floorHit;
        b.velocity.y = -b.velocity.y * b.bounce;
        b.velocity.x *= friction;
        b.velocity.z *= friction;
        b.angularVel.x *= 0.7;
        b.angularVel.z *= 0.7;

        // Put to sleep if barely moving
        if (Math.abs(b.velocity.y) < 0.04 && b.velocity.lengthSq() < 0.01) {
          b.velocity.set(0, 0, 0);
          b.angularVel.set(0, 0, 0);
          b.sleeping = true;
        }
      }

      // ── Wall collisions ──────────────────────────────────────
      if (Math.abs(b.group.position.x) > WALL_X - b.radius) {
        b.group.position.x = Math.sign(b.group.position.x) * (WALL_X - b.radius);
        b.velocity.x *= -b.bounce;
      }
      if (Math.abs(b.group.position.z) > WALL_Z - b.radius) {
        b.group.position.z = Math.sign(b.group.position.z) * (WALL_Z - b.radius);
        b.velocity.z *= -b.bounce;
      }

      // ── Fruit-fruit collision (cheap sphere vs sphere) ────────
      for (const b2 of bodies) {
        if (b2 === b || b2.sleeping) continue;
        const diff = new THREE.Vector3().subVectors(b.group.position, b2.group.position);
        const dist = diff.length();
        const minD = b.radius + b2.radius;
        if (dist < minD && dist > 0.001) {
          const push = diff.normalize().multiplyScalar((minD - dist) * 0.5);
          b.group.position.add(push);
          b2.group.position.sub(push);
          // Exchange a bit of velocity
          const vDiff = new THREE.Vector3().subVectors(b.velocity, b2.velocity).multiplyScalar(0.3);
          b.velocity.sub(vDiff);
          b2.velocity.add(vDiff);
        }
      }
    }
  }

  function getBodies() { return bodies; }

  return { add, remove, clear, update, getBodies };
}

/** Helper: create a physics body descriptor for a fruit */
export function makeBody(fruitData, velocity, spin, bounce = 0.45) {
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
