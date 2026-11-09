import { SITE, NOW, PROJECTS, ART, REPO_TYPES } from '../data/projects.js';
import { ACTIVITY } from '../data/activity.js';
import { MEDIA, VOXEL_CELLS } from '../data/media.js';
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
const SHOWN = PROJECTS.filter((p) => !p.hide);
const ALL = [...SHOWN, ...NOW.dev.map((d) => ({ ...d, year: 2026, state: 'dev', links: [] }))];
const stateText = (p) => (p.state === 'dev' ? 'In development' : p.state === 'client' ? 'Client work' : '');
const metaText = (p) => [TYPE[p.type], p.year, stateText(p)].filter(Boolean).join(', ');
const num = (n) => n.toLocaleString('en');

// ---------- pictures ----------
// Every picture is given its real size and its average colour before it loads, so the page never jumps and
// never shows an empty hole. Small places (tiles, the art grid) load a small copy made by tools/build_media.py.
function pic(src, { alt = '', small = false } = {}) {
  const m = MEDIA[src] || {};
  const img = el('img', { alt, width: m.w, height: m.h, loading: 'lazy', decoding: 'async', class: 'pic' + (m.px ? ' px' : '') });
  img.addEventListener('load', () => img.classList.add('in'), { once: true });
  img.addEventListener('error', () => img.classList.add('in'), { once: true });
  img.src = (small && m.t) || src;
  if (img.complete && img.naturalWidth) img.classList.add('in');
  return img;
}
const tint = (src) => (MEDIA[src] ? `background-color:${MEDIA[src].c}` : null);

// ---------- media: a clip when there is one, otherwise a screenshot, otherwise the project's own pixel creature ----------
function media(p, { big = false } = {}) {
  if (p.video) {
    // the still picture shows first; the clip is only fetched when its row scrolls into view, and fades in once it plays
    const v = el('video', { muted: true, loop: true, playsinline: true, preload: 'none', 'aria-label': `${p.name} clip` });
    v.muted = true;
    v.dataset.src = p.video;
    v.addEventListener('playing', () => v.classList.add('on'), { once: true });
    return el('div', { class: 'media media-clip', style: tint(p.poster) }, [p.poster && pic(p.poster), v]);
  }
  if (p.poster) return el('div', { class: 'media media-shot', style: tint(p.poster) }, pic(p.poster, { alt: `${p.name} screenshot` }));
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
}, { threshold: 0.2, rootMargin: '200px 0px' });
const watchClips = (root) => root.querySelectorAll('video[data-src]').forEach((v) => clips.observe(v));

function linkButtons(p, main = true) {
  return (p.links || []).map((l, i) => {
    const a = el('a', { class: 'btn' + (main && i === 0 ? ' btn-main' : ''), href: l.href, target: '_blank', rel: 'noopener', text: l.label });
    if (l.play) a.addEventListener('click', (ev) => { if (openPlayer(p, l)) ev.preventDefault(); });
    return a;
  });
}

// ---------- Right now ----------
// Panel Haus explained the way it works: as a four-panel comic, drawn with plain boxes.
function comicStrip(steps) {
  const a = sprite('panel-haus-a', 'game', { clear: true }), b = sprite('panel-haus-b', 'app', { clear: true });
  const art = [
    // 1 the script: lines of text and a cursor
    () => [el('i', { class: 'ln', style: 'width:78%' }), el('i', { class: 'ln', style: 'width:92%' }), el('i', { class: 'ln', style: 'width:58%' }), el('i', { class: 'cur' })],
    // 2 the page: a few panels, one picked
    () => [el('i', { class: 'pg' }, [el('i', { style: 'grid-column:1/3' }), el('i', { class: 'hot' }), el('i'), el('i', { style: 'grid-column:1/3' })])],
    // 3 two characters and a speech bubble
    () => [el('img', { class: 'who', src: a.url, alt: '' }), el('img', { class: 'who two', src: b.url, alt: '' }), el('i', { class: 'say', text: 'Hi!' })],
    // 4 what comes out: a page, a book, a clip
    () => [el('i', { class: 'out pgo' }), el('i', { class: 'out bk' }), el('i', { class: 'out clip' })],
  ];
  return el('ol', { class: 'strip', 'aria-label': 'How Panel Haus works' }, steps.map((t, k) =>
    el('li', {}, [el('div', { class: 'cell c' + (k + 1), 'aria-hidden': 'true' }, art[k] ? art[k]() : []), el('span', {}, [el('b', { text: String(k + 1) }), t])])));
}

