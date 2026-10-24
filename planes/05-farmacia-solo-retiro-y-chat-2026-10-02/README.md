# Plan 05 · Farmacia: sólo retiro, chat con la farmacia y una tienda que se entiende — 2026-10-02

> Rama base: `mockup` (`525859e9`). Repo: `mantra-core-health/` (Angular, maqueta en memoria).
> Sucede al Plan 04 (`04-farmacia-ecommerce-2026-09-25`), del que hereda contratos (§4) y lo que
> ya se construyó. **Este plan no crea una tienda nueva: arregla la que hay, le saca la
> intermediación (delivery / pago) y le pone el chat.**

---

## 0 · Resultado observable (Outcome First)

| | |
|---|---|
| **Actor** | Paciente con sesión (`paciente@alovida.mock`) y, del otro lado, el mostrador (`farmacia@alovida.mock`). |
| **Acción** | Entra a «Farmacia», ve farmacias reales cerca, entra a una, arma el pedido, **lo reserva para pasar a recoger**, y si tiene una duda **le escribe a la farmacia por el chat de la app**. Desde «Tus últimos pedidos» ve **qué pidió** y lo **repite** en un toque. |
| **Estado inicial** | Hoy: la portada abre vacía («Escribí qué buscás»), la lista de farmacias trae 7 razones sociales sin dirección a «0,4 km» duplicando a las reales, «Entrar» da **404**, el checkout ofrece Delivery + direcciones de maqueta + pago QR/tarjeta de maqueta, y nadie puede hablar con la farmacia. |
| **Resultado visible** | Portada con farmacias (nombre único, dirección, distancia, «desde Bs», «Entrar»). Tienda por farmacia con catálogo y «Agregar». Carrito → **una sola pantalla «Confirmar retiro»** → pedido `ENVIADO` con código de retiro y botón «Escribir a la farmacia». Ningún texto de envío, domicilio, delivery, PedidosYa, Yango, QR ni tarjeta en todo el módulo. |
| **Persistencia** | El pedido existe en el backend (mock hoy, `POST /pharmacy/orders` con `deliveryMode: 'RETIRO'`), compromete stock, y la conversación queda en la bandeja de chat de ambos. |
| **Errores que debe manejar** | Sin perfil de paciente · sin origen para «Más cerca» · producto sin precio publicado · receta obligatoria sin receta · stock insuficiente al repetir · farmacia sin perfil de chat · conflicto de carrito (otra sede) · fallo de red en cada lectura (S4 con reintento). |

**Regla de oro del propietario (2026-10-02):** *AloVida no hace el pedido ni lo entrega. No deriva a
PedidosYa ni a Yango. Lo único que queda es reservar para pasar a recoger (comprometer stock) y
hablar con la farmacia por el chat de la app.* Toda decisión de este plan se mide contra esa frase.

---

## 1 · Qué entra y qué no (Scope Discipline)

**Entra**

1. Arreglar la carga de farmacias (datos + ruta rota).
2. Rehacer la portada de la tienda para un consumidor que no leyó el manual.
3. Quitar delivery, direcciones y pago de maqueta en **todo** el módulo de tiendas (paciente **y** farmacia).
4. «Tus últimos pedidos» con lo que se pidió y «Repetir compra».
5. Chat con la farmacia desde la tienda, el pedido y el mostrador.
6. E2E del recorrido completo del paciente (hoy no existe) + regresión.

**No entra** (se registra, no se hace): Cotizaciones · el recibo y la factura del pedido · borrar el hub
viejo `pharmacy-hub/` (Plan 04, Pablo, Ola 3) · pasarela de pago real · backend real (se pide a
Marcelo, el mock cubre) · modelo/DDL/seeds · «Lugares cercanos» (ya redirige a Farmacia) · el
directorio público de farmacias (`/f/:slug`) salvo quitar textos de delivery.

---

## 2 · Diagnóstico verificado (hechos, no hipótesis)

Todo lo de abajo se observó en runtime con `corepack yarn dev --port 4200`, sesión de paciente, o
se leyó con archivo y línea. Donde dice «hipótesis», es hipótesis.

### H1 — «Entrar» a una farmacia da 404 (bloqueante)

- `store-results.html:22-31` enlaza a `pharmacyStoreRoute(pharmacyId, siteId)` →
  `/my-account/pharmacy/stores/<id>?site=<id>` (`pharmacy.routes.ts:16-20`).
- `app.routes.ts` registra `my-account/pharmacy`, `…/cart` (506) y `…/prescriptions` (494), **pero
  no `…/stores/:pharmacyId`**. `git log --all -S"pharmacy/stores" -- src/app/app.routes.ts` devuelve
  **vacío**: la ruta nunca existió en ninguna rama.
- Observado: clic en «Entrar a Farmacia Vida · Sucursal Central» → «No encontramos lo que buscás».
- El componente que sabe pintar una tienda existe: `pharmacy-hub/pharmacy-shop/pharmacy-shop.ts`
  (catálogo por farmacia, ±, carrito), pero sólo vive embebido en el hub viejo
  (`pharmacy-hub.html:35`) y **no lee la ruta** — elige la sede con su propia lista interna.

### H2 — La lista de farmacias está contaminada con razones sociales sin sede

