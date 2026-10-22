# Plan — Rediseño del motor de PDF del front (jsPDF)

- Fecha: 2026-10-02 · Repo: `mantra-core-health` (worktree `wt-pdf-motor`, rama `justin/pdf-motor` desde `origin/mockup` @ `4a3d5000`) · Predecesor: `docs/trabajo/2026-09-30-logo-del-consultorio/`, `docs/trabajo/2026-09-30-firma-y-sello/`
- Kill-test: descargar el «Balance de sumas y saldos» desde `/administration/accounting` y abrirlo — si sólo dice «Exportar a PDF», esto NO está hecho.
- Estados: todas las microtareas arrancan en `TODO`; se actualizan en este archivo al abrir y cerrar cada una.

## Contexto

El propietario considera que los PDF que genera la plataforma son «lo peor que ha visto». El
diagnóstico sobre evidencia real (PDFs guardados en `docs/trabajo/` y `docs/frontend/evidence/`)
confirma **tres defectos distintos**, dos de contenido y uno de diseño:

1. **Exports de pantalla vacíos.** En `features/accounting/accounting.html` los 7
   `app-pdf-export-button` apuntan con `[target]` al `div.informe-encabezado` que contiene **sólo
   el `h2` y el botón**: la `app-data-table` queda afuera. El PDF del «Balance de sumas y saldos»
   sale con un único párrafo: *«Exportar a PDF»* (el texto del propio botón, que el extractor DOM
   también recoge). Evidencia: `docs/trabajo/2026-09-30-logo-del-consultorio/pdf-con-logo-p1.png`.
2. **La receta oficial de la maqueta es una hoja en blanco con un UUID.** En `mockup` el
   `GET /clinical/prescriptions/:id/pdf` lo sirve `clinical.handlers.ts:370` con `pdfMinimo()`
   (`files.handlers.ts:117`), un PDF de una línea en Helvetica 18. Es lo que ve cualquiera que
   descargue la receta desde «Mi historia» en la demo. Evidencia:
   `docs/frontend/evidence/b3-receta-pdf/receta-descargada-1440x900-escritorio.pdf`.
3. **Diseño del papel.** El motor único `shared/utils/pdf-export/pdf-export.ts` (1 344 líneas,
   jsPDF puro) sólo usa **Helvetica**, los colores viven en `pdf-theme.ts` desvinculados de
   `styles.css`, la **filigrana** es el isotipo al 62 % del ancho y 5 % detrás de las tablas (se
   lee como mancha gris), y la tabla parte en dos renglones columnas cortas como las fechas
   mientras deja aire en otras. Evidencia: `docs/frontend/evidence/pdf-premium/evoluciones-descargado.pdf`.

Decisiones ya tomadas con el propietario (2026-10-02):
- **Alcance: front primero.** Los 3 PDF pdfkit de la API (receta oficial, encuentro, certificado
  de portabilidad; sin capa común, colores y márgenes distintos entre sí) quedan como fase 2
  documentada, no se tocan.
- **Tipografía de marca embebida:** Poppins (títulos, rótulos, cabeceras) + Inter (cuerpo, tablas).
- **Filigrana:** se mantiene, chica (~25 % del ancho) y discreta (~4 %), abajo a la derecha, lejos
  de las tablas.

Resultado observable: desde la maqueta (`mockup`, sin backend), el médico descarga la receta, las
evoluciones y el balance contable y obtiene PDFs con contenido completo, tipografía Poppins/Inter,
tablas que no parten fechas ni números, y membrete/pie consistentes en los 12 documentos.

## Alcance

- **IN:** `mantra-core-health/` (rama nueva desde `origin/mockup`, PR a `mockup`):
  `shared/utils/pdf-export/*`, `shared/components/molecules/pdf-export-button/*`,
  `shared/components/organisms/data-table/data-table.html`, `features/accounting/accounting.html`,
  `features/admin/patients/patient-detail/patient-detail.html`, `core/pdf-branding/*`,
  `core/mock/handlers/clinical.handlers.ts`, `public/alovida/tipografias/` (+ `LICENCIAS.md`),
  specs afectados, `docs/design-system/paper.md` (nuevo) y un capítulo «Papel» en
  `Mantra Core Health Vault/SALUD/Arquitectura/identidad-visual.md`.
