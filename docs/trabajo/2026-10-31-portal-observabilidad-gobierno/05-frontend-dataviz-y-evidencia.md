# 05 — Frontend del panel de observabilidad y gobierno: arquitectura, visualización de datos (skill `dataviz`) y protocolo de evidencia

- Fecha: 2026-10-31 · Frente: arquitectura frontend + sistema de visualización + evidencia «funciona de verdad».
- Dueño único de este archivo y de `evidencia-dataviz/`. No toca código fuente: es un plan con hechos verificados (`DISCOVERED`, con `ruta:línea`) y microtareas `TODO`.
- Contexto obligatorio: [CONTEXTO-COMUN.md](./CONTEXTO-COMUN.md). Reglas de la casa: `CLAUDE.md`, `docs/frontend/FABLE_STACK.md`, `docs/components/composition-rules.md` §5, `docs/adr/ADR-0005-view-state-m34.md`, `docs/adr/ADR-0017-echarts-chart-library.md`, `docs/design-system/tokens.md`.
- Skill `dataviz` leída completa (`SKILL.md` por el mecanismo oficial; `references/{choosing-a-form,color-formula,palette,marks-and-anatomy,interaction,components,anti-patterns}.md`; `scripts/validate_palette.js`). Nota: en disco `…/dataviz/SKILL.md` **no existe** (sólo `references/` y `scripts/`); el texto de la skill se cargó con la herramienta `Skill`.

---

## 0. Resultado REAL del validador (lo primero)

Se **ejecutó** `node …/dataviz/scripts/validate_palette.js` sobre los tokens reales del proyecto y contra las superficies reales del proyecto (no las por defecto del script). Salidas íntegras en `evidencia-dataviz/`:

| Archivo | Qué prueba | Resultado |
|---|---|---|
| `validate-palette-light.txt` | `--chart-1..8` claro (`src/styles.css:226-227`) sobre `--bg-surface` claro = `#FFFFFF` (`styles.css:232-234`) | **PASS, exit 0.** Banda L, croma, CVD adyacente (peor ΔE 9,1 protan: `#eda100↔#1baf7a`), piso normal 19,6. **WARN contraste**: `#1baf7a` 2,82 · `#eda100` 2,17 · `#e87ba4` 2,69 (< 3:1) → relevo obligatorio (rótulo directo o tabla), que `ChartPanel` ya da (tabla, `chart-table.ts`). |
| `validate-palette-dark.txt` | `--chart-1..8` oscuro (`styles.css:333-334` y `406-407`) sobre `--bg-surface` oscuro = `--c-petrol-800` = `#0A2B3D` (`styles.css:33,338,411`) | **PASS, exit 0.** CVD adyacente 8,4 (`#c98500↔#199e70`), piso normal 19,3. **WARN contraste: `--chart-6` `#008300` = 2,98:1** sobre la superficie real. Control: contra la superficie por defecto del script (`#1a1a19`) pasa limpio → **la ADR-0017 copió la paleta de referencia sin revalidar contra la superficie petróleo del proyecto**. |
| ídem, `--pairs all` | dispersión / múltiplos pequeños, 8 slots | **FAIL en ambos modos** (esperado por la skill: ninguna orden de 8 pasa all-pairs). **Los 3 primeros slots sí pasan all-pairs** en claro y oscuro → tope de 3 series en dispersión/múltiplos pequeños. |
| `validate-palette-dark-propuesta.txt` | snap-to-passing del slot 6 oscuro (sólo luminosidad, mismo matiz) | `#0a8a0a`, `#0b900b`, **`#0c960c`**, `#0ca30c`, `#1a9a1a`: todos **PASS sin WARN** (≥ 3:1), ΔE adyacente inalterado (8,4 / 19,3). `#0c960c` pasa también sobre `--bg-surface-alt` oscuro (`#0B3953`) y `--bg-base` (`#0A1C27`). Control claro sobre `--bg-surface-alt` claro (`#F8F5F0`): se suma `#eb6834` (2,94) a la lista de relevo → **los gráficos del panel van siempre sobre `--bg-surface`, nunca sobre `-alt`.** |
| `validate-sequential-ordinal.txt` | `--chart-seq-1..5` con `--ordinal` (la categórica FALLA por diseño sobre una rampa; `color-formula.md` §Scope) | Como rampa **ordinal** FALLA: extremo claro 1,32:1 (claro) y 1,82:1 (oscuro) < 2:1; en oscuro `#184f95→#1c5cab` ΔL 0,047 < 0,06. Como **secuencial continua** (heatmap de magnitud) es válida: la skill permite que el paso más claro «se retire hacia la superficie» (`palette.md` §Sequential). `--heat-1..4` y la rampa petróleo 100–700 también fallan como ordinal (extremo claro 1,51; en oscuro `--heat-1-bg` = `--bg-surface` → 1,00:1, **una celda de nivel 1 es invisible sobre la tarjeta oscura**; `styles.css:454`). |
| `validate-ordinal-propuesta.txt` | rampas ordinales propuestas (etapas de embudo, cubos de latencia, niveles de fricción) | **PASS**: claro `#86b6ef,#3987e5,#1c5cab,#0d366b` (= seq-2..5); oscuro `#1c5cab,#3987e5,#6da7ec,#9ec5f4` (= seq-2..5). 5 pasos claro con la referencia 250/350/450/550/700 también PASS; 5 pasos oscuro con `#184f95` o `#256abf` FALLA (extremo 1,82 / ΔL 0,048) → **en oscuro la ordinal tiene 4 pasos, no 5.** |
| `heatmap-text-contrast.txt` | texto sobre cada paso del heatmap (regla `readableOn`, `chart-color.ts:48-62`), `--heat-*`, estado y divergente | **Todos los pasos de `--chart-seq-*` alcanzan ≥ 4,5:1** con la regla actual (texto/superficie del tema y, en el medio, negro o blanco puros): claro 11,26 · 7,06 · 5,77(#000) · 6,63 · 11,95; oscuro 7,32 · 5,98 · 5,77(#000) · 5,88 · 8,24. `--heat-*` fg/bg: AA en los 8 pares. Estado `--st-*-fg` sobre `--bg-surface`: 4,94–10,93 (AA) en ambos temas. |

**Conclusión:** la paleta categórica del proyecto **pasa** la skill en los dos modos; hay **un** hallazgo que corregir (slot 6 oscuro, 2,98:1) con corrección validada (`#0c960c`), una regla operativa (gráficos sólo sobre `--bg-surface`), un tope (3 series en formas all-pairs) y una **rampa ordinal** nueva que hay que tokenizar (hoy no existe: sólo hay secuencial continua). Paleta final por slot en §2.

---

## 1. Inventario (`DISCOVERED`, con `ruta:línea`)

### 1.1 `src/app/shared/components/organisms/chart-panel/` — el organismo oficial (ADR-0017)

| Qué | Dónde | Hecho |
|---|---|---|
| Entradas/salidas | `chart-panel.ts:67-74` | `spec: ChartSpec` (requerida), `seleccion`, `grande`; salida `filtroCambia: FiltroActivo`. El panel **no** decide el filtro: lo emite. |
| Contrato 7 puntos | `core/data-access/reporting/reporting-contract.ts:9-24` | Sin título/resumen accesible/motivo de ausencia de filtro, info o velas → `violaciones` y **no dibuja** (`chart-panel.html:70-78`, `data-testid="chart-contract-violated"`). |
| Tipos de gráfico soportados | `reporting.types.ts:103-138` + `chart-option.builder.ts:373-429` | `cartesiano` (series `linea`/`barra`/`area`, `apilar`, `horizontal`), `partes` (`dona`/`embudo`), `mapa-calor` (celdas `[col,fila,valor|null]`), `medidor` (gauge), `cascada`; más `velas` (`chart-option.cascada.ts:119-165`). **No hay**: histograma como forma propia, barra segmentada, medidor lineal, dispersión, énfasis (una serie acento + grises), línea objetivo/umbral, anotaciones de despliegue. |
| Módulos ECharts registrados | `chart-echarts.setup.ts:2-13,15` | Bar, Line, Pie, Funnel, Heatmap, Gauge, Candlestick; Aria, DataZoom, Grid, Legend, MarkLine, Timeline, Tooltip, VisualMap; **SVGRenderer**. Registro único (`:19-43`). `echarts 6.1.0`, `ngx-echarts 21.0.0` (`package.json:98,102`). |
| Cómo toma colores | `chart-theme.ts:25-34,36-42,49-65` | `getComputedStyle(document.documentElement)` lee `--chart-1..8` (serie), `--chart-seq-1..5` (rampa), `--text-primary`, `--text-secondary`, `--border-strong` (línea), `--border-default` (rejilla), `--bg-surface` (tooltip y superficie), `--st-success-fg`/`--st-error-fg` (bueno/malo), y la `font-family` real del `body`. **Ningún hex a mano** (regla 95.1.5). |
| Cómo maneja el tema | `chart-panel.ts:134-154` | `afterNextRender` lee el tema; `document.fonts.ready` relee; `MutationObserver` sobre `data-theme`/`class` del `<html>`; `matchMedia('(prefers-color-scheme: dark)')`. Para tarjetas KPI hay un servicio único `features/reporting/components/chart-theme.service.ts:16-42` (un observador para todas). |
| Accesibilidad | `chart-option.common.ts:44-54` · `chart-panel.html:116-125,180-205` | `aria.enabled`; **decal (textura) sólo** con `prefers-contrast: more` o `forced-colors` (`:37-42,51`) — exactamente lo que pide `marks-and-anatomy.md` §Texture; `animation` apagada con `prefers-reduced-motion` (`:52`); lienzo `role="img"` con `aria-label = resumenAccesible`; tabla con `caption`, `th scope`; menú con `role="menu"`, flechas/Home/End/Escape/Tab (`chart-panel.ts:210-245`); chips de filtro por teclado (`chart-panel.html:151-160`). |
| Tabla alterna y CSV | `chart-table.ts:19-54,57-66,86-90` · `chart-panel.html:178-206` | Obligatoria por la regla de relevo (3 tonos < 3:1). CSV con BOM, unidad en el encabezado y neutralización de fórmulas. `max-height: 22rem` (`chart-panel.css:66`). |
| Tooltips | `chart-option.common.ts:72-83` · `builder.ts:125-140,164-177,244-255,307-314` | `confine`, fondo/borde del tema, `extraCssText` con `var(--shadow-md)`/`var(--r-md)`; cartesiano `trigger: 'axis'` (una lectura, todas las series ✓ `interaction.md`), `axisPointer` `shadow` con barras / `line` con líneas; `null` → «Sin dato» (`NO_DATA`). HTML escapado con `escapar` (`common.ts:29-35`). |
| Marcas | `builder.ts:45-53,112` | Línea 2 px ✓; `barMaxWidth: 28` (skill ≤ 24); `borderRadius` 4 px en el extremo de dato y recto en la base ✓; `symbolSize: 7` (skill ≥ 8); área 0,14 (skill ~0,10); **rejilla `type: 'dashed'`** (`:112`, anti-patrón «Dashed gridlines»); dona con `borderColor` superficie 2 px (`:212`) y heatmap con `borderColor` superficie 2 px (`:291`) = la «brecha de superficie» ✓; **barras apiladas sin brecha** (`:49-53` sólo redondea las no apiladas). |
| Heatmap | `builder.ts:219-296` | `visualMap` continuo con `inRange` = rampa (`:230-243`); celda `null` neutra con `sinDato` (no es cero ni hueco, `:264-274`); etiqueta por celda con `readableOn` (`:278-283`, probado AA en `chart-color.spec.ts:46-70`); rótulos ocultos en lienzo angosto (`:413`). |
| Responsive | `builder.ts:358-371` · `common.ts:27` | `media` de ECharts por **ancho del lienzo** (≤ 520 px) y no de la ventana; rotación/partición de rótulos (`common.ts:118-126`). Alto 300 / 520 en grande (`chart-panel.ts:107`). |
| Menú «Más» | `chart-panel.html:39-65` | Ver en grande (diálogo `size="xl"`, `:210`), tabla, CSV. `data-testid`: `chart-<id>`, `chart-more`, `chart-how-calculated`, `chart-info`, `chart-no-data`, `chart-no-filter|info|candles`, `tabla-<id>`. |
| **Tarjeta propia** | `chart-panel.css:3-13` | `.gp` dibuja borde + `--shadow-sm` + `--r-lg`: dentro de la **única tarjeta con pestañas** (regla §5) sería tarjeta-dentro-de-tarjeta, contra `tokens.md` §Radios («UNA elevada por pantalla; el resto superficie tonal sin borde ni sombra»). Hace falta un modo plano (§3.4). |
| Pruebas | `chart-option.builder.spec.ts` (442 l.), `chart-panel.spec.ts` (223), `chart-color.spec.ts` (79), `chart-table.spec.ts` (43) | Cubren decal, tipografía, rótulos, heatmap sin dato, cascada, clic-filtro. No hay prueba de la paleta contra el validador de la skill (sólo el comentario en `features/insights/charts/chart-tokens.css:1-9` afirma que se midió). |

### 1.2 `src/app/features/reporting/components/`

| Pieza | Dónde | Hecho |
|---|---|---|
| `KpiTile` | `kpi-tile/kpi-tile.ts:41-100`, `.html:1-69` | Contrato de tile: `null` ≠ 0 (`noData`, motivo), variación con flecha + número + palabra (`kpi-delta.ts`), «N de M» (`fraction`), mini-tendencia ECharts (`sparkline.ts:33-83`: línea 2 px, último punto con anillo de superficie 2 px, área 0,12, sin ejes ni leyenda, tooltip), «Cómo se calcula» (`CalcInfo`). `data-testid`: `kpi-<id>`, `kpi-value`, `kpi-reason`, `kpi-delta`, `kpi-fraction`, `kpi-trend`, `kpi-how`. **No tiene** `estado` (bueno/aviso/crítico con icono+rótulo) ni variante «cifra héroe» ≥ 48 px. |
| `ChartThemeService` | `chart-theme.service.ts:16-42` | Un observador del tema para todas las tarjetas. Reutilizable por cualquier widget nuevo. |
| `ReportFilterBar` | `filter-bar/report-filter-bar.html:1-54`, `.ts` (90 l.) | **Una fila**: Periodo (select), Comparar, Moneda (segmentado); chips de filtros activos con «Quitar»/«Limpiar»; `role="status" aria-live` para anunciar cambios. Lee `ReportContextStore` (`state/report-context.store.ts:40-50`: `periodo '7d'|'30d'|'90d'|'ytd'|'12m'`, `comparar`, `moneda`, `alcance 'plataforma'|'organizacion'`, `filtros`). **No tiene** «hoy / 24 h / rango personalizado» ni zona horaria. |
| `TabView` | `tab-view/tab-view.ts:57-99` | Presentacional: `PestanaReporte` → KPIs (6 principales, `:36`), secciones de gráficos y tablas; huérfanos a ancho completo (`tab-layout.ts`). `ReportTable` (`report-table.ts`, 130 l., **no leído en detalle**). |
| `ReportCard`, `CalcInfo` | `report-card/report-card.ts:21-43`, `calc-info/calc-info.ts:11-21` | Tarjeta del grid y ficha «Cómo se calcula» (definición, fórmula, numerador, denominador, fuente, frescura, salvedades). |
| Tipos | `core/data-access/reporting/reporting.types.ts` | `UnidadValor` (`:18-22`): moneda, número, porcentaje, razón — **no hay `duracion` (ms)**. `DimensionFiltro` (`:42-53`) es comercial (plan, especialidad, …) — **no hay endpoint/pantalla/dominio/código**. `KpiSpec` (`:169-193`). |

### 1.3 `src/app/features/insights/charts/` — SVG propio (contradice ADR-0017)

`bar-chart.ts` (165 l.), `line-chart.ts` (282), `heatmap-chart.ts` (82), `funnel-chart.ts`, `stacked-chart.ts`, `scatter-chart.ts`, `distribution-chart.ts`, `chart-math.ts`; tokens en `chart-tokens.css:10-21` (alias `--ins-s1..6` → `--chart-1..6`, `--ins-grid` → `--border-default`, `--ins-good/bad` → `--st-*-fg`). El heatmap usa 4 niveles `--heat-1..4-bg/fg` (`heatmap-chart.css:83-86`) y rayado para «sin dato» (`:78`). **No se reutiliza en el panel**: ADR-0017 fija ECharts vía `ChartPanel`; se registra como deuda (`anti-patterns.md`: dos sistemas de gráficos en un producto). Detalle de `line-chart.ts` y `chart-math.ts`: **no leído**.

### 1.4 Cómo dibujan hoy `admin/observability` y `admin/web-analytics`

- `features/admin/observability/observability.html:14-15` ya usa **`app-card variant="outlined"` + `app-tabs`** (Resumen · Endpoints · Usuarios activos · No medido) con `app-view-state-host` por pestaña (`:17,102,127`) y `app-data-table` con `[state]` (`:78-90`). Rango `hoy|24h|7d` con `app-segmented-control` (`:9`, `observability.ts:81-85`). La serie de solicitudes son **barras CSS** (`div` con `block-size` %, `:51-71`), `title` como tooltip, `role="img"` + frase (`observability.ts:186-191`). `notMeasured` → rótulos (`observability.ts:44-52`); medición apagada → S3 con próxima acción (`:94-99`). **No usa ECharts ni `ChartPanel`.**
- `features/admin/web-analytics/web-analytics.html`: pestañas Resumen · Rendimiento · Embudos · Altas y Deserción · Sesiones · Pipeline; barras CSS (`:43-46`), embudo con barras CSS (`:135-136`), «mapa de calor» como **tarjetas por `thermalLevel`** (`:235-260`), no una grilla. Consume `WebAnalyticsClient` (`core/data-access/admin-portal/platform.client.ts:39-96`).
- `features/admin/measurement/measurement.ts:1-60`: agrupa `/admin/ops/traffic/endpoints` por funcionalidad (`measurement-groups.ts`), dinero (`analytics-money.client.ts`) y heatmap de onboarding. Es el antecedente directo de «uso por parte de la app».
- `features/dashboard/platform-home/platform-home.ts:1-40` («Centro de la plataforma»): tráfico, vida de instancias, herramientas, consola de operación y QA en una portada.

### 1.5 Tokens de color (`src/styles.css`, 695 l.)

- **Son 247 tokens, no 188** (`docs/design-system/tokens.md:35`: 234 + 13 de gráficos). `CLAUDE.md` y `FABLE_STACK.md` dicen 188: desactualizados.
- Rampas 50–900 que no cambian con el tema (`styles.css:31-79`): `petrol`, `aqua`, `mint`, `amber`, `sage`, `ivory`, `neutral`, `success`, `warning` (= amber), `error`, `info` (= aqua).
- Superficies: claro `--bg-base/--bg-surface = #FFFFFF` (`:232-234`), `--bg-surface-alt = ivory-400 #F8F5F0` (`:235`); oscuro `--bg-base = petrol-900 #0A1C27`, `--bg-surface = petrol-800 #0A2B3D`, `--bg-surface-alt = petrol-700 #0B3953` (`:337-339`, `:410-412`). Texto: claro `neutral-500 #242828` / oscuro `ivory-500 #F6F3ED` (`:252`, `:346`, `:418`).
- Estado: `--st-<success|warning|error|info>-<bg|fg|bd>` (`:280-283` claro = 50/700(800 warning)/200; `:379-382` y `:445-448` oscuro = 800/200/600). Primario/secundario/terciario (`:286-292`).
- Escala de intensidad `--heat-1..4-bg/fg` (`:302-305` claro petrol-100/200/400/600; `:392-395`, `:454-457` oscuro petrol-800/700/300/200).
- Gráficos (ADR-0017, 2026-10-30): `--chart-1..8` y `--chart-seq-1..5` (`:226-229` claro; `:333-336` oscuro por preferencia; `:406-409` oscuro manual). **No existen** tokens ordinales, divergentes ni de estado-para-gráficos.
- Gates que los vigilan: `scripts/check-contrast.mjs` (lee los bloques claro/oscuro, resuelve `var()` y compone translúcidos, `:45-140`), `check-tokens.mjs`, `check-css-tokens.mjs`, `check-colores-sueltos.mjs`; `design-tokens.types.spec.ts` compara CSS ↔ TS en ambos sentidos (`tokens.md` §Verificación).

### 1.6 Primitivas de estado y composición

- `ViewState<T>` (`core/view-state/view-state.types.ts:35-230`): 9 estados; `empty` exige `nextAction`, `stale` exige `asOf`, `error` exige `requestId`. `ViewStateHost` (`shared/components/organisms/view-state-host/view-state-host.html:1-180`): `@switch` con 8 `@case`; **S7 `stale` comparte rama con `ready`** (`:180`); salidas `retry`, `refresh` (`view-state-host.ts:69-72`). `errorToViewState` (`core/http/error-to-view-state.ts:64-130`) propaga `correlationId` como `requestId`; la API lo emite desde `x-request-id` (`mantra-core-health-api/src/common/filters/all-exceptions.filter.ts:218`).
- `Tabs`/`Tab` (`shared/components/molecules/tabs/tabs.ts:68-71`, `tab/tab.ts:48-54`): `selectedIndex` como `model`, `orientation`, `appearance 'underline'|'browser'`, activación **manual** (flechas mueven foco; Enter/Espacio seleccionan); `label`, `icon`, `disabled`. `app-tab` **no dibuja el panel cerrado** (composition-rules §5): el estado de cada pestaña vive en señales del componente, no en la vista.
- `Card` (`molecules/card/card.ts:49-53`): `variant` (`outlined`…), `padding`, `interactive`.
- `DataTable` (`docs/adr/CONTRATO-data-table.md:21-66`): `state: ViewState<readonly Row[]>`, `columns`, `trackBy` (obligatorios), `caption`, `rowLabel`, `sort`, `cursor`, `rowNavigable`, `maxHeight`; salidas `sortChanged`, `cursorChanged`, `selectionChanged`, `rowActivated`, `retry`, `refresh`. **Monta `ViewStateHost` por dentro**: no se envuelve en otro.
- `PdfExportButton` (`molecules/pdf-export-button/pdf-export-button.ts:62-95`): `filename` (req.), `title`, `subtitle`, `kind`, `target: HTMLElement`, `label`, `variant`. Cómo rasteriza un SVG de ECharts (`pdf-export.service.ts`): **no verificado**.
- `TenantSwitcher` (`organisms/tenant-switcher/tenant-switcher.ts:52-56`): `tenants`, `activeTenantId`, `variant 'compact'|…`, `tenantChanged` — base del conmutador de organización OPCIONAL.
- `SegmentedControl`, `Select`, `Alert`, `Badge`, `MetricCard`, `EmptyState`, `PageHeader`: existen (`shared/components/{molecules,organisms}/`).

### 1.7 Rutas, guards, entorno, simulador y Playwright

- `src/app/app.routes.ts`: **2 564 líneas**; techo congelado 2 273 (`scripts/baselines/max-lines.json:7`); **`check-max-lines` ya falla hoy** por este archivo (y 122 más). Precedentes para no engordarlo: `app.routes.governance.ts` (90 l., `RUTAS_DE_GOBIERNO` importado en `app.routes.ts:46`), `features/insights/insights-portal.route.ts:22-34` (función que recibe `chunkFallido`, `loadComponent` shell + `loadChildren`), `features/admin/portal/portal.routes.ts` (`PORTAL_RUTAS`, montado en `app.routes.ts:1281`). Portales fuera del armazón: `portal-selector` (`:1820-1830`), `reports` (`:1832-1843`), `insights` (`:1844`). Pantallas diferidas de superadmin: `superadmin/observability|measurement|portal|web-analytics` (`:233-244`); el inicio del grupo superadmin es `/superadmin/observability` (`:1519`).
- Guards: `authGuard` (`core/auth/auth.guard.ts:29-42`) manda a `/auth/organization` si `needsTenantSelection` (`core/auth/session.store.ts:227-229`: `tenants().length > 1 && selectedTenantId() === null`, **sin distinguir roles de plataforma**); `login.ts:219-237 destinoNormal()` repite la regla y luego `entryDestination` (`features/reporting/reporting-access.ts:116-125`). `seccionRolesGuard` (`core/navigation/section-roles.guard.ts:76-88`) lee `ROLES_ROUTE_DATA` o la sección por prefijo; `SUPERADMIN` es comodín (`rolesAlcanzan`). Roles de lectura de la API: `OPS_READ_ROLES = PLATFORM_ADMIN, SRE, SECURITY_ADMIN, RELEASE_MANAGER, GOVERNANCE_ADMIN` (`api/src/modules/ops_console/presentation/controllers/ops-console.controller.ts:14-20`); `ANALYTICS_READ_ROLES = PLATFORM_ADMIN, SECURITY_ADMIN, DATA_PLATFORM_ADMIN, MARKETING_MANAGER, DPO` (`telemetry-analytics.controller.ts:29-35`); `SUPERADMIN` global es comodín en la API (`common/auth/roles.guard.ts:82-86`). Secciones de plataforma y sus roles: `core/navigation/navigation.platform.ts:91-117`.
- Entornos: `environment.types.ts:153-309` (`apiBaseUrl`, `mockBackend`, `designMockups`…); `environment.real-api.ts` apaga todo lo simulado (`mockBackend: false`); `angular.json` `build.real-api` (`:132-142`, `server:false`, `ssr:false`, `outputMode:static`) y `serve.real-api` (`:230`); `yarn start:real-api` (`package.json:18`); `scripts/check-real-api-config.mjs` lo vigila. Proxy `proxy.conf.json` + `proxy.conf.mjs` (prefijos de API hacia el backend; `BACKEND_ORIGIN` lo fija `scripts/generate-env.mjs`). `core/mock/api-mode.ts:25 forcedRealApi` es sólo del visor. Simulador del tráfico: `core/mock/handlers/ops-traffic.handlers.ts` (probado en `.spec.ts:8-32`).
- Playwright: `playwright.config.ts` — `workers: 1` (login limitado a 10/min/IP), `baseURL = E2E_BASE_URL ?? http://localhost:4200`, `locale es-BO`, `timezoneId America/La_Paz`, viewport 1440×900, `trace retain-on-failure`. `playwright/support/sesion.ts:62-120 entrar()` (reintento único ante 429; acepta `/dashboard|/auth/organization|/portal-selector`; `tenant-opcion`); `support/actores.ts:52-58 urlDeApi()` (**por defecto 3005**; `E2E_API_URL` lo cambia). Patrón de spec contra API real: `playwright/altas-api-real-tres-escenarios.spec.ts:1-30` (`E2E_API_REAL=1`, `test.skip` si no, «No es un verde»). `data-testid` del login: `login-identifier`, `login-password`, `login-submit` (`features/auth/login/login.html:96`). Viewports del gate visual: 390×844, 768×1024, 1024×768, 1440×900 (`.claude/skills/visual-quality-gate/SKILL.md:17-20`).
- Revisores: `.claude/agents/visual-reviewer.md` (PASS ≥ 92 y cero BLOCKER/CRITICAL/HIGH; `FAIL: INSUFFICIENT_EVIDENCE` sin navegador), `regression-auditor.md` (`REGRESSION_VERIFIED` sólo con evidencia; `pw:rutas`, `pw:accesos`), `frontend-reviewer.md`.

### 1.8 API real: lo que hay para leer (y lo que no)

| Pregunta del panel | Endpoint hoy | Hecho / hueco |
|---|---|---|
| Resumen del sistema, serie de solicitudes, latencia | `GET /admin/ops/traffic` (`ops-console.controller.ts:90-100`) | `TrafficOverview` (`core/data-access/admin-portal/ops-traffic.types.ts:78-83`): `measured` (requests, succeeded, failed 4xx/5xx, `successRatio|null`, `latencyMs {avg,p50,p95,max, approximate}`, `activeUsers`, **`lastDataAt`**), `series[]` (`bucket, requests, failed4xx, failed5xx, p95Ms`), `notMeasured[]`. **Por cubo sólo hay p95**: p50/p99 en el tiempo exigen ampliar la API (`latency-buckets.ts` estima desde histograma `le5…le10000,inf` guardado en `service_sli_series`, módulo `time_series`). |
| Peticiones por endpoint | `GET /admin/ops/traffic/endpoints` (`:102-110`) | `TrafficEndpoint` (`:85-101`): método, plantilla, 2xx/4xx/5xx, avg/p95/max, `operationId`. `limit`, `sort requests|failed|p95`. |
| Errores agrupados (por código, por `requestId`, por pantalla) | — | **No existe.** La API emite `x-request-id` (`all-exceptions.filter.ts:218`) pero no hay lectura agregada de excepciones. Dependencia del frente API. |
| Consultas SQL lentas | — | `api/src/orm/observability/query-metrics.ts` tiene contadores en memoria (`total`, `byKind`, `slowQueries`, `failedQueries`, `totalMs`, `maxMs`) **sin endpoint** y sin persistencia («por proceso y se pierde al reiniciar»). Dependencia del frente API. |
| Uso por parte de la app | `/traffic/endpoints` + `measurement-groups.ts` | Agrupación en el front por funcionalidad (precedente). |
| Heatmap por pantalla | `GET /admin/analytics/onboarding/heatmap` (`telemetry-onboarding-analytics.controller.ts:152-165`, por campo y `metric interactions|errors|abandonment`); `GET /admin/analytics/heatmap?route…` (clics) **no existe en `telemetry/presentation/controllers/`** aunque el contrato H2 (`docs/trabajo/2026-10-30-perfil-admin-medicion-gobierno/contratos/H2-dinero-y-heatmap.md:70-74`) lo nombra → **no verificado / no implementado**. | `/admin/analytics/*` exige **tenant** (`requireTenantId()`, `telemetry-analytics.controller.ts:128`): un panel de plataforma necesita un alcance «todas las organizaciones» en la API. |
| Embudos | `GET /admin/analytics/funnels`, `/funnels/:id/report`, `/onboarding/funnel` | Tipados en `platform.types.ts:75-101` y `onboarding-draft.types.ts`. |
| Calidad de datos, cobertura, deriva, PII | `GET /admin/catalog/coverage` (`admin-catalog.controller.ts:347`), `permission-drift` (`:334`), `scans` (`:357`), `objects/:id/*`; `GET /admin/portal/catalogo/deriva` (`admin-portal.controller.ts:175`), `linaje` (`:184`), `glosario` (`:200`), `flujos/*` | Clientes ya tipados: `data-catalog.client.ts`, `portal.client.ts`, `flows.client.ts`. «Reglas/incidencias de calidad» y «políticas» estilo Atlas: **sin endpoint** (dependencia API/modelo). |
| SLO / presupuesto de error | `GET /admin/ops/slos` (`:72-79`, «SLO activos con su última medición») · `SloStatus` (`platform.types.ts:372`) | Sin serie temporal de consumo del presupuesto → sólo tile/medidor; la curva exige API. |
| Auditoría | `GET /audit/log`, `GET /audit/data-access` (`audit-query.controller.ts:40,54`) · `core/data-access/audit/audit.types.ts` | Vista de plataforma (atraviesa organizaciones), `AUDIT_MAX_PAGE_SIZE 200`. |
| Operación | `readiness`, `incidents`, `deployments`, `backups` (`ops-console.controller.ts:32-88`) | `platform.types.ts:329-390`. |

---

## 2. Paleta final por slot (tokens del proyecto)

Reglas de la skill que se adoptan tal cual: orden **fijo**, nunca ciclado; 9.ª serie → «Otros»/múltiplos; **un eje**; secuencial = un matiz; divergente = dos matices + gris neutro; estado reservado con icono + rótulo; texto siempre con tokens de texto; validar antes de publicar.

### 2.1 Categórica (identidad) — orden fijo, 8 slots

| Slot | Matiz | Claro (sobre `#FFFFFF`) | Oscuro (sobre `#0A2B3D`) | Token | Relevo |
|---|---|---|---|---|---|
| 1 | azul | `#2a78d6` | `#3987e5` | `--chart-1` | — |
| 2 | naranja | `#eb6834` | `#d95926` | `--chart-2` | — |
| 3 | aqua | `#1baf7a` (2,82) | `#199e70` | `--chart-3` | rótulo/tabla en claro |
| 4 | amarillo | `#eda100` (2,17) | `#c98500` | `--chart-4` | rótulo/tabla en claro |
| 5 | magenta | `#e87ba4` (2,69) | `#d55181` | `--chart-5` | rótulo/tabla en claro |
| 6 | verde | `#008300` | **`#0c960c`** (hoy `#008300`, 2,98 → corregir) | `--chart-6` | — |
| 7 | violeta | `#6250d6` | `#9085e9` | `--chart-7` | — |
| 8 | rojo | `#e34948` | `#e66767` | `--chart-8` | — |

Topes: ≤ 3 series en dispersión/múltiplos pequeños (all-pairs); 4 series exigen rótulo directo (amarillo y naranja juntos); 5–6 leyenda; 7–8 techo. **Nominal** (endpoints, pantallas, dominios): todas las barras con el slot 1, sin leyenda de caja; **nunca** colorear barras nominales por su valor (`anti-patterns.md`).

### 2.2 Secuencial continua (heatmaps de magnitud) — un matiz, azul

`--chart-seq-1..5`: claro `#cde2fb → #86b6ef → #3987e5 → #1c5cab → #0d366b`; oscuro `#184f95 → #1c5cab → #3987e5 → #6da7ec → #9ec5f4` (`styles.css:228-229, 335-336`). Válida como continua; el extremo claro se retira hacia la superficie a propósito. Texto sobre cada paso: AA en los 10 casos (`heatmap-text-contrast.txt`). Celda `null`: `--border-default` + «Sin dato» (ya en `builder.ts:264-274`).

### 2.3 Ordinal (orden discreto: etapas de embudo, cubos de latencia, niveles de fricción, antigüedad) — **nueva**, 4 pasos

| Paso | Claro | Oscuro | Token propuesto |
|---|---|---|---|
| 1 | `#86b6ef` (2,11:1) | `#1c5cab` (2,22:1) | `--chart-ord-1` |
| 2 | `#3987e5` | `#3987e5` | `--chart-ord-2` |
| 3 | `#1c5cab` | `#6da7ec` | `--chart-ord-3` |
| 4 | `#0d366b` | `#9ec5f4` | `--chart-ord-4` |

Validada con `--ordinal` en ambos modos (`validate-ordinal-propuesta.txt`). Son alias de `--chart-seq-2..5` (misma rampa, sin el paso 1): **no se inventa ningún hex**. El heatmap de 4 niveles de `insights` (`--heat-*`) **no** se usa en el panel: su nivel 1 oscuro es la propia superficie.

### 2.4 Divergente (polaridad: delta contra objetivo, mejor/peor que el periodo anterior) — **nueva**

Polo frío `--chart-1` ↔ polo cálido `--chart-8`, **punto medio neutro** `--bg-surface-alt` (`#F8F5F0` / `#0B3953`), pasos intermedios `--chart-seq-2` y un rojo claro del mismo matiz que el polo 8 (a validar en H1 como dos brazos ordinales con `--ordinal`; en `heatmap-text-contrast.txt` los polos dan 4,42/3,95 claro y 4,05/4,56 oscuro). Nunca azul↔aqua (ambos fríos).

### 2.5 Estado (bueno · aviso · serio · crítico) — fijo, nunca tematizado

Se **reutilizan los tokens de estado del sistema**, no los de la referencia: `--st-success-*`, `--st-warning-*`, `--st-error-*` (+ `--st-info-*`), con icono + rótulo **siempre** (`color-formula.md` §Status). Texto `--st-*-fg` sobre `--bg-surface`: 4,94–10,93 (AA) en ambos temas. Regla de colisión: una serie que **significa** bueno/malo (tasa de error, pasa/falla, 5xx) viste estado; «serie 4» viste categórica; nunca ambas en un gráfico. Mapa de `TrafficBucket`: 2xx → `--chart-1`? **No**: la pila éxito/4xx/5xx *significa* estado → `--st-success-bd` / `--st-warning-bd` / `--st-error-bd` (rellenos) con rótulo y tabla. `ChartTheme.bueno/malo` ya lee `--st-success-fg/--st-error-fg` (`chart-theme.ts:59-60`); H1 agrega `aviso` (`--st-warning-fg`) y los `-bd` como rellenos.

### 2.6 Cromo y tinta

Rejilla `--border-default` **sólida**, hairline (hoy `dashed`, corregir); eje `--border-strong`; texto `--text-primary`/`--text-secondary`/`--text-muted`; superficie del gráfico `--bg-surface` **siempre** (sobre `-alt` cae un slot más bajo 3:1); tipografía `--font-body` (Inter) también para la cifra héroe (`palette.md` §Typeface: sans del sistema, nunca display → **no Poppins** en cifras); `tabular-nums` sólo en tablas y ejes.

---

## 3. Sistema de visualización del panel

### 3.1 Pregunta → forma → color → interacción → qué soporta `chart-panel` hoy

| # | Pregunta | Forma (`choosing-a-form.md`) | Color | Interacción | `chart-panel` hoy | Extensión |
|---|---|---|---|---|---|---|
| 1 | Resumen del sistema (solicitudes, éxito, fallidas, p95, usuarios activos, `lastDataAt`) | **Fila de tiles** (`KpiTile`) + **una cifra héroe** (tasa de error 5xx del periodo, ≥ 48 px) — **no es un gráfico** | tiles con tinta de texto; delta con estado | tooltip de la mini-tendencia; «Cómo se calcula» | `KpiTile` ✓ | `estado` (icono+rótulo) y variante `hero`; unidad `duracion` |
| 2 | Solicitudes en el tiempo con éxito/4xx/5xx | **Barras apiladas** por cubo (hora/día) | **estado** (significan bueno/malo), brecha 2 px | crosshair + un tooltip con las tres; clic en cubo → filtra la tabla de endpoints por ventana | `cartesiano` apilado ✓ | brecha 2 px en apiladas; paleta de estado para series que lo declaren (`rol: 'estado'`) |
| 3 | Latencia p50/p95/p99 en el tiempo | **Multilínea** (3 series) + línea de **objetivo** del SLO (markLine sólida, color aviso) | categórica slots 1–3 (pasan all-pairs) o **ordinal** 3 pasos (p50<p95<p99 es orden) → se elige **ordinal** (`color-formula.md` §Categorical or ordinal) | crosshair; `approximate` → tooltip «≥ x ms» | `cartesiano` líneas ✓; MarkLine registrado | `objetivo?: {valor, etiqueta}`; `paleta: 'ordinal'`; API: p50/p99 por cubo |
| 4 | Distribución de latencia | **Histograma** (barras contiguas por cubo `le5…le10000`) | un matiz (slot 1) | tooltip por barra «≥ a y < b: n» | no (cartesiano es categorías) | `tipo: 'histograma'` (bordes de cubo, conteos, 2 px de brecha, 4 px redondeo arriba) |
| 5 | Peticiones por endpoint | **Barras horizontales ordenadas** (top N) **o tabla** si > 7 con significado → **tabla `DataTable`** como principal + barras del top 10 | nominal: slot 1, sin leyenda | `rowActivated` → detalle del endpoint; clic en barra filtra | `DataTable` ✓, `cartesiano horizontal` ✓ | `DimensionFiltro` genérica (`endpoint`, `pantalla`, `dominio`, `codigo`, `metodo`) |
| 6 | Errores agrupados (código, mensaje normalizado, endpoint, `requestId` de ejemplo) | **Tabla** (más de 7 clases) + **barras apiladas** 4xx/5xx por endpoint (top 10) | estado | fila → últimos `requestId`; copiar | `DataTable` ✓ | API (sin endpoint hoy) |
| 7 | Consultas SQL lentas | **Tabla** (sentencia normalizada, n, p95, máx, tabla) + **tile** «lentas desde el arranque» | — / slot 1 en barra de p95 | ordenar; fila → detalle | `DataTable` ✓ | API (`QueryMetricsSnapshot` sin endpoint; sin persistencia → S7 con `asOf`) |
| 8 | Uso por parte de la app (funcionalidad) | **Barras horizontales ordenadas** (≤ 12 funcionalidades) + tabla | nominal slot 1; **énfasis** cuando se elige una (acento + `--text-muted` para el resto) | clic → filtra errores/latencia por funcionalidad | `cartesiano horizontal` ✓ | `enfasis?: string` |
| 9 | Heatmap por pantalla (ruta × hora, o pantalla × métrica) | **Heatmap** de celdas | secuencial continua (`--chart-seq-*`); **ordinal** 4 pasos si la API devuelve niveles (`thermalLevel`) | tooltip por celda; celda = hit target; clic → filtra por pantalla | `mapa-calor` ✓ | `escala: 'continua'|'ordinal'`; leyenda de escala discreta; `--pairs` no aplica |
| 10 | Embudos | **Barras horizontales en orden** (etapas) con % del primer paso; el `funnel` de ECharts queda como alternativa **no** por defecto (forma trapezoidal distorsiona magnitud) | **ordinal** 4 pasos | tooltip con «% del paso anterior» | `partes/embudo` ✓ | `tipo: 'embudo'` con barras ordinales (o `cartesiano horizontal` + `paleta: 'ordinal'`) |
| 11 | Calidad de datos por dominio | **Tiles por dominio** (≤ 6) o **tabla** con **barra segmentada fina** (pasa/aviso/falla) por fila | estado | fila → reglas | `DataTable` ✓ | `app-segmented-bar` (fina 8 px, tall 28 px ≤ 6 partes; CSS, sin ECharts) |
| 12 | Cobertura de catálogo | **Medidor lineal** (misma rampa en pista) + tile «N de M» | ordinal/accent sobre pista `--chart-seq-1` | — | `medidor` (gauge) ✓ | `app-meter` lineal (CSS); el gauge se deprioriza |
| 13 | Deriva (esquema, permisos) | **Tabla** + tile de conteo + **dumbbell** antes→después opcional | 1 matiz, 2 tonos | fila → objeto | `DataTable` ✓ | — |
| 14 | SLO / presupuesto de error | **Medidor lineal** (consumido vs. presupuesto) + **línea vs. línea base** (quemado acumulado contra el presupuesto lineal) | estado en el medidor; divergente para el delta | tooltip | `medidor` gauge ✓ | `app-meter`; `objetivo` en cartesiano; API para la serie |

**Cuándo NO es gráfico** (`choosing-a-form.md` §Is it even a chart): un valor actual → tile; un puñado → fila de tiles; una razón contra un límite → medidor; más de ~7 clases → tabla. Ninguna dona de 2 porciones, ningún eje doble (dos magnitudes = dos gráficos, `reporting.types.ts:102` ya lo dice).

### 3.2 Especificaciones de marca (`marks-and-anatomy.md`) aplicadas a ECharts

- Barra ≤ 24 px: `barMaxWidth: 24` (hoy 28, `builder.ts:50`); 4 px redondeados en el extremo de dato, recto en la base ✓ (`:52`).
- Brecha de superficie 2 px entre fills contiguos y segmentos apilados: `itemStyle.borderColor = tema.superficie, borderWidth = 1` en **todas** las barras (apiladas incluidas) y en histograma; dona y heatmap ya lo hacen (`:212,291`).
- Línea 2 px ✓; marcador ≥ 8 px (`symbolSize: 8`, hoy 7) con **anillo de superficie 2 px** (`itemStyle.borderColor = superficie, borderWidth = 2`, como `sparkline.ts:77`).
- Área ~10 % (`areaStyle.opacity 0.10`, hoy 0,14).
- Rejilla y ejes: hairline **sólida** `--border-default` (`splitLine.lineStyle.type = 'solid'`, hoy `dashed` en `:112`, `cascada.ts:109`, `velas :147`).
- Leyenda: para ≥ 2 series siempre; ≤ 4 series también rótulo directo en el extremo (`label.show` sólo en el último punto / extremo). **Conflicto**: ADR-0017 punto 3 exige leyenda **aun con una serie**; la skill dice que una sola serie **no** lleva caja (el título la nombra) → decisión del usuario (§9).
- Rotular selectivamente (extremo, máximo, la serie de la historia); nunca un número en cada punto; el texto **siempre con tokens de texto**, nunca el color de la serie (ya cumple: `label.color = tema.texto`).
- Cifra héroe: una por vista, ≥ 48 px, `--font-body`, figuras proporcionales; `tabular-nums` sólo en tablas/ejes.
- Textura (decal) sólo bajo `prefers-contrast: more` / `forced-colors` / impresión (`@media print` → releer tema).

### 3.3 Interacción (`interaction.md`)

- Crosshair en líneas/áreas (`axisPointer: 'line'` ✓) y tooltip de **todas** las series en esa X ✓ (`trigger: 'axis'`); en barras/celdas la marca es el blanco (`axisPointer: 'shadow'` ✓, celda ✓).
- Nombres de serie/categoría son **datos no confiables**: hoy el tooltip concatena HTML con `escapar()` (`common.ts:29-35`) — se mantiene y se prueba con `<script>` en una categoría (H2).
- **Una fila de filtros encima de todo**, nunca dentro de una tarjeta de gráfico: la cabecera del portal lleva rango (hoy · 24 h · 7 d · 30 d · personalizado), zona horaria y frescura; cada pestaña **no** tiene su propio rango (si lo necesitara, «es otro dashboard»). Filtros de dimensión (endpoint, pantalla, funcionalidad) como chips, con «Quitar» y anuncio `aria-live` (patrón de `report-filter-bar.html:33-53`).
- **Recarga sin salto**: al refrescar, el widget conserva el render anterior a opacidad reducida (`.gp--refrescando`), sin esqueleto ni salto. Encaja con S7: `stale(datosAnteriores, asOf)` mientras llega lo nuevo.
- Blanco de impacto ≥ 24 px: en heatmaps con muchas columnas `minCell` 24 px y, por debajo, tabla.

### 3.4 Extensiones concretas al `chart-panel` (lista cerrada para H2)

1. `UnidadValor` + `{ tipo: 'duracion' }` (ms → «1,2 s»/«850 ms») en `reporting.types.ts:18-22` y `reporting-format.ts` (formato **no leído**: verificar `formatearValor`).
2. `DimensionFiltro` genérica: unión ampliada (`'endpoint' | 'pantalla' | 'funcionalidad' | 'dominio' | 'codigo' | 'metodo' | 'organizacion' | 'hora'`) o `string` con etiqueta provista por el spec (`ETIQUETA_DIMENSION` hoy es un `Record` cerrado, `chart-panel.ts:110`).
3. Brecha 2 px en barras apiladas e histograma (`borderColor` superficie); `barMaxWidth 24`; marcador 8 px con anillo; área 0,10; rejilla sólida (los cuatro constructores).
4. `tipo: 'histograma'` (`{ bordes: number[], conteos: (number|null)[], unidadBorde }`), barras contiguas, 4 px arriba, tooltip «≥ a y < b».
5. `paleta?: 'categorica' | 'ordinal' | 'estado'` por gráfico y `rol?: 'exito'|'aviso'|'error'` por serie: el builder elige `tema.serie`, `tema.ordinal[]` (nuevo, `--chart-ord-1..4`) o `tema.estado` (`--st-*-bd`), **sin mezclar** en un mismo gráfico (lo valida `getContractViolations`).
6. `enfasis?: string` en cartesiano: la serie nombrada con slot 1 y las demás con `--text-muted` al 60 %.
7. `objetivo?: { valor: number; etiqueta: string }`: `markLine` sólida en color aviso, rótulo con texto de tema (MarkLine ya registrado).
8. `anotaciones?: { en: string; etiqueta: string }[]` (despliegues, incidentes) como `markLine` vertical sutil con tooltip.
9. `mapa-calor.escala?: 'continua' | 'ordinal'` + `visualMap` `piecewise` de 4 piezas con los tokens ordinales; leyenda de escala con rótulos de rango.
10. `[plano]` (input booleano) en `ChartPanel`: sin borde/sombra/radio propio cuando vive dentro de la tarjeta con pestañas (regla §5 + `tokens.md` §Radios).
11. `[refrescando]`: opacidad 0,6 del lienzo y `aria-busy`, manteniendo el render anterior.
12. Leyenda: `show` según decisión §9 (si se mantiene la ADR, también `data` explícita para 1 serie).
13. `KpiTile`: `estado?: 'bueno'|'aviso'|'serio'|'critico'` (icono + rótulo + `--st-*`), `variante: 'hero'` (≥ 48 px, uno por vista), unidad `duracion`.
14. Nuevos átomos/moléculas **sin ECharts**: `app-meter` (medidor lineal, pista del mismo matiz) y `app-segmented-bar` (fina 8/4 px, alta 28 px ≤ 6 partes con cifra dentro si cabe).
15. `chart-theme.ts`: leer `--chart-ord-1..4`, `--st-warning-fg`, `--st-*-bd`; prueba que compara `SERIE_TOKENS`/`RAMPA_TOKENS`/`ORDINAL_TOKENS` con `src/styles.css` (como `design-tokens.types.spec.ts`).
16. Prueba de paleta en el repo: `scripts/check-chart-palette.mjs` que importa `validate()`/`validateOrdinal()` del script de la skill **copiado** a `scripts/lib/validate_palette.js` (MIT/Color.js, licencia en cabecera) y falla si la categórica no pasa adyacente en ambos modos contra `--bg-surface` o si la ordinal falla; se suma a `gates:diseno` (`package.json:35`).
17. `check-contrast.mjs`: pares nuevos `--chart-1..8` vs `--bg-surface` (3:1, con lista de relevo declarada) y `--chart-ord-*`.

### 3.5 Anti-patrones a vigilar en revisión (`anti-patterns.md`, con dónde mirar)

Eje doble (prohibido por tipo) · recolorear al filtrar (el color sigue a la entidad: `enfasis`/`seleccion` atenúan, nunca reasignan) · 9.º matiz (fold a «Otros») · juzgar CVD a ojo (correr el gate) · rampa de valor sobre categorías nominales (endpoints por valor ❌) · arcoíris · matiz en el punto medio divergente · color de estado como «serie 4» · 8 matices cuando la historia es un número (tile) · dona de 2 porciones · > 7 clases con color (tabla) · bloques saturados, rejilla gruesa, **rejilla punteada** (`builder.ts:112`) · número en cada punto · borde para separar (brecha) · rótulo recortado (`overflow: hidden`) · contenedor con alto que excluye el eje X (`alto` incluye la banda del eje; hoy `grid.bottom 56` + `containLabel`) · display/serif en la cifra (Poppins ❌) · `tabular-nums` en cifra grande · textura por defecto · tooltip como único camino (tabla ✓) · blancos de impacto de punta de alfiler · filtros por gráfico · esqueleto al refrescar · sin tabla.

---

## 4. Arquitectura frontend del panel

### 4.1 Shell del portal («portal propio», precedente `insights-portal.route.ts`)

- Ruta `/observability` fuera del armazón de administración, `canActivate: [authGuard, seccionRolesGuard]` con `data[ROLES_ROUTE_DATA] = ROLES_OBSERVABILIDAD` (= `OPS_READ_ROLES` ∪ `ANALYTICS_READ_ROLES` ∪ `SUPERADMIN`; la API autoriza por endpoint y cada pestaña puede caer en S5 por su cuenta, como ya hace `measurement`). `loadComponent` shell + `loadChildren`. **Supuesto**: portal nuevo y no reemplazo in situ de `/superadmin/observability` (que redirige al área «Sistema»); decisión §9.
- Cabecera (una fila, `interaction.md`): **rango temporal global** (`SegmentedControl` hoy · 24 h · 7 d · 30 d + «Personalizado» con `DatePicker` existente en `organisms/date-picker`), **zona horaria** (`UTC` ↔ `America/La_Paz`; la API agrega en UTC, `TrafficWindow.timezone: 'UTC'` → la conversión es sólo de presentación y se dice), **frescura** («Último dato volcado 14:32 UTC · hace 3 min», de `measured.lastDataAt`; > 2 ciclos de volcado sin dato → S7 en los widgets de tráfico), botón **Actualizar**, **conmutador de organización OPCIONAL** (`TenantSwitcher` con opción «Todas las organizaciones» por defecto; visible sólo para `ROLES_PLATAFORMA`; manda `X-Tenant-Id` **sólo** cuando se elige una — nunca por cuerpo; afecta a los widgets que la API acote por tenant, los demás lo dicen con «alcance plataforma»).
- Estado del contexto en un store `providedIn: 'root'` propio (`features/observability/state/observability-context.store.ts`): `rango`, `desde/hasta`, `zonaHoraria`, `organizacion | null`, `filtros` (chips). **Sincronizado con la URL** (`?rango=24h&tz=utc&endpoint=…`) para que una captura sea reproducible y un enlace comparta la vista.
- Navegación lateral por áreas (igual que `portal-shell.html:1-38` e `insights-shell`): **Sistema · Uso y errores de la app · Catálogo · Gobierno · Auditoría · Operación**; en móvil, cajón. Enlace de vuelta a `/portal-selector`.

### 4.2 Cada área = UNA tarjeta con pestañas, a lo ancho (composition-rules §5)

```
<app-page-header …/>                         ← título, subtítulo, migas
<app-card variant="outlined" padding="md">   ← la ÚNICA tarjeta elevada de la pantalla
  <app-tabs [(selectedIndex)]="pestana">     ← índice en señal, también en la URL (?pestana=)
    <app-tab label="…">
      <fila de tiles>                        ← KpiTile (plano)
      <grilla de widgets>                    ← ChartPanel [plano], DataTable, app-meter…
    </app-tab>
  </app-tabs>
</app-card>
```

- Pestañas por área (cada una es un widget set con su propio `ViewState`):
  - **Sistema**: Resumen · Latencia · Endpoints · Errores · Base de datos · No medido.
  - **Uso y errores de la app**: Por funcionalidad · Mapa de calor · Embudos · Errores de cliente · Sesiones.
  - **Catálogo**: Cobertura · Objetos · Deriva de esquema · Linaje · Glosario.
  - **Gobierno**: Calidad por dominio · Clasificación/PII · Políticas · Deriva de permisos · Residencia y retención.
  - **Auditoría**: Bitácora · Accesos a datos · Anomalías.
  - **Operación**: SLO y presupuesto · Incidentes · Despliegues · Preparación · Copias.
- **Cómo se mide (§5, con navegador)**: `holgura_izq − holgura_der` del bloque respecto de `.app-main__inner` ≤ 2 px y `ancho_bloque ≥ 85 %` del área; sin `max-inline-size` propio; columnas 1 / 2 / 3 según 780 / 1120 px; **nunca** tarjetas apiladas donde cabe una con pestañas; `ChartPanel` dentro va `[plano]`.
- Grilla de widgets: `grid-template-columns: repeat(auto-fit, minmax(min(100%, 28rem), 1fr))`; `ancho: 'completo'` ocupa la fila; huérfano a ancho completo (`tab-layout.ts`).

### 4.3 Acceso a datos: `core/data-access/<dominio>/` por área

- Un cliente tipado por dominio API, **sin lógica de presentación**: `ops-traffic` (existe), `ops-console` (existe en `platform.client.ts:186`), `telemetry-analytics` (existe `WebAnalyticsClient`), `data-catalog` y `portal` (existen), `audit` (existe), **nuevos**: `ops-errors` (errores agrupados), `ops-db` (SQL lentas), `ops-slo-series`, `telemetry-heatmap` (clics por ruta), `governance-quality` — todos **espejo del contrato que publique el frente API** (`contratos/` de esa franja), con `notMeasured[] {metric, reason}` y `lastDataAt | null` en cada respuesta.
- Regla `null ≠ 0` en el tipo: todo KPI es `number | null`; `successRatio: null` cuando 0/0 (ya en `ops-traffic.types.ts:58`).
- `requestId`: `errorToViewState` ya lo saca de `correlationId`; el widget en S9 lo muestra y ofrece «Copiar» y, en el área Sistema, un enlace a «Errores» filtrado por ese id (cuando exista el endpoint).
- Prefijos nuevos de API → `proxy.conf.json` y `check-route-prefixes.mjs`/`check-client-prefixes.mjs` (regla de prefijos inequívocos, `proxy.conf.json:_comentario`).

### 4.4 Nueve estados **por widget**, no por página

- Cada widget (tile, gráfico, tabla) recibe su `ViewState<T>` y lo pinta con `ViewStateHost` (o `DataTable[state]`, que lo monta por dentro). Una pestaña con un 403 en un widget no apaga a los demás (patrón de `measurement`, `navigation.platform.ts:106-108`).
- S1 lo resuelve el guard del portal (autorizar antes de pedir); S2 esqueleto del alto final (sin salto); S3 `empty` con `nextAction` concreta («Encienda `OBSERVABILITY_HTTP_SLI_ENABLED`», «Amplíe la ventana», «Registre el esquema de evento `ux_interaccion`»); S4 para rangos inválidos (`VALIDATION_FAILED`); S5 cuando la API niega el rol (mensaje «no tiene permiso para esta lectura», sin ocultar la pestaña); S6 para `/objects/:id` inexistente (sin filtrar existencia); **S7** cuando `lastDataAt` es más viejo que `2 × OBSERVABILITY_HTTP_SLI_FLUSH_SECONDS` o cuando se refresca (datos previos + `asOf`); S8 offline con reintento; S9 con `requestId` visible.
- `notMeasured` **no** es un estado M34: es contenido («No medido (no es cero)») que se lista en su pestaña y como nota al pie del widget afectado.

### 4.5 Rutas sin engordar `app.routes.ts`

- Archivo propio `src/app/features/observability/observability-portal.route.ts` (función `observabilityPortalRoute(chunkFallido)`, patrón `insights-portal.route.ts:22-34`) + `observability.routes.ts` (hijas por área: `sistema`, `uso`, `catalogo`, `gobierno`, `auditoria`, `operacion`, con `?pestana=`). En `app.routes.ts` se agrega **una** línea junto a `insightsPortalRoute(chunkFallido)` (`:1844`) y una redirección `superadmin/observability → /observability/sistema` (si se decide §9). Neto ≤ +3 líneas; el gate ya falla hoy por 2 564 > 2 273: **no se sube el techo**; se registra en el reporte que el delta de esta franja es ≤ 3 líneas.
- `RenderMode.Client` para `/observability/**` en `app.routes.server.ts` (ECharts necesita DOM; precedente `reporting.routes.ts:53-81`).
- Sección en `navigation.platform.ts` para menú/migas (`path: 'observability'`, roles = `ROLES_OBSERVABILIDAD`), tarjeta en `portal-selector` y `entryDestination` (`reporting-access.ts:116-125`): el panel pasa a ser el destino de `PLATFORM_ADMIN`.

### 4.6 Simulador para desarrollo, evidencia sólo contra API real

- `core/mock/handlers/observability.*.handlers.ts` con las **mismas reglas** que la API (como `ops-traffic.handlers.spec.ts:8`), para `yarn start:demo` y Vitest. **Ninguna captura del simulador vale como evidencia** (sello «Datos de prueba» visible; `check-mock-vs-client.mjs` vigila la paridad).

### 4.7 i18n/`usted`, accesibilidad, responsive

- Textos en español de usted (`scripts/check-usted.mjs`), identificadores en inglés (`check-english-identifiers.mjs`), fechas `es-BO`.
- WCAG 2.2 AA: cada gráfico `role="img"` + `resumenAccesible` con la conclusión; tabla equivalente; foco visible (`--focus-ring`); pestañas con activación manual; tooltips también en foco (ECharts `triggerOn`); contraste 4,5:1 texto / 3:1 marcas o relevo; `prefers-reduced-motion` (ya); `prefers-contrast: more` → decal; objetivo táctil ≥ 24 px (`2.5.8`).
- Responsive: móvil (390) una columna, pestañas desplazables (ya `Tabs.medirDesborde`), tablas apiladas (`stackedOnMobile`), rótulos rotados por `media` del lienzo; tablet (768/1024) dos columnas; escritorio (1440) tres. Sin desplazamiento horizontal de página.

---

## 5. Protocolo de evidencia «funciona de verdad»

Lo que faltó antes (`docs/trabajo/2026-10-30-reporteria-comercial-alovida/REPORTE.md:1-15`): maqueta con datos de ejemplo, `pw:rutas`/`pw:accesos` bloqueados, revisión visual no repetida. Acá cada afirmación de «funciona» sigue **UI → request → response → persistencia → recarga → UI** contra la API real con Postgres.

### 5.1 Levantar la API real con Postgres local

1. En `mantra-core-health-api/`: `.env` desde `.env.example` con `POSTGRES_*`, `DB_HOST=postgres` (desde contenedor) o `localhost`/`POSTGRES_PORT` (5433 por defecto si no se fija, `docker-compose.yml:354`), `OBSERVABILITY_HTTP_SLI_ENABLED=true`, `OBSERVABILITY_HTTP_SLI_FLUSH_SECONDS=10` (mínimo permitido, `.env.example:389-390`; acorta la espera de la evidencia; **en el contenedor el default es `ENABLED=false`**, `docker-compose.yml:273-274`, así que hay que declararlo en el `.env`), `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` (opt-in, default vacío, `docker-compose.yml:158-159`).
2. `docker compose --profile local-db up -d postgres postgres-init` (`docker-compose.yml:328-392`; `postgres-init` aplica `database/SQL/apply_all.sql` → `apply_deferred` → parches → `time_series`/`vector_rag`, `docker/db-init/init-postgres.sh:1-40`); esperar a que termine antes de la API.
3. API: `yarn docker:up` (o `yarn start:dev` en el host con `DB_HOST=localhost DB_PORT=5433`). Puerto 3000 (`.env.example:9`).
4. **Cuentas**: el único seed con rol de plataforma encontrado es el **administrador de arranque** (`src/common/seed/bootstrap-admin-seed.service.ts:190-192` crea `SECURITY_ADMIN`; `:207-235` le concede `SUPERADMIN` global, comodín en la API `roles.guard.ts:82-86` y en el front `rolesAlcanzan`). **No hay** seed con `PLATFORM_ADMIN` en `docker/`, `database/`, `scripts/` ni `tools/` (grep vacío). Para probar el rol exacto `PLATFORM_ADMIN` hay que crearlo por API (`POST /iam/users` + rol) en el paso de carga (5.3) — y además una cuenta **sin** roles de lectura (p. ej. la doctora de `tools/alovida/seed-dev-data.mjs`) para el S5 real. Los `tools/e2e/*` exigen `APP_ENV=e2e`, `ALLOW_E2E_SEED=true` y `DB_NAME` con `e2e|test` (`tools/e2e/entorno.mjs:73-92`).
5. Comprobación: `GET /health` 200 (`support/actores.ts:66-72 apiViva`) y `GET /admin/ops/traffic` con el token del admin → 200 con `measured.requests` (puede ser 0 al inicio).

### 5.2 Front contra la API real (no simulador)

- `yarn start:real-api` (`package.json:18`) → `ng serve --configuration real-api` → `environment.real-api.ts` (`mockBackend: false`, `designMockups: false`), proxy `proxy.conf.mjs` + `proxy.conf.json` con `BACKEND_ORIGIN` apuntando a `http://localhost:3000` (lo genera `scripts/generate-env.mjs`; **verificar la variable exacta en ese script**: no leído entero). `node scripts/check-real-api-config.mjs` debe salir 0.
- Nunca `forcedRealApi` (es del visor, `api-mode.ts:25`) ni `start:demo`.
- Comprobación: en la pestaña Red del navegador las peticiones a `/admin/ops/*` salen por el proxy y traen `x-request-id`; no hay sello «Datos de prueba».

### 5.3 Script de carga conocida (`evidencia-dataviz/` sólo salidas; el script vive en `playwright/support/` o `scripts/`)

`playwright/support/observabilidad-carga.ts` (ejecutado por el spec antes de medir), con un `RUN` único:

| Lote | Petición | Esperado en el panel |
|---|---|---|
| A | 40 × `GET /admin/ops/readiness` con token admin | +40 solicitudes, +40 exitosas, endpoint `GET /admin/ops/readiness` ≥ 40 |
| B | 12 × `GET /no-existe-<RUN>` | +12 4xx agregados en `UNMATCHED` (`healthchecksExcluded`/`unmatchedAggregated` lo explican) |
| C | 6 × `GET /admin/ops/traffic` con el token de la doctora | +6 4xx (403) y, en la UI de la doctora, **S5 real** |
| D | 5 × `POST /iam/auth/login` con cuerpo inválido | +5 422 (ojo: límite 10/min/IP → espaciar) |
| E | 3 × `GET /admin/ops/traffic?from=no-es-fecha` | +3 400/422 → en la UI con ese rango, **S4 real** |

Luego esperar `FLUSH_SECONDS + 5` s. **Persistencia**: `psql` contra `service_sli_series` (módulo `time_series`, `api/src/modules/time_series/services/series-query.service.ts`; tabla exacta **no verificada**: confirmar esquema `58_time_series` en `mantra-core-health-model/SQL`) y guardar `SELECT count(*), max(bucket)` en `evidencia-dataviz/persistencia-<RUN>.txt`. **Recarga**: `page.reload()` y volver a leer los mismos `data-testid`.

### 5.4 Playwright (`playwright/observabilidad-gobierno-api-real.spec.ts`)

- `test.skip(!E2E_API_REAL)` con el mismo texto «No es un verde» (`altas-api-real-tres-escenarios.spec.ts:31`). `workers: 1`. **Sin `networkidle`** (HMR: `CLAUDE.md` §5): esperar `expect(getByTestId(...)).toHaveText(...)` con `timeout`.
- Secuencia: `entrar()` como admin de plataforma → `expect(page).not.toHaveURL(/auth\/organization/)` aunque la cuenta tenga ≥ 2 tenants (**depende de la corrección de `needsTenantSelection` del frente de acceso**; si no está, el spec lo documenta como `BLOQUEADO`, no lo rodea) → aterriza en `/observability/sistema` → por cada área y pestaña: `data-testid` estables (`obs-area-<area>`, `obs-tab-<pestana>`, `obs-kpi-<id>` → `kpi-value`, `chart-<id>`, `tabla-<id>`, `obs-not-measured`), y **conteos esperados** del §5.3 (`requests ≥ 40+12+6+5+3`, fila `GET /admin/ops/readiness` con `requests ≥ 40`, `UNMATCHED ≥ 12`, 4xx ≥ 26).
- Capturas: **3 viewports × 2 temas × estados**: 390×844, 768×1024, 1440×900 (del gate: se omite 1024×768 por economía; se declara) × `data-theme` `light`/`dark` (`document.documentElement.setAttribute('data-theme', …)`, `styles.css:405`) × estados: `ready`, `empty` (rango con 0 peticiones: «hoy» a las 00:01 UTC o ventana futura válida), `forbidden` (doctora), `validation` (rango inválido), `error` (único simulado: `page.route` abortando `/admin/ops/traffic` **una vez**, rotulado «S9 inducido»), `stale` (congelar `FLUSH` y esperar), `loading` (captura al primer frame). Nombre: `evidencia-dataviz/capturas/<area>-<pestana>-<viewport>-<tema>-<estado>.png`.
- Medición §5 en el spec: `boundingBox` del bloque vs `.app-main__inner` → `|izq − der| ≤ 2` y `≥ 85 %`; `document.documentElement.scrollWidth ≤ clientWidth` (sin scroll horizontal).
- Accesibilidad: `@axe-core/playwright` si está en `devDependencies` (**no verificado**); si no, comprobaciones manuales de foco/teclado (Tab por pestañas, Enter en «Más», Escape).
- **Consola y red**: `page.on('console')` (error/warning) y `page.on('response')` (`url`, `status`, `x-request-id`, duración) a `evidencia-dataviz/consola-red-<RUN>.json`; criterio: cero errores de consola fuera de los estados inducidos; cero 5xx.

### 5.5 Revisión independiente y gates a mano (CI caído)

- `yarn lint` · `yarn typecheck` · `yarn test` (acotado a lo tocado + completo al final) · `yarn build` · `yarn gates:diseno` · `node scripts/check-usted.mjs` · `check-english-identifiers.mjs` · `check-route-prefixes.mjs` · `check-client-prefixes.mjs` · `check-mock-vs-client.mjs` · `check-real-api-config.mjs` · `check-architecture.mjs` · `check-max-lines.mjs` (reportar el delta de `app.routes.ts`) · **nuevo** `check-chart-palette.mjs` · `yarn pw:rutas` · `yarn pw:accesos` (contra la API real).
- `visual-reviewer` sobre las capturas + consola/red (no sobre el diff); `regression-auditor` (mapa archivo → imports → consumidores → rutas → roles → estados; `REGRESSION_VERIFIED` sólo con evidencia); `frontend-reviewer` sobre el diff. Quien implementa no aprueba (`NO_SELF_APPROVAL`).

### 5.6 Formato de `REPORTE.md` (escalera de evidencia)

```
# Reporte — Portal de observabilidad y gobierno (front)
Fecha · Rama · Commits · PRs (dev, test)
## Peldaño alcanzado (uno por fila, con enlace a la evidencia o «no se ejecutó»)
| Pieza | DISCOVERED | TESTED | VERIFIED_FUNCTIONAL_ONLY | REGRESSION_VERIFIED |
| p. ej. Sistema › Resumen | ruta:línea del código | vitest: N pruebas, comando | spec, captura, consola-red, persistencia (psql), recarga | veredicto del regression-auditor + pw:rutas/pw:accesos |
## Validador dataviz (salida íntegra enlazada; paleta final por slot)
## Conteos esperados vs. observados (tabla del §5.3, con RUN)
## Revisión independiente (visual: puntaje y findings; código; regresión) — ninguno «aprobado» sin su salida
## Lo que NO se verificó y por qué · Desvíos del plan · Riesgos residuales · Decisiones pendientes
```
Definiciones: `DISCOVERED` = leído con ruta:línea; `TESTED` = pruebas unitarias/de componente en verde con comando; `VERIFIED_FUNCTIONAL_ONLY` = navegador contra API real con la cadena completa y capturas; `REGRESSION_VERIFIED` = el auditor independiente lo emite con `pw:rutas`/`pw:accesos` y muestra de consumidores. Sin porcentaje de avance inventado: `HECHO/total` de microtareas.

---

## 6. Hitos (CA · DoD · microtareas, estado `TODO`)

### H1 — Paleta y tokens de gráficos conformes a la skill
**CA.** Dado el tema oscuro, cuando se pinta la serie 6, entonces su color da ≥ 3:1 sobre `--bg-surface` y el validador pasa sin WARN. Dado un gráfico ordinal, cuando se piden 4 pasos, entonces existen `--chart-ord-1..4` validados con `--ordinal` en ambos temas.
**DoD.** `node scripts/check-chart-palette.mjs` exit 0 (adyacente claro/oscuro contra `--bg-surface`, ordinal claro/oscuro); `yarn gates:diseno` sin regresión; `design-tokens.types.spec.ts` en verde con los tokens nuevos; ADR-0017 con adenda «validado contra la superficie del proyecto» y enlace a `evidencia-dataviz/`.
- H1.S1.M1 `TODO` Cambiar `--chart-6` oscuro a `#0c960c` en `styles.css` (bloques `:333-334` y `:406-407`).
- H1.S1.M2 `TODO` Agregar `--chart-ord-1..4` (alias de `--chart-seq-2..5`) en los tres bloques; catalogarlos en `core/tokens/design-tokens.types.ts`.
- H1.S1.M3 `TODO` Definir divergente (`--chart-div-neg/-pos/-mid`) como alias de `--chart-1`, `--chart-8`, `--bg-surface-alt` + 2 intermedios; validar cada brazo con `--ordinal`; guardar salida en `evidencia-dataviz/`.
- H1.S2.M1 `TODO` Copiar `validate_palette.js` a `scripts/lib/validate_palette.js` (licencia) y escribir `scripts/check-chart-palette.mjs` (lee `styles.css` como `check-contrast.mjs:45-58`, resuelve `--bg-surface` por tema, falla en FAIL o en WARN de contraste no declarado en `RELEVO`).
- H1.S2.M2 `TODO` Sumar al `gates:diseno` y a `check-contrast.mjs` los pares `--chart-*`/`--chart-ord-*` vs `--bg-surface`.
- H1.S3.M1 `TODO` `chart-theme.ts`: leer `ordinal[]`, `aviso`, `estadoRelleno {exito, aviso, error}`; prueba CSS↔TS.
- H1.S3.M2 `TODO` Adenda a ADR-0017 (superficie del proyecto, topes all-pairs, ordinal, decisión de la leyenda §9) y actualizar `tokens.md` (247 → 247+n) y `CLAUDE.md`/`FABLE_STACK.md` («188 tokens» desactualizado).

### H2 — Extensiones del `chart-panel` y tiles (lista §3.4)
**CA.** Dado un `ChartSpec` con `paleta: 'estado'` y una serie sin `rol`, cuando se construye, entonces `getContractViolations` lo rechaza. Dado un cartesiano apilado, cuando se renderiza, entonces cada segmento tiene borde de 1 px color superficie (2 px de brecha) y la rejilla es sólida. Dado `tipo: 'histograma'`, cuando se pasan bordes `[0,5,10,…]`, entonces las barras son contiguas con brecha de 2 px y el tooltip dice el rango.
**DoD.** Vitest en `chart-option.builder.spec.ts`, `chart-panel.spec.ts`, `kpi-tile.spec.ts` y nuevos `meter.spec.ts`, `segmented-bar.spec.ts` (sin bajar ninguna prueba: `NO_TEST_WEAKENING`); prueba de inyección (`<img onerror>` como nombre de categoría → escapado); captura en el stock de componentes de los 6 tipos en claro/oscuro; `frontend-reviewer` sin HIGH.
- H2.S1.M1 `TODO` `UnidadValor 'duracion'` + `formatearValor` (ms/s) + pruebas.
- H2.S1.M2 `TODO` `DimensionFiltro` genérica + `ETIQUETA_DIMENSION` abierta (etiqueta en el spec).
- H2.S2.M1 `TODO` Marcas: brecha 2 px en apiladas, `barMaxWidth 24`, marcador 8 + anillo, área 0,10, rejilla sólida en los cuatro constructores.
- H2.S2.M2 `TODO` `paleta` por gráfico y `rol` por serie; validación en el contrato (no mezclar).
- H2.S2.M3 `TODO` `enfasis`, `objetivo`, `anotaciones` (MarkLine).
- H2.S2.M4 `TODO` `tipo: 'histograma'` + tabla alterna + CSV.
- H2.S2.M5 `TODO` `mapa-calor.escala 'ordinal'` con `visualMap piecewise` y leyenda de rangos.
- H2.S3.M1 `TODO` `[plano]` y `[refrescando]` en `ChartPanel` (CSS + `aria-busy`).
- H2.S3.M2 `TODO` Leyenda según decisión §9 (D-1).
- H2.S4.M1 `TODO` `KpiTile`: `estado` (icono+rótulo), `variante 'hero'`, `duracion`.
- H2.S4.M2 `TODO` `app-meter` (lineal, pista del mismo matiz, `aria-valuenow`) y `app-segmented-bar` (fina/alta, legend de nombres, tabla alterna) en `shared/components/molecules/`.

### H3 — Shell del portal, rutas propias, contexto global y guards
**CA.** Dado `PLATFORM_ADMIN` con dos organizaciones, cuando entra, entonces aterriza en `/observability/sistema` sin pasar por `/auth/organization` (**depende del frente de acceso**: `session.store.ts:227`, `auth.guard.ts:36`, `login.ts:220`). Dado el rango «24 h» y zona `America/La_Paz`, cuando se cambia, entonces la URL lo refleja y **todos** los widgets repiden con la misma ventana. Dado un rol sin lectura de ops, cuando abre el área Sistema, entonces el widget muestra S5 con el mensaje de la API y las demás pestañas siguen vivas.
**DoD.** `observability-portal.route.ts` + `observability.routes.ts`; `app.routes.ts` crece ≤ 3 líneas (medido con `check-max-lines --lista`); `RenderMode.Client`; sección en `navigation.platform.ts`; tarjeta en `portal-selector`; `entryDestination` actualizado con prueba; `pw:rutas` y `pw:accesos` verdes contra la API real; medición §5 en las 6 áreas ≤ 2 px / ≥ 85 %.
- H3.S1.M1 `TODO` `features/observability/shell/` (cabecera: rango, tz, frescura, actualizar, `TenantSwitcher` opcional «Todas»), nav lateral, cajón móvil, enlace al selector.
- H3.S1.M2 `TODO` `state/observability-context.store.ts` sincronizado con query params (`rango`, `desde`, `hasta`, `tz`, `org`, `pestana`, filtros).
- H3.S2.M1 `TODO` Archivos de rutas + una línea en `app.routes.ts` + redirección de `superadmin/observability` (según D-3).
- H3.S2.M2 `TODO` `ROLES_OBSERVABILIDAD` en `reporting-access.ts` (o `observability-access.ts`), `entryDestination`, `portal-selector`, `navigation.platform.ts`.
- H3.S3.M1 `TODO` Plantilla de área: `PageHeader` + `Card` + `Tabs`, grilla de widgets, `ChartPanel [plano]`.
- H3.S3.M2 `TODO` Prueba Playwright de la medición §5 (holgura y 85 %) en 3 viewports.

### H4 — Área Sistema (resumen, latencia, endpoints, errores, base de datos, no medido)
**CA.** Dada la carga del §5.3 y el volcado cumplido, cuando se abre Resumen, entonces `obs-kpi-requests` ≥ 66 y el gráfico apilado muestra 4xx ≥ 26 en la ventana; cuando se abre Endpoints, entonces la fila `GET /admin/ops/readiness` tiene `requests ≥ 40`; cuando no hay cubos con p50/p99 (API sin ampliar), entonces el widget de latencia muestra S3 con próxima acción («la API no publica p50/p99 por intervalo») y **no** inventa la serie.
**DoD.** Clientes `ops-traffic` (existente) y nuevos (`ops-errors`, `ops-db`) con `*.client.spec.ts`; Vitest de cada pestaña con los 9 estados; spec Playwright contra API real con conteos; capturas 3×2×estados; consola/red limpias.
- H4.S1.M1 `TODO` Resumen: tiles (solicitudes, exitosas, fallidas, p95 con `≥`, usuarios activos) + héroe «tasa 5xx» + barras apiladas por cubo (estado) + nota `lastDataAt`.
- H4.S1.M2 `TODO` Latencia: multilínea ordinal p50/p95/p99 + objetivo SLO + histograma (cuando la API publique cubos; mientras, S3 con motivo).
- H4.S1.M3 `TODO` Endpoints: `DataTable` (existente `observability.html:78-90`) + barras top 10 nominales + filtro por clic.
- H4.S1.M4 `TODO` Errores: tabla agrupada + apiladas 4xx/5xx por endpoint (contrato del frente API; S3 hasta entonces).
- H4.S1.M5 `TODO` Base de datos: tiles + tabla de sentencias lentas (contrato API; S7 con `asOf` por ser en memoria).
- H4.S1.M6 `TODO` No medido: lista (ya en `observability.html:126-140`), reutilizar `NO_MEDIDO` (`observability.ts:44-52`).
- H4.S2.M1 `TODO` Retirar/redirigir `features/admin/observability` según D-3 (o dejarlo como vista «clásica»).

### H5 — Área Uso y errores de la app
**CA.** Dado el agrupador por funcionalidad, cuando se elige «Agenda», entonces las barras aplican énfasis (acento + gris) sin recolorear a las demás y Errores/Latencia se filtran por esa funcionalidad. Dado el heatmap con `metric=errors`, cuando una celda no tiene muestra suficiente, entonces se pinta neutra y dice «Sin dato» (no cero).
**DoD.** Igual que H4 + prueba de que el filtro no cambia los colores de los sobrevivientes (anti-patrón recolor-on-filter).
- H5.S1.M1 `TODO` Por funcionalidad: barras horizontales nominales + énfasis + tabla (`measurement-groups.ts`).
- H5.S1.M2 `TODO` Mapa de calor: `mapa-calor` por pantalla × hora (clics, cuando exista `/admin/analytics/heatmap?route`) y por campo × métrica (`/onboarding/heatmap`, hoy), `escala 'ordinal'` si la API da niveles.
- H5.S1.M3 `TODO` Embudos: barras ordinales (sin trapecio) + % del primer paso + tabla.
- H5.S1.M4 `TODO` Errores de cliente y Sesiones: tabla + tiles (`/admin/analytics/*`; requiere alcance plataforma en la API: hasta entonces, con la organización elegida y aviso «alcance organización»).

### H6 — Áreas Catálogo y Gobierno
**CA.** Dado `GET /admin/catalog/coverage`, cuando se abre Cobertura, entonces el `app-meter` muestra «N de M» y la pista del mismo matiz; dado un dominio sin reglas de calidad, entonces su fila dice «sin dato» con motivo. Dado `permission-drift`, cuando hay deriva, entonces la tabla la lista con enlace al objeto.
**DoD.** Clientes existentes (`data-catalog.client.ts`, `portal.client.ts`) reutilizados; nuevos sólo si el frente API publica; Vitest + Playwright + capturas.
- H6.S1.M1 `TODO` Catálogo: Cobertura (meter + tiles), Objetos (tabla, `objects/:id` → S6 real), Deriva (`catalogo/deriva`), Linaje (`linaje`, tabla; el grafo queda en `admin/portal`), Glosario.
- H6.S2.M1 `TODO` Gobierno: Calidad por dominio (tabla + barra segmentada fina pasa/aviso/falla), Clasificación/PII (`classification/run` sólo lectura de resultados), Políticas (tabla; S3 hasta endpoint), Deriva de permisos, Residencia/retención (system_ops; S3 hasta endpoint).

### H7 — Áreas Auditoría y Operación
**CA.** Dado `GET /audit/log` paginado por cursor, cuando se avanza, entonces `cursorChanged` repide y la URL conserva filtros; dado un SLO con medición, cuando se abre, entonces el meter muestra consumido/presupuesto con estado e icono+rótulo.
**DoD.** Igual que H4.
- H7.S1.M1 `TODO` Auditoría: Bitácora y Accesos a datos (`DataTable` con cursor), Anomalías (S3 hasta endpoint).
- H7.S2.M1 `TODO` Operación: SLO y presupuesto (meters + línea vs. base cuando haya serie), Incidentes, Despliegues (anotaciones en las series del área Sistema), Preparación, Copias.

### H8 — Evidencia «funciona de verdad» y revisión independiente
**CA.** Dado el entorno §5.1-5.2 y la carga §5.3, cuando corre el spec, entonces los conteos observados coinciden con los esperados, la persistencia se confirma en Postgres, y tras `reload` la UI muestra lo mismo; dados los revisores, entonces hay veredicto escrito de los tres.
**DoD.** `REPORTE.md` con la escalera §5.6; `evidencia-dataviz/capturas/` (3×2×estados por pestaña), `consola-red-<RUN>.json`, `persistencia-<RUN>.txt`; `visual-reviewer` ≥ 92 sin BLOCKER/CRITICAL/HIGH; `regression-auditor` `REGRESSION_VERIFIED`; gates §5.5 con salida adjunta.
- H8.S1.M1 `TODO` `playwright/support/observabilidad-carga.ts` (lotes A–E, respeto del limitador).
- H8.S1.M2 `TODO` `playwright/observabilidad-gobierno-api-real.spec.ts` (login, sin selección de organización, conteos, capturas, §5, consola/red).
- H8.S1.M3 `TODO` Consulta `psql` de persistencia (tabla confirmada en el modelo) y recarga.
- H8.S2.M1 `TODO` Correr gates §5.5 y guardar salidas en `evidencia-dataviz/gates/`.
- H8.S2.M2 `TODO` Revisión por `visual-reviewer`, `frontend-reviewer`, `regression-auditor`; corregir y **repetir** la revisión (no «se corrigió después»).
- H8.S3.M1 `TODO` `REPORTE.md` según §5.6.

### H9 — Dos PRs (dev y test)
- H9.S1.M1 `TODO` PR hacia `dev` desde la rama de trabajo; H9.S1.M2 `TODO` rama desde `test` con cherry-pick de los commits de la franja → PR hacia `test` (`CLAUDE.md` §Git). El flujo termina en abrir los PR.

**Orden:** H1 → H2 → H3 → (H4 ‖ H5 ‖ H6 ‖ H7, archivos disjuntos por área si se autoriza paralelo) → H8 → H9. H4–H7 dependen de contratos del frente API (`contratos/` de esa franja) y del frente de acceso (tenant).

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| La API no publica p50/p99 por cubo, errores agrupados, SQL lentas, heatmap por ruta ni series de SLO (hoy no existen) | Widgets en S3 con próxima acción real; contratos primero (modelo → `gen_entities.py` → API); nunca datos de ejemplo. |
| `/admin/analytics/*` exige tenant (`requireTenantId`) | Conmutador de organización opcional como puente; pedir alcance plataforma al frente API. |
| Regla de selección de organización (`needsTenantSelection`) la corrige otro frente | El spec lo exige; si no está, `BLOQUEADO` explícito, no rodeo. |
| `check-max-lines` ya falla (123 archivos) | Delta de `app.routes.ts` ≤ 3 líneas, archivo de rutas propio; se reporta el estado previo. |
| Tarjeta dentro de tarjeta con `ChartPanel` | `[plano]` (H2.S3.M1). |
| Leyenda con 1 serie: ADR vs skill | Decisión D-1 antes de H2.S3.M2. |
| Volcado cada 60 s hace lenta la evidencia | `OBSERVABILITY_HTTP_SLI_FLUSH_SECONDS=10` sólo en el entorno de evidencia. |
| Límite de login 10/min/IP | Un solo trabajador, reintento único ante 429 (`sesion.ts`). |
| Dos sistemas de gráficos (`insights/charts` SVG) | Deuda registrada; el panel usa sólo `ChartPanel`. |
| `pdf-export` sobre SVG de ECharts no verificado | Probar en H2 o excluir PDF del alcance (CSV y tabla cubren la exportación). |

## 8. Ambigüedades y supuesto tomado

| Ambigüedad | Supuesto |
|---|---|
| ¿Portal nuevo `/observability` o rehacer `/superadmin/observability`? | Portal propio (precedente `/insights`), con redirección de la ruta vieja; D-3 lo confirma. |
| ¿Zona horaria por defecto? | UTC (como la API agrega y hoy muestra `observability.html:11`), con conmutador a `America/La_Paz` sólo de presentación. |
| ¿Cuántos viewports? | 3 (390, 768, 1440) de los 4 del gate; se declara la omisión de 1024×768. |
| ¿El estado S9 se puede inducir contra la API real? | Sólo una captura con `page.route` abortando, rotulada «inducido»; el resto de estados son reales. |
| ¿Embudo trapezoidal o barras? | Barras ordinales por defecto; `funnel` de ECharts queda disponible. |
| ¿Cuenta con `PLATFORM_ADMIN` exacto? | Se crea por API en la carga; el admin de arranque (`SECURITY_ADMIN`+`SUPERADMIN`) sirve para la lectura por comodín. |
| ¿`service_sli_series` es la tabla a consultar? | Supuesto por `latency-buckets.ts` y `time_series`; confirmar en el modelo antes de H8.S1.M3. |

## 9. Decisiones que necesitan al usuario

- **D-1 Leyenda con una sola serie.** ADR-0017 (punto 3) la exige siempre; la skill `dataviz` dice que una serie **no** lleva caja (el título la nombra). Propuesta: seguir la skill y enmendar la ADR.
- **D-2 Corregir `--chart-6` oscuro a `#0c960c`** (se aparta de la paleta de referencia; mismo matiz, +luminosidad) **o** dejar `#008300` con relevo obligatorio (rótulo/tabla) también en oscuro. Propuesta: corregir.
- **D-3 Dónde vive el panel:** portal propio `/observability` (nav lateral por áreas, destino de `PLATFORM_ADMIN`) con redirección desde `superadmin/observability`, **o** ampliar la pantalla actual dentro del armazón de administración. Propuesta: portal propio.
- **D-4 Conmutador de organización opcional:** «Todas las organizaciones» por defecto para roles de plataforma, visible sólo para `ROLES_PLATAFORMA`; ¿se oculta por completo hasta que la API publique alcance plataforma en `/admin/analytics/*`? Propuesta: visible, con aviso de alcance por widget.
- **D-5 Medidor lineal (`app-meter`) en lugar del gauge semicircular** para cobertura y presupuesto de error. Propuesta: lineal (misma rampa en la pista), gauge deprioritizado.
