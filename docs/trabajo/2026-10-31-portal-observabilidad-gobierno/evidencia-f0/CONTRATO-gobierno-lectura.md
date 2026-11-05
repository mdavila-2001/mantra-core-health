# Contrato de lectura del gobierno de datos (F2-DATOS, 31/10/2026)

> API `mantra-core-health-api`, rama `claude/busy-dijkstra-5apd55`. **Verificado contra Postgres real** (copia del API en :3030, base `salud`); salidas en `F2-datos.md`. El front consume sólo lo de este archivo: lo marcado `notMeasured` no tiene fuente y no se simula.

## Reglas comunes
- Sólo `GET`, sólo metadatos (nunca valores de datos, textos libres de fichas, errores crudos ni archivos). Sin token 401; rol fuera de lista 403 `FORBIDDEN`; parámetro no declarado, valor fuera de lista, uuid/fecha inválidos, ventana invertida o cursor corrupto **400** (`VALIDATION_FAILED`/`INVALID_CURSOR`); no existe 404.
- Paginación keyset: `{ items, nextCursor|null, limit, order }`; `limit` 1..200 (50 por omisión); el cursor es opaco y ligado al orden con que se emitió.
- Fechas ISO 8601 UTC con microsegundos. Los códigos de concepto salen sin el prefijo del módulo (`EXEC_SUCCEEDED`, no `system_ops:EXEC_SUCCEEDED`).
- `notMeasured: [{ field, reason }]` = «no hay fuente»; en el front es S3/S7 con el motivo, nunca un 0 ni un verde.
- Alcance: ninguna ruta pide `X-Tenant-Id`. Los roles de plataforma (`SUPERADMIN`, `PLATFORM_ADMIN`, `DATA_PLATFORM_ADMIN`, `GOVERNANCE_ADMIN`) deben ir **sin** cabecera (con una cabecera de otra organización → 403 `TENANT_MEMBERSHIP_REQUIRED`); `DPO`, `AUDITOR`, `DATA_STEWARD`, `SECURITY_ADMIN` se asignan sin tenant y pasan sin cabecera.
- **Alias X-6, sólo de lectura y explícito** (corregido tras la revisión independiente): `GOVERNANCE_ADMIN` y `DATA_GOVERNANCE_ADMIN` figuran los dos en el `@Roles` de cada `GET` de gobierno (`GOVERNANCE_VIEW_ROLES`, `LEGAL_HOLD_VIEW_ROLES`, `PORTAL_VIEW_ROLES`, `AUDIT_SUMMARY_ROLES`). **No hay alias en `RolesGuard`**: en las rutas de escritura cada nombre conserva sólo lo que ya autorizaba.
- Cursor forjado (`t` que no es fecha ISO válida, `i` que no es uuid, tipo de trabajo inexistente) → **400 `INVALID_CURSOR`**, en todas las rutas de este contrato y en `/audit/log` y `/audit/data-access`.

## Roles
| Conjunto | Roles (SUPERADMIN siempre pasa) | Rutas |
|---|---|---|
| `GOVERNANCE_VIEW_ROLES` | SECURITY_ADMIN, PLATFORM_ADMIN, GOVERNANCE_ADMIN, DATA_GOVERNANCE_ADMIN, DATA_PLATFORM_ADMIN, DPO, AUDITOR, DATA_STEWARD | `admin/governance/*` (salvo legal-holds), `admin/catalog/pii/*` |
| `LEGAL_HOLD_VIEW_ROLES` | SECURITY_ADMIN, PLATFORM_ADMIN, GOVERNANCE_ADMIN, DATA_GOVERNANCE_ADMIN, DPO, AUDITOR | `admin/governance/legal-holds` |
| `AUDIT_READ_ROLES` | AUDITOR, DPO, SECURITY_ADMIN | `audit/log`, `audit/log/filter-catalog`, `audit/data-access`, `privacy/dsar[/:id]` |
| `AUDIT_SUMMARY_ROLES` | AUDIT_READ_ROLES + GOVERNANCE_ADMIN + DATA_GOVERNANCE_ADMIN (D-2) | `audit/data-access/summary` |

