/**
 * The site's flat "toy" shading (same as landing/ferry.js): base colour on the lit side, a mix
 * toward the shade colour on the far side, tops lifted toward white, undersides in full shade.
 * Light and grain are shared uniforms so the studio can turn the light and toggle grain live.
 */
import * as THREE from "three";

export const shared = {
  light: { value: new THREE.Vector2(-0.75, 0.66).normalize() },   // direction in the xz plane
  grain: { value: 0 },
};

/** Light direction as an angle in degrees around the vertical axis (site default ≈ 139°). */
export const DEFAULT_LIGHT_DEG = Math.round(THREE.MathUtils.radToDeg(Math.atan2(0.66, -0.75)));
export function setLightAngle(deg) {
  const a = THREE.MathUtils.degToRad(deg);
  shared.light.value.set(Math.cos(a), Math.sin(a));
}

export function flat(color, shade, topMix = 0.45, { doubleSide = false } = {}) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: doubleSide ? THREE.DoubleSide : THREE.FrontSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uLight = shared.light;
    s.uniforms.uGrain = shared.grain;
    s.uniforms.uShade = { value: new THREE.Color(shade) };
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vN;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvN = normalize(mat3(modelMatrix) * normal);");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vN;\nuniform vec2 uLight; uniform vec3 uShade; uniform float uGrain;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        vec3 b = diffuseColor.rgb;
        float lit = smoothstep(-0.2, 0.2, dot(n.xz, uLight));
        vec3 c = mix(mix(b, uShade, 0.6), b, lit);
        if (n.y > 0.6) c = mix(b, vec3(1.0), ${topMix.toFixed(2)});
        if (n.y < -0.6) c = uShade;
        c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.07 * uGrain;
        diffuseColor.rgb = c;`);
  };
  m.customProgramCacheKey = () => "studio-flat-" + topMix.toFixed(2);
  return m;
}
