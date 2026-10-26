# Plan — P34: farmacias abiertas 24 h y de turno

- Fecha: 2026-10-26 · Repos afectados: mantra-core-health-model, mantra-core-health-api,
  mantra-core-health · Predecesor: `PENDIENTES-BACKEND.md` §P34 (rama `mockup` del front).
- Resultado observable: la farmacia declara, sede por sede, si abre 24 h y sus turnos de guardia
  (con inicio y fin); cualquiera, sin sesión, pide `GET /public/pharmacies/open-now` y ve qué sedes
  están abiertas **ahora** (24 h o de turno vigente), con la hora de Bolivia explícita; el paciente ve
  «24 h» / «De turno hasta …» donde elige farmacia.
- Kill-test: un turno con `ends_at` en el pasado aparece en `open-now`, o una sede con `open_24h`
  NULL aparece como 24 h, o el personal de la farmacia A carga un turno en una sede de la B.

## Alcance
- IN: `diagram_24_pharmacy.puml` (columna `open_24h` y tabla `pharmacy_on_call_shifts`),
  `diagram_33_integrity.puml` (CHECK + EXCLUDE), DDL regenerado de 24, patch
  `2026-10-26_v4260_pharmacy_open_24h_on_call_shifts.sql`; entidades regeneradas; conceptos
  `pharmacy:ON_CALL_*`; endpoints de la farmacia (24 h, alta/lista/cancelación de turnos), lectura
  pública `open-now`, campos `open24h`/`onCallUntil` en `GET /pharmacy/sites`; front: cliente,
  simulador, badges en «elegir farmacia», sección «Abiertas ahora» en el directorio público y pantalla
  «Horario y turnos» en el portal de la farmacia.
- OUT: importar el rol del colegio departamental (no hay fuente ni contrato), horarios de atención
  por día de semana (tabla de horarios inexistente; no se inventa), sucursales de cadena (P37),
  catálogo de la farmacia (P47), alta de farmacia (P50).
- Decisiones de producto (las tres preguntas abiertas del P34; tomadas por el agente, ver REPORTE):
  - **D1 Quién carga el rol:** la propia farmacia (su personal `PHARMACY_STAFF`, acotado por
    `PharmacyTenantScopeGuard`) y, en su nombre, la plataforma (`SECURITY_ADMIN`). Cada turno guarda
    su procedencia (`source_concept_id`: `PHARMACY` o `PLATFORM`) y la lectura pública la declara
    («declarado por la farmacia»). Descartado: importar del colegio (sin fuente verificable) y carga
    sólo de plataforma (no conoce el rol de cada local).
  - **D2 Granularidad:** el turno es de la **sede** (el local físico), no de una zona. «Cerca mío» sale
    de las coordenadas de la sede (`lat`/`lng` ordena por distancia) y la zona, de su ciudad
    (`city`). Descartado: turno por municipio/departamento (exige el rol por zona, que no tenemos).
  - **D3 Turno vencido:** nunca se publica. Un turno sólo cuenta mientras `starts_at <= now < ends_at`;
    el cancelado tampoco cuenta. Además el turno dura como máximo 72 h (CHECK en base) y se declara a lo
    sumo con 62 días de anticipación (servidor): no hay turnos recurrentes ni sin fin que caduquen en
    silencio. Dos turnos activos de la misma sede no se solapan (EXCLUDE en base).
  - **D4 24 h nullable:** `open_24h` NULL = «no lo declaró»; sólo `true` se publica como 24 h.
  - **D5 Huso:** las horas se reciben ISO-8601 **con desplazamiento obligatorio** (sin él, 400); se
    guardan `timestamptz`; la respuesta trae `timeZone` (el de la sede o `America/La_Paz`) y la hora
    local ya formateada, además del instante UTC.

