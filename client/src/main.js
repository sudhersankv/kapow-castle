import * as THREE from 'three';
import './upload.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeHero, makeGoat, makeSumi, makeQuill, makeTolu, makeSarnai, animate } from './characters.js';
import { buildWorld, ROOMS, textSprite } from './world.js';
import { initFx, flash, shardBurst, slashWipe, stageCard, setVoiceMeter, setPips, showHints, hideHints } from './fx2d.js';
import { initVoice, voiceReady, startCall, endCall, tellCharacter, muteCall, startRecording } from './voice.js';

const $ = (id) => document.getElementById(id);
initFx();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const NPC_DEFS = [
  {
    id: 'sumi', name: 'Sumi the Abacus Knight', short: 'Sumi', subject: 'math', voice: 'thalia', make: makeSumi, home: [0, -6],
    catchphrase: 'Count me in!',
    personality: 'a brave young knight who treats every sum like a grand quest',
    speechStyle: 'Bold, bright and upbeat. Short punchy sentences. Sometimes counts one, two, three for fun.',
  },
  {
    id: 'quill', name: 'Old Quill', short: 'Old Quill', subject: 'the childhood of Genghis Khan', voice: 'zeus', make: makeQuill, home: [0, -42],
    catchphrase: 'Hoo-hoo, gather round!',
    personality: 'a kind old owl storyteller who guides a tour of the steppe',
    speechStyle: 'Slow, cozy and grandfatherly, with gentle pauses. Says hoo-hoo when delighted.',
  },
  {
    id: 'tolu', name: 'Tolu the Ger Builder', short: 'Tolu', subject: 'how Genghis Khan united the tribes', voice: 'apollo', make: makeTolu, home: [0, -82],
    catchphrase: 'Stake by stake, we build it great!',
    personality: 'a hearty builder of round felt tents, proud of working together',
    speechStyle: 'Hearty, warm and encouraging. Loves building comparisons.',
  },
  {
    id: 'sarnai', name: 'Sarnai the Rider', short: 'Sarnai', subject: 'the Mongol messenger relay and the Silk Road', voice: 'aurora', make: makeSarnai, home: [0, -122],
    catchphrase: 'Fresh horse, fast news!',
    personality: 'a thrilled relay messenger who is always about to gallop off',
    speechStyle: 'Quick, breathless and excited. Says giddy-up when the child is right.',
  },
];

// Scene
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1500);
scene.add(new THREE.HemisphereLight(0xfff1d0, 0xb05a70, 1.7));
const sunLight = new THREE.DirectionalLight(0xfff0d0, 2.2);
sunLight.position.set(-30, 60, 20);
scene.add(sunLight);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 2 }));
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.32, 0.55, 0.9));
composer.addPass(new OutputPass());

// Lowers quality automatically on slower computers.
let quality = 0;
function lowerQuality() {
  quality += 1;
  renderer.setPixelRatio(quality === 1 ? 1 : 0.7);
  resize();
  console.info(`quality lowered to level ${quality}`);
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const world = buildWorld(scene);

// Combines the static castle into a few draw calls. Anything that moves stays separate.
function mergeStatic(root) {
  const dynamic = new Set();
  const markDynamic = (o) => o?.traverse?.((c) => dynamic.add(c));
  for (const gate of world.gates) [gate.mesh, ...(gate.leaves || []), ...(gate.seals || [])].forEach(markDynamic);
  root.updateMatrixWorld(true);
  const before = new Map();
  root.traverse((o) => before.set(o, o.matrixWorld.clone()));
  world.tick(3.1, 0.016);
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (!o.matrixWorld.equals(before.get(o))) markDynamic(o); });

  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || dynamic.has(o) || Array.isArray(o.material) || o.material.transparent) return;
    if (!o.geometry.attributes.uv || !o.geometry.attributes.normal) return;
    const m = o.material;
    const key = m.isShaderMaterial ? m.uuid : [m.type, m.color?.getHex(), m.map?.uuid, m.side, m.gradientMap?.uuid, m.emissive?.getHex()].join('|');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geometries = list.map((o) => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      return g.applyMatrix4(o.matrixWorld);
    });
    const merged = mergeGeometries(geometries);
    if (!merged) continue;
    root.add(new THREE.Mesh(merged, list[0].material));
    // Hides only this mesh; any sprites or moving children under it keep rendering.
    list.forEach((o) => o.layers.set(31));
  }
}
mergeStatic(scene);

