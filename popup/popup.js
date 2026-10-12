// Popup: renderizza SOLO dalla cache locale. Il fetch lo fa il service worker.
import { ASSETS, GROUP_LABELS } from '../lib/config.js';
import { getSettings, getCache } from '../lib/storage.js';
import { MARKETS, isMarketOpen } from '../lib/markets.js';

const $ = (id) => document.getElementById(id);
const fmt = (n, d) => n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });

// Calcola testo e classe (up/down/flat) della variazione in base al tipo di asset.
function change(asset, q) {
  if (q.prev == null) return { text: 'n/d', cls: 'flat' };
  const isBps = asset.kind === 'yield' || asset.kind === 'spread';
  const diff = q.value - q.prev;
  // Rendimenti: differenza in punti percentuali -> bps. Spread: già in bps.
  const delta = asset.kind === 'yield' ? diff * 100 : diff;
  const shown = isBps ? delta : (diff / q.prev) * 100;
  if (Math.abs(shown) < 0.005) return { text: isBps ? '0.0 bps' : '0.00%', cls: 'flat' };

  const sign = shown > 0 ? '+' : '';
  const text = isBps ? `${sign}${fmt(shown, 1)} bps` : `${sign}${fmt(shown, 2)}%`;
  const rising = shown > 0;
  let cls = rising ? 'up' : 'down';
  if (asset.tone === 'inverse') cls = rising ? 'down' : 'up';
  if (asset.tone === 'neutral') cls = 'flat';
  return { text, cls };
}

function valueText(asset, q) {
  const v = fmt(q.value, asset.decimals);
  if (asset.kind === 'yield') return `${v}%`;
  if (asset.kind === 'spread') return `${v} bps`;
  return v;
}

// Riga senza dati: nome + motivo dell'errore (visibile, non solo in tooltip).
function emptyRow(el, asset, error) {
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = asset.label;
  const err = document.createElement('small');
  err.className = 'err';
  err.textContent = error || 'in attesa di dati';
  err.title = error || '';
  name.appendChild(err);
  const v = document.createElement('span');
  v.className = 'value';
  v.textContent = 'n/d';
  el.append(name, v);
  return el;
}

function row(asset, q, error) {
  const el = document.createElement('div');
  el.className = 'row';
  if (!q) return emptyRow(el, asset, error);   // nessun dato in cache: mostro l'errore
  const c = change(asset, q);

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = asset.label;
  if (error) {                       // dato mostrato ma non aggiornato
    const warn = document.createElement('small');
    warn.textContent = '⚠ non aggiornato';
    warn.title = error;
    name.appendChild(warn);
  }
  if (q.freq === 'monthly') {        // dato non giornaliero: mostro il periodo di riferimento
    const sub = document.createElement('small');
    sub.className = 'sub';
    sub.textContent = `mensile · ${new Date(q.asOf).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}`;
    name.appendChild(sub);
  }

  const vals = document.createElement('div');
  vals.className = 'vals';
  const v = document.createElement('span');
  v.className = 'value';
  v.textContent = valueText(asset, q);
  const pill = document.createElement('span');
  pill.className = `pill ${c.cls}`;
  pill.textContent = c.text;
  vals.append(v, pill);

  el.append(name, vals);
  return el;
}

function renderMarkets() {
  const box = $('markets');
  box.replaceChildren(...MARKETS.map((m) => {
    const open = isMarketOpen(m);
    const chip = document.createElement('div');
    chip.className = `chip ${open ? 'open' : ''}`;
    chip.title = `${m.label}: ${open ? 'aperta' : 'chiusa'}`;
    const dot = document.createElement('span');
    dot.className = 'dot';
    chip.append(dot, document.createTextNode(m.label));
    return chip;
  }));
}

async function render() {
  const [settings, cache] = await Promise.all([getSettings(), getCache()]);
  const content = $('content');
  content.replaceChildren();
  renderMarkets();

  const enabled = ASSETS.filter((a) => settings.enabledAssets.includes(a.id));
  let shown = 0;
  for (const group of Object.keys(GROUP_LABELS)) {
    const rows = enabled
      .filter((a) => a.group === group && (cache.data[a.id] || cache.errors[a.id]))
      .map((a) => row(a, cache.data[a.id], cache.errors[a.id]));
    if (!rows.length) continue;
    const card = document.createElement('section');
    card.className = 'card';
    const h = document.createElement('h2');
    h.textContent = GROUP_LABELS[group];
    card.append(h, ...rows);
    content.appendChild(card);
    shown += rows.length;
  }

  if (!shown) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = cache.updatedAt ? 'Nessun dato disponibile.' : 'Caricamento dati…';
    content.appendChild(empty);
  }

  // Footer: orario ultimo aggiornamento + avviso se ci sono errori.
  const errCount = Object.keys(cache.errors).length;
  const time = cache.updatedAt
    ? new Date(cache.updatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : '—';
  $('status').textContent = `Aggiornato alle ${time}` + (errCount ? ` · ${errCount} fonti con errori` : '');
  document.querySelector('footer').classList.toggle('stale', errCount > 0);

  return { settings, cache };
}

async function requestRefresh(force) {
  const btn = $('refresh');
  btn.classList.add('spin');
  try {
    await chrome.runtime.sendMessage({ type: 'refresh', force });
  } catch (_) { /* service worker non raggiungibile: resta la cache */ }
  btn.classList.remove('spin');
}

$('refresh').addEventListener('click', () => requestRefresh(true));
$('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

// Re-render automatico quando il service worker aggiorna la cache.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.cache || changes.settings)) render();
});

(async () => {
  const { settings, cache } = await render();
  // All'apertura: rete solo se la cache è più vecchia dell'intervallo configurato.
  const age = Date.now() - cache.updatedAt;
  if (age > settings.refreshMinutes * 60_000) requestRefresh(false);
})();
