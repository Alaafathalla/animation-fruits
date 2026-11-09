# SLICE STUDIO — Three.js fruit cutting experience

## Run

```bash
npm install
npm run dev
```

For production: `npm run build` and deploy the generated `dist/` directory.

## Controls

- **Slice:** press and drag the pointer across a fruit. The swipe is tested as a swept 2D segment against each fruit's projected 3D size. A hit splits the fruit's actual 3D outer mesh, creates a cut face / rind surface, and launches both pieces with independent gravity and angular momentum.
- **Drag:** drag and release fruit to throw it.
- **Throw:** click to fire the selected fruit into the scene.
- **Explode:** click a fruit for a burst and radial impulse.
- **Orbit:** drag to rotate camera and use the wheel to zoom.
- **Fruit library:** select and add six fruit types.
- **Physics toolbar:** gravity, bounce, friction, throwing settings, shadows and juice effects.

## Main changes

- `src/geometryCut.js`: new triangle/plane mesh-splitting engine with a convex boundary cap.
- `src/slicer.js`: swept-stroke cutting, per-fruit inner faces, decorative seeds / citrus wedges, particles, cutting light flashes and individual half-body physics.
- `src/studio.js`: dimensional 3D stage, metallic platform, orbit curves, particles, contrasting colored lights.
- `src/main.js`: stage integration and UI handling.
- `index.html`, `src/style.css`: refreshed studio interface and responsive layouts.

The geometry splitter is designed for the convex, procedural fruits included with this project. It is not a general-purpose CSG solution for arbitrary concave models.
