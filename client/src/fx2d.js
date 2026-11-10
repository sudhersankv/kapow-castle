// Screen-space effects: flashes, speed lines, shard bursts, slash wipes and stage cards.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#ff2e88', '#ffc400', '#2ef2a3', '#12c7c7', '#fff6d6'];
const PIP_LABELS = ['Math', 'Temujin', 'Tribes', 'Road'];
const BAR_COUNT = 14;

let canvas;
let ctx;
let flashEl;
let bars = [];
let meterMode = 'off';
let meterRunning = false;
let hintTimer = null;
const items = [];
let running = false;

const rand = (min, max) => min + Math.random() * (max - min);

function sizeCanvas() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}

function make(className, parent = document.body) {
  const el = document.createElement('div');
  el.className = className;
  parent.append(el);
  return el;
}

function buildDrift() {
  const drift = document.createElement('div');
  drift.className = 'drift';
  drift.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 26; i++) {
    const shard = make('driftShard', drift);
    const size = rand(40, 240);
    shard.style.cssText = `left:${rand(-5, 100)}%;top:${rand(-5, 100)}%;width:${size}px;height:${size * rand(0.7, 1.3)}px;background:${COLORS[i % COLORS.length]};opacity:${rand(0.06, 0.22)}`;
    if (!reduced) {
      shard.animate(
        [
          { transform: `translate(0,0) rotate(${rand(0, 360)}deg)` },
          { transform: `translate(${rand(-140, 140)}px,${rand(-140, 140)}px) rotate(${rand(0, 360)}deg)` },
        ],
        { duration: rand(14000, 30000), iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
      );
    }
  }
  document.getElementById('title')?.prepend(drift);
}

function buildMeter() {
  const meter = document.getElementById('voiceMeter');
  if (!meter) return;
  bars = Array.from({ length: BAR_COUNT }, () => make('vBar', meter));
}

export function initFx() {
  canvas = document.createElement('canvas');
  canvas.id = 'fx2d';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  ctx = canvas.getContext('2d');
  sizeCanvas();
  addEventListener('resize', sizeCanvas);
  flashEl = make('screenFlash');
  buildDrift();
  buildMeter();
}

function tri(x1, y1, x2, y2, x3, y3) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

function drawSpeedLines(item, t) {
  const { cx, cy, lines } = item;
  const reach = Math.hypot(canvas.width, canvas.height);
  ctx.globalAlpha = (1 - t) * 0.9;
  for (const line of lines) {
    const inner = line.r * (1 + t * 0.5);
    const ca = Math.cos(line.a);
    const sa = Math.sin(line.a);
    ctx.fillStyle = line.color;
    tri(
      cx + ca * inner,
      cy + sa * inner,
      cx + Math.cos(line.a - line.w) * reach,
      cy + Math.sin(line.a - line.w) * reach,
      cx + Math.cos(line.a + line.w) * reach,
      cy + Math.sin(line.a + line.w) * reach,
    );
  }
}

function drawShard(item, t) {
  const eased = 1 - (1 - t) * (1 - t);
  const x = item.x + item.vx * eased;
  const y = item.y + item.vy * eased;
  const a = item.spin * eased;
  const s = item.size;
  ctx.globalAlpha = Math.min(1, (1 - t) * 1.6);
  ctx.fillStyle = item.color;
  tri(
    x + Math.cos(a) * s,
    y + Math.sin(a) * s,
    x + Math.cos(a + 2.2) * s * 0.7,
    y + Math.sin(a + 2.2) * s * 0.7,
    x + Math.cos(a + 4.1) * s * 0.8,
    y + Math.sin(a + 4.1) * s * 0.8,
  );
}

