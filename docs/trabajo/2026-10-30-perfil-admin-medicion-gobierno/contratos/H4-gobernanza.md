# Contrato H4 — Observabilidad y gobernanza de datos (estilo Atlas)

> Estado: `WRITTEN` + `TESTED` con dobles (specs dirigidas en verde, ver §7). **Sin verificar contra PostgreSQL real**: no hay base en la máquina de trabajo, así que ningún SQL de este contrato corrió contra datos. Rama API: `claude/stoic-johnson-4vl5bf` (sin commit). Fecha: 2026-10-31.
> El front consume **solo** lo de este archivo. Lo marcado `NO MEDIDO` o `BLOQUEADO` no existe en la API y no debe simularse en el front.

Reglas comunes a **todas** las rutas nuevas: solo `GET` (nada muta, así que no hay `@Audited` nuevo ni motivo que pedir); sin token → 401; rol fuera de la lista → 403 `FORBIDDEN`; parámetros no declarados, valores fuera de lista, uuid inválido o cursor corrupto → **400** (nunca 500); paginación por cursor opaco `nextCursor` (la última página trae `null`), `limit` 1..200 (50 por omisión), orden total con desempate estable; respuestas **solo de metadatos** (nombres, tipos, niveles, estados, códigos): ningún valor de dato, snapshot, parámetro ni texto libre de ficha.

## 1. Terreno tocado (API `mantra-core-health-api`)

| Módulo | Qué se añadió |
|---|---|
| `src/modules/audit` | filtro `entityId` y `GET /audit/log/filter-catalog` |
| `src/modules/data_catalog` | `GET /admin/catalog/{pii/summary,pii/columns,quality/rules,quality/issues}` y `GET /admin/portal/linaje/{nodos,aristas}` |
| `src/modules/system_ops` (expone `admin/governance`) | `GET /admin/governance/{policies,policies/:policyType/:id,change-log,entity-registry,entity-registry/:id/fields}` |

Sin DDL, sin entidades ni tablas nuevas: SQL parametrizado de solo lectura sobre lo que ya existe.

## 2. Mapa Atlas → nuestra API

Atlas = `/home/user/pabloarauzcaballero/atlasadminportal/src`. Nuestra API = `mantra-core-health-api/src/modules`. «Antes» = lo que había al empezar H4; «Ahora» = tras esta entrega.

