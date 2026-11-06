# Plan — Archivo clínico: sólo «Solicitar vinculación»

- Fecha: 2026-11-02 · Repos afectados: mantra-core-health (front) · Predecesor: FT-07-R05
- Resultado observable: en `/medical-records`, cada fila de paciente muestra únicamente el botón de vincular; pedir un vínculo ya existente (409) se dice como estado, no como error rojo.
- Kill-test: buscar a un paciente y ver dos botones en la fila, o repetir un pedido y ver el cartel rojo «No se pudo enviar».

## Alcance
- IN: fila de `clinical-record` (sin carpeta), 409 de `request-access`, specs unitarios, 5 recorridos Playwright que entraban por la carpeta.
- OUT: tarjeta «Su médico de cabecera» (reservar cita / lista de médicos) — tarea 2, otra rama; el 403 de `GET /profiles/patients/:id` en la pantalla de solicitud (el nombre cae al genérico, es esperable sin vínculo); estado por fila (el listado de vínculos es sólo `CLINICIAN`/`SECURITY_ADMIN`, requiere API).
- Ambigüedades registradas: (1) el 409 no distingue pendiente de activo — la API no manda `code` distinto y la regla del repo es ramificar por `code`; supuesto: texto neutro. Confirmar con quien lleve la API si se quiere un `reason`. (2) Sin botón de expediente en el buscador, el médico entra al expediente por la agenda o la consulta; supuesto tomado por pedido explícito del propietario (02/11/2026).

## H1 — Un solo botón por fila
**CA:** Dado un médico que buscó pacientes, cuando ve la tabla, entonces cada fila tiene sólo «Solicitar vinculación» y apunta a `/medical-records/:id/request-access`.
**DoD:** `ng test` de `clinical-record.spec.ts` en verde.
**Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.M1 | Quitar la carpeta de la fila y `rutaDe` | no existe `paciente-ver-expediente` | spec nuevo | HECHO |
| H1.M2 | Recorridos Playwright toman el perfil del enlace de la fila | los 5 specs no dependen de la carpeta | `tsc` de playwright | A MEDIAS |

## H2 — El 409 no es un error
**CA:** Dado un pedido ya existente, cuando la API responde 409, entonces se ve un aviso informativo y no un `app-alert` de error.
**DoD:** `ng test` de `request-access.spec.ts` en verde.
**Estado:** HECHO

## Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Los 5 Playwright reales no se ejecutan acá (disco C: lleno, sin stack) | rojo oculto | quedan en WRITTEN, declarado en el reporte |
