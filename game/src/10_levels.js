/* ============================ LEVELS ============================ */
// L.d = difficulty index (0 easy … 4 insane). Harder difficulties add extra traps.
const L2D = [
  { name: 'اولین قدم', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 14, 3);
      L.block('drop', 14, 15, 4, 3);
      L.block(null, 18, 15, 14, 3);
      L.door(29, 13);
      L.trig(12.6, 14, 0.8, 1, () => { L.fall('drop', 0.05); L.sfx('rumble'); }, { ground: true });
      if (L.d >= 2) L.trig(14, 14, 4, 1, () => { L.fall('drop', 0.05); L.sfx('rumble'); }, { ground: true });
  }},
  { name: 'خارهای پنهان', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 32, 3);
      L.spikes(null, 9, 14, 2, 'up');
      L.spikes('h1', 14, 14, 2, 'up', { hidden: true });
      L.trig(9, 8, 2, 6, () => L.pop('h1'));
      L.spikes('h2', 22, 14, 2, 'up', { hidden: true });
      L.trig(20.7, 13.5, 0.5, 1.5, () => L.pop('h2'), { ground: true });
      if (L.d >= 3) { L.spikes('h3', 27, 14, 1, 'up', { hidden: true }); L.trig(25.8, 13.5, 0.5, 1.5, () => L.pop('h3'), { ground: true }); }
      L.door(29, 13);
  }},
  { name: 'در فراری', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 32, 3);
      L.block('st1', 8, 13, 2, 2);
      L.block('st2', 4, 11, 2, 0.6, L.d >= 2 ? { crumble: 0.6 } : {});
      L.block(null, 0, 9, 3, 0.6);
      L.door(27, 13);
      L.trig(23.5, 13, 1, 2, () => { L.move('door', 0, -6, 34); L.move('door', -26.2, 0, 34); L.sfx('whoosh'); L.say('اونجا نه، اینجا!'); }, { ground: true });
      L.trig(4, 10, 2, 1, () => L.fall('st1', 0.25), { ground: true });
  }},
  { name: 'سقف سنگین', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 13, 3);
      L.spikes(null, 13, 17, 4, 'up');
      L.block(null, 13, 18, 4, 1);
      L.block(null, 17, 15, 15, 3);
      L.block('crush', 13, 1, 4, 3, { fallV: 260 });
      L.spikes(null, 13, 4, 4, 'down', { parent: 'crush' });
      L.trig(12.4, 0, 4.8, 15, () => { L.fall('crush', 0.15); L.sfx('rumble'); });
      L.door(29, 13);
      L.trig(24, 13, 1, 2, () => { L.move('door', 0, 2.1, 9); L.move('door', 0, -2.1, 5, 0.8); L.say('قایم‌موشک!'); }, { ground: true });
  }},
  { name: 'پل لرزان', spawn: [1, 14], build(L) {
      L.block(null, 0, 15, 9, 3);
      L.spikes(null, 9, 17, 17, 'up');
      L.block('p1', 11, 14, 3, 0.5, { crumble: 0.5 });
      L.block('p2', 16, 14, 3, 0.5);
      L.block('p3', 21, 14, 3, 0.5, { crumble: 0.5 });
      L.block(null, 26, 15, 6, 3);
      L.saw('saw', 20, 19.5, 0.9);
      L.trig(16, 13, 3, 1, () => { L.move('saw', 0, -6, 15); L.move('saw', 0, 6, 6, 1.1); }, { ground: true });
      L.door(29, 13);
  }},
  { name: 'فنر قلابی', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 10, 3);
      L.block('tf', 10, 15, 3, 3, { fallV: 320 });
      L.spring('s1', 11, 14, { parent: 'tf' });
      L.block(null, 13, 15, 19, 3);
      L.spring('s2', 17, 14);
      L.block(null, 21, 6, 11, 1);
      L.door(28.5, 4);
      L.trig(9.3, 13, 0.7, 2, () => { L.fall('tf', 0); L.say('فنر؟ کدوم فنر؟'); }, { ground: true });
  }},
  { name: 'دیوار تعقیب', spawn: [3, 14], build(L) {
      L.block(null, 0, 15, 10, 3);
      L.spikes(null, 10, 17, 2, 'up');
      L.block(null, 12, 15, 6, 3);
      L.spikes(null, 15, 14, 1, 'up');
      L.block('cr', 18, 15, 4, 3, { crumble: 0.1 });
      L.block(null, 22, 15, 10, 3);
      L.block('wall', -7, 0, 6, 15);
      L.spikes(null, -1, 0, 15, 'right', { parent: 'wall' });
      L.trig(5, 12, 1, 3, () => { L.move('wall', 27, 0, 5.2, 0.35); L.sfx('rumble'); L.shake(6); L.say('فرار کن!'); });
      L.door(29, 13);
  }},
  { name: 'وارونه', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 10, 3);
      L.spikes(null, 10, 17, 22, 'up');
      L.block(null, 7, 0, 25, 3);
      L.orb('o1', 8.6, 14.4);
      L.spikes(null, 16, 3, 2, 'down');
      L.orb('trap', 18.6, 6.4);
      L.door(28.5, 3, { flip: true });
  }},
  { name: 'تاریکی', dark: true, spawn: [1, 14], build(L) {
      L.block(null, 0, 15, 7, 3);
      L.spikes(null, 7, 17, 19, 'up');
      L.block(null, 9, 14, 3, 4);
      L.block(null, 14, 13, 3, 5);
      L.saw('sw', 19, 11, 0.8, { patrol: [[19, 10.5], [19, 15.4]], speed: 3.2 });
      L.block(null, 21, 14, 4, 4);
      L.spikes('hs', 23, 13, 1, 'up', { hidden: true });
      L.trig(21, 13, 4, 1, () => L.pop('hs'), { ground: true });
      L.block(null, 26, 15, 6, 3);
      L.door(29, 13);
  }},
  { name: 'سنگ پوک', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 9, 3);
      L.spikes(null, 9, 17, 7, 'up');
      L.block(null, 9, 15, 7, 3, { ghost: true });
      L.block(null, 11, 12.5, 3, 0.6);
      if (L.d >= 2) { L.block(null, 16, 15, 11, 3); L.spikes(null, 27, 17, 2, 'up'); L.block(null, 27, 15, 2, 3, { ghost: true }); L.block(null, 29, 15, 3, 3); }
      else L.block(null, 16, 15, 16, 3);
      L.spikes(null, 23, 14, 1, 'up');
      L.block('bump', 22, 11.5, 2, 1, { hidden: true });
      L.trig(21.5, 12.5, 2.5, 1, () => { L.pop('bump'); L.say('بوم!'); }, { rising: true });
      L.door(30, 13);
  }},
  { name: 'مسیر برعکس', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 12, 3);
      L.spikes(null, 12, 17, 3, 'up');
      L.block(null, 15, 15, 7, 3);
      L.spikes(null, 17, 14, 1, 'up');
      L.spikes(null, 22, 17, 2, 'up');
      L.block(null, 24, 15, 8, 3);
      L.trig(15.6, 2, 0.5, 13, () => { L.reverse(true); L.say('کنترل‌ها برعکس شد!'); });
      L.trig(25, 2, 0.5, 13, () => L.reverse(false));
      if (L.d >= 3) L.trig(27.4, 2, 0.5, 13, () => { L.reverse(true); L.say('باز هم برعکس!'); });
      L.door(29.5, 13);
  }},
  { name: 'باران خار', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 32, 3);
      L.block(null, 0, 0, 32, 2, { ceil: true });
      [[9, 2], [14, 1], [19, 2], [24, 1], [27, 2]].forEach(([c, n], i) => L.spikes('g' + i, c, 2, n, 'down'));
      [5, 10, 15, 20].forEach((k, i) => L.trig(k, 2, 0.5, 13, () => { L.fall('g' + i, 0.1); L.sfx('crack'); }));
      if (L.d >= 3) L.trig(26.6, 2, 0.5, 13, () => L.fall('g4', 0.1));
      L.door(29.5, 13);
  }},
  { name: 'آسانسور', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 6, 3);
      L.spikes(null, 6, 17, 19, 'up');
      L.block('E', 7, 14, 3, 0.6, { patrol: [[7, 14], [14, 14]], speed: 2.6 });
      L.block('V', 18, 14, 3, 0.6, { patrol: [[18, 14], [18, 8.6]], speed: 1.8 });
      L.block(null, 22, 10, 3, 0.6, { ghost: true });
      L.block(null, 25, 10, 7, 8);
      if (L.d >= 3) L.saw('s', 11, 10.3, 0.7, { patrol: [[9, 10.3], [15, 10.3]], speed: 3 });
      L.door(29, 8);
  }},
  { name: 'در خجالتی', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 32, 3);
      L.block(null, 8, 12.5, 2, 0.6);
      L.block(null, 12, 10.5, 7, 0.6);
      L.spikes('sp', 22, 14, 2, 'up', { hidden: true });
      L.door(28, 13);
      L.trig(25, 12, 1, 3, () => {
        L.move('door', 0, -6, 30); L.move('door', -25, 0, 30); L.move('door', 0, 6, 30); L.say('اینجام!'); L.sfx('whoosh');
        L.trig(4.5, 12, 1.2, 3, () => {
          L.move('door', 0, -6, 30); L.move('door', 13, 0, 30); L.move('door', 0, 1.5, 30); L.say('نه، اینجا!'); L.sfx('whoosh');
          L.trig(12, 9.5, 2.5, 1, () => {
            L.move('door', 10, 0, 30); L.move('door', 0, 4.5, 30); L.say('بیا بگیرم!'); L.sfx('whoosh');
            L.trig(20.4, 13.5, 0.6, 1.5, () => L.pop('sp'), { ground: true });
          }, { ground: true });
        }, { ground: true });
      }, { ground: true });
  }},
  { name: 'سقف پایین‌رو', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 32, 3);
      L.block('lid', 0, -8, 32, 11, { ceil: true });
      L.saw('s1', 9, 14.35, 0.65, { patrol: [[8, 14.35], [14, 14.35]], speed: 3 });
      L.saw('s2', 18, 14.35, 0.65, { patrol: [[17, 14.35], [24, 14.35]], speed: 4 });
      L.spikes('sp', 27, 14, 1, 'up', { hidden: true });
      L.trig(4, 0, 0.5, 15, () => { L.move('lid', 0, 9.3, 1.5); L.sfx('rumble'); L.shake(5); L.say('سقف داره میاد پایین!'); });
      L.trig(25.4, 13.5, 0.6, 1.5, () => L.pop('sp'), { ground: true });
      L.door(29.5, 13);
  }},
  { name: 'آخرین شوخی', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 32, 3);
      L.spikes('a', 10, 14, 2, 'up', { hidden: true });
      L.trig(8.4, 13.5, 0.6, 1.5, () => L.pop('a'), { ground: true });
      L.door(28, 13);
      L.block('mp', 12, 8.5, 5, 0.6, { hidden: true });
      L.block('st2', 18, 10.5, 2, 0.6, { hidden: true });
      L.block('st1', 21, 12.5, 2, 0.6, { hidden: true });
      L.spikes('ms', 13.3, 7.5, 2, 'up', { hidden: true });
      L.saw('sweep', -3, 14.1, 0.9);
      L.trig(24, 13, 1, 2, () => {
        L.move('door', 0, -6.5, 30); L.move('door', -16.1, 0, 30);
        L.pop('st1', 0.25); L.pop('st2', 0.4); L.pop('mp', 0.55); L.say('بیا بالا اگه جرئت داری');
      }, { ground: true });
      L.trig(18, 9.5, 2, 1, () => { L.move('sweep', 40, 0, 10); L.sfx('saw'); }, { ground: true });
      L.trig(15.9, 7.5, 1.1, 1, () => L.pop('ms'), { ground: true });
  }},
];


