# F2-DATOS — evidencia (31/10/2026)

Carril F2-DATOS, repo API `/home/user/mantra-core-health-api`, rama `claude/busy-dijkstra-5apd55`. Todo lo de abajo es salida real; lo que no corrió está marcado.

## Entorno
- Postgres 16 real (5544), base `salud`. Copia propia del API en el puerto **3030** (`node dist-f2/src/main.js`, compilada con `tsc -p tsconfig.build.json --outDir …/dist-f2` bajo `flock /tmp/heavy.lock`); la 3010 no se tocó ni se reinició.
- Datos mínimos creados con los POST existentes: dominio+entidad+clasificación+campo (`POST /admin/governance/entity-registry`, 3 entidades), política de retención (`POST retention-policies`) y su vínculo (`PATCH …/retention`), legal hold (`POST legal-holds`), escaneo (`POST /admin/catalog/scans` → 1338 objetos / 18640 columnas, SUCCEEDED), clasificación (`POST classification/run` → 127 NEEDS_REVIEW + 66 AUTO_DETECTED), 2 DSAR (`POST /privacy/dsar`).
- **Por SQL directo (no hay API que lo cree):** (a) los conceptos de módulo de `system_ops` y `audit` (la base F0 no los tenía sembrados; se insertaron con las semillas del propio código, `code` = clave del concepto); (b) 2 filas de `system_ops.retention_executions` (ninguna entidad tiene ejecutor de retención registrado: `POST retention-executions/run` responde 412 `SYSOPS_RETENTION_EXECUTOR_UNSUPPORTED`); (c) 2 fichas de columna pasadas a `APPROVED` (`crm.leads.email`, `crm.leads.full_name`) porque aprobar exige un segundo usuario con rol de escritura del catálogo.

## 1. Matriz de autorización contra la API real (HTTP)

Cuentas: admin@alovidasalud.com (SECURITY_ADMIN+SUPERADMIN), plataforma@alovida.test (PLATFORM_ADMIN), medico2org@alovida.test (USER, PRACTITIONER), y sin token.
```
ruta                                                                                             admin  plataf medico sinTk 
/admin/governance/policies                                                                       200    200    403    401   
/admin/governance/policies/RETENTION/a36bedec-d35a-4dde-98bd-cd3faae41d10                        200    200    403    401   
/admin/governance/change-log                                                                     200    200    403    401   
/admin/governance/entity-registry                                                                200    200    403    401   
/admin/governance/entity-registry/9602a73f-2c7f-4019-9846-f1a6f14369ad/fields                    200    200    403    401   
/admin/governance/domains                                                                        200    200    403    401   
/admin/governance/legal-holds                                                                    200    200    403    401   
/admin/governance/retention-executions                                                           200    200    403    401   
/admin/governance/review-queue?limit=2                                                           200    200    403    401   
/admin/governance/jobs                                                                           200    200    403    401   
/admin/catalog/pii/summary                                                                       200    200    403    401   
/admin/catalog/pii/columns?limit=2                                                               200    200    403    401   
/admin/catalog/pii/reconciliation?limit=2                                                        200    200    403    401   
/audit/log?limit=2                                                                               200    403    403    401   
/audit/log/filter-catalog                                                                        200    403    403    401   
/audit/data-access/summary                                                                       200    403    403    401   
/privacy/dsar                                                                                    200    403    403    401   
```
PLATFORM_ADMIN recibe 403 en `/audit/*` y `/privacy/dsar` a propósito: la bitácora es de AUDITOR/DPO/SECURITY_ADMIN (el resumen agregado admite además GOVERNANCE_ADMIN, D-2).

