/* Ladino — the "disturbing sounds" panel: detect → listen → confirm → remove */
(function () {
  const L = window.L, S = L.state;
  const $ = (s) => document.querySelector(s);
  const fa = L.fa;
  const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  let playingId = null, queue = null, lastTick = 0;

  function note(msg, kind) { const n = $('#nzNote'); n.textContent = msg; n.className = 'note' + (kind ? ' ' + kind : ''); n.hidden = false; }
  function redraw() { L.drawWave($('#nzWave'), S.audio.buf, S.audio.segments, S.audio.cleaned && !S.audio.compare ? S.audio.cleaned : null, L.src.time); }

  function render() {
    const list = $('#nzList');
    const segs = S.audio.segments;
    list.replaceChildren(...segs.map((s) => {
      const T = L.TYPES[s.type];
      const row = document.createElement('div');
      row.className = 'nz' + (playingId === s.id ? ' playing' : '') + (s.removed ? ' done' : '');
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = s.keep; cb.title = 'حذف شود';
      cb.style.accentColor = '#ff6b8b'; cb.onchange = () => { s.keep = cb.checked; updateButtons(); };
      const pb = document.createElement('button'); pb.className = 'btn icon'; pb.style.width = pb.style.height = '32px';
      pb.textContent = playingId === s.id ? '⏹' : '▶'; pb.title = s.removed ? 'شنیدن بعد از حذف' : 'شنیدن این صدا';
      pb.onclick = () => (playingId === s.id ? stop() : play(s));
      const meta = document.createElement('div'); meta.className = 'meta';
      const b = document.createElement('b'); b.textContent = `${T.icon} ${T.name}${s.removed ? ' · حذف شد ✓' : ''}`;
      const sm = document.createElement('small'); sm.textContent = s.type === 'floor' ? `کل ویدیو · ${T.how}` : `${fmt(s.start)} → ${fmt(s.end)} · ${T.how}`;
      meta.append(b, sm);
      const conf = document.createElement('span'); conf.className = 'conf'; conf.textContent = `${fa(s.conf)}٪`; conf.title = 'اطمینان هوش صوتی';
      row.append(cb, pb, meta, conf);
      return row;
    }));
    updateButtons();
    redraw();
    L.drawTimeline();
  }
  function updateButtons() {
    const segs = S.audio.segments;
    $('#nzActions').hidden = !segs.length;
    const pending = segs.filter((s) => s.keep && !s.removed).length;
    $('#nzConfirm').hidden = !segs.length;
    $('#nzConfirm').disabled = !pending;
    $('#nzConfirm').textContent = pending ? `✅ مطمئنم، ${fa(pending)} صدای تیک‌خورده را حذف کن` : '✅ همه صداهای انتخاب‌شده حذف شده‌اند';
    $('#nzAfter').hidden = !S.audio.cleaned;
    $('#nzCompare').textContent = S.audio.compare ? '🎧 شنیدن صدای تمیز' : '🔁 شنیدن صدای اصلی';
  }

  function clipRange(s) {
    if (s.type === 'floor') { const a = Math.max(0, (s.previewAt || 0) - 0.5); return [a, Math.min(3, S.audio.buf.duration - a)]; }
    const a = Math.max(0, s.start - 0.35);
    return [a, Math.min(S.audio.buf.duration - a, s.end - s.start + 0.7)];
  }
  function play(s, onEnd) {
    if (!S.audio.buf) return;
    const [a, d] = clipRange(s);
    playingId = s.id; render();
    const buf = s.removed && S.audio.cleaned ? S.audio.cleaned : S.audio.buf;
    L.playClip(buf, a, d, () => { playingId = null; render(); onEnd && onEnd(); });
  }
  function stop() { queue = null; L.stopClip(); playingId = null; render(); }

  $('#nzDetect').onclick = async () => {
    if (!S.hasVideo) { L.toast('اول ویدیوی خودت را آپلود کن'); L.go('media'); return; }
    if (S.audio.decoding) { note('صبر کن، صدای ویدیو هنوز در حال خواندن است…'); return; }
    if (!S.audio.buf) { note('صدای این ویدیو قابل خواندن نیست.', 'warn'); return; }
    stop();
    const btn = $('#nzDetect'); btn.disabled = true; btn.textContent = '👂 در حال گوش دادن…';
    $('#nzProgWrap').hidden = false;
    try {
      const r = await L.detectNoise(S.audio.buf, (p) => { $('#nzProg').style.width = Math.round(p * 100) + '%'; });
      // keep segments that were already removed when re-detecting
      const done = S.audio.segments.filter((s) => s.removed);
      S.audio.segments = [...done, ...r.segments.filter((n) => !done.some((d) => d.type === n.type && Math.abs(d.start - n.start) < 0.2))].sort((a, b) => a.start - b.start);
      const fresh = S.audio.segments.filter((s) => !s.removed).length;
      if (!fresh) note('صدای مزاحم واضحی پیدا نشد؛ صدای این ویدیو تمیز به نظر می‌رسد. 🎉', 'good');
      else note(`${fa(fresh)} صدای مشکوک پیدا شد. روی ▶ بزن و هر کدام را بشنو. تیک هر صدایی را که نمی‌خواهی حذف شود بردار، بعد دکمه «مطمئنم» را بزن.`, 'warn');
      render();
    } catch (e) {
      note('تحلیل صدا انجام نشد. دوباره امتحان کن.', 'bad');
    } finally {
      btn.disabled = false; btn.textContent = '🔍 پیدا کردن دوباره صداهای مزاحم';
      setTimeout(() => ($('#nzProgWrap').hidden = true), 600);
    }
  };
  $('#nzPlayAll').onclick = () => {
    const items = S.audio.segments.filter((s) => s.keep);
    if (!items.length) { L.toast('صدایی برای پخش انتخاب نشده'); return; }
    queue = items.slice();
    const next = () => { if (!queue || !queue.length) { queue = null; return; } const s = queue.shift(); play(s, () => setTimeout(() => queue && next(), 350)); };
    next();
  };
  $('#nzStop').onclick = stop;
  $('#nzConfirm').onclick = async () => {
    stop();
    const chosen = S.audio.segments.filter((s) => s.keep);
    if (!chosen.length) return;
    const ctx = L.ensureAudio();
    if (!ctx) { note('این مرورگر پردازش صدا را پشتیبانی نمی‌کند.', 'bad'); return; }
    const btn = $('#nzConfirm'); btn.disabled = true; btn.textContent = '🧹 در حال حذف صداهای مزاحم…';
    $('#nzProgWrap').hidden = false;
    try {
      S.audio.cleaned = await L.cleanAudio(ctx, S.audio.buf, chosen, (p) => { $('#nzProg').style.width = Math.round(p * 100) + '%'; });
      S.audio.segments.forEach((s) => (s.removed = s.keep));
      S.audio.compare = false;
      L.syncClean(); L.updateBadges();
      note(`${fa(chosen.length)} صدای مزاحم حذف شد ✨ ویدیو را پخش کن یا روی ▶ هر مورد بزن تا نتیجه را بشنوی.`, 'good');
      L.toast('صداهای مزاحم حذف شدند 🎧');
    } catch (e) {
      note('حذف صدا با خطا روبه‌رو شد.', 'bad');
    } finally {
      setTimeout(() => ($('#nzProgWrap').hidden = true), 600);
      render();
    }
  };
  $('#nzCompare').onclick = () => { S.audio.compare = !S.audio.compare; L.syncClean(); L.updateBadges(); render(); };
  $('#nzRestore').onclick = () => {
    S.audio.cleaned = null; S.audio.compare = false;
    S.audio.segments.forEach((s) => (s.removed = false));
    L.syncClean(); L.updateBadges(); render();
    note('صدای اصلی ویدیو برگشت.');
  };

  L.audioUI = {
    note,
    redraw,
    reset() { stop(); S.audio.segments = []; render(); note('در حال آماده‌سازی صدا…'); $('#nzDetect').textContent = '🔍 پیدا کردن صداهای مزاحم'; },
    ready() { note('صدای ویدیو آماده است. دکمه بالا را بزن تا صداهای مزاحم پیدا شوند.'); redraw(); },
    tick(t) {
      if (!$('#v-audio').classList.contains('active') || !S.audio.buf) return;
      const now = performance.now(); if (now - lastTick < 120) return; lastTick = now;
      redraw();
    },
  };
  render();
})();
