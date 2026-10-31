# Auditoría funcional: Promociones, Servicios e importación masiva

Fecha: 2026-10-31. Código auditado (solo lectura): API `e1805fa8` (origin/dev), front `2e4ae419`.
Entorno: API :3000, SSR :4000. Cuentas: farmacia `admin.farmacia-chavez@alovida.test` (roles `USER, PHARMACY_STAFF`, tenant `54a6fa72-…`), paciente `paciente.lucia@alovida.test` (tenant `1befcfea-…`), médico `dr.andres@alovida.test`, `admin@alovida.test` (SUPERADMIN).
Helpers: `/tmp/claude-0/-home-user/a3997150-d93c-5870-9eb9-02a4fa558d1f/scratchpad/pa.py` (llamadas a la API), `promo-shots.cjs` y `promo-intercept.cjs` (Playwright, Chromium sin ventana, sin `networkidle`).
Capturas: `~/auditoria/evidencia/promos/` (35 PNG: 1440×900 y 390×844, claro y oscuro). No se juzga lo estético: se describe y se compara con Marketplace de Facebook; la aprobación visual es del revisor.

Aclaración de método: la API no deja crear ninguna promoción (HP-01), así que no hay datos `promo-` de promociones. Para ver la grilla con datos se interceptó `GET /promotions/me` en el navegador con 4 promociones inventadas (`promo-sim …`); esas capturas llevan `INTERCEPTADO` en el nombre y NO prueban persistencia.

## 1. Tabla: frase del pedido → veredicto

| # | Frase del pedido | Veredicto | Evidencia |
|---|---|---|---|
| 1 | «Promociones … de forma ultra estética y como un marketplace» (grilla, imagen, precio, filtros, detalle) | FAIL (descripción; aprobación visual: revisor) | §2.3, `pac-promociones-INTERCEPTADO-*.png`. Hay grilla de tarjetas, búsqueda, filtros y orden. Faltan imagen, precio, vendedor, distancia y detalle. HP-06, HP-07 |
| 2 | «… promociones de cada tipo de partner: Doctor, Centro de imagenología, laboratorio, farmacia, aseguradora» | FAIL | El modelo no tiene tipo de partner (HP-04). Solo existe algo para farmacia (apagado, HP-05) y aseguradora (campañas preventivas, otra cosa). Doctor, imagenología y laboratorio: nada (HP-08) |
| 3 | «Necesito que te bases en MARKETPLACE DE FACEBOOK» | FAIL | Tabla de atributos en §2.4: 3 presentes, 2 parciales, 9 ausentes de 14 |
| 4 | La farmacia puede crear/editar/publicar promociones | FAIL | `POST /promotions` → 403 con el token de farmacia; con SUPERADMIN → 422 (HP-01, HP-02, HP-03). La pantalla de farmacia está apagada (HP-05) |
| 5 | El paciente ve las promociones | PASS parcial / BLOQUEADO con datos | `GET /promotions/me` → 200 `{"items":[],"count":0}`; pantalla correcta en estado vacío. Con datos reales: BLOQUEADO por HP-01. Con datos interceptados se dibuja la grilla |
| 6 | Servicios: «CRUD de los servicios que ofrecen» | FAIL en 4 de 5 partners | §3. PASS solo farmacia (productos). HP-09 a HP-12 |
| 7 | Servicios: «aparte el masivo que es UPSERT» | FAIL en 4 de 5; PASS en farmacia | UPSERT de farmacia probado: CREATED → UNCHANGED → UPDATED (§3.2) |
| 8 | «Todos deben tener importación masiva» | FAIL | §4: 5 áreas con importación por archivo, ~30 módulos sin ella |
| 9 | CONTRATO.md §«Servicio general» | N/A | El archivo no tiene esa sección ni menciona promociones: `grep -n -i "servicio gen\|promo\|marketplace" CONTRATO.md` → sin salida. Sus secciones son 1 a 7 (receta, farmacia, pedido, disponibilidad, importación FAR-05, simulador, catálogo). Lo único que toca a servicios/carga es §5 (importación de farmacia), verificada en §3.2 |