function addShadow(group, radius) {
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), new THREE.MeshBasicMaterial({ color: 0x1a1030, transparent: true, opacity: 0.3 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  group.add(shadow);
}

const hero = makeHero();
hero.position.set(0, 0, 8);
hero.rotation.y = Math.PI;
addShadow(hero, 1);
scene.add(hero);

const goat = makeGoat();
goat.position.set(-3, 0, 11);
addShadow(goat, 1);
scene.add(goat);

const npcs = NPC_DEFS.map((def) => {
  const mesh = def.make();
  mesh.position.set(def.home[0], 0, def.home[1]);
  addShadow(mesh, 1.2);
  scene.add(mesh);
  return { ...def, mesh, target: new THREE.Vector3(def.home[0], 0, def.home[1]), wait: 0, cool: false, hop: 0 };
});

function renderPortraits() {
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(160, 160);
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xffffff, 0x8866aa, 2.4));
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const shot = (char) => {
    const copy = char.clone();
    copy.position.set(0, 0, 0);
    copy.rotation.set(0, 0, 0);
    s.add(copy);
    const y = char.userData.headY;
    cam.position.set(0.5, y + 0.1, 2.4);
    cam.lookAt(0, y, 0);
    r.render(s, cam);
    s.remove(copy);
    return r.domElement.toDataURL();
  };
  const urls = { hero: shot(hero), goat: shot(goat) };
  for (const npc of npcs) urls[npc.id] = shot(npc.mesh);
  r.dispose();
  r.forceContextLoss();
  return urls;
}
const portraits = renderPortraits();
$('heroPortrait').src = portraits.hero;
$('mathPortrait').src = portraits.sumi;
$('historyPortrait').src = portraits.quill;
$('goatIcon').src = portraits.goat;

for (const npc of npcs) {
  const tag = textSprite(npc.short, 0.9, '#fff6d6');
  tag.position.y = 5.3;
  npc.mesh.add(tag);
  npc.tag = tag;
}

// Energy aura around the hero, shown while talking or sprinting.
function makeAura() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const ctx = c.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 128, 0, 0);
  gradient.addColorStop(0, 'rgba(255,255,255,.9)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(4, 128);
  ctx.quadraticCurveTo(16, 40, 16, 0);
  ctx.quadraticCurveTo(16, 40, 28, 128);
  ctx.fill();
  const material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: 0xffd84d, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const group = new THREE.Group();
  const flames = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 4.4), material);
    flame.position.set(Math.sin(a) * 1.25, 2.1, Math.cos(a) * 1.25);
    flame.rotation.y = a;
    group.add(flame);
    flames.push(flame);
  }
  hero.add(group);
  return { material, flames };
}
const aura = makeAura();

// Game state
let state = 'title';
let duel = null;
let stars = 0;
let charge = 0;
let shake = 0;
let currentRoom = 0;
let sprinting = false;
let goatRecording = null;
let goatTimer = null;
let dialogueLine = '';
const solved = {};
const keys = {};
const shards = [];
const beams = [];

const typing = () => document.activeElement === $('typed');

function toast(text, ms = 3200) {
  const el = Object.assign(document.createElement('div'), { className: 'toast', textContent: text });
  $('toasts').append(el);
  setTimeout(() => el.remove(), ms);
}

function burst(word, number) {
  const el = document.createElement('div');
  el.className = 'burst';
  el.style.left = `${45 + Math.random() * 18}%`;
  el.style.top = `${28 + Math.random() * 10}%`;
  el.innerHTML = `<b>${word}</b>${number ? `<span>+${number}</span>` : ''}`;
  $('bursts').append(el);
  setTimeout(() => el.remove(), 1300);
}

