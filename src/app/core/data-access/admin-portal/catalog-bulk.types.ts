import type { BulkEntity } from '../pharmacy/pharmacy-bulk.types';

/** The four pharmacy catalog tables a bulk load can write to. */
export type CatalogBulkKind = BulkEntity;

/** A pharmacy the operator can pick (`GET /pharmacy/pharmacies`). */
export interface CatalogBulkPharmacy {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** What the catalog holds for one key after a load (read back by reloading). */
export interface CatalogBulkSnapshotRow {
  readonly key: string;
  readonly detail: string;
}

/** Row key per kind, as the API resolves it (`name_key`, `productCode`, `code`). */
export const CATALOG_BULK_KEY_FIELD: Readonly<Record<CatalogBulkKind, string>> = {
  categories: 'name',
  products: 'productCode',
  prices: 'productCode',
  sites: 'code',
};
