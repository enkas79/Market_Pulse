// Provider dati: SOLO endpoint pubblici aperti, senza API key né registrazione.
// Ogni fetcher restituisce { value, prev, asOf, source, freq } oppure lancia un Error leggibile.

const TIMEOUT_MS = 8000;

async function http(url, accept) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // credentials omit + no-referrer: nessun cookie o referrer verso terze parti.
    const res = await fetch(url, {
      signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: accept ? { Accept: accept } : undefined
    });
    if (res.status === 429) throw new Error('Rate limit (HTTP 429)');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Timeout' : e.message);
  } finally {
    clearTimeout(timer);
  }
}

// --- Yahoo Finance (endpoint JSON pubblico "chart", non ufficiale) ---
async function fromYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const json = await (await http(url)).json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error('Risposta Yahoo non valida');
  let value = meta.regularMarketPrice;
  let prev = meta.chartPreviousClose ?? meta.previousClose;
  // ^TNX storicamente quotato x10 (42.5 = 4.25%): normalizzo per sicurezza.
  if (symbol === '^TNX' && value > 20) { value /= 10; prev = prev / 10; }
  return { value, prev: prev ?? null, asOf: (meta.regularMarketTime || 0) * 1000, source: 'Yahoo', freq: 'daily' };
}

// --- BCE Data Portal (SDMX REST, formato jsondata) ---
// key = "DATAFLOW/CHIAVE_SERIE", es. "EXR/D.USD.EUR.SP00.A".
async function fromEcb(key, freq) {
  const url = `https://data-api.ecb.europa.eu/service/data/${key}?lastNObservations=2&format=jsondata`;
  const json = await (await http(url, 'application/json')).json();
  const series = Object.values(json?.dataSets?.[0]?.series || {})[0];
  const periods = json?.structure?.dimensions?.observation?.[0]?.values || [];
  const obs = Object.entries(series?.observations || {})
    .map(([i, v]) => ({ t: periods[Number(i)]?.id, v: v[0] }))
    .filter((o) => o.t && typeof o.v === 'number')
    .sort((a, b) => a.t.localeCompare(b.t));
  if (obs.length === 0) throw new Error('Nessun dato dalla BCE');
  const last = obs[obs.length - 1];
  return {
    value: last.v,
    prev: obs.length > 1 ? obs[obs.length - 2].v : null,
    asOf: Date.parse(last.t),   // "2026-08" o "2026-10-09"
    source: 'BCE',
    freq
  };
}

/** Prova le sorgenti dell'asset in ordine; restituisce la prima che funziona. */
export async function fetchAsset(asset) {
  const errors = [];
  for (const src of asset.sources) {
    try {
      if (src.type === 'yahoo') return await fromYahoo(src.symbol);
      if (src.type === 'ecb') return await fromEcb(src.key, src.freq);
    } catch (e) {
      errors.push(`${src.type}: ${e.message}`);
    }
  }
  throw new Error(errors.join(' | '));
}
