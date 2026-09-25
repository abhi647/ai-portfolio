// Records the demo videos and writes a matching voiceover script.
//
//   node record.mjs [--base http://localhost:3000] [--only admin|stakeholder]
//
// Needs the app running (npm run build && npm start in the repo root) and
// ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg).

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Director } from './director.mjs';
import { videos } from './scenes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const BASE = opt('--base', 'http://localhost:3000');
const ONLY = opt('--only', null);
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const OUT = path.join(here, 'output');
const W = 1920, H = 1080, FPS = 30;

// ElevenLabs voices read at roughly 150 words per minute.
const WORDS_PER_SEC = 2.5;
const LEAD_OUT = 0.9;
export const narrationSeconds = (text) => text.split(/\s+/).filter(Boolean).length / WORDS_PER_SEC + LEAD_OUT;

const fmt = (s, sep = ',') => {
  const ms = Math.round(s * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
  const sec = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
  return `${h}:${m}:${sec}${sep}${String(ms % 1000).padStart(3, '0')}`;
};
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function recordVideo(browser, video, storageState) {
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    storageState,
  });
  await context.addInitScript({ path: path.join(here, 'overlay.js') });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#username');
  const d = new Director(page);
  await d.restoreCursor();
  await page.waitForTimeout(500);

  // Capture frames straight from the compositor: sharper than recordVideo.
  const frames = [];
  const cdp = await context.newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ data, ts: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  await page.waitForTimeout(300);

  const timeline = [];
  for (const scene of video.scenes) {
    const start = Date.now() / 1000;
    const minLen = narrationSeconds(scene.narration);
    process.stdout.write(`  ${scene.id} ${scene.title} … `);
    await scene.run(d);
    const elapsed = Date.now() / 1000 - start;
    if (elapsed < minLen) await page.waitForTimeout((minLen - elapsed) * 1000);
    await d.clearAll(); // callouts stay up for the whole narration line
    const end = Date.now() / 1000;
    timeline.push({ ...scene, run: undefined, start, end, estNarration: minLen });
    console.log(`${(end - start).toFixed(1)}s`);
  }
  await page.waitForTimeout(400);
  const stopAt = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');

  const state = await context.storageState();
  await context.close();
  return { frames, timeline, stopAt, state };
}

