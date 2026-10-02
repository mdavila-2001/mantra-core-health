/** Proxy de desarrollo contra servicios reales; la demo agrega sus medios aparte. */
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
  ...base,
];
