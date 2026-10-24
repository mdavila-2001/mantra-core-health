# Catálogo universal de medicamentos · «Nuevo producto» de la farmacia

Pedido del propietario (01/10/2026): los productos de farmacia tienen que ser **universales** y venir de un
**registro oficial**; la farmacia sólo sube **el id del producto y lo suyo** (precio, existencias, fotos,
descripción), sin tipear cada medicamento. Las farmacias a conectar son las más grandes del país: el catálogo
único existe para **reducir los conflictos de datos** cuando se integren sus sistemas.

## Qué cambió para la persona

| Antes | Ahora |
|---|---|
| «Nuevo producto» pedía SKU, marca, concentración, presentación, receta, genérico a mano | Se **busca** el medicamento en el catálogo oficial y se **elige**; lo oficial se muestra y no se edita |
| Dos farmacias cargaban el mismo remedio con grafías distintas | Las dos apuntan al mismo registro sanitario |
| Si no estaba, se tipeaba igual | Si no está: **«No encuentro mi medicamento»** → pide el alta; no se publica un producto suelto |

**Sigue siendo de la farmacia, y editable:** SKU, código de barras (GTIN), cadena de frío, **precio**,
**imágenes** (hasta 3, propias), descripción, categoría, disponibilidad/existencias y estado de publicación.

**Producto cargado a mano antes del catálogo:** se sigue editando entero (aviso «Producto cargado a mano»).

## Contrato (lo que el simulador ya cumple y lo que la API real implementa)

- `GET /pharmacy/catalog-products?search=&source=&atc=&limit=` → `{ items: CatalogProduct[], limit, truncated }`.
  Los registros no vigentes llegan con `selectable: false` y no se pueden elegir.
- `POST /pharmacies/:id/products` con `catalogProductId` (+ `catalogPresentationCode` si el producto tiene más de
  una presentación). **Marca, genérico, concentración, presentación, receta y el medicamento del vademécum los
  deriva el servidor**; mandarlos junto al id es un error. El mismo producto y presentación dos veces → 409.
- `PATCH /pharmacies/:id/products/:productId` sobre un producto del catálogo **no** acepta los datos oficiales.
- `POST /pharmacies/:id/catalog-requests` → `{ id, status: 'PENDING', createdAt }`.
- El ancla con la receta es el **ATC nivel 5** (igualdad exacta de código): «dónde comprar mi receta» sigue
  funcionando porque el producto hereda el `medication_concept_id` del vademécum.

Tipos: `CatalogProduct`, `CatalogProductQuery`, `CatalogRequestDraft`, `PharmacyProductCatalogLink` en
`core/data-access/pharmacy/pharmacy.types.ts`.

## De dónde sale la data (descargada el 01/10/2026)

| Fuente | Registros | Estado |
|---|---|---|
| CIMA · AEMPS (España) | 25 470 | cargada al simulador (subconjunto) |
| INVIMA · CUM vigentes (Colombia) | 9 520 registros / 155 807 filas | cargada al simulador (subconjunto) |
| ANVISA (Brasil) | 32 774 con nº de registro (10 806 filas sin él, descartadas) | descargada y normalizada |
| **AGEMED (Bolivia)** | — | **No descargada**: su portal consulta de a un registro y exige reCAPTCHA; eludirlo no corresponde. Hay que pedirla a AGEMED por acceso a información pública |
| DIGEMID (Perú) | — | el sitio devuelve 403 a clientes automatizados; no se evadió |
| ANMAT (Argentina) | — | el dataset abierto es sólo una lista de actualizaciones de 2018 (8 KB) |
| ISP (Chile) | — | sin dataset descargable localizado |

Inventario con URLs, hashes y motivos: `glossary-data-build/medicines-sources/SOURCES.md` (fuera de git).

**Riesgo principal:** sin AGEMED, las marcas locales bolivianas no están en el catálogo. Las otras fuentes
aportan la cobertura internacional y el ATC, no el mercado boliviano.

## El simulador usa datos reales, no inventados

`src/app/core/mock/fixtures/catalogo-medicamentos.generated.ts` es un **subconjunto real** de CIMA e INVIMA
(103 productos). Se regenera con:

```bash
node scripts/build-catalog-fixture.mjs --build-dir <ruta a glossary-data-build>
```

Lo que lee lo produce `tools/terminology-import/build-medicine-catalog.mjs` del repo de la API. El vínculo
entre cada medicamento del vademécum del simulador y el catálogo es su **ATC nivel 5** (verificado contra el
nombre del ATC que trae CIMA).

## Cómo se verificó (y qué NO)

- Pruebas del área (`pharmacy`, handlers del simulador, reglas): ver el informe del PR.
- Navegador: `playwright/portal-farmacia.spec.ts` (flujo completo, ya adaptado) y
  `playwright/catalogo-universal-farmacia.spec.ts` (nuevo). Capturas en `evidencia/`.
- **No verificado:** contra la API real y la base viva. El backend (PR aparte en la API) está probado con
  `EntityManager` simulado; la carga del catálogo a Postgres sólo se corrió en seco. Levantar el stack
  requiere permiso del propietario.

## Pendiente (fuera de este corte)

1. **Backend real**: `PATCH` de producto, precio (por `price-lists`), imágenes y descripción no existen en la API
   real —sólo en el simulador (P47)—. Las dos últimas ni siquiera tienen columna en el modelo.
2. Carga masiva por **id de catálogo / GTIN** (hoy la importación CSV conserva el camino de producto a mano).
3. AGEMED.
4. Las fotos oficiales de CIMA se enlazan desde `cima.aemps.es` (permitido por la CSP); lo definitivo es
   espejarlas en nuestro almacenamiento.