## 2. Respuestas 400/404 (nunca 500)
```
400 /admin/governance/domains?limit=201 -> VALIDATION_FAILED | Error de validación
400 /admin/governance/domains?foo=1 -> VALIDATION_FAILED | Error de validación
400 /admin/governance/domains?cursor=%25%25 -> VALIDATION_FAILED | El cursor de paginación no es válido
400 /admin/governance/legal-holds?tenantId=abc -> VALIDATION_FAILED | Error de validación
400 /admin/governance/legal-holds?status=ACTIVE%27;-- -> VALIDATION_FAILED | Error de validación
400 /admin/governance/retention-executions?from=2026-10-02T00:00:00Z&to=2026-10-01T00:00:00Z -> VALIDATION_FAILED | «to» debe ser posterior a «from»
400 /admin/governance/retention-executions?status=DONE -> VALIDATION_FAILED | Error de validación
400 /admin/governance/review-queue?kind=TERM -> VALIDATION_FAILED | Error de validación
400 /admin/governance/jobs?type=QUALITY -> VALIDATION_FAILED | Error de validación
400 /admin/catalog/pii/reconciliation?kind=ALL -> VALIDATION_FAILED | Error de validación
400 /admin/catalog/pii/reconciliation?schema=iam%27-- -> VALIDATION_FAILED | Error de validación
400 /audit/data-access/summary?minSample=0 -> VALIDATION_FAILED | Error de validación
400 /audit/data-access/summary?from=ayer -> VALIDATION_FAILED | Error de validación
400 /privacy/dsar?status=MAYBE -> VALIDATION_FAILED | Error de validación
400 /privacy/dsar/abc -> VALIDATION_FAILED | Validation failed (uuid is expected)
404 /privacy/dsar/00000000-0000-4000-8000-000000000000 -> NOT_FOUND | Solicitud DSAR no encontrada
400 /audit/log?requestId=x -> VALIDATION_FAILED | Error de validación
```

## 3. Alcance de plataforma (`@PlatformScopeOptional()` por método)
```
plataforma sin X-Tenant-Id  GET /admin/governance/legal-holds  -> 200
plataforma sin X-Tenant-Id  GET /admin/governance/jobs         -> 200
plataforma con X-Tenant-Id ajeno GET /admin/governance/domains -> 403 TENANT_MEMBERSHIP_REQUIRED
```

## 4. Los conteos de la API coinciden con psql (paginando todas las páginas por cursor)
```
API /admin/governance/review-queue: limit=10 paginas=13 items=125 distintos=125   | psql: 125
API /admin/catalog/pii/columns?minSensitivity=PSEUDONYMIZED: limit=7 paginas=28 items=193 distintos=193   | psql: 193
API /admin/governance/jobs: limit=2 paginas=2 items=4 distintos=4   | psql: 4
API /admin/governance/change-log: limit=2 paginas=3 items=6 distintos=6   | psql: 6
API /privacy/dsar: limit=1 paginas=2 items=2 distintos=2   | psql: 2
API /admin/governance/entity-registry: limit=1 paginas=3 items=3 distintos=3   | psql: 3
API /admin/governance/retention-executions: limit=1 paginas=2 items=2 distintos=2   | psql: 2
API /admin/governance/legal-holds: limit=1 paginas=1 items=1 distintos=1   | psql: 1
API /admin/governance/domains: limit=1 paginas=1 items=1 distintos=1   | psql: 1
API pii/summary personalColumns=193 objectsWithPersonal=123 observedColumns=18640
psql: 193 personales / 123 objetos ; observadas: 18640
reconciliation API: {'approvedPersonalColumns': 2, 'declaredFields': 4, 'registryEmpty': False, 'byKind': {'MISSING_IN_REGISTRY': 1, 'REGISTRY_DISAGREES': 1, 'ORPHAN_IN_REGISTRY': 1}, 'total': 3}
psql faltantes (personal aprobada sin campo declarado): 1
psql huérfanos (campo declarado no observado): 1
psql desacuerdos (declarado sin PII/PHI): 1
data-access/summary?minSample=1 API: {'events': 30, 'distinctActors': 1, 'patientScopedEvents': 0} [{'key': 'DSAR_REQUEST', 'events': 13, 'distinctActors': 1}, {'key': 'DATA_ACCESS_SUMMARY', 'events': 10, 'distinctActors': 1}, {'key': 'AUDIT_LOG', 'events': 7, 'distinctActors': 1}]
psql data_access_log (30 d): 30 eventos, 1 actores, 0 con paciente ; por recurso: DSAR_REQUEST=13, DATA_ACCESS_SUMMARY=10, AUDIT_LOG=7
audit/log?entityId API: 3 filas | psql audit_log por entity_id: 3 filas
```

