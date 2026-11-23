// Non-event content for the five-a-day calendar. Everything here is REAL data from
// the website or from verified business listings. Nothing is invented.
import fs from 'node:fs';
import path from 'node:path';
import { cleanTitle, cleanTime, cleanPlace } from './template.js';
import { pickLook } from './icons.js';
import { longDate } from './caption.js';
import { PALETTES } from './palettes.js';
import { parseTimes } from './ics.js';

const DOW3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const pd = (ds) => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (ds, n) => { const d = pd(ds); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayIndex = (ds) => Math.floor(pd(ds).getTime() / 86400000);
const pick = (arr, ds, salt = 0) => arr[(dayIndex(ds) + salt) % arr.length];

export function loadRestaurants(socialDir) {
  return JSON.parse(fs.readFileSync(path.join(socialDir, 'data', 'restaurants.json'), 'utf8'));
}

// Members straight from the directory on the website, so adding a member there adds it to the rotation.
export function loadMembers(indexHtmlPath) {
  const s = fs.readFileSync(indexHtmlPath, 'utf8');
  const grid = s.slice(s.indexOf('id="directoryGrid"'));
  const text = (h) => String(h || '').replace(/<span class="ext">.*?<\/span>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const out = [];
  for (const blk of grid.split('<div class="member ').slice(1)) {
    const cat = (blk.match(/data-cat="([^"]*)"/) || [])[1];
    const name = text((blk.match(/<h5>([\s\S]*?)<\/h5>/) || [])[1]);
    const kind = text((blk.match(/<\/h5>\s*<span>([\s\S]*?)<\/span>/) || [])[1]);
    const addr = (blk.match(/mc-line">([^<]*)</) || [])[1] || '';
    const phone = (blk.match(/mc-phone"[^>]*>([^<]*)</) || [])[1] || '';
    if (!name) continue;
    if (!cat) break;
    out.push({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, cat: text(cat), kind, address: addr.trim(), phone: phone.trim() });
  }
  return out;
}

function openToday(r, dow) {
  if (!r.hours) return null;       // unknown hours: never claim
  return r.hours[String(dow)] ? true : false;
}

// ---- 7am: today's lineup ----
export function lineupItems(events, today, { includeSports = true } = {}) {
  const cats = (e) => e.cat || 'chamber';
  const seen = new Set(), list = [];
  for (const e of events) {
    if (e.date !== today || (e.status && e.status !== 'approved')) continue;
    if (['holiday', 'school'].includes(cats(e))) continue;
    if (!includeSports && cats(e) === 'sports') continue;
    const k = cleanTitle(e.title).toLowerCase();
    if (seen.has(k)) continue; seen.add(k); list.push(e);
  }
  const rank = (e) => ({ chamber: 0, community: 1, sports: 2 }[cats(e)] ?? 3);
  const start = (e) => { const t = parseTimes(e.time); return t ? t.start : -1; };   // all-day first, then by start time
  return list.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || start(a.e) - start(b.e) || a.i - b.i).map((x) => x.e);
}

const clock = (m) => `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${m >= 720 ? 'PM' : 'AM'}`;

export function lineupPost(items, today, label = 'Today in Hobart') {
  const week = label === 'This week in Hobart';
  const ahead = label === 'Coming up in Hobart' || week;
  const seenT = new Set();
  items = items.filter((e) => { const k = cleanTitle(e.title).toLowerCase(); if (seenT.has(k)) return false; seenT.add(k); return true; });
  const shown = items.slice(0, 4);
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const rows = shown.map((e) => {
    const t = cleanTime(e.time);
    const tm = parseTimes(e.time);
    const short = tm ? clock(tm.start) : t && !/showtimes|announced/i.test(t) ? t.split(/[–-]/)[0].trim() : '';   // "12:00 – 7:00 PM" -> "12:00 PM"
    const lead = ahead ? `${MON[pd(e.date).getMonth()]} ${pd(e.date).getDate()}` : short;
    return { i: 'star', t: `${lead ? lead + '  ' : ''}${cleanTitle(e.title)}`.slice(0, 54) };
  });
  const more = items.length - shown.length;
  if (more > 0) rows.push({ i: 'star', t: `+ ${more} more on the calendar` });
  const d = pd(today);
  const first = items[0];
  return {
    type: 'lineup',
    ev: {
      id: `lineup-${today}`, title: label, date: today, palette: PALETTES.lineup,
      look: { icon: items.length === 1 ? pickLook(first).icon : 'star', badge: week ? 'THIS WEEK' : ahead ? 'COMING UP' : label.startsWith('Tomorrow') ? 'SEE YOU THEN' : 'GOOD MORNING' },
      stub: week ? { dow: 'THIS WEEK', big: String(items.length), mon: items.length === 1 ? 'EVENT' : 'EVENTS', note: 'Plan your week' } : ahead ? { dow: 'THIS WEEK', big: '★', mon: 'AHEAD', note: 'On the calendar' } : { dow: ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][d.getDay()], big: String(d.getDate()), mon: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()], note: label.startsWith('Tomorrow') ? 'Plan ahead!' : 'Here we go!' },
      taglineOverride: 'The full community calendar is always at hobartchamber.org.',
      rows,
    },
    items,
  };
}

export function lineupCaption(items, today, label) {
  const seenC = new Set();
  items = items.filter((e) => { const k = cleanTitle(e.title).toLowerCase(); if (seenC.has(k)) return false; seenC.add(k); return true; });
  const lines = items.map((e) => {
    const t = cleanTime(e.time); const p = cleanPlace(e.location);
    return `- ${label === 'Coming up in Hobart' || label === 'This week in Hobart' ? longDate(e.date) + ': ' : ''}${cleanTitle(e.title)}${t ? `, ${t}` : ''}${p ? ` (${p})` : ''}`;
  });
  if (label === 'This week in Hobart') return `Good morning, Hobart. Here's what is on the community calendar this week:\n\n${lines.join('\n')}\n\nSomething missing? Send it to the Chamber and we will add it. Full calendar: hobartchamber.org\n\nHobart Chamber of Commerce | (580) 682-0887`;
  const hello = ['Good morning, Hobart.', 'Morning, Hobart.', 'Rise and shine, Hobart.'][dayIndex(today) % 3];
  return `${hello} ${label === 'Today in Hobart' ? `Here's what's happening today, ${longDate(today)}:` : label === 'Coming up in Hobart' ? "Here's what's coming up on the calendar:" : `Here's what's happening tomorrow, ${longDate(today)}:`}\n\n${lines.join('\n')}\n\nFull community calendar: hobartchamber.org\n\nHobart Chamber of Commerce | (580) 682-0887`;
}

// ---- 12pm: lunch spotlight ----
export function pickRestaurant(restaurants, today, ledger = {}) {
  const dow = pd(today).getDay();
  const ok = restaurants.filter((r) => openToday(r, dow) !== false);
  if (!ok.length) return null;
  // rotate, but prefer the one spotlighted longest ago
  const last = (r) => Object.entries(ledger).filter(([k]) => k.startsWith(`eat:${r.id}:`)).map(([k]) => k.split(':')[2]).sort().pop() || '0000';
  return [...ok].sort((a, b) => last(a).localeCompare(last(b)) || (a.id < b.id ? -1 : 1))[0];
}

export function restaurantPost(r, today) {
  const dow = pd(today).getDay();
  const open = openToday(r, dow);
  const rows = [{ i: 'pin', t: r.address }, { i: 'phone', t: r.phone }];
  if (r.hoursText) rows.unshift({ i: 'clock', t: r.hoursText.length > 44 ? r.hoursText.split('. ')[0] : r.hoursText });
  return {
    type: 'eat',
    key: `eat:${r.id}:${today}`,
    ev: {
      id: `eat-${r.id}`, title: r.name, date: today,
      look: { icon: 'plate', badge: 'LUNCH SPOT' },
      stub: { dow: 'LOCAL', big: '★', mon: 'EAT', note: open ? 'Open today!' : 'Eat local!' },
      taglineOverride: r.blurb, rows,
    },
    restaurant: r,
  };
}

export function restaurantCaption(r, today) {
  const intros = ['Lunch idea, Hobart.', 'Hungry? Here is a local favorite.', 'Eat local today.'];
  const lines = [intros[dayIndex(today) % 3] + ` ${r.name} is one of Hobart's local spots.`, r.blurb];
  const when = [`Where: ${r.address}`, `Call: ${r.phone}`];
  if (r.hoursText) when.unshift(`Hours: ${r.hoursText}`);
  return `${lines.join(' ')}\n\n${when.join('\n')}\n\nSee the full menu: hobartchamber.org/${r.menu}\n\nHobart Chamber of Commerce | (580) 682-0887`;
}

// ---- 3pm: member spotlight ----
export function pickMember(members, today, ledger = {}) {
  const eligible = members.filter((m) => m.name);
  const last = (m) => Object.keys(ledger).filter((k) => k.startsWith(`member:${m.id}:`)).map((k) => k.split(':')[2]).sort().pop() || '0000';
  return [...eligible].sort((a, b) => last(a).localeCompare(last(b)) || (a.id < b.id ? -1 : 1))[0];
}

const CAT_ICON = { 'Civic & Nonprofit': 'heart', 'Education & Training': 'book', 'Retail & Shopping': 'store', 'Restaurants & Food': 'plate', 'Banking & Finance': 'star', 'Healthcare & Medical': 'heart', 'Automotive': 'trophy', 'Home & Construction': 'star' };
export function memberPost(m, today) {
  const rows = [];
  if (m.address) rows.push({ i: 'pin', t: m.address });
  if (m.phone) rows.push({ i: 'phone', t: m.phone });
  return {
    type: 'member',
    key: `member:${m.id}:${today}`,
    ev: {
      id: `member-${m.id}`, title: m.name, date: today, palette: PALETTES.member,
      look: { icon: CAT_ICON[m.cat] || 'store', badge: 'MEMBER SPOTLIGHT' },
      stub: { dow: 'SHOP', big: '★', mon: 'LOCAL', note: 'Chamber member' },
      taglineOverride: m.kind, rows,
    },
    member: m,
  };
}

export function memberCaption(m, today) {
  const intros = ['Member spotlight.', 'Say hello to a Chamber member.', 'Shop local, Hobart.'];
  const facts = [m.kind && `${m.name}: ${m.kind}.`, m.address && `Where: ${m.address}, Hobart`, m.phone && `Call: ${m.phone}`].filter(Boolean);
  return `${intros[dayIndex(today) % 3]}\n\n${facts.join('\n')}\n\nA dollar spent in Hobart stays in Hobart. Meet all of our members: hobartchamber.org/#directory\n\nHobart Chamber of Commerce | (580) 682-0887`;
}

// ---- evergreen fallback (true things about the Chamber's own website) ----
const EVERGREEN = [
  { title: 'Got an event?', tag: 'Add it to the Hobart community calendar. Chamber staff review every submission.', badge: 'SPREAD THE WORD', icon: 'megaphone', note: 'Submit it!',
    caption: 'Hosting something in Hobart? Add it to the community calendar at hobartchamber.org and it can show up right here.\n\nQuestions? Call the Chamber at (580) 682-0887.' },
  { title: 'Meet our members', tag: 'Local businesses and organizations investing in Hobart.', badge: 'SHOP LOCAL', icon: 'store', note: 'Browse them all',
    caption: 'Every dollar spent in Hobart stays in Hobart. Browse the full Chamber member directory at hobartchamber.org/#directory.' },
  { title: 'Where should we eat?', tag: 'Menus from Hobart restaurants, all in one place.', badge: 'EAT LOCAL', icon: 'plate', note: 'See the menus',
    caption: 'Menus from Hobart restaurants are all in one place: hobartchamber.org/local-menus.html' },
  { title: 'Join the Chamber', tag: 'Be part of the network growing Hobart.', badge: 'JOIN US', icon: 'star', note: 'Apply online',
    caption: 'Want your business in the Chamber? You can apply online at hobartchamber.org and the Chamber will follow up with membership options.\n\nOr call (580) 682-0887.' },
];
export function evergreenPost(today, slot) {
  const g = pick(EVERGREEN, today, parseInt(slot, 10));
  return {
    type: 'evergreen', key: `evergreen:${today}:${slot}`,
    ev: { id: `evergreen-${g.title}`, title: g.title, date: today, look: { icon: g.icon, badge: g.badge },
      stub: { dow: 'HOBART', big: '★', mon: 'CHAMBER', note: g.note }, taglineOverride: g.tag,
      rows: [{ i: 'pin', t: 'hobartchamber.org' }, { i: 'phone', t: '(580) 682-0887' }] },
    caption: `${g.caption}\n\nHobart Chamber of Commerce | (580) 682-0887`,
  };
}


// ===================== Weekly schedule content (Jessica's plan) =====================
const MON3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CHAMBER = 'Hobart Chamber of Commerce | (580) 682-0887';

export function loadData(socialDir) {
  const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(socialDir, 'data', f), 'utf8')); } catch { return d; } };
  return { history: rd('history.json', []), prompts: rd('prompts.json', { fun: [] }).fun || [], notes: rd('member-notes.json', {}), results: rd('results.json', []).filter((r) => r && r.date && r.text) };
}

