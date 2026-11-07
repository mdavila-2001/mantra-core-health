/* Service worker de los avisos push de AloVida.
 *
 * Hace una sola cosa: mostrar el aviso que manda el servidor y, al tocarlo,
 * llevar a la persona a la pantalla indicada. No cachea nada ni intercepta
 * peticiones, así que no puede dejar contenido viejo en el navegador.
 *
 * El push trae un texto genérico a propósito (se ve en la pantalla bloqueada);
 * el detalle se lee dentro de la aplicación, ya con la sesión iniciada.
 *
 * Payload (see the shared push contract): { title?, body?, notificationId, route,
 * destinationType, destinationId, category }. The route is resolved by the API;
 * the worker only validates it and falls back to the notification center.
 */
const DEFAULT_ROUTE = '/notification-center';
const DEFAULT_BODY = 'Tiene un aviso nuevo en AloVida';
const INTERNAL_ROUTE = /^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?(?:\?[A-Za-z0-9_=&%.-]*)?$/;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Must match SUBSCRIPTION_CHANGED_MESSAGE in core/notifications/web-push.service.ts. */
const SUBSCRIPTION_CHANGED = 'alovida-push-subscription-changed';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/** Builds the visible notice. Exposed on `self` so a browser test can check it. */
function noticeFrom(data) {
  const route = typeof data.route === 'string' && INTERNAL_ROUTE.test(data.route) ? data.route : DEFAULT_ROUTE;
  const id = typeof data.notificationId === 'string' && SAFE_ID.test(data.notificationId) ? data.notificationId : null;
  return {
    title: typeof data.title === 'string' ? data.title : 'AloVida',
    options: {
      body: typeof data.body === 'string' ? data.body : DEFAULT_BODY,
      icon: '/alovida_logo.svg',
      // One tag per notification: each notice keeps its own route, and a redelivery
      // of the same one replaces it instead of stacking. Without an id they collapse.
      tag: id ? `alovida-${id}` : 'alovida-aviso',
      renotify: true,
      data: { route, notificationId: id },
    },
  };
}

/** Focuses an open AloVida window and moves it to the route; opens one if that fails. */
async function openRoute(route) {
  const target = new URL(INTERNAL_ROUTE.test(route) ? route : DEFAULT_ROUTE, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const ours = windows.filter((w) => new URL(w.url).origin === self.location.origin);
  const open = ours.find((w) => w.focused) ?? ours.find((w) => w.visibilityState === 'visible') ?? ours[0];
  if (open) {
    await open.focus().catch(() => undefined);
    // navigate() rejects on a window this worker does not control yet.
    const moved = await open.navigate(target).catch(() => null);
    if (moved) return moved;
  }
  return self.clients.openWindow(target);
}

// Test hook for playwright/push-notificaciones-web.spec.ts. Harmless: the worker's
// global scope is not reachable from pages or other origins, and these only build a
// notice and focus/open a same-origin route.
self.alovidaPush = { noticeFrom, openRoute, DEFAULT_ROUTE };

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = (event.data ? event.data.json() : {}) ?? {};
  } catch {
    data = {};
  }
  const { title, options } = noticeFrom(data);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openRoute(event.notification.data?.route ?? DEFAULT_ROUTE));
});

// The worker has no access token, so it cannot PUT the rotated subscription itself:
// it tells the open windows, and WebPushService.resync saves it (also on next login).
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => windows.forEach((w) => w.postMessage({ type: SUBSCRIPTION_CHANGED }))),
  );
});
