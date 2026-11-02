# TRASPASO 2 — Portal admin (estructura Atlas), visibilidad, RBAC y catalogación

> Para quien continúe sin contexto. Fecha: 02/11/2026. Rama en los 3 repos: `claude/upbeat-darwin-rm3rn2`.
> Reemplaza la sección «Estado» de `TRASPASO.md` (31/10); aquel archivo sigue valiendo para el contexto de origen.
> **PRs solo hacia `dev`** (la rama `test` está dada de baja). **No se abrió ningún PR.** Orden al abrirlos: modelo → API → front.
> Regla de la casa: nada se da por «listo» sin evidencia ejecutada. Lo de abajo dice qué se ejecutó y qué no.

## 1. Estado por repo

| Repo | Estado en la rama | Verificado |
|---|---|---|
| Modelo (`mantra-core-health-model`) | v4.2.84. Tablas `data_catalog.catalog_fit_runs` e índice único `system_ops.entity_registry(schema_name, table_name)` declarados en `.puml`, DDL regenerado, `SHA256SUMS` y `_generation_report.md` al día. Merge de `dev` hecho. | Pruebas del repo 141 OK / 1 omitida; DDL aplicado desde cero en Postgres 16 y los 2 parches son no-op. |
| API (`mantra-core-health-api`) | Sonda de ajuste persistida, motivo de fin de DENY en `iam.security_events`, `@RequirePermission` + guarda (modo **shadow**, 11 rutas), upsert de `catalogEntity`, `@NotAudited` en heartbeat, OpenAPI e inventario regenerados, `orm:catalog` con la bóveda de `origin/dev`, paso de manifiesto en el `Dockerfile`. | `tsc` limpio, jest de lo tocado en verde, seed 40/40 + 2.ª corrida sin diferencias, API arrancada (1915 rutas) y matriz HTTP por rol. |
| Front (`mantra-core-health`) | Portal fuera de `ShellLayout` (marco único estilo Atlas), 18 pantallas rediseñadas, primitivas compartidas, mocks, contrato, proxy. | Ver §3: **dos revisiones visuales independientes dieron FAIL (58 → 71/100)**; la tercera pasada de correcciones quedó a medias (agentes cortados). |

## 2. Qué se hizo (resumen)

**Marco del portal.** Causa del «doble menú» y el hueco: `superadmin/portal` colgaba de `ShellLayout` y `PortalShell` dibujaba un 2.º armazón; además 3 avisos vacíos del marco global sumaban 32 px cada uno. Ahora es ruta de primer nivel (`src/app/app.routes.own-frame.ts`, mismo patrón que `/insights`), URL y guardas intactas (spec nuevo). `PortalShell` = lateral 268 px + topbar 64 px + lienzo + barra inferior en móvil. Se tocó `src/styles/alovida.css` (**global**: `:empty` oculta avisos vacíos).
**Primitivas** (`docs/trabajo/2026-10-31-visibilidad-rbac/PRIMITIVAS.md`): `app-page-header` con icono + eyebrow (los pone el marco desde `portal-nav`), pestañas que centran la activa, filtros en una fila, tabla apilada a 390, `ColumnDef.nowrap` y `sinCortes()/fecha()/fechaHora()`, `app-view-state-host [filtered]`, `app-alert collapsible`, `app-metric-card` sin partir «X de Y».
**Pantallas** (convención: cabecera → aviso → KPIs con icono → UNA tarjeta con pestañas): rbac-matrix, roles, field-permissions, who-can, access-reviews (ciclo de vida), mutabilidad, catálogo/reglas/«ver como» de visibilidad, catalog-fit, runtime-pieces, dq-issues, dq-rules, privacy, policies, pii, auditoría, centro.
**Piloto `@RequirePermission`** (`PILOTO-REQUIRE-PERMISSION.md`, evidencia `piloto-shadow-http-2026-11-01.txt`): 11 rutas en accounting/authz/scheduling; ningún permiso sembrado; `@Roles` sigue decidiendo.
**Contra Postgres real:** parches `ui_visibility` y `catalog_fit_runs` idempotentes; seeders 40/40; alta de regla de visibilidad UI→request→BD→relectura demostrada; matriz 401/403/200 de los endpoints nuevos.