/* ---------- new 2D levels ---------- */
const NEW2D = [
  { name: 'پله‌های دروغین', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 32, 3);
      L.spikes(null, 11, 14, 11, 'up');
      L.block(null, 6, 13, 2, 2);
      L.block(null, 9, 11, 2, 0.6);
      L.block(null, 12, 9, 2, 0.6, { ghost: true });
      L.block(null, 14, 9, 2, 0.6);
      L.block('e', 18, 7, 2, 0.6, { crumble: 0.4 });
      L.block(null, 22, 5, 10, 13);
      L.spikes('sp', 25, 4, 1, 'up', { hidden: true });
      L.trig(22, 3.5, 2.2, 1.5, () => L.pop('sp'), { ground: true });
      if (L.d >= 3) { L.spikes('sp2', 27.5, 4, 1, 'up', { hidden: true }); L.trig(26.2, 3.5, 0.6, 1.5, () => L.pop('sp2'), { ground: true }); }
      L.door(29.5, 3);
  }},
  { name: 'اره‌های رقصان', spawn: [1, 14], build(L) {
      L.block(null, 0, 15, 32, 3);
      L.saw('s1', 8, 14.35, 0.65, { patrol: [[7, 14.35], [12.5, 14.35]], speed: 3 });
      L.block(null, 9, 12.5, 3, 0.6);
      L.saw('s2', 15, 14.35, 0.65, { patrol: [[14, 14.35], [20, 14.35]], speed: 4.5 });
      L.block('p2', 16, 12.5, 3, 0.6, L.d >= 2 ? { crumble: 0.9 } : {});
      L.saw('s3', 24, 10, 0.65, { patrol: [[24, 10], [24, 14.35]], speed: 3 });
      L.door(29, 13);
  }},
  { name: 'جاذبه دوبل', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 7, 3);
      L.spikes(null, 7, 17, 25, 'up');
      L.block(null, 5, 0, 27, 3);
      L.orb('o1', 6.4, 14.4);
      L.spikes(null, 13, 3, 2, 'down');
      L.orb('o2', 17.5, 3.4);
      L.block(null, 16, 12, 6, 0.6);
      L.orb('o3', 22.6, 11.4);
      L.spikes(null, 27, 3, 2, 'down');
      L.door(30, 3, { flip: true });
  }},
  { name: 'زمین‌لرزه', spawn: [5, 14], build(L) {
      const ch = [[0, 4], [4, 4], [8, 4], [12, 4], [16, 2], [20, 4], [24, 4]];
      L.spikes(null, 0, 17, 28, 'up');
      ch.forEach(([c, w], i) => L.block('c' + i, c, 15, w, 3));
      L.block(null, 28, 15, 4, 3);
      L.spikes(null, 13, 14, 1, 'up');
      L.spikes(null, 23, 14, 1, 'up');
      L.trig(6, 10, 0.5, 5, () => { L.sfx('rumble'); L.shake(8); L.say('زلزله! بدو!'); ch.forEach((_, i) => L.at(0.3 + 0.62 * i, () => { L.fall('c' + i, 0.08); L.shake(4); })); });
      L.door(29.5, 13);
  }},
  { name: 'دو در', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 25, 3);
      L.spikes('fd', 13.5, 14, 2, 'up', { hidden: true });
      L.add('fake', { type: 'door', x: 14 * T, y: 13 * T, w: 1.4 * T, h: 2 * T, fake: 'fd' });
      L.spring('sp', 21, 14);
      L.block(null, 25, 9, 7, 9);
      if (L.d >= 2) { L.spikes('hs', 19, 14, 1, 'up', { hidden: true }); L.trig(17.6, 13.5, 0.6, 1.5, () => L.pop('hs'), { ground: true }); }
      L.door(29, 7);
  }},
  { name: 'آسانسور اره', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 5, 3);
      L.spikes(null, 5, 17, 9, 'up');
      L.block('V', 6, 14, 3, 0.6, { patrol: [[6, 14], [6, 5]], speed: 2.2 });
      L.block('lip', 12, 5, 2, 0.6, { crumble: 0.15 });
      L.block(null, 14, 5, 18, 13);
      L.saw('s', 17, 4.35, 0.65, { patrol: [[16, 4.35], [25, 4.35]], speed: 3.2 });
      L.door(29, 3);
  }},
  { name: 'فنرهای تاریک', dark: true, spawn: [1, 14], build(L) {
      L.block(null, 0, 15, 7, 3);
      L.spikes(null, 7, 17, 21, 'up');
      L.spring(null, 5, 14);
      L.block(null, 9, 6, 5, 0.6);
      L.block(null, 16, 8, 4, 0.6);
      L.spikes('h', 19, 7, 1, 'up', { hidden: true });
      L.trig(16, 6.5, 2, 1.5, () => L.pop('h'), { ground: true });
      L.block(null, 22, 11, 4, 0.6);
      L.block(null, 28, 15, 4, 3);
      L.door(30.2, 13);
  }},
  { name: 'تعقیب برعکس', spawn: [3, 14], build(L) {
      L.block(null, 0, 15, 11, 3);
      L.spikes(null, 11, 17, 2, 'up');
      L.block(null, 13, 15, 9, 3);
      L.spikes(null, 17, 14, 1, 'up');
      L.spikes(null, 22, 17, 2, 'up');
      L.block(null, 24, 15, 8, 3);
      L.block('wall', -7, 0, 6, 15);
      L.spikes(null, -1, 0, 15, 'right', { parent: 'wall' });
      L.trig(5, 2, 0.5, 13, () => { L.reverse(true); L.move('wall', 27, 0, 4.4, 0.6); L.sfx('rumble'); L.shake(6); L.say('برعکس بدو!'); });
      if (L.d >= 3) L.trig(19, 2, 0.5, 13, () => { L.reverse(false); L.say('دوباره عادی!'); });
      L.door(29, 13);
  }},
];

