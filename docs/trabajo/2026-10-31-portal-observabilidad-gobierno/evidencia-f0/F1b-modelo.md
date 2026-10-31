# F1b — Gobierno de datos, lote de cargas masivas y motor de aprobación (evidencia real)

Repo del modelo `mantra-core-health-model`, rama `claude/busy-dijkstra-5apd55`, modelo **v4.2.81**. Cinco commits (no hay PR):

```
2ad60f3 fix(modelo): FK compuestas por tenant en el lote de bulk_import (v4.2.81)
cb8cf50 feat(modelo): motor de aprobación único, four_eyes_requests con sujeto genérico y kinds nuevos (v4.2.81)
2c0f55a feat(modelo): lote persistente de bulk_import, system_ops.bulk_import_batches y _rows (v4.2.81)
91c83dd feat(modelo): gobierno de datos, módulo 67 y system_ops.governance_policy_revisions (v4.2.81)
f31acee feat(modelo): idempotencia de los eventos anónimos de telemetría, índice único parcial (v4.2.81)
```

Todo lo de abajo es salida literal de `psql`/`pg_dump`/generadores sobre Postgres 16.15 local (5544), en bases descartables creadas y borradas para esto
(`f1b_fs` desde cero con los archivos commiteados; `f1b_fu` = `pg_dump -s salud` del esquema anterior v4.2.80 + eventos anónimos repetidos sintéticos).
**No hay TimescaleDB** en este entorno (nada de esto lo necesita). La base `salud` recibió los parches al final, ver §7.

## 1. Cómo se generó (nada de DDL a mano)

`.puml` (11, 28, 29, 33, 67) -> `gen_ddl.py` -> `SQL/` -> `gen_integrity.py` (disparadores y CHECK) -> `gen_apply.py` -> `gen_v4281_patches.py` (cuatro parches que **copian** ese DDL).
`salud-db/tests/test_v4281_patches.py` regenera cada parche y lo compara con el archivo: falla si alguien lo edita a mano.

```
python3 -m unittest discover -s salud-db/tests  -> Ran 98 tests ... OK (skipped=2)
python3 salud-db/check_ddl_sources.py           -> Fuentes de DDL OK
```

Hallazgo del generador que se arregló en el `.puml`: las FK intra-módulo de las tablas ya promovidas del 67 salían de notas FK de la bóveda que este checkout no tiene; regenerar las perdía en
silencio (84 líneas). Ahora van como aristas etiquetadas y el diff de `03_fk_intra.sql` del 67 no quita nada.

## 2. Aplicaciones (los cuatro parches, dos veces, en las dos bases)

```
f1b_fs ronda 1 idempotencia_anonima -> exit 0 |  v4281: 0 evento(s) anonimo(s) repetido(s) eliminado(s) (propiedades reapuntadas: 0, propiedades repetidas eliminadas: 0)
f1b_fs ronda 1 gobierno_de_datos -> exit 0 |  v4281 gobierno: 13 tablas, 48 FK, 51 indices, 9 CHECK, 4+1 disparadores
f1b_fs ronda 1 cargas_masivas -> exit 0 |  v4281 cargas: 2 tablas, 7 FK, 12 indices, 3 CHECK, RLS forzada
f1b_fs ronda 1 motor_aprobacion -> exit 0 |  v4281 aprobacion: 2 columnas, 1 indice, 1 CHECK, 5 conceptos
f1b_fs ronda 2 idempotencia_anonima -> exit 0 |  v4281: 0 evento(s) anonimo(s) repetido(s) eliminado(s) (propiedades reapuntadas: 0, propiedades repetidas eliminadas: 0)
f1b_fs ronda 2 gobierno_de_datos -> exit 0 |  v4281 gobierno: 13 tablas, 48 FK, 51 indices, 9 CHECK, 4+1 disparadores
f1b_fs ronda 2 cargas_masivas -> exit 0 |  v4281 cargas: 2 tablas, 7 FK, 12 indices, 3 CHECK, RLS forzada
f1b_fs ronda 2 motor_aprobacion -> exit 0 |  v4281 aprobacion: 2 columnas, 1 indice, 1 CHECK, 5 conceptos
f1b_fu ronda 1 idempotencia_anonima -> exit 0 |  v4281: 3 evento(s) anonimo(s) repetido(s) eliminado(s) (propiedades reapuntadas: 2, propiedades repetidas eliminadas: 1)
f1b_fu ronda 1 gobierno_de_datos -> exit 0 |  v4281 gobierno: 13 tablas, 48 FK, 51 indices, 9 CHECK, 4+1 disparadores
f1b_fu ronda 1 cargas_masivas -> exit 0 |  v4281 cargas: 2 tablas, 7 FK, 12 indices, 3 CHECK, RLS forzada
f1b_fu ronda 1 motor_aprobacion -> exit 0 |  v4281 aprobacion: 2 columnas, 1 indice, 1 CHECK, 5 conceptos
f1b_fu ronda 2 idempotencia_anonima -> exit 0 |  v4281: 0 evento(s) anonimo(s) repetido(s) eliminado(s) (propiedades reapuntadas: 0, propiedades repetidas eliminadas: 0)
f1b_fu ronda 2 gobierno_de_datos -> exit 0 |  v4281 gobierno: 13 tablas, 48 FK, 51 indices, 9 CHECK, 4+1 disparadores
f1b_fu ronda 2 cargas_masivas -> exit 0 |  v4281 cargas: 2 tablas, 7 FK, 12 indices, 3 CHECK, RLS forzada
f1b_fu ronda 2 motor_aprobacion -> exit 0 |  v4281 aprobacion: 2 columnas, 1 indice, 1 CHECK, 5 conceptos
```

