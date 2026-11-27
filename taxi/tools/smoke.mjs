import { boot } from './harness.mjs';
const t0 = Date.now();
const { browser, ev, st, shot } = await boot();
const r = await ev(() => { step(120); const g = game; return { state: g.state, pos: [g.player.pos.x.toFixed(1), g.player.pos.z.toFixed(1)], hour: g.hour.toFixed(2), q: g.settings && g.settings.quality }; });
console.log(JSON.stringify(r), 'ms', Date.now() - t0);
await shot('smoke');
console.log('errors', st.errors);
await browser.close();
