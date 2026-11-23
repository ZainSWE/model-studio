/**
 * Toronto Island ferry — the boat from landing/ferry.js (geometry kept identical, waves and
 * smoke left out). Two palettes: the original lilac/mint one (genaigenesis.ca) and the current
 * cyan/purple one (the landing page).
 *
 * Branding (the "Logo & name" option, for the plushie): the GenAI Genesis brain on the bow of the
 * hull, wrapped onto its round front, and "GenAI" over "Genesis" on both flat sides. Both are
 * centred on the hull's straight wall, sit just proud of it, are flat-shaded like the surface
 * under them, and use one solid colour each (embroidery-friendly).
 *
 * Model module shape (see models/index.js): { id, name, source, palettes, defaultPalette, build }
 */
import * as THREE from "three";
import { flat } from "../lib/flat.js";
import { assetUrl } from "../lib/patch.js";

// colour + shade-side colour of the logo and the name, per palette (both sit on the hull)
const BRAND = {
  lilac: { logo: ["#8B6CF0", "#6447D2"], name: ["#8B6CF0", "#6447D2"] },   // purple on the white hull
  cyan:  { logo: ["#FFFFFF", "#CFEFEF"], name: ["#FFFFFF", "#CFEFEF"] },   // white on the cyan hull
};
const FONT = `"Google Sans Flex", "Google Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

let logoSrc = null;
const logoSvg = () => (logoSrc ??= fetch(assetUrl("genai-logo.svg")).then((r) => {
  if (!r.ok) throw new Error(`couldn't load the logo (${r.status})`);
  return r.text();
}));

