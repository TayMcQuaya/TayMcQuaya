// Walk the Arcade: one persistent three.js world, native scroll as the conductor.
// Without WebGL (or a failed CDN) the page stays in Quick view, which is plain HTML.
import * as THREE from 'three';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(pointer: coarse)').matches;
const body = document.body;
const DISPLAY = '"Press Start 2P", monospace', UI = 'Silkscreen, monospace';

// ======================================================
// Shared (both modes): viewer, nav
// ======================================================
const sections = $$('.chapter');
const artBtns = $$('.art-btn').sort((a, b) => Number(a.dataset.art) - Number(b.dataset.art));
const viewer = $('#viewer');
let artIdx = 0, lastFocus = null;
function showArt(i) {
  artIdx = (i + artBtns.length) % artBtns.length;
  const b = artBtns[artIdx];
  $('#viewer-img').src = b.dataset.orig; $('#viewer-img').alt = $('img', b).alt;
  $('#viewer-count').textContent = `${artIdx + 1} / ${artBtns.length}`;
}
function openArt(i) { lastFocus = document.activeElement; showArt(i); viewer.hidden = false; $('.viewer-close').focus({ preventScroll: true }); }
function closeArt() { viewer.hidden = true; lastFocus && lastFocus.focus({ preventScroll: true }); }
artBtns.forEach((b, i) => b.addEventListener('click', () => openArt(i)));
$$('[data-v]').forEach((b) => b.addEventListener('click', () => { const d = Number(b.dataset.v); d === 0 ? closeArt() : showArt(artIdx + d); }));
viewer.addEventListener('click', (e) => { if (e.target === viewer) closeArt(); });
addEventListener('keydown', (e) => {
  if (viewer.hidden) return;
  if (e.key === 'Escape') closeArt();
  if (e.key === 'ArrowRight') showArt(artIdx + 1);
  if (e.key === 'ArrowLeft') showArt(artIdx - 1);
});
let goTo = (id) => { const el = document.getElementById(id); el && el.scrollIntoView({ behavior: 'smooth' }); };
$$('[data-go]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goTo(a.dataset.go); }));
sections.forEach((s) => { s.style.setProperty('--w', s.dataset.weight || 1); if (s.dataset.accent) s.style.setProperty('--accent', s.dataset.accent); });

// ======================================================
// 3D
// ======================================================
const diag = document.createElement('div');
diag.id = 'diag'; document.body.appendChild(diag);
const report = (msg) => { console.warn(msg); diag.textContent = msg; diag.classList.add('on'); };
start3D().catch((err) => {
  report('3D view unavailable, showing the plain page. ' + (err && err.message ? err.message : err));
  body.classList.remove('mode-3d');
  ScrollTrigger.getAll().forEach((t) => t.kill());
  $$('.card, .reveal').forEach((el) => { el.style.opacity = ''; el.style.transform = ''; });
  $('#loader').style.display = 'none';
});

// ---------- canvas texture helpers ----------
function canvasTex(w, h, draw, { nearest = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; }
  t.userData.canvas = c; t.userData.ctx = g;
  return t;
}
function fitFont(g, text, font, maxW, start) { let s = start; do { g.font = `${s}px ${font}`; s -= 2; } while (g.measureText(text).width > maxW && s > 8); }
function neonText(text, color, w, h, size, font = DISPLAY) {
  return canvasTex(w, h, (g) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, text, font, w - 80, size);
    g.shadowColor = color; g.shadowBlur = h * 0.25; g.fillStyle = color;
    for (let i = 0; i < 3; i++) g.fillText(text, w / 2, h / 2 + 2);
    g.shadowBlur = 0; g.fillStyle = '#fff6e6'; g.globalAlpha = 0.9; g.fillText(text, w / 2, h / 2 + 2);
  });
}
function marqueeTex(title, accent) {
  return canvasTex(768, 280, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#0e0806'); grd.addColorStop(0.5, accent); grd.addColorStop(1, '#0e0806');
    g.fillStyle = grd; g.globalAlpha = 0.55; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,.08)'; for (let x = -200; x < w + 200; x += 54) { g.save(); g.translate(x, 0); g.transform(1, 0, -0.55, 1, 0, 0); g.fillRect(0, 0, 16, h); g.restore(); }
    g.textAlign = 'center'; g.textBaseline = 'middle'; fitFont(g, title, DISPLAY, w - 90, 74);
    g.fillStyle = '#000'; g.fillText(title, w / 2 + 5, h / 2 + 5);
    g.shadowColor = '#ffe6b0'; g.shadowBlur = 26; g.fillStyle = '#fff1d6'; g.fillText(title, w / 2, h / 2);
    g.shadowBlur = 0; g.strokeStyle = 'rgba(255,230,180,.7)'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
  });
}
function cartridgeTex(emoji, name, accent) {
  return canvasTex(256, 300, (g, w, h) => {
    g.fillStyle = accent; g.fillRect(0, 0, w, h);
    g.fillStyle = '#17110f'; g.fillRect(16, 16, w - 32, 190);
    g.font = '110px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, w / 2, 112);
    g.fillStyle = '#17110f'; fitFont(g, name.toUpperCase(), UI, w - 24, 40); g.fillText(name.toUpperCase(), w / 2, 252);
  });
}
function scoreBoardTex(rows) {
  return canvasTex(1024, 720, (g, w, h) => {
    g.fillStyle = '#0d0806'; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `48px ${DISPLAY}`; g.fillStyle = '#fbbf24';
    g.shadowColor = '#fbbf24'; g.shadowBlur = 18; g.fillText('HIGH SCORES', w / 2, 80); g.shadowBlur = 0;
    g.font = `22px ${DISPLAY}`; g.fillStyle = '#f59e0b'; g.textAlign = 'left';
    g.fillText('RANK', 70, 170); g.fillText('NAME', 240, 170); g.fillText('SCORE', 600, 170);
    g.fillStyle = 'rgba(245,158,11,.5)'; g.fillRect(60, 196, w - 120, 3);
    rows.forEach((r, i) => {
      const y = 260 + i * 92; g.font = `26px ${DISPLAY}`;
      g.fillStyle = ['#fbbf24', '#e5e7eb', '#cd7f32', '#fde8c8'][i] || '#fde8c8'; g.fillText(r[0], 70, y);
      g.fillStyle = '#fde8c8'; g.fillText(r[1], 240, y);
      g.font = `20px ${UI}`; g.fillStyle = '#b39a7a'; g.fillText(r[2], 600, y);
    });
    g.font = `20px ${DISPLAY}`; g.fillStyle = '#84cc16'; g.textAlign = 'center'; g.fillText('● OPEN FOR HIRE ●', w / 2, 660);
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2);
  });
}

