import * as THREE from 'three';
import { part, B, C, K, S, toon } from './characters.js';

export const HALF_WIDTH = 18;

export const ROOMS = [
  { name: 'Math Hall', z0: 22, z1: -22, ground: 'math' },
  { name: 'Stage 1: Young Temujin', z0: -22, z1: -62, ground: 'steppe' },
  { name: 'Stage 2: The Tribes Unite', z0: -62, z1: -102, ground: 'camp' },
  { name: 'Stage 3: The Messenger Road', z0: -102, z1: -142, ground: 'road' },
];

const R = (a, b) => a + Math.random() * (b - a);
const pickOf = (list) => list[Math.floor(Math.random() * list.length)];

function paintTexture(w, h, paint, { repeat = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext('2d'), w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function strokes(ctx, w, h, count, colors, length, width, angle = 0, spread = Math.PI) {
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = R(0, w);
    const y = R(0, h);
    const a = angle + R(-spread / 2, spread / 2);
    const l = R(length * 0.5, length * 1.4);
    ctx.strokeStyle = pickOf(colors);
    ctx.lineWidth = R(width * 0.5, width * 1.5);
    ctx.globalAlpha = R(0.22, 0.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + R(-6, 6), y + Math.sin(a) * l * 0.5 + R(-6, 6), x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintMathFloor(ctx, w, h) {
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#1b1560');
  base.addColorStop(1, '#2c1f9c');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const rows = 11;
  const rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    const stoneW = w / 7;
    const shift = r % 2 ? stoneW / 2 : 0;
    for (let c = -1; c < 8; c++) {
      const x = c * stoneW + shift;
      const hue = 240 + R(-10, 12);
      ctx.fillStyle = `hsl(${hue} ${R(52, 68)}% ${R(20, 32)}%)`;
      ctx.fillRect(x + 3, r * rowH + 3, stoneW - 6, rowH - 6);
    }
  }
  strokes(ctx, w, h, 420, ['#3a32b0', '#191254', '#352aa0'], 22, 3);

  const gold = '#ffc93c';
  const cx = w / 2;
  const cy = h * 0.64;
  ctx.strokeStyle = gold;
  ctx.shadowColor = '#ff9a2e';
  ctx.shadowBlur = 16;
  for (const [radius, width] of [[w * 0.36, 7], [w * 0.31, 3], [w * 0.17, 5]]) {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Sundial-style measuring ticks between the rings.
  ctx.lineWidth = 4;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const inner = i % 2 ? w * 0.25 : w * 0.17;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * w * 0.31, cy + Math.sin(a) * w * 0.31);
    ctx.stroke();
  }
  ctx.fillStyle = gold;
  ctx.font = "62px 'Lilita One', serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ['1', '2', '3', '5', '8', '13', '21', 'π', '×', '÷', '√', '='].forEach((glyph, i) => {
    const a = (i / 12) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * w * 0.335 * 1.02, cy + Math.sin(a) * w * 0.335 * 1.02);
    ctx.rotate(a + Math.PI / 2);
    ctx.font = "34px 'Lilita One', serif";
    ctx.fillText(glyph, 0, 0);
    ctx.restore();
  });
  ctx.shadowBlur = 0;
  // Inlaid path running through the hall to the gate.
  ctx.fillStyle = 'rgb(255 201 60 / .16)';
  ctx.fillRect(cx - w * 0.09, 0, w * 0.18, h);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * w * 0.09, 0);
    ctx.lineTo(cx + side * w * 0.09, h);
    ctx.stroke();
  }
}

