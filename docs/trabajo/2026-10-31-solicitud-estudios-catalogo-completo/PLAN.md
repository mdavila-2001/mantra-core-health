# Plan — Solicitud de estudios con catálogo completo: análisis + componentes, modalidad + región 3D

- Fecha: 2026-10-31 · Rama: `claude/brave-carson-h23qzh` en los tres repos · Predecesor: [`../2026-10-31-estudios-muestra-y-region-corporal/PLAN.md`](../2026-10-31-estudios-muestra-y-region-corporal/PLAN.md) (lo **amplía y reemplaza**; sus correcciones están en `hallazgos-api-modelo.md` §0) y [`../2026-10-31-ordenes-compactas-laboratorio-imagenologia/`](../2026-10-31-ordenes-compactas-laboratorio-imagenologia/) (pantalla «Órdenes» del receptor, hoy contra simulador).
- Repos afectados: `mantra-core-health-model` → `mantra-core-health-api` → `mantra-core-health` (front). App móvil: fuera de alcance (declarado).
- Estado de la entrega: **planificado**. Cinco investigaciones en paralelo terminadas (archivos disjuntos); ningún código de producto escrito.
- **Resultado observable:** el médico, al pedir un estudio, elige el tipo; en Laboratorio marca análisis y sus componentes en una tabla de casillas o en una lista (conmutables) con buscador; en Imagenología elige modalidad, estudio y parte del cuerpo tocando el cuerpo 3D o en un select debajo, sincronizados en ambos sentidos, con lateralidad. Al guardar y recargar, la orden vuelve con todo eso, y la cuenta del laboratorio o de la imagenología lo ve en su pantalla «Órdenes».
- **Kill-test:** pedir «Hemograma: hemoglobina, hematocrito, plaquetas» y «RX de mano izquierda PA y oblicua» desde la ficha del paciente; recargar; abrir «Órdenes» como el centro ejecutor. Si la orden no vuelve con los tres componentes, o la RX no trae modalidad + región MANO + lateralidad IZQ, o el receptor no la ve, **no está hecho**.

## 1. Pedido del usuario (31/10/2026, literal resumido)
Hoy la granularidad no se ve ni al pedir (médico) ni al recibir (imagenología y laboratorio). El médico primero elige el tipo de análisis. Laboratorio: los *features* como tabla de celdas chequeables **o** lista (ambas vistas) + buscador. Imagenología: tipo (rayos X, tomografía…) y parte del cuerpo con el modelo 3D que ya tenemos; debajo un select sincronizado en los dos sentidos. Todo el catálogo posible de servicios y de *features* por análisis, con investigación profunda. Agentes en paralelo; máximo alcance; sin dudas.

## 2. Insumos producidos (leer antes de implementar)

| Archivo | Qué trae |
|---|---|
| `hallazgos-front.md` | Bloque `analysis-order-block`, pantalla «Órdenes», simulador, primitivas reutilizables, brechas B1–B11, componentes propuestos, specs/Playwright/techos afectados |
| `hallazgos-api-modelo.md` | Esquema real (MikroORM 7, modelo 4.2.79), terminología, corpus LOINC versionado, DDL tentativo `v4.2.80`, endpoints C1–C6, validaciones V1–V11, seeders, autorización |
| `hallazgos-cuerpo-3d.md` | Visor `app-anatomy-viewer`, atlas (930 mallas, 669 estructuras), diseño de `app-body-region-picker`, cambios V1–V3 al visor, script generador del mapeo |
| `catalogo/laboratorio.json` + `laboratorio-FUENTES.md` | **532 análisis, 690 componentes, 49 muestras, 20 secciones**; LOINC 2.83 verificado uno a uno (tx.fhir.org); 47 `LAB_*` de la API enlazados en `codigo_api_existente`; prioridades bolivianas (Chagas, dengue, malaria, ETMI) |
| `catalogo/imagenologia.json` + `imagenologia-FUENTES.md` | **14 modalidades (DICOM CID 29), 4 lateralidades, 156 regiones (Annex L + SNOMED verificado), 471 estudios** (LOINC 433, RadLex 343) con proyecciones, contraste, vía y preparación |
| `catalogo/regiones-cuerpo-3d.json` | Región radiológica → mallas del atlas (izq/der/centro), capa preferida, caso sin malla. Generado por script, nunca a mano. **En realineación** a los códigos de `imagenologia.json` |

