# TRASPASO — Portal admin (estilo AtlasAdminPortal), visibilidad, RBAC, catalogación y sondas

> Para quien continúe esta sesión sin contexto previo. Fecha: 2026-10-31. Rama de trabajo en los 3 repos:
> `claude/upbeat-darwin-rm3rn2` (front `mantra-core-health`, API `mantra-core-health-api`, modelo `mantra-core-health-model`).
> **PRs: solo hacia `dev`** (la rama `test` está dada de baja desde el 30/10/2026 — ver CLAUDE.md del front).
> Nada se declara «listo»: lo hecho llegó, como mucho, a peldaño `TESTED` (tests unitarios con dobles) más una pasada
> visual **parcial** (12 capturas escritorio/claro, solo 2 miradas a fondo). Nada se probó contra Postgres ni contra la API corriendo.

## Qué pidió el usuario (resumen)
1. Portal admin **con la estructura de AtlasAdminPortal** (gobernanza, PII, calidad de datos, linaje, auditoría, permisos), en `dev`/`test`/`mockup`.
2. **Catalogación como prioridad máxima**: endpoints, flujos, tablas/columnas afectadas, contratos, DTOs, BD real, explicación de sistemas y de
   negocio, y el **gobierno de mutabilidad** (qué es append-only, qué se puede borrar…). Todo como **seeders idempotentes**.
3. **Sonda de ajuste de la catalogación** y **sonda de workers/piezas de código/instancias**.
4. **Visibilidad**: catalogar elementos de la interfaz por módulo y reglas mostrar/ocultar que afecten a todo el usuario.
5. **RBAC al mayor nivel de granularidad, por módulo.**
6. Subir todo y capturas de cómo se ve.

## Estado por área (qué hay en el árbol)
| Área | API | Front | Estado real |
|---|---|---|---|
| Visibilidad de la interfaz | `src/modules/ui_visibility/` + tablas `authz.ui_visibility_*` en el modelo (+ parche SQL) | `core/visibility/` (servicio, directiva `*appVisible`, guarda, registro), `features/admin/portal/visibility/` (catálogo, reglas, «ver como») | TESTED con dobles. SQL nunca aplicado. Anti-bloqueo (admin siempre ve `nav.superadmin.*`/`nav.administration.*`) en resolutor y en alta de reglas. |
| RBAC por módulo | `authz/controllers/authz-modules-catalog.controller.ts` + servicios | `features/admin/portal/rbac-matrix/` | TESTED. **Hallazgo: los controladores autorizan solo con `@Roles`; los permisos finos no gobiernan endpoints** (ver Pendientes). Informe: `RBAC-POR-MODULO.md`. |
| Permisos / ciclo de vida / revisiones | reconciliado con dev (usa `iam` y `authz-governance` de dev); extensión propia: `authz-governance-ext.*` (permisos por campo de rol, scope grants) | `features/admin/portal/permissions/` (4 pantallas) | TESTED. |
| Mutabilidad de datos | `system_ops/mutability/` (extractor, catálogo JSON generado, seeder de `entity_registry`, API de lectura) | `features/admin/portal/mutability/` | TESTED. Medido: 1430 tablas; 31 contradicciones sin resolver. |
| Catalogación (inventario + seeders) | `data_catalog/application/catalogacion/`, `common/seed/catalog/`, inventario regenerado (1925 ops, 78 módulos) | (portal existente) | Seeders probados con doble en memoria. Cobertura honesta en `docs/trabajo/2026-10-31-catalogacion/COBERTURA.md`. |
| Sonda de ajuste del catálogo | `data_catalog/application/fit/` (23 comprobaciones), tick `fit-tick` cada 5 min | `features/admin/portal/probes/catalog-fit/` | TESTED. Resultados **en memoria** (TTL 24 h). |
| Sonda de piezas en ejecución | `platform_ops/runtime_pieces/` (escáner, seeder idempotente de `tool_registry`) | `features/admin/portal/probes/runtime-pieces/` | Integración con Postgres/Redis reales descartables 17/17. |
| Calidad de datos clínicos | `governance_admin/` (solo calidad) | `features/admin/portal/data-quality/` | TESTED. |
| Privacidad (DSAR) | usa `/privacy/dsar` de dev | `features/admin/portal/privacy/` | TESTED con mock. |
| Políticas y PII | usa `admin/governance/policies`, `change-log`, `admin/catalog/pii/*` de dev | `features/admin/portal/governance/{policies,pii}` | TESTED con mock. |
| Catálogos globales | `GET /admin/catalogs/services/scopes` portado a `billing/` | `features/admin/catalog-editor/` | Servicios y glosario contra API de dev; **Reporte contable = DECISION_REQUIRED** (sin API). |

