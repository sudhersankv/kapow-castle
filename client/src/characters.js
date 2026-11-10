import * as THREE from 'three';

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

// Constant-width outline: pushes the hull out along normals by a fixed distance.
const hulls = new Map();
function hullMat(width) {
  if (!hulls.has(width)) {
    hulls.set(width, new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { width: { value: width } },
      vertexShader: 'uniform float width; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normalize(normal) * width, 1.0); }',
      fragmentShader: 'void main(){ gl_FragColor = vec4(0.102, 0.063, 0.188, 1.0); }',
    }));
  }
  return hulls.get(width);
}

const LINE = 0.028;
const FINE = 0.016;

function add(parent, geo, color, x = 0, y = 0, z = 0, width = LINE) {
  const mesh = new THREE.Mesh(geo, toon(color));
  mesh.position.set(x, y, z);
  if (width) mesh.add(new THREE.Mesh(geo, hullMat(width)));
  parent.add(mesh);
  return mesh;
}

function pivot(parent, x, y, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 8, 16);

function lathe(points, segments = 26) {
  const curve = new THREE.SplineCurve(points.map(([r, y]) => new THREE.Vector2(r, y)));
  const smooth = curve.getPoints(28).map((p) => new THREE.Vector2(Math.max(0.001, p.x), p.y));
  return new THREE.LatheGeometry(smooth, segments);
}

// Tapered limb hanging from its origin.
const limbGeo = (top, bottom, length) => lathe([[0.001, 0.02], [top * 0.8, -0.02], [top, -0.12], [(top + bottom) / 2 + 0.01, -length * 0.5], [bottom, -length + 0.1], [bottom * 0.7, -length]], 16);

