// Doska sahnasini kadrma-kadr render qilib, MP4 yig'adi.
//   node doska/render.mjs --s demo                 — to'liq video (doska/out/demo.mp4)
//   node doska/render.mjs --s demo --stills 2,8,15 — tekshiruv kadrlari (soniyada)
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d);
const SCENE = opt('s', 'demo');
const BUILD = path.join(HERE, 'build', SCENE);
fs.mkdirSync(BUILD, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404;
    return res.end();
  }
  res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));

async function open() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  let fail;
  const failed = new Promise((_, rej) => (fail = rej));
  page.on('pageerror', (e) => fail(new Error('Sahna xatosi: ' + e.message)));
  await page.goto(`http://localhost:${server.address().port}/doska/index.html?s=${SCENE}`);
  await Promise.race([page.waitForFunction('window.ready === true', null, { timeout: 60000 }), failed]);
  return { browser, page };
}

async function renderFrames(frames, dir) {
  const { browser, page } = await open();
  for (const f of frames) {
    await page.evaluate((fr) => window.renderAt(fr), f);
    await page.screenshot({ path: path.join(dir, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
  }
  const meta = await page.evaluate(() => ({ strokes: window.STROKES, frames: window.TOTAL_FRAMES }));
  await browser.close();
  return meta;
}

const stills = opt('stills', null);
if (stills) {
  const dir = path.join(BUILD, 'stills');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  await renderFrames(stills.split(',').map((s) => Math.round(parseFloat(s) * 30)), dir);
  console.log('Tayyor:', dir);
  server.close();
  process.exit(0);
}

const probe = await open();
const meta = await probe.page.evaluate(() => ({ strokes: window.STROKES, frames: window.TOTAL_FRAMES }));
await probe.browser.close();
const dir = path.join(BUILD, 'frames');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const workers = parseInt(opt('workers', '3'), 10);
const all = Array.from({ length: meta.frames }, (_, i) => i);
const t0 = Date.now();
await Promise.all(Array.from({ length: workers }, (_, w) => renderFrames(all.filter((f) => f % workers === w), dir)));
console.log(`${meta.frames} kadr, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
server.close();

fs.writeFileSync(path.join(BUILD, 'strokes.json'), JSON.stringify(meta));
const voice = opt('voice', '');
const audio = path.join(BUILD, 'audio.wav');
const sceneVoice = voice || (fs.existsSync(path.join(BUILD, 'voice.wav')) ? path.join(BUILD, 'voice.wav') : '');
let r = spawnSync('python3', [path.join(HERE, 'audio.py'), path.join(BUILD, 'strokes.json'), audio, sceneVoice], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);
const outDir = path.join(HERE, 'out');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${SCENE}.mp4`);
r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(dir, '%05d.jpg'), '-i', audio,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k',
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);
console.log('Video tayyor:', out);
