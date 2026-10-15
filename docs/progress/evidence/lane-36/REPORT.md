# REPORT — Carril 36 · CORR-06
## Veredicto: VERIFIED_FUNCTIONAL_ONLY

La implementación cumple el alcance funcional y visual observado. La regresión completa mantiene los fallos preexistentes, con un fallo menos que la línea base. No declaro `VERIFIED` porque `carril-19-route-health.spec.ts` no pudo recorrer las rutas sin la API local, la suite global conserva fallos y el verificador Fable del repositorio no está disponible.

## Rutas

| Ruta | 375 | 768 | 1440 | oscuro | fondo | centrado | ancho | scroll | consola |
|---|---|---|---|---|---|---|---|---|---|
| `/my-account/identity` | PASS | PASS | PASS | PASS | PASS | PASS | PASS (≥85 %) | PASS | PASS |
| `/my-account/identity?tab=cases` | PASS | PASS | PASS | PASS | PASS | PASS | PASS (≥85 %) | PASS | PASS |
| `/my-account/identity/cases` | redirección PASS | redirección PASS | redirección PASS | redirección PASS | — | — | — | — | PASS |
| `/my-account/identity/cases/<caseId>` | diálogo PASS | diálogo PASS | diálogo PASS | diálogo PASS | — | — | — | — | PASS |
| `/my-account/identity/verify` | redirección PASS | redirección PASS | redirección PASS | redirección PASS | — | — | — | — | PASS |

La matriz automatizada mide 20 celdas, 0 en rojo. El requisito de fondo blanco también se verificó en tema oscuro según las instrucciones del workspace.

## Fotos (rutas relativas)

- Capturas antes y después: `fotos/antes/` y `fotos/despues/`.
- Matriz posterior (20 celdas): [`MATRIZ-visual.md`](MATRIZ-visual.md).
- Línea base (8 celdas): [`MATRIZ-visual-antes.md`](MATRIZ-visual-antes.md).
- Se revisaron visualmente las 20 capturas posteriores y capturas representativas de la línea base.

## Comandos y salida (literal, recortada)

- `E2E_BASE_URL=http://127.0.0.1:4200 scripts/corr-evidencia.sh 36 --antes` — 8 celdas; 2 rojas por la regla genérica de fondo oscuro que no correspondía a la regla explícita de fondo blanco de este carril.
- `E2E_BASE_URL=http://127.0.0.1:4200 scripts/corr-evidencia.sh 36` — `1 passed`; 20 celdas, 0 rojas.
- `corepack yarn typecheck` — PASS.
- ESLint dirigido a archivos modificados — PASS.
- `corepack yarn build` — PASS; emitió advertencias preexistentes de tamaño de bundles/CSS y CommonJS.
- Specs dirigidos de identidad — `3 files, 36 tests passed`.
- `node scripts/check-route-prefixes.mjs` — PASS; 269 rutas, sin colisiones con 79 prefijos de API.
- `corepack yarn test --watch=false` en base `c36a0188f` — `775 files, 10,633 passed, 74 failed; 10,707 total`.
- El mismo comando en esta rama — `775 files, 10,635 passed, 73 failed; 10,708 total`. No aumentaron fallos; hay 2 pruebas más aprobadas y 1 fallo menos que en la base.
- `corepack yarn lint` — FAIL por 269 errores preexistentes globales; ESLint dirigido pasa.
- `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1` — bloqueado antes de recorrer rutas porque la API local no está disponible (`apiViva=false`); un caso falla y tres se omiten por esa condición.
- `python3 -S scripts/atlas/fable-proof-check.py --lane 36` — no ejecutable: `scripts/atlas/fable-proof-check.py` no existe en este checkout.
- `corepack yarn pw playwright/fable-matriz-roles.spec.ts --workers=1` — no se completó: esta matriz general recorre todas las rutas para cinco cuentas y dos viewports, con timeout de una hora; no forma parte del comando de regresión de CORR-36. La regresión obligatoria de suite completa sí se comparó con la base.

## Bugs encontrados / corregidos

- Los mocks ahora exhiben casos de demostración en estados distintos: verificado, abierto y rechazado, con fechas relativas al reloj fijado en 2026.
- La vista unificada elimina la tarjeta duplicada de trámites anteriores en la pestaña de verificación.
- El detalle de un trámite abre un diálogo compartible y restaura su estado desde `?tab=cases&case=<id>`; se preservan redirecciones de rutas anteriores.
- El chequeo oscuro genérico de la línea base esperaba una superficie oscura. La regla del workspace exige fondo blanco en todas las vistas, así que el chequeo específico de este carril se ajustó a esa regla; no se cambió el criterio de otros carriles.

## Riesgos residuales

- La suite global conserva 73 fallos; la comparación con la base del mismo commit muestra que no son regresiones de esta rama (74 fallos antes).
- La suite `lint` global ya falla en la base del proyecto; el análisis dirigido de los archivos tocados sí pasa.
- La verificación de salud de rutas que depende de API requiere que el servicio API esté disponible.
- Falta el script `scripts/atlas/fable-proof-check.py`; no fue posible completar esa validación automatizada.
- No se inspeccionó manualmente el panel Network del navegador; la evidencia de red se limita a respuestas 5xx y errores de consola medidos por Playwright.

## Decisiones

- Se mantiene el trabajo como complemento de la implementación que ya existe en `mockup`; este cambio termina los criterios restantes de CORR-36.
- Se usa la hora fijada `2026-10-14T12:00:00-04:00` para que fechas y estados de demo sean reproducibles.
- Se acepta fondo blanco en modo oscuro por la regla explícita del cliente para todas las vistas.