function paintSteppe(ctx, w, h, { base, blades, trail, trailEdge }) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  strokes(ctx, w, h, 5200, blades, 34, 4, -Math.PI / 2, 1.1);

  // Dusty trail with a wandering edge.
  const trailPath = (grow) => {
    ctx.beginPath();
    for (let y = 0; y <= h; y += 24) {
      const x = w / 2 + Math.sin(y * 0.008) * w * 0.035 - w * (0.1 + grow);
      if (y) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    for (let y = h; y >= 0; y -= 24) ctx.lineTo(w / 2 + Math.sin(y * 0.008) * w * 0.035 + w * (0.1 + grow), y);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = trailEdge;
  trailPath(0.02);
  ctx.fillStyle = trail;
  trailPath(0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(w * 0.38, 0, w * 0.24, h);
  ctx.clip();
  strokes(ctx, w, h, 1100, ['#fff0c4', trailEdge, '#a8693a'], 26, 4, -Math.PI / 2, 0.8);
  ctx.restore();

  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = pickOf(['#ff5ea8', '#fff0c4', '#ffc93c']);
    ctx.beginPath();
    ctx.arc(R(0, w), R(0, h), R(2, 5), 0, Math.PI * 2);
    ctx.fill();
  }
}

const GROUND_PAINTERS = {
  math: paintMathFloor,
  steppe: (ctx, w, h) => paintSteppe(ctx, w, h, { base: '#3f9a3e', blades: ['#6cc24a', '#2f7f3c', '#a4d94e', '#1f6a4a'], trail: '#c98d4e', trailEdge: '#8c6233' }),
  camp: (ctx, w, h) => paintSteppe(ctx, w, h, { base: '#d9962e', blades: ['#f2bd45', '#b9701f', '#ffd76a', '#9c7f26'], trail: '#e9b56a', trailEdge: '#a3602a' }),
  road: (ctx, w, h) => paintSteppe(ctx, w, h, { base: '#2f9177', blades: ['#55c08a', '#1f6f6a', '#9bd96a', '#c4b24a'], trail: '#c67f47', trailEdge: '#7f4f2e' }),
};

function sandstoneTexture() {
  return paintTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7d4227';
    ctx.fillRect(0, 0, w, h);
    const rows = 4;
    const rowH = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = r % 2 ? -80 : 0;
      while (x < w) {
        const blockW = R(120, 190);
        ctx.fillStyle = `hsl(${R(22, 28)} ${R(56, 62)}% ${R(50, 56) - r}%)`;
        ctx.fillRect(x + 1.5, r * rowH + 1.5, blockW - 3, rowH - 3);
        ctx.fillStyle = 'rgb(255 215 150 / .2)';
        ctx.fillRect(x + 1.5, r * rowH + 1.5, blockW - 3, 4);
        x += blockW;
      }
    }
    strokes(ctx, w, h, 130, ['#a4583a', '#e8ad72'], 14, 2);
  }, { repeat: true });
}

function strataTexture() {
  return paintTexture(256, 256, (ctx, w, h) => {
    const bands = ['#7c2c52', '#b23f3e', '#d9622f', '#ef8f3c', '#c44f37', '#f4ac52', '#9c3648', '#e0713a'];
    let y = 0;
    while (y < h) {
      const band = R(14, 40);
      ctx.fillStyle = pickOf(bands);
      ctx.fillRect(0, y, w, band + 2);
      y += band;
    }
    strokes(ctx, w, h, 110, ['#7a2a4e', '#f2a868'], 12, 2, Math.PI / 2, 0.4);
  }, { repeat: true });
}

function latticeTexture(band) {
  return paintTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f6e7c8';
    ctx.fillRect(0, 0, w, h);
    strokes(ctx, w, h, 240, ['#e0c79c', '#fff6df'], 26, 3, 0, 0.4);
    ctx.fillStyle = band;
    ctx.fillRect(0, 42, w, 44);
    ctx.strokeStyle = '#ffc93c';
    ctx.lineWidth = 3;
    for (let x = -32; x < w + 32; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 86);
      ctx.lineTo(x + 32, 42);
      ctx.moveTo(x + 32, 86);
      ctx.lineTo(x, 42);
      ctx.stroke();
    }
    ctx.fillStyle = '#1a1030';
    ctx.fillRect(0, 38, w, 4);
    ctx.fillRect(0, 86, w, 4);
  }, { repeat: true });
}

