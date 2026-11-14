// "Hobart Happenings" post template.
//
// The niche: every post is a page from a Main Street scrapbook. A paper-grain
// background, the event's real flyer taped on as a polaroid, the date as a
// tear-off ticket stub, a hand-lettered note ("this Saturday!"), and the Chamber's
// own logo and water tower navy/gold. Same bones on every post, different event.
//
// Output is plain HTML sized 1080x1350 (Facebook's 4:5 feed shape).

import { ICONS, UI, pickLook } from './icons.js';
import { themeFor, confetti, stripSVG, SITE } from './themes.js';

const W = 1080, H = 1350;
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const DAYS_TITLE = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parseDate(ds) { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d); }
function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }

export function cleanTitle(t) {
  return String(t || '')
    .replace(/\p{Extended_Pictographic}️?\s*/gu, '')
    .replace(/\s+[\u2014\u2013]\s+/g, ': ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanTime(t) {
  const s = String(t || '').trim();
  if (!s) return '';
  if (/see listing|showtime/i.test(s)) return 'Showtimes at hobartchamber.org';
  if (/^tba$/i.test(s)) return 'Time to be announced';
  return s.replace(/\s*[–-]\s*/g, ' – ');
}

export function cleanPlace(p) {
  return String(p || '')
    .replace(/\s*[\u00b7,]?\s*Hobart,?\s*(OK|Oklahoma)\.?\s*$/i, '')
    .replace(/[\s\u00b7,]+$/, '')
    .trim();
}

export function tagline(desc) {
  let s = String(desc || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  // first sentence only
  const abbr = /\b(Co|Inc|St|Mr|Mrs|Ms|Dr|Jr|Sr|No|vs|Ave|Rd|Ft|Mt)\.$/;
  const re = /[.!?](\s|$)/g; let mm, cut = -1;
  while ((mm = re.exec(s))) { if (!abbr.test(s.slice(0, mm.index + 1))) { cut = mm.index + 1; break; } }
  if (cut > 0) s = s.slice(0, cut);
  if (s.length > 132) s = s.slice(0, 128).replace(/\s+\S*$/, '') + '…';
  return s;
}

export function relativeNote(today, ds) {
  const n = daysBetween(today, ds);
  const dow = DAYS_TITLE[parseDate(ds).getDay()];
  if (n < 0) return 'Save the date!';
  if (n === 0) return 'Today!';
  if (n === 1) return 'Tomorrow!';
  const todayDow = parseDate(today).getDay(), evDow = parseDate(ds).getDay();
  if (n <= 6 && evDow > todayDow) return `This ${dow}!`;
  if (n <= 13) return `Next ${dow}!`;
  return 'Save the date!';
}

function titleSize(t) {
  const n = Math.max(1, t.length);
  const single = Math.floor(950 / (0.6 * n));   // largest size that fits on one line
  if (single >= 84) return Math.min(single, 120);
  const two = Math.floor(1880 / (0.6 * n));     // largest size that fits on two lines
  if (two >= 56) return Math.min(two, 78);
  return 54;
}

// deterministic pseudo-random so the same event always renders the same page
function rng(seed) {
  let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function tornEdge(seed, width, y, amp, down) {
  const r = rng(seed);
  let d = `M0 ${down ? 0 : y + amp * 2} L0 ${y}`;
  let x = 0;
  while (x < width) {
    x += 14 + r() * 22;
    d += ` L${Math.min(x, width).toFixed(1)} ${(y + (r() - 0.5) * amp * 2).toFixed(1)}`;
  }
  d += ` L${width} ${down ? 0 : y + amp * 2} Z`;
  return d;
}

const CSS = (fontsBase, th) => `
@font-face{font-family:'Play';font-weight:800;src:url('${fontsBase}/playfair-display-latin-800-normal.woff2') format('woff2');}
@font-face{font-family:'Play';font-weight:900;src:url('${fontsBase}/playfair-display-latin-900-normal.woff2') format('woff2');}
@font-face{font-family:'PlayI';font-style:italic;font-weight:600;src:url('${fontsBase}/playfair-display-latin-600-italic.woff2') format('woff2');}
@font-face{font-family:'Inter';font-weight:500;src:url('${fontsBase}/inter-latin-500-normal.woff2') format('woff2');}
@font-face{font-family:'Inter';font-weight:700;src:url('${fontsBase}/inter-latin-700-normal.woff2') format('woff2');}
@font-face{font-family:'Inter';font-weight:800;src:url('${fontsBase}/inter-latin-800-normal.woff2') format('woff2');}
:root{--navy:#0e2056;--royal:#1a3ea8;--gold:#c49a3e;--goldlt:#dab65e;--cream:${th.season.paper};--paper:#ffffff;--ink:#0e2056;--accent:${th.accent};--rays:${th.season.rays};}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{width:${W}px;height:${H}px;background:var(--cream);overflow:hidden;font-family:'Inter',sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased;}
.page{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:var(--cream);}
.grain{position:absolute;inset:0;pointer-events:none;z-index:50;mix-blend-mode:multiply;}
.rays{position:absolute;left:-200px;top:140px;width:1480px;height:1480px;background:repeating-conic-gradient(from 0deg at 50% 38%,var(--rays) 0 7deg,rgba(255,255,255,0) 7deg 14deg);}
/* header */
.header{position:absolute;left:0;top:0;width:${W}px;height:230px;z-index:5;}
.header svg.band{position:absolute;left:0;top:0;}
.brand{position:absolute;left:250px;top:42px;z-index:6;}
.brand .t{font-family:'Play';font-weight:900;font-size:62px;line-height:1;color:var(--cream);letter-spacing:.5px;text-shadow:0 3px 0 rgba(0,0,0,.25);}
.brand .s{font-family:'Inter';font-weight:700;font-size:25px;letter-spacing:4.5px;color:var(--goldlt);margin-top:10px;text-transform:uppercase;}
.logo{position:absolute;left:40px;top:22px;width:186px;height:186px;border-radius:50%;background:var(--paper);border:7px solid var(--gold);z-index:8;box-shadow:0 8px 0 rgba(14,32,86,.28),0 14px 24px rgba(14,32,86,.25);display:flex;align-items:center;justify-content:center;}
.logo img{width:150px;height:150px;object-fit:contain;}
/* left column */
.badge{position:absolute;left:52px;top:236px;width:176px;height:176px;border-radius:50%;transform:rotate(-9deg);z-index:9;display:flex;align-items:center;justify-content:center;text-align:center;box-shadow:0 6px 0 rgba(0,0,0,.18);}
.badge::after{content:'';position:absolute;inset:8px;border-radius:50%;border:3px dashed rgba(255,255,255,.75);}
.badge span{position:relative;z-index:2;font-family:'Inter';font-weight:800;font-size:33px;line-height:.98;color:#fff;text-transform:uppercase;letter-spacing:1px;padding:0 20px;}
.stub{position:absolute;left:44px;top:436px;width:300px;height:318px;transform:rotate(-3deg);z-index:7;filter:drop-shadow(0 10px 0 rgba(14,32,86,.20)) drop-shadow(0 18px 18px rgba(14,32,86,.18));}
.stub .in{position:absolute;inset:0;background:var(--paper);
  -webkit-mask:radial-gradient(circle 15px at 0 50%,transparent 97%,#000 100%) left/51% 100% no-repeat,radial-gradient(circle 15px at 100% 50%,transparent 97%,#000 100%) right/51% 100% no-repeat;
          mask:radial-gradient(circle 15px at 0 50%,transparent 97%,#000 100%) left/51% 100% no-repeat,radial-gradient(circle 15px at 100% 50%,transparent 97%,#000 100%) right/51% 100% no-repeat;
  border-radius:10px;}
.stub .frame{position:absolute;inset:14px;border:3px solid var(--navy);border-radius:6px;}
.stub .dow{position:absolute;top:26px;left:0;right:0;text-align:center;font-family:'Inter';font-weight:800;font-size:34px;letter-spacing:7px;color:var(--royal);}
.stub .day{position:absolute;top:60px;left:0;right:0;text-align:center;font-family:'Play';font-weight:900;font-size:150px;line-height:1.02;color:var(--navy);}
.stub .mon{position:absolute;top:222px;left:0;right:0;text-align:center;font-family:'Inter';font-weight:800;font-size:40px;letter-spacing:9px;color:var(--navy);}
.stub .perf{position:absolute;left:14px;right:14px;top:266px;border-top:4px dotted var(--navy);opacity:.7;}
.stub .note{position:absolute;left:14px;right:14px;top:274px;bottom:14px;background:var(--gold);border-radius:0 0 4px 4px;display:flex;align-items:center;justify-content:center;font-family:'PlayI';font-style:italic;font-weight:600;font-size:31px;color:var(--navy);text-align:center;line-height:1;}
/* hero */
.hero{position:absolute;left:372px;top:236px;width:676px;height:530px;z-index:4;display:flex;align-items:center;justify-content:center;}
.polaroid{position:relative;background:var(--paper);padding:18px 18px 70px;box-shadow:0 14px 0 rgba(14,32,86,.14),0 26px 34px rgba(14,32,86,.28);transform:rotate(2.2deg);}
.polaroid img{display:block;max-width:572px;max-height:420px;object-fit:contain;background:#eee;}
.polaroid .cap{position:absolute;left:0;right:0;bottom:14px;text-align:center;font-family:'PlayI';font-style:italic;font-weight:600;font-size:36px;color:var(--navy);}
.tape{position:absolute;width:150px;height:44px;background:repeating-linear-gradient(135deg,rgba(196,154,62,.85) 0 10px,rgba(240,207,124,.85) 10px 20px);opacity:.92;box-shadow:0 2px 6px rgba(0,0,0,.2);}
.tape.a{left:-44px;top:-10px;transform:rotate(-38deg);}
.tape.b{right:-44px;top:-12px;transform:rotate(36deg);}
.scene{position:relative;width:560px;height:520px;}
.scene .sun{position:absolute;left:50px;top:20px;width:470px;height:470px;border-radius:50%;background:radial-gradient(circle,var(--paper) 0 38%,rgba(255,253,246,0) 39%),repeating-conic-gradient(from 0deg,var(--accent) 0 6deg,var(--gold) 6deg 12deg);box-shadow:0 12px 0 rgba(14,32,86,.14);}
.scene .ring{position:absolute;left:92px;top:62px;width:386px;height:386px;border-radius:50%;background:var(--paper);border:6px solid var(--navy);box-shadow:inset 0 0 0 10px var(--cream);}
.scene .ico{position:absolute;left:132px;top:102px;width:306px;height:306px;transform:rotate(-4deg);}
.scene .ico svg{width:100%;height:100%;}
.spark{position:absolute;color:var(--gold);}
.spark svg{width:100%;height:100%;}
/* body */
.body{position:absolute;left:60px;right:60px;top:780px;height:440px;z-index:6;display:flex;flex-direction:column;justify-content:center;}
.title{font-family:'Play';font-weight:900;color:var(--navy);line-height:1.04;text-wrap:balance;letter-spacing:.2px;}
.squig{display:block;margin:8px 0 0 2px;}
.tag{font-family:'PlayI';font-style:italic;font-weight:600;font-size:32px;line-height:1.32;color:#2f3d6e;margin-top:12px;max-width:930px;text-wrap:pretty;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.rows{margin-top:16px;display:flex;flex-direction:column;gap:12px;}
.rows.many .row{font-size:30px;}.rows.many .ic{flex-basis:50px;width:50px;height:50px;}.rows.many{gap:9px;}
.row{display:flex;align-items:center;gap:16px;font-family:'Inter';font-weight:700;font-size:34px;line-height:1.15;color:var(--navy);}
.row .ic{flex:0 0 58px;width:58px;height:58px;border-radius:50%;background:var(--gold);color:var(--navy);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 0 rgba(14,32,86,.22);}
.row .ic svg{width:32px;height:32px;}
/* footer */
.footer{position:absolute;left:0;bottom:0;width:${W}px;height:130px;z-index:6;}
.footer svg{position:absolute;left:0;top:0;}
.footer .l{position:absolute;left:60px;bottom:26px;font-family:'Inter';font-weight:700;font-size:27px;letter-spacing:3.5px;color:var(--goldlt);text-transform:uppercase;line-height:1.15;}
.footer .r{position:absolute;right:60px;bottom:20px;font-family:'Play';font-weight:900;font-size:42px;color:var(--cream);text-shadow:0 3px 0 rgba(0,0,0,.25);}
`;

function sparkle(x, y, size, rot, color) {
  return `<div class="spark" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px;transform:rotate(${rot}deg);${color ? `color:${color};` : ''}">${UI.star}</div>`;
}

/**
 * @param ev   {id,title,date,time,location,description,cat, flyerFile?}
 * @param ctx  {today:'YYYY-MM-DD', socialDir:'/abs/path/to/social', flyerFileUrl?:string}
 */
export function postHTML(ev, ctx) {
  const title = cleanTitle(ev.title);
  const d = parseDate(ev.date);
  const look = ev.look || pickLook(ev);
  const th = themeFor(ctx.today || ev.date, look.icon, { season: ctx.season, accent: ev.accent });
  const accent = th.accent;
  const time = cleanTime(ev.time);
  const place = cleanPlace(ev.location);
  const tag = ev.taglineOverride || tagline(ev.description);
  const note = relativeNote(ctx.today, ev.date);
  const fonts = `file://${ctx.socialDir}/fonts`;
  const logo = `file://${ctx.socialDir}/assets/chamber-logo.png`;
  const seed = ev.id || title;
  const ts = titleSize(title);
  const stub = ev.stub || { dow: DAYS[d.getDay()], big: String(d.getDate()), mon: MONTHS[d.getMonth()], note };
  const rowsHTML = (ev.rows || [...(time ? [{ i: 'clock', t: time }] : []), ...(place ? [{ i: 'pin', t: place }] : [])])
    .map((r) => `<div class="row"><div class="ic">${UI[r.i] || UI.star}</div><div>${esc(r.t)}</div></div>`).join('');

  const hero = ctx.flyerFileUrl
    ? `<div class="hero"><div class="polaroid">
         <span class="tape a"></span><span class="tape b"></span>
         <img src="${ctx.flyerFileUrl}" alt="">
         <div class="cap">see you there ★</div>
       </div></div>`
    : `<div class="hero"><div class="scene">
         <div class="sun"></div><div class="ring"></div>
         <div class="ico">${ICONS[look.icon] || ICONS.star}</div>
         ${sparkle(14, 44, 54, -12)}${sparkle(488, 22, 40, 14, '#dab65e')}${sparkle(500, 400, 56, 8)}${sparkle(40, 410, 34, -8, '#dab65e')}
       </div></div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS(fonts, th)}</style></head><body>
<div class="page">
  <div class="rays"></div>
  ${confetti(th, seed)}

  <div class="header">
    <svg class="band" width="${W}" height="230" viewBox="0 0 ${W} 230"><path d="${tornEdge(seed + 'h', W, 188, 7, true)}" fill="#1a3ea8"/><path d="M0 0 H${W} V186 H0 Z" fill="#1a3ea8"/>
      <path d="M0 176 H${W}" stroke="#c49a3e" stroke-width="3" stroke-dasharray="3 12" stroke-linecap="round" opacity=".8"/></svg>
    ${stripSVG(th.ev.strip, accent)}<div class="logo"><img src="${logo}" alt=""></div>
    <div class="brand"><div class="t">Hobart Happenings</div><div class="s">Your Hobart Chamber of Commerce</div></div>
  </div>

  <div class="badge" style="background:${accent}"><span>${esc(look.badge)}</span></div>

  <div class="stub"><div class="in"></div><div class="frame"></div>
    <div class="dow">${esc(stub.dow)}</div>
    <div class="day" style="font-size:${stub.big.length > 2 ? 96 : 150}px;${stub.big.length > 2 ? 'padding-top:34px;' : ''}">${esc(stub.big)}</div>
    <div class="mon">${esc(stub.mon)}</div>
    <div class="perf"></div>
    <div class="note">${esc(stub.note)}</div>
  </div>

  ${hero}

  <div class="body">
    <div class="title" style="font-size:${ts}px">${esc(title)}</div>
    <svg class="squig" width="360" height="18" viewBox="0 0 360 18"><path d="M3 10 q15 -12 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" fill="none" stroke="#c49a3e" stroke-width="6" stroke-linecap="round"/></svg>
    ${tag ? `<div class="tag">${esc(tag)}</div>` : ''}
    <div class="rows${(ev.rows || []).length > 3 ? ' many' : ''}">
      ${rowsHTML}
    </div>
  </div>

  <div class="footer">
    <svg width="${W}" height="130" viewBox="0 0 ${W} 130"><path d="${tornEdge(seed + 'f', W, 22, 7, false)}" transform="translate(0,0)" fill="#1a3ea8"/><rect x="0" y="40" width="${W}" height="90" fill="#1a3ea8"/></svg>
    <div class="l">Everything happening<br>in Hobart</div>
    <div class="r">hobartchamber.org</div>
  </div>

  <svg class="grain" width="${W}" height="${H}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .42  0 0 0 0 .32  0 0 0 0 .18  0 0 0 .16 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
</div></body></html>`;
}

export { SITE };
export const SIZE = { W, H };
