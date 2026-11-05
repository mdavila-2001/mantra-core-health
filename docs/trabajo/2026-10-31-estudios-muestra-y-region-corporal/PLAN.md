# Plan — Muestra de laboratorio y región corporal en la orden de estudios

- Fecha: 2026-10-31 · Repos afectados: `mantra-core-health` (front), `mantra-core-health-api`, `mantra-core-health-model` · Predecesor: ninguno
- Estado de la entrega: **traspaso**. Solo hay descubrimiento y plan; no hay código de producto escrito.
- Resultado observable: al pedir un estudio, el profesional indica **qué muestra** se analiza (sangre, orina…) si es de laboratorio, o **qué parte del cuerpo** se estudia si es de imagen, marcándola en el modelo 3D del cuerpo que ya existe.
- Kill-test: pedir una radiografía de una mano desde la ficha del paciente; recargar; si la orden no vuelve con la región, lateralidad y tipo de hueso, no está hecho.

## Pedido del cliente (textual, resumido)
Falta granularidad en el detalle de cada análisis clínico. Laboratorio: qué debe analizarse en sangre / en orina. Imagenología: qué parte del cuerpo se estudia y, si es hueso, de qué tipo; y poder marcarla en el cuerpo humano 3D que ya tenemos.

## Decisiones ya tomadas por el usuario (31/10/2026)
- Dónde: **en la orden del estudio** (pantalla del profesional, no el catálogo del centro).
- Imagenología, alcance máximo: región/estructura en el modelo 3D, tipo de hueso, lateralidad y modalidad.
- Alcance técnico: **front + API + modelo** (cambio de esquema incluido).

## Hechos descubiertos (con ruta)
| # | Hecho | Dónde |
|---|---|---|
| F1 | `clinical.service_requests` (la orden) **no tiene** columnas de muestra ni de región corporal. Solo `code_concept_id`, categoría, prioridad, ejecutor, etc. | `mantra-core-health-model/SQL/08_clinical/02_tables.sql:219` |
| F2 | El espécimen se crea **después**, en la recepción del laboratorio: `diagnostics.specimens` tiene `specimen_type_concept_id` (obligatorio) y `body_site_concept_id`. | `mantra-core-health-model/Mantra Core Health Context/modules/diagram_20_diagnostics.puml` |
| F3 | `diagnostics.imaging_studies` e `imaging_series` ya tienen `modality_value_set_id`, `body_site_concept_id` y `laterality_concept_id`, pero cuelgan del estudio ya realizado, no de la orden. | mismo diagrama |
| F4 | La API ya valida el tipo de espécimen contra el catálogo `specimen-type` (422 `SPECIMEN_TYPE_NOT_IN_CATALOG`). | `mantra-core-health-api/src/modules/diagnostics/specimen-catalogs.ts` |
| F5 | DTO y entidad de la orden: `service-request.dto.ts`, `service_requests.entity.ts`, `service-requests.service.ts`, `clinical-orders.controller.ts`. | `mantra-core-health-api/src/modules/clinical/` |
| F6 | El front tiene el tipo `NewSpecimen` con `specimenTypeConceptId` y `bodySiteConceptId?` solo para la recepción, y `SPECIMEN_TYPE_TARGET` (dynamic-enum). | `src/app/core/data-access/diagnostics/diagnostics-lab.types.ts:20,189` |
| F7 | La pantalla donde se pide el estudio es `analysis-order-block` (663 líneas); el tipo de petición es `NewDiagnosticOrder`. | `src/app/features/clinical-record/patient-chart/analysis-order-block/`, `src/app/core/data-access/diagnostics/diagnostics.types.ts:122` |
| F8 | Ya existe el visor 3D `app-anatomy-viewer` (three.js, capas esqueleto/músculos/vasos/nervios/órganos, emite `picked` con el id de malla) y el catálogo UBERON/FMA en `public/anatomy-atlas-3d/catalog/`. Hoy solo lo usa el glosario. | `src/app/shared/components/organisms/anatomy-viewer/`, `src/app/core/data-access/anatomy-atlas/anatomy-atlas.types.ts` |
| F9 | `AnatomyPart` trae `layer`, `side`, `structureId` (UBERON) y `meshId` (FMA); **no** trae tipo de hueso. | `anatomy-atlas.types.ts:20-31` |
| F10 | Existe `studyCategory` en la orden (`study-category.ts`) para distinguir laboratorio de imagen. Verificar si alcanza como discriminador. | `analysis-order-block/study-category.ts` |

## Desconocidos / ambigüedades (resolver antes de escribir esquema)
1. **¿La muestra va por estudio o por orden?** Una orden puede traer varios estudios. Supuesto: un registro por estudio pedido. Confirmar con producto/clínica.
2. **¿El catálogo de «qué muestra lleva cada análisis» tiene fuente?** Regla 97.5.2 del repo: prohibido inventar relaciones entre catálogos. Supuesto: el médico **elige** la muestra de `specimen-type` (que ya existe) y no se pre-rellena por análisis, salvo que haya una fuente (LOINC `SYSTEM`, por ejemplo) con procedencia. Confirmar.
3. **Tipo de hueso** (largo, corto, plano, irregular, sesamoideo): no está en UBERON/FMA tal cual en el catálogo del atlas. Hace falta una fuente con procedencia (UBERON tiene clases de hueso por forma) o una definición clínica aprobada. No generar una tabla a mano sin fuente.
4. **Lateralidad y modalidad**: confirmar si ya existen como value sets (`laterality`, modalidad de imagen) en `03_terminology`; si no, definir con fuente.
5. **Pasanaku/otros repos**: fuera de alcance; la sesión los listaba pero no tienen relación.

