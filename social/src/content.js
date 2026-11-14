// Non-event content for the five-a-day calendar. Everything here is REAL data from
// the website or from verified business listings. Nothing is invented.
import fs from 'node:fs';
import path from 'node:path';
import { cleanTitle, cleanTime, cleanPlace } from './template.js';
import { pickLook } from './icons.js';
import { longDate } from './caption.js';

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
  return list.sort((a, b) => rank(a) - rank(b));
}

export function lineupPost(items, today, label = 'Today in Hobart') {
  const ahead = label === 'Coming up in Hobart';
  const seenT = new Set();
  items = items.filter((e) => { const k = cleanTitle(e.title).toLowerCase(); if (seenT.has(k)) return false; seenT.add(k); return true; });
  const shown = items.slice(0, 4);
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const rows = shown.map((e) => {
    const t = cleanTime(e.time);
    const short = t && !/showtimes|announced/i.test(t) ? t.split(/[–-]/)[0].trim() : '';
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
      id: `lineup-${today}`, title: label, date: today,
      look: { icon: items.length === 1 ? pickLook(first).icon : 'star', badge: ahead ? 'COMING UP' : label.startsWith('Tomorrow') ? 'SEE YOU THEN' : 'GOOD MORNING' },
      stub: ahead ? { dow: 'THIS WEEK', big: '★', mon: 'AHEAD', note: 'On the calendar' } : { dow: ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][d.getDay()], big: String(d.getDate()), mon: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()], note: label.startsWith('Tomorrow') ? 'Plan ahead!' : 'Here we go!' },
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
    return `- ${label === 'Coming up in Hobart' ? longDate(e.date) + ': ' : ''}${cleanTitle(e.title)}${t ? `, ${t}` : ''}${p ? ` (${p})` : ''}`;
  });
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
  const lines = [intros[dayIndex(today) % 3] + ` ${r.name} is a Chamber member.`, r.blurb];
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
      id: `member-${m.id}`, title: m.name, date: today,
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