PLATFORM_ADMIN / DATA_PLATFORM_ADMIN / DATA_STEWARD **no** leen la bitácora ni el DSAR (403). Las lecturas de `audit/*` y `privacy/dsar` quedan selladas en `audit.data_access_log` (`SECURITY_OVERSIGHT`).

## Rutas nuevas (F2-DATOS)

### `GET /admin/governance/domains` — q?, limit?, cursor?  · orden `code, id`
```json
{ "items": [{ "id": "4f33…", "code": "AUDITORIA", "name": "Auditoría", "description": null, "ownerTeam": "Seguridad",
              "entityCount": 1, "version": 1, "createdAt": "2026-10-31T12:16:14.794000Z", "updatedAt": "…" }],
  "nextCursor": null, "limit": 50, "order": "code, id",
  "notMeasured": [{ "field": "stewards", "reason": "system_ops.data_domains sólo guarda un equipo dueño (owner_team): los custodios por dominio no existen todavía" }] }
```
Con la tabla vacía, `notMeasured` suma `{ "field": "domains", … }`.

### `GET /admin/governance/legal-holds` — status? (`ACTIVE|REVOKED`), targetType?, tenantId?, targetId?  · orden `updated_at desc, id desc`
```json
{ "items": [{ "id": "d19f…", "tenantId": "1bef…", "targetType": "HOLD_TARGET_TABLE", "targetId": "9602…",
              "reason": "HOLD_REASON_LITIGATION", "status": "ACTIVE", "startsAt": "…", "endsAt": null,
              "hasAuthorityReference": true, "version": 1, "createdAt": "…", "updatedAt": "…" }],
  "nextCursor": null, "limit": 50, "order": "updated_at desc, id desc",
  "notMeasured": [{ "field": "authorityReference", "reason": "…texto libre…: la lista sólo dice si existe" }] }
```
Un hold levantado tiene `status: "REVOKED"`.

### `GET /admin/governance/retention-executions` — policyId?, entityRegistryId?, status? (`RUNNING|SUCCEEDED|FAILED`), from?, to?  · orden `recorded_at desc, id desc`
```json
{ "items": [{ "id": "c8b8…", "policy": { "id": "a36b…", "code": "RET-F2-DATOS" },
              "entity": { "id": "9602…", "schemaName": "audit", "tableName": "dsar_requests" },
              "status": "FAILED", "startedAt": "…", "finishedAt": "…", "durationMs": 1000,
              "totals": { "scanned": 10, "deleted": 0, "anonymized": 0, "archived": 0 }, "hasError": true, "recordedAt": "…" }],
  "nextCursor": null, "limit": 50, "order": "recorded_at desc, id desc",
  "notMeasured": [{ "field": "errorText", "reason": "…" }, { "field": "requestId", "reason": "retention_executions no guarda el identificador de la petición" }] }
```
`entity` y `durationMs` pueden ser `null`.

### `GET /admin/governance/review-queue` — kind? (`OBJECT|COLUMN`), schema?  · orden `updated_at asc, id asc` (la más antigua primero)
```json
{ "summary": { "total": 127, "bySource": { "CATALOG_OBJECT": 0, "CATALOG_COLUMN": 127 } },
  "items": [{ "source": "CATALOG_COLUMN", "annotationId": "cf40…", "objectId": "67d5…", "columnId": "0002…",
              "schemaName": "ads", "objectName": "conversion_event_user_data", "columnName": "last_name_hash_sha256",
              "sensitivity": "PHI_IDENTIFIER", "origin": "AUTO_CLASSIFIER", "revisionNo": 1,
              "submittedByUserId": "a9f5…", "waitingSince": "…", "ageDays": 0 }],
  "nextCursor": "…", "limit": 50, "order": "updated_at asc, id asc",
  "notMeasured": [{ "field": "glossaryTerms" }, { "field": "policyRevisions" }, { "field": "certifications" }] }
```
`source` es la clave para extender (términos, políticas, certificaciones se sumarán sin romper). `submittedByUserId` sirve para ocultar «aprobar» al propio autor (la API da 403 `SELF_REVIEW`). `summary` respeta `schema`, no `kind` ni la página. Aprobar: `POST /admin/catalog/annotations/:annotationId/review`.