function roofTexture() {
  return paintTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e8cfa2';
    ctx.fillRect(0, 0, w, h);
    strokes(ctx, w, h, 200, ['#caa873', '#fff0d0'], 34, 4);
    ctx.fillStyle = '#7a3b12';
    for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 4, h);
  }, { repeat: true });
}

function doorTexture(color) {
  return paintTexture(128, 192, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffc93c';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = i * 0.72;
      const r = i * 1.9;
      const x = w / 2 + Math.cos(a) * r;
      const y = h / 2 + Math.sin(a) * r;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  });
}

function gateWoodTexture() {
  return paintTexture(256, 512, (ctx, w, h) => {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `hsl(${R(330, 345)} ${R(55, 72)}% ${R(26, 36)}%)`;
      ctx.fillRect((i * w) / 5, 0, w / 5, h);
    }
    strokes(ctx, w, h, 300, ['#3d0f33', '#a53a6e'], 70, 3, Math.PI / 2, 0.25);
    ctx.fillStyle = '#1a1030';
    for (let i = 1; i < 5; i++) ctx.fillRect((i * w) / 5 - 2, 0, 4, h);
    for (const y of [46, h - 78]) {
      ctx.fillStyle = '#ffc93c';
      ctx.fillRect(0, y, w, 32);
      ctx.fillStyle = '#b57415';
      ctx.fillRect(0, y + 25, w, 7);
      ctx.fillStyle = '#1a1030';
      for (let x = 20; x < w; x += 44) {
        ctx.beginPath();
        ctx.arc(x, y + 14, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

function runeTexture() {
  return paintTexture(256, 256, (ctx, w, h) => {
    ctx.translate(w / 2, h / 2);
    ctx.strokeStyle = '#7ffcd0';
    ctx.fillStyle = '#7ffcd0';
    ctx.shadowColor = '#2ef2a3';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 7;
    for (const r of [116, 86]) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = "26px 'Lilita One', serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ['Δ', 'Σ', 'Ω', 'Π', 'Φ', 'Ψ', 'Λ', 'Ξ', '∞', '√'].forEach((g, i) => {
      ctx.save();
      ctx.rotate((i / 10) * Math.PI * 2);
      ctx.fillText(g, 0, -101);
      ctx.restore();
    });
    ctx.lineWidth = 5;
    // A growth spiral, the castle's emblem.
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * Math.PI * 5;
      const r = 4 * Math.exp(a * 0.19);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  });
}

function goldGlyphTexture(glyph) {
  return paintTexture(160, 160, (ctx, w, h) => {
    const fill = ctx.createLinearGradient(0, 20, 0, 140);
    fill.addColorStop(0, '#fff2a8');
    fill.addColorStop(0.55, '#ffc93c');
    fill.addColorStop(1, '#ff7a2e');
    ctx.font = "116px 'Lilita One', serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff5ea8';
    ctx.shadowBlur = 22;
    ctx.fillStyle = fill;
    ctx.fillText(glyph, w / 2, h / 2 + 6);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3a1450';
    ctx.strokeText(glyph, w / 2, h / 2 + 6);
  });
}

function flagTexture(colors) {
  return paintTexture(256, 128, (ctx, w, h) => {
    colors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, (i * h) / colors.length, w, h / colors.length + 1);
    });
    strokes(ctx, w, h, 120, ['#ffffff', '#1a1030'], 26, 2, 0, 0.4);
    ctx.strokeStyle = '#ffc93c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(w * 0.28, h / 2, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h / 2 - 16);
    ctx.lineTo(w * 0.28 + 14, h / 2 + 12);
    ctx.lineTo(w * 0.28 - 14, h / 2 + 12);
    ctx.closePath();
    ctx.fill();
  });
}

