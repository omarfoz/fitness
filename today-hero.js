/* Today, Ember layout: the big steps ring, greeting + streak pill title,
 * this week's bars (Mon–Sun, dashed 10K line) and the challenge strip.
 * Reads the same entries app.js already loaded; writes nothing.
 * Text for calories, fasting and the streak numbers is still set by app.js
 * (same element ids as before); this file owns the visuals around them.
 */
(() => {
  'use strict';
  const GOAL = 10000, STEP_M = 0.75, CIRC = 2 * Math.PI * 96;
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  let getState = null;

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  function renderRing(steps, has) {
    const pct = Math.min(1, steps / GOAL);
    $('stepsRingArc')?.setAttribute('stroke-dasharray', `${(CIRC * pct).toFixed(1)} ${CIRC.toFixed(1)}`);
    const ring = $('stepsRing');
    if (ring) {
      ring.setAttribute('aria-valuenow', String(Math.min(GOAL, steps)));
      ring.classList.toggle('is-done', steps >= GOAL);
    }
    $('stepMeta').textContent = !has ? 'Log steps to fill the ring'
      : steps >= GOAL ? 'of 10,000 · goal hit 🔥' : `${(GOAL - steps).toLocaleString('en-US')} to go`;
    $('heroKm').textContent = has ? (Math.round(steps * STEP_M / 100) / 10).toString() : '—';
  }

  function renderWeek(entries, selected) {
    const chart = $('weekChart');
    if (!chart) return;
    const d = parse(selected), monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const days = [];
    for (let i = 0; i < 7; i++) {
      const x = new Date(monday); x.setDate(monday.getDate() + i);
      const k = key(x), s = entries.get(k)?.steps;
      days.push({ k, label: 'MTWTFSS'[i], steps: s == null ? null : Number(s), future: k > key(new Date()) });
    }
    const max = Math.max(GOAL * 1.3, ...days.map((x) => x.steps || 0));
    const line = Math.round((1 - GOAL / max) * 100);
    chart.innerHTML = `<span class="week-goal-line" style="top:${line}%"><em>10K</em></span>` + days.map((x) => {
      const h = x.steps ? Math.max(4, Math.round((x.steps / max) * 100)) : 0;
      const cls = x.steps >= GOAL ? 'is-goal' : x.steps ? 'is-short' : 'is-empty';
      const title = x.steps == null ? (x.future ? 'not yet' : 'no steps logged') : x.steps.toLocaleString('en-US') + ' steps';
      return `<div class="week-day${x.k === selected ? ' is-selected' : ''}" title="${title}">
        <div class="week-bar-wrap"><span class="week-bar ${cls}" style="height:${h}%"></span></div>
        <span class="week-label">${x.label}</span></div>`;
    }).join('');
    const hits = days.filter((x) => x.steps >= GOAL).length;
    $('weekCount').textContent = `${hits} of 7 at 10K`;
    chart.setAttribute('aria-label', 'Steps this week: ' + days.map((x) => `${x.label} ${x.steps == null ? 'none' : x.steps}`).join(', '));
  }

  function renderChallenge(entries) {
    const strip = $('challengeStrip'), C = window.FitnessChallenges;
    if (!strip || !C) return;
    const month = key(new Date()).slice(0, 7);
    const ch = C.CHALLENGES.find((c) => c.id === month);
    if (!ch) { strip.hidden = true; return; }
    strip.hidden = false;
    const p = C.progress(ch, entries), tiers = ['bronze', 'silver', 'gold'];
    const next = ch.levels[p.level];
    const fmt = (v) => ch.metric === 'km' ? `${Math.round(v * 10) / 10} km` : `${Math.floor(v)} ${ch.unit}`;
    const end = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0);
    const left = Math.max(0, Math.ceil((end - parse(key(new Date()))) / 864e5) + 1);
    $('challengeStripTitle').textContent = ch.title;
    $('challengeStripText').textContent = next != null
      ? `${fmt(p.value)} · ${tiers[p.level][0].toUpperCase() + tiers[p.level].slice(1)} in ${fmt(next - p.value)}`
      : `${fmt(p.value)} · Gold won! 🎉`;
    $('challengeStripDays').textContent = `${left} day${left === 1 ? '' : 's'}`;
    const goal = next ?? ch.levels[2];
    $('challengeStripBar').style.width = Math.max(3, Math.min(100, (p.value / goal) * 100)).toFixed(0) + '%';
    const tier = tiers[Math.min(2, p.level)];
    $('challengeStripMedal').innerHTML = window.FitnessChallengeMedals?.svg?.({ ...ch, month: parse(month + '-01').toLocaleDateString('en-GB', { month: 'long' }), year: Number(month.slice(0, 4)) }, tier, { size: 48, locked: p.level === 0 }) || '';
  }

  function render() {
    const st = getState?.();
    if (!st?.userId) return;
    const entries = st.entries, selected = st.selectedDate || key(new Date());
    const e = entries.get(selected), steps = Number(e?.steps) || 0, has = e?.steps != null;
    $('todayGreeting').textContent = st.readonly ? 'Viewing a shared tracker' : greeting();
    $('todayTitle').textContent = !has ? "Let's walk." : steps >= GOAL ? '10K done. On fire!' : `${(GOAL - steps).toLocaleString('en-US')} steps to 10K`;
    renderRing(steps, has);
    renderWeek(entries, selected);
    renderChallenge(entries);
    const n = Number(($('streakCurrent')?.textContent || '0').replace(/\D/g, '')) || 0;
    $('streakPillUnit').textContent = n === 1 ? 'day' : 'days';
    $('streakPill')?.classList.toggle('is-cold', n === 0);
  }

  function mount(cb) { if (!getState) getState = cb; }
  window.FitnessToday = Object.freeze({ mount, render });
})();