## Alcance
- IN: columnas en la orden para muestra y región; catálogo/value sets necesarios; DTO + servicio + contrato OpenAPI; selector de muestra y selector corporal 3D en `analysis-order-block`; lectura de esos datos en recepción de muestras y en la orden del paciente.
- OUT: DICOM/PACS, cambios al visor 3D más allá de reutilizarlo, catálogo de precios del centro, app móvil.

## Reglas del repo que aplican
`CLAUDE.md` (front): primitivas existentes antes de crear; fichas centradas y a ancho completo; sin Tailwind, solo tokens; nueve estados M34; la API es la autoridad; mutación demostrada UI → request → response → persistencia → recarga → UI; dos PRs (`dev` y `test`, el de `test` por cherry-pick). Reglas de la casa 97 (una sola fuente de esquema: el repo `-model`, flujo modelo → SQL → entidades ORM, con verificación de deriva) y 35 (doble revisión de capturas, PR mergeable).

## H1 — Modelo y API: la orden lleva muestra y región
**CA:** Dado un profesional que crea una orden de laboratorio con muestra «orina» y una de imagen con región «mano», lateralidad «izquierda», cuando recarga la orden, entonces la API devuelve esos valores; una muestra o región inválida responde 422 con `details.reason`.
**DoD:** parche SQL aplicado en entorno de prueba (salida pegada) · verificación de deriva en verde · `yarn test` focalizado del módulo clinical · petición real con `curl` y consulta SQL que muestra la fila · matriz de autorización negativa (otro tenant, rol insuficiente, sin token).
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Resolver ambigüedades 1–4 y registrarlas | Cada una tiene respuesta o supuesto con responsable | Sección «Decisiones» de este plan actualizada | TODO |
| H1.S1.M2 | Parche SQL en `-model` (`SQL/patches/2026-11-xx_v427x_*.sql` + `SQL/08_clinical/02_tables.sql` + `docs/data-catalog/*`) con columnas nullable: `specimen_type_concept_id`, `body_site_concept_id`, `laterality_concept_id`, `modality_concept_id`, `body_structure_ref` (id UBERON/FMA elegido en el 3D) | Aplica limpio y es reversible | Salida de aplicar + `\d clinical.service_requests` | TODO |
| H1.S1.M3 | Value sets (con procedencia) para lateralidad, modalidad y tipo de hueso | Cada valor lleva fuente/fecha; segunda corrida del seeder no inserta nada | Salida de las dos corridas | TODO |
| H1.S2.M1 | Entidad + DTO + servicio + controlador de la orden en `-api` | `POST` con valores válidos persiste; inválidos → 422 | `yarn test` del módulo + `curl` | TODO |
| H1.S2.M2 | Regla: muestra solo si es estudio de laboratorio; región solo si es de imagen | Cruce inválido → 422 | test unitario + `curl` | TODO |
| H1.S2.M3 | Contrato OpenAPI actualizado | `openapi/` refleja los campos | diff de contrato + lint | TODO |

## H2 — Frontend: pedir el estudio con muestra y cuerpo 3D
**CA:** Dado un profesional en la ficha de un paciente, cuando elige un análisis de laboratorio, entonces debe indicar la muestra (sangre, orina…); cuando elige un estudio de imagen, entonces ve el cuerpo 3D, toca la parte (o la elige en la lista accesible), indica lateralidad y, si es un hueso, se muestra su tipo; al guardar y recargar, la orden conserva todo.
**DoD:** `yarn lint` · `yarn typecheck` · `yarn build` · `yarn test` focalizado · Playwright contra backend real · capturas en 3 viewports y ambos temas, con **doble revisión** (`evidencia/doble-revision.md`) · consola y red sin errores nuevos.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Tipos y cliente: ampliar `NewDiagnosticOrder`/`DiagnosticOrder` | Compila y el cliente envía/lee los campos | `yarn typecheck` + spec del cliente | TODO |
| H2.S1.M2 | Selector de muestra (reusar `SPECIMEN_TYPE_TARGET` y el `select` existente) | Estudio de laboratorio exige muestra | spec del componente | TODO |
| H2.S2.M1 | Molécula `body-site-picker` que envuelve `app-anatomy-viewer` + lista accesible; emite estructura, lateralidad y tipo de hueso | Teclado y puntero eligen lo mismo; con SSR no rompe | spec + prueba de teclado | TODO |
| H2.S2.M2 | Integrar en `analysis-order-block` según `studyCategory` | Imagen muestra el selector corporal; laboratorio, el de muestra | spec + Playwright | TODO |
| H2.S2.M3 | Mostrar muestra/región en la orden del paciente (`account/diagnostic-orders`) y en `lab-reception` (precargar el tipo de espécimen) | Los datos viajan hasta recepción | Playwright | TODO |
| H2.S3.M1 | Estados M34, errores del servidor mapeados al campo, doble envío bloqueado | Cada error aparece en su campo | spec + capturas | TODO |
| H2.S3.M2 | Prueba visual y doble revisión | Ninguna pantalla `RECHAZADA` | `evidencia/doble-revision.md` | TODO |

## H3 — Entrega
Dos PRs por cambio terminado: uno a `dev` y otro a `test` (rama propia desde `test`, cherry-pick). Mergeable demostrado con `gh pr view` / `gh pr checks` (regla 35). Un PR por repo afectado; orden de despliegue: modelo → API → front.

## Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Inventar la relación análisis→muestra o hueso→tipo | Catálogo contaminado | Regla 97.5.2: solo con fuente o selección manual del médico |
| El visor 3D pesa (three.js + GLB) dentro del formulario de orden | Carga lenta | Cargar bajo demanda, como ya hace el visor |
| Contrato de la orden consumido por otros repos (móvil) | Rotura silenciosa | Campos nullable y aditivos; documentar en OpenAPI |