## 5. Pruebas automatizadas (Jest, guards reales JWT + alcance de tenant + roles; repositorios dobles declarados)

- Última corrida: `jest src/modules/system_ops src/modules/data_catalog src/modules/audit src/common/auth src/common/tenant src/common/audit-trail` → **72 suites verdes de 73, 1035 de 1036 pruebas**. La única falla es `audit-trail-coverage.spec.ts`: `POST /internal/ops/heartbeats (OpsHeartbeatController.record)` sin `@Audited`/`@NotAudited`; es de F2-SISTEMA (`src/modules/ops_console`/observability), no de este carril (F2-DATOS no añadió ninguna ruta que mute).
- Specs nuevas: `governance-operations-read.controller.spec.ts` (+repositorio), `audit-oversight.controller.spec.ts` (+repositorio), `governance-queue.controller.spec.ts` (+repositorio), `role-aliases.spec.ts`, `data_catalog.role-alias.spec.ts`; ampliadas `admin-catalog-insights.controller.spec.ts`, `catalog-insights.repository.spec.ts`. Cada ruta: 401 / 403 (clínico, ajeno) / 200 (cada rol permitido) / 400 (parámetro inválido, no declarado, cursor corrupto, ventana invertida) / 404 / «nada llega a la base antes de autorizar» / sin verbos de escritura.
- Cambio de política en una prueba existente (no es un debilitamiento): `governance-read.controller.spec.ts` afirmaba «AUDITOR y DATA_STEWARD → 403» en políticas/bitácora de cambios/registro. La matriz 3.12 (y D-2) los admite en sólo lectura; la prueba ahora afirma 200 para ellos y 403 para roles verdaderamente ajenos (PHARMACIST, MEDICAL_DIRECTOR, QA_ADMIN).
- `tsc -p tsconfig.build.json` (typecheck del proyecto) compila este carril sin errores; el único error del árbol es `telemetry-parts-analytics.service.ts(177,96) TS2322` (F2-APP, WIP ajeno). El `dist` de la 3010 no se reconstruyó.

## 6. No se ejecutó / límites

- **Alias de roles contra la API real**: asignar `DATA_GOVERNANCE_ADMIN` a una cuenta de prueba por `POST /authz/users/:id/role-assignments` fue denegado por el clasificador de permisos de la sesión (otorga un rol), así que no se hizo. La prueba del alias es `data_catalog.role-alias.spec.ts` (controladores reales de data_catalog, system_ops y cross_store_consistency + guards reales) y `role-aliases.spec.ts`.
- Retención: ninguna entidad tiene ejecutor registrado (`RETENTION_DISPOSITION_EXECUTORS` vacío), así que `retention_executions` sólo se pudo poblar por SQL; la lectura quedó verificada contra esas filas.
- `openapi/openapi.json` y `ENDPOINTS.md` no se regeneraron (exige `yarn build` completo).
- `byRole` del resumen de accesos y `requestId` en bitácora/trabajos/retenciones: sin fuente, declarados en `notMeasured`.

## 7. Correcciones tras la revisión independiente (CON CAMBIOS REQUERIDOS) — 31/10/2026

Todo lo de esta sección sustituye a lo dicho antes cuando se contradice (§1–§6 son de la primera entrega; el contrato JSON ya está actualizado). Verificado en una copia nueva del API (:3030, compilada de nuevo con `tsc --outDir`; la 3010 sigue intacta y respondió `{"status":"ok"}`).

