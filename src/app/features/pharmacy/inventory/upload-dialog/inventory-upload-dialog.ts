import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FileInput, type RejectedFile } from '../../../../shared/components/molecules/file-input/file-input';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';

import { PharmacyBulkClient } from '../../../../core/data-access/pharmacy/pharmacy-bulk.client';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacyProduct } from '../../../../core/data-access/pharmacy/pharmacy.types';
import {
  ArchivoInvalido,
  FILE_MAX_BYTES,
  decodificarCsv,
} from '../../catalog-rules/catalog.rules';
import {
  bulkFailureMessage,
  countOutcomes,
  toFileRows,
  type FileRowResult,
} from '../../import/bulk-publish';
import { pharmacyErrorMessage } from '../../pharmacy-error-message';
import { reviewInventoryCsv, type InventoryCsvReview } from '../inventory-csv';
import type { InventorySite } from '../site-stock/inventory-sites';
import {
  readSiteAvailabilityCsv,
  type SiteAvailabilityCsvReading,
} from '../site-availability-csv';
import { LoadingState } from '../../../../shared/components/molecules/loading-state/loading-state';

/** Cuántos problemas se listan antes de decir «y N más»: el resto está en el archivo. */
const PROBLEMS_SHOWN = 20;

/**
 * **Subir el inventario por CSV**: se elige el archivo, se revisa contra el
 * catálogo **sin mandar nada**, se dice qué va a cambiar y qué filas no valen,
 * y recién con «Aplicar» sale un único `PATCH …/inventory`.
 *
 * Sirve para las dos formas de llevar el inventario: un archivo con
 * `existencias` (y `umbral`) actualiza cantidades; uno con sólo `disponible`
 * actualiza el «hay / no hay». El inventario exportado desde la pantalla ya
 * tiene los encabezados correctos, así que se puede corregir y volver a subir.
 *
 * Las filas con problema no frenan a las buenas: se aplican las válidas y las
 * demás quedan dichas con su línea. El servidor es todo o nada sobre lo que
 * recibe, y lo que recibe ya viene revisado.
 *
 * ## Una sucursal
 *
 * Con una sucursal elegida (`site`) el archivo es el stock **de esa sede**: va
 * a la carga masiva por sucursal (`POST …/sites/:siteId/availability/bulk`),
 * que alcanza a las sedes con stock propio. El servidor responde la vista
 * previa (`dryRun`, no escribe nada) fila por fila, y «Aplicar» manda lo mismo
 * escrito.
 */
