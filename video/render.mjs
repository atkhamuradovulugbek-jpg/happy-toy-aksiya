// Sahnani kadrma-kadr render qilib, MP4 yig'adi.
//   node render.mjs                 — to'liq video (build/frames → out/*.mp4)
//   node render.mjs --stills 0,300  — faqat tekshiruv kadrlari (build/stills)
//   node render.mjs --workers 3     — parallel brauzerlar soni
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

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const QUERY = opt('query', '') ? '?' + opt('query', '') : '';
const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/timeline.json'), 'utf8'));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/scene/index.html';
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404;
    return res.end('not found');
  }
  res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  let fail;
  const failed = new Promise((_, rej) => (fail = rej));
  page.on('pageerror', (e) => fail(new Error('Sahna xatosi: ' + e.message)));
  page.on('console', (m) => m.type() === 'error' && console.error('CONSOLE', m.text()));
  await page.goto(`http://localhost:${PORT}/scene/index.html${QUERY}`);
  await Promise.race([page.waitForFunction('window.ready === true', null, { timeout: 120000 }), failed]);
  return page;
}

const launch = () =>
  chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });

async function renderFrames(frames, outDir, workerId, log) {
  const browser = await launch();
  const page = await openPage(browser);
  let n = 0;
  const t0 = Date.now();
  for (const f of frames) {
    const info = await page.evaluate((fr) => window.renderAt(fr), f);
    await page.screenshot({ path: path.join(outDir, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
    n++;
    if (log && n % 150 === 0) {
      const rate = (Date.now() - t0) / n;
      console.log(`[w${workerId}] ${n}/${frames.length} kadr, ${rate.toFixed(0)} ms/kadr, qoldi ~${(((frames.length - n) * rate) / 60000).toFixed(1)} daqiqa  (${info.id})`);
    }
  }
  await browser.close();
}

const stills = opt('stills', null);
if (stills) {
  const out = path.join(ROOT, 'build/stills');
  fs.mkdirSync(out, { recursive: true });
  const list = stills.split(',').map((s) => (s.endsWith('s') ? Math.round(parseFloat(s) * timeline.fps) : parseInt(s, 10)));
  await renderFrames(list, out, 0, false);
  console.log('Tayyor:', list.map((f) => `build/stills/${String(f).padStart(5, '0')}.jpg`).join(' '));
  server.close();
  process.exit(0);
}

const total = timeline.frames;
const from = parseInt(opt('from', '0'), 10);
const to = parseInt(opt('to', String(total)), 10);
const workers = parseInt(opt('workers', '3'), 10);
const frameDir = path.join(ROOT, 'build/frames');
fs.mkdirSync(frameDir, { recursive: true });
const todo = [];
for (let f = from; f < to; f++) if (!fs.existsSync(path.join(frameDir, `${String(f).padStart(5, '0')}.jpg`))) todo.push(f);
console.log(`Render: ${todo.length} kadr (${from}..${to}), ${workers} ta parallel brauzer`);
const chunks = Array.from({ length: workers }, (_, i) => todo.filter((_, k) => k % workers === i));
await Promise.all(chunks.map((c, i) => renderFrames(c, frameDir, i, true)));
server.close();

if (from === 0 && to === total) {
  const outDir = path.join(ROOT, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, opt('out', 'pulim-yoq-spin.mp4'));
  const r = spawnSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', String(timeline.fps), '-i', path.join(frameDir, '%05d.jpg'),
    '-i', path.join(ROOT, 'build/audio.wav'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    '-shortest', '-movflags', '+faststart', out,
  ], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status);
  console.log('Video tayyor:', out);
}
