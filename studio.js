/**
 * Model Studio: pose a model, frame it, export a high-res PNG of exactly what's inside the frame.
 *
 * Camera: OrbitControls (orbit / pan / zoom). Model pose: yaw / pitch / roll sliders, or Shift + drag.
 * The white frame in the viewport is the export's aspect ratio; the export camera uses the same view,
 * narrowed to the frame, so the PNG matches the frame. Export renders in its own WebGL context at up to
 * 2× the output size and scales down for clean edges, then downloads the PNG.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MODELS } from "./models/index.js";
import { shared, setLightAngle, DEFAULT_LIGHT_DEG } from "./lib/flat.js";

const $ = (id) => document.getElementById(id);
const D2R = THREE.MathUtils.DEG2RAD, R2D = THREE.MathUtils.RAD2DEG;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;   // phones / tablets

const stage = $("stage"), canvas = $("view"), frameEl = $("frame");
const state = {
  model: 0, palette: null, opts: {},   // opts: the model's on/off details (e.g. the ferry's logo)
  yaw: 0, pitch: 0, roll: 0,
  fov: 18, fill: 0.84, light: DEFAULT_LIGHT_DEG, grain: false,
  size: [3840, 2160], bg: "transparent",
  ss: !coarse,          // 2× of 4K is ~8K of GPU memory: off by default on phones
  mode: "orbit",        // what a plain drag does: "orbit" the camera or "turn" the model
};

/* ------------------------------------------------------------------ scene */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  stage.insertAdjacentHTML("beforeend", '<p class="hint" style="bottom:50%">WebGL is unavailable in this browser.</p>');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pivot = new THREE.Group(); pivot.rotation.order = "YXZ"; scene.add(pivot);
const camera = new THREE.PerspectiveCamera(state.fov, 1, 0.05, 500);
camera.position.set(0, 1, 12);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = !reduced; controls.dampingFactor = 0.12;
controls.addEventListener("start", () => canvas.classList.add("dragging"));
controls.addEventListener("end", () => canvas.classList.remove("dragging"));

let dirty = true;
const requestRender = () => { dirty = true; };
controls.addEventListener("change", requestRender);
// textures that finish loading after a model is built (e.g. the Earth's land map) need a redraw
THREE.DefaultLoadingManager.onLoad = requestRender;
THREE.DefaultLoadingManager.onProgress = requestRender;

/* ------------------------------------------------------------------ models */
let current = null, loadToken = 0;
function dispose(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    [].concat(o.material || []).forEach((m) => { m.map?.dispose(); m.dispose(); });
  });
}
const beforeRender = (cam) => current?.userData.beforeRender?.(cam);
async function loadModel({ refit = false, newModel = false } = {}) {
  const token = ++loadToken;
  const def = MODELS[state.model];
  if (!def.palettes.some((p) => p.id === state.palette)) state.palette = def.defaultPalette;
  renderPaletteButtons();
  if (newModel) applyModelDefaults(def);
  stage.classList.add("loading");
  const slow = setTimeout(() => toast(`Loading ${def.name}…`, 0), 250);
  try {
    await document.fonts?.ready;   // some models paint text (signs, plates) into canvases
    const obj = await def.build(state.palette, { ...state.opts });
    if (token !== loadToken) { dispose(obj); return; }   // another model was picked meanwhile
    // centre on its bounding box so poses turn around the middle of the model
    const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    obj.position.sub(c);
    if (current) { pivot.remove(current); dispose(current); }
    current = obj; pivot.add(obj);
    clearTimeout(slow); toastEl.classList.remove("show");
    for (const ms of [120, 600, 1500]) setTimeout(requestRender, ms);   // late image decodes, canvas textures
    if (refit) applyPreset(presets()[0], { animate: false });
  } catch (err) {
    clearTimeout(slow);
    console.error(err);
    if (token === loadToken) toast(`Couldn't load ${def.name}: ${err.message}`, 6000);
  } finally {
    if (token === loadToken) stage.classList.remove("loading");
  }
  requestRender();
}
/** Per-model starting light, its option toggles, and the grain toggle only where the model supports it. */
function applyModelDefaults(def) {
  state.opts = Object.fromEntries((def.options || []).map((o) => [o.id, o.default ?? false]));
  renderOptions(def);
  state.light = def.light ?? DEFAULT_LIGHT_DEG;
  setLightAngle(state.light);
  $("light").value = state.light; $("light").nextElementSibling.textContent = state.light + "°";
  $("grain").closest(".check").hidden = !def.grain;
}

