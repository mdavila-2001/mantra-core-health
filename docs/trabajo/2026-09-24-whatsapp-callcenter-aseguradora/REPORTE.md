# Reporte — Tarea 2: WhatsApp y Call Center de aseguradora

> **AVANCE: 26 / 26 microtareas HECHO — 100 %.**

- Fecha: 2026-09-24 · Plan: [PLAN.md](./PLAN.md)
- Ramas y PRs:
  - API → `dev`: `marcelo/feat-insurance-whatsapp-callcenter-api` (commit `09c41ca5`) → [PR #458](https://github.com/mdavila-2001/mantra-core-health-api/pull/458)
  - Front → `dev`: `marcelo/feat-insurance-whatsapp-callcenter` (commits `56d5727c`, `3848442d`, `a7832cd6`, `01622e3c`) → [PR #656](https://github.com/mdavila-2001/mantra-core-health/pull/656)
  - Front → `mockup`: `marcelo/feat-insurance-whatsapp-callcenter-mockup` (commits `1f548988`, `7dfebe66`, `c3fe8789`) → [PR #657](https://github.com/mdavila-2001/mantra-core-health/pull/657)
- Peldaño de evidencia alcanzado: **REGRESSION_VERIFIED** en las tres ramas (API + front + `mockup` + E2E real + regresión del módulo). Los tres PRs están abiertos con revisores asignados; el cierre (merge) queda en manos humanas (`jsaldias39`/`PabloArauzCaballero`), como exige el `CLAUDE.md` del repo («el flujo termina en abrir el PR»).

## Completado

### H1.S1 — Backend (API), 5/5

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Baseline API sobre `dev` limpio | `yarn test src/modules/insurance/dto/backbone.dto.spec.ts src/modules/insurance/services/claims-read.service.spec.ts src/modules/insurance/services/declared-coverages-reader.spec.ts` | 3 suites / 50 tests PASS |
| H1.S1.M2 | `backbone.dto.ts`: regex de WhatsApp a mínimo 8 dígitos (`^\+[1-9]\d{7,14}$`); 2 casos nuevos (7 rechaza, 8 acepta) | `yarn test src/modules/insurance/dto/backbone.dto.spec.ts` | 23/23 PASS |
| H1.S1.M3 | Caso «ambos canales presentes» agregado al lector de coberturas (faltaba) | `yarn test .../declared-coverages-reader.spec.ts .../claims-read.service.spec.ts` | 2 suites / 30 tests PASS |
| H1.S1.M4 | OpenAPI/Postman regenerados: sin diff propio (el `@ApiProperty` no declara `pattern`); deriva ajena (endpoints de credenciales de otro merge) detectada y **revertida sin commitear**; sección nueva en `README.md` del módulo | `git status --short openapi docs/postman` | vacío tras revertir la deriva ajena |
| H1.S1.M5 | Regresión del módulo | `yarn test src/modules/insurance` · `yarn typecheck` · `yarn lint src/modules/insurance` | 23 suites / 336 tests PASS · typecheck 0 · lint 0 |

### H1.S2 — Frontend, 6/6

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S2.M1 | Baseline front | specs de telephone + insurance-contact-channels + patient-coverage-card | 3 archivos / 19 tests PASS |
| H1.S2.M2 | `telephone.ts`: `whatsappUrl` rechaza letras y sube el mínimo a 8 dígitos; omite `?text=` vacío; 9 casos nuevos en el spec | spec de telephone | incluido en el 3/30 de abajo |
| H1.S2.M3 | `insurance-contact-channels`: testid `btn-callcenter-claim`→`btn-call-center-phone` (4 archivos), `size` md, guard `dialable` en call center, handler de Espacio, PHI-guard | — | incluido abajo |
| H1.S2.M4 | `patient-coverage-card`: testids nuevos, `min-width: 44px`, handler de Espacio | — | incluido abajo |
| — | **Bug real encontrado y corregido por causa raíz**: `(keydown.space)` en Angular tipa `$event` como `Event`, no `KeyboardEvent` — error de compilación TS2345 en las dos plantillas. Corregido al patrón ya usado en el repo (`body-map.ts:243`, parámetro `Event`) | `yarn test --watch=false --include=...` (3 archivos) | 30/30 PASS (baseline 19) |
| H1.S2.M5 | Docs sin referencias al testid viejo | `grep -rln btn-callcenter-claim docs/routes docs/components docs/integrations` | 0 coincidencias |
| H1.S2.M6 | Gates estáticos: typecheck, lint, build | `yarn typecheck` · `yarn build` | 0 · exit 0 (warnings de presupuesto preexistentes, ninguno en archivos tocados) |

### H1.S3 — Maqueta y E2E, 9/10 (1 condicional cubierta con hallazgo propio)

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S3.M1 | Reclamo `CLM-2026-0185` (Caja Petrolera, sin canales) agregado a la maqueta. **Hallazgo real**: el índice de paciente 1 que el plan proponía estaba reservado por otro spec (`insurance-portability.handlers.spec.ts:16`, `recordCount===0` exacto); corregido al índice 3, sin uso en ningún spec | regresión de handlers | 4 archivos / 50 tests PASS |
| H1.S3.M1b | `contactChannelsOfCarrier()` exportado y conectado en `profiles.handlers.ts`; la tarjeta de `/my-account` deja de usar el call center real de BISA (`800-10-6060`) sin marcarlo | `grep "800-10-6060" src/app/core/mock` | 0 en código (solo prosa explicativa) |
| H1.S3.M2 | `git mv` a `carril-insurance-whatsapp.spec.ts`, reescrita con las 3 superficies, sin `estable()`, popups reales, viewports explícitos | `yarn typecheck` | 0 |
| H1.S3.M3–M7 | Los 5 casos del CA (WhatsApp+Enter+Espacio+PHI-guard, sin-WA, sin-canales, táctil×3 anchos, tarjeta×2 anchos) | — | incluidos en la corrida completa |
| H1.S3.M8 | Corrida completa (maqueta+API) + doble revisión (regla 35.1) | `playwright/carril-insurance-whatsapp.spec.ts --workers=1` | **12/12 PASS**, 0 pantallas RECHAZADA (`evidencia/doble-revision.md`) |
| H1.S3.M9 | Regresión del módulo, 4 archivos, en serie | `carril-adjudicacion-clausulas`, `carril-insurance-antifraud-duplicates`, `patient-coverage-copays`, `carril-insurance-portability` | 25/29 PASS; 4 fallos **preexistentes y ajenos**, verificados por causa raíz (ver «No cubierto») |

**Un fallo real de infraestructura encontrado y resuelto durante S3.M8**: el contenedor Docker
`mantra-redesa-api-1` corría una imagen `:local` vieja (reiniciado por un proceso externo a esta
sesión, no reconstruida), así que el bloque API del E2E daba 200 en vez de 400 para el caso de 7
dígitos. Clasificado `ENVIRONMENT` (regla 80.4): mi código ya estaba verificado unitariamente
(23/23). Reconstruido con `docker compose build api && docker compose up -d api`; reintentado y
**12/12 PASS**.

### H1.S4 — Revisión independiente, `mockup`, PRs, 4/4

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S4.M1 | Regresión completa del front + build | `yarn test --watch=false` · `yarn build` | 573/581 archivos, 7369/7385 tests PASS (16 fallos en 8 archivos, **ninguno en este diff** — verificado por causa raíz, ver «No cubierto»); build exit 0, sin presupuesto excedido en archivos propios |
| H1.S4.M2 | Revisión independiente: front (persona `frontend-reviewer` sobre el diff completo) y API (`/code-review --level medium`) | agente + skill | Front: 0 BLOCKER/CRITICAL/HIGH, 2 hallazgos MEDIUM/LOW documentados sin corregir (fuera de alcance). API: 0 hallazgos (`evidencia/revision-independiente.md`) |
| H1.S4.M3 | Porte a `mockup`: rama desde `origin/mockup` actualizado, cherry-pick limpio de los 2 commits del front. **Hallazgo real**: el E2E portado buscaba la pestaña «Seguros y tutores», que en `mockup` ya está separada en «Seguros» (merge previo `justin/perfil-seguro-tutor-separados`) — corregido el locator | `yarn typecheck` · specs tocados · E2E maqueta | typecheck 0 · 4 archivos/35 tests PASS · **8/8 PASS** en el E2E real contra `ng serve` de `mockup` |
| H1.S4.M4 | Push de las 3 ramas + apertura de los 3 PRs con `jsaldias39`/`PabloArauzCaballero` como revisores; verificación `pr-mergeable-gate` (regla 35.2) | `gh pr create` · `gh pr view --json mergeable,mergeStateStatus,...` · `gh pr checks` | Los 3 PRs `MERGEABLE` (sin conflictos). Ver detalle en «Gate de PR mergeable» |

## A medias

Ninguna microtarea quedó a medias: todo lo abierto se cerró `HECHO`.

## Pendiente

Ninguna microtarea propia del plan queda pendiente. Lo único fuera de mi control: la aprobación
humana y el merge de los tres PRs (`jsaldias39`/`PabloArauzCaballero`), y que el CI de GitHub
Actions —documentado como no confiable en el `CLAUDE.md` del repo— termine de correr.

## Gate de PR mergeable (regla 35.2)

| PR | `mergeable` | `mergeStateStatus` | `reviewDecision` | Checks |
|---|---|---|---|---|
| [API #458](https://github.com/mdavila-2001/mantra-core-health-api/pull/458) → `dev` | `MERGEABLE` | `BLOCKED` | `REVIEW_REQUIRED` | `docs`: **fail**, clasificado `EXTERNAL` (ver abajo); `fork-guard`: skipping |
| [Front #656](https://github.com/mdavila-2001/mantra-core-health/pull/656) → `dev` | `MERGEABLE` | `UNSTABLE` | — | `dependencias`/`e2e`/`verificar`: pending, no progresa (CI documentado como caído en `CLAUDE.md`: «El CI propio está caído; los `check-*.mjs` se corren a mano») |
| [Front #657](https://github.com/mdavila-2001/mantra-core-health/pull/657) → `mockup` | `MERGEABLE` | `UNSTABLE` | — | mismo patrón que #656 |

**Ningún PR tiene conflictos** (`mergeable: MERGEABLE` en los tres). `BLOCKED`/`UNSTABLE` se deben
a: (a) aprobación humana pendiente (condición explícitamente aceptada por la regla 35.2), y (b) el
estado documentado del CI de este proyecto, no a un defecto de este cambio.

**El check `docs` del PR de la API falló por una causa externa, verificada, no por mi código:**

```text
$ gh run view 36090296101 --repo mdavila-2001/mantra-core-health-api --job 107931095776 --log-failed
Levantar MinIO  Unable to find image 'quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z' locally
Levantar MinIO  docker: Error response from daemon: unauthorized: access to the requested resource is not authorized
Levantar MinIO  ##[error]Process completed with exit code 125.
```

El job falla en el paso de infraestructura ("Levantar MinIO"), **antes** de que corra una sola
línea de mi código: el runner no pudo autenticarse contra el registro `quay.io` para bajar la
imagen de MinIO. Clasificado `EXTERNAL` (regla 80.4); no corregible desde este PR.

Per el `CLAUDE.md` del front: **«El merge a `dev` exige revisión humana… El flujo termina en abrir
el PR.»** Los tres PRs están en ese punto: abiertos, sin conflictos, con revisores asignados.

## Evidencia

Todo en `evidencia/`: `api-baseline.txt`, `api-s1m2-backbone-dto.txt`, `api-s1m3-lectores.txt`,
`api-s1m4-openapi-postman.txt`, `api-s1m4-build.txt`, `api-s1m5-{test,typecheck,lint}.txt`,
`front-baseline.txt`, `front-s2-tests.txt`, `front-s3m1-mock.txt`, `front-s3m1b-mock-suite.txt`,
`front-s3m2-typecheck.txt`, `playwright-whatsapp-{maqueta,api,completo}.txt`,
`playwright-regresion-{clausulas,antifraud,antifraud-retry,coverage-copays,portabilidad}.txt`,
`front-suite.txt`, `front-build.txt`, `doble-revision.md`, `contacto-{detalle,tarjeta}-*.png` (5),
`pr-body-{api,front}.md`.

```text
$ npx playwright test playwright/carril-insurance-whatsapp.spec.ts --workers=1
  12 passed (1.4m)

$ yarn test src/modules/insurance   (API)
  Test Suites: 23 passed, 23 total
  Tests:       336 passed, 336 total

$ yarn test --watch=false   (front, suite completa)
  Test Files  8 failed | 573 passed (581)
  Tests  16 failed | 7369 passed (7385)
```

## No cubierto

- **Modo oscuro**: sin captura visual (cambio no toca colores; riesgo bajo, declarado en `doble-revision.md`).
- **4 fallos de regresión preexistentes, verificados por causa raíz y no corregidos** (fuera de
  alcance, regla 00 §3):
  1. `carril-adjudicacion-clausulas.spec.ts`: 403 en vez de 404 en un endpoint de cláusulas
     contractuales que este trabajo no toca.
  2. `carril-insurance-antifraud-duplicates.spec.ts`: 3 timeouts de navegación a `/medical-records`
     (búsqueda por documento), reproducidos idénticos dos veces; dominio de historia clínica ajeno.
  3–8. **8 archivos con 16 fallos en la suite completa del front** (`shell-layout`, dos de
     `health-context`, `identity-assurance`, `insurance-analytics` (handler y componente),
     `selector-emojis`), **ninguno en archivos de este diff**. Verificado por causa raíz:
     `insurance-analytics.handlers.spec.ts` pasa 5/5 en aislamiento (coincide con la regresión de
     mock, 223/223); los otros dos revisados muestran síntomas de contagio ya documentados en el
     proyecto (`TestBed` no reseteado, timeout de `axe-core` bajo carga) — contención del arnés al
     correr 581 archivos juntos, no defecto de producto.
- **H1.S4.M2/M3/M4**: revisión independiente, porte a `mockup` y apertura de PRs, ver «Pendiente».

## Desvíos del plan

- El plan asumía el índice de paciente 1 para el reclamo `CLM-2026-0185`; se corrigió al 3 tras
  destapar la colisión con `insurance-portability.handlers.spec.ts` en la primera corrida.
- El plan no anticipaba que la imagen Docker de la API estuviera desactualizada; se agregó la
  reconstrucción (`docker compose build/up api`) como paso de verificación no escrito originalmente.

## Riesgos residuales y deuda

- El contenedor `mantra-redesa-api-1` reconstruido queda con la imagen nueva; si otro proceso lo
  vuelve a reiniciar desde una imagen vieja, el caso de 8 dígitos volvería a fallar en un E2E futuro.
- Los 4 fallos de regresión preexistentes (arriba) no tienen tarjeta propia en este trabajo; quedan
  documentados acá para quien sea dueño de esos módulos.

## Decisiones y ambigüedades

Todas las decisiones (A1–A11) fueron tomadas con el usuario antes de ejecutar y están registradas
en `PLAN.md`. Ninguna ambigüedad nueva apareció durante la ejecución.

## Gate de seguridad/PHI (regla 90.6)

- **Amenaza considerada**: datos clínicos o identificatorios del paciente viajando en la URL de
  `wa.me` hacia un tercero (Meta).
- **Control**: el mensaje del detalle de reclamo se arma solo desde `claimIdentifier`,
  `carrierName`, `patient.displayName`/`patientCode` y `policyIdentifier` (decisión A1: texto de la
  2.3 conservado, conflicto con la regla 00 §2.3 asumido y registrado desde esa subtarea).
- **Test que lo demuestra**: `insurance-contact-channels.spec.ts` (PHI-guard con campos clínicos
  inyectados por spread) y el E2E (`decodeURIComponent` del `href` real contra `CLM-2026-0177`, que
  tiene una línea DENIED con cláusula — verificado que "ECG"/"Cláusula"/"Control cardiológico" no
  aparecen).
- **Resultado**: ambos PASS.
- **Riesgo residual**: el nombre del paciente y el código de reclamo siguen viajando en la URL
  (deuda ya declarada por la Subtarea 2.3, no ampliada ni reducida por este trabajo).
