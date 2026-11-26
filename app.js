'use strict';
// Best first; anything not listed follows in pieces.json order.
const ORDER = ['eros-and-erotica', 'soul-scale', 'chiral', 'room-that-assembles', 'animated-groove-deck', 'animated-rain-tram', 'ridge-no-01', 'boomerock', 'emberlea', 'amber-candle-film-v002', 'morning-grind', 'night-run', 'blender-melt', 'showreel', 'visualizer',
  'skincare', 'soccer', 'opal-lighting-study-v002', 'afterhours-headphones-study-v001', 'amber-candle-study-v001'];
const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
let works = [];
let vimeo = {};
let pendingOpen = null;
let current = 0;

// ---------- grid: muted previews that play while on screen ----------
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const seen = new IntersectionObserver(entries => {
  for (const e of entries) {
    const v = e.target;
    if (e.isIntersecting && !reduceMotion && !dlg.open && !document.hidden) {
      if (!v.hasAttribute('src')) v.src = v.dataset.src;
      v.play().catch(() => {});
    }
    else v.pause();
  }
}, { rootMargin: '120px 0px', threshold: 0.25 });
function tile(w, i) {
  const art = el('article', 'piece');
  const btn = el('button', 'piece-media');
  btn.type = 'button';
  btn.setAttribute('aria-label', `${w.piece.kind === 'video' ? 'Watch' : 'View'} ${w.piece.name}`);
  const poster = w.asset.poster || (w.piece.kind !== 'video' ? w.asset.file : '');
  if (w.asset.preview) {
    const v = el('video');
    Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'none', poster });
    v.defaultMuted = true;
    v.setAttribute('muted', ''); v.setAttribute('aria-hidden', 'true');
    v.dataset.src = w.asset.preview;
    btn.append(v); seen.observe(v);
  } else {
    const img = el('img');
    Object.assign(img, { src: poster, alt: w.piece.alt || '', loading: 'lazy', decoding: 'async' });
    btn.append(img);
  }
  btn.addEventListener('click', () => openViewer(i));
  const cap = el('div', 'piece-cap');
  cap.append(el('h3', '', w.piece.name), el('p', 'tag', w.piece.type || ''));
  art.append(btn, cap);
  return art;
}

// ---------- viewer ----------
const dlg = $('#viewer');
let stopVimeo = () => {};

function vimeoPlayer(w, source, box) {
  const u = new URL(source);
  const page = new URL(u.pathname.replace('/video/', '/'), 'https://vimeo.com');
  const hash = u.searchParams.get('h');
  if (hash) page.pathname += `/${hash}`;
  for (const [key, value] of Object.entries({ autoplay: 1, title: 0, byline: 0, portrait: 0, dnt: 1, color: 'E0702A', api: 1 })) {
    u.searchParams.set(key, value);
  }
  const m = el('iframe', 'v-vimeo');
  m.referrerPolicy = 'strict-origin-when-cross-origin';
  Object.assign(m, { src: u, allow: 'autoplay; fullscreen; picture-in-picture', title: w.piece.name });
  m.allowFullscreen = true;
  const width = Number(w.asset.width) || 16, height = Number(w.asset.height) || 9;
  m.style.aspectRatio = `${width} / ${height}`;
  m.style.setProperty('--r', width / height);

  const onMsg = ev => {
    if (ev.origin !== u.origin || ev.source !== m.contentWindow) return;
    let data = ev.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return; }
    }
    if (data?.event === 'ready' || data?.method === 'ping') stopVimeo();
  };
  m.addEventListener('load', () => m.contentWindow?.postMessage({ method: 'ping' }, u.origin));
  addEventListener('message', onMsg);
  // Safari can show a Vimeo privacy error on the first load. Retry once.
  const retry = setTimeout(() => {
    if (!dlg.open) return;
    const r = new URL(u);
    r.searchParams.set('_r', Date.now());
    m.src = r;
  }, 3500);
  const fallback = setTimeout(() => {
    stopVimeo();
    if (!dlg.open) return;
    const still = w.asset.preview ? el('video') : el('img');
    if (w.asset.preview) {
      Object.assign(still, { src: w.asset.preview, poster: w.asset.poster, autoplay: true, loop: true, muted: true, playsInline: true });
    } else {
      Object.assign(still, { src: w.asset.poster, alt: w.piece.alt || '' });
    }
    const note = el('a', 'v-fallback', 'Open full video on Vimeo');
    Object.assign(note, { href: page, target: '_blank', rel: 'noopener' });
    box.replaceChildren(still, note);
  }, 10000);
  stopVimeo = () => {
    clearTimeout(retry);
    clearTimeout(fallback);
    removeEventListener('message', onMsg);
  };
  return m;
}

