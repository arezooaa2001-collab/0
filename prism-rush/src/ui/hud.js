// In-game HUD: rings, score/time, boost gauge, speedometer, minimap + radars, objective + navigation arrow, combo,
// toasts, subtitles, homing reticle, boss bar, race info, countdown, title cards, interaction prompt, FPS counter.
import * as THREE from 'three';
import { G, bus } from '../game.js';
import { t, num, digits } from '../i18n.js';
import { clamp, fmtTime, el } from '../util.js';
import { mapCanvas, worldToMap, WORLD } from '../world/terrain.js';
import { countFound } from '../progress.js';

const v1 = new THREE.Vector3();

export class HUD {
  constructor(root) {
    this.root = root; root.innerHTML = '';
    const q = (cls, parent = root, tag = 'div') => { const e = document.createElement(tag); e.className = cls; parent.append(e); return e; };
    this.tl = q('hud-tl');
    this.rings = q('hud-rings', this.tl); this.time = q('hud-time', this.tl); this.score = q('hud-sub', this.tl);
    this.power = q('hud-power', this.tl);
    this.obj = q('hud-obj'); this.objText = q('obj-text', this.obj); this.objProg = q('obj-prog', this.obj); this.objTime = q('obj-time', this.obj);
    this.arrow = q('hud-arrow'); this.arrow.innerHTML = '<svg viewBox="0 0 40 40" width="40" height="40"><path d="M20 3 L35 34 L20 26 L5 34 Z" fill="currentColor"/></svg><span class="arrow-d"></span>';
    this.mm = q('hud-minimap', root, 'canvas'); this.mm.width = this.mm.height = 160;
    this.bottom = q('hud-bottom');
    this.speedo = q('hud-speed', this.bottom); this.boost = q('hud-boost', this.bottom); this.boostFill = q('boost-fill', this.boost); this.boostLbl = q('boost-lbl', this.boost);
    this.combo = q('hud-combo'); this.toasts = q('hud-toasts'); this.sub = q('hud-subtitle'); this.prompt = q('hud-prompt');
    this.reticle = q('hud-reticle'); this.boss = q('hud-boss'); this.bossName = q('boss-name', this.boss); this.bossBarEl = q('boss-bar', this.boss); this.bossFill = q('boss-fill', this.bossBarEl);
    this.race = q('hud-race'); this.count = q('hud-count'); this.card = q('hud-card'); this.fps = q('hud-fps'); this.debug = q('hud-debug', root, 'pre');
    this.popups = q('hud-popups'); this.radarBeep = q('hud-radar');
    this.cache = {}; this.mapImg = null; this.objective = null; this.radarT = 0; this.fpsAcc = 0; this.fpsN = 0;
    bus.on('levelUp', (e) => { this.toast('level_up', 'good', { n: e.level }); G.audio.play('levelUp'); });
    bus.on('achievement', (a) => { this.toast('ach_unlocked', 'gold', { name: t('ach_' + a.id), n: a.reward }); G.audio.play('achievement'); });
    bus.on('challengeDone', (c) => { this.toast('challenge_done', 'gold', { n: c.reward }); G.audio.play('achievement'); });
    bus.on('regionDiscovered', (r) => { this.titleCard('region_' + r.id, 'region_discovered'); });
    bus.on('charUnlocked', (id) => { this.titleCard('char_' + id, 'char_unlocked'); G.audio.play('achievement'); });
    bus.on('powerEnd', (k) => { if (k === 'slowmo') G.audio.play('slowmoOut'); });
  }
  set(key, elx, val) { if (this.cache[key] !== val) { this.cache[key] = val; elx.textContent = val; } }
  html(key, elx, val) { if (this.cache[key] !== val) { this.cache[key] = val; elx.innerHTML = val; } }
  show(v) { this.root.hidden = !v; }
  toast(key, type = 'info', params) {
    const e = el('div', { class: 'toast ' + type, text: t(key, params) }); this.toasts.prepend(e);
    while (this.toasts.children.length > 4) this.toasts.lastChild.remove();
    setTimeout(() => e.classList.add('out'), 2600); setTimeout(() => e.remove(), 3200);
  }
  popup(text, pos) { const e = el('div', { class: 'popup', text: digits(text) }); e._p = pos.clone(); e._t = 1; this.popups.append(e); if (this.popups.children.length > 8) this.popups.firstChild.remove(); }
  subtitle(charId, key) { if (!G.settings.access.subtitles) return; this.sub.innerHTML = ''; this.sub.append(el('b', { text: t('char_' + charId) + ': ' }), t(key)); this.sub.classList.add('on'); clearTimeout(this.subT); this.subT = setTimeout(() => this.sub.classList.remove('on'), 3500); }
  setPrompt(key) {
    const mk = G.missions && G.missions.promptKey(G.player);
    const k = mk || key;
    const txt = k ? (mk ? t('prompt_mission', { name: t('mis_' + G.missions.nearMarker(G.player).m.id) }) : t(k)) : '';
    const keyHint = G.input.isTouchUI() ? '✋' : G.input.lastDevice === 'pad' ? 'LB' : keyName(G.settings.keys.interact[0]);
    this.html('prompt', this.prompt, k ? `<kbd>${keyHint}</kbd> ${escapeHtml(txt)}` : '');
    this.prompt.classList.toggle('on', !!k);
    G.input.setContextVisible('interact', !!k);
  }
  setObjective(o) { this.objective = o; this.obj.classList.toggle('on', !!o); if (!o) this.arrow.classList.remove('on'); }
  missionStart(m) { this.titleCard('mis_' + m.id, 'mdesc_' + m.id); }
  countdown(n) { this.count.textContent = n > 0 ? digits(String(n)) : t('go'); this.count.classList.remove('pop'); void this.count.offsetWidth; this.count.classList.add('pop'); }
  raceInfo(r) {
    this.race.classList.toggle('on', !!r); if (!r) return;
    this.html('race', this.race, `<div><span>${t('race_pos')}</span><b>${num(r.pos)}/${num(r.of)}</b></div><div><span>${t('race_lap')}</span><b>${num(r.lap)}/${num(r.laps)}</b></div><div><span>${t('race_time')}</span><b>${digits(fmtTime(r.t))}</b></div>${r.ghost ? `<div class="ghost">${t('race_ghost')}</div>` : ''}`);
  }
  bossBar(id, frac, phase) {
    this.boss.classList.toggle('on', !!id); if (!id) return;
    this.bossName.textContent = t('boss_' + id) + (phase ? ' · ' + t('phase_n', { n: phase }) : '');
    this.bossFill.style.width = clamp(frac, 0, 1) * 100 + '%';
  }
  titleCard(key, subKey) { this.card.innerHTML = ''; this.card.append(el('h2', { text: t(key) }), subKey ? el('p', { text: t(subKey) }) : ''); this.card.classList.remove('on'); void this.card.offsetWidth; this.card.classList.add('on'); clearTimeout(this.cardT); this.cardT = setTimeout(() => this.card.classList.remove('on'), 3400); }
  update(dt) {
    const P = G.player, S = G.settings; if (!P) return;
    this.set('rings', this.rings, '◎ ' + num(P.rings));
    this.set('time', this.time, digits(fmtTime(G.save.playTime)));
    this.set('score', this.score, t('wallet_short', { n: G.save.wallet }) + ' · ' + t('lv_short', { n: G.save.level[G.save.char] }));
    const pw = []; if (P.shield) pw.push(t('pw_' + P.shield)); for (const k in P.power) if (P.power[k] > 0) pw.push(t('pw_' + k) + ' ' + num(Math.ceil(P.power[k]))); if (P.prism) pw.push(t('pw_prism'));
    this.set('power', this.power, pw.join(' · '));
    const kmh = Math.round(P.vel.length() * 3.6);
    this.html('speed', this.speedo, `<b>${num(kmh)}</b><span>${t('kmh')}</span>`);
    const bf = P.energy / P.stats.boostCap; this.boostFill.style.width = (bf * 100).toFixed(1) + '%'; this.boost.classList.toggle('active', P.boosting); this.boost.classList.toggle('low', bf < 0.15);
    this.set('boostl', this.boostLbl, t('boost'));
    this.combo.classList.toggle('on', P.combo >= 5); if (P.combo >= 5) this.set('combo', this.combo, t('combo_n', { n: P.combo }));
    // objective
    const o = this.objective;
    if (o) {
      this.set('objt', this.objText, t(o.key, o.params));
      this.set('objp', this.objProg, o.prog ? num(o.prog[0]) + ' / ' + num(o.prog[1]) : '');
      this.set('objtm', this.objTime, (o.countdown ? '⏱ ' : '') + digits(fmtTime(o.time)));
      this.objTime.classList.toggle('warn', o.countdown && o.time < 10);
      this.navArrow(o.target);
    }
    // homing reticle
    const tg = P.homingTarget;
    if (tg && (P.mode === 'air' || P.mode === 'ground')) { v1.copy(tg.pos).project(G.camera); if (v1.z < 1) { this.reticle.style.transform = `translate(${(v1.x * 0.5 + 0.5) * innerWidth}px,${(-v1.y * 0.5 + 0.5) * innerHeight}px)`; this.reticle.classList.add('on'); } else this.reticle.classList.remove('on'); }
    else this.reticle.classList.remove('on');
    // popups
    for (const p of [...this.popups.children]) { p._t -= dt; v1.copy(p._p).project(G.camera); p._p.y += dt * 2; p.style.transform = `translate(${(v1.x * 0.5 + 0.5) * innerWidth}px,${(-v1.y * 0.5 + 0.5) * innerHeight}px)`; p.style.opacity = clamp(p._t, 0, 1); if (p._t <= 0 || v1.z > 1) p.remove(); }
    this.minimap(dt);
    this.radar(dt);
    // FPS + debug overlays
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fpsVal = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    this.fps.hidden = !S.fpsCounter; if (S.fpsCounter && this.fpsVal) this.set('fps', this.fps, `${Math.round(this.fpsVal)} FPS · ${G.preset.name} · ${(G.renderer.getPixelRatio()).toFixed(2)}x`);
    this.debug.hidden = !S.dev.moveDebug;
    if (S.dev.moveDebug) this.debug.textContent = `mode ${P.mode}  grounded ${P.grounded}\npos ${P.pos.x.toFixed(1)} ${P.pos.y.toFixed(1)} ${P.pos.z.toFixed(1)}\nvel ${P.vel.x.toFixed(1)} ${P.vel.y.toFixed(1)} ${P.vel.z.toFixed(1)}  |v| ${P.vel.length().toFixed(1)}\nspeed ${P.speed.toFixed(1)} top ${P.topSpeed().toFixed(1)} energy ${P.energy.toFixed(0)}\nground ${P.groundC ? 'collider' : 'terrain'} n ${P.groundN.y.toFixed(2)} surface ${P.surface}\nregion ${G.region && G.region.id} enemies ${G.enemies.active} draw ${G.renderer.info.render.calls} tris ${G.renderer.info.render.triangles}`;
  }
  navArrow(target) {
    if (!target) { this.arrow.classList.remove('on'); return; }
    const cam = G.camera; v1.copy(target).sub(cam.position);
    const d = v1.length(); const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize();
    const x = v1.dot(right), z = v1.dot(fwd.setY(0).normalize());
    const ang = Math.atan2(x, z);
    this.arrow.classList.add('on'); this.arrow.firstChild.style.transform = `rotate(${ang}rad)`;
    this.set('arrowd', this.arrow.lastChild, num(Math.round(G.player.pos.distanceTo(target))) + ' ' + t('m'));
  }
  minimap(dt) {
    const c = this.mm, g = c.getContext('2d'), P = G.player;
    if (!this.mapImg) this.mapImg = mapCanvas(512);
    const S = 160, scale = 512 / (WORLD.half * 2), zoom = 3.2; // px per metre in map image * zoom
    g.save(); g.clearRect(0, 0, S, S); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.clip();
    g.fillStyle = '#0b2a40'; g.fillRect(0, 0, S, S);
    const yaw = G.cam.yaw;
    g.translate(S / 2, S / 2); g.rotate(yaw); g.scale(zoom, zoom);
    const [mx, my] = worldToMap(P.pos.x, P.pos.z, 512);
    g.drawImage(this.mapImg, -mx, -my);
    const dot = (x, z, col, r) => { const [a, b] = worldToMap(x, z, 512); g.fillStyle = col; g.beginPath(); g.arc(a - mx, b - my, r / zoom, 0, 7); g.fill(); };
    if (G.missions) for (const mk of G.missions.markers) dot(mk.p.x, mk.p.z, mk.m.story ? '#ffd21a' : '#5ad8ff', 4);
    const o = this.objective; if (o && o.target) dot(o.target.x, o.target.z, '#4aff8a', 5);
    if (G.save.upgrades.enemyRadar) { const list = G.enemies.radar(this._r || (this._r = []), 120); for (const p of list) dot(p.x, p.z, '#ff4a4a', 2.2); }
    g.restore();
    // player arrow (camera-up map)
    g.save(); g.translate(S / 2, S / 2); g.rotate(yaw - Math.atan2(P.facing.x, P.facing.z) + Math.PI);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.save(); g.translate(S / 2, S / 2); g.rotate(yaw); g.fillText('N', 0, -S / 2 + 14); g.restore();
  }
  radar(dt) {
    // treasure radar: pulses faster near the closest unfound collectible
    if (!G.save.upgrades.treasureRadar) { this.radarBeep.classList.remove('on'); return; }
    const P = G.player.pos; let best = 1e9;
    for (const k in G.level.collectibles) { if (G.save.found[k]) continue; const c = G.level.collectibles[k]; const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < best) best = d; }
    this.radarBeep.classList.toggle('on', best < 160);
    if (best < 160) {
      this.radarT -= dt; const rate = clamp(best / 60, 0.15, 2.5);
      if (this.radarT <= 0) { this.radarT = rate; G.audio.play('uiHover', { pitch: 2 - rate * 0.4, vol: 0.6 }); this.radarBeep.classList.remove('beep'); void this.radarBeep.offsetWidth; this.radarBeep.classList.add('beep'); }
      this.set('radar', this.radarBeep, t('radar_dist', { n: Math.round(best) }));
    }
  }
}
export function keyName(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3); if (code.startsWith('Digit')) return code.slice(5);
  const m = { Space: '␣', ShiftLeft: '⇧', ShiftRight: '⇧R', ControlLeft: 'Ctrl', Escape: 'Esc', Enter: '↵', Tab: '⇥', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Mouse0: '🖱L', Mouse1: '🖱M', Mouse2: '🖱R', Backquote: '`' };
  return m[code] || code;
}
export function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
