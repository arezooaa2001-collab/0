// Prism Rush — bootstrap, main loop (fixed-step physics + interpolation), state machine, save/load, graphics pipeline
// (23 presets, dynamic resolution, adaptive quality), photo mode, replay, comparison preview, error recovery.
import * as THREE from 'three';
import { G, bus } from './game.js';
import { setLang, t, onLang } from './i18n.js';
import { presetParams, PRESET_NAMES } from './config.js';
import { loadSettings, saveSettings, loadSlot, writeSlot, newSave, lastSlot } from './store.js';
import * as progress from './progress.js';
import { audio } from './audio.js';
import { generateTerrain, TerrainMesh, heightAt, waterLevelAt, REGIONS, ZONES } from './world/terrain.js';
import { Sky } from './world/sky.js';
import { Weather } from './world/weather.js';
import { Nature } from './world/nature.js';
import { Level } from './world/level.js';
import { buildWorld, ANCHORS } from './world/content.js';
import { Physics, debugColliders } from './physics.js';
import { Player, Companion } from './player.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { FX, PostFX } from './fx.js';
import { Enemies } from './enemies.js';
import { Bosses } from './bosses.js';
import { Missions, MISSIONS } from './missions.js';
import { HUD } from './ui/hud.js';
import { UI } from './ui/menus.js';
import { Replay } from './replay.js';
import { clamp, damp } from './util.js';
import { CHAR_ORDER } from './progress.js';

const H = 1 / 120;
const loadBar = document.getElementById('load-bar'), loadText = document.getElementById('load-text');
function progressTo(f, key) { loadBar.style.width = Math.round(f * 100) + '%'; if (key) loadText.textContent = t(key); }
const frameYield = () => new Promise((r) => setTimeout(r, 0));

