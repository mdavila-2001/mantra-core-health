# F2-SISTEMA — evidencia (31/10/2026)

API: `/home/user/mantra-core-health-api`, rama `claude/busy-dijkstra-5apd55`. Commits: `34327022b` (rebanada 1), `8247ba791`, `1f512fb41`, `47753b7e3` (SQL normalizado completo), `3a30108ce` (ventana inválida 422).

## Estado por rebanada
| Rebanada | Estado |
|---|---|
| 1 entidades módulo 70 | completa (commit previo) |
| 2 captura HTTP, volcado idempotente, instancia, `OBSERVABILITY_ENABLED` con validación, doble escritura a `service_sli_series` | completa; verificada contra Postgres (abajo) |
| 3 errores (`ErrorSink`, grupos, `/errors/*`, `/requests/:id`, `PATCH`) | completa; verificada |
| 4 SQL (`SqlSink`, `/sql/*`, `slow_request_samples`) | completa; verificada. Hallazgo de seguridad del coordinador corregido (ver más abajo) |
| 5 `summary, timeseries, endpoints, modules, coverage` con sobre y `tz` | completa; verificada |
| `modules/heatmap`, `workers`, `dependencies`, `slo`, latidos, sondas, rollups, alertas | no se hicieron (otra tanda) |

## Qué corrió (salidas reales)
- `yarn typecheck`: sin errores en lo mío; 2 errores ajenos en `src/modules/audit/controllers/compliance.controller.spec.ts` (carril DATOS, en curso).
- `yarn build` (8192): compila (un error ajeno de `telemetry-parts-analytics.service.ts` apareció en una corrida intermedia, carril APP).
- eslint de lo tocado: limpio. Jest `src/modules/observability src/observability/capture src/orm/observability src/common/filters`: 19 suites / 196 pruebas verdes; tras el arreglo de SQL y de ventana: 12 suites/122 y 5 suites/36 verdes. Falla ajena preexistente: `observability/route-index/route-index.service.spec.ts` (rutas nuevas de `AdminCatalogController` sin openapi regenerado, carril DATOS).
- Carga conocida `scripts/observability/selftest.mjs` (13:07 UTC), todas las respuestas con el estado esperado: 37×200, 11×400 (`/admin/ops/traffic?from=basura`, validación del pipe de ese controlador), 7×404, 5×403, 4×500 `throw`, 3×500 `type`.
- `psql` sobre `observability.http_request_minute_series` (filas creadas desde el inicio de la carga): `GET /admin/ops/slos` 200 = 37 y 403 = 5; `GET /admin/ops/traffic` 400 = 11; `UNMATCHED` 404 = 8 (7 míos + 1 de otro agente que comparte la base). Con `operation_key` resuelto (`OpsConsoleController_slos`).
- Errores: `/admin/ops/traffic` 11 eventos con 11 `request_id` distintos en un grupo; `UNMATCHED` 8/8; 500 `throw` 4 y `type` 3 (dos grupos: distinto `exception_type`). `occurrences_total` = filas de `error_events` en todos los grupos revisados (44/44, 71/71, 12/12, 21/21 acumulando corridas previas).
- `GET /requests/7c31cc40-58ad-412d-a7ba-935a44464bf2` (el `correlationId` devuelto por la API en un 500): `found:true`, `code:INTERNAL`, ruta y operación correctas.
- `PATCH /errors/groups/:id` con SUPERADMIN: SEEN con `expectedVersion:1` 200; reenvío con versión 1 -> 409 `CONCURRENCY_CONFLICT`; RESOLVED sin motivo -> 422 `…NOTE_REQUIRED`; con motivo 200. Filas en `audit.audit_log` (`ERROR_GROUP_STATE_CHANGED`, entidad `error_group`). `plataforma@alovida.test` sin `X-Tenant-Id` -> 403 `TENANT_AMBIGUOUS` (decisión: la mutación no hereda el alcance plataforma).
- Matriz de autorización sobre `GET /summary`: sin token 401; `medico2org@alovida.test` 403; `plataforma@alovida.test` sin cabecera 200; `plataforma` con tenant ajeno 403; `admin@alovidasalud.com` 200. Ventana inválida: `tz=Mars/Base` 422 `INVALID_TIMEZONE`; `from=basura` daba 400 del pipe, corregido a 422 `INVALID_DATE` en `3a30108ce` (prueba unitaria; no re-probado en vivo).
- Privacidad: 0 `normalized_sql` con comillas/`--`/`/*`/`$$` y 0 UUID en `route_template`/`message_redacted`/`normalized_sql` (consultas `psql` sobre 325 sentencias).

## Hallazgo de seguridad del coordinador (SQL partido en el corte)
Corregido en `47753b7e3`: se normaliza la sentencia completa antes de acotar; `normalizeSql` lee en una pasada comentarios `--` y `/* */`, `E'…'` con escapes, `'…'` y `$tag$…$tag$` (lo sin cerrar llega al final); `storableNormalizedSql` devuelve `[truncated]` si queda comilla, comentario o dólar, o si la entrada supera 200 000 caracteres. `sql_top_json` y `slow_request_samples` sólo guardan hashes. Pruebas hostiles en `sql-sink.spec.ts` (correo y documento en literal partido en el límite de 20 000, literal sin cerrar, `E'it\'s'`, `$$…$$`, `$x$…$x$`, comentarios, entrada de 300 000): todas verdes, ninguna deja un fragmento del literal en lo que el sink entrega.

## No verificado
- Reinicio con SIGTERM sin pérdida y reenvío de un volcado: sólo pruebas unitarias del servicio de volcado (idempotencia por clave); la prueba en vivo no se completó (el reinicio de la API quedó en curso al cierre).
- Dos instancias simultáneas (P6), `RLS_ENFORCE=true`, `docker`/Timescale (la base local no tiene Timescale: las series son tablas normales).
- `module_code`: `data_catalog.catalog_operations` está vacío en esta base, todo sale `UNKNOWN` (declarado en `notMeasured.moduleAttribution`). Se necesita que el inventario del catálogo se importe (carril DATOS) para atribuir módulos.
- Re-probar en vivo el 422 de `from=basura` y las pruebas hostiles contra SQL real del ORM.

## Pide al modelo
Nada nuevo en el esquema. Pedido de datos: sembrar/importar `data_catalog.catalog_operations`; y revisar `occurrences_24h` de `error_groups` (la lectura lo calcula desde eventos, la columna no se mantiene).
