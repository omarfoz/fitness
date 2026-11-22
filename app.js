/* Fitness Tracker - static app + Supabase Auth + per-user RLS
 * No user meals or measurements are written to GitHub or localStorage.
 */
(() => {
  'use strict';
  const STEP_GOAL = 10000;
  // Anyone can check in for the last few weeks, or any older day they
  // already have data for (e.g. imported steps).
  const BACKFILL_DAYS = 60;
  // The four routes are real HTML documents; absent page-specific controls
  // use detached elements so shared authentication code never needs to copy
  // forms or metrics into the other pages.
  const inertElements = Object.create(null);
  const $ = (id) => document.getElementById(id) ||
    (inertElements[id] ||= document.createElement('div'));
  const page = document.getElementById('appView')?.dataset.page || 'todaySection';
  const routes = Object.freeze({todaySection:'/', logSection:'/log.html',
    historySection:'/history.html', sharingPanel:'/share.html',
    challengesSection:'/challenges.html'});
  function rememberTracker(id) {
    try {
      if(id==='mine')sessionStorage.removeItem('fitness-active-tracker');
      else sessionStorage.setItem('fitness-active-tracker',id);
    }catch(_){}
  }
  function restoredTracker() {
    try{return sessionStorage.getItem('fitness-active-tracker')||'mine';}
    catch(_){return 'mine';}
  }
  const config = window.FITNESS_CONFIG || {};
  let db, user = null, authMode = 'signin', recovering = false, entries = new Map(), flex = new Map();
  let lastObservedDate = localDateKey(new Date());
  let rolloverTimer = null;
  const queryDate = new URLSearchParams(window.location.search).get('date');
  let selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(queryDate||'') && queryDate<=localDateKey(new Date())
    ? queryDate : localDateKey(new Date());
  let displayedMonth = firstOfMonth(dateFromKey(selectedDate));
  let loadingFor = null;
  let currentTrackerId = restoredTracker();
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
  function earliestLogDate() {
    let first=addDays(localDateKey(new Date()),-BACKFILL_DAYS);
    for(const date of entries.keys())if(date<first)first=date;
    return first;
  }
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
    // Reinsert the theme-color element to prompt WebKit to re-evaluate
    // native status-bar tint on a Home Screen app when the theme changes.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const color = mode === 'light' ? '#f5f7fb' : '#16233d';
      if (meta.content !== color) {
        const updated = meta.cloneNode();
        updated.setAttribute('content', color);
        meta.replaceWith(updated);
      }
    }
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
    try { await window.FitnessNotifications?.disconnect?.(); } catch (_) {}
    window.FitnessCsvImport?.reset?.();
    const { error } = await db.auth.signOut();
    if (error) return showMessage('globalAlert', errorText(error), 'error');
    user = null; entries.clear(); flex.clear();
    currentTrackerId='mine';rememberTracker('mine'); ownedShares=[]; incomingShares=[]; lastInvitedEmail='';
    window.FitnessFoodBrowser?.clear();
    $('appView').hidden = true; $('authView').hidden = false; $('logoutBtn').hidden = true;
    $('authPassword').value = '';
    showMessage('authMessage', 'Signed out successfully.', 'success');
  });

  async function showSignedIn(session) {
    if (!session || !session.user || recovering) return;
    if (user && user.id === session.user.id && !$('appView').hidden) {
      window.FitnessPageLoading?.hide?.();
      return;
    }
    user = session.user;
    $('authView').hidden = true; $('appView').hidden = false; $('logoutBtn').hidden = false;
    window.FitnessNotifications?.mount?.(db, user);
    showMessage('globalAlert', '');
    try {
      if(viewingShared()){
        await loadShares();
        const wanted=currentTrackerId;
        currentTrackerId='mine';
        await openTracker(wanted);
      }else{
        // Network calls for sharing and entries are independent. Fetch them
        // concurrently so switching real HTML pages doesn't feel frozen.
        await Promise.all([loadShares(),loadData()]);
      }
      window.FitnessStory?.openRequested?.();
    }finally{
      window.FitnessPageLoading?.hide?.();
    }
  }

  async function fetchOwnedHistory(uid) {
    // Supabase can cap each PostgREST response at 1,000 rows. Cursor
    // pagination keeps years of imported steps visible, not just the latest
    // 1,000 days, without huge URLs or OFFSET drift.
    const size=800,records=[];
    let before=null;
    for(let page=0;page<20;page++){
      let query=db.from('daily_entries')
        .select('id,entry_date,steps,calories_estimate,meals,fasting_hours,one_meal,coffee_cups,waist_cm,notes,meal_items')
        .eq('user_id',uid).order('entry_date',{ascending:false}).limit(size);
      if(before)query=query.lt('entry_date',before);
      const {data,error}=await query;
      if(error)throw error;
      records.push(...(data||[]));
      if(!data || data.length<size)return records;
      before=data[data.length-1].entry_date;
    }
    throw new Error('Your tracker has more than 16,000 daily entries. Contact support to view older history.');
  }
  async function loadData() {
    if (!user) return;
    const uid = user.id;
    if (loadingFor === uid) return;
    loadingFor = uid;
    try {
      const [days,flexResult] = await Promise.all([
        fetchOwnedHistory(uid),
        db.from('weekly_flex')
          .select('week_start,flex_date')
          .eq('user_id',uid).order('week_start',{ascending:false}).limit(250)
      ]);
      if(flexResult.error)throw flexResult.error;
      if(!user || user.id!==uid || viewingShared())return;
      entries = new Map(days.map(row=>[row.entry_date,row]));
      flex = new Map((flexResult.data||[]).map(row=>[row.week_start,row.flex_date]));
      renderAll();
    }catch(e){
      showMessage('globalAlert','Could not load your private data: '+errorText(e),'error');
    }finally{loadingFor=null;}
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
      currentTrackerId = 'mine';rememberTracker('mine');
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
    $('sharingPanel').hidden = readonly;
    $('exportBtn').hidden = readonly;
    $('csvImportPanel').hidden = readonly;
    if (readonly) window.FitnessCsvImport?.reset?.();
    $('bottomShareBtn').hidden = readonly;
    for (const id of ['storySection']) {
      const node=document.getElementById(id);
      if(node)node.hidden=readonly;
    }
    const quick=$('quickLogBtn');
    if(quick.firstChild)quick.firstChild.textContent = readonly ? 'View day ' : 'Check in today ';
  }
  async function openTracker(id) {
    if (!user || !db || id === currentTrackerId) return;
    if (id !== 'mine' && !incomingShares.some((share)=>share.id===id)) return;
    currentTrackerId = id;
    rememberTracker(id);
    entries.clear();
    flex.clear();
    window.FitnessFoodBrowser?.invalidate();
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
    if (!key || key < earliestLogDate()) return;
    if(page!=='logSection'){
      window.location.assign('/log.html?date='+encodeURIComponent(key));
      return;
    }
    selectedDate = key;
    $('entryDate').value = key;
    displayedMonth = firstOfMonth(dateFromKey(key));
    showMessage('entryMessage', '');
    renderAll();
    if (scroll) $('logTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('entryDate').min = earliestLogDate();
  $('entryDate').value = selectedDate;
  $('entryDate').addEventListener('change', (e) => setDate(e.target.value));

  function renderAll() {
    if (!user) return;
    renderSharingState();
    if(page==='todaySection'){
      renderHero();renderStats();renderStreak();window.FitnessRecap?.refresh?.();
    }else if(page==='logSection'){
      renderDay();
    }else if(page==='historySection'){
      renderCalendar();renderSummary();
    }else if(page==='challengesSection'){
      window.FitnessChallenges?.refresh?.();
    }
    if(page==='todaySection')window.FitnessChallenges?.celebrate?.();
  }
  function refreshForNewDay() {
    const currentDate = localDateKey(new Date());
    if (currentDate === lastObservedDate) return;
    const previousDate = lastObservedDate;
    lastObservedDate = currentDate;
    // Follow the new day only when the user was viewing the previous today.
    // Keep a manually selected historical date untouched.
    if (selectedDate === previousDate) {
      selectedDate = currentDate;
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
    setText('overviewDay', fmtDay(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' }));
    const currentShare = incomingShares.find((share)=>share.id===currentTrackerId);
    const dayText = fmtDay(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' });
    setText('heroSubtitle', viewingShared()
      ? 'Viewing '+(currentShare?.display_name || 'shared fitness')+' progress. Read-only access.'
      : selectedDate === today
        ? 'Today is '+dayText+'. Small steps add up.'
        : 'Your check-in for '+dayText+'. Progress at your own pace.');
  }
  function renderDay() {
    $('entryDate').min = earliestLogDate();
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
    window.FitnessFoodBrowser?.openEntry(entry, (user?.id || '') + '|' + currentTrackerId + '|' + selectedDate);
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
    setText('logTitle', viewingShared()
      ? 'Shared day: '+fmtDay(selectedDate,{month:'short',day:'numeric'})
      : (selectedDate === localDateKey(new Date()) ? 'Today’s check-in' : 'Check-in · ' + fmtDay(selectedDate, { month: 'short', day: 'numeric' })));
  }
  function renderStreak() {
    const info=window.FitnessProgress?.streak(entries,localDateKey(new Date()));
    if(!info)return;
    setText('streakCurrent',shortNum(info.current));
    setText('streakBest',shortNum(info.best));
    setText('streakMessage',info.metToday
      ? '10,000-step goal reached today. Keep the streak going!'
      : info.pendingToday
        ? 'Your streak is alive. Reach 10K steps today to extend it.'
        : info.current===0 && info.goalDays===0
          ? 'Reach 10,000 steps to start your first streak.'
          : 'A fresh 10,000-step streak can begin today.');
  }
  function renderStats() {
    const entry = entries.get(selectedDate);
    const calories = entry?.calories_estimate;
    const hasCalories = calories != null;
    // No calorie target: needs differ from person to person. The ring simply
    // fills once a rough estimate is logged.
    const ring = $('calorieRing');
    ring.style.setProperty('--ring-degrees', hasCalories ? '360deg' : '0deg');
    ring.setAttribute('aria-valuetext', hasCalories
      ? 'Roughly ' + shortNum(calories) + ' calories logged'
      : 'No estimated calories logged yet');
    setText('calValue', hasCalories ? shortNum(calories) : '—');
    const foods = Array.isArray(entry?.meal_items) ? entry.meal_items.length : 0;
    setText('foodCount', shortNum(foods));
    setText('foodCountLabel', foods === 1 ? 'food added' : 'foods added');
    setText('calorieState', hasCalories ? 'Logged' : 'Not logged');
    $('calorieState').classList.toggle('is-saved', hasCalories);
    setText('stepValue', entry?.steps == null ? '—' : shortNum(entry.steps));
    $('stepProgress').style.width = Math.min(100, Math.max(0, (entry?.steps || 0) / STEP_GOAL * 100)) + '%';
    setText('stepMeta', entry?.steps == null ? '10,000 steps is your daily aim' : entry.steps >= STEP_GOAL
      ? 'Your daily walking goal is complete'
      : shortNum(STEP_GOAL - entry.steps) + ' steps until your goal');
    setText('fastValue', entry?.fasting_hours == null ? '—' : entry.fasting_hours + 'h');
    setText('fastMeta', entry?.fasting_hours == null ? 'Not logged today' : 'today');
  }
  // Fit two values into narrow seven-column iPhone calendar cells.
  // Full, unrounded numbers remain available in the button's accessible label.
  function compactCalendarNumber(value) {
    const n = Number(value);
    if (n >= 10000) return Math.round(n / 1000) + 'k';
    if (n >= 1000) return (Math.round(n / 100) / 10).toString() + 'k';
    return String(n);
  }
  function calendarMetric(kind, value) {
    const item = document.createElement('span');
    item.className = 'calendar-metric calendar-metric--' + kind;
    item.title = kind === 'steps' ? shortNum(value) + ' steps' : 'Approximately ' + shortNum(value) + ' kcal';
    item.setAttribute('aria-hidden', 'true'); // The button announces the full values.
    const icon = document.createElement('span');
    icon.className = 'calendar-metric-icon';
    icon.innerHTML = kind === 'steps'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3c-1.3 0-2.2 1.8-2.2 3.2s.8 2.7 2.2 2.7 2.2-1.3 2.2-2.7S9.3 3 8 3ZM16 12c-1.3 0-2.2 1.8-2.2 3.2s.9 2.8 2.2 2.8 2.2-1.4 2.2-2.8S17.3 12 16 12Z"/><path d="M5.3 11.6c1.8-.9 4.5-.2 5.1 2 1 3.5-2.1 5.9-4.8 4.3-2.1-1.3-2.3-5.1-.3-6.3Zm8.1 6c2.1-1.3 4.6-.2 5.2 1.9.5 1.7-.6 3-2 3.1-2.4.1-5.5-3.6-3.2-5Z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c4.8 0 8-3.3 8-7.7 0-2.6-1.4-4.3-3.8-6.5.2 2-.7 3.3-1.5 4-1.1-4.1-2.2-6.4-5.2-9.8-.2 3.2-1.1 5-3.2 7.4C4.8 11 4 13 4 15.1 4 19.1 7.3 22 12 22Z"/></svg>';
    const number = document.createElement('span');
    number.className = 'calendar-metric-number';
    number.textContent = compactCalendarNumber(value);
    item.append(icon, number);
    return item;
  }
  function renderCalendar() {
    const grid = $('calendarGrid'); grid.replaceChildren();
    setText('monthLabel', displayedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    // A native month picker makes years of imported history reachable without
    // tapping Previous dozens of times on a phone.
    const monthKey=localDateKey(displayedMonth).slice(0,7);
    const oldestMonth=earliestLogDate().slice(0,7);
    const latestMonth=localDateKey(new Date()).slice(0,7);
    $('calendarJumpMonth').min=oldestMonth;
    $('calendarJumpMonth').max=latestMonth;
    $('calendarJumpMonth').value=monthKey;
    $('prevMonth').disabled=monthKey<=oldestMonth;
    $('nextMonth').disabled=monthKey>=latestMonth;
    const y = displayedMonth.getFullYear(), m = displayedMonth.getMonth();
    const blank = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
    const days = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < blank; i++) {
      const el = document.createElement('span'); el.className = 'calendar-day empty'; grid.append(el);
    }
    for (let day = 1; day <= days; day++) {
      const key = localDateKey(new Date(y, m, day, 12));
      const entry = entries.get(key);
      const logged = entries.has(key);
      const btn = document.createElement('button'); btn.type = 'button';
      btn.className = 'calendar-day' + (logged ? ' is-logged' : '') + (entry?.steps >= STEP_GOAL ? ' is-goal' : '') +
        (key === selectedDate ? ' is-selected' : '') + (key === localDateKey(new Date()) ? ' is-today' : '');
      btn.disabled = key < earliestLogDate();
      const description = [fmtDay(key, { weekday: 'long', month: 'long', day: 'numeric' }), logged ? 'Entry saved' : 'No entry'];
      if (entry?.steps != null) description.push(shortNum(entry.steps) + ' steps');
      if (entry?.calories_estimate != null) description.push('approximately ' + shortNum(entry.calories_estimate) + ' kcal');
      btn.title = description.join(' · ');
      btn.setAttribute('aria-label', description.join(', '));
      const number = document.createElement('span');
      number.className = 'calendar-day-number';
      number.textContent = String(day);
      const status = document.createElement('span');
      status.className = 'day-status';
      status.textContent = logged ? 'Saved' : '·';
      btn.append(number);
      // Show only metrics the user actually logged; missing values are not zeros.
      if (logged && (entry?.steps != null || entry?.calories_estimate != null)) {
        const metrics = document.createElement('span');
        metrics.className = 'calendar-day-metrics';
        if (entry.steps != null) metrics.append(calendarMetric('steps', entry.steps));
        if (entry.calories_estimate != null) metrics.append(calendarMetric('calories', entry.calories_estimate));
        btn.append(metrics);
      } else {
        btn.append(status);
      }
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
    setText('summaryBest', shortNum(window.FitnessProgress?.streak(entries,localDateKey(new Date())).best || 0));
  }

  // Native anchor links navigate between distinct HTML pages.
  // This avoids long-page scrolling pretending to be app navigation.
  function jumpToSection(target,focusMeal=false){
    const destination=routes[target];
    if(!destination)return;
    if(target!==page){
      window.location.assign(destination);
      return;
    }
    const section=document.getElementById(target);
    if(section)section.scrollIntoView({behavior:'smooth',block:'start'});
    if(focusMeal && page==='logSection' && !viewingShared())$('meals').focus({preventScroll:true});
  }
  $('quickLogBtn').addEventListener('click',()=>jumpToSection('logSection'));

  // Keep reference cards open on desktop and collapsible on mobile, including
  // after a screen rotation or viewport resize.
  const desktopDisclosure = window.matchMedia('(min-width: 681px)');
  function syncReferenceCards() {
    document.querySelectorAll('details[data-collapse-mobile]').forEach((details) => {
      details.open = desktopDisclosure.matches;
    });
  }
  syncReferenceCards();
  if (desktopDisclosure.addEventListener) {
    desktopDisclosure.addEventListener('change', syncReferenceCards);
  } else {
    desktopDisclosure.addListener(syncReferenceCards);
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
      const browser = window.FitnessFoodBrowser;
      const mealItems = browser?.getItems() || [];
      if (browser && !browser.validItems()) {
        showMessage('entryMessage', 'Please check each food quantity and calorie value. The daily total must be 15,000 kcal or less.', 'error'); return;
      }
      if (steps == null && cals == null && fasting == null && coffee === 0 && waist == null && !meals && !notes && !mealItems.length && !$('oneMeal').checked) {
        showMessage('entryMessage', 'Add at least one detail before saving.', 'error'); return;
      }
      const data = {
        user_id: user.id, entry_date: selectedDate, steps, calories_estimate: cals, meals,
        fasting_hours: fasting, coffee_cups: coffee, one_meal: $('oneMeal').checked,
        waist_cm: waist, notes, meal_items: mealItems
      };
      try {
        const { data: saved, error } = await db.from('daily_entries')
          .upsert(data, { onConflict: 'user_id,entry_date' })
          .select('id,entry_date,steps,calories_estimate,meals,fasting_hours,one_meal,coffee_cups,waist_cm,notes,meal_items')
          .single();
        if (error) throw error;
        entries.set(saved.entry_date, saved);
        window.FitnessFoodBrowser?.invalidate();
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
      window.FitnessFoodBrowser?.invalidate();
      renderAll();
      showMessage('entryMessage', 'Entry deleted.', 'success');
    } catch (e) { showMessage('entryMessage', errorText(e), 'error'); }
  });
  $('calendarJumpMonth').addEventListener('change', (event) => {
    const month=event.target.value;
    const first=earliestLogDate().slice(0,7);
    const latest=localDateKey(new Date()).slice(0,7);
    if(!/^\d{4}-\d{2}$/.test(month)||month<first||month>latest){
      event.target.value=localDateKey(displayedMonth).slice(0,7);
      return;
    }
    const [year,m]=month.split('-').map(Number);
    displayedMonth=new Date(year,m-1,1,12);
    renderCalendar();
  });
  $('prevMonth').addEventListener('click', () => {
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1, 12);
    renderCalendar();
  });
  $('nextMonth').addEventListener('click', () => {
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1, 12);
    renderCalendar();
  });
  // Import reads the CSV locally. All Supabase writes are scoped to the
  // authenticated owner's daily entries; viewers cannot import or overwrite.
  window.FitnessChallenges?.mount?.(() => ({
    db, userId:user?.id||null, readonly:viewingShared(), entries
  }));
  window.FitnessRecap?.mount?.(() => ({
    userId:user?.id||null,readonly:viewingShared(),entries
  }));
  window.FitnessStory?.mount?.(() => ({
    userId:user?.id||null,readonly:viewingShared(),entries
  }));
  window.FitnessCsvImport?.mount?.({
    getContext: () => ({
      db,
      userId: user?.id || null,
      readonly: viewingShared(),
      existing: entries
    }),
    onSaved: async () => { await loadData(); }
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
        window.FitnessPageLoading?.hide?.();
        $('appView').hidden = true; $('authView').hidden = false;
        $('authForm').hidden = true; $('resetView').hidden = false;
        $('authTitle').textContent = 'Reset your password';
        return;
      }
      if (event === 'SIGNED_OUT') {
        window.FitnessPageLoading?.hide?.();
        window.FitnessNotifications?.reset?.();
        window.FitnessCsvImport?.reset?.();
        user = null; entries.clear(); flex.clear();
        currentTrackerId='mine'; rememberTracker('mine'); ownedShares=[]; incomingShares=[]; lastInvitedEmail='';
    window.FitnessFoodBrowser?.clear();
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
    finally { window.FitnessPageLoading?.hide?.(); }
  }
  init();
})();
