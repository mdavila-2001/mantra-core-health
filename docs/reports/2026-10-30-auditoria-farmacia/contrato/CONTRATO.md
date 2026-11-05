# Contrato congelado — Farmacia (2026-10-29, v1.1)

Lo que un carril le promete al otro. **Manda sobre los paquetes.** Si al implementar algo de acá no se
puede, el carril lo anota en su PR con `ruta:línea`, elige lo más cercano que respete el principio rector
y sigue: no se espera a nadie.

Rutas: API `mantra-core-health-api/src/modules/`, front `mantra-core-health/src/app/`.

**v1.1:** corregido contra el código al escribir los paquetes. Las decisiones D-1 a D-6 (Ender) y D-05-1,
D-06-1 a D-06-3 y D-07-1 (Itzan) se toman con la opción recomendada en el `README.md` de cada uno.

## Supuestos de arranque

- **S-1 · Sin modelo.** Ninguna tabla ni columna nueva. La entidad de `shared_access_links` y `_uses` se
  genera con `salud-db/gen_entities.py 29` + prettier, **sobre un checkout limpio de la API**, y se copian
  solo los dos archivos nuevos: el generador reescribe todo el módulo 29 (`salud-db/gen_entities.py:216-229`).
- **S-2 · Qué es una receta.** Los `clinical.medication_requests` del mismo `encounter_id`, emitidos y no
  invalidados, completados ni reemplazados por otro (el reemplazo vigente sí entra). Un fármaco sin
  `encounter_id` es una receta de un solo ítem. La regla vive en una sola pieza de FAR-03
  (`prescription-validity.ts`) que FAR-01 y FAR-02 toman por cherry-pick.
- **S-3 · Quién la comparte.** El paciente dueño (`PATIENT`) y la médica que la emitió.
- **S-4 · Lo que ve cada uno con el enlace:**
  - sin sesión, o con una sesión que no es de farmacia ni del dueño: si es válida, quién la emitió
    (nombre y matrícula) y cuándo. **Ni el paciente ni los fármacos**;
  - el paciente dueño: su receta completa;
  - una farmacia verificada (`PHARMACY_STAFF` de su tenant): los ítems cruzados con su catálogo, y del
    paciente solo el nombre con iniciales y los últimos 3 dígitos del documento.
  - Cada apertura queda en `shared_access_link_uses` (acción `OPEN`, resultado `OPENED` o `DENIED`). Qué
    farmacia la abrió va en el registro de acceso, porque esa tabla no tiene actor
    (`SQL/29_delegated_access/02_tables.sql:101-111`).
- **S-5 · Vencimiento.** El enlace vence con la receta (`valid_to` más próximo de sus ítems) o a los 30
  días si no tiene; lo que ocurra primero. La vista pública responde 200 con su `status`; el endpoint de la
  farmacia responde 410 si está vencido o revocado.
- **S-6 · Token.** 32 bytes aleatorios en base64url. Se guarda solo el hash SHA-256 (`token_hash`). El token
  en claro se devuelve una sola vez, al crearlo. **La ruta que lo lleva se redacta en los logs de la API**
  (`src/logging/pino-options.ts:25-36`).
- **S-7 · Conceptos.** Los estados reusan `CONCEPTS.STATE_ACTIVE`, `STATE_REVOKED` y `STATE_EXPIRED`
  (`src/common/constants/concepts.ts:182-184`). Lo nuevo lo declara la API con `defineModuleConcepts`
  (como `delegated_access/delegated_access.concepts.ts:14`), en inglés: tipos `PRESCRIPTION_ENCOUNTER` y
  `MEDICATION_REQUEST`, alcance `PHARMACY_DISPENSE`, acción `OPEN`, resultados `OPENED` y `DENIED`. En el
  stack local se cargan con `seed:boot` una vez, nunca contra una base compartida.
- **S-8 · Sucursal.** «La tiene» por sucursal sale del stock por posición de esa sede
  (`pharmacy_inventory/domain/site-product-availability.ts`). Ver §4.
- **S-9 · Errores.** Un 422 lleva el código en `reason` (estándar del repo,
  `src/common/errors/domain.exception.ts:139-157`) y también en `details.reason`, con un mensaje en
  castellano. El front muestra ese mensaje (`core/http/api-failure.ts:34-43`): no hace falta un texto por
  código.

## 1. El enlace de la receta (FAR-01)

- `POST /clinical/prescription-shares`
  - cuerpo: `{ encounterId?: uuid, medicationRequestId?: uuid }`, exactamente uno;
  - 201: `{ shareId, url, token, expiresAt, itemCount }`. `url` es `${webAppBaseUrl}/rx/<token>`;
  - 403 si no es el paciente dueño ni la médica que la emitió; 404 si la receta no existe o es de otro
    paciente; 422 si no hay ningún ítem emitido y vigente.