function texture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
/** The brain, drawn white (the material supplies the colour), 1024px tall. */
async function logoTexture() {
  const svg = (await logoSvg()).replace(/#abfdf6/gi, "#ffffff");
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();
  const H = 1024, W = Math.round((H * img.naturalWidth) / img.naturalHeight), pad = 16;
  const c = Object.assign(document.createElement("canvas"), { width: W + pad * 2, height: H + pad * 2 });
  c.getContext("2d").drawImage(img, pad, pad, W, H);
  return { tex: texture(c), aspect: c.width / c.height, fill: H / c.height };
}
/** Lines of text, each centred, white, cropped tight to the ink (GenAI over Genesis). */
async function nameTexture(lines) {
  const px = 300, spec = `700 ${px}px ${FONT}`, pad = 12, gap = Math.round(px * 0.2);
  try { await document.fonts?.load(spec, lines.join(" ")); } catch (_) {}
  const g0 = document.createElement("canvas").getContext("2d");
  g0.font = spec;
  const ms = lines.map((t) => g0.measureText(t));
  const widths = ms.map((m) => m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
  const inkH = ms.reduce((h, m) => h + m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, 0) + gap * (lines.length - 1);
  const w = Math.ceil(Math.max(...widths)) + pad * 2, h = Math.ceil(inkH) + pad * 2;
  const c = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const g = c.getContext("2d");
  g.font = spec; g.fillStyle = "#ffffff"; g.textBaseline = "alphabetic";
  let y = pad;
  lines.forEach((t, i) => {
    const m = ms[i];
    y += m.actualBoundingBoxAscent;
    g.fillText(t, (w - widths[i]) / 2 + m.actualBoundingBoxLeft, y);
    y += m.actualBoundingBoxDescent + gap;
  });
  return { tex: texture(c), aspect: w / h, fill: inkH / h };
}
function decalMaterial(tex, [color, shade]) {
  const m = flat(color, shade, 0.5);
  Object.assign(m, { map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return m;
}
/** A flat decal: a plane just off a flat wall, flat-shaded with the boat's light. */
function decal({ tex, aspect, fill }, inkHeight, colors) {
  const h = inkHeight / fill;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), decalMaterial(tex, colors));
  mesh.renderOrder = 2;
  return mesh;
}
/**
 * A decal wrapped onto the vertical wall of an extruded shape (block() below), following the wall
 * exactly: the same contour points ExtrudeGeometry uses, pushed out by the same bevel (each vertex
 * along its mitred bisector, so every offset edge stays parallel to its source edge, as three.js
 * does), plus `lift`. The strip is centred on the contour point furthest along +x (the bow) and
 * runs left to right as seen from the front. Returns a mesh in the shape's block space.
 */
function wallDecal({ tex, aspect, fill }, inkHeight, colors, shape, offset, curveSegments = 24) {
  let pts = shape.extractPoints(curveSegments).shape;
  pts = pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 1e-6);   // pill() has zero-length joins at the ends
  if (pts.length > 1 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts = pts.slice(0, -1);
  const area = pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p.x * q.y - q.x * p.y; }, 0);
  const out = (dx, dy) => (area > 0 ? new THREE.Vector2(dy, -dx) : new THREE.Vector2(-dy, dx)).normalize();
  const n = pts.length;
  const off = pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const n1 = out(p.x - a.x, p.y - a.y), n2 = out(b.x - p.x, b.y - p.y);
    const m = n1.clone().add(n2).normalize();
    return p.clone().addScaledVector(m, offset / Math.max(0.2, m.dot(n1)));
  });
  // walk the offset contour as a closed polyline, starting from the bow point
  const start = off.reduce((best, p, i) => (p.x > off[best].x ? i : best), 0);
  const ring = [...off.slice(start), ...off.slice(0, start), off[start]];
  const cum = [0];
  for (let i = 1; i < ring.length; i++) cum.push(cum[i - 1] + ring[i].distanceTo(ring[i - 1]));
  const total = cum[cum.length - 1];
  const at = (sArc) => {                       // point at arc length sArc (wraps), shape space
    sArc = ((sArc % total) + total) % total;
    let i = 1; while (cum[i] < sArc) i++;
    const t = (sArc - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return ring[i - 1].clone().lerp(ring[i], t);
  };
  const h = inkHeight / fill, w = h * aspect, cols = 64;
  // shape (x, y) → block space (x, −y): find which way along the contour is "right" seen from +x (−z)
  const dir = at(0.01).y > 0 ? 1 : -1;        // stepping forward increases shape y → world −z → viewer's right
  const pos = [], uv = [], idx = [];
  for (let c = 0; c <= cols; c++) {
    const u = c / cols, p = at(dir * (u - 0.5) * w);
    for (const [v, y] of [[0, -h / 2], [1, h / 2]]) { pos.push(p.x, y, -p.y); uv.push(u, v); }
  }
  for (let c = 0; c < cols; c++) { const k = c * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // make the faces point outward (toward +x at the bow)
  if (g.attributes.normal.getX(cols) < 0) { g.setIndex(idx.map((_, i) => idx[i - (i % 3) + [0, 2, 1][i % 3]])); g.computeVertexNormals(); }
  const mesh = new THREE.Mesh(g, decalMaterial(tex, colors));
  mesh.renderOrder = 2;
  return mesh;
}

const MATS = {
  lilac: () => {
    const P = { white: "#FFFFFF", lilacPale: "#F3DAFF", lilac: "#E09DFF", mint: "#00FFDD", aqua: "#BCFEFF" };
    return {
      hull: flat(P.white, "#D9C8F5", 0.5), stripe: flat(P.mint, "#16C9B5", 0.4), keel: flat(P.lilac, "#B77BE8", 0.3),
      cabin: flat(P.lilacPale, "#DDB6F3", 0.6), roof: flat(P.lilac, "#B77BE8", 0.5), house: flat(P.white, "#DCCBF6", 0.6),
      port: flat(P.aqua, "#86E3E6", 0.5), portRim: flat(P.white, "#D9C8F5", 0.5), funnel: flat(P.mint, "#16C9B5", 0.35),
      band: flat(P.white, "#D9C8F5", 0.4), top: flat(P.lilac, "#B77BE8", 0.4), flag: flat(P.lilac, "#B77BE8", 0.3, { doubleSide: true }),
    };
  },
  cyan: () => {
    const P = { white: "#FFFFFF", cyan: "#18D9D2", cyanDeep: "#0E9F9A", purple: "#8B6CF0", purpleDeep: "#6447D2", aquaPale: "#DFFFFC" };
    return {
      hull: flat(P.cyan, P.cyanDeep, 0.35), stripe: flat(P.white, "#CFEFEF", 0.4), keel: flat(P.purpleDeep, "#4A31A8", 0.25),
      cabin: flat(P.purple, P.purpleDeep, 0.4), roof: flat(P.purpleDeep, "#4A31A8", 0.35), house: flat(P.white, "#D6CCF6", 0.5),
      port: flat(P.aquaPale, "#9FE9E4", 0.5), portRim: flat(P.white, "#D6CCF6", 0.5), funnel: flat(P.cyan, P.cyanDeep, 0.3),
      band: flat(P.white, "#CFEFEF", 0.4), top: flat(P.purpleDeep, "#4A31A8", 0.35), flag: flat(P.purple, P.purpleDeep, 0.3, { doubleSide: true }),
    };
  },
};

function pill(len, wid, r = wid / 2) {
  const s = new THREE.Shape(), hl = len / 2, hw = wid / 2;
  r = Math.min(r, hw, hl);
  s.moveTo(-hl + r, -hw); s.lineTo(hl - r, -hw); s.quadraticCurveTo(hl, -hw, hl, -hw + r);
  s.lineTo(hl, hw - r); s.quadraticCurveTo(hl, hw, hl - r, hw);
  s.lineTo(-hl + r, hw); s.quadraticCurveTo(-hl, hw, -hl, hw - r);
  s.lineTo(-hl, -hw + r); s.quadraticCurveTo(-hl, -hw, -hl + r, -hw);
  return s;
}
const CURVE_SEGMENTS = 48;
function block(shape, h, mat, bevel = 0.06) {
  // more segments than the site: these get rendered at 4K+
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 6, curveSegments: CURVE_SEGMENTS });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return new THREE.Mesh(g, mat);
}

