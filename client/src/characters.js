import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// All characters are built from primitives and face +z.
const ramp = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;
const inkMat = new THREE.MeshBasicMaterial({ color: 0x1a1030, side: THREE.BackSide });

export const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: ramp });
export const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const S = (r) => new THREE.SphereGeometry(r, 20, 14);
export const C = (top, bottom, h, seg = 14) => new THREE.CylinderGeometry(top, bottom, h, seg);
export const K = (r, h, seg = 10) => new THREE.ConeGeometry(r, h, seg);

// Used by world props: outline is a scale factor.
export function part(parent, geo, color, x = 0, y = 0, z = 0, outline = 1.07) {
  const mesh = new THREE.Mesh(geo, toon(color));
  mesh.position.set(x, y, z);
  if (outline) {
    const shell = new THREE.Mesh(geo, inkMat);
    shell.scale.setScalar(outline);
    mesh.add(shell);
  }
  parent.add(mesh);
  return mesh;
}

// Constant-width ink outline: pushes a hull out along normals by a fixed distance.
const hulls = new Map();
function hullMat(width) {
  if (!hulls.has(width)) {
    hulls.set(width, new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { width: { value: width } },
      vertexShader: 'uniform float width; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normalize(normal) * width, 1.0); }',
      fragmentShader: 'void main(){ gl_FragColor = vec4(0.07, 0.04, 0.14, 1.0); }',
    }));
  }
  return hulls.get(width);
}

// Hard two-tone ramp, as on a cel-painted figure.
const celRamp = new THREE.DataTexture(new Uint8Array([140, 255]), 2, 1, THREE.RedFormat);
celRamp.minFilter = celRamp.magFilter = THREE.NearestFilter;
celRamp.needsUpdate = true;
const celMats = new Map();
function celMat(color) {
  if (!celMats.has(color)) celMats.set(color, new THREE.MeshToonMaterial({ color, gradientMap: celRamp }));
  return celMats.get(color);
}

const LINE = 0.02;
const FINE = 0.011;

function add(parent, geo, color, x = 0, y = 0, z = 0, width = LINE) {
  const mesh = new THREE.Mesh(geo, celMat(color));
  mesh.position.set(x, y, z);
  mesh.userData = { cel: color, width };
  parent.add(mesh);
  return mesh;
}

function pivot(parent, x, y, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const ball = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 3, 10);

function lathe(points, segments = 14) {
  // LatheGeometry faces outward only when y increases along the profile.
  if (points[0][1] > points[points.length - 1][1]) points = [...points].reverse();
  const curve = new THREE.SplineCurve(points.map(([r, y]) => new THREE.Vector2(r, y)));
  const smooth = curve.getPoints(11).map((p) => new THREE.Vector2(Math.max(0.001, p.x), p.y));
  return new THREE.LatheGeometry(smooth, segments);
}

// Merges each moving section into one mesh per color, which keeps draw calls low.
function finish(root, extraNodes = []) {
  const { armL, armR, legL, legR } = root.userData;
  const nodes = [root, armL, armR, legL, legR, ...extraNodes];
  const isNode = new Set(nodes);
  root.updateMatrixWorld(true);
  for (const node of nodes) {
    const inverse = node.matrixWorld.clone().invert();
    const found = [];
    const walk = (object) => {
      for (const child of object.children) {
        if (isNode.has(child)) continue;
        if (child.isMesh && child.userData.cel !== undefined) found.push(child);
        walk(child);
      }
    };
    walk(node);
    const buckets = new Map();
    for (const mesh of found) {
      const key = `${mesh.userData.cel}|${mesh.userData.width}`;
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
      if (!buckets.has(key)) buckets.set(key, { color: mesh.userData.cel, width: mesh.userData.width, list: [] });
      buckets.get(key).list.push(g);
    }
    found.forEach((mesh) => mesh.parent?.remove(mesh));
    for (const { color, width, list } of buckets.values()) {
      const merged = list.length > 1 ? mergeGeometries(list) : list[0];
      const mesh = new THREE.Mesh(merged, celMat(color));
      if (width) mesh.add(new THREE.Mesh(merged, hullMat(width)));
      node.add(mesh);
    }
  }
  return root;
}

// Slims the skull and draws the lower half into a narrow, angular jaw.
function warpJaw(geo, r) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / r;
    const k = y < 0 ? 1 - 0.46 * Math.pow(-y, 1.35) : 1;
    pos.setXYZ(i, pos.getX(i) * 0.88 * k, pos.getY(i) * (y < 0 ? 1.28 : 1.04), pos.getZ(i) * (y < 0 ? 1 - 0.18 * -y : 1));
  }
  geo.computeVertexNormals();
  return geo;
}

