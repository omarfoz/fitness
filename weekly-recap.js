/* Steps as Riyadh, Diriyah, Thadiq and Al-Kharj landmarks: a daily card on
 * Today that changes with every step (plus the next milestone), and a weekly
 * recap in three slides that can be shared as a 9:16 image.
 *
 * Figures (checked 23 Nov 2026, sources in DESIGN.md): Al-Marqab Tower ~30 m,
 * Riyadh Water Tower 61 m, Kingdom Centre Sky Bridge 65 m, Riyadh TV Tower
 * 170 m, Al Faisaliah 266.9 m, Kingdom Centre 302.3 m, PIF Tower 385 m,
 * King Salman Park loop 7.2 km, Wadi Hanifah trail 13.4 km, central Riyadh to
 * Diriyah ~20 km, King Abdullah Road ~25 km, city to King Khalid Airport
 * ~35 km, Metro Blue Line 38 km, King Fahd Road 49 km, Riyadh to Al-Kharj
 * ~85 km, Riyadh to the Edge of the World ~100 km, Wadi Hanifah 120 km,
 * Riyadh to Thadiq ~125 km, Sports Boulevard ~135 km, Metro network 176 km.
 * Steps become distance at about 0.75 m a step, so every figure is "about".
 */
(() => {
  'use strict';
  const STEP_M = 0.75, GOAL = 10000;
  const $ = (id) => document.getElementById(id);

  // scope: 'day' (fits a single day), 'week' (fits a week), 'both'.
  const PLACES = [
    // Heights and short spans, "laid end to end" or "walked across".
    { kind: 'height', km: 0.03, art: 'marqab', name: 'Al-Marqab Tower', plural: 'Al-Marqab Towers', area: 'Thadiq', scope: 'day' },
    { kind: 'height', km: 0.061, art: 'water', name: 'Riyadh Water Tower', plural: 'Riyadh Water Towers', area: 'Riyadh', scope: 'day' },
    { kind: 'bridge', km: 0.065, art: 'kingdom', name: 'the Kingdom Centre Sky Bridge', area: 'Riyadh', scope: 'day' },
    { kind: 'height', km: 0.17, art: 'tv', name: 'Riyadh TV Tower', plural: 'Riyadh TV Towers', area: 'Riyadh', scope: 'day' },
    { kind: 'height', km: 0.2669, art: 'faisaliah', name: 'Al Faisaliah Tower', plural: 'Al Faisaliah Towers', area: 'Riyadh', scope: 'day' },
    { kind: 'height', km: 0.3023, art: 'kingdom', name: 'Kingdom Centre', plural: 'Kingdom Centres', area: 'Riyadh', scope: 'day' },
    { kind: 'height', km: 0.385, art: 'pif', name: 'PIF Tower', plural: 'PIF Towers', area: 'Riyadh', scope: 'day' },
    // Loops and roads.
    { kind: 'loop', km: 7.2, art: 'park', name: 'the King Salman Park loop', area: 'Riyadh', scope: 'both' },
    { kind: 'route', km: 13.4, art: 'wadi', name: 'the Wadi Hanifah trail', area: 'Riyadh', scope: 'both' },
    { kind: 'trip', km: 20, art: 'diriyah', name: 'central Riyadh to Diriyah', area: 'Diriyah', scope: 'both' },
    { kind: 'route', km: 25, art: 'road', name: 'King Abdullah Road', area: 'Riyadh', scope: 'week' },
    { kind: 'trip', km: 35, art: 'plane', name: 'the city to King Khalid Airport', area: 'Riyadh', scope: 'week' },
    { kind: 'route', km: 38, art: 'metro', name: 'the Riyadh Metro Blue Line', area: 'Riyadh', scope: 'week' },
    { kind: 'route', km: 49, art: 'road', name: 'King Fahd Road', area: 'Riyadh', scope: 'week' },
    { kind: 'trip', km: 85, art: 'sign', name: 'Riyadh to Al-Kharj', area: 'Al-Kharj', scope: 'week' },
    { kind: 'trip', km: 100, art: 'cliff', name: 'Riyadh to the Edge of the World', area: 'Tuwaiq', scope: 'week' },
    { kind: 'route', km: 120, art: 'wadi', name: 'the whole of Wadi Hanifah', area: 'Riyadh', scope: 'week' },
    { kind: 'trip', km: 125, art: 'sign', name: 'Riyadh to Thadiq', area: 'Thadiq', scope: 'week' },
    { kind: 'route', km: 135, art: 'wadi', name: 'the Riyadh Sports Boulevard', area: 'Riyadh', scope: 'week' },
    { kind: 'route', km: 176, art: 'metro', name: 'the whole Riyadh Metro network', area: 'Riyadh', scope: 'week' }
  ];

  /* ---------- dates ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
  const mondayOf = (k) => addDays(k, -((parse(k).getDay() + 6) % 7));

  function nice(n) {
    if (n >= 10) return String(Math.round(n));
    return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
  }
  function compact(v) {
    if (v >= 1e6) return nice(v / 1e6) + 'M';
    if (v >= 1000) return nice(v / 1000) + 'k';
    return String(Math.round(v));
  }

  const SHORT = ['height', 'bridge'];
  const inScope = (p, scope) => p.scope === 'both' || p.scope === scope;
  // Pick a landmark that gives a friendly number, varying with the seed.
  function pickPlace(km, seed, scope = 'week') {
    if (!(km > 0)) return null;
    const ok = PLACES.filter((p) => inScope(p, scope));
    const far = ok.filter((p) => !SHORT.includes(p.kind) &&
      km / p.km >= (p.kind === 'trip' ? 0.4 : 1) && km / p.km <= 12);
    const tall = ok.filter((p) => SHORT.includes(p.kind) && km / p.km >= 2 && km / p.km <= 150);
    const pool = scope === 'day' ? [...far, ...tall] : (far.length ? far : tall);
    const list = pool.length ? pool : PLACES.filter((p) => SHORT.includes(p.kind));
    const place = list[Math.abs(seed) % list.length];
    return { place, ratio: km / place.km };
  }
  function comparison(km, seed, scope = 'week') {
    const hit = pickPlace(km, seed, scope);
    if (!hit) return null;
    const { place, ratio } = hit, n = nice(ratio);
    let text;
    if (place.kind === 'height') text = `That's ${n} ${place.plural} laid end to end!`;
    else if (place.kind === 'bridge') text = `That's walking across ${place.name} ${n} times!`;
    else if (place.kind === 'loop') text = ratio < 1.15 ? `That's a full lap of ${place.name}!` : `That's ${n} laps of ${place.name}!`;
    else if (ratio < 1) text = place.kind === 'trip'
      ? `That's ${Math.round(ratio * 100)}% of the way from ${place.name}!`
      : `That's ${Math.round(ratio * 100)}% of ${place.name}.`;
    else if (place.kind === 'trip') text = ratio < 1.15
      ? `That's like walking from ${place.name}!`
      : `That's like walking from ${place.name} ${n} times!`;
    else text = ratio < 1.15 ? `That's the full length of ${place.name}!` : `That's ${n} times the length of ${place.name}!`;
    return { place, text };
  }
  // The next walk worth chasing today, e.g. one King Salman Park lap.
  const MILESTONES = [
    { km: 1, text: 'your first kilometre' },
    { km: 3, text: '10 Kingdom Centres end to end' },
    { km: 7.2, text: 'a full lap of the King Salman Park loop' },
    { km: 7.5, text: 'your 10K goal' },
    { km: 13.4, text: 'the whole Wadi Hanifah trail' },
    { km: 20, text: 'a walk from central Riyadh to Diriyah' }
  ];
  function nextMilestone(steps) {
    const km = steps * STEP_M / 1000;
    const m = MILESTONES.find((x) => x.km > km + 0.05);
    return m ? { text: m.text, stepsLeft: Math.ceil((m.km * 1000) / STEP_M - steps) } : null;
  }

  function summary(entries, todayKey) {
    const thisMon = mondayOf(todayKey);
    const build = (start, end, label) => {
      const days = [];
      for (let k = start; k <= end; k = addDays(k, 1)) {
        const steps = entries.get(k)?.steps;
        days.push({ key: k, steps: steps == null ? null : Number(steps) });
      }
      const logged = days.filter((d) => d.steps != null);
      const total = logged.reduce((s, d) => s + d.steps, 0);
      const best = logged.reduce((b, d) => (!b || d.steps > b.steps ? d : b), null);
      return { start, end, label, days, logged: logged.length, total,
        goalDays: logged.filter((d) => d.steps >= GOAL).length, best };
    };
    let week = build(addDays(thisMon, -7), addDays(thisMon, -1), 'Last week');
    if (!week.total) week = build(thisMon, todayKey, 'This week so far');
    const km = week.total * STEP_M / 1000;
    const seed = Math.round(parse(week.start).getTime() / 864e5 / 7);
    const streak = window.FitnessProgress?.streak(entries, todayKey) || { current: 0, best: 0 };
    return { ...week, km, cmp: comparison(km, seed), streak };
  }

  /* ---------- illustrations ----------
   * Flat scenes in the app palette, each inside a round sky like a badge.
   * Shapes follow the real landmarks' silhouettes. */
  const C = { sky1: '#1C1A20', sky2: '#5A2A18', ground: '#C9A36B', groundDark: '#A9834F', sand: '#E8C994',
    cream: '#FFF3E1', glass: '#FFD2B0', glassDark: '#B97A5C', steel: '#C7D6EA', steelDark: '#8FA6C4',
    mint: '#90E8C7', palm: '#3FA37A', palmDark: '#2B7A5A', trunk: '#8B6A44', ember: '#E0592A', gold: '#F2C14E',
    mud: '#D2A26B', mudDark: '#A87A45', mudShade: '#BD8D57', sign: '#13804A', night: '#16131A' };
  const stars = '<g fill="#fff" opacity=".7"><circle cx="110" cy="92" r="2"/><circle cx="292" cy="78" r="1.6"/><circle cx="318" cy="140" r="2.2"/><circle cx="84" cy="160" r="1.4"/><circle cx="250" cy="52" r="1.3"/></g>';
  const frame = (id, inner, groundFill = C.ground, horizon = 300) => `
    <defs>
      <linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.sky1}"/><stop offset="1" stop-color="${C.sky2}"/></linearGradient>
      <clipPath id="clip-${id}"><circle cx="200" cy="200" r="180"/></clipPath>
    </defs>
    <circle cx="200" cy="200" r="180" fill="url(#sky-${id})"/>
    <g clip-path="url(#clip-${id})">${stars}
      <circle cx="300" cy="110" r="26" fill="${C.cream}" opacity=".16"/>
      <rect x="0" y="${horizon}" width="400" height="${400 - horizon}" fill="${groundFill}"/>
      ${inner}
    </g>
    <circle cx="200" cy="200" r="180" fill="none" stroke="rgba(255,178,122,.40)" stroke-width="3"/>`;
  // Small Riyadh skyline for backgrounds: Kingdom Centre + Al Faisaliah.
  const skyline = (y, s = 1, fill = '#2A2026') => `
    <g fill="${fill}" transform="translate(0 ${y}) scale(${s})">
      <path d="M150 0 L158 -96 C159 -108 162 -116 166 -122 L168 -96 C170 -86 174 -82 176 -82 C178 -82 182 -86 184 -96 L186 -122 C190 -116 193 -108 194 -96 L202 0 Z"/>
      <path d="M232 0 L250 -86 L268 0 Z"/><circle cx="250" cy="-62" r="6"/><rect x="249" y="-104" width="2" height="20"/>
      <rect x="96" y="-34" width="26" height="34"/><rect x="124" y="-48" width="20" height="48"/>
      <rect x="276" y="-40" width="24" height="40"/><rect x="304" y="-26" width="30" height="26"/>
    </g>`;
  const ART = {
    kingdom: frame('kc', `
      ${skyline(312, 1, '#1B3560').replace('<path d="M150', '<path opacity="0" d="M150')}
      <path fill-rule="evenodd" fill="${C.steel}" d="M146 312 L160 150 C162 112 170 84 182 58 L184 58 C186 100 192 128 200 140 C208 128 214 100 216 58 L218 58 C230 84 238 112 240 150 L254 312 Z"/>
      <path fill="${C.steelDark}" d="M200 140 C208 128 214 100 216 58 L218 58 C230 84 238 112 240 150 L254 312 L200 312 Z"/>
      <rect x="190" y="96" width="20" height="7" rx="2" fill="${C.cream}"/>
      <g stroke="${C.glassDark}" stroke-width="2" opacity=".55">
        <path d="M170 170 V310 M184 160 V310 M216 160 V310 M230 170 V310"/>
        <path d="M156 200 H244 M154 236 H246 M151 272 H249"/></g>
      <rect x="182" y="282" width="36" height="30" rx="4" fill="${C.night}"/>`, C.groundDark, 312),
    faisaliah: frame('fa', `
      <path fill="${C.steel}" d="M144 312 L200 64 L256 312 Z"/>
      <path fill="${C.steelDark}" d="M200 64 L256 312 L200 312 Z"/>
      <g stroke="${C.glassDark}" stroke-width="2.5" opacity=".6">
        <path d="M170 180 L230 180 M160 224 L240 224 M151 268 L249 268"/>
        <path d="M200 160 V312"/></g>
      <rect x="198" y="30" width="4" height="40" fill="${C.steel}"/>
      <circle cx="200" cy="132" r="20" fill="${C.gold}"/>
      <circle cx="193" cy="125" r="6" fill="#FFE9A8" opacity=".9"/>
      <rect x="176" y="292" width="48" height="20" rx="3" fill="${C.night}"/>`, C.groundDark, 312),
    road: frame('rd', `
      ${skyline(250, 1)}
      <path fill="#2A3A55" d="M150 250 H250 L380 400 H20 Z"/>
      <path fill="${C.groundDark}" d="M0 250 H150 L20 400 H0 Z M250 250 H400 V400 H380 Z"/>
      <g fill="${C.cream}"><path d="M197 260 h6 l2 18 h-10 Z"/><path d="M194 292 h12 l3 28 h-18 Z"/><path d="M190 336 h20 l4 40 h-28 Z"/></g>
      <g stroke="${C.steel}" stroke-width="5" stroke-linecap="round" fill="none">
        <path d="M110 380 V286 Q110 276 124 276 H140"/><path d="M290 380 V286 Q290 276 276 276 H260"/></g>
      <circle cx="142" cy="278" r="6" fill="${C.gold}"/><circle cx="258" cy="278" r="6" fill="${C.gold}"/>
      <path fill="${C.palm}" d="M60 300 q-30 -4 -44 18 q22 -6 44 -10 q-16 12 -20 30 q14 -14 24 -24 Z M60 300 q30 -4 44 18 q-22 -6 -44 -10 q16 12 20 30 q-14 -14 -24 -24 Z"/>
      <rect x="57" y="300" width="6" height="70" fill="${C.trunk}"/>`, C.groundDark, 250),
    metro: frame('mt', `
      ${skyline(230, 1, '#33252A')}
      <rect x="0" y="252" width="400" height="18" fill="#B8C7DC"/>
      <g fill="#94A7C2"><rect x="70" y="270" width="22" height="130"/><rect x="308" y="270" width="22" height="130"/></g>
      <path fill="#E7EEF8" d="M96 252 V170 C96 136 122 118 156 118 H244 C278 118 304 136 304 170 V252 Z"/>
      <path fill="${C.night}" d="M120 196 V170 C120 152 136 142 156 142 H244 C264 142 280 152 280 170 V196 Z"/>
      <path fill="${C.glass}" opacity=".35" d="M126 176 C130 156 146 148 164 148 H200 L170 192 H126 Z"/>
      <rect x="96" y="212" width="208" height="12" fill="#E0592A"/>
      <circle cx="132" cy="236" r="8" fill="${C.gold}"/><circle cx="268" cy="236" r="8" fill="${C.gold}"/>
      <rect x="176" y="226" width="48" height="10" rx="5" fill="#9FB3CF"/>`, C.groundDark, 330),
    wadi: frame('wd', `
      <path fill="#C49A61" d="M0 150 L60 140 L96 170 L120 166 L140 300 L0 320 Z"/>
      <path fill="#AD8450" d="M0 200 L110 196 L120 240 L0 250 Z M0 270 L130 262 L136 300 L0 310 Z" opacity=".7"/>
      <path fill="#C49A61" d="M400 140 L330 136 L296 166 L274 168 L262 300 L400 320 Z"/>
      <path fill="#AD8450" d="M400 196 L288 194 L280 238 L400 248 Z M400 268 L270 262 L266 300 L400 312 Z" opacity=".7"/>
      <path fill="${C.ground}" d="M0 296 Q200 270 400 296 V400 H0 Z"/>
      <path fill="${C.glass}" d="M150 400 C170 360 230 350 210 320 C200 306 220 296 236 290 C206 298 186 304 190 322 C196 346 140 360 120 400 Z" opacity=".9"/>
      ${[[166, 300, 0.95], [252, 296, 1.1], [306, 312, 0.8]].map(([x, y, s]) => `
      <g transform="translate(${x} ${y}) scale(${s})">
        <path d="M-3 0 Q2 -60 -2 -110 L4 -110 Q8 -60 3 0 Z" fill="${C.trunk}"/>
        <g fill="${C.palm}"><path d="M0 -110 q-44 -10 -66 20 q30 -12 66 -14 Z"/><path d="M0 -110 q44 -10 66 20 q-30 -12 -66 -14 Z"/>
        <path d="M0 -110 q-30 -32 -64 -24 q34 4 64 28 Z"/><path d="M0 -110 q30 -32 64 -24 q-34 4 -64 28 Z"/></g>
        <path fill="${C.palmDark}" d="M0 -110 q-6 -30 -2 -46 q8 18 6 46 Z"/>
      </g>`).join('')}`, C.ground, 296),
    marqab: frame('mq', `
      <path fill="#B98C55" d="M0 280 L70 250 L130 262 L170 248 L400 270 V300 H0 Z" opacity=".6"/>
      <path fill="${C.mud}" d="M156 318 L168 96 H232 L244 318 Z"/>
      <path fill="${C.mudShade}" d="M200 96 H232 L244 318 H200 Z"/>
      <path fill="${C.mud}" d="M162 96 H238 V82 H162 Z"/>
      <g fill="${C.mud}">${[166, 184, 202, 220].map((x) => `<path d="M${x} 82 l7 -16 l7 16 Z"/>`).join('')}</g>
      <g fill="${C.mudDark}">${[[200, 130], [192, 178], [208, 178], [200, 226]].map(([x, y]) => `<path d="M${x - 6} ${y + 10} l6 -12 l6 12 Z"/>`).join('')}</g>
      <g stroke="#7A5530" stroke-width="5" stroke-linecap="round"><path d="M164 150 h-12 M236 150 h12 M160 238 h-12 M240 238 h12"/></g>
      <path fill="#6B4A2B" d="M186 318 V286 Q200 272 214 286 V318 Z"/>`, C.ground, 300),
    sign: (place, ar) => frame('sg' + ar.length, `
      ${place === 'Thadiq'
        ? `<path fill="#B98C55" d="M0 300 L0 210 L60 190 L120 214 L170 200 L230 222 L300 196 L400 220 V300 Z"/><path fill="#A47942" d="M0 240 L400 250 V300 H0 Z" opacity=".5"/>`
        : `${[[56, 286], [96, 290], [312, 288], [350, 284]].map(([x, y]) => `<g transform="translate(${x} ${y}) scale(.55)"><path d="M-3 0 Q2 -60 -2 -110 L4 -110 Q8 -60 3 0 Z" fill="${C.trunk}"/><g fill="${C.palm}"><path d="M0 -110 q-44 -10 -66 20 q30 -12 66 -14 Z"/><path d="M0 -110 q44 -10 66 20 q-30 -12 -66 -14 Z"/><path d="M0 -110 q-30 -32 -64 -24 q34 4 64 28 Z"/><path d="M0 -110 q30 -32 64 -24 q-34 4 -64 28 Z"/></g></g>`).join('')}`}
      <path fill="#2A3A55" d="M184 300 H216 L330 400 H70 Z"/>
      <g fill="${C.cream}"><path d="M198 306 h4 l2 16 h-8 Z"/><path d="M196 334 h8 l3 24 h-14 Z"/><path d="M193 372 h14 l4 28 h-22 Z"/></g>
      <g fill="#9FB3CF"><rect x="112" y="200" width="7" height="110"/><rect x="281" y="200" width="7" height="110"/></g>
      <rect x="100" y="112" width="200" height="104" rx="12" fill="${C.sign}" stroke="#fff" stroke-width="5"/>
      <text x="200" y="156" text-anchor="middle" fill="#fff" font-family="-apple-system,'Segoe UI',Tahoma,Arial,sans-serif" font-size="34" font-weight="700">${ar}</text>
      <text x="200" y="198" text-anchor="middle" fill="#fff" font-family="-apple-system,'Segoe UI',Arial,sans-serif" font-size="28" font-weight="700">${place.toUpperCase()}</text>`, C.ground, 300),
    water: frame('wt', `
      <path fill="#E7EEF8" d="M190 312 L194 196 H206 L210 312 Z"/>
      <path fill="#C7D6EA" d="M200 196 H206 L210 312 H200 Z"/>
      <path fill="#E7EEF8" d="M140 150 L200 206 L260 150 Z"/>
      <path fill="#B8C9E0" d="M200 206 L260 150 H200 Z"/>
      <rect x="132" y="138" width="136" height="14" rx="6" fill="#F4F7FF"/>
      <path fill="${C.glass}" d="M150 138 Q200 96 250 138 Z" opacity=".85"/>
      <rect x="196" y="86" width="8" height="22" fill="#F4F7FF"/>
      <path d="M152 170 H248 M164 182 H236" stroke="${C.glassDark}" stroke-width="3" opacity=".45"/>
      ${[[110, 312, .55], [292, 312, .6]].map(([x, y, s2]) => `<g transform="translate(${x} ${y}) scale(${s2})"><path d="M-3 0 Q2 -60 -2 -110 L4 -110 Q8 -60 3 0 Z" fill="${C.trunk}"/><g fill="${C.palm}"><path d="M0 -110 q-44 -10 -66 20 q30 -12 66 -14 Z"/><path d="M0 -110 q44 -10 66 20 q-30 -12 -66 -14 Z"/><path d="M0 -110 q-30 -32 -64 -24 q34 4 64 28 Z"/><path d="M0 -110 q30 -32 64 -24 q-34 4 -64 28 Z"/></g></g>`).join('')}`, C.groundDark, 312),
    tv: frame('tv', `
      ${skyline(312, 1, '#1B3560').replace('<path d="M150', '<path opacity="0" d="M150').replace('<path d="M232', '<path opacity="0" d="M232')}
      <path fill="#E7EEF8" d="M186 312 L194 120 H206 L214 312 Z"/>
      <path fill="#C7D6EA" d="M200 120 H206 L214 312 H200 Z"/>
      <ellipse cx="200" cy="128" rx="44" ry="12" fill="#F4F7FF"/>
      <path fill="#E7EEF8" d="M160 128 H240 L232 158 H168 Z"/>
      <path fill="${C.glass}" d="M168 136 H232 L229 150 H171 Z" opacity=".8"/>
      <ellipse cx="200" cy="158" rx="32" ry="7" fill="#C7D6EA"/>
      <rect x="198" y="40" width="4" height="80" fill="#F4F7FF"/>
      <g fill="${C.ember}"><circle cx="200" cy="40" r="5"/><circle cx="200" cy="74" r="3"/></g>
      <path d="M190 240 H210 M188 280 H212" stroke="${C.glassDark}" stroke-width="3" opacity=".4"/>`, C.groundDark, 312),
    pif: frame('pf', `
      <path fill="#C7D6EA" d="M150 312 L162 120 L214 40 L250 312 Z"/>
      <path fill="#8FA6C4" d="M214 40 L250 312 H204 Z"/>
      <path fill="${C.glass}" d="M162 120 L214 40 L196 150 Z" opacity=".75"/>
      <path fill="#E7EEF8" d="M156 210 L196 150 L204 312 H150 Z" opacity=".7"/>
      <g stroke="${C.glassDark}" stroke-width="2.5" opacity=".55" fill="none">
        <path d="M158 170 L226 130 M155 230 L236 186 M152 290 L246 244"/><path d="M196 150 L204 312"/></g>
      <rect x="184" y="290" width="40" height="22" rx="3" fill="${C.night}"/>`, C.groundDark, 312),
    park: frame('pk', `
      <path fill="#3A8C66" d="M0 250 Q100 226 200 240 Q300 254 400 232 V400 H0 Z"/>
      <ellipse cx="200" cy="300" rx="150" ry="52" fill="none" stroke="${C.sand}" stroke-width="12"/>
      <ellipse cx="200" cy="300" rx="150" ry="52" fill="none" stroke="${C.cream}" stroke-width="2" stroke-dasharray="10 12"/>
      <ellipse cx="200" cy="300" rx="70" ry="20" fill="${C.glass}" opacity=".8"/>
      ${[[90, 262], [140, 250], [262, 254], [316, 262], [200, 352], [120, 344], [282, 346]].map(([x, y]) => `<g><rect x="${x - 3}" y="${y}" width="6" height="16" fill="${C.trunk}"/><circle cx="${x}" cy="${y - 6}" r="16" fill="${C.palm}"/><circle cx="${x - 5}" cy="${y - 11}" r="7" fill="${C.mint}" opacity=".6"/></g>`).join('')}
      <circle cx="150" cy="282" r="6" fill="${C.ember}"/><path d="M150 288 v14 M150 294 l-7 6 M150 294 l7 6 M150 302 l-5 10 M150 302 l6 9" stroke="${C.ember}" stroke-width="3.5" stroke-linecap="round"/>`, '#3A8C66', 250),
    diriyah: frame('dr', `
      <path fill="#B98C55" d="M0 300 L0 250 L400 240 V300 Z" opacity=".5"/>
      <path fill="${C.mud}" d="M60 312 V210 H150 V312 Z"/><path fill="${C.mudShade}" d="M150 312 V240 H250 V312 Z"/>
      <path fill="${C.mud}" d="M232 312 V170 H300 V312 Z"/><path fill="${C.mudShade}" d="M270 170 H300 V312 H270 Z"/>
      <g fill="${C.mud}">${[64, 82, 100, 118, 136].map((x) => `<path d="M${x} 210 l7 -14 l7 14 Z"/>`).join('')}${[236, 254, 272, 290].map((x) => `<path d="M${x} 170 l6 -14 l6 14 Z"/>`).join('')}</g>
      <g fill="${C.mudShade}">${[154, 172, 190, 208, 226].map((x) => `<path d="M${x} 240 l6 -12 l6 12 Z"/>`).join('')}</g>
      <g fill="#6B4A2B">${[[84, 240], [118, 240], [256, 200], [256, 250]].map(([x, y]) => `<path d="M${x - 5} ${y + 8} l5 -10 l5 10 Z"/>`).join('')}</g>
      <path fill="#6B4A2B" d="M92 312 V280 Q105 266 118 280 V312 Z M182 312 V284 Q194 272 206 284 V312 Z"/>
      <g transform="translate(340 312) scale(.75)"><path d="M-3 0 Q2 -60 -2 -110 L4 -110 Q8 -60 3 0 Z" fill="${C.trunk}"/><g fill="${C.palm}"><path d="M0 -110 q-44 -10 -66 20 q30 -12 66 -14 Z"/><path d="M0 -110 q44 -10 66 20 q-30 -12 -66 -14 Z"/><path d="M0 -110 q-30 -32 -64 -24 q34 4 64 28 Z"/><path d="M0 -110 q30 -32 64 -24 q-34 4 -64 28 Z"/></g></g>`, C.ground, 312),
    plane: frame('pl', `
      <path fill="#2A3A55" d="M0 300 H400 V400 H0 Z"/>
      <path d="M40 350 H360" stroke="${C.cream}" stroke-width="6" stroke-dasharray="28 20"/>
      <path fill="#E7EEF8" d="M300 300 V200 H316 V300 Z"/><path fill="${C.glass}" d="M292 182 H324 L318 204 H298 Z"/>
      <g transform="translate(176 190) rotate(-18)">
        <path fill="#F4F7FF" d="M-110 0 C-110 -12 -96 -18 -80 -18 H80 C104 -18 120 -8 124 0 C120 8 104 14 80 14 H-80 C-96 14 -110 10 -110 0 Z"/>
        <path fill="#C7D6EA" d="M-20 4 L30 4 L-30 62 H-52 Z"/><path fill="#DCE6F2" d="M-20 -10 L20 -10 L-24 -52 H-44 Z"/>
        <path fill="#E0592A" d="M-110 0 L-96 -46 H-80 L-70 -16 Z"/>
        <g fill="${C.glass}">${[60, 40, 20, 0, -20, -40, -60].map((x) => `<circle cx="${x}" cy="-4" r="4"/>`).join('')}</g>
        <path fill="${C.night}" d="M100 -12 C110 -10 118 -6 120 -2 H100 Z"/>
      </g>`, '#2A3A55', 300),
    cliff: frame('cf', `
      <path fill="#D7B47E" d="M0 330 H400 V400 H0 Z"/>
      <path fill="#C49A61" d="M150 400 L170 150 L240 128 L310 150 L400 140 V400 Z"/>
      <path fill="#AD8450" d="M170 150 L196 160 L180 400 H150 Z"/>
      <path fill="#E1C28E" d="M170 150 L240 128 L310 150 L400 140 V156 L240 146 Z"/>
      <path d="M200 200 L300 196 M190 250 L320 246 M184 300 L330 296" stroke="#A47942" stroke-width="5" opacity=".6"/>
      <g transform="translate(80 330)"><rect x="-3" y="-40" width="6" height="40" fill="${C.trunk}"/><ellipse cx="0" cy="-46" rx="40" ry="12" fill="${C.palm}"/><ellipse cx="-14" cy="-52" rx="20" ry="7" fill="${C.mint}" opacity=".5"/></g>
      <circle cx="232" cy="110" r="6" fill="${C.ember}"/><path d="M232 116 v14 M232 120 l-8 -6 M232 120 l8 -6 M232 130 l-5 8 M232 130 l5 8" stroke="${C.ember}" stroke-width="3.5" stroke-linecap="round"/>`, '#D7B47E', 330),
    shoe: frame('sh', `
      <path fill="${C.groundDark}" d="M0 300 H400 V400 H0 Z"/>
      <ellipse cx="200" cy="300" rx="130" ry="14" fill="#000" opacity=".18"/>
      <path fill="${C.glass}" d="M84 282 C80 240 90 206 104 186 C130 196 160 190 176 168 L196 176 C210 214 252 234 300 244 C328 250 336 268 330 282 Z"/>
      <path fill="${C.glassDark}" d="M176 168 L196 176 C206 204 226 220 252 232 C228 236 196 222 182 200 Z"/>
      <path fill="${C.cream}" d="M78 282 H334 C336 292 330 300 318 300 H92 C82 300 76 292 78 282 Z"/>
      <path fill="${C.ember}" d="M104 186 C96 214 98 250 110 282 H96 C84 250 86 214 104 186 Z"/>
      <g stroke="${C.night}" stroke-width="6" stroke-linecap="round"><path d="M166 198 L186 214 M180 188 L202 204 M196 180 L216 196"/></g>`, C.groundDark, 300),
    flame: frame('fl', `
      <path fill="${C.groundDark}" d="M0 316 H400 V400 H0 Z"/>
      <ellipse cx="200" cy="318" rx="96" ry="12" fill="#000" opacity=".2"/>
      <circle cx="200" cy="230" r="110" fill="${C.ember}" opacity=".18"/>
      <path fill="${C.ember}" d="M200 70 C242 136 292 172 284 246 C278 300 242 318 200 318 C154 318 118 292 118 244 C118 202 144 182 162 150 C172 186 184 200 196 206 C190 158 186 112 200 70 Z"/>
      <path fill="#FF9A5C" d="M200 176 C224 216 250 236 246 274 C242 304 222 316 200 316 C176 316 156 302 156 276 C156 250 174 238 184 216 C190 234 198 242 206 246 C202 222 196 202 200 176 Z"/>
      <path fill="${C.cream}" d="M200 246 C214 270 226 284 222 302 C220 314 212 318 200 318 C188 318 178 312 178 298 C178 282 192 272 200 246 Z"/>`, C.groundDark, 316)
  };
  const artSvg = (art, place) => {
    const body = art === 'sign'
      ? ART.sign(place === 'Thadiq' ? 'Thadiq' : 'Al-Kharj', place === 'Thadiq' ? 'ثادق' : 'الخرج')
      : (ART[art] || ART.shoe);
    return body;
  };
  const svg = (art, place) => `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${artSvg(art, place)}</svg>`;

  /* ---------- slides ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const dayName = (k) => parse(k).toLocaleDateString('en-GB', { weekday: 'long' });
  const range = (w) => parse(w.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' – ' +
    parse(w.end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  function slides(w) {
    if (!w.total) return [{ art: 'shoe', title: 'No steps yet', lines: ['Log your steps this week and your recap will show up here.'] }];
    const out = [{
      art: w.cmp?.place.art || 'shoe', place: w.cmp?.place.area,
      big: compact(w.total) + ' steps',
      lines: [`You walked about ${nice(w.km)} km ${w.label === 'Last week' ? 'last week' : 'this week so far'}. What a week!`, w.cmp?.text].filter(Boolean),
      tag: w.cmp ? w.cmp.place.area : ''
    }];
    if (w.best) out.push({
      art: 'shoe', big: compact(w.best.steps) + ' steps',
      lines: [`${dayName(w.best.key)} was your power day! 💪`,
        w.goalDays ? `You hit 10K on ${w.goalDays} of ${w.days.length} days.${w.goalDays >= 5 ? ' Unstoppable!' : ''}` : 'This week, go for your first 10K day!']
    });
    out.push(w.streak.current > 0
      ? { art: 'flame', big: w.streak.current + (w.streak.current === 1 ? ' day' : ' days'),
          lines: ['Your 10K streak is on fire. Don\'t let it go out! 🔥', w.streak.current >= w.streak.best ? 'This is your best streak ever!' : `Best streak: ${w.streak.best} days. Can you beat it?`] }
      : { art: 'flame', big: 'New week', lines: ['Fresh start! Hit 10,000 steps today to light a new streak. 🔥', w.streak.best ? `Best streak so far: ${w.streak.best} days.` : ''].filter(Boolean) });
    return out;
  }

  let getState = null, week = null, list = [], index = 0;
  function renderSlide() {
    const s = list[index];
    $('recapSlide').innerHTML = `<div class="recap-art">${svg(s.art, s.place)}</div>
      ${s.tag ? `<span class="recap-tag">${esc(s.tag)}</span>` : ''}
      <p class="recap-big">${esc(s.big || s.title)}</p>
      ${s.lines.map((l) => `<p class="recap-line">${esc(l)}</p>`).join('')}`;
    $('recapPeriod').textContent = week.label + ' · ' + range(week);
    $('recapDots').innerHTML = list.map((_, i) => `<i class="${i === index ? 'is-on' : ''}"></i>`).join('');
    $('recapBack').disabled = index === 0;
    $('recapNext').textContent = index < list.length - 1 ? `${index + 1}/${list.length} Next` : 'Done';
    $('recapStatus').textContent = '';
  }
  function current() {
    const st = getState?.();
    if (!st?.userId || st.readonly) return null;
    return summary(st.entries, key(new Date()));
  }
  function renderCard() {
    const w = current();
    const card = $('recapSection');
    if (!card) return;
    card.hidden = !w;
    if (!w) return;
    $('recapCardText').textContent = w.total
      ? `${w.label}: ${compact(w.total)} steps, about ${nice(w.km)} km.`
      : 'Log steps this week to unlock your recap.';
  }
  function open() {
    week = current();
    if (!week) return;
    list = slides(week); index = 0;
    renderSlide();
    $('recapDialog').showModal();
  }

  /* ---------- share as a 9:16 image ---------- */
  function wrap(c, s, maxW) {
    const words = s.split(' '), lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }
  async function render(s) {
    const W = 1080, H = 1920, S = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * S; canvas.height = H * S;
    const c = canvas.getContext('2d', { alpha: false });
    c.scale(S, S);
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#24140F'); bg.addColorStop(1, '#0E0F12');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const glow = c.createRadialGradient(540, 700, 40, 540, 700, 620);
    glow.addColorStop(0, 'rgba(255,90,31,.22)'); glow.addColorStop(1, 'rgba(255,90,31,0)');
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(s.art, s.place).replace('role="img" aria-hidden="true"', 'width="800" height="800"'));
    await img.decode();
    c.drawImage(img, 190, 300, 700, 700);
    const body = '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';
    c.textAlign = 'center';
    c.fillStyle = '#B9B1AA'; c.font = `600 40px ${body}`;
    c.fillText(week.label + ' · ' + range(week), W / 2, 200);
    let y = 1130;
    if (s.tag) { c.fillStyle = '#FFB27A'; c.font = `700 34px ${body}`; c.fillText(s.tag.toUpperCase(), W / 2, y); y += 140; }
    c.fillStyle = '#FF9A5C'; c.font = `800 110px ${body}`;
    c.fillText(s.big || s.title, W / 2, y); y += 100;
    c.fillStyle = '#F5F2EE'; c.font = `500 48px ${body}`;
    for (const l of s.lines) for (const line of wrap(c, l, 860)) { c.fillText(line, W / 2, y); y += 66; }
    c.fillStyle = '#B9B1AA'; c.font = `500 30px ${body}`;
    c.fillText('fitness.oalfawzan.sa', W / 2, H - 80);
    return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not create the image.'))), 'image/png'));
  }
  async function share() {
    const status = $('recapStatus');
    try {
      const blob = await render(list[index]);
      const file = new File([blob], 'fitness-week-' + week.start + '.png', { type: 'image/png' });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        try { await navigator.share({ files: [file] }); } catch (e) { if (e.name !== 'AbortError') throw e; }
        return;
      }
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = file.name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status.textContent = 'Image saved to your downloads.';
    } catch (e) {
      status.textContent = e.message || 'Could not share this slide.';
    }
  }

  /* ---------- today's landmark ---------- */
  // Short, upbeat openers; one per day, picked by date.
  const CHEERS = ['Look at you go!', 'Riyadh is your track today.', 'Every step counts.', 'Keep that pace!',
    'Your city, your steps.', 'Nice walking!', 'On the move!'];
  function renderToday() {
    const box = $('landmarkToday');
    if (!box) return;
    const st = getState?.();
    if (!st?.userId) { box.hidden = true; return; }
    box.hidden = false;
    const todayKey = key(new Date());
    const steps = Number(st.entries?.get(todayKey)?.steps) || 0;
    const km = steps * STEP_M / 1000;
    const day = Math.round(parse(todayKey).getTime() / 864e5);
    // Same landmark until the step count moves into a new band.
    const cmp = steps ? comparison(km, day + Math.floor(steps / 2500), 'day') : null;
    const next = nextMilestone(steps);
    const streak = window.FitnessProgress?.streak(st.entries, todayKey) || { current: 0 };
    $('landmarkArt').innerHTML = svg(cmp?.place.art || 'shoe', cmp?.place.area);
    $('landmarkTag').textContent = cmp ? cmp.place.area : 'Today';
    $('landmarkHead').textContent = cmp ? cmp.text : 'Where will your steps take you today?';
    $('landmarkSub').textContent = steps
      ? `${CHEERS[day % CHEERS.length]} ${steps.toLocaleString('en-US')} steps, about ${nice(km)} km.`
      : 'Log your first steps and turn them into Riyadh landmarks.';
    let goal = '', pct = 0;
    if (steps < GOAL) {
      const left = GOAL - steps;
      goal = streak.current > 0
        ? `${left.toLocaleString('en-US')} steps to 10K. Keep your ${streak.current}-day streak alive! 🔥`
        : `${left.toLocaleString('en-US')} steps to 10K and a brand-new streak! 🔥`;
      pct = steps / GOAL;
    } else if (next) {
      const from = MILESTONES.filter((m) => m.km * 1000 / STEP_M <= steps).pop();
      const startSteps = from ? from.km * 1000 / STEP_M : 0, endSteps = steps + next.stepsLeft;
      goal = `10K done! Only ${next.stepsLeft.toLocaleString('en-US')} steps to ${next.text}.`;
      pct = (steps - startSteps) / (endSteps - startSteps);
    } else {
      goal = 'You walked further than Diriyah today. Legend! 🏆';
      pct = 1;
    }
    $('landmarkNext').textContent = goal;
    $('landmarkBar').style.width = Math.round(Math.max(0.03, Math.min(1, pct)) * 100) + '%';
  }

  function mount(callback) {
    if (getState) return;
    getState = callback;
    $('recapOpenBtn')?.addEventListener('click', open);
    $('recapClose')?.addEventListener('click', () => $('recapDialog').close());
    $('recapBack')?.addEventListener('click', () => { if (index > 0) { index--; renderSlide(); } });
    $('recapNext')?.addEventListener('click', () => {
      if (index < list.length - 1) { index++; renderSlide(); } else $('recapDialog').close();
    });
    $('recapShare')?.addEventListener('click', share);
  }
  window.FitnessRecap = Object.freeze({ mount, refresh: () => { renderCard(); renderToday(); }, summary, comparison, nextMilestone, svg, PLACES });
})();