/* ------------------------------------------------------------------ frame */
function frameRect() {
  const vw = stage.clientWidth, vh = stage.clientHeight;
  const pad = Math.max(14, Math.min(36, vw * 0.04));
  const A = state.size[0] / state.size[1];
  let fw = vw - 2 * pad, fh = fw / A;
  if (fh > vh - 2 * pad - 40) { fh = vh - 2 * pad - 40; fw = fh * A; }   // room for the hint pill
  return { x: (vw - fw) / 2, y: (vh - fh) / 2, w: fw, h: fh, vw, vh };
}
/**
 * The Lens slider is the EXPORT camera's vertical field of view. The viewport camera is wider so that
 * the frame shows exactly that lens, whatever the window size: resizing never changes the shot.
 */
function syncViewportLens(r = frameRect()) {
  camera.fov = 2 * Math.atan(Math.tan((state.fov * D2R) / 2) * (r.vh / r.h)) * R2D;
  camera.aspect = r.vw / r.vh;
  camera.updateProjectionMatrix();
}
function layoutFrame() {
  const r = frameRect();
  Object.assign(frameEl.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
  $("frameLabel").textContent = `${state.size[0]} × ${state.size[1]}`;
}

/* ------------------------------------------------------------------ fitting */
const tmp = new THREE.Vector3();
function worldVertices() {
  pivot.updateMatrixWorld(true);
  const pts = [];
  current?.traverseVisible((o) => {
    const pos = o.geometry?.attributes?.position;
    if (!o.isMesh || !pos) return;
    const step = Math.max(1, Math.floor(pos.count / 4000));   // plenty for a silhouette
    for (let i = 0; i < pos.count; i += step) pts.push(tmp.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  return pts;
}
/** Camera position + target that fit the model inside the export frame, looking along -dir. */
function fitView(dir) {
  dir = dir.clone().normalize();
  const pts = worldVertices();
  if (!pts.length) return null;
  const A = state.size[0] / state.size[1];
  const tv = Math.tan((state.fov * D2R) / 2) * state.fill, th = tv * A;
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  const up = new THREE.Vector3().crossVectors(dir, right);
  const target = new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3());
  let d = 1;
  for (let iter = 0; iter < 4; iter++) {
    d = 0;
    for (const p of pts) {
      const q = tmp.subVectors(p, target), x = q.dot(right), y = q.dot(up), z = q.dot(dir);
      d = Math.max(d, z + Math.abs(x) / th, z + Math.abs(y) / tv);
    }
    // re-centre on the projected silhouette
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      const q = tmp.subVectors(p, target), depth = d - q.dot(dir);
      const sx = q.dot(right) / depth, sy = q.dot(up) / depth;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    target.addScaledVector(right, ((x0 + x1) / 2) * d).addScaledVector(up, ((y0 + y1) / 2) * d);
  }
  return { position: target.clone().addScaledVector(dir, d), target };
}

let tween = null;
function moveCamera(view, animate = true) {
  if (!view) return;
  if (!animate || reduced) {
    camera.position.copy(view.position); controls.target.copy(view.target);
    tween = null; finishCamera(); return;
  }
  tween = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: view.position, t1: view.target };
}
function finishCamera() {
  const dist = camera.position.distanceTo(controls.target);
  camera.near = Math.max(0.01, dist / 100); camera.far = dist * 20; syncViewportLens();
  controls.update(); requestRender();
}
function currentDir() { return tmp.subVectors(camera.position, controls.target).normalize().clone(); }
const frameModel = () => moveCamera(fitView(currentDir()));

function presets() {
  const hero = MODELS[state.model].hero || { az: 24, el: 14 };
  return [
    { label: "Hero", ...hero },
    { label: "Side", az: 0, el: 3 },
    { label: "Front", az: 90, el: 6 },
    { label: "Rear ¾", az: -140, el: 16 },
    { label: "Above ¾", az: 30, el: 40 },
    { label: "Top", az: 0, el: 88 },
    { label: "Low", az: 28, el: -8 },
  ];
}
function applyPreset(p, { animate = true } = {}) {
  const a = p.az * D2R, e = p.el * D2R;
  moveCamera(fitView(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e))), animate);
}

