// Decides WHICH posts are due, and WHEN each one goes out.
//
// Rules (all in one place so the Chamber can change them without touching anything else):
//   - Only Chamber + community events get their own post. Sports, school and
//     holiday entries (every junior high game, "No School", etc.) stay on the
//     calendar and do not clutter the Facebook page.
//   - "announce": once, when the event is 7 days away or less.
//   - "reminder": once, the day before (or the morning of, if that was missed).
//   - Multi-date runs (a play with four shows) are ONE announcement that lists every date.
//   - Never more than MAX_PER_DAY posts a day, spaced out at fixed, friendly times.
//   - A post that is already in the ledger is never created again.

export const CONFIG = {
  TZ: 'America/Chicago',
  ANNOUNCE_DAYS_BEFORE: 7,
  MAX_PER_DAY: 3,
  SLOTS: ['10:00', '12:30', '15:30', '18:00'],   // local times posts may go out
  MIN_LEAD_MINUTES: 30,                          // Facebook needs 10+; we leave room
  ELIGIBLE_CATS: ['chamber', 'community'],       // events with no category count as 'chamber'
};

const pd = (ds) => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((pd(b) - pd(a)) / 86400000);
const addDays = (ds, n) => { const d = pd(ds); d.setDate(d.getDate() + n); return fmt(d); };
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const norm = (t) => String(t || '').replace(/\p{Extended_Pictographic}️?/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Epoch seconds for a wall-clock time in a time zone (handles daylight saving).
export function zonedEpoch(dateStr, hhmm, tz = CONFIG.TZ) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(guess)).reduce((a, p) => (a[p.type] = p.value, a), {});
    const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    guess += Date.UTC(y, mo - 1, d, h, mi) - asUTC;
  }
  return Math.floor(guess / 1000);
}

export function centralNow(nowEpochMs = Date.now(), tz = CONFIG.TZ) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(nowEpochMs)).reduce((a, x) => (a[x.type] = x.value, a), {});
  return { today: `${p.year}-${p.month}-${p.day}`, epoch: Math.floor(nowEpochMs / 1000) };
}

function eligible(e) {
  if (!e || !e.date || !e.title) return false;
  if (e.status && e.status !== 'approved') return false;
  return CONFIG.ELIGIBLE_CATS.includes(e.cat || 'chamber');
}

// Group events into runs (same title, dates no more than 14 days apart).
export function buildRuns(events) {
  const byTitle = new Map();
  for (const e of events.filter(eligible)) {
    const k = norm(e.title);
    if (!byTitle.has(k)) byTitle.set(k, []);
    byTitle.get(k).push(e);
  }
  const runs = [];
  for (const [k, list] of byTitle) {
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    let cur = null;
    for (const e of list) {
      if (cur && dayDiff(cur.dates[cur.dates.length - 1], e.date) <= 14) { cur.dates.push(e.date); cur.events.push(e); }
      else { cur = { key: `${k}|${e.date}`, title: e.title, dates: [e.date], events: [e] }; runs.push(cur); }
    }
  }
  for (const r of runs) r.dates = [...new Set(r.dates)];
  return runs;
}

/**
 * Returns posts that are due now (not yet in the ledger), without slots assigned.
 */
export function duePosts(events, today, ledger = {}) {
  const out = [];
  for (const run of buildRuns(events)) {
    const first = run.dates[0];
    const upcoming = run.dates.filter((d) => d >= today);
    if (!upcoming.length) continue;
    const next = upcoming[0];
    const rep = run.events.find((e) => e.date === next) || run.events[0];
    const repWithRun = { ...rep, runDates: upcoming.length > 1 && first >= today ? run.dates : (upcoming.length > 1 ? upcoming : undefined) };

    // announce: only before the run begins
    const announceKey = `${run.key}:announce`;
    const n = dayDiff(today, first);
    if (first >= today && n >= 1 && n <= CONFIG.ANNOUNCE_DAYS_BEFORE && !ledger[announceKey]) {
      out.push({ key: announceKey, type: 'announce', ev: { ...repWithRun, date: first }, eventDate: first, runKey: run.key });
    }

    // reminder: day before each cluster's first date (a "cluster" = consecutive days)
    for (const d of upcoming) {
      const prevIsAdjacent = run.dates.includes(addDays(d, -1));
      if (prevIsAdjacent) continue;
      const k = `${run.key}:reminder:${d}`;
      const dn = dayDiff(today, d);
      if ((dn === 1 || dn === 0) && !ledger[k]) {
        // if the announcement is going out today for tomorrow, a reminder would be a duplicate
        if (out.find((p) => p.runKey === run.key && p.type === 'announce' && dayDiff(today, d) <= 1)) continue;
        const cluster = run.dates.filter((x) => dayDiff(d, x) >= 0 && dayDiff(d, x) <= 3);
        out.push({ key: k, type: 'reminder', ev: { ...(run.events.find((e) => e.date === d) || rep), runDates: cluster.length > 1 ? cluster : undefined }, eventDate: d, runKey: run.key });
      }
    }
  }
  // soonest event first, reminders before announcements
  out.sort((a, b) => (a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : (a.type === 'reminder' ? -1 : 1)));
  return out;
}

/**
 * Give each due post a send time. Slots are fixed local times; no more than
 * MAX_PER_DAY per day (counting what the ledger already scheduled).
 */
export function assignSlots(posts, nowEpoch, ledger = {}) {
  const perDay = {};
  const taken = new Set();
  for (const v of Object.values(ledger)) {
    if (v && v.scheduledFor) {
      taken.add(v.scheduledFor);
      const dt = new Date(v.scheduledFor * 1000);
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.TZ }).format(dt);
      perDay[day] = (perDay[day] || 0) + 1;
    }
  }
  const { today } = centralNow(nowEpoch * 1000);
  const scheduled = [], skipped = [];
  for (const p of posts) {
    // latest day this post is still useful: announce -> day before the event; reminder -> morning of
    const lastDay = p.type === 'announce' ? addDays(p.eventDate, -1) : p.eventDate;
    let placed = false;
    for (let d = today; d <= lastDay && !placed; d = addDays(d, 1)) {
      if ((perDay[d] || 0) >= CONFIG.MAX_PER_DAY) continue;
      for (const s of CONFIG.SLOTS) {
        if (p.type === 'reminder' && d === p.eventDate && s > '12:00') continue;   // day-of reminders go out in the morning
        const epoch = zonedEpoch(d, s);
        if (epoch < nowEpoch + CONFIG.MIN_LEAD_MINUTES * 60 || taken.has(epoch)) continue;
        // prefer the day before the event for reminders, and 7 days out for announcements
        taken.add(epoch); perDay[d] = (perDay[d] || 0) + 1;
        scheduled.push({ ...p, scheduledFor: epoch, scheduledDay: d, slot: s });
        placed = true; break;
      }
    }
    if (!placed) skipped.push({ ...p, reason: 'no open send time before the event' });
  }
  return { scheduled, skipped };
}