## 3. Decisiones adoptadas (para no tener dudas)
Cada una tiene un responsable de confirmación; mientras no se desdiga, **se implementa así**.

| # | Decisión | Por qué | Confirma |
|---|---|---|---|
| D1 | **El catálogo pedible pasa a ser el investigado** (`laboratorio.json` + `imagenologia.json`), con código interno `MAYUSCULAS_SNAKE` y enlace verificado a LOINC / RadLex / DICOM / SNOMED. Los 88 códigos locales siguen válidos (47 `LAB_*` ya enlazados por `codigo_api_existente`; los `IMG_*` se enlazan igual). Esto **supera** la nota «códigos locales y no LOINC» de `clinical.concepts.ts:197-221` → ADR nuevo en la API | El usuario pide «todo el catálogo posible»; la nota rechazaba LOINC *sin verificar*; acá cada código está verificado y con procedencia | Usuario (ADR) |
| D2 | **Un renglón de `service_requests` por análisis/estudio** + `requisition_id` que agrupa lo pedido junto. `POST /clinical/requisitions` crea N renglones atómicos | Todo (muestras, acesiones, informes, reclamos) cuelga de `service_request_id`; no se rompe nada | API |
| D3 | **Componentes siempre explícitos**: al pedir un panel desplegable se escriben los componentes marcados; por defecto vienen todos marcados (`seleccionado_por_defecto`); el médico desmarca. Órdenes viejas: `componentsSpecified:false` («estudio completo, sin detalle»). Un panel con 0 componentes marcados no se puede pedir (422 `COMPONENTS_EMPTY`) | «Todo» y «sin dato» no se confunden; sin backfill clínico inventado | Clínica |
| D4 | **Imagen = estudio del catálogo (fija modalidad y región por defecto) + región editable dentro de las permitidas + lateralidad + contraste (sin / con / sin y con, más vía)**. Una región por renglón; bilateral es un valor de lateralidad; varias regiones = varios renglones | Es como lo codifican RadLex y el Arancel Santa Cruz | Radiología |
| D5 | **La muestra** la propone el catálogo (`analisis.muestra`, HL7 0487 + SNOMED verificados) y queda editable entre las de `specimen-type` | Evita elegir 532 veces lo obvio sin inventar: la fuente es LOINC/HL7 | Laboratorio |
| D6 | **El visor 3D gana `focus`, `pickedAt` y `hoverLabel`** (retrocompatibles; el glosario no cambia). Sin `focus` el select no puede enfocar el 3D | Lo exige el pedido | — |
| D7 | **Tipo con `app-segmented-control`: Laboratorio · Imagenología · Otros** (cardiología, patología, procedimientos). El tipo **filtra** el catálogo; la categoría que viaja a la API sigue saliendo del estudio (no vuelve «hemograma como imagen») | Invariante vigente `study-category.ts:304-311` | — |
| D8 | **El receptor pasa a una bandeja real** (`POST /diagnostics/service-requests/worklist`, `scope LAB\|IMAGING`, estados derivados de datos reales) que reemplaza `/diagnostics/lab/orders` del simulador. Mapeo de estados: `PENDING→Borrador`, `RECEIVED→Recibida`, `IN_PROCESS→Procesada`, `REPORTED→Subidos`, `CANCELLED/REJECTED` | La API real no tiene el ciclo del simulador y hay que verlo «al recibir» | Front + API |
| D9 | **Ejecutor obligatorio para LAB e IMAGING**: el `app-performer-selector` (hoy sólo procedimientos) se ofrece también para laboratorio e imagen; sin `performer_tenant_id` la orden no llega a nadie. `SR_PERF_PATIENT_CHOICE` queda permitido y se declara que esa orden no aparece en bandeja hasta que el paciente elija (fuera de alcance) | Hecho F de `hallazgos-api-modelo.md` §2.3 | Producto |
| D10 | **Antiduplicación** con clave `(código, región, lateralidad)` en imagen y `(código) + conjunto de componentes` en laboratorio: pedir componentes **no cubiertos** por el informe previo no es duplicado | Evita falso positivo mano izq/der | API |
| D11 | **Tipo de hueso** se deriva en lectura del `is_a` de UBERON cuando existe; no se persiste ni se escribe a mano | Regla 97.5.2 | — |
| D12 | **Sin backfill.** Expand-only: columnas nulas y tabla nueva. Contracción (obligatoriedad) en una franja posterior | Regla 97 | — |
| D13 | **Un PR por repo hacia `dev`** (la rama `test` está dada de baja; `mockup` sólo si se pide). Orden de despliegue modelo → API → front | `CLAUDE.md` § Git | — |
| D14 | Agentes en **paralelo con archivos disjuntos** (autorización explícita del usuario para esta tarea), **un solo navegador de pruebas** a la vez, y quien implementa **no aprueba** | Regla de la casa 70 relajada como en reportería e Insights | — |
| D15 | Licencias: aviso LOINC en el detalle del catálogo y en pantalla; BodyParts3D CC BY-SA y UBERON/FMA CC BY en la ficha del visor | Obligación de las fuentes | — |

