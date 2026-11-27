// Regression: core flows + every mode + the new features, with random driving in between.
import { boot } from './harness.mjs';
const { browser, page, ev, st, shot } = await boot(800, 450);
const log = (k, v) => console.log(k.padEnd(14), typeof v === 'string' ? v : JSON.stringify(v));
await ev(() => { const g = game; g.timeScale = 1; g.rides.cooldown = 1e9; const o = g.ui.input.bind(g.ui); g.ui.input = () => Object.assign(o(), window.__inp || {}); g.ui.toggleAuto(true); });
// 1. a full ride
const seat = () => ev(() => { const r = game.rides; let o = null; for (let i = 0; i < 60 && (!o || o.kind || o.stops); i++) o = r.makeOffer(); r.offer = o; r.state = 'offer'; r.accept(false);
  const e = o.pickup.edge, A = game.world.graph.nodes[e.a], B = game.world.graph.nodes[e.b];
  game.player.placeAt(o.pickup.roadX + (o.pickup.x - o.pickup.roadX) * 0.45, o.pickup.roadZ + (o.pickup.z - o.pickup.roadZ) * 0.45, Math.atan2(B.x - A.x, B.z - A.z)); return o.name; });
await seat();
for (let i = 0; i < 40; i++) { await page.waitForTimeout(150); if (await ev(() => (step(20), game.rides.state === 'toDest'))) break; }
await ev(() => { const d = game.rides.ride.o.dest, e = d.edge, A = game.world.graph.nodes[e.a], B = game.world.graph.nodes[e.b]; game.player.placeAt(d.roadX + (d.x - d.roadX) * 0.45, d.roadZ + (d.z - d.roadZ) * 0.45, Math.atan2(B.x - A.x, B.z - A.z)); });
for (let i = 0; i < 40; i++) { await page.waitForTimeout(150); if (await ev(() => (step(20), game.rides.state === 'idle'))) break; }
log('ride', await ev(() => ({ state: game.rides.state, trips: game.stats.trips, money: game.money })));
// 2. police chase -> jail -> release
await ev(() => { const g = game; g.player.placeAt(1980, 1980, 0); g.police.spawnUnit(); g.police.state = 'chase'; step(60); g.startJail(); });
await page.waitForTimeout(1500);
await ev(() => { step(30); game.releaseFromJail(); });
await page.waitForTimeout(1500);
log('jail', await ev(() => (step(30), { state: game.state, police: game.police.state })));
// 3. random driving across regions with the new systems active
await ev(() => { const g = game; g.police.state = 'none'; g.money = 9e6; g.pet.data.owned = ['cat', 'dog', 'parrot']; g.pet.data.active = 'parrot'; g.skyfx.startShower(2); g.skyfx.dropT = 0; });
const spots = [[3, 160], [-1000, 30], [-700, -40], [0, -900], [0, 900], [900, 60], [-1200, 300], [250, 610], [-1000, 600]];
for (const [x, z] of spots) {
  const r = await ev(([x, z]) => { const g = game; g.player.placeAt(x, z, Math.random() * 6); g.hour = Math.random() * 24;
    for (let k = 0; k < 6; k++) { window.__inp = { gas: Math.random(), brake: Math.random() < 0.2 ? 1 : 0, steer: Math.random() * 2 - 1, handbrake: Math.random() < 0.1 }; step(40); if (Math.random() < 0.3) { g.audio.hornOn = true; g.honk(); step(3); g.audio.hornOn = false; } if (Math.random() < 0.3) g.pet.pet(); }
    const p = g.player; return [Math.round(p.pos.x), Math.round(p.pos.z), Number.isFinite(p.suspY) && Number.isFinite(p.y) ? 'ok' : 'NaN', g.state]; }, [x, z]);
  log('drive', r);
}
await ev(() => { window.__inp = {}; });
// 4. every mode starts and ends cleanly
const modes = await ev(() => { const g = game, out = {}; const reset = () => { g.player.placeAt(3, 160, 0); step(5); };
  const tryIt = (k, f) => { try { f(); out[k] = 'ok'; } catch (e) { out[k] = 'ERR ' + e.message; } };
  reset(); tryIt('crazy', () => { g.crazy.start(); step(120); g.crazy.end && g.crazy.end(false); step(30); });
  reset(); tryIt('parking', () => { g.parking.start(); step(120); g.parking.end && g.parking.end(false); step(30); });
  reset(); tryIt('soccer', () => { g.soccer.start(); step(200); g.soccer.end && g.soccer.end(); step(30); });
  reset(); tryIt('drag', () => { g.money = 9e6; g.drag.start(0); step(300); g.drag.end && g.drag.end(); step(30); });
  reset(); tryIt('tornado', () => { g.tornado.spawn(true); step(200); g.tornado.end(); step(30); });
  reset(); tryIt('photo', () => { g.photo.open(); step(10); g.photo.close(); step(5); });
  reset(); tryIt('replay', () => { step(200); g.replay.open(); step(100); g.replay.close(); step(5); });
  reset(); tryIt('garage', () => { g.ui.openGarage(g.world.garages[0]); step(5); g.ui.closePanel(); step(5); });
  return out; });
