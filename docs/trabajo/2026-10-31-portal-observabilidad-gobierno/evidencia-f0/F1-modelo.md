# F1 — Esquema: módulo 70 `observability` y `telemetry.client_error_events` (evidencia real)

Repo del modelo: `mantra-core-health-model`, rama `claude/busy-dijkstra-5apd55`, commit `5a6fd6d` (modelo v4.2.80). Todo lo de abajo es salida
literal de `psql`/`pg_dump`/los generadores sobre **Postgres 16.15 local (puerto 5544)**, en dos bases descartables creadas y borradas para esto
(`f1_scratch`, `f1_scratch2`); la base `salud` de la API **no se tocó** (solo se leyó con `pg_dump`). **No hay TimescaleDB** en este entorno:
no se ejecutó `create_hypertable`; la convertibilidad se garantiza por construcción (ver §6) y queda por verificar contra un Timescale real.

## 1. Cómo se generó (nada de DDL a mano)

```
.puml (70 nuevo, 28 y 33 ampliados) --gen_ddl.py--> SQL/70_observability/, SQL/28_telemetry/
                                    --gen_integrity.py--> 05_constraints.sql (triggers de inmutabilidad, CHECK) + integrity-matrix.md
                                    --gen_apply.py--> apply_all.sql / apply_deferred.sql
                                    --gen_observability_patch.py (nuevo)--> SQL/patches/2026-10-31_v4280_observabilidad_sistema.sql
```

Generadores con la bóveda en un workspace temporal (`SALUD_WORKSPACE`, con `Mantra Core Health Vault` enlazado a `mantra_core_technologies_health_docs`):

```
[28/telemetry] 15 tablas · 23 FK intra · 54 FK diferidas · 3 inferidas · 93 índices · 1 saltadas
[70/observability] 12 tablas · 3 FK intra · 10 FK diferidas · 8 inferidas · 39 índices · 2 saltadas
Generado SQL/patches/2026-10-31_v4280_observabilidad_sistema.sql · 12+1 tablas · 17 FK · 49 índices · 12 conceptos
SQL/apply_all.sql generado · 63 módulos · 25 con 05_constraints · 90_fk_deferred omitidos
python3 salud-db/check_ddl_sources.py -> Fuentes de DDL OK
python3 -m unittest discover -s salud-db/tests -> Ran 94 tests ... OK (skipped=2)
```

Nota de deriva previa (no tocada): con la bóveda disponible aquí, `gen_ddl.py all` reescribe ~20 archivos de otros módulos (marcas «inferida»,
orden) porque la bóveda está detrás de la que generó el SQL commiteado. Se restauraron; el commit contiene solo módulos 28, 70, apply_*,
matriz de integridad y las filas de 28/33/70 (+Σ) de `_generation_report.md` (el resto de filas del reporte, incluido 29 = 33 tablas, ya
estaba desfasado respecto de `SQL/29_delegated_access/02_tables.sql`, que tiene 27).

## 2. Build desde cero (`f1_scratch`): apply_all + apply_deferred + parches

```
createdb f1_scratch
psql -v ON_ERROR_STOP=1 -d f1_scratch -f SQL/apply_all.sql       -> exit 0 (17,5 s; solo NOTICE "does not exist, skipping" de DROP ... IF EXISTS)
psql -v ON_ERROR_STOP=1 -d f1_scratch -f SQL/apply_deferred.sql  -> exit 0
parches, en el orden del README: 2026-08-05_tenant_rls -> v4275 -> v4278 -> v4279 -> v4280   -> los cinco exit 0
2026-08-05_tenant_rls otra vez, DESPUÉS del v4280                  -> exit 0
```

`\dt observability.*`:

```
                      List of relations
    Schema     |            Name             | Type  | Owner 
---------------+-----------------------------+-------+-------
 observability | alert_evaluations           | table | salud
 observability | alert_rules                 | table | salud
 observability | dependency_probe_runs       | table | salud
 observability | error_events                | table | salud
 observability | error_groups                | table | salud
 observability | http_request_minute_series  | table | salud
 observability | instances                   | table | salud
 observability | rollup_watermarks           | table | salud
 observability | slow_request_samples        | table | salud
 observability | sql_statement_minute_series | table | salud
 observability | sql_statements              | table | salud
 observability | worker_tick_minute_series   | table | salud
(12 rows)

```

Índices del módulo (`\di observability.*`, 51 = 12 PK + 39 secundarios/únicos):