function spawnShards(position, color, count = 36) {
  const geometry = new THREE.TetrahedronGeometry(0.28);
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: [color, 0xffc400, 0xff2e88, 0x2ef2a3][i % 4] }));
    mesh.position.copy(position);
    const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.15, Math.random() - 0.5).normalize().multiplyScalar(7 + Math.random() * 10);
    scene.add(mesh);
    shards.push({ mesh, velocity, life: 1.4 });
  }
}

function fireBeam(power) {
  const from = hero.position.clone().setY(2);
  const to = duel.npc.mesh.position.clone().setY(2);
  const gap = to.clone().sub(from);
  const radius = 0.25 + power * 0.8;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, gap.length(), 14),
    new THREE.MeshBasicMaterial({ color: 0xffd84d, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }),
  );
  mesh.position.copy(from).addScaledVector(gap, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), gap.clone().normalize());
  scene.add(mesh);
  beams.push({ mesh, life: 0.5 });
}

function objective() {
  setPips(currentRoom, npcs.map((n) => Boolean(solved[n.id])));
  const gate = world.gates.find((g) => !g.open);
  if (gate) {
    const npc = npcs.find((n) => n.id === gate.needs);
    $('objective').textContent = `Find ${npc.short} and solve the puzzle to open the gate`;
  } else if (!solved.sarnai) {
    $('objective').textContent = 'Find Sarnai to finish the tour';
  } else {
    $('objective').textContent = 'Castle cleared!';
  }
}

function updateGates(npcId) {
  for (const gate of world.gates) {
    if (gate.needs === npcId && !gate.open) {
      gate.open = true;
      gate.collider.off = true;
      spawnShards(new THREE.Vector3(0, 3, gate.z), 0xff2e88, 60);
      setTimeout(() => toast('The gate is open!'), 900);
    }
  }
  if (npcId === 'sarnai') toast('You finished the Genghis Khan tour!', 5000);
  objective();
}

// Goat pop-ups: small boxes that appear one after another.
function showGoat(cards, ms = 14000) {
  const box = $('goatBubble');
  box.replaceChildren(...cards.map(({ title, text }, i) => {
    const card = document.createElement('div');
    card.className = 'goatCard';
    card.style.animationDelay = `${i * 0.35}s`;
    if (title) card.append(Object.assign(document.createElement('strong'), { textContent: title }));
    card.append(text);
    return card;
  }));
  box.hidden = false;
  clearTimeout(goatTimer);
  if (ms) goatTimer = setTimeout(() => { box.hidden = true; }, ms);
}

function goatHop() {
  spawnShards(goat.position.clone().setY(2), 0x2f6bff, 14);
}

async function toggleGoat() {
  if (state !== 'roam' && state !== 'duel') return;
  if (goatRecording) {
    goatRecording.stop();
    return;
  }
  try {
    goatRecording = await startRecording(7000);
  } catch (e) {
    console.warn(e);
    toast('Allow your microphone to ask Exa.');
    return;
  }
  const button = $('goatButton');
  button.dataset.on = 'true';
  button.querySelector('b').textContent = 'Listening. Press to finish';
  muteCall(true);
  goatHop();
  showGoat([{ title: 'Exa the Goat', text: 'Ears up! Ask me anything.' }], 0);

  const blob = await goatRecording.done;
  goatRecording = null;
  muteCall(false);
  button.dataset.on = 'false';
  button.querySelector('b').textContent = 'Ask Exa';
  showGoat([{ title: 'Exa the Goat', text: 'Sniffing around the web...' }], 0);

  try {
    const id = duel ? `&id=${encodeURIComponent(duel.id)}` : '';
    const res = await fetch(`/api/goat?x=1${id}`, { method: 'POST', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob });
    if (!res.ok) throw new Error(`goat ${res.status}`);
    const reply = await res.json();
    if (!reply.question) {
      showGoat([{ title: 'Exa the Goat', text: "I didn't catch that. Press the button and try again!" }], 6000);
      return;
    }
    const cards = [{ title: 'You asked', text: reply.question }];
    cards.push(reply.answer
      ? { title: 'Exa found', text: reply.answer }
      : { title: 'Exa the Goat', text: 'No clue on that one. Try asking another way!' });
    if (reply.hint) cards.push({ title: 'Puzzle hint', text: reply.hint });
    if (reply.domain) cards.push({ text: `Source: ${reply.domain}` });
    goatHop();
    showGoat(cards);
  } catch (e) {
    console.error(e);
    showGoat([{ title: 'Exa the Goat', text: 'My signal got tangled. Press the button and try again.' }], 6000);
  }
}

