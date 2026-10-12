// Provider dati: tutti endpoint pubblici, nessun tracking. Ogni fetcher restituisce
// { value, prev, asOf, source } oppure lancia un Error con messaggio leggibile.

const TIMEOUT_MS = 8000;

async function http(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // credentials omit + no-referrer: nessun cookie o referrer verso terze parti.
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (res.status === 429) throw new Error('Rate limit (HTTP 429)');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Timeout' : e.message);
  } finally {
    clearTimeout(timer);
  }
}

// --- Yahoo Finance (endpoint JSON pubblico "chart", senza chiave) ---
async function fromYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const json = await (await http(url)).json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error('Risposta Yahoo non valida');
  let value = meta.regularMarketPrice;
  let prev = meta.chartPreviousClose ?? meta.previousClose;
  // ^TNX storicamente quotato x10 (42.5 = 4.25%): normalizzo per sicurezza.
  if (symbol === '^TNX' && value > 20) { value /= 10; prev = prev / 10; }
  return { value, prev: prev ?? null, asOf: (meta.regularMarketTime || 0) * 1000, source: 'Yahoo' };
}

// --- Stooq (CSV storico giornaliero, usato per i rendimenti BTP/Bund) ---
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

async function fromStooq(symbol) {
  const now = new Date();
  const from = new Date(now.getTime() - 14 * 86400000);
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d&d1=${ymd(from)}&d2=${ymd(now)}`;
  const text = await (await http(url)).text();
  // Colonne: Date,Open,High,Low,Close[,Volume]
  const rows = text.trim().split('\n').slice(1)
    .map((l) => l.split(','))
    .filter((c) => c.length >= 5 && Number.isFinite(parseFloat(c[4])));
  if (rows.length === 0) throw new Error('Nessun dato da Stooq');
  const last = rows[rows.length - 1];
  const prev = rows.length > 1 ? parseFloat(rows[rows.length - 2][4]) : null;
  return { value: parseFloat(last[4]), prev, asOf: Date.parse(last[0]), source: 'Stooq' };
}

// --- FRED (richiede API key gratuita; serie OCSE mensili: fallback, dato non giornaliero) ---
async function fromFred(symbol, apiKey) {
  if (!apiKey) throw new Error('API key FRED mancante');
  const url = 'https://api.stlouisfed.org/fred/series/observations'
    + `?series_id=${encodeURIComponent(symbol)}&api_key=${encodeURIComponent(apiKey)}`
    + '&file_type=json&sort_order=desc&limit=5';
  const json = await (await http(url)).json();
  const obs = (json.observations || []).filter((o) => o.value !== '.');
  if (obs.length === 0) throw new Error('Nessun dato da FRED');
  return {
    value: parseFloat(obs[0].value),
    prev: obs[1] ? parseFloat(obs[1].value) : null,
    asOf: Date.parse(obs[0].date),
    source: 'FRED (mensile)'
  };
}

/** Prova le sorgenti dell'asset in ordine; restituisce la prima che funziona. */
export async function fetchAsset(asset, settings) {
  const errors = [];
  for (const src of asset.sources) {
    try {
      if (src.type === 'yahoo') return await fromYahoo(src.symbol);
      if (src.type === 'stooq') return await fromStooq(src.symbol);
      if (src.type === 'fred') return await fromFred(src.symbol, settings.fredApiKey);
    } catch (e) {
      errors.push(`${src.type}: ${e.message}`);
    }
  }
  throw new Error(errors.join(' | '));
}
