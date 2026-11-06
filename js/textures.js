// Procedural canvas textures for the Arcade Room.
import * as THREE from 'three';

export const PAL = {
  bg: '#1a0f0a', dusk: '#2a1810', amber: '#f59e0b', red: '#ef4444', gold: '#fbbf24',
  orange: '#f97316', tan: '#d4a574', green: '#84cc16', cream: '#fde8c8', muted: '#8b7355',
  magenta: '#ff4fa3', teal: '#2dd4bf', purple: '#a855f7',
};

const DISPLAY = '"Press Start 2P", monospace';
const UI = 'Silkscreen, monospace';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

export function toTexture(canvas, { nearest = true, mip = false, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = mip ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter;
    t.generateMipmaps = mip;
  }
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// Seeded random so the room looks the same on every visit.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function fitText(g, text, font, maxW, startSize) {
  let size = startSize;
  do { g.font = `${size}px ${font}`; size -= 1; } while (g.measureText(text).width > maxW && size > 6);
  return size + 1;
}

// Classic cosmic arcade carpet, seamless.
export function carpetTexture() {
  const S = 128;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#140a10'; g.fillRect(0, 0, S, S);
  const r = rng(7);
  const cols = [PAL.amber, PAL.magenta, PAL.teal, PAL.gold, PAL.purple, PAL.red];
  const shapes = [];
  for (let i = 0; i < 26; i++) shapes.push({ x: r() * S, y: r() * S, k: (r() * 5) | 0, c: cols[(r() * cols.length) | 0], s: 3 + r() * 6, a: r() * 6.28 });
  const draw = (sh, ox, oy) => {
    g.save(); g.translate(sh.x + ox, sh.y + oy); g.rotate(sh.a);
    g.strokeStyle = sh.c; g.fillStyle = sh.c; g.lineWidth = 1.5;
    if (sh.k === 0) { g.beginPath(); g.arc(0, 0, sh.s, 0, 6.28); g.stroke(); }
    else if (sh.k === 1) { g.beginPath(); g.moveTo(-sh.s, 0); for (let i = 0; i < 4; i++) g.lineTo(-sh.s + (i + 1) * sh.s / 2, i % 2 ? -sh.s / 2 : sh.s / 2); g.stroke(); }
    else if (sh.k === 2) { g.beginPath(); g.moveTo(0, -sh.s); g.lineTo(sh.s, sh.s); g.lineTo(-sh.s, sh.s); g.closePath(); g.stroke(); }
    else if (sh.k === 3) { g.fillRect(-1, -sh.s, 2, sh.s * 2); g.fillRect(-sh.s, -1, sh.s * 2, 2); }
    else { g.fillRect(-sh.s / 2, -sh.s / 2, sh.s / 1.5, sh.s / 1.5); }
    g.restore();
  };
  g.globalAlpha = 0.6;
  for (const sh of shapes) for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) draw(sh, ox, oy);
  return toTexture(c, { mip: true, repeat: [12, 12] });
}