// Conversations
const post = async (url, body) => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
};

function setMic(mode, text) {
  $('mic').dataset.state = mode;
  setVoiceMeter(mode);
  $('mic').textContent = text;
}

function showFallback() {
  $('fallback').hidden = false;
}

function showPuzzle(puzzle) {
  $('question').textContent = puzzle ? `Puzzle: ${puzzle.question}` : 'Puzzle shield broken!';
  $('choices').replaceChildren(...(puzzle?.choices || []).map((choice) => {
    const button = Object.assign(document.createElement('button'), { type: 'button', textContent: choice });
    button.addEventListener('click', () => submit(choice));
    return button;
  }));
}

function setShield() {
  const left = Math.max(0, duel.total - duel.index);
  $('shieldFill').style.width = `${(left / duel.total) * 100}%`;
  duel.shield.visible = left > 0;
  duel.shield.material.opacity = 0.25 + (left / duel.total) * 0.6;
}

async function enterDuel(npc) {
  if (state !== 'roam') return;
  state = 'loading';
  $('prompt').hidden = true;
  const index = solved[npc.id] || 0;
  let info;
  try {
    info = await (await fetch(`/api/puzzle?npcId=${npc.id}&index=${index}`)).json();
  } catch {
    state = 'roam';
    toast('The castle server is not responding. Walk back to try again.');
    return;
  }
  if (!info.puzzle) {
    state = 'roam';
    toast(`${npc.short}: ${npc.catchphrase} All my puzzles are solved!`);
    return;
  }

  const shield = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.8, 1),
    new THREE.MeshBasicMaterial({ color: 0x2ef2a3, wireframe: true, transparent: true }),
  );
  shield.position.copy(npc.mesh.position).setY(1.9);
  scene.add(shield);
  animate(hero, 0, 0);

  const id = `local-${Date.now()}`;
  duel = { npc, id, seq: 0, index, total: info.total, shield, live: false, pending: false, polling: false, timer: null, lesson: info.lesson };
  const current = duel;
  dialogueLine = '';
  state = 'duel';
  slashWipe();
  hideHints();
  $('duel').hidden = false;
  $('foePlate').hidden = false;
  $('objective').hidden = true;
  $('switchSubject').hidden = true;
  $('fallback').hidden = true;
  $('foeName').textContent = npc.name;
  $('foePortrait').src = portraits[npc.id];
  $('speakerPortrait').src = portraits[npc.id];
  $('speakerName').textContent = npc.name;
  $('subtitle').textContent = npc.catchphrase;
  $('youSaid').textContent = '';
  setMic('connecting', 'Connecting');
  showPuzzle(info.puzzle);
  setShield();
  current.timer = setInterval(() => poll(current), 600);

  try {
    await post('/api/session', { id, npcId: npc.id, index });
  } catch {
    toast('The castle server is not responding. Walk back to try again.');
    leaveDuel();
    return;
  }
  if (!voiceReady()) {
    voiceFailed();
    return;
  }

  try {
    const call = await startCall({
      npcName: npc.name,
      npcId: npc.id,
      subject: npc.subject,
      personality: npc.personality,
      speechStyle: npc.speechStyle,
      catchphrase: npc.catchphrase,
      lesson: info.lesson,
      puzzleSeed: info.puzzle.question,
    }, npc.voice);
    if (!call) throw new Error('No call returned');
    if (duel !== current) {
      endCall();
      return;
    }
    await post('/api/session', { id: call.id, from: current.id });
    current.live = true;
  } catch (e) {
    console.error(e);
    if (duel === current) voiceFailed();
  }
}

