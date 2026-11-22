/* Challenges page: monthly "everyone wins" challenges plus personal badges.
 *
 * Personal progress is computed here from the user's own saved entries.
 * Joining writes one row to challenge_participants (RLS: own rows only).
 * The team bar comes from challenge_team_summary(month): participant count
 * and the summed steps of everyone who joined (aggregate only).
 */
(() => {
  'use strict';
  const STEP_M = 0.75, GOAL = 10000;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const nice = (n) => n >= 10 ? Math.round(n).toLocaleString('en-US') : (Math.round(n * 10) / 10).toString();

  // id = month. metric: km | days10k | weekends | kingdoms | laps.
  // teamKm is the shared goal, always counted in kilometres of steps.
  const CHALLENGES = [
    { id: '2026-11', title: 'Road to Al-Kharj', art: 'sign', place: 'Al-Kharj', metric: 'km', levels: [30, 60, 85], unit: 'km',
      blurb: 'Walk the 85 km from Riyadh to Al-Kharj this month.', teamKm: 850, team: '10 trips to Al-Kharj together' },
    { id: '2026-12', title: 'Metro Month', art: 'metro', metric: 'km', levels: [38, 88, 176], unit: 'km',
      blurb: 'Walk the Blue Line, half the network, or all 176 km of the Riyadh Metro.', teamKm: 1760, team: 'The whole Metro network 10 times' },
    { id: '2027-01', title: 'Tuwaiq Trek', art: 'cliff', metric: 'days10k', levels: [10, 15, 20], unit: 'days at 10K',
      blurb: 'Hit 10,000 steps on 10, 15 or 20 days this month.', teamKm: 800, team: 'The whole Tuwaiq escarpment together' },
    { id: '2027-02', title: 'Diriyah Weekends', art: 'diriyah', metric: 'weekends', levels: [2, 3, 4], unit: 'weekends',
      blurb: '10K on both Friday and Saturday, for 2, 3 or 4 weekends.', teamKm: 2000, team: '100 trips to Diriyah together' },
    { id: '2027-03', title: 'Kingdom Climb', art: 'kingdom', metric: 'kingdoms', levels: [100, 200, 300], unit: 'Kingdom Centres',
      blurb: 'Walk 100, 200 or 300 Kingdom Centres laid end to end.', teamKm: 3023, team: '10,000 Kingdom Centres together' },
    { id: '2027-04', title: 'Park Laps', art: 'park', metric: 'laps', levels: [5, 10, 15], unit: 'laps',
      blurb: 'Walk 5, 10 or 15 laps of the King Salman Park loop.', teamKm: 3600, team: '500 laps of the park together' }
  ];
  const TIERS = ['bronze', 'silver', 'gold'];
  const monthName = (id) => parse(id + '-01').toLocaleDateString('en-GB', { month: 'long' });
  const yearOf = (id) => Number(id.slice(0, 4));
  const medalOf = (ch) => ({ ...ch, month: monthName(ch.id), year: yearOf(ch.id) });

  function progress(ch, entries) {
    const days = [];
    for (const e of entries.values()) if (e?.entry_date?.startsWith(ch.id)) days.push(e);
    const steps = days.reduce((s, e) => s + (Number(e.steps) || 0), 0), km = steps * STEP_M / 1000;
    let value = km;
    if (ch.metric === 'days10k') value = days.filter((e) => e.steps >= GOAL).length;
    if (ch.metric === 'kingdoms') value = km / 0.3023;
    if (ch.metric === 'laps') value = km / 7.2;
    if (ch.metric === 'weekends') {
      const hit = new Set(days.filter((e) => e.steps >= GOAL).map((e) => e.entry_date));
      value = 0;
      for (const k of hit) {
        const d = parse(k);
        if (d.getDay() !== 5) continue;
        const sat = new Date(d); sat.setDate(d.getDate() + 1);
        if (hit.has(key(sat))) value++;
      }
    }
    const level = ch.levels.filter((n) => value >= n).length; // 0..3
    return { value, level, km };
  }
  const fmt = (ch, v) => ch.metric === 'km' ? nice(v) + ' km' : nice(Math.floor(v)) + ' ' + ch.unit;

  /* ---------- state ---------- */
  let ctx = null, joined = new Set(), team = new Map(), tab = 'challenges', seen = null;

  async function loadJoins() {
    const { db, userId } = ctx();
    if (!db || !userId) return;
    const { data, error } = await db.from('challenge_participants').select('challenge_id');
    if (!error) joined = new Set((data || []).map((r) => r.challenge_id));
  }
  async function loadTeam(id) {
    const { db } = ctx();
    const { data, error } = await db.rpc('challenge_team_summary', { p_challenge_id: id });
    if (!error && data?.[0]) team.set(id, data[0]);
  }
  async function setJoined(id, on) {
    const { db } = ctx();
    const q = on ? db.from('challenge_participants').insert({ challenge_id: id })
      : db.from('challenge_participants').delete().eq('challenge_id', id);
    const { error } = await q;
    if (error) throw error;
    on ? joined.add(id) : joined.delete(id);
    await loadTeam(id);
    render();
  }

  /* ---------- rendering ---------- */
  const art = (name, place, size) => (window.FitnessRecap?.svg?.(name, place) || '').replace('<svg ', `<svg width="${size}" height="${size}" `);
  const medal = (ch, tier, size, locked) => window.FitnessChallengeMedals?.svg?.(medalOf(ch), tier, { size, locked }) || '';

  function challengeCard(ch, entries, now, viewing = false) {
    const monthKey = key(now).slice(0, 7);
    const live = ch.id === monthKey, past = ch.id < monthKey, isIn = viewing || joined.has(ch.id);
    const p = progress(ch, entries);
    const end = new Date(yearOf(ch.id), Number(ch.id.slice(5)), 0);
    const daysLeft = Math.max(0, Math.ceil((end - parse(key(now))) / 864e5) + 1);
    const t = team.get(ch.id);
    const teamKm = t?.total_steps != null ? Number(t.total_steps) * STEP_M / 1000 : null;
    const nextLevel = ch.levels[p.level];
    const levels = TIERS.map((tier, i) => `<div class="ch-level">
        ${medal(ch, tier, 74, !(isIn && p.level > i))}
        <strong>${tier[0].toUpperCase() + tier.slice(1)}</strong>
        <span>${fmt(ch, ch.levels[i])}</span></div>`).join('');
    const status = live ? `<span class="ch-live">LIVE · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left</span>`
      : past ? '<span class="ch-past">Finished</span>' : `<span class="ch-soon">Starts 1 ${monthName(ch.id)}</span>`;
    const you = viewing && !live && !past ? '' : !isIn ? (past ? '' : `<p class="ch-cta-note">${live ? 'Join now. Your steps from the whole month count, even the ones before you joined.' : 'Join early and it starts counting on day one.'}</p>`)
      : (live || past) ? `<p class="ch-you"><strong>${fmt(ch, p.value)}</strong> ${p.level ? `· ${TIERS[p.level - 1][0].toUpperCase() + TIERS[p.level - 1].slice(1)} won! 🎉` : ''}
          ${nextLevel != null && live ? `<span>${fmt(ch, nextLevel - p.value)} to ${TIERS[p.level]}</span>` : ''}</p>`
      : '<p class="ch-you">You are in. See you on day one! 🔥</p>';
    const teamLine = !t || !t.participants ? '' : `<div class="ch-team"><div class="ch-team-head"><strong>Walking together</strong><span>${t.participants} ${t.participants === 1 ? 'walker' : 'walking'}</span></div>
          <div class="ch-track ch-track-team"><span style="width:${Math.min(100, Math.max(2, (teamKm / ch.teamKm) * 100)).toFixed(1)}%"></span></div>
          <p>${nice(teamKm)} of ${ch.teamKm.toLocaleString('en-US')} km · ${esc(ch.team)}</p></div>`;
    const btn = past || viewing ? '' : `<button type="button" class="button ${isIn ? 'subtle' : 'primary'}" data-join="${ch.id}" data-on="${isIn ? '0' : '1'}">${isIn ? 'Leave' : 'Join challenge'}</button>`;
    return `<article class="glass-card ch-card${live ? ' is-live' : ''}">
      <div class="ch-head">
        <div class="ch-art">${art(ch.art, ch.place, 88)}</div>
        <div class="ch-head-copy">${status}<h2>${esc(ch.title)}</h2><p>${esc(ch.blurb)}</p></div>
      </div>
      <div class="ch-levels">${levels}</div>
      ${you}${teamLine}
      <div class="ch-actions">${btn}</div>
    </article>`;
  }

  function badgeGrid(entries) {
    const list = window.FitnessBadges?.evaluate?.(entries) || [];
    const earned = list.filter((b) => b.earnedOn), locked = list.filter((b) => !b.earnedOn);
    const near = [...locked].sort((a, b) => b.progress - a.progress).slice(0, 3);
    const date = (k) => parse(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const left = (b) => b.group === 'journey' ? `${nice(b.need - b.have)} km to go`
      : b.group === 'day' ? `Best so far ${Math.round(b.have).toLocaleString('en-US')}`
      : b.group === 'streak' ? `${b.need - b.have} more days in a row` : `${Math.round(b.progress * 100)}%`;
    return `<p class="bd-count">${earned.length} of ${list.length} earned</p>
      ${near.length ? `<h2 class="bd-sub">Almost there</h2><div class="bd-near">${near.map((b) => `
        <div class="bd-near-row">${window.FitnessBadges.svg(b, { size: 56, locked: true })}
          <div><div class="bd-near-top"><strong>${esc(b.title)}</strong><span>${esc(left(b))}</span></div>
          <div class="ch-track"><span style="width:${Math.max(3, b.progress * 100).toFixed(0)}%"></span></div></div></div>`).join('')}</div>` : ''}
      <h2 class="bd-sub">Earned</h2>
      ${earned.length ? `<div class="bd-grid">${earned.map((b) => `<button type="button" class="bd-item" data-badge-open="${b.id}">
          ${window.FitnessBadges.svg(b, { size: 96 })}<strong>${esc(b.title)}</strong><span>${date(b.earnedOn)}</span></button>`).join('')}</div>`
        : '<p class="muted">Save your first check-in to earn your first badge.</p>'}
      <h2 class="bd-sub">Locked</h2>
      <div class="bd-grid">${locked.map((b) => `<div class="bd-item is-locked">${window.FitnessBadges.svg(b, { size: 96, locked: true })}<strong>${esc(b.title)}</strong><span>${esc(b.hint)}</span></div>`).join('')}</div>`;
  }

  function render() {
    const root = $('challengesRoot');
    if (!root || !ctx) return;
    const { userId, readonly, entries } = ctx();
    if (!userId) return;
    const now = new Date(), monthKey = key(now).slice(0, 7);
    document.querySelectorAll('[data-ch-tab]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.chTab === tab)));
    if (tab === 'badges') { root.innerHTML = badgeGrid(entries); if (!readonly) celebrate(entries); return; }
    const current = CHALLENGES.filter((c) => c.id >= monthKey).slice(0, 3);
    const past = CHALLENGES.filter((c) => c.id < monthKey && (readonly || joined.has(c.id)));
    root.innerHTML = current.map((c) => challengeCard(c, entries, now, readonly)).join('') +
      (past.length ? `<h2 class="bd-sub">Your medals</h2><div class="ch-medals">${past.map((c) => {
        const p = progress(c, entries);
        return p.level ? `<div class="ch-medal">${medal(c, TIERS[p.level - 1], 84)}<strong>${esc(c.title)}</strong><span>${monthName(c.id)} · ${TIERS[p.level - 1]}</span></div>` : '';
      }).join('')}</div>` : '');
    if (!readonly) celebrate(entries);
  }

  /* ---------- celebration for newly earned badges ---------- */
  function celebrate(entries) {
    if (!entries?.size || ctx?.()?.readonly) return; // wait for real data
    const list = window.FitnessBadges?.evaluate?.(entries) || [];
    const ids = list.filter((b) => b.earnedOn).map((b) => b.id);
    const store = 'fitness-badges-seen-' + (ctx()?.userId || '');
    if (seen === null) {
      try { seen = JSON.parse(localStorage.getItem(store) || 'null'); } catch (_) { seen = null; }
      // First visit: past achievements are awarded all at once. One popup
      // shows the best badge already earned and how many there are.
      if (!Array.isArray(seen)) {
        seen = ids; save(store);
        const order = ['bronze', 'silver', 'gold', 'ember', 'legend'];
        const best = list.filter((b) => b.earnedOn).sort((x, y) => order.indexOf(y.tier) - order.indexOf(x.tier))[0];
        if (best && !$('badgeDialog')?.open) showBadge(best, list, ids.length);
        return;
      }
    }
    const fresh = list.find((b) => b.earnedOn && !seen.includes(b.id));
    if (!fresh || $('badgeDialog')?.open) return;
    seen.push(fresh.id); save(store);
    showBadge(fresh, list);
  }
  function save(store) { try { localStorage.setItem(store, JSON.stringify(seen)); } catch (_) {} }
  function showBadge(b, list, already = 0) {
    const next = list.filter((x) => x.group === b.group && !x.earnedOn).sort((x, y) => x.need - y.need)[0];
    $('badgeArt').innerHTML = window.FitnessBadges.svg(b, { size: 220 });
    $('badgeTitle').textContent = b.title + '!';
    $('badgeText').textContent = b.group === 'journey'
      ? `You have walked ${b.need} km since you started. ${b.hint.split(', ')[1] || ''}, on foot!`
      : b.hint.replace(/^Walk/, 'You walked').replace(/^10K steps/, 'You hit 10K steps').replace(/^Save/, 'You saved') + '. Amazing!';
    $('badgeNext').textContent = next ? `Next up: ${next.title}` : 'You have earned every badge in this set. Legend!';
    if (already > 1) {
      $('badgeText').textContent = `Your past steps already earned you ${already} badges! This is your best one. They are all waiting in My badges.`;
    }
    $('badgeDialog').dataset.badge = b.id;
    $('badgeDialog').showModal();
  }

  /* ---------- share a badge ---------- */
  async function shareBadge() {
    const b = window.FitnessBadges.BADGES.find((x) => x.id === $('badgeDialog').dataset.badge);
    if (!b) return;
    const W = 1080, H = 1920, S = 2, c = document.createElement('canvas');
    c.width = W * S; c.height = H * S;
    const g = c.getContext('2d', { alpha: false });
    g.scale(S, S);
    const bg = g.createRadialGradient(540, 760, 60, 540, 760, 1100);
    bg.addColorStop(0, '#2A4F86'); bg.addColorStop(1, '#071330');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.FitnessBadges.svg(b, { size: 720 }));
    await img.decode();
    g.drawImage(img, 180, 380, 720, 780);
    const font = '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';
    g.textAlign = 'center';
    g.fillStyle = '#FFB27A'; g.font = `800 40px ${font}`; g.fillText('NEW BADGE UNLOCKED', W / 2, 260);
    g.fillStyle = '#F4F7FF'; g.font = `800 96px ${font}`; g.fillText(b.title, W / 2, 1300);
    g.fillStyle = '#C9D6EA'; g.font = `500 44px ${font}`; g.fillText(b.hint, W / 2, 1390, 960);
    g.fillStyle = '#A9BCD8'; g.font = `500 30px ${font}`; g.fillText('fitness.oalfawzan.sa', W / 2, H - 80);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    const file = new File([blob], 'fitness-badge-' + b.id + '.png', { type: 'image/png' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try { await navigator.share({ files: [file] }); } catch (e) { if (e.name !== 'AbortError') throw e; }
      return;
    }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = file.name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function mount(getContext) {
    if (ctx) return;
    ctx = getContext;
    document.addEventListener('click', async (e) => {
      const join = e.target.closest('[data-join]');
      if (join) {
        join.disabled = true;
        try { await setJoined(join.dataset.join, join.dataset.on === '1'); }
        catch (_) { join.disabled = false; $('challengesStatus').textContent = 'Could not update the challenge. Please try again.'; }
        return;
      }
      const tabBtn = e.target.closest('[data-ch-tab]');
      if (tabBtn) { tab = tabBtn.dataset.chTab; render(); return; }
      const badge = e.target.closest('[data-badge-open]');
      if (badge) {
        const list = window.FitnessBadges.evaluate(ctx().entries);
        showBadge(list.find((b) => b.id === badge.dataset.badgeOpen), list);
      }
    });
    $('badgeClose')?.addEventListener('click', () => $('badgeDialog').close());
    $('badgeKeep')?.addEventListener('click', () => $('badgeDialog').close());
    $('badgeShare')?.addEventListener('click', () => shareBadge().catch(() => {}));
  }
  async function refresh() {
    if (!ctx?.()?.userId) return;
    if (document.getElementById('challengesRoot')) {
      await loadJoins();
      const monthKey = key(new Date()).slice(0, 7);
      await Promise.all(CHALLENGES.filter((c) => c.id >= monthKey).slice(0, 3).map((c) => loadTeam(c.id)));
    }
    render();
  }
  window.FitnessChallenges = Object.freeze({ mount, refresh, render, CHALLENGES, progress, celebrate: () => ctx && celebrate(ctx().entries) });
})();
