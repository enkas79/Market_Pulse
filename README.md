# Market Pulse

Estensione Chrome (Manifest V3) "click-to-view": rendimenti (BTP/Bund/UST), spread BTP/Bund in bps, VIX, indici/ETF/EURUSD e stato delle borse (Milano, Francoforte, New York). Nessun tracking, JS/CSS vanilla locali, permessi: `storage`, `alarms` (+ host permission verso Yahoo Finance e BCE).

## Collaudo in modalità sviluppatore
1. Apri `chrome://extensions` e attiva **Modalità sviluppatore**.
2. **Carica estensione non pacchettizzata** e seleziona la cartella del progetto (quella con `manifest.json`).
3. Fissa l'icona dal menu puzzle, clicca per aprire il popup. Il badge mostra lo spread (o il VIX).
4. Debug: in `chrome://extensions` → "service worker" per la console in background; tasto destro sul popup → Ispeziona.
5. Impostazioni: icona ⚙ nel popup (asset, intervallo, badge).

## Fonti dati e limiti
Solo endpoint pubblici aperti, nessuna API key né registrazione.
- Yahoo Finance (endpoint JSON `chart`, non ufficiale): VIX, S&P 500, UST 10Y (`^TNX`), VWCE.DE, FTSE MIB, DAX.
- BCE (`data-api.ecb.europa.eu`): EUR/USD (tasso di riferimento giornaliero) e rendimenti BTP/Bund 10Y (dataset IRS, **mensili**). Lo spread BTP/Bund è quindi mensile, non intraday.
- Area euro 10Y (curva BCE, rating AAA, giornaliera, serie `YC`): proxy giornaliero dei tassi europei, non è Italia né Germania.
- Yahoo non offre simboli verificati per BTP/Bund giornalieri: per averli servirebbe un'altra fonte.
- In caso di errore/rate limit resta l'ultimo dato in cache con avviso "non aggiornato".
- Orari borse: festività non gestite.

## Lingue
Interfaccia in inglese (default) e italiano tramite `_locales/` e `chrome.i18n`: segue la lingua di Chrome.

## Materiali per il Chrome Web Store
`store/assets/` contiene icone, 4 screenshot 1280x800, riquadri promozionali 440x280 e 1400x560 e un video demo (en/it). Si rigenerano con:

    NODE_PATH=$(npm root -g) node store/build_assets.mjs

Richiede Playwright e ffmpeg. Popup e opzioni reali vengono renderizzati con dati di esempio (nessuna rete).
