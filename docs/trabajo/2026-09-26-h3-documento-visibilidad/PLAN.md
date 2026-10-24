# Plan — H3 front (M7-Legion): visibilidad del documento (BR-16/CL-36)

- Fecha: 2026-09-26 · Repo: `mch-legion-front` · Predecesor: PR de API con la decisión D-BR16-01/02
  y la publicación del catálogo `chart.document_records.patient_visibility_concept_id`
  (`mantra-core-health-api` #478, commit `a3bff4d9`).
- Resultado observable: al registrar un documento del expediente, el médico puede elegir
  «Visible para el paciente» desde un selector real (catálogo de la API), no un booleano inventado.
- Kill-test: registrar un documento eligiendo «Visible para el paciente» → si
  `POST /charts/documents` no lleva `patientVisibilityConceptId`, CL-36 no está.

## Alcance
- IN: `document-block.ts`/`.html`/`.spec.ts` — un `app-concept-select` más, mismo patrón que
  `categoria` (`TARGET_CATEGORIA_DOCUMENTAL`).
- OUT (honesto, no silenciado): el resto de BR-14, BR-15 y BR-16 en este repo **no se tocó** en
  este carril — ver la sección de front en
  `mantra-core-health-api` PR #478 (cuerpo del PR, ya que el hook de esta sesión bloqueó escribir
  un `REPORT.md`) para el detalle completo de lo pendiente. Este archivo cubre **sólo** CL-36.
- Ambigüedades registradas: el prompt BR-16 pedía un «interruptor» (`Switch`) para la visibilidad.
  Se implementó como `app-concept-select` (mismo componente que `categoria`) en lugar de un
  `Switch` con dos uuid hardcodeados: el catálogo recién publicado por la API
  (`GET /system-context/dynamic-enums?target=chart.document_records.patient_visibility_concept_id`)
  ya resuelve las dos opciones reales, y hardcodear los uuid en el front hubiera sido inventar un
  valor que el catálogo ya provee — la regla "no inventar códigos" pesa más que la forma literal
  del control que pedía el prompt.

## H1 — Selector de visibilidad en el alta de documento (CL-36)
**Estado:** HECHO

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H1.M1 | `TARGET_VISIBILIDAD_DOCUMENTAL` + señal `visibilidad` | `yarn eslint` limpio | HECHO |
| H1.M2 | `app-concept-select` en el formulario | ídem | HECHO |
| H1.M3 | `patientVisibilityConceptId` en el payload, omitido si no se elige | test dirigido en verde | HECHO |
| H1.M4 | Reset en `limpiar()` tras registrar | cubierto por los tests existentes de `tieneCambiosPendientes` | HECHO |

## Verificación
- `yarn ng test --watch=false --include=.../document-block.spec.ts` → 15/15 en verde (14 previos +
  1 nuevo), sin tocar ningún assert existente.
- `yarn eslint <archivos tocados>` → limpio.
- `npx tsc -p tsconfig.app.json --noEmit` → limpio.
- **No se corrió Playwright/captura de navegador** (regla `NO_EVIDENCE_NO_DONE` de este repo, no
  satisfecha por presupuesto de tiempo del carril): el cambio queda en peldaño `TESTED`
  (unitario), no `VERIFIED` (visual). Se declara explícitamente, no se afirma "verificado".