### `GET /admin/governance/jobs` — type? (`CATALOG_SCAN|CLASSIFICATION|RETENTION`), status? (`QUEUED|RUNNING|SUCCEEDED|FAILED|CANCELLED`), from?, to?  · sin rango, 30 días · orden `requested_at desc, type desc, id desc`
```json
{ "items": [
  { "type": "CATALOG_SCAN", "id": "35d6…", "status": "SUCCEEDED", "requestedByUserId": "7bc6…", "requestedAt": "…", "startedAt": "…", "finishedAt": "…",
    "durationMs": 3149, "lease": null, "counters": { "objectsObserved": 1338, "columnsObserved": 18640, "objectsAdded": 1338, "objectsChanged": 0, "objectsNotObserved": 0, "columnsAdded": 18640, "columnsChanged": 0, "columnsNotObserved": 0, "attempt": 1 },
    "errorCode": null, "hasError": false },
  { "type": "CLASSIFICATION", "id": "6c64…", "status": "SUCCEEDED", "requestedByUserId": "7bc6…", "requestedAt": "…", "startedAt": null, "finishedAt": "…", "durationMs": null, "lease": null, "counters": null, "errorCode": null, "hasError": false },
  { "type": "RETENTION", "id": "8617…", "status": "SUCCEEDED", "requestedByUserId": null, "…": "…", "counters": { "scanned": 100, "deleted": 7, "anonymized": 0, "archived": 0 }, "hasError": false } ],
  "nextCursor": null, "limit": 50, "window": { "from": "…", "to": null }, "order": "requested_at desc, type desc, id desc",
  "notMeasured": [{ "field": "classificationRuns.detail" }, { "field": "qualityRuleRuns" }, { "field": "readModelRefreshRuns" }, { "field": "reconciliationRuns" }, { "field": "errorMessage" }, { "field": "requestId" }] }
```
`lease` (sólo escaneos) = `{ owner, expiresAt, expired }` (`expired` = RUNNING con lease vencido). Las corridas de clasificación **no se persisten**: salen del sello de auditoría (`counters: null`, sin duración).

### `GET /admin/catalog/pii/reconciliation` — kind? (`MISSING_IN_REGISTRY|REGISTRY_DISAGREES|ORPHAN_IN_REGISTRY`), schema?  · orden `schema_name, object_name, column_name, kind`
```json
{ "summary": { "approvedPersonalColumns": 2, "declaredFields": 4, "registryEmpty": false,
               "byKind": { "MISSING_IN_REGISTRY": 1, "REGISTRY_DISAGREES": 1, "ORPHAN_IN_REGISTRY": 1 }, "total": 3 },
  "items": [{ "kind": "REGISTRY_DISAGREES", "schemaName": "crm", "objectName": "leads", "columnName": "email",
              "objectId": "0a77…", "columnId": "0033…", "sensitivity": "PHI_IDENTIFIER", "reviewStatus": "APPROVED",
              "entityRegistryId": "769e…", "fieldRegistryId": "2847…" }],
  "nextCursor": null, "limit": 50, "order": "schema_name, object_name, column_name, kind",
  "notMeasured": [{ "field": "unapprovedColumns", "reason": "…" }] }
```
Concilia sólo columnas personales (≥ `PERSONAL`) con ficha **aprobada y vigente**. `ORPHAN_IN_REGISTRY` trae `objectId/columnId/sensitivity/reviewStatus = null`. `notMeasured` suma `catalog` (sin escaneo: no hay conciliación ni huérfanos) y `declaredRegistry.fields` (registro vacío: toda personal aprobada figura como faltante).

