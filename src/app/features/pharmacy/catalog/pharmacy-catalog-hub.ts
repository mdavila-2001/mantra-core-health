import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PharmacyCategories } from '../categories/pharmacy-categories';
import { ImportTargetPicker } from '../import/import-target/import-target';
import { PharmacyInventory } from '../inventory/pharmacy-inventory';
import { PharmacyIntegration } from '../integration/pharmacy-integration';
import { PharmacyPrices } from '../prices/pharmacy-prices';
import { PharmacyScope } from '../pharmacy-scope';
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
 * propia. Ninguna dibuja su propia tarjeta: la única es la de acá. El
 * `PharmacyScope` es el del hub: la farmacia elegida en una pestaña sigue
 * elegida en la siguiente. Sus rutas viejas redirigen a la pestaña
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
 *
 * ## Lo escrito y sin guardar no se pierde en silencio
 *
 * Precios e Inventario se editan en la tabla. Salir de esas pestañas con
 * cambios sin guardar desmontaría la pantalla y los borraría, así que antes se
 * pregunta con la confirmación de descarte de siempre; la pestaña no cambia
 * hasta que se responda que sí.
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
  providers: [PharmacyScope],
  templateUrl: './pharmacy-catalog-hub.html',
  styleUrl: './pharmacy-catalog-hub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyCatalogHub {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(DialogService);
  private readonly tabStrip = viewChild.required(Tabs);
  private readonly prices = viewChild(PharmacyPrices);
  private readonly inventory = viewChild(PharmacyInventory);

  protected readonly tabs = CATALOG_TABS;
  protected readonly labels = CATALOG_TAB_LABELS;

  protected readonly selected = signal(tabIndexOf(this.route.snapshot.queryParamMap.get('tab')));

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.selected.set(tabIndexOf(params.get('tab')));
    });
  }

  /**
   * El clic en una pestaña. Con cambios sin guardar en la abierta, la tira
   * vuelve a marcar la de antes mientras se pregunta: sólo cambia si se
   * acepta descartarlos.
   */
  protected async requestTab(index: number): Promise<void> {
    const current = this.selected();
    if (index === current || !this.hasUnsavedChanges()) {
      this.select(index);
      return;
    }
    this.tabStrip().selectedIndex.set(current);
    const discard = await this.dialogs.confirmarDescarte({
      title: '¿Sale sin guardar?',
      message: 'Tiene cambios sin guardar en esta pestaña. Si cambia de pestaña, se pierden.',
      cancelLabel: 'Seguir en esta pestaña',
    });
    if (discard) {
      this.select(index);
    }
  }

  private hasUnsavedChanges(): boolean {
    return (this.prices()?.hasUnsavedChanges() ?? false) || (this.inventory()?.hasUnsavedChanges() ?? false);
  }

  /**
   * Cambia de pestaña y lo deja escrito en la URL: sólo `tab`, porque los
   * filtros de una pestaña no significan nada en otra. `replaceUrl` para no
   * llenar el historial: volver atrás sale de la pantalla.
   */
  private select(index: number): void {
    this.selected.set(index);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tabKeyOf(index) },
      replaceUrl: true,
    });
  }
}
