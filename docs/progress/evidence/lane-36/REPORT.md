# REPORT — Carril 36 · CORR-06
## Veredicto: VERIFIED_FUNCTIONAL_ONLY

La implementación cumple el alcance funcional y visual observado. La regresión completa mantiene los fallos preexistentes, con un fallo menos que la línea base. No declaro `VERIFIED` porque `carril-19-route-health.spec.ts` no pudo recorrer las rutas sin la API local, la suite global conserva fallos y el verificador Fable no tiene los prerrequisitos para cerrar este carril.

## Rutas

| Ruta | 375 | 768 | 1440 | oscuro | fondo | centrado | ancho | scroll | consola |
|---|---|---|---|---|---|---|---|---|---|
| `/my-account/identity` | PASS | PASS | PASS | PASS | PASS | PASS | PASS (≥85 %) | PASS | PASS |
| `/my-account/identity?tab=cases` | PASS | PASS | PASS | PASS | PASS | PASS | PASS (≥85 %) | PASS | PASS |
| `/my-account/identity/cases` | redirección PASS | redirección PASS | redirección PASS | redirección PASS | — | — | — | — | PASS |
| `/my-account/identity/cases/<caseId>` | diálogo PASS | diálogo PASS | diálogo PASS | diálogo PASS | — | — | — | — | PASS |
| `/my-account/identity/verify` | redirección PASS | redirección PASS | redirección PASS | redirección PASS | — | — | — | — | PASS |

La matriz automatizada mide 20 celdas, 0 en rojo. El requisito de fondo blanco también se verificó en tema oscuro según las instrucciones del workspace.

La recaptura final se hizo después de rebasar la rama sobre `mockup` (`bac6a1931`). La primera medición detectó dos superficies oscuras reales en tema oscuro (`/my-account/identity` y `?tab=cases`); se corrigió la paleta de esa vista en `src/styles/alovida.css`, sin relajar la medición. Después se repitieron las 20 celdas y se abrieron las 20 capturas finales: todas cumplen visualmente.

## Fotos (rutas relativas)

- Capturas antes y después: `fotos/antes/` y `fotos/despues/`.
- Matriz posterior (20 celdas): [`MATRIZ-visual.md`](MATRIZ-visual.md).
- Línea base (8 celdas): [`MATRIZ-visual-antes.md`](MATRIZ-visual-antes.md).
- Se revisaron visualmente las 20 capturas posteriores y capturas representativas de la línea base.

## Comandos y salida (literal, recortada)

- `E2E_BASE_URL=http://127.0.0.1:4200 scripts/corr-evidencia.sh 36 --antes` — 8 celdas; 2 rojas por la regla genérica de fondo oscuro que no correspondía a la regla explícita de fondo blanco de este carril.
- `E2E_BASE_URL=http://127.0.0.1:4200 scripts/corr-evidencia.sh 36` — `1 passed`; 20 celdas, 0 rojas.
- `CORR_EVIDENCE_DESTINATION="$PWD/docs/progress/evidence/lane-36" scripts/corr-evidencia.sh 36` — recaptura final sobre la rama rebasada; `1 passed`, 20 celdas, 0 rojas. Se revisaron las 20 fotos posteriores una por una.
- `corepack yarn typecheck` — PASS en la recaptura final con la paleta tokenizada.
- `corepack yarn lint` — FAIL con 268 errores preexistentes distribuidos por el repositorio; esta microtarea sólo toca CSS y evidencia.
- `corepack yarn eslint src/styles.css src/styles/alovida.css` — ESLint ignora ambos CSS por no tener configuración para ese formato; no se presenta como validación de CSS.
- `git diff --check` — PASS.
- `corepack yarn build` — PASS; emitió advertencias preexistentes de tamaño de bundles/CSS y CommonJS.
- Specs dirigidos de identidad — `3 files, 36 tests passed`.
- `node scripts/check-route-prefixes.mjs` — PASS; 269 rutas, sin colisiones con 79 prefijos de API.
- `corepack yarn test --watch=false` en base `c36a0188f` — `775 files, 10,633 passed, 74 failed; 10,707 total`.
- El mismo comando en esta rama — `775 files, 10,635 passed, 73 failed; 10,708 total`. No aumentaron fallos; hay 2 pruebas más aprobadas y 1 fallo menos que en la base.
- `corepack yarn lint` en base y rama — FAIL. La comparación registrada en la corrida original normalizó 269 errores en cada árbol: 0 agregados y 0 corregidos. Una repetición tras el retoque CSS informó 268 errores globales; los dos CSS son ignorados por ESLint, sin errores dirigidos atribuibles a esta microtarea.
- `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1` — bloqueado antes de recorrer rutas porque `apiViva=false`; un caso falla y tres se omiten. Se intentó iniciar la API sin permitir sincronización de esquema (`ORM_SCHEMA_SYNC=off PORT=3000 corepack yarn start:dev`), pero Nest salió con `UnknownDependenciesException`: `LinkedClaimOrderService` no resuelve `LinkedOrderDataRepository` en `InsurancePatientSettlementModule`. No se modificó el repositorio backend, que está fuera del alcance visual de CORR-36.
- `python3 -S ../scripts/atlas/fable-proof-check.py --lane 36` — FAIL: no hay claim `.claude/runtime/lane-36-claim.json` y falta `docs/progress/BUGS.md`; no se fabricó un claim de regresión verificada.
- `corepack yarn pw playwright/fable-matriz-roles.spec.ts --workers=1` — no se completó: esta matriz general recorre todas las rutas para cinco cuentas y dos viewports, con timeout de una hora; no forma parte del comando de regresión de CORR-36. La regresión obligatoria de suite completa sí se comparó con la base.

