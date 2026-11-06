# Plan — Orden de estudio: tipo Laboratorio / Imagenología

- Fecha: 2026-11-06 · Repos afectados: `mantra-core-health` (front), `mantra-core-health-api` · Predecesor: [2026-10-31-estudios-muestra-y-region-corporal](../2026-10-31-estudios-muestra-y-region-corporal/PLAN.md) (traspaso sin código)
- Rama: `claude/brave-bohr-vu0zuc` en ambos repos.
- Resultado observable: en «Pedir un análisis» el médico elige primero **Laboratorio** o **Imagenología**. Con Imagenología ve el cuerpo 3D del atlas, elige la región, el tipo de imagen (rayos X, ecografía…), lateralidad y contraste, y lee qué hace ese estudio y qué debe revisar antes de pedirlo. Con Laboratorio elige el tipo de análisis (sangre, orina, heces, fluidos, genético), el estudio en un árbol propio de ese tipo, la muestra y el laboratorio.
- Kill-test: pedir una radiografía de «Miembro superior, izquierdo» desde la ficha, recargar y no ver región, lateralidad y tipo en el histórico ⇒ no está hecho.

## Pedido del cliente (06/11/2026, resumido)
1. La orden lleva un campo select: LABORATORIO o IMAGENOLOGÍA.
2. Imagenología: cuerpo humano 3D (el que ya existe, reusado), tipo de imagen (rayos X, ecografía, etc.) y las recomendaciones y notas aclaratorias que el médico debe considerar o revisar: qué hace esa imagenología.
3. Laboratorio: tipo (genético, sangre, heces, fluidos…), con las características de cada tipo y **un árbol por cada tipo**, y el laboratorio.

## Hechos descubiertos (con ruta)
| # | Hecho | Dónde |
|---|---|---|
| F1 | El modelo ya tiene las columnas `specimen_type_concept_id`, `modality_concept_id`, `body_site_concept_id`, `laterality_concept_id`, `contrast_concept_id` en la orden, con 3 CHECK (v4.2.82). **No hace falta parche de modelo.** | `mantra-core-health-model/SQL/patches/2026-11-01_v4282_service_request_detalle.sql` |
| F2 | La API **no** las lee ni las escribe: ni DTO, ni entidad, ni servicio. | `mantra-core-health-api/src/modules/clinical/{dto,entities,services}` |
| F3 | Los catálogos se declaran en TS y se publican como *dynamic enums* atados a `esquema.tabla.columna`. `specimen-type` (HL7 v2-0487, con procedencia) existe pero solo atado a `diagnostics.specimens`. No hay catálogo de modalidad, contraste ni región. | `src/common/seed/dynamic-enum-catalog.ts:1658`, `src/modules/diagnostics/diagnostics.concepts.ts` |
| F4 | El estudio se elige de un enum plano (`LAB_*`, `IMG_*`, `CAR_*`…); la familia sale del prefijo del código. | `src/app/features/clinical-record/patient-chart/analysis-order-block/study-category.ts` |
| F5 | El atlas 3D clasifica cada estructura en 7 regiones (R01 Cabeza y cuello … R07 Miembro inferior) y el visor emite `picked` con el id de malla. | `public/anatomy-atlas-3d/catalog/structures-*.json`, `glossary-anatomy-atlas.ts:81` |
| F6 | Ya existe `app-tree-select` (grupos → hojas, búsqueda, teclado, diálogo) y `app-performer-selector` (quién realiza). | `src/app/shared/components/organisms/tree-select`, `.../analysis-order-block/performer-selector` |

## Alcance
- IN: API (DTO, entidad, servicio, validación de cruces, catálogos nuevos de modalidad/contraste/región/lateralidad, muestra atada a la orden) · front (tipo de orden, árbol por tipo de laboratorio, selector de región 3D, tipo de imagen, ficha informativa, muestra, laboratorio, histórico con el detalle).
- OUT: modelo SQL (ya está) · DICOM/PACS · precios del centro · móvil Flutter · cambios al visor 3D (solo se reusa) · persistir la estructura 3D más fina que la región.

## Ambigüedades registradas (supuestos tomados)
| # | Pregunta | Supuesto | Confirmar con |
|---|---|---|---|
| A1 | «Recomendaciones y notas especificadoras que debe considerar el doctor, qué hace la imagenología»: ¿texto fijo por tipo de imagen o notas que escribe el médico? | Texto **informativo fijo por tipo de imagen** («qué hace» y «qué revisar antes de pedirlo»). No se persiste. Es **borrador interno sin fuente clínica**: queda rotulado así en pantalla y no se presenta como guía validada (regla 97.5.4). | Cliente / dirección médica (revisión y fuente) |
| A2 | ¿Qué estudio pertenece a qué tipo de laboratorio? | Clasificación interna por tipo de muestra y área (`lab-study-tree.ts`), rotulada «pendiente de validación clínica». Un código fuera del mapa cae en «Otros análisis»: el catálogo puede crecer sin romper. | Dirección médica |
| A3 | «Genético»: el catálogo no tiene estudios genéticos hoy. | El tipo existe y muestra un vacío orientador; no se inventan estudios (regla 97.4). | Producto: ¿qué estudios genéticos van al catálogo? |
| A4 | La parte del cuerpo se guarda como **región** (7), no como estructura exacta. | La estructura elegida en 3D se usa para sugerir la región y mostrarla; lo persistido es la región. | Cliente |
| A5 | «Laboratorio» (quien realiza). | Se reusa el selector de ejecutor existente; no se crea otro. | — |

