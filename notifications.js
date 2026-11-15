/* User-controlled iOS Home Screen Web Push. The private VAPID key is server-side only. */
(() => {
  'use strict';
  const conf = window.FITNESS_CONFIG || {};
  const TIMES = ['09:00', '14:00', '20:00'];
  const $ = (id) => document.getElementById(id);
  let db = null, currentUser = null, registration = null, active = false, busy = false, initialized = false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const installed = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = () => window.isSecureContext && 'serviceWorker' in navigator &&
    'PushManager' in window && 'Notification' in window && Boolean(conf.vapidPublicKey);
  const buttons = () => [...document.querySelectorAll('.push-time-toggle')];
  function selectedTimes() { return buttons().filter((x) => x.getAttribute('aria-pressed') === 'true').map((x) => x.dataset.time); }
  function applyTimes(times) {
    const on = new Set(Array.isArray(times) ? times : TIMES);
    buttons().forEach((b) => {
      const selected = on.has(b.dataset.time);
      b.setAttribute('aria-pressed', String(selected));
      b.classList.toggle('is-on', selected);
    });
  }
  function note(message, kind = '') {
    const el = $('pushStatus');
    if (!el) return;
    el.textContent = message;
    el.className = 'push-message' + (kind ? ' ' + kind : '');
  }
  function toggleBusy(isBusy) {
    busy = isBusy;
    for (const el of [...buttons(), $('pushEnableBtn'), $('pushDisableBtn'), $('pushTestBtn')]) {
      if (el) el.disabled = isBusy;
    }
  }
  function render() {
    const installNeeded = isIOS && !installed();
    if ($('pushInstallHint')) $('pushInstallHint').hidden = !installNeeded;
    if ($('pushEnableBtn')) {
      $('pushEnableBtn').hidden = active;
      $('pushEnableBtn').disabled = busy || installNeeded || !supported() || Notification.permission === 'denied';
    }
    if ($('pushDisableBtn')) $('pushDisableBtn').hidden = !active;
    if ($('pushTestBtn')) $('pushTestBtn').hidden = !active;
    if (installNeeded) note('To receive iPhone alerts, open Fitness from the Home Screen, not a Safari tab.');
    else if (!supported()) note('Push notifications are not supported in this browser.');
    else if (Notification.permission === 'denied') note('Notifications are blocked. Allow Fitness in iPhone Settings → Notifications.', 'error');
  }
  function publicKeyBytes(base64url) {
    const raw = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - base64url.length % 4) % 4));
    return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
  }
  async function saveSubscription(subscription) {
    const json = subscription.toJSON();
    if (!json.keys?.p256dh || !json.keys?.auth) throw new Error('Device subscription keys are missing.');
    const { error } = await db.from('fitness_push_subscriptions').upsert({
      user_id: currentUser.id, endpoint: json.endpoint,
      p256dh: json.keys.p256dh, auth_secret: json.keys.auth
    }, { onConflict: 'endpoint' });
    if (error) throw error;
  }
  async function savePreferences(enabled) {
    if (!db || !currentUser) return;
    const { error } = await db.from('fitness_push_preferences').upsert({
      user_id: currentUser.id, enabled, reminder_times: selectedTimes(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (error) throw error;
  }
  async function openDevice() {
    if (!supported() || (isIOS && !installed()) || !registration) return;
    if (!selectedTimes().length) { note('Choose at least one daily reminder first.', 'error'); return; }
    toggleBusy(true);
    try {
      // subscribe() is initiated by the user's tap, required for Apple Web Push.
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: publicKeyBytes(conf.vapidPublicKey)
      });
      try {
        await saveSubscription(subscription);
        active = true;
        await savePreferences(true);
        note('Notifications enabled for this device. You can send a test now.', 'success');
      } catch (error) {
        await subscription.unsubscribe();
        throw error;
      }
    } catch (error) {
      note('Could not enable notifications: ' + (error?.message || 'Permission was not granted.'), 'error');
    } finally { toggleBusy(false); render(); }
  }
  async function revokeDevice() {
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    if (db && currentUser) {
      const { error } = await db.from('fitness_push_subscriptions')
        .delete().eq('user_id', currentUser.id).eq('endpoint', subscription.endpoint);
      if (error) throw error;
    }
    await subscription.unsubscribe();
  }
  async function turnOff() {
    toggleBusy(true);
    try {
      await savePreferences(false);
      await revokeDevice();
      active = false;
      note('Reminders turned off for your account.', 'success');
    } catch (error) {
      note('Could not turn off notifications: ' + (error?.message || 'Unknown error'), 'error');
    } finally { toggleBusy(false); render(); }
  }
  async function sendTest() {
    toggleBusy(true);
    try {
      const { data, error } = await db.functions.invoke('fitness-push-send', { body: { test: true } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'No registered device received the alert.');
      note('Test sent. Check your iPhone Lock Screen or Notification Center.', 'success');
    } catch (error) {
      note('Test failed: ' + (error?.message || 'Unknown error'), 'error');
    } finally { toggleBusy(false); render(); }
  }
  function setupControls() {
    if (initialized) return;
    initialized = true;
    buttons().forEach((b) => b.addEventListener('click', async () => {
      if (busy || !currentUser) return;
      const next = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(next));
      b.classList.toggle('is-on', next);
      try { await savePreferences(active && selectedTimes().length > 0); note('Reminder times saved.', 'success'); }
      catch (e) { note('Could not save schedule: ' + (e?.message || 'Unknown error'), 'error'); }
    }));
    $('pushEnableBtn')?.addEventListener('click', openDevice);
    $('pushDisableBtn')?.addEventListener('click', turnOff);
    $('pushTestBtn')?.addEventListener('click', sendTest);
  }
  async function mount(client, user) {
    db = client;
    currentUser = user;
    setupControls();
    render();
    if (!supported()) return;
    try {
      registration = await navigator.serviceWorker.register('/fitness-push-sw.js', { scope: '/' });
      const { data: pref, error } = await db.from('fitness_push_preferences')
        .select('enabled,reminder_times').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      applyTimes(pref?.reminder_times || TIMES);
      const subscription = await registration.pushManager.getSubscription();
      active = Boolean(subscription && pref?.enabled);
      if (subscription && active) await saveSubscription(subscription);
      if (active) note('Notifications are enabled. Select reminders or send a test.', 'success');
      else if (pref?.enabled && !subscription) note('Tap Enable notifications to register this device.');
      else if (!pref) note('Choose your reminder times, then enable notifications.');
      render();
    } catch (error) {
      note('Notification setup could not load: ' + (error?.message || 'Unknown error'), 'error');
    }
  }
  async function disconnect() {
    // Signing out removes only this device; other signed-in devices are unaffected.
    try { await revokeDevice(); } catch (_) { /* Signing out must remain possible. */ }
    active = false;
  }
  function reset() { db = null; currentUser = null; active = false; render(); }
  window.FitnessNotifications = { mount, disconnect, reset };
})();