```
                                           List of relations
    Schema     |                   Name                   | Type  | Owner |            Table            
---------------+------------------------------------------+-------+-------+-----------------------------
 observability | brin_alert_evaluations_time              | index | salud | alert_evaluations
 observability | brin_dependency_probe_time               | index | salud | dependency_probe_runs
 observability | brin_error_events_time                   | index | salud | error_events
 observability | brin_http_minute_time                    | index | salud | http_request_minute_series
 observability | brin_slow_request_time                   | index | salud | slow_request_samples
 observability | brin_sql_minute_time                     | index | salud | sql_statement_minute_series
 observability | brin_worker_tick_time                    | index | salud | worker_tick_minute_series
 observability | ix_alert_evaluations_health_incident_id  | index | salud | alert_evaluations
 observability | ix_alert_evaluations_rule_time           | index | salud | alert_evaluations
 observability | ix_alert_rules_created_by_user_id        | index | salud | alert_rules
 observability | ix_alert_rules_enabled_module            | index | salud | alert_rules
 observability | ix_alert_rules_severity_concept_id       | index | salud | alert_rules
 observability | ix_alert_rules_updated_by_user_id        | index | salud | alert_rules
 observability | ix_dependency_probe_code_time            | index | salud | dependency_probe_runs
 observability | ix_dependency_probe_service_component_id | index | salud | dependency_probe_runs
 observability | ix_error_events_group_time               | index | salud | error_events
 observability | ix_error_events_instance_time            | index | salud | error_events
 observability | ix_error_events_module_time              | index | salud | error_events
 observability | ix_error_events_request_id               | index | salud | error_events
 observability | ix_error_groups_assigned_to_user_id      | index | salud | error_groups
 observability | ix_error_groups_code                     | index | salud | error_groups
 observability | ix_error_groups_created_by_user_id       | index | salud | error_groups
 observability | ix_error_groups_module_last_seen         | index | salud | error_groups
 observability | ix_error_groups_resolved_by_user_id      | index | salud | error_groups
 observability | ix_error_groups_state_last_seen          | index | salud | error_groups
 observability | ix_error_groups_updated_by_user_id       | index | salud | error_groups
 observability | ix_http_minute_module_time               | index | salud | http_request_minute_series
 observability | ix_http_minute_route_time                | index | salud | http_request_minute_series
 observability | ix_instances_kind_last_seen              | index | salud | instances
 observability | ix_instances_name                        | index | salud | instances
 observability | ix_slow_request_module_time              | index | salud | slow_request_samples
 observability | ix_slow_request_request_id               | index | salud | slow_request_samples
 observability | ix_sql_minute_hash_time                  | index | salud | sql_statement_minute_series
 observability | ix_sql_minute_module_time                | index | salud | sql_statement_minute_series
 observability | ix_sql_statements_last_seen              | index | salud | sql_statements
 observability | ix_sql_statements_primary_table          | index | salud | sql_statements
 observability | ix_worker_tick_worker_time               | index | salud | worker_tick_minute_series
 observability | pk_alert_evaluations                     | index | salud | alert_evaluations
 observability | pk_alert_rules                           | index | salud | alert_rules
 observability | pk_dependency_probe_runs                 | index | salud | dependency_probe_runs
 observability | pk_error_events                          | index | salud | error_events
 observability | pk_error_groups                          | index | salud | error_groups
 observability | pk_http_request_minute_series            | index | salud | http_request_minute_series
 observability | pk_instances                             | index | salud | instances
 observability | pk_rollup_watermarks                     | index | salud | rollup_watermarks
 observability | pk_slow_request_samples                  | index | salud | slow_request_samples
 observability | pk_sql_statement_minute_series           | index | salud | sql_statement_minute_series
 observability | pk_sql_statements                        | index | salud | sql_statements
 observability | pk_worker_tick_minute_series             | index | salud | worker_tick_minute_series
 observability | uq_alert_rules_code                      | index | salud | alert_rules
 observability | uq_error_groups_fingerprint              | index | salud | error_groups
(51 rows)

```

`telemetry`: tabla nueva e índices nuevos:

```
                                          List of relations
  Schema   |                       Name                        | Type  | Owner |        Table        
-----------+---------------------------------------------------+-------+-------+---------------------
 telemetry | ix_client_error_events_error_class_concept_id     | index | salud | client_error_events
 telemetry | ix_client_error_events_fingerprint_received_at    | index | salud | client_error_events
 telemetry | ix_client_error_events_portal_type_concept_id     | index | salud | client_error_events
 telemetry | ix_client_error_events_received_at                | index | salud | client_error_events
 telemetry | ix_client_error_events_request_id                 | index | salud | client_error_events
 telemetry | ix_client_error_events_route_template_received_at | index | salud | client_error_events
 telemetry | ix_client_error_events_session_id                 | index | salud | client_error_events
 telemetry | ix_client_error_events_user_id                    | index | salud | client_error_events
 telemetry | pk_client_error_events                            | index | salud | client_error_events
(9 rows)

                                           List of relations
  Schema   |                        Name                        | Type  | Owner |        Table         
-----------+----------------------------------------------------+-------+-------+----------------------
 telemetry | ix_user_activity_events_occurred_at                | index | salud | user_activity_events
 telemetry | ix_user_activity_events_route_template_occurred_at | index | salud | user_activity_events
(2 rows)

```

