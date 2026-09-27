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

/**
 * `/ai` va al servicio de triage (AlovidaAIService), que no es la API.
 *
 * **Sin destino por defecto (H3.S2.M2, 2026-09-26).** D-C —qué servicio lo
 * atiende, con qué base legal y dónde corre— sigue sin resolver
 * (`docs/progress/DECISIONS.md`), y hasta que se resuelva **ninguna IP de
 * terceros vive en el repositorio**: mandar texto clínico sin autenticar a un
 * host escrito acá sería exactamente lo que la regla 90.2.4 prohíbe. Sin
 * `ALOVIDA_AI_TARGET` en el entorno, el contexto `/ai/` directamente **no se
 * declara**: la petición cae en la lista base (`proxy.conf.json`), que
 * también dejó `/ai` sin destino real por la misma razón — ver su
 * `_comentario`—, así que `yarn start` no manda nada a ningún servicio.
 */
const aiTarget = process.env.ALOVIDA_AI_TARGET;

export default [
  ...(aiTarget === undefined
    ? []
    : [
        {
          context: ['/ai/'],
          target: aiTarget,
          changeOrigin: true,
          secure: true,
          pathRewrite: { '^/ai': '' },
        },
      ]),
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
