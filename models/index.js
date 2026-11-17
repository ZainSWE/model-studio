/**
 * Every model the studio can open. To add one, write a module beside ferry.js that default-exports
 *   { id, name, source, palettes: [{ id, label, note, swatch: [colorA, colorB] }], defaultPalette, hero?: { az, el }, build(paletteId) → THREE.Object3D }
 * (build may also be async, e.g. to load a .glb) and list it here.
 */
import ferry from "./ferry.js";

export const MODELS = [ferry];