`\d observability.error_events` (hypertable-able: la PK contiene `occurred_at`; FK solo hacia tablas ordinarias):

```
                      Table "observability.error_events"
      Column      |           Type           | Collation | Nullable | Default 
------------------+--------------------------+-----------+----------+---------
 id               | uuid                     |           | not null | 
 occurred_at      | timestamp with time zone |           | not null | 
 error_group_id   | uuid                     |           | not null | 
 request_id       | character varying        |           |          | 
 trace_id         | character varying(32)    |           |          | 
 instance_id      | uuid                     |           | not null | 
 source           | character varying        |           | not null | 
 http_status      | integer                  |           |          | 
 error_code       | character varying        |           | not null | 
 error_reason     | character varying        |           |          | 
 exception_type   | character varying        |           |          | 
 module_code      | character varying        |           |          | 
 operation_key    | character varying        |           |          | 
 http_method      | character varying        |           |          | 
 route_template   | character varying        |           |          | 
 actor_tenant_id  | uuid                     |           |          | 
 actor_hash       | character varying(64)    |           |          | 
 duration_ms      | integer                  |           |          | 
 sqlstate         | character varying        |           |          | 
 constraint_name  | character varying        |           |          | 
 table_name       | character varying        |           |          | 
 column_name      | character varying        |           |          | 
 violations_json  | jsonb                    |           |          | 
 message_redacted | text                     |           |          | 
 frames_json      | jsonb                    |           |          | 
 client_kind      | character varying        |           |          | 
 created_at       | timestamp with time zone |           | not null | 
Indexes:
    "pk_error_events" PRIMARY KEY, btree (id, occurred_at)
    "brin_error_events_time" brin (occurred_at) WITH (pages_per_range='128')
    "ix_error_events_group_time" btree (error_group_id, occurred_at DESC)
    "ix_error_events_instance_time" btree (instance_id, occurred_at DESC)
    "ix_error_events_module_time" btree (module_code, occurred_at DESC)
    "ix_error_events_request_id" btree (request_id, occurred_at DESC)
Check constraints:
    "ck_error_events_source" CHECK (source::text = ANY (ARRAY['api'::character varying, 'worker'::character varying, 'web'::character varying]::text[]))
Foreign-key constraints:
    "fk_error_events_error_group_id" FOREIGN KEY (error_group_id) REFERENCES observability.error_groups(id)
    "fk_error_events_instance_id" FOREIGN KEY (instance_id) REFERENCES observability.instances(id)
Triggers:
    trg_forbid_update BEFORE UPDATE ON observability.error_events FOR EACH ROW EXECUTE FUNCTION integrity.forbid_mutation()

```

`\d telemetry.client_error_events`:

```
                       Table "telemetry.client_error_events"
         Column         |           Type           | Collation | Nullable | Default 
------------------------+--------------------------+-----------+----------+---------
 id                     | uuid                     |           | not null | 
 received_at            | timestamp with time zone |           | not null | 
 occurred_at            | timestamp with time zone |           | not null | 
 portal_type_concept_id | uuid                     |           | not null | 
 actor_tenant_id        | uuid                     |           |          | 
 user_id                | uuid                     |           |          | 
 session_id             | uuid                     |           |          | 
 route_template         | character varying(300)   |           |          | 
 fingerprint            | character varying(32)    |           | not null | 
 error_class_concept_id | uuid                     |           | not null | 
 error_type             | character varying(120)   |           | not null | 
 sanitized_message      | character varying(500)   |           |          | 
 http_method            | character varying(8)     |           |          | 
 api_route_template     | character varying(300)   |           |          | 
 http_status            | smallint                 |           |          | 
 api_error_code         | character varying(60)    |           |          | 
 request_id             | character varying(80)    |           |          | 
 support_code           | character varying(40)    |           |          | 
 app_version            | character varying(40)    |           | not null | 
 build_id               | character varying(40)    |           |          | 
 screen_size            | character varying(12)    |           |          | 
 is_online              | boolean                  |           |          | 
 suppressed_count       | integer                  |           | not null | 0
Indexes:
    "pk_client_error_events" PRIMARY KEY, btree (id)
    "ix_client_error_events_error_class_concept_id" btree (error_class_concept_id)
    "ix_client_error_events_fingerprint_received_at" btree (fingerprint, received_at)
    "ix_client_error_events_portal_type_concept_id" btree (portal_type_concept_id)
    "ix_client_error_events_received_at" btree (received_at DESC)
    "ix_client_error_events_request_id" btree (request_id)
    "ix_client_error_events_route_template_received_at" btree (route_template, received_at)
    "ix_client_error_events_session_id" btree (session_id)
    "ix_client_error_events_user_id" btree (user_id)
Foreign-key constraints:
    "fk_client_error_events_error_class_concept_id" FOREIGN KEY (error_class_concept_id) REFERENCES terminology.catalog_concepts(id)
    "fk_client_error_events_portal_type_concept_id" FOREIGN KEY (portal_type_concept_id) REFERENCES terminology.catalog_concepts(id)
    "fk_client_error_events_session_id" FOREIGN KEY (session_id) REFERENCES iam.sessions(id)
    "fk_client_error_events_user_id" FOREIGN KEY (user_id) REFERENCES iam.users(id)
Triggers:
    trg_forbid_update BEFORE UPDATE ON telemetry.client_error_events FOR EACH ROW EXECUTE FUNCTION integrity.forbid_mutation()

```

`\d observability.http_request_minute_series` (la PK es la clave de idempotencia del volcado):

```
              Table "observability.http_request_minute_series"
     Column     |           Type           | Collation | Nullable | Default 
----------------+--------------------------+-----------+----------+---------
 time           | timestamp with time zone |           | not null | 
 instance_id    | uuid                     |           | not null | 
 flush_seq      | integer                  |           | not null | 
 http_method    | character varying        |           | not null | 
 route_template | character varying        |           | not null | 
 http_status    | integer                  |           | not null | 
 operation_key  | character varying        |           |          | 
 module_code    | character varying        |           |          | 
 requests       | integer                  |           | not null | 
 sum_ms         | double precision         |           | not null | 
 max_ms         | double precision         |           | not null | 
 le5            | integer                  |           | not null | 
 le10           | integer                  |           | not null | 
 le25           | integer                  |           | not null | 
 le50           | integer                  |           | not null | 
 le100          | integer                  |           | not null | 
 le250          | integer                  |           | not null | 
 le500          | integer                  |           | not null | 
 le1000         | integer                  |           | not null | 
 le2000         | integer                  |           | not null | 
 le5000         | integer                  |           | not null | 
 le10000        | integer                  |           | not null | 
 created_at     | timestamp with time zone |           | not null | 
Indexes:
    "pk_http_request_minute_series" PRIMARY KEY, btree ("time", instance_id, flush_seq, http_method, route_template, http_status)
    "brin_http_minute_time" brin ("time") WITH (pages_per_range='128')
    "ix_http_minute_module_time" btree (module_code, "time" DESC)
    "ix_http_minute_route_time" btree (route_template, http_method, "time" DESC)
Triggers:
    trg_forbid_update BEFORE UPDATE ON observability.http_request_minute_series FOR EACH ROW EXECUTE FUNCTION integrity.forbid_mutation()

```

Conteos (consulta al catálogo):

```
tablas observability=12
indices observability=51
FK observability(salientes)=13
FK client_error_events=4
CHECK observability=6
triggers trg_forbid_update=8
```

## 3. RLS: aislamiento por tenant del actor (revisión de seguridad posterior al primer cierre)

`2026-08-05_tenant_rls.sql` pone `tenant_isolation` en **toda** tabla con columna `tenant_id uuid`; sus GUC son `app.current_tenant_id` (organización) y
`app.system_context = 'true'` (contexto de sistema, el que usa `runSystemSweep`); el coordinador escribió `app.tenant_id`, pero el nombre real es el primero.
Ese parche **no cubre** `actor_tenant_id` (por eso la columna no se llama `tenant_id`: ver D-F1-1), así que se decidió la opción explícita y
conservadora: **seis políticas en el parche fechado (sección 6b del v4280)**, mismo patrón, para las dos tablas que llevan el tenant del actor
(`observability.error_events`, `telemetry.client_error_events`), con `ENABLE` + `FORCE ROW LEVEL SECURITY`:

