# Auditoría FAR-03 — El pedido respeta la receta

- Fecha: 2026-10-31. Auditor: subagente FAR-03. Estado del informe: **completo salvo lo marcado «no se ejecutó»**.
- Código auditado (solo lectura): API `~/auditoria/wt/mantra-core-health-api` @ `e1805fa83` (origin/dev); front `~/auditoria/wt/mantra-core-health` @ `2e4ae419`. FAR-03 **ya está mergeado** en esa API (`prescription-order-guard.ts`, `prescription-order-policy.ts`, `prescription-balance.ts`, `prescription-balance.repository.ts`, `clinical/services/prescription-validity.ts`) y en el front (`orderable-prescription.ts`).
- Entorno: API :3000, SSR :4000, Postgres local (solo lectura). Datos creados SOLO por la API con prefijo `far3-` (productos `far3-AMOX-RX`, `far3-PARA-RX`, `far3-NOMED-RX`, `far3-PARA-LIBRE`; recetas `far3-*`; paciente ajena `far3-otra@alovida.test`).
- Evidencia: `~/auditoria/evidencia/far03/`. `api-log.txt` = cada llamada (método, ruta, cuerpo, status, respuesta). `snap-NN-*.txt` = SQL de lectura antes/después. `ui-*.png` = capturas Playwright/Chromium. Scripts reproducibles: `/tmp/claude-0/-home-user/a3997150-d93c-5870-9eb9-02a4fa558d1f/scratchpad/far3work/` (`s*.py`, `f3_*.cjs`, `snap.sh`).
- Aviso de entorno: el scratchpad y la base son compartidos con otros carriles (far12, far45, far67 crean sedes/productos/pedidos en la misma farmacia Chavez); un archivo mío (`ui9.cjs`) fue pisado por otro agente y lo rehíce en `far3work/`. Los conteos globales (ledger, outbox, stock de `AMOX-500`) pueden moverse por terceros; las comparaciones de «sin efectos» se hicieron sobre las filas de la paciente y los productos `far3-`.

## 1. Tabla REQ → resultado

