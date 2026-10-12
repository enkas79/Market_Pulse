// Orari di borsa (sessione continua). Calcolati localmente: nessuna chiamata di rete.
// LIMITE NOTO: i giorni festivi di borsa non sono gestiti (solo sabato/domenica).

export const MARKETS = [
  { id: 'mi',  label: 'Milano',      tz: 'Europe/Rome',     open: [9, 0],  close: [17, 30] },
  { id: 'fra', label: 'Francoforte', tz: 'Europe/Berlin',   open: [9, 0],  close: [17, 30] },
  { id: 'ny',  label: 'New York',    tz: 'America/New_York', open: [9, 30], close: [16, 0] }
];

// Estrae giorno della settimana e minuti dall'inizio giornata nel fuso del mercato (gestisce DST).
function localClock(date, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return { weekday: get('weekday'), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function isMarketOpen(market, now = new Date()) {
  const { weekday, minutes } = localClock(now, market.tz);
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  const start = market.open[0] * 60 + market.open[1];
  const end = market.close[0] * 60 + market.close[1];
  return minutes >= start && minutes < end;
}

export const anyMarketOpen = (now = new Date()) => MARKETS.some((m) => isMarketOpen(m, now));
