# Plan — Crear una orden en Laboratorio e Imagenología (tres vías)

- Fecha: 2026-11-06 · Repos afectados: mantra-core-health (web + simulador) · Predecesor: `2026-10-31-ordenes-compactas-laboratorio-imagenologia`
- Resultado observable: en «Órdenes» de una cuenta `DIAGNOSTIC_CENTER` hay un botón **Nueva orden** y una orden puede nacer por (1) el QR que manda el paciente, (2) la derivación directa de un médico con aceptación previa del paciente, (3) el propio usuario del laboratorio.
- Kill-test: abrir `/administration/laboratory/orders` y no encontrar ninguna forma de crear una orden; o que una derivación médica aparezca en el laboratorio sin que el paciente la haya aceptado.

## Pedido del usuario (06/11/2026, literal resumido)
Laboratorio e Imagenología no permiten crear una orden. Debe poder crearse por: 1) QR que manda el paciente (lector de cámara, archivo subido, copia del portapapeles, o desde la mensajería con un clic en «subir»); 2) referida directamente por el médico, con aceptación previa del paciente; 3) por el mismo usuario.

## Decisiones confirmadas por el usuario (06/11/2026)
- Alcance: front + simulador (como P52). La API real no tiene `/diagnostics/lab/*`; el contrato queda escrito aquí para que lo implemente.
- QR: lo genera el paciente en «Mis órdenes» (código de la orden); el laboratorio lo lee y la orden queda dirigida a su centro.
- Aceptación de la derivación: el paciente acepta o rechaza desde «Mis órdenes»; recién al aceptar la orden aparece en el laboratorio.

## Hechos (descubrimiento, con ruta)
- Pantalla: `src/app/features/laboratory/orders/laboratory-orders.{ts,html}`; solo lista y transiciona.
- Cliente: `src/app/core/data-access/lab-portal/lab-portal.client.ts` (`listOrders`, `transitionOrder`).
- Simulador: `src/app/core/mock/handlers/lab-orders.handlers.ts`; las órdenes salen de `labInboxOrders` (`diagnostics.handlers.ts:295`).
- Orden clínica del paciente: `orderList` (`fixtures/clinic.ts:720`); «Mis órdenes»: `features/account/diagnostic-orders/`.
- `performerTenantId` NO se llena con la sugerencia del médico (`service-request-performer.types.ts`): sugerir no da acceso. La aceptación del paciente es lo que lo concede.
- QR: `shared/utils/qr/draw-qr.ts` dibuja; no hay lector. Cámara: patrón en `features/identity-verification`.

## Contrato (simulador)
- `GET /diagnostics/lab/patients?q=` → `{items:[{patientProfileId, displayName, patientCode}]}` (q ≥ 2).
- `POST /diagnostics/lab/orders` `{patientProfileId, studyName, note?}` → 201 `LabOrder` (origen `LAB_OWN`, estado `DRAFT`).
- `POST /diagnostics/lab/orders/from-qr` `{code}` → 201 la primera vez, 200 si ya estaba (idempotente); 422 código mal formado; 404 orden inexistente; 409 si ya está dirigida a otro centro.
- Código del QR: `ALOVIDA-ORDEN:v1:<orderId>`. (La API real debería firmarlo y vencerlo: riesgo declarado.) Sólo una orden pendiente o activa se dirige a un centro (409 si no).
- Los 422 del contrato borrador salen como **400** (`validation()` del simulador, forma real de la API).
- Derivación: `POST /diagnostics/orders/:orderId/referral` `{performerTenantId}` (médico) → queda `PENDING`; el paciente `POST /diagnostic-results/me/orders/:orderId/referral/{accept|reject}`; al aceptar entra a la bandeja del centro con origen `DOCTOR_REFERRAL`.

## Alcance
- IN: botón y diálogo «Nueva orden» con las 3 vías; lector de QR (cámara, archivo, pegado, adjunto del chat); QR en «Mis órdenes»; derivación + aceptación; simulador; pruebas.
- OUT: API real y esquema; farmacia; app móvil.
- Ambigüedades: (1) «subir desde la mensajería con un clic» se lee como una acción «Usar para una orden» sobre un adjunto de imagen en el chat; confirmar. (2) La lectura de QR en imágenes depende de `BarcodeDetector` (Chromium); en otros navegadores queda la entrada manual del código. Confirmar si se aprueba sumar `jsqr`.

## H1 — Crear orden desde «Órdenes» (vías 1 y 3)
**CA:** Dado personal de un `DIAGNOSTIC_CENTER`, cuando elige «Nueva orden», entonces puede crearla por QR o por sí mismo y la ve en «Borrador» tras recargar.
**DoD:** typecheck · eslint · `ng test` dirigido · E2E Playwright · capturas 390/768/1440 con doble revisión.
**Estado:** A MEDIAS — funciona y está probado (ver REPORTE); falta la doble revisión adversarial independiente y la captura en tema oscuro.

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Simulador + cliente: pacientes, alta propia, alta por QR (idempotente, 404/409/400) | los 3 niveles del contrato responden | `ng test lab-orders-create.handlers` | HECHO |
| H1.S1.M2 | Lector de QR: cámara, archivo, pegado, adjunto del chat | cada entrada entrega un código | `ng test new-laboratory-order image-to-order` + E2E (entrada manual) | A MEDIAS (cámara/imagen sin probar contra un `BarcodeDetector` real) |
| H1.S1.M3 | Pantalla «Nueva orden» (una tarjeta con pestañas) + botón + origen en la tabla | crea y persiste | `ng test laboratory-orders` + E2E | HECHO |

## H2 — Derivación del médico con aceptación del paciente (vía 2) y QR del paciente
**CA:** Dado un médico que deriva una orden a un centro, cuando el paciente la acepta, entonces aparece en el centro; si la rechaza o no responde, no aparece.
**Estado:** HECHO en simulador (E2E de punta a punta).

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Simulador: derivar, aceptar, rechazar | no entra a la bandeja sin aceptar | `ng test referral.handlers` | HECHO |
| H2.S1.M2 | «Mis órdenes»: QR de la orden y aceptar/rechazar derivación | el paciente ve el QR y decide | `ng test diagnostic-orders order-qr-dialog` + E2E | HECHO |
| H2.S1.M3 | Ficha del médico: derivar a un centro | queda «pendiente de aceptación» | `ng test analysis-order-block order-referral-dialog` + E2E | HECHO |

## Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Sin API real | La UI corre contra simulador | Declarado; contrato arriba |
| Código QR sin firma | Falsificable en producción | Declarado como riesgo para la API real |
| `BarcodeDetector` no existe en Firefox/Safari de escritorio | No se lee el QR de una imagen ni por cámara | Entrada manual del código; confirmar si se aprueba `jsqr` |
| Dos PRs (dev y test) | Entrega | Cherry-pick a rama desde `test` |