## H1 — API: la orden persiste muestra, modalidad, región, lateralidad y contraste
**CA:** Dado un `POST /clinical/service-requests` de imagen con modalidad, región, lateralidad y contraste válidos, cuando se consulta la orden, entonces vuelve el mismo detalle; una orden de laboratorio con campos de imagen (o al revés), o una lateralidad sin región, responde 422 con `reason`.
**DoD:** `yarn typecheck` · `yarn lint` sobre lo tocado · `yarn test` dirigido (dto, servicio, catálogo) en verde · matriz negativa (cruce lab↔imagen, valor fuera de catálogo).
**Estado:** A MEDIAS (ver REPORTE.md)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Conceptos y enums: modalidad, contraste, región, lateralidad; `specimen-type` también atado a la orden | Los 4 enums nuevos salen en `dynamic-enums` con sus targets | test del catálogo | HECHO |
| H1.S1.M2 | DTO + entidad + repositorio con las 5 columnas | `typecheck` limpio | `yarn typecheck` | HECHO |
| H1.S1.M3 | Reglas del servicio: muestra solo en LAB, imagen solo en IMAGING, valores del catálogo, lateralidad⇒región, contraste⇒modalidad | cada cruce inválido ⇒ 422 | `service-requests.service.spec.ts` | HECHO |
| H1.S1.M4 | Respuesta y lectura del paciente devuelven el detalle | el histórico trae los 5 campos | spec del servicio de lectura | HECHO |

## H2 — Front: pedir el estudio por tipo
**CA:** Dado un médico con encuentro abierto, cuando elige Laboratorio ve tipo de análisis → árbol de estudios de ese tipo → muestra → laboratorio; cuando elige Imagenología ve el cuerpo 3D, tipo de imagen, lateralidad, contraste y la ficha «qué hace / qué revisar»; al pedir, el request lleva el detalle y el histórico lo muestra; cada error queda en su campo.
**DoD:** `yarn typecheck` · `yarn lint` · `yarn build` · `yarn ng test` dirigido · prueba visual en 3 viewports y 2 temas con doble revisión (si se pudo ejecutar el navegador; si no, queda `A MEDIAS`).
**Estado:** A MEDIAS (ver REPORTE.md)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Tipos y cliente: `NewDiagnosticOrder` y la orden leída con el detalle | compila; el cliente manda los campos | `yarn typecheck` + spec del cliente | A MEDIAS |
| H2.S1.M2 | Lógica pura: árbol de laboratorio por tipo (`lab-study-tree.ts`) y ficha por modalidad (`imaging-guidance.ts`) | cada estudio cae en un tipo; código desconocido ⇒ «Otros» | spec lógico | HECHO |
| H2.S2.M1 | Molécula `body-region-picker` (visor 3D + lista accesible de las 7 regiones) | puntero y teclado eligen lo mismo | spec + prueba de teclado | A MEDIAS |
| H2.S2.M2 | `analysis-order-block`: campo «Tipo de orden» + panel de laboratorio + panel de imagen | el tipo cambia lo que se ofrece y lo que viaja | spec del componente | HECHO |
| H2.S2.M3 | Histórico: muestra o región/lateralidad/modalidad por fila | la fila lo dice | spec | HECHO |
| H2.S3.M1 | Simulador (demo) acepta y devuelve el detalle | el modo demo recorre el flujo | spec del handler | A MEDIAS |
| H2.S3.M2 | Prueba visual + doble revisión | ninguna pantalla `RECHAZADA` | `evidencia/doble-revision.md` | A MEDIAS |

## H3 — Entrega
Commit y push a `claude/brave-bohr-vu0zuc` en API y front. **No se abren PRs**: el usuario no los pidió en esta sesión (el flujo del repo exige dos, `dev` y `test`, y queda para cuando se pidan).

## Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Texto clínico de la ficha sin fuente | Guía no validada en pantalla | Rotulado «borrador interno»; A1 a dirección médica |
| Clasificación estudio→tipo inventada | Catálogo contaminado | Rotulada interna, desconocidos a «Otros», A2 |
| El visor 3D pesa dentro del formulario | Carga lenta | Se monta solo al elegir Imagenología |
| Contrato de la orden usado por móvil | Rotura silenciosa | Campos opcionales y aditivos |

## Desvíos del plan (registrados al cerrar)
- El simulador (H2.S3.M3) no estaba planificado y era condición para recorrer el flujo en navegador: se agregó.
- `analysis-order-block.ts` se partió: el estado del detalle vive en `order-detail-state.ts` (el check de tamaño marcaba el crecimiento).
- «Otro estudio» se agregó como tercera opción del tipo de orden para no perder lo que ya se podía pedir (cardiología, patología, procedimientos).
- El selector de ejecutor existente se reusó para laboratorio e imagen (supuesto A5) con título y términos propios.
- Contrato OpenAPI de la API: parche acotado a `CreateServiceRequestDto` (regenerar entero arrastra miles de líneas ajenas); el front registra las 5 claves como «pendientes del contrato».
