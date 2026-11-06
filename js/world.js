// Builds the Arcade Room. Everything content-related is read from the HTML,
// so adding a project, art piece, skill or contact link means editing index.html only.
import * as THREE from 'three';
import * as T from './textures.js';

export const ROOM = { x: 14, z: 14, h: 7.5 };
const HDR = (v) => new THREE.Color(v, v, v);

export function buildWorld({ scene, loadTexture }) {
  const W = { interactive: [], videos: [], animated: [], hoverables: [] };

  // ---------- helpers ----------
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.05, ...o });
  const basic = (o) => new THREE.MeshBasicMaterial({ toneMapped: false, ...o });
  const glowTex = T.glowTexture('#ffffff');
  const glowDecal = (color, w, h, opacity = 0.5) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.012; return m;
  };
  const makeVideo = (src) => {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.src = src;
    return v;
  };
  // Screen that shows a poster image until its video is near the camera, then plays the video.
  const videoScreen = (mat, src, poster, stations, { nearest = false } = {}) => {
    if (poster) loadTexture(poster, (t) => { if (nearest) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; } if (!mat.userData.live) { mat.map = t; mat.needsUpdate = true; } });
    if (!src) return;
    const video = makeVideo(src);
    const entry = { video, stations, started: false };
    video.addEventListener('playing', () => {
      if (mat.userData.live) return;
      const vt = new THREE.VideoTexture(video);
      vt.colorSpace = THREE.SRGBColorSpace;
      if (nearest) { vt.magFilter = vt.minFilter = THREE.NearestFilter; }
      vt.generateMipmaps = false;
      mat.map = vt; mat.userData.live = true; mat.needsUpdate = true;
    }, { once: true });
    W.videos.push(entry);
  };
  const register = (root, hitMeshes, info) => {
    root.userData.info = info;
    root.userData.hover = 0;
    hitMeshes.forEach((m) => { m.userData.root = root; });
    W.interactive.push(...hitMeshes);
    W.hoverables.push(root);
  };

  // ---------- room shell ----------
  scene.background = new THREE.Color('#0f0805');
  scene.fog = new THREE.Fog('#140b07', 20, 46);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z * 2), std({ map: T.carpetTexture(), roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z * 2), std({ color: '#140b08', roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM.h; scene.add(ceil);

  const wallTex = T.wallTexture();
  const wallMat = std({ map: wallTex, color: '#c9a58a', roughness: 0.9 });
  const trimMat = std({ color: '#3a2216', roughness: 0.7 });
  const neonAmber = basic({ color: HDR(1.0).multiply(new THREE.Color('#f59e0b')).multiplyScalar(2.2) });
  const neonMagenta = basic({ color: new THREE.Color('#ff4fa3').multiplyScalar(1.8) });
  const walls = [
    { pos: [0, 0, -ROOM.z], rot: 0 }, { pos: [0, 0, ROOM.z], rot: Math.PI },
    { pos: [-ROOM.x, 0, 0], rot: Math.PI / 2 }, { pos: [ROOM.x, 0, 0], rot: -Math.PI / 2 },
  ];
  for (const w of walls) {
    const g = new THREE.Group(); g.position.set(...w.pos); g.rotation.y = w.rot;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.h), wallMat);
    plane.position.y = ROOM.h / 2; g.add(plane);
    const base = new THREE.Mesh(new THREE.BoxGeometry(ROOM.x * 2, 0.32, 0.08), trimMat); base.position.set(0, 0.16, 0.04); g.add(base);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(ROOM.x * 2, 0.08, 0.1), trimMat); rail.position.set(0, 1.25, 0.05); g.add(rail);
    const neonTop = new THREE.Mesh(new THREE.BoxGeometry(ROOM.x * 2, 0.06, 0.06), neonAmber); neonTop.position.set(0, ROOM.h - 0.35, 0.08); g.add(neonTop);
    const neonLow = new THREE.Mesh(new THREE.BoxGeometry(ROOM.x * 2, 0.04, 0.04), neonMagenta); neonLow.position.set(0, 0.36, 0.1); g.add(neonLow);
    scene.add(g);
  }

  // ceiling light panels
  const panelMat = basic({ color: new THREE.Color('#ffd9a0').multiplyScalar(1.25) });
  for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), panelMat);
    p.rotation.x = Math.PI / 2; p.position.set(ix * 8, ROOM.h - 0.02, iz * 8); scene.add(p);
  }

  // lights: small readable stack, warm key + colored practicals per zone
  scene.add(new THREE.HemisphereLight('#ffc48a', '#2a1208', 1.1));
  const pl = (c, i, x, y, z, d = 24) => { const l = new THREE.PointLight(c, i, d, 1.6); l.position.set(x, y, z); scene.add(l); return l; };
  pl('#ffb347', 70, 0, 6.4, -7);      // arcade
  pl('#ff7ab0', 45, -9, 6, -1);       // gallery
  pl('#5eead4', 40, 9, 6, -2);        // inventory
  pl('#ffcf7a', 45, 3, 6, 9);         // quest board
  pl('#ffd8a8', 30, 0, 4.5, 6.5);     // portrait

  // neon wall sign
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.56), basic({ map: T.neonText('TAYMCQUAYA', '#f59e0b'), transparent: true, depthWrite: false, color: HDR(1.6) }));
  sign.position.set(0, 6.05, -ROOM.z + 0.06); scene.add(sign);
  const sub = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.66), basic({ map: T.neonText('~ THE ARCADE ~', '#ff4fa3', { size: 64 }), transparent: true, depthWrite: false, color: HDR(1.4) }));
  sub.position.set(0, 5.05, -ROOM.z + 0.06); scene.add(sub);

  // ---------- portrait pedestal ----------
  const ped = new THREE.Group(); ped.position.set(0, 0, 1);
  ped.add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.65, 0.28, 32), std({ color: '#24140d', roughness: 0.5, metalness: 0.3 })));
  ped.children[0].position.y = 0.14;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.035, 6, 48), neonAmber); ring.rotation.x = Math.PI / 2; ring.position.y = 0.29; ped.add(ring);
  ped.add(glowDecal('#f59e0b', 5, 5, 0.35));
  scene.add(ped);

  // ---------- arcade cabinets ----------
  const profile = [[-0.42, 0], [0.40, 0], [0.40, 0.92], [0.62, 0.98], [0.62, 1.06], [0.30, 1.18], [0.22, 1.22], [0.04, 1.98], [0.30, 2.06], [0.30, 2.38], [-0.42, 2.38]];
  const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
  const CAB_W = 1.25;
  const cabGeo = new THREE.ExtrudeGeometry(shape, { depth: CAB_W, bevelEnabled: false });
  cabGeo.rotateY(-Math.PI / 2); cabGeo.translate(CAB_W / 2, 0, 0);
  const cabEdges = new THREE.EdgesGeometry(cabGeo, 25);
  const SCREEN_ANG = Math.atan2(0.18, 0.76);
  const screenN = new THREE.Vector3(0, Math.sin(SCREEN_ANG), Math.cos(SCREEN_ANG));
  const darkMetal = std({ color: '#141010', roughness: 0.4, metalness: 0.6 });
  const black = basic({ color: '#050303' });
  const bodyMat = std({ color: '#1a0f0b', roughness: 0.55 });

  function cabinet({ title, accent, featured = false, video, poster, canvasTex, stations }) {
    const root = new THREE.Group();
    const sideMat = std({ map: T.sideArtTexture(accent), roughness: 0.6 });
    sideMat.map.wrapS = sideMat.map.wrapT = THREE.RepeatWrapping;
    const body = new THREE.Mesh(cabGeo, [sideMat, bodyMat]); root.add(body);
    const edges = new THREE.LineSegments(cabEdges, new THREE.LineBasicMaterial({ color: new THREE.Color(accent).multiplyScalar(featured ? 1.8 : 1.3), toneMapped: false }));
    root.add(edges);

    const sc = new THREE.Group(); sc.position.set(0, 1.60, 0.13); sc.rotation.x = -SCREEN_ANG; root.add(sc);
    const bezel = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.74), black); bezel.position.z = 0.004; sc.add(bezel);
    const screenMat = basic({ color: HDR(featured ? 1.25 : 1.1) });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.54), screenMat); screen.position.z = 0.008; sc.add(screen);
    if (canvasTex) { screenMat.map = canvasTex; W.animated.push(canvasTex); }
    else videoScreen(screenMat, video, poster, stations);

    const marquee = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), basic({ map: T.marqueeTexture(title, accent), color: HDR(1.35) }));
    marquee.position.set(0, 2.22, 0.305); root.add(marquee);

    // control panel
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.13, 6), darkMetal); stick.position.set(-0.3, 1.18, 0.47); root.add(stick);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), std({ color: '#ef4444', roughness: 0.3 })); ball.position.set(-0.3, 1.25, 0.47); root.add(ball);
    ['#fbbf24', accent, '#ef4444'].forEach((c, i) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10), std({ color: c, emissive: c, emissiveIntensity: 0.5, roughness: 0.3 }));
      b.position.set(0.0 + i * 0.14, 1.13 - i * 0.012, 0.47 - i * 0.03); b.rotation.x = -0.36; root.add(b);
    });
    // coin door
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.42), darkMetal); door.position.set(0, 0.55, 0.402); root.add(door);
    [-0.08, 0.08].forEach((x) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.09), basic({ color: new THREE.Color('#ef4444').multiplyScalar(1.6) })); s.position.set(x, 0.63, 0.404); root.add(s); });
    root.add(glowDecal(accent, 2.2, 1.8, featured ? 0.6 : 0.4));

    root.userData.edges = edges;
    return { root, hits: [body, screen, marquee] };
  }

  const projectEls = [...document.querySelectorAll('#projects .project')];
  const regular = projectEls.filter((el) => !el.dataset.soon);
  const soonEl = projectEls.find((el) => el.dataset.soon);
  const ARC = { cx: 0, cz: -7, r: 6 };
  const slots = [-74, -50, -26, 26, 50, 74];
  regular.slice(0, slots.length).forEach((el, i) => {
    const a = THREE.MathUtils.degToRad(slots[i]);
    const name = el.querySelector('.project-name').textContent;
    const { root, hits } = cabinet({ title: name, accent: el.dataset.accent, video: el.dataset.video, poster: el.dataset.poster, stations: [2, 3] });
    root.position.set(ARC.cx + ARC.r * Math.sin(a), 0, ARC.cz - ARC.r * Math.cos(a));
    root.rotation.y = -a;
    scene.add(root);
    register(root, hits, { kind: 'project', el, label: name });
  });

  // featured: Panel Haus
  const featEl = document.querySelector('#now-playing .project');
  if (featEl) {
    const phTex = T.panelHausScreen();
    const { root, hits } = cabinet({ title: 'PANEL HAUS', accent: '#fbbf24', featured: true, canvasTex: phTex });
    const stage = new THREE.Group(); stage.position.set(0, 0, ARC.cz - ARC.r);
    const plat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.24, 2.2), std({ color: '#2a1810', roughness: 0.5, metalness: 0.2 })); plat.position.y = 0.12; stage.add(plat);
    const platEdge = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.04, 2.24), neonAmber); platEdge.position.y = 0.25; stage.add(platEdge);
    root.scale.setScalar(1.3); root.position.y = 0.24; stage.add(root);
    const np = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.34), basic({ map: T.neonText('NOW PLAYING', '#ef4444', { size: 64 }), transparent: true, depthWrite: false, color: HDR(1.5) }));
    np.position.set(0, 3.55, 0.3); stage.add(np);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.7, 4.2, 24, 1, true), basic({ color: '#ffcf6b', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.set(0, 5.2, 0.4); stage.add(cone);
    const spot = new THREE.SpotLight('#ffd36b', 90, 14, 0.42, 0.6, 1.4); spot.position.set(0, 7.3, 1.2); spot.target = root; stage.add(spot);
    scene.add(stage);
    register(root, hits, { kind: 'project', el: featEl, label: 'Panel Haus', featured: true, canvas: phTex.userData.canvas });
  }

  // coming soon: corner cabinet with hazard tape
  if (soonEl) {
    const stTex = T.staticScreen();
    const { root, hits } = cabinet({ title: '???', accent: '#8b7355', canvasTex: stTex });
    root.position.set(10.6, 0, -11.2); root.rotation.y = Math.atan2(-10.6, 11.2 - 4) ;
    const [hc, hg] = T.makeCanvas(32, 4); for (let x = 0; x < 32; x += 8) { hg.fillStyle = '#fbbf24'; hg.fillRect(x, 0, 4, 4); hg.fillStyle = '#111'; hg.fillRect(x + 4, 0, 4, 4); }
    const tapeTex = T.toTexture(hc, { repeat: [4, 1] });
    [0.5, -0.5].forEach((r) => { const t = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.09, 0.01), std({ map: tapeTex })); t.position.set(0, 1.62, 0.42); t.rotation.z = r; root.add(t); });
    scene.add(root);
    register(root, hits, { kind: 'project', el: soonEl, label: 'Coming Soon' });
  }

  // ---------- gallery wall (west) ----------
  const artEls = [...document.querySelectorAll('#art .art')];
  const gallery = new THREE.Group(); gallery.position.set(-ROOM.x + 0.05, 0, -1); gallery.rotation.y = Math.PI / 2;
  const frameMat = std({ color: '#3a2216', roughness: 0.5, metalness: 0.15 });
  const lampMat = basic({ color: new THREE.Color('#ffe2a8').multiplyScalar(1.8) });
  const COLS = 6, CELL = 2.2, BOX = 1.72;
  artEls.forEach((el, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const img = el.querySelector('img');
    const root = new THREE.Group();
    root.position.set((col - (COLS - 1) / 2) * CELL, row === 0 ? 4.6 : 2.3, 0.02);
    const mat = basic({ color: HDR(1.0) });
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); art.position.z = 0.05; root.add(art);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.07), frameMat); frame.position.z = 0.012; root.add(frame);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic({ map: glowTex, color: '#ffb347', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.z = -0.01; root.add(halo);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.08), lampMat); root.add(lamp);
    const sizeTo = (w, h) => {
      const s = w >= h ? [BOX, BOX * h / w] : [BOX * w / h, BOX];
      art.scale.set(s[0], s[1], 1); frame.scale.set(s[0] + 0.16, s[1] + 0.16, 1); halo.scale.set(s[0] + 1.2, s[1] + 1.2, 1);
      lamp.position.set(0, s[1] / 2 + 0.2, 0.12);
    };
    sizeTo(1, 1);
    const tex = el.dataset.tex;
    loadTexture(tex, (t) => { sizeTo(t.image.width, t.image.height); });
    videoScreen(mat, el.dataset.video, tex, [4], { nearest: true });
    gallery.add(root);
    register(root, [art, frame], { kind: 'art', index: i, el, label: img ? img.alt : 'Pixel art' });
  });
  scene.add(gallery);

  // posters: extra pieces from the archive, purely decorative
  const posters = [
    { src: 'assets/tex/art2.png', pos: [-10.4, 3.6, -ROOM.z + 0.06], rot: 0, h: 3.2 },
    { src: 'assets/tex/art20.png', pos: [10.4, 3.7, -ROOM.z + 0.06], rot: 0, h: 2.0 },
    { src: 'assets/tex/art3.png', pos: [ROOM.x - 0.06, 3.7, 8.2], rot: -Math.PI / 2, h: 2.0 },
    { src: 'assets/tex/art16.png', pos: [ROOM.x - 0.06, 3.7, -10.6], rot: -Math.PI / 2, h: 2.0 },
    { src: 'assets/tex/art17.png', pos: [-9.6, 3.8, ROOM.z - 0.06], rot: Math.PI, h: 2.0 },
  ];
  for (const p of posters) {
    const g = new THREE.Group(); g.position.set(...p.pos); g.rotation.y = p.rot;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic({ color: HDR(0.85) })); m.position.z = 0.03; g.add(m);
    const f = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.04), frameMat); g.add(f);
    loadTexture(p.src, (t) => {
      t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
      m.material.map = t; m.material.needsUpdate = true;
      const w = p.h * t.image.width / t.image.height; m.scale.set(w, p.h, 1); f.scale.set(w + 0.14, p.h + 0.14, 1);
    });
    scene.add(g);
  }

  // ---------- inventory shelf (east) ----------
  const skillEls = [...document.querySelectorAll('#skills .skills li')];
  const shelf = new THREE.Group(); shelf.position.set(ROOM.x - 0.45, 0, -2); shelf.rotation.y = -Math.PI / 2;
  const wood = std({ color: '#5a3418', roughness: 0.75 });
  const SW = 5.8, SH = 5.0, SD = 0.7;
  [-SW / 2, SW / 2].forEach((x) => { const u = new THREE.Mesh(new THREE.BoxGeometry(0.12, SH, SD), wood); u.position.set(x, SH / 2, 0); shelf.add(u); });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), std({ color: '#1c100b' })); back.position.set(0, SH / 2, -SD / 2 + 0.01); shelf.add(back);
  const boardYs = [0.3, 1.45, 2.6, 3.75, 4.9];
  const ledMat = basic({ color: new THREE.Color('#2dd4bf').multiplyScalar(1.6) });
  boardYs.forEach((y) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(SW, 0.1, SD), wood); b.position.set(0, y, 0); shelf.add(b);
    if (y > 0.5) { const led = new THREE.Mesh(new THREE.BoxGeometry(SW - 0.3, 0.025, 0.025), ledMat); led.position.set(0, y - 0.065, SD / 2 - 0.06); shelf.add(led); }
  });
  const sign2 = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.64), basic({ map: T.plankTexture('THE INVENTORY'), color: HDR(1.0) })); sign2.position.set(0, 5.5, 0); shelf.add(sign2);
  const cartMat = std({ color: '#2b2622', roughness: 0.5 });
  const cartAccents = ['#f59e0b', '#ef4444', '#2dd4bf', '#a855f7', '#84cc16', '#fbbf24', '#ff4fa3', '#f97316'];
  skillEls.forEach((el, i) => {
    const row = Math.floor(i / 4), col = i % 4;
    const root = new THREE.Group();
    root.position.set(-2.1 + col * 1.4, boardYs[3 - row] + 0.05 + 0.5, 0.02);
    root.rotation.x = -0.08;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.0, 0.16), cartMat); root.add(box);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.08, 0.2), cartMat); ridge.position.y = 0.46; root.add(ridge);
    const name = el.textContent.trim();
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.9), basic({ map: T.cartridgeLabel(el.dataset.emoji, name, cartAccents[i % cartAccents.length]), color: HDR(1.0) }));
    label.position.set(0, -0.02, 0.082); root.add(label);
    root.userData.base = root.position.clone();
    shelf.add(root);
    register(root, [box, label], { kind: 'skill', el, label: name, pop: true });
  });
  scene.add(shelf);

  // ---------- quest board (south) + exit door ----------
  const board = new THREE.Group(); board.position.set(4, 0, ROOM.z - 0.06); board.rotation.y = Math.PI;
  const bf = new THREE.Mesh(new THREE.BoxGeometry(5.0, 3.3, 0.1), wood); bf.position.set(0, 3.0, 0.05); board.add(bf);
  const cork = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 3.0), std({ map: T.corkTexture(), roughness: 1 })); cork.position.set(0, 3.0, 0.105); board.add(cork);
  const title = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.62), basic({ map: T.plankTexture('★ QUEST BOARD ★'), color: HDR(1.0) })); title.position.set(0, 5.0, 0.08); board.add(title);
  const contactEls = [...document.querySelectorAll('#contact a.contact')];
  const notePos = [[-1.6, 3.75, 0.05], [0, 3.85, -0.04], [1.6, 3.7, 0.06], [-0.8, 2.3, -0.05], [0.85, 2.25, 0.04]];
  const pinMat = std({ color: '#ef4444', roughness: 0.3 });
  const notes = contactEls.map((el) => ({ el, title: el.dataset.note, sub: el.dataset.sub }));
  const avail = document.querySelector('#contact .available');
  if (avail) notes.push({ title: 'OPEN FOR HIRE', sub: avail.textContent.trim(), tint: '#d9f0b8', el: contactEls.find((a) => a.href.startsWith('mailto')) });
  notes.slice(0, notePos.length).forEach((n, i) => {
    const root = new THREE.Group(); root.position.set(notePos[i][0], notePos[i][1], 0.12); root.rotation.z = notePos[i][2];
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.04), basic({ map: T.noteTexture(n.title, n.sub, n.tint), color: HDR(0.95) })); root.add(paper);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), pinMat); pin.position.set(0, 0.42, 0.04); root.add(pin);
    root.userData.base = root.position.clone();
    board.add(root);
    register(root, [paper], { kind: 'note', el: n.el, label: n.el ? `Open ${n.title}` : n.title, pop: true });
  });
  scene.add(board);

  const door = new THREE.Group(); door.position.set(-5, 0, ROOM.z - 0.04); door.rotation.y = Math.PI;
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.2), black); hole.position.set(0, 1.6, 0.02); door.add(hole);
  [[-1.08, 1.65, 0.16, 3.3], [1.08, 1.65, 0.16, 3.3], [0, 3.28, 2.32, 0.16]].forEach(([x, y, w, h]) => { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), trimMat); f.position.set(x, y, 0.05); door.add(f); });
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.34), basic({ map: T.neonText('EXIT', '#ef4444', { w: 256, h: 72, size: 40 }), transparent: true, depthWrite: false, color: HDR(1.5) }));
  exit.position.set(0, 3.75, 0.06); door.add(exit);
  scene.add(door);

  return W;
}
