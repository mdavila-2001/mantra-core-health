# Farmacia — reparto en carriles

Lo pidió Itzan el 2026-10-29, a partir del documento del propietario. Reparto: **Ender** se lleva la
receta, de punta a punta, e **Itzan** el catálogo y el inventario de la farmacia. Los dos dominios no
comparten archivos, así que **nadie espera a nadie**.

Fuentes:
- `../decision.md` (qué se decidió);
- `CONTRATO.md` (lo que un carril le promete al otro; manda sobre los paquetes);
- un paquete por persona en `Ender/` e `Itzan/`.

Relevado sobre `origin/dev`: front `4cd7db1a3`, API `64e0aa374`, modelo `7a18d7e` (2026-10-29).

**Principio rector:** el paciente es la parte menos favorecida. Su receta es suya: nadie la ve sin su
enlace, y el enlace no deja comprar a otro.

## Punto de partida (lo que ya existe y no se rehace)

- El pedido del paciente: pestaña Farmacia, carrito, checkout, detalle y estados de ENVIADO a RETIRADO
  (`pharmacy_inventory/presentation/controllers/pharmacy-orders.controller.ts:62-351`).
- «Dónde comprar», con disponibilidad por sede y `stockUpdatedAt`
  (`pharmacy-inventory-read.controller.ts:38,56`).
- La bandeja de la farmacia (`features/organization/pharmacy-inbox/`) y el detalle de mostrador
  (`administration/pharmacy-orders/:orderId`).
- La importación de productos (`features/pharmacy/import/pharmacy-import.ts:140-170`) y la subida de
  inventario por CSV (`features/pharmacy/inventory/upload-dialog/`).
- La verificación pública `GET public/prescriptions/:id/verify`
  (`clinical/controllers/clinical-prescriptions-public.controller.ts:45-58`). El QR del PDF apunta a
  `/verify/rx/:id` (`clinical/services/prescription-pdf.service.ts:533`), pero el front no tiene esa ruta
  y cae en no encontrado.
- Las tablas sin usar: `delegated_access.shared_access_links` y `_uses`
  (`SQL/29_delegated_access/02_tables.sql:77-111`), `pharmacy_integration_connections`,
  `pharmacy_external_product_mappings` (`SQL/24_pharmacy/02_tables.sql:187-221`) y los lotes de
  sincronización (`SQL/25_pharmacy_inventory/02_tables.sql:343-377`).

Rutas: front `mantra-core-health/src/app/`, API `mantra-core-health-api/src/modules/`, modelo
`mantra-core-health-model/`.

## Carriles

| Carril | Persona | Repo · bases | Qué entrega | Depende de | Peso |
|---|---|---|---|---|---|
| FAR-01 | Ender | API + front · `dev`/`test` | **La receta se comparte.** El paciente genera un enlace con QR para la receta de una consulta (o de un fármaco suelto), lo manda por WhatsApp o el menú de compartir, lo ve listado y lo revoca. Sin sesión, el enlace solo confirma que la receta es válida. Incluye la ruta `/verify/rx/:id` que ya imprime el PDF | — | L 3 |
| FAR-02 | Ender | API + front · `dev`/`test` | **La farmacia abre la receta.** Con sesión de farmacia, el enlace muestra los ítems ya cruzados con su catálogo y, por sucursal, si los tiene. La farmacia marca «lo tengo / no lo tengo» por sucursal y eso es lo que ve el paciente en «Dónde comprar» | FAR-01 (servicio de enlaces) y FAR-03 (las dos piezas del día 1), mismo dueño; el endpoint de FAR-06 (`CONTRATO.md` §4), con un doble hasta que FAR-06 publique su rama | L 3 |
| FAR-03 | Ender | API + front · `dev`/`test` | **El pedido respeta la receta.** Al pedir con receta: emitida, vigente, el producto es el fármaco recetado y no se pide más de lo que queda. Un producto que exige receta no se pide sin ella. «Dónde comprar» se acota a la receta elegida. **Va primero:** el día 1 publica la regla de receta vigente y el cálculo de lo que queda, que usan FAR-01 y FAR-02 | — | M 2 |
| FAR-04 | Itzan | front · `dev`/`test` | **Catálogo por pestañas.** Productos, Categorías, Precios, Inventario e Importación en una sola pantalla (Integración la suma FAR-07) tipo ERP, compacta. Las rutas viejas redirigen a su pestaña y el menú de farmacia baja a una entrada | — | L 3 |
| FAR-05 | Itzan | API + front · `dev`/`test` | **Importación masiva en todo.** Endpoints de carga masiva con vista previa (`dryRun`) para categorías, productos, precios y sucursales, y la pestaña Importación que los usa | La pestaña de FAR-04 (mismo dueño) | L 3 |
| FAR-06 | Itzan | API + front · `dev`/`test` | **Stock por sucursal.** El endpoint de disponibilidad por sucursal y producto (`CONTRATO.md` §4) y el selector de sucursal en la pestaña Inventario | — (el endpoint se empuja el día 1, porque FAR-02 lo usa) | M 2 |
| FAR-07 | Itzan | API (+ pestaña) · `dev`/`test` | **Simulador de farmacia externa.** Un proveedor nuevo en `mock-provider-server/` que expone el catálogo y el stock de una farmacia con sus propios códigos; en la API, un puerto y un adaptador hexagonales que lo leen, traducen con `pharmacy_external_product_mappings` y escriben por los lotes de sincronización que ya existen | La pestaña Integración de FAR-04 (mismo dueño) | L 3 |