## 3. Dos aplicaciones idénticas; desde cero == parchada

```
## desde cero: dump tras la 1a aplicacion == tras la 2a
IDENTICOS (185365 lineas)
## esquema anterior: dump tras la 1a aplicacion == tras la 2a
IDENTICOS (186739 lineas)
## que agregan los parches sobre la base construida desde cero (apply_all ya trae las tablas; el parche agrega guarda, permisos y conceptos)
> CREATE FUNCTION system_ops.guard_governance_policy_revision() RETURNS trigger
>     LANGUAGE plpgsql
>     AS $$
> BEGIN
>     IF TG_OP = 'DELETE' THEN
>         RAISE EXCEPTION 'append-only/immutable: DELETE no permitido en %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
>     END IF;
>     IF ROW(NEW.id, NEW.policy_type, NEW.policy_id, NEW.revision_no, NEW.content_json, NEW.content_hash, NEW.change_reason,
>            NEW.submitted_by_user_id, NEW.submitted_at, NEW.created_at)
>        IS DISTINCT FROM
>        ROW(OLD.id, OLD.policy_type, OLD.policy_id, OLD.revision_no, OLD.content_json, OLD.content_hash, OLD.change_reason,
>            OLD.submitted_by_user_id, OLD.submitted_at, OLD.created_at) THEN
>         RAISE EXCEPTION 'append-only/immutable: lo propuesto de una revision de politica (contenido, hash, motivo, autor) no se modifica en %.%',
>             TG_TABLE_SCHEMA, TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
>     END IF;
>     IF OLD.decided_at IS NOT NULL
>        AND ROW(NEW.decided_by_user_id, NEW.decided_at, NEW.decision_comment)
>            IS DISTINCT FROM ROW(OLD.decided_by_user_id, OLD.decided_at, OLD.decision_comment) THEN
>         RAISE EXCEPTION 'append-only/immutable: una decision ya tomada sobre una revision de politica no se reescribe (%.%)',
>             TG_TABLE_SCHEMA, TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
>     END IF;
>     IF (OLD.status IN ('REJECTED', 'SUPERSEDED') AND NEW.status <> OLD.status)
>        OR (OLD.status = 'APPROVED' AND NEW.status NOT IN ('APPROVED', 'SUPERSEDED')) THEN
>         RAISE EXCEPTION 'append-only/immutable: el estado de una revision de politica no retrocede (% -> %)', OLD.status, NEW.status
>             USING ERRCODE = 'restrict_violation';
>     END IF;
>     RETURN NEW;
> END $$;
> ALTER FUNCTION system_ops.guard_governance_policy_revision() OWNER TO salud;
> CREATE TRIGGER trg_guard_policy_revision BEFORE DELETE OR UPDATE ON system_ops.governance_policy_revisions FOR EACH ROW EXECUTE FUNCTION system_ops.guard_governance_pol
< GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE data_catalog.catalog_change_acknowledgements TO mantra_app;
> GRANT SELECT,INSERT,DELETE ON TABLE data_catalog.catalog_change_acknowledgements TO mantra_app;
< GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE data_catalog.catalog_glossary_term_revisions TO mantra_app;
> GRANT SELECT,INSERT,DELETE ON TABLE data_catalog.catalog_glossary_term_revisions TO mantra_app;
< GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE data_catalog.quality_issue_events TO mantra_app;
> GRANT SELECT,INSERT,DELETE ON TABLE data_catalog.quality_issue_events TO mantra_app;
< GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE data_catalog.quality_score_snapshots TO mantra_app;
> GRANT SELECT,INSERT,DELETE ON TABLE data_catalog.quality_score_snapshots TO mantra_app;
< GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE system_ops.governance_policy_revisions TO mantra_app;
> GRANT SELECT,INSERT,UPDATE ON TABLE system_ops.governance_policy_revisions TO mantra_app;
## objetos del v4281: desde cero vs esquema anterior parchado (mismas definiciones)
lineas comparadas: 483 vs 483
448c448
< CREATE UNIQUE INDEX ux_data_catalog_scan_runs_one_active ON data_catalog.catalog_scan_runs USING btree (source_code) WHERE ((status)::text = ANY ((ARRAY['QUEUED'::character varying, 'RUNNING'::character varyi
---
> CREATE UNIQUE INDEX ux_data_catalog_scan_runs_one_active ON data_catalog.catalog_scan_runs USING btree (source_code) WHERE ((status)::text = ANY (ARRAY[('QUEUED'::character varying)::text, ('RUNNING'::charact
SIN DIFERENCIAS
```

