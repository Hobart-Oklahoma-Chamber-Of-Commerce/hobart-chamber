// Theme engine: every post = SEASON look x EVENT look, both layered on the website's own palette.
//
//   Website tokens (index.html :root): royal #1a3ea8, navy-deep #0e2056, gold #c49a3e,
//   gold-light #dab65e, gold-pale #f6edd6, slate #f3f6fc, Playfair Display + Inter.
//   Those NEVER change, so every post is recognizably the Chamber.
//   SEASON changes the paper tint, sunburst color and the falling motif in the margins.
//   EVENT changes the sticker color, hero icon, header strip pattern and a couple of motifs.

export const SITE = {
  royal: '#1a3ea8', navy: '#0e2056', gold: '#c49a3e', goldLt: '#dab65e', pale: '#f6edd6', slate: '#f3f6fc',
};

// meteorological seasons, tuned for Oklahoma; a few calendar-specific overrides sit in holidayFor()
export function seasonFor(ds) {
  const m = Number(ds.slice(5, 7));
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'fall';
  return 'winter';
}

export const SEASONS = {
  fall:   { paper: '#f8ecd2', rays: 'rgba(204,112,40,.13)',  motif: 'leaf',    colors: ['#c8601f', '#d9a02f', '#9a3b1e', '#b7791f'], label: 'FALL' },
  winter: { paper: '#edf2fb', rays: 'rgba(120,160,225,.18)', motif: 'snow',    colors: ['#8fb3e6', '#bcd3f2', '#6f95d1', '#ffffff'], label: 'WINTER' },
  spring: { paper: '#f6f1df', rays: 'rgba(232,140,170,.14)', motif: 'blossom', colors: ['#f08fb0', '#f6b6c9', '#9ccf8a', '#f7d36a'], label: 'SPRING' },
  summer: { paper: '#fbf1d3', rays: 'rgba(250,190,40,.20)',  motif: 'sun',     colors: ['#f2b01e', '#f28a2e', '#5fb0c9', '#f7d36a'], label: 'SUMMER' },
};

// event looks: keyed by the icon the event resolves to
export const EVENT_LOOKS = {
  football:   { accent: '#8a4b25', motif: 'stitch',  strip: 'yard',   extra: ['#8a4b25', '#c49a3e'] },
  basketball: { accent: '#e2671f', motif: 'star',    strip: 'court',  extra: ['#e2671f', '#1a3ea8'] },
  music:      { accent: '#6b3fa0', motif: 'note',    strip: 'staff',  extra: ['#6b3fa0', '#c49a3e'] },
  market:     { accent: '#c8432c', motif: 'star',    strip: 'awning', extra: ['#c8432c', '#e8a93a'] },
  pumpkin:    { accent: '#e07a1f', motif: 'pumpkin', strip: 'dots',   extra: ['#e07a1f', '#3d7a3f'] },
  ghost:      { accent: '#5c4a8a', motif: 'star',    strip: 'dots',   extra: ['#5c4a8a', '#e07a1f'] },
  golf:       { accent: '#2f8a4f', motif: 'star',    strip: 'grass',  extra: ['#2f8a4f', '#c49a3e'] },
  tree:       { accent: '#2f8a4f', motif: 'snow',    strip: 'lights', extra: ['#2f8a4f', '#c8432c'] },
  theater:    { accent: '#9b2f4f', motif: 'star',    strip: 'curtain',extra: ['#9b2f4f', '#c49a3e'] },
  plate:      { accent: '#d8641f', motif: 'star',    strip: 'dots',   extra: ['#d8641f', '#c49a3e'] },
  store:      { accent: '#c8432c', motif: 'star',    strip: 'awning', extra: ['#c8432c', '#c49a3e'] },
  heart:      { accent: '#d9573b', motif: 'star',    strip: 'dots',   extra: ['#d9573b', '#c49a3e'] },
  default:    { accent: '#1a3ea8', motif: 'star',    strip: 'dots',   extra: ['#1a3ea8', '#c49a3e'] },
};