- `GET /pharmacy/sites` (mock, `pharmacy.handlers.ts:1307`) lista `FARMACIAS`, que nace de
  `vitrinas.filtrar(kind === 'PHARMACY')` (`:64-78`).
- Las vitrinas de farmacia salen de tres fuentes: 8 de la maqueta (`comunidad.ts`), 50 sucursales
  del corpus «Bolivia Salud · Eje Central» (`bolivia-eje-central.generated.ts`) **y 7 razones
  sociales del registro RUES** (`markdown-institutions.generated.ts:46`, vía `instituciones.ts:198`)
  con `address: null`, `precision: "ciudad"` y **todas en el mismo punto** (`-17.7834, -63.1821`).
- Resultado en pantalla: «FARMACIA ARTESANAL · Sucursal principal · 0,4 km» ×7, en mayúsculas, sin
  dirección, y **duplicando** a las reales: `FARMACIA CHAVEZ` ≡ «Farmacias Chávez · Sucursal
  Cañoto», `FARMACORP S.A.` ≡ «Farmacorp · …» (×7 sucursales), `FARMACIA HIPERMAXI` ≡ «Hipermaxi
  Farmacias · …».
- Además, como todas tienen productos sembrados (`productos` se arma con `FARMACIAS.flatMap`,
  `:407-430`), el filtro `productCount > 0` del buscador no las saca.

### H3 — La tienda abre vacía y esconde el modo «Farmacias»

- `store-front.ts:160-162`: modo por defecto `products`; sin término muestra «Escribí qué buscás»
  (`store-front.html:92-95`). **Ninguna farmacia a la vista al entrar.**
- El cambio a «Farmacias» está en un `app-segmented-control` que a 1024 px **trunca** las etiquetas
  («Produ…», «Farma…», «Más b…», «Más c…») — observado; a 1440 px se lee pero sigue siendo un
  control técnico para un usuario que sólo quiere ver farmacias.

### H4 — Nombres duplicados o contradictorios

- Vitrina `farmacia-chavez` se llama literalmente «Farmacias Chávez · Sucursal Cañoto»
  (`comunidad.ts:230`) y su sede dice «Sucursal principal» (`pharmacy.handlers.ts:73`) → la fila
  dice dos sucursales distintas. En «Tus últimos pedidos» se ve igual (captura del propietario).
- Corpus: «Farmacorp · 21 de Mayo» / «21 de Mayo» — el nombre de la sucursal se repite en las dos
  líneas porque `displayName` ya lo incluye (`bolivia-eje-central.ts:466`).

### H5 — «Tus últimos pedidos» no dice qué pediste ni deja repetir

- `recent-orders.ts:24-31` proyecta sólo `farmacia · sede · fecha · estado`. Ni un renglón, ni el
  total. Para el consumidor es una lista de nombres de farmacia.
- «Pedir de nuevo» existe **sólo** en el detalle y **sólo** con estado `VENCIDO`
  (`order-detail.html:120-131`), y `PharmacyOrdersClient.reintentar()` **crea el pedido de una**
  (`pharmacy-orders.client.ts:107-119`: `POST` directo, sin pasar por el carrito, sin dejar revisar
  cantidades ni stock). Repetir desde la portada así sería comprometer stock sin mirar.
- `CartStore.replaceWith(site, lines, requestId)` (`cart.store.ts:135`) y `CartLine`
  (`pharmacy-cart.types.ts`) tienen **todo lo que un pedido ya trae** (`productId`, nombre,
  presentación, cantidad, precio, moneda, `requiresPrescription`): «Repetir compra → carrito» es
  viable sin contrato nuevo.

### H6 — Delivery y pago de maqueta viven en seis lugares

| Dónde | Qué hay hoy | Archivo |
|---|---|---|
| Checkout del paciente | Radio «Delivery», paso «Dirección» con direcciones de ejemplo, paso «Medio de pago» QR demo / tarjeta deshabilitada, resumen con «Envío» | `pharmacy-orders/checkout/checkout.{ts,html}`, `order-summary.*`, `checkout.fixtures.ts:84`, `checkout.summary.ts` |
| Revisión de la orden | Radios «Envío a domicilio» y «Envío a mi trabajo» deshabilitados + nota «todavía no están disponibles» | `new-order/new-order.html:329-345`, `new-order.ts` |
| Estados del pedido (paciente) | Etiquetas «Envío a domicilio» / «Envío a tu trabajo», paso «En camino», cierre «Entregado», descripciones con «del envío al retiro» | `pedido-status.ts`, `pharmacy-orders.html:4`, `order-detail.html:3,36` |
| Mostrador (farmacia) | Chip «Delivery», ramas `salePorReparto()`, fixture `ID_PEDIDO_CON_DELIVERY` (`pharmacy-order-8`, `modalidad: 'DOMICILIO'`) | `pharmacy-inbox/entrega-status.ts`, `inbox-order.ts:250-297`, `pharmacy-inbox.fixtures.ts:236-297`, `pedidos-de-farmacia.ts:22-29` |
| Ficha pública estática | Botón «Pedir a domicilio», sello «Entrega a domicilio», cifra «Envío desde Bs 12», columna «Entrega a domicilio», `<dt>Envío a domicilio</dt>` | `alovida/buscar/perfil-farmacia-detalle/perfil-farmacia-detalle.html:17,19,22,44,57` (ruta `buscar/perfil-farmacia-detalle`) |
| Contratos y mocks | `homeDeliveryAvailable` en `PharmacySite`/`AvailabilitySite`/ficha (`pharmacy.types.ts:258,458,524`), `homeDelivery` en el mock (`pharmacy.handlers.ts:75`), `delivery:` en `where-to-buy.ts:173,1108` (sin uso en la plantilla), `MODALIDADES_DE_ENTREGA` con `DOMICILIO`/`TRABAJO` (`pharmacy-orders.types.ts:41`) | — |

