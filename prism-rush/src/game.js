// Shared game context + tiny event bus
export const G = {
  state: 'boot',      // boot | menu | play | paused | photo | replay | cutscene
  time: 0,            // world time (s)
  realTime: 0,
  timeScale: 1,
  settings: null, save: null, slot: 1, preset: null,
  scene: null, camera: null, renderer: null,
  terrain: null, sky: null, weather: null, nature: null, level: null, physics: null,
  player: null, cam: null, input: null, fx: null, post: null,
  enemies: null, bosses: null, missions: null, races: null, ui: null, hud: null, replay: null,
  region: null, debug: {},
};
const handlers = {};
export const bus = {
  on(evt, fn) { (handlers[evt] ||= []).push(fn); return () => { handlers[evt] = handlers[evt].filter((f) => f !== fn); }; },
  emit(evt, data) { const hs = handlers[evt]; if (hs) for (const f of hs.slice()) { try { f(data); } catch (e) { console.error('[bus]', evt, e); } } },
};
