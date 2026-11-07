import type { BulkMode, BulkOutcome } from '../../../core/data-access/pharmacy/pharmacy-bulk.types';
import type { CatalogBulkKind } from '../../../core/data-access/admin-portal/catalog-bulk.types';

/** Maximum rows per request; the API rejects more with a 400. */
export const CATALOG_BULK_MAX_ROWS = 1000;
/** The API body cap is 1 MB; a file above it cannot be sent in one request. */
export const CATALOG_BULK_MAX_BYTES = 1024 * 1024;

export interface KindInfo {
  readonly value: CatalogBulkKind;
  readonly label: string;
  readonly key: string;
  readonly columns: string;
  readonly numeric: readonly string[];
  readonly boolean: readonly string[];
}

export const KINDS: readonly KindInfo[] = [
  { value: 'categories', label: 'Categorías', key: 'name (sin mayúsculas ni tildes)', columns: 'name', numeric: [], boolean: [] },
  {
    value: 'products', label: 'Productos', key: 'productCode',
    columns: 'productCode, brandName, genericName, strengthText, packageSizeText, category, unitPrice, requiresPrescription',
    numeric: ['unitPrice', 'stock', 'minStock'],
    boolean: ['requiresPrescription', 'coldChainRequired', 'inStock'],
  },
  { value: 'prices', label: 'Precios', key: 'productCode', columns: 'productCode, unitPrice', numeric: [], boolean: [] },
  {
    value: 'sites', label: 'Sucursales', key: 'code',
    columns: 'code, name, addressLines, latitude, longitude, pickupAvailable, homeDeliveryAvailable',
    numeric: ['latitude', 'longitude'], boolean: ['pickupAvailable', 'homeDeliveryAvailable'],
  },
];

export const MODES: readonly { value: BulkMode; label: string; description: string }[] = [
  { value: 'UPSERT', label: 'Crear o actualizar', description: 'Crea lo que falta y actualiza lo que ya existe.' },
  { value: 'CREATE', label: 'Solo crear', description: 'Rechaza una clave que ya existe.' },
  { value: 'UPDATE', label: 'Solo actualizar', description: 'Rechaza una clave que no existe.' },
];

export const OUTCOME_LABEL: Readonly<Record<BulkOutcome, string>> = {
  CREATED: 'Creada',
  UPDATED: 'Actualizada',
  UNCHANGED: 'Sin cambio',
  REJECTED: 'Rechazada',
};

export const OUTCOMES: readonly BulkOutcome[] = ['CREATED', 'UPDATED', 'UNCHANGED', 'REJECTED'];
