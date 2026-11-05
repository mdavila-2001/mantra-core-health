import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type { LabService } from '../../../core/data-access/lab-portal/lab-portal.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { buildChanges, withComponents, type PriceRejection } from './laboratory-prices.rules';
import { PriceEdits } from './price-edits';
import { LabPricesTable } from './prices-table/lab-prices-table';
import { savePrices } from './price-save';
import { LabServicesImport } from './services-import/lab-services-import';

/**
 * **Precios** of the lab: list price and AloVida discount of every service,
 * edited in the table and saved together. A panel is followed by its
 * components, each with its own amount (proceso 4.2): the patient pays the
 * panel when the order asks for all of it, or the parts it asks for.
 *
 * Saving sends **only** the changed rows, one by one, with
 * `PATCH /diagnostics/lab/services/:id`; one failing does not stop the rest.
 * «Agregar del catálogo» adds LOINC análisis with suggested prices
 * (`catalog-import/`); «Importar análisis (CSV)» loads the lab's own sheet.
 */
@Component({
  selector: 'app-laboratory-prices',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Card,
    LabPricesTable,
    LabServicesImport,
    PageHeader,
    RouterLink,
    SearchField,
  ],
  templateUrl: './laboratory-prices.html',
  styleUrl: './laboratory-prices.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratoryPrices {
  private readonly lab = inject(LabPortalClient);
  private readonly toasts = inject(ToastService);

  protected readonly services = signal<ViewState<readonly LabService[]>>(loading());
  protected readonly edits = new PriceEdits();
  protected readonly term = signal('');
  protected readonly errors = signal<readonly string[]>([]);
  protected readonly rejected = signal<readonly PriceRejection[]>([]);
  protected readonly saving = signal(false);
  protected readonly importOpen = signal(false);

  protected readonly visible = computed<ViewState<readonly LabService[]>>(() => {
    const state = this.services();
    if (state.status !== 'ready') return state;
    const list = withComponents(state.data, this.term());
    return list.length > 0
      ? ready(list)
      : empty({ label: 'Pruebe con otra palabra' }, `Nada coincide con «${this.term().trim()}».`);
  });

  protected readonly names = computed(
    () => new Map((dataOf(this.services()) ?? []).map((s) => [s.id, s.name])),
  );

  constructor() {
    this.reload();
  }

  protected reload(): void {
    this.services.set(loading());
    this.lab.listServices().subscribe({
      next: (page) => {
        const alive = page.items.filter((service) => service.status !== 'WITHDRAWN');
        this.services.set(
          alive.length > 0
            ? ready(alive)
            : empty(
                {
                  label: 'Agregue análisis del catálogo',
                  route: '/administration/laboratory-prices/catalog',
                },
                'Todavía no hay servicios a los que ponerles precio.',
              ),
        );
      },
      error: (error: unknown) => this.services.set(errorToViewState<readonly LabService[]>(error)),
    });
  }

  /** Rereads the list when the import loaded something; unsaved edits stay. */
  protected importClosed(imported: boolean): void {
    this.importOpen.set(false);
    if (imported) this.reload();
  }

  protected search(term: string): void {
    this.term.set(term);
  }

  protected discard(): void {
    this.edits.clear();
    this.errors.set([]);
  }

  protected save(): void {
    if (this.saving() || this.edits.count() === 0) return;
    const { changes, problems } = buildChanges(dataOf(this.services()) ?? [], this.edits.all());
    this.errors.set(problems);
    this.rejected.set([]);
    if (problems.length > 0) return;
    this.saving.set(true);
    savePrices(this.lab, changes).subscribe(({ saved, rejected }) => {
      this.saving.set(false);
      if (saved > 0) {
        this.toasts.success(
          saved === 1
            ? 'Guardó el precio de 1 servicio.'
            : `Guardó el precio de ${saved} servicios.`,
        );
      }
      this.rejected.set(rejected);
      this.edits.clear();
      // The proof is the table reread from the API.
      this.reload();
    });
  }
}
