import { SITE, NOW, PROJECTS, ART } from '../data/projects.js';
import { ACTIVITY } from '../data/activity.js';
import { sprite, typeColor } from './sprite.js';

const $ = (s, el = document) => el.querySelector(s);
const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'text') n.textContent = v;
    else if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(kids)) if (c) n.append(c);
  return n;
};

const TYPE = { game: 'Game', app: 'App', tool: 'Tool', site: 'Website', learn: 'Learning' };
const TYPES = { game: 'Games', app: 'Apps', tool: 'Tools', site: 'Websites', learn: 'Learning' };
const ALL = [...PROJECTS, ...NOW.dev.map((d) => ({ ...d, year: 2026, state: 'dev', links: [] }))];
const stateText = (p) => (p.state === 'dev' ? 'In development' : p.state === 'client' ? 'Client work' : '');
const metaText = (p) => [TYPE[p.type], p.year, stateText(p)].filter(Boolean).join(', ');

// ---------- media: a clip when there is one, otherwise the project's own pixel creature ----------
function media(p, { big = false } = {}) {
  if (p.video) {
    const v = el('video', { muted: true, loop: true, playsinline: true, preload: 'none', poster: p.poster, 'aria-label': `${p.name} clip` });
    v.muted = true;
    v.dataset.src = p.video;
    return el('div', { class: 'media media-clip' }, v);
  }
  const s = sprite(p.id, p.type);
  return el('div', { class: 'media media-sprite' + (big ? ' is-big' : ''), style: `background:${s.bg}` },
    el('img', { src: s.url, alt: '', width: 16, height: 16 }));
}

const clips = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.src) v.src = v.dataset.src;
      v.play().catch(() => {});
    } else v.pause();
  }
}, { threshold: 0.35 });
const watchClips = (root) => root.querySelectorAll('video[data-src]').forEach((v) => clips.observe(v));

function linkButtons(p, main = true) {
  return (p.links || []).map((l, i) => {
    const a = el('a', { class: 'btn' + (main && i === 0 ? ' btn-main' : ''), href: l.href, target: '_blank', rel: 'noopener', text: l.label });
    if (l.play) a.addEventListener('click', (ev) => { if (openPlayer(p, l)) ev.preventDefault(); });
    return a;
  });
}

// ---------- Right now ----------
function renderNow() {
  const L = NOW.lead;
  const s = sprite(L.id, 'site');
  const lead = el('article', { class: 'now-lead' }, [
    el('div', { class: 'now-mark', style: `background:${s.bg}` }, el('img', { src: s.url, alt: '', width: 16, height: 16 })),
    el('div', {}, [
      el('h3', { text: L.name }),
      el('p', { class: 'meta', text: L.role }),
      el('p', { text: L.text }),
      el('p', { class: 'actions' }, el('a', { class: 'btn btn-main', href: L.link.href, target: '_blank', rel: 'noopener', text: L.link.label })),
    ]),
  ]);
  const dev = el('div', { class: 'now-dev' }, [
    el('h3', { text: 'In development' }),
    el('ul', {}, NOW.dev.map((d) => {
      const sp = sprite(d.id, d.type);
      return el('li', {}, [
        el('span', { class: 'mini', style: `background:${sp.bg}` }, el('img', { src: sp.url, alt: '', width: 16, height: 16 })),
        el('div', {}, [el('b', { text: d.name }), el('p', { text: d.text })]),
      ]);
    })),
  ]);
  $('#now-grid').append(lead, dev);
}

// ---------- Selected work ----------
function renderRows() {
  const rows = $('#rows');
  PROJECTS.filter((p) => p.tier === 'front').forEach((p) => {
    rows.append(el('article', { class: 'row', id: 'p-' + p.id }, [
      media(p, { big: true }),
      el('div', { class: 'row-text' }, [
        el('h3', { text: p.name }),
        el('p', { class: 'meta', text: metaText(p) }),
        el('p', { text: p.text }),
        el('ul', { class: 'tags' }, (p.tags || []).map((t) => el('li', { text: t }))),
        el('p', { class: 'actions' }, linkButtons(p)),
      ]),
    ]));
  });
  watchClips(rows);
}

