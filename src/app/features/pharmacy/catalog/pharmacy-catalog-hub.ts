import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PharmacyCategories } from '../categories/pharmacy-categories';
import { ImportTargetPicker } from '../import/import-target/import-target';
import { PharmacyInventory } from '../inventory/pharmacy-inventory';
import { PharmacyIntegration } from '../integration/pharmacy-integration';
import { PharmacyPrices } from '../prices/pharmacy-prices';
import { PharmacyProducts } from '../products/pharmacy-products';
import { CATALOG_TABS, CATALOG_TAB_LABELS, tabIndexOf, tabKeyOf } from './catalog-tabs';

/**
 * **Catálogo** de la farmacia: productos, categorías, precios, inventario,
 * importación e integración con el sistema de la farmacia en UNA tarjeta con
 * pestañas (`composition-rules.md` §5), en vez de un renglón de menú por cada
 * una.
 *
 * ## Qué NO se reescribió
 *
 * Las cinco primeras pantallas son las mismas clases, con su lógica y sus
 * pruebas: acá se montan con `embedded`, que sólo les quita el membrete
 * propio. Integración (FAR-07) nació como pestaña y no tiene membrete ni ruta
 * propia. Cada una provee su `PharmacyScope`. Sus rutas viejas redirigen a la pestaña
 * (`app.routes.ts`), con el query que traían: `?alerts=true` sigue abriendo
 * Inventario con «solo alertas».
 *
 * ## La pestaña vive en la URL, en las dos direcciones
 *
 * `?tab=` abre la pestaña por su nombre ({@link tabIndexOf}). El hub escucha
 * `queryParamMap` y no sólo la foto inicial: un enlace interno a la misma ruta
 * —«Ver productos» al terminar una importación, el de Categorías— cambia de
 * pestaña sin recrear la pantalla.
 *
 * Sólo se monta la pantalla de la pestaña abierta: `app-tab` no dibuja el
 * panel cerrado, pero el contenido proyectado se instanciaría igual y las
 * seis pedirían sus datos a la vez.
 */
@Component({
  selector: 'app-pharmacy-catalog-hub',
  imports: [
    Card,
    ImportTargetPicker,
    PageHeader,
    PharmacyCategories,
    PharmacyIntegration,
    PharmacyInventory,
    PharmacyPrices,
    PharmacyProducts,
    Tab,
    Tabs,
  ],
  templateUrl: './pharmacy-catalog-hub.html',
  styleUrl: './pharmacy-catalog-hub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyCatalogHub {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly tabs = CATALOG_TABS;
  protected readonly labels = CATALOG_TAB_LABELS;

  protected readonly selected = signal(tabIndexOf(this.route.snapshot.queryParamMap.get('tab')));

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.selected.set(tabIndexOf(params.get('tab')));
    });
  }

  /**
   * Cambia de pestaña y lo deja escrito en la URL: sólo `tab`, porque los
   * filtros de una pestaña no significan nada en otra. `replaceUrl` para no
   * llenar el historial: volver atrás sale de la pantalla.
   */
  protected select(index: number): void {
    this.selected.set(index);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tabKeyOf(index) },
      replaceUrl: true,
    });
  }
}
