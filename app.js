/* Fitness Tracker - static app + Supabase Auth + per-user RLS
 * No user meals or measurements are written to GitHub or localStorage.
 */
(() => {
  'use strict';
  const START_DATE = '2026-11-15';
  const CHALLENGE_DAYS = 30;
  const STEP_GOAL = 10000;
  const $ = (id) => document.getElementById(id);
  const config = window.FITNESS_CONFIG || {};
  let db, user = null, authMode = 'signin', recovering = false, entries = new Map(), flex = new Map();
  let lastObservedDate = localDateKey(new Date());
  let rolloverTimer = null;
  let selectedDate = localDateKey(new Date());
  let displayedMonth = firstOfMonth(dateFromKey(selectedDate));
  let loadingFor = null;
  let currentTrackerId = 'mine';
  let ownedShares = [];
  let incomingShares = [];
  let lastInvitedEmail = '';
  const viewingShared = () => currentTrackerId !== 'mine';

  function localDateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function dateFromKey(key) {
    const parts = key.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12);
  }
  function addDays(key, n) {
    const d = dateFromKey(key);
    d.setDate(d.getDate() + n);
    return localDateKey(d);
  }
  function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1, 12); }
  function mondayFreeWeekStart(key) {
    // Saudi-style week for this tracker: Sunday through Saturday.
    const d = dateFromKey(key);
    d.setDate(d.getDate() - d.getDay());
    return localDateKey(d);
  }
  function isFriday(key) { return dateFromKey(key).getDay() === 5; }
  function isFlexDay(key) { return isFriday(key) || flex.get(mondayFreeWeekStart(key)) === key; }
  function fmtDay(key, opts = { month: 'short', day: 'numeric' }) {
    return dateFromKey(key).toLocaleDateString('en-US', opts);
  }
  function shortNum(n) { return Number(n).toLocaleString('en-US'); }
  function setText(id, value) { $(id).textContent = value; }
  function showMessage(id, message, kind = '') {
    const el = $(id); el.textContent = message; el.className = id === 'globalAlert' ? 'global-alert' : 'inline-message';
    if (kind) el.classList.add(kind);
    if (id === 'globalAlert') el.hidden = !message;
  }
  function errorText(error) { return (error && error.message) ? error.message : 'Something went wrong. Please try again.'; }
  function numericValue(id) { const v = $(id).value.trim(); return v === '' ? null : Number(v); }
  function validRange(n, min, max) { return n === null || (Number.isFinite(n) && n >= min && n <= max); }
  async function callWithButton(button, task) {
    button.disabled = true;
    try { await task(); } finally { button.disabled = false; }
  }

  function setTheme(theme, persist = true) {
    const mode = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = mode;
    const toggle = $('themeToggle');
    toggle.setAttribute('aria-label', mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
    toggle.setAttribute('title', mode === 'light' ? 'Dark mode' : 'Light mode');
    toggle.setAttribute('aria-pressed', String(mode === 'light'));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'light' ? '#e7eff8' : '#16233d');
    if (persist) {
      try { localStorage.setItem('fitness-theme', mode); } catch (_) {}
    }
  }
  setTheme(document.documentElement.dataset.theme, false);
  $('themeToggle').addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    $('themeToggle').blur();
  });

  function authUI() {
    $('authTitle').textContent = authMode === 'signup' ? 'Create your account' : 'Sign in to your tracker';
    $('authSubmit').textContent = authMode === 'signup' ? 'Create account' : 'Sign in';
    $('toggleSignup').textContent = authMode === 'signup' ? 'Already registered? Sign in' : 'Create an account';
    $('authPassword').autocomplete = authMode === 'signup' ? 'new-password' : 'current-password';
    showMessage('authMessage', '');
  }
  $('toggleSignup').addEventListener('click', () => {
    authMode = authMode === 'signin' ? 'signup' : 'signin';
    authUI();
  });
  $('authForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!db) return;
    callWithButton($('authSubmit'), async () => {
      const email = $('authEmail').value.trim();
      const password = $('authPassword').value;
      showMessage('authMessage', '');
      try {
        if (authMode === 'signup') {
          const { data, error } = await db.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + '/' } });
          if (error) throw error;
          if (!data.session) {
            authMode = 'signin'; authUI();
            showMessage('authMessage', 'Account request received. Check your email to confirm your account before signing in.', 'success');
          } else {
            showMessage('authMessage', 'Account created. Loading your dashboard...', 'success');
            await showSignedIn(data.session);
          }
        } else {
          const { data, error } = await db.auth.signInWithPassword({ email, password });
          if (error) throw error;
          await showSignedIn(data.session);
        }
      } catch (e) { showMessage('authMessage', errorText(e), 'error'); }
    });
  });
  $('forgotPassword').addEventListener('click', async () => {
    const email = $('authEmail').value.trim();
    if (!email) { showMessage('authMessage', 'Enter your email address above, then select Forgot password.', 'error'); return; }
    try {
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/' });
      if (error) throw error;
      showMessage('authMessage', 'If this email belongs to an account, a password-reset link has been sent.', 'success');
    } catch (e) { showMessage('authMessage', errorText(e), 'error'); }
  });
  $('resetForm').addEventListener('submit', (event) => {
    event.preventDefault();
    callWithButton($('resetForm').querySelector('button'), async () => {
      try {
        const { error } = await db.auth.updateUser({ password: $('newPassword').value });
        if (error) throw error;
        recovering = false;
        $('resetView').hidden = true;
        $('authForm').hidden = false;
        $('authTitle').textContent = 'Password updated';
        showMessage('authMessage', 'Your password was updated. Your dashboard is ready.', 'success');
        const { data } = await db.auth.getSession();
        if (data.session) await showSignedIn(data.session);
      } catch (e) { showMessage('authMessage', errorText(e), 'error'); }
    });
  });
  $('logoutBtn').addEventListener('click', async () => {
    if (!db) return;
    const { error } = await db.auth.signOut();
    if (error) return showMessage('globalAlert', errorText(error), 'error');
    user = null; entries.clear(); flex.clear();
    currentTrackerId='mine'; ownedShares=[]; incomingShares=[]; lastInvitedEmail='';
    $('appView').hidden = true; $('authView').hidden = false; $('logoutBtn').hidden = true;
    $('authPassword').value = '';
    showMessage('authMessage', 'Signed out successfully.', 'success');
  });

  async function showSignedIn(session) {
    if (!session || !session.user || recovering) return;
    if (user && user.id === session.user.id && !$('appView').hidden) return;
    user = session.user;
    $('authView').hidden = true; $('appView').hidden = false; $('logoutBtn').hidden = false;
    showMessage('globalAlert', '');
    await loadShares();
    await loadData();
  }

  async function loadData() {
    if (!user) return;
    const uid = user.id;
    if (loadingFor === uid) return;
    loadingFor = uid;
    try {
      const [dayResult, flexResult] = await Promise.all([
        db.from('daily_entries')
          .select('id,entry_date,steps,calories_estimate,meals,fasting_hours,one_meal,coffee_cups,waist_cm,notes')
          .eq('user_id', uid).gte('entry_date', START_DATE).order('entry_date', { ascending: false }).limit(1000),
        db.from('weekly_flex')
          .select('week_start,flex_date')
          .eq('user_id', uid).order('week_start', { ascending: false }).limit(250)
      ]);
      if (dayResult.error) throw dayResult.error;
      if (flexResult.error) throw flexResult.error;
      if (!user || user.id !== uid || viewingShared()) return;
      entries = new Map((dayResult.data || []).map((row) => [row.entry_date, row]));
      flex = new Map((flexResult.data || []).map((row) => [row.week_start, row.flex_date]));
      renderAll();
    } catch (e) {
      showMessage('globalAlert', 'Could not load your private data: ' + errorText(e), 'error');
    } finally { loadingFor = null; }
  }


  async function loadShares() {
    if (!user || !db) return;
    const uid = user.id;
    try {
      // Claim pending invitations only for the currently authenticated, verified email.
      const claimed = await db.rpc('claim_fitness_invitations');
      if (claimed.error) throw claimed.error;
      const [owned, incoming] = await Promise.all([
        db.from('progress_shares').select('id,viewer_email,viewer_id,created_at').eq('owner_id',uid).order('created_at',{ascending:false}),
        db.from('progress_shares').select('id,owner_id,display_name').eq('viewer_id',uid).order('created_at',{ascending:false})
      ]);
      if (owned.error) throw owned.error;
      if (incoming.error) throw incoming.error;
      if (!user || user.id !== uid) return;
      ownedShares = owned.data || [];
      incomingShares = incoming.data || [];
      if (viewingShared() && !incomingShares.some((share)=>share.id === currentTrackerId)) {
        currentTrackerId = 'mine';
      }
      renderShareControls();
    } catch (e) {
      showMessage('sharingMessage', 'Sharing could not be loaded: ' + errorText(e), 'error');
    }
  }
  function renderShareControls() {
    const select = $('trackerSelect');
    const previous = currentTrackerId;
    select.replaceChildren();
    const mine = document.createElement('option');
    mine.value = 'mine';
    mine.textContent = 'My progress';
    select.append(mine);
    for (const share of incomingShares) {
      const option = document.createElement('option');
      option.value = share.id;
      option.textContent = share.display_name || 'Shared fitness progress';
      select.append(option);
    }
    if (previous !== 'mine' && !incomingShares.some((share)=>share.id===previous)) {
      currentTrackerId = 'mine';
    }
    select.value = currentTrackerId;
    $('trackerSwitcher').hidden = incomingShares.length === 0;
    const rows = $('viewerList');
    rows.replaceChildren();
    $('viewerCount').textContent = String(ownedShares.length);
    if (ownedShares.length === 0) {
      const message = document.createElement('p');
      message.className = 'muted small';
      message.textContent = 'No one has access yet.';
      rows.append(message);
    }
    for (const share of ownedShares) {
      const row = document.createElement('div');
      row.className = 'viewer-row';
      const info = document.createElement('div');
      info.className = 'viewer-info';
      const email = document.createElement('strong');
      email.textContent = share.viewer_email;
      const state = document.createElement('small');
      state.textContent = share.viewer_id ? 'Access active' : 'Pending: the viewer must sign in with this verified email';
      info.append(email,state);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button subtle';
      remove.textContent = 'Remove';
      remove.dataset.removeShareId = share.id;
      remove.setAttribute('aria-label','Remove access for '+share.viewer_email);
      row.append(info,remove);
      rows.append(row);
    }
    $('copyInviteBtn').hidden = !lastInvitedEmail;
  }
  function renderSharingState() {
    const readonly = viewingShared();
    $('viewOnlyBadge').hidden = !readonly;
    $('entryForm').hidden = readonly;
    $('sharedDaySummary').hidden = !readonly;
    $('flexEditor').hidden = readonly;
    $('flexViewerNote').hidden = !readonly;
    $('sharingPanel').hidden = readonly;
    $('exportBtn').hidden = readonly;
  }
  async function openTracker(id) {
    if (!user || !db || id === currentTrackerId) return;
    if (id !== 'mine' && !incomingShares.some((share)=>share.id===id)) return;
    currentTrackerId = id;
    entries.clear();
    flex.clear();
    renderShareControls();
    renderAll();
    if (id === 'mine') {
      await loadData();
      return;
    }
    const share = incomingShares.find((item)=>item.id===id);
    if (!share) return;
    const selectedId = id;
    showMessage('globalAlert', '');
    const [days,weeks] = await Promise.all([
      db.rpc('shared_fitness_entries',{p_owner_id:share.owner_id}),
      db.rpc('shared_fitness_weeks',{p_owner_id:share.owner_id})
    ]);
    if (currentTrackerId !== selectedId) return;
    if (days.error || weeks.error) {
      showMessage('globalAlert', 'Could not read shared progress: '+errorText(days.error||weeks.error),'error');
      renderAll();
      return;
    }
    entries = new Map((days.data || []).map((day)=>[day.entry_date,day]));
    flex = new Map((weeks.data || []).map((week)=>[week.week_start,week.flex_date]));
    renderAll();
  }
  $('trackerSelect').addEventListener('change',(event)=>{
    openTracker(event.target.value).catch((e)=>showMessage('globalAlert',errorText(e),'error'));
  });
  $('shareForm').addEventListener('submit',(event)=>{
    event.preventDefault();
    if (!user || viewingShared() || !db) return;
    callWithButton($('inviteBtn'),async()=>{
      const email=$('viewerEmail').value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showMessage('sharingMessage','Enter a valid email address.','error'); return;
      }
      if (email === String(user.email||'').toLowerCase()) {
        showMessage('sharingMessage','You already have access to your own progress.','error'); return;
      }
      if (ownedShares.some((share)=>share.viewer_email===email)) {
        showMessage('sharingMessage','This person is already on your list.','error'); return;
      }
      try {
        const { error } = await db.from('progress_shares').insert({
          owner_id: user.id,
          viewer_email: email,
          display_name: String(user.email||'Shared fitness progress').slice(0,80)
        });
        if (error) throw error;
        lastInvitedEmail = email;
        $('viewerEmail').value = '';
        await loadShares();
        showMessage('sharingMessage','Access is ready. Share the invitation message with this person. They must sign in using the verified email you entered.','success');
      } catch(e) { showMessage('sharingMessage',errorText(e),'error'); }
    });
  });
  $('viewerList').addEventListener('click',(event)=>{
    const button=event.target.closest('[data-remove-share-id]');
    if (!button || !user || viewingShared()) return;
    const share=ownedShares.find((item)=>item.id===button.dataset.removeShareId);
    if (!share || !window.confirm('Remove '+share.viewer_email+' from your viewers?')) return;
    callWithButton(button,async()=>{
      const {error}=await db.from('progress_shares').delete().eq('id',share.id).eq('owner_id',user.id);
      if(error) return showMessage('sharingMessage',errorText(error),'error');
      await loadShares();
      showMessage('sharingMessage','Access removed. This person can no longer load your shared progress.','success');
    });
  });
  $('copyInviteBtn').addEventListener('click', async ()=>{
    if (!lastInvitedEmail) return;
    const message = 'I have shared my fitness progress with you (view-only). Open https://fitness.oalfawzan.sa/ and sign in or create an account using '+lastInvitedEmail+'. Verify your email if prompted, then select my tracker from the dashboard.';
    try {
      await navigator.clipboard.writeText(message);
      showMessage('sharingMessage','Invitation copied. Send it to your viewer.','success');
    } catch(e) {
      showMessage('sharingMessage','Could not copy automatically. Your invitee should open https://fitness.oalfawzan.sa/ and sign in using '+lastInvitedEmail+'.','error');
    }
  });

  function setDate(key, scroll = false) {
    if (key < START_DATE) return;
    selectedDate = key;
    $('entryDate').value = key;
    displayedMonth = firstOfMonth(dateFromKey(key));
    showMessage('entryMessage', '');
    showMessage('flexMessage', '');
    renderAll();
    if (scroll) $('logTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('entryDate').min = START_DATE;
  $('entryDate').value = selectedDate < START_DATE ? START_DATE : selectedDate;
  if (selectedDate < START_DATE) selectedDate = START_DATE;
  $('entryDate').addEventListener('change', (e) => setDate(e.target.value));

  function renderAll() {
    if (!user) return;
    renderSharingState();
    renderHero();
    renderDay();
    renderStats();
    renderFlex();
    renderCalendar();
    renderSummary();
  }
  function refreshForNewDay() {
    const currentDate = localDateKey(new Date());
    if (currentDate === lastObservedDate) return;
    const previousDate = lastObservedDate;
    lastObservedDate = currentDate;
    // Follow the new day only when the user was viewing the previous today.
    // Keep a manually selected historical date untouched.
    if (selectedDate === previousDate) {
      selectedDate = currentDate < START_DATE ? START_DATE : currentDate;
      displayedMonth = firstOfMonth(dateFromKey(selectedDate));
    }
    renderAll();
  }
  function scheduleDailyRollover() {
    if (rolloverTimer !== null) clearTimeout(rolloverTimer);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    rolloverTimer = setTimeout(() => {
      refreshForNewDay();
      scheduleDailyRollover();
    }, Math.max(1000, midnight.getTime() - now.getTime()));
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      refreshForNewDay();
      scheduleDailyRollover();
    }
  });
  window.addEventListener('pageshow', () => {
    refreshForNewDay();
    scheduleDailyRollover();
  });
  scheduleDailyRollover();

  function renderHero() {
    const today = localDateKey(new Date());
    const elapsed = Math.floor((dateFromKey(today) - dateFromKey(START_DATE)) / 86400000);
    const day = Math.max(0, elapsed + 1);
    setText('challengeDay', day > CHALLENGE_DAYS ? 'Keep it going!' : 'Day ' + day + ' / ' + CHALLENGE_DAYS);
    $('challengeProgress').style.width = Math.min(100, Math.max(0, day / CHALLENGE_DAYS * 100)) + '%';
    setText('challengeDates', 'Nov 15 – Dec 14, 2026 · Continue afterward');
    const currentShare = incomingShares.find((share)=>share.id===currentTrackerId);
    setText('heroSubtitle', viewingShared()
      ? 'Viewing '+(currentShare?.display_name || 'shared fitness')+' progress. You have read-only access.'
      : 'Today is ' + fmtDay(today, { weekday: 'long', month: 'long', day: 'numeric' }) + '. Build a routine you can keep.');
  }
  function renderDay() {
    const entry = entries.get(selectedDate);
    $('entryDate').value = selectedDate;
    $('steps').value = entry?.steps ?? '';
    $('calories').value = entry?.calories_estimate ?? '';
    $('meals').value = entry?.meals ?? '';
    $('fasting').value = entry?.fasting_hours ?? '';
    $('coffee').value = entry?.coffee_cups ?? '';
    $('oneMeal').checked = entry?.one_meal ?? false;
    $('waist').value = entry?.waist_cm ?? '';
    $('notes').value = entry?.notes ?? '';
    $('deleteEntryBtn').hidden = !entry || viewingShared();
    if (viewingShared()) {
      const box=$('sharedDayMetrics');
      box.replaceChildren();
      $('sharedDayNote').textContent = entry
        ? 'Progress recorded for '+fmtDay(selectedDate,{month:'long',day:'numeric',year:'numeric'})+'.'
        : 'No progress has been recorded for this date.';
      if (entry) {
        const metrics=[
          ['Steps',entry.steps == null ? 'Not logged' : shortNum(entry.steps)],
          ['Estimated calories',entry.calories_estimate == null ? 'Not logged' : shortNum(entry.calories_estimate)],
          ['Fasting',entry.fasting_hours == null ? 'Not logged' : entry.fasting_hours+' hours'],
          ['Black coffee',entry.coffee_cups == null ? 'Not logged' : entry.coffee_cups+' cups'],
          ['One main meal',entry.one_meal ? 'Yes' : 'No']
        ];
        for (const [label,value] of metrics) {
          const item=document.createElement('div');
          item.className='shared-metric';
          const caption=document.createElement('small'); caption.textContent=label;
          const detail=document.createElement('strong'); detail.textContent=value;
          item.append(caption,detail);box.append(item);
        }
      }
    }
    const flexible = isFlexDay(selectedDate);
    $('dayKind').textContent = flexible ? 'Flexible day' : 'Standard day';
    $('dayKind').classList.toggle('flexible', flexible);
    setText('dayHint', flexible
      ? (isFriday(selectedDate) ? 'Friday · flexible meals' : 'Your selected second flexible day')
      : 'One main meal is your preference; sufficient nutrition comes first');
    setText('logTitle', viewingShared()
      ? 'Shared day: '+fmtDay(selectedDate,{month:'short',day:'numeric'})
      : (selectedDate === localDateKey(new Date()) ? 'Log your day' : 'Log ' + fmtDay(selectedDate, { month: 'short', day: 'numeric' })));
  }
  function renderStats() {
    const entry = entries.get(selectedDate);
    setText('stepValue', entry?.steps == null ? '—' : shortNum(entry.steps));
    $('stepProgress').style.width = Math.min(100, Math.max(0, (entry?.steps || 0) / STEP_GOAL * 100)) + '%';
    setText('stepMeta', entry?.steps == null ? 'Goal: 10,000 steps' : Math.max(0, STEP_GOAL - entry.steps).toLocaleString('en-US') + ' to goal · ' + fmtDay(selectedDate));
    setText('calValue', entry?.calories_estimate == null ? '—' : shortNum(entry.calories_estimate));
    setText('calMeta', isFlexDay(selectedDate) ? 'Flexible day · estimates only' : 'Standard day · estimates only');
    setText('fastValue', entry?.fasting_hours == null ? '—' : entry.fasting_hours + 'h');
    $('daysValue').innerHTML = String(entries.size) + '<span class="stat-unit"> days</span>';
  }
  function renderFlex() {
    const week = mondayFreeWeekStart(selectedDate);
    const end = addDays(week, 6);
    setText('weekRange', fmtDay(week) + ' – ' + fmtDay(end));
    const value = flex.get(week) || '';
    const select = $('flexSelect');
    select.replaceChildren();
    const defaultOption = document.createElement('option');
    defaultOption.value = ''; defaultOption.textContent = 'Not selected yet';
    select.append(defaultOption);
    for (let i = 0; i < 7; i++) {
      const key = addDays(week, i);
      if (isFriday(key) || key < START_DATE) continue;
      const option = document.createElement('option');
      option.value = key;
      option.textContent = fmtDay(key, { weekday: 'long', month: 'short', day: 'numeric' });
      select.append(option);
    }
    select.value = value;
    setText('flexViewerNote',value
      ? 'Extra flexible day: '+fmtDay(value,{weekday:'long',month:'short',day:'numeric'})
      : 'Friday is the only flexible day selected for this week.');
  }
  function renderCalendar() {
    const grid = $('calendarGrid'); grid.replaceChildren();
    setText('monthLabel', displayedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    const y = displayedMonth.getFullYear(), m = displayedMonth.getMonth();
    const blank = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < blank; i++) {
      const el = document.createElement('span'); el.className = 'calendar-day empty'; grid.append(el);
    }
    for (let day = 1; day <= days; day++) {
      const key = localDateKey(new Date(y, m, day, 12));
      const btn = document.createElement('button'); btn.type = 'button';
      const logged = entries.has(key);
      const flexible = isFlexDay(key);
      btn.className = 'calendar-day' + (logged ? ' is-logged' : '') + (flexible ? ' is-flex' : '') +
        (key === selectedDate ? ' is-selected' : '') + (key === localDateKey(new Date()) ? ' is-today' : '');
      btn.disabled = key < START_DATE;
      btn.title = fmtDay(key, { weekday: 'long', month: 'long', day: 'numeric' }) +
        ' · ' + (logged ? 'Entry saved' : 'No entry') + (flexible ? ' · Flexible day' : '');
      const number = document.createElement('span'); number.textContent = String(day);
      const status = document.createElement('span'); status.className = 'day-status';
      status.textContent = logged ? 'Saved' : (flexible ? 'Flex' : '·');
      btn.append(number, status);
      btn.addEventListener('click', () => setDate(key, true));
      grid.append(btn);
    }
  }
  function renderSummary() {
    const rows = [...entries.values()];
    const stepRows = rows.filter((r) => r.steps != null);
    setText('summaryLogged', shortNum(rows.length));
    setText('summarySteps', shortNum(stepRows.filter((r) => r.steps >= STEP_GOAL).length));
    setText('summaryAvg', stepRows.length
      ? shortNum(Math.round(stepRows.reduce((sum, r) => sum + r.steps, 0) / stepRows.length))
      : '—');
    setText('summaryMeals', shortNum(rows.filter((r) => r.one_meal).length));
  }

  $('entryForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!user || !db || viewingShared()) return;
    callWithButton($('saveEntryBtn'), async () => {
      const steps = numericValue('steps'), cals = numericValue('calories'), fasting = numericValue('fasting');
      const coffee = numericValue('coffee') ?? 0, waist = numericValue('waist');
      if (!validRange(steps, 0, 100000) || !Number.isInteger(steps ?? 0) ||
          !validRange(cals, 0, 15000) || !Number.isInteger(cals ?? 0) ||
          !validRange(fasting, 0, 24) || !validRange(coffee, 0, 30) || !Number.isInteger(coffee) ||
          !validRange(waist, 30, 300)) {
        showMessage('entryMessage', 'Check your numbers. Steps, calories and coffee should be whole numbers.', 'error'); return;
      }
      const meals = $('meals').value.trim(), notes = $('notes').value.trim();
      if (steps == null && cals == null && fasting == null && coffee === 0 && waist == null && !meals && !notes && !$('oneMeal').checked) {
        showMessage('entryMessage', 'Add at least one detail before saving.', 'error'); return;
      }
      const data = {
        user_id: user.id, entry_date: selectedDate, steps, calories_estimate: cals, meals,
        fasting_hours: fasting, coffee_cups: coffee, one_meal: $('oneMeal').checked,
        waist_cm: waist, notes
      };
      try {
        const { data: saved, error } = await db.from('daily_entries')
          .upsert(data, { onConflict: 'user_id,entry_date' })
          .select('id,entry_date,steps,calories_estimate,meals,fasting_hours,one_meal,coffee_cups,waist_cm,notes')
          .single();
        if (error) throw error;
        entries.set(saved.entry_date, saved);
        renderAll();
        showMessage('entryMessage', 'Saved securely for ' + fmtDay(saved.entry_date) + '.', 'success');
      } catch (e) { showMessage('entryMessage', errorText(e), 'error'); }
    });
  });
  $('deleteEntryBtn').addEventListener('click', async () => {
    if (!user || viewingShared() || !entries.has(selectedDate) || !window.confirm('Delete your entry for ' + fmtDay(selectedDate) + '? This cannot be undone.')) return;
    try {
      const { error } = await db.from('daily_entries').delete()
        .eq('user_id', user.id).eq('entry_date', selectedDate);
      if (error) throw error;
      entries.delete(selectedDate);
      renderAll();
      showMessage('entryMessage', 'Entry deleted.', 'success');
    } catch (e) { showMessage('entryMessage', errorText(e), 'error'); }
  });
  $('quickFoods').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-meal]');
    if (!chip || viewingShared()) return;
    const existingMeal = $('meals').value.trim();
    $('meals').value = (existingMeal ? existingMeal + '\n' : '') + chip.dataset.meal;
    const oldCal = numericValue('calories') || 0;
    $('calories').value = String(oldCal + Number(chip.dataset.cal));
    showMessage('entryMessage', 'Added a rough estimate. Adjust calories based on your actual portion.', 'success');
  });
  $('saveFlexBtn').addEventListener('click', () => {
    if (!user || viewingShared()) return;
    callWithButton($('saveFlexBtn'), async () => {
      const week = mondayFreeWeekStart(selectedDate);
      const chosen = $('flexSelect').value;
      if (chosen && (chosen < week || chosen > addDays(week, 6) || chosen < START_DATE || isFriday(chosen))) {
        showMessage('flexMessage', 'Select a valid extra day in the current week.', 'error'); return;
      }
      try {
        if (chosen) {
          const { error } = await db.from('weekly_flex').upsert(
            { user_id: user.id, week_start: week, flex_date: chosen },
            { onConflict: 'user_id,week_start' }
          );
          if (error) throw error;
          flex.set(week, chosen);
        } else if (flex.has(week)) {
          const { error } = await db.from('weekly_flex').delete()
            .eq('user_id', user.id).eq('week_start', week);
          if (error) throw error;
          flex.delete(week);
        }
        renderAll();
        showMessage('flexMessage', chosen ? 'Your second flexible day is saved.' : 'Extra flexible day cleared.', 'success');
      } catch (e) { showMessage('flexMessage', errorText(e), 'error'); }
    });
  });
  $('prevMonth').addEventListener('click', () => {
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1, 12);
    renderCalendar();
  });
  $('nextMonth').addEventListener('click', () => {
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1, 12);
    renderCalendar();
  });
  $('exportBtn').addEventListener('click', () => {
    if (!user || viewingShared() || entries.size === 0) return showMessage('globalAlert', 'No saved entries to export yet.');
    const cols = ['entry_date', 'steps', 'calories_estimate', 'meals', 'fasting_hours', 'one_meal', 'coffee_cups', 'waist_cm', 'notes'];
    const quoteCsv = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [...entries.values()].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    const csv = '\ufeff' + cols.join(',') + '\r\n' +
      rows.map((r) => cols.map((col) => quoteCsv(r[col])).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'fitness-tracker-' + localDateKey(new Date()) + '.csv';
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  async function init() {
    if (!config.url || !config.publishableKey || !window.supabase?.createClient) {
      $('authSubmit').disabled = true;
      showMessage('authMessage', 'Application configuration is unavailable. Please reload the page or contact the site owner.', 'error');
      return;
    }
    db = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    db.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        recovering = true;
        $('appView').hidden = true; $('authView').hidden = false;
        $('authForm').hidden = true; $('resetView').hidden = false;
        $('authTitle').textContent = 'Reset your password';
        return;
      }
      if (event === 'SIGNED_OUT') {
        user = null; entries.clear(); flex.clear();
        currentTrackerId='mine'; ownedShares=[]; incomingShares=[]; lastInvitedEmail='';
        $('appView').hidden = true; $('authView').hidden = false; $('logoutBtn').hidden = true;
        return;
      }
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && !recovering) {
        // Defer data queries outside the auth-state callback to avoid Supabase auth-lock reentrancy.
        setTimeout(() => showSignedIn(session), 0);
      }
    });
    try {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      if (data.session && !recovering) await showSignedIn(data.session);
    } catch (e) { showMessage('authMessage', errorText(e), 'error'); }
  }
  init();
})();