## 4. Hechos clave (resumen; detalle con ruta:línea en los hallazgos)
- F1 La orden viaja con **un** `codeConceptId`; nada más (`analysis-order-block.ts:507-524`).
- F2 El simulador rompe el tipo (`STUDY-*` → `OTHER`) y lo pedido nunca entra a `labInboxOrders` (B1, B2).
- F3 `CreateServiceRequestDto` sin campos nuevos; simulador y API rechazan claves no declaradas (B3).
- F4 `clinical.service_requests` sin muestra/modalidad/región/lateralidad/contraste y sin tabla de componentes; lo **realizado** sí los tiene (`diagnostics.imaging_series`, `laboratory_work_order_tests`).
- F5 LOINC/SNOMED/DICOM declarados y **vacíos**; UBERON/FMA/RadLex inexistentes en la base. Hay cargadores con procedencia (`tools/terminology-import/{lab-tests,dictionaries}`), ninguno corrido en producto.
- F6 El visor resalta desde afuera (`selected`) pero no encuadra ni emite el punto tocado; 930 mallas; lado izquierdo del paciente en +x.
- F7 Techos ya excedidos en `dev`: `analysis-order-block.ts` 684/649, `diagnostics.handlers.ts`, `concepts.ts`, `lab-portal.handlers.ts`, `consultation.ts`, `misc.handlers.ts`. Lo nuevo va en archivos nuevos / `*.data.ts`.
- F8 Copia de despliegue de parches en la API **desfasada** respecto del modelo (faltan v4275–v4279); colisiones de numeración v4249/v4264/v4265. Siguiente libre: **v4.2.80**.

## 5. Alcance
- **IN:** catálogos (lab + imagen) sembrados con procedencia; esquema `v4.2.80`; API C1–C6 y V1–V11; front médico (tipo, picker de laboratorio tabla/lista + buscador, picker de imagen con 3D ↔ select, lateralidad, contraste, muestra, ejecutor); histórico del médico y orden del paciente con el detalle; pantalla «Órdenes» del receptor contra la bandeja real con el detalle; simulador corregido (B1, B2) y contrato regenerado; evidencia visual con doble revisión; Playwright de punta a punta.
- **OUT:** DICOM/PACS; app móvil; marketplace donde el paciente elige el ejecutor; precios; contracción a obligatorio; carga del corpus LOINC completo; revisión clínica de nombres en español (se registra como pendiente con responsable).

## 6. Franjas (en orden de dependencias)