async function start3D() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: false, powerPreference: 'high-performance' }); }
  catch (e) { throw new Error('WebGL not available'); }
  body.classList.add('mode-3d');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // lighting is baked and graded in Blender
  const DPR = Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 1.75);
  renderer.setPixelRatio(DPR);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0607');
  scene.fog = new THREE.Fog('#0a0607', 9, 26);
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 60);

  const gl = renderer.getContext();
  const gpu = (() => { try { const x = gl.getExtension('WEBGL_debug_renderer_info'); return x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'unknown GPU'; } catch (e) { return 'unknown GPU'; } })();
  const rt = new THREE.WebGLRenderTarget(1, 1, { samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(DPR);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.7, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.04 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `precision mediump float; uniform sampler2D tDiffuse; uniform float uTime, uGrain; varying vec2 vUv;
      float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        float v = smoothstep(1.2, .3, length(vUv - .5) * 1.3);
        c.rgb *= mix(.5, 1., v);
        c.rgb += (rnd(vUv * 1100.) - .5) * uGrain;
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
  const avatar = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/tex/avatar512.jpg'; });
  let gltf;
  try { gltf = await new GLTFLoader(manager).loadAsync('assets/arcade3.glb'); }
  catch (e) {
    // some hosts refuse .glb; the preview ships the same model as a JS module
    const mod = await import('../assets/arcade3.glb.js');
    const bin = Uint8Array.from(atob(mod.default), (c) => c.charCodeAt(0));
    gltf = await new GLTFLoader().parseAsync(bin.buffer, 'assets/');
  }
  scene.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);

  const texLoader = new THREE.TextureLoader(manager);
  const loadTex = (url, cb, nearest = true) => texLoader.load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8;
    if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; }
    cb(t);
  });
  const basic = (o) => new THREE.MeshBasicMaterial({ toneMapped: false, ...o });
  const mirrored = (t) => { t.repeat.x = -1; t.offset.x = 1; return t; };
  const HDR = (v) => new THREE.Color(v, v, v);

  // ---------- content from the DOM ----------
  const projectSections = sections.filter((s) => s.classList.contains('project'));
  const artSections = sections.filter((s) => s.classList.contains('art'));
  const skillsIdx = sections.findIndex((s) => s.id === 'skills');
  const aboutIdx = sections.findIndex((s) => s.id === 'about');
  const skillEls = $$('#skills .inventory li');
  const contactRows = $$('#contact .scores tbody tr').map((tr) => [...tr.children].map((td) => td.textContent.trim()));

  // ---------- materials for every mesh ----------
  const screens = {}, marquees = {}, artPlanes = [], lamps = [], cartLabels = [], floorMesh = { m: null };
  const accentFor = (i) => projectSections[i]?.dataset.accent || '#f59e0b';
  let heroScreen = null, soonScreen = null;
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.name;
    if (n.includes('_baked')) {
      o.material = basic({ map: o.material.map, color: HDR(1.12) });
      if (n.startsWith('floor')) floorMesh.m = o;
    } else if (n.endsWith('screen') && n.startsWith('proj')) {
      const i = Number(n.match(/proj(\d+)/)[1]);
      o.material = basic({ color: HDR(1.0) }); screens[i] = o;
      if (projectSections[i]?.dataset.soon) soonScreen = o;
    } else if (n === 'hero_screen') { heroScreen = o; o.material = basic({ color: HDR(1.1) }); }
    else if (n.endsWith('marquee')) {
      const m = n.match(/proj(\d+)/);
      const title = m ? (projectSections[Number(m[1])]?.dataset.marquee || '???') : 'TAYMCQUAYA';
      const accent = m ? accentFor(Number(m[1])) : '#f59e0b';
      o.material = basic({ map: marqueeTex(title, accent), color: HDR(1.35) }); marquees[n] = o;
    } else if (n.includes('coinslot')) { o.material = basic({ color: new THREE.Color('#ff3b30').multiplyScalar(2.4) }); }
    else if (/^art\d+$/.test(n)) {
      const i = Number(n.slice(3));
      o.material = basic({ color: HDR(0.55), side: THREE.DoubleSide }); artPlanes[i] = o;
      const btn = artBtns[i];
      if (btn) loadTex(btn.dataset.tex, (t) => {
        o.material.map = t; o.material.needsUpdate = true;
        const w = t.image.width, h = t.image.height, BW = 1.0, BH = 0.9;
        const s = Math.min(BW / w, BH / h); o.scale.set(w * s, 1, h * s); // plane lies in local X/Z after export
      });
    } else if (/^lamp\d+$/.test(n)) { o.material = basic({ color: new THREE.Color('#ffe2a8').multiplyScalar(0.35) }); lamps[Number(n.slice(4))] = o; }
    else if (/^cart\d+_label$/.test(n)) {
      const i = Number(n.match(/cart(\d+)/)[1]); const el = skillEls[i];
      const pal = ['#f59e0b', '#ef4444', '#2dd4bf', '#a855f7', '#84cc16', '#fbbf24', '#ff4fa3', '#f97316'];
      o.material = basic({ map: mirrored(cartridgeTex(el?.dataset.emoji || '?', el?.textContent.trim() || '', pal[i % pal.length])), color: HDR(0.35), side: THREE.DoubleSide });
      o.position.z = 8.112; cartLabels[i] = o;
    } else if (n === 'exit_sign') { o.material = basic({ map: mirrored(neonText('EXIT', '#ff3b30', 512, 160, 92)), transparent: true, color: HDR(1.6), side: THREE.DoubleSide }); }
    else if (n === 'board_screen') { o.material = basic({ map: mirrored(scoreBoardTex(contactRows)), color: HDR(1.0), side: THREE.DoubleSide }); }
    else if (n === 'neon_title') { o.material = basic({ map: mirrored(neonText('TAYMCQUAYA', '#f59e0b', 2048, 320, 190)), transparent: true, color: HDR(1.7), side: THREE.DoubleSide }); o.position.y = 3.18; o.scale.multiplyScalar(0.5); }
    else if (n === 'neon_sub') { o.material = basic({ map: mirrored(neonText('~ THE ARCADE ~', '#ff4fa3', 1024, 160, 70)), transparent: true, color: HDR(1.5), side: THREE.DoubleSide }); o.position.y = 2.6; o.scale.multiplyScalar(0.8); }
    else if (n.startsWith('wall_') || n.startsWith('door_')) { /* baked */ }
  });

  // hero screen: animated attract
  const heroTex = canvasTex(640, 480, () => {});
  const drawHero = (t) => {
    const g = heroTex.userData.ctx, w = 640, h = 480;
    g.fillStyle = '#0f0906'; g.fillRect(0, 0, w, h);
    const rg = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 420); rg.addColorStop(0, 'rgba(60,32,16,.9)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h);
    g.imageSmoothingEnabled = false; g.drawImage(avatar, 48, 90, 240, 240);
    g.strokeStyle = '#f59e0b'; g.lineWidth = 6; g.strokeRect(48, 90, 240, 240);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = `27px ${DISPLAY}`; g.fillStyle = '#7f1d1d'; g.fillText('TAYMCQUAYA', 320, 157); g.fillStyle = '#fbbf24'; g.fillText('TAYMCQUAYA', 317, 154);
    g.font = `17px ${UI}`; g.fillStyle = '#f59e0b'; g.fillText('DEVELOPER', 320, 205); g.fillText('PIXEL ARTIST', 320, 232); g.fillText('CREATOR', 320, 259);
    g.font = `18px ${DISPLAY}`; g.fillStyle = '#fde8c8'; g.fillText('LVL ??', 320, 300);
    if (Math.floor(t * 1.6) % 2 === 0) { g.font = `22px ${DISPLAY}`; g.fillStyle = '#fbbf24'; g.textAlign = 'center'; g.fillText('INSERT COIN', w / 2, 410); }
    g.fillStyle = 'rgba(0,0,0,.22)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    heroTex.needsUpdate = true;
  };
  drawHero(0); if (heroScreen) heroScreen.material.map = heroTex;

  // coming-soon screen: static
  const soonTex = canvasTex(160, 120, () => {}, { nearest: true });
  const soonImg = soonTex.userData.ctx.createImageData(160, 120);
  const drawSoon = (t) => {
    const g = soonTex.userData.ctx, d = soonImg.data;
    for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 110) | 0; d[i] = v + 30; d[i + 1] = v + 18; d[i + 2] = v; d[i + 3] = 255; }
    g.putImageData(soonImg, 0, 0);
    g.fillStyle = 'rgba(26,15,10,.85)'; g.fillRect(10, 40, 140, 42);
    g.font = `9px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = Math.floor(t * 2) % 2 ? '#fbbf24' : '#f59e0b';
    g.fillText('UNDER', 80, 53); g.fillText('CONSTRUCTION', 80, 70);
    soonTex.needsUpdate = true;
  };
  drawSoon(0); if (soonScreen) soonScreen.material.map = soonTex;

  // project screens: poster now, video when the camera is near
  const videos = [];
  projectSections.forEach((sec, i) => {
    const mesh = screens[i]; if (!mesh || sec.dataset.soon) return;
    if (sec.dataset.poster) loadTex(sec.dataset.poster, (t) => { if (!mesh.userData.live) { mesh.material.map = t; mesh.material.needsUpdate = true; } }, false);
    if (!sec.dataset.video) return;
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.src = sec.dataset.video;
    v.addEventListener('playing', () => {
      if (mesh.userData.live) return;
      const vt = new THREE.VideoTexture(v); vt.colorSpace = THREE.SRGBColorSpace; vt.flipY = false; vt.generateMipmaps = false;
      mesh.material.map = vt; mesh.userData.live = true; mesh.material.needsUpdate = true;
    }, { once: true });
    videos.push({ v, chapter: sections.indexOf(sec) });
  });

  // floor reflection (desktop only)
  let reflector = null;
  if (!isTouch && floorMesh.m) {
    try {
      const geo = new THREE.PlaneGeometry(18, 14.8);
      reflector = new Reflector(geo, { clipBias: 0.004, textureWidth: Math.round(innerWidth * 0.5), textureHeight: Math.round(innerHeight * 0.5), color: 0x5a5a5a });
      reflector.rotation.x = -Math.PI / 2; reflector.position.set(0, 0.006, -1.2);
      const m = reflector.material;
      m.fragmentShader = m.fragmentShader
        .replace('uniform vec3 color;', 'uniform vec3 color; uniform float uAlpha;')
        .replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', 'gl_FragColor = vec4( base.rgb * color * 1.6, uAlpha );');
      m.uniforms.uAlpha = { value: 0.22 }; m.transparent = true; m.depthWrite = false; m.needsUpdate = true;
      reflector.renderOrder = 1; reflector.visible = false;
      scene.add(reflector);
    } catch (e) { console.warn('reflection off', e); reflector = null; }
  }

  // light beams + dust over the hero and the row
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying float vEdge; void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vEdge = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision mediump float; varying vec2 vUv; varying float vEdge; void main(){ float a = pow(vUv.y, 1.5) * pow(vEdge, 2.4) * .09; gl_FragColor = vec4(1., .8, .52, a); }`,
  });
  const beamGeo = new THREE.CylinderGeometry(0.1, 1.0, 4.4, 40, 1, true);
  [[0, -0.1], [-4.5, -5.6], [-1.5, -5.6], [1.5, -5.6], [4.5, -5.6]].forEach(([x, z]) => { const b = new THREE.Mesh(beamGeo, beamMat); b.position.set(x, 2.6, z); scene.add(b); });
  const dustN = 420, dustPos = new Float32Array(dustN * 3), dustSeed = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) { dustPos.set([(Math.random() - 0.5) * 16, 0.2 + Math.random() * 4.2, -6 + Math.random() * 14], i * 3); dustSeed[i] = Math.random() * 100; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustTex = canvasTex(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,230,190,1)'); r.addColorStop(1, 'rgba(255,230,190,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); });
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.02, map: dustTex, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);
  const dustBase = dustPos.slice();
  const driftDust = (t) => {
    for (let i = 0; i < dustN; i++) {
      const s = dustSeed[i];
      dustPos[i * 3] = dustBase[i * 3] + Math.sin(t * 0.12 + s) * 0.1;
      dustPos[i * 3 + 1] = 0.2 + ((dustBase[i * 3 + 1] - 0.2 + t * 0.03 * (0.5 + (s % 1))) % 4.2);
      dustPos[i * 3 + 2] = dustBase[i * 3 + 2] + Math.cos(t * 0.1 + s) * 0.1;
    }
    dustGeo.attributes.position.needsUpdate = true;
  };

  // ---------- chapter ledger: camera per section (three.js coords; Blender y -> -z) ----------
  const ROW_Z = -5.75, ROW_X = [-4.5, -3, -1.5, 0, 1.5, 3, 4.5];
  const ART_Z = [3.75, 0.75, -2.25];
  const CAM = {
    hero: { pos: [-1.75, 1.35, 3.55], tgt: [0.1, 1.1, -0.2], fov: 32, cx: 0.64 },
    about: { pos: [-0.78, 1.5, 1.7], tgt: [0, 1.52, -0.2], fov: 30, cx: 0.36 },
    skills: { pos: [4.3, 1.9, 3.25], tgt: [4.4, 1.85, 8.2], fov: 40, cx: 0.62 },
    contact: { pos: [-1.5, 1.7, 3.5], tgt: [-1.55, 1.9, 8.5], fov: 44, cx: 0.33 },
  };
  projectSections.forEach((s, i) => { CAM[s.id] = { pos: [ROW_X[i] - 0.22, 1.42, -3.3], tgt: [ROW_X[i], 1.3, ROW_Z], fov: 34, cx: 0.36 }; });
  artSections.forEach((s, i) => { CAM[s.id] = { pos: [4.7, 1.65, ART_Z[i]], tgt: [9, 1.65, ART_Z[i]], fov: 36, cx: 0.64 }; });
  const N = sections.length;
  let vw = innerWidth, vh = innerHeight, narrow = vw <= 760 || vw / vh < 0.9;
  let posCurve, tgtCurve, fovs = [], cxs = [], cys = [];
  function buildCurves() {
    const P = [], T = []; fovs = []; cxs = []; cys = [];
    sections.forEach((s) => {
      const c = CAM[s.id]; const p = new THREE.Vector3(...c.pos), t = new THREE.Vector3(...c.tgt);
      if (narrow) { p.sub(t).multiplyScalar(1.38).add(t); p.y += 0.25; }
      P.push(p); T.push(t); fovs.push(c.fov + (narrow ? 7 : 0)); cxs.push(narrow ? 0.5 : c.cx); cys.push(narrow ? 0.34 : 0.5);
    });
    posCurve = new THREE.CatmullRomCurve3(P, false, 'centripetal', 0.5);
    tgtCurve = new THREE.CatmullRomCurve3(T, false, 'centripetal', 0.5);
  }

  // ---------- conductor: native scroll -> exact / smooth chapter progress ----------
  const lenis = new Lenis({ lerp: reduced ? 1 : 0.1, wheelMultiplier: 0.9, prevent: (node) => !!(node.closest && node.closest('.card, #viewer')) });
  lenis.on('scroll', ScrollTrigger.update);
  lenis.stop(); // in 3D mode the page only moves by stops; Quick view starts it again
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  let anchors = [], beats = [];
  function measure() {
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    anchors = sections.map((s, i) => {
      if (i === 0) return 0; if (i === N - 1) return max;
      return clamp(s.offsetTop + (s.offsetHeight - vh) / 2, 0, max);
    });
    for (let i = 1; i < N; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
    beats = [];
    sections.forEach((s, i) => {
      const B = Number(s.dataset.beats || 1), R = Math.max(0, s.offsetHeight - vh);
      if (i === 0 || i === N - 1 || B === 1) beats.push(anchors[i]);
      else for (let k = 0; k < B; k++) beats.push(clamp(s.offsetTop + R * (k + 0.5) / B, 0, max));
    });
  }
  const exactFrom = (y) => {
    if (y <= anchors[0]) return 0;
    for (let i = 0; i < N - 1; i++) if (y < anchors[i + 1]) return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
    return N - 1;
  };
  let scrollY = 0, exact = 0, smooth = 0, settleT = 0;
  let beat = 0, gliding = false, glideT = 0;
  const MAX_STEPS = 3, STEP_PX = 110;
  const nearestBeat = (y) => { let b = 0, d = Infinity; beats.forEach((v, k) => { const dd = Math.abs(y - v); if (dd < d) { d = dd; b = k; } }); return b; };
  function glideTo(k, immediate = false) {
    k = clamp(k, 0, beats.length - 1);
    const dist = Math.max(1, Math.abs(k - nearestBeat(scrollY)));
    beat = k;
    const duration = immediate || reduced ? 0 : Math.min(2.0, 1.1 + 0.25 * (dist - 1));
    clearTimeout(glideT); gliding = true;
    // a new target mid-glide retargets the running animation from where it is
    lenis.scrollTo(beats[k], { force: true, immediate: immediate || reduced, duration, easing: (t) => 1 - Math.pow(1 - t, 3) });
    glideT = setTimeout(() => { gliding = false; }, duration * 1000 + 120);
  }
  const step = (dir) => { if (!body.classList.contains('mode-3d') || !viewer.hidden) return; glideTo(beat + dir); };
  goTo = (id) => {
    const i = sections.findIndex((x) => x.id === id); if (i < 0) return;
    if (!body.classList.contains('mode-3d')) { lenis.scrollTo(sections[i], { duration: 1.2 }); return; }
    glideTo(nearestBeat(anchors[i] - (sections[i].dataset.beats ? (sections[i].offsetHeight - vh) / 2 : 0)));
  };
  // wheel: a gesture is a run of events in the same direction; the first 18px is one stop,
  // every further STEP_PX adds one, up to MAX_STEPS per gesture. Mouse notches chain the same way.
  let lastWheel = -1e9, gestureAcc = 0, gestureSteps = 0;
  const inScrollableCard = (t) => { const c = t && t.closest && t.closest('.card'); return !!(c && c.scrollHeight > c.clientHeight + 4); };
  addEventListener('wheel', (e) => {
    if (!body.classList.contains('mode-3d') || !viewer.hidden) return;
    if (inScrollableCard(e.target)) return;
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * vh : e.deltaY;
    const now = performance.now();
    if (now - lastWheel > 160 || Math.sign(dy) !== Math.sign(gestureAcc)) { gestureAcc = 0; gestureSteps = 0; }
    lastWheel = now; gestureAcc += dy;
    const a = Math.abs(gestureAcc);
    const want = a > 18 ? Math.min(MAX_STEPS, 1 + Math.floor((a - 18) / STEP_PX)) : 0;
    while (gestureSteps < want) { gestureSteps++; step(gestureAcc > 0 ? 1 : -1); }
  }, { passive: false });
  // touch: swipe length decides how many stops (1–3)
  let touchY = null, touchInCard = false;
  addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; touchInCard = inScrollableCard(e.target); }, { passive: true });
  addEventListener('touchmove', (e) => { if (body.classList.contains('mode-3d') && viewer.hidden && !touchInCard) e.preventDefault(); }, { passive: false });
  addEventListener('touchend', (e) => {
    if (touchY === null || touchInCard || !body.classList.contains('mode-3d')) { touchY = null; return; }
    const dy = touchY - e.changedTouches[0].clientY; touchY = null;
    if (Math.abs(dy) > 36) glideTo(beat + Math.sign(dy) * Math.min(MAX_STEPS, 1 + Math.floor((Math.abs(dy) - 36) / 180)));
  });
  // keys
  addEventListener('keydown', (e) => {
    if (!body.classList.contains('mode-3d') || !viewer.hidden || e.target.closest('input, textarea')) return;
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); step(1); }
    else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1); }
    else if (e.key === 'Home') { e.preventDefault(); glideTo(0); }
    else if (e.key === 'End') { e.preventDefault(); glideTo(beats.length - 1); }
  });
  lenis.on('scroll', ({ scroll }) => {
    scrollY = scroll; exact = exactFrom(scroll);
    $('#hud-hint').classList.add('gone');
    // scrollbar drags or browser jumps: snap to the nearest stop once they end
    clearTimeout(settleT);
    settleT = setTimeout(() => {
      if (gliding || !body.classList.contains('mode-3d') || !viewer.hidden) return;
      const k = nearestBeat(scroll); beat = k;
      if (Math.abs(scroll - beats[k]) > 4) glideTo(k);
    }, 180);
  });

  // ---------- DOM choreography (GSAP ScrollTrigger) ----------
  const hudLabel = $('#hud-label'), hudFill = $('#hud-fill');
  const navLinks = $$('#topbar nav a');
  const groupOf = (s) => s.classList.contains('project') ? 'p-floppytromp' : s.classList.contains('art') ? 'art-1' : s.id;
  sections.forEach((sec, i) => {
    const card = $('.card', sec);
    $$('.eyebrow, h1, h2, .type, .card > p, .tags, .actions, .stats, .thumbs, .inventory, .scores, .lore, .sheet-meta', card).forEach((el) => el.classList.add('reveal'));
    const parts = $$('.reveal', card);
    if (i === 0) {
      gsap.set(card, { opacity: 1, y: 0 });
      gsap.fromTo(parts, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.09, ease: 'power2.out', delay: 0.4 });
    } else {
      const tlIn = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 72%', end: 'top 22%', scrub: 0.5 } });
      tlIn.to(card, { opacity: 1, y: 0, ease: 'none', duration: 1 }, 0)
        .to(parts, { opacity: 1, y: 0, ease: 'none', duration: 0.8, stagger: 0.06 }, 0.15);
    }
    if (i < N - 1) gsap.fromTo(card, { opacity: 1, y: 0 }, { opacity: 0, y: -22, ease: 'none', immediateRender: false, scrollTrigger: { trigger: sec, start: 'bottom 82%', end: 'bottom 42%', scrub: 0.5 } });
    ScrollTrigger.create({
      trigger: sec, start: 'top 50%', end: 'bottom 50%',
      onToggle: (self) => { if (self.isActive) { hudLabel.textContent = sec.dataset.label; navLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.go === groupOf(sec))); try { history.replaceState(null, '', `#${sec.id}`); } catch (e) { /* sandboxed */ } } },
    });
  });
  // lore pages advance with scroll
  const lorePages = $$('.lore-page'), loreDots = $$('.lore-dots i');
  ScrollTrigger.create({
    trigger: '#about', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => { const p = Math.min(2, Math.floor(self.progress * 3)); lorePages.forEach((pg, k) => pg.classList.toggle('is-on', k === p)); loreDots.forEach((d, k) => d.classList.toggle('on', k === p)); },
  });
  // stats count up once
  $$('[data-count]').forEach((dd) => {
    const n = Number(dd.dataset.count); const o = { v: 0 };
    ScrollTrigger.create({ trigger: '#about', start: 'top 60%', once: true, onEnter: () => gsap.to(o, { v: n, duration: 1.4, ease: 'power2.out', onUpdate: () => { dd.textContent = Math.round(o.v); } }) });
  });

  // ---------- picking: art frames open the viewer ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, px: 0, py: 0 };
  let hovered = -1, pointerDirty = false, downAt = null;
  addEventListener('pointermove', (e) => { mouse.x = (e.clientX / vw) * 2 - 1; mouse.y = -(e.clientY / vh) * 2 + 1; pointerDirty = true; });
  const overUI = (e) => e.target.closest('.card, #topbar, #viewer, #hud');
  addEventListener('pointerdown', (e) => { downAt = overUI(e) ? null : { x: e.clientX, y: e.clientY }; });
  addEventListener('pointerup', (e) => {
    if (!downAt || !viewer.hidden) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y); downAt = null; if (moved > 8) return;
    mouse.x = (e.clientX / vw) * 2 - 1; mouse.y = -(e.clientY / vh) * 2 + 1;
    const i = pickArt(); if (i >= 0) openArt(i);
  });
  function pickArt() {
    ndc.set(mouse.x, mouse.y); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(artPlanes.filter(Boolean), false);
    return hits.length ? artPlanes.indexOf(hits[0].object) : -1;
  }

  // ---------- sizing ----------
  function resize() {
    vw = innerWidth; vh = innerHeight; narrow = vw <= 760 || vw / vh < 0.9;
    renderer.setSize(vw, vh, false); composer.setSize(vw, vh); bloom.setSize(vw / 2, vh / 2);
    if (reflector) reflector.getRenderTarget().setSize(Math.round(vw * DPR * 0.5), Math.round(vh * DPR * 0.5));
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    buildCurves(); measure();
  }
  resize();
  addEventListener('resize', () => { resize(); ScrollTrigger.refresh(); });
  ScrollTrigger.addEventListener('refresh', measure);

  // ---------- Quick view ----------
  const qt = $('#quick-toggle');
  qt.addEventListener('click', () => {
    const toDoc = body.classList.contains('mode-3d');
    body.classList.toggle('mode-3d', !toDoc); body.classList.toggle('mode-doc', toDoc);
    qt.setAttribute('aria-pressed', String(toDoc)); qt.textContent = toDoc ? '3D view' : 'Quick view';
    if (toDoc) { lenis.start(); ScrollTrigger.getAll().forEach((t) => t.disable(false)); $$('.card, .reveal').forEach((el) => { el.style.opacity = ''; el.style.transform = ''; }); videos.forEach((x) => x.v.pause()); }
    else { lenis.stop(); ScrollTrigger.getAll().forEach((t) => t.enable()); }
    requestAnimationFrame(() => { lenis.resize(); ScrollTrigger.refresh(); measure(); lenis.scrollTo(0, { immediate: true, force: true }); exact = smooth = 0; beat = 0; });
  });

  // ---------- camera ----------
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), right = new THREE.Vector3(), fwd = new THREE.Vector3();
  function placeCamera(p, time) {
    const u = clamp(p / (N - 1), 0, 1);
    posCurve.getPoint(u, camPos); tgtCurve.getPoint(u, camTgt);
    const i = Math.min(Math.floor(p), N - 2), f = p - i;
    camera.fov = lerp(fovs[i], fovs[i + 1], f);
    const cx = lerp(cxs[i], cxs[i + 1], f), cy = lerp(cys[i], cys[i + 1], f);
    if (!reduced) {
      mouse.sx = lerp(mouse.sx, isTouch ? 0 : mouse.x, 0.04); mouse.sy = lerp(mouse.sy, isTouch ? 0 : mouse.y, 0.04);
      fwd.subVectors(camTgt, camPos).normalize(); right.crossVectors(fwd, camera.up).normalize();
      camPos.addScaledVector(right, mouse.sx * 0.12).add({ x: 0, y: mouse.sy * 0.06 + Math.sin(time * 0.5) * 0.012, z: 0 });
    }
    camera.position.copy(camPos); camera.lookAt(camTgt);
    camera.setViewOffset(vw, vh, (0.5 - cx) * vw, (0.5 - cy) * vh, vw, vh);
    camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let last = 0, lastAnim = 0, lastVid = 0, litCount = -1;
  const artZ = (i) => artPlanes[i] ? artPlanes[i].getWorldPosition(new THREE.Vector3()).z : 0;
  const artZs = artPlanes.map((_, i) => artZ(i));
  function frame() {
    requestAnimationFrame(frame);
    const now = clock.getElapsedTime(), dt = Math.min(0.1, now - last); last = now;
    if (!body.classList.contains('mode-3d')) return;
    smooth = reduced ? exact : damp(smooth, exact, 11, dt);
    if (Math.abs(smooth - exact) < 1e-4) smooth = exact;
    hudFill.style.width = `${(exact / (N - 1)) * 100}%`;
    placeCamera(smooth, now);

    // animated screens ~12fps
    if (now - lastAnim > 1 / 12) { lastAnim = now; drawHero(now); if (soonScreen) drawSoon(now); }
    // videos near the camera
    if (now - lastVid > 0.3) {
      lastVid = now;
      for (const x of videos) { const want = Math.abs(smooth - x.chapter) < 1.3; if (want && x.v.paused) x.v.play().catch(() => {}); else if (!want && !x.v.paused) x.v.pause(); }
    }
    // gallery: frames light up as the camera passes
    const camZ = camera.position.z, inArt = smooth > sections.indexOf(artSections[0]) - 0.6 && smooth < sections.indexOf(artSections[2]) + 0.6;
    artPlanes.forEach((m, i) => {
      if (!m) return;
      const k = inArt ? smoothstep(2.6, 0.9, Math.abs(artZs[i] - camZ)) : 0;
      m.material.color.setScalar(lerp(0.5, 1.05, k));
      if (lamps[i]) lamps[i].material.color.set('#ffe2a8').multiplyScalar(lerp(0.3, 2.2, k));
    });
    // inventory: cartridges light one by one
    const sp = clamp((smooth - (skillsIdx - 0.55)) / 0.9, 0, 1);
    const lit = Math.round(sp * cartLabels.length);
    if (lit !== litCount) {
      litCount = lit;
      cartLabels.forEach((m, i) => m && m.material.color.setScalar(i < lit ? 1.0 : 0.35));
      skillEls.forEach((el, i) => el.classList.toggle('lit', i < lit));
    }
    // hover on frames
    if (pointerDirty && !isTouch && viewer.hidden) {
      pointerDirty = false; const h = inArt ? pickArt() : -1;
      if (h !== hovered) { hovered = h; body.style.cursor = h >= 0 ? 'pointer' : ''; artBtns.forEach((b, k) => b.classList.toggle('is-hot', k === h)); }
    }
    if (!reduced) driftDust(now);
    finish.uniforms.uTime.value = now % 10;
    frames++;
    if (reflector && frames === 40 && quality === 2) reflector.visible = true;
    try {
      if (quality > 0) composer.render(dt); else renderer.render(scene, camera);
      const err = gl.getError();
      if (err !== gl.NO_ERROR || gl.isContextLost()) throw new Error('WebGL error ' + err);
    } catch (e) {
      if (quality === 2) { quality = 1; if (reflector) { reflector.visible = false; scene.remove(reflector); reflector = null; } report('Reflection disabled (' + gpu + '): ' + e.message); }
      else if (quality === 1) { quality = 0; report('Effects disabled (' + gpu + '): ' + e.message); }
      else report('Rendering failed (' + gpu + '): ' + e.message);
    }
  }
  let frames = 0, quality = 2;
  if (location.hash === '#debug') report('GPU: ' + gpu + ' · WebGL' + (renderer.capabilities.isWebGL2 ? '2' : '1') + ' · DPR ' + DPR);

  // ---------- reveal ----------
  ScrollTrigger.refresh(); measure();
  $('#loader').classList.add('done'); setTimeout(() => { $('#loader').style.display = 'none'; }, 900);
  const hashId = location.hash.slice(1);
  if (hashId && sections.some((s) => s.id === hashId)) requestAnimationFrame(() => goTo(hashId));
  addEventListener('resize', () => { if (body.classList.contains('mode-3d')) glideTo(beat, true); });
  frame();

  window.__arcade = {
    setP: (v) => { const y = anchors[Math.round(v)] ?? 0; beat = nearestBeat(y); lenis.scrollTo(y, { immediate: true, force: true }); scrollY = y; exact = smooth = exactFrom(y); ScrollTrigger.update(); },
    setBeat: (k) => { glideTo(k, true); exact = smooth = exactFrom(beats[k]); ScrollTrigger.update(); },
    step, beat: () => beat,
    info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, exact, smooth, anchors, beats, reflector: !!reflector, playing: videos.filter((x) => !x.v.paused).length }),
    sync: () => { smooth = exact; },
    artAt: (i) => { const v = artPlanes[i].getWorldPosition(new THREE.Vector3()).project(camera); return [(v.x + 1) / 2 * vw, (1 - v.y) / 2 * vh]; },
  };
}
