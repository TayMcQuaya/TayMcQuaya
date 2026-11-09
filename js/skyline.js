// The hero: every day since the first commit as a block. Taller = more commits.
// Also holds the Snake game that runs on the same blocks.
import * as THREE from 'three';

const BG = 0x210b1b;
const EMPTY = new THREE.Color('#3a1730');
const RAMP = ['#1f6b2c', '#27933a', '#3ad531', '#a4f24a', '#f0ff7a'].map((c) => new THREE.Color(c));
const SNAKE = new THREE.Color('#f2c14e');
const HEAD = new THREE.Color('#fff3b0');
const HOT = new THREE.Color('#ffffff');

const iso = (d) => d.toISOString().slice(0, 10);
const heightOf = (n) => (n ? 0.45 + Math.sqrt(n) * 0.95 : 0.14);
const colorOf = (n) => (!n ? EMPTY : n < 2 ? RAMP[0] : n < 4 ? RAMP[1] : n < 8 ? RAMP[2] : n < 15 ? RAMP[3] : RAMP[4]);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

export function buildDays(activity, today = new Date()) {
  const keys = Object.keys(activity).sort();
  const first = new Date(keys[0] + 'T00:00:00Z');
  first.setUTCDate(first.getUTCDate() - first.getUTCDay());           // back to Sunday
  const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const days = [];
  for (let d = new Date(first), i = 0; d <= end; d.setUTCDate(d.getUTCDate() + 1), i++) {
    const k = iso(d), a = activity[k];
    days.push({ i, date: k, n: a ? a[0] : 0, what: a ? a[1] : '', col: Math.floor(i / 7), row: i % 7 });
  }
  return days;
}