| REQ | Resultado | Evidencia (una línea) |
|---|---|---|
| 001 regla única `prescriptionItemState` | PASS | Lectura `clinical/services/prescription-validity.ts:30-41` (`ISSUED` + `validTo` nulo/futuro → ACTIVE; `validTo <= now` → EXPIRED; resto NOT_ACTIVE); comportada en API: `api-log.txt` casos A–C, R1, K1, `expired-soon` (201 antes de 03:11:36Z, 422 EXPIRED a las 03:11:41Z). Hash/commit «día 1»: no se ejecutó (git de origen no auditado). |
| 002 saldo `remainingQuantity` / `isComparableUnit` | PASS | `prescription-balance.ts:21-60`: solo `{bottle}`/`{tube}`; receta en comprimidos (21) + `far3-AMOX-RX` x5 → 201 sin control (`api-log.txt` caso 9). Saldo ≥0 por lectura de código. |
| 003 lectura de entregado y reservado | PASS | Receta `far3-ok-bottle3` (3 env): reservado 2 → x2 da 422, cancelar libera, entrega de 2 (`sql-dispensacion.txt`) + 1 reservado → x1 da 422; `snap-04/05/06`, `sql-pedidos-por-receta.txt`. Estados cuentan como en `RESERVING_ORDER_STATUS_IDS`. |
| 004 qué es la receta del pedido (encuentro) | PASS | Encuentro con A (amox, emitida) y B (paracetamol, BORRADOR): pedir para_rx con id de A → 422 PRODUCT_NOT_PRESCRIBED (E1); emitida B → 201 (E2); id de B autoriza amox de A (E4); saldos por fármaco (E3, E5). Reemplazo emitido sí entra (R3 201). |
| 005 `PRESCRIPTION_NOT_ACTIVE` | PASS | DRAFT (A), INVALIDADA (B), REEMPLAZADA (R1), reemplazo en borrador (R2), COMPLETADA vía `medication-records isFinalDose` (K1): todos 422 con `reason`+`details.reason` iguales y mensaje del texto propuesto. Con solo línea libre (M) también 422. |
| 006 `PRESCRIPTION_EXPIRED` | PASS | `validTo` pasado (C) y vencimiento natural (`expired-soon`, 201→422 en el mismo segundo del `validTo`). |
| 007 `PRODUCT_NOT_PRESCRIBED` | PASS | Producto de otro fármaco (F), producto RX sin `medication_concept_id` (G), mixto con línea ok (F2: solo `para_rx` en `productIds`); venta libre de otro fármaco pasa (D-4: pedido 2, `para_libre` x1 → 201). |
| 008 `QUANTITY_EXCEEDS_PRESCRIPTION` | PASS | Receta 3 envases: x4 → 422 (H); 2+1 → 201,201; luego 422; cancelar libera; con entrega suma. Saldo `null` no controla (comprimidos). |
| 009 `PRESCRIPTION_REQUIRED` | PASS | Sin receta + RX (D), + RX sin concepto (E) → 422 con `productIds`; venta libre `false` → 201; `requires_prescription` NULL (`AMOX-500`) sin receta → 201 (N1, `api-log.txt` final). |
| 010 forma del error | PASS | `code=PRECONDITION_FAILED`, `reason` de 1.er nivel = `details.reason`, `details.medicationRequestId` (null sin receta) y `productIds` cuando aplica, mensajes en castellano idénticos a los propuestos (`prescription-order-guard.ts:34-47`). |
| 011 sin efectos | PASS | `snap-01` vs `snap-02`: diff vacío tras 12 llamadas (10 rechazadas: reservas, líneas, ledger, outbox y posiciones de stock idénticas). Para el 404/400 también. |
| 012 sin carrera | PASS | 6 pedidos simultáneos x1 sobre receta de 3 envases: 3×201 y 3×422 (`api-log.txt` «carrera hilo», `snap-07/08`; `sql-pedidos-por-receta.txt` = 3). Una sola corrida de 6 hilos; no se repitió. |
| 013 lo de hoy no cambia | PASS | Receta inexistente → 404 «Receta no encontrada» (L); receta ajena y receta BORRADOR ajena → mismo 404 sin filtrar estado (F1/F2, paciente `far3-otra`); producto de otra farmacia → 404 incluso con o sin receta (X1/X2); idempotencia responde antes de validar: misma clave con saldo 0 e incluso con receta invalidada → mismo id (I2/I3), clave nueva → 422 (I4). |
| 014 «Dónde comprar» pide solo la receta elegida | **FAIL** | En la API real el front declara toda receta «no se puede usar» (ver H3-01, `ui-03-donde-comprar-receta-ui.png`). Con el código de estado corregido de forma simulada (interceptando `/terminology/concepts`), la lista se limita a las 2 filas del encuentro (`ui-15`, `ui-16`) y el pedido viaja con `medicationRequestId` de la receta (`ui-17-*`). |
| 015 caso de uso no crece más que lo indispensable | PASS (parcial) | `create` solo suma `lockOwnRequest` (≈11 líneas, `use-cases.ts:406-420`) y `assertOrderRespectsPrescription` (≈6 líneas, `:442-448`); la lógica vive en archivos nuevos. Conteo exacto con `git diff` del PR: no se ejecutó. |
| 016 PR a `dev` y `test` | BLOQUEADO | `gh pr view` no se ejecutó (sin acceso al repo remoto en el entorno); además `ender/README.md` dice que `test` se dio de baja el 2026-10-30. |

Totales: **14 PASS (1 parcial), 1 FAIL (REQ-014), 1 BLOQUEADO (REQ-016)**. Las 5 reasons de 422 y `remainingQuantity` funcionan en la API; los fallos están en el recorrido del paciente y alrededor.

## 2. Frase del pedido: «El paciente desde la pestaña Farmacia hace el pedido… el usuario por sucursal marca si tiene o no el producto para que el usuario pueda reservar»