Conteo: 9 filas = 0 PASS, 1 PASS parcial, 7 FAIL, 1 N/A. BLOQUEADO es solo la parte «con datos reales» de la fila 5.

## 2. Promociones

### 2.1 Qué existe hoy

Rutas del front (`src/app/app.routes.ts`):
- `my-account/promotions` → `Promotions` (:288). Paciente. Fuera del menú lateral; se llega por el icono de la barra superior (`core/navigation/navigation.map.ts:1664-1672`).
- `administration/pharmacy-campaigns` → `PharmacyCampaigns` (:320). Solo tenant `PHARMACY` (`navigation.map.ts:1930-1950`).
- `promotions/:campaignId` → `CampaignDetail` (:1724). Pública, enlace compartible.
- `administration/insurance-campaigns` → `InsuranceCampaigns` (:203). Aseguradora; son campañas preventivas de salud, no de descuento.
- Médico: `my-account/promotions` redirige a `/dashboard` (capturas `med-promociones-*`). No hay pantalla de promociones para doctor, imagenología ni laboratorio.

Endpoints del módulo de promociones (`src/modules/promotions/controllers/promotions.controller.ts`):

| Verbo y ruta | Línea | Roles |
|---|---|---|
| `GET promotions/me` | :62 | `PATIENT` |
| `POST promotions` | :82 | `PROMOTIONS_ADMIN`, `MARKETING_MANAGER` (:83) |
| `POST promotions/:id/coupons/batch` | :99 | ídem |
| `POST coupons/validate` | :120 | `CASHIER`, `PROMOTIONS_ADMIN` |
| `POST redemptions` | :139 | ídem |
| `POST checkout/:orderId/apply-discount` | :155 | ídem |
| `POST redemptions/:id/reverse` | :176 | ídem |

No hay listado de administración, edición, baja ni activación. Sondeos:

```
$ python3 pa.py GET /promotions admin                  -> 404 Cannot GET /promotions
$ python3 pa.py PATCH /promotions/<uuid> admin '{}'    -> 404 Cannot PATCH /promotions/<uuid>
$ python3 pa.py POST /promotions/<uuid>/activate admin -> 404
$ python3 pa.py DELETE /promotions/<uuid> admin        -> 404
```

Estado de los datos: `docker exec mantra-redesa-postgres-1 psql -U mantra -d mantra_redesa_health -c "select count(*) from promotions.promotions where tenant_id='1befcfea-44c0-563a-81cd-337ec6acc840'"` → 0. Hay 26 promociones sembradas, todas en otros tenants, así que el paciente ve 0.

### 2.2 Flujo recorrido

| Paso | Comando o acción | Resultado |
|---|---|---|
| Paciente, API | `python3 pa.py GET /promotions/me pac` | 200 `{"items": [], "count": 0}` |
| Farmacia, API | `python3 pa.py GET /promotions/me far` | 403 `ROLE_INSUFFICIENT` |
| Farmacia crea | `python3 pa.py POST /promotions far <body promo-far-001>` | 403 `Rol insuficiente para la operación` |
| Médico y paciente crean | mismo POST con `doc` y `pac` | 403 y 403 |
| SUPERADMIN crea (3 cuerpos: `promo-admin-001` porcentaje, `promo-adm-fixed`, `promo-adm-coupon`) | `pa.call("POST","/promotions",…, adm, T)` | 422 `FOREIGN_KEY_VIOLATION` los 3 |
| Causa en el log | `grep -n "fk_discount_rules_promotion_id" scratchpad/api.log` | 3 coincidencias: `constraint":"fk_discount_rules_promotion_id","table":"discount_rules"` |
| Navegador, paciente | `node promo-shots.cjs '[…/my-account/promotions…]'` | 200, `GET /promotions/me -> 200`, estado vacío «Todavía no hay nada acá / Por ahora no tiene promociones vigentes» |
| Navegador, detalle | `/promotions/00000000-0000-4000-8000-0000000000aa` | «No encontramos lo que busca» |
| Navegador, farmacia | `/administration/pharmacy-campaigns` | Alerta «Las promociones están apagadas en este entorno … Nada de lo que arme ahora se guardaría». Cero llamadas a `/promotions` |
| Navegador, con datos | `node promo-intercept.cjs` (respuesta simulada) | Grilla de 4 tarjetas; clic en la tarjeta → `/my-account/pharmacy` |

