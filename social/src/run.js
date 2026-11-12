// The worker. One run = look at the calendar, decide what's due, make the
// pictures + captions, and (if Facebook is connected) schedule them on the Page.
//
//   node src/run.js --dry-run            make drafts only, never touch Facebook (default when no secrets)
//   node src/run.js                      schedule on the Page for real
//   node src/run.js --check              verify the Facebook token + Page, then stop
//   node src/run.js --now 2026-11-12T08:30   pretend it's this Central-time moment (testing)
//   node src/run.js --only <eventId>     only this event
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSeed, loadCarouselFlyers, matchFlyer, fetchAdminEvents, downloadFlyer } from './events.js';
import { duePosts, assignSlots, centralNow, zonedEpoch, CONFIG } from './plan.js';
import { postHTML, cleanTitle } from './template.js';
import { writeCaption, altText, runDatesText } from './caption.js';
import { renderPNG, closeBrowser } from './render.js';
import { fbConfig, postPhoto, checkPage } from './facebook.js';

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

// 1) the calendar
const indexHtml = path.join(repoDir, 'index.html');
const seed = loadSeed(indexHtml);
const cards = loadCarouselFlyers(indexHtml);
const admin = await fetchAdminEvents();
if (admin.error) console.log(`Note: could not read admin-added events (${admin.error}). Using the built-in calendar only.`);
const events = [...seed, ...admin.events];

// 2) what's due
let due = duePosts(events, today, ledger);
if (opt('only')) due = due.filter((p) => p.ev.id === opt('only'));
const { scheduled, skipped } = assignSlots(due, nowEpoch, ledger);

console.log(`Today (Central): ${today}. ${events.length} calendar events, ${due.length} post(s) due.`);
for (const s of skipped) console.log(`  skipped: ${cleanTitle(s.ev.title)} (${s.type}) - ${s.reason}`);

// 3) make + send
fs.mkdirSync(outDir, { recursive: true });
let made = 0;
for (const post of scheduled) {
  const ev = { ...post.ev };
  if (ev.runDates && ev.runDates.length > 1) ev.taglineOverride = `Dates: ${runDatesText(ev.runDates)}.`;

  let flyerPath = matchFlyer(ev, cards, repoDir);
  if (!flyerPath && ev.flyerUrl) flyerPath = await downloadFlyer(ev.flyerUrl, path.join(socialDir, 'out', 'flyers'), ev.id);

  const slug = `${post.eventDate}-${String(ev.id).replace(/[^a-z0-9_-]/gi, '')}-${post.type}`;
  const png = path.join(outDir, `${slug}.png`);
  await renderPNG(postHTML(ev, { today: post.scheduledDay, socialDir, flyerFileUrl: flyerPath ? 'file://' + flyerPath : null }), png);
  const caption = writeCaption({ type: post.type, ev }, post.scheduledDay);
  fs.writeFileSync(path.join(outDir, `${slug}.txt`), caption);

  const when = new Date(post.scheduledFor * 1000).toLocaleString('en-US', { timeZone: CONFIG.TZ, dateStyle: 'medium', timeStyle: 'short' });
  if (dry) {
    console.log(`  DRAFT  ${cleanTitle(ev.title)} [${post.type}] for ${when} CT -> ${path.relative(socialDir, png)}`);
  } else {
    try {
      const res = await postPhoto(fb, { imagePath: png, caption, altText: altText(ev), publishAtEpoch: post.scheduledFor });
      ledger[post.key] = { fbPostId: res.post_id || res.id, scheduledFor: post.scheduledFor, title: cleanTitle(ev.title), type: post.type, mode: fb.mode, madeAt: new Date().toISOString() };
      fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
      fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
      console.log(`  SENT   ${cleanTitle(ev.title)} [${post.type}] ${fb.mode === 'schedule' ? 'scheduled for ' + when + ' CT' : 'published'} (id ${ledger[post.key].fbPostId})`);
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
