# Hallazgos front — Solicitud de estudios con catálogo completo

- Fecha: 2026-10-31 · Rama: `claude/brave-carson-h23qzh` · Autor: agente de planificación (solo lectura; no se tocó código).
- Insumos leídos: `CLAUDE.md`, `docs/trabajo/2026-10-31-estudios-muestra-y-region-corporal/PLAN.md` (F1–F10), `docs/trabajo/2026-10-31-ordenes-compactas-laboratorio-imagenologia/REPORTE.md`.
- Alcance: front Angular. El visor 3D se investiga en otro informe; acá solo se marca dónde se enchufa.
- Ninguna afirmación de este documento se verificó en navegador: todo sale de leer código y de correr `node scripts/check-max-lines.mjs`.

## 0. Resumen en cinco líneas

1. Hoy el médico elige **un** estudio de un `app-concept-select` plano; el tipo (laboratorio/imagen) **se deduce** del prefijo del código y no se elige. No hay análisis múltiples, ni componentes, ni modalidad, ni región, ni lateralidad.
2. En el **simulador** los códigos son `STUDY-*`, así que `studyFamilyOf` devuelve `OTHER` para **todo**: un hemograma pedido en la maqueta sale como «Otro estudio» (§1.3, B1).
3. La orden que crea el médico **nunca llega** a la pantalla «Órdenes» del laboratorio: el laboratorio lee una colección sembrada aparte (`labInboxOrders`), y el alta del médico escribe en `orderList` sin `performerTenantId` (§2.3, B2).
4. El contrato de la API (`CreateServiceRequestDto`) no tiene ningún campo nuevo, y el simulador **rechaza con 400** toda clave no declarada (`forbidNonWhitelisted`). Sin cambio de API + regeneración del contrato, el front no puede mandar nada nuevo (§1.5, B3).
5. No hay en el front ninguna fuente de «componentes de un análisis» (analitos). Hay que traerla de la API con procedencia (§1.4, B4).

---

## 1. Lado médico (quien pide)

### 1.1 El bloque `analysis-order-block`

Archivos y tamaño actual (líneas):

| Archivo | Líneas | Rol |
|---|---|---|
| `src/app/features/clinical-record/patient-chart/analysis-order-block/analysis-order-block.ts` | 683 (techo 649, **ya excedido**) | Componente `app-analysis-order-block` |
| `…/analysis-order-block.html` | 218 | Formulario + histórico |
| `…/analysis-order-block.css` | 124 | |
| `…/analysis-order-block.helpers.ts` | 104 | `PRIORITY_LABELS`, `EstudioEnFicha`, `duplicadoDe`, `conceptosDe`, `mensajeDeAlta` |
| `…/study-category.ts` | 153 | Familia del estudio deducida del código |
| `…/performer-selector/*` | 7 archivos | Ejecutor, **solo** para procedimientos |
| `…/duplicate-study-warning-dialog/*` | 4 archivos | Antiduplicación |
| `…/analysis-order-block.spec.ts` | 907 | |

Hechos:

- **Constantes de catálogo** (`analysis-order-block.ts:71,78,81`): `TARGET_ESTUDIO = 'clinical.service_requests.code_concept_id'`, `TARGET_CATEGORIA = '…category_concept_id'`, `TARGET_PRIORIDAD = '…priority_concept_id'`. `form-conclusion-block.ts:34` las importa también.
- **Entradas/salidas** (`analysis-order-block.ts:162-182`): `patientProfileId` (required), `encounterId`, `exigeRespuesta`, `ofreceRespuesta`; salida `cambio`.
- **Estado del formulario** con señales (`:227-252`): `estudio`, `tipo = createStudyCategoryState(...)`, `prioridad`, `catalogoListo`, `pidiendo`, `performer = createPerformerOrderState(...)`. `registro: ViewState<null>` (`:255`), `circuito: ViewState<PatientDiagnostics>` (`:278`).
- **Puerta del catálogo** (`:399-404`): `dynamicEnum(TARGET_ESTUDIO)`; sin opciones o con error → `catalogoListo=false` y la plantilla muestra el aviso «El catálogo de estudios no está publicado» (`.html:21-29`).
- **Plantilla del formulario** (`.html:31-102`): `app-form-response-picker` (`:35-43`) → `app-form-field «Estudio»` con `app-concept-select [target]="targetEstudio"` (`:47-59`, el *hint* muestra «Tipo: …» deducido) → `«Prioridad»` (`:61-72`) → `app-performer-selector` solo si `performer.isProcedure()` (`:74-87`) → `app-form-actions «Pedir estudio»` (`:96-101`).
- **Decisión de diseño vigente** (`.html:45-46`, `study-category.ts:304-311`): «El tipo no se elige: sale del estudio. Un segundo selector dejaba pedir un hemograma como imagen.» La spec lo fija: `analysis-order-block.spec.ts:313-333` exige que **no** haya ningún `<label>` que empiece con «Tipo».
- **Envío** (`analysis-order-block.ts:438-465` y `:475-544`): primero `checkDuplicateStudy({patientProfileId, codeConceptId, encounterId})`; si no hay duplicado, `requestStudy(cuerpo)` con `custodianTenantId, patientProfileId, codeConceptId, ...categoria, encounterId, formInstanceId?, basedOnNoteIds?, priorityConceptId?, ...performerFields, ...decision` (`:507-524`). Los opcionales sin valor **se omiten** (`:519-521`). Tras el alta, `limpiar()` (`:609-613`) y se relee el histórico (`:536`).
- **Histórico** (`.html:119-203`, `ts:293-311`, `:627-649`): cada fila muestra `estudio`, `categoria`, `estado`, duplicado/resultado y consentimiento. No hay lugar para el detalle (componentes, región…).
- **Borrador**: el bloque **no** implementa `DRAFT_BLOCK`/`tieneCambiosPendientes()` (sí lo hacen otros bloques: `patient-chart/draft-block.ts`). En la consulta, `casillaSinCambios` (`consultation.ts:560-562`) da `true` y el modal se cierra sin preguntar: con una selección rica (10 analitos marcados) cerrar el modal la pierde sin aviso.

