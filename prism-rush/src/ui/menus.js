// Menus & screens: main menu, save slots, pause, settings (gear icon, 10 tabs), characters + skill trees + skins,
// missions / races / bosses, world map + fast travel, inventory, shop, achievements + challenges, statistics,
// mission briefing / results, photo mode, replay, graphics comparison, touch-layout editor.
import { G, bus } from '../game.js';
import { t, num, digits, LANGS, setLang, onLang, coverage, langInfo } from '../i18n.js';
import { el, clamp, fmtTime } from '../util.js';
import { PRESET_NAMES, presetParams, ACTIONS, DEFAULT_KEYS, defaultSettings } from '../config.js';
import { saveSettings, slotMeta, deleteSlot, loadSlot, writeSlot, newSave } from '../store.js';
import { CHAR_ORDER, CHAR_STATS, SKILLS, SHOP, SKIN_PRICES, ACHIEVEMENTS, charStats, xpFor, completion, stat, challengeProgress, countFound, TOTALS, UNLOCK_RULES } from '../progress.js';
import { CHARACTER_INFO } from '../characters.js';
import { MISSIONS, RACES } from '../missions.js';
import { BOSS_DEFS } from '../bosses.js';
import { WEATHER_TYPES } from '../world/weather.js';
import { REGIONS, mapCanvas, worldToMap, WORLD } from '../world/terrain.js';
import { keyName, escapeHtml } from './hud.js';
import { ANCHORS } from '../world/content.js';

const GEAR_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.8 1.7 1l.4 2.5h4l.4-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>';
const PAUSE_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>';

