# Reporte — Port del front del carril 16 (PR #1227) a test

- Fecha: 2026-10-25 · Plan: [PLAN.md](./PLAN.md) · Rama: `marcelo/lane16-insurance-ui-test` → PR #1378 a `test`
- Peldaño de evidencia alcanzado: `VERIFIED` para la maqueta (Playwright 25/25 + 2 capturas con doble revisión); `TESTED` para el resto. No `REGRESSION_VERIFIED`: `test` ya tiene la suite en rojo (ver «Riesgos residuales»).
- Avance: 6 / 7 microtareas HECHO (85,7 %). Falta H2.M7 solo por la revisión humana que exige `test`.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H2.M1 | El mismo cambio de #1377 sobre `origin/test`, sin conflictos | `git diff --cached --stat origin/test` | 33 archivos de `src/` y `playwright/` |
| H2.M2 | Typecheck | `yarn typecheck` | exit 0, 0 errores TS ([01](./evidencia/01-typecheck-test.txt)) |
| H2.M3 | Specs dirigidos sin fallos nuevos | `yarn test --include=…` | 118 archivos, 1325 pruebas: 2 fallos, ambos ya presentes en la base ([02](./evidencia/02-tests-dirigidos-test.recortada.txt)) |
| H2.M4 | Suite completa comparada con la base | `yarn test` con y sin el port | ver «Evidencia» ([base](./evidencia/03-test-completo-base-test.recortada.txt), [con port](./evidencia/03-test-completo-con-port-test.recortada.txt)) |
| H2.M5 | Lint de los archivos tocados | `yarn eslint <archivos>` | exit 0, sin salida ([04](./evidencia/04-lint-archivos-test.txt)) |
| H2.M6 | Playwright del cobro contra la maqueta | `yarn pw playwright/carril-16-cobro-con-seguro.spec.ts` | `25 passed (34.4s)` ([07](./evidencia/07-playwright-cobro-con-seguro-test.txt)) |

`PR #1378` — `MERGEABLE` · `CLEAN` · sin checks reportados (el CI propio está caído) · consultado 2026-10-25 20:42 tras el push `031dcf3ed` ([08](./evidencia/08-pr-1378-mergeable.txt)).

## A medias
### H2.M7 — PR a test mergeable
- Qué anda: el PR está abierto, fuera de draft, `MERGEABLE` y `CLEAN`.
- Qué no anda: nada falla en el PR.
- Qué falta exactamente: la revisión humana; en este repo `gh pr merge` y el auto-merge están bloqueados.
- Dónde quedó: PR #1378.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| Specs en rojo de `origin/test` | TODO, fuera de alcance | Un PR propio a `test`; ver #1293 para el caso de `received-claims` |

## Evidencia
- Suite completa en `origin/test` limpio (`78d8b7a1a`): 12 archivos fallan, 98 pruebas (`standard-sheets`, `patient-list`, `billing` 28, `design-system-sample`, `form-builder` 72, `received-claims` 40, `pharmacy-inbox`, `pharmacy-categories`, `pharmacy-import`, `pharmacy-inventory`, `inventory-upload-dialog`, `pharmacy-products`).
- Suite completa con el port: 15 archivos fallan, 69 pruebas. Los 12 de la base (con distinta cantidad de pruebas rotas: `billing` 1 y `received-claims` 1) más 3 que no fallaban: `spinner`, `paginated-form` y `promotion-rule-editor`, 1 prueba cada uno, con el mensaje «Cannot configure the test module when the test module has already been instantiated». Corridos aparte pasan: 3 archivos, 94/94 ([03b](./evidencia/03b-tres-extra-aislados-test.txt)). Ese error es de contaminación de `TestBed` dentro de un mismo worker; **no demostré qué prueba la causa**.
- Los fallos dirigidos de seguros en test: `received-claims` «anular la factura pide motivo y lo manda» y `standard-sheets` «son tantas como los JSON» (370 ≠ 374). Los dos fallan también en la base.
- Doble revisión de capturas: solo `pagos-dialogo-1280-light` y `-dark` ([capturas/](./evidencia/capturas/)); el spec generó otras 26 que **no miré** y se borraron.
  - Primera pasada (la médica cotiza en «Pagos» y ve el reparto del servidor): cumple, 50,00 + 450,00 = 500,00, y convive con los totales de `Pagos de la persona`.
  - Segunda pasada (postura de rechazo): **ACEPTABLE CON RESERVAS**, ninguna `RECHAZADA`. Las reservas son las del port a dev (formato «50.00 Bs» frente a «Bs 180,00» en el mismo diálogo, texto corrupto del nomenclador simulado, UUID cortado por el principio en el campo de aprobación previa, resumen que repite la única línea). Las capturas en test son idénticas a las de dev.
- Las capturas de desglose y objeción del paciente **no se revisaron en test**; se revisaron en dev (ver el reporte del PR #1377) con el mismo código.

## No cubierto
- Playwright contra la **API real** (`carril-16-solicitudes-de-seguro.spec.ts`): requiere la semilla de la API local; no se ejecutó.
- Contra la API real, cotizar con seguro, el desglose y la objeción no funcionan de punta a punta (faltan `GET /patient-coverages/by-patient` y `breakdown`/`patientObjection` en `GET /insurance/my-claims`). Huecos de backend ya registrados.
- No se desplegó ni se probó en el entorno `test` publicado.
- Los chequeos manuales del repo (`check-max-lines`, `check-api-contract-drift`, …) no se corrieron en test; en dev el port empujó 2 archivos sobre su techo y agregó 3 operaciones sin declarar en `backend-api.md` (ver el reporte de #1377). El código es el mismo.
- El desglose y la objeción del paciente en navegador, sobre la base de test.

## Desvíos del plan
Ninguno.

## Riesgos residuales
- `origin/test` tiene la suite en rojo sin este cambio (12 archivos, 98 pruebas). Mientras siga así, «sin regresiones» no se puede afirmar con la suite completa; solo que los fallos nuevos aparecen como contaminación de `TestBed` y pasan aislados.
- Los conteos de la base y del port no son comparables prueba a prueba (`billing` 28 → 1 y `received-claims` 40 → 1): sospecho carga de la máquina o contaminación entre archivos, pero no lo comprobé.

## Decisiones y ambigüedades
- Se reutilizó el cambio de #1377 en vez de rehacer la resolución: el cherry-pick no tuvo conflictos sobre `origin/test`.
- Ambigüedad heredada de #1377: la maqueta ya no acepta el cobro sin cobertura. A confirmar con quien revise.