// ---------- Everything ----------
let filter = 'all';
function renderWall() {
  const counts = {};
  ALL.forEach((p) => { counts[p.type] = (counts[p.type] || 0) + 1; });
  $('#all-lead').textContent = `${ALL.length} projects are on this page. I have ${SITE.repos} repos in total; the rest is client and team work that stays private.`;
  $('#fact-projects').textContent = ALL.length;
  $('#fact-repos').textContent = SITE.repos;
  $('#fact-art').textContent = ART.length;

  const chips = $('#chips');
  const mk = (key, label, n) => el('button', { type: 'button', class: 'chip', 'aria-pressed': key === filter ? 'true' : 'false', 'data-f': key,
    onclick: () => { filter = key; paint(); } }, [label, el('span', { text: n })]);
  chips.append(mk('all', 'All', ALL.length), ...Object.keys(TYPES).filter((k) => counts[k]).map((k) => mk(k, TYPES[k], counts[k])));

  const wall = $('#wall');
  ALL.forEach((p) => {
    const b = el('button', { type: 'button', class: 'tile', 'data-type': p.type, style: `--tc:${typeColor(p.type)}`, onclick: () => openSheet(p) }, [
      p.poster ? el('span', { class: 'tile-pic' }, el('img', { src: p.poster, alt: '', loading: 'lazy' }))
        : (() => { const s = sprite(p.id, p.type); return el('span', { class: 'tile-pic is-sprite', style: `background:${s.bg}` }, el('img', { src: s.url, alt: '', width: 16, height: 16 })); })(),
      el('span', { class: 'tile-name', text: p.name }),
      el('span', { class: 'tile-meta', text: [TYPE[p.type], p.year].join(', ') }),
    ]);
    wall.append(el('li', { 'data-type': p.type }, b));
  });
  wall.append(el('li', { class: 'tile-more', 'data-type': 'more' }, [
    el('b', { text: '+' + (SITE.repos - SITE.publicRepos) }),
    el('span', { text: 'more repos are private: client builds and team work.' }),
  ]));

  function paint() {
    chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.f === filter ? 'true' : 'false'));
    wall.querySelectorAll('li').forEach((li) => { li.hidden = filter !== 'all' && li.dataset.type !== filter; });
  }
}

// ---------- project sheet ----------
const sheet = $('#sheet');
function openSheet(p) {
  const m = $('#sheet-media');
  m.replaceChildren(media(p, { big: true }));
  const v = m.querySelector('video');
  if (v) { v.src = v.dataset.src; v.play().catch(() => {}); }
  $('#sheet-name').textContent = p.name;
  $('#sheet-meta').textContent = metaText(p);
  $('#sheet-text').textContent = p.text;
  const links = linkButtons(p);
  $('#sheet-links').replaceChildren(...(links.length ? links : [el('span', { class: 'meta', text: p.state === 'dev' ? 'No public build yet.' : 'Not public yet. Ask me for a look.' })]));
  sheet.showModal();
}

// ---------- play inside the page ----------
const player = $('#player');
function openPlayer(p, link) {
  if (matchMedia('(max-width: 760px)').matches) return false;      // on a phone, a new tab works better
  $('#player-name').textContent = p.name;
  $('#player-out').href = link.href;
  $('#player-frame').replaceChildren(el('iframe', { src: link.href, title: p.name, allow: 'fullscreen; autoplay; gamepad', loading: 'eager' }));
  if (sheet.open) sheet.close();
  player.showModal();
  return true;
}
player.addEventListener('close', () => $('#player-frame').replaceChildren());

// ---------- pixel art ----------
const viewer = $('#viewer');
let artAt = 0;
function showArt(i) {
  artAt = (i + ART.length) % ART.length;
  $('#viewer-img').src = 'images/' + ART[artAt];
  $('#viewer-img').alt = `Pixel art ${artAt + 1} of ${ART.length}`;
  $('#viewer-count').textContent = `${artAt + 1} / ${ART.length}`;
}
function renderArt() {
  const grid = $('#art-grid');
  ART.forEach((f, i) => {
    grid.append(el('li', {}, el('button', { type: 'button', 'aria-label': `Open pixel art ${i + 1}`, onclick: () => { showArt(i); viewer.showModal(); } },
      el('img', { src: 'images/' + f, alt: '', loading: 'lazy', decoding: 'async' }))));
  });
  viewer.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => showArt(artAt + Number(b.dataset.step))));
  viewer.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') showArt(artAt + 1); if (e.key === 'ArrowLeft') showArt(artAt - 1); });
}

// close buttons and click-outside for all three dialogs
document.querySelectorAll('dialog').forEach((d) => {
  d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.addEventListener('close', () => d.querySelectorAll('video').forEach((v) => v.pause()));
});