async function build(palette = "lilac", { logo = true } = {}) {
  const M = (MATS[palette] || MATS.lilac)();
  const boat = new THREE.Group();
  const L = 4.4, B = 1.9;
  const keel = block(pill(L * 0.9, B * 0.82), 0.28, M.keel, 0.1); keel.position.y = -0.36; boat.add(keel);
  const hull = block(pill(L, B), 0.5, M.hull, 0.12); hull.position.y = -0.2; boat.add(hull);
  const stripe = block(pill(L + 0.14, B + 0.14), 0.07, M.stripe, 0.04); stripe.position.y = 0.28; boat.add(stripe);
  const CL = L - 1.2, CW = B - 0.5, CH = 0.62, cbev = 0.08;
  const cabin = block(pill(CL, CW, 0.32), CH, M.cabin, cbev); cabin.position.y = 0.36; boat.add(cabin);
  const portGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 48); portGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.TorusGeometry(0.125, 0.025, 16, 48);
  const wallZ = CW / 2 + cbev;
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x = -CL / 2 + 0.55 + i * ((CL - 1.1) / 3);
    const port = new THREE.Mesh(portGeo, M.port); port.position.set(x, 0.36 + cbev + CH * 0.55, side * (wallZ + 0.012)); boat.add(port);
    const rim = new THREE.Mesh(rimGeo, M.portRim); rim.position.set(x, port.position.y, side * (wallZ + 0.03)); boat.add(rim);
  }
  const roof = block(pill(CL + 0.3, CW + 0.3, 0.42), 0.07, M.roof, 0.04); roof.position.y = 0.36 + CH + 2 * cbev + 0.005; boat.add(roof);
  const roofTop = roof.position.y + 0.07 + 0.08;
  const ph = block(pill(1.0, 0.9, 0.3), 0.42, M.house, 0.06); ph.position.set(0.75, roofTop - 0.04, 0); boat.add(ph);
  const phWin = block(pill(1.04, 0.94, 0.32), 0.14, M.port, 0.05); phWin.position.set(0.75, roofTop + 0.16, 0); boat.add(phWin);
  const phCap = block(pill(1.2, 1.08, 0.38), 0.06, M.roof, 0.03); phCap.position.set(0.75, roofTop + 0.5, 0); boat.add(phCap);
  const funnel = new THREE.Group(); funnel.position.set(-0.55, roofTop - 0.04, 0); funnel.rotation.z = 0.1; boat.add(funnel);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.8, 64), M.funnel); stack.position.y = 0.4; funnel.add(stack);
  // band nudged out a hair from the site version: flush with the stack it shows jagged edges at 4K
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.284, 0.298, 0.13, 64), M.band); band.position.y = 0.5; funnel.add(band);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.05, 16, 64), M.top); lip.rotation.x = Math.PI / 2; lip.position.y = 0.8; funnel.add(lip);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 16), M.house); mast.position.set(0.95, roofTop + 0.78, 0); boat.add(mast);
  const fshape = new THREE.Shape(); fshape.moveTo(0, 0); fshape.lineTo(-0.32, -0.07); fshape.lineTo(0, -0.15);
  const flag = new THREE.Mesh(new THREE.ShapeGeometry(fshape), M.flag); flag.position.set(0.95, roofTop + 1.02, 0); boat.add(flag);

  if (logo) {
    const brand = BRAND[palette] || BRAND.lilac;
    // The hull is a stadium (pill with r = B/2) extruded 0.5 with a 0.12 bevel: its straight wall
    // runs y −0.08 … 0.42 at distance B/2 + 0.12 from the centre line; the ends are half-circles.
    const wallR = B / 2 + 0.12, wallY = (-0.08 + 0.42) / 2, wallH = 0.5, lift = 0.004;
    // brain: on the bow, wrapped along the hull's real rounded outline, centred on the wall
    const brain = wallDecal(await logoTexture(), wallH * 0.88, brand.logo, pill(L, B), 0.12 + lift, CURVE_SEGMENTS);
    brain.position.y = wallY;
    boat.add(brain);
    // name: both flat sides, centred along the hull and on the wall
    const name = await nameTexture(["GenAI", "Genesis"]);
    const flatLen = L - B - 0.3;                     // straight part of the side, with a margin
    let ink = wallH * 0.8;                           // the two-line block: same 10% margin top and bottom as the brain
    if ((ink / name.fill) * name.aspect > flatLen) ink = (flatLen * name.fill) / name.aspect;
    for (const side of [1, -1]) {
      const d = decal(name, ink, brand.name);
      d.rotation.y = side > 0 ? 0 : Math.PI;        // reads left-to-right from outside on both sides
      d.position.set(0, wallY, side * (wallR + lift));
      boat.add(d);
    }
  }
  return boat;
}

export default {
  id: "ferry",
  name: "Toronto Island ferry",
  source: "landing/ferry.js",
  palettes: [
    { id: "lilac", label: "Lilac", note: "genaigenesis.ca", swatch: ["#E09DFF", "#00FFDD"] },
    { id: "cyan", label: "Cyan", note: "landing page", swatch: ["#18D9D2", "#8B6CF0"] },
  ],
  defaultPalette: "lilac",
  // camera view the "Hero" preset uses for this model (azimuth / elevation in degrees)
  options: [{ id: "logo", label: "Logo & name", note: "for the plushie", default: true }],
  hero: { az: 24, el: 14 },
  light: 139,         // landing/ferry.js LIGHT
  grain: true,        // uses lib/flat.js, so the film-grain toggle applies
  build,
};