| Tramo | Resultado | Evidencia |
|---|---|---|
| Paciente, pestaña Farmacia → buscar → Agregar (venta libre) → carrito → checkout → Confirmar | PASS | `ui-04…ui-09-libre-*`. Request `POST /pharmacy/orders {"siteId":"864f4eb5…","deliveryMode":"RETIRO","idempotencyKey":"1cbc9e9b-…","lines":[{"productId":"3521c5c0-…","quantity":1}]}` → 201 `PINV_ORDER_ENVIADO`, línea 10.00 Bs. |
| Persistencia | PASS | `snap-09` vs `snap-10`: reservas 14→15, líneas 16→17, `far3-PARA-LIBRE` reservado 2→3, disponible 40→39. |
| Producto de receta desde la pestaña Farmacia | FAIL (diseño) | La fila RX no tiene «Agregar» («Requiere receta / Busque su receta para comprarlo», `ui-04`); el único camino es «Dónde comprar», roto por H3-01. En la práctica el paciente no puede pedir un producto de receta desde la UI. |
| Recarga → UI del pedido recién creado | **FAIL** | Tras confirmar redirige a `/my-account/pharmacy-orders/<id>`; `GET /pharmacy/orders/<id> → 404` y «No encontramos lo que busca» (`ui-09-libre-recarga.png`). H3-02. |
| La farmacia lo ve | PASS | `ui-10-farmacia-bandeja.png` (14 pedidos, «Lucía Mamani», `far3-*`), `ui-11` detalle con «Receta electrónica — prescribió Andrés Rojas». Abrir el detalle dispara `POST …/review` (ENVIADO→EN_REVISION). |
| La farmacia gestiona: confirmar → listo → entregar | PASS | `ui-12-farmacia-confirmado`, `ui-13-farmacia-listo`, `ui-13-farmacia-codigo`, `ui-13-farmacia-entrega`: `POST …/dispense {"pickupCode":"NVXPKN",…}` → 200, «Finalizada». SQL: dispensación `DISPENSED` 2 unidades (`sql-dispensacion.txt`); `snap-11`→`snap-12`: `far3-AMOX-RX` on_hand 57→55 y reservado 17→15 (descuento y liberación de reserva coherentes). |
| Farmacia abre la receta y ve saldo | PASS | `ui-14-farmacia-abre-receta.png`: «Quedan 4 de 4», 33 interruptores «Lo tengo» por sede y producto. |
| Sucursal marca «No lo tengo» / «Lo tengo» y el paciente reserva | PASS con reserva (H3-04) | `PUT …/availability {"available":false}` → `quantity 0`; `{"available":true,"quantity":5}` → 5; pedido x3 → línea CONFIRMED, reservado 3 (`snap-13/14`: on_hand 42→8, reservado 3→6). Pero ver H3-04. |
| «Dónde comprar» → Enviar pedido con `medicationRequestId` (solo con corrección simulada de H3-01) | PASS condicionado | `POST /pharmacy/orders {"siteId":"368bda30-…","medicationRequestId":"0392b36d-…","deliveryMode":"RETIRO","lines":[{"productId":"db5882c9-…","quantity":1}]}` → 201; luego `GET /pharmacy/orders/0ee0e70c… → 404` (H3-02 otra vez). `ui-17-*`. |
| El mensaje de un 422 llega al paciente en la UI | PASS | Receta invalidada con la pantalla ya abierta (con corrección simulada de H3-01): `POST /pharmacy/orders {"medicationRequestId":"a01def07-…",…}` → 422 `PRESCRIPTION_NOT_ACTIVE` (`reason` y `details.reason`); la pantalla muestra «No pudimos confirmar su pedido. Esta receta ya no se puede usar: fue anulada, reemplazada o ya se entregó. (Código de soporte: d9e9d7b0-…)» y conserva el pedido (`ui-19-receta-invalidada-con-pantalla-abierta-tras-confirmar.png`; `snap-17` vs `snap-18`: diff vacío, sin efectos). El caso 404 de H3-05 se vio en una corrida previa (captura sobrescrita).

## 3. Hallazgos

### H3-01 — Alta/bloqueante — «Dónde comprar» rechaza TODA receta en la API real
- **Observado:** abrir `/my-account/medical-record/where-to-buy/<recetaEmitidaYVigente>` muestra «Esta receta no se puede usar para comprar: todavía no se emitió, fue anulada o reemplazada, ya se entregó o venció» (`ui-03-donde-comprar-receta-ui.png`). La API devuelve para el estado el código `clinical:MEDICATION_REQUEST_ISSUED`:
  `GET /terminology/concepts?ids=cce628c0-…&lang=ES` → `{"conceptId":"cce628c0-…","code":"clinical:MEDICATION_REQUEST_ISSUED",…}` (`api-log.txt`/salida de la sesión). El front compara con `'MR_ISSUED'`.
- **Causa probable:** `mantra-core-health/src/app/features/account/medical-record/where-to-buy/orderable-prescription.ts:15` (`ISSUED_STATUS_CODE = 'MR_ISSUED'`) usado en `:29`; consumido en `where-to-buy.ts:615`. `MR_ISSUED` es el `code` en `clinical.concepts.ts:598` y en los mocks (`core/mock/fixtures/concepts.ts:1004`), pero el catálogo persistido lo expone con prefijo de módulo y clave (como el resto del front: `'clinical:SERVICE_REQUEST_CATEGORY_LAB'`). Las pruebas pasan solo con los mocks.
- **Corrección mínima:** `ISSUED_STATUS_CODE = 'clinical:MEDICATION_REQUEST_ISSUED'` y ajustar fixtures/spec; mejor aún, que la API devuelva un indicador de vigencia en el resumen y el front no interprete códigos.
- **Con la corrección simulada** (`f3_wtb.cjs`, FIX=1, reescribe el código en la respuesta): la lista se limita a la receta elegida (D-3 funciona) — `ui-15`.

