// Accesso a chrome.storage.local. Tutto resta sul dispositivo (niente sync, niente cloud).
import { DEFAULT_SETTINGS } from './config.js';

// Incrementare quando cambia la struttura/fonti dei dati: invalida la cache salvata da versioni precedenti.
const CACHE_VERSION = 2;
const EMPTY_CACHE = { data: {}, errors: {}, updatedAt: 0, lastAttempt: 0 };

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export const saveSettings = (settings) => chrome.storage.local.set({ settings });

export async function getCache() {
  const { cache } = await chrome.storage.local.get('cache');
  if (!cache || cache.v !== CACHE_VERSION) return { ...EMPTY_CACHE };
  return { ...EMPTY_CACHE, ...cache };
}

export const saveCache = (cache) => chrome.storage.local.set({ cache: { ...cache, v: CACHE_VERSION } });