// events between two dates (inclusive), one row per title
export function rangeItems(events, from, to, { includeSports = true } = {}) {
  const cats = (e) => e.cat || 'chamber';
  const seen = new Set(), list = [];
  for (const e of [...events].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    if (!e.date || e.date < from || e.date > to || (e.status && e.status !== 'approved')) continue;
    if (['holiday', 'school'].includes(cats(e))) continue;
    if (!includeSports && cats(e) === 'sports') continue;
    const k = cleanTitle(e.title).toLowerCase();
    if (seen.has(k)) continue; seen.add(k); list.push(e);
  }
  const rank = (e) => ({ chamber: 0, community: 1, sports: 2 }[cats(e)] ?? 3);
  return list.sort((a, b) => rank(a) - rank(b) || (a.date < b.date ? -1 : 1));
}

export function weekAheadPost(events, D) {
  const items = rangeItems(events, D, addDays(D, 6));
  if (!items.length) return null;
  return { ...lineupPost(items, D, 'This week in Hobart'), key: `week:${D}` };
}

// Weekday 10:30: member spotlight with a morning look
export function memberPostAM(m, D) {
  const p = memberPost(m, D);
  p.ev.look = { ...p.ev.look, badge: 'GOOD MORNING' };
  p.ev.stub = { dow: 'MORNING', big: '★', mon: 'MEMBER', note: 'Say hello!' };
  return p;
}

