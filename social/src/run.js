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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSeed, loadCarouselFlyers, matchFlyer, fetchAdminEvents, downloadFlyer } from './events.js';
import { planWeek, centralNow, zonedEpoch, CONFIG, WEEK_STARTS } from './plan.js';
import { loadRestaurants, loadMembers, loadData, lineupCaption, restaurantCaption, memberCaption } from './content.js';
import { postHTML, cleanTitle } from './template.js';
import { writeCaption, altText, runDatesText } from './caption.js';
import { renderPNG, closeBrowser } from './render.js';
import { flyerPalette } from './palettes.js';
import { writeICS } from './ics.js';
import { fbConfig, postPhoto, checkPage, deletePost } from './facebook.js';

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

// 0) optional: throw away the worker's own FUTURE scheduled posts (only ones in the ledger, from the new plan's start date on) and re-plan them
if (flag('reset-scheduled')) {
  const gone = new Set();
  for (const [k, v] of Object.entries(ledger)) {
    if (!v || !v.fbPostId || !v.scheduledFor || v.mode !== 'schedule' || k.startsWith('slot:')) continue;
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.TZ }).format(new Date(v.scheduledFor * 1000));
    if (v.scheduledFor <= nowEpoch + 600 || day < WEEK_STARTS) continue;       // never touch posts that are live, about to go, or from the old plan
    if (dry) { console.log(`  WOULD DELETE ${v.title} [${v.type}] for ${day} (id ${v.fbPostId})`); continue; }
    try { const res = await deletePost(fb, v.fbPostId); console.log(`  ${res.toUpperCase()}  ${v.title} [${v.type}] for ${day}`); gone.add(v.scheduledFor); }
    catch (e) { console.log(`  COULD NOT DELETE ${v.title} for ${day}: ${e.message}`); process.exitCode = 1; }
  }
  for (const [k, v] of Object.entries(ledger)) if (v && gone.has(v.scheduledFor)) delete ledger[k];
  if (!dry) { fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n'); console.log(`Removed ${gone.size} scheduled post(s). Planning them again now.`); }
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