| Sección Atlas | Qué consume Atlas | Antes (existía) | Faltaba | Ahora |
|---|---|---|---|---|
| **Políticas** `/internal/governance/policies` | `GET /internal/governance/policies/:id` (solo lectura; el `PATCH` lo retiró el backend) — `features/governance-policies/services.ts:12` | Solo escrituras: `POST write-policies`, `retention-policies`, `anonymization-rules`, `PATCH …/write-policy`, `…/retention`, `field-registry/:id` — `system_ops/controllers/governance-catalog.controller.ts:53-159` (todas `@Audited`, `SECURITY_ADMIN`); residencia `POST` en `residency.controller.ts:38` | **Ninguna lectura** de políticas | §3.1 `policies`, `policies/:policyType/:id` |
| **PII** `/internal/governance/pii` | tablas y rutas con `personalData=true`, paginado en servidor — `features/governance/pii-registry-page.tsx:38-49` | Lineage declara `tablasConPii: 'SIN_FUENTE'` (`inventario/grafos/linaje.json` → `/admin/portal/linaje`, `admin-portal.controller.ts:188`); el catálogo clasifica por columna (`data_catalog/domain/classification/column-classifier.ts`, `catalog_annotations.sensitivity`) pero solo se veía objeto por objeto (`admin-catalog.controller.ts:158`, `objects/:id/columns`); `system_ops.entity_registry/field_registry` sin lectura | Vista **transversal** de qué columnas son personales y su sensibilidad; lectura del registro declarado | §3.2 `pii/summary`, `pii/columns`; §3.1 `entity-registry`, `…/fields` |
| **Calidad de datos · reglas** `/internal/data-quality/rules` | `GET /internal/data-quality/rules[/:id]` (solo lectura; el `run` por regla lo retiró el backend) — `features/data-quality-rules/services.ts:13,21` | `health_data.health_data_quality_rules/rule_sets/runs/issues` y `lakehouse.lakehouse_quality_*` existen como tablas; **solo `POST health-data/quality-runs`** (`health_data/controllers/health-data.controller.ts:286`) y `POST lakehouse/datasets/:id/quality-runs` (`lakehouse.controller.ts:180`). Cobertura documental: `GET /admin/catalog/coverage` (`admin-catalog.controller.ts:384`) | Reglas e incidencias de calidad **de valores** (nulos, duplicados, formatos): no hay lectura ni tabla de plataforma, y esos módulos están fuera de este terreno | **Parcial.** Reglas e incidencias de calidad **del catálogo** (§3.3). Calidad de valores: `NO MEDIDO`/`BLOQUEADO` (§5) |
| **Calidad de datos · incidencias** `/internal/data-quality/issues` | `GET /operations/data-quality/issues` + `POST …/:id/resolve` con motivo — `features/operations/services.ts:138,147` | — | Lista de incidencias con resumen del servidor | §3.3 `quality/issues` (derivadas, sin cierre) |
| **Linaje** `/internal/lineage` | grafo, nodo e impacto — `features/lineage-official/services.ts:10,14,18` | Métricas + dominios (`admin-portal.controller.ts:188`), linaje de una tabla (`:213`), impacto por FK de un objeto vivo (`admin-catalog.controller.ts:250`) | El grafo completo (nodos y aristas) paginado | §3.4 `linaje/nodos`, `linaje/aristas` |
| **Auditoría** `/internal/audit` | `GET /systems/action-logs` con catálogo de filtros — `features/systems/log-services.ts:22,48`; filtros `requestId`, fechas ISO — `features/audit/audit-filters.ts:87` | `GET /audit/log` por actor, tenant, acción, verbo, ruta, entidad, resultado y fecha, paginado (`audit/controllers/audit-query.controller.ts:60`); `GET /audit/data-access` (`:87`) | Filtro por **recurso** (`entityId`) y catálogo de filtros/límites | §3.5 |
| **Trazabilidad por `requestId`** `/internal/audit/request/[requestId]` | `GET /systems/action-logs/by-request/:id` — `features/systems/log-services.ts:36` | Ningún endpoint de auditoría por `requestId`/`correlationId`; tráfico y latencia por endpoint en `GET /admin/ops/traffic` y `traffic/endpoints` (`ops_console/presentation/controllers/ops-console.controller.ts:90,102`, **fuera de este terreno**) | El dato: `audit.audit_log` no guarda `requestId`; `correlation_id` existe en el DDL (`database/SQL/10_audit/02_tables.sql:17`) pero la entidad del ORM no lo mapea y ningún sello lo rellena | **`NO MEDIDO`** — declarado por `GET /audit/log/filter-catalog` (§3.5) |
| **Metadatos de negocio / glosario** `/internal/business-metadata/*` | `GET /internal/business-metadata/glossary`, `terms/:id` — `features/business-glossary/services.ts:11,25` | Glosario (`GET /admin/portal/glosario`, `admin-portal.controller.ts:222`), dominios en `linaje` | — | Sin cambios (cubierto) |

## 3. Rutas

### 3.1 Políticas, bitácora de cambios y registro — `admin/governance` (módulo `system_ops`)

**Roles** (`GOVERNANCE_READ_ROLES`): `SECURITY_ADMIN`, `GOVERNANCE_ADMIN`, `DPO`, `PLATFORM_ADMIN`, `DATA_PLATFORM_ADMIN`. Sin tenant (datos de plataforma). `AUDITOR` y `DATA_STEWARD` → 403 (leen el catálogo, no el gobierno). Escribir sigue siendo `SECURITY_ADMIN` en las rutas existentes. Fuente: `system_ops/controllers/governance-read.controller.ts` (cabecera con el mismo contrato).

