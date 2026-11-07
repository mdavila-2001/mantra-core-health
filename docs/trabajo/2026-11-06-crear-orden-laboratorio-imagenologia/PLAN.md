# Plan — Crear una orden en Laboratorio e Imagenología (tres vías), sobre `dev`

- Fecha: 2026-11-07 · Repo: mantra-core-health (web + simulador) · Predecesor: `2026-10-31-ordenes-compactas-laboratorio-imagenologia`
- Resultado observable: en «Órdenes» de una cuenta `DIAGNOSTIC_CENTER` hay «Nueva orden» y una orden nace por (1) el QR del paciente, (2) la derivación de un médico aceptada por el paciente, (3) el propio centro.
- Kill-test: no existe forma de crear una orden desde el centro, o una derivación aparece en el centro sin que el paciente la acepte.

## Por qué se rehízo sobre `dev`
La primera versión (commit `3d05a1c7`) se hizo contra una base 2078 commits atrás y suponía que `/diagnostics/lab/*` era solo simulador. `dev` ya tenía: la API real con `POST /diagnostics/lab/orders` y `POST …/patients/lookup` (vía 3), un lector de QR con `jsqr` (`shared/utils/qr/read-qr.ts`) y la pantalla de órdenes rehecha. Se descartó lo duplicado y se rehízo contra el contrato real.

## Contrato
| Vía | Ruta | Estado |
|---|---|---|
| 3 (centro) | `POST /diagnostics/lab/patients/lookup`, `POST /diagnostics/lab/orders` | **API real** (`diagnostics-lab-portal.controller.ts`); el simulador la espeja |
| 1 (QR del paciente) | `POST /diagnostics/lab/orders/from-qr` `{code}`; código `ALOVIDA-ORDEN:v1:<orderId>` | **solo simulador** (sin firma ni vencimiento) |
| 2 (derivación) | `POST /diagnostics/orders/:id/referral`, `POST /diagnostic-results/me/orders/:id/referral/{accept\|reject}` | **solo simulador** |

Solo se dirige/deriva una orden pendiente o activa (409 si no).

## Alcance
- IN: «Orden con QR del paciente» (diálogo en la pantalla de órdenes; la orden propia ya la entrega `dev` en «Nueva orden»), QR del paciente en «Mis órdenes», aceptar/rechazar derivación, «Derivar a un centro» en la ficha del médico, «Usar para una orden» en el visor de fotos del chat, `app-organization-identity` (logo/iniciales), chip de origen en la tabla.
- OUT: API real de las vías 1 y 2; app móvil; PR a `test` (rama dada de baja el 30/10).

## H1 — Vía 3 y vía 1 desde «Órdenes»
| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H1.M1 | Simulador: `from-qr` (el lookup y el alta ya los trae `dev`) | `ng test lab-order-qr.handlers` | HECHO |
| H1.M2 | Pestaña «Orden propia» | — | DESCARTADO: otra sesión la entregó en `dev` (`order-intake/lab-order-intake-dialog`, contrato real); se retiró la versión propia para no duplicar. Decide: justin |
| H1.M3 | Pestaña «QR del paciente» (cámara, imagen, soltar, Ctrl+V, código) | `ng test qr-order-tab` + E2E (código a mano) | A MEDIAS: cámara/imagen reales sin probar en un navegador con cámara |
| H1.M4 | Identidad del centro + botón/diálogo del QR en órdenes, chip de origen | `ng test laboratory-orders-page order-origin` + E2E | HECHO |
| H1.M5 | «Usar para una orden» en el chat | `ng test image-to-order` | A MEDIAS: sin E2E |

## H2 — Vía 2 (derivación con aceptación)
| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H2.M1 | Simulador: derivar/aceptar/rechazar | `ng test lab-referral.handlers` | HECHO |
| H2.M2 | «Mis órdenes»: QR y aceptar/rechazar | `ng test diagnostic-orders.referral order-qr-dialog` + E2E | HECHO |
| H2.M3 | Ficha del médico: derivar a un centro | `ng test study-referral order-referral-dialog` + E2E | HECHO |
