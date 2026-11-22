/**
 * Toronto: the landing page's diorama (vendor/landing/city.js, unchanged) — the CN Tower, Rogers
 * Centre, City Hall, Nathan Phillips Square with the TORONTO sign, the financial-district
 * skyline and the lake — as the full snow globe or as the bare island.
 *
 * createCity() builds a whole story scene; this takes its city at a settled moment of the scroll
 * (every building risen, glass and snow in, no Earth), detaches it, and hands its light to the
 * studio. The stats band and the Earth are left behind.
 */
import * as THREE from "three";
import { createCity } from "../vendor/landing/city.js";
import { shared } from "../lib/flat.js";
import { overrideUniforms, viewSpaceLight, fetchOnce, assetUrl } from "../lib/patch.js";

const SETTLED = 2;   // story position: stats chapter — buildings up, dome fully in, Earth not yet formed

async function buildCity(palette, { glass }) {
  const c = await createCity(await fetchOnce(assetUrl("cn-tower.glb")), { stats: [] });
  c.setTheme(palette === "night");
  c.camera.aspect = 1.6;
  c.pose(SETTLED);

  const pivot = c.scene.children[0];   // tilt pivot → city group (see createCity)
  const city = pivot.children[0];
  c.scene.remove(pivot);
  pivot.rotation.set(0, 0, 0);
  city.rotation.set(0, 0, 0);

  if (!glass) {
    // city children, in build order: base, snow ring, plinth, band, foot, dust specks,
    // dome (back), dome (front), snow, lake, shore, tower, Rogers, City Hall, square, skyline ×2
    const k = city.children;
    const looksRight = k[1]?.geometry?.type === "RingGeometry" && k[6]?.material?.isShaderMaterial && k[8]?.isPoints;
    if (looksRight) city.remove(...k.slice(1, 9));
    else console.warn("Toronto diorama: city.js layout changed; leaving the snow globe parts in");
  }

  const towerU = { value: new THREE.Vector2(1, 0) };
  overrideUniforms(pivot, { uLight: shared.light, uLightDir: towerU });
  pivot.userData.beforeRender = (camera) => viewSpaceLight(shared.light.value, camera, towerU.value);
  return pivot;
}

const palettes = [
  { id: "day", label: "Day", note: "light theme", swatch: ["#F3DAFF", "#2EF2DC"] },
  { id: "night", label: "Night", note: "dark theme", swatch: ["#4B3BA2", "#3FE3D6"] },
];

export const snowGlobe = {
  id: "toronto-globe",
  name: "Toronto snow globe",
  source: "landing/city.js",
  palettes, defaultPalette: "day",
  hero: { az: 18, el: 14 },
  light: 24,
  build: (p) => buildCity(p, { glass: true }),
};

export const diorama = {
  id: "toronto-island",
  name: "Toronto diorama (no glass)",
  source: "landing/city.js",
  palettes, defaultPalette: "day",
  hero: { az: 18, el: 24 },
  light: 24,
  build: (p) => buildCity(p, { glass: false }),
};