El contrato ya hace lo correcto en el envío: `CreatePharmacyOrderDto.deliveryMode: 'RETIRO'` es
literal (`pharmacy-orders.dto.ts:85`) y `checkout.ts:390` manda `RETIRO` siempre. El problema es
**lo que se le muestra y se le promete al usuario**, no lo que se manda.

### H7 — Chat: la cañería existe, faltan dos caños

- Mecanismo vivo: `/messaging?escribirA=<slug>` abre o crea el hilo (`messaging.ts:191-210`,
  `chat.store.ts:1548`). Lo usan la ficha pública y «Hablar con el broker» (`insurer-detail.html`),
  con el patrón `chatSlug: string | null` en el contrato (`insurance.types.ts:268-276`).
- Las farmacias **son vitrinas con slug** (`comunidad.ts:230`, `farmacia-vida`…), y el mock arma
  `FARMACIAS` desde esas vitrinas, así que **conoce el slug de cada `pharmacyId`**.
- **Caño 1 (contrato):** ni `PharmacySite`, ni `PharmacyOrderDto`, ni `PedidoFarmacia` llevan el
  slug de la farmacia → la pantalla no tiene con qué armar el enlace.
- **Caño 2 (identidad del mostrador, mock):** `vitrinaDeSesion()` resuelve
  `vitrinaDe(practitionerProfileId ?? patientProfileId ?? user.id)` (`community.handlers.ts:94`) y
  `vitrinaDe` compara con `targetId`/`id` (`comunidad.ts:358-360`). La vitrina de Farmacia Vida tiene
  `targetId = uuid('tenant-farmacia-vida')` y la cuenta `farmacia@alovida.mock` trae
  `userId = uuid('user-farmacia-vida')` y `tenants: [TENANT_FARMACIA]` (`mock-session.ts:38,122,251`).
  **No casan**: un mensaje del paciente a `farmacia-vida` hoy cae en una vitrina a la que el
  mostrador no accede. Hay que resolver la vitrina del staff **por tenant**.
- Para que el mostrador escriba al paciente hace falta el slug del paciente en el pedido
  (`patientName` no alcanza); los pacientes del mock tienen slug `paciente-N` (`comunidad.ts:294`).

### H8 — Nota operativa

`yarn start` en `mockup` ejecuta `node dist/mantra-core-health/server/server.mjs` (**un build
viejo**); el servidor de desarrollo es **`yarn dev`** (`package.json:14,16`). El `CLAUDE.md` de la
raíz dice `yarn start (:4200)`: está desactualizado. El lanzador de la sesión ya quedó corregido en
`Mantra Core Health/.claude/launch.json` → `alovida-mockup` = `corepack yarn dev --port 4200`.

### Baseline de pruebas

- Unitarias que tocan el módulo: `store-front.spec.ts` (12 `it`), `recent-orders.spec.ts` (5),
  `checkout.spec.ts` (27), `pedido-status.spec.ts`, `entrega-status.spec.ts`, `inbox-order.spec.ts`,
  `pharmacy-inbox.fixtures.spec.ts`, `pharmacy-search.service.spec.ts`, `cart.store.spec.ts`,
  `pharmacy-shop.spec.ts`, `pharmacy.handlers.spec.ts`, `markdown-catalogs-visibility.spec.ts`
  (**exige que las 7 RUES se vean** en algún directorio — ver D-2).
- E2E existentes: `portal-farmacia.spec.ts` (portal de la **cuenta de farmacia**: menú de ocho,
  productos, inventario, capturas), `tablero-de-pedidos-de-farmacia.spec.ts`. **No hay E2E del
  recorrido del paciente** (tienda → carrito → pedido).
- Cuentas de prueba del mock (contraseña: cualquier texto no vacío): `paciente@alovida.mock` (CI
  `7654321`), `farmacia@alovida.mock`.

---

## 3 · Principios para la pantalla (ponerse en el lugar del consumidor)

1. **Lo primero que se ve son farmacias**, no un buscador vacío. Como cualquier app de compras:
   entrás y hay tiendas.
2. **Una farmacia = una fila con lo que hace falta para decidir**: nombre (una vez), sucursal,
   dirección, distancia, «desde Bs X» si se buscó algo, y un botón «Entrar». Nada en MAYÚSCULAS de
   registro mercantil.
3. **El buscador es uno solo.** Escribís «paracetamol» y ves dónde está y a cuánto; borrás y
   vuelven las farmacias. Sin «Buscar en: Productos | Farmacias».
4. **Se dice lo que pasa, en palabras del mostrador:** «Reservá y pasá a recoger», «Pagás en la
   farmacia al retirar», «La farmacia tiene 48 h tu pedido apartado». Nunca «checkout», «delivery»,
   «modalidad».
5. **Lo que no hacemos, no aparece** — ni deshabilitado, ni «próximamente». Un radio gris de «Envío a
   domicilio» promete algo.
