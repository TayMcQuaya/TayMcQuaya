// The Cabinet: the site runs on a 3D arcade cabinet's CRT.
// Without WebGL (or if a CDN fails) the page stays in Quick view, which is plain HTML.
import * as THREE from 'three';
import Lenis from 'lenis';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(pointer: coarse)').matches;
const body = document.body;

// ======================================================
// Screen content (works in both modes)
// ======================================================
const views = Object.fromEntries($$('.view').map((v) => [v.dataset.view, v]));
let current = 'menu';
let enterCabinet = () => {};
function openView(name, focus = true) {
  if (!views[name]) return;
  if (body.classList.contains('mode-3d')) {
    Object.values(views).forEach((v) => v.classList.toggle('is-on', v === views[name]));
    current = name;
    if (name === 'projects') showGame(gameIdx);
    else stopGameVideo();
    if (focus && body.classList.contains('is-inside')) {
      const f = $(name === 'menu' ? '.menu-list button' : '.back', views[name]);
      f && f.focus({ preventScroll: true });
    }
  } else {
    views[name].scrollIntoView({ behavior: 'smooth' });
  }
}
$$('[data-open]').forEach((el) => el.addEventListener('click', (e) => {
  e.preventDefault();
  openView(el.dataset.open);
  if (!body.classList.contains('is-inside')) enterCabinet();
}));

// lore pager
let lorePage = 0;
const lorePages = $$('.lore-page');
$$('[data-lore]').forEach((b) => b.addEventListener('click', () => {
  lorePage = (lorePage + Number(b.dataset.lore) + lorePages.length) % lorePages.length;
  lorePages.forEach((p, i) => p.classList.toggle('is-on', i === lorePage));
  $('#lore-count').textContent = `${lorePage + 1} / ${lorePages.length}`;
}));

// game select
const gameBtns = $$('.game');
const games = $$('.games .project');
let gameIdx = 0;
function stopGameVideo() { $$('.project-media video').forEach((v) => { v.pause(); v.remove(); }); }
function showGame(i) {
  gameIdx = (i + games.length) % games.length;
  gameBtns.forEach((b, k) => b.classList.toggle('is-on', k === gameIdx));
  games.forEach((g, k) => g.classList.toggle('is-on', k === gameIdx));
  stopGameVideo();
  const g = games[gameIdx];
  if (g.dataset.video && body.classList.contains('mode-3d')) {
    const v = document.createElement('video');
    Object.assign(v, { src: g.dataset.video, poster: g.dataset.poster || '', muted: true, loop: true, autoplay: true, playsInline: true });
    v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    $('.project-media', g).appendChild(v);
    v.play().catch(() => {});
  }
}
gameBtns.forEach((b, k) => { b.addEventListener('click', () => showGame(k)); b.addEventListener('mouseenter', () => showGame(k)); });

// art viewer
const arts = $$('.art');
const viewer = $('#viewer');
let artIdx = 0;
function showArt(i) {
  artIdx = (i + arts.length) % arts.length;
  $('#viewer-img').src = arts[artIdx].dataset.orig;
  $('#viewer-img').alt = $('img', arts[artIdx]).alt;
  $('#viewer-count').textContent = `${artIdx + 1} / ${arts.length}`;
}
arts.forEach((a, i) => a.addEventListener('click', () => { showArt(i); viewer.hidden = false; $('[data-v="0"]', viewer).focus({ preventScroll: true }); }));
$$('[data-v]').forEach((b) => b.addEventListener('click', () => {
  const d = Number(b.dataset.v);
  if (d === 0) viewer.hidden = true; else showArt(artIdx + d);
}));

// keyboard: arrows move, Enter picks, Escape goes back
const menuBtns = $$('.menu-list button');
let menuSel = 0;
menuBtns.forEach((b, i) => b.addEventListener('mouseenter', () => { menuSel = i; menuBtns.forEach((x, k) => x.classList.toggle('is-sel', k === i)); }));
addEventListener('keydown', (e) => {
  if (!body.classList.contains('is-inside')) return;
  if (e.key === 'Escape') {
    if (!viewer.hidden) viewer.hidden = true;
    else if (current !== 'menu') openView('menu');
    else window.__exitCabinet && window.__exitCabinet();
    e.preventDefault(); return;
  }
  const dir = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
  if (current === 'menu' && dir) {
    menuSel = (menuSel + dir + menuBtns.length) % menuBtns.length;
    menuBtns.forEach((x, k) => x.classList.toggle('is-sel', k === menuSel));
    menuBtns[menuSel].focus({ preventScroll: true }); e.preventDefault();
  } else if (current === 'projects' && dir) { showGame(gameIdx + dir); gameBtns[gameIdx].focus({ preventScroll: true }); e.preventDefault(); }
  else if (current === 'art' && !viewer.hidden && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) showArt(artIdx + (e.key === 'ArrowRight' ? 1 : -1));
});

