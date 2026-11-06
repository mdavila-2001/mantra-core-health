import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { DiagnosticUnitsClient } from '../../../core/data-access/diagnostic-units/diagnostic-units.client';
import type { DiagnosticUnitDetail } from '../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { categoryName } from '../laboratory-directory';
import { LabFacilityGrid } from './facility-grid/facility-grid';
import { LabSheetSkeleton } from './sheet-skeleton/sheet-skeleton';
import { LabStudiesPanel } from './studies-panel/studies-panel';
import { LabUnitSummary } from './unit-summary/unit-summary';

/**
 * The sheet tabs, in drawing order. The key travels in `?tab=`, so a saved link
 * opens a tab by name, not by position. Studies always exists; the other three
 * only when the centre has something to show in them.
 */
const SHEET_TABS = ['estudios', 'equipos', 'sedes', 'acreditaciones'] as const;
type SheetTab = (typeof SHEET_TABS)[number];

/** The patient's "my orders": booking a study always starts from a doctor's order. */
export const ORDERS_ROUTE = '/my-account/diagnostic-orders';

/**
 * Public sheet of a diagnostic unit: a clinical laboratory or an imaging centre.
 *
 * ONE `app-card` with tabs, centred and full width (`composition-rules.md` §5).
 * The summary on top answers "is this the place for me?"; the tabs hold the
 * collections; the open one lives in `?tab=`. This container only loads, routes
 * and owns the studies filter, so a new centre starts clean.
 */
@Component({
  selector: 'app-laboratory-detail',
  imports: [
    AppButtonLink, Badge, Card, LabFacilityGrid, LabSheetSkeleton, LabStudiesPanel, LabUnitSummary, NavIcon,
    PageHeader, RouterLink, Tab, Tabs, ViewStateHost,
  ],
  templateUrl: './laboratory-detail.html',
  styleUrls: ['../../../shared/styles/public-sheet.css', './laboratory-detail.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratoryDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly units = inject(DiagnosticUnitsClient);
  private readonly navigation = inject(NavigationService);

  protected readonly state = signal<ViewState<DiagnosticUnitDetail>>(loading());
  protected readonly detail = computed(() => dataOf(this.state()));
  protected readonly title = computed(() => this.detail()?.name ?? 'Unidad diagnóstica');
  protected readonly category = computed(() => {
    const type = this.detail()?.type;
    return type ? categoryName(type.code, type.display) : '';
  });
  protected readonly ordersRoute = ORDERS_ROUTE;

  /** The centre's own icon: a scanner for imaging, a flask for anything else. */
  protected readonly iconoDelCentro = computed<NavIconName>(() =>
    this.detail()?.type.code === 'DU_TYPE_IMAGING' ? 'scan' : 'flask',
  );

  /** Only whoever has «Mis órdenes» (a patient) can book; the rule lives in the nav map. */
  protected readonly canBook = computed(() =>
    this.navigation.visibleSections().some((section) => `/${section.path}` === ORDERS_ROUTE),
  );

  /** The API only returns accreditations in force, so any of them is a trust signal. */
  protected readonly accredited = computed(() => (this.detail()?.accreditations.length ?? 0) > 0);

  /** Studies filter, owned here so opening another centre resets it. */
  protected readonly terminoDeEstudio = signal('');
  protected readonly selectedArea = signal<string | null>(null);

  private readonly requestedTab = signal<string | null>(null);

  protected readonly tabs = computed<readonly SheetTab[]>(() => {
    const unit = this.detail();
    if (unit === null) return ['estudios'];
    const { equipment, sites, accreditations } = unit;
    const counts: Record<SheetTab, number> = { estudios: 1, equipos: equipment.length, sedes: sites.length, acreditaciones: accreditations.length };
    return SHEET_TABS.filter((tab) => counts[tab] > 0);
  });

  /** Index of the open tab (labels carry their counts, «Estudios (106)»). Unknown or none: Studies. */
  protected readonly seleccionada = computed(() => Math.max(0, this.tabs().findIndex((tab) => tab === this.requestedTab())));

  private unitId: string | null = null;
  private anchorHandled = false; // the URL anchor is honoured once per load

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.unitId = params.get('unitId');
      this.anchorHandled = false;
      this.terminoDeEstudio.set('');
      this.selectedArea.set(null);
      this.load();
    });

    // `queryParamMap`, not the snapshot: another `?tab=` on the same sheet
    // switches tabs without recreating the screen.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.requestedTab.set(params.get('tab'));
    });

    // «Ver estudios y precios» arrives with `#estudios`, which only exists once
    // the sheet is drawn: scroll there by hand when it is, once per load.
    afterRenderEffect(() => {
      if (this.detail() === null || this.anchorHandled) return;
      const anchor = this.route.snapshot.fragment;
      if (anchor === null) return;
      this.anchorHandled = true;
      globalThis.document?.getElementById(anchor)?.scrollIntoView({ block: 'start' });
    });
  }

  protected readonly retry = (): void => this.load();

  /** Switches tab and writes only `tab` to the URL, with `replaceUrl`. */
  protected seleccionar(index: number): void {
    const tab = this.tabs()[index] ?? 'estudios';
    this.requestedTab.set(tab);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, replaceUrl: true });
  }

  private load(): void {
    if (!this.unitId) {
      this.state.set(notFound({ label: 'Volver al directorio', route: '/laboratory-directory' }));
      return;
    }
    this.state.set(loading());
    this.units.getById(this.unitId).subscribe({
      next: (detail) => this.state.set(ready(detail)),
      error: (error: unknown) => this.state.set(errorToViewState<DiagnosticUnitDetail>(error)),
    });
  }
}