// ---------- the skyline ----------
async function startSky() {
  const stage = $('#sky-stage'), tip = $('#sky-tip'), labels = $('#sky-labels');
  const commits = Object.values(ACTIVITY).reduce((a, d) => a + d[0], 0);
  const activeDays = Object.keys(ACTIVITY).length;
  $('#sky-caption').textContent = `Every block is a day I pushed code. Taller means more commits. ${commits} commits on ${activeDays} days, counting public repos only.`;

  let mod;
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');
    mod = await import('./skyline.js');
  } catch (err) {
    flatSky(stage);
    $('#sky-start').hidden = true;
    return;
  }
  const days = mod.buildDays(ACTIVITY);

  // name the busiest day of each project that is on the page
  const byRepo = new Map(PROJECTS.filter((p) => p.repo).map((p) => [p.repo, p]));
  const best = new Map();
  days.forEach((d) => {
    const top = d.what.split(', ')[0];
    const p = byRepo.get(top);
    if (p && (!best.has(p.id) || best.get(p.id).n < d.n)) best.set(p.id, { ...d, name: p.name, pid: p.id });
  });
  // front-row projects first, then by how busy the day was; keep them apart along the strip
  const rank = (m) => (PROJECTS.find((p) => p.id === m.pid).tier === 'front' ? 1000 : 0) + m.n;
  const marks = [];
  [...best.values()].filter((m) => { const p = PROJECTS.find((x) => x.id === m.pid); return p.tier === 'front' || p.video; })
    .sort((a, b) => rank(b) - rank(a)).forEach((m) => {
      if (marks.length < 8 && marks.every((o) => Math.abs(o.col - m.col) > 5)) marks.push(m);
    });
  const markEls = marks.map((m) => {
    const a = el('a', { class: 'sky-label', href: '#everything', text: m.name });
    a.addEventListener('click', (ev) => { ev.preventDefault(); const p = ALL.find((x) => x.id === m.pid); if (p) openSheet(p); });
    labels.append(a);
    return a;
  });
  labels.setAttribute('aria-hidden', 'false');

  const fmt = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const game = $('#sky-game'), over = $('#sky-over');
  const sky = mod.createSkyline(stage, days, {
    onHover(d, pos) {
      if (!d || !pos) { tip.hidden = true; return; }
      tip.hidden = false;
      tip.textContent = d.n ? `${fmt.format(new Date(d.date))}: ${d.n} commit${d.n > 1 ? 's' : ''}, ${d.what}` : `${fmt.format(new Date(d.date))}: nothing pushed`;
      tip.style.left = Math.min(Math.max(pos.x, 110), stage.clientWidth - 110) + 'px';
      tip.style.top = pos.y + 'px';
    },
    onFrame(project) {
      const w = stage.clientWidth, placed = [];
      marks.forEach((m, i) => {
        const p = project(m.i, 0.2), e = markEls[i];
        const lw = e.offsetWidth || 120;
        const clear = placed.every((q) => Math.abs(q.y - p.y) > 30 || p.x > q.x + q.w + 10 || q.x > p.x + lw + 10);
        const show = !sky.playing && p.z < 1 && p.x > 20 && p.x < w - lw && p.y > 90 && clear;
        e.style.display = show ? '' : 'none';
        if (show) { e.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`; placed.push({ x: p.x, y: p.y, w: lw }); }
      });
    },
    onGame(g) {
      if (g.state === 'idle') { game.hidden = true; document.body.classList.remove('is-playing'); return; }
      game.hidden = false; tip.hidden = true; document.body.classList.add('is-playing');
      $('#sky-score').textContent = g.score;
      $('#sky-date').textContent = g.date ? 'at ' + fmt.format(new Date(g.date)) : '';
      over.hidden = g.state !== 'over';
      if (g.state === 'over') {
        const pct = Math.round((g.score / g.total) * 100);
        $('#sky-over-text').textContent = `You made it back to July 2024 and ate ${g.score} of my ${g.total} commits. That's ${pct}%.`;
        $('#sky-again').focus();
      }
    },
  });

  $('#sky-start').addEventListener('click', () => { sky.play(); stage.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  $('#sky-again').addEventListener('click', () => sky.play());
  $('#sky-quit').addEventListener('click', () => sky.stop());
  // while playing, the camera looks down the strip, so screen-left is the next weekday lane
  const lanes = { ArrowLeft: 1, ArrowRight: -1, a: 1, d: -1 };
  addEventListener('keydown', (e) => {
    if (!sky.playing) return;
    if (e.key === 'Escape') { sky.stop(); return; }
    const k = lanes[e.key] || lanes[e.key.toLowerCase()];
    if (k) { e.preventDefault(); sky.turn(k); }
    else if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
  });
  sky.canvas.addEventListener('pointerdown', (e) => {
    if (!sky.playing) return;
    const r = sky.canvas.getBoundingClientRect();
    sky.turn(e.clientX < r.left + r.width / 2 ? 1 : -1);
  });

  window.__site = { sky, days, marks, openSheet, ALL };
}

// plain grid for browsers without WebGL
function flatSky(stage) {
  const keys = Object.keys(ACTIVITY).sort();
  const start = new Date(keys[0] + 'T00:00:00Z'); start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date();
  const g = el('div', { class: 'sky-flat' });
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const a = ACTIVITY[d.toISOString().slice(0, 10)], n = a ? a[0] : 0;
    g.append(el('i', { 'data-l': !n ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 8 ? 3 : 4 }));
  }
  stage.append(g);
}

renderNow();
renderRows();
renderWall();
renderArt();
startSky();