/* ---------- 3D chase levels ---------- */
const ALL3D = ['bar', 'wall', 'gap', 'mover', 'spikes', 'roller'];
const L3D = [
  { kind: '3d', name: 'فرار از غول', theme: 'dusk', len: 2200, giants: 1, speed: 14, gap: 24, types: [], noObst: true, zig: 0.55, seed: 1 },
  { kind: '3d', name: 'جنگل غول', theme: 'forest', len: 3000, giants: 1, speed: 15, gap: 22, gs: 0.965, types: ['bar', 'wall', 'gap'], dens: 0.65, seed: 2 },
  { kind: '3d', name: 'بیابان لرزان', theme: 'desert', len: 3400, giants: 2, speed: 16, gap: 22, gs: 0.97, types: ['bar', 'wall', 'gap', 'mover'], dens: 0.75, seed: 3 },
  { kind: '3d', name: 'کوه یخی', theme: 'snow', len: 3800, giants: 3, speed: 16.5, gap: 21, gs: 0.972, types: ['bar', 'wall', 'gap', 'mover', 'spikes'], dens: 0.85, zig: 0.12, seed: 4 },
  { kind: '3d', name: 'رود آتش', theme: 'lava', len: 4200, giants: 5, speed: 17, gap: 21, gs: 0.975, types: ALL3D, dens: 0.9, zig: 0.1, seed: 5 },
  { kind: '3d', name: 'شب بی‌پایان', theme: 'night', len: 4800, giants: 8, speed: 17.5, gap: 20, gs: 0.978, types: ALL3D, dens: 1, zig: 0.12, seed: 6 },
  { kind: '3d', name: 'طوفان سنگی', theme: 'storm', len: 5400, giants: 12, speed: 18, gap: 20, gs: 0.98, types: ALL3D, dens: 1.1, zig: 0.12, seed: 7 },
  { kind: '3d', name: 'لشکر غول‌ها', theme: 'ash', len: 6200, giants: 20, speed: 18.5, gap: 20, gs: 0.982, types: ALL3D, dens: 1.2, zig: 0.14, seed: 8 },
  { kind: '3d', name: 'آخرالزمان: ۴۵ غول', theme: 'doom', len: 9000, giants: 45, speed: 19.5, gap: 19, gs: 0.985, types: ALL3D, dens: 1.85, zig: 0.14, seed: 9 },
];

