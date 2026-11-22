/* Weekly recap: last week's steps turned into Riyadh, Thadiq and Al-Kharj
 * landmarks, in three short slides that can be shared as a 9:16 image.
 *
 * Distances (checked 23 Nov 2026, see DESIGN.md for sources):
 *   Wadi Hanifah trail (Sports Boulevard)  13.4 km
 *   King Abdullah Road                     ~25 km
 *   Riyadh Metro Blue Line                 38 km
 *   King Fahd Road (inside Riyadh)         49 km
 *   Riyadh to Al-Kharj by road             ~85 km
 *   Riyadh to Thadiq by road               ~125 km
 *   Riyadh Sports Boulevard                ~135 km
 *   Whole Riyadh Metro network             176 km
 *   Kingdom Centre height                  302.3 m
 *   King Abdulaziz Mosque minarets, Kharj  ~83 m
 *   Al-Marqab Tower, Raghba (Thadiq)       ~30 m
 * Steps become distance at about 0.75 m a step, so every figure is "about".
 */
(() => {
  'use strict';
  const STEP_M = 0.75, GOAL = 10000;
  const $ = (id) => document.getElementById(id);

  const PLACES = [
    { kind: 'route', km: 13.4, art: 'wadi', name: 'the Wadi Hanifah trail', area: 'Riyadh' },
    { kind: 'route', km: 25, art: 'road', name: 'King Abdullah Road', area: 'Riyadh' },
    { kind: 'route', km: 38, art: 'metro', name: 'the Riyadh Metro Blue Line', area: 'Riyadh' },
    { kind: 'route', km: 49, art: 'road', name: 'King Fahd Road', area: 'Riyadh' },
    { kind: 'trip', km: 85, art: 'minarets', name: 'Riyadh to Al-Kharj', area: 'Al-Kharj' },
    { kind: 'trip', km: 125, art: 'marqab', name: 'Riyadh to Thadiq', area: 'Thadiq' },
    { kind: 'route', km: 135, art: 'wadi', name: 'the Riyadh Sports Boulevard', area: 'Riyadh' },
    { kind: 'route', km: 176, art: 'metro', name: 'the whole Riyadh Metro network', area: 'Riyadh' },
    { kind: 'height', km: 0.3023, art: 'kingdom', name: 'Kingdom Centre', plural: 'Kingdom Centres', area: 'Riyadh' },
    { kind: 'height', km: 0.083, art: 'minarets', name: 'King Abdulaziz Mosque minaret', plural: 'King Abdulaziz Mosque minarets', area: 'Al-Kharj' },
    { kind: 'height', km: 0.03, art: 'marqab', name: 'Al-Marqab Tower', plural: 'Al-Marqab Towers', area: 'Thadiq' }
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

  // Pick a landmark that gives a friendly number, varying week to week.
  function pickPlace(km, seed) {
    if (!(km > 0)) return null;
    // Trips (Riyadh to Al-Kharj / Thadiq) also read well as "60% of the way".
    const far = PLACES.filter((p) => p.kind !== 'height' &&
      km / p.km >= (p.kind === 'trip' ? 0.4 : 1) && km / p.km <= 12);
    const tall = PLACES.filter((p) => p.kind === 'height' && km / p.km >= 3 && km / p.km <= 120);
    const pool = far.length ? far : tall.length ? tall : PLACES.filter((p) => p.kind !== 'height');
    const place = pool[seed % pool.length];
    return { place, ratio: km / place.km };
  }
  function comparison(km, seed) {
    const hit = pickPlace(km, seed);
    if (!hit) return null;
    const { place, ratio } = hit, n = nice(ratio);
    let text;
    if (place.kind === 'height') text = `That's ${n} ${place.plural} laid end to end!`;
    else if (ratio < 1) text = place.kind === 'trip'
      ? `That's ${Math.round(ratio * 100)}% of the way from ${place.name}!`
      : `That's ${Math.round(ratio * 100)}% of ${place.name}.`;
    else if (place.kind === 'trip') text = ratio < 1.15
      ? `That's like walking from ${place.name}!`
      : `That's like walking from ${place.name} ${n} times!`;
    else text = ratio < 1.15 ? `That's the full length of ${place.name}!` : `That's ${n} times the length of ${place.name}!`;
    return { place, text };
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

  /* ---------- illustrations (flat, in the app's palette) ---------- */
  const NAVY = '#16294D', GLASS = '#8DC8FF', MINT = '#90E8C7', EMBER = '#E0592A', SAND = '#E9C99A', CREAM = '#FFF3E1';
  const ground = (fill = '#22375E') => `<ellipse cx="200" cy="356" rx="170" ry="22" fill="${fill}"/>`;
  const ART = {
    kingdom: `${ground()}<path d="M130 350 L170 60 Q200 40 230 60 L270 350 Z" fill="#2B4A7A"/>
      <path d="M160 140 Q200 95 240 140 L232 200 Q200 165 168 200 Z" fill="${NAVY}"/>
      <path d="M170 60 Q200 40 230 60 L224 104 Q200 84 176 104 Z" fill="${GLASS}" opacity=".55"/>
      <path d="M150 240 H250 M145 280 H255 M140 320 H260" stroke="${GLASS}" stroke-width="5" opacity=".35"/>`,
    road: `${ground()}<path d="M170 350 L196 90 H204 L230 350 Z" fill="#2B4A7A"/>
      <path d="M200 110 V140 M200 170 V210 M200 240 V290 M200 315 V350" stroke="${SAND}" stroke-width="6" stroke-linecap="round"/>
      <path d="M120 350 V180 Q120 165 135 165 H150 M280 350 V180 Q280 165 265 165 H250" stroke="${GLASS}" stroke-width="7" fill="none" stroke-linecap="round"/>
      <circle cx="152" cy="168" r="9" fill="${CREAM}"/><circle cx="248" cy="168" r="9" fill="${CREAM}"/>`,
    metro: `${ground()}<rect x="110" y="110" width="180" height="220" rx="40" fill="#2B6CB8"/>
      <rect x="132" y="140" width="136" height="80" rx="16" fill="${NAVY}"/>
      <rect x="140" y="148" width="120" height="30" rx="10" fill="${GLASS}" opacity=".45"/>
      <rect x="110" y="236" width="180" height="16" fill="${MINT}"/>
      <circle cx="150" cy="290" r="14" fill="${CREAM}"/><circle cx="250" cy="290" r="14" fill="${CREAM}"/>
      <path d="M140 345 L120 370 M260 345 L280 370" stroke="${GLASS}" stroke-width="8" stroke-linecap="round"/>`,
    wadi: `${ground('#2A4B5E')}<path d="M40 340 Q200 300 360 340" stroke="${GLASS}" stroke-width="14" fill="none" stroke-linecap="round" opacity=".8"/>
      ${[[120, 330, 190], [200, 320, 150], [280, 330, 200]].map(([x, b, t]) => `
      <path d="M${x} ${b} Q${x + 6} ${(b + t) / 2} ${x} ${t}" stroke="#8B6A44" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M${x} ${t} q-50 -6 -70 26 M${x} ${t} q50 -6 70 26 M${x} ${t} q-30 -34 -64 -30 M${x} ${t} q30 -34 64 -30 M${x} ${t} q0 -30 -6 -46" stroke="${MINT}" stroke-width="12" fill="none" stroke-linecap="round"/>`).join('')}`,
    marqab: `${ground('#4A3A2E')}<path d="M150 350 L170 90 H230 L250 350 Z" fill="${SAND}"/>
      <path d="M165 90 H235 V70 H221 V80 H207 V70 H193 V80 H179 V70 H165 Z" fill="${SAND}"/>
      <path d="M170 90 H230" stroke="#B8915F" stroke-width="6"/>
      <rect x="192" y="140" width="16" height="26" rx="8" fill="#6B4A2B"/><rect x="190" y="210" width="20" height="30" rx="10" fill="#6B4A2B"/>
      <rect x="186" y="290" width="28" height="60" rx="14" fill="#6B4A2B"/>
      <path d="M160 260 L240 250" stroke="#B8915F" stroke-width="4" opacity=".6"/>`,
    minarets: `${ground()}<path d="M140 350 V230 Q200 150 260 230 V350 Z" fill="${SAND}"/>
      <path d="M160 240 Q200 180 240 240" fill="#E2B577"/>
      ${[95, 305].map((x) => `<rect x="${x - 14}" y="100" width="28" height="250" fill="${CREAM}"/>
      <rect x="${x - 20}" y="170" width="40" height="12" rx="4" fill="${SAND}"/>
      <path d="M${x - 14} 100 L${x} 62 L${x + 14} 100 Z" fill="${EMBER}"/>`).join('')}
      <rect x="186" y="290" width="28" height="60" rx="14" fill="#6B4A2B"/>`,
    flame: `${ground()}<path d="M200 60 C240 130 300 170 290 250 C282 318 240 350 200 350 C150 350 110 316 110 258 C110 210 140 186 160 150 C170 190 182 206 196 214 C190 160 186 110 200 60 Z" fill="${EMBER}"/>
      <path d="M200 200 C222 240 250 262 246 298 C242 330 222 344 200 344 C176 344 156 328 156 300 C156 272 176 260 186 238 C192 256 198 264 206 268 C202 246 196 226 200 200 Z" fill="#FFB27A"/>
      <path d="M200 270 C212 292 222 304 220 320 C218 336 210 342 200 342 C188 342 180 334 180 320 C180 306 192 296 200 270 Z" fill="${CREAM}"/>`,
    shoe: `${ground()}<path d="M80 300 L90 190 Q150 200 180 160 L220 210 Q270 250 320 262 Q340 270 330 300 Z" fill="${GLASS}"/>
      <path d="M80 300 H330 V318 Q330 330 318 330 H92 Q80 330 80 318 Z" fill="${CREAM}"/>
      <path d="M150 196 L176 220 M170 186 L196 210 M190 196 L214 220" stroke="${NAVY}" stroke-width="7" stroke-linecap="round"/>`
  };
  const svg = (art) => `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${ART[art] || ART.shoe}</svg>`;

  /* ---------- slides ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const dayName = (k) => parse(k).toLocaleDateString('en-GB', { weekday: 'long' });
  const range = (w) => parse(w.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' – ' +
    parse(w.end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  function slides(w) {
    if (!w.total) return [{ art: 'shoe', title: 'No steps yet', lines: ['Log your steps this week and your recap will show up here.'] }];
    const out = [{
      art: w.cmp?.place.art || 'shoe',
      big: compact(w.total) + ' steps',
      lines: [`You walked about ${nice(w.km)} km ${w.label === 'Last week' ? 'last week' : 'this week so far'}.`, w.cmp?.text].filter(Boolean),
      tag: w.cmp ? w.cmp.place.area : ''
    }];
    if (w.best) out.push({
      art: 'shoe', big: compact(w.best.steps) + ' steps',
      lines: [`Your best day was ${dayName(w.best.key)}.`,
        w.goalDays ? `You reached 10K on ${w.goalDays} of ${w.days.length} days.` : 'Aim for one 10K day this week.']
    });
    out.push(w.streak.current > 0
      ? { art: 'flame', big: w.streak.current + (w.streak.current === 1 ? ' day' : ' days'),
          lines: ['Your 10K streak is alive. Keep it going!', `Best streak: ${w.streak.best} days.`] }
      : { art: 'flame', big: 'New week', lines: ['Hit 10,000 steps today to start a new streak.', w.streak.best ? `Best streak so far: ${w.streak.best} days.` : ''].filter(Boolean) });
    return out;
  }

  let getState = null, week = null, list = [], index = 0;
  function renderSlide() {
    const s = list[index];
    $('recapSlide').innerHTML = `<div class="recap-art">${svg(s.art)}</div>
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
    bg.addColorStop(0, '#0E2147'); bg.addColorStop(1, '#071330');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const glow = c.createRadialGradient(540, 700, 40, 540, 700, 620);
    glow.addColorStop(0, 'rgba(141,200,255,.18)'); glow.addColorStop(1, 'rgba(141,200,255,0)');
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(s.art).replace('role="img" aria-hidden="true"', 'width="800" height="800"'));
    await img.decode();
    c.drawImage(img, 190, 300, 700, 700);
    const body = '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';
    c.textAlign = 'center';
    c.fillStyle = '#A9BCD8'; c.font = `600 40px ${body}`;
    c.fillText(week.label + ' · ' + range(week), W / 2, 200);
    let y = 1130;
    if (s.tag) { c.fillStyle = '#90E8C7'; c.font = `700 34px ${body}`; c.fillText(s.tag.toUpperCase(), W / 2, y); y += 140; }
    c.fillStyle = '#90E8C7'; c.font = `800 110px ${body}`;
    c.fillText(s.big || s.title, W / 2, y); y += 100;
    c.fillStyle = '#F4F7FF'; c.font = `500 48px ${body}`;
    for (const l of s.lines) for (const line of wrap(c, l, 860)) { c.fillText(line, W / 2, y); y += 66; }
    c.fillStyle = '#A9BCD8'; c.font = `500 30px ${body}`;
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
  window.FitnessRecap = Object.freeze({ mount, refresh: renderCard, summary, comparison, PLACES });
})();
