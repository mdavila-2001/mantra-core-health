import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type {
  LabCatalog,
  LabCatalogImportResult,
} from '../../../../core/data-access/lab-portal/lab-import.types';
import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import { describeApiFailure } from '../../../../core/http/api-failure';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { FilterDef } from '../../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { SpecialtyBrowser } from '../../../../shared/components/organisms/specialty-browser/specialty-browser';
import { LabCatalogItemCard } from './lab-catalog-item';
import { catalogGroups, importSummary, type CatalogEntry } from './lab-catalog.rules';

const PRICES_ROUTE = '/administration/laboratory-prices';
const SECTION = 'section';
const SAMPLE = 'sample';

/**
 * «Agregar del catálogo» (proceso 4.2): the lab picks análisis from the same
 * LOINC catalog the doctor orders from, grouped by section, like the doctor
 * picks procedures from the arancel. Each one comes with its components and
 * the suggested price of each (INLASA, else FONASA in Bs); adding it creates
 * the panel and one priced service per component, editable in Precios.
 */
@Component({
  selector: 'app-lab-catalog-import',
  imports: [Alert, AppButton, LabCatalogItemCard, PageHeader, RouterLink, SpecialtyBrowser],
  templateUrl: './lab-catalog-import.html',
  styleUrl: './lab-catalog-import.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabCatalogImport {
  private readonly lab = inject(LabPortalClient);
  private readonly route = inject(ActivatedRoute);

  protected readonly pricesRoute = PRICES_ROUTE;
  protected readonly catalog = signal<ViewState<LabCatalog>>(loading());
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly importing = signal(false);
  protected readonly result = signal<LabCatalogImportResult | null>(null);
  protected readonly failure = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly filters = computed<readonly FilterDef[]>(() => [
    {
      key: SAMPLE,
      label: 'Muestra',
      placeholder: 'Todas las muestras',
      options: (dataOf(this.catalog())?.sampleTypes ?? []).map((t) => ({
        value: t.code,
        label: t.name,
      })),
    },
    {
      key: SECTION,
      label: 'Sección',
      placeholder: 'Todas las secciones',
      options: (dataOf(this.catalog())?.sections ?? []).map((s) => ({
        value: s.code,
        label: `${s.name} (${s.items.length})`,
      })),
    },
  ]);

  protected readonly groups = computed(() =>
    catalogGroups(dataOf(this.catalog()), {
      sample: this.params().get(SAMPLE) ?? '',
      section: this.params().get(SECTION) ?? '',
      text: this.params().get('q') ?? '',
    }),
  );

  protected readonly summary = computed(() => {
    const result = this.result();
    if (result === null) return null;
    const names = new Map(
      (dataOf(this.catalog())?.sections ?? [])
        .flatMap((s) => s.items)
        .map((i) => [i.conceptId, i.name]),
    );
    return importSummary(result, (id) => names.get(id) ?? 'Un análisis');
  });
  protected readonly addLabel = computed(() => {
    const n = this.selected().size;
    return n === 0 ? 'Agregar análisis' : n === 1 ? 'Agregar 1 análisis' : `Agregar ${n} análisis`;
  });
  protected readonly priceRule = computed(() => dataOf(this.catalog())?.priceRule ?? null);
  protected readonly hasFilter = computed(() =>
    ['q', SECTION, SAMPLE].some((key) => (this.params().get(key) ?? '') !== ''),
  );
  /** Only the basic análisis are there: no LOINC catalog loaded in this environment. */
  protected readonly notLoaded = computed(() => {
    const catalog = dataOf(this.catalog());
    return catalog !== null && catalog.catalogVersion === null;
  });

  constructor() {
    this.load();
  }

  /** Rereads without a skeleton when data is shown, so open cards stay open. */
  protected load(): void {
    if (this.catalog().status !== 'ready') this.catalog.set(loading());
    this.lab.getCatalog().subscribe({
      next: (catalog) =>
        this.catalog.set(
          catalog.count > 0
            ? ready(catalog)
            : empty(
                { label: 'Volver a Precios', route: PRICES_ROUTE },
                'El catálogo de estudios todavía no está cargado.',
              ),
        ),
      error: (error: unknown) => this.catalog.set(errorToViewState<LabCatalog>(error)),
    });
  }

  protected toggle(item: CatalogEntry): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(item.conceptId)) next.add(item.conceptId);
      return next;
    });
  }

  /** Selects every not-yet-offered item the current filter shows. */
  protected selectShown(): void {
    const ids = this.groups().flatMap((g) =>
      g.items.filter((i) => !i.offeredServiceId).map((i) => i.conceptId),
    );
    this.selected.update((current) => new Set([...current, ...ids]));
  }

  protected add(): void {
    const ids = [...this.selected()];
    if (ids.length === 0 || this.importing()) return;
    this.importing.set(true);
    this.failure.set(null);
    this.lab.importCatalog(ids).subscribe({
      next: (result) => {
        this.importing.set(false);
        this.result.set(result);
        this.selected.set(new Set());
        // Reread: what was added now reads «Ya está en su lista de precios».
        this.load();
      },
      error: (error: unknown) => {
        this.importing.set(false);
        this.failure.set(describeApiFailure(error, 'No se pudieron agregar los análisis.'));
      },
    });
  }
}
