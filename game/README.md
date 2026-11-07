# تله‌زار (Telezar)

A troll platformer with 40 levels, giant-chase runs, and a hidden realm. It ships as a single HTML file (`index.html`) that works offline. Everything, including three.js r128 (MIT), is embedded in the file.

## Build

The source lives in `src/` and `vendor/`. After editing, rebuild the single file:

```
python3 build.py          # writes index.html
ARTIFACT_OUT=out.html python3 build.py   # also writes a variant without <html>/<head>/<body> wrappers
```

## Source layout

| file | contents |
|---|---|
| `src/05_settings.js` | settings persistence, graphics presets (Go … Max Ultra), adaptive resolution (`Perf`), light/mood presets, colour palettes |
| `src/10_levels.js` | all level definitions: 2D platformer levels, 3D chase levels, hidden realm, final order |
| `src/15_course.js` | long scrolling levels: catalogue of ~54 obstacle designs, per-level selection without repeats (FLAVOR families), chunks with checkpoint flags, chase/reverse chunks, per-level colour schemes (BIOMES); the level's hand-made screen is its finale |
| `src/20_world.js` | 2D platformer simulation (traps, physics, save/load snapshots); long levels are built section by section (`secBuilder` shifts x and prefixes ids), with a camera, checkpoint flags and an update window around the player |
| `src/40_render2d.js` | 2D canvas renderer: classic view and the 2.5D extruded view, scrolling camera, cached static blocks around the camera, endless parallax mountains |
| `src/45_views.js` | chase levels drawn in 2D (side view) and pseudo-3D (road) |
| `src/50_run3d.js` | chase-level simulation (dense obstacle courses up to 9 km, windowed collision checks) and its three.js view (static scenery split into 400 m chunks that are culled by distance) |
| `src/55_p3d.js` | three.js view for platformer levels ("3D" mode) |
| `src/60_app.js`, `src/65_ui.js` | app flow, records, achievements, settings, mode, and records screens |

## Game modes

- **Mixed**: platformer levels in 2D, chase levels in 3D.
- **2D**: everything flat; chase levels use a side view.
- **2D with 3D effect**: extruded blocks with parallax; chase levels use a pseudo-3D road.
- **Full 3D**: every level rendered with three.js.

All modes run the same simulation, so traps behave identically in every view.
