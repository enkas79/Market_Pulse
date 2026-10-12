// Accesso a chrome.storage.local. Tutto resta sul dispositivo (niente sync, niente cloud).
import { DEFAULT_SETTINGS } from './config.js';

const EMPTY_CACHE = { data: {}, errors: {}, updatedAt: 0, lastAttempt: 0 };

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export const saveSettings = (settings) => chrome.storage.local.set({ settings });

export async function getCache() {
  const { cache } = await chrome.storage.local.get('cache');
  return { ...EMPTY_CACHE, ...(cache || {}) };
}

export const saveCache = (cache) => chrome.storage.local.set({ cache });
