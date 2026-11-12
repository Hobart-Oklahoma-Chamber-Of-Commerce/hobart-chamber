import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSeed, loadCarouselFlyers, matchFlyer } from './events.js';
import { postHTML } from './template.js';
import { renderPNG, closeBrowser } from './render.js';

const socialDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(socialDir, '..');
const index = path.join(repoDir, 'index.html');
const seed = loadSeed(index);
const cards = loadCarouselFlyers(index);

// [event id or title match, pretend "today"]
const picks = [
  { find: (e) => /First Saturday Market/.test(e.title) && e.date === '2026-11-07', today: '2026-11-02' },
  { find: (e) => /Par 3/.test(e.title) && e.date === '2026-11-07', today: '2026-11-05' },
  { find: (e) => /Food Pantry/.test(e.title) && e.date === '2026-11-18', today: '2026-11-12' },
  { find: (e) => /Dickens/.test(e.title) && e.date === '2026-11-28', today: '2026-11-12' },
  { find: (e) => /Women.s Friendship/.test(e.title), today: '2026-10-20' },
  { find: (e) => /Trunk or Treat/.test(e.title), today: '2026-10-30' },
];
const only = process.argv[2];
let n = 0;
for (const p of picks) {
  const ev = seed.find(p.find);
  if (!ev) { console.log('no event for pick', n); n++; continue; }
  const flyer = matchFlyer(ev, cards, repoDir);
  const html = postHTML(ev, { today: p.today, socialDir, flyerFileUrl: flyer ? 'file://' + flyer : null });
  const out = path.join(socialDir, 'out', `sample-${n + 1}-${ev.id}.png`);
  if (!only || String(n + 1) === only) { await renderPNG(html, out); console.log('wrote', out, flyer ? '(flyer)' : '(no flyer)'); }
  n++;
}
await closeBrowser();
