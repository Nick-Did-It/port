'use strict';
// Best first; anything not listed follows in pieces.json order.
const ORDER = ['chiral', 'soul-scale', 'emberlea', 'amber-candle-film-v002', 'visualizer',
  'skincare', 'soccer', 'opal-lighting-study-v002', 'afterhours-headphones-study-v001', 'amber-candle-study-v001'];
// TV body in the 1920x1080 scene frame, as fractions.
const TV = { x: 0.724, y: 0.52, w: 0.205, h: 0.245 };

const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
let works = [];
let vimeo = {};
let current = 0;

// ---------- grid ----------
function tile(w, i) {
  const art = el('article', 'piece');
  if (w.asset.width > w.asset.height) art.classList.add('wide');
  const btn = el('button', 'piece-media');
  btn.type = 'button';
  btn.setAttribute('aria-label', `Watch ${w.piece.name}`);
  const img = el('img');
  Object.assign(img, { src: w.asset.poster || w.asset.file, alt: w.piece.alt || '', loading: 'lazy', decoding: 'async', width: w.asset.width, height: w.asset.height });
  btn.append(img);
  if (w.piece.kind === 'video') btn.append(el('span', 'play-label'));
  btn.addEventListener('click', () => openViewer(i));
  const meta = el('div', 'piece-meta');
  meta.append(el('span', 'tag', w.piece.type), el('span', 'format', w.piece.kind === 'video' ? 'Video' : 'Still'));
  art.append(btn, meta, el('h3', '', w.piece.name), el('p', 'description', w.piece.description));
  return art;
}

// ---------- viewer ----------
const dlg = $('#viewer');
function show(i) {
  current = (i + works.length) % works.length;
  const w = works[current];
  const box = $('#v-media');
  box.querySelectorAll('video').forEach(v => v.pause());
  let m;
  if (w.piece.kind === 'video' && vimeo[w.piece.id]) {
    const u = new URL(vimeo[w.piece.id]);
    for (const [k, v] of Object.entries({ autoplay: 1, title: 0, byline: 0, portrait: 0, dnt: 1, color: 'E0702A' })) u.searchParams.set(k, v);
    m = el('iframe', 'v-vimeo');
    Object.assign(m, { src: u, allow: 'autoplay; fullscreen; picture-in-picture', title: w.piece.name });
    m.allowFullscreen = true;
    m.style.aspectRatio = `${w.asset.width} / ${w.asset.height}`;
    m.style.setProperty('--r', w.asset.width / w.asset.height);
  } else if (w.piece.kind === 'video') {
    m = el('video');
    Object.assign(m, { src: w.asset.file, poster: w.asset.poster || '', controls: true, playsInline: true, autoplay: true });
    m.addEventListener('ended', () => show(current + 1));
  } else {
    m = el('img');
    Object.assign(m, { src: w.asset.file, alt: w.piece.alt || '' });
  }
  box.replaceChildren(m);
  $('#v-count').textContent = `${current + 1} / ${works.length}`;
  $('#v-tag').textContent = w.piece.type || '';
  $('#v-title').textContent = w.piece.name;
  $('#v-desc').textContent = w.piece.description || '';
  [...$('#v-strip').children].forEach((t, k) => t.setAttribute('aria-current', k === current ? 'true' : 'false'));
  $('#v-strip').children[current]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}
function openViewer(i = 0) {
  if (!works.length) return;
  $('#scene').pause();
  dlg.showModal();
  show(i);
}
function closeViewer() {
  dlg.querySelectorAll('video').forEach(v => v.pause());
  $('#v-media').replaceChildren();
  if (dlg.open) dlg.close();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) $('#scene').play().catch(() => {});
}
$('#v-close').onclick = closeViewer;
$('#v-prev').onclick = () => show(current - 1);
$('#v-next').onclick = () => show(current + 1);
dlg.addEventListener('close', closeViewer);
dlg.addEventListener('keydown', e => {
  if (e.target.tagName === 'VIDEO' && (e.key === ' ')) return;
  if (e.key === 'ArrowRight') show(current + 1);
  if (e.key === 'ArrowLeft') show(current - 1);
});
let touchX = null;
$('#v-media').addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
$('#v-media').addEventListener('touchend', e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX; touchX = null;
  if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
});
$('#open-viewer').onclick = () => openViewer(0);
$('#tv').onclick = () => openViewer(0);

