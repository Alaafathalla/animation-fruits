import * as THREE from 'three';

/**
 * Creates an ambient dust/fiber particle system that floats
 * softly around the garment, evoking a fabric studio atmosphere.
 */
export function createParticles(scene) {
  const COUNT = 600;
  const SPREAD = 6;

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const alphas = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3;
    positions[i3]     = (Math.random() - 0.5) * SPREAD;
    positions[i3 + 1] = (Math.random() - 0.5) * SPREAD;
    positions[i3 + 2] = (Math.random() - 0.5) * SPREAD;

    velocities[i3]     = (Math.random() - 0.5) * 0.002;
    velocities[i3 + 1] = Math.random() * 0.003 + 0.001; // gentle upward drift
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.002;

    sizes[i]  = Math.random() * 2.5 + 0.5;
    alphas[i] = Math.random() * 0.6 + 0.1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('alpha',    new THREE.BufferAttribute(alphas, 1));

  // Custom shader material for soft round particles with per-particle alpha
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xc8b89a) },
      uTime:  { value: 0 },
    },
    vertexShader: /* glsl */`
      attribute float size;
      attribute float alpha;
      varying float vAlpha;

      void main() {
        vAlpha = alpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (280.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vAlpha;

      void main() {
        // Soft circle
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float strength = 1.0 - (dist * 2.0);
        strength = pow(strength, 2.0);
        gl_FragColor = vec4(uColor, strength * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // Update function — call each frame
  function update(elapsedTime) {
    material.uniforms.uTime.value = elapsedTime;

    const pos = geometry.attributes.position.array;

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;

      pos[i3]     += velocities[i3]     + Math.sin(elapsedTime * 0.3 + i) * 0.0003;
      pos[i3 + 1] += velocities[i3 + 1];
      pos[i3 + 2] += velocities[i3 + 2] + Math.cos(elapsedTime * 0.2 + i) * 0.0003;

      // Wrap particles back when they drift out of bounds
      const half = SPREAD / 2;
      if (pos[i3]     >  half) pos[i3]     = -half;
      if (pos[i3]     < -half) pos[i3]     =  half;
      if (pos[i3 + 1] >  half) pos[i3 + 1] = -half;
      if (pos[i3 + 1] < -half) pos[i3 + 1] =  half;
      if (pos[i3 + 2] >  half) pos[i3 + 2] = -half;
      if (pos[i3 + 2] < -half) pos[i3 + 2] =  half;
    }

    geometry.attributes.position.needsUpdate = true;
  }

  /** Change the particle tint when the garment color changes */
  function setColor(hex) {
    material.uniforms.uColor.value.set(hex);
  }

  return { points, update, setColor };
}