// Sunday 3:30: a business and what it does for the community (only true text: the member's own category, plus a note the Chamber wrote)
export function pickMemberCommunity(members, D, ledger, notes) {
  const withNote = members.filter((m) => notes[m.id]);
  return pickMember(withNote.length ? withNote : members, D, ledger);
}
export function memberPostCommunity(m, D, notes) {
  const p = memberPost(m, D);
  const note = notes[m.id];
  p.ev.look = { ...p.ev.look, badge: 'THANK YOU' };
  p.ev.stub = { dow: 'SUNDAY', big: '★', mon: 'MEMBER', note: 'Shop local' };
  p.ev.taglineOverride = note || (m.kind ? `${m.kind}. A Chamber member investing in Hobart.` : 'A Chamber member investing in Hobart.');
  const facts = [m.kind && `${m.name}: ${m.kind}.`, note, m.address && `Where: ${m.address}, Hobart`, m.phone && `Call: ${m.phone}`].filter(Boolean);
  p.caption = `Sunday spotlight: ${m.name}.\n\n${facts.join('\n')}\n\nChamber members put their name and their money behind this town. Thank them with your business this week. Meet all of our members: hobartchamber.org/#directory\n\n${CHAMBER}`;
  return p;
}

// Weekday 7:30 PM: an engagement post that asks people to comment. Rotates history / fun question / year-ago / weekend.
const WEEK_KIND = { 1: 'history', 2: 'fun', 3: 'history', 4: 'yearago', 5: 'weekend' };
export function engagementPost(D, { history, prompts }, events, ledger = {}) {
  const dow = pd(D).getDay();
  // least recently used first (never used = first); repeats once everything has had a turn
  const lastUsed = (x, kind) => {
    let t = 0;
    for (const [k, v] of Object.entries(ledger)) if (k === `engage:${kind}:${x.id}` || k.startsWith(`engage:${kind}:${x.id}:`)) t = Math.max(t, (v && v.scheduledFor) || 1);
    return t;
  };
  const pickNew = (arr, kind) => [...arr].sort((a, b) => lastUsed(a, kind) - lastUsed(b, kind) || (a.id < b.id ? -1 : 1))[0];
  let kind = WEEK_KIND[dow] || 'fun';
  // a year ago: only if the calendar really has something from about this time last year
  if (kind === 'yearago') {
    const ly = addDays(D, -364);
    const past = rangeItems(events, addDays(ly, -3), addDays(ly, 3), { includeSports: false });
    if (past.length) {
      const e = past[0];
      return { type: 'engage', key: `engage:yearago:${D}`,
        ev: { palette: PALETTES.engage, id: `engage-yearago-${D}`, title: cleanTitle(e.title), date: D, look: { icon: 'star', badge: 'A YEAR AGO' }, stub: { dow: 'A YEAR', big: '1', mon: 'YEAR AGO', note: 'Remember this?' },
          taglineOverride: `This time last year in Hobart. What do you remember?`, rows: [{ i: 'pin', t: 'Tell us in the comments' }] },
        caption: `A year ago this week in Hobart: ${cleanTitle(e.title)}.\n\nDo you remember it? Share your memory or a photo in the comments.\n\n${CHAMBER}` };
    }
    kind = 'fun';
  }
  if (kind === 'weekend') {
    const sat = addDays(D, 1), sun = addDays(D, 2);
    const wk = rangeItems(events, sat, sun, { includeSports: false });
    const head = wk.length ? `This weekend: ${wk.slice(0, 3).map((e) => cleanTitle(e.title)).join(', ')}.` : 'Weekend is almost here.';
    return { type: 'engage', key: `engage:weekend:${D}`,
      ev: { palette: PALETTES.engage, id: `engage-weekend-${D}`, title: 'Weekend plans?', date: D, look: { icon: 'star', badge: 'HAPPY FRIDAY' }, stub: { dow: 'FRIDAY', big: '?', mon: 'WEEKEND', note: 'Tell us!' },
        taglineOverride: 'What are you doing in Hobart this weekend?', rows: [{ i: 'pin', t: 'Tell us in the comments' }] },
      caption: `Happy Friday, Hobart. ${head}\n\nWhat are you doing this weekend? Tell us in the comments.\n\nFull calendar: hobartchamber.org\n\n${CHAMBER}` };
  }
  if (kind === 'history' && history.length) {
    const h = pickNew(history, 'history');
    return { type: 'engage', key: `engage:history:${h.id}:${D}`,
      ev: { palette: PALETTES.engage, id: `engage-history-${h.id}`, title: h.head, date: D, look: { icon: 'book', badge: 'HOBART HISTORY' }, stub: { dow: 'HOBART', big: h.year, mon: 'HISTORY', note: 'Did you know?' },
        taglineOverride: h.fact, rows: [{ i: 'pin', t: 'Tell us in the comments' }] },
      caption: `Hobart history: ${h.fact}\n\n${h.ask}\n\nSource: Oklahoma Historical Society, Encyclopedia of Oklahoma History and Culture.\n\n${CHAMBER}` };
  }
  const f = pickNew(prompts, 'fun');
  if (!f) return null;
  return { type: 'engage', key: `engage:fun:${f.id}:${D}`,
    ev: { palette: PALETTES.engage, id: `engage-fun-${f.id}`, title: f.head, date: D, look: { icon: 'megaphone', badge: 'YOUR TURN' }, stub: { dow: 'HOBART', big: '?', mon: 'QUESTION', note: 'Join in!' },
      taglineOverride: f.q, rows: [{ i: 'pin', t: 'Tell us in the comments' }] },
    caption: `${f.q}\n\n${f.ask}\n\n${CHAMBER}` };
}