Ciclo UI → request → response → persistencia → recarga → UI: NO se pudo ejecutar para promociones. La creación falla en la API. No se escribió nada en la base.

Desbordamiento horizontal (`scrollWidth > innerWidth`): `false` en las 35 capturas, 390×844 incluido. Tema oscuro: `data-theme=dark`, fondo `rgb(8, 22, 28)`. Consola sin errores en todas las páginas.

### 2.3 Lo que se ve (descripción, sin aprobar)

Paciente, `my-account/promotions`, 1440×900 con datos interceptados: cabecera «Promociones», mapa de Bolivia por departamento, buscador «Buscar por promoción, farmacia o medicamento». Columna izquierda de filtros con «Categoría» (En toda la compra / En un producto / En una categoría) y «Vigencia». Barra con «N promociones encontradas · Sin ciudad declarada», selector «Ordenar por» (Predeterminado, Nombre A-Z, Nombre Z-A) y alternador Grilla/Lista. Tarjetas de 4 por fila. Cada una trae un bloque con «-30%» (o «-10.00 BOB») en lugar de imagen, título, cinco estrellas grises con «Sin reseñas todavía», línea «En un producto» con pin, vigencia «Del 29 oct al 23 nov», sello «Vigente» y botón «Ver ficha».
A 390×844: 2 tarjetas por fila, filtros colapsados en botón «Filtros». Claro y oscuro se renderizan sin cortes.
Estado vacío: ícono de bandeja, «Todavía no hay nada acá» y enlace «Buscar farmacias».
Farmacia: página con título, subtítulo y una alerta informativa; sin tabla, sin formulario, sin botón de crear.
Nota sobre las capturas de página completa: la barra lateral aparece superpuesta porque Playwright captura `fullPage` con la barra fija. Es un artefacto de la captura, no un defecto de la pantalla.

### 2.4 Comparación con Marketplace de Facebook

| Atributo de Marketplace | ¿Está? | Detalle |
|---|---|---|
| Grilla de tarjetas | Sí | Grilla/Lista, 4 columnas en escritorio, 2 en móvil |
| Imagen del artículo en la tarjeta | No | 0 `<img>` en `main`; bloque de color con el porcentaje. `MyPromotionDto` (`promotions-read.service.ts:125-153`) no trae imagen |
| Precio (actual y anterior) | No | Solo «-30%» o monto de descuento. Ni precio base ni precio final |
| Nombre del vendedor y su tipo | No | `farmacia: null` (`promotions.ts`, `promotionFromContract`); ningún dato del partner |
| Ubicación en la tarjeta | No | Siempre «Sin ciudad declarada» con datos reales; el contrato no relaciona promoción con lugar |
| Filtro por distancia o radio | No | Solo mapa por departamento, que con datos reales cuenta 0 por departamento |
| Filtro por categoría | Parcial | Categoría = tipo de objetivo del descuento (orden/producto/categoría), no categoría de producto ni tipo de partner |
| Filtro por precio | No | |
| Búsqueda | Sí | Texto libre; busca solo en título y descripción (no hay farmacia ni medicamento con datos reales) |
| Orden | Parcial | Predeterminado y nombre; sin «más cercano», «más reciente», «precio» |
| Vista de detalle del artículo | No | «Ver ficha» lleva a `my-account/pharmacy` (`promotions.ts:49,404`). `promotions/:campaignId` existe pero responde «No encontramos» |
| Guardar, compartir, mensajear al vendedor | No | |
| Crear o publicar un anuncio (lado vendedor) | No | La farmacia no puede (HP-03, HP-05) |
| Filtro por tipo de partner (pestañas Doctor, Imagenología, Laboratorio, Farmacia, Aseguradora) | No | |
| Responsive y tema oscuro | Sí | Sin desbordamiento a 390 px; oscuro aplicado |

