/* Ember layout for Check-in, Calendar, Challenges and Share.
 * Adds UI around app.js's existing elements (same IDs, same saving logic).
 * app.js calls mount(getContext) once and render(page) after each render. */
(() => {
  'use strict';
  const GOAL = 10000, STEP_M = 0.75;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const short = (n) => n >= 10000 ? (Math.round(n / 100) / 10) + 'k' : fmt(n);
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const svg = (paths, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICON = {
    steps: '<path d="M8 3c-1.4 0-2.4 1.6-2.4 3.7 0 1.6.6 3 .9 4.4.2.9 1 1.4 1.9 1.3 1-.1 1.6-.9 1.7-1.8.2-1.6.4-3.2.4-4.5C10.5 4.4 9.4 3 8 3Z"/><path d="M6.6 14.5c.1 1.6.9 2.6 2 2.6s1.6-.9 1.5-2.4"/><path d="M16 7c1.4 0 2.4 1.6 2.4 3.7 0 1.6-.6 3-.9 4.4-.2.9-1 1.4-1.9 1.3-1-.1-1.6-.9-1.7-1.8-.2-1.6-.4-3.2-.4-4.5 0-1.7 1.1-3.1 2.5-3.1Z"/><path d="M17.4 18.5c-.1 1.6-.9 2.6-2 2.6s-1.6-.9-1.5-2.4"/>',
    flame: '<path d="M12 22c4 0 7-2.8 7-6.8 0-3.1-1.8-5.3-3.6-7 .1 1.8-.6 3.1-1.8 3.6.4-4-1.4-7.2-4.1-8.8.5 3.1-1 5.1-2.7 7C5.4 11.6 5 13.4 5 15.2 5 19.2 8 22 12 22Z"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1.5A5.5 5.5 0 0 1 8.5 13h1A5.5 5.5 0 0 1 15 18.5V20"/><path d="M16 4.5a3 3 0 0 1 0 6M18 13.5a5 5 0 0 1 3 4.6V20"/>',
    medal: '<path d="M7 3h4l2 5M17 3h-4"/><circle cx="12" cy="15" r="6"/><path d="m12 12 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5L11 14z"/>',
    badge: '<path d="M12 2.5 14.6 5l3.5-.4.5 3.5 3 1.9-1.6 3.1 1.6 3.1-3 1.9-.5 3.5-3.5-.4L12 23.5 9.4 21l-3.5.4-.5-3.5-3-1.9L4 12.9 2.4 9.8l3-1.9.5-3.5 3.5.4z"/>',
    road: '<path d="M8 3 4 21M16 3l4 18M12 4v3M12 11v3M12 18v2"/>'
  };
  let getCtx = null;
  let wired = false;

  /* ---------- shared: page eyebrow ---------- */
  function eyebrow(text) {
    const intro = document.querySelector('.page-intro > div');
    if (!intro) return;
    let el = intro.querySelector('.page-eyebrow');
    if (!el) { el = document.createElement('span'); el.className = 'page-eyebrow'; intro.prepend(el); }
    el.textContent = text;
  }
  const dayLabel = (k) => parse(k).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  /* ---------- Check-in ---------- */
  function wireCheckin() {
    const box = document.querySelector('.quick-entry-steps');
    const input = $('steps');
    if (!box || !input || box.querySelector('.steps-live')) return;
    box.querySelector('.quick-entry-copy')?.insertAdjacentHTML('afterbegin', `<span class="qe-icon">${svg(ICON.steps)}</span>`);
    document.querySelector('.quick-entry-calories .quick-entry-copy')?.insertAdjacentHTML('afterbegin', `<span class="qe-icon">${svg(ICON.flame)}</span>`);
    box.insertAdjacentHTML('beforeend', `
      <div class="steps-live">
        <div class="steps-live-track" aria-hidden="true"><span id="stepsLiveBar"></span><i></i></div>
        <div class="steps-live-meta"><span id="stepsLiveText">0 of 10,000</span><span id="stepsLiveKm">0 km</span></div>
        <div class="steps-chips" role="group" aria-label="Quick add steps">
          <button type="button" data-add="1000">+1,000</button>
          <button type="button" data-add="2500">+2,500</button>
          <button type="button" data-add="5000">+5,000</button>
          <button type="button" data-set="10000">10K</button>
        </div>
      </div>`);
    box.querySelectorAll('.steps-chips button').forEach((b) => b.addEventListener('click', () => {
      const now = Number(input.value) || 0;
      const next = b.dataset.set ? Math.max(now, Number(b.dataset.set)) : Math.min(100000, now + Number(b.dataset.add));
      input.value = String(next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop');
    }));
    input.addEventListener('input', liveSteps);
    input.addEventListener('change', liveSteps);
  }
  function liveSteps() {
    const input = $('steps'); if (!input) return;
    const steps = Math.max(0, Number(input.value) || 0);
    const pct = Math.min(100, steps / GOAL * 100);
    const bar = $('stepsLiveBar'); if (bar) bar.style.width = pct.toFixed(1) + '%';
    const box = document.querySelector('.quick-entry-steps');
    box?.classList.toggle('is-done', steps >= GOAL);
    const t = $('stepsLiveText');
    if (t) t.textContent = !steps ? 'Goal 10,000 steps' : steps >= GOAL ? `${fmt(steps)} · goal hit` : `${fmt(GOAL - steps)} to 10K`;
    const k = $('stepsLiveKm'); if (k) k.textContent = (Math.round(steps * STEP_M / 100) / 10) + ' km';
  }
  function renderCheckin(ctx) {
    wireCheckin();
    liveSteps();
    if (ctx?.selectedDate) {
      const today = key(new Date());
      eyebrow(ctx.selectedDate === today ? 'TODAY · ' + dayLabel(today) : dayLabel(ctx.selectedDate));
    }
  }

  /* ---------- Calendar ---------- */
  function wireCalendar() {
    const layout = document.querySelector('.page-layout-history');
    if (!layout || $('monthHero')) return;
    layout.insertAdjacentHTML('afterbegin', `
      <section class="glass-card month-hero" id="monthHero" aria-labelledby="monthHeroTitle">
        <div class="month-hero-head">
          <div><span class="month-hero-kicker" id="monthHeroKicker">THIS MONTH</span><h2 id="monthHeroTitle">0 steps</h2></div>
          <span class="month-hero-pill" id="monthHeroGoal">0 days at 10K</span>
        </div>
        <div class="month-hero-stats">
          <div><strong id="monthHeroKm">0</strong><span>km walked</span></div>
          <div><strong id="monthHeroAvg">0</strong><span>avg / day</span></div>
          <div><strong id="monthHeroBest">0</strong><span>best day</span></div>
        </div>
        <div class="month-bars" id="monthBars" aria-hidden="true"></div>
      </section>`);
    const legend = document.querySelector('.calendar-metrics-legend');
    if (legend) legend.innerHTML = '<span class="heat-scale">Less <i style="--heat:.05"></i><i style="--heat:.3"></i><i style="--heat:.55"></i><i style="--heat:.8"></i><i class="is-goal-key" style="--heat:1"></i> 10K+</span>';
    document.querySelector('.calendar-key')?.remove();
    const summary = document.querySelector('.summary-panel');
    if (summary && !summary.previousElementSibling?.classList.contains('summary-title')) {
      summary.insertAdjacentHTML('beforebegin', '<h3 class="summary-title">All time</h3>');
    }
  }
  function renderCalendar(ctx) {
    wireCalendar();
    if (!ctx?.entries || !ctx.displayedMonth) return;
    const m0 = ctx.displayedMonth;
    const y = m0.getFullYear(), m = m0.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const todayKey = key(new Date());
    const rows = [];
    for (let d = 1; d <= days; d++) {
      const k = key(new Date(y, m, d, 12));
      const e = ctx.entries.get(k);
      rows.push({ d, k, steps: e?.steps == null ? null : Number(e.steps), future: k > todayKey });
    }
    const logged = rows.filter((r) => r.steps != null);
    const total = logged.reduce((s, r) => s + r.steps, 0);
    const goal = logged.filter((r) => r.steps >= GOAL).length;
    const best = logged.reduce((b, r) => Math.max(b, r.steps), 0);
    const isCurrent = key(new Date(y, m, 1, 12)).slice(0, 7) === todayKey.slice(0, 7);
    $('monthHeroKicker').textContent = (isCurrent ? 'THIS MONTH · ' : '') + m0.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
    $('monthHeroTitle').textContent = `${fmt(total)} steps`;
    $('monthHeroGoal').innerHTML = `<svg class="ico-flame" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 22c4 0 7-2.8 7-6.8 0-3.1-1.8-5.3-3.6-7 .1 1.8-.6 3.1-1.8 3.6.4-4-1.4-7.2-4.1-8.8.5 3.1-1 5.1-2.7 7C5.4 11.6 5 13.4 5 15.2 5 19.2 8 22 12 22Z"/></svg> ${goal} day${goal === 1 ? '' : 's'} at 10K`;
    $('monthHeroKm').textContent = (Math.round(total * STEP_M / 100) / 10).toLocaleString('en-US');
    $('monthHeroAvg').textContent = logged.length ? short(total / logged.length) : '—';
    $('monthHeroBest').textContent = best ? short(best) : '—';
    const max = Math.max(GOAL * 1.25, best);
    $('monthBars').innerHTML = `<i class="month-goal-line" style="bottom:${(GOAL / max * 100).toFixed(1)}%"></i>` + rows.map((r) => {
      const h = r.steps == null ? 0 : Math.max(4, r.steps / max * 100);
      const cls = r.future ? 'is-future' : r.steps == null ? 'is-empty' : r.steps >= GOAL ? 'is-goal' : '';
      return `<span class="${cls}${r.k === todayKey ? ' is-today' : ''}"><b style="height:${h.toFixed(1)}%"></b></span>`;
    }).join('');
  }

  /* ---------- Challenges ---------- */
  function renderChallenges(ctx) {
    const intro = document.querySelector('.page-intro');
    if (!intro || !ctx?.entries) return;
    let hero = $('chSummary');
    if (!hero) {
      intro.insertAdjacentHTML('afterend', `
        <section class="ch-summary" id="chSummary" aria-label="Your progress">
          <div class="ch-sum-tile"><span class="ch-sum-icon">${svg(ICON.medal)}</span><strong id="chSumMonth">0 km</strong><small id="chSumMonthLabel">this month</small></div>
          <div class="ch-sum-tile"><span class="ch-sum-icon">${svg(ICON.badge)}</span><strong id="chSumBadges">0 / 17</strong><small>badges</small></div>
          <div class="ch-sum-tile"><span class="ch-sum-icon">${svg(ICON.road)}</span><strong id="chSumKm">0 km</strong><small>all time</small></div>
        </section>`);
    }
    const now = new Date();
    const month = key(now).slice(0, 7);
    let monthSteps = 0, allSteps = 0;
    for (const e of ctx.entries.values()) {
      const s = Number(e?.steps) || 0;
      allSteps += s;
      if (String(e?.entry_date || '').startsWith(month)) monthSteps += s;
    }
    const km = (n) => (Math.round(n * STEP_M / 1000 * 10) / 10).toLocaleString('en-US') + ' km';
    $('chSumMonth').textContent = km(monthSteps);
    $('chSumMonthLabel').textContent = now.toLocaleDateString('en-GB', { month: 'long' }).toLowerCase();
    $('chSumKm').textContent = km(allSteps).replace(/\.\d km$/, ' km');
    const list = window.FitnessBadges?.evaluate?.(ctx.entries) || [];
    $('chSumBadges').textContent = `${list.filter((b) => b.earnedOn).length} / ${list.length || 17}`;
  }

  /* ---------- Share ---------- */
  function renderShare() {
    const add = (id, icon) => {
      const h = $(id);
      if (h && !h.querySelector('.head-icon')) h.insertAdjacentHTML('afterbegin', `<span class="head-icon">${svg(icon)}</span>`);
    };
    add('pushTitle', ICON.bell);
    add('sharingTitle', ICON.people);
  }

  function render(page) {
    const ctx = getCtx?.() || {};
    document.documentElement.dataset.page = page || '';
    if (page === 'logSection') renderCheckin(ctx);
    else if (page === 'historySection') { eyebrow('YOUR HISTORY'); renderCalendar(ctx); }
    else if (page === 'challengesSection') { eyebrow('EVERYONE WINS'); renderChallenges(ctx); }
    else if (page === 'sharingPanel') { eyebrow('FRIENDS & REMINDERS'); renderShare(); }
  }
  function mount(fn) { getCtx = fn; wired = true; }

  window.FitnessPages = Object.freeze({ mount, render, get wired() { return wired; } });
})();
