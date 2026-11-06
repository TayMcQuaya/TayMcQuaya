// The Arcade Room: scroll-driven 3D portfolio.
// Without WebGL (or if a CDN fails) the page stays in Quick view, which is plain HTML.
import * as THREE from 'three';
import Lenis from 'lenis';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, ROOM } from './world.js';
import { createPortrait } from './portrait.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(pointer: coarse)').matches;

// ---------- parts that work in both modes ----------
$$('.project').forEach((el) => el.dataset.accent && el.style.setProperty('--accent', el.dataset.accent));
const panels = $$('.panel');
const N = panels.length;

let lenis = null;
const lockScroll = (on) => { if (!lenis) return; on ? lenis.stop() : lenis.start(); };

// Lore pager
let lorePage = 0;
const lorePages = $$('.lore-page');
$$('[data-lore]').forEach((b) => b.addEventListener('click', () => {
  lorePage = (lorePage + Number(b.dataset.lore) + lorePages.length) % lorePages.length;
  lorePages.forEach((p, i) => p.classList.toggle('is-on', i === lorePage));
  $('#lore-count').textContent = `${lorePage + 1} / ${lorePages.length}`;
}));

// Project modal
const modal = $('#modal');
let lastFocus = null, modalCanvasEl = null;
function openOverlay(el) { lastFocus = document.activeElement; el.hidden = false; lockScroll(true); $('[data-close]', el).focus(); }
function closeOverlay(el) {
  el.hidden = true; lockScroll(false);
  const v = $('video', el); if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
  modalCanvasEl = null;
  if (lastFocus) lastFocus.focus({ preventScroll: true });
}
function openProject(el, canvasSrc) {
  const media = $('#modal-media'); media.innerHTML = '';
  if (el.dataset.video) {
    const v = document.createElement('video');
    Object.assign(v, { src: el.dataset.video, autoplay: true, loop: true, muted: true, playsInline: true, controls: true });
    if (el.dataset.poster) v.poster = el.dataset.poster;
    media.appendChild(v);
  } else if (canvasSrc) {
    modalCanvasEl = document.createElement('canvas'); modalCanvasEl.width = canvasSrc.width; modalCanvasEl.height = canvasSrc.height;
    modalCanvasEl.dataset.src = 'ph'; modalCanvasEl._src = canvasSrc;
    media.appendChild(modalCanvasEl);
  } else {
    media.innerHTML = '<p style="font-family:var(--font-display);color:var(--gold);font-size:28px">???</p>';
  }
  $('#modal-title').textContent = $('.project-name', el).textContent;
  $('#modal-type').textContent = $('.project-type', el).textContent;
  $('#modal-body').innerHTML = $('.project-body', el).innerHTML;
  openOverlay(modal);
}
$$('.project-open').forEach((b) => b.addEventListener('click', () => {
  const el = b.closest('.project');
  openProject(el, el.dataset.featured ? world?.phCanvas : null);
}));

// Art lightbox
const lightbox = $('#lightbox');
const arts = $$('#art .art');
let lbIndex = 0;
function showArt(i) {
  lbIndex = (i + arts.length) % arts.length;
  const fig = arts[lbIndex], img = $('img', fig);
  $('#lightbox-img').src = fig.dataset.orig; $('#lightbox-img').alt = img.alt;
  $('#lightbox-count').textContent = `${lbIndex + 1} / ${arts.length}`;
}
function openArt(i) { showArt(i); openOverlay(lightbox); }
arts.forEach((f, i) => f.addEventListener('click', () => openArt(i)));
$$('[data-lb]').forEach((b) => b.addEventListener('click', () => showArt(lbIndex + Number(b.dataset.lb))));

$$('.overlay').forEach((o) => {
  o.addEventListener('click', (e) => { if (e.target === o || e.target.closest('[data-close]')) closeOverlay(o); });
});
addEventListener('keydown', (e) => {
  const open = $$('.overlay').find((o) => !o.hidden);
  if (!open) return;
  if (e.key === 'Escape') closeOverlay(open);
  if (open === lightbox && e.key === 'ArrowRight') showArt(lbIndex + 1);
  if (open === lightbox && e.key === 'ArrowLeft') showArt(lbIndex - 1);
});

