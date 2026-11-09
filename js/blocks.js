// One set of cubes for the whole page. Every cube is a day since the first commit.
// As you scroll they re-form: commit skyline -> stacks by kind of work -> a pixel artwork -> "SAY HI".
// Between those they float as confetti behind the content.
import * as THREE from 'three';

const D = 100;                    // camera distance to the plane the page lives on
const FOV = 40;
const TAN = Math.tan((FOV / 2) * Math.PI / 180);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const iso = (d) => d.toISOString().slice(0, 10);

const GREEN = ['#1b6e30', '#239a3b', '#2fc13a', '#5edb48', '#a4ee5c'].map((c) => new THREE.Color(c));
const GROUND = new THREE.Color('#2f9fd0');
const RUNNER = new THREE.Color('#ff3b5c');          // red on green, so the player is easy to find
const RUNNER_HEAD = new THREE.Color('#ffffff');
const WHITE = new THREE.Color('#ffffff');
const heightOf = (n) => (n ? 0.4 + Math.sqrt(n) * 0.72 : 0.14);
// five shades, split where a fifth of the active days fall
const greenOf = (n) => (!n ? GROUND : n < 3 ? GREEN[0] : n < 6 ? GREEN[1] : n < 10 ? GREEN[2] : n < 15 ? GREEN[3] : GREEN[4]);

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

// 5x7 letters for the last formation
const FONT = {
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  ' ': ['000', '000', '000', '000', '000', '000', '000'],
};

