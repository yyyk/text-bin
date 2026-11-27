# text-bin

[![CI](https://github.com/yyyk/text-bin/actions/workflows/ci.yml/badge.svg)](https://github.com/yyyk/text-bin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Text packed into a texture atlas, as an app that zooms through text does:
every size it draws needs its own copy of the text, packed into a fixed
texture with [shelf-pack](https://www.npmjs.com/package/@mapbox/shelf-pack).
When the texture is full, old copies are evicted and new ones packed over
them, and what's left of the old ones shows around the new. Play it, tweak
it, and watch the atlas fill up.

**[Open the app](https://yyyk.github.io/text-bin/)**

## How it works

1. **Motion**: the texts zoom in and out in gestures (Zoom), or are scattered
   into the atlas at random sizes, a few each frame (Scatter). Everything is
   played frame by frame at a fixed frame rate, from one seed: the same seed
   and settings always give the same atlas.
2. **Packing**: each text is packed at each size it's shown at, whole, by
   word or by letter, wrapped into pieces when it's wider than the atlas. A
   copy already in the atlas at that size is used again (or, with Reuse off,
   every new appearance is packed again). Text is measured with
   [text-shape](https://www.npmjs.com/package/text-shape), so it packs the
   same in every browser.
3. **Eviction**: when there's no room, the least recently used copies that
   free a big enough slot are evicted; when that isn't enough, the atlas
   starts over. Evicted pixels stay where they were, as in a real texture:
   only a new copy's own box (and its padding) is cleared.
4. **Drawing**: the text is drawn by the browser or as text-shape's glyph
   outlines, as a mask, shown in the chosen colours or on transparent.

## What it does

The settings are in four tabs: Text, Motion, Atlas and Output.

- **Text**: any texts (one per line), a built-in font (Montserrat, Roboto) or
  your own (.ttf, .otf), letter spacing (in em, so it zooms with the text),
  and the renderer. Letters the font has no shape for are flagged.
- **Appearance**: the background and text colours, or a transparent
  background, as a texture has.
- **Motion**: Zoom (which texts, their sizes, the pattern, the gestures and
  any CSS easing: keywords, `cubic-bezier()`, `steps()`, `linear()`) or
  Scatter (how many a frame, and in a cycle), between a min and max size.
- **Timing**: the gestures' durations (fixed, by size, or by zoom ratio),
  jitter, pauses, and the frame rate. The preview keeps playing: each pass
  starts over from an empty atlas.
- **Atlas**: its size; padding around each entry (and optionally along the
  edges too, for even spacing); when text is packed during a zoom (every
  frame, every few px, or at the end); what's packed (text, word or letter),
  how text too wide for it wraps, whether copies are reused, and what
  happens to old text (kept and cut by newer text, or cleared by letter,
  word or whole). The seed, with a button to shuffle it.
- **Preview**: play and pause (Space), step a frame (→), scrub; fit to the
  window or 100% (Shift+1, Shift+0), sharp at either. Debug mode shows each
  text drawn from the atlas, the entries outlined (their padding dashed), and
  the packing stats.
- **Documents**: undo and redo (⌘Z, ⇧⌘Z), save and open as .json (⌘S, ⌘O).

## Development

Needs Node 20.19+ or 22.12+ (Vite 8's requirement).

```sh
npm install
npm run dev           # dev server
npm run build         # type-check and build into dist/
npm test              # Vitest, watching
npm run test:run      # Vitest, once
npm run lint          # oxlint
npm run format        # Prettier, write
npm run format:check  # Prettier, check only
```

VS Code formats on save with the recommended Prettier extension.

Built with React, TypeScript, Vite, Tailwind CSS and shadcn/ui (Base UI), as
[type-shards](https://github.com/yyyk/type-shards) is. The packing is
[shelf-pack](https://www.npmjs.com/package/@mapbox/shelf-pack); measuring,
shaping and glyph outlines are [text-shape](https://www.npmjs.com/package/text-shape).

## Deployment

Every push to `main` builds the app and deploys it to GitHub Pages
(`.github/workflows/pages.yml`); `BASE_PATH` sets the `/<repo>/` prefix. CI
(`.github/workflows/ci.yml`) checks formatting, lint, the tests and the build on
every push and pull request.

## License

[MIT](LICENSE). The Montserrat and Roboto fonts in `public/fonts` are under the
SIL Open Font License (`Montserrat-OFL.txt`, `Roboto-OFL.txt`).
