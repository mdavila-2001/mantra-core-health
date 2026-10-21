# H5.S1.M1 — Atlas → primitiva de AloVida → qué falta

Referencia de anatomía: `PasanakuFrontend/docs/trabajo/2026-10-18-backoffice-como-atlas/evidencia/sistema-visual.md` §4–§6.
Regla del repo: usar las primitivas existentes antes de crear una nueva (`CLAUDE.md`). Se **amplía** lo compatible; se crea sólo lo que no existe.

| Pieza de Atlas | Primitiva existente | Qué falta | Decisión |
|---|---|---|---|
| Cabecera de página (eyebrow, título en acento, descripción, acciones) | `app-page-header` (`title`, `subtitle`, `breadcrumbs`, `secondaryActions`, `[page-actions]`) | eyebrow y loseta de ícono | **Se usa tal cual**; el eyebrow va como migas (`breadcrumbs`) y el ícono lo lleva el shell. No se duplica. |
| Cifras (KPI) | — (no hay) | loseta de ícono con tono, rótulo en mayúsculas, cifra tabular, pista, «Sin dato» | **Nueva**: `app-metric-card` (H5.S1.M2) |
| Insignias semánticas (método, riesgo, PII, revisión, bloque, módulo) | `app-badge` (6 tonos) + `platform-labels.ts` (código → rótulo/tono) | un mapa para método HTTP, riesgo, PII, bloque | **No se crean seis componentes**: mapas puros en `portal-labels.ts` sobre `app-badge` (H5.S1.M3, desvío declarado). No hay tono morado: «Datos personales» usa `secondary` **y** lleva texto, nunca sólo color |
| Barra de filtros en tarjeta | `app-search-field` + `app-select` en una tarjeta; `app-filter-bar` (selectores de value set) | — | Se usa `app-card` + `app-search-field` + `app-select` como `administration/data-catalog` |
| Tabla «Registros · n», cabecera fija, acciones fijadas | `app-data-table` (9 estados vía `view-state-host`, `maxHeight`, columna `sticky: 'end'`, cursor) | encabezado «Registros · n», cabecera de columnas fija con scroll, resumen de página | **Ampliada, compatible** (H5.S1.M7): `heading`, `totalCount`, `pageSummary`, `thead th` fija con `maxHeight` |
| Paginación «Página x de y · n registros · filas por página · ir a página» | `app-pagination` (page/pageSize/saltar, total conocido) y cursor de `app-data-table` | la API del portal pagina por **cursor con total**: no hay «ir a página N» | **Se usa el resumen por cursor** (`pageSummary`) y el selector de filas por página; «ir a página» **no se ofrece** porque un cursor no puede saltar (declarado, H5.S1.M8) |
| Pestañas segmentadas con estado en `?vista=` | `app-tabs` / `app-segmented-control` | persistir la pestaña en la URL | Se usan; la sincronización con `?vista=` va en cada ficha (H5.S3/S4) |
| Sección clave–valor (cabecera gris, cebra, rótulo en mayúsculas, valor mono copiable) | `app-fact-list` (oculta lo que falta), `app-fact-section` (ficha paginada con buscador) | mostrar «Sin dato», cebra, mono y copiar | **Nueva**: `app-key-value-section` (H5.S1.M6). `fact-list` no sirve: oculta las filas nulas, justo lo que un catálogo tiene que decir |
| Cajón lateral derecho (acciones por fila) | `app-card-detail-panel` (popover de tarjeta), `app-dialog` (centrado) | cajón anclado con cabecera fija, foco atrapado y restaurado | **Nuevo**: `app-drawer-panel` sobre `<dialog>` modal (H5.S1.M4) |
| Diálogo de confirmación con frase | `app-dialog` / `DialogService.confirm` (detalles, motivo, destructivo) | exigir una frase escrita | **Ampliado, compatible**: `confirmPhrase` (H5.S1.M5). «Botón cargando» **no se agrega al diálogo**: se resuelve por promesa y el botón cargando lo lleva la página que hace la petición |
| Estados cargando / vacío / error / sin permiso | `app-view-state-host` (los nueve estados M34) | — | Se usa tal cual |
| Barra lateral oscura con grupos plegables | `app-side-nav` / `shell` de la aplicación | grupos plegables propios del portal | **Shell propio del portal** dentro del contenido (ambigüedad 5): reutiliza `app-nav-icon` y los tokens `--nav-*` (H5.S2.M1) |
| Grafo de procesos / linaje | — | lienzo SVG con capas, pan/zoom, buscador | **Nuevo, piloto** `graph-canvas` (D-05, H5.S3.M1) |

Tokens: sin Tailwind ni literales; todo por `var(--…)` (`check-css-tokens.mjs`).