Las únicas diferencias «desde cero» vs «parchada» son lo que el parche agrega a propósito sobre lo que `apply_all.sql` ya creó: la función/disparador de columnas de las revisiones de política y los `GRANT`
(quita UPDATE a `mantra_app` sobre las 4 tablas inmutables, y DELETE sobre las revisiones). La línea de `ux_data_catalog_scan_runs_one_active` es deriva previa de la base de desarrollo (formato del cast), no de esta franja.
`2026-08-05_tenant_rls.sql` ejecutado DESPUÉS de los parches:

```
tenant_rls despues de v4281: exit 0
bulk_import_batch_rows|1
bulk_import_batches|1
```

## 4. Idempotencia anónima (entregable 1)

Dos inserts concurrentes con la misma clave anónima y organización (S1 confirma a los 4 s; S2 espera y falla con 23505):

```
 s1_inserto 
 s1_confirmo 
 s2_intenta 
 ERROR:  duplicate key value violates unique constraint "ux_user_activity_events_anonymous_idempotency"
 ERROR:  current transaction is aborted, commands ignored until end of transaction block
filas con esa clave tras las dos transacciones: 1
```

Casos (sin organización choca por el COALESCE; otra organización y los identificados no chocan; `ON CONFLICT` con la misma expresión da `INSERT 0 0`; EXPLAIN usa los dos índices):

```
=== anonimo SIN organizacion: dos veces la misma clave -> debe chocar (por el COALESCE; sin el, los NULL serian distintos)
e1_more.sql:6: ERROR:  duplicate key value violates unique constraint "ux_user_activity_events_anonymous_idempotency"
DETAIL:  Key (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), event_idempotency_key)=(00000000-0000-0000-0000-000000000000, n-1) already exists.
=== misma clave, OTRA organizacion -> permitido
=== misma clave pero IDENTIFICADO (user_id) dos veces -> permitido (el indice de busqueda no es unico)
=== ON CONFLICT con la misma expresion: el reintento no inserta (INSERT 0 0), sin error
INSERT 0 0
 clave  | con_org | identificado | count 
--------+---------+--------------+-------
 conc-1 | t       | f            |     2
 conc-1 | t       | t            |     2
 conc-2 | t       | f            |     1
 n-1    | f       | f            |     1
(4 rows)

=== el indice de busqueda de identificados lo usa el planificador (EXPLAIN)
                                                          QUERY PLAN                                                           
-------------------------------------------------------------------------------------------------------------------------------
 Index Scan using ix_user_activity_events_user_idempotency on user_activity_events
   Index Cond: ((user_id = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c'::uuid) AND ((event_idempotency_key)::text = 'conc-1'::text))
(2 rows)

                                                                                       QUERY PLAN                                                                                        
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Index Scan using ux_user_activity_events_anonymous_idempotency on user_activity_events
   Index Cond: ((COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid) = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'::uuid) AND ((event_idempotency_key)::text = 'conc-1'::text))
(2 rows)

```

Base con repetidos (`f1b_fu`, 9 eventos: 3+2 repetidos anónimos, 2 identificados con la misma clave, 1 de otra organización; propiedades, web vitals, journey y conversión colgando de los repetidos). Resultado tras el parche:

```
 ev | clave | con_org | identificado 
----+-------+---------+--------------
 01 | dupA  | t       | f
 04 | dupB  | f       | f
 06 | solo  | f       | f
 07 | dupA  | t       | t
 08 | dupA  | t       | t
 09 | dupA  | t       | f
(6 rows)

              que              | valor 
-------------------------------+-------
 propiedades del conservado 01 | x,y,z
 propiedades de los borrados   | 0
 web_vitals ->                 | 01
 journey entry/exit ->         | 04/01
 conversion completion ->      | 01
(5 rows)

```

Sobrevive el más antiguo; los identificados y la otra organización quedan; lo que colgaba de un repetido se reapunta (journey 04/01, conversión 01, web vital 01; propiedades x,y,z en el conservado).
Corrido como `mantra_app` (sujeta a RLS) sin `app.system_context` ve 0 anónimos; con el contexto que fija el parche, 7 (control negativo hecho en una corrida previa de desarrollo).
Con 400 mil filas y 25 claves repetidas (corrida de desarrollo): deduplicación 444 ms, índice único 280 ms, índice de búsqueda 120 ms, `lock_timeout 15s`.
Nota para la API: la búsqueda del anónimo debe usar la misma expresión `COALESCE(tenant_id, uuid cero)` (o `ON CONFLICT` con ella) para usar el índice único; sin la expresión no lo usa.

## 5. Gobierno de datos (entregable 2) — comportamiento real

