# Plan — P37: las sucursales de una farmacia y la receta entre ellas

- Fecha: 2026-10-26 · Repos afectados: mantra-core-health-api, mantra-core-health (front) · Modelo: sin cambio
  (ver D-1) · Predecesor: P30/P31 (`public/profiles/f/:slug/products`, módulo `public`), P54 (`directory.branches`
  con `description` y `location_url`, ya en `dev`).
- Resultado observable: un anónimo abre la ficha pública de una farmacia, ve sus sucursales reales (de la base, no
  del corpus), escribe a mano los renglones de su receta y la API le dice qué sucursal los tiene en stock, ordenadas
  primero las completas y después la más cercana — sin que un solo renglón de la receta viaje en la URL.
- Kill-test: `GET /public/profiles/f/<slug>/branches` contra la API real responde 404, o la búsqueda de la receta
  sale como `?items=...` en la URL.

## Hechos (descubrimiento)

- La cadena ya existe en la base: `pharmacy.pharmacies (tenant_id)` → `pharmacy.pharmacy_sites (pharmacy_id,
  practice_site_id)` → `practice.practice_sites (branch_id → directory.branches, address_id → common.addresses)`;
  el stock es por sede: `pharmacy_inventory.inventory_locations (pharmacy_site_id)` →
  `inventory_stock_positions`.
- La cadena gestiona todo eso con endpoints que ya existen: `GET/POST/PATCH /tenants/:id/branches`
  (`directory/controllers/tenants.controller.ts`), sedes físicas con `branchId` (`practice/dto/create-site.dto.ts`)
  y sedes de farmacia (`pharmacy/dto/create-site.dto.ts`).
- `directory.branches` ya trae `latitude`, `longitude`, `description`, `location_url` (P54).
- La lectura hermana con sesión es `GET /pharmacy-inventory/availability` (por ids de producto).
- El front (`features/public-directories/pharmacy-detail`) ya dibuja la sección contra el simulador
  (`core/mock/handlers/public.handlers.ts`), con la receta por `GET ?items=a|b|c&lat&lng`.

## Alcance
- IN: módulo `public` de la API (dos rutas nuevas, DTO, servicio, repositorio, tests unitarios + http + integración
  real), README del módulo, OpenAPI/ENDPOINTS regenerados; en el front: cliente (`POST`), tipos, simulador con el
  mismo contrato, ficha (enlace sólo a otra ficha, descripción y «Cómo llegar», vacío orientado), tests.
- OUT: OCR o foto de la receta (D-4), edición de sucursales (ya existe, P54), el vínculo entre tenants padre/hijo
  (D-1), la lectura con sesión `pharmacy-inventory/availability`.

## Decisiones (tomadas sin poder consultar; ver REPORTE)
- D-1 La «cadena» es el **tenant** dueño de la ficha; las sucursales son sus `pharmacy_sites` activas de farmacias
  activas y verificadas. No se usa `parent_tenant_id`. Sin cambio de modelo.
- D-2 La receta viaja por **`POST /public/profiles/f/:slug/branch-availability`** con cuerpo
  `{ items: string[], lat?, lng? }`: es una lectura, pero un renglón de receta es un dato de salud y la URL queda en
  historiales, proxies y logs de acceso. La `GET ?items=` del simulador se retira.
- D-3 Coincidencia: un renglón casa con un producto **en stock** de esa sede si el genérico, la marca, el concepto
  de medicamento, la concentración o la presentación lo contienen, sin tildes ni mayúsculas. Si casan varios, gana
  el más barato con precio, después por genérico. Un agotado cuenta como faltante.
- D-4 Sin foto de la receta: subir una imagen de receta como anónimo es guardar un dato de salud sin consentimiento
  ni dueño; se escribe a mano (el pedido es «receta escrita a mano»).
- D-5 Punto de la sucursal: primero el de `directory.branches` (lo edita la cadena en su pestaña Sucursales), si no
  el de `common.addresses`. `locationAccuracy` y `phone`: `null` (no hay columna). `openingHours`: `null`; la
  `description` de la sucursal viaja aparte como `description`, y `locationUrl` como enlace.
- D-6 `slug` de cada sucursal = el de la ficha (comparten tenant). `isCurrent` = `true` sólo si la cadena tiene una
  única sucursal. El front enlaza una tarjeta sólo si su `slug` es otro.
- D-7 `totalAmount`: suma exacta (bigint) de los encontrados; `null` si no encontró nada, si a alguno le falta precio
  o si mezclan monedas (un total parcial mentiría).
- D-8 Topes: 20 renglones, 120 caracteres cada uno, 200 sucursales; renglones repetidos (sin tildes) se colapsan.

## H1 — La API sirve sucursales y disponibilidad por receta
**CA:** Dado un tenant con dos sedes y stock en una, cuando un anónimo pide las sucursales y manda una receta,
entonces recibe las dos sedes y la que tiene stock primero con `complete: true`; un slug de otro tipo da 404.
**DoD:** `yarn test src/modules/public` verde · integración real contra `mantra_p37` verde · typecheck y lint.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Repositorio: sedes públicas del tenant (sede, dirección, sucursal) | devuelve sólo sedes activas de farmacias verificadas | test de integración | HECHO |
| H1.S1.M2 | Repositorio: productos en stock que casan con algún renglón, con precio por sede | agotado no sale | test de integración | HECHO |
| H1.S2.M1 | Dominio puro: casar renglones, total exacto, orden | casos correcto/límite/inválido | `yarn test src/modules/public` | HECHO |
| H1.S2.M2 | Servicio + DTO + controlador (`GET .../branches`, `POST .../branch-availability`) | 404 por tipo, 400 por cuerpo inválido | `public-catalog.http.spec.ts` | HECHO |
| H1.S3.M1 | Integración real: datos sintéticos, dos sedes, slug de otro tipo → 404 | verde | `yarn test:integration p37` | HECHO |
| H1.S3.M2 | README del módulo, OpenAPI y ENDPOINTS regenerados | sin diff pendiente | `docs:openapi:generate` | HECHO |

## H2 — El front usa el contrato real
**CA:** Dado el cliente real, cuando la persona busca su receta, entonces sale un `POST` sin parámetros en la URL y
la ficha dibuja el resultado; el simulador sirve el mismo contrato.
**DoD:** `yarn vitest run` de la ficha y del cliente verdes · `yarn lint` de lo tocado · typecheck.
**Estado:** A MEDIAS (falta prueba visual en navegador)

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Cliente `prescriptionAvailability` por `POST` con cuerpo | URL sin `items` | spec del cliente | HECHO |
| H2.S1.M2 | Simulador `POST` con el mismo cuerpo y campos nuevos | spec de la ficha verde | `vitest pharmacy-detail` | HECHO |
| H2.S2.M1 | Ficha: enlace sólo a otra ficha, descripción, «Cómo llegar», vacío orientado | spec | `vitest pharmacy-detail` | A MEDIAS (sin captura de navegador) |

## Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| 12 agentes tocan `openapi/` | conflicto en derivados | regenerar tras merge, nunca elegir lado |
| Catálogo grande por tenant | consulta lenta | filtro por renglón en SQL, `LIMIT`, sedes ≤ 200 |