## 3. Pendientes técnicos (por prioridad)

### A. Front — lo que impide aprobar la revisión visual
1. **Árbol con cambios sin commitear de agentes cortados** (≈41 archivos en `features/admin/portal/{visibility,mutability,probes,data-quality,privacy,governance}/**`): trabajo de la 3.ª pasada (RV-2) **sin verificar** (build/specs/capturas). Si este documento viene con un commit «WIP sin revisar», es eso. Revisar `git show` de ese commit antes de dar nada por bueno.
2. **Puntos de `REVISION-VISUAL-2.md` aún abiertos** (el informe tiene la tabla punto por punto):
   - Adoptar en TODAS las pantallas `fechaHora()/fecha()` (runtime-pieces usa «dd/MM/yyyy HH:mm»; `dateTime()` de `governance-labels.ts` parte «a. m.»), `<app-alert collapsible>` (hay `<details>` propios) y la cabecera de tabla única (tablas hechas a mano).
   - Mutabilidad: filtros en dos filas → «Hallazgos» bajo «Más filtros»; icono de cabecera (lápiz) no representa el módulo (vive en `portal-nav.ts`).
   - `ui-rules`: controles sin rótulo visible; `ui-catalog`: filtros en una fila.
   - `runtime-pieces`: 3 botones compiten en la cabecera; «evaluado hace 0 s»; `catalog-fit` Hallazgos a 390 ≈3890 px; mostrar `retention.kind/fallbackReason/lastWrite`.
   - `policies`: «Sin estado» pesa igual que «Activa». Auditoría 1440: «Resultado» baja de fila (o se cortan las fechas).
   - Menú lateral «Calidad de datos clínicos»: un solo ítem que no nombra la pantalla (se cambió a «Incidencias y reglas»; verificar).
3. **Capturas que faltan** (no hay NI UNA de estados M34 de carga/error/vacío-filtrado/S7/S9 salvo las de rbac-matrix y mutabilidad): who-can y access-reviews (vacío/error/carga), privacy (vacío), fichas de detalle de dq-rules/privacy/policies, T2 (lateral en página completa), KPIs a 768, barra inferior vs. acción primaria a 390, tema oscuro/768 de varias. Las capturas «antes» reales están en `evidencia/visual-final/*/antes-*` (commit `1d95bdcc`).
4. **Pruebas:** la suite completa nunca corrió (OOM). Corridas por partes: portal/permissions/rbac-matrix 78/78, visibility 67/67 (+180 en 15 archivos), mocks 1882/1882 (×2), 165 en las carpetas de sondas/calidad/privacidad/gobernanza **antes** de la 3.ª pasada. 3 fallos ya conocidos y ajenos: `adt.handlers.spec («censo: hoy…»)` depende de la fecha. `PortalShell` no tiene spec. Tres specs de `insurance-analytics` se corrigieron y no se volvieron a correr. Recomendado: `NG_BUILD_PARALLEL_TS=0 NODE_OPTIONS=--max-old-space-size=6144`, un `ng test` a la vez (`flock`), sin `ng serve` abierto.
5. **Auditor de regresiones — pasada incompleta.** Primer informe: NO verificado. Corregido después: orden visual/DOM de filtros (+ `filter-form.spec.ts`), avisos de seguridad/consentimiento en el portal, fuga de estado en mocks (`isolate: false`). **Sin auditar:** los commits posteriores a `c8aa9050` (primitivas: `data-table`, `tabs`, `view-state-host`, `page-header`, `notification-bell`, `app-alert`, `app-date-picker` en `filter-form`) con muestra de usos **fuera del portal**; ni `yarn pw:rutas`/`pw:accesos`.
6. **Checks de la raíz** (`node scripts/check-*.mjs`; el CI propio está caído): los de usted/colores del portal ya no marcan. Siguen fallando por áreas ajenas y por la base. De esta rama: `check-max-lines` → `app.routes.ts` ≈2582 (techo 2273; la base 2575) y `infrastructure*.handlers.ts`, `adt.handlers.ts` > 600 líneas. Tabla rama-vs-dev en el informe del agente de pendientes (ver git log `c8aa9050`).
7. `/tmp/fe-dev` y `/tmp/fe-base` (worktrees de comparación) ya se borraron; si reaparecen: `git worktree remove --force`.

