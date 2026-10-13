# REPORT — Carril 35 · CORR-05

## Veredicto: VISUAL VERIFIED; regresión completa no verificada

La pantalla `/notification-center` ahora presenta pestañas Todas, Sin leer, Consultas, Mensajes, Recetas y Red. Se agregó Preferencias en la cabecera y se conectaron carga, vacío y errores al organismo `app-view-state-host`, con el identificador de soporte visible en S9. Las categorías filtran los resultados cargados; el cursor sigue permitiendo cargar páginas posteriores.

La implementación general de notificaciones ya estaba en `origin/mockup` (`6e951a485`); la línea base de esta rama es ese mockup previo a los cambios adicionales de cumplimiento. La especificación menciona `/notifications`, pero el router vigente declara `/notification-center`; el inventario de Playwright y la evidencia usan la ruta real.

## Rutas y mediciones

| Ruta | 375 claro | 768 claro | 1440 claro | 1440 oscuro | Fondo claro | Centrado | Ancho ≥85 % | Scroll | Consola |
|---|---|---|---|---|---|---|---|---|---|
| `/notification-center` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

Matrices: [antes](MATRIZ-visual-antes.md) · [después](MATRIZ-visual.md). La línea base y el resultado final tienen 4 celdas cada una, 0 rojas. En producción el tema oscuro se fija mediante `mantra-core-health.theme`; el auditor ahora establece explícitamente esa preferencia para que la prueba mida el tema pedido, no sólo `prefers-color-scheme`.

## Fotos

- Antes: [375 claro](fotos/antes/notificaciones-375-claro.png), [768 claro](fotos/antes/notificaciones-768-claro.png), [1440 claro](fotos/antes/notificaciones-1440-claro.png), [1440 oscuro](fotos/antes/notificaciones-1440-oscuro.png).
- Después: [375 claro](fotos/despues/notificaciones-375-claro.png), [768 claro](fotos/despues/notificaciones-768-claro.png), [1440 claro](fotos/despues/notificaciones-1440-claro.png), [1440 oscuro](fotos/despues/notificaciones-1440-oscuro.png).

Revisé las capturas en móvil y escritorio, claro y oscuro. La de oscuro muestra la superficie oscura y las seis pestañas sin overflow horizontal.

## Comandos y salida

- `corepack yarn env:generate && corepack yarn typecheck` → PASS.
- ESLint dirigido a `notification-center.ts`, `.html`, `.spec.ts` y `playwright/corr-evidencia.spec.ts` → PASS.
- Specs de `notification-center` y `notification-presentation` → 2 archivos, 27 pruebas PASS.
- `corepack yarn build` → PASS; quedan avisos CommonJS/prerender y advertencias NG8113 en componentes ajenos.
- `scripts/corr-evidencia.sh 35 --antes` contra `origin/mockup` en SSR → PASS, 4 celdas.
- `scripts/corr-evidencia.sh 35` en SSR → PASS, 4 celdas.
- `corepack yarn lint` → FAIL global, 269 errores del repositorio. Los archivos tocados pasan el ESLint dirigido.
- `corepack yarn test --watch=false`: antes, sobre `origin/mockup` (`c36a0188f`), 10.633 aprobadas y 74 fallidas (10.707 total); después, 10.633 aprobadas y 76 fallidas (10.709 total). Las dos fallas netas adicionales aparecen en `practitioner-detail.spec.ts`, `insurance-portability.handlers.spec.ts` y `clinical.handlers.spec.ts`; desaparece la falla de `pdf-logo.spec.ts`. Ninguno de esos archivos se modifica en esta rama. La cantidad de aprobadas se mantiene; no se declara regresión aprobada porque el total de fallas sube en dos. Los fallos repetidos dominantes son 66 casos preexistentes de `medication-block.spec.ts`.
- `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1` → FAIL antes de iniciar el barrido: la API local no está viva (`apiViva` esperado true, recibido false).

## Bugs encontrados / corregidos

- El diseño previo sólo ofrecía Todas y Sin leer, y no enlazaba Preferencias. Se agregaron las cuatro pestañas requeridas y el acceso a `/settings`.
- La carga mostraba una alerta genérica sin código de soporte. Ahora usa `errorToViewState` y `app-view-state-host`, comprobado con una respuesta `INTERNAL` que trae `correlationId`.
- El auditor tomaba `colorScheme` como si eligiera el tema de la app. Se agregó la preferencia persistida a ambos contextos de navegador; no se relajaron mediciones ni aserciones.

## Riesgos residuales

- La regresión completa queda sin aprobar: al comparar base y rama, las aprobadas quedan en 10.633, pero las fallidas suben de 74 a 76 en specs ajenos a este cambio. Debe repetirse la suite en un entorno estable y revisar esos fallos antes de elevar el claim.
- Las pestañas de categoría filtran las páginas ya cargadas; si una página no contiene coincidencias, se informa y se ofrece cargar más. La API sólo soporta el filtro de no leídas.
- El lint global falla en 269 errores no acotados a CORR-35. La suite completa y route-health deben ejecutarse antes de elevar el claim de regresión.
- La implementación original ya existe en `mockup`; el PR de esta rama cubre las brechas y su evidencia.

## Decisiones

- Se conserva `/notification-center` porque es la ruta registrada en `app.routes.ts`; no se crea un alias `/notifications` sólo para la ficha antigua.
- Consultas, mensajes, recetas y red son filtros locales sobre las páginas acumuladas. «Ver más» sigue el cursor de la bandeja sin alterar el orden del backend.
