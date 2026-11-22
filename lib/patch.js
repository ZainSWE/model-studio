/**
 * Helpers for models that come straight from the landing page (vendor/landing/*).
 *
 * Those modules keep their light and night-mode values in module-level uniforms. Rather than
 * edit the vendored files (so they stay a plain copy of the site's code), the adapters swap
 * those uniforms for the studio's own after the model is built.
 */
import * as THREE from "three";

/**
 * Point uniforms of every material under `root` at the given objects: { uLight: shared.light, … }.
 * Works for onBeforeCompile materials (wrapped, so it applies once the shader is built) and for
 * ShaderMaterials (replaced directly). Only uniforms the material already has are touched.
 */
export function overrideUniforms(root, map) {
  const seen = new Set();
  root.traverse((o) => {
    for (const m of [].concat(o.material || [])) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      if (m.isShaderMaterial) {
        for (const k in map) if (k in m.uniforms) m.uniforms[k] = map[k];
        continue;
      }
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = function (s, r) {
        prev?.call(this, s, r);
        for (const k in map) if (k in s.uniforms) s.uniforms[k] = map[k];
      };
      m.needsUpdate = true;
    }
  });
}

/** World light (xz) → the view-space xz direction the CN Tower's two-tone material expects. */
const v3 = new THREE.Vector3();
export function viewSpaceLight(worldXZ, camera, out) {
  camera.updateMatrixWorld();
  v3.set(worldXZ.x, 0, worldXZ.y).transformDirection(camera.matrixWorldInverse);
  out.set(v3.x, v3.z);
  if (out.lengthSq() < 1e-8) out.set(1, 0); else out.normalize();
  return out;
}

/** Fetch once, hand out the same ArrayBuffer (GLTFLoader.parseAsync doesn't consume it). */
const cache = new Map();
export function fetchOnce(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => {
    if (!r.ok) throw new Error(`couldn't load ${url} (${r.status})`);
    return r.arrayBuffer();
  }));
  return cache.get(url);
}

export const assetUrl = (path) => new URL(`../models/assets/${path}`, import.meta.url).href;