function voiceFailed() {
  toast('Voice is off. Tap or type your answer.');
  setMic('off', 'Voice off');
  if (duel) $('subtitle').textContent = duel.lesson;
  showFallback();
}

function leaveDuel() {
  if (!duel) return;
  const finished = duel;
  duel = null;
  clearInterval(finished.timer);
  scene.remove(finished.shield);
  if (finished.live) endCall();
  state = 'roam';
  $('duel').hidden = true;
  $('foePlate').hidden = true;
  $('objective').hidden = false;
  $('switchSubject').hidden = false;
  $('typed').value = '';
  $('typed').blur();
  for (const part of ['legL', 'legR']) hero.userData[part].rotation.z = 0;
  if (finished.advance) advanceFrom(finished.npc);
  objective();
}

async function submit(text) {
  const d = duel;
  if (!d || d.pending || !text.trim()) return;
  d.pending = true;
  [...$('choices').children].forEach((b) => { b.disabled = true; });
  try {
    const { spoken } = await post('/api/grade', { id: d.id, text });
    if (d.live && spoken) tellCharacter(`The child tapped or typed: "${text}". ${spoken}`);
    await poll(d);
  } catch (e) {
    console.error(e);
    toast('That answer did not send. Try again.');
  }
  d.pending = false;
  if (duel === d) [...$('choices').children].forEach((b) => { b.disabled = false; });
}

async function poll(d) {
  if (d.polling) return;
  d.polling = true;
  try {
    const id = d.id;
    const { events } = await (await fetch(`/api/events?id=${encodeURIComponent(id)}&after=${d.seq}`)).json();
    if (duel === d && d.id === id) for (const event of events) {
      d.seq = event.seq;
      handleEvent(d, event);
    }
  } catch (e) {
    console.warn(e);
  }
  d.polling = false;
}

// One answer clears a stage: the character says goodbye, then the hero moves on.
function clearStage(d) {
  d.shield.visible = false;
  d.advance = true;
  stageCard('Stage clear', 'The gate is open', 700);
  $('shieldFill').style.width = '0%';
  $('question').textContent = 'Stage cleared! Heading to the next gate...';
  $('fallback').hidden = true;
  setTimeout(() => { if (duel === d) leaveDuel(); }, d.live ? 6500 : 2200);
}

function advanceFrom(npc) {
  const room = ROOMS[npcs.indexOf(npc) + 1];
  if (!room) return;
  const z = room.z0 - 5;
  hero.position.set(0, 0, z);
  hero.rotation.y = Math.PI;
  goat.position.set(-3, 0, z + 3);
  camera.position.set(0, 6, z + 10);
  lookTarget.set(0, 2.4, z - 7);
  currentRoom = npcs.indexOf(npc) + 1;
  slashWipe();
  stageCard(room.name, 'Next stage', 200);
}

function handleEvent(d, e) {
  if (e.type === 'correct') {
    d.index = e.index;
    solved[d.npc.id] = e.index;
    stars += 1;
    $('stars').textContent = `★ ${stars}`;
    charge = 1;
    fireBeam(e.power);
    d.npc.hop = 1;
    shake = reducedMotion ? 0 : 0.5 + e.power * 0.7;
    spawnShards(d.npc.mesh.position.clone().setY(2.2), 0x2ef2a3);
    flash(e.power);
    shardBurst();
    burst(e.power > 0.75 ? 'KAPOW!' : 'BOOM!', Math.round(e.power * 999));
    if (!d.live) $('subtitle').textContent = e.feedback;
    updateGates(d.npc.id);
    clearStage(d);
  } else if (e.type === 'filtered') {
    $('youSaid').textContent = 'Jev set that aside. It was not about the puzzle.';
  } else if (e.type === 'wrong') {
    d.shield.material.color.set(0xff2e88);
    setTimeout(() => d.shield.material.color.set(0x2ef2a3), 350);
    if (!d.live) $('subtitle').textContent = `${e.feedback} Hint: ${e.hint}`;
  } else if (e.type === 'skip') {
    d.index = e.index;
    solved[d.npc.id] = e.index;
    if (!d.live && e.reveal) $('subtitle').textContent = `Good try! The answer was ${e.reveal}.`;
    updateGates(d.npc.id);
    clearStage(d);
  } else if (e.type === 'goat') {
    goatHop();
    const cards = [{ title: 'Exa the Goat', text: e.domain ? `I sniffed out a clue on ${e.domain}!` : 'No clue this time. Keep trying!' }];
    if (e.hint) cards.push({ title: 'Puzzle hint', text: e.hint });
    showGoat(cards, 9000);
  }
}

