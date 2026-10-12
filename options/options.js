// Pagina opzioni: asset attivi, intervallo, badge.
import { ASSETS } from '../lib/config.js';
import { getSettings, saveSettings } from '../lib/storage.js';
import { assetLabel, localizeDom } from '../lib/i18n.js';

const $ = (id) => document.getElementById(id);

localizeDom();
(async () => {
  const settings = await getSettings();

  // Checkbox per ogni asset del catalogo.
  $('assets').replaceChildren(...ASSETS.map((a) => {
    const label = document.createElement('label');
    label.className = 'check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = a.id;
    cb.checked = settings.enabledAssets.includes(a.id);
    label.append(cb, document.createTextNode(assetLabel(a)));
    return label;
  }));

  $('refreshMinutes').value = String(settings.refreshMinutes);
  $('badgeMode').value = settings.badgeMode;

  $('save').addEventListener('click', async () => {
    await saveSettings({
      enabledAssets: [...document.querySelectorAll('#assets input:checked')].map((c) => c.value),
      refreshMinutes: Number($('refreshMinutes').value),
      badgeMode: $('badgeMode').value
    });
    // Il service worker intercetta la modifica e riprogramma l'allarme.
    $('saved').hidden = false;
    setTimeout(() => { $('saved').hidden = true; }, 1800);
  });
})();
