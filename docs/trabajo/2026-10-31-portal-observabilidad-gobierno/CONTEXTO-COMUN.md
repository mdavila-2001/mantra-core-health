# Contexto común para los agentes de planificación (31/10/2026)

## Pedido del usuario (literal, resumido sin perder nada)
1. El «panel de reportería» actual está bugueado por completo y, siendo **Portal Admin de AloVida**, le obliga a **elegir organización (tenant)**. Hay que sacar eso.
2. El portal de administración/reportería debe ser **observabilidad de la app**: un dashboard completo a nivel de **sistema**: consultas, latencia y **sobre todo errores**.
3. Medir **errores y uso de cada parte de la app**, con **heatmap de cada parte**.
4. **Catalogación de datos** como el Admin Portal de Atlas (https://github.com/PabloArauzCaballero/AtlasAdminPortal) y, clave y fundamental: **GOBIERNO DE DATOS**.
5. Máximo alcance, cubriendo todo. El mejor plan. Usar la skill `dataviz` (en `/tmp/claude-0/bundled-skills/2.1.316/20955bcf05b5c776034d0a33381d37b2/dataviz`, leer `SKILL.md` y `references/`) y **probar que lo que se propone funciona de verdad** (lo entregado hasta hoy fue maqueta con datos de ejemplo y no sirvió).

## Repos (todos en /home/user, rama de trabajo `claude/busy-dijkstra-5apd55` en cada uno)
- `mantra-core-health` — front Angular 21, señales, `ViewState<T>` 9 estados (ADR-0005), 188 tokens CSS, sin Tailwind, ECharts (ADR-0017, `shared/components/organisms/chart-panel/`), Vitest, Playwright. Reglas en `CLAUDE.md`, `docs/frontend/FABLE_STACK.md`, `docs/components/composition-rules.md` §5 (UNA tarjeta con pestañas, a lo ancho).
- `mantra-core-health-api` — NestJS + MikroORM + Postgres. Módulos relevantes: `telemetry` (`/admin/analytics/*`, `/telemetry/*`), `ops_console` (`/admin/ops/traffic`, `/admin/ops/traffic/endpoints`, readiness, incidents, deployments, slos, backups), `platform_ops` (SLI/SLO, incidentes, runbooks), `data_catalog` (`/admin/catalog/*`, `/admin/portal/*`), `system_ops` (clasificaciones, dominios, retención, anonimización, residencia, legal holds, incidentes de seguridad), `audit` (`/audit/log`, `/audit/data-access`), `authz`, `iam`, `read_models`, `lakehouse`, `reporting`. Común: `src/common/auth/` (roles.guard, tenant-scope.guard; `PlatformAdminScopeGuard` **no existe** según el frente 01, lo que hay es `@PlatformTenantOptional`), `src/common/filters/all-exceptions.filter.ts` (x-request-id), `src/common/tenant/tenant-context.interceptor.ts`.
- `mantra-core-health-model` — fuente de verdad del esquema (`SQL/NN_schema/`), entidades generadas por introspección (`gen_entities.py`), nunca DDL a mano en el API. Esquemas: `28_telemetry`, `67_data_catalog`, `10_audit`, `30_read_models`, `46_platform_ops`, `11_system_ops`, `63_lakehouse`, `39_reporting`.
- `mantra_core_health_mobile` — Flutter; **sin telemetría ni captura de errores hoy** (grep de analytics/sentry/crashlytics vacío).
- `mantra_core_technologies_health_docs` — docs (M28 telemetry, M46 platform_ops, V10 audit).

## Lo que ya existe y hay que conocer (no reescribir)
- Front: `features/portal-selector/`, `features/reporting/` (maqueta comercial: grid + dashboard comercial con datos de EJEMPLO, sin API; `reporting-access.ts` con ROLES_REPORTERIA/ADMINISTRACION/INSIGHTS), `features/insights/` (marketing), `features/admin/observability/` (consume `/admin/ops/traffic*`), `features/admin/web-analytics/`, `features/admin/measurement/`, `features/admin/data-catalog/`, `features/admin/portal/` (catálogo técnico: tablas, linaje, deriva, flujos, operaciones, glosario), `features/dashboard/platform-home/` («Centro de la plataforma»), `core/data-access/admin-portal/`, `core/data-access/telemetry/`, `core/data-access/audit/`, `core/navigation/navigation.platform.ts` y `navigation.management.ts`.
- Post-login: `features/auth/login/login.ts › destinoNormal()`: si `needsTenantSelection()` → `/auth/organization`. `core/auth/session.store.ts:227`: `needsTenantSelection = tenants().length > 1 && selectedTenantId() === null`. **No distingue roles de plataforma**: un PLATFORM_ADMIN con 2+ tenants cae a elegir organización. El guard `core/auth/auth.guard.ts:36` repite la regla. API: `iam-auth.service.ts › loadActiveTenantIds` arma `tenants` del token.
- Planes previos (leer, son insumo): `docs/trabajo/2026-10-30-reporteria-comercial-alovida/{PLAN,REPORTE}.md` (maqueta comercial, lo que el usuario rechaza como «no sirve»), `docs/trabajo/2026-10-30-perfil-admin-medicion-gobierno/{PLAN,TRASPASO}.md` + `contratos/` + `descubrimiento/` (medición por funcionalidad, dinero, heatmap, gobernanza estilo Atlas, permisos; rama `claude/stoic-johnson-4vl5bf` con conflictos contra dev), `docs/trabajo/2026-10-30-alovida-insights-portal/PLAN.md`.
- Atlas Admin Portal (referencia, Next.js; «nada hardcodeado, todo del backend»): rutas `/internal/systems/endpoints`, `data-catalog/tables`, `qa/*`, `audit`, `review-queue`, `systems/tools`, `settings/users|roles|catalog-sync`, `lineage`, `lineage/official`, `lineage/impact`, `governance`, `governance/pii`, `governance/policies[/:id]`, `business-metadata/domains|definitions|glossary`, `reports/readiness`, `reports[/:id]`, `data-quality/rules[/:id]`, `data-quality/issues`, `risk-policy/current`, `release-readiness`, `jobs`, `alerts`, `exports`, `security/session`, `search`. Transversal: `requestId` de `x-request-id`/`x-correlation-id`, timeouts → mensajes controlados, gate max-lines 300, source-boundaries.

## Reglas de escritura del plan (obligatorias)
- Español. Hechos con **ruta:línea** (DISCOVERED); lo que no se leyó se marca «no verificado». Nada inventado.
- Formato por hito: CA (dado/cuando/entonces), DoD ejecutable, microtareas con ID `Hn.Sn.Mn`, estado `TODO`.
- Cambios de esquema SIEMPRE en `mantra-core-health-model` primero → `gen_entities.py` → API.
- La API autoriza; ocultar no es seguridad. Tenant del token, nunca del cuerpo. Sin PHI en tableros (agregados; `minSample`).
- `null` ≠ 0: todo KPI sin fuente se muestra «sin dato» con motivo. 9 estados `ViewState`.
- Evidencia: cada afirmación de que «funciona» exige UI → request → response → persistencia → recarga → UI contra la API real (Postgres), no contra el simulador.
- Dataviz: seguir `SKILL.md` de la skill (forma por pregunta, color por trabajo, validar paleta con `scripts/validate_palette.js`, un eje, leyenda + etiqueta directa, tabla alterna, modo oscuro propio).
- Dos PRs por franja (dev y test), según `CLAUDE.md`.

## Ampliación del pedido (31/10/2026, mismo turno)
6. Falta también **subida masiva** (cargas masivas), **flujo de aprobación** y **gobierno de usuarios**. Orden explícita: **inventariar lo que ya existe en todas las ramas** (varios carriles «supuestamente lo hacían»; el usuario recuerda haberlo visto hecho) antes de proponer nada nuevo. Frente 06.
7. «El mejor plan jamás hecho»: máximo alcance, con la skill `dataviz` aplicada y **probada** (validador ejecutado, salida guardada), y evidencia real contra la API con Postgres; lo entregado antes (maqueta con datos de ejemplo) no sirvió.

## Frentes y archivos (dueños disjuntos)
| # | Archivo | Frente |
|---|---|---|
| 01 | `01-entrada-y-acceso.md` | Bug de selección de organización para Portal Admin; entrada y roles; qué pasa con la maqueta comercial |
| 02 | `02-observabilidad-sistema.md` | Sistema: peticiones, latencia, consultas SQL, errores agrupados, workers, SLO |
| 03 | `03-uso-errores-heatmap.md` | Uso y errores por parte de la app (web y móvil), heatmap por pantalla |
| 04 | `04-catalogo-y-gobierno.md` | Catálogo de datos y gobierno de datos (paridad Atlas) |
| 05 | `05-frontend-dataviz-y-evidencia.md` + `evidencia-dataviz/` | Arquitectura front del panel, dataviz validada, protocolo de evidencia |
| 06 | `06-cargas-masivas-aprobacion-gobierno-usuarios.md` | Inventario forense por rama + cierre de cargas masivas, aprobación y gobierno de usuarios |
| — | `PLAN.md` (consolidado) | Orden de franjas, dependencias, kill-tests, decisiones pendientes |
