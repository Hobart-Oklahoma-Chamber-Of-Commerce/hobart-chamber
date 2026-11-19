// The worker. One run = look at the calendar, decide what's due, make the
// pictures + captions, and (if Facebook is connected) schedule them on the Page.
//
//   node src/run.js --dry-run            make drafts only, never touch Facebook (default when no secrets)
//   node src/run.js                      schedule on the Page for real
//   node src/run.js --check              verify the Facebook token + Page, then stop
//   node src/run.js --now 2026-11-12T08:30   pretend it's this Central-time moment (testing)
//   node src/run.js --only <eventId>     only this event
//   node src/run.js --reset-scheduled    delete the worker's own scheduled posts from the new week-plan start date on, forget them, then plan again
//   node src/run.js --publish-now 12:00  publish today's 12:00 post to the Page RIGHT NOW (demo / showcase)
//
// Chamber graphics: a picture in social/overrides named for its time (2026-11-19-0730.jpg) plus its caption
// (2026-11-19-0730.txt) replaces the worker's own post for that time. See social/overrides/README.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadSeed, loadCarouselFlyers, matchFlyer, fetchAdminEvents, downloadFlyer } from './events.js';
import { planWeek, centralNow, zonedEpoch, CONFIG, WEEK_STARTS } from './plan.js';
import { loadRestaurants, loadMembers, loadData, lineupCaption, restaurantCaption, memberCaption } from './content.js';
import { postHTML, cleanTitle } from './template.js';
import { writeCaption, altText, runDatesText } from './caption.js';
import { renderPNG, closeBrowser } from './render.js';
import { flyerPalette } from './palettes.js';
import { writeICS } from './ics.js';
import { fbConfig, postPhoto, checkPage, deletePost, getNode, scheduledPosts } from './facebook.js';

const socialDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(socialDir, '..');
const ledgerPath = path.join(socialDir, 'state', 'ledger.json');
const outDir = path.join(socialDir, 'out', 'drafts');

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };

const fb = fbConfig();
const dry = flag('dry-run') || !fb.ready;

if (flag('check')) {
  if (!fb.ready) { console.log('FB_PAGE_ID / FB_PAGE_TOKEN are not set.'); process.exit(1); }
  const info = await checkPage(fb);
  console.log(`Connected to Facebook Page: ${info.name} (${info.link || fb.pageId}). Mode: ${fb.mode}.`);
  process.exit(0);
}

let nowEpochMs = Date.now();
if (opt('now')) {
  const [d, t] = opt('now').split('T');
  nowEpochMs = zonedEpoch(d, t || '08:00') * 1000;
}
const { today, epoch: nowEpoch } = centralNow(nowEpochMs);

const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : {};
const saveLedger = () => { fs.mkdirSync(path.dirname(ledgerPath), { recursive: true }); fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n'); };

// 0) optional: throw away the worker's own FUTURE scheduled posts (only ones in the ledger, from the new plan's start date on) and re-plan them
if (flag('reset-scheduled')) {
  const gone = new Set();
  const chamberTimes = new Set(Object.entries(ledger).filter(([k, v]) => k.startsWith('override:') && v).map(([, v]) => v.scheduledFor));
  for (const [k, v] of Object.entries(ledger)) {
    if (!v || !v.fbPostId || !v.scheduledFor || v.mode !== 'schedule' || k.startsWith('slot:') || k.startsWith('override:') || chamberTimes.has(v.scheduledFor)) continue;
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.TZ }).format(new Date(v.scheduledFor * 1000));
    if (v.scheduledFor <= nowEpoch + 600 || day < WEEK_STARTS) continue;       // never touch posts that are live, about to go, or from the old plan
    if (dry) { console.log(`  WOULD DELETE ${v.title} [${v.type}] for ${day} (id ${v.fbPostId})`); continue; }
    try { const res = await deletePost(fb, v.fbPostId); console.log(`  ${res.toUpperCase()}  ${v.title} [${v.type}] for ${day}`); gone.add(v.scheduledFor); }
    catch (e) { console.log(`  COULD NOT DELETE ${v.title} for ${day}: ${e.message}`); process.exitCode = 1; }
  }
  for (const [k, v] of Object.entries(ledger)) if (v && gone.has(v.scheduledFor)) delete ledger[k];
  if (!dry) { fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n'); console.log(`Removed ${gone.size} scheduled post(s). Planning them again now.`); }
}

