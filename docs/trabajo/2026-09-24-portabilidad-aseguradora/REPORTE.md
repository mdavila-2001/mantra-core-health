# REPORTE — Portabilidad de póliza e historial de siniestralidad a 1 clic

**Avance: 23/26 microtareas HECHO (88,5 %) · 1 BLOCKED (documentado) · 2 EN CURSO (gate de PR).**
(Denominador sin la microtarea condicional S3.M6 "pierna real", que el propio PLAN.md marca como
condicional y no obligatoria para el cierre.)

- Fecha: 2026-09-24
- Repos: `mantra-core-health-api` (rama `marcelo/feat-insurance-portability-hardening-api`),
  `mantra-core-health` (ramas `marcelo/feat-patient-insurance-portability-e2e` sobre `dev` y
  `marcelo/feat-patient-insurance-portability-mockup` sobre `mockup`).
- Fuente del requisito: `REGISTRO DE PROCESOS POR MODULO.md:499` = bóveda 6.3 · ítem 5 =
  `docs/tareas/subtarea-3.3-portabilidad-siniestralidad/`.
- Plan aprobado: `PLAN.md` (este directorio).
- PRs:
  - API → `dev`: https://github.com/mdavila-2001/mantra-core-health-api/pull/455
  - Front → `dev`: https://github.com/mdavila-2001/mantra-core-health/pull/638
  - Front → `mockup`: https://github.com/mdavila-2001/mantra-core-health/pull/639

## Completado

### Backend (API, H1.S1 — 9/9)

1. `ParseShaHashPipe` acepta el hash del verify público en mayúsculas/mixto y lo normaliza a
   minúsculas (antes 400 con la API real).
2. `generatedAt` es un único instante: `createExportJob` acepta `requestedAt` explícito; el
   servicio lo fija al mismo `generatedAt` que sella el certificado.
3. Sección `encounters` nueva en el certificado (JSON + PDF): `InsurancePortabilityRepository
   .encountersOfPatient` sobre `clinical.encounters`, sin `reason_text` (minimización PHI).
   `schemaVersion` → `alovida.insurance-portability/2`.
4. `insurance-portability-pdf.service.spec.ts` nuevo (no existía).
5. Caso "sin coberturas" cubierto en el spec del servicio (no lanza, deja constancia).
6. Ownership en descargas (`renderPdf`/`downloadJson`) y payload del `verify` (7 campos, sin PHI)
   cubiertos en el spec del servicio.
7. **`test/integration/insurance-portability.int-spec.ts` nuevo, 2/2 contra Neon real**
   (`bootstrapTestApp()` sin reset, dos cuentas por HTTP): un actor ajeno recibe 403 real sin PHI
   y queda una fila en `audit.audit_log`; el titular exporta, el JSON descargado hashea
   exactamente al `manifestHash`, y el verify público acepta el sello en MAYÚSCULAS con el mismo
   `generatedAt` que se selló. **Esta corrida destapó y permitió corregir dos bugs de producción
   reales** (ver abajo) que el spec unitario, con `EntityManager` mockeado, no podía ver.
8. Identificadores en inglés (lane-29) en los archivos propios de la subtarea: el servicio de PDF
   pasó de nombres en castellano a inglés (`buildCertificate`, `draw`, `PortabilitySheet`,
   `TableRow`…); título del PDF sin "oficial".
9. OpenAPI/Postman regenerados y sección "Portabilidad del titular" en el README del módulo.

**Dos bugs de producción encontrados y corregidos** (invisibles al spec unitario porque éste
mockea exactamente los puntos donde fallaban):

- `HealthProvenanceRecords.custodianTenantId` es NOT NULL sin default y el servicio nunca lo
  enviaba: cualquier `POST /insurance/portability/export` real terminaba en **500**. Se fija al
  tenant de plataforma, mismo criterio que ya usa `createExportJob`.
- Faltaba `await tx.flush()` entre crear el `health_export_job` y el `health_export_manifest`:
  `healthExportJobId` es una columna uuid plana, no una relación que MikroORM pueda ordenar, así
  que el manifiesto podía insertarse antes que el job y la FK
  (`fk_health_export_manifests_health_export_job_id`) lo rechazaba con **422**.

Evidencia: `yarn test src/modules/insurance src/modules/health_data` → 431/431 ·
`yarn test:integration --testPathPatterns=insurance-portability` → 2/2 (`evidencia/int-spec-neon.txt`)
· `yarn typecheck` → 0 · `yarn lint` → 0.

### Frontend (H1.S2 — 8/8)

