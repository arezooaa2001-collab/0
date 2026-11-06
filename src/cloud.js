/* Ladino — private cloud: projects, exports and the AI library live inside the app (artifact db + assets) */
(function () {
  const L = window.L, S = L.state, A = L.api;
  const $ = (s) => document.querySelector(s);
  const fa = L.fa;
  const MAX = 20 * 1048576;
  let db = null, user = null, assets = null, me = null, base = '';
  let projects = [], exportsList = [], ready = false, saving = false;

  function stat(kind, text) { const el = $('#cloudStat'); el.querySelector('.dot').className = 'dot ' + kind; el.querySelector('span').textContent = text; }
  function note(text, kind) { const n = $('#cloudNote'); n.textContent = text; n.className = 'note' + (kind ? ' ' + kind : ''); }
  const when = (ms) => { if (!ms) return ''; const d = new Date(ms); try { return d.toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return d.toLocaleString(); } };
  const mb = (b) => `${fa((b / 1048576).toFixed(1))} مگابایت`;
  const isCloudVideo = (blob) => /^video\/(mp4|webm)$/.test(blob.type || '') && blob.size <= MAX;
  const errText = (e) => ({ too_large: 'فایل بزرگ‌تر از ۲۰ مگابایت است.', unsupported_type: 'فقط ویدیوی MP4 یا WebM در ابر جا می‌شود.', quota_or_state: 'فضای ابری پر شده؛ چند خروجی یا پروژه قدیمی را پاک کن.', rate_limited: 'خیلی سریع شد؛ چند لحظه بعد دوباره بزن.', permission_denied: 'اجازه نوشتن در ابر نداری.' }[e && e.code] || 'ارتباط با ابر برقرار نشد؛ دوباره امتحان کن.');

  async function usage() {
    if (!assets) { $('#cloudUsage').textContent = 'ذخیره ویدیو در ابر فقط برای صاحب و ویرایشگرهای این برنامه فعال است.'; return; }
    try {
      const { usage: u } = await assets.list();
      $('#cloudMeter').style.width = Math.min(100, (u.bytes / u.maxBytes) * 100) + '%';
      $('#cloudUsage').textContent = `${mb(u.bytes)} از ${mb(u.maxBytes)} · ${fa(u.files)} فایل`;
    } catch (e) { /* meter is optional */ }
  }

  function renderProjects() {
    const box = $('#projList');
    if (!ready) return;
    if (!projects.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'هنوز پروژه‌ای ذخیره نکرده‌ای. دکمه «ذخیره» بالا را بزن.'; box.replaceChildren(p); return; }
    box.replaceChildren(...projects.map((p) => {
      const row = document.createElement('div'); row.className = 'proj';
      const info = document.createElement('div');
      const b = document.createElement('b'); b.textContent = p.name || 'بدون نام';
      const sm = document.createElement('small'); sm.textContent = `${when(p.updatedAt)} · ${p.videoAssetId ? '🎬 ' + mb(p.videoSize || 0) : 'بدون ویدیو'} · ${fa(p.texts || 0)} متن · ${fa(p.fx || 0)} جلوه`;
      info.append(b, sm);
      const acts = document.createElement('div'); acts.className = 'row';
      const open = document.createElement('button'); open.className = 'btn sm'; open.textContent = 'باز کن'; open.onclick = () => openProject(p, open);
      const del = document.createElement('button'); del.className = 'btn sm danger'; del.textContent = '🗑';
      del.onclick = () => {
        if (del.dataset.sure) { deleteProject(p); return; }
        del.dataset.sure = '1'; del.textContent = 'حذف شود؟'; setTimeout(() => { delete del.dataset.sure; del.textContent = '🗑'; }, 3000);
      };
      acts.append(open, del);
      row.append(info, acts);
      return row;
    }));
  }
  function renderExports() {
    const box = $('#expList');
    if (!ready) return;
    if (!exportsList.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'بعد از ساخت خروجی، دکمه «ذخیره در ابر» را بزن تا اینجا بماند.'; box.replaceChildren(p); return; }
    box.replaceChildren(...exportsList.map((x) => {
      const row = document.createElement('div'); row.className = 'proj';
      const info = document.createElement('div');
      const b = document.createElement('b'); b.textContent = x.name; const sm = document.createElement('small'); sm.textContent = `${when(x.createdAt)} · ${mb(x.size || 0)}`;
      info.append(b, sm);
      const acts = document.createElement('div'); acts.className = 'row';
      const watch = document.createElement('button'); watch.className = 'btn sm'; watch.textContent = '▶ ببین';
      const dl = document.createElement('button'); dl.className = 'btn sm'; dl.textContent = '⬇';
      const del = document.createElement('button'); del.className = 'btn sm danger'; del.textContent = '🗑';
      watch.onclick = () => {
        if (row.querySelector('video')) { row.querySelector('video').remove(); return; }
        const v = document.createElement('video'); v.controls = true; v.playsInline = true; v.preload = 'metadata'; v.src = '/_blob/' + x.assetId; row.append(v); v.play().catch(() => {});
      };
      dl.onclick = async () => {
        const d = await window.claude.use('downloads').catch(() => null);
        if (!d) { L.toast('دانلود در این نما ممکن نیست'); return; }
        try { const blob = await (await fetch('/_blob/' + x.assetId)).blob(); await d.save({ filename: x.name, data: blob }); } catch (e) { L.toast(e && e.code === 'declined' ? 'دانلود لغو شد' : 'دانلود انجام نشد'); }
      };
      del.onclick = async () => {
        if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'حذف شود؟'; setTimeout(() => { delete del.dataset.sure; del.textContent = '🗑'; }, 3000); return; }
        try { await db.collection(base + '/exports').doc(x.id).delete(); if (assets) await assets.delete(x.assetId).catch(() => {}); L.toast('خروجی پاک شد'); usage(); } catch (e) { L.toast(errText(e)); }
      };
      acts.append(watch, dl, del);
      row.append(info, acts);
      return row;
    }));
  }

  async function save() {
    if (!ready) { L.go('cloud'); L.toast('فضای ابری هنوز وصل نیست'); return; }
    if (saving) return;
    saving = true;
    const btns = [$('#cloudSave'), $('#quickSave')];
    btns.forEach((b) => (b.disabled = true));
    const name = ($('#projName').value || 'پروژه من').trim().slice(0, 80);
    try {
      let warn = '';
      if (S.hasVideo && !S.video.assetId && S.video.file) {
        if (assets && isCloudVideo(S.video.file)) {
          note('در حال بردن ویدیو به ابر…');
          const r = await assets.upload(S.video.file, { type: S.video.file.type });
          S.video.assetId = r.id;
        } else warn = assets ? 'ویدیو بیشتر از ۲۰ مگابایت است یا MP4/WebM نیست؛ فقط تنظیمات پروژه ذخیره شد. می‌توانی خروجی سبک بگیری و آن را در ابر بگذاری.' : 'ذخیره ویدیو برای این حساب فعال نیست؛ فقط تنظیمات ذخیره شد.';
      }
      const state = A.serialize();
      state.noise = S.audio.segments.filter((s) => s.removed).map((s) => ({ type: s.type, start: s.start, end: s.end, conf: s.conf, previewAt: s.previewAt }));
      const body = JSON.stringify(state);
      if (body.length > 240000) throw { code: 'too_large_doc' };
      const id = S.projectId || 'p' + Date.now().toString(36);
      await db.collection(base + '/projects').doc(id).set({
        name, updatedAt: Date.now(), state: body,
        videoAssetId: S.video.assetId || null, videoName: S.video.name || '', videoSize: S.video.size || 0, duration: L.src.dur || 0,
        texts: S.texts.length, fx: S.effects.length,
      });
      S.projectId = id;
      note(warn || `«${name}» در فضای ابری ذخیره شد ✅`, warn ? 'warn' : 'good');
      L.toast('ذخیره شد ☁️');
      usage();
    } catch (e) {
      note(e && e.code === 'too_large_doc' ? 'پروژه خیلی بزرگ است؛ تعداد متن‌ها یا جلوه‌های ساخته‌شده را کمتر کن.' : errText(e), 'bad');
      L.toast('ذخیره نشد');
    } finally { saving = false; btns.forEach((b) => (b.disabled = false)); }
  }

  async function openProject(p, btn) {
    btn.disabled = true; btn.textContent = '⏳';
    try {
      const state = JSON.parse(p.state || '{}');
      if (p.videoAssetId) {
        note('در حال آوردن ویدیو از ابر…');
        const res = await fetch('/_blob/' + p.videoAssetId);
        if (!res.ok) throw { code: 'missing' };
        const blob = await res.blob();
        const file = new File([blob], p.videoName || 'video.mp4', { type: blob.type || 'video/mp4' });
        S.trim = state.trim || S.trim;
        await L.loadFile(file, { assetId: p.videoAssetId, keepTrim: true });
      }
      A.restoreState(state);
      S.projectId = p.id;
      $('#projName').value = p.name || '';
      if (state.noise && state.noise.length) L.pendingNoise = state.noise;
      note(`«${p.name}» باز شد.` + (p.videoAssetId ? '' : ' این پروژه ویدیو در ابر ندارد؛ تنظیماتش روی ویدیوی فعلی نشست.'), p.videoAssetId ? 'good' : 'warn');
      L.go('media');
    } catch (e) {
      note(e && e.code === 'missing' ? 'ویدیوی این پروژه در ابر پیدا نشد.' : 'باز کردن پروژه ممکن نشد.', 'bad');
    } finally { btn.disabled = false; btn.textContent = 'باز کن'; }
  }

  async function deleteProject(p) {
    try {
      await db.collection(base + '/projects').doc(p.id).delete();
      const used = projects.some((q) => q.id !== p.id && q.videoAssetId === p.videoAssetId);
      if (p.videoAssetId && assets && !used) await assets.delete(p.videoAssetId).catch(() => {});
      if (S.projectId === p.id) S.projectId = null;
      L.toast('پروژه پاک شد'); usage();
    } catch (e) { L.toast(errText(e)); }
  }

  async function saveExport(exp) {
    if (!ready || !assets) { L.toast('ذخیره ویدیو در ابر برای این حساب فعال نیست'); return; }
    if (exp.blob.size > MAX) { L.toast('خروجی بیشتر از ۲۰ مگابایت است؛ با کیفیت سبک‌تر دوباره بساز', 4500); $('#expCloud').disabled = false; return; }
    try {
      $('#expText').textContent = 'در حال بردن به ابر…';
      const r = await assets.upload(exp.blob, { type: exp.type });
      await db.collection(base + '/exports').doc('e' + Date.now().toString(36)).set({ name: exp.name, assetId: r.id, size: r.sizeBytes, createdAt: Date.now() });
      $('#expText').textContent = 'در فضای ابری ذخیره شد ✅';
      L.toast('خروجی در ابر ذخیره شد ☁️'); usage();
    } catch (e) { $('#expText').textContent = errText(e); $('#expCloud').disabled = false; }
  }

  let libQueue = Promise.resolve();
  function saveLibraryItem(item) {
    if (!ready) return;
    libQueue = libQueue.then(() => db.collection(base + '/library').doc(item.id).set(JSON.parse(JSON.stringify(item)))).catch(() => {});
  }

  L.cloud = { save, saveExport, saveLibraryItem, canUpload: () => ready && !!assets };
  $('#cloudSave').onclick = save;
  $('#quickSave').onclick = () => { if (!ready) { L.go('cloud'); return; } save(); };

  // re-apply removed noise after a cloud project's audio has been decoded
  L.onAudioReady = async () => {
    const pend = L.pendingNoise; L.pendingNoise = null;
    if (!pend || !S.audio.buf) return;
    const segs = pend.map((s, i) => ({ ...s, id: 'r' + i, keep: true, removed: true }));
    const ctx = L.ensureAudio(); if (!ctx) return;
    S.audio.segments = segs;
    S.audio.cleaned = await L.cleanAudio(ctx, S.audio.buf, segs);
    L.syncClean(); L.updateBadges(); L.drawTimeline(); L.audioUI.note(`${fa(segs.length)} صدای مزاحمی که قبلاً حذف کرده بودی دوباره حذف شد.`, 'good');
  };

  (async () => {
    if (!window.claude || typeof window.claude.use !== 'function') {
      stat('off', 'ابر: داخل Claude باز کن');
      note('فضای ابری لادینو وقتی کار می‌کند که برنامه داخل Claude باز شده باشد.', 'warn');
      return;
    }
    [db, user, assets] = await Promise.all([window.claude.use('db'), window.claude.use('user'), window.claude.use('assets')]);
    if (!db || !user) { stat('off', 'ابر در دسترس نیست'); note('برای استفاده از فضای ابری باید وارد حساب Claude باشی.', 'warn'); return; }
    me = await user.id();
    if (!me) { stat('off', 'ابر: وارد شو'); note('برای استفاده از فضای ابری وارد حساب Claude شو.', 'warn'); return; }
    base = 'data/users/' + me;
    ready = true;
    stat('on', 'ابر وصل است');
    note(assets ? 'فضای ابری خصوصی تو وصل است. پروژه‌ها فقط برای خودت دیده می‌شوند.' : 'فضای ابری وصل است. ذخیره خود ویدیو فقط برای صاحب برنامه فعال است؛ تنظیمات پروژه ذخیره می‌شود.', 'good');
    let loaded = false;
    const timer = setTimeout(() => { if (!loaded) { ready = true; projects = []; renderProjects(); renderExports(); } }, 10000);
    db.collection(base + '/projects').onSnapshot((snap) => {
      loaded = true; clearTimeout(timer);
      projects = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      renderProjects();
    }, () => { note('خواندن پروژه‌ها از ابر ممکن نشد.', 'bad'); });
    db.collection(base + '/exports').onSnapshot((snap) => {
      exportsList = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      renderExports();
    }, () => {});
    try {
      const lib = await db.collection(base + '/library').get();
      L.lib.load(lib.docs.map((d) => d.data()));
      // push anything made before signing in
      const have = new Set(lib.docs.map((d) => d.id));
      L.lib.items().filter((it) => !have.has(it.id)).forEach(saveLibraryItem);
      A.renderFx();
    } catch (e) { /* library is optional */ }
    renderProjects(); renderExports(); usage();
  })();
})();