6. **Cada pedido cuenta qué tiene**: «Paracetamol 500 mg ×2 · Ibuprofeno 400 mg ×1 · Bs 48», y dos
   acciones: **Repetir compra** y **Escribir a la farmacia**.
7. **Siempre hay una salida humana**: el chat está en la tienda, en el carrito, en el pedido y en el
   mostrador.
8. Estados completos en toda lectura (cargando / listo / vacío / error con reintento), modo
   oscuro, teclado, nombres accesibles, sin scroll horizontal en 375 / 768 / 1440 (regla visual
   del cliente, `.claude/rules/50-frontend.md` y `30-testing.md`).

---

## 4 · Arquitectura objetivo

```text
/my-account/pharmacy                      Portada: farmacias cerca + buscador único
  └─ /stores/:pharmacyId?site=<siteId>    Tienda de una farmacia (NUEVA RUTA, reusa pharmacy-shop)
  └─ /cart                                Carrito (existe)
  └─ /prescriptions                       Receta completa (existe)
/my-account/pharmacy-orders/new           Revisión de la orden (existe; sin radios de envío)
/my-account/pharmacy-orders/checkout      «Confirmar retiro» — UNA pantalla (hoy 4 pasos)
/my-account/pharmacy-orders/:orderId      Detalle (existe; + «Escribir a la farmacia»)
/messaging?escribirA=<chatSlug>&pedido=<código>   Chat (existe; + borrador prellenado)
/organization/pharmacy-inbox/:id          Mostrador (existe; sin delivery; + «Escribir al paciente»)
```

Flujo del paciente: **portada → farmacia → agregar → carrito → Confirmar retiro → pedido con
código → (chat)**. Flujo de repetición: **últimos pedidos → Repetir compra → carrito prellenado →
Confirmar retiro**.

Componentes que se reutilizan tal cual: `Card`, `Badge`, `Chip`, `SearchField`, `EmptyState`,
`ViewStateHost`, `DialogService.confirm()`, `app-stepper` (ya no en el checkout), `PageHeader`,
`AppButtonLink`, el `CartStore`, el `search-origin-picker`, el patrón `chatSlug`.

---

## 5 · Contratos a tocar (front primero, mock primero, API después)

Memoria del equipo: *no bloquear carriles esperando el modelo*. Se agrega al tipo de vista y al
mock, se deja el `TODO(API)` y se le pide a Marcelo en `COORDINACION-AGENTES.md`.

| Contrato | Cambio | Dónde (front) | Pedido a la API |
|---|---|---|---|
| `PharmacySite` (`GET /pharmacy/sites`) | `+ chatSlug: string \| null` | `pharmacy.types.ts`, mock `pharmacy.handlers.ts:1307` (sale de la vitrina: `vitrinaDe(f.id)?.slug`) | Publicar el slug del perfil comunitario del tenant en las sedes |
| `PharmacyOrderDto` / `PedidoFarmacia` | `+ pharmacyChatSlug: string \| null` · `+ patientChatSlug: string \| null` | `pharmacy-orders.dto.ts`, `.types.ts`, `.adapter.ts`, mock `:786-800` | Idem, en el pedido (los dos lados) |
| `StoreHit` / `ProductHit` | `+ chatSlug` | `pharmacy-search.types.ts`, `pharmacy-search.service.ts` | — (derivado) |
| `PedidoFarmacia.modalidad` | se **conserva** el tipo (`RETIRO \| DOMICILIO \| TRABAJO \| null`) por pedidos históricos; la UI sólo ofrece y nombra `RETIRO` | `pharmacy-orders.types.ts` | Dejar `PINV_DELIVERY_RETIRO` como único valor emitible desde la app |
| `homeDeliveryAvailable` | se conserva en el tipo, **ninguna pantalla lo lee**; el mock lo pone en `false` para todas | `pharmacy.types.ts`, `pharmacy.handlers.ts:75` | — |
| Vitrina del staff (mock) | `vitrinaDeSesion()` cae a `vitrinaDe(user.tenants[0])` para `accountKind: 'ORGANIZATION'` | `community.handlers.ts:91-95` | **Decisión de backend**: quién encarna a la organización en una conversación (perfil del tenant compartido por su staff). Registrar en `COORDINACION-AGENTES.md`. |
| Chat prellenado | `?escribirA=<slug>&borrador=<texto>` → `store.guardarBorrador(texto)` al abrir el hilo | `messaging.ts:191-210` | — (sólo front) |

---

## 6 · Carriles (slices), en orden

Cada carril: archivos, pasos, criterios de aceptación falsables, pruebas, evidencia. Nivel de la
escalera (`15-claim-ladder.md`) que debe alcanzar antes de cerrarse: **REGRESSION_VERIFIED**.
Regla 29: identificadores nuevos en inglés, prosa en castellano.

### C0 · Entorno, baseline y esqueleto E2E (½ día)

- **Hecho ya:** `launch.json` → `alovida-mockup` con `yarn dev`.
- `playwright/tienda-del-paciente.spec.ts` (nuevo): login paciente, abrir `/my-account/pharmacy`,
  **captura del estado actual** en 375/768/1440 como «antes». Sin aserciones todavía.
