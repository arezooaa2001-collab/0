# Prism Rush

An original high-speed 3D open-world platformer that runs in one HTML file: **`prism-rush.html`**. Open it in any modern browser (Chrome on Android, desktop Chrome, Edge, Firefox or Safari). There is nothing to install and no server; three.js and every asset are bundled inside. The only external request is Google Fonts, and the game falls back to system fonts offline.

The characters, world, music and art are all original and generated in code. Sega's characters are not used; see `FEATURES.md` for what replaces them and for the honest status of all 550 requested features.

**فارسی:** فایل `prism-rush.html` را در مرورگر باز کنید. زبان پیش‌فرض انگلیسی است. با آیکون چرخ‌دنده در گوشه‌ی بالا سمت چپ می‌توانید زبان را به فارسی (یا ۲۱ زبان دیگر) تغییر دهید. روی گوشی، دستگاه را افقی نگه دارید.

## Controls

| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Move | WASD or arrows | Left stick | Left joystick |
| Camera | Mouse (click to lock), wheel to zoom | Right stick | Swipe on the right side |
| Jump / double jump | Space | A | ⤒ |
| Boost | Shift | RB / RT | ⚡ |
| Spin dash, roll, slide, stomp | C | B / LT | ⟳ |
| Homing attack / dash | E or left click | X | ✦ |
| Character ability | Q | Y | ★ |
| Interact (missions, cannons, chests) | F | LB | ✋ |
| Prism Form | X | L3 | ◆ |
| Camera mode / reset | V / R | D-pad down / R3 | ◎ |
| Map, switch character, photo, replay | M, Tab, P, B | Back, D-pad up | Pause menu, ⇄ |
| Use items | 1–9 | | Inventory |

Every key can be remapped in Settings → Controls, and the touch layout can be dragged and saved in Settings → Touch.

## What is in it

- Ten connected regions on one 2.4 km island, plus floating Sky Isles, a low-gravity Moon Base and the Prism Trial stage
- Six playable original characters, each with their own ability, level, skill tree and skins, plus a companion who follows you
- Rings, boost, homing attack, spin dash, rails with switching, loops, corkscrews, speed tubes, wall running, swimming and springs
- Ten robot types, five bosses (Titan Walker, Magma Wyrm, Kraken Unit, Vex and the Iron Regent), 35 missions and 8 races with ghosts and local leaderboards
- Dynamic day and night, ten weather types, procedural music and sound, three save slots, a shop, achievements, and daily and weekly challenges
- 23 graphics presets (Plus, Pro, Ultra Max and 20 tiers above), with dynamic resolution and adaptive quality
- 23 languages: English (US and UK), Persian, Arabic, Urdu, Turkish, Azerbaijani, Hindi, German, French, Spanish, Italian, Portuguese, Russian, Ukrainian, Polish, Dutch, Swedish, Chinese, Japanese, Korean, Indonesian and Vietnamese. RTL scripts lay out right to left.

Frame rate depends on the device. The higher presets are meant for strong desktop GPUs. On phones, start with Plus or Pro (chosen automatically on first launch).

## Building from source

```
cd prism-rush
npm install
npm run build      # writes prism-rush.html (and dist/artifact.html)
npm run check      # validates every translation pack against src/strings/en.js
```

Source layout: `src/main.js` (loop and states), `src/player.js` (movement), `src/physics.js`, `src/camera.js`, `src/input.js`, `src/enemies.js`, `src/bosses.js`, `src/missions.js`, `src/world/*` (terrain, sky, weather, vegetation, level objects, world content), `src/ui/*` (HUD and menus), `src/characters.js` and `src/robots.js` (procedural models), `src/audio.js` (synthesized music and sound), and `src/strings/*` (translations).

three.js is MIT-licensed © 2010–2024 three.js authors.
