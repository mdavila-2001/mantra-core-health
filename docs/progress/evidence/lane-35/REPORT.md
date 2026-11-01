# REPORT — Carril 35 · CORR-05

## Veredicto: VISUAL VERIFIED (12/12); regresión completa no verificada

La pantalla `/notification-center` ahora presenta pestañas Todas, Sin leer, Consultas, Mensajes, Recetas y Red. Se agregó Preferencias en la cabecera y se conectaron carga, vacío y errores al organismo `app-view-state-host`, con el identificador de soporte visible en S9. Las categorías filtran los resultados cargados; el cursor sigue permitiendo cargar páginas posteriores.

La implementación general de notificaciones ya estaba en `origin/mockup` (`6e951a485`); la línea base de esta rama es ese mockup previo a los cambios adicionales de cumplimiento. La especificación menciona `/notifications`, pero el router vigente declara `/notification-center`; el inventario de Playwright y la evidencia usan la ruta real.

## Rutas y mediciones

| Estado | 375 claro | 768 claro | 1440 claro | 1440 oscuro | Celdas |
|---|---|---|---|---|---:|
| Todas | PASS | PASS | PASS | PASS | 4 |
| Sin leer (cuatro avisos reales) | PASS | PASS | PASS | PASS | 4 |
| Vacío (marcar todas como leídas y abrir Sin leer) | PASS | PASS | PASS | PASS | 4 |

Matriz [después](MATRIZ-visual.md): 12 celdas, 0 rojas. La matriz histórica [antes](MATRIZ-visual-antes.md) conserva las cuatro capturas de `/notification-center` previas a esta ampliación de evidencia. En producción el tema oscuro se fija mediante `mantra-core-health.theme`; el auditor establece explícitamente esa preferencia para medir el tema pedido y no sólo `prefers-color-scheme`.

## Fotos

- Antes: [375 claro](fotos/antes/notificaciones-375-claro.png), [768 claro](fotos/antes/notificaciones-768-claro.png), [1440 claro](fotos/antes/notificaciones-1440-claro.png), [1440 oscuro](fotos/antes/notificaciones-1440-oscuro.png).
- Después — Todas: [375](fotos/despues/notificaciones-todas-375-claro.png), [768](fotos/despues/notificaciones-todas-768-claro.png), [1440 claro](fotos/despues/notificaciones-todas-1440-claro.png), [1440 oscuro](fotos/despues/notificaciones-todas-1440-oscuro.png).
- Después — Sin leer: [375](fotos/despues/notificaciones-sin-leer-375-claro.png), [768](fotos/despues/notificaciones-sin-leer-768-claro.png), [1440 claro](fotos/despues/notificaciones-sin-leer-1440-claro.png), [1440 oscuro](fotos/despues/notificaciones-sin-leer-1440-oscuro.png).
- Después — Vacío: [375](fotos/despues/notificaciones-vacio-375-claro.png), [768](fotos/despues/notificaciones-vacio-768-claro.png), [1440 claro](fotos/despues/notificaciones-vacio-1440-claro.png), [1440 oscuro](fotos/despues/notificaciones-vacio-1440-oscuro.png).

Revisé individualmente las doce capturas. «Sin leer» muestra los cuatro avisos del simulador y «Vacío» muestra el estado vacío después de marcarlos como leídos. La captura inicial de 768 px mostró el esqueleto; reforcé la sincronización para esperar cuatro títulos y repetí el carril completo antes de conservar estas fotos. La de oscuro muestra la superficie oscura y las seis pestañas sin overflow horizontal.

## Comandos y salida

- `corepack yarn env:generate && corepack yarn typecheck` → PASS.
- ESLint dirigido a `notification-center.ts`, `.html`, `.spec.ts` y `playwright/corr-evidencia.spec.ts` → PASS.
- Specs de `notification-center` y `notification-presentation` → 2 archivos, 27 pruebas PASS.
- `scripts/corr-evidencia.sh 35` → Playwright 1 test PASS; 12 celdas, 0 rojas. Un único worker.
- `corepack yarn build` → PASS; quedan avisos CommonJS/prerender y advertencias NG8113 en componentes ajenos.
- `scripts/corr-evidencia.sh 35 --antes` contra `origin/mockup` en SSR → PASS, 4 celdas.
- `scripts/corr-evidencia.sh 35` en SSR → PASS, 4 celdas.
- `corepack yarn lint` → FAIL global, 269 errores del repositorio. Los archivos tocados pasan el ESLint dirigido.
- `corepack yarn test --watch=false`: antes, sobre `origin/mockup` (`c36a0188f`), 10.633 aprobadas y 74 fallidas (10.707 total); después, 10.633 aprobadas y 76 fallidas (10.709 total). Las dos fallas netas adicionales aparecen en `practitioner-detail.spec.ts`, `insurance-portability.handlers.spec.ts` y `clinical.handlers.spec.ts`; desaparece la falla de `pdf-logo.spec.ts`. Ninguno de esos archivos se modifica en esta rama. La cantidad de aprobadas se mantiene; no se declara regresión aprobada porque el total de fallas sube en dos. Los fallos repetidos dominantes son 66 casos preexistentes de `medication-block.spec.ts`.
- Repetición dirigida del 2026-10-15 en la rama y en `wt-corr-35-before` (`c36a0188f`): los tres specs de esas fallas (`clinical.handlers`, `insurance-portability.handlers` y `practitioner-detail`) pasaron **46/46 en ambos árboles**. La diferencia de fallos de la corrida completa no se reprodujo en este subconjunto y queda sin resolver; no se eleva el claim global por esta comprobación dirigida.
- `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1` → FAIL antes de iniciar el barrido: la API local no está viva (`apiViva` esperado true, recibido false).

## Bugs encontrados / corregidos

- El diseño previo sólo ofrecía Todas y Sin leer, y no enlazaba Preferencias. Se agregaron las cuatro pestañas requeridas y el acceso a `/settings`.
- La carga mostraba una alerta genérica sin código de soporte. Ahora usa `errorToViewState` y `app-view-state-host`, comprobado con una respuesta `INTERNAL` que trae `correlationId`.
- El auditor tomaba `colorScheme` como si eligiera el tema de la app. Se agregó la preferencia persistida a ambos contextos de navegador; no se relajaron mediciones ni aserciones.

## Riesgos residuales

- La regresión completa queda sin aprobar: al comparar base y rama, las aprobadas quedan en 10.633, pero las fallidas suben de 74 a 76 en specs ajenos a este cambio. Debe repetirse la suite en un entorno estable y revisar esos fallos antes de elevar el claim.
- Los tres specs mencionados pasaron 46/46 tanto en la rama como en la base al repetirlos; esto acota la investigación, pero no sustituye la suite completa ni explica su variación.
- Las pestañas de categoría filtran las páginas ya cargadas; si una página no contiene coincidencias, se informa y se ofrece cargar más. La API sólo soporta el filtro de no leídas.
- El lint global falla en 269 errores no acotados a CORR-35. La suite completa y route-health deben ejecutarse antes de elevar el claim de regresión.
- La implementación original ya existe en `mockup`; el PR de esta rama cubre las brechas y su evidencia.

## Decisiones

- Se conserva `/notification-center` porque es la ruta registrada en `app.routes.ts`; no se crea un alias `/notifications` sólo para la ficha antigua.
- Consultas, mensajes, recetas y red son filtros locales sobre las páginas acumuladas. «Ver más» sigue el cursor de la bandeja sin alterar el orden del backend.