Conteo: 3 presentes (grilla, búsqueda, responsive y oscuro), 2 parciales (filtro por categoría, orden), 9 ausentes.

## 3. Servicios: CRUD y carga masiva por partner

Ruta:línea en API (`~/auditoria/wt/mantra-core-health-api/src/modules/…`) y front (`~/auditoria/wt/mantra-core-health/src/app/…`).

### 3.1 Tabla

| Partner | Qué son los «servicios» | C | R | U | D | Masivo / UPSERT | Veredicto |
|---|---|---|---|---|---|---|---|
| Doctor / práctica | Catálogo de servicios de la práctica | `billing/controllers/billing-service-catalog.controller.ts:165` (`SECURITY_ADMIN`, `PRACTITIONER`, `CLINICIAN`) | :81 | :234 | no hay `@Delete` | `POST import-procedures` :200: crea desde el arancel, «salta los códigos que la práctica ya tiene». No es UPSERT, no recibe archivo. Front: `features/admin/services-catalog/procedure-import/procedure-import.ts`, botón «Importar producto» (`services-catalog.html:16`, `my-services.html:13`) | FAIL (sin baja, sin UPSERT) |
| Doctor (agenda) | Ofertas de agenda | `scheduling/presentation/controllers/scheduling-service-offerings.controller.ts:78` | :53 | :98 | no | no | FAIL |
| Centro de imagenología | Ofertas de estudio y tarifario | `diagnostic_units/controllers/diagnostic-units.controller.ts:260` (`SECURITY_ADMIN`); precios `diagnostic-pricing.controller.ts:55`, cronograma `diagnostic-units.controller.ts:280` | dentro de `GET :id/administration` | no hay PATCH de oferta; el precio se cierra (`:75`) y se crea otro | `diagnostic-pricing.controller.ts:92` (baja lógica) | no | FAIL (sin edición ni masivo) |
| Laboratorio | Servicios y precios del laboratorio | front `core/data-access/lab-portal/lab-portal.client.ts:52` | :44 | :58 | :68 | `importServices` :74 (modo + filas) | FAIL: `simulatorOnly`; la API no publica ninguna ruta `/diagnostics/lab/*` (HP-09). Ninguna pantalla llama a `importServices` |
| Farmacia | Productos (y categorías, precios, sedes) | `pharmacy/controllers/pharmacy.controller.ts:347` (productos), :121 (categorías) | `pharmacy-read.controller.ts:208` | :366 / :143 | :394 / :167 | `pharmacy-bulk.controller.ts:57,74,91,110`: `categories`, `products`, `prices`, `sites`, modos CREATE/UPDATE/UPSERT con `dryRun` | PASS |
| Aseguradora | Productos, planes y coberturas | `insurance/presentation/controllers/insurance-backbone.controller.ts:130` (producto), :155 (plan), :179 (cobertura) | `insurance-read.controller.ts:49` (carriers), `insurance-catalog.controller.ts:37` | :196 (importes de cobertura), :235 (prima). No hay PUT de plan | no hay DELETE de plan | no | FAIL (HP-12) |

### 3.2 Pruebas ejecutadas

