import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild, type TemplateRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import type { CensusAdjustment, CensusDay, CensusField, CensusView } from '../../../core/data-access/adt/adt.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, forbidden, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { InpatientAccessStore } from '../inpatient-access.store';
import { BED_BOARD_ROUTE, dateKey, keyToDate, shortDate, shortDateTime, siteToday } from '../inpatient-presentation';
import { AdjustDialog } from './adjust-dialog';
import { CENSUS_LABEL } from './census-fields';

/** Las columnas que se ven en la tabla (las 12 están en el ajuste y en la API). */
const SHOWN: readonly CensusField[] = ['beds_censable', 'beds_available', 'beds_blocked', 'patients_at_cutoff', 'admissions', 'discharges', 'deaths', 'transfers_in', 'transfers_out', 'same_day_stays', 'patient_days'];

/** Una fila de la tabla: la unidad del día y sus números ya escritos. */
export type CensusRow = { readonly id: string; readonly unitName: string; readonly day: CensusDay } & Readonly<Partial<Record<CensusField, string>>>;

export function toRow(d: CensusDay): CensusRow {
  const numeros = Object.fromEntries(
    SHOWN.map((f) => [f, d.counts[f] === d.adjustedCounts[f] ? String(d.counts[f]) : `${d.counts[f]} → ${d.adjustedCounts[f]}`]),
  ) as Partial<Record<CensusField, string>>;
  return { id: d.id ?? `abierto-${d.unitId}`, unitName: d.unitName, day: d, ...numeros };
}

/**
 * **Censo diario** — `/inpatient/census` (F3.4).
 *
 * Día abierto: vista previa calculada por la API (no se persiste). Día
 * cerrado: la foto, sellada, y sus ajustes debajo. **El número original nunca
 * se reescribe**: si hubo ajuste se muestra «original → ajustado».
 */
