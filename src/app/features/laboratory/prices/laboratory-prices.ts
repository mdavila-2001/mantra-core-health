import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, concatMap, from, map, of, toArray } from 'rxjs';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type { LabService } from '../../../core/data-access/lab-portal/lab-portal.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import type { CursorState } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import {
  changesOf,
  discountText,
  panelGroups,
  reasonOf,
  withEdit,
  withoutIds,
  type PriceEdits,
  type PriceRejection,
} from './laboratory-prices.rules';
import { LabModalitiesPanel } from './modalities/lab-modalities-panel';
import { LabPriceTable, type RowEdit } from './price-table/lab-price-table';
import { LabServicesImport } from './services-import/lab-services-import';

const PAGE_SIZE = 10;

/**
 * «Precios»: list price and AloVida discount per service, saved together with
 * «Guardar cambios», one `PATCH /diagnostics/lab/services/:id` per changed
 * row. A refused row keeps what was typed and shows the API's reason; the
 * saved ones are proven by re-reading the list. The modalities declared at
 * registration (`kind: 'MODALITY'`) are not priced: they get their own tab.
 */
@Component({
  selector: 'app-laboratory-prices',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Card,
    LabModalitiesPanel,
    LabPriceTable,
    LabServicesImport,
    PageHeader,
    RouterLink,
    SearchField,
    Tab,
    Tabs,
  ],
  templateUrl: './laboratory-prices.html',
  styleUrl: './laboratory-prices.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratoryPrices {
  private readonly lab = inject(LabPortalClient);
  private readonly toasts = inject(ToastService);

  protected readonly catalog = signal<ViewState<readonly LabService[]>>(loading());
  protected readonly edits = signal<PriceEdits>({});
  protected readonly term = signal('');
  protected readonly errors = signal<readonly string[]>([]);
  protected readonly rejected = signal<readonly PriceRejection[]>([]);
  protected readonly saving = signal(false);
  protected readonly offset = signal(0);
  protected readonly importOpen = signal(false);
  protected readonly tab = signal(0);

  protected readonly dirtyCount = computed(() => Object.keys(this.edits()).length);
  protected readonly rejectedById = computed(() =>
    Object.fromEntries(this.rejected().map((rejection) => [rejection.id, rejection.reason])),
  );
  protected readonly modalities = computed(
    () => dataOf(this.catalog())?.filter((service) => service.kind === 'MODALITY') ?? [],
  );

  /** One group per panel (the panel and its components); modalities are not priced. */
  private readonly groups = computed<ViewState<readonly (readonly LabService[])[]>>(() => {
    const state = this.catalog();
    const groupsOf = (all: readonly LabService[]) =>
      panelGroups(
        all.filter((service) => service.kind === 'SERVICE'),
        this.term(),
      );
    if (state.status !== 'ready') {
      return mapData(state, groupsOf);
    }
    const list = groupsOf(state.data);
    if (list.length > 0) {
      return ready(list);
    }
    return this.term().trim() === ''
      ? empty(
          { label: 'Agregue análisis del catálogo', route: '/administration/laboratory-prices/catalog' },
          'Todavía no hay estudios a los que ponerles precio.',
        )
      : empty({ label: 'Pruebe con otra palabra' }, `Nada coincide con «${this.term().trim()}».`);
  });

  /** A page is made of whole groups, so a panel never loses its components to the next page. */
  protected readonly pageRows = computed<ViewState<readonly LabService[]>>(() =>
    mapData(this.groups(), (groups) => groups.slice(this.offset(), this.offset() + PAGE_SIZE).flat()),
  );

  protected readonly panelNames = computed(
    () => Object.fromEntries((dataOf(this.catalog()) ?? []).map((service) => [service.id, service.name])),
  );

  protected readonly cursor = computed<CursorState>(() => {
    const total = dataOf(this.groups())?.length ?? 0;
    return {
      prevCursor: this.offset() > 0 ? String(Math.max(0, this.offset() - PAGE_SIZE)) : null,
      nextCursor: this.offset() + PAGE_SIZE < total ? String(this.offset() + PAGE_SIZE) : null,
    };
  });

  constructor() {
    this.reload();
  }

  /** Re-reads the catalog. Unsaved edits and the last rejections are kept on purpose. */
  protected reload(): void {
    this.catalog.set(loading());
    this.offset.set(0);
    this.lab.listServices().subscribe({
      next: (page) => this.catalog.set(ready(page.items.filter((service) => service.status !== 'WITHDRAWN'))),
      error: (error: unknown) => this.catalog.set(errorToViewState<readonly LabService[]>(error)),
    });
  }

  protected importClosed(imported: boolean): void {
    this.importOpen.set(false);
    if (imported) {
      this.reload();
    }
  }

  protected goToCursor(cursor: string): void {
    this.offset.set(Math.max(0, Number(cursor) || 0));
  }

  protected search(term: string): void {
    this.term.set(term);
    this.offset.set(0);
  }

  protected setPrice({ service, value }: RowEdit): void {
    this.edits.update((edits) =>
      withEdit(edits, service, { price: value, discount: edits[service.id]?.discount ?? discountText(service) }),
    );
  }

  protected setDiscount({ service, value }: RowEdit): void {
    this.edits.update((edits) =>
      withEdit(edits, service, { price: edits[service.id]?.price ?? service.price ?? '', discount: value }),
    );
  }

  protected discard(): void {
    this.edits.set({});
    this.errors.set([]);
    this.rejected.set([]);
  }

  protected save(): void {
    if (this.saving() || this.dirtyCount() === 0) {
      return;
    }
    const { changes, problems } = changesOf(dataOf(this.catalog()) ?? [], this.edits());
    this.errors.set(problems);
    this.rejected.set([]);
    if (problems.length > 0) {
      return;
    }
    this.saving.set(true);
    from(changes)
      .pipe(
        concatMap(({ service, changes: body }) =>
          this.lab.updateService(service.id, body).pipe(
            map(() => null),
            catchError((error: unknown) => of({ id: service.id, name: service.name, reason: reasonOf(error) })),
          ),
        ),
        toArray(),
      )
      .subscribe((results) => {
        this.saving.set(false);
        const rejected = results.filter((result): result is PriceRejection => result !== null);
        const saved = changes.map((c) => c.service.id).filter((id) => !rejected.some((r) => r.id === id));
        if (saved.length > 0) {
          this.toasts.success(
            saved.length === 1 ? 'Guardó el precio de 1 servicio.' : `Guardó el precio de ${saved.length} servicios.`,
          );
        }
        // Refused rows keep their text so the person can fix it; saved rows are proven by the re-read.
        this.rejected.set(rejected);
        this.edits.update((edits) => withoutIds(edits, saved));
        this.reload();
      });
  }
}