### 1.2 `study-category.ts` — cómo distingue laboratorio de imagen

- `StudyFamily = 'LAB'|'IMAGING'|'CARDIO'|'PATHOLOGY'|'PROCEDURE'|'OTHER'` (`study-category.ts:13`).
- `FAMILY_BY_STUDY_PREFIX` (`:29-35`): `LAB→LAB`, `IMG→IMAGING`, `CAR→CARDIO`, `PAT→PATHOLOGY`, `PRO→PROCEDURE`; cualquier otro prefijo → `OTHER` (`:56-62`).
- `createStudyCategoryState` (`:98-153`) memoiza `dynamicEnum(studyTarget)` y `dynamicEnum(categoryTarget)`; `fields()` devuelve `{category: 'LAB'|'IMAGING'|'OTHER'}` o `{categoryConceptId}` para CARDIO/PATHOLOGY/PROCEDURE (`:130-142`).
- Es la única fuente de «qué tipo es»: no se pregunta a la API.

### 1.3 De dónde sale el catálogo de estudios

- Front: `SystemContextClient.dynamicEnum('clinical.service_requests.code_concept_id')` (consumido por `app-concept-select`, `shared/components/molecules/concept-select/concept-select.ts:69-107`).
- Simulador: `GET /system-context/dynamic-enums` (`core/mock/handlers/misc.handlers.ts:409-433`) mapea por regex `service_requests\.code_concept_id → VS_DIAGNOSTIC_STUDY` (`misc.handlers.ts:127`).
- `VS_DIAGNOSTIC_STUDY` = `ESTUDIO` (`core/mock/fixtures/concepts.ts:1146-1172`): 24 estudios con códigos `STUDY-HEMOGRAMA`, `STUDY-RX-TORAX`, `STUDY-TAC-CRANEO`… Nombres desde INLASA (`fixtures/inlasa.ts:17-31`) o FONASA (`reference-prices.ts:289`).
- **Defecto B1**: `studyFamilyOf('STUDY-HEMOGRAMA')` → prefijo `STUDY` → `OTHER`. En la maqueta **todo** estudio es «Otro estudio» y viaja como `category: 'OTHER'`. La spec usa códigos `LAB_CBC`, `IMG_RX_TORAX` (`analysis-order-block.spec.ts:28-42`), por eso pasa en verde. Un filtro «Laboratorio / Imagenología» construido sobre `studyFamilyOf` dejaría la maqueta **vacía** en las dos pestañas.
- La API real (según el comentario de `study-category.ts:27`) usa `LAB_*`, `IMG_*`, `CAR_*`, `PAT_*`, `PRO_*`. **No verificado** contra la API en esta sesión.

### 1.4 Catálogos relacionados que ya existen (simulador)

| Catálogo | Dónde | Uso actual | Nota |
|---|---|---|---|
| `VS_DIAGNOSTIC_MODALITY` (`DU_MODALITY_LAB/XRAY/ULTRASOUND/CT/MRI/MAMMOGRAPHY/BONE_DENSITOMETRY`) | `concepts.ts:1478-1491`; target `diagnostic_study_offerings.modality_concept_id` (`misc.handlers.ts:55`) | Alta de centros/ofertas | Candidato directo para «modalidad». No está atado a `service_requests` |
| `VS_CONDITION_LATERALITY` (`COND_LAT_LEFT/RIGHT/BILATERAL`) | `concepts.ts:898-903` | Diagnósticos | Candidato para lateralidad; hoy es de `conditions` |
| `VS_SPECIMEN_TYPE` (HL7 v2-0487) | `concepts.ts:1570-1583`; `SPECIMEN_TYPE_TARGET` en `diagnostics-lab.types.ts:191` | Recepción de muestras | Para «muestra» del plan previo |
| Analitos / componentes de un análisis | **No existe** | — | INLASA solo trae `code, name, officialName, area, priceBs` (`inlasa-tariffs.generated.ts:14-20`). El único rastro de analitos es un texto libre de resultado (`diagnostics.handlers.ts:104`) |
| Catálogo propio del laboratorio (`LabService`: `sampleType`, `categoryName`) | `core/data-access/lab-portal/lab-portal.types.ts:21-52` | «Precios» del laboratorio | Es otro catálogo (el del centro), sin analitos ni vínculo con `VS_DIAGNOSTIC_STUDY` |

### 1.5 Tipos y cliente (`src/app/core/data-access/diagnostics/`)