```
=== FK activas: un dominio inexistente se rechaza
e2_behavior.sql:7: ERROR:  insert or update on table "catalog_stewardships" violates foreign key constraint "fk_catalog_stewardships_domain_id"
DETAIL:  Key (domain_id)=(6ec068cc-cdbf-48a6-a7d1-79683180c534) is not present in table "data_domains".
=== responsables: alcance incoherente (DOMAIN con object_id) -> debe fallar ck_catalog_stewardships_scope
e2_behavior.sql:13: ERROR:  new row for relation "catalog_stewardships" violates check constraint "ck_catalog_stewardships_scope"
DETAIL:  Failing row contains (ae771af5-bfbd-4384-b2be-c03d1c279932, DOMAIN, af212e35-f5eb-49e3-87ff-79238a66a4cb, 086399e6-eeb1-40e4-ab45-031531bd9e44, DATA_STEWARD, null, x, 2026-10-31 12:19:50.952277+00, nul
=== responsables: sin usuario ni equipo -> debe fallar ck_catalog_stewardships_holder
e2_behavior.sql:18: ERROR:  new row for relation "catalog_stewardships" violates check constraint "ck_catalog_stewardships_holder"
DETAIL:  Failing row contains (a1b4edc7-2d4a-4767-90e7-bcf866b96212, DOMAIN, ca3af948-a69c-4d4d-a1d0-3c99883490ac, null, DATA_STEWARD, null, null, 2026-10-31 12:19:50.952798+00, null, 2026-10-31 12:19:50.952798
=== responsables: un solo vigente por (alcance, objetivo, rol); cerrar el vigente permite el siguiente
SELECT 1
e2_behavior.sql:27: ERROR:  duplicate key value violates unique constraint "ux_data_catalog_stewardships_active_role"
DETAIL:  Key (scope_kind, COALESCE(domain_id, object_id), role_kind)=(DOMAIN, 3947dcb1-d265-4cf8-8ea9-bf74637ee8bf, BUSINESS_OWNER) already exists.
                       prueba                        | filas | vigentes 
-----------------------------------------------------+-------+----------
 responsables de ese dominio (1 cerrado + 1 vigente) |     2 |        1
(1 row)

=== glosario: el mismo termino se enlaza una sola vez, tambien con columna NULL (COALESCE)
SELECT 1
e2_behavior.sql:39: ERROR:  duplicate key value violates unique constraint "ux_data_catalog_glossary_term_links_pair"
DETAIL:  Key (term_id, object_id, COALESCE(column_id, '00000000-0000-0000-0000-000000000000'::uuid))=(943be129-62fb-4054-9021-bb9991f96fdf, 743e64af-2b51-48d3-a1b5-3d28372c7dd3, 00000000-0000-0000-0000-00000000
=== inmutables: UPDATE prohibido (revisiones del glosario, eventos de incidencia, puntajes, acuses), DELETE permitido (disparadores activos: origin)
e2_behavior.sql:49: ERROR:  append-only/immutable: UPDATE no permitido en data_catalog.catalog_glossary_term_revisions
e2_behavior.sql:50: ERROR:  append-only/immutable: UPDATE no permitido en data_catalog.quality_issue_events
e2_behavior.sql:51: ERROR:  append-only/immutable: UPDATE no permitido en data_catalog.quality_score_snapshots
e2_behavior.sql:52: ERROR:  append-only/immutable: UPDATE no permitido en data_catalog.catalog_change_acknowledgements
=== puntaje fuera de 0..100 -> ck_quality_score_snapshots_score; un puntaje por (alcance, objetivo, instante)
e2_behavior.sql:59: ERROR:  new row for relation "quality_score_snapshots" violates check constraint "ck_quality_score_snapshots_score"
DETAIL:  Failing row contains (8c8807a4-de39-4ee2-a3bb-91a98ab888b8, GLOBAL, null, null, 2026-10-31 12:19:50.96964+00, 100.01, {}, 2026-10-31 12:19:50.96964+00).
e2_behavior.sql:64: ERROR:  duplicate key value violates unique constraint "ux_data_catalog_quality_score_snapshots_scope_asof"
DETAIL:  Key (scope_kind, COALESCE(object_id, domain_id, '00000000-0000-0000-0000-000000000000'::uuid), as_of)=(GLOBAL, 00000000-0000-0000-0000-000000000000, 2026-10-31 00:00:00+00) already exists.
=== calidad: una corrida activa por regla; una incidencia viva por huella; umbral 0..100
SELECT 1
        prueba        | sample_limit | enabled | version | row_version 
----------------------+--------------+---------+---------+-------------
 defaults de la regla |           20 | t       |       1 |           1
(1 row)

e2_behavior.sql:75: ERROR:  new row for relation "quality_rules" violates check constraint "ck_quality_rules_threshold"
DETAIL:  Failing row contains (a51b9d8d-250c-46a3-a813-8dfda6e8ca77, DQ-y, y, null, 764fba9e-2f2f-4680-85dc-583fec05a67c, null, NOT_NULL, {}, HIGH, 100.50, null, 20, t, null, 1, 2026-10-31 12:19:50.970479+00, 2
e2_behavior.sql:79: ERROR:  duplicate key value violates unique constraint "ux_data_catalog_quality_rule_runs_one_active"
DETAIL:  Key (rule_id)=(7bea4dcb-a066-4fe8-a034-17ea5925e2dd) already exists.
e2_behavior.sql:87: ERROR:  duplicate key value violates unique constraint "ux_data_catalog_quality_issues_live"
DETAIL:  Key (fingerprint)=(fp1) already exists.
                        prueba                         | count 
-------------------------------------------------------+-------
 incidencias con la misma huella (1 resuelta + 1 viva) |     2
(1 row)

=== certificaciones: quien pide no certifica; un destino por fila; una viva por destino
SELECT 1
e2_behavior.sql:99: ERROR:  new row for relation "catalog_certifications" violates check constraint "ck_catalog_certifications_not_self"
DETAIL:  Failing row contains (ebd7d3c9-1810-4ca7-930f-f1970d739816, OBJECT, 3e3b44c3-b14b-40b3-8a31-f92d5e911adb, null, null, null, CERTIFIED, {}, 1a042ddc-054b-4de0-8b1a-33bcc04b2721, 2026-10-31 12:19:50.9762
e2_behavior.sql:102: ERROR:  new row for relation "catalog_certifications" violates check constraint "ck_catalog_certifications_target"
DETAIL:  Failing row contains (a3bed578-7487-4418-9955-0503210335e4, KPI, 3e3b44c3-b14b-40b3-8a31-f92d5e911adb, null, null, k, REQUESTED, {}, 1a042ddc-054b-4de0-8b1a-33bcc04b2721, 2026-10-31 12:19:50.97628+00, 
e2_behavior.sql:105: ERROR:  new row for relation "catalog_certifications" violates check constraint "ck_catalog_certifications_target"
DETAIL:  Failing row contains (5acfe975-00e4-42c0-b432-ac8af83f150b, KPI, null, null, null, null, REQUESTED, {}, 1a042ddc-054b-4de0-8b1a-33bcc04b2721, 2026-10-31 12:19:50.97628+00, null, null, null, null, null,
e2_behavior.sql:111: ERROR:  duplicate key value violates unique constraint "ux_data_catalog_certifications_live"
DETAIL:  Key (target_kind, COALESCE(object_id, read_model_definition_id, report_definition_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(kpi_code, ''::character varying))=(OBJECT, 3e3b44c3-b14b-40
             prueba             |  status   
--------------------------------+-----------
 certificacion por otra persona | CERTIFIED
(1 row)

=== revisiones de politica: unica pendiente por politica; ciclo de vida permitido, contenido congelado, decision no reescrita, sin retroceso, sin DELETE, quien propone no aprueba
SELECT 1
--- (con los disparadores y las FK activas desde aqui: la fila ya esta confirmada)
        prueba         |      status      
-----------------------+------------------
 borrador -> pendiente | PENDING_APPROVAL
(1 row)

--- una segunda pendiente de la misma politica
e2_behavior.sql:130: ERROR:  duplicate key value violates unique constraint "ux_governance_policy_revisions_one_pending"
DETAIL:  Key (policy_type, policy_id)=(RETENTION, 8117b4d9-3a58-438c-a4b3-3398dc109146) already exists.
--- el contenido propuesto no se toca
e2_behavior.sql:134: ERROR:  append-only/immutable: lo propuesto de una revision de politica (contenido, hash, motivo, autor) no se modifica en system_ops.governance_policy_revisions
e2_behavior.sql:136: ERROR:  append-only/immutable: lo propuesto de una revision de politica (contenido, hash, motivo, autor) no se modifica en system_ops.governance_policy_revisions
--- quien propone no aprueba (CHECK)
e2_behavior.sql:139: ERROR:  new row for relation "governance_policy_revisions" violates check constraint "ck_governance_policy_revisions_not_self"
DETAIL:  Failing row contains (0132a75f-52be-4bc7-9e05-ff2869bb2223, RETENTION, 8117b4d9-3a58-438c-a4b3-3398dc109146, 1, {"days": 365}, h1, APPROVED, motivo, 27f409f5-7091-4aac-b6ab-067ea5797ad6, 2026-10-31 12:
--- aprobar sin decisor (CHECK)
e2_behavior.sql:142: ERROR:  new row for relation "governance_policy_revisions" violates check constraint "ck_governance_policy_revisions_decision"
DETAIL:  Failing row contains (0132a75f-52be-4bc7-9e05-ff2869bb2223, RETENTION, 8117b4d9-3a58-438c-a4b3-3398dc109146, 1, {"days": 365}, h1, APPROVED, motivo, 27f409f5-7091-4aac-b6ab-067ea5797ad6, 2026-10-31 12:
--- otra persona aprueba
      prueba       |  status  
-------------------+----------
 revision aprobada | APPROVED
(1 row)

--- la decision no se reescribe
e2_behavior.sql:153: ERROR:  append-only/immutable: una decision ya tomada sobre una revision de politica no se reescribe (system_ops.governance_policy_revisions)
--- el estado no retrocede
e2_behavior.sql:156: ERROR:  append-only/immutable: el estado de una revision de politica no retrocede (APPROVED -> PENDING_APPROVAL)
--- no se borra
e2_behavior.sql:159: ERROR:  append-only/immutable: DELETE no permitido en system_ops.governance_policy_revisions
--- si puede quedar reemplazada
        prueba        |   status   
----------------------+------------
 revision reemplazada | SUPERSEDED
(1 row)

--- y una reemplazada no vuelve a aprobada
e2_behavior.sql:168: ERROR:  append-only/immutable: el estado de una revision de politica no retrocede (SUPERSEDED -> APPROVED)
=== indice de la bitacora por objetivo
                                                                     indexdef                                                                     
--------------------------------------------------------------------------------------------------------------------------------------------------
 CREATE INDEX ix_governance_change_log_target_recorded ON system_ops.governance_change_log USING btree (target_type, target_id, recorded_at DESC)
(1 row)

```

