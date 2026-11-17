# Model Studio — GenAI Genesis

Pose our 3D models, frame the shot, and export high-res PNGs (HD up to 8K, transparent or solid background).

**Live:** https://zainswe.github.io/model-studio/

## Using it

- **Orbit camera / Turn model** toggle (top of the viewport): what a one-finger or left-mouse drag does.
  - Desktop: right-drag pans, scroll zooms, **Shift + drag** turns the model in either mode.
  - Phone: pinch zooms, two fingers pan.
- **Presets:** Hero, Side, Front, Rear ¾, Above ¾, Top, Low. Each refits the model to the frame.
- **Pose:** Yaw / Pitch / Roll sliders. **Lens** is the export camera's field of view. **Fill** is how much of the frame the model takes.
- **Look:** turn the light around the model; optional film grain as on the landing page.
- **Export:** size, background, optional 2× supersampling (on by default on desktop, off on phones to save memory). The PNG is exactly what's inside the white frame.
  - Desktop: downloads straight away.
  - Phone: opens a sheet with **Share / Save to Photos** and **Download**.
- Keyboard: **F** frame model · **R** reset pose · **S** export · **T** switch drag mode.

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000/
```

No build step. three.js r169 loads from jsDelivr through the import map in `index.html`. Pages need serving over HTTP; `file://` won't load ES modules.

## Adding a model

1. Add `models/<name>.js` that default-exports:
   ```js
   { id, name, source, palettes: [{ id, label, note, swatch: [a, b] }], defaultPalette, hero: { az, el }, build(paletteId) }
   ```
   `build` returns a `THREE.Object3D`. It can be `async`, e.g. to load a `.glb` with `GLTFLoader` from `three/addons/loaders/GLTFLoader.js`. Use `flat()` from `lib/flat.js` for the site's toy shading.
2. Add it to `MODELS` in `models/index.js`, commit and push. Pages redeploys in about a minute.

## Files

| Path | What it is |
|---|---|
| `index.html`, `studio.css` | Page and styles (the landing page's tokens) |
| `studio.js` | Viewport, posing, framing, export |
| `lib/flat.js` | The landing page's flat shader, with shared light and grain |
| `models/ferry.js` | The FAQ ferry from the landing page, in both palettes (no waves or smoke) |
| `models/index.js` | Model registry |
| `og.png` | Link preview image for Slack, Discord, etc. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |
