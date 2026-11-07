import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, of, switchMap, tap } from 'rxjs';

import { CatalogBulkClient } from '../../../core/data-access/admin-portal/catalog-bulk.client';
import {
  CATALOG_BULK_KEY_FIELD,
  type CatalogBulkKind,
  type CatalogBulkPharmacy,
  type CatalogBulkSnapshotRow,
} from '../../../core/data-access/admin-portal/catalog-bulk.types';
import type { BulkMode, BulkOutcome, BulkResponse } from '../../../core/data-access/pharmacy/pharmacy-bulk.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FileInput, type RejectedFile } from '../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { MetricCard } from '../../../shared/components/molecules/metric-card/metric-card';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { parseCatalogFile, keyOfRow } from './catalog-bulk-file';
import {
  CATALOG_BULK_MAX_BYTES, KINDS, MODES, OUTCOMES, OUTCOME_LABEL, type KindInfo,
} from './catalog-bulk-kinds';

interface ResultRow {
  readonly id: string;
  readonly row: number;
  readonly key: string;
  readonly outcome: string;
  readonly reason: string;
}
interface SnapshotRow extends CatalogBulkSnapshotRow { readonly id: string }

/**
 * Pharmacy catalog bulk load (categories, products, prices, sites): pick the
 * pharmacy and kind, upload a file, simulate with `dryRun`, confirm, report.
 * Writes through `POST /pharmacies/:id/{kind}/bulk`; the API is the authority.
 */
