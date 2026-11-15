/* Fitness Tracker Web Push service worker. No private tracking data is cached. */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = typeof data.title === 'string' ? data.title : 'Fitness Tracker';
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof data.body === 'string' ? data.body : 'Your daily wellness reminder.',
    icon: '/fitness-icon.svg',
    badge: '/fitness-icon.svg',
    tag: typeof data.tag === 'string' ? data.tag : 'fitness-reminder',
    data: { url: 'https://fitness.oalfawzan.sa/' }
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if (client.url.startsWith('https://fitness.oalfawzan.sa/')) return client.focus();
    }
    return self.clients.openWindow('https://fitness.oalfawzan.sa/');
  })());
});