- Correr `corepack yarn test --watch=false --include='**/pharmacy*/**'` y anotar el número base.
- Corregir el `CLAUDE.md` raíz: `yarn dev`, no `yarn start` (una línea).
- **DoD:** carpeta `docs/progress/evidence/lane-C0/` con las tres capturas «antes» y el baseline.

### C1 · Las farmacias cargan: datos limpios y ruta a la tienda (1 día) — **bloqueante**

**C1.a Datos.** En `pharmacy.handlers.ts:64-78`, `FARMACIAS` excluye las vitrinas **sin sede
física**: toda vitrina de `PHARMACIES_AND_LABS` con `precision !== 'direccion'` o `address === null`
(hoy las 7). Criterio: una tienda sin dirección no se puede ir a recoger. Se hace en el mock, no en
`instituciones.ts`: esas razones sociales **siguen existiendo** como instituciones del directorio
(`markdown-catalogs-visibility.spec.ts` lo exige) — sólo dejan de ser tiendas. Ver D-2.

**C1.b Nombres.** Presentador único `pharmacy-site-label.ts` (nuevo, en `features/account/pharmacy/`)
con `storeTitle(site)` y `storeSubtitle(site)`: si `siteName` ya está contenido en `pharmacyName`
(«Farmacorp · 21 de Mayo» / «21 de Mayo») o `pharmacyName` ya dice «· Sucursal X», el título es la
cadena y el subtítulo la sucursal, **una vez cada uno**. Corregir además la vitrina
`farmacia-chavez` del mock: `name: 'Farmacias Chávez'`, `siteName: 'Sucursal Cañoto'`
(`comunidad.ts:230` + `pharmacy.handlers.ts:73`). Lo usan `store-results`, `recent-orders`,
`cart-page`, `new-order`, `checkout`, `order-detail` (la misma función, seis lugares).

**C1.c Ruta.** `app.routes.ts`: `my-account/pharmacy/stores/:pharmacyId` → `StorePage` (nuevo,
`features/account/pharmacy/store-page/`), `seccionRolesGuard` como `…/cart`. `StorePage` lee
`pharmacyId` y `?site`, carga `GET /pharmacy/pharmacies/:id` (mock `:844`, con sus `sites`) y el
catálogo con precio de la sede (`GET /pharmacy/sites/:siteId/prices`, mock `:1341`) y **reutiliza el
cuerpo de `pharmacy-shop`** (lista de productos, ±, «Agregar», conflicto de carrito). Si
`pharmacy-shop` no se puede parametrizar sin romper el hub, se extrae su catálogo a
`store-catalog/` compartido y el hub lo sigue usando. Cabecera: título/sub de C1.b, dirección,
distancia si hay origen, botón «Escribir a la farmacia» (lo activa C6; en C1 queda oculto).

**Aceptación**
- `GET /pharmacy/sites` del mock no devuelve ninguna sede con `addressText === null`.
- En la lista no aparece ningún nombre en mayúsculas sostenidas ni dos filas de la misma empresa en
  el mismo punto.
- Clic en «Entrar» de cualquier farmacia → tienda con su catálogo (**200, no 404**), «Agregar» mete
  al carrito y el ícono de la cabecera suma.
- `pharmacy-search.service.spec.ts`, `pharmacy.handlers.spec.ts`, `markdown-catalogs-visibility.spec.ts`
  en verde (ajustando la lista cerrada si la hay, nunca saltando el test).

### C2 · La portada que se entiende (1,5 días)

Reescribir `store-front.{ts,html,css}` sin tocar el servicio de búsqueda:

1. **Estado inicial = farmacias**: `searchStores('')` ordenadas por distancia si hay origen; por
   nombre si no. El selector de origen queda como chips «Tu casa · Trabajo · Ubicación actual» y
   si no hay ninguno, la lista igual se ve (sin distancia) con un aviso corto «Elegí desde dónde
   medir para ver distancias».
2. **Buscador único**: con ≥ 2 letras pasa a resultados de productos (una fila por producto y
   farmacia, precio, «Agregar»/insignia de receta); con el campo vacío vuelven las farmacias. Se
   elimina el segmentado «Buscar en». El orden se elige con chips «Más barato · Más cerca» que no
   truncan (`white-space: nowrap`, ancho natural; probado a 375).
3. **Tarjeta de farmacia**: título/sub de C1.b, dirección, distancia, «desde Bs X» si hay término,
   «Entrar». Nada más.
4. **Atajos**: «Buscar toda una receta» y «Mis pedidos» quedan, como botones secundarios bajo el
   buscador.
5. Estados: skeleton, vacío de búsqueda («Ninguna farmacia publica algo con ese nombre» +
   «Probá con otra palabra»), error con reintento, sin perfil de paciente.
6. Copy de la cabecera: «Elegí una farmacia, armá tu pedido y pasá a recogerlo. Pagás en la
   farmacia.»

**Aceptación:** al entrar sin escribir nada hay ≥ 1 farmacia visible en 375/768/1440 · ningún
texto cortado con «…» en los controles · `store-front.spec.ts` reescrito (≥ 12 casos, incluidos
«vacío muestra farmacias», «término cambia a productos», «borrar vuelve a farmacias») ·
`design-taste` pasada en la portada (candado de genericidad, contraste, copy).

### C3 · Sólo retiro en la revisión y la confirmación (1 día)

