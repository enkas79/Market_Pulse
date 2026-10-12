// Catalogo asset e impostazioni di default. Condiviso da service worker, popup e options.

/**
 * kind: yield | spread | vol | index | fx   (determina formattazione e variazione)
 * tone: normal  -> su = verde, giù = rosso
 *       inverse -> su = rosso (VIX, spread: più alto = più rischio)
 *       neutral -> nessun giudizio (rendimenti)
 * sources: provider tentati in ordine; il primo che risponde vince.
 * derived: asset calcolato da altri (non scaricato direttamente).
 */
export const ASSETS = [
  { id: 'btp10', label: 'BTP 10Y', group: 'rates', kind: 'yield', tone: 'neutral', decimals: 2,
    sources: [{ type: 'ecb', key: 'IRS/M.IT.L.L40.CI.0000.EUR.N.Z', freq: 'monthly' }] },
  { id: 'bund10', label: 'Bund 10Y', group: 'rates', kind: 'yield', tone: 'neutral', decimals: 2,
    sources: [{ type: 'ecb', key: 'IRS/M.DE.L.L40.CI.0000.EUR.N.Z', freq: 'monthly' }] },
  { id: 'spread', label: 'Spread BTP/Bund', group: 'rates', kind: 'spread', tone: 'inverse', decimals: 0,
    derived: ['btp10', 'bund10'] },
  { id: 'ust10', label: 'US 10Y Treasury', group: 'rates', kind: 'yield', tone: 'neutral', decimals: 2,
    sources: [{ type: 'yahoo', symbol: '^TNX' }] },

  { id: 'vix', label: 'VIX', group: 'market', kind: 'vol', tone: 'inverse', decimals: 2,
    sources: [{ type: 'yahoo', symbol: '^VIX' }] },
  { id: 'spx', label: 'S&P 500', group: 'market', kind: 'index', tone: 'normal', decimals: 2,
    sources: [{ type: 'yahoo', symbol: '^GSPC' }] },
  { id: 'vwce', label: 'VWCE (FTSE All-World)', group: 'market', kind: 'index', tone: 'normal', decimals: 2,
    sources: [{ type: 'yahoo', symbol: 'VWCE.DE' }] },
  { id: 'eurusd', label: 'EUR/USD', group: 'market', kind: 'fx', tone: 'normal', decimals: 4,
    sources: [{ type: 'ecb', key: 'EXR/D.USD.EUR.SP00.A', freq: 'daily' }] },
  { id: 'ftsemib', label: 'FTSE MIB', group: 'market', kind: 'index', tone: 'normal', decimals: 0,
    sources: [{ type: 'yahoo', symbol: 'FTSEMIB.MI' }] },
  { id: 'dax', label: 'DAX', group: 'market', kind: 'index', tone: 'normal', decimals: 0,
    sources: [{ type: 'yahoo', symbol: '^GDAXI' }] }
];

export const GROUP_LABELS = { rates: 'Rendimenti e tassi', market: 'Mercati' };

export const DEFAULT_SETTINGS = {
  enabledAssets: ['btp10', 'bund10', 'spread', 'ust10', 'vix', 'spx', 'vwce', 'eurusd'],
  refreshMinutes: 15,       // 5 | 15 | 30 | 60
  badgeMode: 'spread'       // spread | vix | none
};

export const getAsset = (id) => ASSETS.find((a) => a.id === id);