Retirado por ser duplicado de `dev` (auditoría `RECONCILIACION-DEV.md`): `admin_catalogs`, `clinical_import` (+ pantalla), privacidad de `governance_admin`.

## Cómo trabajar aquí (trampas medidas)
- Front: `corepack yarn`, NUNCA npm. El hook `pre-push` corre `yarn build` (necesita `corepack enable`). `tsc` no revisa plantillas: compila con `ng`.
- **Memoria**: `ng test` de toda la suite muere por OOM en esta máquina. Correr por partes: `npx ng test --watch=false --include 'src/app/<carpeta>/**/*.spec.ts'` (antes del merge con la API: ~15 000 pruebas en verde por trozos; repetir tras cualquier cambio). `tsc` de la API: `NODE_OPTIONS=--max-old-space-size=6000`.
- API jest: `NODE_OPTIONS="--max-old-space-size=4000 --experimental-vm-modules" node node_modules/jest-cli/bin/jest.js --runInBand <ruta>`.
- Varias corridas pesadas a la vez matan el proceso: serializarlas con `flock /tmp/<x>.lock <comando>`.
- App con datos simulados: `NODE_OPTIONS=--max-old-space-size=6000 npx ng serve --configuration development,demo --port 4200`; login en **`/auth`** (no `/auth/login`) con `superadmin@alovida.mock` y cualquier clave no vacía. Playwright del repo no trae su chromium: usar `executablePath: '/opt/pw-browsers/chromium'`.
- Tras tocar carpetas de features: `node scripts/generate-component-index.mjs` (el índice generado apunta a archivos y rompe `ng` si quedan stale).
- API: la rama estuvo construida sobre `master` y se fusionó `origin/dev` (489 commits) — conflictos resueltos tomando lo de dev en duplicados. Inventario: `node tools/inventario/{endpoints,flujos,catalogo}.mjs` y `corepack yarn inventario:verificar`; **el generador no borra archivos de módulos eliminados** (hay que borrarlos a mano).
- Modelo: parche `SQL/patches/2026-10-31_ui_visibility.sql` (idempotente) y `salud-db/gen_ui_visibility_patch.py`; la versión del modelo NO se subió (sigue 4.2.81).

## PENDIENTES (por prioridad)
### Decisiones que necesitan al usuario / dueños
1. **RBAC fino real**: introducir `@RequirePermission('modulo.recurso.accion')` + guarda que consulte el PDP, en piloto (2–3 módulos, primero las 37 rutas sensibles: delete/export/approve/reject/assign/configure) con compatibilidad con `@Roles`. Hoy asignar un permiso a un rol **no cambia** lo que un endpoint permite. Propuesta de ~1 638 códigos en `RBAC-POR-MODULO.md` (apéndice) — requieren revisión humana antes de sembrar. 202 rutas sin autorización declarada (96 mutan): auditar.
2. **Dueño de `iam`** (código de dev): (a) el ciclo de vida no protege a `SUPERADMIN` (un admin de plataforma puede suspender/dar de baja a un SUPERADMIN); (b) `deactivate` no revoca `user_role_assignments` de authz.
3. **Dueño del modelo**: índice único `(schema_name, table_name)` en `system_ops.entity_registry` + upsert en `GovernanceCatalogService.catalogEntity` (hoy un alta por API puede duplicar una tabla sembrada y **rompe el ciclo de purga de identidad**, que exige exactamente una fila). Subir la versión del modelo y regenerar `SQL/_generation_report.md`/`SHA256SUMS` (`diagram_50_marketing` ya fallaba antes).
4. **Cumplimiento/DPO**: plazos de retención (solo 8 tablas tienen plazo, del modelo) y bases legales; `is_official` del linaje (hoy `false`); nivel mínimo de evidencia para `is_append_only` (`MIN_ASSERT_LEVEL`); `LIFECYCLE_ONLY` vs `APPEND_ONLY` en tablas declaradas inmutables con UPDATE en el código (31 contradicciones, ninguna resuelta; la más grave `common.file_versions`).
5. **Producto**: «Reporte contable por tipo de usuario» (contrato H3 §4); alcance de `SECURITY_ADMIN` en `ui_visibility` (hoy alta/sync del catálogo la puede mutar cualquier SECURITY_ADMIN y es global); ¿los administradores acotados a una organización pierden ciclo de vida/revisiones/simulador (hoy 403)?; umbral de frescura del escaneo (35 min, puesto por mí).
6. **UX**: en el portal se ven **dos menús** (menú global izquierdo + menú propio «Portal de inventario») y un hueco en blanco grande bajo la barra superior. Es el marco existente de `dev` (`portal-shell`); decidir si se funde/colapsa. Revisar además que las pantallas nuevas reproduzcan la **estructura** de AtlasAdminPortal (el usuario lo exigió dos veces).