/* ------------------------------------------------------------------ pose */
function applyPose() {
  pivot.rotation.set(state.pitch * D2R, state.yaw * D2R, state.roll * D2R, "YXZ");
  for (const k of ["yaw", "pitch", "roll"]) { $(k).value = Math.round(state[k]); $(k).nextElementSibling.textContent = Math.round(state[k]) + "°"; }
  requestRender();
}
const wrap = (v) => ((((v + 180) % 360) + 360) % 360) - 180;

/*
 * Turning the model:
 *  - "Turn model" mode (the toggle on the viewport; the only way on touch): one-finger / left drag turns
 *    the model, while pinch, two-finger drag, right-drag and the wheel still zoom and pan the camera.
 *  - Shift + drag with a mouse, in either mode. Caught in the capture phase so OrbitControls (which
 *    would treat Shift + drag as a pan) never sees it.
 */
const pointers = new Map();
let turnBy = null;   // null | "mode" | "shift"
stage.addEventListener("pointerdown", (e) => {
  if (e.target !== canvas) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const isPrimary = e.pointerType !== "mouse" || e.button === 0;
  if (e.shiftKey && e.pointerType === "mouse" && e.button === 0) {
    e.stopPropagation(); e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    turnBy = "shift";
  } else if (state.mode === "turn" && pointers.size === 1 && isPrimary) {
    turnBy = "mode";
  } else if (pointers.size > 1 && turnBy === "mode") {
    turnBy = null;   // a second finger: the gesture belongs to the camera now
  }
  canvas.classList.toggle("turning", !!turnBy);
}, true);
stage.addEventListener("pointermove", (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  if (turnBy && pointers.size === 1) {
    if (turnBy === "shift") e.stopPropagation();
    const k = e.pointerType === "touch" ? 0.6 : 0.45;
    state.yaw = wrap(state.yaw + (e.clientX - p.x) * k);
    state.pitch = THREE.MathUtils.clamp(state.pitch + (e.clientY - p.y) * k * 0.8, -90, 90);
    applyPose();
  }
  p.x = e.clientX; p.y = e.clientY;
}, true);
const endPointer = (e) => {
  if (!pointers.delete(e.pointerId)) return;
  if (turnBy === "shift") { e.stopPropagation(); try { canvas.releasePointerCapture(e.pointerId); } catch (_) {} }
  if (pointers.size === 0) { turnBy = null; canvas.classList.remove("turning"); }
};
stage.addEventListener("pointerup", endPointer, true);
stage.addEventListener("pointercancel", endPointer, true);

function setMode(mode) {
  state.mode = mode;
  controls.enableRotate = mode === "orbit";
  document.querySelectorAll("#modes button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === mode)));
  $("hint").innerHTML = coarse
    ? (mode === "orbit" ? "Drag to orbit · pinch to zoom · two fingers to pan" : "Drag to turn the model · pinch to zoom")
    : (mode === "orbit"
        ? "Drag to orbit · right-drag to pan · scroll to zoom · <b>Shift + drag</b> to turn the model"
        : "Drag to turn the model · right-drag to pan · scroll to zoom · <b>T</b> to switch back");
}
document.querySelectorAll("#modes button").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));