## H1 — El modelo sabe qué sede abre 24 h y cuál está de turno
**CA:** Dado el modelo regenerado, cuando se aplica el patch a una base viva dos veces, entonces existe
`pharmacy_sites.open_24h` (nullable) y `pharmacy_on_call_shifts` con FKs, índices, CHECK y EXCLUDE, sin
errores la segunda vez.
**DoD:** `gen_ddl.py 24` + `gen_integrity.py` + `gen_apply.py` sin diff fuera de lo esperado · patch ×2 con
`ON_ERROR_STOP=1` en `mantra_p34` · consultas de verificación.
**Estado:** HECHO (sin prueba visual: ver REPORTE)

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | `.puml` 24 + 33 declaran columna, tabla, índices, CHECK, EXCLUDE | gen_ddl emite la tabla | `python3 salud-db/gen_ddl.py 24` → 10 tablas | HECHO |
| H1.S1.M2 | 05_constraints de 24 y apply_all regenerados | archivo con CHECK y EXCLUDE | `gen_integrity.py` + `gen_apply.py` | HECHO |
| H1.S1.M3 | Patch idempotente aplicado dos veces | 2 corridas sin error | `psql -v ON_ERROR_STOP=1 -f patch` ×2 | HECHO |
| H1.S1.M4 | Copia vendorizada en la API | `db:vendor:check` limpio | `yarn db:vendor` | HECHO |

## H2 — API
**CA:** Dado el personal de una farmacia, cuando declara 24 h y un turno de su sede, entonces
`open-now` (sin sesión) la devuelve mientras el turno está vigente; el personal de otra farmacia
recibe 403; un turno vencido, cancelado o sin desplazamiento horario no se publica / se rechaza.
**DoD:** unitarios dirigidos · `yarn typecheck` · lint de los archivos · integración HTTP real contra
`mantra_p34` (incluye 401/403 y turno vencido) · OpenAPI regenerado.
**Estado:** HECHO (sin prueba visual: ver REPORTE)

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Entidades regeneradas (`gen_entities.py`) | `PharmacyOnCallShifts` + `open24h` | `gen_entities.py` + typecheck | HECHO |
| H2.S1.M2 | Conceptos `ON_CALL_*` | UUID = los del EXCLUDE | test de conceptos | HECHO |
| H2.S2.M1 | `PATCH .../sites/:siteId/open-24h` | 200 y persistido | unitario del servicio | HECHO |
| H2.S2.M2 | `POST/GET/DELETE` turnos | validación 72 h / 62 días / offset / solape | unitario del servicio y DTO | HECHO |
| H2.S3.M1 | `GET /public/pharmacies/open-now` paginado | sólo vigentes; cursor | unitario + integración | HECHO |
| H2.S3.M2 | `GET /pharmacy/sites` trae `open24h` y `onCallUntil` | campos presentes | unitario del read service | HECHO |
| H2.S4.M1 | Integración HTTP real contra la base | todo lo del CA | `yarn test:integration pharmacy-on-call` | HECHO |
| H2.S4.M2 | OpenAPI e inventario regenerados | sin breaking | `docs:openapi:generate` | HECHO |

## H3 — Frontend
**CA:** Dado el paciente eligiendo farmacia, entonces ve «Abierta 24 h» / «De turno hasta HH:MM» en las
sedes que lo declararon y puede pedir sólo las abiertas ahora; el directorio público muestra
«Abiertas ahora»; el portal de la farmacia permite declarar 24 h y cargar/cancelar turnos.
**DoD:** specs del cliente y de los componentes (`ng test --include`) · typecheck · lint de los archivos.
**Estado:** HECHO (sin prueba visual: ver REPORTE)

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Cliente + tipos + simulador con el mismo contrato | spec del cliente verde | `ng test --include` cliente | HECHO |
| H3.S2.M1 | Badges y filtro en «elegir farmacia» | spec del componente | `ng test --include` | HECHO |
| H3.S2.M2 | «Abiertas ahora» en el directorio público | spec del componente | `ng test --include` | HECHO |
| H3.S3.M1 | Pantalla «Horario y turnos» del portal | spec del componente | `ng test --include` | HECHO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| P37/P47/P50 tocan `diagram_24` y el módulo pharmacy | conflicto en el merge | cambios acotados; derivados se regeneran al unir |
| Sin navegador para prueba visual | sin evidencia visual | declararlo en «No cubierto» |
