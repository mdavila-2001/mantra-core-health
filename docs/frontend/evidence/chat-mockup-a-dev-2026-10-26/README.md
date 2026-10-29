# Chat: tres piezas de `mockup` portadas a `dev` (26/10/2026)

Origen: `origin/mockup` (commits `85ee44a4f` y `d1d994472`). Destino: `dev`.
`git cherry` no las reconoce como portadas porque `dev` renombró los archivos a
inglés; el contenido tampoco estaba en `dev` ni en `test`.

| # | Pieza | Dónde |
|---|---|---|
| 1 | Carril de filtros con flechas; «Archivados» y «Bloqueados» pasan a ser chips del mismo carril | `messaging.html`, `messaging.ts`, `messaging.css` |
| 2 | Bandeja que no se sale en el teléfono: columnas `minmax(0, 1fr)`, fila en rejilla fija, estado `:active` | `messaging.css`, `conversation-list.css` |
| 3 | ALOVIDA Pulse en el chat: aro del contador de no leídos, botones del composer que se hunden, burbuja ajena que llega en vivo | `conversation-list.css`, `composer.css`, `thread/live-arrivals.ts`, `thread.html` |

Lo que **no** se trajo, a propósito: de `mockup` salen también `slug` en lugar de
`profileId`, `#fff`/`rgb()` sueltos y los textos con «aquí/aparecerá». `dev` ya
tiene la versión nueva de cada uno y portarlos habría sido un retroceso.

## Evidencia de navegador

`ng serve --configuration development,demo`, cuenta `medica@alovida.mock`,
Chromium. Script: [`verificar-chat.js`](verificar-chat.js).

| Medida | 1440×900 | 390×844 |
|---|---|---|
| Carril: `scrollWidth` / `clientWidth` | 584 / 239 | 584 / 270 |
| Flecha «anterior» al inicio | apagada | apagada |
| Tras «siguiente», `scrollLeft` | 178, ambas encendidas | 178, ambas encendidas |
| «Archivados» `aria-pressed` al pulsar y al volver a pulsar | `true` → `false` | `true` → `false` |
| Fila más a la derecha / borde del panel | 599 / 600 | 390 / 390 |
| Desborde horizontal del documento | no | no |
| `animation-name` del contador de no leídos | `pulse-ring` | `pulse-ring` |
| `transform` del botón del composer con el dedo abajo | `matrix(0.92, …)` | `matrix(0.92, …)` |
| Errores de consola | ninguno | ninguno |

La altura de fila medida es 80 px, no 72: `src/styles/paciente.css` la fija en
80 para el shell rediseñado, igual que en `mockup`. Los 72 px son la base.

Capturas: `escritorio-01-bandeja.png`, `escritorio-02-carril-desplazado.png`,
`movil-01-bandeja.png`, `movil-02-carril-desplazado.png`,
`movil-03-archivados.png`, `movil-04-hilo-composer.png`.

## Pruebas

`yarn ng test --include='src/app/features/messaging/**/*.spec.ts'`: 10 archivos,
128 pruebas, todas verdes. Nuevas: el carril y el chip de «Archivados»
(`messaging.spec.ts`) y «el historial no anima; sólo la burbuja ajena que llega
después» (`thread.spec.ts`). `tsc` de la app y `eslint` del chat limpios;
`check-max-lines` sin hallazgos nuevos.

## Lo que no se demostró

- No corrió la suite completa (`yarn test`, ~140 s) ni Playwright contra la API real.
- La llegada de una burbuja en vivo se demuestra con prueba unitaria; en el
  navegador solo se midieron el contador y el composer.
- `test` sigue sin esto y sin la función de adjuntar con editor de imagen:
  este cambio es solo para `dev`.
- Chequeos que ya fallaban antes de este cambio y siguen igual:
  `check-css-tokens`, `check-architecture`, `check-colores-sueltos`,
  `check-usted`, `check-english-identifiers`, y `check-max-lines` en
  `chat.store.ts` y `thread.css`.