```
$ python3 pa.py POST /diagnostics/lab/services/import far '{"mode":"UPSERT","rows":[]}'
-> 404 Cannot POST /diagnostics/lab/services/import
$ python3 pa.py GET /diagnostics/lab/services far
-> 404 Cannot GET /diagnostics/lab/services
$ python3 pa.py PUT /insurance-plans/<uuid> admin '{}'     -> 404 Cannot PUT /insurance-plans/<uuid>
$ python3 pa.py DELETE /insurance-plans/<uuid> admin       -> 404 Cannot DELETE /insurance-plans/<uuid>
```
Los métodos del front `updatePlan` y `deletePlan` están marcados `simulatorOnly` (`core/data-access/insurance/insurance.client.ts:356-370`).

UPSERT de farmacia, `POST /pharmacies/1a82de64-…/products/bulk`, fila `{"productCode":"promo-bulk-1","brandName":"promo- Producto bulk","genericName":"promo-generico"}`:
```
dryRun:true        -> 200 {"dryRun":true,"results":[{"row":1,"outcome":"CREATED"}]}
mode UPSERT (1.ª)  -> 200 {"dryRun":false,"results":[{"row":1,"outcome":"CREATED","id":"2fae0c56-b0c4-4e0e-abf5-f8cdae39ca54"}]}
mode UPSERT (2.ª)  -> 200 … "outcome":"UNCHANGED" (mismo id)
brandName "… v2"   -> 200 … "outcome":"UPDATED" (mismo id)
fila sin productCode -> 200 … "REJECTED", errors:[{"field":"productCode","reason":"REQUIRED"}]
rows:[]            -> 400 "rows must contain at least 1 elements"
```
Quedó el producto `promo-bulk-1` en la farmacia de prueba (creado solo por API).

Doctor: `GET /billing/service-catalog?practiceId=<uuid inexistente>` con el token del médico → 200 `{"items":[],"count":0,"limit":50,"nextCursor":null}`. El POST y el PATCH del catálogo NO se ejecutaron: el médico de prueba no tiene práctica (la pantalla `/my-services` dice «Su organización todavía no tiene prácticas»). `administration/services-catalog` redirige a `/dashboard` para el médico.
Imagenología y aseguradora: no hay cuenta en el entorno; solo análisis de código, NO se ejecutó.

## 4. Inventario de importación masiva en administración

Tiene importación masiva real:

| Módulo | Dónde | Forma |
|---|---|---|
| Catálogo de farmacia (productos, categorías, precios, sucursales) | front `features/pharmacy/import/pharmacy-import.ts` en `administration/pharmacy-catalog?tab=import`; API `pharmacy-bulk.controller.ts:57,74,91,110` | CSV, 4 pasos, UPSERT, vista previa. Captura `far-catalogo-importar-*.png` |
| Inventario de farmacia | `features/pharmacy/inventory/upload-dialog/inventory-upload-dialog.ts` | CSV por sede |
| Sucursales de organización | `shared/components/organisms/branch-bulk-import/branch-bulk-import.ts`, usado en `organization-branches.ts:30,87`, `organization-detail.ts:47`, `branches-editor.ts:24` | CSV; crea una por una (`organization-detail.ts:384`: la API no tiene alta masiva). Sin UPSERT |
| Espacios de atención (infraestructura médica) | `features/admin/medical-organization/espacio/space-import.ts`, `space-bulk.ts`; API `practice/controllers/site-infrastructure.controller.ts:85,103` | Patrón y CSV, `dryRun` |
| Terminología | `features/admin/terminology/version-import/version-import.ts`; API `terminology/controllers/terminology-versions.controller.ts:83,123` | CSV/XLSX/NDJSON |
| Servicios del médico | `procedure-import.ts` / `billing-service-catalog.controller.ts:200` | Desde el arancel, no desde archivo; solo crea |