Decisiones: sin RLS (ninguna tabla lleva tenant; el parche aborta si aparece una columna de tenant); inmutables por `forbid_mutation`: revisiones del glosario, eventos de incidencia, puntajes, acuses;
`governance_policy_revisions` **no** es `UPDATE: forbidden` aunque el plan la llamaba inmutable (su estado y su decisión están en la misma fila): disparador de columnas + `ck_..._not_self`.

## 6. Lote de cargas masivas y motor de aprobación (entregables 3 y 4)

El `kind` de `four_eyes_requests` **no es un vocabulario cerrado** (FK a conceptos, sin CHECK): solo hicieron falta dos columnas nullable, un índice, un CHECK y 5 conceptos
(los 4 pedidos + `REVIEWER_KIND_PLATFORM_ADMIN`, porque `approver_kind_concept_id` es NOT NULL y no había aprobador de plataforma).

```
=== lote: clave de confirmacion unica por organizacion (no entre organizaciones); NULL repetido permitido
SELECT 1
e3_behavior.sql:11: ERROR:  duplicate key value violates unique constraint "ux_bulk_import_batches_confirm_key"
DETAIL:  Key (tenant_id, confirm_key)=(17276976-9eb9-4c37-87d0-a4f6e29847a0, clave-1) already exists.
                      prueba                       | count 
---------------------------------------------------+-------
 lotes: 2 con clave (orgs distintas) + 2 sin clave |     4
(1 row)

=== lote: contadores incoherentes (total <> validas + rechazadas) -> debe fallar
e3_behavior.sql:23: ERROR:  new row for relation "bulk_import_batches" violates check constraint "ck_bulk_import_batches_counts"
DETAIL:  Failing row contains (fc0f599b-df97-4ce1-9610-05db798dd6b6, 17276976-9eb9-4c37-87d0-a4f6e29847a0, usuario-paciente, 1, USERS, VALIDADO, csv, 10, null, null, null, null, null, 5, 1, 1, 0, 0, null, null,
=== filas: resultado sin datos personales; una fila con resultado que conserva datos -> debe fallar
e3_behavior.sql:29: ERROR:  new row for relation "bulk_import_batch_rows" violates check constraint "ck_bulk_import_batch_rows_closed_no_data"
DETAIL:  Failing row contains (410bbed2-2653-4bfe-b665-16d1c4cdc333, 00000000-0000-4000-8000-00000000b001, 17276976-9eb9-4c37-87d0-a4f6e29847a0, 1, CREADA, null, null, iam.users, 5340a287-e4ab-4750-a937-f736f7d
    prueba    | outcome | target_entity | sin_datos | sin_clave 
--------------+---------+---------------+-----------+-----------
 fila cerrada | CREADA  | iam.users     | t         | t
(1 row)

e3_behavior.sql:34: ERROR:  duplicate key value violates unique constraint "ux_bulk_import_batch_rows_row"
DETAIL:  Key (batch_id, row_no)=(00000000-0000-4000-8000-00000000b001, 1) already exists.
e3_behavior.sql:36: ERROR:  new row for relation "bulk_import_batch_rows" violates check constraint "ck_bulk_import_batch_rows_row_no"
DETAIL:  Failing row contains (621c470f-da7c-4fd8-afe4-db36623315fb, 00000000-0000-4000-8000-00000000b001, 17276976-9eb9-4c37-87d0-a4f6e29847a0, 0, null, null, null, null, null, null, null, null, 2026-10-31 12:
--- (arriba: fila repetida del mismo lote y fila 0 deben fallar)
=== auditoria de residuos: lo que conserva datos sobre un lote cerrado (debe ser 0)
 filas_con_datos_en_lotes_cerrados 
-----------------------------------
                                 0
(1 row)

=== FK activas: una fila apunta a un lote inexistente -> debe fallar
e3_behavior.sql:46: ERROR:  insert or update on table "bulk_import_batch_rows" violates foreign key constraint "fk_bulk_import_batch_rows_batch_id"
DETAIL:  Key (tenant_id, batch_id)=(2e0342f6-b9d3-4ee7-91c6-b107f01e88f8, e9082571-8548-4e61-a61c-e351c790c3c4) is not present in table "bulk_import_batches".
=== four_eyes_requests: sujeto generico todo-o-nada
SELECT 1
e3_behavior.sql:54: ERROR:  new row for relation "four_eyes_requests" violates check constraint "ck_four_eyes_requests_subject_pair"
DETAIL:  Failing row contains (8d17d626-44c5-42b6-b151-6a4e98234509, dd45abab-5b92-4897-815b-f51332763f80, 494a96dc-4aa8-4e18-a056-ebf1b5fd05ca, 420407df-0d77-4e91-b496-8912925fae02, null, null, null, BULK_IMPO
                                   prueba                                   | count 
----------------------------------------------------------------------------+-------
 solicitudes: 1 con sujeto generico + 1 sin (las anteriores siguen validas) |     2
(1 row)

=== conceptos nuevos del motor unico
                           code                           |                  id                  
----------------------------------------------------------+--------------------------------------
 delegated_access:FOUR_EYES_KIND_ACCESS_SENSITIVE_CHANGE  | fd295668-f51c-5562-8cc2-41e342a59e60
 delegated_access:FOUR_EYES_KIND_ACTION                   | 201ca117-97ad-58c2-a6d3-803ea412cd2c
 delegated_access:FOUR_EYES_KIND_BULK_IMPORT_CONFIRM      | 31e5342a-69ca-51f7-ba85-eae0846c0973
 delegated_access:FOUR_EYES_KIND_CATALOG_CLASSIFICATION   | 96048d4a-724a-572e-9b3b-83f23d4a1144
 delegated_access:FOUR_EYES_KIND_ENGAGEMENT_MOVE          | c5dace75-a0b2-5bac-bdda-5b19d7f0aaef
 delegated_access:FOUR_EYES_KIND_GOVERNANCE_POLICY_CHANGE | 76a6d23b-a609-5a4f-92bc-2bc5eab75436
 delegated_access:FOUR_EYES_KIND_GRANT_CHANGE             | 26a6dc6f-0b9f-5946-9214-e43a7382de68
 delegated_access:FOUR_EYES_KIND_REACTIVATION             | 99b6eaae-af0b-5929-b0f9-666be9ed3a83
 delegated_access:FOUR_EYES_KIND_SOD_EXCEPTION            | 5b36bf36-7f60-5d20-a2ea-3c7826e8d492
 delegated_access:REVIEWER_KIND_PLATFORM_ADMIN            | db5ab60e-ce23-5766-a63d-d6a9f141858a
(10 rows)

```