log('modes', modes);
// 4b. this round's rides and world features
const extra = await ev(() => { const g = game, out = {}; const tryIt = (k, f) => { try { out[k] = f(); } catch (e) { out[k] = 'ERR ' + e.message; } };
  tryIt('hydro', () => { const p = g.player; p.perf = [...(p.perf || []), 'hydro']; p.placeAt(3, -300, 0); step(5); p.speed = 12; g.hydro.press(); step(30); g.hydro.release(); const air = p.air; step(120, () => !p.air); return air ? 'ok' : 'no hop'; });
  tryIt('loop', () => { const S = g.stuntRides, L = S.loop, p = g.player; p.placeAt(L.x0 - 6, L.z0, L.h); step(2); p.speed = 22; const l0 = g.stats.loops || 0; step(30, () => !!p.script); step(300, () => !p.script); return (g.stats.loops || 0) > l0 ? 'ok' : 'no loop'; });
  tryIt('cannon', () => { const S = g.stuntRides, C = S.cannon, p = g.player; p.placeAt(C.pad.x, C.pad.z, C.aim); step(90); const on = !!p.script; step(1200, () => !p.script); return on && !p.script && !S.chute.visible ? 'ok' : 'stuck'; });
  tryIt('volcano', () => { g.volcano.erupt(); step(400); return g.volcano.rocks.length > 0 ? 'ok' : 'no rocks'; });
  tryIt('deer', () => { const p = g.player, ne = g.world.nearestEdge(0, -1000); p.placeAt(ne.x, ne.z, Math.atan2(-ne.dx, -ne.dz)); step(3); let ok = g.wildlife.startCrossing(); if (!ok) { p.heading += Math.PI; ok = g.wildlife.startCrossing(); } step(900, () => !g.wildlife.cross); return ok && !g.wildlife.cross ? 'ok' : 'stuck'; });
  tryIt('treasure', () => { const T = g.treasure; T.newHunt(); for (const q of [...T.data.pieces]) { g.player.placeAt(q.x + 2, q.z, 0); step(3); } return T.data.x ? 'ok' : 'no X'; });
  tryIt('airport', () => { const A = g.airport; A.state = 'away'; A.wait = 0.01; step(2); A.pos.z = A.A.z1 + 200; step(9000, () => A.state === 'gate'); return A.state === 'gate' ? 'ok' : A.state; });
  g.player.placeAt(3, 160, 0); step(5); return out; });
log('new', extra);
// 5. frozen night in and out
const z = await ev(() => { const g = game; g.player.placeAt(3, 160, 0); step(5); const can = g.zombie.canEnter(); g.zombie.enter(); step(300); const a = g.zombie.active; const pig = g.pigeons.body.visible, sky = g.skyfx.aurora.visible; g.zombie.exit(); step(60); return { can, active: a, pigeonsHidden: !pig, aurora: sky, after: g.zombie.active, state: g.state }; });
log('zombie', z);
await page.waitForTimeout(1200);
// 6. save -> reload -> state is back
await ev(() => { const g = game; g.stats.regMark = 4242; g.save(); });
await page.reload();
await page.waitForFunction(() => window.game && window.game.state === 'menu', null, { timeout: 240000 });
log('reload', await ev(() => ({ mark: game.stats.regMark, pet: game.pet.active(), owned: game.pet.data.owned, trips: game.stats.trips })));
await page.click('#menuContinue').catch(() => page.click('#menuStart'));
await page.waitForTimeout(500);
await ev(() => { const g = game; g.renderer.setAnimationLoop(null); g.clock.getDelta = () => 1 / 60; for (let i = 0; i < 200; i++) g.frame(); });
log('errors', st.errors);
await browser.close();
