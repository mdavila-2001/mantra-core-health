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

import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacyProduct } from '../../../../core/data-access/pharmacy/pharmacy.types';
import {
  ArchivoInvalido,
  BYTES_MAXIMOS_DEL_ARCHIVO,
  decodificarCsv,
} from '../../catalog-rules/catalogo.reglas';
import { pharmacyErrorMessage } from '../../pharmacy-error-message';
import { reviewInventoryCsv, type InventoryCsvReview } from '../inventory-csv';

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
 */
@Component({
  selector: 'app-inventory-upload-dialog',
  imports: [Alert, AppButton, ContentDialog, FileInput],
  templateUrl: './inventory-upload-dialog.html',
  styleUrl: './inventory-upload-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryUploadDialog {
  readonly pharmacyId = input.required<string>();
  /** El catálogo tal como está hoy, para revisar los códigos. */
  readonly products = input.required<readonly PharmacyProduct[]>();

  readonly applied = output<void>();
  readonly closed = output<void>();

  private readonly pharmacy = inject(PharmacyClient);
  private readonly toasts = inject(ToastService);
  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly maxBytes = BYTES_MAXIMOS_DEL_ARCHIVO;
  protected readonly files = signal<readonly File[]>([]);
  protected readonly reading = signal(false);
  protected readonly review = signal<InventoryCsvReview | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly applying = signal(false);
  protected readonly applyError = signal<string | null>(null);

  protected readonly shownProblems = computed(() => this.review()?.problems.slice(0, PROBLEMS_SHOWN) ?? []);
  protected readonly hiddenProblems = computed(() =>
    Math.max(0, (this.review()?.problems.length ?? 0) - PROBLEMS_SHOWN),
  );
  protected readonly canApply = computed(() => (this.review()?.lines.length ?? 0) > 0);

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
    const file = chosen[0];
    if (file === undefined) {
      return;
    }
    this.reading.set(true);
    try {
      const { texto } = decodificarCsv(await file.arrayBuffer());
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
}