@Component({
  selector: 'app-census',
  imports: [AdjustDialog, AppButton, Card, DataTable, DatePicker, FormField, PageHeader, StatusSeal, ViewStateHost],
  templateUrl: './census.html',
  styleUrl: './census.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Census {
  private readonly adt = inject(AdtClient);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly access = inject(InpatientAccessStore);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly fieldLabel = (code: string): string => CENSUS_LABEL[code as CensusField] ?? code;
  protected readonly when = (iso: string | null) => shortDateTime(iso) ?? '—';
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  protected readonly site = computed(() => this.access.pickSite(this.query().get('site'), 'census.view'));
  protected readonly siteId = computed(() => this.site()?.siteId ?? null);
  protected readonly date = computed(() => {
    const d = this.query().get('date');
    return d !== null && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : siteToday(-1);
  });
  protected readonly pickerDate = computed(() => keyToDate(this.date()));
  protected readonly dateLabel = computed(() => shortDate(this.date()));

  protected readonly gate = computed<ViewState<string>>(() => {
    const a = this.access.state();
    if (a.status !== 'ready') return a as ViewState<string>;
    const s = this.site();
    return s === null ? forbidden({ message: 'Su rol no incluye el censo de ningún establecimiento de esta organización.' }) : ready(s.siteId);
  });

  private readonly view = signal<ViewState<CensusView>>(loading());
  protected readonly data = computed(() => dataOf(this.view()));
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly working = signal(false);
  protected readonly adjusting = signal<CensusDay | null>(null);

  protected readonly allClosed = computed(() => (this.data()?.days ?? []).every((d) => d.status === 'CENSUS_CLOSED'));
  protected readonly closable = computed(() => {
    const v = this.data();
    return v !== null && Date.now() >= Date.parse(v.closableFrom) && !this.allClosed();
  });

  protected readonly days = computed<ViewState<readonly CensusDay[]>>(() => {
    const m = mapData(this.view(), (v) => v.days);
    return m.status === 'ready' && m.data.length === 0
      ? empty({ label: 'Ver el tablero de camas', route: BED_BOARD_ROUTE }, 'Este establecimiento no tiene camas censables.')
      : m;
  });

  protected readonly adjustments = computed<ViewState<readonly (CensusAdjustment & { readonly unitName: string })[]>>(() => {
    const m = mapData(this.view(), (v) => v.days.flatMap((d) => d.adjustments.map((a) => ({ ...a, unitName: d.unitName }))));
    return m.status === 'ready' && m.data.length === 0
      ? empty({ label: 'Ajustar desde la fila de la unidad (sólo días cerrados)' }, 'Sin ajustes: la foto del día es la que se cerró.')
      : m;
  });

  private readonly cellUnit = viewChild<TemplateRef<{ $implicit: CensusRow }>>('cellUnit');
  private readonly cellStatus = viewChild<TemplateRef<{ $implicit: CensusRow }>>('cellStatus');
  private readonly cellActions = viewChild<TemplateRef<{ $implicit: CensusRow }>>('cellActions');
  private readonly cellAdj = viewChild<TemplateRef<{ $implicit: CensusAdjustment & { readonly unitName: string } }>>('cellAdj');

  /** Las filas, con cada número ya escrito: «3», o «3 → 4» si hubo ajuste. */
  protected readonly rows = computed<ViewState<readonly CensusRow[]>>(() => {
    const d = this.days();
    return d.status === 'ready' ? ready(d.data.map(toRow)) : (d as ViewState<readonly CensusRow[]>);
  });

  protected readonly columns = computed<readonly ColumnDef<CensusRow>[]>(() => [
    { key: 'unitName', header: 'Unidad', priority: 1, cell: this.cellUnit() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.cellStatus() },
    ...SHOWN.map((f, i) => ({ key: f, header: CENSUS_LABEL[f], priority: i < 4 ? 2 : 3, align: 'end' as const })),
    { key: 'id', header: 'Acciones', priority: 1, align: 'end', accion: true, cell: this.cellActions() },
  ]);

  protected readonly adjColumns = computed<readonly ColumnDef<CensusAdjustment & { readonly unitName: string }>[]>(() => [
    { key: 'unitName', header: 'Unidad', priority: 1 },
    { key: 'fieldCode', header: 'Campo', priority: 1, cell: this.cellAdj() },
    { key: 'reasonText', header: 'Motivo', priority: 2 },
    { key: 'adjustedByName', header: 'Ajustó', priority: 3 },
    { key: 'requestId', header: 'Código de petición', priority: 4 },
  ]);

  protected readonly byId = (r: { readonly id: string }): string => r.id;

  constructor() {
    this.access.ensure();
    effect(() => {
      const id = this.siteId();
      const d = this.date();
      if (id === null) return;
      untracked(() => this.load(id, d));
    });
  }

  protected pickDate(d: Date | null): void {
    if (d === null) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { date: dateKey(d) }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected reload(): void {
    const id = this.siteId();
    if (id !== null) this.load(id, this.date());
  }

  protected async close(): Promise<void> {
    const id = this.siteId();
    if (id === null) return;
    const ok = await this.dialogs.confirm({
      title: `Cerrar el censo del ${this.dateLabel()}`,
      message: 'La foto del día queda inmutable. Una corrección posterior es un ajuste con motivo, nunca una edición.',
      confirmLabel: 'Cerrar censo',
    });
    if (!ok) return;
    this.working.set(true);
    this.failure.set(null);
    this.adt.closeCensus(id, this.date()).subscribe({
      next: () => {
        this.working.set(false);
        this.reload();
      },
      error: (e: unknown) => {
        this.working.set(false);
        this.failure.set(errorToViewState<never>(e));
      },
    });
  }

  protected afterAdjust(): void {
    this.adjusting.set(null);
    this.reload();
  }

  private load(siteId: string, date: string): void {
    this.view.set(loading());
    this.adt
      .getCensus(siteId, date)
      .pipe(
        map((v) => ready(v) as ViewState<CensusView>),
        catchError((e: unknown) => of(errorToViewState<CensusView>(e))),
      )
      .subscribe((s) => this.view.set(s));
  }
}
