// Genera icone, screenshot, riquadri promozionali e video demo per il Chrome Web Store.
// Uso:  NODE_PATH=$(npm root -g) node store/build_assets.mjs
// Richiede Playwright (Chromium) e ffmpeg. Il popup/options REALI vengono renderizzati con un
// `chrome` finto (storage, i18n) e dati di esempio: nessuna rete. Output in store/assets/.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'store', 'assets');
const TMP = path.join(OUT, '.tmp');
fs.mkdirSync(TMP, { recursive: true });

// ---------- server statico ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

// ---------- chrome finto (eseguito nella pagina) ----------
function stub(opts) {
  const { lang, mode } = opts;                       // mode: 'full' (cache piena) | 'empty' (si riempie dopo il refresh)
  const FIXED = Date.parse('2026-10-12T08:25:00Z');  // 10:25 a Milano: Milano/Francoforte aperte, New York chiusa
  const R = Date;
  window.Date = class extends R {
    constructor(...a) { if (a.length) super(...a); else super(FIXED); }
    static now() { return FIXED; }
  };
  const x = new XMLHttpRequest();
  x.open('GET', `/_locales/${lang}/messages.json`, false); x.send();
  const MSG = JSON.parse(x.responseText);
  const mo = Date.parse('2026-09-01');
  const q = (value, prev, asOf, source, freq) => ({ value, prev, asOf, source, freq, fetchedAt: FIXED });
  const data = {
    btp10: q(4.36, 3.984, mo, 'BCE', 'monthly'), bund10: q(3.47, 3.182, mo, 'BCE', 'monthly'),
    spread: q(89, 80.2, mo, 'BCE', 'monthly'), ust10: q(5.24, 5.227, FIXED, 'Yahoo', 'daily'),
    vix: q(15.39, 14.84, FIXED, 'Yahoo', 'daily'), spx: q(7811.54, 7765.7, FIXED, 'Yahoo', 'daily'),
    vwce: q(173.60, 172.85, FIXED, 'Yahoo', 'daily'), eurusd: q(1.1206, 1.1186, FIXED, 'BCE', 'daily'),
    ftsemib: q(50066, 49745, FIXED, 'Yahoo', 'daily'), dax: q(25211, 25089, FIXED, 'Yahoo', 'daily')
  };
  const store = { settings: { enabledAssets: Object.keys(data), refreshMinutes: 15, badgeMode: 'spread' } };
  const full = () => ({ v: 2, data, errors: {}, updatedAt: FIXED, lastAttempt: FIXED });
  if (mode === 'full') store.cache = full();
  const listeners = [];
  window.chrome = {
    i18n: {
      getUILanguage: () => lang,
      getMessage: (k, subs) => {
        const e = MSG[k]; if (!e) return '';
        const a = subs === undefined ? [] : [].concat(subs);
        return e.message.replace(/\$P(\d)\$/g, (_, i) => a[i - 1] ?? '');
      }
    },
    storage: {
      local: { get: async (k) => ({ [k]: store[k] }), set: async (o) => { Object.assign(store, o); } },
      onChanged: { addListener: (f) => listeners.push(f) }
    },
    runtime: {
      getManifest: () => ({ version: '1.1.0' }),
      openOptionsPage() {},
      sendMessage: async () => {                      // simula il fetch del service worker
        await new Promise((r) => setTimeout(r, store.cache ? 1000 : 1500));
        store.cache = full();
        listeners.forEach((f) => f({ cache: {} }, 'local'));
        parent.postMessage({ type: 'filled' }, '*');
        return { ok: true };
      }
    }
  };
}

const browser = await chromium.launch();
const ctxOpts = (lang, scheme, w, h, extra = {}) => ({
  viewport: { width: w, height: h }, colorScheme: scheme, timezoneId: 'Europe/Rome',
  locale: lang === 'it' ? 'it-IT' : 'en-US', ...extra
});