export class UI {
  constructor() {
    this.layer = document.getElementById('ui'); this.stack = []; this.menuEl = null;
    this.gear = el('button', { id: 'gear', class: 'corner-btn', html: GEAR_SVG, onclick: () => { G.audio.play('uiClick'); this.openSettings(); } });
    this.pauseBtn = el('button', { id: 'pausebtn', class: 'corner-btn', html: PAUSE_SVG, onclick: () => { G.audio.play('uiClick'); G.togglePause(); } });
    document.body.append(this.gear, this.pauseBtn);
    onLang(() => this.relabel());
    this.relabel();
    addEventListener('keydown', (e) => {
      if (G.input && G.input.rebind) return;
      if (e.code === 'Escape' && this.stack.length) { e.preventDefault(); e.stopPropagation(); this.back(); }
    }, true);
  }
  relabel() {
    this.gear.setAttribute('aria-label', t('settings')); this.gear.title = t('settings');
    this.pauseBtn.setAttribute('aria-label', t('pause')); this.pauseBtn.title = t('pause');
    for (const m of this.stack) m.render();
    if (this.menuEl && this.menuRender) this.menuRender();
  }
  get open() { return this.stack.length > 0; }
  // ------------------------------------------------------------------ modal framework
  modal(titleKey, build, opts = {}) {
    const wrap = el('div', { class: 'modal-wrap' + (opts.cls ? ' ' + opts.cls : '') });
    const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
    wrap.append(box); this.layer.append(wrap);
    const m = { wrap, box, titleKey, build, opts, tab: opts.tab, render: () => {
      box.innerHTML = '';
      const head = el('div', { class: 'modal-head' }, [el('h2', { text: typeof m.titleKey === 'function' ? m.titleKey() : t(m.titleKey) }), opts.noClose ? null : el('button', { class: 'x', 'aria-label': t('close'), text: '✕', onclick: () => this.close(m) })]);
      const body = el('div', { class: 'modal-body' }); box.append(head, body); build(body, m);
    } };
    this.stack.push(m); m.render(); G.audio.play('uiClick');
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap && !opts.noClose) this.close(m); });
    G.onUIChange && G.onUIChange();
    return m;
  }
  close(m) { const i = this.stack.indexOf(m); if (i < 0) return; this.stack.splice(i, 1); m.wrap.remove(); m.opts.onClose && m.opts.onClose(); G.audio.play('uiBack'); saveSettings(G.settings); G.onUIChange && G.onUIChange(); }
  closeAll() { while (this.stack.length) this.close(this.stack[this.stack.length - 1]); }
  back() { if (this.stack.length) this.close(this.stack[this.stack.length - 1]); }
  rerender() { for (const m of this.stack) m.render(); }

  // ------------------------------------------------------------------ widgets
  btn(key, fn, cls = '', params) { return el('button', { class: 'btn ' + cls, text: t(key, params), onclick: (e) => { G.audio.play('uiClick'); fn(e); }, onmouseenter: () => G.audio.play('uiHover') }); }
  row(key, ctrl, hint) { return el('div', { class: 'row' }, [el('label', { text: t(key) }, hint ? [el('small', { text: t(hint) })] : []), ctrl]); }
  slider(v, min, max, step, fn, fmt = (x) => num(x, step < 1 ? (step < 0.1 ? 2 : 1) : 0)) {
    const out = el('output', { text: fmt(v) });
    const inp = el('input', { type: 'range', min, max, step, value: v, oninput: (e) => { const x = parseFloat(e.target.value); out.textContent = fmt(x); fn(x); } });
    return el('div', { class: 'slider' }, [inp, out]);
  }
  toggle(v, fn) { const b = el('button', { class: 'toggle' + (v ? ' on' : ''), role: 'switch', 'aria-checked': String(!!v), text: v ? t('on') : t('off') }); b.onclick = () => { v = !v; b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); b.textContent = v ? t('on') : t('off'); G.audio.play('uiClick'); fn(v); }; return b; }
  select(opts, v, fn) { const s = el('select', { onchange: (e) => fn(e.target.value) }); for (const o of opts) s.append(el('option', { value: o.v, text: o.l, selected: String(o.v) === String(v) })); return s; }
  tabs(m, list, body, renderTab) {
    const bar = el('div', { class: 'tabs', role: 'tablist' }); m.tab = m.tab || list[0][0];
    for (const [id, key, icon] of list) bar.append(el('button', { class: 'tab' + (m.tab === id ? ' on' : ''), role: 'tab', 'aria-selected': String(m.tab === id), html: `<span class="ti">${icon || ''}</span><span>${escapeHtml(t(key))}</span>`, onclick: () => { m.tab = id; G.audio.play('uiClick'); m.render(); } }));
    const pane = el('div', { class: 'tabpane' }); body.append(bar, pane); renderTab(m.tab, pane);
  }
  saveS() { saveSettings(G.settings); }

  // ------------------------------------------------------------------ main menu
  mainMenu() {
    this.closeAll();
    if (this.menuEl) this.menuEl.remove();
    const root = this.menuEl = el('div', { class: 'mainmenu' }); this.layer.append(root);
    this.menuRender = () => {
      root.innerHTML = '';
      const last = G.lastSlot; const meta = last ? slotMeta(last) : null;
      root.append(el('div', { class: 'title' }, [el('h1', { text: t('game_title') }), el('p', { text: t('title_sub') })]));
      const col = el('div', { class: 'menu-col' });
      if (meta) col.append(this.btn('continue', () => G.startGame(last), 'primary'));
      col.append(this.btn(meta ? 'new_game' : 'play', () => this.slots(), meta ? '' : 'primary'));
      col.append(this.btn('characters', () => this.needSave(() => this.characters())), this.btn('missions', () => this.needSave(() => this.missions())), this.btn('shop', () => this.needSave(() => this.shop())), this.btn('achievements', () => this.needSave(() => this.achievements())), this.btn('how_to_play', () => this.howTo()));
      root.append(col, el('p', { class: 'menu-foot', text: t('menu_foot') }));
    };
    this.menuRender();
    G.audio.music('menu');
  }
  hideMainMenu() { if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; this.menuRender = null; } }
  needSave(fn) { if (!G.save) { const s = G.lastSlot || 1; G.loadSlotData(s); } fn(); }
  slots() {
    this.modal('choose_slot', (body) => {
      for (let n = 1; n <= 3; n++) {
        const meta = slotMeta(n);
        const info = meta ? `${t('char_' + meta.char)} · ${t('completion_n', { n: meta.completion })} · ${digits(fmtTime(meta.playTime))} · ${new Date(meta.updated).toLocaleDateString(langInfo().locale)}` : t('empty_slot');
        body.append(el('div', { class: 'slot' }, [el('div', {}, [el('b', { text: t('slot_n', { n }) }), el('small', { text: info })]),
          el('div', { class: 'slot-btns' }, [this.btn(meta ? 'load' : 'new_game', () => { this.closeAll(); G.startGame(n, !meta); }, 'primary'), meta ? this.btn('delete', () => this.confirm('confirm_delete', () => { deleteSlot(n); this.rerender(); }), 'danger') : null])]));
      }
    });
  }
  confirm(key, yes) {
    const m = this.modal('confirm', (body) => { body.append(el('p', { text: t(key) }), el('div', { class: 'btn-row' }, [this.btn('yes', () => { this.close(m); yes(); }, 'danger'), this.btn('no', () => this.close(m))])); }, { cls: 'small' });
  }
  howTo() {
    this.modal('how_to_play', (body) => {
      const k = (a) => keyName(G.settings.keys[a][0]);
      const rows = [['move', 'WASD / ←↑→↓'], ['act_jump', k('jump')], ['act_boost', k('boost')], ['act_spin', k('spin')], ['act_attack', k('attack')], ['act_special', k('special')], ['act_interact', k('interact')], ['act_transform', k('transform')], ['act_camMode', k('camMode')], ['act_map', k('map')], ['act_switchChar', k('switchChar')], ['act_photo', k('photo')], ['act_replay', k('replay')], ['act_pause', k('pause')], ['items_hotkeys', '1–9']];
      const tb = el('table', { class: 'keys' }); for (const [a, kk] of rows) tb.append(el('tr', {}, [el('td', { text: t(a) }), el('td', {}, [el('kbd', { text: kk })])]));
      body.append(tb);
      for (let i = 1; i <= 8; i++) body.append(el('p', { class: 'tip', text: t('tip_' + i) }));
    });
  }

  // ------------------------------------------------------------------ pause
  pause() {
    const m = this.modal('paused', (body) => {
      const s = G.save; const mis = G.missions.active;
      body.append(el('p', { class: 'muted', text: `${t('region_' + (G.region ? G.region.id : 'meadow'))} · ${t('completion_n', { n: completion() })} · ${t('wallet_short', { n: s.wallet })}` }));
      const grid = el('div', { class: 'grid-btns' });
      grid.append(this.btn('resume', () => G.togglePause(false), 'primary'));
      grid.append(this.btn('restart_cp', () => { G.togglePause(false); G.player.respawn(true); }));
      if (mis) grid.append(this.btn('restart_mission', () => { const d = mis.def; G.missions.abort(true); G.togglePause(false); G.missions.start(d, true); }), this.btn('abort_mission', () => { G.missions.abort(); G.togglePause(false); }, 'danger'));
      grid.append(this.btn('save_game', () => { G.autosave(true); }), this.btn('map', () => this.map()), this.btn('missions', () => this.missions()), this.btn('characters', () => this.characters()), this.btn('inventory', () => this.inventory()), this.btn('shop', () => this.shop()), this.btn('achievements', () => this.achievements()), this.btn('statistics', () => this.stats()), this.btn('photo_mode', () => G.startPhoto()), this.btn('replay', () => G.startReplay()), this.btn('how_to_play', () => this.howTo()), this.btn('main_menu', () => this.confirm('confirm_menu', () => G.toMenu()), 'danger'));
      body.append(grid);
    }, { onClose: () => { if (G.state === 'paused' && !this.stack.length) G.togglePause(false); } });
    return m;
  }

  // ------------------------------------------------------------------ settings (gear icon)
  openSettings(tab) {
    if (G.state === 'play') G.togglePause(true, true);
    const existing = this.stack.find((m) => m.titleKey === 'settings'); if (existing) return;
    this.modal('settings', (body, m) => {
      this.tabs(m, [['lang', 'tab_language', '🌐'], ['gfx', 'tab_graphics', '🖥'], ['audio', 'tab_audio', '🔊'], ['controls', 'tab_controls', '⌨'], ['touch', 'tab_touch', '👆'], ['camera', 'tab_camera', '🎥'], ['access', 'tab_access', '♿'], ['game', 'tab_gameplay', '🎮'], ['save', 'tab_save', '💾'], ['dev', 'tab_dev', '🛠']], body, (tab, pane) => this['set_' + tab](pane, m));
    }, { cls: 'wide settings', tab, onClose: () => { if (G.state === 'paused' && this.stack.length === 0 && G.pausedBySettings) G.togglePause(false); } });
  }
  set_lang(p) {
    const S = G.settings;
    const grid = el('div', { class: 'lang-grid' });
    for (const L of LANGS) {
      const cov = Math.round(coverage(L.code) * 100);
      grid.append(el('button', { class: 'lang' + (S.lang === L.code ? ' on' : ''), lang: L.code, dir: L.rtl ? 'rtl' : 'ltr', onclick: () => { S.lang = L.code; setLang(L.code); this.saveS(); G.audio.play('uiClick'); } }, [el('b', { text: L.name }), el('small', { text: L.code + (cov < 100 && L.code !== 'en' && L.code !== 'en-GB' ? ` · ${cov}%` : '') })]));
    }
    p.append(grid, el('p', { class: 'muted', text: t('lang_note') }));
  }
  set_gfx(p, m) {
    const S = G.settings, o = S.gfx; const cur = presetParams(S.preset);
    const grid = el('div', { class: 'preset-grid' });
    PRESET_NAMES.forEach((name, i) => grid.append(el('button', { class: 'preset' + (S.preset === i ? ' on' : '') + (i >= 3 ? ' beyond' : ''), onclick: () => { S.preset = i; this.saveS(); G.applyGraphics(); m.render(); } }, [el('b', { text: name }), el('small', { text: i < 3 ? t('preset_desc_' + i) : t('preset_tier', { n: i - 2 }) })])));
    p.append(el('h3', { text: t('gfx_presets') }), grid);
    const info = el('div', { class: 'preset-info' });
    const fx = []; if (cur.bloom) fx.push(t('fx_bloom')); if (cur.ssao) fx.push(t('fx_ssao')); if (cur.godrays) fx.push(t('fx_godrays')); if (cur.motionBlur) fx.push(t('fx_mblur')); if (cur.msaa) fx.push('MSAA ×' + num(cur.msaa)); if (cur.dofCine) fx.push(t('fx_dof')); if (cur.env) fx.push(t('fx_reflect')); if (cur.grain) fx.push(t('fx_grain'));
    info.append(el('table', { class: 'kv' }, [
      ['gi_res', num(cur.scale * 100) + '% · ' + t('gi_cap', { n: num(cur.prCap, 1) })], ['gi_shadow', cur.shadow ? num(cur.shadow) + ' px · ' + num(cur.shadowDist) + ' ' + t('m') : t('gi_blob')], ['gi_draw', num(cur.draw) + ' ' + t('m')],
      ['gi_veg', num(cur.veg * 100) + '%'], ['gi_grass', cur.grass ? num(cur.grass * 100) + '%' : t('off')], ['gi_particles', num(cur.particles * 100) + '%'], ['gi_aa', cur.aa.toUpperCase()], ['gi_char', num(cur.charQ * 100) + '%'], ['gi_effects', fx.join(' · ') || '—'],
    ].map(([k, v]) => el('tr', {}, [el('td', { text: t(k) }), el('td', { text: v })]))));
    info.append(el('p', { class: 'muted', text: t('fps_note') }));
    info.append(this.btn('gfx_compare', () => G.comparePreview(S.preset)));
    p.append(info);
    const ov = (key, ctrl) => p.append(this.row(key, ctrl));
    const tri = (v) => (v === null ? 'auto' : v ? 'on' : 'off');
    const triSel = (k) => this.select([{ v: 'auto', l: t('auto_preset') }, { v: 'on', l: t('on') }, { v: 'off', l: t('off') }], tri(o[k]), (v) => { o[k] = v === 'auto' ? null : v === 'on'; this.saveS(); G.applyGraphics(); });
    p.append(el('h3', { text: t('gfx_custom') }));
    ov('gfx_res', this.select([{ v: '', l: t('auto_preset') }, ...[0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5, 2].map((x) => ({ v: x, l: num(x * 100) + '%' }))], o.renderScale ?? '', (v) => { o.renderScale = v === '' ? null : parseFloat(v); this.saveS(); G.applyGraphics(); }));
    ov('gfx_shadow', this.select([{ v: '', l: t('auto_preset') }, { v: 0, l: t('off') }, { v: 1024, l: t('q_low') }, { v: 2048, l: t('q_med') }, { v: 4096, l: t('q_high') }], o.shadow ?? '', (v) => { o.shadow = v === '' ? null : parseInt(v); this.saveS(); G.applyGraphics(); }));
    ov('gfx_particles', this.select([{ v: '', l: t('auto_preset') }, { v: 0.35, l: t('q_low') }, { v: 1, l: t('q_med') }, { v: 2, l: t('q_high') }], o.particles ?? '', (v) => { o.particles = v === '' ? null : parseFloat(v); this.saveS(); G.applyGraphics(); }));
    ov('gfx_anim', this.select([{ v: '', l: t('auto_preset') }, { v: 20, l: t('q_low') }, { v: 60, l: t('q_med') }, { v: 200, l: t('q_high') }], o.anim ?? '', (v) => { o.anim = v === '' ? null : parseFloat(v); this.saveS(); G.applyGraphics(); }));
    ov('gfx_draw', this.select([{ v: '', l: t('auto_preset') }, ...[400, 700, 1000, 1600, 2400].map((x) => ({ v: x, l: num(x) + ' ' + t('m') }))], o.draw ?? '', (v) => { o.draw = v === '' ? null : parseFloat(v); this.saveS(); G.applyGraphics(); }));
    ov('gfx_aa', this.select([{ v: '', l: t('auto_preset') }, { v: 'none', l: t('off') }, { v: 'fxaa', l: 'FXAA' }, { v: 'smaa', l: 'SMAA' }], o.aa ?? '', (v) => { o.aa = v === '' ? null : v; this.saveS(); G.applyGraphics(); }));
    ov('fx_bloom', triSel('bloom')); ov('fx_ssao', triSel('ssao')); ov('fx_mblur', triSel('motionBlur')); ov('fx_godrays', triSel('godrays')); ov('fx_dof', triSel('dof'));
    ov('gfx_post', this.slider(S.postIntensity, 0, 1.5, 0.05, (v) => { S.postIntensity = v; this.saveS(); }));
    ov('gfx_fps', this.toggle(S.fpsCounter, (v) => { S.fpsCounter = v; this.saveS(); }));
    ov('gfx_dynres', this.toggle(S.dynRes, (v) => { S.dynRes = v; this.saveS(); }));
    ov('gfx_adaptive', this.toggle(S.adaptive, (v) => { S.adaptive = v; this.saveS(); }));
    ov('gfx_target', this.select([{ v: 30, l: '30' }, { v: 60, l: '60' }, { v: 0, l: t('unlimited') }], S.fpsTarget, (v) => { S.fpsTarget = parseInt(v); this.saveS(); }));
  }
  set_audio(p) {
    const a = G.settings.audio; const up = () => { G.audio.setVolumes(a); this.saveS(); };
    for (const k of ['master', 'music', 'sfx', 'ambient']) p.append(this.row('vol_' + k, this.slider(a[k], 0, 1, 0.05, (v) => { a[k] = v; up(); }, (x) => num(x * 100) + '%')));
    p.append(this.row('audio_quality', this.select([{ v: 'high', l: t('q_high') }, { v: 'low', l: t('q_low') }], G.settings.audioQ || 'high', (v) => { G.settings.audioQ = v; G.audio.setQuality(v); this.saveS(); })));
    p.append(this.btn('audio_test', () => G.audio.play('ring')));
  }
  set_controls(p) {
    const S = G.settings;
    p.append(this.row('mouse_sens', this.slider(S.camera.sens, 0.2, 3, 0.05, (v) => { S.camera.sens = v; this.saveS(); })));
    p.append(this.row('invert_y', this.toggle(S.camera.invertY, (v) => { S.camera.invertY = v; this.saveS(); })));
    p.append(this.row('pad_dead', this.slider(S.pad.dead, 0.05, 0.4, 0.01, (v) => { S.pad.dead = v; this.saveS(); })));
    p.append(this.row('pad_sens', this.slider(S.pad.sens, 0.3, 3, 0.05, (v) => { S.pad.sens = v; this.saveS(); })));
    p.append(el('h3', { text: t('key_bindings') }), el('p', { class: 'muted', text: t('rebind_hint') }));
    const tb = el('table', { class: 'binds' });
    for (const a of ACTIONS) {
      const cells = [0, 1].map((slot) => { const b = el('button', { class: 'kbtn', text: keyName(S.keys[a][slot]) }); b.onclick = () => { b.textContent = '…'; b.classList.add('wait'); G.input.startRebind(a, slot, () => { this.saveS(); this.rerender(); }); }; return el('td', {}, [b]); });
      tb.append(el('tr', {}, [el('td', { text: t('act_' + a) }), ...cells]));
    }
    p.append(tb, this.btn('reset_keys', () => { S.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS)); this.saveS(); this.rerender(); }));
  }
  set_touch(p) {
    const T = G.settings.touch; const ap = () => { G.input.applyTouchLayout(); this.saveS(); };
    p.append(this.row('touch_show', this.select([{ v: 'auto', l: t('auto') }, { v: 'on', l: t('on') }, { v: 'off', l: t('off') }], T.show, (v) => { T.show = v; ap(); })));
    p.append(this.row('joy_size', this.slider(T.joySize, 0.6, 1.6, 0.05, (v) => { T.joySize = v; ap(); })));
    p.append(this.row('joy_mode', this.select([{ v: 'floating', l: t('joy_floating') }, { v: 'fixed', l: t('joy_fixed') }], T.joyMode, (v) => { T.joyMode = v; ap(); })));
    p.append(this.row('btn_size', this.slider(T.btnSize, 0.6, 1.6, 0.05, (v) => { T.btnSize = v; ap(); })));
    p.append(this.row('btn_opacity', this.slider(T.opacity, 0.15, 1, 0.05, (v) => { T.opacity = v; ap(); }, (x) => num(x * 100) + '%')));
    p.append(this.row('touch_sens', this.slider(T.sens, 0.3, 3, 0.05, (v) => { T.sens = v; ap(); })));
    p.append(this.row('touch_dead', this.slider(T.dead, 0, 0.4, 0.01, (v) => { T.dead = v; ap(); })));
    p.append(this.row('touch_smooth', this.slider(T.smoothing, 0, 0.9, 0.05, (v) => { T.smoothing = v; ap(); })));
    p.append(this.row('haptics', this.toggle(T.haptics, (v) => { T.haptics = v; ap(); G.input.vibrate(30); })));
    p.append(el('div', { class: 'btn-row' }, [this.btn('edit_layout', () => this.layoutEditor(), 'primary'), this.btn('reset_layout', () => { G.input.resetLayout(); this.saveS(); })]));
  }
  layoutEditor() {
    this.closeAll(); G.input.editLayout(true);
    const bar = el('div', { class: 'layout-bar' }, [el('span', { text: t('layout_hint') }), this.btn('done', () => { G.input.editLayout(false); this.saveS(); bar.remove(); this.openSettings('touch'); }, 'primary'), this.btn('reset_layout', () => { G.input.resetLayout(); G.input.editLayout(true); })]);
    document.body.append(bar);
  }
  set_camera(p) {
    const C = G.settings.camera; const sv = () => this.saveS();
    p.append(this.row('cam_sens', this.slider(C.sens, 0.2, 3, 0.05, (v) => { C.sens = v; sv(); })));
    p.append(this.row('cam_smooth', this.slider(C.smooth, 0, 1, 0.05, (v) => { C.smooth = v; sv(); })));
    p.append(this.row('cam_dist', this.slider(C.dist, 0.6, 1.8, 0.05, (v) => { C.dist = v; sv(); })));
    p.append(this.row('cam_fov', this.slider(C.fov, 50, 90, 1, (v) => { C.fov = v; sv(); })));
    p.append(this.row('cam_shake', this.slider(C.shake, 0, 1.5, 0.05, (v) => { C.shake = v; sv(); })));
    p.append(this.row('cam_auto', this.toggle(C.autoAlign, (v) => { C.autoAlign = v; sv(); }), 'cam_auto_hint'));
    p.append(this.row('cam_speedfov', this.toggle(C.speedFov, (v) => { C.speedFov = v; sv(); })));
    p.append(this.row('cam_mode', this.select(['follow', 'close', 'far', 'free', 'first'].map((x, i) => ({ v: i, l: t('cam_' + x) })), G.cam ? G.cam.modeIndex : 0, (v) => { if (G.cam) G.cam.modeIndex = parseInt(v); })));
    p.append(this.btn('cam_reset', () => G.cam && G.cam.reset()));
  }
  set_access(p) {
    const A = G.settings.access; const sv = () => { this.saveS(); G.applyAccess(); };
    p.append(this.row('text_size', this.slider(A.textScale, 0.8, 1.5, 0.05, (v) => { A.textScale = v; sv(); }, (x) => num(x * 100) + '%')));
    p.append(this.row('colorblind', this.select(['none', 'protanopia', 'deuteranopia', 'tritanopia'].map((x) => ({ v: x, l: t('cb_' + x) })), A.colorblind, (v) => { A.colorblind = v; sv(); })));
    p.append(this.row('reduce_motion', this.toggle(A.reduceMotion, (v) => { A.reduceMotion = v; sv(); })));
    p.append(this.row('high_contrast', this.toggle(A.highContrast, (v) => { A.highContrast = v; sv(); })));
    p.append(this.row('subtitles', this.toggle(A.subtitles, (v) => { A.subtitles = v; sv(); })));
    p.append(this.row('auto_run', this.toggle(A.autoRun, (v) => { A.autoRun = v; sv(); }), 'auto_run_hint'));
    p.append(this.row('boost_toggle', this.toggle(A.boostToggle, (v) => { A.boostToggle = v; sv(); })));
    p.append(this.row('game_speed', this.select([0.6, 0.75, 0.9, 1].map((x) => ({ v: x, l: num(x * 100) + '%' })), A.gameSpeed, (v) => { A.gameSpeed = parseFloat(v); sv(); })));
  }
  set_game(p) {
    const Gp = G.settings.gameplay; const sv = () => this.saveS();
    const diff = (k) => this.select(['easy', 'normal', 'hard'].map((x) => ({ v: x, l: t('diff_' + x) })), Gp[k], (v) => { Gp[k] = v; sv(); });
    p.append(this.row('difficulty', diff('difficulty')), this.row('boss_difficulty', diff('boss')), this.row('mission_difficulty', diff('mission')));
    p.append(this.row('companion', this.toggle(Gp.companion, (v) => { Gp.companion = v; sv(); })));
    p.append(this.row('weather', this.select([{ v: 'dynamic', l: t('dynamic') }, ...WEATHER_TYPES.map((w) => ({ v: w, l: t('w_' + w) }))], Gp.weather, (v) => { Gp.weather = v; sv(); if (G.weather && G.region) G.weather.pickFor(G.region); })));
    p.append(this.row('time_of_day', this.select([{ v: 'dynamic', l: t('dynamic') }, { v: 6.2, l: t('tod_sunrise') }, { v: 10, l: t('tod_morning') }, { v: 13, l: t('tod_noon') }, { v: 18.1, l: t('tod_sunset') }, { v: 23, l: t('tod_night') }], Gp.time, (v) => { Gp.time = v; sv(); G.applyTime(); })));
    p.append(this.row('day_length', this.slider(Gp.dayLength, 4, 60, 1, (v) => { Gp.dayLength = v; sv(); G.applyTime(); }, (x) => t('minutes_n', { n: x }))));
    p.append(this.row('hints', this.toggle(Gp.hints, (v) => { Gp.hints = v; sv(); })));
  }
  set_save(p) {
    const Sv = G.settings.save;
    p.append(this.row('autosave', this.toggle(Sv.autosave, (v) => { Sv.autosave = v; this.saveS(); })));
    p.append(this.row('autosave_interval', this.select([30, 60, 120, 300].map((x) => ({ v: x, l: t('seconds_n', { n: x }) })), Sv.interval, (v) => { Sv.interval = parseInt(v); this.saveS(); })));
    if (G.save) p.append(el('div', { class: 'btn-row' }, [this.btn('save_now', () => G.autosave(true), 'primary'), this.btn('export_save', () => this.exportSave()), this.btn('import_save', () => this.importSave())]));
    p.append(el('h3', { text: t('save_slots') }));
    for (let n = 1; n <= 3; n++) { const meta = slotMeta(n); p.append(el('div', { class: 'slot' }, [el('div', {}, [el('b', { text: t('slot_n', { n }) + (G.slot === n && G.save ? ' · ' + t('current') : '') }), el('small', { text: meta ? `${t('char_' + meta.char)} · ${t('completion_n', { n: meta.completion })}` : t('empty_slot') })]), el('div', { class: 'slot-btns' }, [G.save && G.slot !== n ? this.btn('save_here', () => { G.slot = n; G.autosave(true); this.rerender(); }) : null, meta ? this.btn('delete', () => this.confirm('confirm_delete', () => { deleteSlot(n); this.rerender(); }), 'danger') : null])])); }
    p.append(el('h3', { text: t('reset') }), el('div', { class: 'btn-row' }, [this.btn('reset_settings', () => this.confirm('confirm_reset', () => { const lang = G.settings.lang; Object.assign(G.settings, defaultSettings(), { lang }); this.saveS(); G.applyGraphics(); G.applyAccess(); G.input.applyTouchLayout(); this.rerender(); }), 'danger')]));
  }
  exportSave() {
    const txt = JSON.stringify(G.save);
    this.modal('export_save', (body) => {
      const ta = el('textarea', { class: 'code', readonly: true, rows: 8 }); ta.value = txt;
      body.append(el('p', { class: 'muted', text: t('export_hint') }), ta, this.btn('copy', () => { ta.select(); try { navigator.clipboard.writeText(txt).catch(() => {}); } catch { /* select fallback */ } G.hud.toast('copied', 'info'); }));
    });
  }
  importSave() {
    this.modal('import_save', (body, m) => {
      const ta = el('textarea', { class: 'code', rows: 8, placeholder: '{ … }' });
      const file = el('input', { type: 'file', accept: '.json,application/json,text/plain', onchange: (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => (ta.value = r.result); r.readAsText(f); } });
      body.append(el('p', { class: 'muted', text: t('import_hint') }), file, ta, this.btn('import', () => { try { const d = JSON.parse(ta.value); if (d.v !== 1 || !d.stats) throw 0; writeSlot(G.slot, d); this.close(m); G.startGame(G.slot); G.hud.toast('import_ok', 'good'); } catch { G.hud.toast('import_bad', 'warn'); } }, 'primary'));
    });
  }
  set_dev(p) {
    const D = G.settings.dev; const sv = () => this.saveS();
    p.append(this.row('dev_collision', this.toggle(D.collision, (v) => { D.collision = v; sv(); })));
    p.append(this.row('dev_move', this.toggle(D.moveDebug, (v) => { D.moveDebug = v; sv(); })));
    p.append(this.row('dev_perf', this.toggle(D.perfGraph, (v) => { D.perfGraph = v; sv(); })));
    p.append(this.row('gfx_fps', this.toggle(G.settings.fpsCounter, (v) => { G.settings.fpsCounter = v; sv(); })));
    if (G.save) { p.append(el('h3', { text: t('dev_teleport') })); const row = el('div', { class: 'chips' }); for (const k of ['hub', 'titan', 'waterfall', 'oasis', 'crater', 'city', 'shrine', 'fortress', 'lab', 'sky0', 'moon', 'krakenArena']) if (ANCHORS[k]) row.append(this.btn('anchor_' + k, () => { G.player.spawn(ANCHORS[k].clone().add(new (ANCHORS[k].constructor)(3, 2, 3)), 0); this.closeAll(); G.togglePause(false); })); p.append(row); }
  }

  // ------------------------------------------------------------------ characters
  characters() {
    this.modal('characters', (body, m) => {
      const s = G.save; m.sel = m.sel || s.char;
      const list = el('div', { class: 'char-list' });
      for (const id of CHAR_ORDER) {
        const un = s.unlocked.includes(id); const info = CHARACTER_INFO[id];
        list.append(el('button', { class: 'char' + (m.sel === id ? ' on' : '') + (un ? '' : ' locked'), style: { '--c': info.colors.primary }, onclick: () => { m.sel = id; m.render(); } }, [el('span', { class: 'swatch' }), el('b', { text: t('char_' + id) }), el('small', { text: un ? t('lv_short', { n: s.level[id] }) + (s.char === id ? ' · ★' : s.companion === id ? ' · ♥' : '') : '🔒' })]));
      }
      body.append(list);
      const id = m.sel; const un = s.unlocked.includes(id); const st = charStats(id); const base = CHAR_STATS[id];
      const d = el('div', { class: 'char-detail' });
      d.append(el('h3', { text: t('char_' + id) + ' — ' + t('species_' + id) }), el('p', { text: t('bio_' + id) }), el('p', { class: 'muted', text: t('ability') + ': ' + t('spec_' + base.special) }));
      if (!un) { const r = UNLOCK_RULES[id]; d.append(el('p', { class: 'lock', text: r.mission ? t('unlock_mission', { name: t('mis_' + r.mission) }) : r.boss ? t('unlock_boss', { name: t('boss_' + r.boss) }) : t('unlock_tokens', { n: countFound('token'), m: r.tokens }) })); }
      const bar = (k, v, max) => el('div', { class: 'stat' }, [el('span', { text: t(k) }), el('i', {}, [el('em', { style: { width: clamp(v / max, 0, 1) * 100 + '%' } })])]);
      d.append(bar('st_speed', st.top, 40), bar('st_accel', st.accel, 45), bar('st_jump', st.jump, 17), bar('st_boost', st.boostSpeed, 80), bar('st_air', st.air, 1.8));
      if (un) {
        const xp = s.xp[id], need = xpFor(s.level[id]);
        d.append(el('p', { text: t('xp_line', { lv: s.level[id], xp, need, sp: s.sp[id] }) }));
        d.append(el('div', { class: 'btn-row' }, [s.char !== id ? this.btn('play_as', () => { G.switchCharacter(id); m.render(); }, 'primary') : el('span', { class: 'pill', text: t('playing') }), s.companion !== id && s.char !== id ? this.btn('set_companion', () => { s.companion = id; G.companion && G.companion.set(id); m.render(); }) : null]));
        // skins
        d.append(el('h4', { text: t('skins') }));
        const sk = el('div', { class: 'chips' });
        CHARACTER_INFO[id].skins.forEach((skin, i) => { const key = id + ':' + skin; const owned = i === 0 || s.ownedSkins[key]; const on = s.skin[id] === skin;
          sk.append(el('button', { class: 'chip' + (on ? ' on' : ''), text: t('skin_' + skin) + (owned ? '' : ' · ◎' + num(SKIN_PRICES[i])), onclick: () => { if (!owned) { if (s.wallet < SKIN_PRICES[i]) return G.hud.toast('not_enough', 'warn'); s.wallet -= SKIN_PRICES[i]; s.ownedSkins[key] = 1; G.audio.play('itemPickup'); } s.skin[id] = skin; if (G.player.charId === id) G.player.rig.setSkin(skin); m.render(); } })); });
        d.append(sk);
        // skill tree
        d.append(el('h4', { text: t('skill_tree') + ' · ' + t('sp_n', { n: s.sp[id] }) }));
        const tree = el('div', { class: 'tree' }); const owned = s.skills[id];
        for (const sk2 of SKILLS) {
          const has = !!owned[sk2.id]; const can = !has && s.sp[id] >= sk2.cost && (!sk2.req || owned[sk2.req]);
          tree.append(el('button', { class: 'node' + (has ? ' has' : can ? ' can' : ''), style: { gridColumn: sk2.col + 1, gridRow: sk2.row + 1 }, onclick: () => { if (!can) return; owned[sk2.id] = 1; s.sp[id] -= sk2.cost; G.player.refreshStats(); G.audio.play('levelUp'); m.render(); } }, [el('b', { text: t('sk_' + sk2.id, { spec: t('spec_' + base.special) }) }), el('small', { text: has ? '✓' : t('sp_n', { n: sk2.cost }) })]));
        }
        d.append(tree);
        const cm = MISSIONS.find((x) => x.char === id); if (cm) d.append(el('p', { class: 'muted', text: t('char_mission') + ': ' + t('mis_' + cm.id) }));
      }
      body.append(d);
    }, { cls: 'wide' });
  }

  // ------------------------------------------------------------------ missions / races / bosses
  missions() {
    this.modal('missions', (body, m) => {
      this.tabs(m, [['story', 'mt_story'], ['side', 'mt_side'], ['char', 'mt_char'], ['race', 'mt_race'], ['boss', 'mt_boss'], ['daily', 'mt_challenges']], body, (tab, pane) => {
        if (tab === 'daily') return this.challenges(pane);
        const list = MISSIONS.filter((x) => tab === 'story' ? x.story : tab === 'side' ? (!x.story && !x.char && x.type !== 'race' && x.special === undefined) : tab === 'char' ? x.char : tab === 'race' ? x.type === 'race' || x.type === 'tournament' : x.type === 'boss');
        for (const ms of list) {
          const rec = G.save.missions[ms.id]; const av = G.missions.available(ms);
          const right = el('div', { class: 'slot-btns' });
          if (av) right.append(this.btn(rec && rec.done ? 'replay' : 'start', () => { this.closeAll(); G.togglePause(false); G.missions.start(ms, true); }, rec && rec.done ? '' : 'primary'));
          const extra = ms.race ? this.raceLine(ms.race) : ms.boss && G.save.bosses[ms.boss] ? ` · ${t('best')} ${digits(fmtTime(G.save.bosses[ms.boss].best))} · ${G.save.bosses[ms.boss].rank}` : '';
          pane.append(el('div', { class: 'slot' + (av ? '' : ' locked') }, [el('div', {}, [el('b', { text: (rec && rec.done ? '✓ ' : av ? '' : '🔒 ') + t('mis_' + ms.id) }), el('small', { text: t('mdesc_' + ms.id, { n: ms.count, kmh: ms.kmh, s: ms.seconds }) + (ms.reward ? ` · ${t('reward')}: ◎${num(ms.reward)}` : '') + (rec && rec.rank ? ` · ${t('rank')} ${rec.rank}` : '') + extra })]), right]));
          if (ms.race && G.save.races[ms.race] && G.save.races[ms.race].board) { const b = G.save.races[ms.race].board; pane.append(el('ol', { class: 'board' }, b.map((r) => el('li', { text: `${digits(fmtTime(r.t))} · ${t('char_' + r.c)}` })))); }
        }
      });
    }, { cls: 'wide' });
  }
  raceLine(id) { const r = G.save.races[id]; if (!r) return ''; return ` · ${t('best')} ${digits(fmtTime(r.best))}${r.medal ? ' · ' + t('medal_' + r.medal) : ''}${r.avgSpeed ? ' · ' + num(r.avgSpeed) + ' ' + t('kmh') : ''}`; }
  challenges(p) {
    G.progress.refreshChallenges(); const s = G.save;
    for (const [set, key, reward] of [[s.daily, 'daily', 250], [s.weekly, 'weekly', 1500]]) {
      p.append(el('h3', { text: t(key + '_challenges') + ' · ◎' + num(reward) }));
      for (const c of set.list) { const pr = challengeProgress(c); p.append(el('div', { class: 'slot' + (c.done ? ' done' : '') }, [el('div', {}, [el('b', { text: (c.done ? '✓ ' : '') + t('ch_' + c.stat, { n: c.goal }) }), el('small', { text: num(Math.floor(pr)) + ' / ' + num(c.goal) })])])); }
    }
  }
  missionBrief(ms) {
    if (G.state === 'play') G.togglePause(true, true);
    const m = this.modal(() => t('mis_' + ms.id), (body) => {
      body.append(el('p', { text: t('mdesc_' + ms.id, { n: ms.count, kmh: ms.kmh, s: ms.seconds }) }));
      const rec = G.save.missions[ms.id];
      body.append(el('table', { class: 'kv' }, [
        ms.time ? el('tr', {}, [el('td', { text: t('time_limit') }), el('td', { text: digits(fmtTime(ms.time)) })]) : null,
        el('tr', {}, [el('td', { text: t('reward') }), el('td', { text: ms.reward ? '◎' + num(rec && rec.done ? Math.round(ms.reward * 0.3) : ms.reward) + ' + XP' : (ms.boss ? '◎' + num(BOSS_DEFS[ms.boss].reward) + ' + XP' : 'XP') })]),
        el('tr', {}, [el('td', { text: t('rank_s_hint') }), el('td', { text: ms.time ? digits(fmtTime(ms.time * 0.45)) : '—' })]),
        rec ? el('tr', {}, [el('td', { text: t('best') }), el('td', { text: digits(fmtTime(rec.best)) + ' · ' + rec.rank })]) : null,
        el('tr', {}, [el('td', { text: t('mission_difficulty') }), el('td', { text: t('diff_' + G.settings.gameplay.mission) })]),
      ]));
      body.append(el('div', { class: 'btn-row' }, [this.btn('start', () => { this.closeAll(); G.togglePause(false); G.missions.start(ms, false); }, 'primary'), this.btn('cancel', () => { this.close(m); })]));
    }, { cls: 'small', onClose: () => { if (!this.stack.length && G.state === 'paused') G.togglePause(false); } });
  }
  missionResult(ms, r) {
    G.togglePause(true, true);
    const m = this.modal(() => (r.ok ? t('mission_complete') : t('mission_failed')), (body) => {
      body.append(el('h3', { text: t('mis_' + ms.id) }));
      if (r.ok) {
        body.append(el('div', { class: 'rank rank-' + r.rank, text: r.rank }));
        body.append(el('table', { class: 'kv' }, [el('tr', {}, [el('td', { text: t('time') }), el('td', { text: digits(fmtTime(r.time)) })]), el('tr', {}, [el('td', { text: t('reward') }), el('td', { text: '◎' + num(r.reward) })]),
          r.race ? el('tr', {}, [el('td', { text: t('race_pos') }), el('td', { text: num(r.race.pos) + '/' + num(r.race.of) + (r.race.medal ? ' · ' + t('medal_' + r.race.medal) : '') })]) : null,
          r.race ? el('tr', {}, [el('td', { text: t('avg_speed') }), el('td', { text: num(r.race.avg) + ' ' + t('kmh') })]) : null]));
        if (r.first) body.append(el('p', { class: 'good', text: t('first_clear') }));
      } else body.append(el('p', { class: 'warn', text: t(r.reason || 'fail_time') }));
      body.append(el('div', { class: 'btn-row' }, [this.btn(r.ok ? 'replay' : 'retry', () => { this.closeAll(); G.togglePause(false); G.missions.start(ms, true); }), this.btn('continue', () => { this.closeAll(); G.togglePause(false); }, 'primary')]));
    }, { cls: 'small', onClose: () => { if (!this.stack.length) G.togglePause(false); } });
  }

  // ------------------------------------------------------------------ map
  map() {
    this.modal('map', (body) => {
      const size = Math.min(560, innerWidth - 80, innerHeight - 170);
      const c = el('canvas', { class: 'worldmap', width: 512, height: 512, style: { width: size + 'px', height: size + 'px' } });
      const g = c.getContext('2d'); if (!this.mapImg) this.mapImg = mapCanvas(512);
      g.drawImage(this.mapImg, 0, 0);
      const s = G.save;
      // fog over undiscovered regions
      for (const r of REGIONS) { if (s.regions[r.id]) continue; const [x, y] = worldToMap(r.c[0], r.c[1], 512); const gr = g.createRadialGradient(x, y, 10, x, y, r.s * 512 / 2400 * 1.3); gr.addColorStop(0, 'rgba(10,14,28,0.85)'); gr.addColorStop(1, 'rgba(10,14,28,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r.s * 0.3, 0, 7); g.fill(); }
      g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
      for (const r of REGIONS) { const [x, y] = worldToMap(r.c[0], r.c[1], 512); g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(s.regions[r.id] ? t('region_' + r.id) : '?', x + 1, y + 1); g.fillStyle = '#fff'; g.fillText(s.regions[r.id] ? t('region_' + r.id) : '?', x, y); }
      const dot = (x, z, col, rr = 4) => { const [a, b] = worldToMap(x, z, 512); g.fillStyle = col; g.beginPath(); g.arc(a, b, rr, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); };
      for (const mk of G.missions.markers) dot(mk.p.x, mk.p.z, mk.m.story ? '#ffd21a' : '#5ad8ff', 4);
      // collectibles revealed by map fragments
      for (const k in G.level.collectibles) { const cc = G.level.collectibles[k]; if (s.found[k] || cc.x === undefined) continue; const reg = REGIONS.find((r) => r.id === (G.level.regionOf ? G.level.regionOf(cc) : '')); const rid = regionIdAt(cc.x, cc.z); if (s.maps[rid]) dot(cc.x, cc.z, cc.kind === 'red' ? '#ff3a5a' : cc.kind === 'shard' ? '#ffffff' : '#9a6aff', 2.5); }
      const P = G.player.pos; dot(P.x, P.z, '#4aff8a', 6);
      body.append(el('div', { class: 'map-wrap' }, [c]));
      body.append(el('p', { class: 'muted', text: t('map_legend') }));
      // fast travel to discovered regions
      const ft = el('div', { class: 'chips' });
      for (const r of REGIONS) if (s.regions[r.id]) ft.append(this.btn('travel_to', () => { const cp = G.level.objects.find((o) => o.type === 'checkpoint' && regionIdAt(o.pos.x, o.pos.z) === r.id); const p = cp ? cp.pos.clone() : null; if (p) { G.missions.abort(true); G.player.spawn(p.add(new p.constructor(2, 1, 2)), 0); G.level.setCheckpoint(cp); this.closeAll(); G.togglePause(false); } }, '', { name: t('region_' + r.id) }));
      body.append(el('h4', { text: t('fast_travel') }), ft);
    }, { cls: 'wide' });
  }

  // ------------------------------------------------------------------ inventory / shop
  inventory() {
    this.modal('inventory', (body, m) => {
      const s = G.save;
      body.append(el('div', { class: 'chips' }, [el('span', { class: 'pill', text: '◎ ' + num(s.wallet) }), el('span', { class: 'pill', text: t('keys_n', { n: s.keys }) }), el('span', { class: 'pill', text: t('crystals_n', { n: s.crystals }) }), el('span', { class: 'pill', text: t('shards_n', { n: countFound('shard'), m: 7 }) }), el('span', { class: 'pill', text: t('tokens_n', { n: countFound('token'), m: TOTALS.token }) })]));
      const items = Object.keys(s.items); let i = 1;
      for (const k of items) {
        const n = s.items[k]; const hot = i++;
        body.append(el('div', { class: 'slot' }, [el('div', {}, [el('b', { text: t('item_' + k) + ' ×' + num(n) }), el('small', { text: t('idesc_' + k) + ' · ' + t('hotkey_n', { n: hot }) })]), n > 0 ? this.btn('use', () => { G.useItem(k); m.render(); }, 'primary') : null]));
      }
    });
  }
  shop() {
    this.modal('shop', (body, m) => {
      const s = G.save;
      body.append(el('p', { class: 'pill', text: '◎ ' + num(s.wallet) }));
      this.tabs(m, [['upgrade', 'shop_upgrades'], ['ability', 'shop_abilities'], ['item', 'shop_items'], ['skins', 'shop_skins']], body, (tab, pane) => {
        if (tab === 'skins') { pane.append(el('p', { class: 'muted', text: t('skins_hint') }), this.btn('characters', () => this.characters())); return; }
        for (const it of SHOP.filter((x) => x.kind === tab)) {
          const lvl = it.kind === 'item' ? 0 : s.upgrades[it.id] || 0; const max = it.max || 99; const done = it.kind !== 'item' && lvl >= max;
          const price = it.price[Math.min(lvl, it.price.length - 1)];
          pane.append(el('div', { class: 'slot' }, [el('div', {}, [el('b', { text: t('shop_' + it.id) + (it.max > 1 ? ` (${num(lvl)}/${num(max)})` : '') + (it.kind === 'item' ? ' ×' + num(s.items[it.id] || 0) : '') }), el('small', { text: t('sdesc_' + it.id) })]),
            done ? el('span', { class: 'pill', text: '✓' }) : this.btn('buy_for', () => { if (s.wallet < price) return G.hud.toast('not_enough', 'warn'); s.wallet -= price; if (it.kind === 'item') s.items[it.id] = (s.items[it.id] || 0) + 1; else s.upgrades[it.id] = lvl + 1; G.player.refreshStats(); G.audio.play('itemPickup'); bus.emit('purchase', it.id); m.render(); }, s.wallet >= price ? 'primary' : '', { n: price })]));
        }
      });
    }, { cls: 'wide' });
  }

  // ------------------------------------------------------------------ achievements / stats
  achievements() {
    this.modal('achievements', (body) => {
      const s = G.save; const n = Object.keys(s.achievements).length;
      body.append(el('p', { class: 'muted', text: t('ach_count', { n, m: ACHIEVEMENTS.length }) }));
      const grid = el('div', { class: 'ach-grid' });
      for (const a of ACHIEVEMENTS) { const got = !!s.achievements[a.id]; const v = Math.min(a.goal, stat(a.stat));
        grid.append(el('div', { class: 'ach' + (got ? ' got' : '') }, [el('b', { text: (got ? '🏆 ' : '') + t('ach_' + a.id) }), el('small', { text: t('achd_' + a.id, { n: a.goal }) }), el('i', {}, [el('em', { style: { width: (v / a.goal) * 100 + '%' } })]), el('small', { text: '◎' + num(a.reward) })])); }
      body.append(grid);
    }, { cls: 'wide' });
  }
  stats() {
    this.modal('statistics', (body) => {
      const s = G.save, st = s.stats; const comp = completion();
      body.append(el('div', { class: 'completion' }, [el('b', { text: num(comp) + '%' }), el('span', { text: t('completion') })]));
      if (comp >= 100 && !s.flags.finalReward) { s.flags.finalReward = 1; s.wallet += 10000; s.unlocked = Array.from(new Set(s.unlocked.concat(['vex', 'ember']))); G.hud.toast('final_reward', 'gold'); }
      const rows = [['s_play', digits(fmtTime(s.playTime))], ['s_dist', num(st.distance / 1000, 1) + ' km'], ['s_rings', num(st.rings)], ['s_enemies', num(st.enemies)], ['s_top', num(st.topSpeed) + ' ' + t('kmh')], ['s_jumps', num(st.jumps)], ['s_boost', num(st.boostTime) + ' s'], ['s_homing', num(st.homing)], ['s_rail', num(st.railDist) + ' ' + t('m')], ['s_loops', num(st.loops)], ['s_missions', num(st.missions) + '/' + num(TOTALS.missions)], ['s_races', num(st.racesWon)], ['s_bosses', num(st.bosses) + '/5'], ['s_critters', num(st.critters)], ['s_deaths', num(st.deaths)], ['s_combo', num(st.maxCombo)],
        ['c_shards', num(countFound('shard')) + '/7'], ['c_red', num(countFound('red')) + '/' + num(TOTALS.red)], ['c_chests', num(countFound('chest')) + '/' + num(TOTALS.chest)], ['c_keys', num(countFound('key')) + '/' + num(TOTALS.key)], ['c_crystals', num(countFound('crystal')) + '/' + num(TOTALS.crystal)], ['c_tokens', num(countFound('token')) + '/' + num(TOTALS.token)], ['c_maps', num(countFound('map')) + '/' + num(TOTALS.map)], ['c_regions', num(Object.keys(s.regions).length) + '/10']];
      body.append(el('table', { class: 'kv two' }, rows.map(([k, v]) => el('tr', {}, [el('td', { text: t(k) }), el('td', { text: v })]))));
      body.append(el('h4', { text: t('milestones') }));
      const ms = [[10, 'ms_10'], [25, 'ms_25'], [50, 'ms_50'], [75, 'ms_75'], [100, 'ms_100']];
      body.append(el('div', { class: 'chips' }, ms.map(([p, k]) => el('span', { class: 'pill' + (comp >= p ? ' on' : ''), text: num(p) + '% · ' + t(k) }))));
    }, { cls: 'wide' });
  }

  // ------------------------------------------------------------------ photo mode / replay / compare
  photoUI(on) {
    if (this.photoEl) { this.photoEl.remove(); this.photoEl = null; }
    if (!on) return;
    const P = G.post; const ph = el('div', { class: 'photo-ui' });
    const render = () => {
      ph.innerHTML = '';
      ph.append(el('b', { text: t('photo_mode') }), el('small', { text: t('photo_hint') }));
      ph.append(this.row('cam_fov', this.slider(G.camera.fov, 20, 100, 1, (v) => { G.camera.fov = v; G.camera.updateProjectionMatrix(); })));
      ph.append(this.row('ph_focus', this.slider(P.dof ? P.dof.focus : 8, 1, 60, 0.5, (v) => { P.dof = Object.assign(P.dof || { aperture: 0.004, maxblur: 0.01 }, { focus: v }); })));
      ph.append(this.row('ph_aperture', this.slider(P.dof ? P.dof.aperture * 1000 : 0, 0, 20, 0.5, (v) => { P.dof = Object.assign(P.dof || { focus: 8, maxblur: 0.012 }, { aperture: v / 1000 }); if (v === 0) P.dof = null; })));
      ph.append(this.row('ph_exposure', this.slider(P.exposure, 0.4, 2, 0.05, (v) => { P.exposure = v; })));
      ph.append(this.row('ph_filter', this.select(['none', 'bw', 'sepia', 'warm', 'cool', 'vivid'].map((x, i) => ({ v: i, l: t('flt_' + x) })), P.filter, (v) => { P.filter = parseInt(v); })));
      ph.append(this.row('ph_time', this.slider(G.sky.hours, 0, 24, 0.1, (v) => { G.sky.fixed = v; })));
      ph.append(el('div', { class: 'btn-row' }, [this.btn('ph_capture', () => G.capturePhoto(), 'primary'), this.btn('ph_hide', () => { ph.classList.toggle('min'); }), this.btn('exit', () => G.stopPhoto())]));
    };
    render(); this.photoEl = ph; document.body.append(ph);
  }
  showPhoto(url) {
    this.modal('ph_saved', (body) => { body.append(el('img', { src: url, class: 'shot', alt: t('photo_mode') }), el('p', { class: 'muted', text: t('ph_saved_hint') })); }, { cls: 'wide' });
  }
  replayUI(on, rep) {
    if (this.repEl) { this.repEl.remove(); this.repEl = null; }
    if (!on) return;
    const r = el('div', { class: 'replay-ui' });
    const slider = el('input', { type: 'range', min: 0, max: 1, step: 0.001, value: 0, oninput: (e) => rep.seek(parseFloat(e.target.value)) });
    rep.onTick = (f) => { slider.value = f; };
    r.append(el('b', { text: t('replay') }), slider, el('div', { class: 'btn-row' }, [this.btn('play_pause', () => rep.toggle()), this.select([0.25, 0.5, 1, 2].map((x) => ({ v: x, l: num(x, 2) + '×' })), 1, (v) => (rep.speed = parseFloat(v))), this.select(['follow', 'orbit', 'side', 'track'].map((x) => ({ v: x, l: t('rc_' + x) })), rep.cam, (v) => (rep.cam = v)), this.btn('exit', () => G.stopReplay())]));
    this.repEl = r; document.body.append(r);
  }
  compareModal(a, b, nameA, nameB) {
    this.modal('gfx_compare', (body) => {
      body.append(el('div', { class: 'compare' }, [el('figure', {}, [el('img', { src: a, alt: nameA }), el('figcaption', { text: nameA })]), el('figure', {}, [el('img', { src: b, alt: nameB }), el('figcaption', { text: nameB })])]));
      body.append(el('p', { class: 'muted', text: t('compare_hint') }));
    }, { cls: 'wide' });
  }
}
function regionIdAt(x, z) { let best = null, bd = 1e9; for (const r of REGIONS) { const d = Math.hypot(x - r.c[0], z - r.c[1]) / r.s; if (d < bd) { bd = d; best = r.id; } } return best; }
