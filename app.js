'use strict';

const grid = document.querySelector('#piece-grid');
const status = document.querySelector('#load-status');
const count = document.querySelector('#piece-count');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function tile(piece, asset) {
  const article = element('article', 'piece');
  if (asset.width > asset.height) article.classList.add('wide');
  article.id = piece.id;
  const media = element('div', 'piece-media');
  const image = element('img');
  image.src = asset.poster || asset.file;
  image.alt = piece.alt;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.width = asset.width;
  image.height = asset.height;
  image.addEventListener('error', () => {
    media.replaceChildren(element('p', 'media-error', 'This preview is unavailable.'));
  });

  if (piece.kind === 'video') {
    const play = element('button', 'play');
    play.type = 'button';
    play.setAttribute('aria-label', `Play ${piece.name} video`);
    const label = element('span', 'play-label', '▷ Play video');
    label.setAttribute('aria-hidden', 'true');
    play.append(image, label);
    media.append(play);
    play.addEventListener('click', async () => {
      document.querySelectorAll('video').forEach(other => other.pause());
      const video = element('video');
      video.controls = true;
      video.muted = false;
      video.defaultMuted = true;
      video.playsInline = true;
      video.preload = 'none';
      video.poster = asset.poster;
      video.src = asset.file;
      video.tabIndex = 0;
      video.setAttribute('aria-label', `${piece.name} spec video`);
      video.addEventListener('play', () => {
        document.querySelectorAll('video').forEach(other => {
          if (other !== video) other.pause();
        });
      });
      video.addEventListener('error', () => {
        media.replaceChildren(element('p', 'media-error', 'This video is unavailable. Please reload to try again.'));
      });
      media.replaceChildren(video);
      video.focus({ preventScroll: true });
      try { await video.play(); } catch {
        // Native controls remain available if the browser declines playback.
      }
    }, { once: true });
  } else {
    media.append(image);
  }

  const meta = element('div', 'piece-meta');
  meta.append(element('span', 'tag', piece.type), element('span', 'format', piece.kind === 'video' ? 'Video' : 'Still'));
  const heading = element('h3', '', piece.name);
  const description = element('p', 'description', piece.description);
  const attribution = element('p', 'attribution', 'Spec concept by Nick Goergen · not affiliated');
  article.append(media, meta, heading, description, attribution);
  return article;
}

async function loadPieces() {
  try {
    const [piecesResponse, assetsResponse] = await Promise.all([
      fetch('pieces.json'), fetch('media/available.json')
    ]);
    if (!piecesResponse.ok || !assetsResponse.ok) throw new Error('Missing collection data');
    const pieces = await piecesResponse.json();
    const assets = await assetsResponse.json();
    const ready = pieces.filter(piece => assets[piece.id]);
    grid.replaceChildren(...ready.map(piece => tile(piece, assets[piece.id])));
    count.textContent = `${ready.length} ${ready.length === 1 ? 'piece' : 'pieces'}`;
    status.hidden = ready.length > 0;
    status.textContent = 'The collection is being prepared. Contact Nick for samples.';
  } catch (error) {
    status.hidden = false;
    status.textContent = 'The collection could not load. Please try again, or contact Nick for samples.';
    console.error(error);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) document.querySelectorAll('video').forEach(video => video.pause());
});
loadPieces();

// Hero: the garden scene loop when it exists, moving warm geometry until then.
(function hero() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const video = document.querySelector('#scene');
  const canvas = document.querySelector('#geo');
  const narrow = matchMedia('(max-aspect-ratio: 1/1)').matches;
  fetch('scene/manifest.json').then(r => r.ok ? r.json() : null).then(m => {
    if (!m) return;
    const src = narrow && m.phone ? m.phone : m.loop;
    if (m.poster) video.poster = m.poster;
    video.src = src; video.hidden = false; canvas.hidden = true;
    if (!reduce) video.play().catch(() => {});
  }).catch(() => {});

  const ctx = canvas.getContext('2d');
  const colors = ['#E0702A', '#F2B33D', '#C2452D', '#7A8B3A', '#8C5A9E', '#F4D58D'];
  const shapes = Array.from({ length: 14 }, (_, i) => ({
    sides: [3, 4, 6, 0][i % 4], c: colors[i % colors.length],
    x: Math.random(), y: Math.random(), r: 0.06 + Math.random() * 0.16,
    a: Math.random() * 6.28, s: (Math.random() - 0.5) * 0.004,
    dx: (Math.random() - 0.5) * 0.0006, dy: (Math.random() - 0.5) * 0.0004
  }));
  function size() { canvas.width = canvas.clientWidth * devicePixelRatio; canvas.height = canvas.clientHeight * devicePixelRatio; }
  function draw() {
    const w = canvas.width, h = canvas.height, m = Math.max(w, h);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'multiply';
    for (const p of shapes) {
      ctx.beginPath();
      const R = p.r * m;
      if (!p.sides) ctx.arc(p.x * w, p.y * h, R, 0, 6.29);
      else for (let k = 0; k <= p.sides; k++) {
        const t = p.a + k * 6.2832 / p.sides;
        ctx[k ? 'lineTo' : 'moveTo'](p.x * w + R * Math.cos(t), p.y * h + R * Math.sin(t));
      }
      ctx.fillStyle = p.c + 'B0'; ctx.fill();
      p.a += p.s; p.x = (p.x + p.dx + 1.2) % 1.2 - 0.1; p.y = (p.y + p.dy + 1.2) % 1.2 - 0.1;
    }
    if (!reduce && !canvas.hidden) requestAnimationFrame(draw);
  }
  size(); addEventListener('resize', size); draw();
})();
