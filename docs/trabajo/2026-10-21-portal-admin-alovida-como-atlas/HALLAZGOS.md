# Hallazgos — Inventario y portal interno de AloVida como AtlasAdminPortal

Lo que el inventario revela roto, ambiguo o fuera de alcance. **Acá se anota, no se arregla** (regla 00 §3). Cada fila cita ruta y, cuando corresponde, a quién hay que confirmárselo.

## §0 — Módulo piloto (H0.S1.M2)

**Piloto principal: `scheduling`.** Razones, con ruta:
- Es uno de los dos únicos módulos con flujo de negocio punta a punta ya documentado (`mantra-core-health-api/docs/business/critical-workflows.md` §1 «Ciclo de vida de una cita»): sirve de **control** para validar que el generador de flujos reconstruye lo mismo desde el código.
- Tiene máquina de estados en el modelo (`Mantra Core Health Context/modules/diagram_41_scheduling.puml`, entidades `*_states`), worker propio (`src/worker-scheduling.ts`: expirar holds, promover lista de espera) y eventos: cubre los tres tipos de nodo del árbol (guard, decisión, efecto) y el caso «operación disparada por un worker, no por HTTP».
- Tiene pruebas de integración que fijan el flujo (`test/integration/scheduling-agenda.int-spec.ts`) y está en la lista de flujos verificados contra la API real (`docs/api/flujos-verificados-frontend.md`): permite comparar «declarado» vs «observado».
- El kill-test del plan está definido sobre `POST /scheduling/slots/{id}/holds`.

**Piloto de control: `audit`.** Es el extremo opuesto: 11 operaciones, casi todas escritura, tablas WORM append-only (`src/modules/audit/README.md`, «Entidades y reglas de persistencia»), 131 entidades. Si el generador deriva bien «ESCRIBE» sin inventar «BORRA» en tablas WORM y asigna las 131 entidades al schema `audit`, la lógica de tablas afectadas y de `append_only` queda probada en el caso difícil.

## §1 — Hallazgos del descubrimiento (2026-10-21)

| # | Hallazgo | Evidencia | Qué implica | Confirmar con |
|---|---|---|---|---|
| HZ-01 | El portal administrativo del frontend (`administration/data-catalog`, `qa-lab`, `operations`, `web-analytics`) **sólo funciona contra el mock**: las rutas `/admin/catalog/*`, `/admin/qa/*`, `/admin/ops/*`, `/admin/analytics/*` no existen en el API | `mantra-core-health/src/app/core/mock/handlers/admin-portal.handlers.ts:287-688`; `grep -rn "admin/catalog" mantra-core-health-api/src/modules` → 0 resultados | H4 construye la API real; las pantallas que no entran en la primera ola deben mostrar «datos simulados» (ADR-0014) | Marcelo (alcance) |
| HZ-02 | Tres conteos de tablas que no cierran: **1 230** en el DDL del modelo (`model/docs/data-catalog/tables.csv`), **1 239** entidades ORM (`api/docs/data/entity-catalog.md`), **1 212** desplegadas en 58 esquemas (`api/docs/data/data-access-inventory.md`) | rutas citadas | La deriva es un entregable (H3.S1.M5–M6), no se elige un número | Pablo (modelo) |
| HZ-03 | El frontend declara **415** operaciones HTTP en sus clientes (`docs/reports/generated/api-inventory.md`) pero `docs/integrations/backend-api.md` documenta **184** y dice que `check-api-contract-drift.mjs` falla si hay una sin documentar | rutas citadas | O el script no se corre, o compara otra cosa. Entra como fila de «Deriva de permisos / contrato» en H2.S2.M3 y H5.S3.M7 | — |
| HZ-04 | La «descripción de negocio» de la referencia de endpoints es el `summary` de `@ApiOperation` + una frase fija («Requiere JWT y los roles…»), no una explicación de negocio | `api/openapi/endpoints/audit.md` líneas 37-40 | H1.S3.M1 la compone con UC del README y propósito del `.puml`, trazable; queda `AUTO_DETECTADA` hasta revisión humana | Marcelo (ambigüedad 3) |
| HZ-05 | El usuario de aplicación de la base es superusuario con `BYPASSRLS`: 288 tablas con RLS que no se aplica en runtime | `api/docs/data/data-access-inventory.md` «Motor y credencial» | Fuera de alcance de este trabajo; se debe mostrar en la pestaña «Gobierno operativo» como hecho, no ocultarlo | Equipo de plataforma |
| HZ-06 | El `README.md` del repo del modelo es la plantilla de NestJS sin editar | `mantra-core-health-model/README.md` | Cosmético; se anota | — |
| HZ-07 | `api/openapi/ENDPOINTS.md` dice 65 módulos; `api/docs/modules/index.md` dice 63; `docs/reports/system-inventory.md` reconcilia 60 directorios / 57 con entidades | rutas citadas | El inventario debe declarar **un** criterio de conteo de módulos y citarlo (se adopta el de `system-inventory.md`) | — |

## §2 — Hallazgos de H1 (endpoints)
_(pendiente)_

## §3 — Hallazgos de H2 (flujos)
_(pendiente)_

## §4 — Hallazgos de H3 (catálogo de datos)
_(pendiente)_

## §H4 — Decisión sobre `system_ops.entity_registry` (H4.S1.M1)
_(pendiente)_