// Narrows the lower half of a sphere into a soft chin. Applied to head and face so they match.
function warpChin(geo, r) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / r;
    if (y >= 0) continue;
    const k = 1 - 0.26 * Math.pow(-y, 1.6);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * 1.1, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function faceTexture(o) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  const eyeW = o.eyeW || 62;
  const eyeH = o.eyeH || 88;
  const spread = o.spread || 92;
  const eyeY = o.eyeY || 170;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (o.blush) {
    ctx.fillStyle = o.blush;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(256 + s * (spread + 34), eyeY + 66, 36, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const s of [-1, 1]) {
    const cx = 256 + s * spread;
    ctx.save();
    ctx.translate(cx, eyeY);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = o.iris;
    ctx.beginPath();
    ctx.ellipse(s * -4, 8, eyeW * 0.4, eyeH * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.irisLight || 'rgba(255,255,255,.45)';
    ctx.beginPath();
    ctx.ellipse(s * -4, 32, eyeW * 0.28, eyeH * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1030';
    ctx.beginPath();
    ctx.ellipse(s * -4, 6, eyeW * 0.2, eyeH * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s * -4 - 11, -13, 11, 0, Math.PI * 2);
    ctx.arc(s * -4 + 11, 18, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1030';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeW / 2 + 2, eyeH / 2 + 2, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeW / 2, eyeH / 2, 0, Math.PI * 0.3, Math.PI * 0.7);
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(s * (eyeW / 2 - 2), -eyeH * 0.2);
    ctx.lineTo(s * (eyeW / 2 + 15), -eyeH * 0.34);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, eyeY - eyeH / 2 - 26 + (o.browDrop || 0));
    ctx.rotate(s * (o.brow ?? -0.15));
    ctx.strokeStyle = o.browColor || '#1a1030';
    ctx.lineWidth = o.browWidth || 12;
    ctx.beginPath();
    ctx.moveTo(-38, 0);
    ctx.quadraticCurveTo(0, -9, 38, 0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = '#1a1030';
  ctx.lineWidth = 6;
  ctx.fillStyle = '#b52a4a';
  const my = eyeY + 92;
  ctx.beginPath();
  if (o.mouth === 'open') {
    ctx.moveTo(214, my - 8);
    ctx.quadraticCurveTo(256, my + 8, 298, my - 8);
    ctx.quadraticCurveTo(286, my + 42, 256, my + 42);
    ctx.quadraticCurveTo(226, my + 42, 214, my - 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(222, my - 3);
    ctx.quadraticCurveTo(256, my + 9, 290, my - 3);
    ctx.lineTo(284, my + 10);
    ctx.quadraticCurveTo(256, my + 18, 228, my + 10);
    ctx.closePath();
    ctx.fill();
  } else if (o.mouth === 'smirk') {
    ctx.moveTo(226, my + 6);
    ctx.quadraticCurveTo(262, my + 20, 296, my - 10);
    ctx.stroke();
  } else if (o.mouth === 'smile') {
    ctx.moveTo(222, my);
    ctx.quadraticCurveTo(256, my + 28, 290, my);
    ctx.stroke();
  }
  o.extra?.(ctx, eyeY, spread);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function head(parent, r, skin, y, faceOptions, z = 0) {
  const group = pivot(parent, 0, y, z);
  add(group, warpChin(new THREE.SphereGeometry(r, 32, 24), r), skin);
  const faceGeo = warpChin(new THREE.SphereGeometry(r * 1.012, 32, 20, Math.PI / 2 - 1.1, 2.2, 0.8, 1.4), r * 1.012);
  const material = new THREE.MeshBasicMaterial({ map: faceTexture(faceOptions), transparent: true, depthWrite: false });
  group.add(new THREE.Mesh(faceGeo, material));
  return group;
}

// Cone rooted at its base, so rotation swings it from the root.
function spike(parent, radius, length, color, x, y, z, rx = 0, rz = 0, width = FINE) {
  const geo = K(radius, length, 10);
  geo.translate(0, length / 2, 0);
  const mesh = add(parent, geo, color, x, y, z, width);
  mesh.rotation.set(rx, 0, rz);
  return mesh;
}

function hairCap(parent, r, color, tilt = -0.55, reach = 1.5) {
  const mesh = add(parent, new THREE.SphereGeometry(r * 1.05, 28, 18, 0, Math.PI * 2, 0, reach), color);
  mesh.rotation.x = tilt;
  return mesh;
}

function torus(parent, r, tube, color, x, y, z, rx = Math.PI / 2, width = FINE) {
  const mesh = add(parent, new THREE.TorusGeometry(r, tube, 10, 32), color, x, y, z, width);
  mesh.rotation.x = rx;
  return mesh;
}

// Shared body. Options set colors and whether the torso is a robe.
function humanoid({ skin, top, pants, boots, gloves, sleeve, face, hipY = 1.32 }) {
  const g = new THREE.Group();
  const r = 0.74;
  const headY = 3.02;

  const torso = add(g, lathe([[0.001, hipY - 0.12], [0.34, hipY - 0.06], [0.37, hipY + 0.22], [0.31, hipY + 0.5], [0.42, hipY + 0.85], [0.3, hipY + 1.08], [0.001, hipY + 1.14]]), top);
  torso.scale.z = 0.76;
  add(g, cap(0.14, 0.12), skin, 0, 2.5, 0, 0);

  const leg = (s) => {
    const p = pivot(g, s * 0.2, hipY);
    add(p, limbGeo(0.21, 0.13, hipY - 0.2), pants);
    const boot = pivot(p, 0, -hipY);
    add(boot, lathe([[0.001, 0.62], [0.16, 0.6], [0.18, 0.34], [0.19, 0.16], [0.001, 0.14]], 16), boots, 0, 0.0, 0, FINE);
    const foot = add(boot, S(0.22), boots, 0, 0.13, 0.1, FINE);
    foot.scale.set(0.95, 0.62, 1.45);
    return p;
  };
  const arm = (s) => {
    const p = pivot(g, s * 0.5, 2.3);
    p.rotation.z = s * 0.12;
    add(p, limbGeo(0.15, 0.11, 0.86), sleeve || top, 0, 0, 0, FINE);
    const hand = add(p, S(0.16), gloves || skin, 0, -0.95, 0, FINE);
    hand.scale.set(1, 1.08, 1);
    if (gloves) torus(p, 0.135, 0.05, gloves, 0, -0.74, 0, Math.PI / 2);
    return p;
  };

  g.userData = { armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1), headY };
  g.head = undefined;
  const headGroup = head(g, r, skin, headY, face);
  return { g, headGroup, r, hipY };
}

export function animate(char, speed, t) {
  const { armL, armR, legL, legR } = char.userData;
  const swing = speed > 0.1 ? Math.sin(t * (6 + speed)) * 0.75 : 0;
  armL.rotation.x = swing;
  armR.rotation.x = -swing;
  legL.rotation.x = -swing;
  legR.rotation.x = swing;
}

function belt(g, y, radius, color, zScale = 0.78) {
  torus(g, radius, 0.075, color, 0, y, 0).scale.y = zScale;
}

function scarfTail(g, color, x, y, z, rx, rz, length = 0.7) {
  const geo = cap(0.11, length);
  geo.translate(0, -length / 2, 0);
  const tail = add(g, geo, color, x, y, z, FINE);
  tail.rotation.set(rx, 0, rz);
  tail.scale.z = 0.4;
  return tail;
}

export function makeHero() {
  const hair = 0x7a2be2;
  const { g, headGroup: h, r } = humanoid({
    skin: 0xf4bd8f, top: 0x12c7c7, pants: 0x3226c4, boots: 0xff2e88, gloves: 0xfff3dc, sleeve: 0x0fa9b5,
    face: {
      iris: '#1fa8ff', brow: -0.2, mouth: 'open', blush: 'rgba(255,110,120,.5)', browColor: '#5a1fb0',
      extra(ctx, eyeY, spread) {
        ctx.fillStyle = '#ffc400';
        ctx.strokeStyle = '#1a1030';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const d = i % 2 ? 9 : 20;
          ctx[i ? 'lineTo' : 'moveTo'](256 + spread + 46 + Math.cos(a) * d, eyeY + 50 + Math.sin(a) * d);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      },
    },
  });

  hairCap(h, r, hair);
  for (const [x, y, z, rx, rz, len] of [
    [0, 0.68, -0.12, -0.75, 0, 0.95], [-0.34, 0.6, -0.18, -0.75, 0.5, 0.85], [0.34, 0.6, -0.18, -0.75, -0.5, 0.85],
    [-0.2, 0.42, -0.5, -1.25, 0.25, 0.9], [0.2, 0.42, -0.5, -1.25, -0.25, 0.9], [-0.56, 0.3, -0.34, -1.05, 0.95, 0.72], [0.56, 0.3, -0.34, -1.05, -0.95, 0.72],
    [0, 0.8, 0.2, -0.3, 0, 0.72],
  ]) spike(h, 0.2, len, hair, x, y, z, rx, rz);
  for (const [x, rz, len] of [[-0.38, 0.12, 0.4], [-0.12, 0.04, 0.44], [0.14, -0.05, 0.42], [0.4, -0.14, 0.38]]) {
    spike(h, 0.15, len, hair, x, 0.56, 0.42, 2.52, rz);
  }

  // Cropped jacket with open front and a gold belt.
  add(g, lathe([[0.001, 2.18], [0.3, 2.14], [0.33, 2.3], [0.001, 2.44]], 20), 0xfff3dc, 0, 0, 0.13, FINE).scale.z = 0.6;
  belt(g, 1.5, 0.36, 0xffc400);
  for (const s of [-1, 1]) add(g, S(0.22), 0xff2e88, s * 0.55, 2.42, 0, FINE).scale.set(1, 0.72, 1);

  torus(g, 0.25, 0.1, 0xff2e88, 0, 2.5, 0, Math.PI / 2, FINE);
  scarfTail(g, 0xff2e88, -0.12, 2.48, -0.28, -0.75, 0.15, 0.85);
  scarfTail(g, 0xd11f6e, 0.14, 2.46, -0.28, -0.5, -0.2, 0.6);

  const satchel = add(g, cap(0.2, 0.3), 0xffa53d, 0, 1.95, -0.34, FINE);
  satchel.rotation.z = Math.PI / 2;
  satchel.scale.z = 0.7;
  return g;
}

export function makeSumi() {
  const steel = 0xd8def5;
  const pink = 0xff4f9e;
  const { g, headGroup: h, r } = humanoid({
    skin: 0xb9794c, top: steel, pants: 0x6a3fd0, boots: 0xaab2d8, gloves: 0xaab2d8, sleeve: 0x8b5fe0,
    face: {
      iris: '#ff4f9e', brow: -0.28, browWidth: 14, mouth: 'smirk', blush: 'rgba(255,90,110,.32)',
      extra(ctx, eyeY, spread) {
        ctx.strokeStyle = '#ffc400';
        ctx.lineWidth = 7;
        for (const n of [0, 16, 32]) {
          ctx.beginPath();
          ctx.moveTo(256 - spread - 64 + n, eyeY + 56);
          ctx.lineTo(256 - spread - 64 + n, eyeY + 84);
          ctx.stroke();
        }
      },
    },
  });

  const helmet = add(h, new THREE.SphereGeometry(r * 1.1, 30, 18, 0, Math.PI * 2, 0, 1.28), steel);
  helmet.rotation.x = -0.5;
  torus(h, r * 0.99, 0.055, 0xffc400, 0, 0.16, -0.26, Math.PI / 2 - 0.5);
  for (const s of [-1, 1]) {
    const guard = add(h, cap(0.15, 0.32), steel, s * 0.68, -0.22, -0.02, FINE);
    guard.rotation.z = s * 0.14;
  }
  for (let i = 0; i < 7; i++) {
    const a = -0.1 - i * 0.34;
    spike(h, 0.13, 0.8 - i * 0.04, pink, 0, Math.cos(a) * r * 1.07 , Math.sin(a) * r * 1.07 - 0.1, a - 0.45);
  }

  // Layered tabard, breastplate ridge and rounded pauldrons.
  add(g, lathe([[0.31, 1.62], [0.38, 1.4], [0.5, 1.14], [0.6, 0.92]], 22), pink).scale.z = 0.82;
  torus(g, 0.59, 0.045, 0xffc400, 0, 0.93, 0).scale.y = 0.82;
  belt(g, 1.56, 0.34, 0xffc400);
  add(g, S(0.14), 0xffc400, 0, 2.05, 0.31, FINE).scale.set(1, 1.5, 0.5);

  for (const arm of [g.userData.armL, g.userData.armR]) {
    add(arm, S(0.3), steel, 0, 0.04, 0).scale.set(1.05, 0.82, 1.05);
    torus(arm, 0.235, 0.04, 0xffc400, 0, -0.1, 0);
  }

  const cape = add(g, lathe([[0.3, 2.42], [0.48, 2.1], [0.6, 1.5], [0.72, 0.85]], 20), 0x5a2fc0);
  cape.scale.z = 0.5;
  cape.position.z = -0.26;

  // Abacus shield.
  const shield = pivot(g.userData.armR, 0.27, -0.62, 0.05);
  add(shield, C(0.74, 0.74, 0.1, 30), 0xb06a2c).rotation.z = Math.PI / 2;
  torus(shield, 0.74, 0.07, 0xffc400, 0, 0, 0, 0).rotation.y = Math.PI / 2;
  const colors = [0xffc400, 0x2ef2a3, 0xff2e88, 0x12c7c7];
  for (let i = 0; i < 4; i++) {
    const y = 0.42 - i * 0.28;
    const half = Math.sqrt(Math.max(0, 0.68 * 0.68 - y * y));
    add(shield, C(0.022, 0.022, half * 2, 8), 0x1a1030, 0.09, y, 0, 0).rotation.x = Math.PI / 2;
    for (let j = 0; j < 4; j++) {
      const bead = add(shield, S(0.095), colors[(i + j) % 4], 0.1, y, -half * 0.68 + j * 0.34 + (i % 2) * 0.09, FINE);
      bead.scale.x = 0.75;
    }
  }
  return g;
}

export function makeQuill() {
  const feather = 0x8a5a2b;
  const dark = 0x613b1a;
  const cream = 0xf6e2b8;
  const g = new THREE.Group();

  add(g, lathe([[0.001, 0.2], [0.62, 0.3], [0.98, 0.85], [1.0, 1.45], [0.86, 2.05], [0.62, 2.45], [0.001, 2.6]]), feather).scale.z = 0.88;
  const belly = add(g, S(0.74), cream, 0, 1.22, 0.36, 0);
  belly.scale.set(1, 1.2, 0.72);
  for (const [row, count, y] of [[0, 3, 1.72], [1, 4, 1.42], [2, 3, 1.12], [3, 2, 0.82]]) {
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 0.34;
      const mark = spike(g, 0.09, 0.2, dark, x, y, 0.96 - Math.abs(x) * 0.24 - row * 0.02, 2.75, 0, 0);
      mark.scale.z = 0.4;
    }
  }

  const r = 0.98;
  const h = head(g, r, feather, 2.72, {
    iris: '#ffb627', irisLight: 'rgba(255,240,170,.75)', eyeW: 92, eyeH: 106, spread: 90, eyeY: 164, brow: 0.22, browDrop: 16, browColor: '#3f240c', browWidth: 15, mouth: 'none',
  });
  // Pale facial disc behind the eyes, placed under the face layer.
  for (const s of [-1, 1]) {
    const disc = add(h, S(0.44), cream, s * 0.37, 0.05, 0.57, 0);
    disc.scale.set(1, 1.08, 0.72);
    torus(h, 0.33, 0.028, 0xffc400, s * 0.37, 0.06, 0.98, 0, 0);
  }
  add(h, C(0.02, 0.02, 0.16, 8), 0xffc400, 0, 0.1, 1.0, 0).rotation.z = Math.PI / 2;
  const beak = spike(h, 0.14, 0.42, 0xffa21f, 0, -0.1, 0.92, 2.1);
  beak.scale.x = 0.85;
  for (const s of [-1, 1]) {
    spike(h, 0.26, 0.8, feather, s * 0.56, 0.68, -0.02, -0.2, -s * 0.55);
    spike(h, 0.12, 0.5, dark, s * 0.62, 0.74, 0.02, -0.15, -s * 0.5);
  }

  torus(g, 0.68, 0.11, 0x12c7c7, 0, 2.08, 0, Math.PI / 2 + 0.05, FINE);
  scarfTail(g, 0x12c7c7, 0.32, 2.02, 0.58, 0.1, 0.1, 0.5);

  const wing = (s) => {
    const p = pivot(g, s * 0.94, 2.05);
    p.rotation.z = s * 0.14;
    const blade = cap(0.26, 0.88);
    blade.translate(0, -0.62, 0);
    add(p, blade, dark).scale.z = 0.42;
    for (let i = 0; i < 3; i++) {
      const tip = spike(p, 0.11, 0.42, feather, (i - 1) * 0.15, -1.2, 0, Math.PI, (i - 1) * 0.3);
      tip.scale.z = 0.45;
    }
    return p;
  };
  const foot = (s) => {
    const p = pivot(g, s * 0.42, 0.32);
    add(p, cap(0.09, 0.14), 0xffa21f, 0, -0.14, 0, FINE);
    for (let i = -1; i <= 1; i++) add(p, cap(0.07, 0.18), 0xffa21f, i * 0.16, -0.26, 0.16, FINE).rotation.set(Math.PI / 2, 0, -i * 0.1);
    return p;
  };
  g.userData = { armL: wing(-1), armR: wing(1), legL: foot(-1), legR: foot(1), headY: 2.72 };

  // Storybook held in the wing.
  const book = pivot(g.userData.armR, 0.14, -0.92, 0.42);
  add(book, B(0.14, 0.84, 0.66), 0xff2e88, 0, 0, 0, FINE);
  add(book, B(0.16, 0.76, 0.6), 0xfff6d6, 0.012, 0, 0.02, 0);
  add(book, S(0.09), 0xffc400, 0.09, 0.1, 0, 0).scale.x = 0.3;
  return g;
}

function deel(g, color, trim, sash) {
  const robe = add(g, lathe([[0.3, 2.42], [0.42, 2.14], [0.37, 1.62], [0.5, 1.22], [0.68, 0.82], [0.8, 0.5]], 26), color);
  robe.scale.z = 0.84;
  torus(g, 0.8, 0.055, trim, 0, 0.5, 0).scale.y = 0.84;
  belt(g, 1.6, 0.39, sash, 0.82);
  // Diagonal overlap of the robe, with buttons.
  const flap = add(g, cap(0.042, 0.72), trim, 0.1, 2.12, 0.33, 0);
  flap.rotation.set(0.18, 0, 0.72);
  for (const [x, y] of [[0.2, 1.98], [0.28, 1.86]]) add(g, S(0.05), 0xffc400, x, y, 0.33, 0);
  for (const arm of [g.userData.armL, g.userData.armR]) {
    add(arm, lathe([[0.17, -0.02], [0.2, -0.32], [0.27, -0.72]], 16), color, 0, 0, 0, FINE);
    torus(arm, 0.27, 0.04, trim, 0, -0.72, 0);
  }
  // Curled toe of Mongolian boots.
  for (const leg of [g.userData.legL, g.userData.legR]) spike(leg, 0.08, 0.26, trim, 0, -1.18, 0.33, 0.85);
}

export function makeTolu() {
  const green = 0x1f8a5b;
  const { g, headGroup: h, r } = humanoid({
    skin: 0xd09160, top: green, pants: 0x14583c, boots: 0x7a3b12, sleeve: green,
    face: {
      iris: '#2a9d5c', brow: 0.08, browWidth: 17, browColor: '#2a1608', eyeW: 54, eyeH: 66, eyeY: 176, blush: 'rgba(230,90,70,.35)', mouth: 'smile',
      extra(ctx, eyeY) {
        ctx.fillStyle = '#2a1608';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(256, eyeY + 68);
          ctx.quadraticCurveTo(256 + s * 46, eyeY + 56, 256 + s * 90, eyeY + 88);
          ctx.quadraticCurveTo(256 + s * 42, eyeY + 88, 256, eyeY + 80);
          ctx.fill();
        }
      },
    },
  });
  deel(g, green, 0xffc400, 0xd11f3f);
  // Felt hat with upturned brim.
  add(h, lathe([[r * 0.98, 0.32], [r * 1.14, 0.34], [r * 1.22, 0.56], [r * 1.02, 0.62], [r * 0.86, 0.6]], 28), 0xffc400);
  add(h, lathe([[r * 0.88, 0.5], [r * 0.84, 0.86], [r * 0.5, 1.2], [0.08, 1.34], [0.001, 1.38]], 26), green);
  add(h, S(0.11), 0xd11f3f, 0, 1.4, 0, FINE);

  // Mallet in the right hand.
  const grip = pivot(g.userData.armR, 0, -0.96, 0.05);
  add(grip, C(0.05, 0.06, 1.15, 10), 0x7a3b12, 0, 0, 0.4, FINE).rotation.x = Math.PI / 2 - 0.2;
  const mallet = add(grip, cap(0.2, 0.34), 0xc98a4a, 0, 0.12, 0.98);
  torus(mallet, 0.2, 0.03, 0xffc400, 0, 0.2, 0, Math.PI / 2, 0);
  torus(mallet, 0.2, 0.03, 0xffc400, 0, -0.2, 0, Math.PI / 2, 0);
  return g;
}

export function makeSarnai() {
  const red = 0xd11f3f;
  const hair = 0x241338;
  const teal = 0x12c7c7;
  const { g, headGroup: h, r } = humanoid({
    skin: 0xe6ad7e, top: red, pants: 0x2a1fa8, boots: 0x1a1030, sleeve: red,
    face: {
      iris: '#c0651b', brow: -0.04, mouth: 'open', eyeH: 92, blush: 'rgba(255,90,110,.5)',
      extra(ctx, eyeY, spread) {
        ctx.fillStyle = '#9c5a2c';
        for (const s of [-1, 1]) for (const [dx, dy] of [[0, 0], [20, 7], [40, 0]]) {
          ctx.beginPath();
          ctx.arc(256 + s * (spread + 2 + dx - 20), eyeY + 60 + dy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    },
  });
  deel(g, red, teal, 0xffc400);
  hairCap(h, r, hair, -0.42, 1.45);
  // Tall riding hat with a fur band.
  add(h, lathe([[r * 0.92, 0.36], [r * 1.14, 0.44], [r * 1.16, 0.68], [r * 0.9, 0.76]], 28), 0xfff0d4);
  add(h, lathe([[r * 0.78, 0.68], [r * 0.6, 1.1], [r * 0.28, 1.5], [0.001, 1.72]], 24), red);
  add(h, S(0.1), 0xffc400, 0, 1.74, 0, FINE);

  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const link = add(h, S(0.15 - i * 0.012), hair, s * (0.72 + i * 0.015), -0.2 - i * 0.22, -0.16 - i * 0.02, FINE);
      link.scale.y = 0.95;
    }
    add(h, S(0.09), teal, s * 0.79, -1.3, -0.25, FINE).scale.y = 1.2;
  }

  // Bell pouch and signal horn.
  const pouch = add(g, cap(0.15, 0.1), 0xffa53d, -0.42, 1.38, 0.22, FINE);
  pouch.scale.z = 0.6;
  const grip = pivot(g.userData.armR, 0, -0.95, 0.04);
  const horn = add(grip, lathe([[0.03, 0], [0.05, 0.3], [0.09, 0.56], [0.22, 0.74]], 14), 0xffc400, 0, 0, 0, FINE);
  horn.rotation.x = Math.PI / 2 + 0.3;
  return g;
}

// Change these to match a reference image of the goat.
export const GOAT_COLORS = { coat: 0xf4f1ff, shade: 0xc9c6ea, horn: 0xffc400, scarf: 0x2f6bff, lens: 0x2ef2a3, hoof: 0x1a1030 };

function horn(parent, s, color) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(s * 0.14, 0.25, -0.02),
    new THREE.Vector3(s * 0.25, 0.6, -0.14),
    new THREE.Vector3(s * 0.38, 0.72, -0.48),
    new THREE.Vector3(s * 0.48, 0.48, -0.74),
  ]);
  add(parent, new THREE.TubeGeometry(curve, 24, 0.07, 10, false), color, 0, 0, 0, FINE);
  add(parent, S(0.09), color, s * 0.14, 0.24, -0.02, FINE);
}

export function makeGoat() {
  const c = GOAT_COLORS;
  const g = new THREE.Group();

  const body = cap(0.5, 0.86);
  body.rotateX(Math.PI / 2);
  add(g, body, c.coat, 0, 1.2, -0.08);
  add(g, S(0.42), c.shade, 0, 1.0, 0.44, 0).scale.set(0.85, 0.75, 0.8);
  const neck = cap(0.26, 0.4);
  add(g, neck, c.coat, 0, 1.68, 0.62).rotation.x = 0.55;

  const r = 0.46;
  const h = head(g, r, c.coat, 2.0, {
    iris: '#2f6bff', eyeW: 74, eyeH: 96, spread: 104, eyeY: 188, brow: -0.12, browDrop: 8, mouth: 'none',
  }, 0.9);
  const snout = add(h, cap(0.21, 0.2), c.shade, 0, -0.18, 0.34);
  snout.rotation.x = Math.PI / 2 + 0.28;
  for (const s of [-1, 1]) add(h, S(0.036), c.hoof, s * 0.09, -0.11, 0.66, 0);
  const smile = add(h, new THREE.TorusGeometry(0.1, 0.014, 6, 18, Math.PI), c.hoof, 0, -0.25, 0.6, 0);
  smile.rotation.set(0.25, 0, Math.PI);

  for (const s of [-1, 1]) {
    horn(h, s, c.horn);
    const ear = cap(0.1, 0.32);
    ear.translate(0, -0.2, 0);
    const mesh = add(h, ear, c.coat, s * 0.42, 0.14, -0.06, FINE);
    mesh.rotation.z = s * 1.2;
    mesh.scale.z = 0.5;
  }

  // Goggles pushed up on the forehead.
  add(h, new THREE.TorusGeometry(0.44, 0.04, 8, 32), c.hoof, 0, 0.28, -0.03, 0).rotation.x = Math.PI / 2 - 0.35;
  for (const s of [-1, 1]) {
    torus(h, 0.13, 0.035, c.horn, s * 0.16, 0.33, 0.34, 0.42, 0);
    const lens = add(h, new THREE.CircleGeometry(0.125, 20), c.lens, s * 0.16, 0.33, 0.35, 0);
    lens.rotation.x = -0.42;
  }

  spike(h, 0.09, 0.42, c.shade, 0, -0.36, 0.42, Math.PI - 0.15);

  torus(g, 0.33, 0.12, c.scarf, 0, 1.5, 0.56, Math.PI / 2.5, FINE);
  scarfTail(g, c.scarf, 0.14, 1.42, 0.8, 0.25, 0.1, 0.5);
  scarfTail(g, 0x2354c8, -0.12, 1.42, 0.79, 0.15, -0.1, 0.36);

  spike(g, 0.13, 0.48, c.coat, 0, 1.46, -0.82, -0.75);

  const leg = (x, z) => {
    const p = pivot(g, x, 0.86, z);
    add(p, limbGeo(0.17, 0.095, 0.7), c.coat, 0, 0, 0, FINE);
    add(p, lathe([[0.001, -0.62], [0.12, -0.64], [0.135, -0.8], [0.001, -0.86]].reverse(), 12), c.hoof, 0, 0, 0, 0);
    return p;
  };
  g.userData = { armL: leg(-0.26, 0.42), armR: leg(0.26, 0.42), legL: leg(-0.26, -0.58), legR: leg(0.26, -0.58), headY: 2.0 };
  return g;
}