Sin importación masiva (ruta de `app.routes.ts` y comprobación): `administration/users` (:166), `patients` (:168), `organizations` (alta de a una; solo sucursales en lote), `my-organization` (:183), `medical-laboratory` (:187; estudios y precios de a uno), `insurance` (:191), `brokers` (:195), `insurance-claims` (:197), `insurance-analytics` (:199), `insurance-campaigns` (:203), `received-claims` (:207), `insurer-practitioner-requests` (:211), `insurance-patients` (:215), `accounting` (:228; solo exporta CSV), `content-packs` (:232), `moderation` (:234), `pharmacy-orders`, `pharmacy-campaigns`, `pharmacy-hours` (:330), `laboratory` (:342), `laboratory-results` (:344), `laboratory-prices` (:346; API inexistente), `delegated-access` (:356), `identity-providers` (:360), `identity-assurance` (:364), `health-context` (:368), `geolocation` (:372), `clinical-forms` (:388), `pharma-lab` (:405; `pharma-catalog.controller.ts:61,94` de a uno). Comando de apoyo: `grep -rliE "importar|csv|bulk|masiv" features core/data-access` (sin spec/fixtures/mock) devuelve solo los módulos de la lista anterior más la exportación a CSV.

Conclusión: 5 de ~35 módulos tienen importación; «todos deben tener» FAIL. Además, de los 4 que tienen UPSERT o modo, solo farmacia cumple «CRUD + masivo UPSERT» completo.

## 5. Hallazgos

### HP-01 — `POST /promotions` falla siempre con 422 (no se puede crear ninguna promoción)
- Severidad: Crítica.
- Observado: SUPERADMIN, con 3 cuerpos distintos (porcentaje, monto fijo, cupón), recibe 422 `FOREIGN_KEY_VIOLATION`. Log: `"constraint":"fk_discount_rules_promotion_id","table":"discount_rules"`. La transacción hace rollback y no queda nada (`select count(*) … where code like 'promo-%'` → 0).
- Causa probable: `promotions/services/promotions-discounts.service.ts:165-205` crea la promoción y sus reglas con `em.create` dentro de la misma transacción. `DiscountRules.promotionId` es un `uuid` escalar sin relación (`promotions/entities/discount_rules.entity.ts:19`), así que el Unit of Work no sabe que debe insertar `promotions` antes que `discount_rules` (`repositories/promotions-discounts.repository.ts:247` y `:324`).
- Corrección mínima: `await tx.flush()` después de crear la promoción y antes de crear las reglas, o mapear `promotionId` como `ManyToOne`. Agregar una prueba de integración con base real (los specs mockean el repositorio).

### HP-02 — No hay forma de activar, editar, listar ni dar de baja una promoción
- Severidad: Alta.
- Observado: `PATCH`, `DELETE`, `POST …/activate` y `GET /promotions` → 404. El módulo solo expone alta, lote de cupones, validación, redención y reversa.
- Causa probable: la promoción nace en borrador (`promotions-discounts.service.ts:183`) y solo las `PROMOTION_ACTIVE` se sirven (`promotions-discounts.repository.ts:382`); ningún código escribe `PROMOTION_ACTIVE` (`grep -rn "PROMOTION_ACTIVE" src` → solo comparaciones en :259, :821, :838 y el filtro de lectura). Emitir cupones también exige activa (:259).
- Corrección mínima: `GET /promotions` (administración, por tenant), `PATCH /promotions/:id` y `POST /promotions/:id/status` (borrador → activa → pausada/finalizada), con auditoría.

### HP-03 — La farmacia no puede crear promociones y, aunque pudiera, el paciente no las vería (alcance por tenant)
- Severidad: Alta.
- Observado: token de farmacia = roles `["USER","PHARMACY_STAFF"]` → `POST /promotions` 403 `ROLE_INSUFFICIENT`. El paciente (tenant `1befcfea-…`) lee solo promociones de su propio tenant; la farmacia vive en otro (`54a6fa72-…`).
- Causa probable: `promotions.controller.ts:83` (`PROMOTIONS_ADMIN`, `MARKETING_MANAGER`); `promotions-read.service.ts:65-71` y `promotions-discounts.repository.ts:381` filtran por `tenantId` del contexto. Un modelo por tenant no sirve para un marketplace entre partners.
- Corrección mínima: permitir `PHARMACY_STAFF` (y los roles equivalentes de cada partner) sobre su propio tenant, y una lectura de marketplace que cruce tenants como ya hace el directorio (`pharmacy/services/pharmacy-marketplace.service.ts`), publicando solo promociones activas y vigentes.

