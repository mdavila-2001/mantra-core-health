# Reporte — Rediseño del motor de PDF del front (jsPDF)

> **AVANCE: 20 / 21 — 95,2 %.** (1 descartada con motivo)

- Fecha: 2026-10-02 · Plan: [PLAN.md](./PLAN.md) · Rama: `justin/pdf-motor` (worktree `wt-pdf-motor`, base `origin/mockup` @ `4a3d5000`)
- Peldaño de evidencia alcanzado: **REGRESSION_VERIFIED** — E2E dirigido 3/3 PASS con evidencia, regresión unitaria completa, build, typecheck, lint y doble revisión visual (`evidencia/doble-revision.md`).

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.M1 | El extractor DOM no copia controles ni texto oculto (`aria-hidden`, `.sr-only`, `data-pdf-ignore`, `button`, el propio botón de exportar) | `corepack yarn test --watch=false --include='**/pdf-export.spec.ts'` | 48/48 PASS |
| H1.M2 | `app-data-table` marca sus 4 celdas de control con `data-pdf-ignore` | `--include='**/data-table.spec.ts'` | 39/39 PASS |
| H1.M3 | Los 7 exports de contabilidad envuelven encabezado **y** tabla (`data-pdf-root`) | `E2E_BASE_URL=http://localhost:4260 corepack yarn pw --workers=1 playwright/pdf-motor.spec.ts` | caso 1 PASS · `evidencia/balance-de-sumas-y-saldos.pdf` |
| H1.M4 | El primer encabezado de la pantalla no se repite como sección si es el título | `pdf-export.spec.ts` | 2 casos PASS; balance re-descargado |
| H2.M1 | `poppins-600.ttf` e `inter-400.ttf` en `public/alovida/tipografias/` + `LICENCIAS.md` | `ls public/alovida/tipografias/*.ttf` | 2 archivos |
| H2.M2 | `pdf-fuentes.ts`: holder + `prepararFuentes()` que nunca rechaza, las dos o ninguna | `--include='**/pdf-fuentes.spec.ts'` | 7/7 PASS |
| H2.M3 | `PdfBrandingService` baja las fuentes una vez por sesión (token `PREPARAR_FUENTES`) | `--include='**/pdf-branding.service.spec.ts'` | 16/16 PASS |
| H2.M4 | El motor registra las fuentes por documento; negrita → Poppins, normal → Inter; sin fuentes → Helvetica | `pdf-export.spec.ts` | 3 casos PASS |
| H2.M5 | Métricas ajustadas; los 3 PDF descargados embeben `/Poppins` y `/Inter` | `strings <pdf> \| grep FontName` | ✔ en los 3 |
| H3.M1 | Columnas: mínimo = palabra más larga, preferido = celda más larga, faltante por holgura | `pdf-export.spec.ts` | PASS |
| H3.M2 | Toda columna numérica a la derecha; fechas y documentos no | `pdf-export.spec.ts` + balance | PASS |
| H3.M3 | Cabecera Poppins sobre panel, cebra en impares, filetes marcados en bordes | balance p. 1 | ✔ |
| H3.M4 | Filigrana 25 %/4 % abajo a la derecha sobre el pie | `pdf-export.spec.ts` (opacidad y posición) + los 3 PDF | PASS |
| H3.M5 | Membrete con los tamaños de las fuentes nuevas; `INICIO_DE_CONTENIDO_*` intactos | specs de logo/firma existentes | PASS sin modificar |
| H3.M7 | `pdf-theme.spec.ts` lee `styles.css` y ata cada color del papel a su token | `--include='**/pdf-theme.spec.ts'` | 9/9 PASS |
| H3.M8 | Etiquetas de `field` más anchas que su columna se parten por palabras (medidas con el espaciado) | historia re-descargada, p. 1 | ✔ (`evidencia/historia-completa-p1.png`) |
| H4.M1 | El mock sirve la receta por el motor (`recetaDesdeResumen` + `buildPrescriptionPdf`), con diagnóstico o motivo | `--include='**/clinical.handlers.spec.ts'` | 23/23 PASS |
| H4.M2 | La receta descargada desde «Mi historia» es el documento del motor | E2E caso 2 | PASS · `evidencia/receta-oficial-mock.pdf` |
| H5.M1 | `docs/design-system/paper.md` + enlace desde `tokens.md` | — | archivo |
| H5.M2 | Parte 11 · Papel (PDF) en `identidad-visual.md` del vault, wikilinks `M08 clinical`, `M15 chart`, `M26 insurance` verificados | `ls Módulos/` | existen |