### Trabajo técnico
7. **Verificación visual real** (regla 95.7): solo se tomaron 12 capturas escritorio/tema claro (`/tmp/claude-0/shots`, volátil). Falta: 3 viewports, tema oscuro, estados vacío/error/carga, revisar una por una (solo se miraron a fondo 01 y 03), consola/red.
8. **Contra Postgres real**: aplicar el parche `ui_visibility`, `yarn orm:catalog`, correr los seeders (mutabilidad, catálogo, `runtime-pieces`), verificación de deriva, 2.ª corrida. Los seeders se probaron con dobles en memoria (salvo `runtime-pieces`, probado con Postgres 16/Redis).
9. **API arrancada de verdad**: arranque de Nest con todos los módulos nuevos, orden de rutas (`services/scopes` antes de `:id`), `audit-trail-coverage.spec`, matriz de 403/404 por rol sobre HTTP real, E2E UI→request→BD→recarga (regla del repo).
10. `yarn contract:refresh` y/o `scripts/contracts/admin-portal-known-gaps.json`; `check-*.mjs` de la raíz (varios ya fallaban antes: `check-max-lines`, `check-architecture`, `check-mock-vs-client`, `check-admin-portal-contract`); `mutability.handlers.ts` tiene 602 líneas (techo 600).
11. `Dockerfile` de la API: paso que genere `dist/runtime-pieces.manifest.json` (`node dist/src/modules/platform_ops/runtime_pieces/runtime-pieces-manifest.cli.js dist/runtime-pieces.manifest.json`) — la imagen solo trae `dist/`, sin eso el escáner no ve nada. No probado.
12. Seguridad abierta: calidad de datos clínicos — comprobar que un SECURITY_ADMIN acotado a otra organización no vea incidencias ajenas; el motivo al terminar un permiso DENY se exige pero **no se persiste** (falta concepto/evento); `AUTHZ_GOVERNANCE_CONCEPT_SEEDS` quedó con conceptos sin uso; `authz-modules-route-inventory.ts` repite el escaneo de rutas (usar `RouteMetadataService` si es viable); `GET /admin/ops/tools` está declarado dos veces en dev.
13. Sonda de ajuste: persistir resultados (propuesta de tabla `data_catalog.catalog_fit_runs` en el README de `fit/`); enchufada a la taxonomía real de mutabilidad (`MutabilityFitSource`).
14. Catalogación: la **explicación de negocio sigue siendo plantilla** (0 operaciones curadas, 0 grano de fila, 3,4 % de columnas con descripción propia). Requiere curación humana por dominio; el sistema solo la deja visible como brecha.
15. Visibilidad: la directiva `*appVisible` se aplicó solo a 5 elementos del dashboard + menú/rutas; instrumentar más elementos = declararlos en `<feature>.ui-elements.ts` (+ `src/app/ui-elements.catalog.ts`) y usar la directiva. El portal admin debería llamar `refresh()` tras editar reglas. Falta mapear en el front los códigos de error extra de la API (`UI_RULE_PROTECTED_ELEMENT`, `UI_RULE_NOT_FOUND`, `UI_RULE_ENDED`, `UI_RULE_IF_MATCH_REQUIRED`, …).
16. Abrir los 3 PRs hacia `dev` (modelo primero, luego API, luego front) y subir la versión del modelo.

## Dónde mirar
- Contrato de visibilidad: `CONTRATO.md` (esta carpeta). Informes: `RBAC-POR-MODULO.md`, `RECONCILIACION-DEV.md`.
- Catalogación: `docs/trabajo/2026-10-31-catalogacion/{BRECHAS,COBERTURA}.md`.
- Plan original del perfil admin: `docs/trabajo/2026-10-30-perfil-admin-medicion-gobierno/PLAN.md`.