1. `git cherry-pick` del copy honesto (commit que vivía solo en `mockup`, sin "oficial"/"firma
   digital").
2. El diálogo preselecciona **BUNDLE** (PDF + JSON) por defecto.
3. No se puede cerrar el diálogo (Escape/click de fondo) mientras está `loading`.
4. Objetivos táctiles de "Copiar hash" y las descargas ≥ 44 px en móvil.
5. Tipos + maqueta: `PortabilityEncounter`, sección `encounters` simulada, `schemaVersion` → `/2`,
   verify normaliza mayúsculas, el informe simulado usa el perfil real de quien pide (no siempre
   el mismo paciente demo).
6. Identificadores en inglés (lane-29) y testid duplicado corregido
   (`btn-generate-portability-download` repetido en dos botones).
7. Actuando por un dependiente, el diálogo exporta el historial del **titular**, nunca el del
   dependiente, con alerta `role="status"`.
8. Docs actualizadas (`docs/routes/verify-portability.md`, `docs/integrations/backend-api.md`).

### E2E Playwright (H1.S3 — 4/6, 1 BLOCKED, 1 condicional no intentada)

- M1 doble descarga del paquete completo (JSON con `schemaVersion`/2 y `encounters`) — HECHO.
- M2 actuando por un dependiente — HECHO.
- M4 objetivos táctiles y ausencia de scroll horizontal — HECHO (integrado en M1/M2).
- M5 corrida completa + doble revisión de las 4 capturas (regla 35) — HECHO,
  `evidencia/doble-revision.md`: 3 APROBADA, 1 ACEPTABLE CON RESERVAS (un toast ajeno visible en
  una esquina, cosmético, no bloquea).
- **M3 "titular sin coberturas": BLOCKED, documentado en el propio spec.** Se intentó dos veces:
  (a) `page.route()` para interceptar la llamada — imposible, porque `mockBackendInterceptor`
  nunca emite una petición de red real (responde en memoria vía RxJS `of()`/`throwError()`, jamás
  llama a `next(request)`), confirmado con un timeout de 180 s en `page.waitForResponse()`;
  (b) buscar una persona sin coberturas entre los usuarios con login en `mock-session.ts` — no
  existe ninguna. El caso sí queda cubierto por el spec unitario del mock (con coberturas
  vacías, no hereda historial de otro paciente).
- M6 "pierna real" (API local + `start:real-api`): **no intentada**, condicional por el propio
  plan; no bloquea el cierre.

Evidencia: `playwright/carril-insurance-portability.spec.ts` → 10/10 en 1440×900 y 390×844
(`evidencia/playwright-portabilidad.txt`), 4 capturas en `evidencia/`.

### Regresión y ramas (H1.S4 — 2/4 HECHO, 2 EN CURSO)

- M1 regresión API: `yarn typecheck` 0 · `yarn lint` 0 · 431/431 (insurance+health_data) — HECHO.
- M2 regresión front: rebase limpio de la rama `dev` sobre `origin/dev` (sin conflictos) ·
  `yarn typecheck` 0 · specs de portabilidad en verde · lint de los archivos propios 0 — HECHO.
  Corrida completa (`yarn test --watch=false`): 30/7374 rojos, **ninguno del carril**. 28 de esos
  30 son contaminación de pool documentada entre specs (confirmado corriendo los 8 archivos en
  aislamiento: 246/248 pasan solos, y el primer intento de aislamiento sufrió el segfault de
  esbuild ya documentado en memoria — retry limpio). Los 2 rojos reales y reproducibles son de
  `shell-layout.spec.ts`, causados por el lane de cotizaciones (PR #635, recién mergeado a `dev`)
  que agregó la ruta `/my-account/cotizaciones` sin actualizar la lista esperada del menú —
  **preexistente, fuera de alcance de este carril, no tocado**. El lint global tiene 249 errores
  preexistentes de `@angular-eslint/prefer-on-push-component-change-detection` en 196 archivos
  ajenos (ninguno de portabilidad; verificado con `eslint` acotado a los archivos propios → 0).
- M3 push + PRs: **HECHO el push y la creación de los 3 PRs; EN CURSO la verificación de
  mergeabilidad** (regla 35). Estado al momento de escribir este reporte:
  - API #455: **aprobado por `Jsaldias39`** (`reviewDecision=APPROVED`, 2026-09-24 23:14 UTC; sin
    comentarios bloqueantes de `copilot-pull-request-reviewer`). `mergeable`/`mergeStateStatus` en
    `UNKNOWN` (GitHub recalculando tras el último rerun; estado transitorio, no un bloqueo). El
    check `docs` falló dos veces (la original y un
    `gh run rerun --failed`), ambas con el mismo error: `docker: Error response from daemon:
    unauthorized: access to the requested resource is not authorized` al levantar
    `quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z`. **Confirmado que es una caída de CI a
    nivel de todo el repo, no de este PR**: los últimos 7 runs de `docs.yml` sobre ramas
    completamente ajenas (`justin/cierre-plan-2-3-y-7-1`, `justin/medical-module-execution-*`
    ×6) fallan con el mismo error desde antes de que este carril existiera. Clasificación:
    **EXTERNAL** (quay.io rechazando el pull anónimo de esa imagen/tag) — no corregible desde
    este PR ni reintentando; queda para quien mantenga `docs.yml` (pinear un mirror o agregar
    credenciales). `fork-guard` se salteó como consecuencia. El resto de los controles del PR
    (revisión humana) sigue pendiente por separado.
  - Front #638 y #639: `mergeable=MERGEABLE`, `mergeStateStatus=UNSTABLE` — el runner
    self-hosted (`marcelo-wsl-front`) tenía WSL/Docker Desktop apagados en esta máquina; se
    relanzaron. El runner quedó `online` pero con una cola compartida de más de 10 PRs (algunos
    del equipo esperando hace más de 1h40) delante de estos dos — **la resolución de sus checks
    depende del orden de esa cola compartida, no de nada de este carril.** Este documento se
    actualiza cuando resuelvan (ver "Pendiente").
- M4 este REPORTE.md — HECHO (esta entrega); se actualizará con el resultado final de CI.

## A medias

- **La rama `mockup` del front** (`marcelo/feat-patient-insurance-portability-mockup`, PR #639):
  no estaba en el plan original — se agregó a pedido explícito del usuario después de aprobado
  el plan, para que la demo pública (que se despliega empujando a `origin/mockup`) también
  muestre la feature. Se hizo con `cherry-pick` limpio (sin conflictos) de los 4 commits nuevos
  sobre `origin/mockup` — el 5.º commit (el copy honesto) ya vivía ahí, no se repitió. Verificado
  con `yarn typecheck` (0) y los specs de portabilidad (47/47), **pero no con Playwright ni con
  el conjunto completo de tests de `mockup`** (fuera del tiempo disponible en este cierre).

## No cubierto (documentado, no oculto)

1. **E2E "titular sin coberturas"**: BLOCKED por arquitectura del mock (ver arriba). El caso
   síigue cubierto por spec unitario.
2. **S3.M6 "pierna real"** (API local real + front apuntando a ella): condicional, no intentada.
3. **El bug gemelo de `custodianTenantId`** en `DataReleaseService.exportBundle`
   (`data-release.service.ts:256`) — mismo defecto, mismo síntoma (500 en cualquier export real),
   pero pertenece a otro servicio y otro carril. Reportado, no corregido acá.
4. **Bypass de `SUPERADMIN`/`SECURITY_ADMIN`** sobre el ownership del titular — convención
   transversal ya existente en `profile-ownership.service.ts:147`, fuera de alcance.
5. **Consentimiento / `data_use_agreements`** — pregunta abierta de producto, no de este carril.
6. **`WEB_APP_BASE_URL` en Coolify** — ítem de despliegue, no de código; el QR/verify usan la
   variable de entorno ya declarada, pendiente de confirmar su valor en producción.
7. La rama `mockup` no corrió Playwright ni la suite completa (ver "A medias").

## Desvíos del plan

- El título del PDF quedó "Certificado de portabilidad de siniestralidad" (sin "oficial"),
  coherente con el copy honesto del front — CA-01 del prompt original decía "PDF oficial"; se
  prefirió la coherencia con el resto del producto. Queda para confirmar con Justin/Pablo en el
  PR, como ya estaba anotado en el plan como ambigüedad.
- Se agregó una tercera rama/PR de front (`mockup`) no contemplada en el plan original, a pedido
  explícito del usuario tras la aprobación.

## Decisiones y ambigüedades (heredadas del plan, sin cambios)

- `recordCount` sigue contando reclamos, no atenciones (documentado en el DTO).
- `encounters` excluye `reason_text` por minimización de PHI.
- BUNDLE como formato por defecto (decisión del usuario, 2026-09-24).

## Gates de seguridad / PHI (regla 90.6)

- **Amenaza**: IDOR sobre `patientProfileId` en `POST /insurance/portability/export` y en las
  descargas de certificado.
- **Control**: `ProfileOwnershipService.assertOwnsPatientProfile` — 403 indistinguible entre
  sin-perfil, perfil ajeno y uuid inventado.
- **Test**: `insurance-portability.int-spec.ts` (403 real por HTTP + fila en `audit.audit_log`) +
  spec unitario de ownership en descargas.
- **Resultado**: PASS, evidencia arriba.
- **Riesgo residual**: bypass de `SUPERADMIN`/`SECURITY_ADMIN` (preexistente, transversal, fuera
  de alcance).

## Pendiente

1. Que se resuelva el CI de los PRs #638 y #639 (estaba `UNSTABLE` por el runner apagado; ya
   relanzado) y confirmar `mergeStateStatus` final de los 3 PRs.
2. Revisión humana de `jsaldias39`/`PabloArauzCaballero` en los 3 PRs.
3. Decidir si la rama `mockup` necesita su propia corrida de Playwright antes de mergear (no se
   hizo en este cierre).
4. Confirmar con Justin/Pablo la redacción final del título del PDF (sin "oficial").
