import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import type {
  LabCatalog,
  LabCatalogImportResult,
  LabCatalogItem,
} from '../../../../core/data-access/lab-portal/lab-import.types';
import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { FilterDef } from '../../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { SpecialtyBrowser } from '../../../../shared/components/organisms/specialty-browser/specialty-browser';
import type { SpecialtyGroup } from '../../../../shared/components/organisms/specialty-browser/specialty-browser.types';
import { LabCatalogItemCard } from './lab-catalog-item';

const PRICES_ROUTE = '/administration/laboratory-prices';
const SECTION = 'section';

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
  private readonly router = inject(Router);

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
      key: SECTION,
      label: 'Sección',
      placeholder: 'Todas las secciones',
      options: (dataOf(this.catalog())?.sections ?? []).map((s) => ({
        value: s.code,
        label: `${s.name} (${s.items.length})`,
      })),
    },
  ]);

  /** Sections filtered by the URL's section and text (name, code, LOINC or component). */
  protected readonly groups = computed<readonly SpecialtyGroup<LabCatalogItem>[]>(() => {
    const section = this.params().get(SECTION) ?? '';
    const term = (this.params().get('q') ?? '').trim().toLocaleLowerCase('es');
    const hit = (i: LabCatalogItem) =>
      term === '' ||
      [i.name, i.code, i.loinc, ...i.components.map((c) => c.name)].some((t) =>
        (t ?? '').toLocaleLowerCase('es').includes(term),
      );
    return (dataOf(this.catalog())?.sections ?? [])
      .filter((s) => section === '' || s.code === section)
      .map((s) => ({ conceptId: s.code, label: s.name, items: s.items.filter(hit) }))
      .filter((g) => g.items.length > 0);
  });

  /** One sentence: added (created or linked to a hand-typed one), skipped, rejected. */
  protected readonly resultText = computed(() => {
    const r = this.result();
    if (r === null) return null;
    const added = r.created + r.linked + r.republished;
    const parts = [`Se ${added === 1 ? 'agregó 1 análisis' : `agregaron ${added} análisis`} con sus componentes`];
    if (r.skipped > 0) parts.push(`${r.skipped} ya estaba${r.skipped === 1 ? '' : 'n'}`);
    if (r.rejected > 0) parts.push(`${r.rejected} no se pudo agregar`);
    return `${parts.join('; ')}.`;
  });
  protected readonly addLabel = computed(() => {
    const n = this.selected().size;
    return n === 0 ? 'Agregar análisis' : n === 1 ? 'Agregar 1 análisis' : `Agregar ${n} análisis`;
  });
  protected readonly priceRule = computed(() => dataOf(this.catalog())?.priceRule ?? null);
  protected readonly hasFilter = computed(
    () => (this.params().get('q') ?? '') !== '' || (this.params().get(SECTION) ?? '') !== '',
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.catalog.set(loading());
    this.lab.getCatalog().subscribe({
      next: (catalog) => this.catalog.set(ready(catalog)),
      error: (error: unknown) => this.catalog.set(errorToViewState<LabCatalog>(error)),
    });
  }

  protected filter(filters: Readonly<Record<string, string>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...filters },
      replaceUrl: true,
    });
  }

  protected toggle(item: LabCatalogItem): void {
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
        const state = errorToViewState<never>(error);
        this.failure.set(
          'message' in state && typeof state.message === 'string'
            ? state.message
            : 'No se pudieron agregar los análisis.',
        );
      },
    });
  }
}