- **OUT:** API pdfkit (`mantra-core-health-api/src/modules/{chart,clinical,insurance}`), el
  visor `file-preview` (pdfjs), `features/billing/representacion-grafica.ts` (dibuja QR y
  «SIMULADO» con jsPDF crudo — se anota como deuda, no se migra), levantar el stack Docker.
- **Ambigüedad registrada:** «chat» en el pedido. El módulo de mensajería **no genera PDFs**
  (sólo previsualiza adjuntos vía `file-preview`); se interpreta «el motor de PDFs, en general».
  Confirmar con el propietario si esperaba exportar conversaciones.

## Entorno de trabajo (regla «un checkout, una sesión»)

```bash
git -C mantra-core-health worktree add ../wt-pdf-motor -b justin/pdf-motor origin/mockup
python3 -S scripts/atlas/check-exclusive-checkout.py
```

Plan versionado en `docs/trabajo/2026-10-02-motor-pdf/PLAN.md` (+ `REPORTE.md`, `evidencia/`),
siguiendo el patrón de `docs/trabajo/2026-09-30-logo-del-consultorio/`.

---

## H1 — Los exports de pantalla traen lo que se ve

**CA:** Dado el médico en `/administration/accounting` con libros cargados, cuando exporta el
balance, entonces el PDF contiene la cabecera de la tabla y sus filas, y **no** contiene «Exportar
a PDF», «Seleccionar las filas visibles», «Ver el detalle de la fila» ni las flechas de orden.

| ID | Microtarea | DoD |
|---|---|---|
| H1.M1 | En `pdf-export.ts` `walk()`: saltar nodos con `aria-hidden="true"`, `[data-pdf-ignore]`, `BUTTON`, `APP-PDF-EXPORT-BUTTON`, `.sr-only`; y que el texto de una celda/encabezado se calcule **sin** esos descendientes (helper `textoVisible(el)` que clona y poda). | spec nuevo en `pdf-export.spec.ts`: DOM con botón de export, `th` con `<button>` + flecha `aria-hidden`, celda `sr-only` → bloques esperados | **TESTED — pdf-export.spec 38/38**
| H1.M2 | `data-table.html`: `data-pdf-ignore` en `th/td.data-table__select-cell` y `.data-table__detail-toggle-cell`. | `yarn test --include=**/data-table.spec.ts` verde; spec que afirma el atributo | **TESTED — data-table.spec 39/39**
| H1.M3 | `accounting.html`: envolver encabezado **y** tabla (y totales del estado de resultados) en un `<div data-pdf-root #xxxPdf>` para los 7 exports; revisar `patient-detail.html:9`. | Playwright `--workers=1`: descargar balance → `pdftotext`-equivalente (leer con `pdfjs` en el test o `sips`+revisión) contiene «Saldos por cuenta» y ≥ 1 fila | **VERIFIED — E2E caso 1 PASS; `evidencia/balance-de-sumas-y-saldos.pdf` con la tabla completa**
 **WRITTEN — 7 raíces `data-pdf-root`; E2E pendiente**
| H1.M4 | *(descubierta en la revisión visual)* El primer encabezado de la pantalla, si dice lo mismo que `title`, no se repite como sección (`sinElTituloRepetido`). | `pdf-export.spec.ts`: 2 casos | **TESTED — 57/57; balance re-descargado sin el título doble** |

## H2 — Tipografía de marca en el papel

**CA:** Dado cualquier documento del motor, cuando se genera en el navegador, entonces títulos,
rótulos y cabeceras salen en Poppins y el cuerpo y las tablas en Inter; si las fuentes no se
pudieron cargar, el documento sale igual en Helvetica (nunca falla por la fuente).

