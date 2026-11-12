// Hand-built vector icons for the Hobart Happenings post template.
// Every icon is drawn on a 100x100 canvas with the same chunky rounded stroke
// so the whole set reads as one hand-inked family. No AI-generated art anywhere.

const N = '#0a1f5c';   // ink navy
const G = '#e3b04b';   // gold
const R = '#d9573b';   // barn red
const O = '#ef8a2f';   // sunset orange
const GR = '#5b9a5e';  // field green
const C = '#fff8e6';   // paper cream
const SK = '#8fc3e8';  // sky blue

const wrap = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="${N}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const ICONS = {
  golf: wrap(`
    <path d="M6 82 Q50 58 94 82 L94 92 L6 92 Z" fill="${GR}"/>
    <line x1="60" y1="18" x2="60" y2="72"/>
    <path d="M60 18 L86 28 L60 38 Z" fill="${R}"/>
    <circle cx="34" cy="74" r="7" fill="${C}"/>
    <circle cx="32" cy="72" r="1" fill="${N}" stroke="none"/><circle cx="36" cy="75" r="1" fill="${N}" stroke="none"/>`),

  market: wrap(`
    <path d="M10 40 L20 14 H80 L90 40 Z" fill="${C}"/>
    <path d="M30 14 L26 40 M50 14 V40 M70 14 L74 40" />
    <path d="M20 14 H30 L26 40 H10 Z M50 14 H70 L74 40 H50 Z" fill="${R}"/>
    <path d="M10 40 q8 10 16 0 q8 10 16 0 q8 10 16 0 q8 10 16 0 q8 10 16 0" fill="${C}"/>
    <line x1="18" y1="52" x2="18" y2="88"/><line x1="82" y1="52" x2="82" y2="88"/>
    <rect x="18" y="68" width="64" height="12" rx="3" fill="${G}"/>
    <circle cx="36" cy="62" r="6" fill="${O}"/><circle cx="52" cy="62" r="6" fill="${R}"/><circle cx="68" cy="62" r="6" fill="${GR}"/>`),

  plate: wrap(`
    <circle cx="50" cy="52" r="30" fill="${C}"/>
    <circle cx="50" cy="52" r="19" fill="${G}" opacity=".55"/>
    <path d="M12 22 V44 M8 22 V36 q0 8 8 8 q0 0 0 0 M16 22 V36 M12 44 V84" />
    <path d="M88 22 q-10 8 -8 30 h8 Z M88 52 V84" fill="${C}"/>`),

  pumpkin: wrap(`
    <path d="M48 24 q-2 -10 8 -14" stroke="${GR}" stroke-width="5"/>
    <path d="M50 26 C16 18 4 46 14 68 C22 86 40 88 50 82 C60 88 78 86 86 68 C96 46 84 18 50 26 Z" fill="${O}"/>
    <path d="M50 26 C40 40 40 70 50 82 M50 26 C60 40 60 70 50 82" />
    <path d="M34 48 l6 6 M66 48 l-6 6" stroke-width="3.5"/>`),

  ghost: wrap(`
    <path d="M22 86 V44 C22 22 36 12 50 12 C64 12 78 22 78 44 V86 L68 78 L59 86 L50 78 L41 86 L32 78 Z" fill="${C}"/>
    <circle cx="40" cy="44" r="5" fill="${N}"/><circle cx="60" cy="44" r="5" fill="${N}"/>
    <ellipse cx="50" cy="62" rx="6" ry="8" fill="${N}"/>
    <ellipse cx="30" cy="56" rx="5" ry="3" fill="${R}" opacity=".4" stroke="none"/><ellipse cx="70" cy="56" rx="5" ry="3" fill="${R}" opacity=".4" stroke="none"/>`),

  basketball: wrap(`
    <circle cx="50" cy="50" r="38" fill="${O}"/>
    <path d="M12 50 H88 M50 12 V88"/>
    <path d="M22 22 C40 36 40 64 22 78 M78 22 C60 36 60 64 78 78"/>`),

  football: wrap(`
    <path d="M10 62 C10 28 40 14 62 20 C86 26 92 56 88 74 C70 86 20 86 10 62 Z" transform="rotate(-18 50 50)" fill="#9a5a34"/>
    <path d="M36 62 L64 38 M44 46 l6 6 M52 40 l6 6 M36 54 l6 6" stroke="${C}"/>`),

  theater: wrap(`
    <rect x="8" y="80" width="84" height="10" rx="2" fill="${G}"/>
    <path d="M14 80 V30 H86 V80" fill="${C}"/>
    <path d="M50 38 l4.5 9.5 10.5 1.4 -7.7 7.3 2 10.4 -9.3 -5 -9.3 5 2 -10.4 -7.7 -7.3 10.5 -1.4 z" fill="${G}" stroke-width="3"/>
    <path d="M14 30 H41 C38 46 31 62 28 80 H14 Z" fill="${R}"/>
    <path d="M86 30 H59 C62 46 69 62 72 80 H86 Z" fill="${R}"/>
    <path d="M24 34 C27 48 24 62 22 78 M76 34 C73 48 76 62 78 78" stroke="${N}" stroke-width="2.6" opacity=".55"/>
    <path d="M8 14 H92 V30 H8 Z" fill="${G}"/>
    <path d="M8 30 q7 9 14 0 q7 9 14 0 q7 9 14 0 q7 9 14 0 q7 9 14 0 q7 9 14 0" fill="${G}"/>`),

  tree: wrap(`
    <path d="M50 14 L72 44 H60 L80 70 H20 L40 44 H28 Z" fill="${GR}"/>
    <rect x="43" y="70" width="14" height="14" fill="#9a5a34"/>
    <path d="M50 4 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 z" fill="${G}" stroke-width="3"/>
    <circle cx="42" cy="52" r="3.5" fill="${R}"/><circle cx="58" cy="60" r="3.5" fill="${G}"/><circle cx="46" cy="66" r="3.5" fill="${SK}"/>`),

  book: wrap(`
    <path d="M10 22 C26 16 42 18 50 26 C58 18 74 16 90 22 V76 C74 70 58 72 50 80 C42 72 26 70 10 76 Z" fill="${C}"/>
    <path d="M50 26 V80"/>
    <path d="M20 34 q14 -4 24 4 M20 46 q14 -4 24 4 M80 34 q-14 -4 -24 4 M80 46 q-14 -4 -24 4" stroke-width="3"/>`),

  heart: wrap(`<path d="M50 84 C18 62 8 42 18 28 C28 14 44 20 50 32 C56 20 72 14 82 28 C92 42 82 62 50 84 Z" fill="${R}"/>
    <path d="M28 34 q4 -6 10 -4" stroke="${C}" stroke-width="3.5"/>`),

  trophy: wrap(`
    <path d="M28 14 H72 V40 C72 56 62 62 50 62 C38 62 28 56 28 40 Z" fill="${G}"/>
    <path d="M28 22 H14 C14 40 20 46 30 48 M72 22 H86 C86 40 80 46 70 48"/>
    <path d="M50 62 V76 M34 86 H66 L62 76 H38 Z" fill="${G}"/>`),

  star: wrap(`
    <path d="M50 8 l11 26 28 3 -21 19 6 28 -24 -14 -24 14 6 -28 -21 -19 28 -3 z" fill="${G}"/>
    <path d="M86 12 v10 M81 17 h10 M12 70 v8 M8 74 h8" stroke-width="3.5"/>`),

  biker: wrap(`
    <circle cx="24" cy="66" r="14" fill="${C}"/><circle cx="78" cy="66" r="14" fill="${C}"/>
    <path d="M24 66 L40 40 H62 L78 66 M40 40 L34 30 H24 M52 40 L58 66 H40 M62 40 L70 28 H80"/>
    <path d="M44 40 q8 -10 18 0 Z" fill="${R}"/>`),

  cards: wrap(`
    <rect x="14" y="16" width="44" height="62" rx="6" transform="rotate(-12 36 47)" fill="${C}"/>
    <rect x="42" y="18" width="44" height="62" rx="6" transform="rotate(10 64 49)" fill="${C}"/>
    <path d="M66 36 c-8 8 -12 14 -6 18 c3 2 6 0 6 -3 c0 3 3 5 6 3 c6 -4 2 -10 -6 -18 z" fill="${R}" transform="rotate(10 66 45)"/>`),

  dress: wrap(`
    <path d="M40 12 L50 22 L60 12 L64 30 L54 44 L76 88 H24 L46 44 L36 30 Z" fill="${R}"/>
    <path d="M44 44 H56" /><path d="M36 30 H64"/>`),
};