| Política | Comando | Regla |
|---|---|---|
| `actor_tenant_select` | SELECT | `actor_tenant_id = app.current_tenant_id` **o** `app.system_context = 'true'`. Fila sin tenant: solo sistema. Sin contexto: 0 filas (fail-closed) |
| `public_ingest_insert` | INSERT | `WITH CHECK (true)`: la ingesta pública no conoce el tenant, no puede exigirlo (el servicio lo rellena desde el actor, nunca del cuerpo) |
| `system_retention_delete` | DELETE | solo `app.system_context = 'true'` (retención). No hay política de UPDATE (además lo frena el trigger) |

El resto de las tablas de `observability` no llevan tenant y no tienen RLS (sin columna `tenant_id`, sin políticas). La sección 9 del parche aborta si no hay
exactamente esas 6 políticas, si la RLS no está forzada en las dos tablas, o si aparece cualquier otra política/columna `tenant_id`. Construcción desde cero
(`apply_all` + `apply_deferred` + tenant_rls + v4275 + v4278 + v4279 + **v4280 dos veces** + tenant_rls otra vez) -> todos exit 0; el tenant_rls posterior no toca ni
duplica las políticas. Prueba como `mantra_app` (rol sujeto a RLS), en transacciones que se revierten, con dos organizaciones A y B y una fila sin tenant:

```
=== politicas
  schemaname   |      tablename      |       policyname        |  cmd   
---------------+---------------------+-------------------------+--------
 observability | error_events        | actor_tenant_select     | SELECT
 observability | error_events        | public_ingest_insert    | INSERT
 observability | error_events        | system_retention_delete | DELETE
 telemetry     | client_error_events | actor_tenant_select     | SELECT
 telemetry     | client_error_events | public_ingest_insert    | INSERT
 telemetry     | client_error_events | system_retention_delete | DELETE
(6 rows)

       relname       | relrowsecurity | relforcerowsecurity 
---------------------+----------------+---------------------
 error_events        | t              | t
 client_error_events | t              | t
(2 rows)

=== (c) ingesta publica SIN contexto: INSERT con tenant A, con tenant B y sin tenant (no debe exigirlo)
=== sin ningun contexto (fail-closed): lectura
 error_events_visibles | client_error_events_visibles 
-----------------------+------------------------------
                     0 |                            0
(1 row)

=== (a) contexto de organizacion A (app.current_tenant_id=A): solo filas de A
                  id                  |           actor_tenant_id            
--------------------------------------+--------------------------------------
 a0000000-0000-4000-8000-000000000001 | aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
(1 row)

                  id                  |           actor_tenant_id            
--------------------------------------+--------------------------------------
 a1000000-0000-4000-8000-000000000001 | aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
(1 row)

 filas_de_b_visibles 
---------------------
                   0
(1 row)

--- A no puede borrar (retencion es solo sistema): DELETE 0
DELETE 0
RESET
=== (b) contexto de sistema (app.system_context=true, como runSystemSweep): lee todas, incluida la de tenant nulo
                  id                  |           actor_tenant_id            
--------------------------------------+--------------------------------------
 a0000000-0000-4000-8000-000000000001 | aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
 b0000000-0000-4000-8000-000000000001 | bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
 c0000000-0000-4000-8000-000000000001 | 
(3 rows)

 client_error_events_en_sistema 
--------------------------------
                              3
(1 row)

--- sistema borra por retencion
DELETE 1
=== INSERT ... RETURNING sin contexto (aviso para la ingesta)
psql:/tmp/claude-0/-home-user/e193d5cf-24a3-5ae3-aa33-d49093c0d1e4/scratchpad/rls_test.sql:44: ERROR:  new row violates row-level security policy for table "error_events"
```

Lectura de la salida: (c) la ingesta sin contexto inserta filas de A, de B y sin tenant; sin contexto no se lee nada; (a) con `app.current_tenant_id`=A solo se ven las
filas de A (0 de B) y A no borra nada; (b) con `app.system_context=true` se leen las 3 (incluida la de tenant nulo) y se puede borrar por retención.

**Aviso para la ingesta (F2):** `INSERT ... RETURNING` sin contexto falla (la fila nueva debe pasar también la política SELECT, y la pública no tiene tenant). La ingesta
de errores debe insertar **sin `RETURNING`** (el id lo genera el cliente: no hace falta), o hacerlo dentro de un contexto de sistema. Las lecturas del panel de plataforma
pasan por el contexto de sistema; las de una organización ven solo su tenant. `error_groups` y las series no llevan tenant (agregados de plataforma): quien lea
esas tablas con rol de aplicación ve todo, así que sus endpoints siguen siendo de plataforma (guard `@PlatformTenantOptional`), no de organización.

## 4. Comportamiento de las tablas (humo como `mantra_app`)

