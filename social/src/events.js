// Reads the Chamber's calendar the same way the website does:
//  1) the hard-coded SEED list inside index.html
//  2) (worker) events Jessica adds in the admin panel, from Firestore
import fs from 'node:fs';
import path from 'node:path';

export function loadSeed(indexHtmlPath) {
  const s = fs.readFileSync(indexHtmlPath, 'utf8');
  const a = s.indexOf('var SEED=[');
  if (a < 0) throw new Error('SEED not found in index.html');
  let depth = 0, i = a + 9, end = -1;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  // The array is plain JS object literals; evaluate it in an isolated function scope.
  // eslint-disable-next-line no-new-func
  return new Function('return ' + s.slice(a + 9, end + 1))();
}

// Carousel cards carry the flyer for an event: <div class="event-card" data-date=".."> ... <img src="flyers/x.jpg"> ... <h4>Title</h4>
export function loadCarouselFlyers(indexHtmlPath) {
  const s = fs.readFileSync(indexHtmlPath, 'utf8');
  const out = [];
  const re = /<div class="event-card" data-date="([^"]+)"[^>]*><div class="flyer-slot"><img src="([^"]+)"[\s\S]*?<h4>([\s\S]*?)<\/h4>/g;
  let m;
  while ((m = re.exec(s))) out.push({ date: m[1], src: m[2], title: m[3].replace(/<[^>]+>/g, '').trim() });
  return out;
}

const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const words = (t) => new Set(norm(t).split(' ').filter((w) => w.length > 2));

export function matchFlyer(ev, cards, repoDir) {
  const ew = words(ev.title);
  let best = null, bestScore = 0;
  for (const c of cards) {
    if (c.date !== ev.date) continue;
    const cw = words(c.title);
    let hit = 0; for (const w of ew) if (cw.has(w)) hit++;
    const score = hit / Math.max(1, Math.min(ew.size, cw.size));
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (best && bestScore >= 0.5) {
    const p = path.join(repoDir, best.src);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ---- events Jessica adds in the admin panel (Firestore) ----
const PROJECT = 'hobart-chamber';
function fromFs(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  return null;
}
export async function fetchAdminEvents() {
  const out = [];
  let pageToken = '';
  try {
    do {
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/events?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Firestore ${res.status}`);
      const json = await res.json();
      for (const doc of json.documents || []) {
        const f = {}; for (const [k, v] of Object.entries(doc.fields || {})) f[k] = fromFs(v);
        f.id = doc.name.split('/').pop();
        f._admin = true;
        out.push(f);
      }
      pageToken = json.nextPageToken || '';
    } while (pageToken);
  } catch (e) {
    return { events: out, error: String(e.message || e) };
  }
  return { events: out };
}

export async function downloadFlyer(url, destDir, id) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    const ext = /png/.test(type) ? 'png' : /webp/.test(type) ? 'webp' : 'jpg';
    fs.mkdirSync(destDir, { recursive: true });
    const p = path.join(destDir, `${String(id).replace(/[^a-z0-9_-]/gi, '')}.${ext}`);
    fs.writeFileSync(p, Buffer.from(await res.arrayBuffer()));
    return p;
  } catch { return null; }
}