/* ------------------------------------------------------------------ export */
const toastEl = $("toast"); let toastT = 0;
function toast(msg, ms = 2600) {
  toastEl.textContent = msg; toastEl.classList.add("show");
  clearTimeout(toastT); if (ms) toastT = setTimeout(() => toastEl.classList.remove("show"), ms);
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
function sizeName([w, h]) {
  const m = Math.max(w, h);
  return m >= 7680 ? "8K" : m >= 3840 ? "4K" : m >= 1920 ? "HD" : `${w}×${h}`;
}

async function shoot() {
  const btn = $("shoot");
  if (btn.disabled || !current) return;
  btn.disabled = true;
  const [w, h] = state.size;
  toast(`Rendering ${w} × ${h}…`, 0);
  await nextFrame(); await nextFrame();
  let er;
  try {
    er = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    const gl = er.getContext();
    const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    const limit = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), dims[0], dims[1]);
    if (Math.max(w, h) > limit) throw new Error(`this GPU tops out at ${limit}px`);
    let ss = state.ss ? 2 : 1;
    while (ss > 1 && Math.max(w, h) * ss > Math.min(limit, 8192)) ss--;   // 8192 cap keeps memory sane
    er.setPixelRatio(1);
    er.setSize(w * ss, h * ss, false);
    er.outputColorSpace = THREE.SRGBColorSpace;
    er.setClearColor(0x000000, 0);

    // same view as the viewport, narrowed to the (centred) frame
    const cam = camera.clone();
    cam.fov = state.fov; cam.aspect = w / h;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    beforeRender(cam);
    er.render(scene, cam);
    beforeRender(camera);

    const out = document.createElement("canvas"); out.width = w; out.height = h;
    const ctx = out.getContext("2d");
    if (state.bg !== "transparent") { ctx.fillStyle = state.bg; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(er.domElement, 0, 0, w, h);
    const blob = await new Promise((res) => out.toBlob(res, "image/png"));
    if (!blob) throw new Error("the browser couldn't encode the PNG");

    const def = MODELS[state.model];
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "").replace(/(\d{8})(\d{6})/, "$1-$2");
    const on = Object.keys(state.opts).filter((k) => state.opts[k]);
    const name = `${[def.id, state.palette, ...on].join("-")}-${w}x${h}-${stamp}.png`;
    if (coarse) {
      toastEl.classList.remove("show");
      showResult(blob, name, `${w} × ${h}${ss > 1 ? " · 2× supersampled" : ""} · ${(blob.size / 1e6).toFixed(1)} MB`);
    } else {
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast(`Saved ${name}${ss > 1 ? " (2× supersampled)" : ""}`);
    }
  } catch (err) {
    console.error(err);
    toast(`Export failed: ${err.message}. Try a smaller size or turn off supersampling.`, 6000);
  } finally {
    if (er) { er.dispose(); er.forceContextLoss(); }
    btn.disabled = false;
  }
}

/*
 * On phones a download started after a long render is often blocked (the tap that started it has
 * "expired"), so the result opens in a sheet: Share / Save to Photos and Download are fresh taps.
 */
const resultDlg = $("result");
let resultUrl = null;
function showResult(blob, name, meta) {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = URL.createObjectURL(blob);
  $("resultImg").src = resultUrl;
  $("resultMeta").textContent = `${name} · ${meta}`;
  const dl = $("resultDownload"); dl.href = resultUrl; dl.download = name;
  const file = new File([blob], name, { type: "image/png" });
  const share = $("resultShare");
  share.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
  share.onclick = async () => {
    try { await navigator.share({ files: [file], title: name }); }
    catch (err) { if (err.name !== "AbortError") toast("Sharing isn't available here. Use Download instead."); }
  };
  if (resultDlg.showModal) resultDlg.showModal(); else resultDlg.setAttribute("open", "");
}
resultDlg.addEventListener("close", () => { if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; } });
resultDlg.addEventListener("click", (e) => { if (e.target === resultDlg) resultDlg.close(); });   // tap outside to close

/* ------------------------------------------------------------------ UI */
function renderPaletteButtons() {
  const box = $("palette"); box.textContent = "";
  for (const p of MODELS[state.model].palettes) {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(p.id === state.palette));
    b.title = p.note || p.label;
    const [ca, cb] = p.swatch || ["#ccc", "#999"];
    b.innerHTML = `<span class="dot" style="--a:${ca};--b:${cb}"></span><span class="seg-text">${p.label}${p.note ? `<small>${p.note}</small>` : ""}</span>`;
    b.onclick = () => { if (state.palette !== p.id) { state.palette = p.id; loadModel(); } };
    box.append(b);
  }
}
function renderOptions(def) {
  const box = $("opts"); box.textContent = "";
  $("optsField").hidden = !(def.options || []).length;
  for (const o of def.options || []) {
    const label = document.createElement("label"); label.className = "check";
    const input = Object.assign(document.createElement("input"), { type: "checkbox", checked: !!state.opts[o.id] });
    input.onchange = () => { state.opts[o.id] = input.checked; loadModel(); };
    label.append(input, ` ${o.label}`);
    if (o.note) label.append(Object.assign(document.createElement("small"), { textContent: `· ${o.note}` }));
    box.append(label);
  }
}
function bindSlider(id, fmt, set) {
  const el = $(id), out = el.nextElementSibling;
  el.addEventListener("input", () => { const v = +el.value; out.textContent = fmt(v); set(v); requestRender(); });
}