async function boot() {
  G.settings = loadSettings(); setLang(G.settings.lang);
  G.progress = progress; G.audio = audio;
  progressTo(0.02, 'load_start');
  // renderer
  const canvas = document.getElementById('game');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { document.getElementById('load-text').textContent = t('webgl_error'); throw e; }
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  G.renderer = renderer;
  const scene = (G.scene = new THREE.Scene());
  const camera = (G.camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.15, 3000));
  G.preset = effectivePreset();
  G.physics = new Physics();
  // world generation
  await generateTerrain((f) => progressTo(0.05 + f * 0.5, 'load_terrain'));
  progressTo(0.56, 'load_meshes'); await frameYield();
  G.terrain = new TerrainMesh(scene, G.preset);
  G.sky = new Sky(scene, renderer, G.preset);
  G.weather = new Weather(scene, G.preset);
  progressTo(0.62, 'load_nature'); await frameYield();
  G.nature = new Nature(scene, G.preset, G.physics);
  G.fx = new FX(scene, G.preset);
  G.input = new Input(canvas);
  G.cam = new CameraRig(camera);
  G.ui = new UI();
  G.hud = new HUD(document.getElementById('hud'));
  progressTo(0.72, 'load_level'); await frameYield();
  G.save = newSave(); // temporary save so content can query found items; replaced on start
  G.level = new Level(scene, G.physics, G.preset);
  G.player = new Player(scene); G.player.setCharacter('zara');
  buildWorld(G.level);
  const totals = G.level.totals(); Object.assign(progress.TOTALS, { red: totals.red, chest: totals.chest, key: totals.key, token: totals.token, crystal: totals.crystal, map: totals.map, shard: 7 });
  progressTo(0.82, 'load_enemies'); await frameYield();
  G.enemies = new Enemies(scene); G.enemies.populate();
  G.bosses = new Bosses(scene);
  G.missions = new Missions(scene); G.__MISSIONS = MISSIONS;
  G.companion = new Companion(scene);
  G.replay = new Replay(scene);
  G.post = new PostFX(renderer, scene, camera);
  applyGraphics(true);
  applyAccess(); applyTime();
  audio.setVolumes(G.settings.audio);
  G.lastSlot = lastSlot();
  const rot = () => { const r = document.getElementById('rotate'); if (r) r.textContent = t('rotate'); const c = document.getElementById('ctxlost'); if (c) c.textContent = t('ctx_lost'); };
  rot(); onLang(rot);
  progressTo(0.92, 'load_shaders'); await frameYield();
  G.player.spawn(ANCHORS.start.clone().add(new THREE.Vector3(0, 1, 0)), Math.PI);
  try { renderer.compile(scene, camera); } catch (e) { console.warn(e); }
  progressTo(1, 'load_done');
  addEventListener('resize', () => G.post.resize());
  setupGlobalHandlers(canvas);
  document.getElementById('loading').classList.add('done');
  setTimeout(() => document.getElementById('loading').remove(), 700);
  toMenu();
  // first interaction unlocks audio
  const unlock = () => { audio.init(); audio.setVolumes(G.settings.audio); audio.setQuality(G.settings.audioQ || (G.preset.index === 0 ? 'low' : 'high')); if (G.state === 'menu') audio.music('menu'); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- graphics
function effectivePreset() {
  const S = G.settings; const p = presetParams(S.preset); const o = S.gfx;
  if (o.shadow !== null && o.shadow !== undefined) p.shadow = o.shadow;
  if (o.particles !== null && o.particles !== undefined) p.particles = o.particles;
  if (o.anim !== null && o.anim !== undefined) p.animLod = o.anim;
  if (o.draw !== null && o.draw !== undefined) p.draw = o.draw;
  if (o.renderScale !== null && o.renderScale !== undefined) p.scale = o.renderScale;
  // adaptive quality reductions
  const ad = G.adapt || 0; if (ad >= 1) p.ssao = 0; if (ad >= 2) p.godrays = 0; if (ad >= 3) { p.bloom = 0; p.motionBlur = 0; } if (ad >= 4) p.shadow = Math.min(p.shadow, 1024);
  return p;
}
function applyGraphics(first) {
  const p = (G.preset = effectivePreset());
  G.dynScale = 1;
  setPixelRatio();
  G.camera.far = Math.max(1600, p.draw * 1.6 + 600); G.camera.updateProjectionMatrix();
  if (!first) { G.sky.setPreset(p); G.terrain.setPreset(p); G.nature.setPreset(p); G.weather.build(p); G.fx.setPreset(p); G.level.setPreset(p); if (G.player.charId) G.player.setCharacter(G.player.charId, p.charQ); }
  G.post.setPreset(p, G.settings.gfx);
  G.renderer.shadowMap.needsUpdate = true;
}
function setPixelRatio() { const p = G.preset; const pr = Math.min(devicePixelRatio || 1, p.prCap) * p.scale * (G.dynScale || 1); G.renderer.setPixelRatio(clamp(pr, 0.35, 4)); G.post.resize && G.post.composer !== undefined && G.post.resize(); }
G.applyGraphics = () => { G.adapt = 0; applyGraphics(false); };
function applyAccess() {
  const A = G.settings.access; document.documentElement.style.setProperty('--ts', A.textScale);
  document.documentElement.classList.toggle('hc', A.highContrast); document.documentElement.classList.toggle('rm', A.reduceMotion);
}
G.applyAccess = applyAccess;
function applyTime() { const gp = G.settings.gameplay; G.sky.dayLength = gp.dayLength * 60; G.sky.fixed = gp.time === 'dynamic' ? null : parseFloat(gp.time); }
G.applyTime = applyTime;

// ---------------------------------------------------------------- states
function toMenu() {
  if (G.save && G.state !== 'boot' && G.state !== 'menu') { autosave(); }
  G.missions && G.missions.abort(true);
  G.ui.closeAll(); G.state = 'menu'; G.hud.show(false); G.input.clearAll();
  document.exitPointerLock && document.exitPointerLock();
  document.documentElement.classList.add('in-menu');
  G.player.spawn(ANCHORS.start.clone(), Math.PI); G.player.setMode('ground'); G.player.locked = true; G.player.speed = 0;
  G.ui.mainMenu();
}
G.toMenu = toMenu;
G.loadSlotData = (n, fresh) => {
  let data = null;
  if (!fresh) { const r = loadSlot(n); data = r.data; if (r.recovered) setTimeout(() => G.hud.toast('save_recovered', 'warn'), 500); if (r.corrupt) setTimeout(() => G.hud.toast('save_corrupt', 'warn'), 500); }
  G.save = data || newSave(); G.slot = n; G.settings.save.slot = n;
  progress.refreshChallenges();
};
G.startGame = (n, fresh) => {
  G.loadSlotData(n, fresh); const s = G.save;
  G.ui.hideMainMenu(); G.ui.closeAll(); document.documentElement.classList.remove('in-menu');
  // reset collectible / world state that depends on the save
  rebuildForSave();
  G.player.setCharacter(s.char); G.player.rings = 0; G.player.energy = G.player.stats.boostCap;
  let spawn = ANCHORS.start.clone(), yaw = Math.PI;
  if (s.checkpoint) { spawn = new THREE.Vector3().fromArray(s.checkpoint.pos); yaw = s.checkpoint.yaw || 0; G.level.checkpoint = { pos: spawn.clone(), yaw }; }
  else G.level.checkpoint = { pos: spawn.clone(), yaw };
  G.player.spawn(spawn.add(new THREE.Vector3(0, 1, 0)), yaw); G.player.locked = false;
  G.companion.set(s.companion && s.companion !== s.char && s.unlocked.includes(s.companion) ? s.companion : null);
  G.missions.buildMarkers();
  G.state = 'play'; G.hud.show(true); G.lastSlot = n;
  G.region = null; G.autosaveT = 0;
  writeSlot(n, s);
  if (fresh || !s.flags.intro) { s.flags.intro = 1; G.hud.titleCard('game_title', 'intro_line'); setTimeout(() => G.hud.subtitle('pip', 'line_intro'), 3500); }
  bus.emit('gameStart');
};
function rebuildForSave() {
  // collected items: hide those found in this save, re-show the others
  for (const o of G.level.objects) if (o.type === 'collect') { const f = !!G.save.found[o.key]; o.got = f; if (o.m) o.m.visible = !f || o.kind === 'chest'; }
  // collectibles skipped at build time (found in the temporary save) are none, since the boot save is empty
}
function autosave(manual) {
  const s = G.save; if (!s || G.state === 'menu' || G.state === 'boot') return;
  if (G.player && G.player.mode !== 'dead') s.pos = G.player.pos.toArray();
  s.flags.completion = progress.completion();
  const ok = writeSlot(G.slot || 1, s); saveSettings(G.settings);
  if (manual) G.hud.toast(ok ? 'saved' : 'save_failed', ok ? 'good' : 'warn');
}
G.autosave = autosave;
G.togglePause = (on, bySettings) => {
  if (on === undefined) on = G.state === 'play';
  if (on && G.state === 'play') { G.state = 'paused'; G.pausedBySettings = !!bySettings; audio.setPaused(true); document.exitPointerLock && document.exitPointerLock(); if (!bySettings) G.ui.pause(); }
  else if (!on && G.state === 'paused') { G.ui.closeAll(); G.state = 'play'; G.pausedBySettings = false; audio.setPaused(false); G.input.clearAll(); }
};
G.switchCharacter = (id) => {
  const s = G.save; if (!s.unlocked.includes(id)) return;
  const prev = s.char; s.char = id; G.player.setCharacter(id); G.fx.burst(G.player.pos, 0xffffff, 20, 6); audio.play('teleport', { pitch: 1.4 });
  if (s.companion === id) { s.companion = prev; G.companion.set(prev); }
  G.hud.toast('switched_to', 'info', { name: t('char_' + id) });
};
G.useItem = (k) => {
  const s = G.save; if (!s.items[k]) return;
  s.items[k]--; G.player.givePower(k); G.hud.toast('item_' + k, 'good');
};
G.onUIChange = () => { if (G.ui.open) document.exitPointerLock && document.exitPointerLock(); };

// ---------------------------------------------------------------- photo / replay / compare
G.startPhoto = () => { G.ui.closeAll(); G.state = 'photo'; audio.setPaused(true); G.cam.startPhoto(); G.hud.show(false); G.ui.photoUI(true); document.documentElement.classList.add('photo'); };
G.stopPhoto = () => { G.cam.stopPhoto(); G.ui.photoUI(false); G.post.dof = null; G.post.filter = 0; G.post.exposure = 1; applyTime(); G.state = 'play'; audio.setPaused(false); G.hud.show(true); document.documentElement.classList.remove('photo'); };
G.capturePhoto = () => {
  G.post.render(0); const url = G.renderer.domElement.toDataURL('image/png');
  G.save.stats.photos++; progress.checkAchievements(); audio.play('uiClick', { pitch: 1.6 });
  try { const a = document.createElement('a'); a.href = url; a.download = 'prism-rush-' + Date.now() + '.png'; document.body.append(a); a.click(); a.remove(); } catch { /* sandboxed */ }
  G.ui.showPhoto(url);
};
G.startReplay = () => { G.ui.closeAll(); if (!G.replay.start()) { G.state = 'play'; return; } G.state = 'replay'; audio.setPaused(true); G.hud.show(false); G.ui.replayUI(true, G.replay); };
G.stopReplay = () => { G.replay.stop(); G.ui.replayUI(false); G.state = 'play'; audio.setPaused(false); G.hud.show(true); G.cam.snapBehind(G.player); };
G.comparePreview = async (idx) => {
  const S = G.settings; const keep = S.preset; const other = idx === 0 ? 2 : 0;
  G.hud.toast('compare_wait', 'info'); await frameYield();
  const shot = (i) => { S.preset = i; G.adapt = 0; applyGraphics(false); G.nature.update(0.016, G.camera, G.player.pos, G.sky, G.weather); G.terrain.update(G.camera.position, 0); G.post.render(0.016); return G.renderer.domElement.toDataURL('image/jpeg', 0.85); };
  const a = shot(other); const b = shot(idx); S.preset = keep; applyGraphics(false);
  G.ui.compareModal(a, b, PRESET_NAMES[other], PRESET_NAMES[idx]);
};

// ---------------------------------------------------------------- input shortcuts
function globalKeys() {
  const inp = G.input;
  if (G.state === 'play') {
    if (inp.take('pause')) { G.togglePause(true); return; }
    if (inp.take('map')) { G.togglePause(true, true); G.ui.map(); }
    if (inp.take('photo')) G.startPhoto();
    if (inp.take('replay')) G.startReplay();
    if (inp.take('camMode')) G.cam.cycleMode();
    if (inp.take('camReset')) G.cam.reset();
    if (inp.take('switchChar')) { const u = G.save.unlocked; const order = CHAR_ORDER.filter((c) => u.includes(c)); const i = order.indexOf(G.save.char); G.switchCharacter(order[(i + 1) % order.length]); }
    const items = Object.keys(G.save.items);
    for (let i = 0; i < 9; i++) if (inp.codePressed('Digit' + (i + 1)) && items[i]) G.useItem(items[i]);
  } else if (G.state === 'photo') { if (inp.take('pause') || inp.take('photo')) G.stopPhoto(); }
  else if (G.state === 'replay') { if (inp.take('pause') || inp.take('replay')) G.stopReplay(); }
}
function setupGlobalHandlers(canvas) {
  let errs = 0;
  addEventListener('error', (e) => { console.error(e.error || e.message); if (errs++ < 5 && G.hud) G.hud.toast('error_recovered', 'warn'); });
  addEventListener('unhandledrejection', (e) => { console.error(e.reason); });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); G.contextLost = true; document.getElementById('ctxlost').hidden = false; });
  canvas.addEventListener('webglcontextrestored', () => { G.contextLost = false; document.getElementById('ctxlost').hidden = true; applyGraphics(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') G.togglePause(true); if (document.hidden) autosave(); });
  addEventListener('beforeunload', () => autosave());
}

// ---------------------------------------------------------------- performance monitor + dynamic resolution
const perf = { ema: 16.7, low: 0, high: 0, adaptT: 0, graph: [] };
function perfUpdate(dt) {
  perf.ema = perf.ema * 0.93 + dt * 1000 * 0.07;
  const S = G.settings; const target = S.fpsTarget || 0; if (!target || G.state !== 'play') return;
  const fps = 1000 / perf.ema;
  if (S.dynRes) {
    if (fps < target * 0.88) { perf.low += dt; perf.high = 0; } else if (fps > target * 0.97) { perf.high += dt; perf.low = 0; } else { perf.low = perf.high = 0; }
    if (perf.low > 1 && G.dynScale > 0.55) { G.dynScale = Math.max(0.5, G.dynScale - 0.1); setPixelRatio(); perf.low = 0; }
    if (perf.high > 4 && G.dynScale < 1) { G.dynScale = Math.min(1, G.dynScale + 0.05); setPixelRatio(); perf.high = 0; }
  }
  if (S.adaptive && (G.dynScale <= 0.55 || !S.dynRes)) {
    if (fps < target * 0.72) perf.adaptT += dt; else perf.adaptT = Math.max(0, perf.adaptT - dt);
    if (perf.adaptT > 3 && (G.adapt || 0) < 4) { G.adapt = (G.adapt || 0) + 1; perf.adaptT = 0; applyGraphics(false); G.dynScale = 0.75; setPixelRatio(); G.hud.toast('adaptive_reduced', 'info'); }
  }
}
function perfGraph() {
  let c = document.getElementById('perfgraph');
  if (!G.settings.dev.perfGraph) { if (c) c.hidden = true; return; }
  if (!c) { c = document.createElement('canvas'); c.id = 'perfgraph'; c.width = 180; c.height = 60; document.body.append(c); }
  c.hidden = false; const g = c.getContext('2d'); perf.graph.push(perf.ema); if (perf.graph.length > 180) perf.graph.shift();
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, 180, 60); g.strokeStyle = '#4aff8a'; g.beginPath();
  perf.graph.forEach((v, i) => { const y = 60 - clamp(v / 50, 0, 1) * 60; if (i === 0) g.moveTo(i, y); else g.lineTo(i, y); }); g.stroke();
  g.fillStyle = '#fff'; g.font = '10px monospace'; g.fillText(perf.ema.toFixed(1) + ' ms  ' + (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : ''), 4, 12);
}

// ---------------------------------------------------------------- main loop
let last = performance.now(), acc = 0, colDbgT = 0;
const ambientPrev = {};
function loop(now) {
  requestAnimationFrame(loop);
  const rdt = Math.min(0.1, (now - last) / 1000); last = now;
  if (G.contextLost) return;
  G.realTime += rdt;
  const inp = G.input; inp.update(rdt);
  globalKeys();
  const P = G.player;
  G.timeScaleTarget = G.timeScaleTarget ?? 1;
  G.timeScale = damp(G.timeScale, G.timeScaleTarget, 4, rdt);
  const playing = G.state === 'play' || G.state === 'cutscene';
  const dt = rdt * G.timeScale * G.settings.access.gameSpeed;
  if (playing) {
    acc += dt; let steps = 0;
    while (acc >= H && steps < 10) { P.fixedUpdate(H); acc -= H; steps++; }
    if (steps >= 10) acc = 0;
    G.time += dt;
    P.update(dt, acc / H);
    G.companion.update(dt); G.enemies.update(dt); G.bosses.update(dt); G.level.update(dt, P); G.missions.update(dt);
    G.replay.record(dt, P);
    G.save.playTime += rdt;
    if (G.state === 'play') {
      G.autosaveT = (G.autosaveT || 0) + rdt;
      if (G.settings.save.autosave && G.autosaveT > G.settings.save.interval) { G.autosaveT = 0; autosave(); }
      G.chkT = (G.chkT || 0) + rdt; if (G.chkT > 2) { G.chkT = 0; progress.checkAchievements(); progress.checkChallenges(); progress.tryUnlocks(); }
    }
    G.cam.update(rdt, P);
  } else if (G.state === 'menu') {
    const a = G.realTime * 0.08; const c = ANCHORS.hub;
    G.camera.position.set(c.x + Math.sin(a) * 34, c.y + 9 + Math.sin(a * 0.7) * 3, c.z + Math.cos(a) * 34); G.camera.lookAt(c.x, c.y + 2, c.z);
    P.update(rdt, 1); G.level.update(rdt, P);
    G.time += rdt;
  } else if (G.state === 'photo') { G.cam.update(rdt, P); }
  else if (G.state === 'replay') { G.replay.update(rdt); }
  const cam = G.camera;
  const focus = G.state === 'replay' && G.replay.rig ? G.replay.rig.root.position : P.pos;
  const live = G.state !== 'paused';
  const wdt = live ? dt || rdt : 0;
  G.sky.update(G.state === 'photo' ? 0 : wdt, focus, cam, G.preset.draw);
  G.weather.update(wdt, cam, focus, G.sky, G.region || REGIONS[0]);
  G.nature.update(wdt, cam, focus, G.sky, G.weather);
  G.terrain.update(cam.position, wdt);
  if (live) G.fx.update(wdt);
  // audio: listener, music by region, ambience, intensity
  if (audio.ready) {
    const f = new THREE.Vector3(); cam.getWorldDirection(f); audio.setListener(cam.position.toArray(), f.toArray(), [0, 1, 0]);
    if (playing && !G.bosses.active && !G.missions.race && G.region && G.region.music !== G.curMusic) { G.curMusic = G.region.music; audio.music(G.region.music); }
    if (G.bosses.active || G.missions.race) G.curMusic = null;
    audio.setMusicIntensity(clamp(P.speed / 60 + (P.boosting ? 0.3 : 0) + (G.bosses.active ? 0.5 : 0), 0, 1));
    const r = G.region ? G.region.id : 'meadow'; const day = !G.sky.isNight();
    const amb = { ocean: r === 'coast' || waterLevelAt(P.pos.x, P.pos.z) > heightAt(P.pos.x, P.pos.z) ? 0.6 : 0, lava: r === 'volcano' ? 0.7 : 0, city: r === 'city' ? 0.5 : 0, birds: (r === 'meadow' || r === 'forest' || r === 'coast') && day ? 0.5 : 0, cave: G.cam.interior ? 0.6 : 0, water: P.pos.distanceTo(ANCHORS.waterfall) < 70 ? 0.8 : 0, space: r === 'moon' || r === 'special' ? 0.6 : 0 };
    for (const k in amb) if (ambientPrev[k] !== amb[k] || amb[k] > 0) { audio.ambient(k, live ? amb[k] : 0); ambientPrev[k] = amb[k]; }
  }
  // collision debug
  if (G.settings.dev.collision) { colDbgT -= rdt; if (colDbgT <= 0) { colDbgT = 0.5; G.colDebug = debugColliders(G.physics, G.scene, P.pos, G.colDebug); } } else if (G.colDebug) { G.scene.remove(G.colDebug); G.colDebug = null; }
  if (G.state === 'play' || G.state === 'cutscene') G.hud.update(rdt);
  G.post.render(rdt);
  perfUpdate(rdt); perfGraph();
  inp.endFrame();
}

G.timeScale = 1; window.__G = G; G.terrainH = heightAt; window.__setLang = (c) => { G.settings.lang = c; setLang(c); };
boot().catch((e) => { console.error(e); const lt = document.getElementById('load-text'); if (lt) lt.textContent = 'Error: ' + (e && e.message); });