| ID | Microtarea | DoD |
|---|---|---|
| H2.M1 | Copiar `Poppins-Medium.ttf`, `Poppins-SemiBold.ttf` desde `mantra_core_health_mobile/assets/fonts/` a `public/alovida/tipografias/`; traer **`Inter-Regular.ttf` estática** (release oficial de Inter, OFL — jsPDF no interpreta ejes variables, **no** usar `Inter-Variable.ttf`); anotar las tres en `LICENCIAS.md`. | `ls public/alovida/tipografias/*.ttf` → 3 archivos; `LICENCIAS.md` los lista | **HECHO — 2 TTF (poppins-600, inter-400) + LICENCIAS.md**
| H2.M2 | Nuevo `shared/utils/pdf-export/pdf-fuentes.ts` con el mismo patrón de `pdf-logo.ts`: holder de módulo (`establecerFuentesDeDocumentos` / `fuentesDeDocumentos`), `prepararFuentes()` que hace `fetch` de los 3 TTF, los pasa a base64 y **nunca rechaza** (devuelve `null` bajo SSR o ante error). | spec `pdf-fuentes.spec.ts`: fetch falso → base64; fetch que falla → `null` | **TESTED — pdf-fuentes.spec 7/7**
| H2.M3 | `PdfBrandingService` dispara `prepararFuentes()` **una vez** en el constructor (no depende del perfil) y guarda el resultado en el holder. | `pdf-branding.service.spec.ts` extendido: se llama una vez, no por cambio de perfil | **TESTED — pdf-branding.service.spec 16/16**
| H2.M4 | En `abrirHoja()`: si hay fuentes, `doc.addFileToVFS` + `doc.addFont(archivo, 'Poppins', 'normal'|'bold')` / `('Inter','normal')` y una tabla `FUENTE = { display, cuerpo }` en `pdf-theme.ts`; todas las llamadas `setFont('helvetica', …)` (`:1120`, `:1210`, `:1247` y `repartirColumnas`) pasan por un `fuenteDe(rol, estilo)` que devuelve la de marca o `helvetica`. | `pdf-export.spec.ts`: el doble de jsPDF registra `addFont`; con holder vacío sólo se usa `helvetica` | **TESTED — pdf-export.spec (3 casos de fuentes)**
| H2.M5 | Reajustar `TIPOGRAFIA`/`ESPACIADO`/`RITMO` a las métricas reales de Poppins/Inter (Poppins es más ancha: título 20, logotipo 12, clase 7, cabecera de tabla 8 con `charSpace` 0.8; Inter cuerpo 9.5, fila 9, interlineado 13.5). Verificar que `charSpace` respeta las fuentes embebidas (Identity-H). | PDF real renderizado (`sips -s format png`) revisado: sin solapes, letras espaciadas correctas |
 **VERIFIED (spike local) — Poppins/Inter embebidas, charSpace OK, render revisado**
## H3 — Diseño del papel: membrete, tablas, filigrana, pie

**CA:** Dado el PDF de evoluciones (tabla de 4 columnas con fechas y conteos), cuando se genera,
entonces la columna de fecha no parte en dos renglones, los conteos van a la derecha, la cabecera
de tabla va en versalitas de marca sobre panel, las filas alternan un fondo apenas teñido, la
filigrana queda abajo a la derecha sin pisar texto y el pie numera «Página X de N».