### H3-02 — Alta — El paciente no puede abrir el detalle de SUS pedidos (404)
- **Observado:** `GET /pharmacy/orders/<id>` con el token del titular → 404 «Pedido no encontrado» para los 15 pedidos de la paciente (`for` sobre `/me`, 15×404); con `X-Tenant-Id` del tenant semilla también 404; con el de la farmacia → 403. La lista `/pharmacy/orders/me` sí devuelve los 15. En la UI, tras confirmar un pedido (201) la pantalla de detalle dice «No encontramos lo que busca» y tras recarga igual (`ui-09-libre-recarga.png`, `ui-17-pedido-desde-receta-tras-confirmar.png`). Rompe `persistencia → recarga → UI` de la paciente, el recibo y los enlaces de notificación.
- **Causa probable:** `pharmacy_inventory/application/pharmacy-orders/pharmacy-orders.use-cases.ts:588-593` llama `findPharmaciesByIdsInTenant(em, tenantId, …)` con el tenant del request incluso para el titular; la farmacia es de otro tenant. El propio repositorio dice que para la vista del paciente va `undefined` (`pharmacy-orders.repository.ts:232-234`) y `composeOrders` ya lo hace (`:620-625`, `isOwner ? undefined : tenantId`).
- **Corrección mínima:** calcular `isOwner` antes y pasar `isOwner ? undefined : tenantId` en `:588`; spec de titular con farmacia de otro tenant.

### H3-03 — Media — «Mis recetas» marca «Emitida» recetas invalidadas, reemplazadas, completadas y vencidas, y ofrece «Buscar dónde comprarla» y «Compartir»
- **Observado:** `ui-02-mis-recetas.png`: `far3-invalidated`, `far3-completed`, `far3-replaced-orig` (dos filas) y `far3-expired-past` aparecen «Emitida» (estados reales en SQL: INVALIDATED/COMPLETED/REPLACED/ISSUED con `valid_to` pasado).
- **Causa probable:** `features/account/pharmacy/prescriptions/prescriptions-page.ts:261-266` (`emitida` = tener `issuedAt`) y `prescriptions-page.html:25`.
- **Corrección mínima:** derivar el estado de `statusConceptId` (mismo código de H3-01) y `validTo`, y ocultar «Buscar dónde comprarla»/«Compartir» si no está vigente. La API ya rechaza el pedido (422), así que es un problema de honestidad de la UI.

### H3-04 — Media — Se acepta un pedido cuyas líneas están TODAS sin stock (producto marcado «No lo tengo» en la sucursal)
- **Observado:** tras `PUT …/availability {"available":false}`, `POST /pharmacy/orders` con ese producto → **201** `ENVIADO`, `reservationLines: []`; SQL: línea `RES_LINE_OUT_OF_STOCK`, `reserved_quantity 0`, pedido `ORDER_ENVIADO` (`sql-pedido-no-lo-tengo.txt`, pedido `a46eba41-…`). La farmacia recibe un pedido pendiente que no puede surtir.
- **Causa probable:** `pharmacy-orders.use-cases.ts:473` (`reserveOrderLines` marca SIN_STOCK y el alta continúa; el filtro previo solo mira `out_of_stock_declared` de la farmacia, `:424-440`). Es la «reserva parcial» documentada, pero no cubre el caso de cero líneas reservadas.
- **Corrección mínima:** si `outOfStock === dto.lines.length`, lanzar 422 tipificado (p. ej. `PRODUCT_OUT_OF_STOCK`) antes del `outbox.publish` y revertir la transacción.

### H3-05 — Media — «Enviar pedido» desde una sucursal parcial manda líneas que esa sucursal no vende y todo falla con un 404 genérico
- **Observado (corrida con corrección simulada de H3-01; salida literal de la sesión, la captura de esa corrida fue sobrescrita por la corrida exitosa posterior):** borrador «Amoxicilina — Sin precio publicado — La farmacia no la tiene», luego `POST /pharmacy/orders` → `404 {"code":"NOT_FOUND","message":"Producto no disponible en la sede","details":{"productIds":["1e8c03d8-b4ae-460c-b4b8-259324946da5"]}}` y en pantalla «No pudimos confirmar su pedido. No se pudo enviar el pedido a la farmacia. (Código de soporte: 3f40f509-5dc9-430a-a9aa-c590a978194f)». Quitar la línea con la casilla permite el pedido (`ui-17-*`: 201).
- **Causa probable:** `where-to-buy/pharmacy-branches.ts:289-320` (`orderDraftOf` conserva las líneas con `disponible:false`/`productId:null` y comenta que «viajan igual»), contra la API que responde 404 si el producto no es de la farmacia (`pharmacy-orders.use-cases.ts:424-440`).
- **Corrección mínima:** no enviar las líneas no disponibles (como ya hace `cartLinesFromDraft` para el carrito) y mostrar cuáles se omiten; o deshabilitar «Enviar pedido» en sucursales parciales.