@Component({
  selector: 'app-inventory-upload-dialog',
  imports: [Alert, AppButton, ContentDialog, FileInput, LoadingState],
  templateUrl: './inventory-upload-dialog.html',
  styleUrl: './inventory-upload-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryUploadDialog {
  readonly pharmacyId = input.required<string>();
  /** El catálogo tal como está hoy, para revisar los códigos. */
  readonly products = input.required<readonly PharmacyProduct[]>();
  /** La sucursal cuyo stock se sube; `null` = lo declarado en el catálogo. */
  readonly site = input<InventorySite | null>(null);

  readonly applied = output<void>();
  readonly closed = output<void>();

  private readonly pharmacy = inject(PharmacyClient);
  private readonly bulk = inject(PharmacyBulkClient);
  private readonly toasts = inject(ToastService);
  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly maxBytes = FILE_MAX_BYTES;
  protected readonly files = signal<readonly File[]>([]);
  protected readonly reading = signal(false);
  protected readonly review = signal<InventoryCsvReview | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly applying = signal(false);
  protected readonly applyError = signal<string | null>(null);

  /* Una sucursal: lo que se leyó y lo que contestó el servidor. */
  protected readonly siteReading = signal<SiteAvailabilityCsvReading | null>(null);
  protected readonly siteResults = signal<readonly FileRowResult[] | null>(null);
  protected readonly sitePreviewing = signal(false);
  /** La carga escrita ya salió: lo que se ve es su resultado, no una vista previa. */
  protected readonly siteApplied = signal(false);
  protected readonly siteCounts = computed(() => countOutcomes(this.siteResults() ?? []));
  /** Lo frenado acá y lo que rechazaría el servidor, por línea del archivo. */
  protected readonly siteProblems = computed(() => [
    ...(this.siteReading()?.rows ?? [])
      .filter((row) => row.payload === null)
      .map((row) => ({ line: row.line, message: row.errors.join(' ') })),
    ...(this.siteResults() ?? [])
      .filter((result) => result.outcome === 'REJECTED')
      .map((result) => ({ line: result.number, message: result.message })),
  ].sort((a, b) => a.line - b.line));
  protected readonly siteChanges = computed(
    () => this.siteCounts().created + this.siteCounts().updated,
  );

  protected readonly shownProblems = computed(() => this.review()?.problems.slice(0, PROBLEMS_SHOWN) ?? []);
  protected readonly hiddenProblems = computed(() =>
    Math.max(0, (this.review()?.problems.length ?? 0) - PROBLEMS_SHOWN),
  );
  protected readonly canApply = computed(() =>
    this.site() === null
      ? (this.review()?.lines.length ?? 0) > 0
      : !this.sitePreviewing() &&
        !this.siteApplied() &&
        this.siteResults() !== null &&
        this.siteChanges() > 0,
  );

  /** Con qué forma vino el archivo, dicho en palabras. */
  protected readonly kindText = computed(() => {
    const columns = this.review()?.columns ?? [];
    if (columns.includes('stock')) {
      return 'Actualiza las cantidades' + (columns.includes('minimum') ? ' y los umbrales.' : '.');
    }
    if (columns.includes('available')) {
      return 'Actualiza sólo si hay o no hay, sin cantidades.';
    }
    return 'Actualiza los umbrales de alerta.';
  });

  protected reject(rejected: readonly RejectedFile[]): void {
    const first = rejected[0];
    this.fileError.set(
      first === undefined ? null : 'Ese archivo no sirve: elija un CSV de hasta 1 MB.',
    );
  }

  protected async choose(chosen: readonly File[]): Promise<void> {
    this.files.set(chosen);
    this.review.set(null);
    this.fileError.set(null);
    this.applyError.set(null);
    this.siteReading.set(null);
    this.siteResults.set(null);
    this.siteApplied.set(false);
    const file = chosen[0];
    if (file === undefined) {
      return;
    }
    this.reading.set(true);
    try {
      const { texto } = decodificarCsv(await file.arrayBuffer());
      if (this.site() !== null) {
        this.siteReading.set(readSiteAvailabilityCsv(texto));
        this.sendSite(true);
        return;
      }
      this.review.set(reviewInventoryCsv(texto, this.products()));
    } catch (error) {
      this.fileError.set(
        error instanceof ArchivoInvalido ? error.message : 'No se pudo leer el archivo.',
      );
    } finally {
      this.reading.set(false);
    }
  }

  protected apply(): void {
    if (this.site() !== null) {
      if (this.canApply() && !this.applying()) {
        this.sendSite(false);
      }
      return;
    }
    const review = this.review();
    if (review === null || review.lines.length === 0 || this.applying()) {
      return;
    }
    this.applying.set(true);
    this.applyError.set(null);
    this.pharmacy.updateInventory(this.pharmacyId(), review.lines).subscribe({
      next: (result) => {
        this.applying.set(false);
        this.toasts.success(
          result.updated === 1
            ? 'Actualizó el inventario de 1 producto.'
            : `Actualizó el inventario de ${result.updated} productos.`,
        );
        this.applied.emit();
        this.dialog().close(true);
      },
      error: (error: unknown) => {
        this.applying.set(false);
        this.applyError.set(pharmacyErrorMessage(error, 'No se pudo actualizar el inventario.'));
      },
    });
  }

  /**
   * Manda las filas legibles a la carga de la sucursal, en lotes de 250 y en
   * serie: con `dryRun` es la vista previa (el servidor no escribe nada); sin
   * él, lo mismo escrito, y la pestaña relee el stock de la API.
   */
  private sendSite(dryRun: boolean): void {
    const site = this.site();
    const rows = (this.siteReading()?.rows ?? []).filter((row) => row.payload !== null);
    if (site === null || rows.length === 0) {
      this.siteResults.set(rows.length === 0 ? [] : null);
      return;
    }
    const lines = rows.map((row) => row.line);
    (dryRun ? this.sitePreviewing : this.applying).set(true);
    this.applyError.set(null);
    this.bulk
      .bulkAll(
        this.pharmacyId(),
        { siteAvailability: site.siteId },
        { mode: 'UPSERT', ...(dryRun ? { dryRun: true } : {}), rows: rows.map((row) => row.payload!) },
      )
      .subscribe({
        next: (response) => {
          const results = toFileRows(lines, response.results);
          if (dryRun) {
            this.sitePreviewing.set(false);
            this.siteResults.set(results);
            return;
          }
          this.applying.set(false);
          const done = countOutcomes(results);
          const changed = done.created + done.updated;
          this.applied.emit();
          if (done.rejected > 0) {
            // Lo que el servidor no aplicó se queda a la vista, con su motivo.
            this.siteApplied.set(true);
            this.siteResults.set(results);
            this.applyError.set(
              `Se aplicaron ${changed} y el servidor rechazó ${done.rejected}: revise los motivos.`,
            );
            return;
          }
          this.toasts.success(
            `Actualizó el stock de ${site.siteName}: ${changed} ${changed === 1 ? 'producto' : 'productos'}.`,
          );
          this.dialog().close(true);
        },
        error: (error: unknown) => {
          (dryRun ? this.sitePreviewing : this.applying).set(false);
          this.applyError.set(bulkFailureMessage(error));
        },
      });
  }
}