export function themeFor(ds, iconKey, opts = {}) {
  const season = SEASONS[opts.season || seasonFor(ds)];
  const ev = EVENT_LOOKS[iconKey] || EVENT_LOOKS.default;
  return { seasonKey: opts.season || seasonFor(ds), season, ev, accent: opts.accent || ev.accent };
}

function rnd(seed) {
  let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Margin confetti: seasonal motifs everywhere + a few event motifs; positions avoid the main content blocks.
import { MOTIFS } from './icons.js';
const SLOTS = [
  [900, 250, 60], [986, 330, 40], [960, 640, 52], [356, 700, 40], [20, 770, 46], [990, 760, 42],
  [20, 1190, 50], [880, 1186, 46], [520, 1236, 38], [300, 250, 34], [250, 735, 32], [1000, 1100, 40],
];
export function confetti(theme, seed) {
  const r = rnd(seed);
  const out = [];
  SLOTS.forEach(([x, y, size], i) => {
    const useEvent = i % 3 === 2;
    const key = useEvent ? theme.ev.motif : theme.season.motif;
    const pool = useEvent ? theme.ev.extra : theme.season.colors;
    const color = pool[Math.floor(r() * pool.length)];
    const rot = Math.round((r() - 0.5) * 80);
    const sz = Math.round(size * (0.85 + r() * 0.3));
    out.push(`<div style="position:absolute;left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;color:${color};opacity:.55;transform:rotate(${rot}deg);z-index:3">${MOTIFS[key] || MOTIFS.star}</div>`);
  });
  return out.join('');
}

// Strip under the header, patterned by event type (all drawn in code).
export function stripSVG(kind, accent, W = 1080) {
  const y = 196, h = 18;
  const A = accent, G = SITE.gold;
  let inner = '';
  if (kind === 'yard') for (let x = 0; x < W; x += 60) inner += `<rect x="${x}" y="${y}" width="3" height="${h}" fill="#fff" opacity=".85"/><rect x="${x + 30}" y="${y + 6}" width="2" height="${h - 12}" fill="#fff" opacity=".6"/>`;
  else if (kind === 'court') inner = `<rect x="0" y="${y + 7}" width="${W}" height="4" fill="#fff" opacity=".8"/>` + Array.from({ length: 8 }, (_, i) => `<circle cx="${70 + i * 140}" cy="${y + 9}" r="9" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>`).join('');
  else if (kind === 'staff') inner = [0, 5, 10, 15].map((o) => `<rect x="0" y="${y + o}" width="${W}" height="1.6" fill="#fff" opacity=".7"/>`).join('');
  else if (kind === 'awning') for (let x = 0; x < W; x += 90) inner += `<path d="M${x} ${y} h45 v${h - 6} a22.5 12 0 0 1 -45 0 Z" fill="#fff" opacity=".85"/>`;
  else if (kind === 'grass') for (let x = 0; x < W; x += 16) inner += `<path d="M${x} ${y + h} l5 -${h - 2} l5 ${h - 2}" fill="#fff" opacity=".7"/>`;
  else if (kind === 'lights') for (let x = 20; x < W; x += 54) inner += `<circle cx="${x}" cy="${y + 9}" r="7" fill="${['#fff', '#f0cf7c', '#ffb3a3'][(x / 54) % 3 | 0]}"/>`;
  else if (kind === 'curtain') for (let x = 0; x < W; x += 54) inner += `<path d="M${x} ${y} q27 ${h + 6} 54 0" fill="none" stroke="#fff" stroke-width="3" opacity=".75"/>`;
  else for (let x = 12; x < W; x += 36) inner += `<circle cx="${x}" cy="${y + 9}" r="4" fill="#fff" opacity=".8"/>`;
  return `<svg width="${W}" height="230" viewBox="0 0 ${W} 230" style="position:absolute;left:0;top:0;z-index:4"><rect x="0" y="${y - 4}" width="${W}" height="${h + 8}" fill="${A}"/>${inner}</svg>`;
}
