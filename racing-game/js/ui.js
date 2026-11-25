// رابط کاربری حین مسابقه: سرعت‌سنج، نقشه کوچک، جدول رتبه، پیام‌ها، شمارش معکوس، نتایج و پخش ویدیو
import { toFa, fmtTime, fmtNum, clamp } from './utils.js';
import { TEAM_COLORS, TEAM_NAMES } from './track.js';
import { COINS } from './race.js';

const $ = (id) => document.getElementById(id);
const teamCss = (t) => (TEAM_COLORS[t] === 'fire' ? 'linear-gradient(135deg,#ff2a1a,#ff7a00,#ffd400)' : TEAM_COLORS[t]);

export class HUD {
  constructor(app) {
    this.app = app;
    this.spd = $('hSpeed').getContext('2d'); this.map = $('hMap').getContext('2d');
    this.msgT = 0; this.boardT = 0; this.fpsAcc = []; this.toastT = 0;
  }
  onPhase(p, race) {
    $('hSkip').classList.toggle('show', p === 'boss' || p === 'intro');
    if (p === 'boss') this.message(race.cfg.level === 1000 ? '👑 رئیس کل پیست برای مرحله ۱۰۰۰ آمده!' : (race.info.bossTeam === 0 ? 'رئیس کل پیست کنار طرفدارهای تو نشست!' : 'رئیس کل پیست کنار طرفدارهای تیم ' + TEAM_NAMES[race.info.bossTeam] + ' نشست!'), 6);
    if (p === 'intro') this.message('مرحله ' + toFa(race.cfg.level) + ' • ' + race.track.name, 3);
    if (p === 'race') this.message('برو!', 1.2);
    if (p === 'finish') { const pl = race.player.place; this.message(pl === 1 ? '🏆 نفر اول شدی!' : 'به خط پایان رسیدی • نفر ' + toFa(pl), 3.5); }
    if (p === 'judge') this.showJudge(race);
    if (p !== 'judge') $('judge').classList.remove('show');
  }
  setText(id, v) { this._txt = this._txt || {}; if (this._txt[id] !== v) { this._txt[id] = v; $(id).textContent = v; } }
  message(text, dur = 2) { const m = $('hMsg'); m.textContent = text; m.style.opacity = 1; this.msgT = dur; }
  toast(text) { const t = $('toast'); t.textContent = text; t.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), 2000); }
  countdown(n) {
    const c = $('hCount'); c.classList.remove('pop', 'go'); void c.offsetWidth;
    c.textContent = n > 0 ? toFa(n) : 'برو!'; if (n === 0) c.classList.add('go'); c.classList.add('pop');
  }
  update(race, dt) {
    const p = race.player; const L = race.track.length; const laps = race.info.laps;
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) $('hMsg').style.opacity = 0; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').classList.remove('show'); }
    this.setText('hPos', toFa(p.place)); this.setText('hPosOf', '/' + toFa(race.racers.length));
    this.setText('hLap', toFa(Math.min(p.lap, laps)) + '/' + toFa(laps));
    this.timeT = (this.timeT || 0) - dt;
    if (this.timeT <= 0) { this.timeT = 0.05; this.setText('hTime', fmtTime(race.phase === 'countdown' || race.phase === 'intro' || race.phase === 'boss' ? 0 : (p.finished ? p.finishTime : race.raceTime))); }
    if (p.wrongT > 1.2) this.message('⚠ مسیر اشتباه! برگرد', 0.3);
    if (!race._lastLapMsg && p.lap === laps && laps > 1 && race.phase === 'race') { race._lastLapMsg = true; this.message('دور آخر!', 2); }
    // جدول رتبه
    this.boardT -= dt;
    if (this.boardT <= 0 && race.standings) {
      this.boardT = 0.25;
      const lead = race.standings[0];
      $('hBoard').innerHTML = race.standings.map((r) => `<li class="${r.isPlayer ? 'me' : ''}"><b>${toFa(r.place)}</b><i style="background:${teamCss(r.team)}"></i><span>${r.isPlayer ? 'تو' : r.name}</span><span class="gap">${r === lead ? '' : (r.finished ? '✓' : '+' + toFa(Math.round(lead.P - r.P)) + 'م')}</span></li>`).join('');
    }
    // سرعت‌سنج حداکثر ۳۰ بار و نقشه ۱۵ بار در ثانیه بازسازی می‌شوند
    this.spdT = (this.spdT || 0) - dt; this.mapT = (this.mapT || 0) - dt;
    const kmh = Math.round(Math.abs(p.vf) * 3.6);
    if (this.spdT <= 0 && (kmh !== this._lastKmh || p.gear !== this._lastGear || Math.abs(p.rpm - (this._lastRpm || 0)) > 150 || p.nitroOn)) { this.spdT = 1 / 30; this._lastKmh = kmh; this._lastGear = p.gear; this._lastRpm = p.rpm; this.drawSpeed(p); }
    if (this.mapT <= 0) { this.mapT = 1 / 15; this.drawMap(race); }
    // FPS
    if (this.app.save.data.settings.fps) {
      this.fpsAcc.push(dt); if (this.fpsAcc.length >= 30) { const a = this.fpsAcc.reduce((x, y) => x + y, 0) / this.fpsAcc.length; $('hFps').textContent = 'FPS ' + Math.round(1 / a); this.fpsAcc.length = 0; }
    } else $('hFps').textContent = '';
  }
  drawSpeed(p) {
    const c = this.spd; const W = 260; c.clearRect(0, 0, W, W);
    const cx = 130, cy = 136, R = 108;
    const kmh = Math.abs(p.vf) * 3.6; const top = Math.ceil((p.stats.vmax * 3.6 * 1.15) / 20) * 20;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    c.fillStyle = 'rgba(10,12,18,0.72)'; c.beginPath(); c.arc(cx, cy, R + 14, 0, Math.PI * 2); c.fill();
    c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,0.12)'; c.stroke();
    // دور موتور
    const rf = clamp((p.rpm - 800) / 7200, 0, 1);
    c.lineWidth = 9; c.strokeStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.arc(cx, cy, R - 4, a0, a1); c.stroke();
    const grad = c.createLinearGradient(0, 260, 260, 0); grad.addColorStop(0, '#ffd400'); grad.addColorStop(0.6, '#ff7a00'); grad.addColorStop(1, '#ff2a1a');
    c.strokeStyle = grad; c.beginPath(); c.arc(cx, cy, R - 4, a0, a0 + (a1 - a0) * rf); c.stroke();
    // درجه‌بندی
    c.fillStyle = '#d8dde6'; c.font = "700 13px 'Vazirmatn', sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let k = 0; k <= 10; k++) {
      const a = a0 + (a1 - a0) * k / 10; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - 18), cy + Math.sin(a) * (R - 18)); c.lineTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10)); c.stroke();
      if (k % 2 === 0) c.fillText(toFa(Math.round(top * k / 10)), cx + Math.cos(a) * (R - 32), cy + Math.sin(a) * (R - 32));
    }
    // عقربه
    const na = a0 + (a1 - a0) * clamp(kmh / top, 0, 1);
    c.strokeStyle = '#ff3a1a'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(na) * (R - 22), cy + Math.sin(na) * (R - 22)); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, 6, 0, Math.PI * 2); c.fill();
    c.font = "900 40px 'Vazirmatn', sans-serif"; c.fillStyle = '#fff'; c.fillText(toFa(Math.round(kmh)), cx, cy + 40);
    c.font = "600 12px 'Vazirmatn', sans-serif"; c.fillStyle = '#a8b0bf'; c.fillText('کیلومتر بر ساعت', cx, cy + 64);
    c.font = "900 22px 'Vazirmatn', sans-serif"; c.fillStyle = '#ffd400'; c.fillText(p.gear === 0 ? 'R' : (Math.abs(p.vf) < 0.5 && p.throttle < 0.1 ? 'N' : toFa(p.gear)), cx, cy - 34);
    // نیترو
    if (p.stats.nitro > 0) {
      const nf = p.nitro / p.stats.nitro; c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(cx - 50, cy + 82, 100, 7);
      c.fillStyle = p.nitroOn ? '#9fd0ff' : '#3d8bff'; c.fillRect(cx - 50, cy + 82, 100 * nf, 7);
    }
  }
  drawMap(race) {
    const c = this.map; const mm = race.mm; c.clearRect(0, 0, 200, 200);
    c.drawImage(mm.base, 0, 0);
    for (const r of [...race.racers].sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0))) {
      const x = mm.ox + r.pos.x * mm.sc, y = mm.oz + r.pos.z * mm.sc;
      c.beginPath(); c.arc(x, y, r.isPlayer ? 6 : 4.2, 0, Math.PI * 2);
      c.fillStyle = r.isPlayer ? '#ff5a00' : (TEAM_COLORS[r.team] === 'fire' ? '#ff5a00' : TEAM_COLORS[r.team]); c.fill();
      c.lineWidth = r.isPlayer ? 2.5 : 1.2; c.strokeStyle = r.isPlayer ? '#fff' : 'rgba(0,0,0,0.7)'; c.stroke();
    }
    if (race.boss && race.boss.seat) { const x = mm.ox + race.boss.seat.x * mm.sc, y = mm.oz + race.boss.seat.z * mm.sc; c.font = '14px sans-serif'; c.textAlign = 'center'; c.fillText('👑', x, y); }
  }
  showJudge(race) {
    const rows = race.judgeRows; if (!rows) return;
    const max = rows[0].score;
    $('judgeRows').innerHTML = rows.map((j, k) => `<div class="jrow ${j.r.isPlayer ? 'me' : ''}"><span>${toFa(k + 1)}. ${j.r.isPlayer ? 'تو' : j.r.name}</span><div class="jbar"><i data-w="${(j.score / max * 100).toFixed(1)}"></i></div><span>${toFa(Math.round(j.score))}</span></div>`).join('');
    $('judge').classList.add('show');
    requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('#judgeRows i').forEach((i) => { i.style.width = i.dataset.w + '%'; })));
  }
  showResults(res, race, { coins, advanced, total }) {
    $('judge').classList.remove('show');
    const pl = res.place;
    $('rTitle').textContent = res.judged ? 'نتیجه داوری رئیس کل' : 'نتیجه مسابقه';
    $('rHead').innerHTML = `<span class="big">نفر ${toFa(pl)}</span><span class="coins">+${fmtNum(coins)} سکه</span>` +
      `<span class="note">${advanced ? 'آفرین! مرحله ' + toFa(race.cfg.level + 1) + ' باز شد.' : (pl <= 3 ? 'عالی بود!' : 'برای باز شدن مرحله بعد باید جزو سه نفر اول باشی. با سکه‌ها ماشینت را قوی‌تر کن.')} • موجودی: ${fmtNum(total)} سکه</span>` +
      (res.judged ? `<span class="note">رئیس کل فقط به قدرت، سرعت و ظاهر ماشین‌ها نگاه کرد، نه به رانندگی.</span>` : '');
    $('rBody').innerHTML = res.order.map((o, k) => `<tr class="${o.r.isPlayer ? 'me' : ''}"><td>${toFa(k + 1)}</td><td><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${teamCss(o.r.team)};margin-left:6px"></i>${o.r.isPlayer ? 'تو' : o.r.name + ' (' + o.r.teamName + ')'}</td><td>${o.r.def.name}</td><td>${o.r.finished ? fmtTime(o.time) : '~' + fmtTime(o.time)}</td><td>${toFa(COINS[k] || 0)}</td></tr>`).join('');
    $('rNext').disabled = !(race.cfg.level < 1000 && race.cfg.level < this.app.save.data.maxStage);
    const rp = $('rReplay'); rp.disabled = race.replayWatched; rp.querySelector('span:last-child').textContent = race.replayWatched ? 'ویدیو دیده شد' : 'دیدن ویدیوی مسابقه (فقط یک بار)';
    $('results').classList.add('show');
  }
  replayHud(race, t, total) {
    $('rpProg').style.width = (t / Math.max(0.001, total) * 100).toFixed(2) + '%';
    const rp = race.rp;
    $('rpPlay').textContent = rp.playing ? '❚❚' : '▶';
    const names = { auto: 'خودکار', tv: 'تلویزیونی', chase: 'تعقیب', heli: 'هلیکوپتر', cockpit: 'داخل ماشین', wheel: 'کنار چرخ', fans: 'تماشاگران', top: 'از بالا' };
    $('rpCamName').textContent = 'دوربین: ' + names[rp.cam === 'auto' ? rp.dirMode : rp.cam];
  }
}