| Método y ruta | Query | 200 | Errores |
|---|---|---|---|
| `GET /admin/governance/policies` | `type?` `WRITE\|RETENTION\|ANONYMIZATION\|RESIDENCY` · `state?` (código de concepto, p. ej. `ACTIVE`) · `q?` (≤120; código y nombre) · `sort?` `code\|updatedAt` (def. `code`) · `order?` `asc\|desc` (def. `asc`) · `limit?` · `cursor?` | `{ items: [{ policyType, id, code, name\|null, state\|null, version, updatedAt }], nextCursor, limit, sort, order }` | 400 parámetro inválido; 400 si el `cursor` se emitió con otro `sort`/`order` |
| `GET /admin/governance/policies/:policyType/:id` | — | `{ …resumen, createdAt, createdByUserId, updatedByUserId, settings, appliedTo: { total, items: [{ schemaName, tableName, columnName\|null }], truncated } }` | 400 tipo o uuid inválido · 404 no existe (también si el id es de otro tipo) |
| `GET /admin/governance/change-log` | `targetType?` · `targetId?` (uuid) · `changedBy?` (uuid) · `from?` `to?` (ISO 8601; `to` > `from`; sin rango: últimos 30 días) · `limit?` · `cursor?` | `{ items: [{ id, targetType, targetId, action, changedByUserId, reason\|null, recordedAt }], nextCursor, limit, order: "recorded_at desc, id desc" }` | 400 ventana invertida/vacía o fecha no ISO |
| `GET /admin/governance/entity-registry` | `schema?` · `q?` · `domain?` · `classification?` (códigos) · `containsPii?` `containsPhi?` (`true\|false`) · `limit?` · `cursor?` | `{ items: [{ id, schemaName, tableName, domain\|null, classification\|null, ownerTeam, containsPii, containsPhi, isAppendOnly, isSoftDelete, hasHistory, retentionPolicyCode, writePolicyCode, fieldCount, personalFieldCount }], nextCursor, limit, order: "schema_name, table_name, id", notMeasured }` | 400 |
| `GET /admin/governance/entity-registry/:id/fields` | `limit?` `cursor?` | `{ items: [{ id, columnName, classification, isPii, isPhi, maskingStrategy, anonymizationRuleCode }], nextCursor, limit, order: "column_name, id" }` | 400 uuid · 404 la entidad no está en el registro |

`settings` por tipo (códigos de concepto, nunca ids): `WRITE` → `{ insertMode, updateMode, deleteMode, requiresReason, requiresApproval, dualControl, maxBatchSize }`; `RETENTION` → `{ retentionPeriodDays, legalBasis, disposition, jurisdiction }`; `ANONYMIZATION` → `{ technique, description, parameterKeys: string[] }` (**solo los nombres** de los parámetros, jamás sus valores); `RESIDENCY` → `{ jurisdiction, dataClassification, crossBorderTransferBasis, transferImpactAssessmentRequired, encryptionKeyRegionLocked, validFrom, validTo }`. `appliedTo` lista como máximo 50 (tablas, o columnas para anonimización); `RESIDENCY` devuelve vacío. El `change-log` no devuelve snapshots. `entity-registry` vacío → `items: []` y `notMeasured: [{ field: "entityRegistry", reason }]` (solo sin filtros).

La bitácora de cambios sin rango mira 30 días porque `governance_change_log` no tiene índice por fecha ni por objeto (`database/SQL/11_system_ops/04_indexes.sql:91-93`).

### 3.2 Datos personales — `admin/catalog/pii/*` (módulo `data_catalog`)

**Roles** (`PORTAL_READ_ROLES`): `SECURITY_ADMIN`, `PLATFORM_ADMIN`, `GOVERNANCE_ADMIN`, `DATA_PLATFORM_ADMIN`, `DPO`, `AUDITOR`, `DATA_STEWARD`. Fuente: `data_catalog/presentation/controllers/admin-catalog.controller.ts:394,407`.