### H3-06 — Media — 166 de 176 productos con `requires_prescription = true` no tienen `medication_concept_id`: nunca se pueden vender con receta (R-03-5)
- **Observado:** `sql-r035-productos-rx-sin-concepto.txt`: `rx_true 176, rx_true_sin_concepto 166, rx_nulo 38, total 554`. Con receta darían `PRODUCT_NOT_PRESCRIBED` (caso G) y sin receta `PRESCRIPTION_REQUIRED` (E): pedido imposible. (Incluye datos de otros carriles; mi `far3-NOMED-RX` es 1.)
- **Causa probable:** datos de carga (seed/bulk) sin concepto; `pharmacy/dto/create-product.dto.ts` no exige el concepto cuando `requiresPrescription=true`.
- **Corrección mínima:** validar en alta/bulk (400/rechazo de fila) que un producto con receta obligatoria traiga `medicationConceptId` (o `catalogProductId`), y corregir el catálogo existente.

### H3-07 — Media/Baja — «Dónde comprar» considera un solo producto por fármaco
- **Observado:** `GET /pharmacy/products?conceptId=<amox>&limit=1` y `…availability?products=772972ec-…,1e8c03d8-…` (ambos de las farmacias `far67`, ninguno de Farmacia Chavez) (`ui-15`, `ui-16`). Los productos de otras farmacias del mismo fármaco no entran, y se ofrecen sucursales ajenas a la mejor oferta.
- **Causa probable:** `where-to-buy/where-to-buy.ts:660-665` (`searchProducts({ conceptId, limit: 1 })`, usa `items[0].id`).
- **Corrección mínima:** consultar disponibilidad por `conceptId` (todas las ofertas) o paginar productos por fármaco. Fuera del texto de FAR-03 pero condiciona «pedido desde la receta».

### H3-08 — Baja — La API permite emitir una receta con `validTo` en el pasado
- **Observado:** `POST /clinical/medication-requests {… "validTo":"2026-10-29T…"}` → 201, firma 200, emisión 200 (`api-log.txt` «receta expired-past»). El pedido luego da `PRESCRIPTION_EXPIRED` (correcto), pero la médica pudo emitir algo ya vencido.
- **Causa probable:** `clinical/services/medications.service.ts:402` y `:606-607` (emisión) no validan `validTo > now`.
- **Corrección mínima:** 422 en alta/emisión si `validTo <= now`. Fuera de FAR-03.

### H3-09 — Info — Control de cantidad efectivo solo con `{bottle}`/`{tube}`
- **Observado:** las recetas creadas desde el flujo normal no traen unidad (`unitCode null` en `/pharmacy/prescription-shares`, `ui-14`: «Quedan 4 de 4» solo porque se usó envase); con unidad `tablet` el pedido x5 pasa (caso 9). Es D-5 aceptado; solo se anota que el 422 de cantidad en práctica no se dispara con recetas típicas.

### Observaciones sin ID
- «Su receta: Receta electrónica. Quién la emitió y cuándo todavía no se muestra acá.» aparece también en un pedido de venta libre sin receta (`ui-07-checkout.png`).
- Los productos `far3-*` aparecen disponibles en 16 sedes de la farmacia donde no se marcó disponibilidad (`ui-04`, `ui-14`): fallback al stock declarado de la farmacia para sedes sin posiciones. Es territorio FAR-06; no se auditó aquí.
- Capturas pendientes / no ejecutadas: tema oscuro y móvil (no pedidos para este carril), PRs (REQ-016).

## 4. Qué no se tocó
Ningún cambio de código, commit ni push; no se leyó ni tocó `.env` ni `.claude/`. Datos solo por API (más SQL `SELECT`). Playwright con Chromium sin ventana, sin `networkidle`, un navegador a la vez. Para H3-01 se interceptó la respuesta del catálogo en el navegador solo como experimento de diagnóstico, rotulado como tal.
