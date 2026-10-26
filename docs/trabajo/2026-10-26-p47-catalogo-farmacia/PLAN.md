# Plan — P47: el catálogo completo de la farmacia (precio, categoría, descripción, existencias, estado, imágenes)

- Fecha: 2026-10-26 · Repos afectados: mantra-core-health-model, mantra-core-health-api, mantra-core-health
  (rama `wt/p47` → `claude/elegant-goodall-0wu6ci`) · Predecesor: P47 §2 (`PATCH` descriptivo) ya en `dev`.
- Resultado observable: el personal de una farmacia (membresía activa en el tenant `PHARMACY` dueño) da de alta y
  edita sus productos con precio en Bs, categoría, descripción, existencias/umbral o «hay / no hay», estado
  (publicado / borrador / retirado) e imágenes; gestiona sus categorías; guarda el inventario de varios productos de
  una vez (todo o nada) y ve el resumen con números reales — contra la API real, sin la maqueta.
- Kill-test: `PATCH /pharmacies/:id/products/:pid {"unitPrice":12.5}` contra la API real devuelve 400
  (`forbidNonWhitelisted`), o el personal de la farmacia B recibe otra cosa que 404/403 sobre la farmacia A.

## Alcance
- IN: `diagram_24_pharmacy.puml` + DDL regenerado + patch `2026-10-26_v4255_pharmacy_catalog.sql`; entidades
  regeneradas; DTO/servicios/controlador del módulo `pharmacy`; filtro de «sin stock» en disponibilidad y precios de
  sede; P31 (`/public/profiles/f/:slug/products`) con el «sin stock» declarado; OpenAPI y docs del módulo; cliente,
  tipos, simulador y portal de farmacia del front (sólo lo que el contrato nuevo cambia).
- OUT: carga masiva del lado del servidor (§6, opcional); registro sanitario (el front no lo dibuja); vínculo
  automático del genérico tipeado con el vademécum; solicitudes de alta al catálogo (`catalog-requests`); el ledger
  de inventario (`pharmacy_inventory`) — no se escribe desde el catálogo; registro de farmacia (P50) y sucursales (P37).
- Ambigüedades registradas (decididas esta noche, sin nadie a quien preguntar; confirmar con el dueño del producto):
  - D1 Estado: se reusa `status_concept_id` con un concepto nuevo `PHARM_PRODUCT_DRAFT`. PUBLISHED=ACTIVE,
    WITHDRAWN=RETIRED. Descartado: columna `publication_status` aparte (dos estados que pueden contradecirse).
  - D2 Categoría: tabla `pharmacy_product_categories` por farmacia y FK desde el producto; viaja por nombre; un nombre
    que no es de la farmacia es 422. Las seis del mockup se siembran (catálogo interno, origen: mockup del cliente
    28/09/2026) para las farmacias existentes en el patch y al dar de alta una farmacia. Descartado: texto libre.
  - D3 Existencias: declaración del catálogo, independiente del ledger: `stock_quantity` (NULL = «sin conteo»),
    `min_stock_quantity` (NULL = umbral por defecto 5, el del mockup) y `out_of_stock_declared`. `inStock` deriva.
    Descartado: escribir `inventory_stock_positions` (exige sede, ubicación, lote y asiento del ledger).
    Descartado: el «100 sin conteo» del simulador (un número inventado).
  - D4 Precio: reusa listas y precios versionados. La farmacia tiene una lista pública de mostrador `CATALOGO`
    (toda la farmacia, BOB) que se crea al primer precio; `unitPrice` versiona en ella; `null` la supersede.
    El importe viaja como número o texto decimal con ≤ 2 decimales y se guarda `numeric` exacto. La lectura agrega
    `currency`. Descartado: columna `unit_price` en el producto (segunda fuente de verdad del precio).
  - D5 Imágenes: tabla `pharmacy_product_images` (hasta 3, orden 1..3, `image_file_id` → `common.files` del tenant).
  - D6 Actividad reciente del resumen: se lee de `audit.audit_log` (lo que `@Audited` ya sella), sin tabla nueva.
  - D7 Inventario en lote: 422 si una línea trae `stock` e `inStock` o no trae nada, y si el producto no es de la
    farmacia o está retirado; todo o nada en una transacción.