function sandTexture() {
  return paintTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#e39a4a';
    ctx.fillRect(0, 0, w, h);
    strokes(ctx, w, h, 1000, ['#f4b866', '#c9743a', '#ffcd86', '#d4823e'], 90, 7, 0, 0.5);
  }, { repeat: true });
}

const textured = (mesh, texture) => {
  mesh.material.map = texture;
  mesh.material.color.set(0xffffff);
  return mesh;
};

export function textSprite(text, height = 2, color = '#ffc400') {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = "96px 'Lilita One', 'Trebuchet MS', sans-serif";
  ctx.font = font;
  canvas.width = Math.ceil(ctx.measureText(text).width) + 80;
  canvas.height = 150;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 18;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a1030';
  ctx.fillStyle = color;
  ctx.strokeText(text, canvas.width / 2, 78);
  ctx.fillText(text, canvas.width / 2, 78);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
  sprite.material.map.colorSpace = THREE.SRGBColorSpace;
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  return sprite;
}

function sky(scene) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 p;
      void main(){
        float h = clamp(p.y, 0.0, 1.0);
        vec3 c = mix(vec3(1.0,0.72,0.28), vec3(1.0,0.27,0.5), smoothstep(0.0,0.16,h));
        c = mix(c, vec3(0.42,0.17,0.84), smoothstep(0.14,0.38,h));
        c = mix(c, vec3(0.11,0.15,0.68), smoothstep(0.36,0.8,h));
        gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), material));
  const sun = new THREE.Mesh(new THREE.CircleGeometry(46, 40), new THREE.MeshBasicMaterial({ color: 0xfff0a0, fog: false }));
  sun.position.set(-90, 70, -480);
  scene.add(sun);
}

function mountains(scene) {
  const colors = [0x4a1f9a, 0x3a1fa8, 0x6a2aa8, 0x2f2a9e];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + R(-0.08, 0.08);
    const d = R(430, 540);
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(R(70, 130), R(55, 110), 6), new THREE.MeshBasicMaterial({ color: pickOf(colors), fog: false }));
    mountain.position.set(Math.cos(a) * d, 20, Math.sin(a) * d - 60);
    mountain.rotation.y = R(0, 3);
    scene.add(mountain);
  }
}

function mesa(scene, texture, x, z, r, h) {
  const g = new THREE.Group();
  textured(part(g, C(r * 0.72, r, h * 0.72, 9), 0xffffff, 0, h * 0.36, 0, 1.012), texture);
  textured(part(g, C(r * 0.56, r * 0.68, h * 0.28, 9), 0xffffff, 0, h * 0.86, 0, 1.012), texture);
  part(g, C(r * 0.54, r * 0.56, h * 0.03, 9), 0x6cc24a, 0, h * 1.01, 0, 0);
  g.position.set(x, 0, z);
  g.rotation.y = x * 7;
  scene.add(g);
}

function yurt(parent, assets, x, z, band = '#d11f3f') {
  const g = new THREE.Group();
  textured(part(g, C(3, 3, 2.5, 22), 0xffffff, 0, 1.25, 0, 1.03), assets.lattice(band));
  textured(part(g, K(3.4, 1.9, 22), 0xffffff, 0, 3.45, 0, 1.03), assets.roof);
  const crown = part(g, new THREE.TorusGeometry(0.55, 0.13, 8, 18), 0xffc93c, 0, 4.42, 0, 0);
  crown.rotation.x = Math.PI / 2;
  part(g, K(0.14, 1.1, 8), 0xffc93c, 0, 5, 0, 0);
  textured(part(g, B(1.3, 2.1, 0.22), 0xffffff, 0, 1.05, 3), assets.door(band));
  g.position.set(x, 0, z);
  g.rotation.y = Math.atan2(-x, 0);
  parent.add(g);
}