### HP-04 — El modelo no distingue tipo de partner, ni imagen, precio, producto ni ubicación
- Severidad: Alta.
- Observado: la respuesta de `/promotions/me` (`MyPromotionDto`) trae id, código, nombre, descripción, tipo AUTOMATIC/COUPON, vigencia, descuentos y cupones. Ni partner, ni tipo de partner, ni imagen, ni precio, ni ciudad.
- Causa probable: `promotions/entities/promotions.entity.ts` (sin campos de partner ni medios), `CreatePromotionDto` en `promotions/dto/promotions.dto.ts:818`, `toMyPromotion` en `promotions-read.service.ts:125-153`. `targetFilterJson` se guarda y nadie lo lee (nota en `pharmacy-campaigns.client.ts`, cabecera).
- Corrección mínima: devolver nombre y tipo del tenant emisor (`tenantTypes` ya existe en el token), ciudad de la sede, `fileId` de imagen y referencia al producto o servicio con su precio.

### HP-05 — La pantalla de promociones de la farmacia está apagada y no habla con la API
- Severidad: Alta.
- Observado: `administration/pharmacy-campaigns` muestra «Las promociones están apagadas en este entorno … Nada de lo que arme ahora se guardaría». Cero llamadas a `/promotions`.
- Causa probable: `environment.campaignsDemo: false` en todos los entornos desplegables (`environments/environment.ts:12`, `environment.development.ts:12`, `environment.real-api.ts:10`, `environment.production-api.ts:12`; solo `environment.demo.ts:11` lo enciende). `core/data-access/pharmacy-campaigns/pharmacy-campaigns.client.ts` es un cliente en memoria: sin HTTP, datos sembrados y vida de la sesión.
- Corrección mínima: un cliente HTTP real contra los endpoints de HP-01 a HP-04 y quitar el interruptor (el pie del cliente ya lo describe como temporal).

### HP-06 — «Ver ficha» no lleva a la promoción y el detalle público no resuelve
- Severidad: Media.
- Observado: clic en una tarjeta → `/my-account/pharmacy` (tienda genérica). `/promotions/<id>` → «No encontramos lo que busca».
- Causa probable: `features/account/promotions/promotions.ts:49` (`RUTA_DE_COMPRA`) y `:404` (`link`); `features/campaigns/campaign-detail/campaign-detail.ts` lee el cliente demo de HP-05; ruta en `app.routes.ts:1724`.
- Corrección mínima: enlazar a `/promotions/:id` y que el detalle lea un `GET /promotions/:id` público (hoy no existe en la API).

### HP-07 — Tarjetas sin imagen, precio ni vendedor; marcador de reseñas vacío
- Severidad: Media (la aprobación estética es del revisor).
- Observado: bloque con porcentaje en lugar de imagen; cada tarjeta muestra cinco estrellas grises y «Sin reseñas todavía» aunque no existe concepto de reseña de promoción; agrupación única «Sin ciudad declarada»; el mapa no filtra nada con datos reales.
- Causa probable: `promotions.ts:386-416` (`aTarjeta`) alimenta el molde de resultado de directorio (`shared/components/molecules/search-result`) con campos nulos (HP-04).
- Corrección mínima: tarjeta propia de marketplace (imagen, precio, vendedor, distancia) y no mostrar estrellas sin dato.