function encode(name, frames, stopAt) {
  const dir = path.join(OUT, name);
  const fdir = path.join(dir, 'frames');
  fs.rmSync(fdir, { recursive: true, force: true });
  fs.mkdirSync(fdir, { recursive: true });
  const t0 = frames[0].ts;
  let list = '';
  frames.forEach((f, i) => {
    const file = path.join(fdir, `${String(i).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    const next = i + 1 < frames.length ? frames[i + 1].ts : stopAt;
    list += `file '${file}'\nduration ${Math.max(0.001, next - f.ts).toFixed(4)}\n`;
  });
  list += `file '${path.join(fdir, `${String(frames.length - 1).padStart(6, '0')}.jpg`)}'\n`;
  fs.writeFileSync(path.join(dir, 'frames.txt'), list);
  const out = path.join(dir, `${name}-demo.mp4`);
  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'frames.txt'),
    '-vf', `scale=${W}:${H}:flags=lanczos,fps=${FPS}`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
  ]);
  fs.rmSync(fdir, { recursive: true, force: true });
  fs.rmSync(path.join(dir, 'frames.txt'));
  return { out, t0 };
}

function writeScripts(video, timeline, t0, total) {
  const dir = path.join(OUT, video.id);
  const scenes = timeline.map((s) => ({
    id: s.id,
    title: s.title,
    narration: s.narration,
    start: +(s.start - t0).toFixed(2),
    end: +(s.end - t0).toFixed(2),
    estNarration: +s.estNarration.toFixed(1),
  }));
  fs.writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify({ video: video.id, duration: total, scenes }, null, 2));

  // Subtitles, one cue per narration line.
  const srt = scenes
    .map((s, i) => `${i + 1}\n${fmt(s.start)} --> ${fmt(Math.min(s.end, s.start + s.estNarration))}\n${s.narration}\n`)
    .join('\n');
  fs.writeFileSync(path.join(dir, 'captions.srt'), srt);

  // One paste-ready block for ElevenLabs, with <break> tags that pad each
  // line out to its scene length (ElevenLabs caps a single break at 3s).
  let el = '';
  scenes.forEach((s, i) => {
    el += s.narration;
    if (i < scenes.length - 1) {
      let gap = scenes[i + 1].start - s.start - (s.estNarration - LEAD_OUT);
      const breaks = [];
      while (gap > 0.25) {
        const b = Math.min(3, gap);
        breaks.push(`<break time="${b.toFixed(1)}s" />`);
        gap -= b;
      }
      el += ` ${breaks.join(' ')}\n\n`;
    }
  });
  fs.writeFileSync(path.join(dir, 'elevenlabs-single-take.txt'), el + '\n');
  return scenes;
}

function writeMarkdown(results) {
  let md = `# Demo voiceover script\n\nGenerated by \`demo/record.mjs\`. Each line starts at the timestamp shown in its video.\n\n`;
  md += `**Recommended ElevenLabs settings:** Multilingual v2 (or Turbo v2.5), a calm narrator voice, Stability ~50%, Similarity ~75%, Style 0–15%, Speaker boost on.\n\n`;
  md += `**Two ways to use it:**\n\n1. *Per-scene clips (most accurate):* generate each line below as its own clip, name it after the scene ID (e.g. \`A01.mp3\`), put the clips in one folder and run \`node voiceover.mjs --video admin --clips <folder>\`. It places every clip at its timestamp and exports a voiced MP4.\n2. *Single take:* paste \`output/<video>/elevenlabs-single-take.txt\` into ElevenLabs. It already contains \`<break>\` pauses sized to the scenes; nudge the audio in your editor if a line drifts.\n\n`;
  for (const { video, scenes, total } of results) {
    md += `## ${video.name} (\`output/${video.id}/${video.id}-demo.mp4\`, ${mmss(total)})\n\n| ID | Time | On screen | Narration |\n|---|---|---|---|\n`;
    for (const s of scenes) md += `| ${s.id} | ${mmss(s.start)}–${mmss(s.end)} | ${s.title} | ${s.narration} |\n`;
    md += '\n';
  }
  fs.writeFileSync(path.join(here, 'VOICEOVER_SCRIPT.md'), md);
}

const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const results = [];
let state;
for (const video of videos) {
  if (ONLY && video.id !== ONLY && !(ONLY === 'stakeholder' && video.id === 'admin')) continue;
  const record = ONLY === 'stakeholder' && video.id === 'admin' ? 'setup' : 'record';
  console.log(`${record === 'setup' ? 'Preparing' : 'Recording'} ${video.name}`);
  let storage;
  if (!video.fresh) {
    // Carry the Admin's project over, but start logged out.
    storage = {
      ...state,
      origins: state.origins.map((o) => ({ ...o, localStorage: o.localStorage.filter((e) => e.name !== 'user-storage') })),
    };
  }
  fs.mkdirSync(path.join(OUT, video.id), { recursive: true });
  const r = await recordVideo(browser, video, storage);
  state = r.state;
  if (record === 'setup') continue;
  const { out, t0 } = encode(video.id, r.frames, r.stopAt);
  const total = +(r.stopAt - t0).toFixed(2);
  const scenes = writeScripts(video, r.timeline, t0, total);
  results.push({ video, scenes, total });
  console.log(`  → ${path.relative(process.cwd(), out)} (${mmss(total)})`);
}
await browser.close();

if (results.length === videos.length) {
  // Both videos back to back.
  const list = path.join(OUT, 'concat.txt');
  fs.writeFileSync(list, results.map((r) => `file '${path.join(OUT, r.video.id, `${r.video.id}-demo.mp4`)}'`).join('\n'));
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(OUT, 'full-demo.mp4')]);
  fs.rmSync(list);
  writeMarkdown(results);
  console.log('Wrote output/full-demo.mp4 and VOICEOVER_SCRIPT.md');
}