function horse(parent, x, z, turn, coat = 0xa8622e) {
  const g = new THREE.Group();
  part(g, S(0.72), coat, 0, 2.05, 0.65).scale.set(1, 1, 1.25);
  part(g, S(0.7), coat, 0, 2.05, -0.65).scale.set(1, 1, 1.25);
  part(g, C(0.3, 0.46, 1.5, 10), coat, 0, 2.9, 1.25).rotation.x = 0.55;
  part(g, S(0.34), coat, 0, 3.6, 1.72).scale.set(0.85, 0.9, 1.6);
  part(g, B(0.14, 1.4, 1.2), 0x1a1030, 0, 3.15, 0.85, 0).rotation.x = 0.55;
  part(g, K(0.2, 1.5, 8), 0x1a1030, 0, 1.75, -1.5, 0).rotation.x = -0.35;
  part(g, B(0.9, 0.14, 1), 0xff2e88, 0, 2.78, 0, 0);
  for (const [lx, lz] of [[-0.34, 0.85], [0.34, 0.85], [-0.34, -0.85], [0.34, -0.85]]) {
    part(g, C(0.12, 0.2, 1.5, 8), coat, lx, 0.8, lz);
    part(g, C(0.2, 0.2, 0.16, 8), 0x1a1030, lx, 0.08, lz, 0);
  }
  g.position.set(x, 0, z);
  g.rotation.y = turn;
  parent.add(g);
}