```
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
--- UPDATE sobre error_events (debe fallar: append-only)
psql:/tmp/claude-0/-home-user/e193d5cf-24a3-5ae3-aa33-d49093c0d1e4/scratchpad/f1_smoke.sql:16: ERROR:  append-only/immutable: UPDATE no permitido en observability.error_events
--- serie por minuto: el reintento del mismo volcado no duplica (ON CONFLICT DO NOTHING)
INSERT 0 1
INSERT 0 0
 filas_tras_reintento 
----------------------
                    1
(1 row)

--- UPDATE sobre la serie (debe fallar)
psql:/tmp/claude-0/-home-user/e193d5cf-24a3-5ae3-aa33-d49093c0d1e4/scratchpad/f1_smoke.sql:27: ERROR:  append-only/immutable: UPDATE no permitido en observability.http_request_minute_series
--- DELETE (retencion) si se permite
psql:/tmp/claude-0/-home-user/e193d5cf-24a3-5ae3-aa33-d49093c0d1e4/scratchpad/f1_smoke.sql:29: ERROR:  current transaction is aborted, commands ignored until end of transaction block
--- CHECK de vocabulario cerrado (debe fallar)
psql:/tmp/claude-0/-home-user/e193d5cf-24a3-5ae3-aa33-d49093c0d1e4/scratchpad/f1_smoke.sql:31: ERROR:  current transaction is aborted, commands ignored until end of transaction block
INSERT 0 1
--- client_error_events: insercion publica (sin tenant, sin sesion, sin GUC) como mantra_app
INSERT 0 1
                  id                  |           fingerprint            | suppressed_count 
--------------------------------------+----------------------------------+------------------
 ccccccc1-cccc-4ccc-8ccc-ccccccccccc1 | ffffffffffffffffffffffffffffffff |                0
(1 row)

--- UPDATE sobre client_error_events (debe fallar)
psql:/tmp/claude-0/-home-user/e193d5cf-24a3-5ae3-aa33-d49093c0d1e4/scratchpad/f1_smoke.sql:42: ERROR:  append-only/immutable: UPDATE no permitido en telemetry.client_error_events

# (los «transaction is aborted» de arriba son la consecuencia esperada del UPDATE que falló dentro de la misma transacción)
# segunda tanda (con SAVEPOINT para seguir tras cada error esperado)
INSERT 0 1
--- DELETE (retencion) si se permite
DELETE 1
--- CHECK de vocabulario cerrado (debe fallar)
psql:/tmp/claude-0/-home-user/e193d5cf-24a3-5ae3-aa33-d49093c0d1e4/scratchpad/f1_smoke2.sql:10: ERROR:  new row for relation "instances" violates check constraint "ck_instances_kind"
DETAIL:  Failing row contains (44444444-4444-4444-8444-444444444444, BOGUS, x, null, null, null, 2026-10-31 09:56:39.438581+00, 2026-10-31 09:56:39.438581+00, running, null, null, 2026-10-31 09:56:39.438581+00, 2026-10-31 09:56:39.438581+00, 1).
--- FK: error_events con grupo inexistente (debe fallar)
psql:/tmp/claude-0/-home-user/e193d5cf-24a3-5ae3-aa33-d49093c0d1e4/scratchpad/f1_smoke2.sql:13: ERROR:  insert or update on table "error_events" violates foreign key constraint "fk_error_events_error_group_id"
DETAIL:  Key (error_group_id)=(df2b6854-1063-468c-804d-edd8ea229048) is not present in table "error_groups".
```

Conceptos que sembró el parche (ids = UUIDv5 de la clave, mismos que deriva la API con `deterministicId`):

```
                   code                   |                  id                  
------------------------------------------+--------------------------------------
 observability:ERROR_GROUP_STATE_IGNORED  | 45c74d83-87a6-5fcd-95cc-785783a67feb
 observability:ERROR_GROUP_STATE_NEW      | 2529878b-9021-5f78-84e7-277a0f2736fd
 observability:ERROR_GROUP_STATE_RESOLVED | 65878481-6760-5406-8c59-e530bcaaea17
 observability:ERROR_GROUP_STATE_SEEN     | 5dd2898e-a1e9-5581-b525-4868cb33dc2d
 telemetry:ERROR_CLASS_CHUNK              | 18aa38ac-4de0-5ef8-b5b0-b359ff8e3515
 telemetry:ERROR_CLASS_HTTP               | b50bdf43-d747-5942-a472-f6462afe4a86
 telemetry:ERROR_CLASS_HYDRATION          | 77e406cb-8fac-5fbf-889f-5dd5d2dc358e
 telemetry:ERROR_CLASS_JS                 | 5ba43268-115e-5daa-b5b6-4c87aa675a43
 telemetry:ERROR_CLASS_NATIVE             | f71fb756-3320-5d6a-b852-8e9a81335799
 telemetry:ERROR_CLASS_PROMISE            | 81575400-d9af-5769-8289-43eea6ed152f
 telemetry:ERROR_CLASS_ROUTE              | 730cc3b1-69ac-56a6-941f-4d7e0dd91609
 telemetry:ERROR_CLASS_TEMPLATE           | ca456806-4152-5b27-8fa3-8327422f8c79
(12 rows)
```