function faceTexture(o) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  const ink = '#1a1030';
  const eyeW = o.eyeW || 74;
  const eyeH = o.eyeH || 30;
  const spread = o.spread || 72;
  const eyeY = 156;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Hard cel shadow down one side of the face.
  ctx.fillStyle = o.shade || 'rgba(120,50,40,.2)';
  ctx.beginPath();
  ctx.moveTo(512, 0);
  ctx.lineTo(370, 0);
  ctx.lineTo(346, 120);
  ctx.lineTo(372, 196);
  ctx.lineTo(322, 320);
  ctx.lineTo(512, 320);
  ctx.closePath();
  ctx.fill();

  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(256 + s * spread, eyeY);
    ctx.scale(s, 1);
    const almond = () => {
      ctx.beginPath();
      ctx.moveTo(-eyeW / 2, 8);
      ctx.quadraticCurveTo(-eyeW * 0.05, -eyeH, eyeW / 2, -7);
      ctx.quadraticCurveTo(eyeW * 0.08, eyeH * 0.82, -eyeW / 2, 8);
      ctx.closePath();
    };
    almond();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.save();
    almond();
    ctx.clip();
    ctx.fillStyle = o.iris;
    ctx.beginPath();
    ctx.arc(-5, -1, eyeH * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(-5, -1, eyeH * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-11, -8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Heavy upper lid that sweeps past the outer corner.
    ctx.strokeStyle = ink;
    ctx.lineWidth = o.lashes ? 10 : 7;
    ctx.beginPath();
    ctx.moveTo(-eyeW / 2, 9);
    ctx.quadraticCurveTo(-eyeW * 0.05, -eyeH, eyeW / 2 + (o.lashes ? 16 : 7), -11);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-eyeW * 0.3, eyeH * 0.42);
    ctx.quadraticCurveTo(eyeW * 0.12, eyeH * 0.5, eyeW / 2, -4);
    ctx.stroke();
    // Angular brow, low over the eye.
    ctx.strokeStyle = o.browColor || ink;
    ctx.lineWidth = o.browWidth || 10;
    ctx.beginPath();
    ctx.moveTo(-eyeW * 0.62, -34 + (o.browIn ?? 12));
    ctx.lineTo(eyeW * 0.2, -46);
    ctx.lineTo(eyeW * 0.66, -38);
    ctx.stroke();
    ctx.restore();
  }

  // Nose and mouth are single confident strokes.
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(262, eyeY + 26);
  ctx.lineTo(268, eyeY + 56);
  ctx.lineTo(252, eyeY + 60);
  ctx.stroke();
  const my = eyeY + 96;
  ctx.lineWidth = 5;
  ctx.beginPath();
  if (o.mouth === 'grin') {
    ctx.fillStyle = '#fff';
    ctx.moveTo(214, my - 4);
    ctx.quadraticCurveTo(256, my + 6, 300, my - 12);
    ctx.quadraticCurveTo(290, my + 22, 250, my + 22);
    ctx.quadraticCurveTo(222, my + 20, 214, my - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (o.mouth === 'smile') {
    ctx.moveTo(220, my - 4);
    ctx.quadraticCurveTo(256, my + 14, 292, my - 6);
    ctx.stroke();
  } else {
    ctx.moveTo(226, my + 2);
    ctx.lineTo(288, my - 2);
    ctx.stroke();
  }
  o.extra?.(ctx, eyeY, my);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function head(parent, r, skin, y, faceOptions) {
  const group = pivot(parent, 0, y, 0.02);
  add(group, warpJaw(new THREE.SphereGeometry(r, 20, 14), r), skin);
  const faceGeo = warpJaw(new THREE.SphereGeometry(r * 1.012, 24, 14, Math.PI / 2 - 1.1, 2.2, 0.8, 1.45), r * 1.012);
  const material = new THREE.MeshBasicMaterial({ map: faceTexture(faceOptions), transparent: true, depthWrite: false });
  group.add(new THREE.Mesh(faceGeo, material));
  return group;
}

const triangle = (x) => 1 - Math.abs(((x % 1) + 1) % 1 * 2 - 1);
const dir = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

// One solid sculpted hair mass: a skull cap pulled out into sharp tufts, with a jagged hairline.
function hairGeo(r, { tufts = [], front = 0.95, back = 1.95, jag = 0.28, teeth = 11 }) {
  const geo = new THREE.SphereGeometry(r, 44, 18, 0, Math.PI * 2, 0, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.acos(THREE.MathUtils.clamp(pos.getY(i) / r, -1, 1));
    const a = Math.atan2(pos.getX(i), pos.getZ(i));
    const f = THREE.MathUtils.smoothstep((Math.cos(a) + 1) / 2, 0.15, 0.85);
    const limit = THREE.MathUtils.lerp(back, front, f) + jag * triangle((a / (Math.PI * 2)) * teeth);
    const theta = t * limit;
    v.set(Math.sin(theta) * Math.sin(a), Math.cos(theta), Math.sin(theta) * Math.cos(a));
    let bump = 0;
    for (const { d, h, s } of tufts) bump = Math.max(bump, h * Math.pow(Math.max(0, v.dot(d)), s));
    pos.setXYZ(i, v.x * r * 0.92 * (1 + bump), v.y * r * 1.04 * (1 + bump), v.z * r * (1 + bump));
  }
  geo.computeVertexNormals();
  return geo;
}

// A human about seven heads tall. b widens the chest, h the hips.
function human({ skin, top, pants, boots, sleeve, wrist, face, b = 1, h: hips = 1, bareArms = false }) {
  const g = new THREE.Group();
  const r = 0.28;
  const w = (rad, y) => rad * (y > 2.7 ? b : hips);
  const profile = [[0.001, 2.32], [0.31, 2.36], [0.3, 2.62], [0.37, 2.86], [0.52, 3.16], [0.56, 3.36], [0.34, 3.54], [0.001, 3.58]].map(([x, y]) => [w(x, y), y]);
  add(g, lathe(profile, 18), top).scale.z = 0.62;
  add(g, lathe([[0.001, 1.96], [0.3, 2.0], [0.38, 2.2], [0.34, 2.44], [0.001, 2.5]].map(([x, y]) => [x * hips, y]), 16), pants).scale.z = 0.7;
  add(g, new THREE.CylinderGeometry(0.105, 0.135, 0.34, 10), skin, 0, 3.62, 0, FINE);

  const leg = (s) => {
    const p = pivot(g, s * 0.2 * hips, 2.12);
    add(p, lathe([[0.2, 0], [0.26, -0.28], [0.26, -0.68], [0.28, -1.02], [0.26, -1.36], [0.17, -1.68], [0.135, -1.78]]), pants);
    add(p, lathe([[0.15, -1.62], [0.165, -1.74], [0.155, -1.96], [0.17, -2.06], [0.001, -2.09]], 12), boots, 0, 0, 0, FINE);
    const foot = add(p, ball(0.17, 12, 8), boots, 0, -2.0, 0.13, FINE);
    foot.scale.set(0.82, 0.62, 1.6);
    return p;
  };

  const arm = (s) => {
    const p = pivot(g, s * 0.62 * b, 3.34);
    p.rotation.z = s * 0.09;
    const color = bareArms ? skin : sleeve || top;
    add(p, ball(0.19), color, 0, -0.04, 0).scale.set(1.04, 1.12, 1.04);
    add(p, lathe([[0.13, 0], [0.17, -0.26], [0.14, -0.5], [0.105, -0.72]], 12), color, 0, 0, 0, FINE);
    const fore = pivot(p, 0, -0.72, 0);
    fore.rotation.x = -0.28;
    add(fore, ball(0.112, 10, 8), color, 0, 0, 0, 0);
    add(fore, lathe([[0.105, 0], [0.145, -0.18], [0.115, -0.42], [0.085, -0.64]], 12), color, 0, 0, 0, FINE);
    if (wrist) add(fore, lathe([[0.1, -0.46], [0.112, -0.54], [0.1, -0.64]], 12), wrist, 0, 0, 0, FINE);
    const fist = add(fore, ball(0.122, 12, 8), skin, 0, -0.76, 0, FINE);
    fist.scale.set(0.92, 1.04, 1.12);
    add(fore, cap(0.05, 0.13), skin, 0, -0.82, 0.08, FINE).rotation.z = Math.PI / 2;
    add(fore, cap(0.04, 0.09), skin, -s * 0.1, -0.74, 0.07, 0).rotation.x = 0.9;
    return { p, fore };
  };

  const left = arm(-1);
  const right = arm(1);
  g.userData = { armL: left.p, armR: right.p, legL: leg(-1), legR: leg(1), headY: 3.72 };
  return { g, head: head(g, r, skin, 3.94, face), r, right, left };
}

export function animate(char, speed, t) {
  const { armL, armR, legL, legR } = char.userData;
  const swing = speed > 0.1 ? Math.sin(t * (6 + speed)) * 0.75 : 0;
  armL.rotation.x = swing;
  armR.rotation.x = -swing;
  legL.rotation.x = -swing;
  legR.rotation.x = swing;
}

function sash(g, y, radius, color, zScale = 0.68) {
  const mesh = add(g, new THREE.TorusGeometry(radius, 0.06, 6, 22), color, 0, y, 0, FINE);
  mesh.rotation.x = Math.PI / 2;
  mesh.scale.y = zScale;
}

function cloth(g, color, x, y, z, length, tilt = 0.12, width = 0.11) {
  const geo = cap(width, length);
  geo.translate(0, -length / 2, 0);
  const mesh = add(g, geo, color, x, y, z, FINE);
  mesh.rotation.x = tilt;
  mesh.scale.z = 0.3;
  return mesh;
}

function diamond(parent, size, color, x, y, z) {
  const mesh = add(parent, new THREE.CylinderGeometry(size, size, 0.02, 4), color, x, y, z, 0);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

export function makeHero() {
  const skin = 0xe9b48a;
  const teal = 0x0fb0b4;
  const deep = 0x087a86;
  const magenta = 0xff2e88;
  const { g, head: h, r } = human({
    skin, top: teal, pants: 0x2c23a8, boots: magenta, wrist: 0xffc400, bareArms: true,
    b: 1.05,
    face: { iris: '#19a0ff', browColor: '#2a145e', browIn: 16, mouth: 'set' },
  });

  // Hair swept back and to one side, as one angular mass.
  add(h, hairGeo(r * 1.08, {
    front: 0.82, back: 1.72, jag: 0.34, teeth: 13,
    tufts: [
      { d: dir(0.1, 0.75, -0.65), h: 1.05, s: 34 }, { d: dir(-0.55, 0.55, -0.6), h: 0.95, s: 38 }, { d: dir(0.6, 0.5, -0.6), h: 0.9, s: 38 },
      { d: dir(-0.1, 0.25, -0.95), h: 1.0, s: 36 }, { d: dir(0.42, 0.12, -0.9), h: 0.8, s: 40 }, { d: dir(-0.5, 0.05, -0.85), h: 0.82, s: 40 },
      { d: dir(-0.85, 0.42, 0.25), h: 0.72, s: 44 }, { d: dir(0.88, 0.32, 0.18), h: 0.6, s: 46 }, { d: dir(-0.34, 0.86, 0.38), h: 0.7, s: 42 }, { d: dir(0.26, 0.94, 0.2), h: 0.62, s: 42 },
    ],
  }), 0x4a22c8);

  // Sleeveless martial jacket, open over a bare chest.
  add(g, ball(0.27, 12, 8), skin, -0.18, 3.14, 0.2, FINE).scale.set(0.95, 0.72, 0.42);
  add(g, ball(0.27, 12, 8), skin, 0.18, 3.14, 0.2, FINE).scale.set(0.95, 0.72, 0.42);
  for (const s of [-1, 1]) {
    const lapel = add(g, cap(0.05, 0.84), deep, s * 0.27, 3.0, 0.3, FINE);
    lapel.rotation.z = s * 0.42;
    lapel.rotation.x = -0.1;
    add(g, ball(0.1, 8, 6), deep, s * 0.48, 3.4, 0, FINE).scale.set(1.5, 0.5, 1.5);
  }
  diamond(g, 0.21, 0xffc400, 0, 3.14, -0.33);
  diamond(g, 0.12, magenta, 0, 3.14, -0.345);

  sash(g, 2.44, 0.36, magenta);
  cloth(g, magenta, 0.26, 2.42, 0.16, 0.72, 0.1);
  cloth(g, 0xd11f6e, 0.12, 2.42, 0.2, 0.5, 0.14);
  return finish(g, [h]);
}

export function makeSumi() {
  const steel = 0xd6dcf3;
  const dark = 0x8791bd;
  const gold = 0xffc400;
  const pink = 0xff4f9e;
  const { g, head: h, r, right } = human({
    skin: 0xb9794c, top: steel, pants: 0x4a2fa6, boots: dark, sleeve: 0x6a4fc4, wrist: dark,
    b: 0.86, h: 0.96,
    face: { iris: '#ff4f9e', lashes: true, eyeH: 33, browWidth: 7, browIn: 8, mouth: 'smile', shade: 'rgba(70,30,20,.24)' },
  });

  // Open-faced helmet, plume and a ponytail.
  add(h, hairGeo(r * 1.13, { front: 0.86, back: 1.5, jag: 0, tufts: [{ d: dir(0, 1, -0.15), h: 0.18, s: 8 }] }), steel);
  const plume = add(h, cap(0.05, 0.5), pink, 0, 0.42, -0.1, FINE);
  plume.rotation.x = -0.55;
  plume.scale.x = 0.7;
  for (let i = 0; i < 4; i++) add(h, ball(0.1 - i * 0.012, 8, 6), 0x24143e, 0, -0.1 - i * 0.2, -0.34 - i * 0.05, FINE).scale.set(0.95, 1.25, 0.9);
  for (const s of [-1, 1]) add(h, cap(0.05, 0.2), dark, s * 0.25, -0.06, 0.02, FINE);

  // Tapered breastplate, gold trim and a pointed tabard.
  add(g, ball(0.21, 12, 8), steel, -0.16, 3.12, 0.2, FINE).scale.set(1, 0.9, 0.55);
  add(g, ball(0.21, 12, 8), steel, 0.16, 3.12, 0.2, FINE).scale.set(1, 0.9, 0.55);
  sash(g, 2.5, 0.3, gold);
  const tabard = add(g, lathe([[0.34, 2.5], [0.44, 2.1], [0.56, 1.72], [0.62, 1.5]], 16), pink);
  tabard.scale.z = 0.72;
  sash(g, 1.52, 0.6, gold, 0.72);

  for (const arm of [g.userData.armL, g.userData.armR]) {
    add(arm, ball(0.26, 12, 8), steel, 0, 0.02, 0).scale.set(1.02, 0.78, 1.02);
    add(arm, new THREE.TorusGeometry(0.2, 0.025, 6, 16), gold, 0, -0.08, 0, 0).rotation.x = Math.PI / 2;
  }
  for (const leg of [g.userData.legL, g.userData.legR]) add(leg, ball(0.16, 10, 8), steel, 0, -1.0, 0.12, FINE).scale.set(1, 1.15, 0.6);

  const cape = add(g, lathe([[0.3, 3.5], [0.5, 3.1], [0.6, 2.2], [0.78, 1.0]], 14), 0x3f24a0);
  cape.scale.z = 0.46;
  cape.position.z = -0.24;

  // Abacus shield on the forearm.
  const shield = pivot(right.fore, 0.2, -0.42, 0.04);
  add(shield, new THREE.CylinderGeometry(0.58, 0.58, 0.07, 20), 0xa8652a, 0, 0, 0).rotation.z = Math.PI / 2;
  const rim = add(shield, new THREE.TorusGeometry(0.58, 0.05, 6, 24), gold, 0, 0, 0, FINE);
  rim.rotation.y = Math.PI / 2;
  const colors = [gold, 0x2ef2a3, pink, 0x12c7c7];
  for (let i = 0; i < 4; i++) {
    const y = 0.33 - i * 0.22;
    const half = Math.sqrt(0.5 * 0.5 - y * y);
    add(shield, new THREE.CylinderGeometry(0.014, 0.014, half * 2, 5), 0x1a1030, 0.06, y, 0, 0).rotation.x = Math.PI / 2;
    for (let j = 0; j < 4; j++) add(shield, ball(0.07, 8, 6), colors[(i + j) % 4], 0.07, y, -half * 0.66 + j * half * 0.44 + (i % 2) * 0.05, 0).scale.x = 0.7;
  }
  return finish(g, [h]);
}

// Long Mongolian robe over the body, flared to the shin, with a diagonal closure.
function deel(g, color, trim, sashColor, b = 1) {
  const robe = add(g, lathe([[0.42 * b, 3.5], [0.56 * b, 3.3], [0.48 * b, 2.9], [0.4, 2.5], [0.52, 2.0], [0.66, 1.36], [0.74, 0.86]], 18), color);
  robe.scale.z = 0.7;
  const hem = add(g, new THREE.TorusGeometry(0.74, 0.04, 6, 24), trim, 0, 0.86, 0, FINE);
  hem.rotation.x = Math.PI / 2;
  hem.scale.y = 0.7;
  sash(g, 2.5, 0.41, sashColor);
  const flap = add(g, cap(0.035, 0.74), trim, 0.1, 3.12, 0.32 * b, 0);
  flap.rotation.set(0.1, 0, 0.74);
  for (const [x, y] of [[0.26, 2.98], [0.33, 2.86]]) add(g, ball(0.035, 6, 5), 0xffc400, x, y, 0.3 * b, 0);
  for (const arm of [g.userData.armL, g.userData.armR]) add(arm, new THREE.TorusGeometry(0.13, 0.03, 6, 14), trim, 0, -0.68, 0, 0).rotation.x = Math.PI / 2;
}

export function makeTolu() {
  const green = 0x1a7f55;
  const { g, head: h, r, right } = human({
    skin: 0xc98a58, top: green, pants: 0x124c34, boots: 0x6e3510, sleeve: green,
    b: 1.2, h: 1.08,
    face: {
      iris: '#2f7d4f', eyeW: 68, eyeH: 26, browWidth: 15, browColor: '#231207', browIn: 4, mouth: 'smile',
      extra(ctx, eyeY, my) {
        ctx.fillStyle = '#231207';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(256, my - 18);
          ctx.quadraticCurveTo(256 + s * 42, my - 26, 256 + s * 84, my + 4);
          ctx.quadraticCurveTo(256 + s * 40, my - 4, 256, my - 8);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(35,18,7,.28)';
        ctx.fillRect(226, my + 16, 60, 26);
      },
    },
  });
  deel(g, green, 0xffc400, 0xd11f3f, 1.2);

  // Felt hat with an upturned brim.
  add(h, lathe([[r * 0.95, 0.09], [r * 1.14, 0.1], [r * 1.26, 0.22], [r * 0.98, 0.26]], 16), 0xffc400, 0, 0, 0, FINE);
  add(h, lathe([[r * 0.96, 0.2], [r * 0.88, 0.42], [r * 0.45, 0.56], [0.001, 0.6]], 14), green);
  add(h, ball(0.05, 8, 6), 0xd11f3f, 0, 0.61, 0, 0);

  // Mallet gripped in the right fist.
  const grip = pivot(right.fore, 0, -0.78, 0.04);
  add(grip, new THREE.CylinderGeometry(0.04, 0.05, 1.05, 8), 0x7a3b12, 0, 0, 0.3, FINE).rotation.x = Math.PI / 2 - 0.1;
  add(grip, cap(0.17, 0.3), 0xc98a4a, 0, 0.06, 0.82);
  return finish(g, [h]);
}

export function makeSarnai() {
  const red = 0xc91c3b;
  const teal = 0x12c7c7;
  const hairColor = 0x1f1034;
  const fur = 0xf3e4c4;
  const { g, head: h, r, right } = human({
    skin: 0xe2a877, top: red, pants: 0x2a1fa8, boots: 0x20123c, sleeve: red,
    b: 0.82, h: 0.92,
    face: {
      iris: '#b85e16', lashes: true, eyeH: 34, browWidth: 7, browColor: '#1f1034', browIn: -6, mouth: 'grin',
      extra(ctx, eyeY) {
        ctx.fillStyle = '#8f5226';
        for (const s of [-1, 1]) for (const dx of [0, 16, 32]) {
          ctx.beginPath();
          ctx.arc(256 + s * (64 + dx), eyeY + 44 + (dx === 16 ? 6 : 0), 3, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    },
  });
  deel(g, red, teal, 0xffc400, 0.86);
  add(h, hairGeo(r * 1.08, { front: 0.92, back: 1.5, jag: 0.14, teeth: 15 }), hairColor);

  // Riding hat with a thick fur band.
  const band = add(h, new THREE.TorusGeometry(r * 1.02, 0.095, 8, 22), fur, 0, 0.17, -0.02);
  band.rotation.x = Math.PI / 2 - 0.1;
  add(h, lathe([[r * 0.92, 0.19], [r * 0.74, 0.42], [r * 0.3, 0.62], [0.001, 0.72]], 14), red, 0, 0, -0.03);
  add(h, ball(0.05, 8, 6), 0xffc400, 0, 0.73, -0.03, 0);

  // Long twin braids.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) add(h, ball(0.075 - i * 0.004, 8, 6), hairColor, s * 0.25, -0.08 - i * 0.14, -0.1 - i * 0.012, FINE);
    add(h, ball(0.055, 6, 5), teal, s * 0.25, -0.94, -0.17, 0);
  }

  const pouch = add(g, cap(0.11, 0.09), 0xffa53d, -0.38, 2.28, 0.18, FINE);
  pouch.scale.z = 0.6;
  // Signal horn in the right fist.
  const grip = pivot(right.fore, 0, -0.78, 0.04);
  const signal = add(grip, lathe([[0.03, 0], [0.045, 0.28], [0.08, 0.5], [0.2, 0.66]], 10), 0xffc400, 0, 0, 0, FINE);
  signal.rotation.x = Math.PI / 2 + 0.3;
  return finish(g, [h]);
}

export function makeQuill() {
  const robe = 0x2c2a7c;
  const gold = 0xffc400;
  const white = 0xf2efe6;
  const { g, head: h, r, right } = human({
    skin: 0xdfae88, top: robe, pants: robe, boots: 0x3a2a5e, sleeve: robe,
    b: 0.92,
    face: {
      iris: '#7a8fd6', eyeW: 62, eyeH: 20, browColor: '#f2efe6', browWidth: 15, browIn: -14, mouth: 'smile',
      extra(ctx, eyeY, my) {
        ctx.strokeStyle = 'rgba(70,35,20,.7)';
        ctx.lineWidth = 3;
        for (const s of [-1, 1]) {
          for (const dy of [0, 10]) {
            ctx.beginPath();
            ctx.moveTo(256 + s * 124, eyeY - 8 + dy);
            ctx.lineTo(256 + s * 142, eyeY - 14 + dy * 1.6);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(256 + s * 52, my - 28);
          ctx.quadraticCurveTo(256 + s * 70, my - 6, 256 + s * 58, my + 10);
          ctx.stroke();
        }
      },
    },
  });

  // Floor-length robes with wide sleeves and gold trim.
  const gown = add(g, lathe([[0.44, 3.52], [0.54, 3.3], [0.46, 2.8], [0.5, 2.2], [0.68, 1.2], [0.86, 0.1]], 20), robe);
  gown.scale.z = 0.72;
  const hem = add(g, new THREE.TorusGeometry(0.86, 0.045, 6, 26), gold, 0, 0.12, 0, FINE);
  hem.rotation.x = Math.PI / 2;
  hem.scale.y = 0.72;
  sash(g, 2.56, 0.4, gold);
  const stole = add(g, cap(0.12, 1.5), 0x7a2be2, 0, 2.5, 0.34, FINE);
  stole.scale.z = 0.25;
  for (const arm of [g.userData.armL, g.userData.armR]) {
    const cuff = add(arm, lathe([[0.15, -0.3], [0.22, -0.72], [0.34, -1.16]], 12), robe, 0, 0, 0, FINE);
    cuff.rotation.x = -0.12;
    add(arm, new THREE.TorusGeometry(0.34, 0.03, 6, 16), gold, 0, -1.16, 0.14, 0).rotation.x = Math.PI / 2 - 0.12;
  }

  // White hair, and a long pointed beard that hangs from the jaw.
  add(h, hairGeo(r * 1.07, { front: 0.68, back: 1.6, jag: 0.22, teeth: 9, tufts: [{ d: dir(-0.75, 0.2, -0.6), h: 0.32, s: 16 }, { d: dir(0.75, 0.2, -0.6), h: 0.32, s: 16 }] }), white);
  const beard = add(h, lathe([[0.001, -0.98], [0.07, -0.72], [0.16, -0.44], [0.2, -0.26], [0.13, -0.16]], 12), white, 0, 0, 0.1);
  beard.scale.z = 0.62;
  for (const s of [-1, 1]) {
    const moustache = add(h, cap(0.03, 0.14), white, s * 0.1, -0.16, 0.25, 0);
    moustache.rotation.z = s * 1.25;
  }

  // A small owl rides on his shoulder.
  const owl = pivot(g, -0.6, 3.72, -0.02);
  add(owl, ball(0.16, 12, 8), 0x8a5a2b).scale.set(0.95, 1.2, 0.9);
  add(owl, ball(0.11, 10, 8), 0xf3dcb0, 0, -0.02, 0.09, 0).scale.set(1, 1.15, 0.6);
  add(owl, ball(0.13, 12, 8), 0x8a5a2b, 0, 0.2, 0.02);
  for (const s of [-1, 1]) {
    add(owl, ball(0.056, 8, 6), 0xffd24a, s * 0.056, 0.22, 0.12, 0);
    add(owl, ball(0.028, 6, 5), 0x1a1030, s * 0.056, 0.22, 0.165, 0);
    add(owl, new THREE.ConeGeometry(0.04, 0.12, 5), 0x8a5a2b, s * 0.08, 0.33, 0, 0).rotation.z = -s * 0.25;
  }
  add(owl, new THREE.ConeGeometry(0.024, 0.07, 5), 0xffa21f, 0, 0.18, 0.15, 0).rotation.x = 2.1;

  // Storybook in his right hand.
  const book = pivot(right.fore, 0.08, -0.72, 0.16);
  add(book, B(0.1, 0.58, 0.44), 0xff2e88, 0, 0, 0, FINE);
  add(book, B(0.11, 0.52, 0.4), 0xfff6d6, 0.008, 0, 0.015, 0);
  diamond(book, 0.08, gold, 0.06, 0.06, 0).rotation.set(0, 0, Math.PI / 2);
  return finish(g, [h]);
}

// Change these to match a reference image of the goat.
export const GOAT_COLORS = { coat: 0xf1eee6, shade: 0xc9c2b4, horn: 0xc9a14a, scarf: 0x2f6bff, lens: 0x2ef2a3, hoof: 0x24183a, eye: 0xd8972a };

export function makeGoat() {
  const c = GOAT_COLORS;
  const g = new THREE.Group();

  // Lean barrel: deep chest, tucked belly.
  const body = lathe([[0.001, -0.74], [0.2, -0.66], [0.3, -0.34], [0.3, 0.02], [0.37, 0.4], [0.3, 0.68], [0.001, 0.76]], 16);
  body.rotateX(Math.PI / 2);
  const barrel = add(g, body, c.coat, 0, 1.42, 0);
  barrel.scale.x = 0.82;
  const neck = lathe([[0.2, 0], [0.16, 0.3], [0.13, 0.62]], 12);
  add(g, neck, c.coat, 0, 1.54, 0.5).rotation.x = 0.62;

  const h = pivot(g, 0, 2.08, 0.9);
  const skull = add(h, ball(0.2, 14, 10), c.coat);
  skull.scale.set(0.84, 0.95, 1);
  // Long tapering muzzle.
  const muzzle = lathe([[0.17, 0], [0.135, 0.22], [0.085, 0.42], [0.001, 0.48]], 12);
  add(h, muzzle, c.coat, 0, -0.05, 0.08).rotation.x = Math.PI / 2 + 0.5;
  add(h, ball(0.06, 8, 6), c.shade, 0, -0.26, 0.4, 0).scale.set(1.1, 0.7, 0.8);
  for (const s of [-1, 1]) {
    add(h, ball(0.016, 5, 4), c.hoof, s * 0.03, -0.25, 0.46, 0);
    const eye = add(h, ball(0.058, 10, 8), c.eye, s * 0.145, 0.04, 0.09, FINE);
    eye.scale.z = 0.7;
    add(h, B(0.016, 0.018, 0.058), c.hoof, s * 0.186, 0.04, 0.115, 0).rotation.y = s * 0.8;

    // Backward-curving horns.
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.08, 0.13, -0.02), new THREE.Vector3(s * 0.16, 0.32, -0.13), new THREE.Vector3(s * 0.22, 0.4, -0.36), new THREE.Vector3(s * 0.25, 0.25, -0.55)]);
    add(h, new THREE.TubeGeometry(curve, 16, 0.042, 7, false), c.horn, 0, 0, 0, FINE);
    add(h, ball(0.052, 8, 6), c.horn, s * 0.08, 0.13, -0.02, 0);

    const ear = cap(0.052, 0.2);
    ear.translate(0, -0.14, 0);
    const earMesh = add(h, ear, c.coat, s * 0.17, 0.08, -0.08, FINE);
    earMesh.rotation.z = s * 1.28;
    earMesh.scale.z = 0.42;

    // Goggles pushed up on the forehead.
    const ring = add(h, new THREE.TorusGeometry(0.075, 0.018, 6, 16), c.horn, s * 0.082, 0.17, 0.11, 0);
    ring.rotation.x = -0.65;
    const lens = add(h, new THREE.CircleGeometry(0.068, 14), c.lens, s * 0.082, 0.17, 0.113, 0);
    lens.rotation.x = -0.65;
  }
  const strap = add(h, new THREE.TorusGeometry(0.2, 0.016, 5, 22), c.hoof, 0, 0.13, -0.02, 0);
  strap.rotation.x = Math.PI / 2 - 0.3;

  // Pointed beard.
  const beard = new THREE.ConeGeometry(0.05, 0.3, 6);
  beard.rotateX(Math.PI);
  add(h, beard, c.shade, 0, -0.42, 0.3, FINE);

  const scarf = add(g, new THREE.TorusGeometry(0.21, 0.08, 7, 18), c.scarf, 0, 1.68, 0.66, FINE);
  scarf.rotation.x = Math.PI / 2.6;
  cloth(g, c.scarf, 0.08, 1.62, 0.86, 0.34, 0.2, 0.08);
  cloth(g, 0x2354c8, -0.08, 1.62, 0.85, 0.24, 0.12, 0.07);

  const tail = new THREE.ConeGeometry(0.075, 0.3, 6);
  tail.translate(0, 0.15, 0);
  add(g, tail, c.coat, 0, 1.62, -0.72, FINE).rotation.x = -0.65;

  const leg = (x, z) => {
    const p = pivot(g, x, 1.14, z);
    add(p, lathe([[0.125, 0.12], [0.11, -0.2], [0.06, -0.44], [0.075, -0.52], [0.05, -0.76], [0.06, -0.92]], 10), c.coat, 0, 0, 0, FINE);
    add(p, lathe([[0.065, -0.94], [0.08, -1.08], [0.085, -1.13], [0.001, -1.14]], 8), c.hoof, 0, 0, 0, 0);
    return p;
  };
  g.userData = { armL: leg(-0.17, 0.44), armR: leg(0.17, 0.44), legL: leg(-0.17, -0.52), legR: leg(0.17, -0.52), headY: 1.95 };
  return finish(g, [h]);
}
