# تله‌زار (Telezar)

A troll platformer with 42 levels, giant-chase runs, rival runners, and a hidden realm. Every level is split into rooms (5 to 45 per level; level 41 is a one-room rest stop, level 42 is a 45-room 3D run). It ships as a single HTML file (`index.html`) that works offline. Everything, including three.js r128 (MIT), is embedded in the file.

## Build

The source lives in `src/` and `vendor/`. After editing, rebuild the single file:

```
python3 build.py          # writes index.html
ARTIFACT_OUT=out.html python3 build.py   # also writes a variant without <html>/<head>/<body> wrappers
```

## Android app (APK)

`telezar.apk` is the game wrapped in a full-screen Android WebView (landscape, saves kept on the phone, back key = pause/back,
works offline). Rebuild it after changing the game:

```
android/build_apk.sh      # needs a JDK and: apt-get install android-sdk-platform-23 aapt dalvik-exchange zipalign apksigner
```

The build script creates a signing key `android/telezar.keystore` on first use (it is not kept in git). Keep that file: new versions only install over old ones when they are signed with the same key.

## Source layout

| file | contents |
|---|---|
| `src/05_settings.js` | settings persistence, graphics presets (Go … Max Ultra and 20 higher tiers, Hyper … Reality Max), adaptive resolution (`Perf`), light/mood presets, colour palettes, per-level colour schemes |
| `src/07_skins.js` | shop items: body colours, hats and trails (2D drawing, 3D hat meshes, trail particles) |
| `src/10_levels.js` | all level definitions: 2D platformer levels, 3D chase levels, the rest stop, hidden realm, final order, rooms per level, race levels |
| `src/15_course.js` | long scrolling levels: catalogue of 171 obstacle designs (switch blocks, kicker springs, pressure plates, spinners and more), per-level selection without repeats (FLAVOR families + one newer mechanic family per level), independent chunks with checkpoint flags, chase/reverse chunks, underground cave chunks (auto / all / picked / off), gems, power-ups (shield, star, slow time, magnet, spring shoes), 24 level looks (BIOMES: colours, background scenery, block material, floor edge, sky object, matching 3D theme); the level's hand-made screen is its finale; `CHUNK_FIX` holds solver-verified seeds |
| `src/16_rivaldata.js` | recorded solver runs used by the rivals of the 2D race levels (generated) |
| `src/17_endless.js` | endless mode and daily challenge: a course of solver-checked chunks that grows ahead of the player, with zones |
| `src/20_world.js` | 2D platformer simulation (traps, physics, save/load snapshots): trampolines, wind/updraft zones, low gravity, teleporters, blinking blocks, orbit/pendulum platforms, one-way planks, dash pads, lava/acid, fake spikes, gems, power-up effects, death slow-motion; long levels built section by section (`secBuilder`), camera, checkpoints, update window around the player |
| `src/40_render2d.js` | 2D canvas renderer: classic view and the 2.5D extruded view, scrolling camera, static blocks cached in 640 px tiles, per-biome block textures and parallax scenery (mountains, cities, forests, dunes, crystals, islands, ruins, …), caves, high-tier sky effects (mist, moon rays, meteors) |
| `src/42_weather.js` | weather (rain, snow, flood, storm, automatic) for the 2D views and both three.js views, rain/wind sounds |
| `src/45_views.js` | chase levels drawn in 2D (side view) and pseudo-3D (road) |
| `src/50_run3d.js` | chase-level simulation (dense obstacle courses up to 9 km, windowed collision checks) and its three.js view (static scenery split into 400 m chunks that are culled by distance) |
| `src/52_run3dx.js` | six newer 3D obstacle types described by moving parts (lasers, saws, hammers, sliding walls, turning bars, pillars), the shared autopilot / rival AI, rival runners, and the conversion of any platformer level into a 3D run (true 3D mode) |
| `src/55_p3d.js` | three.js view for platformer levels (side-3D mode): side camera or third-person camera, mesh reuse on respawn |
| `src/58_rivals2d.js` | rivals of the race levels played in 2D: each replays recorded solver runs room by room in its own invisible copy of the level |
| `src/60_app.js`, `src/65_ui.js` | app flow, records, achievements, gem shop, endless/daily runs with lives, ghost of the best run, settings, mode, and records screens |

## Game modes

- **Mixed**: platformer levels in 2D, chase levels in 3D.
- **2D**: everything flat; chase levels use a side view.
- **2D with 3D effect**: extruded blocks with parallax; chase levels use a pseudo-3D road.
- **True 3D**: every level is a 3D run like the giant-chase levels (platformer levels are converted, keeping their rooms and colours).
- **Side-view 3D platformer**: platformer levels keep their 2D layout but are drawn with three.js (side or behind-the-player camera).

The 2D, 2.5D and side-3D views run the same platformer simulation, so traps behave identically in each of them; true 3D builds a 3D run from the level.
