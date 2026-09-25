// Adds narration to the recorded demos, one clip per scene, each placed at
// the scene's start time from output/<video>/timeline.json.
//
// Generate with the ElevenLabs API:
//   ELEVENLABS_API_KEY=... node voiceover.mjs [--video admin|stakeholder|all] [--voice <voice_id>]
//
// Or use clips you made on elevenlabs.io, named after the scene IDs
// (A01.mp3, A02.mp3, ... S08.mp3):
//   node voiceover.mjs --clips ./my-clips

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const OUT = path.join(here, 'output');
const WHICH = opt('--video', 'all');
const CLIPS = opt('--clips', null);
const VOICE = opt('--voice', process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb'); // "George", a stock narrator voice
const MODEL = opt('--model', 'eleven_multilingual_v2');
const KEY = process.env.ELEVENLABS_API_KEY;

if (!CLIPS && !KEY) {
  console.error('Set ELEVENLABS_API_KEY, or pass --clips <folder> with A01.mp3, A02.mp3, ...');
  process.exit(1);
}

function duration(file) {
  const { stderr } = spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
}

async function synthesize(scene, prev, next, file) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: scene.narration,
      model_id: MODEL,
      // Neighbouring lines keep intonation consistent across separate clips.
      previous_text: prev?.narration,
      next_text: next?.narration,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} for ${scene.id}: ${await res.text()}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function voice(videoId) {
  const dir = path.join(OUT, videoId);
  const { scenes, duration: total } = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));
  const voiceDir = path.join(dir, 'voice');
  fs.mkdirSync(voiceDir, { recursive: true });

  const clips = [];
  for (const [i, s] of scenes.entries()) {
    let file;
    if (CLIPS) {
      file = ['mp3', 'wav', 'm4a'].map((ext) => path.join(CLIPS, `${s.id}.${ext}`)).find((f) => fs.existsSync(f));
      if (!file) throw new Error(`Missing clip for ${s.id} in ${CLIPS}`);
    } else {
      file = path.join(voiceDir, `${s.id}.mp3`);
      if (!fs.existsSync(file)) {
        process.stdout.write(`  ${s.id} synthesizing … `);
        await synthesize(s, scenes[i - 1], scenes[i + 1], file);
        console.log('ok');
      }
    }
    const len = duration(file);
    const room = s.end - s.start;
    if (len > room + 0.05) {
      console.warn(`  ! ${s.id} audio is ${len.toFixed(1)}s but the scene is ${room.toFixed(1)}s; it will overlap the next line. Lengthen the scene in scenes.mjs or trim the text.`);
    }
    clips.push({ file, start: s.start });
  }

  const video = path.join(dir, `${videoId}-demo.mp4`);
  const out = path.join(dir, `${videoId}-demo-voiced.mp4`);
  const inputs = clips.flatMap((c) => ['-i', c.file]);
  const delays = clips.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.start * 1000)}:all=1[a${i}]`).join(';');
  const mix = `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0,apad[aout]`;
  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error', '-i', video, ...inputs,
    '-filter_complex', `${delays};${mix}`,
    '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(total), out,
  ]);
  console.log(`  → ${path.relative(process.cwd(), out)}`);
  return out;
}

const ids = WHICH === 'all' ? ['admin', 'stakeholder'] : [WHICH];
const outs = [];
for (const id of ids) {
  console.log(`Voicing ${id}`);
  outs.push(await voice(id));
}
if (outs.length > 1) {
  const list = path.join(OUT, 'concat-voiced.txt');
  fs.writeFileSync(list, outs.map((o) => `file '${o}'`).join('\n'));
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(OUT, 'full-demo-voiced.mp4')]);
  fs.rmSync(list);
  console.log('  → output/full-demo-voiced.mp4');
}