export function createBlocks(host, cfg) {
  const { days, stages, cat, cats, sprite } = cfg;
  const N = days.length;
  // The pixel artwork has more pixels than there are days. The cubes it needs on top of the day cubes are only
  // there for that one formation: everywhere else they have no size and cost nothing.
  const M = Math.max(N, cfg.artCubes || 0);
  const cols = days[N - 1].col + 1;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x5fcff2, D * 1.1, D * 3.4);
  const cam = new THREE.PerspectiveCamera(FOV, 1, 1, 600);
  cam.position.set(0, 0, D);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a7f95, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(-50, 90, 70);
  scene.add(sun);

  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), M);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // ---------- per-cube random numbers ----------
  let seed = 20240707;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const R = new Float32Array(M * 6);
  for (let i = 0; i < M * 6; i++) R[i] = rnd();
  const shuffled = [...Array(N).keys()];
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  // loose cubes keep the colour of their day: greens for days with work, white for days off
  const idle = new THREE.Color(cfg.idle || '#fffaf1');
  const loose = days.map((d) => (d.n ? greenOf(d.n) : idle));
  for (let i = N; i < M; i++) loose.push(idle);

  // ---------- formations ----------
  function formation(rotX, rotY, fit) {
    const f = { pos: new Float32Array(M * 3), scl: new Float32Array(M * 3), col: new Float32Array(M * 3), on: new Uint8Array(M), fit,
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, 0, 'XYZ')), ext: { w: 1, h: 1, cx: 0, cy: 0, cz: 0 } };
    f.set = (i, x, y, z, sx, sy, sz, c) => {
      f.pos[i * 3] = x; f.pos[i * 3 + 1] = y; f.pos[i * 3 + 2] = z;
      f.scl[i * 3] = sx; f.scl[i * 3 + 1] = sy; f.scl[i * 3 + 2] = sz;
      f.col[i * 3] = c.r; f.col[i * 3 + 1] = c.g; f.col[i * 3 + 2] = c.b; f.on[i] = 1;
    };
    f.measure = () => {
      const v = new THREE.Vector3();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, zs = 0, n = 0;
      for (let i = 0; i < M; i++) {
        if (!f.on[i]) continue;
        for (const top of [0, 1]) {
          v.set(f.pos[i * 3], f.pos[i * 3 + 1] + top * f.scl[i * 3 + 1], f.pos[i * 3 + 2]).applyQuaternion(f.q);
          x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); zs += v.z; n++;
        }
      }
      f.ext = { w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, cz: n ? zs / n : 0 };
      return f;
    };
    return f;
  }

  // 1. the skyline: one column per week, newest week nearest
  const H = new Float32Array(N);
  // on a phone the strip is seen from lower down, so it stays inside its own area instead of climbing into the headline
  const sky = formation(innerWidth < 720 ? 0.15 : 0.3, 1.2, 1.0);
  days.forEach((d, i) => { H[i] = heightOf(d.n); sky.set(i, cols / 2 - d.col, 0, 3 - d.row, 0.84, H[i], 0.84, greenOf(d.n)); });
  sky.measure();
  {
    // the skyline is not fitted whole: the newest week sits at the front of its stage and the rest runs off into the distance
    const v = new THREE.Vector3(-(cols / 2) + 1, 0, 0).applyQuaternion(sky.q);
    sky.ext.cx = v.x; sky.ext.cy = v.y; sky.ext.cz = v.z;
  }

  // 2. stacks: the days sort themselves by what they were spent on, the empty days become the floor
  const stacks = formation(0.42, -0.5, 0.92);
  const stackInfo = cats.map((c, k) => ({ ...c, k, days: 0, commits: 0, x: 0, top: 0 }));
  {
    // each kind of work gets a 3x3 tower; a kind marked "wide" gets a 10x5 block so it does not dwarf the rest
    const foot = cats.map((c) => (c.wide ? [10, 5] : [3, 3]));
    const gap = 2.4, centre = [];
    let cursor = 0;
    foot.forEach(([w]) => { centre.push(cursor + w / 2); cursor += w + gap; });
    const span = cursor - gap;
    const fill = cats.map(() => 0);
    const floor = [];
    days.forEach((d, i) => {
      if (!d.n) { floor.push(i); return; }
      const k = cat[i], s = stackInfo[k], n = fill[k]++, [w, dp] = foot[k];
      s.days++; s.commits += d.n;
      stacks.set(i, centre[k] - span / 2 - w / 2 + 0.5 + (n % w), Math.floor(n / (w * dp)) * 1.02 + 0.2, (Math.floor(n / w) % dp) - (dp - 1) / 2, 0.92, 0.92, 0.92, new THREE.Color(s.color));
    });
    stackInfo.forEach((s, k) => { s.x = centre[k] - span / 2; s.top = Math.ceil(fill[k] / (foot[k][0] * foot[k][1])) * 1.02 + 0.2; });
    const fw = Math.ceil(span + 4), fd = Math.max(8, Math.ceil(floor.length / fw));
    const tile = new THREE.Color(cfg.floor || '#ffffff');
    floor.forEach((i, n) => { stacks.set(i, (n % fw) - fw / 2 + 0.5, 0, Math.floor(n / fw) - fd / 2 + 0.5, 0.94, 0.16, 0.94, tile); });
    stacks.measure();
  }

  // 3. a pixel artwork that moves: one cube per pixel, and every frame says which cubes show and in which colour.
  // Its data is big, so it arrives after the page is up (setArt).
  const art = formation(0.06, -0.38, 0.95);
  let artFrames = null, artPal = null, artNow = null, artSeq = null, artMs = 100, extrasOut = false;
  function setArt(sprite) {
    if (!sprite || !sprite.cells || !sprite.cells.length) return;
    const cells = sprite.cells.slice(0, M);
    // a little brighter than drawn, because the face of a cube that looks at you is never fully lit
    artPal = sprite.palette.map((c) => new THREE.Color(c).multiplyScalar(1.4));
    // the pixels used most get the day cubes, the rest get the extra ones
    const cube = (n) => (n < N ? shuffled[n] : n);
    cells.forEach((c, n) => art.set(cube(n), c[0] - sprite.w / 2, sprite.h / 2 - c[1], 0, 1, 1, 1, WHITE));
    artFrames = sprite.frames.map((row) => {
      const a = new Int8Array(M).fill(-1);
      for (let n = 0; n < cells.length; n++) { const ch = row.charCodeAt(n); if (ch !== 46) a[cube(n)] = ch - 48; }
      return a;
    });
    artSeq = sprite.seq; artMs = sprite.ms || 100;
    art.measure();
  }
  if (sprite) setArt(sprite);

  // 4. SAY HI, standing on a floor made of the remaining cubes
  const hi = formation(0.3, -0.42, 0.95);
  {
    const text = 'SAY HI', ink = new THREE.Color(cfg.ink || '#210b1b');
    let x = 0, n = 0;
    const cells = [];
    for (const ch of text) { const g = FONT[ch]; g.forEach((row, y) => [...row].forEach((b, cx) => { if (b === '1') cells.push([x + cx, 6 - y]); })); x += g[0].length + 1; }
    const wide = x - 1;
    cells.forEach(([cx, cy]) => { for (let z = 0; z < 2; z++) hi.set(shuffled[n++], cx - wide / 2, cy + 0.3, z - 0.5, 0.96, 0.96, 0.96, z ? ink : new THREE.Color(cfg.hiFront || '#ffffff')); });
    const fw = wide + 8, tile = new THREE.Color(cfg.hiFloor || '#f7c948');
    for (let m = 0; n < N && m < fw * 9; n++, m++) hi.set(shuffled[n], (m % fw) - fw / 2 + 0.5, 0, Math.floor(m / fw) - 4, 0.94, 0.2, 0.94, tile);
    hi.measure();
  }

  const FORMS = [
    { f: sky, el: stages.sky }, { f: stacks, el: stages.stacks }, { f: art, el: stages.art }, { f: hi, el: stages.hi },
  ].filter((s) => s.el);

  // ---------- state ----------
  let W = 1, Hpx = 1, wpp = 1, narrow = false;
  let intro = reduced ? 1 : 0;
  let hover = -1;
  let scrollY = scrollY0();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const bg = new THREE.Color('#5fcff2');
  function scrollY0() { return window.scrollY || 0; }

  function resize() {
    W = host.clientWidth || innerWidth; Hpx = host.clientHeight || innerHeight;
    narrow = W < 720;
    renderer.setSize(W, Hpx, false);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    cam.aspect = W / Hpx; cam.updateProjectionMatrix();
    wpp = (2 * D * TAN) / Hpx;
    // on a phone the skyline fades out sooner, so it stays below the headline
    scene.fog.near = D * (narrow ? 0.9 : 1.1); scene.fog.far = D * (narrow ? 1.5 : 3.4);
  }
  addEventListener('resize', resize);
  resize();

  // ---------- the game (same blocks, seen from behind a runner) ----------
  let run = null, runMix = 0, stepAcc = 0;
  const eaten = new Uint8Array(N), trail = new Set();
  const total = days.reduce((a, d) => a + d.n, 0);
  const qRun = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.62, 0, 0));
  const idx = (col, row) => col * 7 + row;
  function enter(col, row) {
    const i = idx(col, row);
    run.col = col; run.row = row;
    if (i >= N) return;
    run.cells.unshift(i);
    while (run.cells.length > 9) run.cells.pop();
    trail.clear(); run.cells.forEach((c) => trail.add(c));
    if (days[i].n && !eaten[i]) { eaten[i] = 1; run.score += days[i].n; run.days++; }
    tell(days[i].date);
  }
  function tell(date) {
    cfg.onGame && cfg.onGame({ state: run.count > 0 ? 'count' : 'play', n: Math.ceil(run.count), score: run.score, total, date });
  }
  function play() {
    eaten.fill(0); stepAcc = 0;
    // three seconds to find yourself and try the lanes before the run starts
    run = { cells: [], col: cols - 2, row: 3, camCol: cols - 2, score: 0, days: 0, over: false, count: 3 };
    if (idx(cols - 1, 3) < N) run.cells.push(idx(cols - 1, 3));
    enter(run.col, run.row);
  }
  function stop() { run = null; trail.clear(); eaten.fill(0); cfg.onGame && cfg.onGame({ state: 'idle' }); }
  function turn(d) { if (!run || run.over) return; const row = clamp(run.row + d, 0, 6); if (row !== run.row) enter(run.col, row); }
  function step() {
    if (run.col - 1 < 0) { run.over = true; cfg.onGame && cfg.onGame({ state: 'over', score: run.score, total, days: run.days }); return; }
    enter(run.col - 1, run.row);
  }

  // an arrow that hovers over the runner
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.5, 4), new THREE.MeshLambertMaterial({ color: 0xff3b5c }));
  marker.visible = false;
  scene.add(marker);
  const flip = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)), spin = new THREE.Quaternion(), up = new THREE.Vector3();
  function placeMarker() {
    marker.visible = !!run && runMix > 0.6 && !run.over;
    if (!marker.visible) return;
    const hh0 = D * TAN, sRun = ((narrow ? 0.7 : 0.27) * 2 * hh0 * cam.aspect) / 7;
    const bob = 2.9 + Math.sin(time * 5) * 0.35;
    marker.position.set(3 - run.row, 0, run.col - run.camCol).applyQuaternion(qRun).multiplyScalar(sRun);
    marker.position.y -= hh0 * 0.42; marker.position.z += 6;
    marker.position.add(up.set(0, bob * sRun, 0).applyQuaternion(qRun));
    spin.setFromEuler(new THREE.Euler(0, time * 2.2, 0));
    marker.quaternion.copy(qRun).multiply(flip).multiply(spin);
    marker.scale.setScalar(sRun);
  }

  // ---------- frame ----------
  const P = new THREE.Vector3(), S = new THREE.Vector3(), Q = new THREE.Quaternion(), C = new THREE.Color();
  const Pc = new THREE.Vector3(), Qc = new THREE.Quaternion(), Pr = new THREE.Vector3(), E = new THREE.Euler();
  const m4 = new THREE.Matrix4(), tmp = new THREE.Vector3(), tmpC = new THREE.Color();
  const live = FORMS.map(() => ({ w: 0, ax: 0, ay: 0, az: 0, s: 1 }));
  let active = 0, activeW = 0, time = 0;

  function measureStages() {
    active = 0; activeW = 0;
    FORMS.forEach((st, k) => {
      const r = st.el.getBoundingClientRect(), L = live[k];
      const cy = r.top + r.height / 2;
      const off = r.height > Hpx ? Math.max(0, Math.max(r.top, Hpx - r.bottom)) / Hpx : Math.abs(cy - Hpx / 2) / Hpx;
      L.w = r.width ? 1 - smooth(0.34, 0.92, off) : 0;
      L.ax = (r.left + r.width / 2 - W / 2) * wpp; L.ay = -(cy - Hpx / 2) * wpp;
      L.s = st.f.fit * Math.min((r.width * wpp) / st.f.ext.w, (r.height * wpp) / st.f.ext.h);
      L.az = 0;
      if (st.f === sky) {
        L.az = 22;
        const near = (D - L.az) / D;
        L.s = (r.width * wpp) / (narrow ? 15 : 24);
        L.ax = (r.left + r.width * (narrow ? 0.2 : 0.14) - W / 2) * wpp * near;
        L.ay = -(r.top + r.height * (narrow ? 0.9 : 0.84) - Hpx / 2) * wpp * near;
      }
      if (L.w > activeW) { activeW = L.w; active = k; }
    });
    if (FORMS[active].f === sky) activeW *= ease(intro);
  }

  function frameCubes() {
    const st = FORMS[active], f = st.f, L = live[active];
    const playing = !!run;
    const wAll = playing ? 1 : activeW;
    const isSky = f === sky || playing;
    const sway = isSky && !playing ? 1 : 0.6;
    Q.copy(f.q);
    if (!playing) { E.set(pointer.y * 0.05 * sway, pointer.x * 0.09 * sway, 0); Qc.setFromEuler(E); Q.premultiply(Qc); }
    const fq = Q.clone();
    if (runMix > 0) fq.slerp(qRun, ease(runMix));
    const hh0 = D * TAN, sRun = ((narrow ? 0.7 : 0.27) * 2 * hh0 * cam.aspect) / 7;
    const g = ease(runMix);
    artNow = artFrames ? artFrames[artSeq[reduced ? 0 : Math.floor((time * 1000) / artMs) % artSeq.length]] : null;
    // the extra cubes are only gone through while the artwork is up, and once more afterwards to put them away
    const artUp = f === art && !playing && !!artNow && wAll > 0;
    const end = artUp || extrasOut ? M : N;
    extrasOut = artUp;

    for (let i = 0; i < end; i++) {
      const r0 = R[i * 6], r1 = R[i * 6 + 1], r2 = R[i * 6 + 2], r3 = R[i * 6 + 3], r4 = R[i * 6 + 4], r5 = R[i * 6 + 5];
      // confetti position: fixed to the screen, drifting up as the page scrolls, nearer cubes faster
      const depth = r2, z = 12 - depth * 0.95 * D, hh = (D - z) * TAN;
      // most confetti keeps to the page margins; the few cubes behind the text are small and far away
      const side = r0 < 0.5 ? -1 : 1, edge = r5 < 0.62, u = (r0 * 2) % 1;
      const spread = edge ? (narrow ? 0.98 + 0.3 * u : 0.85 + 0.4 * u) : u * 0.8;      // on a phone they only peek in from the sides
      const Ry = hh * 1.35;
      let y = (r1 * 2 - 1) * Ry + scrollY * wpp * (0.95 - 0.6 * depth) + (reduced ? 0 : Math.sin(time * 0.25 + r3 * 40) * 1.4);
      y = ((((y + Ry) % (2 * Ry)) + 2 * Ry) % (2 * Ry)) - Ry;
      Pc.set(side * spread * hh * cam.aspect, y, z);
      const extra = i >= N;
      const cs = extra ? 0 : edge ? 0.8 + r4 * 1.4 : (r4 < 0.4 && !narrow ? 0.55 + r4 : 0);
      E.set(time * (0.15 + r3 * 0.3) + r4 * 6, time * (0.1 + r5 * 0.25) + r0 * 6, 0);
      Qc.setFromEuler(E);
      const cc = loose[i];

      const on = extra ? (artUp ? f.on[i] : 0) : isSky ? 1 : f.on[i];
      const e = on ? ease((wAll - 0.4 * r3) / 0.6) : 0;
      if (e <= 0) {
        m4.compose(Pc, Qc, S.set(cs, cs, cs)); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, cc);
        continue;
      }
      // formed position
      const src = !extra && (playing || runMix > 0) ? sky : f, d = days[i];
      let sy = src.scl[i * 3 + 1], sx = src.scl[i * 3], sz = src.scl[i * 3 + 2];
      C.setRGB(src.col[i * 3], src.col[i * 3 + 1], src.col[i * 3 + 2]);
      if (src === art && artNow) {
        if (artNow[i] < 0) sx = sy = sz = 0;          // this pixel is empty in the current frame
        else C.copy(artPal[artNow[i]]);
      }
      if (src === sky) {
        if (eaten[i]) { sy = 0.14; C.copy(GROUND); }
        if (run && d.col > run.col) sy = Math.min(sy, 0.3);
        if (trail.has(i)) { sy = 1.5; C.copy(i === run.cells[0] ? RUNNER_HEAD : RUNNER); }
        else if (i === hover) C.copy(WHITE);
      }
      tmp.set(src.pos[i * 3], src.pos[i * 3 + 1], src.pos[i * 3 + 2]).applyQuaternion(fq);
      P.set(L.ax + L.s * (tmp.x - src.ext.cx), L.ay + L.s * (tmp.y - src.ext.cy), L.az + L.s * (tmp.z - src.ext.cz));
      S.set(sx * L.s, sy * L.s, sz * L.s);
      if (g > 0 && !extra) {
        const camCol = run ? run.camCol : cols - 2;
        const dz = d.col - camCol;
        Pr.set(3 - d.row, 0, dz).applyQuaternion(qRun).multiplyScalar(sRun);
        Pr.y -= hh0 * 0.42; Pr.z += 6;
        const vis = dz > 5 || dz < -75 ? 0 : 1;
        P.lerp(Pr, g);
        S.set(THREE.MathUtils.lerp(S.x, 0.84 * sRun * vis, g), THREE.MathUtils.lerp(S.y, sy * sRun * vis, g), THREE.MathUtils.lerp(S.z, 0.84 * sRun * vis, g));
      }
      if (e < 1) {
        P.lerpVectors(Pc, P, e); S.set(THREE.MathUtils.lerp(cs, S.x, e), THREE.MathUtils.lerp(cs, S.y, e), THREE.MathUtils.lerp(cs, S.z, e));
        Q.copy(Qc).slerp(fq, e); C.copy(tmpC.copy(cc).lerp(C, e));
        m4.compose(P, Q, S);
      } else m4.compose(P, fq, S);
      mesh.setMatrixAt(i, m4); mesh.setColorAt(i, C);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  // where a skyline cube or a stack sits on screen (for labels and tooltips)
  const v3 = new THREE.Vector3();
  function projectDay(i, lift = 0.4) {
    const k = FORMS.findIndex((s) => s.f === sky), L = live[k];
    v3.set(sky.pos[i * 3], (eaten[i] ? 0.14 : H[i]) + lift, sky.pos[i * 3 + 2]).applyQuaternion(sky.q);
    v3.set(L.ax + L.s * (v3.x - sky.ext.cx), L.ay + L.s * (v3.y - sky.ext.cy), L.az + L.s * (v3.z - sky.ext.cz)).project(cam);
    return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * Hpx };
  }
  function projectStack(k2) {
    const k = FORMS.findIndex((s) => s.f === stacks), L = live[k], s = stackInfo[k2];
    v3.set(s.x, s.top + 0.6, 0).applyQuaternion(stacks.q);
    v3.set(L.ax + L.s * (v3.x - stacks.ext.cx), L.ay + L.s * (v3.y - stacks.ext.cy), L.s * (v3.z - stacks.ext.cz)).project(cam);
    return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * Hpx };
  }

  // ---------- hover on the skyline ----------
  const ray = new THREE.Raycaster(), p2 = new THREE.Vector2();
  addEventListener('pointermove', (ev) => {
    pointer.tx = (ev.clientX / W) * 2 - 1; pointer.ty = (ev.clientY / Hpx) * 2 - 1;
    if (ev.pointerType === 'touch' || run) return;
    const skyOn = FORMS[active].f === sky && activeW > 0.97;
    const free = !(ev.target.closest && ev.target.closest('a, button, video, dialog, .card, .tile, header'));
    let id = -1;
    if (skyOn && free) {
      p2.set(pointer.tx, -pointer.ty);
      ray.setFromCamera(p2, cam);
      mesh.boundingSphere = null;                 // the cubes move, so the cached bounds would be stale
      const hit = ray.intersectObject(mesh)[0];
      if (hit && hit.instanceId < N) id = hit.instanceId;
    }
    if (id !== hover) { hover = id; cfg.onHover && cfg.onHover(id < 0 ? null : days[id], id < 0 ? null : projectDay(id, 0.7)); }
  }, { passive: true });

  // ---------- loop ----------
  let last = performance.now(), visible = !document.hidden;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) { last = performance.now(); requestAnimationFrame(frame); } });
  function frame(now) {
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    scrollY = scrollY0();
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 4); pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 4);
    runMix = clamp(runMix + (run ? dt : -dt) / 0.7, 0, 1);
    if (run && !run.over) {
      if (run.count > 0) {
        const was = Math.ceil(run.count);
        run.count -= dt;
        if (Math.ceil(Math.max(run.count, 0)) !== was) tell(days[run.cells[0]].date);
      } else {
        stepAcc += dt;
        const every = 0.13 - 0.05 * (1 - run.col / cols);
        while (stepAcc > every && !run.over) { stepAcc -= every; step(); }
      }
    }
    if (run) run.camCol += (run.col - run.camCol) * Math.min(1, dt * 7);
    if (intro < 1) intro = Math.min(1, intro + dt / 2.4);
    measureStages();
    if (cfg.background) { bg.set(cfg.background()); scene.fog.color.copy(bg); }
    frameCubes();
    placeMarker();
    renderer.render(scene, cam);
    cfg.onFrame && cfg.onFrame({ skyOn: FORMS[active].f === sky && activeW > 0.9 && !run, stacksOn: FORMS[active].f === stacks && activeW > 0.85, projectDay, projectStack });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    play, stop, turn, setArt,
    get playing() { return !!run; },
    stackInfo, projectDay, projectStack, cols, total,
    _skipIntro() { intro = 1; },
  };
}