- `AnalysisCategory = 'LAB'|'IMAGING'|'OTHER'` (`diagnostics.types.ts:12`).
- `DiagnosticOrder` (`diagnostics.types.ts:44-75`): `id, patientProfileId, encounterId?, codeConceptId, categoryConceptId?, category?, basedOnNoteIds?, statusConceptId, priorityConceptId?, requesterProfileId?, createdAt, previousDiagnosticReportId?, duplicateOverrideReason?, previousServiceRequestId?`. **Sin** analitos, modalidad, región, lateralidad ni muestra.
- `NewDiagnosticOrder` (`diagnostics.types.ts:122-157`, extiende `ServiceRequestPerformerInput`): ídem, más `custodianTenantId, formInstanceId?, performerTenantId?, reusePreviousReport?`.
- `DiagnosticOrderCreated` (`:165-175`).
- `DiagnosticsClient.requestStudy` → `POST /clinical/service-requests` con `Idempotency-Key` y `sinAusentes` (`diagnostics.client.ts:145-165`); `checkDuplicateStudy` → `POST /clinical/service-requests/duplicate-check` (`:167-186`); lectura `GET /diagnostics/patients/:id/orders` (`:85-100`).
- **Contrato** (`core/mock/contract/api-contract.generated.ts`, generado por `scripts/gen-mock-contract.mjs` desde `openapi.json`): `CreateServiceRequestDto.keys = [custodianTenantId, patientProfileId, encounterId, formInstanceId, codeConceptId, categoryConceptId, category, basedOnNoteIds, priorityConceptId, requesterProfileId, performerTenantId, performerSelectionConceptId, performerPractitionerProfileId, suggestedPracticeSiteId, previousDiagnosticReportId, reusePreviousReport, duplicateOverrideReason]`.
- **El simulador valida ese contrato**: `mock-backend.interceptor.ts:106-113` responde 400 a toda clave no declarada. Una clave nueva en el cuerpo **rompe el alta en la maqueta** hasta regenerar el contrato (`yarn contract:refresh`, `yarn mock-contract:check`).

### 1.6 Simulador del alta

- `POST /clinical/service-requests` (`core/mock/handlers/diagnostics.handlers.ts:992-1068`): valida categoría (`service-request-category.mock.ts:54-76`) y notas, corre el detector de duplicado, y guarda en `orderList` (`fixtures/clinic.ts:695-720`, tipo `SimulatedOrder`) sólo `codeConceptId, categoryConceptId, priorityConceptId, encounterId, formInstanceId, reasonText, performer (pickPerformerFields), previousDiagnosticReportId, duplicateOverrideReason`.
- `pickPerformerFields` descarta `performerTenantId` a propósito (`service-request-performer.mock.ts:16-30`).
- `GET /diagnostics/patients/:id/orders` (`diagnostics.handlers.ts:1111-1124`) devuelve `orderList` filtrado.

### 1.7 Otros puntos de entrada para pedir un estudio

| Entrada | Dónde | Cómo pide |
|---|---|---|
| Casilla «Orden de análisis» de la consulta | `features/clinical-record/consultation/consultation.html:239-246` (dentro de `app-content-dialog size="lg"`, `:198-211`; config `consultation.ts:187-193`) | Monta `app-analysis-order-block` con `ofreceRespuesta`. **Es el único lugar** donde se monta el bloque |
| Cierre del formulario de especialidad (sugerencia IA) | `patient-chart/form-conclusion-block/form-conclusion-block.ts:186-190,337-352` (selector manual de categoría en `.html:103`, opciones `ts:146-148`) → `specialty-form-block.ts:1386-1400` llama `diagnostics.requestStudy({ codeConceptId, category, categoryConceptId?, formInstanceId })` | Un estudio, categoría elegida a mano. Sin antiduplicación |
| Receta (`medication-block`) | — | No pide estudios |
| Recepción (`lab-reception`) | `features/lab-reception/` | Sin ruta desde el 31/10 (redirige a Órdenes; `app.routes.ts:1495-1496`). Código muerto |

---

## 2. Lado receptor (cuenta laboratorio / imagenología)

### 2.1 Pantalla «Órdenes»

- Ruta `administration/laboratory-orders` (`app.routes.ts:345-346`); menú en `core/navigation/navigation.laboratory.ts:51`. Cuenta `DIAGNOSTIC_CENTER` (laboratorio e imagenología comparten pantalla).
- `features/laboratory/orders/laboratory-orders.html` (187 líneas): `app-page-header` → **una** `app-card` con `app-tabs appearance="browser"` por estado (`:8-23`) → buscador `app-search-field` (`:27-34`) → cola de subidas (`:47-120`) → `app-data-table` (`:122-131`).
- Columnas (`laboratory-orders.ts:172-185`): Paciente, **Estudio** (`studyCell` = `{{ order.studyName }}`, `.html:153`), Pedida, Estado, Acciones (`app-row-actions`).
- Búsqueda por paciente o estudio (`laboratory-orders.ts:150-170`).
- Lógica pura en `laboratory-orders.logic.ts` (pestañas `ORDER_TABS`, `actionsOf`).

### 2.2 Tipos y cliente

- `LabOrder` (`core/data-access/lab-portal/lab-portal.types.ts:280-290`): `orderId, studyName, patientName, requesterName, requestedAt, status, reason, files`. **Sin** categoría, analitos, modalidad, región, lateralidad ni prioridad.
- `LabPortalClient.listOrders` → `GET /diagnostics/lab/orders` (`lab-portal.client.ts:128-131`); transiciones `:141`. Solo existe en el simulador (P52).

### 2.3 Simulador del receptor

- `GET /diagnostics/lab/orders` (`core/mock/handlers/lab-orders.handlers.ts:139-149`) lee `labInboxOrders` (`diagnostics.handlers.ts:284-307`): **8 órdenes sembradas** de `STUDY-HEMOGRAMA/GLUCOSA/PERFIL-LIPIDICO/TSH/ORINA`, todas `SRQ-LAB`, `performerTenantId = TENANT_LABORATORIO`.
- `ordenDeRespuesta` (`lab-orders.handlers.ts:104-125`) arma la fila con `destinoDeOrden` (`lab-portal.handlers.ts:453-466`), que sólo resuelve `studyName = displayOf(codeConceptId)`, paciente y médico.
- **Defecto B2**: ningún código mueve una orden de `orderList` (lo que pide el médico) a `labInboxOrders`. Grep de `labInboxOrders.agregar`: cero resultados. Hoy, en la maqueta, **lo que pide el médico no aparece nunca en «Órdenes»**. Además la orden de laboratorio no lleva `performerTenantId` (el selector de ejecutor solo aparece en procedimientos, `performer-order-state.ts:97-100,132-134`), así que no hay a qué laboratorio dirigirla.
- La bandeja de recepción (`POST /diagnostics/service-requests/inbox`, `diagnostics.handlers.ts:1323-1400`) devuelve `specimens` por orden, pero tampoco analitos ni región.

