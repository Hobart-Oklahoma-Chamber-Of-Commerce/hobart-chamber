// Caption writer.
//
// Goal: read like the Chamber wrote it, because mostly the Chamber did. The event
// description on the calendar is human-written, so it goes in nearly untouched.
// Around it we only add a short, plain intro and a When / Where block.
// House rules (this is what keeps it from sounding like a chatbot):
//   - no emoji bullets, no hashtag piles, no "unforgettable / vibrant / join us for an evening of"
//   - no em dashes
//   - one idea per sentence, plain Oklahoma-friendly voice
//   - a real phone number and a real link at the bottom

import { cleanTitle, cleanTime, cleanPlace } from './template.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOWS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const pd = (ds) => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d); };
const days = (a, b) => Math.round((pd(b) - pd(a)) / 86400000);

function seeded(seed, n) {
  let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return s % n;
}

export function whenPhrase(today, ds) {
  const n = days(today, ds);
  const dow = DOWS[pd(ds).getDay()];
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n <= 6 && pd(ds).getDay() > pd(today).getDay()) return `this ${dow}`;
  if (n <= 13) return `next ${dow}`;
  return `on ${dow}, ${MONTHS[pd(ds).getMonth()]} ${pd(ds).getDate()}`;
}

export function longDate(ds) {
  const d = pd(ds);
  return `${DOWS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// "Nov 28, 29 and Dec 5, 6"
export function runDatesText(dates) {
  const byMonth = [];
  for (const ds of dates) {
    const d = pd(ds), m = d.getMonth();
    const last = byMonth[byMonth.length - 1];
    if (last && last.m === m) last.days.push(d.getDate());
    else byMonth.push({ m, days: [d.getDate()] });
  }
  return byMonth.map((g) => `${MON3[g.m]} ${g.days.join(', ')}`).join(' and ');
}

// Keep the Chamber's own words, trimmed to a sensible length, minus em dashes.
function body(desc) {
  let s = String(desc || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  s = s.replace(/\s+[—–]\s+/g, ', ').replace(/[—]/g, ', ');
  if (s.length <= 420) return s;
  const parts = s.match(/[^.!?]+[.!?]+(\s|$)/g) || [s];
  let out = '';
  for (const p of parts) { if ((out + p).length > 420) break; out += p; }
  return (out || s.slice(0, 400)).trim();
}

const INTROS = {
  announce: [
    (t, w) => `Mark your calendar, Hobart. ${t} is ${w}.`,
    (t, w) => `Coming up ${w}: ${t}.`,
    (t, w) => `Here's one for the calendar. ${t} is ${w}.`,
    (t, w) => `Heads up, Hobart. ${t} is ${w}.`,
  ],
  reminder: [
    (t, w) => `Just a reminder, ${t} is ${w}.`,
    (t, w) => `${t} is ${w}. See you there.`,
    (t, w) => `Don't forget, ${t} is ${w}.`,
  ],
};

/**
 * @param post {type:'announce'|'reminder', ev:{id,title,date,time,location,description,runDates?}}
 * @param today 'YYYY-MM-DD' (Central time)
 */
export function writeCaption(post, today) {
  const { ev, type } = post;
  const title = cleanTitle(ev.title);
  const pool = INTROS[type] || INTROS.announce;
  const intro = pool[seeded(`${ev.id}:${type}`, pool.length)](title, whenPhrase(today, ev.date));

  const lines = [];
  const multi = ev.runDates && ev.runDates.length > 1;
  const t = cleanTime(ev.time);
  const timePart = t ? (/^showtimes/i.test(t) ? ` (${t[0].toLowerCase() + t.slice(1)})` : `, ${t}`) : '';
  lines.push(`When: ${multi ? runDatesText(ev.runDates) : longDate(ev.date)}${timePart}`);
  const place = cleanPlace(ev.location);
  if (place) lines.push(`Where: ${place}`);

  const desc = body(ev.description);
  const parts = [intro, lines.join('\n')];
  if (desc) parts.push(desc);
  parts.push('Details and the full community calendar: hobartchamber.org');
  parts.push('Hobart Chamber of Commerce | (580) 682-0887');
  return parts.join('\n\n');
}

export function altText(ev) {
  const t = cleanTitle(ev.title);
  const bits = [longDate(ev.date)];
  if (cleanTime(ev.time)) bits.push(cleanTime(ev.time));
  const place = cleanPlace(ev.location);
  if (place) bits.push(place);
  return `Hobart Happenings graphic for ${t}. ${bits.join(', ')}.`;
}