$("model").innerHTML = MODELS.map((m, i) => `<option value="${i}">${m.name}</option>`).join("");
$("model").onchange = (e) => { state.model = +e.target.value; state.palette = null; loadModel({ refit: true, newModel: true }); };
$("presets").append(...presets().map((p) => Object.assign(document.createElement("button"), { type: "button", textContent: p.label, onclick: () => applyPreset(presets().find((q) => q.label === p.label)) })));

for (const k of ["yaw", "pitch", "roll"]) bindSlider(k, (v) => v + "°", (v) => { state[k] = v; applyPose(); });
$("resetPose").onclick = () => { state.yaw = state.pitch = state.roll = 0; applyPose(); };
$("frameBtn").onclick = frameModel;
bindSlider("fov", (v) => v + "°", (v) => { state.fov = v; syncViewportLens(); });
bindSlider("fill", (v) => v + "%", (v) => { state.fill = v / 100; });
$("fill").addEventListener("change", frameModel);   // refit once the slider is let go
bindSlider("light", (v) => v + "°", (v) => { state.light = v; setLightAngle(v); });
$("light").value = state.light; $("light").nextElementSibling.textContent = state.light + "°";
$("grain").onchange = (e) => { state.grain = e.target.checked; shared.grain.value = state.grain ? 1 : 0; requestRender(); };

$("size").onchange = (e) => {
  state.size = e.target.value.split("x").map(Number);
  $("shoot").textContent = `Generate ${sizeName(state.size)} PNG`;
  layoutFrame(); syncViewportLens(); frameModel();
};
function setBg(bg) {
  state.bg = bg;
  stage.dataset.bg = bg === "transparent" ? "transparent" : "solid";
  stage.style.setProperty("--stage-bg", bg === "transparent" ? "" : bg);
  document.querySelectorAll("#bg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.bg === bg)));
  $("bgCustom").parentElement.style.outline = bg === $("bgCustom").value ? "2.5px solid var(--purple)" : "";
  $("bgCustom").parentElement.style.outlineOffset = "2px";
}
document.querySelectorAll("#bg button").forEach((b) => (b.onclick = () => setBg(b.dataset.bg)));
$("bgCustom").addEventListener("input", (e) => setBg(e.target.value));
$("ss").checked = state.ss;
$("ss").onchange = (e) => { state.ss = e.target.checked; };
setMode("orbit");
$("shoot").onclick = shoot;

addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target.tagName;
  if (tag === "SELECT" || (tag === "INPUT" && e.target.type !== "range" && e.target.type !== "checkbox")) return;
  const k = e.key.toLowerCase();
  if (k === "f") frameModel();
  else if (k === "r") $("resetPose").click();
  else if (k === "s") shoot();
  else if (k === "t") setMode(state.mode === "orbit" ? "turn" : "orbit");
});

/* ------------------------------------------------------------------ loop */
function resize() {
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  renderer.setSize(w, h, false);
  layoutFrame(); syncViewportLens(); requestRender();
}
new ResizeObserver(resize).observe(stage);

const ease = (t) => 1 - Math.pow(1 - t, 3);
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / 0.6);
    const k = ease(tween.t);
    camera.position.lerpVectors(tween.p0, tween.p1, k);
    controls.target.lerpVectors(tween.t0, tween.t1, k);
    if (tween.t >= 1) tween = null;
    finishCamera();
  }
  controls.update();
  if (dirty) { beforeRender(camera); renderer.render(scene, camera); dirty = false; }
  requestAnimationFrame(loop);
}

resize();
await loadModel({ refit: true, newModel: true });
requestAnimationFrame(loop);
window.__studio = { state, shoot, ready: true };   // handy for scripted exports