| Método y ruta | Query | 200 |
|---|---|---|
| `GET /admin/catalog/pii/summary` | — | `{ source, observedColumns, classifiedColumns, personalColumns, objectsWithPersonalColumns, bySensitivity: [{ sensitivity, columns, approved, needsReview, autoDetected, other }], declaredRegistry: { entities, entitiesPersonal, fields, fieldsPersonal }, notMeasured: [{ field, reason }] }` |
| `GET /admin/catalog/pii/columns` | `schema?` · `minSensitivity?` `PSEUDONYMIZED\|PERSONAL\|PHI_IDENTIFIER\|PHI_SENSITIVE\|PHI_SPECIAL\|CREDENTIAL` (def. `PERSONAL`) · `sensitivity?` (exacta) · `reviewStatus?` `AUTO_DETECTED\|DRAFT\|NEEDS_REVIEW\|APPROVED\|REJECTED` · `q?` (≤120; `schema.objeto.columna`) · `sort?` `name\|sensitivity` (def. `name`) · `limit?` · `cursor?` | `{ items: [{ columnId, objectId, schemaName, objectName, columnName, nativeType, sensitivity, reviewStatus, origin, approved, registryMarksPersonal }], nextCursor, limit, sort }` |

`sort=name` ordena por `schema, objeto, columna`; `sort=sensitivity` de más a menos sensible y luego por nombre. Un `cursor` de un orden no sirve en el otro (400). `registryMarksPersonal`: `true/false` si `system_ops.field_registry` declara la columna; `null` si no la declara. La escala de sensibilidad es la del catálogo (`UNKNOWN < ANONYMIZED < PUBLIC < INTERNAL < PSEUDONYMIZED < PERSONAL < PHI_IDENTIFIER < PHI_SENSITIVE < PHI_SPECIAL < CREDENTIAL`); «personal» = `PERSONAL` o superior salvo que se pida otro mínimo.

`notMeasured` de `pii/summary` (siempre honesto): `catalog` si no hay columnas observadas (falta un escaneo); `declaredRegistry.fields` si `system_ops.field_registry` está vacío; `dataValues` siempre — el catálogo clasifica por nombre y tipo, **no lee valores**, así que una columna sin clasificar no está garantizada libre de datos personales.

### 3.3 Calidad del catálogo — `admin/catalog/quality/*` (módulo `data_catalog`)

Mismos roles y fuente (`admin-catalog.controller.ts:420,431`). **Derivadas al leer, sin estado ni acción de cierre**: no existe tabla de incidencias, y crear una exige DDL por el modelo (fuera de alcance). La incidencia desaparece al corregir la ficha; por eso no hay acción idempotente que ofrecer.

| Método y ruta | Query | 200 |
|---|---|---|
| `GET /admin/catalog/quality/rules` | — | `{ rules: [{ code, name, description, severity, target, resolution, openIssues }], notMeasured }` |
| `GET /admin/catalog/quality/issues` | `rule?` · `severity?` `HIGH\|MEDIUM\|LOW` · `schema?` · `q?` · `limit?` · `cursor?` | `{ items: [{ ruleCode, severity, schemaName, objectName, columnName\|null, objectId, columnId\|null, sensitivity\|null, reviewStatus\|null, affected }], nextCursor, limit, summary: { total, bySeverity, byRule }, derived: true, notMeasured }` |

Reglas (`data_catalog/domain/catalog/governance-insights.ts`): `CAT-PII-UNREVIEWED` (HIGH, columna personal sin ficha aprobada con revisión vigente) · `CAT-PII-NO-OWNER` (MEDIUM, objeto con columnas personales sin responsable ni custodio) · `CAT-OBJECT-NOT-OBSERVED` (MEDIUM, ficha de un objeto que el último escaneo no vio) · `CAT-OBJECT-NO-ANNOTATION` (LOW, objeto observado sin ficha). Orden: `regla, schema, objeto, columna`. `summary` respeta los filtros pero no la página; trae todas las claves de severidad y de regla (con 0). `notMeasured` declara `dataValueQuality` (rules) y `resolutionState` (issues).

### 3.4 Linaje — `admin/portal/linaje/*` (módulo `data_catalog`, inventario generado)

Roles `PORTAL_READ_ROLES`. Fuente: `admin-portal.controller.ts:195,203`. Sin base de datos; responde 503 si falta el inventario (igual que el resto de `admin/portal`).