### H0 — Catálogos listos para sembrar
**CA:** Dado `laboratorio.json` e `imagenologia.json`, cuando se corre el validador, entonces 0 códigos inventados (todo `loinc`/`snomed`/`dicom` no nulo existe en su fuente), 0 referencias rotas (sección, muestra, modalidad, región, padre) y `regiones-cuerpo-3d.json` usa sólo códigos de `imagenologia.json`.
**DoD:** script de validación en `tools/` del API (lee los tres JSON) · salida pegada · lista de `verificar:true` con responsable clínico.
**Estado:** A MEDIAS (JSON hechos y validados; realineación 3D en curso).

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H0.M1 | Realinear `regiones-cuerpo-3d.json` a los códigos de `imagenologia.json` | Toda región del mapeo existe en el catálogo | salida del script + conteo por tipo | EN CURSO |
| H0.M2 | Enlazar los 27 `IMG_*` locales a estudios de `imagenologia.json` (`codigo_api_existente`) | 27/27 con enlace o `sin_equivalente` justificado | diff del JSON | TODO |
| H0.M3 | Validador cruzado de los tres JSON (`tools/catalogs/check-study-catalogs.mjs`) | exit 0 | salida | TODO |
| H0.M4 | Registrar pendientes clínicos en `catalogo/PENDIENTES-CLINICOS.md` con responsable (170 filas: 10 LOINC de laboratorio sin verificar, 70 perfiles `verificar_composicion`, 12 muestras sin código, 31 estudios de imagen sin código + 9 con LOINC sin verificar, 34 lateralidades por criterio, 2 LOINC desaconsejados, nombres en español) | archivo existe | generado por script | HECHO |

### H1 — Modelo (`mantra-core-health-model`)
**CA:** Dado el parche `v4.2.80` aplicado en una base de prueba, cuando se consulta `\d clinical.service_requests` y `\d clinical.service_request_components`, entonces existen las 6 columnas, la tabla, los 3 CHECK, los índices y la política RLS; segunda aplicación = 0 cambios.
**DoD:** `.puml` → `gen_ddl.py all` → `gen_integrity.py` → `check_ddl_sources.py` verdes · salida de aplicar dos veces · re-ejecución de `v4226` · README del modelo actualizado · copia a `mantra-core-health-api/database/SQL/patches/` **después** de resolver el desfase (F8).

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.M1 | Resolver desfase de `patches/` entre modelo y API (sólo documentar y copiar lo que falta; no renumerar lo aplicado) | `diff` vacío | salida del `diff` | TODO |
| H1.M2 | `diagram_08_clinical.puml`: columnas `requisition_id`, `specimen_type_concept_id`, `modality_concept_id`, `body_site_concept_id`, `laterality_concept_id`, `contrast_concept_id`; entidad `service_request_components` | DDL regenerado sin ruido | diff | TODO |
| H1.M3 | Parche `2026-11-xx_v4280_service_request_detalle.sql` (DDL de `hallazgos-api-modelo.md` §3.b) | idempotente | 2 corridas | TODO |
| H1.M4 | Índice compuesto de bandeja `(performer_tenant_id, status_concept_id, created_at, id)` | existe | `\di` | TODO |
| H1.M5 | `docs/data-catalog/*` y `model-manifest.yaml` → 4.2.80 | consistente | diff | TODO |

