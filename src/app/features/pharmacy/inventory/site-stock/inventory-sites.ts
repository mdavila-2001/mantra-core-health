import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';

import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import { PharmacySiteStockClient } from '../../../../core/data-access/pharmacy/pharmacy-site-stock.client';
import { isLedgerSite } from './site-stock-rows';

/** El valor de «Todas» en el selector: lo declarado en el catálogo. */
export const ALL_SITES = 'all';

/** Una sede de la farmacia, como la nombra el selector. */
export interface InventorySite {
  readonly siteId: string;
  readonly siteName: string;
}

type SitesLoad = 'loading' | 'ready' | 'failed';

/**
 * **Las sucursales de la pestaña Inventario** y cuáles llevan su propio stock.
 *
 * Las sedes salen de `GET /pharmacies/:pharmacyId/opening-hours`; el modo de
 * cada una, de su `GET /pharmacy-inventory/sites/:siteId/stock` (con alguna
 * posición, lleva su propio stock). Una lectura de stock que falla no tumba
 * el selector: esa sede queda sin aviso hasta que se la elija.
 *
 * Lo provee la pestaña y muere con ella, como `PharmacyScope`.
 */
@Injectable()
export class InventorySites {
  private readonly pharmacy = inject(PharmacyClient);
  private readonly siteStock = inject(PharmacySiteStockClient);

  readonly status = signal<SitesLoad>('loading');
  readonly sites = signal<readonly InventorySite[]>([]);
  /** Las sedes que llevan su propio stock, por id. */
  private readonly ledger = signal<ReadonlySet<string>>(new Set());
  /** Cuenta las cargas: la respuesta de una farmacia anterior no pisa la actual. */
  private generation = 0;

  readonly options = computed<readonly SelectOption<string>[]>(() => [
    { value: ALL_SITES, label: 'Todas (lo declarado en el catálogo)' },
    ...this.sites().map((site) => ({
      value: site.siteId,
      label: site.siteName,
      description: this.ledger().has(site.siteId) ? 'Lleva su propio stock' : undefined,
    })),
  ]);

  /** Los nombres de las sedes que llevan su propio stock, en el orden de la lista. */
  readonly ledgerNames = computed(() =>
    this.sites()
      .filter((site) => this.ledger().has(site.siteId))
      .map((site) => site.siteName),
  );

  load(pharmacyId: string): void {
    const generation = ++this.generation;
    this.status.set('loading');
    this.sites.set([]);
    this.ledger.set(new Set());
    this.pharmacy.getOpeningHours(pharmacyId).subscribe({
      next: (hours) => {
        if (generation !== this.generation) {
          return;
        }
        const sites = hours.sites.map((site) => ({ siteId: site.siteId, siteName: site.siteName }));
        this.sites.set(sites);
        this.status.set('ready');
        this.readModes(generation, sites);
      },
      error: () => {
        if (generation === this.generation) {
          this.status.set('failed');
        }
      },
    });
  }

  /** Lo que dijo la última lectura de una sede (la del panel, por ejemplo). */
  markMode(siteId: string, ledger: boolean): void {
    this.ledger.update((current) => {
      const next = new Set(current);
      if (ledger) {
        next.add(siteId);
      } else {
        next.delete(siteId);
      }
      return next;
    });
  }

  nameOf(siteId: string): string {
    return this.sites().find((site) => site.siteId === siteId)?.siteName ?? '';
  }

  private readModes(generation: number, sites: readonly InventorySite[]): void {
    if (sites.length === 0) {
      return;
    }
    forkJoin(
      sites.map((site) =>
        this.siteStock.getSiteStock(site.siteId).pipe(
          map((stock) => ({ siteId: site.siteId, ledger: isLedgerSite(stock) })),
          catchError(() => of(null)),
        ),
      ),
    ).subscribe((modes) => {
      if (generation !== this.generation) {
        return;
      }
      for (const mode of modes) {
        if (mode !== null) {
          this.markMode(mode.siteId, mode.ledger);
        }
      }
    });
  }
}