function renderNow() {
  const L = NOW.lead;
  const lead = el('article', { class: 'card now-lead' }, [
    el('div', { class: 'now-shot' }, pic(L.image, { alt: `${L.name} logo`, small: true })),
    el('div', { class: 'now-text' }, [
      el('h3', { text: L.name }),
      el('p', { class: 'meta', text: L.role }),
      el('p', { text: L.text }),
      L.steps && comicStrip(L.steps),
      el('p', { class: 'actions' }, el('a', { class: 'btn btn-main', href: L.link.href, target: '_blank', rel: 'noopener', text: L.link.label })),
    ]),
  ]);
  const dev = el('div', { class: 'card now-dev' }, [
    el('h3', { text: 'In development' }),
    el('ul', {}, NOW.dev.map((d) => {
      const full = ALL.find((p) => p.id === d.id);
      return el('li', {}, el('button', { type: 'button', class: 'dev', onclick: () => openSheet(full) }, [
        el('span', { class: 'mini', style: tint(d.poster) }, pic(d.poster, { small: true })),
        el('span', {}, [el('b', { text: d.name }), el('span', { class: 'dev-text', text: d.text })]),
      ]));
    })),
  ]);
  $('#now-grid').append(lead, dev);
}

// ---------- Selected work ----------
function renderRows() {
  const rows = $('#rows');
  SHOWN.filter((p) => p.tier === 'front').forEach((p) => {
    rows.append(el('article', { class: 'card row', id: 'p-' + p.id }, [
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

// ---------- the wall ----------
let filter = 'all';
function renderWall() {
  const counts = {};
  ALL.forEach((p) => { counts[p.type] = (counts[p.type] || 0) + 1; });
  $('#fact-repos').textContent = SITE.repos;
  $('#fact-art').textContent = ART.length;

  const chips = $('#chips');
  const mk = (key, label, n) => el('button', { type: 'button', class: 'chip', 'aria-pressed': key === filter ? 'true' : 'false', 'data-f': key,
    onclick: () => { filter = key; paint(); } }, [label, el('span', { text: n })]);
  chips.append(mk('all', 'All', ALL.length), ...Object.keys(TYPES).filter((k) => counts[k]).map((k) => mk(k, TYPES[k], counts[k])));

  const wall = $('#wall');
  ALL.forEach((p) => {
    const b = el('button', { type: 'button', class: 'tile', 'data-type': p.type, onclick: () => openSheet(p) }, [
      p.poster ? el('span', { class: 'tile-pic', style: tint(p.poster) }, pic(p.poster, { small: true }))
        : (() => { const s = sprite(p.id, p.type); return el('span', { class: 'tile-pic is-sprite', style: `background:${s.bg}` }, el('img', { src: s.url, alt: '', width: 16, height: 16 })); })(),
      el('span', { class: 'tile-name', text: p.name }),
      el('span', { class: 'tile-meta', text: [TYPE[p.type], p.year].join(', ') }),
    ]);
    wall.append(el('li', { 'data-type': p.type }, b));
  });
  wall.append(el('li', { class: 'tile-more', 'data-type': 'more' }, [
    el('b', { text: '+' + (SITE.repos - ALL.length) }),
    el('span', { text: 'more repos: smaller tools, experiments, and client and team work that stays private.' }),
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
  const at = artAt, src = 'images/' + ART[at], m = MEDIA[src], img = $('#viewer-img');
  img.alt = `Pixel art ${at + 1} of ${ART.length}`;
  $('#viewer-count').textContent = `${at + 1} / ${ART.length}`;
  if (!m) { img.src = src; return; }
  // the small copy is on screen at once, at the size of the real one, and the real one takes over when it has arrived
  img.style.aspectRatio = `${m.w} / ${m.h}`;
  img.style.width = `min(92vw, 1100px, ${m.w}px, calc(78dvh * ${(m.w / m.h).toFixed(4)}))`;
  img.src = m.t;
  const full = new Image();
  const swap = () => { if (artAt === at && viewer.open) img.src = src; };
  full.src = src;
  full.decode().then(swap, swap);
}
function renderArt() {
  const grid = $('#art-grid');
  ART.forEach((f, i) => {
    const src = 'images/' + f, m = MEDIA[src] || {};
    const img = pic(src, { small: true });
    const b = el('button', { type: 'button', 'aria-label': `Open pixel art ${i + 1}`, style: tint(src), onclick: () => { showArt(i); viewer.showModal(); } }, img);
    if (m.a === 2) {
      // too heavy to animate in the grid: it starts moving when you point at it
      b.append(el('span', { class: 'gif-tag', text: 'GIF' }));
      b.addEventListener('pointerenter', () => { img.src = src; }, { once: true });
    }
    grid.append(el('li', {}, b));
  });
  grid.append(el('li', { class: 'art-more' }, [el('b', { text: '+ more' }), el('span', { text: 'These are the published ones. Plenty more are not online yet. Ask me if you want to see them.' })]));
  viewer.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => showArt(artAt + Number(b.dataset.step))));
  viewer.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') showArt(artAt + 1); if (e.key === 'ArrowLeft') showArt(artAt - 1); });
}

// close buttons and click-outside for all three dialogs
document.querySelectorAll('dialog').forEach((d) => {
  d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.addEventListener('close', () => d.querySelectorAll('video').forEach((v) => v.pause()));
});

// ---------- page colour: each section has its own, and they blend as you scroll ----------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const sections = [...document.querySelectorAll('[data-bg]')].map((s) => ({ el: s, rgb: hex(s.dataset.bg) }));
const theme = document.querySelector('meta[name="theme-color"]');
let lastBg = '';
function pageColour() {
  const mid = innerHeight * 0.5, band = innerHeight * 0.26;
  let c = sections[0].rgb;
  for (let k = 1; k < sections.length; k++) {
    const top = sections[k].el.getBoundingClientRect().top;
    let t = (mid + band - top) / (2 * band);
    t = Math.min(1, Math.max(0, t)); t = t * t * (3 - 2 * t);
    if (t > 0) c = c.map((v, i) => v + (sections[k].rgb[i] - v) * t);
  }
  const css = `rgb(${c.map((v) => Math.round(v)).join(',')})`;
  if (css !== lastBg) { lastBg = css; document.body.style.backgroundColor = css; if (theme) theme.content = css; }
  return css;
}

// ---------- live numbers ----------
// The day counts shipped in data/activity.js are a snapshot. The page starts at once with the newest counts it
// already has (the snapshot, or what an earlier visit saved), and asks GitHub for today's counts in the background.
// When they arrive the numbers in the text update, and the next visit builds its cubes from them.
const KEY = 'tay-contributions-v1';
const firstDay = Object.keys(ACTIVITY).sort()[0];
const baseTotal = Object.values(ACTIVITY).reduce((a, d) => a + d[0], 0);
function mergeActivity(list) {
  if (!Array.isArray(list)) return null;
  const out = {};
  let total = 0;
  for (const c of list) if (c[1] > 0 && c[0] >= firstDay) { out[c[0]] = [c[1], (ACTIVITY[c[0]] || [])[1] || '']; total += c[1]; }
  return total >= baseTotal * 0.9 ? out : null;            // a much lower total means the source lost the private days
}
function showNumbers(activity) {
  const commits = Object.values(activity).reduce((a, d) => a + d[0], 0);
  $('#fact-commits').textContent = num(commits);
  $('#all-lead').textContent = `${num(commits)} contributions on ${Object.keys(activity).length} days since July 2024, private work included. Here the same blocks sort themselves by what each day went into.`;
}
function activityNow() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(KEY)); } catch (err) { /* no storage, no cache */ }
  const have = (cached && mergeActivity(cached.list)) || ACTIVITY;
  if (!cached || Date.now() - cached.t > 3 * 3600e3) {
    const years = [];
    for (let y = Number(firstDay.slice(0, 4)); y <= new Date().getFullYear(); y++) years.push('y=' + y);
    fetch(`https://github-contributions-api.jogruber.de/v4/${SITE.github}?${years.join('&')}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('status ' + r.status))))
      .then((j) => {
        const list = j.contributions.filter((c) => c.count > 0).map((c) => [c.date, c.count]);
        const fresh = mergeActivity(list);
        if (!fresh) return;
        try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), list })); } catch (err) { /* fine */ }
        showNumbers(fresh);
      })
      .catch(() => {});
  }
  return have;
}

// ---------- the cubes ----------
async function startWorld() {
  const tip = $('#sky-tip'), labels = $('#sky-labels'), stackLabels = $('#stack-labels');
  const activity = activityNow();
  showNumbers(activity);

  let mod;
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');
    mod = await import('./blocks.js');
  } catch (err) {
    document.body.classList.add('no-3d');
    flatSky($('#stage-sky'));
    $('#sky-start').hidden = true;
    addEventListener('scroll', pageColour, { passive: true }); pageColour();
    return;
  }
  const days = mod.buildDays(activity);

  // what each active day went into
  const cats = [
    { key: 'game', name: 'Games', short: 'Games', color: '#d95763' },
    { key: 'app', name: 'Apps', short: 'Apps', color: '#2fa9d6' },
    { key: 'tool', name: 'Tools', short: 'Tools', color: '#f2b631' },
    { key: 'site', name: 'Websites\nand courses', short: 'Sites', color: '#9484dd' },
    { key: 'team', name: 'Team work', short: 'Team', color: '#ff8fa8' },
    { key: 'private', name: 'Private\nand client', short: 'Private', color: '#35c93c', wide: true },
  ];
  const typeOfRepo = new Map([...Object.entries(REPO_TYPES), ...PROJECTS.filter((p) => p.repo).map((p) => [p.repo, p.type])]);
  const catIndex = Object.fromEntries(cats.map((c, i) => [c.key, i]));
  const cat = days.map((d) => {
    const top = d.what.split(', ')[0];
    if (top === 'private work' || !top) return catIndex.private;
    if (top === 'team work') return catIndex.team;
    const type = typeOfRepo.get(top) || 'tool';
    return catIndex[type === 'learn' ? 'site' : type];
  });

  // Flags on the skyline: the projects named in SITE.flags, in that order. Each sits on its "when" from
  // data/projects.js (a day, or just a year), or else on the busiest day of its public repo.
  const monthYear = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const marks = [];
  (SITE.flags || []).forEach((id) => {
    const p = [NOW.lead, ...SHOWN].find((x) => x.id === id);
    if (!p) return;
    let d = null, label = '';
    if (p.when && String(p.when).length === 4) {
      const inYear = days.filter((x) => x.date.startsWith(p.when));
      d = inYear[Math.floor(inYear.length / 2)]; label = String(p.when);
    } else if (p.when) d = days.find((x) => x.date >= p.when);
    else if (p.repo) days.forEach((x) => { if (x.what.split(', ')[0] === p.repo && (!d || d.n < x.n)) d = x; });
    if (d) marks.push({ ...d, name: p.name, pid: p.id, label: label || monthYear.format(new Date(d.date)) });
  });
  const markEls = marks.map((m) => {
    const a = el('a', { class: 'sky-label', href: '#everything' }, [m.name, el('span', { text: m.label })]);
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const p = ALL.find((x) => x.id === m.pid);
      if (p) openSheet(p); else $('#now').scrollIntoView({ behavior: 'smooth' });
    });
    labels.append(a);
    return a;
  });

  const fmt = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const game = $('#sky-game'), over = $('#sky-over'), count = $('#sky-count');
  let stackEls = [];

  const world = mod.createBlocks($('#world'), {
    days, cat, cats, artCubes: VOXEL_CELLS,
    stages: { sky: $('#stage-sky'), stacks: $('#stage-stacks'), art: $('#stage-art'), hi: $('#stage-hi') },
    floor: '#fffaf1', ink: '#210b1b', hiFront: '#fffaf1', hiFloor: '#f7c948',
    background: pageColour,
    onHover(d, pos) {
      if (!d || !pos) { tip.hidden = true; return; }
      tip.hidden = false;
      tip.textContent = d.n ? `${fmt.format(new Date(d.date))}: ${d.n} contribution${d.n > 1 ? 's' : ''}${d.what ? ', ' + d.what : ''}` : `${fmt.format(new Date(d.date))}: nothing on GitHub`;
      tip.style.left = Math.min(Math.max(pos.x, 130), innerWidth - 130) + 'px';
      tip.style.top = pos.y + 'px';
    },
    onFrame(s) {
      const placed = [];
      // on a phone the labels stay inside the skyline's own area, clear of the buttons above it
      const minY = innerWidth < 760 ? $('#stage-sky').getBoundingClientRect().top + 60 : 110;
      // No flag may sit on another flag or on its pole. A flag that has no room to the right of its pole
      // tries the left side, and the ones higher up in data/projects.js get to choose first.
      const cross = (f, n) => f.px > n.x - 4 && f.px < n.x + n.w + 4 && f.y > n.y - 68 && f.y < n.y + 2;      // f's pole through n's label
      const hit = (a, b) => (Math.abs(a.y - b.y) < 42 && a.x < b.x + b.w + 10 && b.x < a.x + a.w + 10) || cross(a, b) || cross(b, a);
      const minX = innerWidth * (innerWidth < 760 ? 0.03 : 0.46);
      marks.forEach((m, i) => {
        const e = markEls[i];
        let at = null;
        if (s.skyOn) {
          const p = s.projectDay(m.i, 0.2), w = e.offsetWidth;
          if (p.y > minY && p.y < innerHeight - 40) {
            for (const flip of [false, true]) {
              const me = { x: flip ? p.x - w + 8 : p.x - 8, y: p.y, w, px: p.x, flip };
              if (me.x > minX && me.x + w < innerWidth - 6 && placed.every((q) => !hit(me, q))) { at = me; break; }
            }
          }
        }
        if (at) {
          e.classList.toggle('flip', at.flip);
          e.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
          placed.push(at);
        }
        e.style.visibility = at ? '' : 'hidden';        // hidden, not removed, so its width can still be measured
      });
      stackEls.forEach((e, k) => {
        if (!s.stacksOn) { e.style.display = 'none'; return; }
        const p = s.projectStack(k);
        e.style.display = ''; e.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translateY(-100%)`;      // the label sits on top of its stack, however many lines it has
      });
    },
    onGame(g) {
      if (g.state === 'idle') { game.hidden = true; document.body.classList.remove('is-playing'); return; }
      game.hidden = false; tip.hidden = true; document.body.classList.add('is-playing');
      count.hidden = g.state !== 'count';
      if (g.state === 'count') count.textContent = g.n;
      $('#sky-score').textContent = num(g.score);
      $('#sky-date').textContent = g.date ? 'at ' + fmt.format(new Date(g.date)) : '';
      over.hidden = g.state !== 'over';
      if (g.state === 'over') {
        const pct = Math.round((g.score / g.total) * 100);
        $('#sky-over-text').textContent = `You made it back to July 2024 and ate ${num(g.score)} of my ${num(g.total)} contributions. That's ${pct}%.`;
        $('#sky-again').focus();
      }
    },
  });

  // the animated character is a big file, so it comes in after everything else is running
  import('../data/voxel.js').then((m) => world.setArt(m.VOXEL)).catch(() => {});

  stackEls = world.stackInfo.map((s) => {
    const e = el('div', { class: 'stack-label' }, [el('b', { class: 'long', text: s.name }), el('b', { class: 'short', text: s.short }), el('span', { text: `${s.days} days` })]);
    stackLabels.append(e);
    return e;
  });

  $('#sky-start').addEventListener('click', () => { scrollTo({ top: 0, behavior: 'smooth' }); world.play(); });
  $('#sky-again').addEventListener('click', () => world.play());
  $('#sky-quit').addEventListener('click', () => world.stop());
  // while playing, you look down the strip from behind the runner
  const lanes = { ArrowLeft: 1, ArrowRight: -1, a: 1, d: -1 };
  addEventListener('keydown', (e) => {
    if (!world.playing) return;
    if (e.key === 'Escape') { world.stop(); return; }
    const k = lanes[e.key] || lanes[e.key.toLowerCase()];
    if (k) { e.preventDefault(); world.turn(k); }
    else if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
  });
  addEventListener('pointerdown', (e) => {
    if (!world.playing || (e.target.closest && e.target.closest('a, button, header'))) return;
    world.turn(e.clientX < innerWidth / 2 ? 1 : -1);
  });
  addEventListener('scroll', () => { if (world.playing && scrollY > innerHeight * 0.6) world.stop(); }, { passive: true });

  window.__site = { world, days, marks, openSheet, ALL };
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

// ---------- header ----------
// A small green block sits under the link of the section you are in, and on a phone the links fold into a menu.
function header() {
  const links = [...document.querySelectorAll('#nav-links a')].map((a) => ({ a, target: document.querySelector(a.getAttribute('href')) })).filter((l) => l.target);
  let queued = false;
  const mark = () => {
    queued = false;
    let now = null;
    for (const l of links) if (l.target.getBoundingClientRect().top < innerHeight * 0.45) now = l;
    if ($('#contact').getBoundingClientRect().top < innerHeight * 0.45) now = null;      // the last section has the button, not a link
    links.forEach((l) => { if (l === now) l.a.setAttribute('aria-current', 'true'); else l.a.removeAttribute('aria-current'); });
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(mark); } }, { passive: true });
  mark();

  const top = $('.top'), toggle = $('#nav-toggle');
  const set = (open) => { top.classList.toggle('open', open); toggle.setAttribute('aria-expanded', open ? 'true' : 'false'); toggle.textContent = open ? 'Close' : 'Menu'; };
  toggle.addEventListener('click', () => set(!top.classList.contains('open')));
  top.querySelectorAll('nav a').forEach((a) => a.addEventListener('click', () => set(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
}

// ---------- warm up ----------
// Once the page itself is up and the browser has a quiet moment, fetch the pictures further down in page order,
// a few at a time. By the time you scroll there they are already here.
function warmUp() {
  const c = navigator.connection;
  if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
  const list = [
    ...SHOWN.filter((p) => p.tier === 'front' && p.poster).map((p) => p.poster),
    MEDIA[NOW.lead.image] && MEDIA[NOW.lead.image].t,
    ...ALL.filter((p) => p.poster && MEDIA[p.poster]).map((p) => MEDIA[p.poster].t),
    ...ART.map((f) => MEDIA['images/' + f] && MEDIA['images/' + f].t),
  ].filter(Boolean);
  const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1200 }) : setTimeout(f, 200));
  let at = 0;
  const next = () => {
    if (at >= list.length) return;
    const img = new Image();
    img.onload = img.onerror = () => idle(next);
    img.src = list[at++];
  };
  idle(() => { for (let k = 0; k < 4; k++) next(); });
}

header();
renderNow();
renderRows();
renderWall();
renderArt();
pageColour();
startWorld();
if (document.readyState === 'complete') warmUp(); else addEventListener('load', warmUp, { once: true });
