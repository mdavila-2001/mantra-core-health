# Plan situado

## Ejecutado en esta iteración

| ID | Resultado observable | Archivos | Prueba | Reversión | Estado |
|---|---|---|---|---|---|
| T-01 | `yarn start` arranca en un clon limpio | `.gitignore`, `proxy.conf.mjs` | arranque real | `git revert 8519df72` | ✅ |
| T-02 | El cajón aloja el selector sin errores | `core/alovida/alovida-runtime.service.ts` (+spec) | unit + E2E + kill-test | `git revert 79957540` | ✅ |
| T-03 | «Mis citas»: acción arriba, próximas primero, filtros plegables | `features/account/appointments/*`, `upcoming-and-past.ts` | 12 unit + 7 E2E | `git revert 36c0864d 68d26516 36104a9d` | ✅ |
| T-04 | Una sola escala de movimiento | 35 hojas, `alovida.css`, `motion.md` | 1 327 unit + medición | `git revert a5a831e1` | ✅ |
| T-05 | Fechas sin «De» | 3 hojas | observación (1 de 3) | `git revert 7ea3cd77` | ✅ parcial |
| T-06 | Tablas: acciones visibles, indicio, nombres | `data-table/*`, `agenda.*` | 3 unit + E2E | `git revert c1390ab1` | ✅ |
| T-07 | `lint` en verde | `tools/promo/deck-aseguradoras.html` | lint | `git revert b3908f77` | ✅ |

Todos los incrementos son sólo de frontend; revertir no toca datos.

## Segunda tanda (ejecutada)

| ID | Resultado | Commit | Prueba | Estado |
|---|---|---|---|---|
| N-04 | Panel de la médica: agenda arriba, cifras al final | `9025e688` | unit + navegador 1440/390 | ✅ |
| N-05 | Filtros de «Mis citas» parejos en todos los anchos | `9b157e5c` | E2E + medición 390–1440 | ✅ |
| N-03 | `rowLabel` en 21 tablas más (+ limpieza de formato `cff3fdf9`) | `19a76565` | 87 unit + navegador en pacientes | ✅ |
| N-02a | «Mis resultados»: botones con el estudio en el nombre accesible | `73ccd9e7` | unit + navegador | ✅ |
| N-02b | «Mis órdenes» → reservar en laboratorio | `df1b8ab7` | unit + E2E | ✅ |
| N-02c | «Mis pedidos»: sin cambios — ya ordena bien y el pedido nace desde una receta (D-14) | — | — | ✅ no aplica |
| N-06 | Movimiento del marco `alovida.css` | `e7261cb4` | medición | ✅ |
| N-01 | CSP en producción | — | SSR medido: 0 errores | ✅ cerrado (sólo dev) |

## Siguiente

| ID | Resultado | Tamaño |
|---|---|---|
| N-07 | Lector de pantalla (VoiceOver) + Safari/Firefox sobre el piloto | S |
| N-08 | Consultas a 1280 px: 49 px todavía detrás del scroll (con indicio) | M — decisión sobre qué columna ceder |
| N-09 | Las 10 pruebas rojas preexistentes (H-13, H-17), en sus carriles | — |