// Saturday 2:00 PM: the week in review. Only uses real scores from data/results.json; otherwise lists what was on the calendar and asks for photos.
export function recapPost(events, D, results) {
  const from = addDays(D, -6), to = addDays(D, -1);   // days that have already happened
  const items = rangeItems(events, from, to, { includeSports: false });
  const scores = results.filter((r) => r.date >= from && r.date <= D);
  if (!items.length && !scores.length) return null;
  const rows = [
    ...scores.slice(0, 3).map((r) => ({ i: 'trophy', t: r.text.slice(0, 54) })),
    ...items.slice(0, Math.max(1, 4 - Math.min(scores.length, 3))).map((e) => ({ i: 'star', t: `${MON3[pd(e.date).getMonth()]} ${pd(e.date).getDate()}  ${cleanTitle(e.title)}`.slice(0, 54) })),
  ];
  const lines = [...scores.map((r) => `- ${r.text}`), ...items.map((e) => `- ${longDate(e.date)}: ${cleanTitle(e.title)}`)];
  return { type: 'recap', key: `recap:${D}`,
    ev: { palette: PALETTES.lineup, id: `recap-${D}`, title: 'The week in Hobart', date: D, look: { icon: 'trophy', badge: 'WEEK IN REVIEW' }, stub: { dow: 'THIS WEEK', big: '★', mon: 'RECAP', note: 'Nice work, Hobart' },
      taglineOverride: scores.length ? 'Scores and highlights from around town.' : 'A look back at what was on the Hobart calendar.', rows },
    caption: `The week in Hobart, in review:\n\n${lines.join('\n')}\n\nWere you there? Share your photos and highlights in the comments.\n\n${CHAMBER}` };
}