// ======================================================
// 3D
// ======================================================
start3D().catch((err) => {
  console.warn('3D view unavailable, staying in Quick view:', err);
  body.classList.remove('mode-3d', 'is-inside', 'is-full');
});

// Solve the 3x3 homography that maps 4 src points onto 4 dst points.
function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return `matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,1)`;
}

async function start3D() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: false, powerPreference: 'high-performance' }); }
  catch (e) { throw new Error('WebGL not available'); }
  body.classList.add('mode-3d');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // lighting is baked + tone mapped in Blender
  const DPR = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0708');
  scene.fog = new THREE.Fog('#0b0708', 6, 13);
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 40);

  const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(DPR);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.7, 0.55, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.045 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `precision mediump float; uniform sampler2D tDiffuse; uniform float uTime, uGrain; varying vec2 vUv;
      float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        float v = smoothstep(1.15, .35, length(vUv - .5) * 1.25);
        c.rgb *= mix(.55, 1., v);
        c.rgb += (rnd(vUv * 900.) - .5) * uGrain;
        gl_FragColor = c; }`,
  });
  composer.addPass(finish);

  // ---------- load ----------
  const fill = $('#loader-fill');
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_u, l, t) => { fill.style.width = `${Math.round((l / t) * 100)}%`; };
  await Promise.race([
    Promise.all(['16px "Press Start 2P"', '16px Silkscreen', '16px "Space Mono"'].map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  const gltf = await new GLTFLoader(manager).loadAsync('assets/arcade.glb');
  scene.add(gltf.scene);

  let screenMesh = null;
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name.includes('_baked')) {
      o.material = new THREE.MeshBasicMaterial({ map: o.material.map });
    } else if (o.name.startsWith('cab_screen')) {
      screenMesh = o; o.material = new THREE.MeshBasicMaterial({ color: '#120a07' });
    } else if (o.name.startsWith('cab_marquee')) {
      o.material = new THREE.MeshBasicMaterial({ map: marqueeTexture(), color: new THREE.Color(1.5, 1.5, 1.5) });
    } else if (o.name.startsWith('cab_coinslot')) {
      o.material = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b30').multiplyScalar(2.6) });
    }
  });
  if (!screenMesh) throw new Error('screen mesh missing');

  // soft light beam from the ceiling spot, with dust drifting through it
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 1.15, 3.4, 48, 1, true),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; varying float vEdge;
        void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.);
          vEdge = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `precision mediump float; varying vec2 vUv; varying float vEdge;
        void main(){ float a = pow(vUv.y, 1.6) * pow(vEdge, 2.2) * .11; gl_FragColor = vec4(1., .82, .55, a); }`,
    }),
  );
  beam.position.set(0, 1.95, 0.62); beam.rotation.x = -0.12;
  scene.add(beam);
  const dustN = 240, dustPos = new Float32Array(dustN * 3), dustSeed = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) {
    const r = Math.sqrt(Math.random()) * 0.95, a = Math.random() * Math.PI * 2;
    dustPos.set([Math.cos(a) * r, 0.3 + Math.random() * 3.0, 0.6 + Math.sin(a) * r], i * 3); dustSeed[i] = Math.random() * 100;
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dc = document.createElement('canvas'); dc.width = dc.height = 32;
  const dg = dc.getContext('2d'), rg = dg.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,230,190,1)'); rg.addColorStop(1, 'rgba(255,230,190,0)'); dg.fillStyle = rg; dg.fillRect(0, 0, 32, 32);
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.014, map: new THREE.CanvasTexture(dc), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);
  const dustBase = dustPos.slice();
  const driftDust = (t) => {
    for (let i = 0; i < dustN; i++) {
      const s = dustSeed[i];
      dustPos[i * 3] = dustBase[i * 3] + Math.sin(t * 0.13 + s) * 0.08;
      dustPos[i * 3 + 1] = 0.3 + ((dustBase[i * 3 + 1] - 0.3 + t * 0.025 * (0.5 + (s % 1))) % 3.0);
      dustPos[i * 3 + 2] = dustBase[i * 3 + 2] + Math.cos(t * 0.11 + s) * 0.08;
    }
    dustGeo.attributes.position.needsUpdate = true;
  };

  // screen frame in world space: center, normal, up, right
  gltf.scene.updateMatrixWorld(true);
  screenMesh.geometry.computeBoundingBox();
  const bb = screenMesh.geometry.boundingBox, ext = bb.getSize(new THREE.Vector3());
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  const order = [0, 1, 2].sort((a, b) => ext.getComponent(a) - ext.getComponent(b)); // thin, short, long
  const nm = new THREE.Matrix3().getNormalMatrix(screenMesh.matrixWorld);
  const N = axes[order[0]].clone().applyMatrix3(nm).normalize(); if (N.z < 0) N.negate();
  const U = axes[order[1]].clone().applyMatrix3(nm).normalize(); if (U.y < 0) U.negate();
  const R = new THREE.Vector3().crossVectors(U, N).normalize();
  const C = bb.getCenter(new THREE.Vector3()); C.setComponent(order[0], bb.max.getComponent(order[0]));
  screenMesh.localToWorld(C);
  const SW = ext.getComponent(order[2]) * 0.985, SH = ext.getComponent(order[1]) * 0.985;
  const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => C.clone().addScaledVector(R, sx * SW / 2).addScaledVector(U, sy * SH / 2));
  const SRC = [[0, 0], [960, 0], [960, 720], [0, 720]];

  // ---------- sizing ----------
  let vw = innerWidth, vh = innerHeight, narrow = vw <= 760 || vw / vh < 0.9;
  const track = $('#scroll-track');
  function resize() {
    vw = innerWidth; vh = innerHeight; narrow = vw <= 760 || vw / vh < 0.9;
    renderer.setSize(vw, vh, false); composer.setSize(vw, vh);
    bloom.setSize(vw / 2, vh / 2);
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    track.style.height = `${vh * 2.2}px`;
  }
  resize(); addEventListener('resize', resize);

  // ---------- camera rig ----------
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const WIDE = new THREE.Vector3(-1.15, 1.12, 4.0), WIDE_T = new THREE.Vector3(0.02, 0.96, 0);
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3(), up = new THREE.Vector3(), tmp = new THREE.Vector3();
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (e) => { mouse.x = (e.clientX / vw) * 2 - 1; mouse.y = -(e.clientY / vh) * 2 + 1; });
  function insideDist() {
    return Math.max(SH / (0.9 * 2 * tanH), SW / (0.95 * 2 * tanH * camera.aspect));
  }
  function placeCamera(p, time) {
    const e = ease(p);
    const IN = C.clone().addScaledVector(N, insideDist());
    const MID = C.clone().addScaledVector(N, 1.6).add(new THREE.Vector3(-0.35, -0.05, 0));
    const W0 = narrow ? WIDE_T.clone().add(tmp.copy(WIDE).sub(WIDE_T).multiplyScalar(1.5)) : WIDE;
    const curve = new THREE.QuadraticBezierCurve3(W0, MID, IN);
    curve.getPoint(e, pos);
    tgt.lerpVectors(WIDE_T, C, clamp(e * 1.25, 0, 1));
    up.set(0, 1, 0).lerp(U, clamp((e - 0.5) * 2, 0, 1)).normalize();
    if (!reduced) {
      const k = 1 - e;
      mouse.sx = lerp(mouse.sx, isTouch ? 0 : mouse.x, 0.04); mouse.sy = lerp(mouse.sy, isTouch ? 0 : mouse.y, 0.04);
      pos.x += mouse.sx * 0.35 * k; pos.y += mouse.sy * 0.15 * k + Math.sin(time * 0.5) * 0.02 * k;
    }
    camera.position.copy(pos); camera.up.copy(up); camera.lookAt(tgt);
    // frame the cabinet beside the intro text on the wide shot
    const cx = narrow ? 0.5 : lerp(0.64, 0.5, e), cy = narrow ? lerp(0.36, 0.5, e) : 0.5;
    camera.setViewOffset(vw, vh, (0.5 - cx) * vw, (0.5 - cy) * vh, vw, vh);
    camera.updateMatrixWorld();
  }
  const screenEl = $('#screen');
  const ndc = new THREE.Vector3();
  function mapScreen() {
    if (body.classList.contains('is-full')) { screenEl.style.transform = ''; return; }
    const dst = corners.map((c) => { ndc.copy(c).project(camera); return [(ndc.x + 1) / 2 * vw, (1 - ndc.y) / 2 * vh]; });
    screenEl.style.transform = homography(SRC, dst);
  }

  // ---------- scroll: 0 = wide shot, 1 = inside the screen ----------
  const lenis = new Lenis({ lerp: reduced ? 1 : 0.07, wheelMultiplier: 0.8 });
  const maxScroll = () => vh * 1.2;
  let p = 0, renderP = 0, snapT = 0;
  lenis.on('scroll', ({ scroll }) => {
    if (!body.classList.contains('mode-3d')) return;
    p = clamp(scroll / maxScroll(), 0, 1);
    clearTimeout(snapT);
    snapT = setTimeout(() => { if (p > 0.04 && p < 0.96) lenis.scrollTo(p > 0.4 ? maxScroll() : 0, { duration: 1.4 }); }, 220);
  });
  enterCabinet = () => lenis.scrollTo(maxScroll(), { duration: reduced ? 0 : 2.2 });
  window.__exitCabinet = () => lenis.scrollTo(0, { duration: reduced ? 0 : 1.8 });
  $('#intro-start').addEventListener('click', enterCabinet);
  $('#exit-btn').addEventListener('click', window.__exitCabinet);
  screenEl.addEventListener('click', () => { if (!body.classList.contains('is-inside')) enterCabinet(); });

  // Quick view
  const qt = $('#quick-toggle');
  qt.addEventListener('click', () => {
    const toDoc = body.classList.contains('mode-3d');
    body.classList.toggle('mode-3d', !toDoc);
    if (toDoc) { body.classList.remove('is-inside', 'is-full'); screenEl.style.transform = ''; stopGameVideo(); }
    qt.setAttribute('aria-pressed', String(toDoc)); qt.textContent = toDoc ? '3D view' : 'Quick view';
    requestAnimationFrame(() => { lenis.resize(); lenis.scrollTo(0, { immediate: true }); p = renderP = 0; });
  });

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let last = 0, inside = false;
  function frame() {
    requestAnimationFrame(frame);
    const now = clock.getElapsedTime(), dt = Math.min(0.1, now - last); last = now;
    lenis.raf(now * 1000);
    if (!body.classList.contains('mode-3d')) return;
    renderP = reduced ? p : lerp(renderP, p, 1 - Math.pow(0.002, dt));
    if (Math.abs(renderP - p) < 1e-4) renderP = p;
    const nowInside = renderP > 0.985;
    if (nowInside !== inside) {
      inside = nowInside;
      body.classList.toggle('is-inside', inside);
      body.classList.toggle('is-full', inside && narrow);
      if (inside) { const f = $(current === 'menu' ? '.menu-list button' : '.back', views[current]); f && f.focus({ preventScroll: true }); if (current === 'projects') showGame(gameIdx); }
      else stopGameVideo();
    }
    $('#intro').classList.toggle('gone', renderP > 0.08);
    placeCamera(renderP, now);
    mapScreen();
    if (!reduced) driftDust(now);
    beam.visible = dust.visible = renderP < 0.97;
    finish.uniforms.uTime.value = now % 10;
    composer.render(dt);
  }

  // ---------- reveal ----------
  $('#loader').classList.add('done');
  setTimeout(() => { $('#loader').style.display = 'none'; }, 900);
  const hashView = location.hash.slice(1);
  if (views[hashView]) { openView(hashView, false); requestAnimationFrame(() => enterCabinet()); }
  frame();

  window.__arcade = { setP: (v) => { p = renderP = v; }, info: () => ({ calls: renderer.info.render.calls, inside }) };
}

// Marquee art: backlit sign with the name in the pixel font
function marqueeTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 372;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 372);
  grd.addColorStop(0, '#3a1206'); grd.addColorStop(0.5, '#7a2a08'); grd.addColorStop(1, '#2a0d05');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 372);
  g.globalAlpha = 0.18; g.fillStyle = '#fbbf24';
  for (let i = -400; i < 1100; i += 60) { g.save(); g.translate(i, 0); g.transform(1, 0, -0.6, 1, 0, 0); g.fillRect(0, 0, 18, 372); g.restore(); }
  g.globalAlpha = 1;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '82px "Press Start 2P", monospace';
  g.fillStyle = '#7f1d1d'; g.fillText('TAYMCQUAYA', 518, 176);
  g.shadowColor = '#fbbf24'; g.shadowBlur = 30; g.fillStyle = '#ffe9a8'; g.fillText('TAYMCQUAYA', 512, 170);
  g.shadowBlur = 0; g.font = '26px "Press Start 2P", monospace'; g.fillStyle = '#fde8c8';
  g.fillText('★ INSERT COIN ★', 512, 290);
  g.strokeStyle = '#fbbf24'; g.lineWidth = 6; g.strokeRect(14, 14, 996, 344);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8;
  return t;
}