Transversales:

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `corepack yarn typecheck` | exit 0 |
| Lint de lo tocado | `corepack yarn eslint <archivos tocados> --max-warnings=0` | exit 0 |
| Build | `corepack yarn build` | exit 0 · inicial 386,87 kB transferidos · 6 avisos de presupuesto CSS en archivos ajenos (agenda, date-picker, login…), preexistentes |
| Regresión unitaria | `corepack yarn test --watch=false` | 741/743 archivos · 10 263/10 265 pruebas. Los 2 fallos no son de este trabajo: `app.routes.spec.ts` «una sección disponible NO cae en el placeholder» → timeout 30 s por contención (aislado: 53/53 PASS); `access-tree.spec.ts` «la aseguradora ve exactamente dos zonas» → espera 4 rutas y recibe 5 (`/administration/received-claims`), falla también aislado y en archivos que no toqué (`core/navigation/*`) |
| E2E | `pw --workers=1 playwright/pdf-motor.spec.ts` | 3/3 PASS (7,6 s) |
| Doble revisión | `evidencia/doble-revision.md` | balance APROBADA · receta APROBADA · historia ACEPTABLE CON RESERVAS |

## A medias

Ninguna.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H3.M6 | DESCARTADO | `bloquesDeReceta` ya emite «Documento generado el …» como caption; un sello en el pie lo duplicaría. Decidido en sesión. |

## Evidencia

- `evidencia/balance-de-sumas-y-saldos.pdf` + `-p1.png`, `evidencia/contabilidad-libros-1440.png`
- `evidencia/receta-oficial-mock.pdf` + `-p1.png`
- `evidencia/historia-completa.pdf` (5 páginas) + `-p1.png`
- `evidencia/spike-receta.png`, `evidencia/spike-evoluciones.png` — render local del motor con datos de muestra (spec temporal, borrado) con el que se ajustaron fuentes y tabla antes del E2E
- `evidencia/doble-revision.md`
- Antes (para comparar): `docs/trabajo/2026-09-30-logo-del-consultorio/pdf-con-logo-p1.png` (balance con un solo renglón «Exportar a PDF»), `docs/frontend/evidence/b3-receta-pdf/receta-descargada-1440x900-escritorio.pdf` (hoja en blanco con UUID), `docs/frontend/evidence/pdf-premium/evoluciones-descargado.pdf` (filigrana detrás de la tabla, fechas partidas)

## No cubierto

- Documentos que no se descargaron de la maqueta: comprobante, presupuesto, formulario en blanco, ficha de paciente, orden de estudio, atención suelta, cuadro de mando y los otros 5 informes contables. Comparten motor y sus specs de contenido pasan; no se miró su papel.
- Páginas 2–5 de la historia: sólo a resolución de miniatura.
- Carga real de fuentes en el navegador: el E2E prueba que el PDF las embebe (lo que implica que `prepararFuentes` las bajó); no se midió el tiempo de la primera exportación.

## Desvíos del plan

- H3.M6 descartada (motivo arriba).
- H2.M1: 2 TTF y no 3 — el reparto por estilo (negrita → Poppins 600, normal → Inter 400) cubre todos los usos del motor.
- H3.M1: en vez de «columnas compactas ≤ 18 caracteres» se implementó el reparto mínimo/preferido/holgura, que subsume ese caso y protege los nombres largos.
- El spec de deriva de color movió `COLOR_TINTA`, `COLOR_TINTA_SUAVE`, `COLOR_MARCA_PROFUNDO` y `COLOR_FILETE_FUERTE` a valores exactos de la rampa.
- Dos microtareas nuevas descubiertas por la revisión visual: H1.M4 (título repetido) y H3.M8 (etiquetas que pisaban el valor), ambas cerradas.
- La página «Evoluciones» del plan ya no existe en el árbol; el documento largo de evidencia es «Historia completa».

## Riesgos residuales

- Los TTF (~570 KB) se bajan en cada sesión; el servidor estático los cachea por URL, no hay cache busting propio.
- `pdf-motor.spec.ts` comprueba estructura, peso mínimo (50 KB) y fuentes embebidas, no el texto: con Identity-H el texto no es grepeable; la lectura de contenido queda en la revisión visual.
- `playwright install chromium` dejó `chromium_headless_shell-1234` en la caché de usuario (94,7 MB), compartida por las otras sesiones con la misma versión.

## Decisiones y ambigüedades

- «chat» en el pedido: mensajería no genera PDFs; se interpretó «el motor en general». **Confirmar con el propietario** si esperaba exportar conversaciones.
- Los informes contables salen con el bloque de firma y sello del profesional (comportamiento previo del branding). **Confirmar con el propietario** si un informe contable debe llevar firma.
- Fuera de alcance, anotado y no tocado: `data-table.spec.ts:33` falla `prefer-on-push-component-change-detection` también en `origin/mockup`; cifras sin separador de miles en contabilidad (dato de la pantalla); unidades «mg» en talla/peso del mock.
- API pdfkit (fase 2): documentada en `docs/design-system/paper.md` §Deuda y en el vault, Parte 11.4.