// Event-slot fallback before any filler: Bearcat games later today.
// Only games that start at or after the post time (or with no set time) are listed.
export function gameDayPost(events, D, slot) {
  const slotMin = (() => { const [h, m] = String(slot || '00:00').split(':').map(Number); return h * 60 + (m || 0); })();
  const startOf = (e) => { const t = parseTimes(e.time); return t ? t.start : null; };
  const games = events
    .filter((e) => e && e.date === D && e.cat === 'sports' && (!e.status || e.status === 'approved'))
    .filter((e) => { const st = startOf(e); return st === null || st >= slotMin; })
    .sort((a, b) => (startOf(a) ?? 9999) - (startOf(b) ?? 9999));
  if (!games.length) return null;
  const shown = games.slice(0, 4);
  const rows = shown.map((e) => {
    const t = cleanTime(e.time); const short = t && !/showtimes|announced|tba|tbd/i.test(t) ? t.split(/[–-]/)[0].trim() : '';
    return { i: 'star', t: `${short ? short + '  ' : ''}${cleanTitle(e.title)}`.slice(0, 54) };
  });
  if (games.length > shown.length) rows.push({ i: 'star', t: `+ ${games.length - shown.length} more on the calendar` });
  const lines = games.map((e) => { const t = cleanTime(e.time); return `- ${cleanTitle(e.title)}${t ? ', ' + (/announced|tba|tbd/i.test(t) ? 'time TBA' : t) : ''}${e.location ? ' (' + e.location + ')' : ''}`; });
  return {
    type: 'gameday', key: `gameday:${D}`,
    ev: { id: `gameday-${D}`, title: 'Bearcat game day', date: D, palette: PALETTES.lineup,
      look: { icon: pickLook(games[0]).icon || 'star', badge: 'GAME DAY' },
      stub: { dow: 'TODAY', big: String(games.length), mon: games.length === 1 ? 'GAME' : 'GAMES', note: 'Go Bearcats!' },
      taglineOverride: 'Come out and cheer on the Bearcats.', rows },
    caption: `Game day! On the Bearcat schedule today:\n\n${lines.join('\n')}\n\nCome out and cheer them on. The full schedule is on the community calendar: hobartchamber.org\n\n${CHAMBER}`,
  };
}