// Dark wood paneling for walls.
export function wallTexture() {
  const W = 64, H = 64;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#2a1712'; g.fillRect(0, 0, W, H);
  const r = rng(3);
  for (let x = 0; x < W; x += 16) {
    g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.1})`; g.fillRect(x, 0, 1, H);
    g.fillStyle = 'rgba(255,200,150,0.05)'; g.fillRect(x + 1, 0, 1, H);
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(x + 3 + ((r() * 11) | 0), (r() * H) | 0, 1, 6 + ((r() * 10) | 0)); }
  }
  return toTexture(c, { mip: true, repeat: [10, 2] });
}

// Marquee sign on top of a cabinet.
export function marqueeTexture(title, accent) {
  const [c, g] = makeCanvas(256, 64);
  g.fillStyle = '#0d0705'; g.fillRect(0, 0, 256, 64);
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, accent); grad.addColorStop(1, '#1a0f0a');
  g.globalAlpha = 0.55; g.fillStyle = grad; g.fillRect(4, 4, 248, 56); g.globalAlpha = 1;
  for (let x = 8; x < 250; x += 12) { g.fillStyle = PAL.cream; g.fillRect(x, 2, 3, 3); g.fillRect(x, 59, 3, 3); }
  const label = title.toUpperCase();
  fitText(g, label, DISPLAY, 228, 16);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#000'; g.fillText(label, 130, 35);
  g.fillStyle = PAL.cream; g.fillText(label, 128, 33);
  return toTexture(c);
}

// Side art stripe for a cabinet (applied on the side caps).
export function sideArtTexture(accent) {
  const [c, g] = makeCanvas(64, 64);
  g.fillStyle = '#1c100b'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = accent;
  for (let i = -64; i < 64; i += 14) { g.save(); g.translate(i, 0); g.transform(1, 0, 0.7, 1, 0, 0); g.fillRect(0, 20, 5, 44); g.restore(); }
  g.globalAlpha = 0.5; g.fillRect(0, 60, 64, 4);
  return toTexture(c);
}

// Animated Panel Haus "Now Playing" screen.
export function panelHausScreen() {
  const W = 320, H = 180;
  const [c, g] = makeCanvas(W, H);
  const tex = toTexture(c, { nearest: false });
  const panels = [[14, 40, 92, 62], [112, 40, 92, 62], [210, 40, 96, 128], [14, 108, 190, 60]];
  const r = rng(11);
  const dots = Array.from({ length: 40 }, () => [r(), r(), r()]);
  tex.userData.draw = (t) => {
    g.fillStyle = '#120a06'; g.fillRect(0, 0, W, H);
    g.font = `12px ${DISPLAY}`; g.textBaseline = 'top'; g.textAlign = 'left';
    g.fillStyle = PAL.gold; g.fillText('PANEL HAUS', 14, 14);
    if (Math.floor(t * 2) % 2 === 0) { g.font = `8px ${DISPLAY}`; g.fillStyle = PAL.red; g.textAlign = 'right'; g.fillText('● NOW PLAYING', W - 14, 16); }
    const cycle = (t * 0.45) % 1.6;
    panels.forEach((p, i) => {
      const k = Math.min(1, Math.max(0, (cycle - i * 0.22) * 3));
      g.strokeStyle = PAL.cream; g.lineWidth = 2;
      g.strokeRect(p[0], p[1], p[2] * k, p[3] * (k > 0 ? 1 : 0));
      if (k >= 1) {
        g.fillStyle = ['#3b1d12', '#2d1a2e', '#14262b', '#2b2410'][i]; g.fillRect(p[0] + 2, p[1] + 2, p[2] - 4, p[3] - 4);
        g.fillStyle = [PAL.amber, PAL.magenta, PAL.teal, PAL.gold][i];
        dots.slice(i * 10, i * 10 + 10).forEach(([a, b, s]) => g.fillRect(p[0] + 4 + a * (p[2] - 12), p[1] + 4 + b * (p[3] - 12), 2 + s * 5, 2 + s * 5));
        if (i === 0) { g.fillStyle = PAL.cream; g.fillRect(p[0] + 8, p[1] + 8, 40, 14); g.fillStyle = '#000'; g.font = `6px ${DISPLAY}`; g.fillText('POW!', p[0] + 12, p[1] + 12); }
      }
    });
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    tex.needsUpdate = true;
  };
  tex.userData.draw(0);
  tex.userData.canvas = c;
  return tex;
}

// "Under construction" static screen for the Coming Soon cabinet.
export function staticScreen() {
  const W = 96, H = 54;
  const [c, g] = makeCanvas(W, H);
  const tex = toTexture(c);
  const img = g.createImageData(W, H);
  tex.userData.draw = (t) => {
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 120 | 0; img.data[i] = v + 30; img.data[i + 1] = v + 20; img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    g.fillStyle = 'rgba(26,15,10,.8)'; g.fillRect(6, 17, 84, 20);
    g.font = `6px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = Math.floor(t * 2) % 2 ? PAL.gold : PAL.amber;
    g.fillText('UNDER', 48, 23); g.fillText('CONSTRUCTION', 48, 32);
    tex.needsUpdate = true;
  };
  tex.userData.draw(0);
  return tex;
}