/* ---------- 7 more hand-made levels (replace the old mirrored copies) ---------- */
const MORE2D = [
  { name: 'یخبندان', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 6, 3);
      L.block(null, 6, 15, 7, 3, { ice: true });
      L.spikes(null, 13, 17, 3, 'up');
      L.block(null, 16, 15, 6, 3, { ice: true });
      L.spikes(null, 20, 14, 1, 'up');
      L.spikes(null, 22, 17, 2, 'up');
      L.block(null, 24, 15, 8, 3, { ice: true });
      L.spikes('hs', 27, 14, 1, 'up', { hidden: true });
      L.trig(24, 13.5, 1.2, 1.5, () => L.pop('hs'), { ground: true });
      if (L.d >= 3) L.saw('s', 18, 12, 0.6, { patrol: [[17, 12], [19.5, 12]], speed: 2 });
      L.door(29.5, 13);
  }},
  { name: 'نوار نقاله', spawn: [1, 14], build(L) {
      L.block(null, 0, 15, 4, 3);
      L.block(null, 4, 15, 9, 3, { conv: -3 });
      L.spikes(null, 9, 14, 1, 'up');
      L.spikes(null, 13, 17, 2, 'up');
      L.block(null, 15, 15, 7, 3, { conv: 4.5 });
      L.spikes(null, 22, 17, 2, 'up');
      L.block(null, 24, 15, 8, 3);
      L.saw('s', 26, 14.35, 0.6, { patrol: [[25, 14.35], [28.5, 14.35]], speed: 3.5 });
      L.spikes('hs', 19, 14, 1, 'up', { hidden: true });
      L.trig(15.4, 13.5, 1.5, 1.5, () => L.pop('hs'), { ground: true });
      L.door(30, 13);
  }},
  { name: 'سقف‌های فروریز', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 32, 3);
      L.block(null, 0, 0, 32, 1.5, { ceil: true });
      [[7, 'c0'], [13, 'c1'], [19, 'c2'], [25, 'c3']].forEach(([c, id], i) => {
        L.block(id, c, 1.5, 2, 2, { fallV: 120 });
        L.spikes(null, c, 3.5, 2, 'down', { parent: id });
        L.trig(c - 2.2, 2, 0.5, 13, () => { L.fall(id, 0.25); L.sfx('rumble'); });
      });
      L.door(29.5, 13);
  }},
  { name: 'اره‌های مداری', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 6, 3);
      L.spikes(null, 6, 17, 21, 'up');
      L.block(null, 8, 13, 3, 0.6);
      L.block(null, 13, 11, 3, 0.6);
      L.block(null, 18, 12, 3, 0.6);
      L.block(null, 23, 13, 3, 0.6);
      L.block(null, 27, 15, 5, 3);
      L.saw('o1', 11.8, 12, 0.55, { orbit: { rad: 1.7, w: 2.1, ph: 0 } });
      L.saw('o2', 17, 9.5, 0.6, { orbit: { rad: 2.2, w: -1.7, ph: 1.5 } });
      L.saw('o3', 22, 11, 0.55, { orbit: { rad: 2, w: 2.3, ph: 3 } });
      if (L.d >= 2) L.saw('o4', 26.5, 12, 0.5, { orbit: { rad: 1.6, w: -2.6, ph: 0.5 } });
      L.door(29.5, 13);
  }},
  { name: 'بالابرها', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 32, 3);
      L.spikes(null, 6, 14, 20, 'up');
      L.block('m1', 6, 12, 3, 0.6, { patrol: [[6, 12], [11, 12]], speed: 2.2 });
      L.block('m2', 13, 9, 3, 0.6, { patrol: [[13, 9], [18, 9]], speed: 2.4 });
      L.block('m3', 20, 6.5, 3, 0.6, { patrol: [[20, 6.5], [24, 6.5]], speed: 2.6 });
      L.block(null, 27, 5, 5, 0.6);
      L.saw('s', 19, 3.5, 0.55, { patrol: [[16, 3.5], [24, 3.5]], speed: 3 });
      L.door(29.5, 3);
  }},
  { name: 'پرتال مخفی', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 32, 3);
      L.spring('sp', 10, 14);
      L.block('ledge', 13, 5, 5, 0.6, { crumble: 0.9 });
      L.portal('portal', 14.8, 3);
      L.openPortal('portal', 1.6);
      L.spikes(null, 16, 14, 1, 'up');
      L.spikes('h1', 21, 14, 2, 'up', { hidden: true });
      L.trig(19.6, 13.5, 0.6, 1.5, () => L.pop('h1'), { ground: true });
      L.block('drop', 25, 15, 3, 3);
      L.trig(24.2, 14, 0.6, 1, () => L.fall('drop', 0.05), { ground: true });
      L.door(29.5, 13);
  }},
  { name: 'گدازه‌ی بالارونده', spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 7, 3);
      L.block(null, 9, 13, 4, 0.6);
      L.block(null, 15, 11, 4, 0.6);
      L.block(null, 21, 9, 4, 0.6);
      L.block(null, 26, 7, 4, 0.6, { crumble: 1.2 });
      L.block(null, 19, 5, 4, 0.6);
      L.block(null, 11, 3.5, 5, 0.6);
      L.block('lava', 0, 18.6, 32, 12, { lava: true, ghost: true });
      L.at(1.2, () => { L.move('lava', 0, -12.3, 0.95); L.say('گدازه داره بالا میاد!'); L.sfx('rumble'); L.shake(5); });
      L.door(12.2, 1.5);
  }},
];