function show(i) {
  current = (i + works.length) % works.length;
  const w = works[current];
  const box = $('#v-media');
  stopVimeo();
  box.querySelectorAll('video').forEach(v => v.pause());
  let m;
  if (w.piece.kind === 'video' && Object.hasOwn(vimeo, w.piece.id)) {
    m = vimeoPlayer(w, vimeo[w.piece.id], box);
  } else if (w.piece.kind === 'video') {
    m = el('video');
    Object.assign(m, { src: w.asset.file, poster: w.asset.poster || '', controls: true, playsInline: true, autoplay: true });
    m.addEventListener('ended', () => { if (m.isConnected && dlg.open) show(current + 1); });
  } else {
    m = el('img');
    Object.assign(m, { src: w.asset.file, alt: w.piece.alt || '' });
  }
  box.replaceChildren(m);
  $('#v-count').textContent = `${current + 1} / ${works.length}`;
  $('#v-tag').textContent = w.piece.type || '';
  $('#v-title').textContent = w.piece.name;
  $('#v-desc').textContent = w.piece.description || '';
  const strip = $('#v-strip');
  [...strip.children].forEach((t, k) => t.setAttribute('aria-current', k === current ? 'true' : 'false'));
  const thumb = strip.children[current];
  if (thumb) strip.scrollTo({
    left: strip.scrollLeft + thumb.getBoundingClientRect().left - strip.getBoundingClientRect().left
      - (strip.clientWidth - thumb.offsetWidth) / 2,
    behavior: reduceMotion ? 'auto' : 'smooth',
  });
}
function openViewer(i = 0) {
  if (!works.length) { pendingOpen = i; $('#open-viewer').classList.add('loading'); return; }
  $('#scene').pause();
  document.querySelectorAll('.piece video').forEach(v => v.pause());
  dlg.showModal();
  show(i);
}
function closeViewer() {
  if (dlg.open) return;
  stopVimeo();
  dlg.querySelectorAll('video').forEach(v => v.pause());
  $('#v-media').replaceChildren();
  document.querySelectorAll('.piece video').forEach(v => { seen.unobserve(v); seen.observe(v); });
  heroResume();
}
$('#v-close').onclick = () => dlg.close();
$('#v-prev').onclick = () => show(current - 1);
$('#v-next').onclick = () => show(current + 1);
dlg.addEventListener('close', closeViewer);
dlg.addEventListener('keydown', e => {
  if (e.target.tagName === 'VIDEO') return;
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  e.preventDefault();
  show(current + (e.key === 'ArrowRight' ? 1 : -1));
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
      const t = el('button', 'v-thumb'); t.type = 'button';
      t.setAttribute('aria-label', w.piece.name);
      const im = el('img'); im.src = w.asset.poster || w.asset.file; im.alt = ''; im.loading = 'lazy';
      t.append(im); t.onclick = () => show(i); return t;
    }));
    status.hidden = works.length > 0;
    if (!works.length) status.textContent = 'No work is available right now.';
    $('#open-viewer').classList.remove('loading');
    const hash = location.hash.slice(1);
    const at = works.findIndex(w => w.piece.id === hash);
    if (works.length && (at >= 0 || pendingOpen !== null)) openViewer(at >= 0 ? at : pendingOpen);
    pendingOpen = null;
  } catch (err) {
    status.hidden = false;
    status.textContent = 'The collection could not load. Please try again, or contact Nick for samples.';
    $('#open-viewer').classList.remove('loading');
    const retry = el('button', 'cta retry', 'Try again'); retry.type = 'button'; retry.onclick = () => { retry.remove(); status.textContent = 'Loading the work…'; load(); };
    status.after(retry);
    console.error(err);
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { document.querySelectorAll('video').forEach(v => v.pause()); return; }
  if (dlg.open) return;
  heroResume();
  document.querySelectorAll('.piece video').forEach(v => { seen.unobserve(v); seen.observe(v); });
});
load();

// ---------- hero: garden loop (landscape or portrait), moving geometry until it exists ----------
let heroResume = () => {};
(function hero() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = $('#stage'), video = $('#scene'), canvas = $('#geo'), tv = $('#tv');
  const portrait = matchMedia('(max-aspect-ratio: 1/1)');
  let m = null, mode = null;
  function place() {
    if (!m || video.hidden) { tv.hidden = true; return; }
    const ph = portrait.matches, box = ph ? m.phoneTv : m.tv;
    if (!box) { tv.hidden = true; return; }
    const FW = ph ? 1080 : 1920, FH = ph ? 1920 : 1080;
    const W = stage.clientWidth, H = stage.clientHeight, sc = Math.max(W / FW, H / FH);
    const pos = getComputedStyle(video).objectPosition.split(' ').map(v => parseFloat(v) / 100);
    const ox = (W - FW * sc) * (pos[0] ?? .5), oy = (H - FH * sc) * (pos[1] ?? .5);
    Object.assign(tv.style, { left: ox + box[0] * FW * sc + 'px', top: oy + box[1] * FH * sc + 'px',
      width: (box[2] - box[0]) * FW * sc + 'px', height: (box[3] - box[1]) * FH * sc + 'px' });
    tv.hidden = false;
  }
  function pick() {
    if (!m) return;
    const ph = portrait.matches;
    const next = ph ? 'p' : 'l';
    if (next !== mode) {
      mode = next;
      const webm = false; // MP4 (H.264) plays everywhere; iPhone Safari stalls on some WebM
      video.poster = ph ? (m.phone || m.poster) : m.poster;
      const src = ph ? (webm && m.phoneWebm ? m.phoneWebm : m.phoneLoop) : (webm && m.webm ? m.webm : m.loop);
      if (src) video.src = src; else video.removeAttribute('src');
      video.hidden = false; canvas.hidden = true;
      heroResume();
    }
    place();
  }
  video.muted = true; video.defaultMuted = true; video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
  let userWants = true, userPaused = false; // Nick: the garden plays for everyone
  heroResume = () => { if (userWants && !userPaused && video.src && !dlg.open && !document.hidden) video.play().catch(() => {}); };
  // If the phone blocked autoplay (e.g. Low Power Mode), start on the first touch or scroll.
  const kick = () => { userWants = true; heroResume(); document.querySelectorAll('.piece video').forEach(v => { seen.unobserve(v); seen.observe(v); }); };
  ['touchstart', 'scroll', 'pointerdown'].forEach(t => addEventListener(t, kick, { passive: true, once: true }));
  portrait.addEventListener('change', pick);
  addEventListener('resize', place);
  fetch('scene/manifest.json').then(r => r.ok ? r.json() : null).then(j => { m = j; pick(); }).catch(() => {});

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