- `GET /clinical/prescription-shares?patientProfileId=` → los enlaces del paciente:
  `[{ shareId, resourceType, resourceId, createdAt, expiresAt, status, uses }]`, sin el token.
- `GET /clinical/prescription-shares/by-token/:token` (paciente o médica) → 200 con la receta si el enlace
  es suyo; 404 si no. No registra uso. Es lo que usa `/rx/:token` para saber si la sesión es del dueño.
- `POST /clinical/prescription-shares/:shareId/revoke` → 204. Solo el dueño o quien lo creó.
- `GET /public/prescription-shares/:token` (sin sesión) → 200
  `{ status: 'VALID' | 'EXPIRED' | 'REVOKED', issuedAt, prescriberName, prescriberLicense, itemCount }`.
  Nada del paciente ni de los fármacos.
- Front:
  - `/rx/:token`, pública: con sesión de farmacia lleva a la pantalla de FAR-02; con la sesión del dueño,
    a su receta; si no, la vista pública;
  - `/verify/rx/:id`, pública: usa el `GET public/prescriptions/:id/verify` que ya existe;
  - en «Mis recetas» del paciente (`features/account/pharmacy/prescriptions/`): «Compartir» por receta,
    con el QR en pantalla, la hoja de compartir del teléfono (`navigator.share`), un enlace
    `https://wa.me/?text=` y «Copiar enlace»; la lista de enlaces con «Revocar».

## 2. La farmacia abre la receta (FAR-02)

- `GET /pharmacy/prescription-shares/:token` (`PHARMACY_STAFF`, scope de su farmacia) →

  ```text
  {
    shareId, issuedAt, validTo,
    prescriber: { name, license },
    patient: { maskedName, documentLast3 },
    items: [{
      medicationRequestId, medicationConceptId, display, dosageText,
      prescribedQuantity, unitCode, dispensedQuantity, remainingQuantity,
      matches: [{
        pharmacyId, pharmacyProductId, name, price, currencyCode, requiresPrescription,
        sites: [{ siteId, siteName, available, quantity, stockUpdatedAt }]
      }]
    }]
  }
  ```

  - el cruce es por `medication_concept_id` del producto contra el de la receta;
  - registra el uso (`OPENED`); un token vencido o revocado responde 410 y registra `DENIED`.
- Front: pantalla «Abrir receta» de la farmacia, a la que llega `/rx/:token`. Lista los ítems, sus
  productos y, por sucursal, el interruptor «Lo tengo / No lo tengo», que llama al endpoint del §4.
- `remainingQuantity` = recetado − entregado − reservado en pedidos activos, calculado en una sola pieza de
  FAR-03 (`prescription-balance.ts`). Solo es comparable si la unidad recetada es un envase que se vende
  por pieza (`{bottle}`, `{tube}`); si no, `null` y la pantalla dice «sin control de cantidad».

## 3. El pedido respeta la receta (FAR-03)

En `POST /pharmacy/orders`, cuando el pedido trae `medicationRequestId`, además de lo de hoy
(`pharmacy_inventory/application/pharmacy-orders/pharmacy-orders.use-cases.ts:400-412`). Todo es 422
(S-9):

| Caso | `reason` |
|---|---|
| La receta no está emitida, o fue invalidada, completada o reemplazada | `PRESCRIPTION_NOT_ACTIVE` |
| `valid_to` ya pasó | `PRESCRIPTION_EXPIRED` |
| Una línea con producto `requires_prescription = true` cuyo `medication_concept_id` no es de la receta | `PRODUCT_NOT_PRESCRIBED` |
| Lo pedido supera `remainingQuantity` (si es comparable) | `QUANTITY_EXCEEDS_PRESCRIPTION` |
| Sin receta, una línea con producto `requires_prescription = true` | `PRESCRIPTION_REQUIRED` |

- Las líneas de venta libre pasan sin validar contra la receta.
- «Dónde comprar» hoy arma el pedido con productos de todas las recetas del paciente bajo un solo
  `medicationRequestId` (`features/account/medical-record/where-to-buy/where-to-buy.ts:570-584`). FAR-03 lo
  acota a la receta elegida (mismo encuentro) en el front, para que estas reglas no rechacen pedidos
  legítimos.

## 4. Disponibilidad por sucursal (FAR-06, se empuja el día 1)