### 2.4 Dónde mostrar el detalle elegido

1. **Celda «Estudio»** (`laboratory-orders.html:153`): debajo del nombre, una línea secundaria (`.orders__secondary`, ya existe en `:150,169`) con el resumen: «Hemograma · 4 de 9 componentes» o «Rayos X · Mano · Izquierda».
2. **Detalle completo**: `app-card-detail-panel` (`shared/components/molecules/card-detail-panel/card-detail-panel.ts:60-74`, inputs `heading`, `rows`, `triggerLabel`) dentro de la celda, o una acción «Ver detalle» en `app-row-actions` que abra `app-drawer-panel` (`organisms/drawer-panel/drawer-panel.ts:23-39`). Recomiendo el panel de detalle en la celda: no agrega acción ni modal.
3. **Búsqueda** (`laboratory-orders.ts:154-160`): sumar región/modalidad/analitos al texto buscado.
4. **Histórico del médico** (`analysis-order-block.html:133-137`) y la orden del paciente (`features/account/diagnostic-orders/`) deberían mostrar el mismo resumen.

---

## 3. Flujo de datos actual

```
Médico (consulta → casilla «Orden de análisis», modal lg)
  app-analysis-order-block
    app-concept-select  ← GET /system-context/dynamic-enums?target=clinical.service_requests.code_concept_id
                           (simulador: VS_DIAGNOSTIC_STUDY, códigos STUDY-*)
    tipo = studyFamilyOf(código)  (simulador: siempre OTHER)
    POST /clinical/service-requests/duplicate-check {patientProfileId, codeConceptId, encounterId}
    POST /clinical/service-requests {custodianTenantId, patientProfileId, codeConceptId, category,
                                     encounterId, formInstanceId?, basedOnNoteIds?, priorityConceptId?,
                                     performer…?, decisión antiduplicación?}
      simulador → orderList (sin performerTenantId)
    GET /diagnostics/patients/:id/orders → histórico (estudio, categoría, estado)

Laboratorio / imagenología («Órdenes»)
  GET /diagnostics/lab/orders  (solo simulador)
      simulador → labInboxOrders (sembradas, desconectadas de orderList)
  fila: paciente, studyName, fecha, estado, archivos
```

Granularidad que viaja hoy de punta a punta: **un `codeConceptId`**. Nada más.

---

## 4. Brechas

| # | Brecha | Evidencia | Peso |
|---|---|---|---|
| B1 | Simulador: todo estudio es `OTHER` por los códigos `STUDY-*` | `concepts.ts:1146`, `study-category.ts:56-62` | Bloquea el filtro por tipo en la maqueta |
| B2 | La orden del médico no llega a «Órdenes» del laboratorio | `lab-orders.handlers.ts:142`, `diagnostics.handlers.ts:1031`, sin `labInboxOrders.agregar` | Bloquea el «hoy no se ve al recibir» |
| B3 | El contrato no admite campos nuevos; el simulador da 400 | `api-contract.generated.ts` (`CreateServiceRequestDto`), `mock-backend.interceptor.ts:106-113` | Bloquea todo envío nuevo |
| B4 | No hay catálogo de analitos/componentes por análisis | §1.4 | Bloquea la vista tabla/lista de laboratorio |
| B5 | No hay relación modalidad ↔ estudio de imagen ↔ región | `VS_DIAGNOSTIC_MODALITY` sólo atado a `diagnostic_study_offerings` | Sin fuente, el filtro por modalidad se inventaría (regla 97.5.2) |
| B6 | Una orden = un estudio. Pedir 5 análisis hoy son 5 altas y 5 chequeos de duplicado | `analysis-order-block.ts:438-544` | Decisión de modelo (ver P1) |
| B7 | El tipo no se elige (decisión vigente + spec que lo fija) | `.html:45-46`, `spec.ts:313-333` | Hay que conciliar el pedido con la invariante «no pedir hemograma como imagen» |
| B8 | `DiagnosticOrder`/`LabOrder` no traen detalle; el histórico y «Órdenes» no tienen dónde mostrarlo | `diagnostics.types.ts:44`, `lab-portal.types.ts:280` | |
| B9 | El bloque no avisa al cerrar con cambios | sin `DRAFT_BLOCK`; `consultation.ts:560` | Con selección rica, pérdida silenciosa |
| B10 | `form-conclusion-block` es un segundo camino de alta sin granularidad | `specialty-form-block.ts:1386-1400` | Divergencia entre caminos |
| B11 | Familias CARDIO/PATHOLOGY/PROCEDURE/OTHER deben seguir pidiéndose | `study-category.ts:13`, performer solo en PROCEDURE | Si el «tipo» solo ofrece Lab/Imagen, el ECG y los procedimientos quedan inaccesibles |

---

## 5. Primitivas existentes reutilizables