export function createSkyline(wrap, days, opts = {}) {
  const cols = days[days.length - 1].col + 1;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(BG, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A row of blocks, one per day since July 2024. Taller blocks are days with more commits.');
  wrap.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 40, 150);
  const cam = new THREE.PerspectiveCamera(30, 2, 0.5, 400);
  scene.add(new THREE.HemisphereLight(0xfff0e0, 0x4a1a3a, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(8, 14, -10);
  scene.add(sun);

  const geo = new THREE.BoxGeometry(0.84, 1, 0.84);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), days.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  // per-block state
  const H = new Float32Array(days.length);      // target height
  const C = days.map((d) => colorOf(d.n).clone());
  const eaten = new Uint8Array(days.length);
  days.forEach((d, i) => { H[i] = heightOf(d.n); });
  const m4 = new THREE.Matrix4();
  const idx = (col, row) => col * 7 + row;

  let intro = reduced ? 1 : 0;
  let hover = -1;
  let dirty = true;
  let mode = 'idle';
  const view = { x: cols, tx: cols };            // which column the camera sits at
  const pointer = { x: 0, y: 0 };

  function layout() {
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const local = ease(intro * 1.9 - (d.col / cols) * 0.9);
      let h = eaten[i] ? 0.14 : 0.14 + (H[i] - 0.14) * local;
      if (snake && d.col > snake.col) h = Math.min(h, 0.3);          // weeks already passed lie flat, so nothing blocks the view
      if (snake && snakeAt.has(i)) h = 1.25;
      m4.makeScale(1, h, 1);
      m4.setPosition(d.col, 0, d.row);
      mesh.setMatrixAt(i, m4);
      let c = eaten[i] ? EMPTY : C[i];
      if (snake && snakeAt.has(i)) c = i === snake.cells[0] ? HEAD : SNAKE;
      else if (i === hover) c = HOT;
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  let narrow = false;
  // Camera presets, relative to the column the camera sits at (the newest week when idle).
  // pos/look are [along the strip, up, across the strip].
  const VIEW = {
    wide: { fov: 32, pos: [18, 9, -9], look: [-30, 1, 8], shift: [0.2, 0.02] },
    narrow: { fov: 40, pos: [11, 10, -10], look: [-16, 0.5, 7] },
    playWide: { fov: 30, pos: [17, 12, 3], look: [-8, 0, 3] },      // straight down the strip, like a runner
    playNarrow: { fov: 44, pos: [15, 13, 3], look: [-5, 0, 3] },
  };
  function placeCamera() {
    const k = ease(intro * 1.2);
    const x = view.x;
    const v = mode === 'play' ? (narrow ? VIEW.playNarrow : VIEW.playWide) : (narrow ? VIEW.narrow : VIEW.wide);
    const sway = mode === 'play' ? 0 : 1;
    // the intro starts almost straight above (the flat graph everyone knows) and drops to the low view
    const up = (1 - k) * 34, back = (1 - k) * 0.75;
    cam.fov = v.fov;
    cam.position.set(x + v.pos[0] + pointer.x * 1.4 * sway, v.pos[1] + up + pointer.y * 0.7 * sway, v.pos[2] * (1 - back));
    cam.lookAt(x + v.look[0], v.look[1], v.look[2]);
    // slide the picture sideways so the strip sits beside the headline instead of under it
    const w = wrap.clientWidth, h = wrap.clientHeight, sh = v.shift;
    if (sh && w && h) cam.setViewOffset(w, h, -sh[0] * w * k, -sh[1] * h * k, w, h); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    narrow = w < 720;
    renderer.setSize(w, h, false);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    cam.aspect = w / h;
    scene.fog.near = narrow ? 26 : 52; scene.fog.far = narrow ? 70 : 170;
    dirty = true;
  }
  new ResizeObserver(resize).observe(wrap);
  resize();

  // ---------- labels (project names over their busiest day) ----------
  const v3 = new THREE.Vector3();
  function project(i, lift = 0.4) {
    const d = days[i];
    v3.set(d.col, (eaten[i] ? 0.14 : H[i]) + lift, d.row).project(cam);
    return { x: (v3.x * 0.5 + 0.5) * wrap.clientWidth, y: (-v3.y * 0.5 + 0.5) * wrap.clientHeight, z: v3.z };
  }

  // ---------- hover ----------
  const ray = new THREE.Raycaster(), p2 = new THREE.Vector2();
  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    p2.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    pointer.x += ((p2.x) - pointer.x) * 0.5; pointer.y += ((p2.y) - pointer.y) * 0.5;
    ray.setFromCamera(p2, cam);
    const hit = ray.intersectObject(mesh)[0];
    const id = hit ? hit.instanceId : -1;
    if (id !== hover) {
      hover = id; dirty = true;
      opts.onHover && opts.onHover(id < 0 ? null : days[id], id < 0 ? null : project(id, 0.6));
    }
    dirty = true;
  }
  canvas.addEventListener('pointermove', (e) => { if (mode === 'idle' && e.pointerType !== 'touch') pick(e); });
  canvas.addEventListener('pointerleave', () => { hover = -1; pointer.x = 0; pointer.y = 0; dirty = true; opts.onHover && opts.onHover(null); });
  canvas.addEventListener('click', (e) => { if (mode === 'idle') pick(e); });

  // ---------- the game: run back through time and eat the green days ----------
  // The runner moves one week per step, always toward 2024. Left and right change the weekday lane.
  let snake = null;
  const snakeAt = new Set();
  const total = days.reduce((a, d) => a + d.n, 0);
  let stepAcc = 0;
  function enter(col, row) {
    const s = snake, i = idx(col, row);
    s.col = col; s.row = row;
    if (i >= days.length) return;
    s.cells.unshift(i);
    while (s.cells.length > 9) s.cells.pop();
    snakeAt.clear(); s.cells.forEach((c) => snakeAt.add(c));
    if (days[i].n && !eaten[i]) { eaten[i] = 1; s.score += days[i].n; s.days++; }
    view.tx = col;
    opts.onGame && opts.onGame({ state: 'play', score: s.score, total, date: days[i].date });
  }
  function play() {
    eaten.fill(0);
    snake = { cells: [], col: cols - 2, row: 3, score: 0, days: 0, over: false };
    mode = 'play'; hover = -1; stepAcc = 0;
    canvas.style.touchAction = 'none';
    enter(snake.col, snake.row);
    dirty = true;
  }
  function stop() {
    snake = null; snakeAt.clear(); eaten.fill(0);
    mode = 'idle'; view.tx = cols; canvas.style.touchAction = '';
    opts.onGame && opts.onGame({ state: 'idle' });
    dirty = true;
  }
  function turn(d) {
    if (!snake || snake.over) return;
    const row = clamp(snake.row + d, 0, 6);
    if (row !== snake.row) enter(snake.col, row);
  }
  function step() {
    const s = snake;
    if (s.col - 1 < 0) {
      s.over = true;
      opts.onGame && opts.onGame({ state: 'over', score: s.score, total, days: s.days, date: days[0].date });
      return;
    }
    enter(s.col - 1, s.row);
  }

  // ---------- loop ----------
  let last = performance.now(), visible = true, raf = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(wrap);
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let moving = false;
    if (intro < 1) { intro = Math.min(1, intro + dt / 2.6); moving = true; }
    if (mode === 'play' && snake && !snake.over) {
      stepAcc += dt;
      const every = 0.13 - 0.05 * (1 - snake.col / cols);          // speeds up on the way back
      while (stepAcc > every && !snake.over) { stepAcc -= every; step(); }
      moving = true;
    }
    const dx = view.tx - view.x;
    if (Math.abs(dx) > 0.01) { view.x += dx * Math.min(1, dt * 5); moving = true; }
    if (moving || dirty) {
      dirty = false;
      layout(); placeCamera();
      renderer.render(scene, cam);
      opts.onFrame && opts.onFrame(project);
    }
    if (visible && (moving || mode === 'play')) kick();
  }
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  const wake = () => { dirty = true; kick(); };
  canvas.addEventListener('pointermove', wake);
  canvas.addEventListener('pointerleave', wake);
  new ResizeObserver(wake).observe(wrap);
  kick();

  return {
    play() { play(); kick(); }, stop() { stop(); kick(); }, turn(d) { turn(d); kick(); },
    get playing() { return mode === 'play'; },
    project, cols, canvas,
    _skipIntro() { intro = 1; wake(); },
    _view(name, cfg) { Object.assign(VIEW[name], cfg); wake(); },
  };
}