// Input
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state === 'duel') {
    if (typing()) $('typed').blur();
    else leaveDuel();
    return;
  }
  if (typing()) return;
  if (e.code === 'KeyG' && !e.repeat) toggleGoat();
  if (state === 'duel' && !e.repeat && MOVE_KEYS.has(e.code)) leaveDuel();
  keys[e.code] = true;
  if (state === 'duel' && !$('fallback').hidden && /^Digit[123]$/.test(e.code)) $('choices').children[Number(e.code.at(-1)) - 1]?.click();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

$('typeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('typed').value;
  $('typed').value = '';
  submit(text);
});
$('leave').addEventListener('click', leaveDuel);
$('goatButton').addEventListener('click', (e) => {
  e.currentTarget.blur();
  toggleGoat();
});

function startGame(subject) {
  navigator.mediaDevices?.getUserMedia({ audio: true })
    .then((stream) => stream.getTracks().forEach((t) => t.stop()))
    .catch(() => toast('Allow your microphone so you can talk to the characters.'));
  $('title').hidden = true;
  $('hud').hidden = false;
  $('goatButton').hidden = false;
  const z = subject === 'history' ? ROOMS[1].z0 - 5 : 8;
  if (subject === 'history' && !world.gates[0].open) {
    world.gates[0].open = true;
    world.gates[0].collider.off = true;
  }
  hero.position.set(0, 0, z);
  hero.rotation.y = Math.PI;
  goat.position.set(-3, 0, z + 3);
  camera.position.set(0, 6, z + 10);
  state = 'roam';
  currentRoom = subject === 'history' ? 1 : 0;
  objective();
  toast(ROOMS[currentRoom].name);
  showGoat([{ title: 'Exa the Goat', text: 'Walk up to anyone and start talking. Stuck? Press G and ask me!' }], 8000);
  showHints();
}

for (const button of document.querySelectorAll('.subject')) {
  button.addEventListener('click', () => {
    button.blur();
    startGame(button.dataset.subject);
  });
}
$('switchSubject').addEventListener('click', (e) => {
  e.currentTarget.blur();
  state = 'title';
  $('title').hidden = false;
  $('hud').hidden = true;
  $('goatButton').hidden = true;
});

// The logo's starburst.
const burstPoints = [];
for (let i = 0; i < 32; i++) {
  const a = (i / 32) * Math.PI * 2;
  const r = i % 2 ? 150 + (i % 4 === 1 ? 26 : 0) : 300 + (i % 8 === 0 ? 34 : 0);
  burstPoints.push(`${320 + Math.cos(a) * r * 1.05},${165 + Math.sin(a) * r * 0.55}`);
}
$('logoBurst').setAttribute('points', burstPoints.join(' '));

initVoice({
  'call-end': () => {
    if (duel?.live) {
      duel.live = false;
      leaveDuel();
    }
  },
  'speech-start': () => {
    if (!duel) return;
    dialogueLine = '';
    setMic('talking', `${duel.npc.short} is talking`);
  },
  'speech-end': () => {
    if (duel) setMic('listening', 'Your turn. Say your answer');
  },
  error: (e) => {
    console.error('voice error', e);
    if (duel?.live) {
      duel.live = false;
      voiceFailed();
    }
  },
  message: (m) => {
    if (m.type !== 'transcript' || !duel) return;
    if (m.role === 'user') {
      charge = Math.min(1, charge + 0.1);
      $('youSaid').textContent = `You: ${m.transcript}`;
      if (m.transcriptType === 'final') setMic('thinking', 'Checking');
    } else if (m.transcriptType === 'final') {
      dialogueLine = `${dialogueLine} ${m.transcript}`.trim();
      $('subtitle').textContent = dialogueLine;
    } else {
      $('subtitle').textContent = `${dialogueLine} ${m.transcript}`.trim();
    }
  },
}).catch((e) => {
  console.error(e);
  toast('Voice is off. You can still tap or type your answers.');
});