**`new-order.html:329-345`**: se elimina el bloque «Cómo lo recibís» entero. En su lugar, una
línea de hecho: «Retiro en **{farmacia · sucursal}**, {dirección}». `new-order.ts`: fuera
`modalidad()`/`alElegirModalidad()`.

**`checkout/`** pasa de 4 pasos a **una pantalla «Confirmar retiro»**:
- Se eliminan `ENTREGAS`, `Entrega`, `MEDIOS_DE_PAGO`, `Paso`, el stepper, el paso DIRECCION
  (`DireccionDeEjemplo`, `direcciones`, `checkout.fixtures.ts` de direcciones y envío), el paso
  PAGO (QR demo, lienzo, tarjeta de maqueta), la nota «Con delivery todavía no se puede confirmar»
  y la fila «Envío» de `order-summary`.
- Queda: cabecera «Confirmar retiro», dónde se recoge (título/sub + dirección), el resumen de
  renglones con total (sin «Envío», sin «puntos» si eran de ejemplo — ver D-3), la frase «**Reservamos
  tu pedido 48 horas. Pagás en la farmacia al retirar.**», y dos botones: «Confirmar retiro» y
  «Volver a la orden». El envío sigue siendo `enviar({ borrador, modalidad: 'RETIRO', direccionDeEntrega: null })`.
- Ruta y `data-testid="checkout-confirmar"` se conservan (los usan notificaciones y specs).
- Renombrar el título de la ruta: «AloVida - Confirmar retiro».

**Aceptación:** en todo el recorrido no aparece ninguna de estas palabras: *delivery, domicilio,
envío, trabajo (como destino), QR, tarjeta, pago (como paso), demo, maqueta* — comprobado por un
test E2E que lee el texto de cada pantalla · `checkout.spec.ts` reescrito (los 27 casos actuales
caen a ≈ 12 reales) · el pedido creado trae `deliveryMode = RETIRO` y `pickupCode` al pasar a
`LISTO_PARA_RETIRO`.

### C4 · Sólo retiro en estados, detalle, mostrador y ficha pública (1 día)

- `pedido-status.ts`: `ETIQUETA_DE_MODALIDAD` queda con `RETIRO`; para `DOMICILIO`/`TRABAJO`
  (históricos) devuelve «Retiro en la farmacia (pedido anterior)» — ver D-4; se quitan los pasos
  «En camino»/«Entregado» de `pasosDeLaLineaDeTiempo` (rama `esEnvio`) y la presentación
  «Entregado». Subtítulos «del envío al retiro» (`pharmacy-orders.html:4`, `order-detail.html:3`)
  → «de la reserva al retiro». Bloque «El envío, cuando salió» (`order-detail.html:36`) se borra.
- `entrega-status.ts` + `inbox-order.ts:250-297`: el chip pasa a ser sólo «Recojo en mostrador»;
  desaparecen `salePorReparto()`, las acciones de envío y el tono `info` de Delivery.
  `bandeja-status.ts` igual.
- Fixtures: `pedidos-de-farmacia.ts:22-29` (`conDelivery` → `RETIRO`, renombrar la semilla a
  `pickupOnly`), `pharmacy-inbox.fixtures.ts:236,295-297`, `order-invoice.fixtures.ts` si cita envío.
- `perfil-farmacia-detalle.html`: quitar «Pedir a domicilio», el sello «Entrega a domicilio», la
  cifra «Envío desde», la columna y el `<dt>` de envío. El spec de `pharmacy-detail` que dice
  «Farmacia · entrega a domicilio» cambia el `headline`.
- `where-to-buy.ts:173,1108`: borrar `delivery` del tipo de fila (no se lee).
- Mock `homeDelivery: false` para todas (`pharmacy.handlers.ts:75`).

**Aceptación:** `grep -rniE "delivery|domicilio|envío a|en camino|entregado" src/app/features/{account/pharmacy,account/pharmacy-orders,organization/pharmacy-inbox,alovida/buscar/perfil-farmacia-detalle}` devuelve **0 líneas de plantilla o etiqueta** (comentarios históricos permitidos) · el tablero y `tablero-de-pedidos-de-farmacia.spec.ts` en verde · `entrega-status.spec.ts`, `inbox-order.spec.ts`, `pedido-status.spec.ts` reescritos.

### C5 · «Tus últimos pedidos» cuenta qué pediste y se repite (1 día)

`recent-orders.{ts,html,css}`:
- Fila = **título/sub de la farmacia** · fecha · estado (badge) · **renglones**: hasta 3 «Nombre
  presentación ×cantidad», y «y N más» · **total** («Bs 48» o «precio a confirmar») · acciones
  **Repetir compra** (primaria) y **Escribir a la farmacia** (secundaria, C6) · toda la fila enlaza al
  detalle.
- **Repetir compra** = `CartStore.replaceWith(siteFromOrder, linesFromOrder, order.requestId)` y
  navegar a `/my-account/pharmacy/cart`. Si el carrito ya tiene otra sede →
  `DialogService.confirm()` «Tenés un carrito de {X}. ¿Lo reemplazamos?» (mismo diálogo que
  `pharmacy-shop`). Renglones sin `productId` se omiten y se avisa en el carrito («1 producto ya
  no está publicado»). El carrito revalida stock al «Continuar» (ya lo hace).
- `ultimos()` sube a 3 filas igual; «Ver todos» se queda.
- `order-detail.html`: «Pedir de nuevo» (sólo `VENCIDO`) pasa a llamarse **«Repetir compra»** y usa
  el mismo camino por carrito; `reintentar()` del cliente queda sin uso → se borra (y su spec).

