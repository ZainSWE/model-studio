# Model Studio — GenAI Genesis

Pose our 3D models, frame the shot, and export high-res PNGs (HD up to 8K, transparent or solid background).

## Models

| Model | Palettes | From the landing page |
|---|---|---|
| Toronto Island ferry | Lilac (genaigenesis.ca) · Cyan (landing page) | `landing/ferry.js` (FAQ) |
| CN Tower | Cyan (landing page) · Mint (first hero) | `assets/cn-tower/cn-tower.glb` |
| Toronto snow globe | Day · Night | `landing/city.js` (hero → Toronto chapter) |
| Toronto diorama (no glass) | Day · Night | `landing/city.js`, without dome, snow and pedestal |
| TTC Flexity streetcar | Day · Night | `landing/streetcar.js` (finale) |
| Earth | Day · Night | `landing/globe.js` (world chapter) |
| TTC subway train | Lilac | `landing/subway.js` (earlier finale) |

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

## Keeping in sync with the landing page

`vendor/landing/` is an unchanged copy of the landing page's 3D files, and `models/assets/cn-tower.glb` of its tower. The adapters in `models/` build each one, leave out its scenery (road, platform, waves, stats band) and hand its light to the studio's Light slider without editing the copied files. When the site's models change, copy the files over again from the repo root of `genai-genesis-landing-page`:

```bash
cp landing/{city,streetcar,subway,globe,globe-land,sign-font,skyline}.js ../model-studio/vendor/landing/
cp assets/cn-tower/cn-tower.glb ../model-studio/models/assets/
```

The ferry is the exception: `models/ferry.js` is its own copy of the boat (with both palettes), so mirror ferry changes by hand.

## Adding a model

1. Add `models/<name>.js` that default-exports:
   ```js
   { id, name, source, palettes: [{ id, label, note, swatch: [a, b] }], defaultPalette, hero: { az, el }, light, grain, build(paletteId) }
   ```
   `build` returns a `THREE.Object3D`. It can be `async`, e.g. to load a `.glb` with `GLTFLoader` from `three/addons/loaders/GLTFLoader.js`.
   - `light` is the Light slider's starting angle for this model.
   - Set `grain: true` only if it uses `flat()` from `lib/flat.js`, the site's toy shading.
   - For camera-dependent uniforms, set `object.userData.beforeRender = (camera) => { … }`. It runs before every frame and every export.
   - To bring in a model from the landing page, see `models/toronto.js` and `lib/patch.js` (`overrideUniforms`).
2. Add it to `MODELS` in `models/index.js`, commit and push. Pages redeploys in about a minute.

## Files

| Path | What it is |
|---|---|
| `index.html`, `studio.css` | Page and styles (the landing page's tokens) |
| `studio.js` | Viewport, posing, framing, export |
| `lib/flat.js` | The landing page's flat shader, with shared light and grain |
| `models/*.js` | One adapter per model (see the table above); `models/index.js` is the registry |
| `models/assets/` | Model files (the CN Tower `.glb`) |
| `vendor/landing/` | Unchanged copy of the landing page's 3D modules |
| `lib/patch.js` | Helpers for the landing-page models: uniform overrides, view-space light, cached fetch |
| `og.png` | Link preview image for Slack, Discord, etc. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |
