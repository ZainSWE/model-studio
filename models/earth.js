/**
 * Earth: the planet the snow globe turns into (vendor/landing/globe.js, unchanged), fully formed.
 *
 * On the site it's drawn with a flat, front-on camera, so its glassy edge assumes the viewer
 * looks straight down −z. Here the two view-direction lines are swapped for the real camera
 * direction, so the edge stays right as you orbit.
 */
import * as THREE from "three";
import { createGlobe } from "../vendor/landing/globe.js";
import { shared } from "../lib/flat.js";

const HORIZONTAL = Math.hypot(-0.35, 0.5);   // globe.js light (-0.35, 0.8, 0.5): keep its height, turn its heading

function build(palette = "day") {
  const g = createGlobe({ night: { value: palette === "night" ? 1 : 0 } });
  g.setReveal(1);
  const root = g.group;
  root.visible = true;

  const lightU = { value: new THREE.Vector3(-0.35, 0.8, 0.5).normalize() };
  root.traverse((o) => {
    const m = o.material;
    if (!m?.isShaderMaterial) return;
    const before = m.vertexShader;
    m.vertexShader = m.vertexShader
      .replace("vV = vec3(0.0, 0.0, 1.0);   // orthographic camera looks down −z", "vV = normalize(cameraPosition - w.xyz);")
      .replace("vV = vec3(0.0, 0.0, 1.0); gl_Position", "vV = normalize(-mv.xyz); gl_Position");
    if (m.vertexShader === before) console.warn("Earth: globe.js shader changed; edge glow assumes a front-on view");
    if (m.uniforms.uLight) m.uniforms.uLight = lightU;
    m.needsUpdate = true;
  });
  root.userData.beforeRender = () => {
    const l = shared.light.value;
    lightU.value.set(l.x * HORIZONTAL, 0.8, l.y * HORIZONTAL).normalize();
  };
  return root;
}

export default {
  id: "earth",
  name: "Earth",
  source: "landing/globe.js",
  palettes: [
    { id: "day", label: "Day", note: "light theme", swatch: ["#E6FBF8", "#C6B2F4"] },
    { id: "night", label: "Night", note: "dark theme", swatch: ["#2B2063", "#3FE3D6"] },
  ],
  defaultPalette: "day",
  hero: { az: 0, el: 10 },
  light: 125,
  build,
};
