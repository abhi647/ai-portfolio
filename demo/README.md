# Demo videos

Scripted screen recordings of the app with an animated cursor, click ripples,
spotlights and callouts, plus a voiceover script for ElevenLabs.

| Video | Length | File |
|---|---|---|
| Admin walkthrough: sign in, create a project with demo data, tour the dashboard | ~2:35 | `output/admin/admin-demo.mp4` |
| Stakeholder walkthrough: read-only sign in, portfolio view, sign out | ~1:17 | `output/stakeholder/stakeholder-demo.mp4` |
| Both, back to back | ~3:53 | `output/full-demo.mp4` |

The narration, with a timestamp for every line, is in [`VOICEOVER_SCRIPT.md`](VOICEOVER_SCRIPT.md).
Each video folder also has `captions.srt`, `timeline.json` and `elevenlabs-single-take.txt`.

## Adding the voiceover

**Option A: ElevenLabs website.** Generate each line of `VOICEOVER_SCRIPT.md` as its own clip,
save them as `A01.mp3` … `A12.mp3` and `S01.mp3` … `S08.mp3` in one folder, then run:

```bash
cd demo
node voiceover.mjs --clips ~/Downloads/demo-clips     # all videos
node voiceover.mjs --video admin --clips ./clips      # just one
```

**Option B: ElevenLabs API.** Generates every clip and muxes them in one go:

```bash
ELEVENLABS_API_KEY=sk_... node voiceover.mjs --voice <voice_id>
```

Either way you get `output/<video>/<video>-demo-voiced.mp4` (and `output/full-demo-voiced.mp4`).
The script warns if a clip runs longer than its scene.

**Option C: one take.** Paste `output/<video>/elevenlabs-single-take.txt` into ElevenLabs. It has
`<break>` tags sized to each scene; line it up in any video editor.

## Re-recording

The storyboard lives in `scenes.mjs`: narration and on-screen actions side by side. Each scene lasts
at least as long as its narration takes to read (about 150 words per minute), so edits to the text
keep the audio in sync automatically.

```bash
npm run build && npm start          # in the repo root, serves http://localhost:3000
cd demo && npm install
node record.mjs                     # needs ffmpeg on PATH, or FFMPEG=/path/to/ffmpeg
node record.mjs --only stakeholder  # re-record one video
```

Playwright drives Chromium at 1920×1080. Frames come straight from the browser compositor and are
encoded to H.264 at 30 fps. `overlay.js` draws the cursor and callouts; `director.mjs` has the
move / click / type / callout helpers.
