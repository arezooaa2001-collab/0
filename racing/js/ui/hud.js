// In-race heads-up display: position, laps, timers, analog tachometer + speed, gear, nitro,
// minimap, live standings, centre messages and touch-friendly buttons.

import { fa, faNum, formatTime, clamp } from '../core/utils.js';
import { FIELD_SIZE } from '../core/config.js';

export class Hud {
  constructor(host, opts) {
    this.opts = opts;
    const el = document.createElement('div');
    el.className = 'hud';
    el.innerHTML = `
      <div class="hud-top">
        <div class="hud-card hud-pos"><span>رتبه</span><b data-k="pos">-</b><small>/${fa(FIELD_SIZE)}</small></div>
        <div class="hud-card hud-lap"><span>دور</span><b data-k="lap">-</b></div>
        <div class="hud-card hud-time"><span>زمان</span><b data-k="time">0:00.000</b><small data-k="best">بهترین دور: --</small></div>
        <div class="hud-actions">
          <button class="hud-btn" data-a="camera" aria-label="دوربین">🎥</button>
          <button class="hud-btn" data-a="pause" aria-label="توقف">⏸</button>
        </div>
      </div>
      <div class="hud-board" data-k="board"></div>
      <canvas class="hud-map" width="180" height="180"></canvas>
      <div class="hud-speedo">
        <canvas width="220" height="220"></canvas>
        <div class="hud-nitro"><i data-k="nitro"></i><span>N₂O</span></div>
      </div>
      <div class="hud-msg" data-k="msg"></div>
      <div class="hud-sub" data-k="sub"></div>
      <button class="hud-respawn" data-a="respawn">↺ بازگشت به مسیر</button>
      <div class="hud-fps" data-k="fps"></div>`;
    host.appendChild(el);
    this.el = el;
    this.q = (k) => el.querySelector(`[data-k="${k}"]`);
    this.els = {};
    for (const k of ['pos', 'lap', 'time', 'best', 'board', 'nitro', 'msg', 'sub', 'fps']) this.els[k] = this.q(k);
    this.respawnBtn = el.querySelector('.hud-respawn');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (b) opts.onAction?.(b.dataset.a);
    });
    this.map = el.querySelector('.hud-map');
    this.mapCtx = this.map.getContext('2d');
    this.speedo = el.querySelector('.hud-speedo canvas');
    this.spCtx = this.speedo.getContext('2d');
    this.cache = {};
    this.msgTimer = 0;
    this.textTimer = 0;
    this.drawTimer = 0;
    this.dpr = 1;
    this.#resizeCanvases();
  }

  #resizeCanvases() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    for (const c of [this.map, this.speedo]) {
      const w = c === this.map ? 180 : 220;
      c.width = w * dpr;
      c.height = w * dpr;
    }
    this.mapBase = null;
  }

  setVisible(v) {
    this.el.classList.toggle('visible', v);
  }

  setMinimap(on) {
    this.map.style.display = on ? '' : 'none';
  }

  #set(k, v) {
    if (this.cache[k] === v) return;
    this.cache[k] = v;
    this.els[k].textContent = v;
  }

  message(text, sub = '', duration = 1.6, cls = '') {
    this.els.msg.textContent = text;
    this.els.msg.className = `hud-msg show ${cls}`;
    this.els.sub.textContent = sub;
    this.els.sub.classList.toggle('show', !!sub);
    this.msgTimer = duration;
  }

  /** Builds the static minimap background from the track centre line. */
  buildMinimap(track) {
    const c = document.createElement('canvas');
    const S = this.map.width;
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const b = track.bounds;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 1.1;
    const sc = S / span;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    this.mapXf = (x, z) => [S / 2 + (x - cx) * sc, S / 2 + (z - cz) * sc];
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const path = () => {
      ctx.beginPath();
      for (let i = 0; i <= track.n; i += 3) {
        const k = i % track.n;
        const [x, y] = this.mapXf(track.px[k], track.pz[k]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    path();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 9 * this.dpr;
    ctx.stroke();
    path();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 4 * this.dpr;
    ctx.stroke();
    const [sx, sy] = this.mapXf(track.px[0], track.pz[0]);
    ctx.fillStyle = '#ffd400';
    ctx.fillRect(sx - 4 * this.dpr, sy - 4 * this.dpr, 8 * this.dpr, 8 * this.dpr);
    this.mapBase = c;
  }

  update(dt, s) {
    this.textTimer -= dt;
    this.drawTimer -= dt;
    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0) {
        this.els.msg.classList.remove('show');
        this.els.sub.classList.remove('show');
      }
    }
    if (this.textTimer <= 0) {
      this.textTimer = 0.1;
      this.#set('pos', fa(s.rank));
      this.#set('lap', `${fa(Math.min(s.lap, s.laps))}/${fa(s.laps)}`);
      this.#set('time', formatTime(s.time));
      this.#set('best', `بهترین دور: ${s.bestLap ? formatTime(s.bestLap) : '--'}`);
      this.els.nitro.style.transform = `scaleX(${clamp(s.nitro, 0, 1).toFixed(3)})`;
      this.els.nitro.parentElement.classList.toggle('active', s.nitroActive);
      this.respawnBtn.classList.toggle('show', !!s.stuck);
      if (s.fps !== undefined) this.#set('fps', s.fps ? `${fa(s.fps)} FPS` : '');
      if (s.board && (this.boardTimer = (this.boardTimer || 0) - 0.1) <= 0) {
        this.boardTimer = 0.4;
        const html = s.board
          .map((r) => `<div class="row ${r.player ? 'me' : ''}"><i>${fa(r.rank)}</i><span>${r.name}</span><em>${r.gap}</em></div>`)
          .join('');
        if (html !== this.cache.board) {
          this.cache.board = html;
          this.els.board.innerHTML = html;
        }
      }
    }
    if (this.drawTimer <= 0) {
      this.drawTimer = 1 / 30;
      this.#drawSpeedo(s);
      if (s.mapCars) this.#drawMap(s.mapCars);
    }
  }

  #drawSpeedo(s) {
    const ctx = this.spCtx;
    const W = this.speedo.width;
    const d = this.dpr;
    ctx.clearRect(0, 0, W, W);
    const cx = W / 2, cy = W / 2, R = W * 0.43;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const rpmN = clamp(s.rpm / s.redline, 0, 1.05);
    // dial
    ctx.beginPath();
    ctx.arc(cx, cy, R + 8 * d, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,10,16,0.62)';
    ctx.fill();
    ctx.lineWidth = 10 * d;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.arc(cx, cy, R, a0, a1);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R, a0 + (a1 - a0) * 0.85, a1);
    ctx.strokeStyle = 'rgba(255,40,60,0.5)';
    ctx.stroke();
    const grad = ctx.createLinearGradient(0, W, W, 0);
    grad.addColorStop(0, '#22d3ee');
    grad.addColorStop(0.7, '#a3e635');
    grad.addColorStop(1, '#ff2d55');
    ctx.beginPath();
    ctx.arc(cx, cy, R, a0, a0 + (a1 - a0) * Math.min(1, rpmN));
    ctx.strokeStyle = rpmN > 0.9 ? '#ff2d55' : grad;
    ctx.stroke();
    // ticks
    ctx.lineWidth = 2 * d;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i <= 10; i++) {
      const a = a0 + ((a1 - a0) * i) / 10;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R - 12 * d), cy + Math.sin(a) * (R - 12 * d));
      ctx.lineTo(cx + Math.cos(a) * (R - 20 * d), cy + Math.sin(a) * (R - 20 * d));
      ctx.stroke();
    }
    // needle
    const an = a0 + (a1 - a0) * Math.min(1.02, rpmN);
    ctx.strokeStyle = '#ff2d55';
    ctx.lineWidth = 3 * d;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(an) * R * 0.25, cy + Math.sin(an) * R * 0.25);
    ctx.lineTo(cx + Math.cos(an) * (R - 6 * d), cy + Math.sin(an) * (R - 6 * d));
    ctx.stroke();
    // text
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${Math.round(52 * d)}px Vazirmatn, Tahoma, sans-serif`;
    ctx.fillText(fa(Math.round(s.speed)), cx, cy + 14 * d);
    ctx.font = `600 ${Math.round(13 * d)}px Vazirmatn, Tahoma, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(s.units === 'mph' ? 'mph' : 'کیلومتر/ساعت', cx, cy + 36 * d);
    ctx.font = `800 ${Math.round(24 * d)}px Vazirmatn, Tahoma, sans-serif`;
    ctx.fillStyle = rpmN > 0.9 ? '#ff2d55' : '#ffd400';
    ctx.fillText(s.gear === -1 ? 'R' : fa(s.gear), cx, cy + 72 * d);
  }

  #drawMap(cars) {
    if (!this.mapBase || !this.mapXf) return;
    const ctx = this.mapCtx;
    const W = this.map.width;
    ctx.clearRect(0, 0, W, W);
    ctx.drawImage(this.mapBase, 0, 0);
    const d = this.dpr;
    for (const c of cars) {
      if (c.player) continue;
      const [x, y] = this.mapXf(c.x, c.z);
      ctx.beginPath();
      ctx.arc(x, y, 3.2 * d, 0, Math.PI * 2);
      ctx.fillStyle = c.color;
      ctx.fill();
      ctx.lineWidth = 1 * d;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.stroke();
    }
    const p = cars.find((c) => c.player);
    if (p) {
      const [x, y] = this.mapXf(p.x, p.z);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) * -1 + Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, -8 * d);
      ctx.lineTo(5.5 * d, 6 * d);
      ctx.lineTo(-5.5 * d, 6 * d);
      ctx.closePath();
      ctx.fillStyle = '#ff2d55';
      ctx.fill();
      ctx.lineWidth = 1.5 * d;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.restore();
    }
  }

  dispose() {
    this.el.remove();
  }
}
