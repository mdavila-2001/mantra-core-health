import { EMPTY, expand, map, reduce, type Observable } from 'rxjs';

import type { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type { AdminPage, PermissionSummary } from '../../../../../core/data-access/authz-admin/authz-admin.types';

/** Tope de páginas que se recorren: un catálogo que no cabe en esto se avisa, no se recorta en silencio. */
export const CATALOG_MAX_PAGES = 25;
const PAGE = 200;

export interface CatalogRead {
  readonly items: readonly PermissionSummary[];
  /** `true` si quedaron páginas sin leer. */
  readonly truncated: boolean;
}

/** El catálogo de permisos entero, leído página a página por cursor. */
export function readWholeCatalog(authz: Pick<AuthzAdminClient, 'permissions'>): Observable<CatalogRead> {
  let pages = 0;
  return authz.permissions({ limit: PAGE }).pipe(
    expand((page: AdminPage<PermissionSummary>) => {
      pages += 1;
      return page.nextCursor !== null && pages < CATALOG_MAX_PAGES
        ? authz.permissions({ limit: PAGE, cursor: page.nextCursor })
        : EMPTY;
    }),
    reduce(
      (acc, page) => ({ items: [...acc.items, ...page.items], last: page }),
      { items: [] as PermissionSummary[], last: null as AdminPage<PermissionSummary> | null },
    ),
    map(({ items, last }) => ({ items, truncated: last?.nextCursor != null })),
  );
}
