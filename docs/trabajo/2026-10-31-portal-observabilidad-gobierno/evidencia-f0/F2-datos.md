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
