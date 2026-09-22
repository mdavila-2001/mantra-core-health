# Evidencia T-E4 · Seguimiento del pedido y factura (pantalla H)

Capturas de navegador en los cinco viewports de AC-COMUN-02 (390×844, 768×1024, 1024×768,
1440×900, 1920×1080), tomadas el 2026-09-15 con Chrome headless contra `ng serve --port 4221` sobre
`origin/dev a8e8aea5` más los cambios de T-E4 **sin commit**, con la cuenta `paciente@alovida.mock`.

**Backend simulado (`mockBackend: true`).** El pago y la factura son **datos de ejemplo**
(`order-invoice.fixtures.ts`), rotulados en pantalla. El overlay sólo completa el pago cuando el
contrato lo trae en `null`: **no reemplaza ningún valor del contrato** (ni modalidad, ni envío, ni
dirección). Esto **no** es evidencia `FUNCIONA_E2E`.

## Conjunto mínimo: 6 escenarios × 5 viewports

| Escenario | Requisito que prueba |
|---|---|
| `detalle--pagado-en-preparacion` | AC-T-E4-01 · paso «Pagado» condicional, «En preparación» actual, badge de medio de pago |
| `detalle--listo-para-retirar-pagado` | AC-T-E4-01/06 · «Listo para retirar» pagado; AC-T-E4-04 vacío honesto de «Tu factura» en el detalle |
| `detalle--retirado-con-factura` | AC-T-E4-02/06 · pedido entregado (retiro) con «Tu factura»: número, emitida el, total, estado, «Ver factura», «Descargar PDF» y comprobante interno aparte |
| `factura--lista` | AC-T-E4-02/04/05 · pantalla hija `:orderId/invoice` con el documento completo |
| `factura--sin-factura` | AC-T-E4-04 · vacío honesto «Este pedido todavía no tiene factura.» |
| `factura--no-encontrado` | AC-T-E4-04 · error (404 de la API) |

Comprobaciones de la corrida: 0 capturas con desborde horizontal; «Ver factura» navega a
`…/invoice`; el PDF se descarga desde el detalle y desde la factura (`factura-2026-08-27-38c754.pdf`,
31 289 bytes, cabecera `%PDF-`). El estado «cargando» es transitorio y lo fija `order-invoice.spec.ts`.

## Lo que no está en navegador, y por qué

- **Rama delivery («En camino» / «Entregado» por envío).** El backend simulado responde `RETIRO` para
  todos los pedidos (`core/mock/handlers/pharmacy.handlers.ts:222`, fuera del alcance de T-E4) y el
  contrato no publica el hito del envío. Mostrarla exigiría reemplazar un valor del contrato, que la
  regla D-FARMOCK-2 prohíbe. La rama existente queda cubierta por `pedido-status.spec.ts` y por
  `order-detail.spec.ts` con un pedido cuyo contrato trae `DOMICILIO`.
- **Comprobante interno.** `order-receipt` no cambió; su spec sigue en verde. En los pedidos de ejemplo
  el detalle dice «Pagado (demo)» y el comprobante dice «todavía no tiene un pago registrado»: es una
  limitación del mock, porque el contrato no trae pago.

## Retiradas en la curación (2026-09-15)

`detalle--en-camino` y `detalle--entregado-delivery-con-factura` (mostraban un envío obtenido
reemplazando la modalidad del contrato: inválidas tras F-1), `detalle--sin-pago-sin-factura` y
`comprobante-interno--separado` (redundantes: no prueban un requisito explícito con captura y están
cubiertos por specs).

Notas: en las capturas de página completa se ven los botones flotantes del modo simulado («Datos de
prueba» · «Ver componentes»), que son del marco de la app. Los errores de consola por CSP vienen del
`<script>` en línea de `src/index.html:9`, previo a esta tarea.
