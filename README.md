# Market Pulse

Estensione Chrome (Manifest V3) "click-to-view": rendimenti (BTP/Bund/UST), spread BTP/Bund in bps, VIX, indici/ETF/EURUSD e stato delle borse (Milano, Francoforte, New York). Nessun tracking, JS/CSS vanilla locali, permessi: `storage`, `alarms` (+ host permission verso Yahoo Finance, Stooq, FRED).

## Collaudo in modalità sviluppatore
1. Apri `chrome://extensions` e attiva **Modalità sviluppatore**.
2. **Carica estensione non pacchettizzata** e seleziona la cartella del progetto (quella con `manifest.json`).
3. Fissa l'icona dal menu puzzle, clicca per aprire il popup. Il badge mostra lo spread (o il VIX).
4. Debug: in `chrome://extensions` → "service worker" per la console in background; tasto destro sul popup → Ispeziona.
5. Impostazioni: icona ⚙ nel popup (asset, intervallo, badge, API key FRED).

## Fonti dati e limiti
- Yahoo Finance (endpoint JSON `chart`, non ufficiale): VIX, S&P 500, UST 10Y, VWCE, EUR/USD.
- Stooq (CSV): BTP/Bund 10Y. Fallback FRED (mensile, richiede API key gratuita).
- Gli endpoint non sono garantiti: in caso di errore/rate limit resta l'ultimo dato in cache con avviso "non aggiornato".
- Orari borse: festività non gestite.