**Pesos:** Ender 8, Itzan 11. Escala: S=1, M=2, L=3, XL=5.

## Fuera de este reparto

- Envío a domicilio y pago en línea del pedido.
- Promociones tipo marketplace, encuestas de satisfacción y el resto del documento del propietario.
- Un interruptor «no lo tengo» por sucursal sin cantidades: pediría una tabla nueva. FAR-06 lo resuelve con
  el stock por posición que ya existe.
- La pantalla «Sucursales» escribe `directory.branches` y nunca crea una sede de venta (`tenants.controller.ts:305`),
  así que esas sucursales no tienen stock ni salen en «Dónde comprar». Es un bug ajeno: se informa, no se toca.
- `mockup`: estos cambios solo tienen sentido contra la API real.

## Orden de trabajo

Nadie espera un merge. Lo que se necesita del otro carril se toma de **su rama publicada** (`git fetch` +
`cherry-pick`), nunca de un PR mergeado.

1. **Día 1:**
   - cada uno lee `CONTRATO.md` y su paquete, crea sus ramas (una por base) y las empuja;
   - **FAR-06 empuja primero el endpoint de disponibilidad por sucursal** (controlador, DTO, caso de uso y
     specs), para que FAR-02 lo tome;
   - **FAR-03 empuja primero sus dos piezas** (`prescription-validity.ts` y `prescription-balance.ts`), para
     que FAR-01 y FAR-02 las tomen.
2. **En paralelo:** FAR-01, FAR-03, FAR-04 y FAR-07 van completos; FAR-02 trabaja con un doble del
   endpoint de FAR-06 hasta tenerlo.
3. **Al terminar cada carril:** los PR de la API y del front a `dev`.
4. **Cierre:** cada carril deja su reporte en la descripción del PR y anota lo que quedó bloqueado.

## Orden de merge

Mergea Justin.

1. API a `dev`: FAR-06 → FAR-05 → FAR-07 → FAR-03 → FAR-01 → **FAR-02 al final**, que rebasa y regenera
   OpenAPI y Postman con todo adentro.
2. Front a `dev`: FAR-04 → FAR-06 → FAR-05 → FAR-07 → FAR-03 → FAR-01 → FAR-02.
3. API y front a `test`, en el mismo orden.

## Archivos compartidos: un solo dueño

Si el otro carril necesita tocar uno de estos archivos, se lo pide al dueño, que agrega las líneas.

