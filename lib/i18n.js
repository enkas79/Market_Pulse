// Localizzazione (en/it) tramite chrome.i18n. La lingua è quella dell'interfaccia di Chrome.
export const lang = chrome.i18n.getUILanguage();

/** Messaggio localizzato; con sostituzioni opzionali ($1, $2…). */
export const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;

export const assetLabel = (a) => t(`asset_${a.id}`);
export const marketLabel = (m) => t(`market_${m.id}`);

/** Applica data-i18n / data-i18n-title / data-i18n-aria agli elementi dell'HTML. */
export function localizeDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.documentElement.lang = lang.split('-')[0];
}