| Método y ruta | Query | 200 |
|---|---|---|
| `GET /admin/portal/linaje/nodos` | `tipo?` `OPERACION\|TABLA\|DOMINIO` · `q?` · `dominio?` (etiqueta exacta) · `limit?` · `cursor?` | `{ items: [{ id, tipo, etiqueta, dominio\|null, riesgo\|null }], nextCursor, limit, total }` (orden por `id`) |
| `GET /admin/portal/linaje/aristas` | `tipo?` `LEE\|ESCRIBE\|BORRA\|REFERENCIA\|PERTENECE` · `de?` · `a?` (id exacto del nodo, ≤240) · `limit?` · `cursor?` | `{ items: [{ de, a, tipo }], nextCursor, limit, total }` (orden por `de\|a\|tipo`) |

Un filtro sin coincidencias es `items: []`, no un error. Los ids de nodo son `op:<id>`, `tabla:<schema>.<tabla>`, `dominio:<etiqueta>`.

### 3.5 Auditoría — `audit/*` (módulo `audit`)

**Roles** (`AUDIT_READ_ROLES`): `AUDITOR`, `DPO`, `SECURITY_ADMIN`. **No se amplió**: `GOVERNANCE_ADMIN`, `PLATFORM_ADMIN` y `DATA_PLATFORM_ADMIN` reciben 403 (leer la bitácora no se hereda de un rol de gobierno). Cada lectura de `/audit/log` queda sellada en `audit.data_access_log` (`@AccessLogged`, `SECURITY_OVERSIGHT`). Fuente: `audit/controllers/audit-query.controller.ts` (cabecera con el contrato).

| Método y ruta | Query | 200 |
|---|---|---|
| `GET /audit/log` | `userId?` (**actor**, uuid) · `entity?` (tipo de **recurso**) · `entityId?` (uuid; **nuevo**, recurso concreto) · `action?` · `method?` `POST\|PUT\|PATCH\|DELETE` · `route?` · `result?` `SUCCESS\|FAILURE` · `tenantId?` · `from?` `to?` (ISO 8601; `to` > `from`; sin rango: 30 días) · `limit?` (1..200, 50) · `cursor?` | `{ items: [{ id, userId, tenantId, action, entity, entityId, result, ip, method, route, healthRisk, recordedAt }], nextCursor, limit }` — orden fijo `recorded_at desc, id desc` |
| `GET /audit/log/filter-catalog` | — | `{ filters: [{ name, type, description, options }], defaultWindowDays: 30, defaultPageSize: 50, maxPageSize: 200, order, notMeasured: [{ field, reason }] }` |

`filter-catalog` no lee la bitácora ni deja sello de lectura. Su `notMeasured` es: `requestId` («el sello de auditoría no guarda el identificador de la petición») y `correlationId` («`audit.audit_log.correlation_id` existe en el DDL pero la entidad del ORM no lo mapea y ningún sello lo rellena; las filas son WORM y no se completan hacia atrás»). **El front no debe mostrar un buscador por `requestId`/`correlationId` contra esta API**: pedir `?requestId=` devuelve 400 (parámetro no declarado) a propósito, en vez de un vacío que se leería como «sin actividad».

## 4. Qué NO se hizo y por qué (alcance)

- **Mutaciones**: ninguna. Las incidencias de calidad no tienen estado; las políticas se siguen cambiando por las rutas `POST/PATCH` existentes de `system_ops` (que ya llevan `@Audited`; ninguna pide `reason` hoy — deuda anotada, fuera de H4).
- **Observabilidad de errores/latencia** (H4.S1.M2): vive en `admin/ops` (`ops_console`/`platform_ops`), territorio de otro agente. Este contrato no la cubre.
- `src/common/audit-trail/audit-trail-coverage.spec.ts` sigue en verde (no se añadió ninguna ruta que mute).

## 5. NO MEDIDO / BLOQUEADO