- `PUT /pharmacies/:pharmacyId/sites/:siteId/products/:productId/availability`
  (`PHARMACY_STAFF` de esa farmacia, o `SECURITY_ADMIN`)
  - cuerpo: `{ available: boolean, quantity?: number }`. `false` deja la cantidad en 0. `true` sin
    cantidad toma la del producto; si el producto no tiene conteo o está en 0, 1 unidad;
  - 200: `{ siteId, productId, available, quantity, stockUpdatedAt }`;
  - 422 `PRODUCT_OUT_OF_STOCK_DECLARED` si el producto está marcado sin stock para toda la farmacia
    (`out_of_stock_declared` gana sobre el libro). Una sede no apaga esa marca;
  - escribe por el libro de inventario, nunca a mano.
- **Al escribir en una sede, el mismo caso de uso completa en esa transacción las posiciones que falten**
  del resto de los productos de la sede, con el stock declarado de la farmacia (1 unidad si no tiene
  conteo). Una sede con una posición pasa entera a stock por posición
  (`site-product-availability.ts:70-79,90`), así que ningún producto puede quedar «no disponible» de
  rebote. La pestaña Inventario lista como «Sin registrar en esta sucursal» los productos publicados
  después.
- Una vez que la sede pasa a stock por posición, el `PATCH` de inventario de la farmacia y la subida por
  CSV ya no la afectan. La pestaña lo dice.
- `GET pharmacy-inventory/sites/:siteId/stock` y `/availability`, que ya existen, devuelven lo escrito.

## 5. Importación masiva (FAR-05)

- `POST /pharmacies/:pharmacyId/{categories|products|prices|sites}/bulk`
  - cuerpo: `{ mode: 'CREATE' | 'UPDATE' | 'UPSERT', dryRun?: boolean, rows: [...] }`, hasta 1000 filas;
    el front manda lotes de 250, porque la API rechaza cuerpos de más de 1 MB (`src/main.ts:176`);
  - 200: `{ dryRun, results: [{ row, outcome: 'CREATED' | 'UPDATED' | 'REJECTED' | 'UNCHANGED', id?, errors?: [{ field, reason }] }] }`;
  - con `dryRun` no escribe nada. Sin él, cada fila es independiente: una fila mala no tumba las demás;
  - la clave de upsert la fija el paquete de FAR-05. Productos y sedes no tienen índice único por código,
    así que la carga toma un lock por farmacia.
- `sites/bulk` crea la cadena sede de práctica → sede de venta, como el alta
  (`pharmacy/services/pharmacy-provisioning.service.ts:211-276`). La pantalla «Sucursales» no se toca.
- La subida de inventario por CSV que ya existe se queda como está, dentro de la pestaña.

## 6. Simulador de farmacia externa (FAR-07)

- `mock-provider-server/` suma un proveedor de farmacia con su propio catálogo y stock, con códigos que no
  son los nuestros: `GET /pharmacy-erp/products`, `GET /pharmacy-erp/stock?siteCode=`. El `siteCode` es
  `pharmacy_sites.code`. La API lo encuentra por `PHARMACY_ERP_BASE_URL`, vacía por defecto.
- API: un puerto `ExternalPharmacyCatalogPort` en `pharmacy_inventory/application/ports/`, un adaptador
  HTTP en `infrastructure/adapters/` y un caso de uso que lee y traduce con
  `pharmacy_external_product_mappings`. Llama en el mismo proceso al lote de sincronización y su
  conciliación (`pharmacy-inventory-internal.controller.ts:81,98`, que por HTTP son solo de
  `SECURITY_ADMIN`). Después aplica el stock con el escritor de FAR-06, porque la conciliación no lo
  cambia. Lo que no tiene mapeo se informa, no se inventa.
- `POST /pharmacies/:pharmacyId/integration-connections/:connectionId/sync` (`PHARMACY_STAFF`) →
  `{ batchId, received, mapped, unmapped: [{ externalCode, name }], applied }`.
- Lecturas nuevas para la pestaña: la conexión, sus mapeos, los lotes y el detalle de uno.
- Front: la pestaña Integración del catálogo la suma FAR-07, con la conexión, los mapeos, la última
  sincronización y «Sincronizar ahora».

## 7. Catálogo por pestañas (FAR-04)

- Una ruta: `administration/pharmacy-catalog?tab=products|categories|prices|inventory|import`
  (`integration` la agrega FAR-07).
- `administration/pharmacy-categories`, `pharmacy-prices`, `pharmacy-inventory` y `pharmacy-import`
  redirigen a su pestaña. Los enlaces viejos no se rompen.
- El menú de farmacia pasa de cinco entradas a una: «Catálogo».