### B. API / modelo
8. **Subir/regenerar:** declarar `catalog_fit_runs` en el ORM no se hizo (a propósito: SQL directo, evita deriva ORM↔modelo; por eso no sale en `orm:catalog`). El parche de `catalog_fit_runs` sigue siendo necesario por el `COMMENT`/`GRANT` que el generador no escribe. `check_ddl_sources.py` falla igual que antes (hay que `yarn db:vendor` en la API y hay un `CREATE TABLE` en `tools/terminology-import`).
9. **Índices sueltos:** 6 índices de parches viejos (v410, v4011, v414, v421, v4275) no están en la BD de prueba; parecen renombrados, **no se comprobó**.
10. **`audit-trail-coverage.spec`** 10/10 tras `@NotAudited` en el heartbeat; revisar que el motivo sea el correcto con el dueño de `ops_console`.
11. `Dockerfile`: el paso del manifiesto de piezas genera 181 piezas en el `dist` local; **`docker build` no se probó** (no había daemon).
12. Cuentas demo de pacientes (`ana.rojas.7`…) no entran con `SEED_DEMO_PASSWORD`; solo las de proveedores.
13. La copia `database/SQL` de la API está muy desfasada respecto del modelo.
14. Prueba en el shadow: sin un arranque «antes» sin decorador para comparar; la evidencia muestra que `@Roles` y el servicio deciden.

### C. Operación local
15. Postgres (5433) y Redis (6380) locales: `/home/user/db-env.txt` (puede no sobrevivir a la sesión). Base `alovida_model_check` es evidencia, se puede borrar. A `farmacia.demo` se le concedió y revocó PRACTITIONER durante la prueba; la fila de `crm.account_team_members` quedó con dominio `CRM_PRUEBA_UPSERT`.
16. `ng serve` + `ng test` no caben juntos en 14,3 GB (5 caídas por OOM durante el trabajo). Un `ng serve` con `--no-hmr` y heap 4000 es estable.

## 4. Decisiones que NO son de quien implementa
Ver `DECISIONES-PENDIENTES.md` (D1–D12). Resumen: entrada de `SECURITY_ADMIN`/`PRACTITIONER` global al PDP (bloquea `enforce`); aprobar o renombrar los 11 códigos del piloto; `SUPERADMIN` sin consultar el PDP; `reject`→APPROVE; shadow en log o auditoría; reporte contable por tipo de usuario; alcance de `SECURITY_ADMIN` en `ui_visibility`; Cumplimiento/DPO (retención, `is_official`, contradicciones de mutabilidad); dos huecos de `iam` en dev; umbral de frescura de 35 min; curación de negocio del catálogo; **cuál de las dos `GET /admin/ops/tools` se queda** (hoy el front espera la forma que nunca responde).

## 5. Cómo seguir (orden sugerido)
1. Verificar el árbol: `git log --oneline -5`, `git show --stat HEAD`; `NG_BUILD_PARALLEL_TS=0 NODE_OPTIONS=--max-old-space-size=6000 flock /tmp/heavy.lock corepack yarn ng build --configuration development`; specs por carpeta de §3-A4.
2. Cerrar §3-A2 y recapturar (§3-A3) con **un solo navegador** (`flock /tmp/browser.lock`), esperando h1 y sin overlay de error; mirar cada captura.
3. Revisión visual 3 + auditor de regresiones sobre HEAD completo (agentes en `.claude/agents/`: `visual-reviewer`, `regression-auditor`). Quien implementa no aprueba.
4. Decidir §4 con los dueños; recién entonces sembrar los 11 códigos y mirar el shadow unos días.
5. PRs a `dev`: modelo → API → front (cada uno con su descripción; el pre-push del front corre `yarn build`).

## Dónde mirar
`TRASPASO.md` (contexto), `ESTRUCTURA-ATLAS.md` (especificación), `PRIMITIVAS.md`, `REVISION-VISUAL-1.md` / `REVISION-VISUAL-2.md`, `DECISIONES-PENDIENTES.md`, `PILOTO-REQUIRE-PERMISSION.md`, `RBAC-POR-MODULO.md`, `RECONCILIACION-DEV.md`, `evidencia/visual-final/INDICE.md`.