| ID | Microtarea | DoD |
|---|---|---|
| H3.M1 | `repartirColumnas()`: clasificar columnas **compactas** (todas las celdas del cuerpo ≤ 18 caracteres y sin espacios internos largos — fechas, horas, números, códigos) y reservarles su ancho pedido entero (no se parten); el faltante se reparte sólo entre columnas de texto. Mantener la regla de columnas angostas. | spec: tabla con fecha larga + descripción → `partirFila` devuelve 1 línea en la fecha | **TESTED — reparto mínimo/preferido/holgura**
| H3.M2 | Alinear a la derecha **toda** columna numérica (no sólo la última): generalizar `ultimaColumnaEsNumerica` → `columnasNumericas()` (regex numérica estricta: `^[\d.,\s%$Bs-]+$`, no «contiene un dígito», que hoy marca una fecha como numérica). | spec: columna «#» y «Atenciones» a la derecha, «Fecha» a la izquierda | **TESTED — `columnasNumericas` con patrón estricto**
| H3.M3 | Fila de cabecera: texto en mayúsculas con `charSpace`, Poppins SemiBold 8, `COLOR_MARCA`, panel `COLOR_PANEL`; cuerpo con **zebra** (fondo `COLOR_PANEL` al 50 % en filas impares — nuevo token `COLOR_CEBRA`) y filete sólo al cierre; alto de fila = líneas × 13.5 + 8. | spec: `rect` de relleno en filas impares; PDF renderizado revisado | **TESTED — cebra + cabecera Poppins 8,5**
| H3.M4 | Filigrana: `FILIGRANA = { anchoRelativo: 0.25, opacidad: 0.04 }`, posición abajo a la derecha, con el borde inferior 12 pt sobre el filete del pie (no centrada). | `pdf-export.spec.ts` ajusta la aserción de posición; PDF renderizado: no toca ninguna tabla | **TESTED — filigrana 25 %/4 % abajo a la derecha (spec de posición)**
| H3.M5 | Membrete: logotipo y clase en Poppins; bajo el filete, cuando hay `subtitle`, una **línea de identificación** en Inter 9 `COLOR_TINTA_SUAVE`; títulos de sección (`subseccion`) en Poppins Medium con `charSpace`; etiquetas de `field` en Poppins Medium 7.5. Sin cambiar alturas de `INICIO_DE_CONTENIDO_*` (los specs de logo/firma dependen de ellas). | specs existentes de membrete/logo/firma siguen verdes sin debilitar | **HECHO — tamaños ajustados; INICIO_* intactos**
| H3.M6 | Pie: filete + línea legal a la izquierda y «Página X de N» a la derecha (ya existe), más la fecha de generación a la derecha de la legal en `TIPOGRAFIA.pie` (`Generado el 2 de octubre de 2026, 16:40`), opcional por `options.generatedAt` (default: ahora; `null` lo omite para que las pruebas sean deterministas). | spec: con `generatedAt: null` no aparece; con fecha fija aparece formateada | **DESCARTADO — `bloquesDeReceta` ya emite «Documento generado el …» como caption; un sello en el pie lo duplicaría**
| H3.M7 | Nuevo spec de **deriva de color** `pdf-theme.spec.ts`: lee `src/styles.css` con `node:fs` (mismo patrón que `core/tokens/design-tokens.types.spec.ts`) y afirma que `COLOR_MARCA` = `--c-petrol-500`, `COLOR_MARCA_PROFUNDO` = `--c-petrol-700`, `COLOR_PANEL` = `--c-petrol-50`/equivalente, `COLOR_TINTA` = `--c-neutral-900`, etc. (ajustar los RGB de `pdf-theme.ts` a las rampas reales si difieren). | `yarn test --include=**/pdf-theme.spec.ts` verde |
 **TESTED — pdf-theme.spec 9/9 (lee styles.css)**
| H3.M8 | *(descubierta en la revisión visual)* Las etiquetas de `field` más anchas que su columna se parten por palabras midiendo con el espaciado (`partirEtiqueta`), y la fila crece; antes pisaban el valor («HIPERTENSIÓN ARTERIAL ESENCIAL»). | historia completa re-descargada y revisada | **VERIFIED — `evidencia/historia-completa-p1.png`** |

## H4 — La receta de la maqueta sale por el mismo motor

**CA:** Dado el paciente en «Mi historia» de la maqueta, cuando descarga la receta oficial,
entonces el PDF es el documento de receta del motor (membrete, tabla de medicamentos, firma),
no una hoja con un UUID.

| ID | Microtarea | DoD |
|---|---|---|
| H4.M1 | `clinical.handlers.ts:370`: reemplazar `pdfMinimo(texto)` por `import('…/clinical-pdf/clinical-pdf')` + `recetaDesdeResumen()` (`from-summary.ts:59`, verificar firma) + `buildPrescriptionPdf(...).output('arraybuffer')`, con `kind: 'Receta médica'` y `reference` = id corto. `pdfMinimo` queda para los adjuntos genéricos de `files.handlers.ts`. | spec del handler: `Content-Type: application/pdf`, bytes empiezan en `%PDF`, tamaño > 5 KB (el stub pesa < 1 KB) | **TESTED — clinical.handlers.spec 23/23**
| H4.M2 | Playwright `--workers=1`: paciente → Mi historia → descargar receta → guardar en `evidencia/`, renderizar p. 1 con `sips` y revisar. | captura + PDF en `docs/trabajo/2026-10-02-motor-pdf/evidencia/` | **VERIFIED — E2E caso 2 PASS; `evidencia/receta-oficial-mock.pdf` es el documento del motor**
## H5 — Documentación del papel