### `GET /audit/data-access/summary` — from?, to? (def. 30 días; **ventana mínima 24 h**, si no 400 `INVALID_DATE`), minSample? (**5..1000**, def. 5; menos de 5 → 400)
```json
{ "window": { "from": "…", "to": "…" }, "totals": { "events": 38, "distinctActors": 1, "patientScopedEvents": 0 },
  "byPurpose": [{ "key": "SECURITY_OVERSIGHT", "events": 38, "distinctActors": 1 }],
  "byResourceType": [{ "key": "DATA_ACCESS_SUMMARY", "events": 14, "distinctActors": 1 }, { "key": "DSAR_REQUEST", "events": 14, "distinctActors": 1 }],
  "byOperation": [{ "key": "READ", "events": 38, "distinctActors": 1 }],
  "daily": [{ "day": "2026-10-31", "events": 38 }],
  "minSample": 5, "suppressed": { "byPurpose": 0, "byResourceType": 10, "byOperation": 0, "daily": 0 },
  "notMeasured": [{ "field": "byRole", "reason": "…" }, { "field": "phiOnly", "reason": "…" }] }
```
k-anonimato **impuesto por el servidor**: el piso es 5 y el cliente sólo puede subirlo. Un grupo (o día) con menos de `minSample` eventos no se muestra; si lo oculto suma menos que `minSample` (restarlo del total lo revelaría) se ocultan también los grupos visibles más chicos (supresión complementaria), así que cada cifra de `suppressed` es **0 o ≥ minSample**. `totals.events/distinctActors` son `null` (con `notMeasured: totals`) si hay menos de `minSample` eventos; `totals.patientScopedEvents` es `null` si está entre 1 y `minSample−1`. El front debe pintar `null` como «sin dato (muestra insuficiente)», nunca como 0.

### `GET /privacy/dsar` — status? (`RECEIVED|IN_PROGRESS|COMPLETED|REJECTED`), type? (`ACCESS|ERASURE|RECTIFICATION|PORTABILITY|OBJECTION`), from?, to?  · orden `requested_at desc, id desc`  — y `GET /privacy/dsar/:id` (mismo ítem)
```json
{ "items": [{ "id": "b97e…", "subjectUserId": "7bc6…", "type": "ERASURE", "status": "RECEIVED", "jurisdiction": null,
              "requestedAt": "…", "completedAt": null, "dueAt": "2026-11-30T12:17:17.875Z", "overdue": false,
              "hasResultFile": false, "version": 1, "createdAt": "…", "updatedAt": "…" }],
  "nextCursor": null, "limit": 50, "order": "requested_at desc, id desc",
  "notMeasured": [{ "field": "resultFile" }, { "field": "slaPolicy", "reason": "dueAt usa un plazo fijo de 30 días…" }] }
```
`jurisdiction` es el código del concepto (`JURISDICTION_PE`) o `null`. `overdue` = no cerrada y pasado `dueAt`.

## Rutas que ya existían (verificadas contra Postgres real; cambios de F2-DATOS marcados)
- `GET /admin/governance/policies[?type,state,q,sort,order]`, `policies/:policyType/:id`, `change-log[?targetType,targetId,changedBy,from,to]`, `entity-registry[?schema,q,domain,classification,containsPii,containsPhi]`, `entity-registry/:id/fields` — forma en `H4-gobernanza.md` §3.1. **Cambios**: roles ahora `GOVERNANCE_VIEW_ROLES` (suma AUDITOR y DATA_STEWARD); `action`, `maskingStrategy`, `settings.*` y `state` salen sin prefijo de módulo (`ACTION_CREATE`, `MASK_NONE`). Observado: el `change-log` de un vínculo de retención registra `targetType: "retention_policies"` con el id de la **entidad** (comportamiento del escritor existente, no de la lectura).
- `GET /admin/catalog/pii/summary` y `pii/columns` — `H4-gobernanza.md` §3.2. Con datos reales: `bySensitivity` incluye la fila `UNKNOWN` (columnas sin ficha, 18 447 de 18 640).
- `GET /audit/log` (con `entityId`, uuid del recurso) y `GET /audit/log/filter-catalog` (declara `requestId`/`correlationId` en `notMeasured`; pedir `?requestId=` da 400 a propósito).