| Necesidad | Primitiva | Selector · ruta | Entradas / salidas |
|---|---|---|---|
| Elegir tipo (Lab / Imagen / Otros) | **Control segmentado** (radiogroup, flechas) | `app-segmented-control` · `shared/components/molecules/segmented-control/segmented-control.ts:54-78` | `options: SegmentedOption<T>[]` (`value, label, icon?, description?, disabled?`, `segmented-control.types.ts:15-25`), `value: T` (required), `ariaLabel` (required), `size: 'sm'|'md'`, `wrap`; salida `valueChange<T>`. No es `<label>`: no choca con la spec `spec.ts:313-322` |
| Conmutar vista tabla / lista | Mismo `app-segmented-control` (ya lo usan `body-map.html:7`, `chart-panel.html:15`, `reporting-shell.html:30`) | idem | El directorio usa botones propios `.directorio__vista` (`organisms/directory-page/directory-page.html:154-171`, CSS `:255-294`) con `aria-pressed`, **no** reutilizables (están dentro del organismo, y el REPORTE previo midió 40 px en vez de 44) |
| Pestañas | `app-tabs` + `app-tab` · `molecules/tabs/tabs.ts:45-71`, `tab/tab.ts:30-54` | `selectedIndex` (model), `orientation`, `appearance: 'underline'|'browser'`; `app-tab`: `label` (req), `icon`, `disabled`. Activación manual; el panel cerrado no se dibuja (los valores deben vivir en señales) |
| Casilla | `app-checkbox` · `atoms/checkbox/checkbox.ts:29-69` | `checked` (model), `disabled`, `label`, `hasError`, `indeterminate`, `hideLabel` |
| Lista de casillas | `app-checkbox-group` · `molecules/checkbox-group/checkbox-group.ts:67,196-203` | `options: {value,label}[]`, `value` (model `string[]`), `disabled`, `hasError`, `allowOther`. CVA. Plano: no agrupa por análisis ni tiene «marcar todo» por grupo |
| Tabla con selección | `app-data-table` · `organisms/data-table/data-table.ts:59-217` | `state: ViewState<Row[]>` (req), `columns: ColumnDef<Row>[]` (req, `cell?: TemplateRef`), `trackBy` (req), `selectable`, `rowLabel`, `stackedOnMobile`, `maxHeight`, …; salida `selectionChanged`. **Limitación**: la selección es interna (`selectedRows`, `:219-330`), por referencia de fila y solo de la página visible; no se puede precargar ni sobrevive a un filtro. Para un selector persistente de analitos no sirve tal cual |
| Buscador | `app-search-field` · `molecules/search-field/search-field.ts:51-89` | `value` (model), `placeholder`, `debounceMs`, `loading`, `disabled`, `label`; salida `searched` |
| Select / combobox | `app-select` · `atoms/select/select.ts:71-120` | `value` (model), `options: SelectOption<T>[]` (`value,label,description?,disabled?`), `placeholder`, `ariaLabel`, `searchable` (auto si hay más de `SEARCH_FROM` opciones, `:161`), `hasError`, `multilineValue` |
| Select de catálogo | `app-concept-select` · `molecules/concept-select/concept-select.ts:52-107` | `target` (req), `value` (model), `disabled`, `valueField`, `labels`, `placeholder`, `clearable`. **No acepta un filtro** de opciones |
| Select agrupado (región por zona) | `app-tree-select` · `organisms/tree-select/tree-select.ts:104-130` | `value` (model), `groups: {label, items}[]`, `placeholder`, `dialogTitle`, `searchPlaceholder`, `emptyMessage` |
| Autocompletar con servidor | `app-reference-combobox` · `molecules/reference-combobox/reference-combobox.ts:85-154` | `value` (model), `options`, `loading`, `minQueryLength`; salidas `searched`, `selectionChange` |
| Chips de lo elegido | `app-chip` · `atoms/chip/chip.ts:37-65` | `variant`, `size`, `label`, `removable`, `selectable`, `selected` (model); salida `removed` |
| Tarjeta | `app-card` · `molecules/card/card.ts:34-53` | `variant`, `padding`, `interactive`; salida `activated` |
| Detalle plegable en la fila | `app-card-detail-panel` · `molecules/card-detail-panel/card-detail-panel.ts:60-74` | `heading` (req), `rows: CardDetailRow[]` (req), `triggerLabel` |
| Lista de hechos | `app-fact-list` · `molecules/fact-list/fact-list.ts:46-68` | `hechos` (req), `disposicion`, `etiqueta` |
| Vacío | `app-empty-state` · `molecules/empty-state/empty-state.ts:22-35` | `title` (req), `description`, `variant` |
| Estados M34 | `ViewState<T>` + fábricas `loading/empty/ready/validation/forbidden/notFound/stale/offline/unexpectedError` (`core/view-state/view-state.ts:29-116`); host `app-view-state-host` (`organisms/view-state-host/view-state-host.ts:49-72`: `state` req, salidas `retry`, `refresh`) | |
| Formulario paginado | `app-paginated-form` · `organisms/paginated-form/paginated-form.ts:176-327` | Requiere `form: FormGroup` y `paginas`. El bloque es de señales, sin `FormGroup`: adoptarlo exige reescribir el formulario. `check-form-pages.mjs` solo cuenta plantillas con `[formGroup]`, así que el bloque no cae en el tope de 4 campos, aunque la regla de fondo aplica |
| Silueta 2D | `app-body-map` · `organisms/body-map/body-map.ts:154-189` | `zonas` (req), `value` (model), `marcadas`, `sexo`. Usado por `symptom-check`. Alternativa liviana al 3D, fuera de alcance aquí |
| Visor 3D | `app-anatomy-viewer` · `organisms/anatomy-viewer/anatomy-viewer.ts:75-92` | `parts`, `modelUrls`, `layers`, `sex`, `selected`, `related`, `label`; salidas `picked`, `statusChange`. Hoy solo en `features/glossary/glossary-anatomy-atlas.html`. **Detalle: otro informe** |

No hace falta crear un átomo nuevo. Sí hacen falta dos o tres moléculas/organismos de dominio (§6).

---

## 6. Propuesta de componentes

Principio: el `analysis-order-block.ts` ya está 35 líneas **por encima** de su techo (684 vs 649). Todo lo nuevo va en archivos propios y el bloque debe **adelgazar** (mover el histórico a un componente aparte es lo más rentable).