RLS como `mantra_app`:

```
=== politicas
 schemaname |       tablename        |    policyname    | cmd 
------------+------------------------+------------------+-----
 system_ops | bulk_import_batch_rows | tenant_isolation | ALL
 system_ops | bulk_import_batches    | tenant_isolation | ALL
(2 rows)

        relname         | relrowsecurity | relforcerowsecurity 
------------------------+----------------+---------------------
 bulk_import_batch_rows | t              | t
 bulk_import_batches    | t              | t
(2 rows)

INSERT 0 2
INSERT 0 2
=== sin ningun contexto (falla cerrado): 0 filas
 lotes | filas 
-------+-------
     0 |     0
(1 row)

=== organizacion A: solo lo suyo; B no se ve ni se puede leer por id
              set_config              
--------------------------------------
 aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
(1 row)

                  id                  |              tenant_id               
--------------------------------------+--------------------------------------
 a0000000-0000-4000-8000-0000000000a1 | aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
(1 row)

 filas_visibles 
----------------
              1
(1 row)

 lote_de_b_por_id 
------------------
                0
(1 row)

--- A no puede crear un lote a nombre de B (WITH CHECK)
e3_rls.sql:27: ERROR:  new row violates row-level security policy for table "bulk_import_batches"
--- A no puede modificar el lote de B (UPDATE 0)
              set_config              
--------------------------------------
 aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
(1 row)

UPDATE 0
=== contexto de sistema: ve ambas
 set_config 
------------
 true
(1 row)

 lotes 
-------
     2
(1 row)

```