### 7.1 K-anonimato del resumen de accesos (hallazgo 1)
- `minSample` ya no baja de 5: DTO `@Min(5)` y, aunque el DTO dejara pasar un valor menor, el servicio aplica `max(minSample, 5)`. Ventana mínima de 24 h (400 `INVALID_DATE`). `totals`, `daily` y cada `by*` aplican supresión **complementaria**: lo oculto suma 0 o ≥ `minSample`, así que `totals − visibles` nunca revela un grupo de 1 a 4 eventos. `suppressed` pasó de `{buckets, events}` a `{byPurpose, byResourceType, byOperation, daily}` (sin conteo de grupos ocultos).
- curl: `minSample=1` → 400; `minSample=4` → 400; ventana de 1 h → 400 `INVALID_DATE`. Con datos reales (psql: `DATA_ACCESS_SUMMARY=14, DSAR_REQUEST=14, AUDIT_LOG=9, DATA_ACCESS_LOG=1`) la API devuelve sólo los dos grupos de 14 y `suppressed.byResourceType = 10` (el grupo de 1 se oculta junto con el de 9; no se puede deducir por resta).
- Pruebas: `audit-oversight.controller.spec.ts` (piso, `minSample=1` no revela grupos de 1 incluso llamando al servicio directo, supresión complementaria, `totals` null, serie diaria, ventana, DSAR con cursor forjado). Cambié dos pruebas que fijaban el contrato débil anterior (`minSample=1 muestra todo` y la forma de `suppressed`): ahora afirman el contrato nuevo.

### 7.2 Cursor forjado → 400, no 500 (hallazgo 2)
- Nuevo `src/common/pagination/keyset-fields.ts` (`readCursorFields`, `assertOneOf`): valida cada campo que luego se castea (`t` = instante ISO UTC real —rechaza `2026-02-31`—, `i` = uuid, `ty` = tipo de trabajo de la lista). Aplicado a policies, change-log, entity-registry, fields, domains, legal-holds, retention-executions, review-queue, jobs, dsar y también a `/audit/log` y `/audit/data-access` (mismo defecto, mismo módulo). Responde 400 con `reason: INVALID_CURSOR` y no repite el cursor.
- curl (12 rutas, todas 400 `INVALID_CURSOR`): domains `{"c":"a","i":"x"}`; legal-holds, retention-executions, review-queue, change-log, dsar, audit/log, audit/data-access con `{"t":"abc","i":"x"}`; retention-executions con `t` válido e `i` inválido; jobs con `t` inválido y con `ty:"DROP"`; entity-registry `{"s":"a","t":"b","i":"x"}`. Pruebas: un bloque «cursor forjado» en cada spec de controlador.
- **Anotado, sin tocar (carril Sistema):** mapear los errores de PostgreSQL 22007/22008/22P02 a 400 en `common/filters` sería la defensa en profundidad para cualquier ruta del repo con un cursor casteado; no se hizo aquí porque `src/common/filters/**` es de F2-SISTEMA. Otras rutas del repo con cursor `::timestamptz` fuera de estos tres módulos no se revisaron.