async function load() {
  const status = $('#load-status');
  try {
    const [p, a, v] = await Promise.all([fetch('pieces.json'), fetch('media/available.json'), fetch('vimeo.json').catch(() => null)]);
    if (v && v.ok) vimeo = await v.json();
    if (!p.ok || !a.ok) throw new Error('Missing collection data');
    const pieces = await p.json(), assets = await a.json();
    const rank = id => { const r = ORDER.indexOf(id); return r < 0 ? 999 : r; };
    works = pieces.filter(x => assets[x.id]).map(x => ({ piece: x, asset: assets[x.id] }))
      .sort((m, n) => rank(m.piece.id) - rank(n.piece.id));
    $('#piece-grid').replaceChildren(...works.map(tile));
    $('#piece-count').textContent = `${works.length} pieces`;
    $('#v-strip').replaceChildren(...works.map((w, i) => {
      const t = el('button', 'v-thumb'); t.type = 'button'; t.setAttribute('role', 'listitem');
      t.setAttribute('aria-label', w.piece.name);
      const im = el('img'); im.src = w.asset.poster || w.asset.file; im.alt = ''; im.loading = 'lazy';
      t.append(im); t.onclick = () => show(i); return t;
    }));
    status.hidden = works.length > 0;
    const hash = location.hash.slice(1);
    const at = works.findIndex(w => w.piece.id === hash);
    if (at >= 0) openViewer(at);
  } catch (err) {
    status.hidden = false;
    status.textContent = 'The collection could not load. Please try again, or contact Nick for samples.';
    console.error(err);
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) document.querySelectorAll('video').forEach(v => v.pause());
});
load();

// ---------- hero: garden scene loop, or moving geometry until it exists ----------
(function hero() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = $('#stage'), video = $('#scene'), canvas = $('#geo'), tv = $('#tv');
  const narrow = () => matchMedia('(max-aspect-ratio: 1/1)').matches;
  // Keep the TV hotspot glued to the TV however object-fit:cover crops the frame.
  function place() {
    if (video.hidden || narrow()) { tv.hidden = true; return; }
    const W = stage.clientWidth, H = stage.clientHeight, s = Math.max(W / 1920, H / 1080);
    const fx = parseFloat(getComputedStyle(video).objectPosition) / 100 || 0.5;
    const ox = (W - 1920 * s) * fx, oy = (H - 1080 * s) * 0.5;
    Object.assign(tv.style, { left: ox + TV.x * 1920 * s + 'px', top: oy + TV.y * 1080 * s + 'px', width: TV.w * 1920 * s + 'px', height: TV.h * 1080 * s + 'px' });
    tv.hidden = false;
  }
  addEventListener('resize', place);
  fetch('scene/manifest.json').then(r => r.ok ? r.json() : null).then(m => {
    if (!m) return;
    video.poster = narrow() && m.phone ? m.phone : m.poster;
    video.hidden = false; canvas.hidden = true; place();
    if (narrow()) return;
    video.src = m.webm && video.canPlayType('video/webm') ? m.webm : m.loop;
    if (!reduce) video.play().catch(() => {});
  }).catch(() => {});

  const ctx = canvas.getContext('2d');
  const colors = ['#E0702A', '#F2B33D', '#C2452D', '#7A8B3A', '#8C5A9E', '#F4D58D'];
  const shapes = Array.from({ length: 14 }, (_, i) => ({ sides: [3, 4, 6, 0][i % 4], c: colors[i % 6], x: Math.random(), y: Math.random(), r: 0.06 + Math.random() * 0.16, a: Math.random() * 6.28, s: (Math.random() - 0.5) * 0.004, dx: (Math.random() - 0.5) * 0.0006, dy: (Math.random() - 0.5) * 0.0004 }));
  function size() { canvas.width = canvas.clientWidth * devicePixelRatio; canvas.height = canvas.clientHeight * devicePixelRatio; }
  function draw() {
    if (canvas.hidden) return;
    const w = canvas.width, h = canvas.height, M = Math.max(w, h);
    ctx.clearRect(0, 0, w, h); ctx.globalCompositeOperation = 'multiply';
    for (const p of shapes) {
      ctx.beginPath(); const R = p.r * M;
      if (!p.sides) ctx.arc(p.x * w, p.y * h, R, 0, 6.29);
      else for (let k = 0; k <= p.sides; k++) { const t = p.a + k * 6.2832 / p.sides; ctx[k ? 'lineTo' : 'moveTo'](p.x * w + R * Math.cos(t), p.y * h + R * Math.sin(t)); }
      ctx.fillStyle = p.c + 'B0'; ctx.fill();
      p.a += p.s; p.x = (p.x + p.dx + 1.2) % 1.2 - 0.1; p.y = (p.y + p.dy + 1.2) % 1.2 - 0.1;
    }
    if (!reduce) requestAnimationFrame(draw);
  }
  size(); addEventListener('resize', size); draw();
})();
