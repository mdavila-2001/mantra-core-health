# Brief común para los agentes de la maqueta del portal de reportería

Léelo entero antes de escribir una línea. Es el contrato; lo que no esté aquí, pregunta al
agente principal (no inventes).

## 0. Qué se construye y por qué

Un **portal de reportería** para Alovida, en el frontend (`/home/user/mantra-core-health`,
Angular 21 standalone con señales), como **MAQUETA** con datos de **EJEMPLO** declarados.
Plan completo: `docs/trabajo/2026-10-30-reporteria-comercial-alovida/PLAN.md` (§3 = los KPI
de cada pestaña, §5 = selector de portal y grid, §5.3 = estructura del panel y asistente).

Pedido del solicitante, textual y no negociable:

- Un admin entra y **elige** entre «Portal de administración» y «Portal de reportería».
- El portal de reportería es un **panel integral**; el centro son los **reportes** en un **grid**.
  Un chat/asistente puede ir dentro, **plegable**, pero no es el centro.
- Un **dashboard de ventas ultra completo** con pestañas, con tres verticales:
  suscripciones de doctores, publicidad push y pauteo (**modelada como Meta Ads Manager**:
  campaña → conjunto → anuncio; módulo aún no cerrado), y comisiones a actores.
- Todo lo demás: **lo más recomendado y estándar** de la industria.
- **Cada gráfico** usa la librería oficial (Apache ECharts, ADR-0017) y cumple SIEMPRE:
  1 título · 2 gráfico · 3 leyenda · 4 tooltip · 5 elemento clicable que filtra ·
  6 «cómo se calcula» · 7 versión en velas. Los puntos 5–7 «si corresponde»: solo se omiten
  con un **motivo escrito** (`filtro: null` + `filtroMotivo`, etc.).
- Todo se prueba con **capturas** (las toma y revisa el agente principal, no tú).

## 1. Ya existe (no lo reescribas; léelo)

| Pieza | Ruta | Dueño |
|---|---|---|
| Contrato de datos | `src/app/core/data-access/reporting/reporting.types.ts` | principal |
| Formato (`formatearValor`, `SIN_DATO`) | `.../reporting/reporting-format.ts` | principal |
| Cliente HTTP | `.../reporting/reporting.client.ts` (`ReportingClient.catalogo()`, `.pestana(vertical, contexto)`) | principal |
| Etiquetas | `.../reporting/reporting-labels.ts` | principal |
| Servidor simulado + catálogo del grid | `src/app/core/mock/handlers/reporting.handlers.ts` | principal |
| Utilidades de datos de ejemplo | `src/app/core/mock/handlers/reporting/reporting-dataset.util.ts` | principal |
| **`ChartPanel`** (`<app-chart-panel [spec] [seleccion] (filtroCambia)>`) | `src/app/shared/components/organisms/chart-panel/` | principal |
| Estado compartido (periodo, comparar, moneda, alcance, filtros) | `src/app/features/reporting/state/report-context.store.ts` | principal |
| Tokens `--chart-1..8`, `--chart-seq-1..5` | `src/styles.css` | principal |

Si crees que hay un defecto en un archivo del principal, **no lo edites**: descríbelo en tu
informe final con archivo, línea y propuesta.

## 2. Propiedad de archivos (disjunta: solo escribes lo tuyo)

| Agente | Archivos que posee |
|---|---|
| `shell` | `src/app/features/reporting/shell/**`, `src/app/features/reporting/reporting.routes.ts`, `src/app/features/portal-selector/**`, el cableado en `src/app/app.routes.ts`, `src/app/app.routes.server.ts`, y el destino post-login en `src/app/features/auth/login/login.ts` |
| `pages` | `src/app/features/reporting/pages/**`, `src/app/features/reporting/components/**` (kpi-tile, filter-bar, tab-view, report-card) |
| `assistant` | `src/app/features/reporting/assistant/**` |
| `ds-<pestaña>` | `src/app/core/mock/handlers/reporting/<pestaña>.dataset.ts` y su `.spec.ts` (una pestaña por agente) |

Pestañas: `resumen`, `suscripciones`, `publicidad`, `comisiones`, `cobros`, `adquisicion`, `calidad`.

Nombres exactos que **otros agentes darán por existentes** (respétalos tal cual):

- `ReportingShell` — `features/reporting/shell/reporting-shell.ts` (selector `app-reporting-shell`)
- `PortalSelector` — `features/portal-selector/portal-selector.ts`, ruta `/portal-selector`
- `ReportGrid` — `features/reporting/pages/report-grid/report-grid.ts`
- `CommercialDashboard` — `features/reporting/pages/commercial-dashboard/commercial-dashboard.ts`
  (lee `:pestana` de la ruta `reports/commercial/:pestana`)
- `ReportAssistant` — `features/reporting/assistant/report-assistant.ts` (selector
  `app-report-assistant`, **sin inputs**; el shell lo monta plegable)
- `KpiTile`, `ReportFilterBar`, `TabView` — en `features/reporting/components/`
- Rutas: `/portal-selector`, `/reports` (grid), `/reports/commercial/:pestana`

## 3. Reglas de la casa que aplican (CLAUDE.md del repo y reglas 95/80/30)

- **Reutiliza antes de crear**: `app-tabs`, `app-card`, `app-page-header`, `app-segmented-control`,
  `app-select`, `app-badge`, `app-alert`, `ViewStateHost`, `app-content-dialog`, `AppButton`,
  `NavIcon`. Mira cómo los usan `features/admin/web-analytics` y `features/accounting/cockpit`.