// Loop
const circleHits = (x, z, r) => world.colliders.some((c) => !c.off && x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ);

function updateHero(dt) {
  if (keys.KeyA || keys.ArrowLeft) hero.rotation.y += dt * 2.6;
  if (keys.KeyD || keys.ArrowRight) hero.rotation.y -= dt * 2.6;
  const forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  sprinting = Boolean(forward && (keys.ShiftLeft || keys.ShiftRight));
  const speed = forward * (sprinting ? 17 : 10);
  const dx = Math.sin(hero.rotation.y) * speed * dt;
  const dz = Math.cos(hero.rotation.y) * speed * dt;
  if (!circleHits(hero.position.x + dx, hero.position.z, 0.8)) hero.position.x += dx;
  if (!circleHits(hero.position.x, hero.position.z + dz, 0.8)) hero.position.z += dz;
  animate(hero, Math.abs(speed), clockTime);

  const roomIndex = ROOMS.findIndex((r) => hero.position.z <= r.z0 && hero.position.z > r.z1);
  if (roomIndex >= 0 && roomIndex !== currentRoom) {
    currentRoom = roomIndex;
    objective();
    toast(ROOMS[roomIndex].name);
  }

  // Walking up to a character starts the conversation.
  for (const npc of npcs) {
    const distance = npc.mesh.position.distanceTo(hero.position);
    if (distance > 7.5) npc.cool = false;
    if (distance < 4.6 && !npc.cool && state === 'roam') {
      npc.cool = true;
      enterDuel(npc);
    }
  }
}

function fightStance() {
  const { armL, armR, legL, legR } = hero.userData;
  armL.rotation.x = -1.25;
  armR.rotation.x = -0.75;
  legL.rotation.x = 0.35;
  legR.rotation.x = -0.35;
  legL.rotation.z = -0.32;
  legR.rotation.z = 0.32;
}

function updateNpcs(dt) {
  for (const npc of npcs) {
    const position = npc.mesh.position;
    const inDuel = duel?.npc === npc;
    npc.tag.visible = !inDuel;
    const near = position.distanceTo(hero.position) < 6;
    if (npc.hop > 0) {
      npc.hop = Math.max(0, npc.hop - dt * 1.4);
      position.y = Math.abs(Math.sin(npc.hop * 12)) * npc.hop * 1.4;
    }
    if (inDuel || near) {
      npc.mesh.rotation.y = Math.atan2(hero.position.x - position.x, hero.position.z - position.z);
      animate(npc.mesh, 0, 0);
      continue;
    }
    npc.wait -= dt;
    const gap = npc.target.clone().sub(position).setY(0);
    if (gap.length() < 0.3 || npc.wait > 0) {
      animate(npc.mesh, 0, 0);
      if (npc.wait <= 0) {
        npc.wait = 1 + Math.random() * 2.5;
        npc.target.set(npc.home[0] + (Math.random() - 0.5) * 11, 0, npc.home[1] + (Math.random() - 0.5) * 11);
      }
      continue;
    }
    gap.normalize();
    position.addScaledVector(gap, dt * 2);
    npc.mesh.rotation.y = Math.atan2(gap.x, gap.z);
    animate(npc.mesh, 2, clockTime);
  }
}

function updateGoat(dt) {
  const forward = new THREE.Vector3(Math.sin(hero.rotation.y), 0, Math.cos(hero.rotation.y));
  const side = new THREE.Vector3(forward.z, 0, -forward.x);
  const target = duel
    ? hero.position.clone().addScaledVector(side, -2.6).addScaledVector(forward, 1)
    : hero.position.clone().addScaledVector(forward, -2.6).addScaledVector(side, 2);
  const gap = target.clone().sub(goat.position).setY(0);
  const distance = gap.length();
  const moving = distance > 0.5;
  if (moving) {
    const step = Math.min(distance, dt * Math.max(8, distance * 3));
    goat.position.addScaledVector(gap.normalize(), step);
    goat.rotation.y = Math.atan2(gap.x, gap.z);
  } else {
    goat.rotation.y = hero.rotation.y;
  }
  const listening = Boolean(goatRecording);
  goat.position.y = moving || listening ? Math.abs(Math.sin(clockTime * (listening ? 7 : 10))) * 0.35 : 0;
  animate(goat, moving ? 8 : 0, clockTime);
}