**Aceptación:** la captura del propietario, rehecha, muestra en cada fila qué se pidió y el botón ·
Repetir deja el carrito con los mismos productos y cantidades (E2E lo asevera leyendo el carrito) ·
con receta obligatoria sin receta, `replaceWith` recibe `requestId` del pedido original.

### C6 · Hablar con la farmacia (1,5 días)

1. Contratos de §5 (`chatSlug`, `pharmacyChatSlug`, `patientChatSlug`) en tipos + adapter + mock.
2. Mock: `vitrinaDeSesion()` resuelve la vitrina del tenant para cuentas `ORGANIZATION`
   (`community.handlers.ts:91-95`); test unitario que entra como `farmacia@alovida.mock` y lee
   `/community/profiles/me` → `farmacia-vida`.
3. `messaging.ts`: `?borrador=` opcional → `store.guardarBorrador()` al abrir el hilo.
4. Botón **«Escribir a la farmacia»** (`AppButtonLink`, `variant="secondary"`, ícono `chat`) en:
   `StorePage` (cabecera), `cart-page` (junto a «Continuar»: «¿Dudas sobre un producto?»),
   `order-detail` (siempre que haya `pharmacyChatSlug`), `recent-orders` (fila). Enlace:
   `/messaging?escribirA=<slug>&borrador=Hola, te escribo por mi pedido <código o fecha>`.
   Sin slug → no se pinta (misma regla que `chatSlug` de brokers).
5. Mostrador: **«Escribir al paciente»** en `inbox-order` con `patientChatSlug`.
6. Dar de baja silenciosa de cualquier «coordina la entrega» en copies.

**Aceptación (E2E en dos sesiones del mismo test):** el paciente toca «Escribir a la farmacia» en
su pedido → se abre el hilo con «Farmacia Vida» y el borrador prellenado → envía → **entra como
`farmacia@alovida.mock`** y el mensaje está en su bandeja → responde → el paciente lo ve.
Sin slug el botón no existe (test negativo con una sede del corpus sin vitrina, si la hay).

### C7 · Inglés en lo nuevo, castellano en pantalla (transversal, 0 días extra)

Checklist al cerrar cada carril: rutas (`/stores/:pharmacyId`), archivos (`store-page.ts`,
`pharmacy-site-label.ts`), señales e identificadores nuevos en inglés; lo existente en castellano
**no se renombra** (fuera de alcance, Plan 04 §4.6). `scripts/check-route-prefixes.mjs` en verde.

### C8 · QA de cierre y entrega (1 día)

- `playwright/tienda-del-paciente.spec.ts` completo: portada con farmacias → entrar → agregar →
  carrito → confirmar retiro → detalle con código → últimos pedidos con renglones → repetir →
  carrito igual → chat ida y vuelta. Más: barrido de palabras prohibidas por pantalla; 375/768/1440;
  claro/oscuro; consola sin errores; sin 4xx/5xx inesperados. `--workers=1`.
- Regresión: `portal-farmacia.spec.ts`, `tablero-de-pedidos-de-farmacia.spec.ts`,
  `carril-chat-realtime.spec.ts`, `corepack yarn test --watch=false`, `typecheck`, `build`
  (presupuesto: hoy 1,29 de 1,3 MB — todo diferido por ruta, la tienda nueva no entra al inicial).
- Evidencia: `docs/progress/evidence/lane-05-*/REPORT.md` con antes/después, comandos y salidas.
- PR a **`mockup`** (memoria del equipo), un PR por carril o dos (C1+C2, C3+C4, C5+C6) si se reparte
  en máquinas; `build` verificado **sobre la integración**, no sólo en la rama.

**Dependencias:** C0 → C1 → {C2, C3, C4, C5} en paralelo (archivos disjuntos) → C6 (necesita el
`StorePage` de C1 y las filas de C5) → C8. Estimación total: **8–9 días-persona**; con tres
máquinas, 3–4 días calendario.

---

## 7 · Decisiones tomadas y preguntas con valor por defecto