// 0b) Chamber graphics (social/overrides). A picture named for its time, 2026-11-19-0730.jpg, with its caption
//     in 2026-11-19-0730.txt (and alt text in 2026-11-19-0730.alt.txt if wanted). The worker deletes its own
//     scheduled post for that time, if it made one, and schedules the Chamber's picture in its place, once.
//     Change the picture or caption later and the next run swaps it again. Dry runs only look, never change.
const overridesDir = path.join(socialDir, 'overrides');
const flat = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const toEpoch = (v) => (typeof v === 'number' ? v : /^\d+$/.test(String(v)) ? Number(v) : Math.floor(Date.parse(String(v).replace(/([+-]\d\d)(\d\d)$/, '$1:$2')) / 1000));
let pageQueue = null;
for (const f of fs.existsSync(overridesDir) ? fs.readdirSync(overridesDir).sort() : []) {
  const m = f.match(/^(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})\.(png|jpe?g)$/i);
  if (!m) continue;
  const D = m[1], T = `${m[2]}:${m[3]}`, base = f.replace(/\.[^.]+$/, ''), label = `${D} ${T}`;
  const at = zonedEpoch(D, T);
  if (at <= nowEpoch) continue;                                          // its time has come and gone
  const read = (ext) => { const p = path.join(overridesDir, base + ext); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : ''; };
  const caption = read('.txt'), alt = read('.alt.txt');
  if (!caption) { console.log(`  SKIPPED Chamber graphic ${f}: it needs a caption file named ${base}.txt`); continue; }
  const imagePath = path.join(overridesDir, f);
  const sig = crypto.createHash('sha1').update(fs.readFileSync(imagePath)).update(caption).update(alt).digest('hex').slice(0, 12);
  const doneKey = `override:${D}:${T}`, slotKey = `slot:${D}:${T}`;
  const done = ledger[doneKey];
  if (done && done.sig === sig) continue;                                // already swapped in
  if (at < nowEpoch + 15 * 60) { console.log(`  SKIPPED Chamber graphic for ${label}: too close to post time to swap safely`); continue; }
  const wk = ledger[slotKey] && ledger[slotKey].key !== doneKey ? ledger[slotKey].key : null;
  const replacing = done && done.fbPostId ? { key: doneKey, title: done.title, type: 'override', fbPostId: done.fbPostId }
    : wk && ledger[wk] && ledger[wk].fbPostId ? { key: wk, title: ledger[wk].title, type: ledger[wk].type, fbPostId: ledger[wk].fbPostId } : null;
  if (fb.ready) {                                                        // look first: what is queued on the Page for that time?
    if (!pageQueue) { try { pageQueue = await scheduledPosts(fb); } catch (e) { pageQueue = []; console.log(`  (could not list the Page's scheduled posts: ${e.message})`); } }
    const same = pageQueue.filter((p) => toEpoch(p.scheduled_publish_time) === at);
    for (const p of same) console.log(`    queued on the Page for ${label}: ${p.id} "${flat(p.message).slice(0, 80)}"`);
    const already = !done && same.find((p) => flat(p.message) === flat(caption));
    if (already) {                                                       // a run before this one already did it
      if (!dry) { ledger[doneKey] = { fbPostId: already.id, scheduledFor: at, title: `Chamber graphic ${f}`, type: 'override', mode: 'schedule', sig, madeAt: new Date().toISOString() }; if (!ledger[slotKey]) ledger[slotKey] = { scheduledFor: at, key: doneKey }; saveLedger(); }
      console.log(`  ALREADY ON THE PAGE  Chamber graphic ${f} for ${label}`);
      continue;
    }
    if (replacing) {
      try { const o = await getNode(fb, replacing.fbPostId, 'id,name,created_time,updated_time'); console.log(`    now in that slot: ${replacing.title} [${replacing.type}] ${o.id}, made ${o.created_time}, last changed ${o.updated_time}: "${flat(o.name).slice(0, 80)}"`); }
      catch (e) { console.log(`    now in that slot: ${replacing.title} [${replacing.type}] ${replacing.fbPostId} (${e.message})`); }
    }
  }
  if (dry) { console.log(`  WOULD SWAP  ${replacing ? `${replacing.title} [${replacing.type}]` : '(no worker post at that time)'} -> Chamber graphic ${f} for ${label} CT`); continue; }
  try {
    if (replacing) {
      const r = await deletePost(fb, replacing.fbPostId);
      console.log(`  ${r.toUpperCase()}  ${replacing.title} [${replacing.type}] for ${label}`);
      ledger[replacing.key] = { ...ledger[replacing.key], fbPostId: null, replacedBy: doneKey };
      saveLedger();
    }
    const res = await postPhoto({ ...fb, mode: 'schedule' }, { imagePath, caption, altText: alt, publishAtEpoch: at });
    ledger[doneKey] = { fbPostId: res.post_id || res.id, scheduledFor: at, title: `Chamber graphic ${f}`, type: 'override', mode: 'schedule', sig, replaced: replacing ? replacing.fbPostId : null, madeAt: new Date().toISOString() };
    if (!ledger[slotKey]) ledger[slotKey] = { scheduledFor: at, key: doneKey };
    saveLedger();
    console.log(`  SENT   Chamber graphic ${f} scheduled for ${label} CT (id ${ledger[doneKey].fbPostId})`);
  } catch (e) {
    console.log(`  FAILED Chamber graphic ${f}: ${e.message}`);
    process.exitCode = 1;
  }
}