// ---------- 1. icone ----------
const ICON_SVG = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 128 128">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a63c9"/><stop offset="1" stop-color="#0d2757"/></linearGradient></defs>
<rect width="128" height="128" rx="28" fill="url(#g)"/>
<polyline points="14,72 38,72 52,34 76,100 90,56 99,72 114,72" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="114" cy="72" r="0" fill="#3ddc97"/></svg>`;
async function renderIcons() {
  const ctx = await browser.newContext({ viewport: { width: 128, height: 128 } });
  const page = await ctx.newPage();
  for (const s of [16, 48, 128]) {
    await page.setViewportSize({ width: s, height: s });
    await page.setContent(`<body style="margin:0;background:transparent">${ICON_SVG(s)}</body>`);
    await page.screenshot({ path: path.join(ROOT, 'icons', `icon${s}.png`), omitBackground: true });
  }
  await ctx.close();
}
await renderIcons();
const iconB64 = fs.readFileSync(path.join(ROOT, 'icons', 'icon128.png')).toString('base64');
const ICON = `data:image/png;base64,${iconB64}`;

// ---------- 2. catture di popup/options (PNG @2x) ----------
async function capture(lang, scheme, kind) {
  const file = path.join(TMP, `${kind}-${lang}-${scheme}.png`);
  const ctx = await browser.newContext(ctxOpts(lang, scheme, kind === 'popup' ? 340 : 460, 900, { deviceScaleFactor: 2 }));
  await ctx.addInitScript(stub, { lang, mode: 'full' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${kind}/${kind}.html`);
  await page.waitForSelector(kind === 'popup' ? '.card' : '#assets input');
  await page.waitForTimeout(400);
  await page.locator('body').screenshot({ path: file });
  await ctx.close();
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
}

// ---------- 3. composizioni ----------
const COPY = {
  en: {
    tag: 'Markets at a glance', sub: 'Yields, BTP/Bund spread, VIX, indices and FX — one click away.',
    s2: 'BTP/Bund spread on your toolbar', s2sub: 'The badge shows the spread in bps (or the VIX) without opening anything.',
    s3: 'Light, dark, yours', s3sub: 'Pick the assets, the refresh interval and the badge value.',
    s4: 'Private by design',
    bullets: ['No tracking, no analytics', 'No accounts, no API keys', 'Only public sources: Yahoo Finance & ECB', 'Data stays in your browser'],
    mini: 'Yields · Spread · VIX · FX', cap1: 'Markets at a glance', cap2: 'BTP/Bund spread right on the icon',
    cap3: 'Dark mode included', cap4: 'No tracking · No API keys · Public data only', open: 'Click the icon'
  },
  it: {
    tag: "Mercati a colpo d'occhio", sub: 'Rendimenti, spread BTP/Bund, VIX, indici e cambi — a un clic.',
    s2: 'Lo spread BTP/Bund sulla toolbar', s2sub: 'Il badge mostra lo spread in bps (o il VIX) senza aprire nulla.',
    s3: 'Chiaro, scuro, a modo tuo', s3sub: 'Scegli asset, intervallo di aggiornamento e valore del badge.',
    s4: 'Privacy by design',
    bullets: ['Nessun tracking, nessuna analisi', 'Nessun account, nessuna API key', 'Solo fonti pubbliche: Yahoo Finance e BCE', 'I dati restano nel tuo browser'],
    mini: 'Rendimenti · Spread · VIX · Cambi', cap1: "Mercati a colpo d'occhio", cap2: "Lo spread BTP/Bund direttamente sull'icona",
    cap3: 'Tema scuro incluso', cap4: 'Nessun tracking · Nessuna API key · Solo dati pubblici', open: "Clicca l'icona"
  }
};
const CSS = `*{box-sizing:border-box;margin:0}body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;
background:linear-gradient(135deg,#1d4fa6 0%,#0c2552 100%);overflow:hidden;position:relative}
.shot{border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.12);display:block}
h1{font-weight:750;letter-spacing:-.02em;line-height:1.05}p{opacity:.85;line-height:1.35}
.abs{position:absolute}.glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.35;background:#3ddc97}`;
const html = (w, h, body) => `<!doctype html><meta charset="utf-8"><style>${CSS}body{width:${w}px;height:${h}px}</style><body>${body}</body>`;

async function shoot(name, w, h, body) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.setContent(html(w, h, body));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, name) });
  await ctx.close();
}