// Pick an icon (and sticker label) from the event's words. First match wins.
const RULES = [
  [/golf|scramble|tee\b/i,                     'golf',       'FORE!'],
  [/poker run|ride|motorcycle|biker|crawl/i,   'biker',      'ROLL OUT'],
  [/market|sale|vendor|bazaar|craft|boutique/i,'market',     'SHOP LOCAL'],
  [/fashion|friendship/i,                      'dress',      'BRING A FRIEND'],
  [/dinner|supper|breakfast|pancake|lunch|bbq|chili|cook-?off|pantry|food/i, 'plate', 'COME HUNGRY'],
  [/trunk|halloween|spooky|boo\b|haunt/i,      'pumpkin',    'FAMILY FUN'],
  [/play\b|playhouse|theater|theatre|show|musical|doomsday|carol/i, 'theater', 'LIVE ON STAGE'],
  [/christmas|santa|lights|tree|parade of lights|dickens/i, 'tree', 'HOLIDAY FUN'],
  [/book|library|reading|school/i,             'book',       'BACK TO BOOKS'],
  [/basketball/i,                              'basketball', 'GAME NIGHT'],
  [/football|bearcat/i,                        'football',   'GAME NIGHT'],
  [/fundrais|donat|benefit|drive|relay|raffle/i,'heart',     'GIVE BACK'],
  [/tournament|race|contest|derby|winner/i,    'trophy',     'GAME ON'],
  [/kids|kid|children|family|youth|jr\.?|junior|carnival|fair|party|bash|birthday|bday/i, 'star', 'FAMILY FUN'],
  [/card|poker|bingo/i,                        'cards',      'TRY YOUR LUCK'],
];

export function pickLook(ev) {
  // Judge by the title first, so a stray word in the description ("boutiques")
  // can't hijack the look. Fall back to title + description.
  for (const hay of [String(ev.title || ''), `${ev.title || ''} ${ev.description || ''}`]) {
    for (const [re, icon, badge] of RULES) {
      if (re.test(hay)) return { icon, badge };
    }
  }
  const cat = ev.cat || 'chamber';
  return { icon: 'star', badge: cat === 'community' ? 'HAPPENING IN HOBART' : 'CHAMBER EVENT' };
}

export const UI = {
  clock: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="20" r="15"/><path d="M20 10 V20 L27 24"/></svg>`,
  pin:   `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 36 C10 24 7 19 7 14 a13 13 0 0 1 26 0 c0 5 -3 10 -13 22 Z"/><circle cx="20" cy="14" r="4.5"/></svg>`,
  star:  `<svg viewBox="0 0 40 40" fill="currentColor"><path d="M20 3 l4.6 11.6 12.4 1 -9.5 8 3 12.2 L20 28.6 9.5 35.8 12.5 23.6 3 15.6 l12.4 -1 z"/></svg>`,
};