@Component({
  selector: 'app-catalog-bulk',
  imports: [Alert, AppButton, Card, DataTable, FileInput, FormField, MetricCard, PageHeader, Select, ViewStateHost],
  templateUrl: './catalog-bulk.html',
  styleUrl: './catalog-bulk.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogBulk {
  private readonly client = inject(CatalogBulkClient);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly pharmacies = signal<ViewState<readonly CatalogBulkPharmacy[]>>(loading());
  protected readonly pharmacyId = signal<string | null>(null);
  protected readonly kind = signal<CatalogBulkKind>('categories');
  protected readonly mode = signal<BulkMode>('UPSERT');
  protected readonly files = signal<readonly File[]>([]);
  protected readonly rows = signal<readonly Record<string, unknown>[]>([]);
  protected readonly fileError = signal<string | null>(null);
  protected readonly running = signal(false);
  protected readonly preview = signal<BulkResponse | null>(null);
  protected readonly report = signal<BulkResponse | null>(null);
  protected readonly failure = signal<string | null>(null);
  protected readonly snapshot = signal<ViewState<readonly SnapshotRow[] | null> | null>(null);

  protected readonly kindOptions: readonly SelectOption<CatalogBulkKind>[] = KINDS.map((k) => ({ value: k.value, label: k.label }));
  protected readonly modeOptions: readonly SelectOption<BulkMode>[] = MODES.map((m) => ({ value: m.value, label: m.label, description: m.description }));
  protected readonly pharmacyOptions = computed<SelectOption<string>[]>(() => {
    const s = this.pharmacies();
    return s.status === 'ready' ? s.data.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })) : [];
  });
  protected readonly info = computed<KindInfo>(() => KINDS.find((k) => k.value === this.kind())!);
  protected readonly maxBytes = CATALOG_BULK_MAX_BYTES;
  protected readonly outcomes = OUTCOMES;
  protected readonly label = OUTCOME_LABEL;

  /** The response on screen: the confirmed report wins over the preview. */
  protected readonly current = computed(() => this.report() ?? this.preview());
  protected readonly canSimulate = computed(() => this.pharmacyId() !== null && this.rows().length > 0 && !this.running());
  protected readonly resultRows = computed<ViewState<readonly ResultRow[]>>(() => {
    const res = this.current();
    const field = CATALOG_BULK_KEY_FIELD[this.kind()];
    return ready(
      (res?.results ?? []).map((r) => ({
        id: String(r.row), row: r.row, key: keyOfRow(this.rows()[r.row - 1], field), outcome: OUTCOME_LABEL[r.outcome],
        reason: (r.errors ?? []).map((e) => e.message ?? e.reason).join(' · '),
      })),
    );
  });
  protected readonly snapshotRows = computed<ViewState<readonly SnapshotRow[]>>(() => {
    const s = this.snapshot();
    return s !== null && s.status === 'ready' ? ready(s.data ?? []) : ready([]);
  });
  protected readonly resultColumns: readonly ColumnDef<ResultRow>[] = [
    { key: 'row', header: 'Fila', priority: 1, align: 'end' },
    { key: 'key', header: 'Clave', priority: 1 },
    { key: 'outcome', header: 'Resultado', priority: 1 },
    { key: 'reason', header: 'Motivo', priority: 2 },
  ];
  protected readonly snapshotColumns: readonly ColumnDef<SnapshotRow>[] = [
    { key: 'key', header: 'Clave', priority: 1 },
    { key: 'detail', header: 'Dato guardado', priority: 1 },
  ];
  protected readonly byId = (r: { readonly id: string }): string => r.id;
  protected readonly rowName = (r: ResultRow): string => `Fila ${r.row}`;
  protected readonly snapshotName = (r: SnapshotRow): string => r.key;

  constructor() {
    this.client.pharmacies().subscribe({
      next: (list) => {
        this.pharmacies.set(ready(list));
        if (list.length === 1) this.pharmacyId.set(list[0]!.id);
      },
      error: (e: unknown) => this.pharmacies.set(errorToViewState(e)),
    });
  }

  protected count(outcome: BulkOutcome): number {
    return this.current()?.results.filter((r) => r.outcome === outcome).length ?? 0;
  }

  protected resetResults(): void {
    this.preview.set(null);
    this.report.set(null);
    this.failure.set(null);
    this.snapshot.set(null);
  }

  protected pick<T>(target: { set(v: T): void }, value: T | null): void {
    if (value === null) return;
    target.set(value);
    this.resetResults();
  }

  protected pickKind(value: CatalogBulkKind | null): void {
    this.pick(this.kind, value);
    this.files.set([]);
    this.rows.set([]);
    this.fileError.set(null);
  }

  protected pickFile(files: readonly File[]): void {
    this.files.set(files);
    this.resetResults();
    this.rows.set([]);
    this.fileError.set(null);
    const file = files[0];
    if (file === undefined) return;
    void file.text().then((text) => {
      const parsed = parseCatalogFile(file.name, text, this.info());
      if (parsed.ok) this.rows.set(parsed.rows);
      else this.fileError.set(parsed.message);
    });
  }

  protected rejectFile(rejected: readonly RejectedFile[]): void {
    this.fileError.set(`Archivo no aceptado (${rejected[0]?.reason ?? 'inválido'}). Use CSV o JSON de hasta 1 MB.`);
  }

  /** Step 1: `dryRun: true` — nothing is written. */
  protected simulate(): void {
    this.send(true);
  }

  /** Step 2: the real load, then reload the catalog to read back what persisted. */
  protected confirm(): void {
    this.send(false);
  }

  private send(dryRun: boolean): void {
    const pharmacyId = this.pharmacyId();
    if (pharmacyId === null) return;
    const kind = this.kind();
    this.running.set(true);
    this.failure.set(null);
    this.client
      .bulk(pharmacyId, kind, { mode: this.mode(), dryRun, rows: this.rows() })
      .pipe(
        tap((res) => (dryRun ? this.preview.set(res) : this.report.set(res))),
        switchMap(() => {
          if (dryRun) return of(null);
          this.snapshot.set(loading());
          return this.client.snapshot(pharmacyId, kind);
        }),
        catchError((e: unknown) => {
          const state = errorToViewState<never>(e);
          this.failure.set((state.status === 'error' ? state.message : undefined) ?? 'No se pudo completar la carga.');
          return of(undefined);
        }),
      )
      .subscribe((snap) => {
        this.running.set(false);
        if (!dryRun && snap !== undefined) {
          this.snapshot.set(ready((snap ?? null) === null ? null : snap!.map((s) => ({ ...s, id: s.key }))));
        }
      });
  }
}
