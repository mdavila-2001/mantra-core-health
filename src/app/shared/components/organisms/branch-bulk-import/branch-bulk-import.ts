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

import { ArchivoInvalido, decodificarCsv } from '../../../utils/csv-import/csv-import';
import {
  BRANCH_IMPORT_COLUMNS,
  BRANCH_IMPORT_MAX_BYTES,
  BRANCH_IMPORT_MAX_ROWS,
  BRANCH_IMPORT_SAMPLE_ROWS,
  reviewBranchCsv,
  validDrafts,
  type BranchDraft,
  type BranchImportReview,
} from '../../../utils/branch-import/branch-import';
import { CsvExportService, type CsvColumn } from '../../../utils/csv-export/csv-export';
import { AppButton } from '../../atoms/button/button';
import { Alert } from '../../molecules/alert/alert';
import { FileInput, type RejectedFile } from '../../molecules/file-input/file-input';
import { ContentDialog } from '../content-dialog/content-dialog';

/** Cuántas filas se listan antes de decir «y N más»: el resto está en el archivo. */
const ROWS_SHOWN = 20;

type SampleRow = (typeof BRANCH_IMPORT_SAMPLE_ROWS)[number];

/**
 * **Subir sucursales en lote**: un CSV con una sucursal por fila —nombre,
 * descripción y enlace de ubicación, más dirección y código opcionales—.
 *
 * Es la misma pieza para toda organización (las altas de laboratorio, farmacia
 * e imagenología, y la ficha de cualquier organización en administración):
 * revisa el archivo **sin mandar nada**, dice qué filas valen y cuáles no con
 * su línea, y recién con «Agregar» emite las válidas. Qué se hace con ellas
 * —sumarlas al formulario o crearlas en la API— lo decide quien la abre.
 */
@Component({
  selector: 'app-branch-bulk-import',
  imports: [Alert, AppButton, ContentDialog, FileInput],
  templateUrl: './branch-bulk-import.html',
  styleUrl: './branch-bulk-import.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchBulkImport {
  /** Las sucursales que ya están cargadas: repetirlas es un error de la fila. */
  readonly existingNames = input<readonly string[]>([]);
  /** Prefijo de los `data-testid`, para que dos pantallas no choquen. */
  readonly testIdPrefix = input('branch-import');
  /** Texto del botón de confirmar: «Agregar» en un alta, «Crear» en la ficha. */
  readonly confirmVerb = input('Agregar');
  /** Aviso propio de la pantalla (por ejemplo, qué pasa con las que no traen punto). */
  readonly contextNote = input<string | null>(null);
  /** Mientras quien la abrió persiste, el diálogo no se cierra ni se reenvía. */
  readonly pending = input(false);
  /**
   * Si se cierra solo al confirmar. `true` cuando sumar es instantáneo (un
   * formulario de alta); `false` cuando quien lo abrió todavía tiene que
   * persistir y cerrar con {@link close} al terminar.
   */
  readonly closeOnConfirm = input(true);

  readonly imported = output<readonly BranchDraft[]>();
  readonly closed = output<void>();

  private readonly csv = inject(CsvExportService);
  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly columns = BRANCH_IMPORT_COLUMNS;
  protected readonly maxBytes = BRANCH_IMPORT_MAX_BYTES;
  protected readonly maxRows = BRANCH_IMPORT_MAX_ROWS;

  protected readonly files = signal<readonly File[]>([]);
  protected readonly reading = signal(false);
  protected readonly review = signal<BranchImportReview | null>(null);
  protected readonly fileError = signal<string | null>(null);

  protected readonly drafts = computed(() => {
    const review = this.review();
    return review === null ? [] : validDrafts(review);
  });
  protected readonly problems = computed(() =>
    (this.review()?.rows ?? []).flatMap((row) => (row.ok ? [] : [row])),
  );
  protected readonly notes = computed(() =>
    (this.review()?.rows ?? []).flatMap((row) =>
      row.ok && row.notes.length > 0 ? [{ line: row.line, text: row.notes.join(' ') }] : [],
    ),
  );
  protected readonly shownDrafts = computed(() => this.drafts().slice(0, ROWS_SHOWN));
  protected readonly hiddenDrafts = computed(() => Math.max(0, this.drafts().length - ROWS_SHOWN));
  protected readonly shownProblems = computed(() => this.problems().slice(0, ROWS_SHOWN));
  protected readonly hiddenProblems = computed(() => Math.max(0, this.problems().length - ROWS_SHOWN));
  protected readonly withPoint = computed(
    () => this.drafts().filter((draft) => draft.coordinates !== null).length,
  );

  protected readonly confirmLabel = computed(() => {
    const count = this.drafts().length;
    if (count === 0) {
      return this.confirmVerb();
    }
    return `${this.confirmVerb()} ${count} ${count === 1 ? 'sucursal' : 'sucursales'}`;
  });

  protected downloadTemplate(): void {
    const columns: CsvColumn<SampleRow>[] = BRANCH_IMPORT_COLUMNS.map((column) => ({
      header: column.header,
      value: (row) => row[column.field],
    }));
    this.csv.download(BRANCH_IMPORT_SAMPLE_ROWS, columns, 'plantilla-sucursales.csv');
  }

  protected reject(rejected: readonly RejectedFile[]): void {
    this.fileError.set(
      rejected.length === 0 ? null : 'Ese archivo no sirve: elegí un CSV de hasta 512 KB.',
    );
  }

  protected async choose(chosen: readonly File[]): Promise<void> {
    this.files.set(chosen);
    this.review.set(null);
    this.fileError.set(null);
    const file = chosen[0];
    if (file === undefined) {
      return;
    }
    this.reading.set(true);
    try {
      const { texto } = decodificarCsv(await file.arrayBuffer());
      this.review.set(reviewBranchCsv(texto, this.existingNames()));
    } catch (error) {
      this.fileError.set(
        error instanceof ArchivoInvalido ? error.message : 'No se pudo leer el archivo.',
      );
    } finally {
      this.reading.set(false);
    }
  }

  protected confirm(): void {
    const drafts = this.drafts();
    if (drafts.length === 0 || this.pending()) {
      return;
    }
    this.imported.emit(drafts);
    if (this.closeOnConfirm()) {
      this.close();
    }
  }

  /** Lo cierra quien lo abrió, cuando terminó de usar las sucursales. */
  close(): void {
    this.dialog().close(true);
  }
}
