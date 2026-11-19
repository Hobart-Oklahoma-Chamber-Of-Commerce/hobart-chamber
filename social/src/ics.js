// The calendar subscription file (hobart-chamber.ics at the site root).
// Rebuilt from the full calendar (built-in events + admin-approved ones) on every
// worker run, so phones that subscribe stay up to date on their own.
import fs from 'node:fs';

const TZ_BLOCK = [
  'BEGIN:VTIMEZONE', 'TZID:America/Chicago',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0500', 'TZNAME:CDT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0600', 'TZNAME:CST', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];
const KEEP_PAST_DAYS = 60;   // older events drop off the feed
const DEFAULT_MINUTES = 120; // events with only a start time get two hours

const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// fold long lines at 75 bytes (RFC 5545), never splitting a character
function fold(line) {
  const out = []; let cur = ''; let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

// "6:00 PM", "4:00 – 7:00 PM", "8:00 - 10:30 AM", "Noon - 6:00 PM", "Doors 5:30 PM · Dinner 6:00 PM" ...
// Returns minutes after midnight { start, end } or null for all-day / unknown times.
export function parseTimes(text) {
  const t = String(text || '').replace(/\bnoon\b/gi, '12:00 PM').replace(/\bmidnight\b/gi, '11:59 PM');
  const re = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?![\d])/gi;
  const toks = [];
  let m;
  while ((m = re.exec(t))) {
    const h = +m[1], min = m[2] ? +m[2] : 0;
    if (h > 12 || min > 59) continue;
    const mer = m[3] ? (m[3][0].toLowerCase() === 'p' ? 'pm' : 'am') : null;
    toks.push({ h, min, mer, at: m.index, len: m[0].length, hasColon: !!m[2] });
  }
  if (!toks.length || !toks.some((x) => x.mer)) return null;   // no AM/PM anywhere: dates or words, not times
  const firstMer = toks.find((x) => x.mer).mer;
  const mins = (x, fallback) => { const mer = x.mer || fallback; let h = x.h % 12; if (mer === 'pm') h += 12; return h * 60 + x.min; };
  const a = toks[0];
  if (!a.mer && !a.hasColon && !toks[1]) return null;
  let start = mins(a, a.mer || (toks[1] && toks[1].mer) || firstMer);
  let end = null;
  if (toks[1]) {
    const between = t.slice(a.at + a.len, toks[1].at);
    if (/^\s*[–—-]+\s*$/.test(between) || /^\s*to\s*$/i.test(between)) {
      end = mins(toks[1], toks[1].mer || firstMer);
      if (!a.mer && end - start > 12 * 60) start += 12 * 60;           // "8 - 10:30 PM" reads as evening
      if (!a.mer && start > end && start - 12 * 60 >= 0) start -= 12 * 60; // "11 - 2 PM" starts in the morning
    }
  }
  if (end === null || end <= start) end = Math.min(start + DEFAULT_MINUTES, 23 * 60 + 59);
  return { start, end };
}

const hhmm = (mins) => String(Math.floor(mins / 60)).padStart(2, '0') + String(mins % 60).padStart(2, '0') + '00';
const ymd = (d) => d.replace(/-/g, '');
const nextDay = (d) => { const [y, m, dd] = d.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, dd + 1)); return x.toISOString().slice(0, 10).replace(/-/g, ''); };

export function buildICS(events, { todayYmd, stamp }) {
  const cutoff = new Date(todayYmd + 'T00:00:00Z'); cutoff.setUTCDate(cutoff.getUTCDate() - KEEP_PAST_DAYS);
  const from = cutoff.toISOString().slice(0, 10);
  const list = events
    .filter((e) => e && e.date && e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && (!e.status || e.status === 'approved') && e.date >= from)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.id).localeCompare(String(b.id))));
  const seen = new Set();
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hobart Chamber of Commerce//Community Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Hobart Community Calendar', 'X-WR-TIMEZONE:America/Chicago',
    'X-WR-CALDESC:' + esc('Community events, Bearcat games, school dates and holidays for Hobart and Kiowa County, Oklahoma. From hobartchamber.org.'),
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H',
    ...TZ_BLOCK,
  ];
  for (const e of list) {
    const uid = `${e.id}@hobartchamber.org`;
    if (seen.has(uid)) continue;
    seen.add(uid);
    const tm = parseTimes(e.time);
    const timeText = String(e.time || '').trim();
    const simple = tm && /^\d{1,2}(:\d{2})?\s*[AP]M(\s*[–—-]\s*\d{1,2}(:\d{2})?\s*[AP]M)?$/i.test(timeText);
    const desc = [timeText && !simple && !/^(all day|tba|tbd)$/i.test(timeText) ? `Time: ${timeText}` : '', e.description || ''].filter(Boolean).join('\n\n');
    lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`);
    if (tm) lines.push(`DTSTART;TZID=America/Chicago:${ymd(e.date)}T${hhmm(tm.start)}`, `DTEND;TZID=America/Chicago:${ymd(e.date)}T${hhmm(tm.end)}`);
    else lines.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${nextDay(e.date)}`);
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.cat) lines.push(`CATEGORIES:${esc(e.cat.charAt(0).toUpperCase() + e.cat.slice(1))}`);
    lines.push('URL:https://hobartchamber.org/#calendar', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return { text: lines.map(fold).join('\r\n') + '\r\n', count: seen.size };
}

// Writes the file only when an event actually changed (DTSTAMP alone doesn't count),
// so the repo isn't touched on quiet runs. Returns { changed, count }.
export function writeICS(events, filePath, todayYmd) {
  const strip = (s) => s.replace(/\r\nDTSTAMP:[0-9TZ]+/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const { text, count } = buildICS(events, { todayYmd, stamp });
  let old = '';
  try { old = fs.readFileSync(filePath, 'utf8'); } catch {}
  if (old && strip(old) === strip(text)) return { changed: false, count };
  fs.writeFileSync(filePath, text);
  return { changed: true, count };
}
