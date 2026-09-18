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

## Siguiente (propuesto, por prioridad)

| ID | Resultado | Archivos probables | Tamaño · incertidumbre |
|---|---|---|---|
| N-01 | Confirmar H-14 en build SSR y, si ocurre, alinear el hash de la CSP | `src/server/security-headers.ts`, `index.html` | S · media |
| N-02 | Llevar el patrón «próximas primero + acción arriba» a «Mis pedidos», «Mis resultados», «Mis órdenes» | `features/account/{pharmacy-orders,diagnostic-results,diagnostic-orders}` | M · baja — reutilizar `splitUpcomingAndPast` sólo si tienen fecha futura |
| N-03 | Pasar `rowLabel` en las 23 tablas restantes | plantillas con `<app-data-table>` | M · baja |
| N-04 | Panel de la médica (H-10) tras decisión D-05 | `features/dashboard/` | S · decisión de producto |
| N-05 | «Hasta» sola a 1280 (H-15) | `appointments.css` | S · baja |
| N-06 | Literales de movimiento de `styles/alovida.css` | 1 hoja | S · baja |
| N-07 | Lector de pantalla + Safari/Firefox sobre el piloto | — | S |
