import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PharmacyCategories } from '../categories/pharmacy-categories';
import { IMPORT_TARGET_PARAM, ImportTargetPicker } from '../import/import-target/import-target';
import { PharmacyInventory } from '../inventory/pharmacy-inventory';
import { PharmacyIntegration } from '../integration/pharmacy-integration';
import { PharmacyPrices } from '../prices/pharmacy-prices';
import { PharmacyScope } from '../pharmacy-scope';
import { PharmacyProducts } from '../products/pharmacy-products';
import {
  CATALOG_TABS,
  CATALOG_TAB_LABELS,
  IMPORT_TAB_KEY,
  IMPORT_TARGET_BY_TAB,
  tabIndexOf,
  tabKeyOf,
} from './catalog-tabs';

/**
 * Pharmacy **Catalog**: products, categories, prices, inventory and the
 * integration with the pharmacy's system in ONE tabbed card
 * (`composition-rules.md` §5), with CSV import behind a header button that
 * opens a modal.
 *
 * ## What was NOT rewritten
 *
 * The screens are the same classes, with their logic and tests: they are
 * mounted with `embedded`, which only drops their own header. The
 * `PharmacyScope` belongs to the hub: the pharmacy chosen in one tab stays
 * chosen in the next one and inside the import modal.
 *
 * ## The tab and the modal live in the URL
 *
 * `?tab=` opens the tab by name ({@link tabIndexOf}). `?tab=import` — the old
 * tab key, still used by the Summary and by the `administration/pharmacy-import`
 * redirect — opens the modal over the tab that was open, with `?target=`
 * saying what is imported. Any navigation to another tab («Ver precios» after
 * an import) closes it. Closing it remounts the tab, which re-reads what was
 * just loaded.
 */
@Component({
  selector: 'app-pharmacy-catalog-hub',
  imports: [
    AppButton,
    Card,
    ContentDialog,
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
  private readonly toasts = inject(ToastService);
  private readonly importPicker = viewChild(ImportTargetPicker);

  protected readonly tabs = CATALOG_TABS;
  protected readonly labels = CATALOG_TAB_LABELS;

  protected readonly selected = signal(0);
  protected readonly importOpen = signal(false);
  /** Bumped when the import closes: remounts the open tab. */
  protected readonly generation = signal(0);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const tab = params.get('tab');
      const importing = tab === IMPORT_TAB_KEY;
      if (this.importOpen() && !importing) {
        this.generation.update((value) => value + 1);
      }
      this.importOpen.set(importing);
      // With the modal open, the previous tab stays underneath.
      if (!importing) {
        this.selected.set(tabIndexOf(tab));
      }
    });
  }

  /**
   * Close guard of the import modal: while a load is being written, closing
   * would cut it halfway and lose the result screen, so it stays open.
   */
  protected readonly importGuard = (): boolean => {
    if (this.importPicker()?.busy()) {
      this.toasts.info('Espere a que termine la carga: si cierra ahora, se corta a la mitad.');
      return false;
    }
    return true;
  };

  /** Opens the modal preselecting what matches the open tab. */
  protected openImport(): void {
    this.navigate({
      tab: IMPORT_TAB_KEY,
      [IMPORT_TARGET_PARAM]: IMPORT_TARGET_BY_TAB[tabKeyOf(this.selected())],
    });
  }

  /** Closes the modal and leaves only the underlying tab in the URL. */
  protected closeImport(): void {
    if (this.importOpen()) {
      this.navigate({ tab: tabKeyOf(this.selected()) });
    }
  }

  /**
   * Switches tab and writes it to the URL: only `tab`, because one tab's
   * filters mean nothing in another. `replaceUrl` keeps history clean: going
   * back leaves the screen.
   */
  protected select(index: number): void {
    this.selected.set(index);
    this.navigate({ tab: tabKeyOf(index) });
  }

  private navigate(queryParams: Record<string, string>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }
}