export function buildWorld(scene) {
  sky(scene);
  mountains(scene);
  scene.fog = new THREE.Fog(0xff8a6a, 120, 420);

  const sandMap = sandTexture();
  sandMap.repeat.set(60, 60);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), toon(0xffffff));
  sand.material.map = sandMap;
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.05;
  scene.add(sand);

  const strata = strataTexture();
  for (let i = 0; i < 36; i++) {
    const side = i % 2 ? 1 : -1;
    mesa(scene, strata, side * (40 + Math.random() * 170), 60 - Math.random() * 320, 10 + Math.random() * 18, 18 + Math.random() * 46);
  }

  const stone = sandstoneTexture();
  const stoneFor = (length, height) => {
    const texture = stone.clone();
    texture.repeat.set(Math.max(1, Math.round(length / 10)), height > 4 ? 1 : 0.5);
    texture.needsUpdate = true;
    return texture;
  };

  const colliders = [];
  const wall = (x0, z0, x1, z1) => {
    const w = Math.max(Math.abs(x1 - x0), 1.2);
    const d = Math.max(Math.abs(z1 - z0), 1.2);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const length = Math.max(w, d);
    textured(part(scene, B(w, 6, d), 0xffffff, cx, 3, cz, 1.004), stoneFor(length, 6));
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    const along = w > d;
    const count = Math.floor(length / 3.2);
    const merlonMap = stoneFor(8, 3);
    for (let i = 0; i < count; i++) {
      const offset = -length / 2 + (i + 0.5) * (length / count);
      const grand = i % 6 === 3;
      const height = grand ? 2.2 : 1 + ((i * 7) % 3) * 0.28;
      const width = grand ? 2 : 1.4;
      const mx = cx + (along ? offset : 0);
      const mz = cz + (along ? 0 : offset);
      textured(part(scene, B(along ? width : 1.4, height, along ? 1.4 : width), 0xffffff, mx, 6 + height / 2, mz, 1.03), merlonMap);
      if (grand) part(scene, K(1.25, 1.3, 4), 0xff2e88, mx, 6 + height + 0.65, mz, 1.03).rotation.y = Math.PI / 4;
    }
  };

  wall(-HALF_WIDTH, ROOMS[0].z0, -HALF_WIDTH, ROOMS[3].z1);
  wall(HALF_WIDTH, ROOMS[0].z0, HALF_WIDTH, ROOMS[3].z1);
  wall(-HALF_WIDTH, ROOMS[0].z0, HALF_WIDTH, ROOMS[0].z0);
  wall(-HALF_WIDTH, ROOMS[3].z1, HALF_WIDTH, ROOMS[3].z1);

  for (const [x, z] of [[-HALF_WIDTH, ROOMS[0].z0], [HALF_WIDTH, ROOMS[0].z0], [-HALF_WIDTH, ROOMS[3].z1], [HALF_WIDTH, ROOMS[3].z1]]) {
    textured(part(scene, C(2.8, 3.2, 11, 12), 0xffffff, x, 5.5, z, 1.02), stoneFor(16, 12));
    part(scene, K(3.6, 5, 12), 0xff2e88, x, 13.5, z, 1.03);
    part(scene, C(3.4, 3.4, 0.4, 12), 0xffc93c, x, 11.1, z, 0);
  }

  for (const room of ROOMS) {
    const length = room.z0 - room.z1;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, length), toon(0xffffff));
    floor.material.map = paintTexture(1024, Math.round((1024 * length) / (HALF_WIDTH * 2)), GROUND_PAINTERS[room.ground]);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.01, (room.z0 + room.z1) / 2);
    scene.add(floor);
    const sign = textSprite(room.name, 1.7);
    sign.position.set(0, 14, room.z0 - 1);
    scene.add(sign);
  }

  // Gates: two carved leaves that swing open under a gold arch.
  const wood = gateWoodTexture();
  const rune = runeTexture();
  const gates = ['sumi', 'quill', 'tolu'].map((needs, i) => {
    const z = ROOMS[i].z1;
    wall(-HALF_WIDTH, z, -3.5, z);
    wall(3.5, z, HALF_WIDTH, z);

    for (const s of [-1, 1]) {
      part(scene, C(0.62, 0.72, 7.6, 10), 0x5a1f7a, s * 4.05, 3.8, z);
      for (const y of [0.5, 3.2, 6.1]) part(scene, C(0.84, 0.84, 0.32, 10), 0xffc93c, s * 4.05, y, z);
      part(scene, S(0.5), 0xffc93c, s * 4.05, 8.05, z);
    }
    part(scene, new THREE.TorusGeometry(4.05, 0.42, 10, 28, Math.PI), 0xffc93c, 0, 6.6, z, 1.05);
    part(scene, K(0.55, 1.4, 6), 0xff2e88, 0, 11.4, z, 1.05);

    const mesh = new THREE.Group();
    const seals = [];
    const leaves = [-1, 1].map((s) => {
      const leaf = new THREE.Group();
      leaf.position.set(s * 3.5, 0, z);
      textured(part(leaf, B(3.5, 6.2, 0.3), 0xffffff, -s * 1.75, 3.1, 0, 1.02), wood);
      const start = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      const seal = new THREE.Mesh(
        new THREE.CircleGeometry(1.5, 32, start, Math.PI),
        new THREE.MeshBasicMaterial({ map: rune, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
      );
      seal.position.set(-s * 3.5, 3.3, 0.2);
      const backSeal = seal.clone();
      backSeal.position.z = -0.2;
      leaf.add(seal, backSeal);
      seals.push(seal.material);
      mesh.add(leaf);
      return leaf;
    });
    scene.add(mesh);

    const collider = { minX: -3.5, maxX: 3.5, minZ: z - 0.5, maxZ: z + 0.5, off: false };
    colliders.push(collider);
    return { needs, z, mesh, collider, open: false, leaves, seals };
  });

  // Math Hall: floating gold glyphs and two orreries.
  const floaters = [];
  [['π', -13, 13], ['7', 13, 13], ['×', -14, 0], ['√', 14, 1], ['÷', -13, -14], ['∑', 13, -14], ['6', -7, 18], ['=', 7, 18]].forEach(([glyph, x, z], i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: goldGlyphTexture(glyph), transparent: true, depthWrite: false }));
    const size = 3 + (i % 3) * 0.7;
    sprite.scale.set(size, size, 1);
    sprite.position.set(x, 4.6, z);
    scene.add(sprite);
    floaters.push(sprite);
  });

  const orreries = [[-10, -3], [10, 8]].map(([x, z]) => {
    const g = new THREE.Group();
    g.position.set(x, 6.4, z);
    part(g, S(0.75), 0xffc93c, 0, 0, 0);
    const rings = [[2.5, 0x2ef2a3, 0xff5ea8], [1.8, 0xff7a2e, 0x2ef2a3]].map(([radius, ringColor, ballColor], i) => {
      const ring = new THREE.Group();
      part(ring, new THREE.TorusGeometry(radius, 0.07, 8, 44), 0xffc93c, 0, 0, 0, 0).rotation.x = Math.PI / 2;
      part(ring, S(0.26 + i * 0.05), ballColor, radius, 0, 0);
      part(ring, S(0.16), ringColor, -radius, 0, 0, 0);
      ring.rotation.x = 0.35 + i * 0.5;
      g.add(ring);
      return ring;
    });
    scene.add(g);
    return rings;
  });

  // Genghis Khan tour props, with shared yurt textures.
  const latticeCache = {};
  const doorCache = {};
  const assets = {
    roof: (() => {
      const texture = roofTexture();
      texture.repeat.set(3, 1);
      return texture;
    })(),
    lattice: (band) => {
      if (!latticeCache[band]) {
        latticeCache[band] = latticeTexture(band);
        latticeCache[band].repeat.set(4, 1);
      }
      return latticeCache[band];
    },
    door: (band) => (doorCache[band] ||= doorTexture(band)),
  };

  yurt(scene, assets, -11, -34);
  yurt(scene, assets, 11, -36, '#2a1fa8');
  yurt(scene, assets, -11, -52, '#0f9a9a');
  horse(scene, 11, -50, -2);
  yurt(scene, assets, -12, -74, '#1f8a5b');
  yurt(scene, assets, 12, -74, '#e8660c');
  yurt(scene, assets, -12, -92, '#7a22c8');
  yurt(scene, assets, 12, -92);
  horse(scene, -11, -110, 1.2, 0xeee0c8);
  horse(scene, 11, -112, -1.2);
  horse(scene, -12, -128, 1.6, 0x5a3418);
  part(scene, B(5, 2.4, 3), 0x7a3b12, 11, 1.2, -128);
  part(scene, K(3.6, 1.8, 4), 0xd11f3f, 11, 3.3, -128).rotation.y = Math.PI / 4;
  const roadSign = textSprite('Relay station', 1.5, '#fff6d6');
  roadSign.position.set(11, 5.4, -128);
  scene.add(roadSign);

  // Waving flags
  const flags = [];
  const flagPalettes = [['#d11f3f', '#ffc93c', '#d11f3f'], ['#2a1fa8', '#ff2e88', '#2a1fa8'], ['#1f8a5b', '#fff6d6', '#1f8a5b'], ['#ff7a2e', '#7a22c8', '#ff7a2e']];
  [[-6, -68, 0], [6, -68, 1], [-6, -96, 2], [6, -96, 3], [-7, -28, 1], [7, -28, 0], [-6, -106, 3], [6, -136, 2]].forEach(([x, z, palette]) => {
    part(scene, C(0.11, 0.14, 9, 8), 0x7a3b12, x, 4.5, z);
    part(scene, K(0.32, 0.8, 8), 0xffc93c, x, 9.4, z);
    const geometry = new THREE.PlaneGeometry(3, 1.7, 12, 3);
    geometry.translate(1.5, 0, 0);
    const material = toon(0xffffff);
    material.map = flagTexture(flagPalettes[palette]);
    material.side = THREE.DoubleSide;
    const flag = new THREE.Mesh(geometry, material);
    flag.position.set(x, 7.9, z);
    scene.add(flag);
    flags.push(flag);
  });

  // Campfires
  const flames = [];
  [[7, -44], [-7, -84], [7, -118]].forEach(([x, z]) => {
    for (const turn of [0, 1.05, 2.1]) {
      const log = part(scene, C(0.18, 0.18, 2.1, 8), 0x5a3418, x, 0.22, z);
      log.rotation.set(0, turn, Math.PI / 2);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      part(scene, S(0.28), 0x8a7a8c, x + Math.cos(a) * 1.3, 0.15, z + Math.sin(a) * 1.3, 1.05);
    }
    [[0xff7a2e, 0.62, 2.1, 0], [0xffc93c, 0.4, 1.4, 1.3], [0xfff2a8, 0.2, 0.8, 2.6]].forEach(([color, r, h, phase]) => {
      const flame = new THREE.Mesh(K(r, h, 7), new THREE.MeshBasicMaterial({ color }));
      flame.position.set(x, 0.3 + h / 2, z);
      scene.add(flame);
      flames.push({ flame, phase });
    });
  });

  // Grass tufts across the three steppe stages, clear of the trail.
  const GRASS = 1500;
  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.13, 1, 4), toon(0xffffff), GRASS);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palettes = [[0x6cc24a, 0x9fdc55, 0x2f8f4c], [0xf2bd45, 0xffd76a, 0xc98a2a], [0x55c08a, 0x9bd96a, 0x2a8a78]];
  for (let i = 0; i < GRASS; i++) {
    const stage = i % 3;
    const room = ROOMS[stage + 1];
    const side = Math.random() < 0.5 ? -1 : 1;
    const height = R(0.5, 1.2);
    dummy.position.set(side * R(4.4, HALF_WIDTH - 1), height / 2, R(room.z1 + 1, room.z0 - 1));
    dummy.rotation.set(R(-0.25, 0.25), R(0, 6), R(-0.25, 0.25));
    dummy.scale.set(1, height, 1);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    grass.setColorAt(i, color.set(pickOf(palettes[stage])));
  }
  grass.instanceMatrix.needsUpdate = true;
  grass.instanceColor.needsUpdate = true;
  scene.add(grass);

  // Finish star
  const trophy = new THREE.Group();
  part(trophy, S(1.4), 0xffc400, 0, 0, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = part(trophy, K(0.7, 2.2, 6), 0xffc400, Math.sin(a) * 1.9, Math.cos(a) * 1.9, 0);
    spike.rotation.z = -a;
  }
  trophy.position.set(0, 5, -137);
  scene.add(trophy);

  return {
    colliders,
    gates,
    tick(t, dt) {
      floaters.forEach((m, i) => {
        m.position.y = 4.6 + Math.sin(t * 1.1 + i) * 0.55;
      });
      orreries.forEach((rings, n) => rings.forEach((ring, i) => {
        ring.rotation.y = t * (0.7 + i * 0.6) * (n ? -1 : 1);
      }));
      trophy.rotation.y = t * 1.2;
      for (const gate of gates) {
        const ease = Math.min(1, dt * 2.6);
        gate.leaves.forEach((leaf, i) => {
          const target = gate.open ? (i === 0 ? 1.75 : -1.75) : 0;
          leaf.rotation.y += (target - leaf.rotation.y) * ease;
        });
        const glow = gate.open ? 0 : 0.7 + Math.sin(t * 3) * 0.3;
        gate.seals.forEach((seal) => {
          seal.opacity += (glow - seal.opacity) * ease;
        });
      }
      for (const flag of flags) {
        const position = flag.geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
          const x = position.getX(i);
          position.setZ(i, Math.sin(x * 2.2 - t * 5) * x * 0.14);
        }
        position.needsUpdate = true;
      }
      for (const { flame, phase } of flames) {
        const pulse = 1 + Math.sin(t * 11 + phase) * 0.14;
        flame.scale.set(1 / pulse, pulse, 1 / pulse);
      }
    },
  };
}
