// Draws a small pixel creature for a project that has no screenshot yet.
// Same id always gives the same creature, so each project keeps its own face.

const BG = {
  game: ['#d95763', '#e8798a', '#c7435a'],
  app: ['#47c7ec', '#6fd6f2', '#2fa9d6'],
  tool: ['#f2c14e', '#f6d37a', '#e3a92f'],
  site: ['#b1a1ec', '#c6b9f3', '#9484dd'],
  learn: ['#3ad531', '#6be35f', '#27b522'],
};
const BODY = ['#f7ead9', '#ffffff', '#ffd9a8', '#fff3b0', '#d8f7ff', '#ffd1dc', '#2c1024'];
const INK = '#210b1b';

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function typeColor(type) {
  return (BG[type] || BG.tool)[0];
}

export function sprite(id, type) {
  const N = 16, W = 10, H = 10, OX = 3, OY = 3;
  const r = rng(hash(id + ':' + type));
  const bgs = BG[type] || BG.tool;
  const bg = bgs[Math.floor(r() * bgs.length)];
  let body = BODY[Math.floor(r() * BODY.length)];
  const shade = r() < 0.5;

  // left half, mirrored
  const g = Array.from({ length: H }, () => Array(W).fill(0));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W / 2; x++) {
      const toCentre = x / (W / 2 - 1);                 // 0 at the edge, 1 in the middle
      const belly = 1 - Math.abs(y - H * 0.45) / (H * 0.6);
      const p = 0.12 + 0.55 * toCentre + 0.3 * belly;
      if (r() < p) { g[y][x] = 1; g[y][W - 1 - x] = 1; }
    }
  }
  // always a solid core, so nothing comes out as scattered dust
  for (let y = 2; y < 7; y++) for (let x = 3; x < 7; x++) g[y][x] = 1;
  // feet
  const foot = 1 + Math.floor(r() * 3);
  g[H - 1][foot] = 1; g[H - 1][W - 1 - foot] = 1; g[H - 2][foot] = 1; g[H - 2][W - 1 - foot] = 1;
  // eyes
  const ey = 3 + Math.floor(r() * 2), ex = 3;
  g[ey][ex] = 2; g[ey][W - 1 - ex] = 2;
  if (r() < 0.4) { g[ey + 2][4] = 2; g[ey + 2][5] = 2; }   // mouth

  const c = document.createElement('canvas');
  c.width = N; c.height = N;
  const k = c.getContext('2d');
  k.fillStyle = bg; k.fillRect(0, 0, N, N);
  // outline first
  k.fillStyle = INK;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!g[y][x]) continue;
    k.fillRect(OX + x - 1, OY + y, 3, 1); k.fillRect(OX + x, OY + y - 1, 1, 3);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!g[y][x]) continue;
    if (g[y][x] === 2) k.fillStyle = body === INK || body === '#2c1024' ? '#f7ead9' : INK;
    else k.fillStyle = body;
    k.fillRect(OX + x, OY + y, 1, 1);
    if (shade && g[y][x] === 1 && y > H * 0.55) { k.fillStyle = 'rgba(33,11,27,.22)'; k.fillRect(OX + x, OY + y, 1, 1); }
  }
  return { url: c.toDataURL('image/png'), bg };
}
