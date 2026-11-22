/**
 * CN Tower: the landing page's model (models/assets/cn-tower.glb, from
 * genai-genesis-landing-page/assets/cn-tower) with its two-tone "illustration" material: each
 * mesh is split into a lit and a shadow side by the light direction, seen from the camera.
 *
 * Palettes: the live site's cyan (city.js PASTEL) and the original mint (landing/tower.js).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PASTEL as SITE } from "../vendor/landing/city.js";
import { shared } from "../lib/flat.js";
import { fetchOnce, assetUrl, viewSpaceLight } from "../lib/patch.js";

// landing/tower.js (the first version of the hero tower): mint mast instead of cyan
const MINT = {
  ...SITE,
  tower_teal: ["#BCFEFF", "#00FFDD"],
  tower_teal_low: ["#BCFEFF", "#00FFDD"],
};

/** Same shader as city.js towerMaterial(): lit / shadow split by the view-space light. */
function towerMaterial(lit, shadow, name, lightU) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(lit) });
  m.name = name;
  const shadowColor = new THREE.Color(shadow);
  m.onBeforeCompile = (s) => {
    s.uniforms.uShadowColor = { value: shadowColor };
    s.uniforms.uLightDir = lightU;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vSide;\nuniform vec2 uLightDir;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 radialV = modelViewMatrix * vec4(transformed.x, 0.0, transformed.z, 0.0);
        vSide = dot(radialV.xz, uLightDir);`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vSide;\nuniform vec3 uShadowColor;")
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", `float w = max(fwidth(vSide), 1e-6);
        vec4 diffuseColor = vec4( mix(uShadowColor, diffuse, clamp(vSide / w + 0.5, 0.0, 1.0)), opacity );`);
  };
  m.customProgramCacheKey = () => "studio-cn-tower";
  return m;
}

async function build(palette = "site") {
  const table = palette === "mint" ? MINT : SITE;
  const gltf = await new GLTFLoader().parseAsync(await fetchOnce(assetUrl("cn-tower.glb")), "");
  const lightU = { value: new THREE.Vector2(1, 0) };
  const made = new Map();
  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    const swap = (src) => {
      if (!made.has(src)) {
        const [lit, shadow] = table[src.name] ?? ["#ffffff", "#dddddd"];
        made.set(src, towerMaterial(lit, shadow, src.name, lightU));
        src.dispose();
      }
      return made.get(src);
    };
    node.material = Array.isArray(node.material) ? node.material.map(swap) : swap(node.material);
  });
  // the split is in view space, so it follows the camera and the Light slider
  gltf.scene.userData.beforeRender = (camera) => viewSpaceLight(shared.light.value, camera, lightU.value);
  return gltf.scene;
}

export default {
  id: "cn-tower",
  name: "CN Tower",
  source: "assets/cn-tower/cn-tower.glb",
  palettes: [
    { id: "site", label: "Cyan", note: "landing page", swatch: ["#2EF2DC", "#E09DFF"] },
    { id: "mint", label: "Mint", note: "first hero", swatch: ["#00FFDD", "#F3DAFF"] },
  ],
  defaultPalette: "site",
  hero: { az: 0, el: 8 },
  light: 24,          // city.js LIGHT_W: from camera-right, slightly toward the viewer
  build,
};
