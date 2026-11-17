/**
 * Toronto Island ferry — the boat from landing/ferry.js (geometry kept identical, waves and
 * smoke left out). Two palettes: the original lilac/mint one (genaigenesis.ca) and the current
 * cyan/purple one (the landing page).
 *
 * Model module shape (see models/index.js): { id, name, source, palettes, defaultPalette, build }
 */
import * as THREE from "three";
import { flat } from "../lib/flat.js";

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
function block(shape, h, mat, bevel = 0.06) {
  // more segments than the site: these get rendered at 4K+
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 6, curveSegments: 48 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return new THREE.Mesh(g, mat);
}

function build(palette = "lilac") {
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
  hero: { az: 24, el: 14 },
  build,
};