## 5. Parche sobre una base que ya tenía el esquema anterior (`f1_scratch2`), dos veces

Base: `pg_dump -s salud | psql f1_scratch2` (1325 tablas, **sin** schema `observability` ni `telemetry.client_error_events`) + datos de `terminology` y
`telemetry` (11 463 conceptos) y 400 300 filas sintéticas en `telemetry.user_activity_events`.

```
antes: schemas observability=0
antes: client_error_events=(no existe)
antes: tablas del modelo=1325
== 1a aplicación: exit 0   (14 NOTICE de IF NOT EXISTS/duplicate; termina en DO / DO / COMMIT)
   conceptos: 11463 -> 11475 (+12)    filas de user_activity_events: 400305 (intactas)
== 2a aplicación: exit 0   (termina en DO / DO / COMMIT)
   conceptos: 11475 (sin cambio)
observability: dump (pg_dump -s) tras 1a aplicación == tras 2a (identicos, 360 lineas)
telemetry client_error_events+user_activity_events: 1a == 2a (118 lineas)
observability: build desde cero == base parcheada (salvo GRANTs)
telemetry (2 tablas): desde cero == parcheada (salvo GRANTs)
```

Las únicas diferencias entre «desde cero» y «parcheada» son los `GRANT`: el parche quita `UPDATE/TRUNCATE` a `mantra_app` sobre las 8 tablas de
historia; el RLS re-ejecutado vuelve a concederlos (los dispara el `trg_forbid_update`, que sí frena el UPDATE sea cual sea el privilegio: probado en §4).
La sección 9 del parche aborta (y revierte todo) si no hay 12 tablas, 8 disparadores, 12 conceptos, 6 políticas RLS con RLS forzada, o si aparece una columna `tenant_id`.

### EXPLAIN antes / después de los dos índices de `user_activity_events` (H1.S1.M4)

400 305 filas, 300 de ellas en la ruta consultada; `EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)`.

Antes (sin el parche):

```
                                                                              QUERY PLAN                                                                               
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Finalize Aggregate (actual rows=1 loops=1)
   Buffers: shared hit=6903
   ->  Gather (actual rows=3 loops=1)
         Workers Planned: 2
         Workers Launched: 2
         Buffers: shared hit=6903
         ->  Partial Aggregate (actual rows=1 loops=3)
               Buffers: shared hit=6903
               ->  Parallel Seq Scan on user_activity_events (actual rows=100 loops=3)
                     Filter: (((route_template)::text = '/superadmin/observability'::text) AND (occurred_at < now()) AND (occurred_at >= (now() - '1 day'::interval)))
                     Rows Removed by Filter: 133335
                     Buffers: shared hit=6903
 Planning:
   Buffers: shared hit=255 read=1
 Planning Time: 0.816 ms
 Execution Time: 29.477 ms
(16 rows)

                                               QUERY PLAN                                                
---------------------------------------------------------------------------------------------------------
 Finalize Aggregate (actual rows=1 loops=1)
   Buffers: shared hit=6903
   ->  Gather (actual rows=3 loops=1)
         Workers Planned: 2
         Workers Launched: 2
         Buffers: shared hit=6903
         ->  Partial Aggregate (actual rows=1 loops=3)
               Buffers: shared hit=6903
               ->  Parallel Seq Scan on user_activity_events (actual rows=2499 loops=3)
                     Filter: ((occurred_at < now()) AND (occurred_at >= (now() - '02:00:00'::interval)))
                     Rows Removed by Filter: 130936
                     Buffers: shared hit=6903
 Planning Time: 0.113 ms
 Execution Time: 30.220 ms
(14 rows)

```

Después (con el parche):

