# Renombrado a inglés del frontend — inventario y estado (2026-10-09)

Hallazgo D4 de `docs/INVENTARIO-ESTRUCTURA-BACKEND-2026-10-08.md`; regla 29 (identificadores y archivos en inglés,
prosa visible en castellano). Rama `justin/ddd-front-rename-test`, base `origin/test` (`785c6a7b`). Es el mismo renombrado del PR a `dev` (#1032), reaplicado con los mismos scripts sobre `test` en vez de cherry-pick (las ramas divergen y dev movió ≈100 de estos archivos).

## Cómo se midió y cómo se aplicó

- **Medición:** barrido de nombres de archivo y de identificadores con la API del compilador de TypeScript
  (`typescript` de `node_modules`, sin instalar nada). El hallazgo hablaba de 67 `.ts`; el barrido real encontró
  **294 `.ts` no-spec** con algún segmento en castellano, de los cuales **126 viven en `features/alovida/**`** (ver «Descartado»).
- **Aplicado con herramientas del compilador, no con `sed`:**
  - archivos/carpetas: resolución de módulos de `tsc` (`ts.resolveModuleName`) para reescribir cada especificador
    (importaciones, `export … from`, `import()`, `vi.mock`, alias `@core/@shared/@features`);
    `templateUrl`/`styleUrl` y `@import` de CSS por nombre de base. (`LanguageService.getEditsForFileRename`
    se probó primero: con 267 pares recalcula el programa en cada llamada y no terminó en 24 min de CPU.)
  - símbolos y miembros: `LanguageService.findRenameLocations` (todo el lote contra el mismo programa), con
    prefijo/sufijo para atajos de objeto y reexportaciones.
  - plantillas: parche **sólo de expresiones** (interpolaciones, bindings, `@if/@for/@switch/@let`, `host`, `template` en línea);
    el texto visible no se toca.

## Resultado

| Qué | Cifra |
|---|---|
| Archivos movidos | **337** (169 `.ts`, 101 `.spec.ts`, 30 `.html`, 37 `.css`) en `core/`, `features/` (salvo alovida) y `shared/` |
| Archivos reescritos por importaciones y referencias | 362 + 11 |
| Símbolos de nivel superior renombrados | **1 272** (clases, funciones, constantes, interfaces, tipos) |
| Miembros de clase renombrados (propiedades, signals, métodos) | **631** |
| Selectores de componente `app-…` | **34** (plantillas, specs y escenarios de navegador) |
| Referencias en `scripts/` y `tools/` | generadores (`gen-*`), `generate-component-index.mjs`, `glossary-seed/export-rows.ts` |

## Descartado (con motivo)

| Qué | Cantidad | Motivo |
|---|---|---|
| `features/alovida/**` (archivos, carpetas, clases) | 126 `.ts` + sus carpetas/html | **Lo genera `scripts/port-vistas-alovida.mjs` y el nombre del archivo es la URL** (`/<módulo>/<slug>`, `vistas.manifest.json`). Renombrar cambia rutas: decisión aparte. |
| Rutas del router (`app.routes.ts`), `proxy.conf.json` | — | Regla del encargo: las URLs no se tocan. |
| Propiedades de interfaces/tipos de datos y claves de objetos de fixtures | no enumeradas | Espejan la API o son datos de ejemplo (`core/mock/fixtures`: se renombran archivos y símbolos, no el contenido). |
| Operaciones SIAT (`solicitudCuis`, `solicitudCufd`, `sincronizarFechaHora`, `recepcionFactura`, `verificacionEstadoFactura`, `anulacionFactura`, `reversionAnulacionFactura`) | 7 | Nombres de operación del servicio del Impuesto (contrato externo, `FiscalProviderPort`). Se renombraron por error y se revirtieron. |
| Entradas `input()`, salidas `output()`, `model()`, `viewChild()` de componentes | 87 | Son el contrato de plantilla que consumen los padres: pendiente de un pase con verificación en pantalla. |
| Símbolos de archivos `*.generated.ts` | 12 archivos | Se renombraron los **archivos** (y la ruta de salida de su generador); los símbolos los fija el generador. |

## Pendiente (con motivo)

- **22 símbolos de nivel superior** sin renombrar por choque con un nombre ya presente en el archivo o en uno de sus
  importadores (`emisor→issuer`, `pago→payment`, `conjunto→set`, `conceptos→concepts`, `SEXO→SEX`, `UNIDAD→UNIT`, `normalizar→normalize`, …).
  Requieren nombre distinto elegido a mano.
- **7 miembros** que chocan con otro de la misma clase (`Quotations.buscar`, `Summary.recargar`, `UniversitiesRegistry.cargar`,
  `ScenarioContentDialog.abrir`, `LegalDocuments.abrirAlta`, `FilterTerritorial.catalogoCaido`, `Quotations.abrirReserva`).
- Variables locales, parámetros, propiedades de interfaces y comentarios en castellano: no se tocaron (alcance: nombres de archivo
  y símbolos de esos archivos). El verificador `scripts/check-english-identifiers.mjs` sigue reportando identificadores heredados.
- `shared/utils/pdf-export`, `core/pdf-branding` y otros ya violaban `check-architecture.mjs` en la base (verificado en un
  worktree de `d2d6669d`): los 5 verificadores `check-architecture/form-pages/tokens/css-tokens/english-identifiers` fallan igual antes y después.

## Verificación (comandos y resultado literal)

```
tsc -p tsconfig.app.json  --noEmit                        →  sin salida (0 errores)
tsc -p tsconfig.spec.json --noEmit                        →  sin salida (0 errores)
corepack yarn build                                       →  exit 0 (avisos de presupuesto de CSS ya existentes)
corepack yarn ng build --configuration production-api     →  exit 0, «Application bundle generation complete» (la configuración del despliegue)
corepack yarn test --watch=false (1 worker)               →  Test Files 4 failed | 778 passed (782) · Tests 4 failed | 10 849 passed (10 853)
   las 4: design-tokens.types.spec (--heat-*), standard-sheets.spec (137 ≠ 43), messaging.spec («No pudimos cargar sus conversaciones»),
   clinical.handlers.spec (buildPrescriptionPdf(...).output; pasa aislada, 22/22)
```

Esas cuatro fallan con el mismo mensaje en la base de `dev` (`c728d124`, medido en un worktree de la base). **No se midió en un
worktree de `origin/test`**: el disco se llenó al crearlo; por eso la comparación contra la base de `test` es por igualdad de mensajes, no por corrida.

**Rung de evidencia (regla 15): RUNS + TESTED** (compila, build normal y `production-api`, y pruebas unitarias). **No se abrió el
navegador ni se corrió Cypress/E2E**: el flujo en pantalla no está verificado.