## H1 — Modelo
**CA:** Dado el modelo, cuando se regenera el DDL, entonces el módulo 24 declara las columnas y tablas nuevas y el
patch las aplica sobre una base viva, dos veces sin error.
**DoD:** `gen_ddl.py all` sin diff inesperado · patch aplicado 2× a `mantra_p47` · deriva puml↔base↔entidades.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Columnas y tablas en `diagram_24_pharmacy.puml` | `gen_ddl.py 24` emite 11 tablas | `python3 salud-db/gen_ddl.py 24` | HECHO |
| H1.S1.M2 | Patch idempotente (columnas, tablas, FKs, índices, CHECK, concepto DRAFT, categorías por defecto) | 2ª aplicación sin error | `psql -v ON_ERROR_STOP=1 -f patch` ×2 | HECHO |
| H1.S1.M3 | Entidades regeneradas | `gen_entities.py 24` + typecheck | `yarn typecheck` | HECHO |

## H2 — API
**CA:** Dado el personal de la farmacia A, cuando publica/edita con precio, categoría, descripción, existencias,
estado e imágenes, entonces se persiste y `GET /pharmacy/products?managed=true` lo devuelve; el personal de B recibe
404 sobre A; un borrador o un «sin stock» no sale en la búsqueda pública, disponibilidad, precios de sede ni P31.
**DoD:** unitarios del módulo en verde · integración real contra `mantra_p47` (incluye negativo de autorización) ·
`yarn lint` · `yarn typecheck` · OpenAPI regenerado.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | DTO de alta/edición con las claves nuevas y validación | 400 en importe con 3 decimales | `yarn jest dto` | HECHO |
| H2.S1.M2 | Servicio de catálogo: categoría, precio, existencias, estado, imágenes en alta y `PATCH` | unit spec | `yarn jest pharmacy-products` | HECHO |
| H2.S1.M3 | Categorías CRUD (409 con productos, renombrar sigue) | unit spec | `yarn jest pharmacy-categories` | HECHO |
| H2.S1.M4 | `PATCH /pharmacies/:id/inventory` todo o nada | unit spec | `yarn jest pharmacy-inventory-lines` | HECHO |
| H2.S1.M5 | Lectura `managed=true` + `unitPrice/inStock/category/description/currency` | unit spec | `yarn jest pharmacy-read` | HECHO |
| H2.S1.M6 | Resumen con números reales + actividad desde la bitácora | unit spec | `yarn jest staff-read` | HECHO |
| H2.S1.M7 | «Sin stock»/borrador fuera de disponibilidad, precios de sede y P31 | int-spec | `yarn test:integration pharmacy-catalog` | HECHO |
| H2.S2.M1 | Integración real (alta, edición, inventario, categorías, resumen, autorización negativa) | int-spec verde | `yarn test:integration pharmacy-catalog` | HECHO |
| H2.S2.M2 | OpenAPI, endpoints md y README del módulo | `--check` limpio | `node tools/openapi/generate-openapi.mjs` | HECHO |

## H3 — Frontend
**CA:** Dada la API real, cuando el portal guarda precio, categoría, inventario o imágenes, entonces viajan (no se
filtran como extensión del simulador) y el simulador sirve el mismo contrato (stock `null` = sin conteo).
**DoD:** `yarn vitest run src/app/core/data-access/pharmacy src/app/features/pharmacy` · `yarn typecheck` ·
`node scripts/gen-mock-contract.mjs --check`.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Cliente: fuera `simulatorOnly`/extensiones para categorías, inventario y claves del producto | spec del cliente | `vitest pharmacy.client` | HECHO |
| H3.S1.M2 | Tipos + simulador con stock nullable y `currency` | specs de inventario/productos | `vitest features/pharmacy` | HECHO |
| H3.S1.M3 | Contrato de la maqueta regenerado | `--check` limpio | `node scripts/gen-mock-contract.mjs --check` | HECHO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| P50 toca el alta de farmacia (`pharmacies.service.ts`) | conflicto de merge | cambio de una línea, unir ambos |
| Otro agente usa la misma versión de patch | confusión de orden | `v4255`, nombre propio |
| Prueba visual exige navegador | no se ejecuta | se declara en «No cubierto» |