### Consistencia de tenant entre tablas con RLS (corrección del hallazgo de seguridad)

```
=== consistencia de tenant: FK compuestas (se retiran, solo dentro de la transaccion, las FK de tenant hacia directory.tenants para aislar la prueba)
ALTER TABLE
ALTER TABLE
INSERT 0 2
--- lote de A con la aprobacion de A: permitido
--- lote de A SIN aprobacion (NULL): permitido (MATCH SIMPLE)
--- NEGATIVA: lote de A ligado a la aprobacion de B -> debe fallar
e3_tenant.sql:23: ERROR:  insert or update on table "bulk_import_batches" violates foreign key constraint "fk_bulk_import_batches_approval_request_id"
DETAIL:  Key (tenant_id, approval_request_id)=(aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa, fe000000-0000-4000-8000-00000000000b) is not present in table "four_eyes_requests".
--- NEGATIVA: el lote existente de A cambia su aprobacion a la de B (UPDATE) -> debe fallar
e3_tenant.sql:26: ERROR:  insert or update on table "bulk_import_batches" violates foreign key constraint "fk_bulk_import_batches_approval_request_id"
DETAIL:  Key (tenant_id, approval_request_id)=(aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa, fe000000-0000-4000-8000-00000000000b) is not present in table "four_eyes_requests".
--- fila de A sobre un lote de A: permitido
--- NEGATIVA: fila con tenant A sobre un lote de tenant B -> debe fallar
e3_tenant.sql:32: ERROR:  insert or update on table "bulk_import_batch_rows" violates foreign key constraint "fk_bulk_import_batch_rows_batch_id"
DETAIL:  Key (tenant_id, batch_id)=(aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa, bb000000-0000-4000-8000-0000000000b1) is not present in table "bulk_import_batches".
--- NEGATIVA: la fila de A se re-apunta al lote de B (UPDATE) -> debe fallar
e3_tenant.sql:35: ERROR:  insert or update on table "bulk_import_batch_rows" violates foreign key constraint "fk_bulk_import_batch_rows_batch_id"
DETAIL:  Key (tenant_id, batch_id)=(aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa, bb000000-0000-4000-8000-0000000000b1) is not present in table "bulk_import_batches".
--- NEGATIVA: el lote de A cambia de tenant teniendo filas (UPDATE tenant_id) -> debe fallar
e3_tenant.sql:38: ERROR:  update or delete on table "bulk_import_batches" violates foreign key constraint "fk_bulk_import_batch_rows_batch_id" on table "bulk_import_batch_rows"
DETAIL:  Key (tenant_id, id)=(aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa, ba000000-0000-4000-8000-0000000000a1) is still referenced from table "bulk_import_batch_rows".
```

