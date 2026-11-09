// Application bootstrap and screen flow.

import { Profile } from './core/save.js';
import { STAGES } from './core/config.js';
import { getTier, detectDefaultTier } from './gfx/quality.js';
import { Gfx } from './gfx/renderer.js';
import { disposeTextureCache } from './gfx/textures.js';
import { clearCarModelCache } from './gfx/carModel.js';
import { AudioEngine } from './audio/audio.js';
import { Input } from './game/input.js';
import { Race } from './game/race.js';
import { UI } from './ui/ui.js';
import { Garage } from './ui/garage.js';
import { isTouchDevice, nextFrame, wait } from './core/utils.js';

class App {
  async init() {
    this.profile = new Profile(detectDefaultTier());
    this.tier = getTier(this.profile.settings.graphics);
    this.ui = new UI(this);
    this.ui.setLoading(0.1, 'راه‌اندازی موتور گرافیک...');
    await nextFrame();
    try {
      this.gfx = new Gfx(document.getElementById('stage'));
    } catch (e) {
      console.error(e);
      this.ui.setLoading(1, 'مرورگر شما از WebGL2 پشتیبانی نمی‌کند. لطفاً مرورگر را به‌روز کنید.');
      return;
    }
    this.gfx.onContextLost = () => this.ui.toast('اتصال به کارت گرافیک قطع شد؛ بازی دوباره بارگذاری می‌شود...', 4000);
    this.gfx.onContextRestored = () => location.reload();
    this.gfx.setTier(this.tier);
    this.audio = new AudioEngine();
    this.#applyVolumes();
    this.input = new Input(document.body, () => this.profile.settings);
    this.input.applySettings();
    this.input.on('pause', () => this.togglePause());
    this.input.on('camera', () => this.race?.cycleCamera());
    this.input.on('respawn', () => this.race?.respawnPlayer());
    this.ui.setLoading(0.4, 'بارگذاری فونت‌ها...');
    try {
      await Promise.race([Promise.all([document.fonts.load('900 40px Vazirmatn'), document.fonts.load('800 20px Vazirmatn')]), wait(2500)]);
    } catch { /* fonts optional */ }
    this.ui.setLoading(0.7, 'آماده‌سازی گاراژ...');
    await nextFrame();
    this.garage = new Garage(this);
    this.garage.showCar(this.profile.data.selected, this.profile.paintOf(this.profile.data.selected));
    this.gfx.setView(this.garage.scene, this.garage.camera);
    this.garage.setActive(true);
    this.profile.onChange(() => this.ui.refreshWallet());
    this.ui.setLoading(1, 'آماده!');
    this.fps = 0;
    this._fpsFrames = 0;
    this._fpsTime = 0;
    this.last = performance.now();
    requestAnimationFrame((t) => this.#frame(t));
    window.addEventListener('resize', () => this.#resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.#resize(), 250));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.race && !this.race.paused && this.race.state !== 'finished') this.pause(true);
        this.audio.setPaused(true);
      } else if (!this.race || !this.race.paused) this.audio.setPaused(false);
    });
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
    window.addEventListener('keydown', () => this.audio.unlock(), { once: true });
    await wait(150);
    this.go('menu');
    this.#resize();
    const params = new URLSearchParams(location.search);
    if (params.has('stage')) this.startRace(Math.min(STAGES.length - 1, Number(params.get('stage')) || 0));
  }

  #resize() {
    this.gfx.resize();
    this.ui.updateRotateHint(!!this.race);
    this.#frameGarage();
  }

  #frameGarage() {
    const landscape = window.innerWidth > window.innerHeight * 1.15 && window.innerWidth > 560;
    this.garage.setFraming(landscape && this.ui.current === 'menu' ? 0.2 : 0);
  }

  #frame(t) {
    requestAnimationFrame((tt) => this.#frame(tt));
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 0.1);
    this._fpsFrames++;
    this._fpsTime += dt;
    if (this._fpsTime >= 0.5) {
      this.fps = Math.round(this._fpsFrames / this._fpsTime);
      this._fpsFrames = 0;
      this._fpsTime = 0;
    }
    if (this.renderPaused) return;
    try {
      if (this.race) {
        if (this.race.state !== 'loading') {
          this.race.update(dt);
          this.gfx.render(dt);
        }
      } else if (this.garage) {
        this.garage.update(dt);
        this.gfx.render(dt);
      }
    } catch (e) {
      this.#reportError(e);
    }
  }

  #reportError(e) {
    console.error(e);
    const now = performance.now();
    if (!this._lastErr || now - this._lastErr > 4000) {
      this._lastErr = now;
      this.ui.toast(`خطا: ${e && e.message ? e.message : e}`, 3500);
    }
  }

  // ---- navigation -----------------------------------------------------------------------------
  go(screen) {
    if (screen === 'settings') {
      this.ui.openSettings('menu');
    } else {
      this.ui.show(screen);
    }
    if (screen === 'garage') this.ui.garageCar = this.profile.data.selected;
    if (screen === 'menu' || screen === 'garage') {
      const id = screen === 'garage' ? this.ui.garageCar : this.profile.data.selected;
      this.garage.showCar(id, this.profile.paintOf(id));
      if (screen === 'garage') this.ui.renderGarage();
    }
    this.#frameGarage();
  }

  async startRace(index) {
    if (this.starting) return;
    this.starting = true;
    this.ui.hideResults();
    this.ui.showPause(false);
    this.#endRace();
    this.audio.unlock();
    if (isTouchDevice()) {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        await screen.orientation?.lock?.('landscape');
      } catch { /* not supported – fine */ }
    }
    this.ui.show('loading');
    this.ui.setLoading(0, 'در حال ساخت مسابقه...');
    this.garage.setActive(false);
    await nextFrame();
    const race = new Race(this, index);
    this.race = race;
    try {
      await race.build((p, text) => this.ui.setLoading(p, text));
    } catch (e) {
      this.#reportError(e);
      this.race = null;
      race.dispose();
      this.starting = false;
      this.go('menu');
      return;
    }
    this.ui.show('none');
    this.input.applySettings();
    this.input.setTouchVisible(true);
    this.input.setEnabled(false);
    document.body.classList.add('racing');
    this.ui.updateRotateHint(true);
    this.gfx.resize(true);
    this.starting = false;
    window.__shetabRace = race;
  }

  #endRace() {
    if (!this.race) return;
    this.race.dispose();
    this.race = null;
    window.__shetabRace = null;
    disposeTextureCache(); // free race textures (road/ground at high resolutions)
    this.input.setTouchVisible(false);
    this.input.setEnabled(false);
    document.body.classList.remove('racing');
    this.gfx.speedBlur = 0;
    this.gfx.flash = 0;
    this.gfx.renderer.toneMappingExposure = 1;
    this.gfx.setGrade({ saturation: 1.08, contrast: 1.04, vignette: 0.35 });
    this.gfx.setView(this.garage.scene, this.garage.camera);
    this.gfx.resize(true);
    this.garage.setActive(true);
    this.ui.updateRotateHint(false);
    this.audio.setPaused(false);
  }

  pause(p) {
    if (!this.race || this.race.state === 'loading') return;
    if (this.race.state === 'finished' && p) return;
    this.race.setPaused(p);
    this.ui.showPause(p);
    this.audio.setPaused(p);
  }

  togglePause() {
    if (!this.race) return;
    this.pause(!this.race.paused);
  }

  pauseAction(a) {
    const race = this.race;
    if (!race) return;
    switch (a) {
      case 'resume':
        this.pause(false);
        break;
      case 'restart':
        this.pause(false);
        this.startRace(race.stageIndex);
        break;
      case 'respawn':
        this.pause(false);
        race.respawnPlayer();
        break;
      case 'settings':
        this.ui.showPause(false);
        this.ui.openSettings('pause');
        break;
      case 'quit':
        this.ui.showPause(false);
        this.#endRace();
        this.go('menu');
        break;
      default:
        break;
    }
  }

  showResults(results) {
    if (!this.race || this.race.results !== results) return;
    this.input.setTouchVisible(false);
    this.ui.showResults(results);
  }

  resultsAction(a) {
    const idx = this.race ? this.race.stageIndex : 0;
    this.ui.hideResults();
    if (a === 'next') this.startRace(Math.min(STAGES.length - 1, idx + 1));
    else if (a === 'retry') this.startRace(idx);
    else {
      this.#endRace();
      this.go(a === 'garage' ? 'garage' : 'menu');
    }
  }

  // ---- settings -------------------------------------------------------------------------------
  onSettingChanged(key) {
    const s = this.profile.settings;
    if (key === 'graphics') {
      const tier = getTier(s.graphics);
      this.tier = tier;
      this.gfx.setTier(tier);
      if (this.race) {
        this.ui.toast('تغییرات کامل گرافیک از مسابقه‌ی بعد اعمال می‌شود');
      } else {
        disposeTextureCache();
        clearCarModelCache();
        const id = this.ui.current === 'garage' && this.ui.garageCar ? this.ui.garageCar : this.profile.data.selected;
        this.garage.showCar(id, this.profile.paintOf(id));
      }
    } else if (key.endsWith('Volume')) {
      this.#applyVolumes();
    } else if (key === 'minimap') {
      this.race?.hud.setMinimap(s.minimap);
    } else if (key === 'camera') {
      /* stored only */
    } else {
      this.input.applySettings();
    }
  }

  #applyVolumes() {
    const s = this.profile.settings;
    this.audio.setVolumes({ master: s.masterVolume, sfx: s.sfxVolume, engine: s.engineVolume });
  }

  onProfileReset() {
    this.ui.garageCar = this.profile.data.selected;
    this.garage.showCar(this.profile.data.selected, this.profile.paintOf(this.profile.data.selected));
    this.ui.refreshWallet();
  }

  /** Test helper: run `n` full frames (simulation + render) synchronously. */
  debugRender(n = 1, dt = 1 / 60) {
    for (let i = 0; i < n; i++) {
      if (this.race) this.race.update(dt);
      else this.garage.update(dt);
      this.gfx.render(dt);
    }
    const info = this.gfx.renderer.info;
    return { calls: info.render.calls, triangles: info.render.triangles, programs: info.programs?.length || 0 };
  }

  /** Test helper: simulate `seconds` of race time without rendering. */
  fastForward(seconds, step = 1 / 30) {
    if (!this.race) return;
    const n = Math.ceil(seconds / step);
    for (let i = 0; i < n && this.race && !this.race.results; i++) this.race.update(step);
  }
}

const app = new App();
window.__shetab = app;
app.init().catch((e) => {
  console.error(e);
  const t = document.getElementById('load-text');
  if (t) t.textContent = `خطا در اجرای بازی: ${e.message}`;
});