function tick(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    item.start ??= now;
    const t = (now - item.start) / item.life;
    if (t >= 1) {
      items.splice(i, 1);
      continue;
    }
    if (item.kind === 'lines') drawSpeedLines(item, t);
    else drawShard(item, t);
  }
  ctx.globalAlpha = 1;
  if (items.length) {
    requestAnimationFrame(tick);
  } else {
    running = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function start() {
  if (running) return;
  running = true;
  requestAnimationFrame(tick);
}

// White-hot flash with radial speed lines. Power runs from 0 to 1.
export function flash(power = 0.7) {
  if (reduced) return;
  flashEl.animate([{ opacity: 0.55 + power * 0.4 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' });
  const lines = Array.from({ length: 34 + Math.round(power * 26) }, () => ({
    a: rand(0, Math.PI * 2),
    w: rand(0.004, 0.022),
    r: rand(130, 300),
    color: Math.random() < 0.6 ? '#ffffff' : '#ffc400',
  }));
  items.push({ kind: 'lines', cx: canvas.width / 2, cy: canvas.height * 0.42, lines, life: 460 });
  start();
}

// Triangles fired inward from the screen edges.
export function shardBurst(count = 44) {
  if (reduced) return;
  const w = canvas.width;
  const h = canvas.height;
  for (let i = 0; i < count; i++) {
    const side = i % 4;
    const x = side === 0 ? 0 : side === 1 ? w : rand(0, w);
    const y = side === 2 ? 0 : side === 3 ? h : rand(0, h);
    const cx = (w / 2 - x) * rand(0.15, 0.5);
    const cy = (h / 2 - y) * rand(0.15, 0.5);
    items.push({ kind: 'shard', x, y, vx: cx, vy: cy, spin: rand(-5, 5), size: rand(14, 54), color: COLORS[i % COLORS.length], life: rand(560, 1050) });
  }
  start();
}

// Three diagonal bars sweep across the screen.
export function slashWipe() {
  if (reduced) return;
  ['#ff2e88', '#ffc400', '#120a24'].forEach((color, i) => {
    const bar = make('slash');
    bar.style.background = color;
    bar.animate(
      [{ transform: 'translateX(-130vw) skewX(-24deg)' }, { transform: 'translateX(130vw) skewX(-24deg)' }],
      { duration: 460, delay: i * 70, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'both' },
    ).finished.finally(() => bar.remove());
  });
}

// A large slanted title card, such as STAGE CLEAR or the next stage's name.
export function stageCard(main, sub, delay = 0) {
  const card = make('stageCard');
  card.setAttribute('role', 'status');
  const band = make('scBand', card);
  void band;
  const mainEl = make('scMain', card);
  mainEl.textContent = main;
  if (sub) make('scSub', card).textContent = sub;
  const frames = reduced
    ? [{ opacity: 1 }, { opacity: 1 }]
    : [
        { opacity: 0, transform: 'translateX(-40vw) rotate(-5deg)' },
        { opacity: 1, transform: 'translateX(0) rotate(-5deg)', offset: 0.14 },
        { opacity: 1, transform: 'translateX(1vw) rotate(-5deg)', offset: 0.84 },
        { opacity: 0, transform: 'translateX(40vw) rotate(-5deg)' },
      ];
  card.animate(frames, { duration: 1900, delay, fill: 'both', easing: 'ease-out' }).finished.finally(() => card.remove());
}

function meterTick(now) {
  if (meterMode !== 'listening' && meterMode !== 'talking') {
    meterRunning = false;
    bars.forEach((bar) => { bar.style.transform = 'skewX(-18deg) scaleY(.18)'; });
    return;
  }
  const energy = meterMode === 'talking' ? 1 : 0.65;
  bars.forEach((bar, i) => {
    const wave = Math.abs(Math.sin(now / 130 + i * 0.75)) * 0.55 + Math.abs(Math.sin(now / 71 + i * 1.9)) * 0.45;
    bar.style.transform = `skewX(-18deg) scaleY(${(0.18 + wave * 0.82 * energy).toFixed(3)})`;
  });
  requestAnimationFrame(meterTick);
}

// Tracks whose turn it is: connecting, talking, listening, thinking or off.
export function setVoiceMeter(mode) {
  meterMode = mode;
  const dialogue = document.getElementById('duel');
  if (dialogue) dialogue.dataset.turn = mode;
  if (reduced) return;
  if (!meterRunning) {
    meterRunning = true;
    requestAnimationFrame(meterTick);
  }
}

export function setPips(current, solved) {
  const pips = document.getElementById('pips');
  if (!pips) return;
  if (!pips.children.length) {
    PIP_LABELS.forEach((label) => {
      const pip = make('pip', pips);
      make('pipMark', pip);
      make('pipLabel', pip).textContent = label;
    });
  }
  [...pips.children].forEach((pip, i) => {
    pip.dataset.state = solved[i] ? 'done' : i === current ? 'now' : 'todo';
  });
}

export function hideHints() {
  clearTimeout(hintTimer);
  const strip = document.getElementById('hintStrip');
  if (strip) strip.hidden = true;
}

// Shows the how-to-play strip the first time only.
export function showHints() {
  let seen = false;
  try {
    seen = localStorage.getItem('kapowHintsSeen') === '1';
    localStorage.setItem('kapowHintsSeen', '1');
  } catch {
    seen = false;
  }
  if (seen) return;
  const strip = document.getElementById('hintStrip');
  if (strip) strip.hidden = false;
  hintTimer = setTimeout(hideHints, 11000);
}
