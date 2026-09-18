/**
 * El proxy de `yarn start` en la rama `mockup`.
 *
 * Reexporta `proxy.conf.json` tal cual —es lo que leen `check-api-prefixes.mjs`
 * y `check-client-prefixes.mjs`, y lo que vale contra la API real— y le
 * antepone una sola entrada: `/public/media/*` se sirve desde
 * `public/mock-media.svg` en vez de ir a la API.
 *
 * Por qué hace falta: una `<img src="/public/media/<id>">` la pide el
 * navegador directo, sin pasar por `HttpClient`, así que el interceptor del
 * simulador no la ve. Con la API apagada el proxy respondía 500 y la foto de
 * vitrina de «Artículos médicos» caía a las iniciales con un error rojo en
 * consola. `bypass` (contrato de `server.proxy` de Vite, que es lo que hay
 * debajo de `@angular/build:dev-server`) contesta un 302 al archivo estático
 * y devuelve `false` para que el proxy no siga.
 *
 * Responde en vez de reescribir la ruta: el middleware de assets de Angular
 * corre ANTES del proxy, así que una reescritura a `/mock-media.svg` ya no
 * encuentra quien la sirva y cae en el `index.html` de la aplicación.
 *
 * La entrada va PRIMERA porque el proxy compara por inicio de ruta y
 * `/public/` de la lista base se comería `/public/media`.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const base = require('./proxy.conf.json');

export default [
  {
    context: ['/public/media'],
    target: 'http://localhost:3125',
    bypass: (_request, response) => {
      response.writeHead(302, { Location: '/mock-media.svg' });
      response.end();
      return false;
    },
  },
  ...base,
];