// 1) the calendar
const indexHtml = path.join(repoDir, 'index.html');
const seed = loadSeed(indexHtml);
const cards = loadCarouselFlyers(indexHtml);
const admin = await fetchAdminEvents();
if (admin.error) console.log(`Note: could not read admin-added events (${admin.error}). Using the built-in calendar only.`);
const events = [...seed, ...admin.events];

// 1b) keep the calendar subscription file (hobart-chamber.ics) in step with the calendar
const ics = writeICS(events, path.join(repoDir, 'hobart-chamber.ics'), today);
console.log(`Calendar subscription: ${ics.count} events${ics.changed ? ' (updated)' : ' (no changes)'}`);

// 2) the five-a-day plan
const restaurants = loadRestaurants(socialDir);
const members = loadMembers(indexHtml);
const pubNow = opt('publish-now');
const data = loadData(socialDir);
let scheduled = planWeek(events, { members, data }, pubNow ? zonedEpoch(today, '00:00') : nowEpoch, ledger);
if (pubNow) scheduled = scheduled.filter((p) => p.scheduledDay === today && p.slot === pubNow);
if (opt('only')) scheduled = scheduled.filter((p) => p.ev.id === opt('only') || p.slot === opt('only'));
const skipped = [];
const due = scheduled;

console.log(`Today (Central): ${today}. ${events.length} calendar events, ${members.length} members, ${restaurants.length} restaurants. ${scheduled.length} post(s) to make.`);

// 3) make + send
fs.mkdirSync(outDir, { recursive: true });
let made = 0;
for (const post of scheduled) {
  const ev = { ...post.ev };
  if ((post.type === 'announce' || post.type === 'reminder') && ev.runDates && ev.runDates.length > 1) ev.taglineOverride = `Dates: ${runDatesText(ev.runDates)}.`;

  let flyerPath = ['announce', 'reminder'].includes(post.type) ? matchFlyer(ev, cards, repoDir) : null;
  if (!flyerPath && ev.flyerUrl) flyerPath = await downloadFlyer(ev.flyerUrl, path.join(socialDir, 'out', 'flyers'), ev.id);

  if (flyerPath && !ev.palette) { const pal = await flyerPalette(flyerPath); if (pal) ev.palette = pal; }

  const slug = `${post.scheduledDay}-${post.slot.replace(':', '')}-${String(ev.id).replace(/[^a-z0-9_-]/gi, '').slice(0, 40)}-${post.type}`;
  const png = path.join(outDir, `${slug}.png`);
  await renderPNG(postHTML(ev, { today: post.scheduledDay, socialDir, flyerFileUrl: flyerPath ? 'file://' + flyerPath : null }), png);
  const caption = post.caption ? post.caption : post.type === 'lineup' ? lineupCaption(post.items, ev.date, ev.title)
    : post.type === 'eat' ? restaurantCaption(post.restaurant, post.scheduledDay)
    : post.type === 'member' ? memberCaption(post.member, post.scheduledDay)
    : post.type === 'evergreen' ? post.caption
    : writeCaption({ type: post.type, ev }, post.scheduledDay);
  fs.writeFileSync(path.join(outDir, `${slug}.txt`), caption);
  console.log(`  ${post.slot} ${post.type}: ${cleanTitle(ev.title)}`);

  const when = new Date(post.scheduledFor * 1000).toLocaleString('en-US', { timeZone: CONFIG.TZ, dateStyle: 'medium', timeStyle: 'short' });
  if (dry) {
    console.log(`  DRAFT  ${cleanTitle(ev.title)} [${post.type}] for ${when} CT -> ${path.relative(socialDir, png)}`);
  } else {
    try {
      const res = await postPhoto(pubNow ? { ...fb, mode: 'publish' } : fb, { imagePath: png, caption, altText: ['announce', 'reminder'].includes(post.type) ? altText(ev) : `Hobart Happenings graphic: ${cleanTitle(ev.title)}. ${ev.taglineOverride || ''}`.trim(), publishAtEpoch: post.scheduledFor });
      ledger[post.slotKey] = { scheduledFor: post.scheduledFor, key: post.key };
      ledger[post.key] = { fbPostId: res.post_id || res.id, scheduledFor: post.scheduledFor, title: cleanTitle(ev.title), type: post.type, mode: fb.mode, madeAt: new Date().toISOString() };
      fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
      fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
      console.log(`  SENT   ${cleanTitle(ev.title)} [${post.type}] ${fb.mode === 'schedule' && !pubNow ? 'scheduled for ' + when + ' CT' : 'published now'} (id ${ledger[post.key].fbPostId})`);
    } catch (e) {
      console.log(`  FAILED ${cleanTitle(ev.title)} [${post.type}]: ${e.message}`);
      process.exitCode = 1;
    }
  }
  made++;
}
if (!made) console.log('Nothing to post right now.');
if (dry && !flag('dry-run')) console.log('(Facebook is not connected yet, so these are drafts only. Add FB_PAGE_ID and FB_PAGE_TOKEN to go live.)');
await closeBrowser();
