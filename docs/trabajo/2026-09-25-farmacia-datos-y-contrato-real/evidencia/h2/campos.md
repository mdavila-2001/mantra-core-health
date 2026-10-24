# H2.S1.M1 — Campos calcados de `read-responses.dto.ts` (API real, `mantra-core-health-api` @ 343795cc)

Leído directamente el archivo (no supuesto): `src/modules/pharmacy/dto/read-responses.dto.ts`.

## `PharmacySiteReadDto` (l. 27-73) → `PharmacySiteRead`

| Campo real | Tipo real | En el front | Igual |
|---|---|---|---|
| `id` | `string` (uuid) | `id: string` | sí |
| `code` | `string` | `code: string` | sí |
| `name` | `string` | `name: string` | sí |
| `addressText` | `string \| null` | `addressText: string \| null` | sí |
| `latitude` | `number \| null` | `latitude: number \| null` | sí |
| `longitude` | `number \| null` | `longitude: number \| null` | sí |
| `dispensingMode` | `PharmacyConcept \| null` | **no incluido** | no consumido por ninguna pantalla todavía (convención del archivo: "se agrega cuando alguien lo pida") |
| `homeDeliveryAvailable` | `boolean \| null` | **no incluido** (a nivel sede) | ídem — sí viaja a nivel `PharmacyDetail` (agregado de sus sedes) |
| `pickupAvailable` | `boolean \| null` | **no incluido** (a nivel sede) | ídem |

## `PharmacyDetailDto extends PharmacyDirectoryItemDto` (l. 152-159, 79-135) → `PharmacyDetail`

| Campo real | En el front | Igual |
|---|---|---|
| `id, code, name, siteCount, productCount` (heredados de `PharmacyDirectoryItemDto`) | ya existían en `PharmacyDirectoryItem` | sí |
| `legalName` | `legalName: string` | sí |
| `type: PharmacyConcept \| null` | `type: PharmacyConcept \| null` | sí |
| `homeDeliveryAvailable: boolean \| null` | `homeDeliveryAvailable: boolean \| null` | sí |
| `pickupAvailable: boolean \| null` | `pickupAvailable: boolean \| null` | sí |
| `sites: PharmacySiteReadDto[]` | `sites: readonly PharmacySiteRead[]` | sí (tipo espejado, ver arriba) |

## `PharmacySitePriceDto` (l. 253-354) → `PharmacySitePriceItem`

| Campo real | Tipo real | En el front | Igual |
|---|---|---|---|
| `productId` | `string` (uuid) | sí | sí |
| `productCode` | `string` | sí | sí |
| `brandName` | `string \| null` | sí | sí |
| `genericName` | `string \| null` | sí | sí |
| `strengthText` | `string \| null` | sí | sí |
| `packageSizeText` | `string \| null` | sí | sí |
| `medication` | `PharmacyConcept \| null` | sí | sí |
| `requiresPrescription` | **NO EXISTE** | `requiresPrescription: boolean \| null` | **Q-M4 resuelta: NO estaba en el DTO real.** Se agrega en H4 (`PharmacySitePriceDto` + servicio), declarado acá para que Justin/Itzan cierren contra el contrato final, no contra uno que después cambia. |
| `priceListId` | `string` (uuid) | no incluido | no consumido por ninguna pantalla |
| `priceListCode` | `string` | sí | sí |
| `currency` | `PharmacyConcept \| null` | sí | sí |
| `unitAmount` | `string` | sí | sí |
| `taxAmount` | `string \| null` | no incluido | no consumido |
| `patientAmount` | `string \| null` | sí | sí |
| `minimumQuantity` | `string \| null` | no incluido | no consumido |
| `effectiveFrom` / `effectiveTo` | `Date` / `Date \| null` | no incluido | no consumido |

## `PharmacySitePricesResponseDto` (l. 287-320) → `PharmacySitePrices`

| Campo real | En el front | Igual |
|---|---|---|
| `siteId` | sí | sí |
| `siteName` | sí | sí |
| `pharmacyId`, `pharmacyName` | no incluidos | no consumidos por ninguna pantalla (se agregan si hace falta) |
| `items: PharmacySitePriceDto[]` | `items: readonly PharmacySitePriceItem[]` | sí |
| `count` | no incluido | el front puede derivar `items.length` |

## Decisión de Q-M2 (decimal de `distanceKm`)

Verificado leyendo `pharmacy_inventory/services/pharmacy-inventory-read.service.ts:423-433`
(`haversineKm`): **ya redondea a un decimal internamente** (`Math.round(distance * 10) / 10`).
`GET /pharmacy/sites` (H4) reutiliza esa misma función exportada, así que no hace falta redondear
de nuevo.
