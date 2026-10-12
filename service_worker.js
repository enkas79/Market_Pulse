// Service worker: allarmi, fetch, cache e badge. Nessun processo persistente:
// il worker si sveglia solo per l'allarme, i messaggi del popup o le modifiche alle opzioni.
import { ASSETS, getAsset } from './lib/config.js';
import { getSettings, getCache, saveCache } from './lib/storage.js';
import { fetchAsset } from './lib/providers.js';
import { anyMarketOpen } from './lib/markets.js';

const ALARM = 'refresh';
const MIN_GAP_MS = 30_000;            // anti-spam: max un giro di fetch ogni 30s
const MAX_IDLE_MS = 6 * 3600_000;     // a mercati chiusi aggiorno comunque se il dato ha >6h

// ---------- Allarmi ----------
async function scheduleAlarm() {
  const { refreshMinutes } = await getSettings();
  await chrome.alarms.create(ALARM, { periodInMinutes: refreshMinutes });
}

chrome.runtime.onInstalled.addListener(async () => {
  await scheduleAlarm();
  await refreshAll({ force: true });
});
chrome.runtime.onStartup.addListener(scheduleAlarm);

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  const cache = await getCache();
  // Risparmio: se tutte le borse sono chiuse e il dato è recente, salto il giro.
  if (!anyMarketOpen() && Date.now() - cache.updatedAt < MAX_IDLE_MS) return;
  await refreshAll();
});

// Modifica opzioni -> riprogramma allarme, aggiorna subito dati e badge.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    scheduleAlarm().then(() => refreshAll({ force: true }));
  }
});

// Richieste dal popup.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'refresh') {
    refreshAll({ force: !!msg.force })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true; // risposta asincrona
  }
});

// ---------- Refresh ----------
let inflight = null; // evita giri paralleli (alarm + popup)

function refreshAll(opts = {}) {
  if (!inflight) {
    inflight = doRefresh(opts)
      .catch(async (e) => {
        // Errore imprevisto: lo salvo in cache così il popup lo mostra invece di restare in "Caricamento".
        console.error('Market Pulse refresh failed', e);
        const cache = await getCache();
        await saveCache({ ...cache, errors: { ...cache.errors, _global: String(e?.message || e) }, lastAttempt: Date.now() });
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

async function doRefresh({ force = false } = {}) {
  const settings = await getSettings();
  const cache = await getCache();
  if (!force && Date.now() - cache.lastAttempt < MIN_GAP_MS) return;

  // Asset da scaricare = abilitati + dipendenze dei derivati + asset del badge.
  const wanted = new Set(settings.enabledAssets);
  if (settings.badgeMode === 'spread') wanted.add('spread');
  if (settings.badgeMode === 'vix') wanted.add('vix');
  for (const id of [...wanted]) getAsset(id)?.derived?.forEach((d) => wanted.add(d));
  const toFetch = ASSETS.filter((a) => wanted.has(a.id) && !a.derived);

  const results = await Promise.allSettled(toFetch.map((a) => fetchAsset(a)));

  const data = { ...cache.data };
  const errors = {};
  results.forEach((r, i) => {
    const id = toFetch[i].id;
    if (r.status === 'fulfilled') data[id] = { ...r.value, fetchedAt: Date.now() };
    else errors[id] = r.reason.message; // il vecchio dato in cache resta (fallback elegante)
  });

  // Spread BTP/Bund in punti base, calcolato dai due rendimenti.
  const btp = data.btp10, bund = data.bund10;
  if (btp && bund) {
    data.spread = {
      value: (btp.value - bund.value) * 100,
      prev: btp.prev != null && bund.prev != null ? (btp.prev - bund.prev) * 100 : null,
      asOf: Math.min(btp.asOf, bund.asOf),
      source: `${btp.source}`,
      fetchedAt: Date.now()
    };
    if (errors.btp10 || errors.bund10) errors.spread = errors.btp10 || errors.bund10;
  }

  const anyOk = results.some((r) => r.status === 'fulfilled');
  await saveCache({
    data, errors,
    lastAttempt: Date.now(),
    updatedAt: anyOk ? Date.now() : cache.updatedAt
  });
  await updateBadge(settings, data);
}

// ---------- Badge ----------
const COLORS = { green: '#1a9c5b', amber: '#d98a00', red: '#d6333b', grey: '#6b7280' };

async function updateBadge(settings, data) {
  const mode = settings.badgeMode;
  const quote = mode === 'spread' ? data.spread : mode === 'vix' ? data.vix : null;
  if (mode === 'none' || !quote) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const v = quote.value;
  let text, color;
  if (mode === 'spread') {            // bps: <150 calmo, <250 attenzione, oltre stress
    text = String(Math.round(v));
    color = v < 150 ? COLORS.green : v < 250 ? COLORS.amber : COLORS.red;
  } else {                            // VIX: <20 calmo, <30 attenzione, oltre stress
    text = v >= 100 ? String(Math.round(v)) : v.toFixed(1);
    color = v < 20 ? COLORS.green : v < 30 ? COLORS.amber : COLORS.red;
  }
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setTitle({
    title: mode === 'spread' ? `Spread BTP/Bund: ${text} bps` : `VIX: ${text}`
  });
}
