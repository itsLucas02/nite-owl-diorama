# NITE OWL ☾

A pixel-art cyberpunk rooftop in the rain. 02:37 AM, 2089. Animated in real time
on a 640×360 canvas buffer and upscaled with nearest-neighbour, so every pixel
lands on an exact integer block.

**Live:** https://nite-owl.pages.dev

## What it is

A single-scene lo-fi diorama: a rooftop above a neon megacity. Nothing loops on a
fixed timeline — rain, wind gusts, passing traffic and lightning are all driven by
continuous simulation, so no two minutes look alike.

- Rain at three intensities, with splashes, puddle ripples and wet-floor reflections
- Gusts that tilt the rain, whip the smoke and sway what's exposed on the roof
- A maglev train crossing the viaduct, flyers in three depth lanes, and a blimp
- Neon signage, animated windows, a koi hologram, searchlights, lightning and the
  occasional brownout
- Chimney, duct, stove and steam-valve smoke on separate emitters
- A 1920×1080 frame export, a clean capture mode and a hidden UI for recording

## Controls

| Key | Action |
| --- | --- |
| `F` | Toggle fullscreen (also double-click) |
| `H` | Hide the interface (clean capture mode) |
| `R` | Cycle rain: drizzle → steady → downpour |
| `M` | Toggle scaling: integer (pixel-perfect) ↔ fill |
| `P` | Pause / resume (also `Space`) |
| `S` | Save the current frame as a 1920×1080 PNG |
| `A` | Mute / unmute the ambience |

## Audio

A 4:17 ambient track loops underneath the scene. It never starts at full volume:
each cycle rises over 7 seconds, falls back to silence over the last 7 seconds,
and the loop point lands in that hush — so it breathes rather than cutting.

Browsers refuse to play audio before a gesture, so the track starts on your first
click or keypress; the page asks once if it was blocked. `A` mutes it without
stopping the fade cycle. Volume automation uses `HTMLMediaElement.volume`, which
Safari on iOS ignores — the visuals are unaffected, the fades just don't apply there.

## URL parameters

Useful for OBS browser sources, wallpapers and screenshots — combine them freely.

| Parameter | Values | Default | Effect |
| --- | --- | --- | --- |
| `clean` | `1` | off | Starts with the UI hidden |
| `rain` | `0` \| `1` \| `2` | `1` | Drizzle, steady, downpour |
| `t` | seconds | `24` | Start time, so the scene opens mid-moment |
| `mode` | `fill` | integer | Non-integer fill instead of exact pixel scaling |

```
https://nite-owl.pages.dev/?clean=1&rain=2&t=600
```

At 1920×1080 the scene is an exact 3× upscale of the source buffer, which is what
`S` captures. Press `F`, then `H`, for a clean full-screen view worth recording.

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # -> dist/index.html (single self-contained file)
npm run preview   # serve the production build
```

`vite-plugin-singlefile` inlines all JS and CSS, so the build is one HTML file with
no external requests other than the Silkscreen webfont and the ambience track.

## Deploy

Hosted on Cloudflare Pages as a static site:

```bash
npm run build
npx wrangler pages deploy dist --project-name nite-owl
```

## Stack

React 19 · TypeScript · Vite 7 · Tailwind CSS 4 · Canvas 2D. All the rendering is
hand-written — no game engine, no image assets, no shaders.

## License

[MIT](LICENSE)