for (const lang of ['en', 'it']) {
  const c = COPY[lang];
  const pl = await capture(lang, 'light', 'popup');
  const pd = await capture(lang, 'dark', 'popup');
  const ol = await capture(lang, 'light', 'options');

  // Screenshot 1280x800
  await shoot(`screenshot-1-${lang}.png`, 1280, 800, `
    <div class="glow" style="width:420px;height:420px;left:60px;top:300px"></div>
    <div class="abs" style="left:90px;top:230px;width:560px"><img src="${ICON}" width="72" style="border-radius:16px;margin-bottom:28px">
      <h1 style="font-size:64px">${c.tag}</h1><p style="font-size:26px;margin-top:22px">${c.sub}</p></div>
    <img class="shot abs" src="${pl}" style="right:120px;top:70px;height:660px">`);

  await shoot(`screenshot-2-${lang}.png`, 1280, 800, `
    <div class="glow" style="width:420px;height:420px;left:60px;top:300px"></div>
    <div class="abs" style="left:90px;top:250px;width:560px"><h1 style="font-size:58px">${c.s2}</h1><p style="font-size:26px;margin-top:22px">${c.s2sub}</p></div>
    <div class="abs" style="right:110px;top:50px;width:380px;height:58px;background:#f1f3f4;border-radius:29px;display:flex;align-items:center;justify-content:flex-end;padding-right:16px;gap:14px;box-shadow:0 8px 24px rgba(0,0,0,.35)">
      <div style="width:130px;height:8px;border-radius:4px;background:#c7ccd1;margin-right:auto;margin-left:24px"></div>
      <div style="position:relative;width:40px;height:40px"><img src="${ICON}" width="36" style="margin:2px;border-radius:9px">
        <span style="position:absolute;right:-8px;bottom:-4px;background:#1a9c5b;color:#fff;font:700 15px/1 system-ui;padding:3px 5px;border-radius:5px">89</span></div>
      <div style="width:30px;height:30px;border-radius:50%;background:#d0d5da"></div></div>
    <img class="shot abs" src="${pl}" style="right:120px;top:130px;height:620px">`);

  await shoot(`screenshot-3-${lang}.png`, 1280, 800, `
    <div class="abs" style="left:0;right:0;top:50px;text-align:center"><h1 style="font-size:52px">${c.s3}</h1><p style="font-size:24px;margin-top:14px">${c.s3sub}</p></div>
    <div class="abs" style="left:0;right:0;top:200px;display:flex;justify-content:center;gap:34px;align-items:flex-start">
      <img class="shot" src="${pl}" style="height:540px"><img class="shot" src="${pd}" style="height:540px"><img class="shot" src="${ol}" style="height:480px"></div>`);

  await shoot(`screenshot-4-${lang}.png`, 1280, 800, `
    <div class="glow" style="width:520px;height:520px;right:40px;top:140px"></div>
    <div class="abs" style="left:90px;top:200px;width:480px"><img src="${ICON}" width="96" style="border-radius:22px;margin-bottom:30px"><h1 style="font-size:64px">${c.s4}</h1></div>
    <div class="abs" style="right:90px;top:170px;width:560px;display:flex;flex-direction:column;gap:22px">
      ${c.bullets.map((b) => `<div style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:26px 30px;font-size:27px;font-weight:600;display:flex;gap:18px;align-items:center"><span style="color:#3ddc97;font-size:34px">✓</span>${b}</div>`).join('')}</div>`);

  // Riquadro piccolo 440x280
  await shoot(`promo-small-${lang}.png`, 440, 280, `
    <div class="abs" style="left:28px;top:44px;width:230px"><img src="${ICON}" width="52" style="border-radius:12px;margin-bottom:14px">
      <h1 style="font-size:30px">Market Pulse</h1><p style="font-size:14px;margin-top:10px">${c.mini}</p></div>
    <img class="shot abs" src="${pl}" style="left:268px;top:36px;width:200px;border-radius:10px">`);

  // Riquadro in primo piano 1400x560
  await shoot(`promo-marquee-${lang}.png`, 1400, 560, `
    <div class="glow" style="width:380px;height:380px;left:80px;top:200px"></div>
    <div class="abs" style="left:90px;top:130px;width:620px"><div style="display:flex;align-items:center;gap:20px;margin-bottom:26px"><img src="${ICON}" width="76" style="border-radius:18px"><h1 style="font-size:56px">Market Pulse</h1></div>
      <h1 style="font-size:46px;font-weight:650">${c.tag}</h1><p style="font-size:24px;margin-top:18px">${c.sub}</p></div>
    <img class="shot abs" src="${pl}" style="left:790px;top:60px;width:260px"><img class="shot abs" src="${pd}" style="left:1080px;top:110px;width:260px">`);
}

// ---------- 4. video demo (1280x720, ~25 s) ----------
const VCSS = `*{box-sizing:border-box;margin:0}
:root{--bg:#e9edf3;--bar:#fff;--text:#14171c;--sub:#5c6573}
@media (prefers-color-scheme:dark){:root{--bg:#10151c;--bar:#1d2229;--text:#e8eaed;--sub:#98a0ab}}
body{width:1280px;height:720px;overflow:hidden;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;transition:background .6s}
.bar{position:absolute;left:0;right:0;top:0;height:64px;background:var(--bar);display:flex;align-items:center;padding:0 24px;gap:14px;box-shadow:0 1px 0 rgba(128,128,128,.25)}
.dot{width:12px;height:12px;border-radius:50%;background:#ff5f57}.dot:nth-child(2){background:#febc2e}.dot:nth-child(3){background:#28c840}
.url{flex:1;height:34px;border-radius:17px;background:rgba(128,128,128,.18);margin:0 18px}
#ext{position:relative;width:40px;height:40px;border-radius:8px;display:grid;place-items:center;transition:background .2s}
#ext.pressed{background:rgba(128,128,128,.35)}
#ext img{width:30px;border-radius:7px}
#badge{position:absolute;right:-2px;bottom:-2px;background:#1a9c5b;color:#fff;font:700 13px/1 system-ui;padding:2px 4px;border-radius:4px;display:none}
#pop{position:absolute;right:30px;top:74px;width:340px;height:60px;border:0;border-radius:10px;box-shadow:0 20px 50px rgba(0,0,0,.35);opacity:0;transform:translateY(-10px);transition:opacity .35s,transform .35s;background:transparent}
#pop.show{opacity:1;transform:none}
#cap{position:absolute;left:70px;top:300px;width:620px;font-size:46px;font-weight:750;letter-spacing:-.02em;line-height:1.1;opacity:0;transition:opacity .5s}
#cap.show{opacity:1}
#title{position:absolute;inset:0;background:linear-gradient(135deg,#1d4fa6,#0c2552);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;transition:opacity .6s;text-align:center}
#title img{width:110px;border-radius:26px}#title h1{font-size:68px;letter-spacing:-.02em}#title p{font-size:28px;opacity:.85;max-width:900px}
#title.hide{opacity:0;pointer-events:none}`;
for (const lang of ['en', 'it']) {
  const c = COPY[lang];
  const ctx = await browser.newContext({ ...ctxOpts(lang, 'light', 1280, 720), recordVideo: { dir: TMP, size: { width: 1280, height: 720 } } });
  await ctx.addInitScript(stub, { lang, mode: 'empty' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/store/blank.html`);
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${VCSS}</style>
  <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><div class="url"></div>
   <div id="ext"><img src="${ICON}"><span id="badge">89</span></div></div>
  <div id="cap"></div><iframe id="pop"></iframe>
  <div id="title"><img src="${ICON}"><h1>Market Pulse</h1><p>${c.sub}</p></div>`);
  await page.evaluate((base) => {
    const pop = document.getElementById('pop');
    pop.dataset.src = `${base}/popup/popup.html`;
    setInterval(() => { try { const d = pop.contentDocument; if (d && d.body) pop.style.height = Math.min(640, d.documentElement.scrollHeight) + 'px'; } catch (e) {} }, 150);
    addEventListener('message', (e) => { if (e.data && e.data.type === 'filled') document.getElementById('badge').style.display = 'block'; });
    window.cap = (t) => { const el = document.getElementById('cap'); el.classList.remove('show'); setTimeout(() => { el.textContent = t || ''; if (t) el.classList.add('show'); }, 350); };
  }, BASE);
  const wait = (ms) => page.waitForTimeout(ms);
  await wait(2800);
  await page.evaluate(() => document.getElementById('title').classList.add('hide'));
  await wait(1200);
  await page.evaluate((t) => cap(t), c.open);
  await wait(1200);
  await page.evaluate(() => { document.getElementById('ext').classList.add('pressed'); const p = document.getElementById('pop'); p.src = p.dataset.src; p.classList.add('show'); });
  await wait(300);
  await page.evaluate(() => document.getElementById('ext').classList.remove('pressed'));
  await wait(3200);
  await page.evaluate((t) => cap(t), c.cap1);
  await wait(3500);
  await page.evaluate((t) => cap(t), c.cap2);
  await page.evaluate(() => document.getElementById('badge').style.outline = '3px solid #ffd54a');
  await wait(3500);
  await page.evaluate(() => document.getElementById('badge').style.outline = 'none');
  await page.frames().find((f) => f.url().includes('popup.html'))?.click('#refresh');   // refresh manuale
  await wait(2200);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate((t) => cap(t), c.cap3);
  await wait(3500);
  await page.evaluate(() => document.getElementById('pop').classList.remove('show'));
  await page.evaluate(() => cap(''));
  await wait(600);
  await page.evaluate((t) => { const el = document.getElementById('title'); el.querySelector('p').textContent = t; el.classList.remove('hide'); }, c.cap4);
  await wait(3200);
  const vpath = await page.video().path();
  await ctx.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', vpath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-an', path.join(OUT, `demo-${lang}.mp4`)]);
}

await browser.close();
server.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log(fs.readdirSync(OUT).join('\n'));
