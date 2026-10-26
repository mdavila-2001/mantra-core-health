/* Service worker de los avisos push de AloVida.
 *
 * Hace una sola cosa: mostrar el aviso que manda el servidor y, al tocarlo,
 * llevar a la persona a la pantalla indicada. No cachea nada ni intercepta
 * peticiones, así que no puede dejar contenido viejo en el navegador.
 *
 * El push trae un texto genérico a propósito (se ve en la pantalla bloqueada);
 * el detalle se lee dentro de la aplicación, ya con la sesión iniciada.
 */
const DEFAULT_ROUTE = '/notifications';
const INTERNAL_ROUTE = /^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?(?:\?[A-Za-z0-9_=&%.-]*)?$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === 'string' ? data.title : 'AloVida';
  const body = typeof data.body === 'string' ? data.body : 'Tiene un aviso nuevo';
  const route = INTERNAL_ROUTE.test(data.route) ? data.route : DEFAULT_ROUTE;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/alovida_logo.svg',
      tag: 'alovida-aviso',
      renotify: true,
      data: { route },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const route = event.notification.data?.route ?? DEFAULT_ROUTE;
  const target = new URL(route, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        return open.navigate(target).then((w) => w?.focus());
      }
      return self.clients.openWindow(target);
    }),
  );
});