| # | Decisión | Por qué | Si el propietario dice otra cosa |
|---|---|---|---|
| D-1 | El pago de maqueta (QR demo / tarjeta) **sale del checkout**; «Pagás en la farmacia al retirar» es la única frase de pago. | El propietario pidió sacar todo lo que no sea retiro + chat; un paso de pago «DEMO» confunde y promete una pasarela. El demo del detalle (`order-payment`, detrás de su gate) no se toca. | Si quiere dejar el QR como vitrina de futuro, va al detalle, nunca al checkout. |
| D-2 | Las 7 razones sociales RUES **dejan de ser tiendas** (sin dirección = no se puede ir); siguen como instituciones del directorio. | Una tienda a la que no se puede llegar no es una tienda. Fusionarlas con sus sucursales reales (Chávez/Farmacorp/Hipermaxi) exige un mapeo manual que hoy no existe en los datos. | Fusionar por `legalName` ↔ cadena, en el mock, cuando el propietario lo pida. |
| D-3 | Las cifras de ejemplo del resumen (descuento, coaseguro, puntos) **se quitan** del checkout; queda sólo subtotal real de renglones. | Están rotuladas «valores de ejemplo»; en una pantalla de compromiso no puede haber números inventados. El coaseguro real vive en el detalle (`patient-insurance-settlement`). | — |
| D-4 | Pedidos históricos con `DOMICILIO`/`TRABAJO` se **muestran como retiro** con nota «(pedido anterior)»; el tipo se conserva. | No existen en producción; en la maqueta sólo `pharmacy-order-8`, que C4 convierte. No se borra un valor del contrato de la API. | — |
| D-5 | **Repetir compra pasa por el carrito**, no crea el pedido. | Comprometer stock sin que la persona vea cantidades y disponibilidad es lo contrario a «comprensible». | — |
| D-6 | El hub viejo `pharmacy-hub/` **no se borra acá** (Plan 04, Ola 3, Pablo). Si C1 extrae el catálogo, el hub lo sigue importando. | Scope. | — |
| D-7 | Mock primero, API después (`COORDINACION-AGENTES.md`): `chatSlug`, `pharmacyChatSlug`, `patientChatSlug`, perfil de chat por tenant. | Memoria del equipo: no bloquear carriles esperando a Marcelo. | — |
| P-1 | ¿«Más cerca» sin origen pide elegir uno o usa la ciudad del perfil? **Default:** lista sin distancia + aviso. | — | — |
| P-2 | ¿Cuántas farmacias en la portada? **Default:** 20 (tope del servicio), «Ver más» no entra. | — | — |

---

## 8 · Riesgos

| Riesgo | Mitigación |
|---|---|
| Specs con listas cerradas (`markdown-catalogs-visibility`, `portal-farmacia` «ocho renglones») | Se corrige la lista con su motivo; **nunca** se salta el test. |
| `pharmacy-shop` acoplado al hub | Extraer `store-catalog/` compartido; el hub lo sigue usando; `pharmacy-shop.spec.ts` se mantiene. |
| El checkout lo citan notificaciones y specs por ruta/testid | Ruta y `checkout-confirmar` se conservan; cambia el contenido. |
| Varias sesiones sobre el mismo checkout (regla 20) | Cada carril en su `git worktree`; C2/C3/C4/C5 tocan carpetas disjuntas. |
| Presupuesto de bundle | Todo por `loadComponent`; medir en `build` de la integración. |
| Backend real sin `/pharmacy/sites` ni slugs | Mock cubre; `BUILD_CONFIGURATION=production-api` del front de `test` no debe romper: campos nuevos son `?: string \| null`. |
| El chat del mostrador depende de una decisión de backend (quién encarna al tenant) | Se implementa en mock con la regla más simple (vitrina del tenant) y se registra como pedido explícito; si la API elige otra, cambia el adapter, no las pantallas. |

---

## 9 · Definition of Done (por carril y global)

1. `corepack yarn typecheck` · `corepack yarn test --watch=false` · `corepack yarn build` en 0.
2. E2E dirigido del carril PASS con `--workers=1`; regresión relevante PASS.
3. Barrido de palabras prohibidas = 0 en plantillas y etiquetas del módulo.
4. Capturas 375/768/1440 claro + 1440 oscuro de cada pantalla tocada (VISUAL_PROOF).
5. Consola sin errores; red sin 4xx/5xx inesperados.
6. `docs/progress/evidence/lane-05-<carril>/REPORT.md` + `BUGS.md`/`DECISIONS.md` actualizados.
7. `python3 .claude/hooks/claim.py --lane 05-<carril> --level REGRESSION_VERIFIED --evidence "<ruta>"`.
8. PR a `mockup` con el resumen en castellano y la lista de archivos.

Comandos de referencia:

```bash
cd mantra-core-health && corepack yarn dev --port 4200
```

```bash
cd mantra-core-health && corepack yarn test --watch=false
```

```bash
cd mantra-core-health && corepack yarn pw tienda-del-paciente --workers=1
```

---

## 10 · Prompts de reparto (uno por máquina)

**C1 — Farmacias cargan**
> En `mantra-core-health` (worktree desde `origin/mockup`), carril C1 del Plan 05
> (`planes/05-farmacia-solo-retiro-y-chat-2026-10-02/README.md`): (a) en
> `pharmacy.handlers.ts` excluí de `FARMACIAS` las vitrinas sin dirección física; (b) creá
> `pharmacy-site-label.ts` y corregí la vitrina `farmacia-chavez`; (c) registrá la ruta
> `my-account/pharmacy/stores/:pharmacyId` con un `StorePage` que reutilice el catálogo de
> `pharmacy-shop`. «Entrar» tiene que abrir la tienda (hoy 404). Specs y E2E según §6.C1. Rung
> REGRESSION_VERIFIED antes de cerrar.

**C2 — Portada** · **C3 — Confirmar retiro** · **C4 — Sólo retiro en estados y mostrador** ·
**C5 — Últimos pedidos + Repetir compra** · **C6 — Chat**: mismo encabezado, con la sección §6
correspondiente como especificación y las decisiones de §7 como restricciones. **C6 arranca
cuando C1 y C5 estén mergeados en `mockup`.**

---

*Verificación de este documento: todo lo de §2 se observó el 2026-10-02 sobre `mockup@525859e9` con
`corepack yarn dev` en `localhost:4200`, sesión `paciente@alovida.mock`, o se leyó en los archivos y
líneas citados. Lo no observado está marcado como hipótesis o decisión.*
