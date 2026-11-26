/* Today, Ember layout: the big steps ring, greeting + streak pill title,
 * this week's bars (Sun–Sat, dashed 10K line) and the challenge strip.
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
    $('stepMeta').innerHTML = !has ? 'Log steps to fill the ring'
      : steps >= GOAL ? 'of 10,000 · goal hit <svg class="ico-flame" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path fill="currentColor" d="M12.6 2.2c.4 3-1.2 4.6-2.7 6.2C8.4 10 7 11.6 7 14.3A5 5 0 0 0 12 19.5a5 5 0 0 0 5-5.2c0-2.2-1-3.6-2-4.8.1 1.6-.5 2.7-1.6 3.1.6-3.7-.3-7.4-.8-10.4Z"/><path fill="currentColor" opacity=".55" d="M12 21.8c-3.9 0-7.2-3-7.2-7.4 0-1.6.4-3 1.1-4.2-.1 3.6 1.7 7.4 6.1 7.4s6.2-3.8 6.1-7.4c.7 1.2 1.1 2.6 1.1 4.2 0 4.4-3.3 7.4-7.2 7.4Z"/></svg>' : `${(GOAL - steps).toLocaleString('en-US')} to go`;
    $('heroKm').textContent = has ? (Math.round(steps * STEP_M / 100) / 10).toString() : '—';
  }

  function renderWeek(entries, selected) {
    const chart = $('weekChart');
    if (!chart) return;
    const d = parse(selected), monday = new Date(d); // week starts Sunday (Saudi work week)
    monday.setDate(d.getDate() - d.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const x = new Date(monday); x.setDate(monday.getDate() + i);
      const k = key(x), s = entries.get(k)?.steps;
      days.push({ k, label: 'SMTWTFS'[i], steps: s == null ? null : Number(s), future: k > key(new Date()) });
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
    $('challengeStripText').innerHTML = next != null
      ? `${fmt(p.value)} · ${tiers[p.level][0].toUpperCase() + tiers[p.level].slice(1)} in ${fmt(next - p.value)}`
      : `${fmt(p.value)} · Gold won <svg class="ico-medal" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path fill="currentColor" opacity=".6" d="M7 2h4l2 5-3 2zM17 2h-4l-2 5 3 2z"/><circle cx="12" cy="15" r="6.2" fill="currentColor"/><path fill="#fff" opacity=".85" d="m12 11.4 1.1 2.2 2.4.4-1.7 1.7.4 2.4-2.2-1.1-2.2 1.1.4-2.4-1.7-1.7 2.4-.4z"/></svg>`;
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
    const km = Math.round(steps * STEP_M / 100) / 10;
    const isToday = selected === key(new Date());
    // Celebrate what was walked; the shortfall is said once, inside the ring.
    $('todayTitle').textContent = !has ? (isToday ? "Let's walk." : 'Nothing logged yet.')
      : steps >= GOAL ? '10K done. On fire!'
      : `You walked about ${km} km${isToday ? ' today' : ''}.`;
    renderRing(steps, has);
    renderWeek(entries, selected);
    renderChallenge(entries);
    const n = Number(($('streakCurrent')?.textContent || '0').replace(/\D/g, '')) || 0;
    $('streakPillUnit').textContent = n === 1 ? 'day' : 'days';
    if ($('streakPill')) $('streakPill').hidden = n === 0;   // only shown when there is a streak to celebrate
    // Optional metrics appear only once entered.
    if ($('heroCalBox')) $('heroCalBox').hidden = e?.calories_estimate == null;
    if ($('heroFastBox')) $('heroFastBox').hidden = e?.fasting_hours == null;
    // The title already says the distance below 10K; drop the stats row when it would only repeat it.
    const stats = document.querySelector('.hero-stats');
    if (stats) stats.hidden = has && steps < GOAL && e?.calories_estimate == null && e?.fasting_hours == null;
    const btn = $('quickLogBtn');
    if (btn && !st.readonly && btn.firstChild) btn.firstChild.textContent = has ? 'Update steps' : 'Log steps';
    renderHighlight(entries);
  }

  /* ---------- weekly highlight: the recap's best line, on Today ---------- */
  function renderHighlight(entries) {
    const box = $('weekHighlight'), R = window.FitnessRecap;
    if (!box || !R?.summary) return;
    const w = R.summary(entries, key(new Date()));
    if (!w?.total) { box.hidden = true; return; }
    box.hidden = false;
    const kmW = Math.round(w.km * 10) / 10;
    $('weekHighlightKicker').textContent = (w.label === 'Last week' ? 'LAST WEEK' : 'THIS WEEK SO FAR') + ` · ${w.logged} ${w.logged === 1 ? 'DAY' : 'DAYS'} LOGGED`;
    $('weekHighlightKm').textContent = `You walked ${kmW} km`;
    $('weekHighlightText').textContent = w.cmp?.text || `${w.total.toLocaleString('en-US')} steps in total.`;
    $('weekHighlightArt').innerHTML = R.svg(w.cmp?.place.art || 'shoe', w.cmp?.place.area);
    if (!box.dataset.wired) {
      box.dataset.wired = '1';
      box.addEventListener('click', () => $('recapOpenBtn')?.click());
    }
  }

  /* ---------- quick step entry ---------- */
  let qsDay = 0;
  const qsKey = () => { const d = new Date(); d.setDate(d.getDate() + qsDay); return key(d); };
  const digits = (s) => String(s || '').replace(/[^0-9]/g, '');
  function qsSync() {
    const k = qsKey(), cur = window.FitnessApp?.stepsFor?.(k);
    $('quickSheetTitle').textContent = cur == null ? 'Log steps' : 'Update steps';
    $('quickStepsLabel').textContent = qsDay === 0 ? "Today's total steps" : "Yesterday's total steps";
    const input = $('quickSteps');
    input.value = cur == null ? '' : Number(cur).toLocaleString('en-US');
    document.querySelectorAll('[data-qs-day]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.qsDay) === qsDay)));
    $('quickSheetMore').href = '/log.html?date=' + k;
    $('quickSheetMsg').textContent = ''; $('quickSheetMsg').className = 'qs-msg';
    qsLive();
  }
  function qsLive() {
    const n = Number(digits($('quickSteps').value));
    $('quickStepsLive').textContent = !n ? "Copy the total from your phone's Health app."
      : n >= GOAL ? `About ${Math.round(n * STEP_M / 100) / 10} km. That's a 10K day!`
      : `About ${Math.round(n * STEP_M / 100) / 10} km.`;
  }
  function openQuick() {
    const dlg = $('quickSheet');
    if (!dlg || !window.FitnessApp?.canEdit?.()) return false;
    qsDay = 0; qsSync();
    dlg.showModal();
    requestAnimationFrame(() => { const i = $('quickSteps'); i.focus(); i.select?.(); });
    return true;
  }
  function wireQuick() {
    const dlg = $('quickSheet');
    if (!dlg || dlg.dataset.wired) return;
    dlg.dataset.wired = '1';
    const input = $('quickSteps');
    input.addEventListener('input', () => {
      const raw = digits(input.value).slice(0, 6);
      input.value = raw ? Number(raw).toLocaleString('en-US') : '';
      qsLive();
    });
    document.querySelectorAll('[data-qs-day]').forEach((b) => b.addEventListener('click', () => { qsDay = Number(b.dataset.qsDay); qsSync(); input.focus(); }));
    $('quickSheetClose').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
    $('quickSheetForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const raw = digits(input.value), msg = $('quickSheetMsg'), save = $('quickSheetSave');
      if (!raw) { msg.textContent = 'Type your total steps first.'; msg.className = 'qs-msg is-error'; input.focus(); return; }
      if (save.disabled) return;
      save.disabled = true; save.textContent = 'Saving…';
      try {
        const saved = await window.FitnessApp.saveSteps(qsKey(), Number(raw));
        if (saved) {
          dlg.close();
          const s = Number(saved.steps);
          toast(s >= GOAL ? `Saved. ${s.toLocaleString('en-US')} steps, 10K done!` : `Saved. ${s.toLocaleString('en-US')} steps, about ${Math.round(s * STEP_M / 100) / 10} km.`);
        }
      } catch (err) {
        msg.textContent = (err && err.message) || 'Could not save. Check your connection and try again.';
        msg.className = 'qs-msg is-error';           // the typed number stays in the field
      } finally { save.disabled = false; save.textContent = 'Save steps'; }
    });
  }
  function toast(text) {
    let el = $('todayToast');
    if (!el) { el = document.createElement('div'); el.id = 'todayToast'; el.className = 'today-toast'; el.setAttribute('role', 'status'); document.body.append(el); }
    el.textContent = text;
    el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('is-on'), 2600);
  }

  function mount(cb) { if (!getState) getState = cb; wireQuick(); }
  window.FitnessToday = Object.freeze({ mount, render, openQuick });
})();
