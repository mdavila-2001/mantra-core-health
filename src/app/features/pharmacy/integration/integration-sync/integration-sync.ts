import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { DatePipe } from '@angular/common';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';

import { PharmacyIntegrationClient } from '../../../../core/data-access/pharmacy/pharmacy-integration.client';
import type {
  IntegrationConnection,
  SyncBatch,
  SyncResult,
  SyncSiteSummary,
} from '../../../../core/data-access/pharmacy/pharmacy-integration.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';

import { integrationErrorMessage } from '../integration-error-message';
import { syncSkipMessage } from './sync-skip-message';

/** Cuántos lotes se muestran: los últimos. */
const BATCH_LIMIT = 5;

/**
 * La sincronización de una conexión: la última, las anteriores y «Sincronizar
 * ahora».
 *
 * - El botón no deja salir dos sincronizaciones: queda deshabilitado mientras
 *   una viaja, y también si la conexión no puede sincronizar (inactiva, sin
 *   consulta de stock o sin el sistema configurado en la API).
 * - El resumen es el de la respuesta, en líneas (un código en una sede):
 *   recibidas = vinculadas + sin vínculo, una fila por sede, las líneas que no
 *   se aplicaron con su motivo, los códigos que el sistema dejó de mandar y
 *   los códigos sin vínculo único. Un código sin vínculo ofrece vincularlo
 *   ({@link linkRequested}); uno ambiguo manda a deshacer los que sobran. La
 *   lista de lotes se relee después.
 * - Un 422 o un 502 se dicen en castellano y no dejan un resumen viejo a la
 *   vista: no hay datos a medias.
 */
@Component({
  selector: 'app-integration-sync',
  imports: [Alert, AppButton, Badge, DataTable, DatePipe],
  templateUrl: './integration-sync.html',
  styleUrl: './integration-sync.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationSync {
  readonly pharmacyId = input.required<string>();
  readonly connection = input.required<IntegrationConnection>();

  /** «Vincular» sobre un código sin vínculo: lo atiende «Productos vinculados». */
  readonly linkRequested = output<string>();

  private readonly integration = inject(PharmacyIntegrationClient);

  protected readonly batches = signal<ViewState<readonly SyncBatch[]>>(loading());
  protected readonly syncing = signal(false);
  protected readonly result = signal<SyncResult | null>(null);
  protected readonly error = signal<string | null>(null);

  /** La última sincronización registrada, o `null` si nunca hubo una. */
  protected readonly last = computed(() => dataOf(this.batches())?.[0] ?? null);

  /** Si la conexión puede sincronizar; lo que diga la API en el `POST` sigue mandando. */
  protected readonly canSync = computed(() => {
    const connection = this.connection();
    return connection.status === 'ACTIVE' && connection.supportsStockQuery && connection.providerConfigured;
  });

  /** Líneas sin vínculo único; una API anterior a FAR-C8 no las manda y se deducen. */
  protected readonly unmappedLines = computed(() => {
    const result = this.result();
    return result === null ? 0 : (result.unmappedLines ?? Math.max(0, result.received - result.mapped));
  });

  protected readonly sites = computed<ViewState<readonly SyncSiteSummary[]>>(() =>
    ready(this.result()?.sites ?? []),
  );
  protected readonly hasSites = computed(() => (this.result()?.sites ?? []).length > 0);
  protected readonly skipped = computed(() => this.result()?.skipped ?? []);
  protected readonly notSent = computed(() => this.result()?.notSent ?? []);
  protected readonly ambiguousCount = computed(
    () => (this.result()?.unmapped ?? []).filter((item) => item.reason === 'AMBIGUOUS_MAPPING').length,
  );

  /** El nombre de cada sede de la corrida, para las listas que sólo traen el código. */
  private readonly siteNames = computed(
    () => new Map((this.result()?.sites ?? []).map((site) => [site.siteId, site.siteName])),
  );

  protected readonly skipMessage = syncSkipMessage;

  protected siteLabel(line: { readonly siteId: string; readonly siteCode: string }): string {
    return this.siteNames().get(line.siteId) ?? line.siteCode;
  }

  protected readonly siteRowId = (site: SyncSiteSummary): string => site.siteId;
  protected readonly siteRowLabel = (site: SyncSiteSummary): string => site.siteName;

  private readonly siteCell = viewChild.required<TemplateRef<{ $implicit: SyncSiteSummary }>>('siteCell');

  protected readonly siteColumns = computed<readonly ColumnDef<SyncSiteSummary>[]>(() => [
    { key: 'siteName', header: 'Sede', priority: 1, cell: this.siteCell() },
    { key: 'received', header: 'Recibidas', priority: 1, align: 'end' },
    { key: 'mapped', header: 'Vinculadas', priority: 2, align: 'end' },
    { key: 'unmapped', header: 'Sin vínculo', priority: 2, align: 'end' },
    { key: 'applied', header: 'Aplicadas', priority: 1, align: 'end' },
    { key: 'unchanged', header: 'Sin cambios', priority: 2, align: 'end' },
    { key: 'skipped', header: 'No aplicadas', priority: 2, align: 'end' },
  ]);

  private readonly dateCell = viewChild.required<TemplateRef<{ $implicit: SyncBatch }>>('dateCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: SyncBatch }>>('statusCell');
  private readonly itemsCell = viewChild.required<TemplateRef<{ $implicit: SyncBatch }>>('itemsCell');
  private readonly discrepanciesCell = viewChild.required<TemplateRef<{ $implicit: SyncBatch }>>('discrepanciesCell');

  protected readonly columns = computed<readonly ColumnDef<SyncBatch>[]>(() => [
    { key: 'receivedAt', header: 'Fecha', priority: 1, cell: this.dateCell() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.statusCell() },
    { key: 'itemCount', header: 'Ítems recibidos', priority: 2, cell: this.itemsCell() },
    { key: 'discrepancies', header: 'Sin vincular', priority: 2, cell: this.discrepanciesCell() },
  ]);

  protected readonly rowId = (batch: SyncBatch): string => batch.id;
  protected readonly rowLabel = (batch: SyncBatch): string => `Sincronización ${batch.id}`;

  constructor() {
    // Otra conexión u otra farmacia: el resumen anterior no habla de esta. Por
    // la clave y no por el objeto: releer la misma conexión no lo borra.
    const key = computed(() => `${this.pharmacyId()}|${this.connection().id}`);
    effect(() => {
      key();
      untracked(() => {
        this.result.set(null);
        this.error.set(null);
        this.reload();
      });
    });
  }

  protected reload(): void {
    this.batches.set(loading());
    this.integration.listSyncBatches(this.pharmacyId(), this.connection().id, BATCH_LIMIT).subscribe({
      next: (list) =>
        this.batches.set(
          list.items.length > 0
            ? ready(list.items)
            : empty({ label: 'Toque «Sincronizar ahora»' }, 'Todavía no se sincronizó con el sistema de la farmacia.'),
        ),
      error: (error: unknown) => this.batches.set(errorToViewState<readonly SyncBatch[]>(error)),
    });
  }

  protected sync(): void {
    if (this.syncing() || !this.canSync()) {
      return;
    }
    this.syncing.set(true);
    this.result.set(null);
    this.error.set(null);
    this.integration.sync(this.pharmacyId(), this.connection().id).subscribe({
      next: (result) => {
        this.syncing.set(false);
        this.result.set(result);
        this.reload();
      },
      error: (error: unknown) => {
        this.syncing.set(false);
        this.error.set(integrationErrorMessage(error, 'No se pudo sincronizar con el sistema de la farmacia.'));
      },
    });
  }
}