### 6.1 Estructura dentro del bloque

```
app-analysis-order-block (orquestador, señales, envío)
├─ app-form-response-picker                      (sin cambios)
├─ app-segmented-control «Tipo de estudio»       (Laboratorio | Imagenología | Otros)
│    → filtra el catálogo; la categoría SIGUE saliendo del estudio (invariante B7)
├─ @switch tipo
│   ├─ 'LAB'     → app-lab-analysis-picker       (NUEVO)
│   ├─ 'IMAGING' → app-imaging-study-picker      (NUEVO; aloja el 3D)
│   └─ 'OTHER'   → app-concept-select «Estudio» filtrado (como hoy; CARDIO/PAT/PRO/OTHER)
├─ «Prioridad», app-performer-selector           (sin cambios)
├─ app-form-actions «Pedir estudio»
└─ app-analysis-order-history                    (NUEVO, extraído: .html:119-203 + aFila/estudios/informesSueltos)
```

### 6.2 Componentes nuevos

Ubicación: son de dominio clínico, no genéricos → `features/clinical-record/patient-chart/analysis-order-block/<nombre>/` (misma carpeta que `performer-selector`). Nada en `shared/` salvo que aparezca un segundo consumidor.

**a) `app-lab-analysis-picker`** — `analysis-order-block/lab-analysis-picker/lab-analysis-picker.{ts,html,css}` (organismo de feature)

- Entradas:
  - `analyses = input.required<readonly LabAnalysisOption[]>()` — `{ conceptId, code, label, components: readonly { conceptId, code, label }[], specimenTypeLabel?: string }` (forma a definir con la API, P2).
  - `state = input<ViewState<null>>(ready(null))` — para S1/S2/S8/S9 del catálogo.
  - `disabled = input(false)`.
- Modelo: `selection = model<ReadonlyMap<string, ReadonlySet<string>>>(new Map())` — análisis → componentes elegidos (un análisis sin componentes elegidos = «completo», a confirmar P3).
- Estado interno (señales): `view = signal<'grid'|'list'>('grid')` (recordable en `localStorage` con try/catch, opcional), `query = signal('')`, `visible = computed(...)` filtrado por análisis **y** componente, normalizado sin tildes.
- Vista **tabla de celdas** («grid»): rejilla CSS de tarjetas por análisis; cabecera con `app-checkbox` (tri-estado con `indeterminate`) que marca/desmarca todos sus componentes; celdas `app-checkbox` por componente. Columnas por ancho (1 / 2 desde 780 px / 3 desde 1120 px, composition-rules §5).
- Vista **lista**: `<ul>` por análisis con `app-checkbox` padre y sublista de componentes (o `app-accordion` `multi`), una línea por ítem.
- Arriba: `app-search-field` + `app-segmented-control` (Tabla | Lista, `ariaLabel="Cómo ver los análisis"`). Debajo: resumen con `app-chip removable` por análisis elegido y contador.
- Salidas: solo el `model` (`selectionChange` implícito).
- Lógica pura en `lab-analysis-picker.logic.ts` (filtrar, alternar padre/hijo, tri-estado, serializar) con spec propia: así el componente queda chico.

**b) `app-imaging-study-picker`** — `analysis-order-block/imaging-study-picker/…`

- Entradas: `modalities = input.required<readonly SelectOption<string>[]>()`, `studies = input.required<readonly ImagingStudyOption[]>()` (`{conceptId, label, modalityCode?}`), `regions = input.required<readonly BodyRegionOption[]>()` (`{id, label, group, side?}` — viene del atlas), `lateralities = input<readonly SelectOption<string>[]>([])`.
- Modelos: `modality = model<string|null>(null)`, `study = model<string|null>(null)`, `region = model<string|null>(null)`, `laterality = model<string|null>(null)`.
- Plantilla: `app-segmented-control` (o `app-select` si son más de 5) para modalidad → `app-select` «Estudio» filtrado por modalidad → **ranura del 3D** → debajo `app-tree-select` (regiones agrupadas) **o** `app-select searchable` «Parte del cuerpo» → `app-segmented-control` lateralidad (solo si la región es par).
- **Sincronía 3D ↔ select**: una sola fuente de verdad, `region` (model). El visor recibe `[selected]="region() ? [meshIdDe(region())] : []"` y su `(picked)` escribe `region.set(regionDeMesh($event))`; el select hace `[(value)]="region"`. Sin `effect` de ida y vuelta (evita bucles). La lateralidad se puede deducir de `AnatomyPart.side` cuando la malla es lateral (F9), sobreescribible.
- El visor se monta con `@defer (on viewport)` y respeta SSR (detalle en el informe del 3D).

**c) `app-analysis-order-history`** — `analysis-order-block/analysis-order-history/…` (extracción, sin cambio de comportamiento)

- Entradas: `patientProfileId`, `encounterId`, `reloadToken = input(0)` (o método público `recargar()`); muestra la línea de detalle nueva (analitos/región).
- Objetivo: bajar `analysis-order-block.ts` por debajo del techo de 649.

**d) Ajuste opcional en `ConceptSelect`** (`shared/components/molecules/concept-select/concept-select.ts`): `include = input<((o: DynamicEnumOption) => boolean) | null>(null)` para filtrar por familia en el caso «Otros». Alternativa sin tocar `shared/`: armar las opciones en el bloque y usar `app-select`.

### 6.3 Archivos a modificar

