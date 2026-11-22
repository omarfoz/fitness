/* Badges: medallions earned from saved steps, no extra database tables.
 *
 * Look: a round medallion with a Najdi crenellated rim (the triangular
 * parapets of mud-brick towers), a tier-coloured disc, one of the landmark
 * scenes from weekly-recap.js in the centre, and a ribbon with the number.
 * Tiers climb bronze → silver → gold → ember → mint (legend).
 */
(() => {
  'use strict';
  const STEP_M = 0.75;

  const TIERS = {
    bronze: { rim: '#7A4E25', a: '#F0B57C', b: '#9A6234', ring: '#FAD6B2', ribbon: '#B8743C', ribbonDark: '#7A4E25', name: 'Bronze' },
    silver: { rim: '#5E708B', a: '#F4F8FD', b: '#8FA6C4', ring: '#FFFFFF', ribbon: '#7D93B2', ribbonDark: '#4E6280', name: 'Silver' },
    gold: { rim: '#8C6508', a: '#FFE69A', b: '#D69A12', ring: '#FFF6CF', ribbon: '#C8901A', ribbonDark: '#8C6508', name: 'Gold' },
    ember: { rim: '#7A2610', a: '#FFB27A', b: '#C4461C', ring: '#FFE1CF', ribbon: '#E0592A', ribbonDark: '#8F2E12', name: 'Ember' },
    legend: { rim: '#17513F', a: '#C8F8E6', b: '#2E9C74', ring: '#EFFFF8', ribbon: '#23946C', ribbonDark: '#17513F', name: 'Legend' }
  };

  // group: day = best single day, streak = 10K days in a row,
  // journey = all steps ever, as a walk; special = one-offs.
  const BADGES = [
    { id: 'day10', group: 'day', need: 10000, tier: 'bronze', art: 'kingdom', label: '10K', title: '10K Day', hint: 'Walk 10,000 steps in one day' },
    { id: 'day15', group: 'day', need: 15000, tier: 'silver', art: 'faisaliah', label: '15K', title: '15K Day', hint: 'Walk 15,000 steps in one day' },
    { id: 'day20', group: 'day', need: 20000, tier: 'gold', art: 'pif', label: '20K', title: '20K Day', hint: 'Walk 20,000 steps in one day' },
    { id: 'day25', group: 'day', need: 25000, tier: 'ember', art: 'wadi', label: '25K', title: '25K Day', hint: 'Walk 25,000 steps in one day' },
    { id: 'day30', group: 'day', need: 30000, tier: 'legend', art: 'cliff', label: '30K', title: '30K Day', hint: 'Walk 30,000 steps in one day' },

    { id: 'streak3', group: 'streak', need: 3, tier: 'bronze', art: 'flame', label: '3 DAYS', title: 'Spark', hint: '10K steps 3 days in a row' },
    { id: 'streak7', group: 'streak', need: 7, tier: 'silver', art: 'flame', label: '7 DAYS', title: 'Full Week', hint: '10K steps 7 days in a row' },
    { id: 'streak14', group: 'streak', need: 14, tier: 'gold', art: 'flame', label: '14 DAYS', title: 'Two Weeks Strong', hint: '10K steps 14 days in a row' },
    { id: 'streak30', group: 'streak', need: 30, tier: 'ember', art: 'flame', label: '30 DAYS', title: 'Month on Fire', hint: '10K steps 30 days in a row' },
    { id: 'streak100', group: 'streak', need: 100, tier: 'legend', art: 'flame', label: '100 DAYS', title: 'Unstoppable', hint: '10K steps 100 days in a row' },

    { id: 'trip20', group: 'journey', need: 20, tier: 'bronze', art: 'diriyah', label: '20 KM', title: 'To Diriyah', hint: 'Walk 20 km in total, central Riyadh to Diriyah' },
    { id: 'trip85', group: 'journey', need: 85, tier: 'silver', art: 'sign', place: 'Al-Kharj', label: '85 KM', title: 'To Al-Kharj', hint: 'Walk 85 km in total, Riyadh to Al-Kharj' },
    { id: 'trip125', group: 'journey', need: 125, tier: 'gold', art: 'sign', place: 'Thadiq', label: '125 KM', title: 'To Thadiq', hint: 'Walk 125 km in total, Riyadh to Thadiq' },
    { id: 'trip176', group: 'journey', need: 176, tier: 'ember', art: 'metro', label: '176 KM', title: 'Whole Metro', hint: 'Walk 176 km in total, the whole Riyadh Metro' },
    { id: 'trip800', group: 'journey', need: 800, tier: 'legend', art: 'cliff', label: '800 KM', title: 'All of Tuwaiq', hint: 'Walk 800 km in total, the length of the Tuwaiq escarpment' },

    { id: 'first', group: 'special', need: 1, tier: 'bronze', art: 'shoe', label: 'DAY 1', title: 'First Steps', hint: 'Save your first check-in' },
    { id: 'perfect', group: 'special', need: 7, tier: 'gold', art: 'park', label: '7 / 7', title: 'Perfect Week', hint: '10K steps every day, Monday to Sunday' }
  ];

  /* ---------- drawing ---------- */
  const r2 = (n) => Math.round(n * 10) / 10;
  // Najdi parapet rim: triangle teeth all round the disc.
  function rim(cx, cy, inner, outer, teeth) {
    const pts = [];
    for (let i = 0; i < teeth * 2; i++) {
      const ang = (Math.PI * i) / teeth - Math.PI / 2;
      const rad = i % 2 ? inner : outer;
      pts.push(r2(cx + rad * Math.cos(ang)) + ',' + r2(cy + rad * Math.sin(ang)));
    }
    return pts.join(' ');
  }
  let uid = 0;
  function svg(badge, opts = {}) {
    const t = TIERS[badge.tier], id = 'bd' + (++uid), size = opts.size || 240, locked = !!opts.locked;
    const art = window.FitnessRecap?.svg?.(badge.art, badge.place) || '';
    const inner = art.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const labelSize = badge.label.length > 6 ? 19 : 23;
    return `<svg viewBox="0 0 240 260" width="${size}" height="${Math.round(size * 260 / 240)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${badge.title} badge${locked ? ', locked' : ''}">
  <defs>
    <radialGradient id="${id}d" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${t.a}"/><stop offset="1" stop-color="${t.b}"/></radialGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="${id}c"><circle cx="120" cy="116" r="74"/></clipPath>
    ${locked ? `<filter id="${id}g"><feColorMatrix type="saturate" values="0"/></filter>` : ''}
  </defs>
  <g ${locked ? `filter="url(#${id}g)" opacity=".5"` : ''}>
    <ellipse cx="120" cy="238" rx="70" ry="8" fill="#000" opacity=".25"/>
    <polygon points="${rim(120, 116, 101, 113, 28)}" fill="${t.rim}"/>
    <circle cx="120" cy="116" r="101" fill="${t.rim}"/>
    <circle cx="120" cy="116" r="96" fill="url(#${id}d)"/>
    <circle cx="120" cy="116" r="83" fill="none" stroke="${t.ring}" stroke-width="3" opacity=".9"/>
    <circle cx="120" cy="116" r="78" fill="${t.rim}"/>
    <g clip-path="url(#${id}c)"><svg x="42" y="38" width="156" height="156" viewBox="20 20 360 360">${inner}</svg></g>
    <circle cx="120" cy="116" r="74" fill="none" stroke="${t.ring}" stroke-width="2" opacity=".6"/>
    <path d="M44 60 A96 96 0 0 1 196 60" fill="none" stroke="url(#${id}s)" stroke-width="10" stroke-linecap="round" opacity=".7"/>
    <path d="M30 186 L48 186 L40 200 L48 214 L22 214 Z" fill="${t.ribbonDark}"/>
    <path d="M210 186 L192 186 L200 200 L192 214 L218 214 Z" fill="${t.ribbonDark}"/>
    <path d="M40 178 H200 L206 200 L200 222 H40 L34 200 Z" fill="${t.ribbon}"/>
    <path d="M40 178 H200 L203 189 H37 Z" fill="#fff" opacity=".22"/>
    <text x="120" y="${208 - (23 - labelSize) / 2}" text-anchor="middle" fill="#fff" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="${labelSize}" font-weight="800" letter-spacing="1.5">${badge.label}</text>
    <g fill="${t.ring}"><path d="M120 6 l4 9 l9 1 l-7 6 l2 9 l-8 -5 l-8 5 l2 -9 l-7 -6 l9 -1 Z"/></g>
  </g>
  ${locked ? `<g><circle cx="196" cy="40" r="22" fill="#13284D" stroke="#A9BCD8" stroke-width="2"/>
    <rect x="186" y="38" width="20" height="15" rx="3" fill="#A9BCD8"/>
    <path d="M190 38 v-5 a6 6 0 0 1 12 0 v5" fill="none" stroke="#A9BCD8" stroke-width="3"/></g>` : ''}
</svg>`;
  }

  /* ---------- earning ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const next = (k) => { const d = parse(k); d.setDate(d.getDate() + 1); return key(d); };

  // Walks saved days in date order once and records the first date each
  // badge was earned, plus progress for the ones still locked.
  function evaluate(entries) {
    const days = [...entries.values()].filter((e) => e?.entry_date).sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    const earned = new Map();
    const hit = (id, date) => { if (!earned.has(id)) earned.set(id, date); };
    let bestDay = 0, run = 0, bestRun = 0, prev = null, km = 0;
    const week = new Map();
    for (const e of days) {
      const steps = Number(e.steps) || 0;
      hit('first', e.entry_date);
      bestDay = Math.max(bestDay, steps);
      for (const b of BADGES) if (b.group === 'day' && steps >= b.need) hit(b.id, e.entry_date);
      run = steps >= 10000 ? (prev && next(prev) === e.entry_date ? run + 1 : 1) : 0;
      prev = steps >= 10000 ? e.entry_date : null;
      bestRun = Math.max(bestRun, run);
      for (const b of BADGES) if (b.group === 'streak' && run >= b.need) hit(b.id, e.entry_date);
      km += steps * STEP_M / 1000;
      for (const b of BADGES) if (b.group === 'journey' && km >= b.need) hit(b.id, e.entry_date);
      const d = parse(e.entry_date), monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const wk = key(monday);
      if (steps >= 10000) week.set(wk, (week.get(wk) || 0) + 1);
      if (week.get(wk) === 7) hit('perfect', e.entry_date);
    }
    const bestWeek = Math.max(0, ...week.values());
    const value = { day: bestDay, streak: bestRun, journey: km, special: null };
    return BADGES.map((b) => {
      const have = b.id === 'first' ? days.length : b.id === 'perfect' ? bestWeek : value[b.group];
      return { ...b, earnedOn: earned.get(b.id) || null, progress: Math.min(1, have / b.need), have };
    });
  }

  window.FitnessBadges = Object.freeze({ BADGES, TIERS, svg, evaluate });
})();
