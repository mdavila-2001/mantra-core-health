# Plan — Doctor más práctico: emitir sin formulario médico y diagnóstico presuntivo desde «Diagnóstico»

- Fecha: 2026-10-30 · Repos afectados: `mantra-core-health` (web, se implementa) · `mantra_core_health_mobile` (sólo especificación) · `mantra-core-health-api` (sólo lectura, sin cambios) · Predecesor: ninguno
- Resultado observable: un doctor en la consulta puede (1) recetar, pedir un análisis, agendar reconsulta o abrir un plan de cuidados **sin** haber llenado el formulario médico, y (2) desde la casilla «Diagnóstico» registrar un diagnóstico **presuntivo** escribiendo motivos «campo: valor» ahí mismo, o partiendo de un formulario médico ya llenado, sin perder la tabla actual de presuntivos ni sus botones Confirmar/Rechazar.
- Kill-test: abrir «Receta» en una consulta sin respuesta de formulario y comprobar que el botón de emitir sigue bloqueado con «Falta el formulario médico» → no está hecho.

## Decisiones tomadas con el cliente (30/10/2026)

| Pregunta | Respuesta |
|---|---|
| Alcance móvil | Web + **especificación** móvil (el móvil Flutter no tiene login, API ni pantallas clínicas) |
| «Formulario ya llenado» | **Las dos**: se precargan sus respuestas como filas campo/valor editables **y** el diagnóstico queda vinculado a la respuesta de origen |
| Persistencia | **Nota estructurada**: `noteText` con resumen + nota médica del encuentro con `entries` (contrato existente, sin cambio de esquema) |
| Punto 1 | **Sólo el formulario** deja de ser obligatorio; el encuentro abierto sigue siéndolo |

## Alcance
- IN: `form-response-picker` (modo opcional), `medication-block`, `analysis-order-block`, `follow-up-block`, `care-plan-block` (input `ofreceRespuesta`), `consultation.html`, `additional-fields` (parametrizable + precarga), `diagnosis-block` (alta de presuntivo), simulador `core/mock`, specs, documentación y especificación móvil.
- OUT: cambios de esquema/API; el encuentro deja de ser obligatorio; confirmar/rechazar presuntivos (no se toca `diagnosis-verify-dialog`); app Flutter.
- Ambigüedades registradas:
  1. «Vinculado a la respuesta de origen»: la API **no** tiene `form_instance_id` en `clinical.conditions`. El vínculo queda en `noteText` («Del formulario «X» · fecha») y en la nota estructurada. Confirmar con el cliente si hace falta una columna (cambio coordinado model + API).
  2. Un diagnóstico exige concepto del catálogo (`codeConceptId`): **no** hay texto libre de diagnóstico. Confirmar con el cliente.
  3. Sin encuentro abierto el diagnóstico y la nota se registran sin `encounterId` (la API lo admite).

## H1 — Emitir sin formulario médico
**CA:** Dado un encuentro abierto sin respuesta de formulario cerrada, cuando el doctor abre Receta, Orden de análisis, Reconsulta o Plan de cuidados, entonces el selector dice «Sin formulario médico», no bloquea y la petición sale sin `formInstanceId`. Con respuestas, la más reciente viene elegida y se puede desvincular.
**DoD:** specs del selector y de los 4 bloques en verde · `yarn typecheck` · `yarn lint` · prueba en navegador contra el simulador.
**Estado:** A MEDIAS (ver REPORTE.md)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | `FormResponsePicker` con `opcional` | sin respuestas no muestra `respuesta-falta`; ofrece «Sin formulario médico» | `ng test form-response-picker` | A MEDIAS: TESTED + navegador (simulador); falta reg. completa |
| H1.S1.M2 | `ofreceRespuesta` en los 4 bloques + consulta (el encuentro sigue exigido) | la consulta ya no pasa `exigeRespuesta`; sin encuentro no se emite | `ng test` de los 4 bloques y `consultation` | A MEDIAS: TESTED + navegador (simulador) |
| H1.S1.M3 | Emisión sin respuesta omite `formInstanceId`/`basedOnNoteIds` | la petición no lleva esos campos | navegador: `POST /clinical/service-requests` | A MEDIAS: observado en el simulador; sin API real |

## H2 — Diagnóstico presuntivo desde «Diagnóstico»
**CA:** Dado el modal «Nuevo diagnóstico», cuando el doctor elige un diagnóstico del catálogo, escribe filas campo/valor (o elige un formulario ya llenado) y registra, entonces `POST /clinical/conditions` sale con `verificationStatus: PROVISIONAL`, la nota estructurada se crea con las filas, la tabla muestra el diagnóstico «En estudio» con Confirmar/Rechazar tras releer, y un fallo parcial conserva lo escrito y no duplica el diagnóstico al reintentar.
**DoD:** specs en verde · typecheck · lint · prueba en navegador `UI → request → response → recarga → UI` en 3 viewports y 2 temas · doble revisión de capturas.
**Estado:** A MEDIAS (ver REPORTE.md)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | `AdditionalFields` parametrizable + `cargar()` + texto plano | defaults intactos; precarga con dedupe, truncado y sin enmascaradas | spec `additional-fields` | A MEDIAS: TESTED |
| H2.S2.M1 | Formulario de alta `PresuntivoForm` (componente propio; el bloque conserva la tabla) | diagnóstico obligatorio; no doble envío; errores por campo | specs `presuntivo-form` y `diagnosis-block` | A MEDIAS: TESTED + navegador (simulador) |
| H2.S2.M2 | Precarga desde formulario ya llenado | filas editables; enmascaradas no viajan | spec + navegador | A MEDIAS: TESTED + navegador (simulador) |
| H2.S2.M3 | Reintento sin duplicar; `terminado` sólo con todo guardado | tras fallo de la nota, reintentar no repite `POST conditions` y el modal no se cierra | spec + navegador (fallo inyectado) | A MEDIAS: TESTED + navegador (simulador) |
| H2.S2.M4 | Contrato real: `verificationStatusConceptId` (hallazgo: el cliente mandaba `verificationStatus`, la API lo rechaza) | cuerpo sin la palabra `PROVISIONAL` | specs de cliente/formulario | A MEDIAS: TESTED; sin API real |
| H2.S3.M1 | Simulador fiel (respeta el estado de verificación declarado) | por omisión confirmado, como la API | specs + navegador | A MEDIAS: TESTED |
| H2.S4.M1 | Prueba en navegador y capturas | 3 viewports × 2 temas | evidencia/ | A MEDIAS: capturas hechas; revisión independiente en curso |

## H3 — Especificación móvil
**CA:** el repo móvil trae un documento con contrato, reglas y estados para construir lo mismo cuando exista la consulta móvil.
**DoD:** archivo `docs/doctor-consulta-practica.md` creado.
**Estado:** A MEDIAS (ver REPORTE.md)

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| No hay API real ni Postgres en el contenedor | El E2E corre contra el simulador | Se etiqueta «verificado contra simulador»; contrato real revisado en el código de la API |
| Specs que codifican el requisito viejo | Parecería debilitar tests | Se actualizan explícitamente como cambio de requisito y se declara en el reporte |