| Archivo | Cambio |
|---|---|
| `core/data-access/diagnostics/diagnostics.types.ts` | Campos aditivos y opcionales en `NewDiagnosticOrder` y `DiagnosticOrder` (p. ej. `requestedComponentConceptIds?`, `modalityConceptId?`, `bodySiteConceptId?`/`bodyStructureRef?`, `lateralityConceptId?`, `specimenTypeConceptId?`); nombres finales los fija la API (H1 del plan previo) |
| `core/data-access/diagnostics/diagnostics.client.ts` | Nada si los campos son planos (pasa por `sinAusentes`). Nueva lectura del catálogo de análisis con componentes si la API publica un endpoint (P2) |
| `core/data-access/lab-portal/lab-portal.types.ts` | `LabOrder` + `category`, `detail` (resumen legible ya resuelto por el servidor, para no traducir uuids en la bandeja) |
| `core/mock/contract/api-contract.generated.ts` | **Regenerar** (`yarn contract:refresh`) cuando la API publique el DTO; no editar a mano |
| `core/mock/handlers/diagnostics.handlers.ts` (1666, techo 1637, ya excedido) | Guardar los campos nuevos. Para no crecer: mover la lógica nueva a `service-request-detail.mock.ts` (como ya se hizo con `service-request-category.mock.ts`) |
| `core/mock/fixtures/clinic.ts` | `SimulatedOrder` + campos nuevos |
| `core/mock/fixtures/concepts.ts` (1680, techo 1398) | Corregir B1 (códigos `LAB_*`/`IMG_*` o un mapa explícito código→familia) y catálogo de analitos **en archivo aparte** `fixtures/lab-analytes.data.ts` (los `*.data.ts` están exentos del tope) con procedencia |
| `core/mock/handlers/misc.handlers.ts` (785, techo 771) | Regex de targets nuevos (modalidad/lateralidad/región de `service_requests`) si la API los publica por `dynamic-enums` |
| `core/mock/handlers/lab-orders.handlers.ts` (180) | Puente B2: las órdenes del médico dirigidas a un laboratorio entran a la bandeja, y `ordenDeRespuesta` devuelve el detalle |
| `analysis-order-block.{ts,html,css}` | Tipo con segmentado, `@switch`, armado del cuerpo, `DRAFT_BLOCK` (B9); extraer histórico |
| `features/laboratory/orders/laboratory-orders.{html,ts}` | Línea de detalle en la celda «Estudio», panel de detalle, búsqueda ampliada |
| `form-conclusion-block` / `specialty-form-block.ts:1386-1400` | Decidir (P6): o se queda en «un estudio sin detalle», o abre el mismo selector |

### 6.4 Orden sugerido (franjas, en orden de dependencias)

1. **Modelo + API** (H1 del plan previo): campos en `service_requests`, DTO, OpenAPI, catálogo de analitos con procedencia, endpoint de lectura del catálogo. Sin esto el front no puede mandar nada (B3).
2. **Contrato y simulador**: regenerar contrato; corregir B1; puente B2; fixtures de analitos y regiones. Specs de handlers.
3. **Extraer `app-analysis-order-history`** sin cambio de comportamiento (baja el bloque bajo su techo). Specs verdes antes de seguir.
4. **Tipo con segmentado + filtro de catálogo** (mantiene la invariante; ajustar la spec `:313-333` con un caso nuevo, sin quitar el que prueba que la categoría sale del estudio).
5. **`app-lab-analysis-picker`** (lógica pura + componente) e integración en el envío.
6. **`app-imaging-study-picker`** con el select primero; el 3D se enchufa después en su ranura (franja del otro agente).
7. **Receptor**: `LabOrder` con detalle, celda y panel en «Órdenes»; histórico del médico.
8. `DRAFT_BLOCK` en el bloque; evidencia visual en 390/768/1440, claro y oscuro, doble revisión; Playwright de punta a punta (pedir → recargar → ver en «Órdenes»).

---

## 7. Specs y Playwright que tocan estas pantallas

Unitarias (Vitest):
- `features/clinical-record/patient-chart/analysis-order-block/analysis-order-block.spec.ts` (907 líneas; catálogo con `LAB_CBC`/`IMG_RX_TORAX`, `:28-42`; «no ofrece un selector de tipo», `:313-333`; categoría por estudio, `:339-356`; cuerpo del alta, `:378-414`; ejecutor, `:692-905`).
- `…/duplicate-study-warning-dialog/duplicate-study-warning-dialog.spec.ts`, `…/performer-selector/*.spec.ts` (3).
- `features/clinical-record/patient-chart/specialty-form-block/specialty-form-block.spec.ts:1640-1680` — compara el cuerpo del alta con `toEqual` **exacto**: cualquier clave nueva siempre presente lo rompe; los campos nuevos deben omitirse cuando no hay valor.
- `features/laboratory/orders/laboratory-orders.spec.ts`, `laboratory-orders.logic.spec.ts` (24 tests según el REPORTE previo).
- `core/data-access/diagnostics/diagnostics.client.spec.ts`, `core/mock/handlers/diagnostics.handlers.spec.ts`, `service-request-category.mock.spec.ts`, `lab-inbox.handlers.spec.ts`, `clinical.handlers.spec.ts`, `core/mock/mock-backend.spec.ts`.

Playwright (`playwright/`):
- `consulta-rejilla.spec.ts:169-174` — usa `.estudios__formulario`, `estudios-lista`/`estudios-vacio`, `estudios-error`, `estudios-historico-error`. Conservar esas clases y `data-testid`.
- `carril-insurance-antifraud-duplicates.spec.ts:205-232,292,336,375` — abre la casilla `ordenes`, espera el título «Laboratorio e imagenología», elige `combobox /^Estudio\b/` **y** `combobox /^Tipo\b/`. El combobox «Tipo» **ya no existe** en la plantilla: esta prueba está desactualizada hoy, independientemente de este cambio.
- `hito2-laboratory-insurance.spec.ts:146` — `lab-orders-uploads`; recorre «Órdenes».
- `modales-fuera-de-consulta.spec.ts`, y los guiones `.mjs` `expediente-cuadra-con-la-consulta.mjs`, `evidencia-d4-cierre.mjs`, `diagnostico-presuntivo-libre.mjs`.
- Para el 3D ya hay `atlas-anatomico-3d.spec.ts` y `atlas-anatomico-en-pantalla.spec.ts` (los mira el otro agente).