// Game cartridge label for the inventory shelf.
export function cartridgeLabel(emoji, name, accent) {
  const [c, g] = makeCanvas(96, 120);
  g.fillStyle = accent; g.fillRect(0, 0, 96, 120);
  g.fillStyle = '#1a0f0a'; g.fillRect(6, 6, 84, 74);
  g.font = '44px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, 48, 46);
  g.fillStyle = '#1a0f0a';
  fitText(g, name.toUpperCase(), UI, 86, 15);
  g.fillText(name.toUpperCase(), 48, 100);
  return toTexture(c, { nearest: false });
}

// Parchment note for the quest board.
export function noteTexture(title, sub, tint = '#f3e2c0') {
  const [c, g] = makeCanvas(160, 128);
  g.fillStyle = tint; g.fillRect(0, 0, 160, 128);
  const r = rng(title.length * 13);
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(120,80,40,${r() * 0.12})`; g.fillRect(r() * 160, r() * 128, 2, 2); }
  g.fillStyle = 'rgba(120,80,40,.35)'; g.fillRect(0, 0, 160, 3); g.fillRect(0, 125, 160, 3);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#3a2216';
  fitText(g, title.toUpperCase(), DISPLAY, 140, 13); g.fillText(title.toUpperCase(), 80, 52);
  g.fillStyle = '#7a4a22'; fitText(g, sub, UI, 146, 15); g.fillText(sub, 80, 84);
  return toTexture(c, { nearest: false });
}

// Cork board surface.
export function corkTexture() {
  const [c, g] = makeCanvas(128, 96);
  g.fillStyle = '#8a5a32'; g.fillRect(0, 0, 128, 96);
  const r = rng(5);
  for (let i = 0; i < 900; i++) { const v = r(); g.fillStyle = v > 0.5 ? 'rgba(60,30,10,.35)' : 'rgba(220,170,110,.25)'; g.fillRect(r() * 128 | 0, r() * 96 | 0, 1, 1); }
  return toTexture(c);
}

// Neon sign text (transparent canvas, drawn with glow).
export function neonText(text, color, { w = 1024, h = 160, size = 88, font = DISPLAY } = {}) {
  const [c, g] = makeCanvas(w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  fitText(g, text, font, w - 60, size);
  g.shadowColor = color; g.shadowBlur = 24; g.fillStyle = color;
  g.fillText(text, w / 2, h / 2 + 4);
  g.shadowBlur = 0; g.fillStyle = '#fff6e0'; g.globalAlpha = 0.85;
  g.fillText(text, w / 2, h / 2 + 4);
  return toTexture(c, { nearest: false });
}

// Soft radial glow used for floor decals and light cones.
export function glowTexture(color = '#ffffff') {
  const [c, g] = makeCanvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, color); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return toTexture(c, { nearest: false });
}

// Wooden plank sign with text.
export function plankTexture(text) {
  const [c, g] = makeCanvas(256, 48);
  g.fillStyle = '#5a3418'; g.fillRect(0, 0, 256, 48);
  g.fillStyle = 'rgba(0,0,0,.2)'; for (let y = 6; y < 48; y += 9) g.fillRect(0, y, 256, 1);
  g.fillStyle = PAL.gold; g.textAlign = 'center'; g.textBaseline = 'middle';
  fitText(g, text, DISPLAY, 230, 14); g.fillText(text, 128, 25);
  return toTexture(c);
}