FK compuestas `(tenant_id, batch_id) -> bulk_import_batches (tenant_id, id)` y `(tenant_id, approval_request_id) -> four_eyes_requests (tenant_id, id)` (`UNIQUE (tenant_id, id)` nuevos en ambas).
`tenant_id` es NOT NULL en las tres tablas; `approval_request_id` es nullable y con MATCH SIMPLE un NULL no se valida. Revisión del resto: las tablas de gobierno de datos, calidad, linaje y certificaciones
no llevan tenant (plataforma), así que no tienen este patrón. Queda a cargo del servicio que `subject_entity/subject_id` de la solicitud apunte a ese lote (referencia polimórfica).
Los lotes existentes con las FK simples del primer borrador (solo en bases de prueba) se sustituyen: el parche las elimina si no son compuestas.

## 7. Base de desarrollo `salud`

Respaldo previo: `pg_dump -s salud` -> `.../scratchpad/m2/salud_pre_v4281_backup.sql` (6 356 827 bytes). Parches ya verificados arriba, aplicados dos veces cada uno (idénticos):

```
tablas antes: 1338 · después: 1353 (+15: 12 de data_catalog, governance_policy_revisions, bulk_import_batches, bulk_import_batch_rows)
API /health tras aplicar: 200
```

`\dt data_catalog.*` -> 25 tablas; `\dt system_ops.bulk*` -> bulk_import_batch_rows, bulk_import_batches; `\dt system_ops.governance*` -> governance_change_log, governance_policy_revisions.

## 8. Entidades del API (no se escribió en `/home/user/mantra-core-health-api`)

Generadas con `gen_entities.py 11 28 29 67` a un workspace temporal; para copiar: `.../scratchpad/m2/entities-para-copiar/`.
- Copiar tal cual (nuevas): `data_catalog/` 12 (`catalog_stewardships, catalog_glossary_terms, _term_revisions, _term_links, quality_rules, quality_rule_runs, quality_issues, quality_issue_events, quality_score_snapshots, catalog_lineage_edges, catalog_certifications, catalog_change_acknowledgements`), `system_ops/` 3 (`governance_policy_revisions, bulk_import_batches, bulk_import_batch_rows`), `delegated_access/four_eyes_requests` (el API de `dev` aún no tiene esa entidad: viene con el rescate de la rama de gobierno).
- Fusionar a mano: `catalog_objects` (solo la propiedad `domainId`; el archivo del API tiene JSDoc/relaciones), y los `index.ts` (añadir exports; `index.ts.generado` trae la lista).
- Defectos conocidos del generador: comenta `// FK (destino no resuelto)` en FK que sí resuelve por arista etiquetada; `bigint` y `numeric` salen como `string`; sin relaciones `@ManyToOne` ni JSDoc ni prettier (una línea por `@Property`); los nombres de clase son el plural de la tabla (`QualityRules`, `BulkImportBatches`; sin colisión en el API); el `index.ts` se sobrescribe entero; los archivos existentes difieren de los del API (no copiar carpetas enteras); sin defaults en columnas `numeric`.