Gates de tamaño y arquitectura:
- `scripts/check-max-lines.mjs`: techo 600 por archivo nuevo; congelados en `scripts/baselines/max-lines.json`; exentos `*.spec.ts`, `*.generated.ts`, `*.data.ts`. **Ya en rojo en `dev`** (123 archivos); entre ellos, los de este cambio: `analysis-order-block.ts` 684/649, `diagnostics.handlers.ts` 1667/1637, `concepts.ts` 1681/1398, `lab-portal.handlers.ts` 1010/1008, `consultation.ts` 909/850, `misc.handlers.ts` 786/771. Regla: no hacer crecer ninguno; lo nuevo, en archivos nuevos.
- `scripts/check-architecture.mjs`: sin ciclos; capas `features → shared → core`; HTTP solo en `core/data-access/`. Los componentes nuevos en `features/` pueden usar `shared/`; el mock no puede importar de `features/`.
- `scripts/check-form-pages.mjs`: tope de 4 campos por pantalla en plantillas con `[formGroup]` (el bloque no usa `FormGroup`, pero con tipo + selector + prioridad + ejecutor + respuesta ya roza el espíritu de la regla).
- `yarn mock-contract:check` (`gen-mock-contract.mjs --check`), `check-mock-vs-client.mjs`, `check-css-tokens.mjs`, `check-colores-sueltos.mjs`, `check-contrast.mjs`.

---

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Volver a habilitar «pedir hemograma como imagen» al agregar el selector de tipo | Orden en la cola equivocada (el defecto que `study-category.ts:304-311` cerró) | El tipo **filtra**; la categoría que viaja sigue saliendo del estudio |
| Inventar analitos por análisis o modalidad por estudio | Catálogo contaminado (regla 97.5.2) | Solo con fuente (p. ej. paneles LOINC) y procedencia; si no, el médico elige sin preselección |
| Mandar claves que el DTO no declara | 400 en la API y en el simulador | Primero API + contrato; campos opcionales y omitidos cuando faltan |
| Varios análisis = varias órdenes | N chequeos de duplicado, N diálogos, alta parcial si falla la tercera | Decidir P1; si son N altas, secuenciales con informe de fallos (patrón `ejecutarEnOrden` de `specialty-form-block.ts`) |
| Bloque y mocks ya por encima del techo | `check-max-lines` empeora | Extraer el histórico; lógica nueva en archivos nuevos y `*.data.ts` |
| Pérdida de una selección larga al cerrar el modal | Retrabajo del médico | Implementar `DRAFT_BLOCK` (B9) |
| El modal `lg` mide 46–57,5 rem: rejilla de analitos + 3D apretados | Mala lectura en tablet | Considerar `size="xl"` (70 rem) para la casilla `ordenes`; medir en 768 |
| Peso del visor 3D dentro de la consulta | Carga lenta | `@defer`, sólo en Imagenología |
| Divergencia entre los dos caminos de alta (bloque y cierre del formulario) | Órdenes con y sin detalle | Decidir P6 |
| La pantalla «Órdenes» solo existe contra el simulador (P52) | Lo visto en maqueta no se puede probar contra la API | Declararlo en la evidencia; no afirmar «hecho» contra la API |
| Spec de Playwright antifraude ya desactualizada (busca «Tipo») | Rojo atribuido al cambio nuevo | Registrarla aparte antes de empezar |

---

## 9. Preguntas abiertas (solo lo que el código no responde)

1. **P1 · ¿Una orden con varios análisis o una orden por análisis?** Hoy la API crea una `service_request` por `codeConceptId`. ¿Se agrupan (requisición/«grupo de órdenes») o se crean N órdenes ligadas? Afecta antiduplicación, la bandeja del laboratorio y el contrato.
2. **P2 · ¿De dónde sale la lista de componentes de cada análisis?** No hay fuente en el front ni en INLASA. ¿La API publicará un catálogo (p. ej. paneles LOINC con miembros) y por qué endpoint?
3. **P3 · Semántica de «elegir componentes»**: ¿el médico puede pedir un hemograma **parcial** (solo hemoglobina) o los componentes son informativos y el análisis se pide entero? ¿Un análisis sin componentes marcados significa «completo»?
4. **P4 · Imagenología: ¿el «estudio» sigue siendo un código del catálogo** (`IMG_RX_TORAX`) filtrado por modalidad, o la orden pasa a ser «modalidad + región» sin código de estudio fijo? ¿Hay una fuente para la relación modalidad ↔ estudio?
5. **P5 · Catálogo de regiones del select**: ¿se usan directamente las estructuras UBERON/FMA del atlas (miles de piezas) o una lista clínica reducida (mano, rodilla, tórax…) mapeada a mallas? Eso decide si el select es `app-select` o `app-tree-select`.
6. **P6 · ¿El cierre del formulario de especialidad (sugerencia IA) también debe pedir análisis con componentes y región**, o se queda en un estudio sin detalle?
7. **P7 · ¿A qué laboratorio/centro va la orden de laboratorio o imagen?** Hoy no se elige ejecutor fuera de procedimientos y sin `performerTenantId` la orden no llega a ninguna bandeja. ¿La elige el médico, el paciente después, o el sistema?
8. **P8 · ¿Qué lado «Otros»** debe ofrecer el selector de tipo: cardiología, anatomía patológica y procedimientos juntos en un tercer segmento, o un segmento por familia?