### 7.3 Alias de roles: SOLO lectura y explícito (hallazgo 3, el importante)
- **Revertido** el alias global: `roles.guard.ts` y `platform-scope.ts` volvieron a su estado anterior a la rebanada 5 (la reversión quedó dentro del commit 47753b7e3 de otro carril, que commiteó mi índice; el contenido de HEAD es el correcto) y se borró `common/auth/role-aliases.ts`. El guard compara nombres exactos.
- Opt-in explícito: `DATA_GOVERNANCE_ADMIN` se agregó a `GOVERNANCE_VIEW_ROLES`, `LEGAL_HOLD_VIEW_ROLES`, `AUDIT_SUMMARY_ROLES` y a una lista nueva `PORTAL_VIEW_ROLES` (= `PORTAL_READ_ROLES` + el alias) usada **sólo en los `GET`** de `admin-catalog` y `admin-portal`. `CATALOG_WRITE_ROLES` no cambió.
- Pruebas (`data_catalog.role-alias.spec.ts` y `role-aliases.spec.ts`, reescritas para el contrato nuevo, no borradas): `RolesGuard` REAL sobre el `@Roles` REAL de cada handler — `registerProjection`, `replayDeadLetter`, `repairDrift`, `moveData` (cross_store) y `defineAccessScope` (graph_intelligence): `DATA_GOVERNANCE_ADMIN` pasa, `GOVERNANCE_ADMIN` solo → denegado; `saveAnnotation` (catálogo), `defineDataset`, `defineCollection`, `approvePlacement` (polyglot_storage) y `registerStateMachine` (workflow): `GOVERNANCE_ADMIN` pasa, `DATA_GOVERNANCE_ADMIN` solo → denegado. HTTP real: POST de cross_store con `GOVERNANCE_ADMIN` → 403, con `DATA_GOVERNANCE_ADMIN` → 400 (pasó la puerta). Ambos nombres → 200 en las lecturas de data_catalog y system_ops, y sus listas de lectura contienen los dos.
- **DPO/AUDITOR/DATA_STEWARD no se asignan con tenant**: prueba nueva que fija (a) que los cinco roles de gobierno se siembran con ámbito `GLOBAL` y (b) que `AuthzGrantsService.assignRole` con `tenantId` sobre un rol global responde 412 `ROLE_ASSIGNMENT_GLOBAL_ROLE_WITH_SCOPE` y no crea la asignación (`authz-grants.service.ts:121-127`).

### 7.4 Notas de riesgo que quedan anotadas
- **Inconsistencia menor:** con `X-Tenant-Id` ajeno, un rol de plataforma (`GOVERNANCE_ADMIN`, `PLATFORM_ADMIN`…) recibe 403 `TENANT_MEMBERSHIP_REQUIRED` (rige `@PlatformScopeOptional`), pero `DPO`/`AUDITOR`/`DATA_STEWARD`/`SECURITY_ADMIN` y `DATA_GOVERNANCE_ADMIN` (que no figura en `PLATFORM_SCOPE_ROLES`) reciben 200 porque `@PlatformTenantOptional` ignora la cabecera. No filtra nada: son datos de plataforma sin tenant y la cabecera no cambia la consulta.
- **Riesgo de `@PlatformTenantOptional` a nivel de clase** en `audit-query.controller.ts:67` (`...AUDIT_READ_ROLES, 'SUPERADMIN'`): se hereda en cualquier ruta que se agregue después a esa clase, incluida una que mute o lea datos con `tenant_id`, y esa ruta dejaría de exigir organización a esos roles sin que nadie lo decida. Hoy las tres rutas de la clase son de plataforma. Mitigación recomendada (no aplicada, fuera del alcance de «solo lecturas nuevas»): moverlo a cada método, como se hizo en las rutas nuevas. Las nuevas rutas de `audit` y `privacy` lo declaran por método.
- El alias de lectura también significa que `DATA_GOVERNANCE_ADMIN` no tiene alcance plataforma de `PLATFORM_SCOPE_ROLES` (no se amplió esa lista, a propósito).

### 7.5 Pruebas y compilación de esta ronda
- `jest` sobre system_ops, data_catalog, audit, common/auth, common/tenant, common/pagination, cross_store_consistency, graph_intelligence, polyglot_storage, workflow y authz: 118 suites, 1696 pruebas; 7 fallaron en la primera pasada por mis propias pruebas nuevas (clase de excepción importada de otro paquete, clave de metadatos, y un cursor de fixture `'a9'` en `audit-query.service.spec.ts` que ahora es un cursor inválido) — corregidas (el fixture usa un uuid; la aserción es la misma) y las dos suites afectadas pasan (52 pruebas).
- `tsc -p tsconfig.build.json`: exit 0, sin errores en todo el árbol.
- No se ejecutó: `eslint` sobre lo tocado; el alias de lectura contra la API real (asignar el rol a una cuenta fue denegado por el clasificador de permisos); `openapi`.