// ---------- 3D ----------
let world = null;
start3D().catch((err) => { console.warn('3D view unavailable, staying in Quick view:', err); document.body.classList.remove('mode-3d'); });

async function start3D() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: false, powerPreference: 'high-performance' });
  } catch (e) { throw new Error('WebGL not available'); }
  document.body.classList.add('mode-3d');

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 80);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // loading
  const loaderText = $('#loader-text'), fill = $('#loader-fill');
  const manager = new THREE.LoadingManager();
  let ready = false;
  manager.onProgress = (_u, loaded, total) => { fill.style.width = `${Math.round((loaded / total) * 100)}%`; };
  const texLoader = new THREE.TextureLoader(manager);
  const loadTexture = (url, cb) => texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; cb && cb(t); });

  await Promise.race([
    Promise.all(['16px "Press Start 2P"', '16px Silkscreen', '16px "Space Mono"'].map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  const avatar = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/tex/avatar64.png'; });

  world = buildWorld({ scene, loadTexture });
  const featured = world.interactive.find((m) => m.userData.root?.userData.info.featured);
  world.phCanvas = featured ? featured.userData.root.userData.info.canvas : null;
  world.hoverables.forEach((r) => { r.userData.baseScale = r.scale.x; });

  const portrait = createPortrait(avatar);
  portrait.group.position.set(0, 3.15, 1);
  scene.add(portrait.group);

  // ---------- stations ----------
  const STATIONS = [
    { target: [0, 3.1, 1], yaw: 0, pitch: 4, w: 6.4, h: 6.4 },          // hero
    { target: [0, 3.15, 1], yaw: -42, pitch: 7, w: 6.2, h: 6.2 },        // about
    { target: [0, 1.75, -8.4], yaw: 0, pitch: 13, w: 14.2, h: 5.6 },     // the arcade
    { target: [0, 2.5, -12.8], yaw: 0, pitch: 6, w: 3.2, h: 3.3 },       // now playing
    { target: [-ROOM.x, 3.45, -1], yaw: 90, pitch: 3, w: 13.8, h: 5.4 },  // gallery
    { target: [ROOM.x - 0.5, 3.0, -2], yaw: -90, pitch: 4, w: 6.6, h: 6.9 }, // inventory
    { target: [4, 3.45, ROOM.z], yaw: -180, pitch: 3, w: 5.6, h: 4.3 },   // quest board
  ];
  const sides = panels.map((p) => p.dataset.side || 'left');

  let vw = innerWidth, vh = innerHeight, mobile = vw <= 760, layouts = [];
  const STEP = 1.15; // viewport heights of scroll per station
  const track = $('#scroll-track');
  let pxScale = 1, qualityDrop = 0;

  function measureLayouts() {
    const top = 56 / vh;
    layouts = panels.map((p, i) => {
      if (mobile) {
        const f = clamp((Math.min(p.scrollHeight, vh * 0.43) + 20) / vh, 0.2, 0.5);
        return { ax: 1, ay: 1 - f - top, cx: 0.5, cy: top + (1 - f - top) / 2 };
      }
      const pw = p.getBoundingClientRect().width || Math.min(430, vw * 0.38);
      const f = clamp((vw * 0.04 + pw + 28) / vw, 0.25, 0.55);
      const ax = 1 - f;
      return { ax, ay: 1, cx: sides[i] === 'right' ? ax / 2 : f + ax / 2, cy: 0.5 };
    });
  }
  function resize() {
    vw = innerWidth; vh = innerHeight; mobile = vw <= 760;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const longSide = Math.max(vw, vh) * dpr;
    pxScale = Math.max(1, longSide / (mobile ? 760 : 820)) * (1 + qualityDrop * 0.3);
    const rw = Math.max(64, Math.round((vw * dpr) / pxScale)), rh = Math.max(64, Math.round((vh * dpr) / pxScale));
    renderer.setSize(rw, rh, false);
    composer.setSize(rw, rh);
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    track.style.height = `${(N - 1) * STEP * vh + vh}px`;
    measureLayouts();
  }
  resize();
  addEventListener('resize', resize);

  // ---------- scroll ----------
  lenis = new Lenis({ lerp: reduced ? 1 : 0.085, wheelMultiplier: 0.9 });
  lenis.stop();
  const stationY = (i) => i * STEP * vh;
  const goTo = (i, immediate = false) => {
    if (document.body.classList.contains('mode-doc')) { $(`#${panels[i].id}`).scrollIntoView({ behavior: 'smooth' }); return; }
    lenis.scrollTo(stationY(i), { immediate: immediate || reduced, duration: 1.6, lock: false });
  };
  $$('[data-go]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goTo(Number(a.dataset.go)); }));

  let p = 0, snapTimer = 0;
  lenis.on('scroll', ({ scroll }) => {
    if (document.body.classList.contains('mode-doc')) return;
    p = clamp(scroll / (STEP * vh), 0, N - 1);
    $('#hud-hint').classList.add('gone');
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      const r = Math.round(p), off = Math.abs(p - r);
      if (off > 0.06 && off < 0.5 && lenis.isScrolling === false) lenis.scrollTo(stationY(r), { duration: 0.9 });
    }, 260);
  });

  // HUD
  const dots = $('#hud-dots');
  panels.forEach(() => dots.appendChild(document.createElement('i')));
  const navLinks = $$('#topbar nav a');
  let activeStation = -1;
  function setActive(i) {
    if (i === activeStation) return;
    activeStation = i;
    panels.forEach((pn, k) => { pn.classList.toggle('is-active', k === i); pn.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
    if (i < 0) return;
    $('#hud-num').textContent = `${i + 1}/${N}`;
    $('#hud-label').textContent = panels[i].dataset.label;
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    const navFor = i === 3 ? 2 : i;
    navLinks.forEach((a) => a.classList.toggle('is-active', Number(a.dataset.go) === navFor));
    try { history.replaceState(null, '', `#${panels[i].id}`); } catch (e) { /* sandboxed */ }
  }

  // Quick view toggle
  const qt = $('#quick-toggle');
  let savedScroll = 0;
  function setDocMode(on) {
    if (on === document.body.classList.contains('mode-doc')) return;
    if (on) {
      savedScroll = lenis.scroll;
      document.body.classList.add('mode-doc'); document.body.classList.remove('mode-3d');
      panels.forEach((pn) => pn.removeAttribute('aria-hidden'));
      lenis.start(); requestAnimationFrame(() => lenis.scrollTo(0, { immediate: true }));
    } else {
      document.body.classList.remove('mode-doc'); document.body.classList.add('mode-3d');
      activeStation = -1; resize();
      requestAnimationFrame(() => lenis.scrollTo(savedScroll, { immediate: true }));
    }
    qt.setAttribute('aria-pressed', String(on));
    qt.textContent = on ? '3D view' : 'Quick view';
  }
  qt.addEventListener('click', () => { hideLoader(); setDocMode(!document.body.classList.contains('mode-doc')); });

  // ---------- loader / start ----------
  let started = false, assembleT = 0;
  const startBtn = $('#loader-start'), quickBtn = $('#loader-quick');
  function hideLoader() { $('#loader').classList.add('done'); setTimeout(() => { $('#loader').style.display = 'none'; }, 650); }
  function begin() {
    if (started || !ready) return;
    started = true; hideLoader(); lenis.start();
    const hashIdx = panels.findIndex((pn) => `#${pn.id}` === location.hash);
    if (hashIdx > 0) goTo(hashIdx, true);
    if (reduced) assembleT = 1;
  }
  startBtn.addEventListener('click', begin);
  quickBtn.addEventListener('click', () => { started = true; hideLoader(); setDocMode(true); });
  addEventListener('keydown', (e) => { if (!started && ready && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); begin(); } });
  addEventListener('wheel', () => { if (!started && ready) begin(); }, { passive: true });
  addEventListener('touchmove', () => { if (!started && ready) begin(); }, { passive: true });

  const onReady = () => {
    if (ready) return; ready = true;
    fill.style.width = '100%'; loaderText.textContent = 'READY';
    startBtn.hidden = false; quickBtn.hidden = false;
  };
  manager.onLoad = onReady;
  setTimeout(onReady, 9000); // never get stuck on a slow texture

  // ---------- picking ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(), mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  let hovered = null, pointerDirty = false, downAt = null, listHover = null;
  const tip = $('#tooltip');
  addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / vw) * 2 - 1; mouse.y = -(e.clientY / vh) * 2 + 1;
    tip.style.left = `${e.clientX}px`; tip.style.top = `${e.clientY}px`;
    pointerDirty = true;
  });
  const overUI = (e) => e.target.closest('.panel, #topbar, .overlay, #loader');
  addEventListener('pointerdown', (e) => { downAt = overUI(e) ? null : { x: e.clientX, y: e.clientY, t: performance.now() }; });
  addEventListener('pointerup', (e) => {
    if (!downAt || !started || document.body.classList.contains('mode-doc')) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 8) return;
    mouse.x = (e.clientX / vw) * 2 - 1; mouse.y = -(e.clientY / vh) * 2 + 1;
    const hit = pick();
    if (hit) activate(hit.userData.info);
  });
  function pick() {
    ndc.set(mouse.x, mouse.y);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(world.interactive, false);
    return hits.length ? hits[0].object.userData.root : null;
  }
  function activate(info) {
    if (info.kind === 'project') openProject(info.el, info.featured ? info.canvas : null);
    else if (info.kind === 'art') openArt(info.index);
    else if (info.kind === 'note' && info.el) info.el.click();
    else if (info.kind === 'skill') { info.el.animate([{ color: '#fbbf24', transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 600 }); if (activeStation !== 5) goTo(5); }
  }
  // hovering a project name in the panel lights up its cabinet
  $$('#projects .project, #now-playing .project').forEach((el) => {
    el.addEventListener('mouseenter', () => { listHover = world.hoverables.find((r) => r.userData.info.el === el) || null; });
    el.addEventListener('mouseleave', () => { listHover = null; });
  });

  // ---------- camera ----------
  const tgt = new THREE.Vector3(), dir = new THREE.Vector3(), camPos = new THREE.Vector3(), right = new THREE.Vector3();
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const BOUND = { x: ROOM.x - 0.6, z: ROOM.z - 0.6, y: ROOM.h - 0.4 };
  function placeCamera(pp, time) {
    const i = Math.min(Math.floor(pp), N - 2), f = pp - i;
    const t = smoother(clamp((f - 0.16) / 0.68, 0, 1));
    const A = STATIONS[i], B = STATIONS[i + 1], LA = layouts[i], LB = layouts[i + 1];
    tgt.set(lerp(A.target[0], B.target[0], t), lerp(A.target[1], B.target[1], t), lerp(A.target[2], B.target[2], t));
    const yaw = THREE.MathUtils.degToRad(lerp(A.yaw, B.yaw, t)), pitch = THREE.MathUtils.degToRad(lerp(A.pitch, B.pitch, t));
    dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const w = lerp(A.w, B.w, t), h = lerp(A.h, B.h, t);
    const ax = lerp(LA.ax, LB.ax, t), ay = lerp(LA.ay, LB.ay, t), cx = lerp(LA.cx, LB.cx, t), cy = lerp(LA.cy, LB.cy, t);
    // pull back further mid-transit so moves read as a sweep, not a slide
    const arc = Math.sin(Math.PI * t) * (A.yaw !== B.yaw ? 1.35 : 1.12);
    let d = Math.max(h / (2 * ay * tanH), w / (2 * camera.aspect * ax * tanH)) * Math.max(1, arc);
    // keep the camera inside the room
    for (const [k, b] of [['x', BOUND.x], ['z', BOUND.z]]) {
      const dc = dir[k];
      if (Math.abs(dc) > 1e-4) d = Math.min(d, ((dc > 0 ? b : -b) - tgt[k]) / dc);
    }
    if (dir.y > 1e-4) d = Math.min(d, (BOUND.y - tgt.y) / dir.y);
    d = Math.max(d, 1.2);
    // gentle life: idle breathing + pointer parallax
    if (!reduced) {
      mouse.sx = lerp(mouse.sx, isTouch ? 0 : mouse.x, 0.05); mouse.sy = lerp(mouse.sy, isTouch ? 0 : mouse.y, 0.05);
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      tgt.addScaledVector(right, mouse.sx * 0.18 * (w / 6)).add({ x: 0, y: mouse.sy * 0.1 * (h / 5) + Math.sin(time * 0.6) * 0.03, z: 0 });
    }
    camPos.copy(tgt).addScaledVector(dir, d);
    camera.position.copy(camPos);
    camera.lookAt(tgt);
    camera.setViewOffset(vw, vh, (0.5 - cx) * vw, (0.5 - cy) * vh, vw, vh);
  }

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let last = 0, lastAnim = 0, lastVid = 0, slowFrames = 0, renderP = 0;
  function frame() {
    requestAnimationFrame(frame);
    const now = clock.getElapsedTime(), dt = Math.min(0.1, now - last); last = now;
    lenis.raf(now * 1000);
    if (document.body.classList.contains('mode-doc')) return;

    renderP = reduced ? p : lerp(renderP, p, 1 - Math.pow(0.0001, dt));
    if (Math.abs(renderP - p) < 1e-4) renderP = p;
    const near = Math.round(renderP);
    setActive(started && Math.abs(renderP - near) < 0.32 ? near : -1);
    placeCamera(renderP, now);

    // portrait
    if (started && assembleT < 1) assembleT = Math.min(1, assembleT + dt / 2.4);
    const u = portrait.uniforms;
    u.uTime.value = now;
    u.uAssemble.value = assembleT;
    u.uRelief.value = smooth(0.15, 0.85, renderP);
    u.uScatter.value = smooth(1.25, 1.95, renderP);
    portrait.group.rotation.y = -0.22 * u.uRelief.value * (1 - u.uScatter.value) + (reduced ? 0 : Math.sin(now * 0.4) * 0.03);

    // hover
    if (pointerDirty && started && !isTouch) {
      pointerDirty = false;
      const h = pick();
      if (h !== hovered) {
        hovered = h;
        document.body.classList.toggle('is-hovering', !!h);
        tip.classList.toggle('on', !!h);
        if (h) tip.textContent = h.userData.info.label;
      }
    }
    for (const r of world.hoverables) {
      const on = r === hovered || r === listHover ? 1 : 0;
      r.userData.hover = lerp(r.userData.hover, on, 1 - Math.pow(0.001, dt));
      const hv = r.userData.hover;
      if (r.userData.info.pop) { r.position.z = r.userData.base.z + hv * 0.2; }
      else r.scale.setScalar(r.userData.baseScale * (1 + hv * 0.035));
    }

    // animated canvas screens ~15fps
    if (now - lastAnim > 1 / 15) {
      lastAnim = now;
      world.animated.forEach((t) => t.userData.draw(now));
      if (modalCanvasEl && !modal.hidden) modalCanvasEl.getContext('2d').drawImage(modalCanvasEl._src, 0, 0);
    }
    // only play videos the camera is near
    if (now - lastVid > 0.3) {
      lastVid = now;
      for (const v of world.videos) {
        const want = started && v.stations.some((s) => Math.abs(renderP - s) < 1.15);
        if (want && v.video.paused) v.video.play().catch(() => {});
        else if (!want && !v.video.paused) v.video.pause();
      }
    }

    composer.render(dt);

    // adaptive quality: if frames stay slow, render fewer pixels, then drop bloom
    if (dt > 1 / 32) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 90 && qualityDrop < 3) { qualityDrop++; slowFrames = 0; if (qualityDrop === 3) bloom.enabled = false; resize(); }
  }
  frame();

  // test hook (used by the QA screenshots, harmless in production)
  window.__arcade = {
    setP: (v) => { p = renderP = v; },
    start: () => { begin(); assembleT = 1; },
    info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, px: [renderer.domElement.width, renderer.domElement.height], qualityDrop }),
  };
}