## Bugs encontrados / corregidos

- Los mocks ahora exhiben casos de demostración en estados distintos: verificado, abierto y rechazado, con fechas relativas al reloj fijado en 2026.
- La vista unificada elimina la tarjeta duplicada de trámites anteriores en la pestaña de verificación.
- El detalle de un trámite abre un diálogo compartible y restaura su estado desde `?tab=cases&case=<id>`; se preservan redirecciones de rutas anteriores.
- El chequeo oscuro genérico de la línea base esperaba una superficie oscura. La regla del workspace exige fondo blanco en todas las vistas, así que el chequeo específico de este carril se ajustó a esa regla; no se cambió el criterio de otros carriles.
- La primera recaptura sobre la base actual expuso que el tema oscuro todavía pintaba el contenido de identidad en petróleo, aunque el carril exige blanco. Se fijaron los tokens de superficie, texto, borde y controles para esta vista y se apagaron la imagen y los velos del fondo; el criterio de medición se conservó.

## Revisión de código — microtarea de paleta

- Alcance visual: PASS; sólo se cambia el token semántico blanco y el mapeo de tokens de identidad en tema oscuro.
- Límites del repositorio: PASS; no se tocaron modelo, API, secretos ni proxy.
- Criterio de fondo blanco/contraste: PASS en la matriz y en las 20 capturas inspeccionadas.
- Tokens: PASS; el bloque usa tokens existentes de `src/styles.css`; `--surface-white` queda definido una vez en la paleta central y se reutiliza en ambas hojas.
- Tema oscuro: PASS; el selector scoped conserva fondo, superficies y texto claros sólo para `app-identity-hub`.
- Pruebas debilitadas/rutas nuevas/accesibilidad nueva: no aplica; no se modificaron specs, rutas ni controles.
- Typecheck y diff: PASS. Lint global: FAIL por 268 errores ajenos; ESLint ignora CSS sin configuración para ese formato.

## Riesgos residuales

- La suite global conserva 73 fallos; la comparación con la base del mismo commit muestra que no son regresiones de esta rama (74 fallos antes).
- La suite `lint` global falla con 268 errores en la última repetición (la comparación original base/rama fue 269/269). ESLint no analiza CSS en esta configuración; los cambios CSS se verificaron con typecheck, compilación, Playwright visual y revisión manual de las 20 capturas.
- La verificación de salud de rutas requiere que la API esté disponible; su arranque actual está bloqueado por la dependencia indicada arriba, ajena a este cambio.
- El verificador Fable existe en el workspace padre, pero falla porque falta el claim de cierre y `docs/progress/BUGS.md`; no corresponde declarar regresión verificada mientras sigan pendientes los gates globales/API.
- No se inspeccionó manualmente el panel Network del navegador; la evidencia de red se limita a respuestas 5xx y errores de consola medidos por Playwright.

## Decisiones

- Se mantiene el trabajo como complemento de la implementación que ya existe en `mockup`; este cambio termina los criterios restantes de CORR-36.
- Se usa la hora fijada `2026-10-14T12:00:00-04:00` para que fechas y estados de demo sean reproducibles.
- Se acepta fondo blanco en modo oscuro por la regla explícita del cliente para todas las vistas.