### HP-08 — No hay promociones para doctor, imagenología ni laboratorio; el banner publicitario es fijo
- Severidad: Alta (es la mitad del pedido).
- Observado: el médico es redirigido a `/dashboard`; no hay ruta ni endpoint para esos partners. La aseguradora tiene campañas preventivas (`insurance/presentation/controllers/insurance-campaigns.controller.ts`, `GET /insurance-campaigns` → 403 «La organización activa no es una aseguradora» con farmacia y paciente), que no son ofertas comerciales. `features/alovida/buscar/feed-publicaciones/feed-banner/feed-banner.ts:33` trae 2 banners escritos a mano y ninguna plantilla de `features` lo usa (`grep -rn "feed-banner" features --include=*.html` sin resultados fuera del índice generado).
- Corrección mínima: tras HP-04, una sola superficie «Promociones» con pestañas por tipo de partner y un alta por partner.

### HP-09 — Laboratorio: CRUD y carga masiva de servicios solo existen en el simulador
- Severidad: Alta.
- Observado: `GET /diagnostics/lab/services` y `POST …/import` → 404. `LabPortalClient` marca todo como `simulatorOnly`. Ninguna pantalla usa `importServices`.
- Causa probable: `core/data-access/lab-portal/lab-portal.client.ts:44-84` (la API no publica `/diagnostics/lab/*`; el propio cliente lo dice en su cabecera).
- Corrección mínima: controlador `diagnostics/lab/services` (CRUD + `import` con `mode`, `dryRun`) y pestaña de importación en `laboratory-prices`.

### HP-10 — Imagenología: sin edición ni importación de estudios; solo `SECURITY_ADMIN`
- Severidad: Media.
- Observado: alta de oferta, baja y cierre de precio; no hay `PATCH` de oferta ni lote. Los roles de la propia cuenta del centro (staff) no están en `@Roles`.
- Causa probable: `diagnostic-units.controller.ts:260-261`, `diagnostic-pricing.controller.ts:55-56,92-93`.
- Corrección mínima: `PATCH diagnostic-study-offerings/:id` y `POST diagnostic-units/:id/study-offerings/bulk` con UPSERT por código.

### HP-11 — Doctor: sin baja de servicios y la «importación» no es UPSERT ni de archivo
- Severidad: Media.
- Observado: existen alta y edición; no hay `DELETE`; `import-procedures` solo crea desde el arancel y salta los existentes. No se pudo ejecutar el alta: el médico de prueba no tiene práctica.
- Causa probable: `billing/controllers/billing-service-catalog.controller.ts:165,200,234` (sin `@Delete`).
- Corrección mínima: `DELETE :id` (baja lógica) y `POST import` con filas `{code,name,price}` y `mode`.

### HP-12 — Aseguradora: sin edición de plan ni baja; sin masivo
- Severidad: Media.
- Observado: `PUT/DELETE /insurance-plans/:id` → 404 aunque el front los llama.
- Causa probable: `insurance.client.ts:356-370` (`simulatorOnly`); `insurance-backbone.controller.ts:155,179,196` solo crea y edita importes.
- Corrección mínima: `PUT/DELETE insurance-plans/:planId` y carga masiva de coberturas.

### HP-13 — Importación masiva: falta en la mayoría de los módulos y sucursales no admite UPSERT
- Severidad: Media.
- Observado: ver §4. La carga de sucursales crea una por una, sin modo ni vista previa del servidor (`organization-detail.ts:384`).
- Corrección mínima: reutilizar el contrato `{mode, dryRun, rows}` de `pharmacy-bulk.controller.ts` como estándar para cada módulo con CRUD.

## 6. Límites de esta auditoría

- No se creó ninguna promoción: HP-01. Los datos `promo-` que existen son un producto de farmacia (`promo-bulk-1`) creado por API; ninguna promoción.
- Las capturas `INTERCEPTADO` usan respuestas inventadas del navegador y no prueban el flujo de punta a punta.
- Cuentas de imagenología, laboratorio y aseguradora: no existen en el entorno; no se ejecutó nada contra ellas.
- Doctor sin práctica: el CRUD del catálogo de servicios no se ejecutó.
- No se modificó código, ni `.env`, ni `.claude/`. No se hizo commit ni push.
