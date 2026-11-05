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
 * **Las sucursales de la pestaña Inventario** y cuáles tienen stock propio.
 *
 * Las sedes salen de `GET /pharmacies/:pharmacyId/opening-hours`; el modo de
 * cada una, de su `GET /pharmacy-inventory/sites/:siteId/stock` (con alguna
 * posición, tiene stock propio de ese producto; el resto sigue el catálogo).
 * Una lectura de stock que falla no tumba
 * el selector: esa sede queda sin aviso hasta que se la elija.
 *
 * Abrir la pestaña lee sólo la lista de sedes. El stock de cada una se pide
 * cuando hace falta ({@link ensureModes}): al empezar a cambiar algo en
 * «Todas» o al subir un CSV, que es cuando el aviso de «stock propio» dice
 * algo. Con dieciséis sedes eran dieciséis lecturas sólo por abrir.
 *
 * Lo provee la pestaña y muere con ella, como `PharmacyScope`.
 */
@Injectable()
export class InventorySites {
  private readonly pharmacy = inject(PharmacyClient);
  private readonly siteStock = inject(PharmacySiteStockClient);

  readonly status = signal<SitesLoad>('loading');
  readonly sites = signal<readonly InventorySite[]>([]);
  /** Las sedes con stock propio de algún producto, por id. */
  private readonly ledger = signal<ReadonlySet<string>>(new Set());
  /** Cuenta las cargas: la respuesta de una farmacia anterior no pisa la actual. */
  private generation = 0;
  /** La carga cuyas sedes ya se leyeron (o se están leyendo); -1, ninguna. */
  private modesRead = -1;

  readonly options = computed<readonly SelectOption<string>[]>(() => [
    { value: ALL_SITES, label: 'Todas (lo declarado en el catálogo)' },
    ...this.sites().map((site) => ({
      value: site.siteId,
      label: site.siteName,
      description: this.ledger().has(site.siteId) ? 'Con stock propio' : undefined,
    })),
  ]);

  /** Los nombres de las sedes con stock propio de algún producto, en el orden de la lista. */
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

  /**
   * Lee el stock de cada sede, una sola vez por carga, para saber cuáles
   * llevan stock propio. Antes de que lleguen las sedes no hace nada.
   */
  ensureModes(): void {
    const generation = this.generation;
    const sites = this.sites();
    if (this.status() !== 'ready' || this.modesRead === generation || sites.length === 0) {
      return;
    }
    this.modesRead = generation;
    this.readModes(generation, sites);
  }

  private readModes(generation: number, sites: readonly InventorySite[]): void {
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