### H2 — API (`mantra-core-health-api`)
**CA:** Dado un médico con relación asistencial, cuando hace `POST /clinical/requisitions` con un hemograma de 3 componentes y una RX de mano izquierda, entonces 201 con `requisitionId` y dos renglones con su detalle; `GET /clinical/service-requests/:id` lo devuelve; cualquier regla V1–V11 violada responde 422 `PRECONDITION_FAILED` con `details.itemIndex/field/reason`; la bandeja del centro ejecutor lo lista con el detalle y otro tenant recibe lista vacía / 404.
**DoD:** `gen_entities.py` · `yarn orm:catalog` · seeders dos corridas (segunda = 0 filas) · `yarn lint` · `yarn typecheck` · pruebas unitarias e integración nuevas verdes · `yarn docs:openapi:generate` + `check-breaking` sin rupturas · `yarn inventario:deriva-bd` verde · matriz de autorización negativa (otro tenant, rol insuficiente, sin token, paciente, `RLS_ENFORCE=true`) con `curl` pegado · ADR «catálogo pedible con códigos verificados» (D1).

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Entidades regeneradas + ADR D1 | compila | diff | TODO |
| H2.S1.M2 | Seeder de catálogos desde los JSON (conceptos, `part-of` panel→componente con `ordinal`, `has-modality`, región por estudio, muestra por análisis), **con `concept_relationship_evidence` por relación** citando `fuente` del JSON; ids `md5('mantra:<sistema>:<código>')` compatibles con `load-lab-tests.mjs`; value sets `service-request-code` (ampliado), `service-request-imaging-modality`, `imaging-body-structure`, `imaging-contrast`; targets nuevos en `specimen-type` y `condition-laterality` | 2.ª corrida = 0 inserciones | salida de 2 corridas + conteos | TODO |
| H2.S1.M3 | Cargar a `terminology` las 669 estructuras del atlas (UBERON/FMA) + 156 regiones radiológicas (SNOMED) y su mapeo región↔mallas como propiedad | `$expand` las devuelve | `curl` | TODO |
| H2.S2.M1 | `GET /clinical/study-catalog` (C1: `family`, `q`, `cursor`, `limit`) y `GET /clinical/study-catalog/:conceptId` (C2: componentes anidados, muestra sugerida, modalidad, regiones permitidas, contraste, atribución) | búsqueda sin tildes; paginado | spec + `curl` | TODO |
| H2.S2.M2 | `filter` en `GET /terminology/value-sets/:id/$expand` (C3) | FHIR-compatible | spec | TODO |
| H2.S2.M3 | DTO aditivo en `POST /clinical/service-requests` + `POST /clinical/requisitions` (C4) con `Idempotency-Key`; V1–V9 | 422 por regla | spec por regla + `curl` | TODO |
| H2.S2.M4 | V10 antiduplicación con región/lateralidad/componentes | mano izq ≠ der | spec | TODO |
| H2.S2.M5 | `GET /clinical/service-requests/:id` (C5) | 404 fuera de relación | spec | TODO |
| H2.S3.M1 | Inbox ampliado + `POST /diagnostics/service-requests/worklist` (`scope`, `state` derivado) + `GET /diagnostics/service-requests/:id` receptor (C6); `LabStaffGuard` cubre imagen | otro ejecutor: vacío/404 | spec + integración | TODO |
| H2.S3.M2 | Elegir **una** convención de `reason` en 422 para lo nuevo (`details.reason`) y documentarla | consistente | lint de errores | TODO |
| H2.S4.M1 | OpenAPI regenerado; `check-breaking`; `request-body-contract` | sin rupturas | salida | TODO |

### H3 — Front: simulador y contrato (`mantra-core-health`)
**CA:** Dado el simulador, cuando el médico pide un estudio dirigido a un laboratorio, entonces aparece en «Órdenes» de ese laboratorio con su detalle; los códigos del catálogo simulado tienen familia correcta.
**DoD:** `yarn contract:refresh` + `yarn mock-contract:check` · `check-mock-vs-client` · specs de handlers · `check-max-lines` sin empeorar (lo nuevo en `*.data.ts` y handlers nuevos).

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.M1 | Regenerar `api-contract.generated.ts` desde el OpenAPI de H2 | claves nuevas aceptadas | `mock-contract:check` | TODO |
| H3.M2 | Fixtures `fixtures/study-catalog-lab.data.ts` e `…-imaging.data.ts` generados **desde los JSON** (script `scripts/gen-study-catalog-fixtures.mjs`), subconjunto representativo; corregir B1 (familia explícita) | `studyFamilyOf` correcto en maqueta | spec | TODO |
| H3.M3 | Handlers nuevos `study-catalog.handlers.ts`, `requisitions.handlers.ts`, `worklist.handlers.ts`; puente B2 (`orderList` → bandeja del `performerTenantId`) | pedido → aparece en Órdenes | spec | TODO |