```
                                                                      QUERY PLAN                                                                       
-------------------------------------------------------------------------------------------------------------------------------------------------------
 Aggregate (actual rows=1 loops=1)
   Buffers: shared hit=1 read=5
   ->  Index Only Scan using ix_user_activity_events_route_template_occurred_at on user_activity_events (actual rows=300 loops=1)
         Index Cond: ((route_template = '/superadmin/observability'::text) AND (occurred_at >= (now() - '1 day'::interval)) AND (occurred_at < now()))
         Heap Fetches: 0
         Buffers: shared hit=1 read=5
 Planning:
   Buffers: shared hit=303 read=3
 Planning Time: 1.347 ms
 Execution Time: 0.158 ms
(10 rows)

                                                     QUERY PLAN                                                     
--------------------------------------------------------------------------------------------------------------------
 Aggregate (actual rows=1 loops=1)
   Buffers: shared hit=4 read=20
   ->  Index Only Scan using ix_user_activity_events_occurred_at on user_activity_events (actual rows=7476 loops=1)
         Index Cond: ((occurred_at >= (now() - '02:00:00'::interval)) AND (occurred_at < now()))
         Heap Fetches: 0
         Buffers: shared hit=4 read=20
 Planning:
   Buffers: shared hit=8
 Planning Time: 0.119 ms
 Execution Time: 0.869 ms
(10 rows)

```

Consulta 1 (ruta + rango de un día): `Parallel Seq Scan` 6 903 buffers, 29,5 ms -> `Index Only Scan` sobre
`ix_user_activity_events_route_template_occurred_at`, 6 buffers, 0,16 ms. Consulta 2 (rango de 2 h): 6 903 buffers, 30,2 ms -> 24 buffers, 0,87 ms
con `ix_user_activity_events_occurred_at`.

## 6. Decisiones de diseño y lo que no se pudo verificar

| # | Decisión | Por qué |
|---|---|---|
| D-F1-1 | Ninguna columna `tenant_id`; el tenant del actor es `actor_tenant_id` (uuid, sin FK) | El RLS alcanza toda tabla con `tenant_id uuid` (§3) |
| D-F1-2 | Series relacionales en el módulo 70, no `TIMESERIES_MEASUREMENT` en el 58 | El 58 emite `CREATE EXTENSION timescaledb`, no está en `apply_all.sql` y no aplica en Postgres plano. PK con la columna de tiempo, sin único sin ella y sin FK hacia estas tablas = convertibles; chunk 1 día y retención por tabla en la nota `HYPERTABLE POLICY` del `.puml` |
| D-F1-2c | La PK de cada serie es su clave de idempotencia; **no** se declaran `uq_http_minute_key`, `uq_sql_minute_key`, `uq_worker_tick_key`, `uq_error_events_id_time`, `uq_sql_statements_hash` | Serían un segundo índice único idéntico a la PK (doble costo de escritura). `ON CONFLICT DO NOTHING` sin destino explícito los cubre |
| D-F1-3 | Series de alta frecuencia con `instance_id` **sin FK**; `error_events` sí tiene FK a `instances` | Un volcado no debe fallar por un latido tardío |
| D-F1-4 | `alert_rules.severity_concept_id` reutiliza las severidades de incidentes de `platform_ops` | El plan pedía verificar; no hay vocabulario nuevo |
| D-F1-5 | `observability.client_error_events` de 02 §4.1 **no se crea**; vale `telemetry.client_error_events` (03 §4.3, 90 d) | Una tabla, un dueño |
| D-F1-6 | `sql_statement_minute_series.operation_key` es NOT NULL (forma parte de la PK); la API escribe `UNKNOWN` | Una columna nula no puede estar en una PK |
| D-F1-7 | `slow_request_samples` lleva `id` + `time` como PK; `alert_evaluations` PK `id` (no hypertable) | El plan no daba clave |
| — | `http` mide `le5…le10000` (11 cortes reales de `LATENCY_BUCKETS_MS`, incluye `le2000`); `requests` es el cubo +Inf | Coincide con `http-sli.aggregator.ts` |

No se pudo verificar / no se hizo:
- **TimescaleDB real**: no hay extensión; `create_hypertable(... migrate_data => TRUE)` sobre estas PK no se ejecutó (es el carril de `physical.catalog.ts`).
- **Semillas H1.S2.M2** (`service_components`, SLI/SLO/presupuestos ×3): no se hicieron; el parche solo siembra los 12 conceptos. Tampoco `gen_seeds.py`/`seedsGenerales/`.
- **`check-schema-drift` del API**: no corrió (otro repo); `docs/data-catalog/` (necesita fila de justificación por tabla, revisión de dominio) sin regenerar.
- **Entidades del API**: ver el informe (se generaron a un directorio temporal, no a `mantra-core-health-api`).
- Numeración: el módulo SALUD 70 comparte número con la base PAY `pay_connectors` (70-89 reservados para PAY); no chocan (salidas `SQL/70_observability/` vs `SQL/pay/70_pay_connectors/`), anotado en el manifest.