| ID | Microtarea | DoD |
|---|---|---|
| H5.M1 | `docs/design-system/paper.md`: tokens de `pdf-theme.ts`, qué fuente lleva cada rol, reglas de tabla, filigrana, pie, cómo exportar una pantalla (`data-pdf-root` / `data-pdf-ignore`), y la deuda: API pdfkit sin capa común (fase 2: `src/common/pdf/` espejo de `pdf-theme.ts`), `representacion-grafica.ts` fuera del tema. | archivo existe; enlazado desde `docs/design-system/tokens.md` | **HECHO — docs/design-system/paper.md, enlazado desde tokens.md**
| H5.M2 | Capítulo «Papel (PDF)» en `Mantra Core Health Vault/SALUD/Arquitectura/identidad-visual.md` (skill `obsidian-markdown`), 20–30 líneas con wikilinks al resto del documento. | sin enlaces rotos |
 **HECHO — Parte 11 · Papel (PDF) en identidad-visual.md**
---

## Verificación de cierre (pirámide, serial)

```bash
corepack yarn typecheck && corepack yarn lint
corepack yarn test --watch=false --include='**/pdf-*.spec.ts' --include='**/clinical-pdf/**' --include='**/pdf-export-button/**' --include='**/data-table.spec.ts'
corepack yarn test --watch=false            # regresión completa (~140 s)
corepack yarn build                         # vigilar el presupuesto de 500 kB — jspdf ya es lazy; los TTF se sirven como assets, no entran al bundle
corepack yarn pw --workers=1 playwright/pdf-motor.spec.ts   # nuevo: receta (paciente), evoluciones y balance (médico) → guarda los 3 PDF
```

Prueba visual (regla 35, doble revisión): cada PDF → `sips -s format png` (p. 1) y las páginas
siguientes abiertas en el navegador integrado; comparar contra las tres evidencias «antes» citadas
en Contexto. Criterios binarios: fuente Poppins/Inter visible en las propiedades del PDF
(`strings archivo.pdf | grep FontName`), fecha en una línea, conteos a la derecha, filigrana sin
pisar tabla, «Exportar a PDF» ausente del balance, receta con tabla de medicamentos.

Cierre: `REPORTE.md` con avance `HECHO/total`, PR a `mockup` con las capturas antes/después, estado
mergeable pegado (`gh pr view --json mergeable,mergeStateStatus`).

## Hallazgos fuera de alcance (anotados, no corregidos)

- `data-table.spec.ts:33` — el `HostComponent` de prueba sin `OnPush` dispara `@angular-eslint/prefer-on-push-component-change-detection`. **Preexistente en `origin/mockup`** (verificado linteando la versión base: mismo error). No se tocó.
- La página de «Evoluciones» que produjo `docs/frontend/evidence/pdf-premium/` ya no existe en el árbol (no hay ruta `/progress-notes`); la evidencia del documento largo se toma con «Historia completa» del paciente.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| jsPDF 4 + TTF con `charSpace`/`getTextWidth` se comporta distinto que con Helvetica (medidas de columna) | H2.M5 valida con PDF real antes de H3; si falla, las versalitas espaciadas se hacen letra a letra (ya existe `escribirEspaciado`) |
| `pdf-export.spec.ts` (37 tests) afirma posiciones y conteos de llamadas sobre un jsPDF falso | Ajustar aserciones **al nuevo diseño**, nunca borrar; la aserción «marca dibujada 2× por página» sigue valiendo |
| Timeouts del pool de vitest con muchos specs | correr dirigido con `--include`, luego la suite completa una sola vez |
| `recetaDesdeResumen` necesita datos que el mock de receta no tiene | si falta un campo, el mock lo sirve con `SIN_DATO` del propio builder; no inventar datos clínicos |
