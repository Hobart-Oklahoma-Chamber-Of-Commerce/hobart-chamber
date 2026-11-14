// Post "looks". Every post type gets its own color family so the page is easy to scan.
// The site's fonts and layout never change; only the colors do.
//   lineup   blue + gold (most days are ball games)
//   member   navy + gold + silver (business)
//   engage   deep teal + coral
//   events   colors pulled from the event's own flyer (see flyerPalette), else the seasonal look
import { chromium } from 'playwright';
import fs from 'node:fs';

export const PALETTES = {
  lineup: {
    band: '#1a3ea8', royal: '#1a3ea8', navy: '#0e2056', gold: '#c49a3e', goldLt: '#e8c978',
    cream: '#eef2fb', rays: 'rgba(26,62,168,.11)', accent: '#c49a3e', badgeInk: '#0e2056',
    colors: ['#1a3ea8', '#c49a3e', '#7f9ae0', '#e8c978'], strip: 'court',
  },
  member: {
    band: '#0e2056', royal: '#0e2056', navy: '#0e2056', gold: '#b9923a', goldLt: '#d9dee8',
    cream: '#eceff5', rays: 'rgba(120,134,160,.20)', accent: '#c49a3e', badgeInk: '#0e2056',
    colors: ['#c49a3e', '#aab3c2', '#dab65e', '#7d8aa5'], strip: 'dots',
  },
  engage: {
    band: '#0f5c63', royal: '#0f5c63', navy: '#0b2f3a', gold: '#c49a3e', goldLt: '#f3d9a4',
    cream: '#f7efe2', rays: 'rgba(226,103,74,.13)', accent: '#e2674a', badgeInk: '#ffffff',
    colors: ['#e2674a', '#0f5c63', '#f0b24a', '#7fc4c0'], strip: 'dots',
  },
};

// ---- colors from a flyer image ----
const toHSL = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
  return { h, s, l };
};
const hex = ({ h, s, l }) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
};
const rgba = (hsl, a) => { const h = hex(hsl); return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`; };

export async function flyerPalette(imagePath) {
  try {
    const buf = fs.readFileSync(imagePath);
    const mime = /\.png$/i.test(imagePath) ? 'image/png' : 'image/jpeg';
    const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
    const page = await b.newPage();
    const px = await page.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
      return Array.from(x.getImageData(0, 0, 64, 64).data);
    }, `data:${mime};base64,${buf.toString('base64')}`);
    await b.close();
    const bins = new Map();
    for (let i = 0; i < px.length; i += 4) {
      const rgb = [px[i], px[i + 1], px[i + 2]];
      const { h, s, l } = toHSL(rgb);
      if (s < 0.28 || l < 0.14 || l > 0.9) continue;                       // skip grays, near-black, near-white
      const k = Math.round(h / 24);
      const o = bins.get(k) || { n: 0, h: 0, s: 0, l: 0 };
      const w = s * (h > 18 && h < 58 && l > 0.5 ? 0.3 : 1);   // tan paper counts less than real ink colors
      o.n += w; o.h += h * w; o.s += s * w; o.l += l * w; bins.set(k, o);
    }
    const list = [...bins.values()].map((o) => ({ n: o.n, h: o.h / o.n, s: o.s / o.n, l: o.l / o.n })).sort((a, b) => b.n - a.n);
    const total = list.reduce((a, o) => a + o.n, 0);
    if (!list.length || total < 25) return null;                           // flyer has no real color: keep the seasonal look
    const main = list[0];
    const second = list.find((o) => Math.min(Math.abs(o.h - main.h), 360 - Math.abs(o.h - main.h)) > 40) || { ...main, h: (main.h + 30) % 360 };
    const band = { h: main.h, s: Math.min(0.75, Math.max(0.4, main.s)), l: 0.22 };           // dark enough for cream text
    const navy = { h: main.h, s: Math.min(0.7, main.s), l: 0.14 };
    const accent = { h: second.h, s: Math.max(0.55, second.s), l: Math.min(0.5, Math.max(0.38, second.l)) };
    const cream = { h: main.h, s: 0.45, l: 0.93 };
    return {
      band: hex(band), royal: hex({ ...band, l: 0.3 }), navy: hex(navy), gold: '#c49a3e', goldLt: hex({ h: main.h, s: 0.6, l: 0.82 }),
      cream: hex(cream), rays: rgba({ h: main.h, s: 0.6, l: 0.5 }, 0.12), accent: hex(accent), badgeInk: '#ffffff',
      colors: [hex({ ...main, l: 0.45 }), hex(accent), '#c49a3e', hex({ ...main, l: 0.75 })], source: 'flyer',
    };
  } catch (e) { return null; }
}
