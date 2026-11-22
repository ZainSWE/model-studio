/**
 * Every model the studio can open. To add one, write a module that default-exports (or exports)
 *   { id, name, source, palettes: [{ id, label, note, swatch: [colorA, colorB] }], defaultPalette,
 *     hero?: { az, el }, light?: degrees, grain?: true, build(paletteId) → THREE.Object3D }
 * and list it here. build may be async (e.g. to load a .glb). The returned object may set
 * userData.beforeRender(camera), called before every viewport frame and every export, for
 * camera-dependent uniforms. `light` is the Light slider's starting angle for that model; `grain`
 * says the model uses lib/flat.js, so the film-grain toggle applies.
 */
import ferry from "./ferry.js";
import cnTower from "./cn-tower.js";
import { snowGlobe, diorama } from "./toronto.js";
import { streetcar, subway } from "./vehicles.js";
import earth from "./earth.js";

export const MODELS = [ferry, cnTower, snowGlobe, diorama, streetcar, earth, subway];