/* ---------- hidden realm: reached through the portal in level 37. Double jump, lasers, harder everything ---------- */
const REALM = [
  { name: 'دروازه‌ی بی‌نهایت', realm: true, dj: true, spawn: [1, 14], build(L) {
      L.block(null, 0, 15, 4, 3);
      L.spikes(null, 4, 17, 24, 'up');
      L.block('m1', 5, 13, 2, 0.6, { patrol: [[5, 13], [9, 13]], speed: 2.4 });
      L.laser('l1', 11.5, 4, 11, 'v', { on: 1.0, off: 1.3 });
      L.block('m2', 13, 13, 2, 0.6, { patrol: [[13, 13], [13, 8.5]], speed: 2.2 });
      L.laser('l2', 16, 10, 6, 'h', { on: 0.9, off: 1.2, ph: 0.6 });
      L.block('m3', 17, 12.5, 2, 0.6, { patrol: [[17, 12.5], [22, 12.5]], speed: 2.8 });
      L.saw('o', 25, 11, 0.55, { orbit: { rad: 1.8, w: 2.4, ph: 1 } });
      L.block(null, 28, 15, 4, 3);
      L.door(29.8, 13);
  }},
  { name: 'برج لیزر', realm: true, dj: true, spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 32, 3);
      L.spikes(null, 7, 14, 18, 'up');
      L.block(null, 8, 12, 3, 0.6, { crumble: 0.7 });
      L.laser('l1', 6, 10, 9, 'h', { on: 1.0, off: 1.5 });
      L.block(null, 14, 9.5, 3, 0.6);
      L.laser('l2', 18.5, 3, 9, 'v', { on: 0.9, off: 1.4, ph: 0.7 });
      L.block(null, 20, 8, 3, 0.6, { crumble: 0.7 });
      L.block('m', 24, 6, 3, 0.6, { patrol: [[24, 6], [24, 10]], speed: 2.2 });
      L.laser('l3', 13, 5, 10, 'h', { on: 1.0, off: 1.4, ph: 1.2 });
      L.block(null, 27, 4, 5, 0.6);
      L.saw('s', 29, 2.6, 0.5, { patrol: [[28, 2.6], [31, 2.6]], speed: 2 });
      L.door(30.2, 2);
  }},
  { name: 'قلب آشوب', realm: true, dj: true, dark: true, spawn: [2, 14], build(L) {
      L.block(null, 0, 15, 8, 3, { ice: true });
      L.spikes(null, 8, 17, 24, 'up');
      L.block(null, 5, 0, 27, 2.5);
      L.orb('o1', 7.4, 14.2);
      L.spikes(null, 12, 2.5, 2, 'down');
      L.laser('l1', 15.5, 2.6, 6, 'v', { on: 0.8, off: 1.3 });
      L.orb('o2', 19, 3.1);
      L.block(null, 18, 11, 6, 0.6, { conv: 3 });
      L.saw('s', 21, 9.6, 0.5, { patrol: [[18.6, 9.6], [23.4, 9.6]], speed: 2.2 });
      L.trig(18, 9.5, 6, 1.5, () => L.reverse(true), { ground: true });
      L.block(null, 27, 15, 5, 3);
      L.door(29.5, 13);
  }},
];

/* ---------- final order: 40 levels ---------- */
const LEVELS = [
  L2D[0], L3D[0], L2D[1], L2D[2], L3D[1], L2D[3], L2D[4], L2D[5], L2D[6], L3D[2],
  L2D[7], L2D[8], L2D[9], L2D[10], L3D[3], L2D[11], L2D[12], L2D[13], L2D[14], L3D[4],
  NEW2D[0], NEW2D[1], NEW2D[2], NEW2D[3], L3D[5], NEW2D[4], NEW2D[5], NEW2D[6], NEW2D[7], L3D[6],
  MORE2D[0], MORE2D[1], MORE2D[2], MORE2D[3], L3D[7], MORE2D[4], MORE2D[5], MORE2D[6], L2D[15], L3D[8],
];
const PORTAL_LEVEL = 36; // level 37 holds the secret portal