| Qué | Estado | Motivo | Qué lo destraba |
|---|---|---|---|
| Traza por `requestId`/`correlationId` en la auditoría | `NO MEDIDO` | `audit_log` no guarda `requestId`; `correlation_id` sin mapear ni rellenar | Mapear `correlation_id` en la entidad y que `AuditTrailInterceptor` lo estampe desde el id de petición (cambio de escritura sobre una tabla WORM con cadena de hash: decisión del dueño de `audit`) |
| Calidad de **valores** (reglas e incidencias de datos) | `BLOQUEADO` | Sin lectura: `health_data_quality_*` y `lakehouse_quality_*` tienen tablas y solo `POST …/quality-runs`; módulos fuera de este terreno, y no hay tabla de plataforma | Que los dueños de `health_data`/`lakehouse` expongan `GET` de reglas e incidencias (metadatos), o una decisión de negocio sobre una tabla de incidencias de plataforma |
| Acción de cierre de incidencia (reconocer/resolver con motivo) | `BLOQUEADO` | Requiere persistir estado de la incidencia → DDL desde el modelo | Decisión de negocio + cambio en el modelo `salud-db` |
| Registro de campos `system_ops.field_registry` | Vacío honesto | Nadie declaró campos con `POST /admin/governance/entity-registry`; `pii/summary.notMeasured` lo declara | Que gobierno catalogue entidades; mientras, la fuente de PII es la clasificación del catálogo |
| Todo SQL de este contrato contra PostgreSQL real | `BLOQUEADO` | No hay base en la máquina de trabajo (`pg_isready`: sin respuesta; sin Docker) | Correr las rutas contra una base con el esquema `data_catalog`, `system_ops` y `audit` aplicado |
| `openapi/openapi.json`, `openapi/ENDPOINTS.md` | Pendiente | Regenerar exige `yarn build` completo (prohibido en esta máquina) | `yarn docs:openapi:generate` y `yarn docs:endpoints:generate` |

## 6. Ambigüedades registradas

1. «Datos personales» = sensibilidad `PERSONAL` o superior (default de `pii/columns`); `PSEUDONYMIZED` queda opt-in con `minSensitivity`. Supuesto tomado: por defecto se muestra lo claramente personal. Confirmar con el DPO.
2. Las reglas `CAT-*` son una propuesta mínima de calidad **documental**, no de valores. Confirmar con gobierno de datos cuáles se mantienen y con qué severidad.
3. `GET /admin/governance/*` admite `GOVERNANCE_ADMIN`/`DPO`/`PLATFORM_ADMIN`/`DATA_PLATFORM_ADMIN` además de `SECURITY_ADMIN`, según la instrucción de H4; `AUDITOR` y `DATA_STEWARD` quedan fuera. Confirmar con seguridad.

## 7. Evidencia (dobles declarados)

Todas las specs usan un **repositorio doble** (sin PostgreSQL) y los guards reales de JWT y roles; lo que prueban es el contrato HTTP, la validación, la matriz de autorización negativa, la paginación y la ausencia de datos en las respuestas. Salidas literales en el reporte de la sesión y en `evidencia/` cuando se archiven.

| Spec | Qué cubre |
|---|---|
| `audit/controllers/audit-query.controller.spec.ts` | 401/403/200 por rol (incl. roles de gobierno → 403), filtros actor/recurso/acción/fecha, 400 por entrada inválida, `filter-catalog` |
| `audit/services/audit-query.service.spec.ts`, `audit/repositories/audit-query.repository.spec.ts` | `entityId`, `filterCatalog`, SQL parametrizado, orden fijo |
| `data_catalog/presentation/controllers/admin-catalog-insights.controller.spec.ts` | matriz de autorización de las 4 rutas, filtros, 400, sin valores en la respuesta, sin verbos de escritura |
| `data_catalog/application/catalog-insights.service.spec.ts`, `…/catalog-insights.repository.spec.ts` | `notMeasured`, paginación y cursores, SQL parametrizado, reglas ↔ SQL |
| `data_catalog/presentation/controllers/admin-portal.controller.spec.ts` | linaje nodos/aristas: autorización, recorrido completo sin saltos, 400 |
| `system_ops/controllers/governance-read.controller.spec.ts`, `system_ops/repositories/governance-read.repository.spec.ts` | matriz de autorización de las 5 rutas, cursor de otro orden → 400, 404, sin snapshots ni notas, SQL parametrizado |

**No cubierto:** ejecución contra PostgreSQL real (sintaxis y plan de las consultas, `jsonb_object_keys`, tuplas de keyset); rendimiento (`entity_id`, `target_id` y `action` sin índice: se acotan por ventana de fechas); E2E con el front; `openapi`.
