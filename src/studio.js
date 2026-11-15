import * as THREE from 'three';

/**
 * Jelly Garden studio — minimal bright environment.
 * Light floor, soft shadow catcher, clean backdrop.
 * No dark stage, no glowing rims.
 */
export function createStudio(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // ── Floor plane — receives shadows, matches bg colour ────────────
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.08 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 28), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.0;
  floor.receiveShadow = true;
  root.add(floor);

  // ── Faint circle vignette on the floor ───────────────────────────
  const circleMat = new THREE.MeshBasicMaterial({
    color: 0xd4d4d2,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const circle = new THREE.Mesh(new THREE.CircleGeometry(5.5, 80), circleMat);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = -2.99;
  root.add(circle);

  // ── Subtle ambient fill light from below (bounce) ─────────────────
  const bounceLight = new THREE.PointLight(0xffffff, 0.6, 14, 2);
  bounceLight.position.set(0, -2.4, 2);
  root.add(bounceLight);

  // ── Very soft warm accent from upper-left ─────────────────────────
  const warmFill = new THREE.PointLight(0xfff5e8, 1.2, 18, 2);
  warmFill.position.set(-6, 5, 4);
  root.add(warmFill);

  // ── Cool accent from right for specular catchlights ───────────────
  const coolFill = new THREE.PointLight(0xe8f0ff, 1.0, 16, 2);
  coolFill.position.set(6, 2, -2);
  root.add(coolFill);

  function update(time) {
    // Gentle breathing intensity on accent lights
    warmFill.intensity = 1.1 + Math.sin(time * 0.55) * 0.15;
    coolFill.intensity = 0.9 + Math.sin(time * 0.42 + 1.1) * 0.12;
  }

  return { root, update };
}