| Archivo | Dueño | Lo usan |
|---|---|---|
| API `delegated_access/**` (entidad generada de `shared_access_links` y `_uses`, servicio de enlaces) | FAR-01 | FAR-02 lee el enlace por token |
| API `clinical/controllers/clinical-prescriptions-public.controller.ts` y `prescription-pdf.service.ts` | FAR-01 | — |
| API controlador nuevo de recetas para la farmacia (archivo propio en `pharmacy_inventory/presentation/controllers/`) | FAR-02 | — |
| API `pharmacy_inventory/application/pharmacy-orders/**` y los motivos de error del pedido | FAR-03 | — |
| API `pharmacy/controllers/pharmacy.controller.ts` y sus servicios de catálogo | FAR-05 | — |
| API caso de uso y controlador nuevos de disponibilidad por sucursal (`pharmacy_inventory`) | FAR-06 | FAR-02 lo llama |
| API `pharmacy_inventory/application/ports/` (puerto externo nuevo), su adaptador y `mock-provider-server/**` | FAR-07 | — |
| API `pharmacy_inventory/pharmacy_inventory.module.ts` | FAR-06 (lo toca primero) | FAR-02, FAR-03 y FAR-07 agregan sus providers; rebasa el que mergea después |
| API `openapi/**`, `docs/postman/**` | FAR-02 (regenera al final, sobre `dev` con todo adentro) | Los demás PR declaran ese rojo esperado de «artefactos al día» |
| API `inventario/`, `docs/modules`, `docs/data` (los revisa el CI) | Cada carril de API regenera los suyos en su PR, después de compilar su rama | Si choca con otro PR, el que mergea después rebasa y regenera: nunca se resuelve a mano |
| Front `features/account/medical-record/where-to-buy/**` | FAR-03 | — |
| Front `features/pharmacy/**` (catálogo, categorías, precios, inventario, importación, integración) y el grupo de farmacia de `navigation.map.ts` | FAR-04 | FAR-05, FAR-06 y FAR-07 (mismo dueño) |
| Front `features/account/pharmacy/prescriptions/**` (botón compartir) y las carpetas nuevas de la receta compartida | FAR-01 | — |
| Front pantalla nueva «Abrir receta» de la farmacia (carpeta propia, no dentro de `features/pharmacy/`) | FAR-02 | — |
| Front `core/data-access/pharmacy*/**` | El carril que agrega cada método, en su propio archivo de cliente si puede | — |
| Front `src/app/app.routes.ts` | FAR-04 (achica el bloque de farmacia) | FAR-01 y FAR-02 cuelgan sus rutas de un archivo de rutas propio con una sola entrada en `app.routes.ts` |

## Entorno

- Cada carril usa su propio stack local: la base se arma con `rebuild_stack.py --yes` del modelo y la API
  corre contra ella. **Nunca** contra las bases de `dev` o `test`.
- Cuentas de prueba: solo sintéticas `@alovida.test`, creadas por la API (paciente, médica y una farmacia
  con dos sucursales). La receta completa está en `Itzan/README.md`, «Entorno común de verificación».
- Con `SEED_ON_BOOT=false` los conceptos de los módulos no existen: se corre `seed:boot` una vez, **solo
  contra el stack local**.
- Lo que no se pueda correr se reporta BLOCKED, nunca PASS.

## Gates en rojo antes de empezar

Cada carril los mide en su base limpia antes de declarar un rojo heredado:
`git show origin/dev:.github/workflows/ci.yml | rg -n '^\s+- name:|^\s+run:'`.

- `check-max-lines` en `origin/dev` `4cd7db1a3`, contado como lo cuenta el CI (`scripts/check-max-lines.mjs:24`):
  - `app.routes.ts` tiene 2403 líneas, con un techo de 2273: sigue en rojo aun con FAR-04;
  - `navigation.map.ts` tiene 2144, con un techo de 2080: FAR-04 lo deja en verde (unas 2065);
  - `pharmacy-import.ts` (817) y `catalog.rules.ts` (771) están justo en su techo.

  La regla es saldo neto ≤ 0 en cada archivo que ya supera o toca su techo (`scripts/baselines/max-lines.json`).
  FAR-04 achica las rutas y el menú: junta cinco en una. FAR-01 y FAR-02 suman dos líneas en `app.routes.ts`
  (el `import` y la ruta) y las compensan en su propio diff.
- **Un PR de la API a `test` no corre checks** (`docs.yml` solo corre contra `dev` y `master`). Se corren a
  mano.

## Reglas para todos

- **Una rama por base** (`dev`, `test`), nunca una encima de otra. Justin mergea.
- **API:** el plan y el reporte van en la **descripción del PR** (`AGENTS.md`), no en `docs/trabajo/`.
- **Identificadores, rutas y `data-testid` en inglés.** El texto de pantalla va en castellano.
- **El modelo no se toca.** La única pieza generada es la entidad de `shared_access_links`, con
  `salud-db/gen_entities.py 29`: viaja en la API, no en el modelo.
- **Nada con pantalla se entrega sin verlo en el navegador**, con la sesión de cada rol que la ve
  (paciente y farmacia como mínimo). La evidencia va en `docs/frontend/evidence/<carril>/` del front.
- **El front no decide acceso a datos:** si una pantalla no recibe algo, se pide a la API, no se rodea.