function updateFx(dt) {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    s.life -= dt;
    s.velocity.y -= 18 * dt;
    s.mesh.position.addScaledVector(s.velocity, dt);
    s.mesh.rotation.x += dt * 9;
    s.mesh.scale.setScalar(Math.max(0.01, s.life / 1.4));
    if (s.life <= 0 || s.mesh.position.y < 0) {
      scene.remove(s.mesh);
      shards.splice(i, 1);
    }
  }
  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i];
    b.life -= dt;
    const k = Math.max(0.01, b.life / 0.5);
    b.mesh.scale.set(k, 1, k);
    if (b.life <= 0) {
      scene.remove(b.mesh);
      beams.splice(i, 1);
    }
  }
  if (duel) {
    duel.shield.rotation.y += dt * 0.8;
    fightStance();
  }
  charge = Math.max(0, charge - dt * 0.12);
  $('chargeFill').style.width = `${charge * 100}%`;
  shake = Math.max(0, shake - dt * 2);

  const auraOn = duel || sprinting;
  const targetOpacity = auraOn ? 0.18 + charge * 0.55 : 0;
  aura.material.opacity += (targetOpacity - aura.material.opacity) * Math.min(1, dt * 6);
  aura.flames.forEach((flame, i) => {
    flame.scale.y = 0.8 + Math.sin(clockTime * 11 + i * 2.1) * 0.25 + charge * 0.3;
    flame.position.y = 2.1 + Math.sin(clockTime * 7 + i) * 0.15;
  });
}

const camTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3(0, 2, 0);

function updateCamera(dt) {
  if (duel) {
    const toFoe = duel.npc.mesh.position.clone().sub(hero.position).setY(0).normalize();
    hero.rotation.y = Math.atan2(toFoe.x, toFoe.z);
    const right = new THREE.Vector3(-toFoe.z, 0, toFoe.x);
    camTarget.copy(hero.position).addScaledVector(toFoe, -5.6).addScaledVector(right, 3).setY(3.2);
    lookTarget.lerp(duel.npc.mesh.position.clone().setY(0.6), Math.min(1, dt * 6));
  } else {
    const dir = new THREE.Vector3(Math.sin(hero.rotation.y), 0, Math.cos(hero.rotation.y));
    camTarget.copy(hero.position).addScaledVector(dir, -10).setY(6);
    lookTarget.lerp(hero.position.clone().addScaledVector(dir, 7).setY(2.4), Math.min(1, dt * 8));
  }
  camera.position.lerp(camTarget, Math.min(1, dt * 6));
  if (shake > 0) camera.position.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake * 0.6));
  camera.lookAt(lookTarget);
}

const clock = new THREE.Clock();
let clockTime = 0;
camera.position.set(0, 6, 18);

let fpsFrames = 0;
let fpsTime = 0;

function frame() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  clockTime += dt;
  if (!document.hidden) {
    fpsFrames += 1;
    fpsTime += rawDt;
    if (fpsTime >= 2) {
      if (fpsFrames / fpsTime < 45 && quality < 2) lowerQuality();
      fpsFrames = 0;
      fpsTime = 0;
    }
  }
  if (state === 'roam') updateHero(dt);
  updateNpcs(dt);
  updateGoat(dt);
  updateFx(dt);
  updateCamera(dt);
  world.tick(clockTime, dt);
  if (quality < 2) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
frame();

// Exposed for automated smoke tests.
window.__game = { hero, npcs, enterDuel, submit, showGoat, drawStats: () => { renderer.render(scene, camera); return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, quality }; }, getState: () => ({ state, stars, gates: world.gates.map((g) => g.open) }) };