### H4 — Front: médico pide (`analysis-order-block`)
**CA:** Dado un médico en la casilla «Orden de análisis», cuando elige Laboratorio, entonces ve el buscador, el conmutador Tabla/Lista y los análisis con sus componentes como casillas (padre tri-estado); cuando elige Imagenología, ve modalidad → estudio → cuerpo 3D con el select debajo sincronizado → lateralidad (sólo si la región es par) → contraste; «Pedir» crea la requisición y el histórico muestra el detalle; cerrar el modal con selección pendiente pide confirmación.
**DoD:** `yarn lint` · `yarn typecheck` · `yarn build` · `yarn test` dirigido (bloque, pickers, lógica pura, historial, visor, atlas) · `check-max-lines` (bloque **bajo 649**) · `check-architecture` · `check-css-tokens` · `check-contrast` · Playwright nuevo `orden-estudios-detalle.spec.ts` (pedir → recargar → histórico → «Órdenes») · capturas 390/768/1440 claro y oscuro con **doble revisión** (`evidencia/doble-revision.md`) · consola y red sin errores nuevos.

Agentes en paralelo con archivos **disjuntos** (D14):

| ID | Dueño | Archivos | Microtarea | CA | Estado |
|---|---|---|---|---|---|
| H4.A.M1 | A (orquestador) | `analysis-order-block/analysis-order-history/*` | Extraer el histórico sin cambio de comportamiento; mostrar línea de detalle | bloque < 649 líneas; specs viejas verdes | TODO |
| H4.A.M2 | A | `analysis-order-block.{ts,html,css}`, `study-category.ts`, spec | Tipo con `app-segmented-control` (Lab · Imagen · Otros) que filtra; `@switch`; `DRAFT_BLOCK`; armado del cuerpo de la requisición; ejecutor para LAB/IMG (D9); modal `size="xl"` para la casilla `ordenes` | spec «no ofrece selector Tipo» se reescribe como «la categoría sale del estudio» (sin debilitar) | TODO |
| H4.B.M1 | B | `analysis-order-block/lab-analysis-picker/*` (+ `.logic.ts` y spec) | Rejilla de casillas y lista conmutables con `app-segmented-control`; `app-search-field` (análisis y componentes, sin tildes); padre tri-estado con `app-checkbox indeterminate`; chips de lo elegido; muestra sugerida editable (`app-select` de `specimen-type`); `ViewState` del catálogo; vista recordada en `localStorage` con try/catch | teclado completo; 1/2/3 columnas por ancho (§5 composición) | TODO |
| H4.C.M1 | C | `analysis-order-block/imaging-study-picker/*` (+ `.logic.ts` y spec) | Modalidad (`app-select`) → estudio filtrado (`app-select searchable`) → ranura del 3D → `app-body-region-picker` → lateralidad (`app-segmented-control`, sólo si `admite_lateralidad`) → contraste | región por defecto del estudio, editable dentro de las permitidas | TODO |
| H4.D.M1 | D | `shared/components/organisms/body-region-picker/*`, `core/data-access/anatomy-atlas/body-regions.*` | `app-body-region-picker`: `value = model<{region, laterality}>`; select/`app-tree-select` agrupado por región padre; lista accesible; capa por modalidad; lateralidad deducida del `side` tocado; regiones sin malla (contenedora/referencia/ninguna) sin 3D pero elegibles; carga del mapeo `regiones-cuerpo-3d.json` desde `public/anatomy-atlas-3d/catalog/` | tocar 3D ⇄ select en ambos sentidos sin bucle (`computed`, sin `effect` cruzado); SSR inerte sin error | TODO |
| H4.D.M2 | D | `anatomy-viewer.ts` + spec, glosario intacto | Inputs `focus` (encuadre unión/intersección con tamaño mínimo para rodilla/tobillo), `pickedAt`, `hoverLabel` | Playwright `atlas-anatomico-*` siguen verdes | TODO |
| H4.E.M1 | E | `core/data-access/diagnostics/*` (tipos + cliente + spec), `core/data-access/study-catalog/*` | `NewRequisition`, `DiagnosticOrder` con detalle, cliente de C1–C5; campos opcionales **omitidos** cuando no hay valor (spec `specialty-form-block.spec.ts:1640`) | typecheck + spec | TODO |