- **Cero valores literales** de color, espaciado, radio o tipografía: solo tokens
  (`var(--bg-surface)`, `--text-primary`, `--sp-*`, `--r-*`, `--fs-*`). Nada de hex.
- **Sin Tailwind.** CSS plano en archivo propio. **Sin librerías nuevas.**
- **`ViewState<T>` de nueve estados** (ADR-0005): cargando, vacío con próxima acción, error accionable
  con ID de petición, sin permiso, datos atrasados, sin conexión. El vacío **orienta**; el error
  **explica y ofrece reintentar**, nunca el error crudo.
- **Modo claro y oscuro** siempre. **`prefers-reduced-motion`** respetado.
- **Responsivo**: móvil estrecho (390), tablet (768), escritorio (1440). Sin desborde horizontal.
- **Accesibilidad WCAG 2.2 AA**: nombre accesible, foco visible, teclado, objetivos ≥ 24 px,
  nada solo por color. Los botones llevan texto (ADR-0012).
- **Estados de datos**: `null` ≠ `0`. «Sin dato» con su motivo; nunca un 0 inventado.
- **Dinero**: importes con su moneda (`formatearValor`); nunca sumar BOB con USD.
- **Sin PHI/PII**: nada de pacientes. De doctores y organizaciones solo nombres comerciales de
  EJEMPLO inventados (que no sean de personas reales).
- Comentarios: explican un porqué no evidente, en español, con el tono del repo.
- Máx. razonable por archivo: ~300 líneas; parte lo que crezca.
- Texto de interfaz en español neutro y claro (Bolivia: `Bs`, `es-BO`). Botones que nombran la acción.
- `ux-writing-microcopy`: sin jerga técnica en pantalla (nada de «payload», «query»).

## 4. Contrato de calidad del gráfico (lo que hace cumplir `ChartPanel`)

`violacionesDelContrato(spec)` debe devolver `[]` para **todo** gráfico que produzcas; hay un
`huecosDelContrato` análogo en `reporting-dataset.util.ts`. Además, de la skill `dataviz`
(**léela: `Skill dataviz`**):

- **Un solo eje.** Nada de ejes duales. Magnitudes de escala distinta = dos gráficos.
- Máximo **8 series** por gráfico; categóricas en orden fijo; a partir de 5 considera
  agrupar en «Otros». El color sigue a la entidad, no al ranking.
- Barras apiladas solo para partes de un total; no uses dona con más de 5 partes.
- Velas (`velas`) **solo** para series de SALDO o RAZÓN con apertura/máx/mín/cierre con sentido
  (MRR, base de suscriptores, saldo por pagar, CPM, ROAS). No para flujos que se suman.
  Usa `velasDeSerie()` del util. `subirEsMalo: true` cuando subir sea malo (churn, mora).
- Cada gráfico lleva `resumenAccesible` que dice **qué muestra y cuál es la lectura**, no «gráfico de barras».
- `info` completa: definición, fórmula, numerador, denominador (si es tasa), fuente (tablas/módulos
  reales candidatos del plan, p. ej. `payments.subscriptions`), frescura, salvedades honestas
  (incluye siempre: «Datos de EJEMPLO»).
- Filtros por clic (`filtro: { dimension }`) en los gráficos categóricos: **los números deben cambiar
  de verdad** al activar un filtro (usa `factorContexto(ctx)` y `factorDeFiltro`). Si hacer clic no
  mueve nada, el clic no filtra.

## 5. Cómo verificar (permitido)

- Typecheck: `cd /home/user/mantra-core-health && corepack yarn tsc -p tsconfig.app.json --noEmit`
  (hay errores previos ajenos solo si faltan los archivos generados; ya están generados).
  **`tsc` no revisa las plantillas**: léelas dos veces.
- Pruebas: un `.spec.ts` propio, ejecutado de forma **dirigida** (`corepack yarn ng test --include <ruta>`
  o el runner que funcione; reporta el comando exacto y la salida literal). No corras la suite completa.
- **PROHIBIDO**: abrir navegadores, Playwright, `ng serve`, `ng build`, dejar procesos en segundo
  plano. Las capturas y la prueba visual las hace el agente principal en serie.
- No hagas `git commit`/`push`. No toques `package.json`, `CLAUDE.md`, `styles.css`.

## 6. Informe final (lo que devuelves)

Sin volcar código. Máximo ~40 líneas, con: qué archivos creaste (rutas), qué cubre cada uno,
**comando + salida literal** del typecheck y de tus pruebas, qué decisiones tomaste y con qué
supuesto, y **qué NO verificaste** (di «WRITTEN»/«TESTED», nunca «funciona» sin evidencia).

## 7. Calidad de referencia

El nivel a igualar es el de **AtlasDashboards** (`/home/user/AtlasDashboardsFrontend/src`:
`shared/charts/`, `features/dashboards/serie/`, `features/dashboards/informe/`). Míralo:
informe tipo banca (no una pared de fichas), KPI con variación y razón de «sin dato», tabla
debajo de cada gráfico, velas, «cómo se calcula», ver en grande, CSV. Carga las skills
`dashboard-data-ui`, `dataviz`, `visual-hierarchy-composition`, `frontend-ux-states`,
`ux-writing-microcopy` (están instaladas en `.claude/skills/`) antes de diseñar.
