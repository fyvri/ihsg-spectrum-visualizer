# Built-in music library — bring your own audio

This folder holds the audio files for the app's **Library** tab. **No audio is
committed to this repository** — most music is copyrighted, and publishing it
here (or serving it from a public deployment) would infringe those rights. The
audio files are git-ignored on purpose (see `.gitignore`).

To use the built-in library locally, just **drop audio files into this folder**.
The Library list is generated automatically at build time from whatever is
present here — there is **no list to edit in code**. For each file the build
reads:

- **Title** ← the MP3's `TIT2` ID3 tag.
- **Artist** (shown as the sub-line) ← the `TPE1` ID3 tag.
- If a file has no usable tags, it falls back to the **`Artist - Title.mp3`**
  filename convention (split on the first ` - `); with no ` - `, the whole
  filename becomes the title.

So a file tagged Title `Merah` / Artist `Efek Rumah Kaca` (or simply named
`Efek Rumah Kaca - Merah.mp3`) shows up as **Merah — Efek Rumah Kaca**.

Supported extensions: `.mp3` (tags read), plus `.m4a` / `.ogg` / `.wav`
(filename only). Prefer files you own or that are Creative Commons /
public-domain / royalty-free, and credit the authors.

The scan is implemented in `vite-plugin-song-library.ts` (exposes
`virtual:song-library`, consumed as `SONGS` in `src/audio/useAudioEngine.ts`).
It runs at build time, so after adding/removing files **rebuild** (or restart
`npm run dev` — the dev server also live-reloads when this folder changes).

Without these files, the Library rows still appear but will fail to play
(404). The **Device upload** and **YouTube** tabs work regardless — they play
audio the end user supplies in their own browser.