Integración (serie, después de A–E): A monta B, C, D y E; luego Playwright y capturas con un solo navegador.

### H5 — Front: receptor ve el detalle
**CA:** Dado el centro ejecutor en «Órdenes», cuando llega la requisición, entonces la celda «Estudio» muestra el resumen («Hemograma · 3 de 27 componentes» / «RX · Mano · Izquierda · sin contraste») y un `app-card-detail-panel` con el detalle completo; la búsqueda encuentra por región, modalidad y componente; la pestaña Imagenología/Laboratorio filtra por `scope`.
**DoD:** `laboratory-orders` + `.logic` specs · `lab-portal` migrado a C6 (`lab-orders.handlers.ts` del simulador apunta a la bandeja) · Playwright `hito2-laboratory-insurance` verde · capturas 390/768/1440 con doble revisión · la orden del paciente (`account/diagnostic-orders`) muestra el mismo resumen.

| ID | Microtarea | CA | Estado |
|---|---|---|---|
| H5.M1 | `LabOrder` + `detail` legible resuelto por el servidor; cliente a C6 | typecheck | TODO |
| H5.M2 | Celda, panel, búsqueda ampliada, filtro por `scope` | specs | TODO |
| H5.M3 | Orden del paciente e histórico con el mismo resumen (componente compartido `app-study-detail-summary`, molécula en `shared`) | un solo componente para los tres lugares | TODO |

### H6 — Verificación independiente y entrega
- Revisores: `frontend-reviewer`, `visual-reviewer`, `regression-auditor` (quien implementa no aprueba).
- Evidencia: `evidencia/` con capturas, `doble-revision.md`, logs de `curl`, salidas SQL, logs de seeders (2 corridas), Playwright.
- Tres PRs hacia `dev` (modelo, API, front), en ese orden, cada uno con su checklist; `gh pr view`/`checks` pegados (CI caído: `check-*.mjs` a mano).

## 7. Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Revertir «no LOINC» sin ADR | Catálogo con códigos que parecen interoperables y no lo son | ADR D1; sólo códigos verificados; `verificar:true` no se siembra como válido |
| Nombres en español sin fuente boliviana | Confusión clínica | `PENDIENTES-CLINICOS.md` con responsable; sinónimos locales en `sinonimos` |
| Visor 3D pesado dentro del modal de consulta | Carga lenta | `@defer (on viewport)`, sólo en Imagenología; GLB por capa bajo demanda |
| Bucle 3D ⇄ select | Parpadeo / cuelgue | única fuente de verdad (`value`), derivadas con `computed`, spec que cuenta emisiones |
| Techos de líneas ya en rojo | `check-max-lines` empeora | extracción del histórico primero; archivos nuevos; `*.data.ts` |
| Órdenes sin ejecutor | Nunca llegan a bandeja | D9; mensaje en pantalla cuando se elige «el paciente elige» |
| Copia de parches desfasada | Parche en `dev` y no en Coolify | H1.M1 antes de v4.2.80 |
| Antiduplicación vieja | 422 falsos | V10 antes de habilitar región |
| Simulador ≠ API | Verdes falsos | Playwright final contra API real en `dev` además de maqueta; declarar lo que no se probó |
| Dos convenciones de `reason` | Front ramifica mal | H2.S3.M2 |

## 8. Lo único que requiere al usuario
Se adoptaron valores por defecto (sección 3); confirmar o corregir **sin bloquear el inicio de H0–H1**:
1. D1 (adoptar el catálogo verificado con enlace LOINC/RadLex y superar la nota «no LOINC»).
2. D9 (el médico elige el laboratorio/centro al pedir, también para laboratorio e imagen).
3. D3 (componentes vienen todos marcados y el médico desmarca; sin componentes no se pide).
4. Quién revisa clínicamente `PENDIENTES-CLINICOS.md` (nombre/rol) antes de que esos ítems se siembren como válidos.
