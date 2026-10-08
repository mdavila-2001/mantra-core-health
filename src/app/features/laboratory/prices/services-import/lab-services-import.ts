import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { forkJoin } from 'rxjs';

import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import type {
  LabImportOutcome,
  LabImportResult,
  LabImportRow,
} from '../../../../core/data-access/lab-portal/lab-portal.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import {
  FileInput,
  type RejectedFile,
} from '../../../../shared/components/molecules/file-input/file-input';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { CsvExportService, type CsvColumn } from '../../../../shared/utils/csv-export/csv-export';
import { ArchivoInvalido, decodificarCsv } from '../../../../shared/utils/csv-import/csv-import';
import {
  LAB_IMPORT_COLUMNS,
  LAB_IMPORT_MAX_BYTES,
  LAB_IMPORT_MAX_ROWS,
  LAB_IMPORT_SAMPLE_ROWS,
  LAB_IMPORT_TEMPLATE_NAME,
  reviewLabServicesCsv,
  validImportRows,
  type LabImportContext,
  type LabImportReview,
  type LabImportSampleRow,
} from './lab-services-import.rules';

/** Una fila del archivo que no se manda, con lo que hay que corregir. */
interface ProblemRow {
  readonly line: number;
  readonly code: string;
  readonly name: string;
  readonly reason: string;
}

/** Una fila del resultado de la API, con el nombre que traía el archivo. */
interface ResultRow {
  readonly line: number;
  readonly code: string;
  readonly name: string;
  readonly outcome: LabImportOutcome;
  readonly reason: string;
}

const OUTCOME_LABEL: Readonly<Record<LabImportOutcome, string>> = {
  CREATED: 'Creado',
  UPDATED: 'Actualizado',
  UNCHANGED: 'Sin cambios',
  REJECTED: 'Rechazado',
};

const OUTCOME_TONE: Readonly<Record<LabImportOutcome, BadgeVariant>> = {
  CREATED: 'success',
  UPDATED: 'info',
  UNCHANGED: 'secondary',
  REJECTED: 'error',
};

/**
 * **Importar análisis (CSV)**: el laboratorio sube su lista de servicios y
 * precios de una vez (registro de procesos 4.2).
 *
 * 1. Dice qué columnas lee y ofrece la plantilla.
 * 2. Revisa el archivo en el navegador, **sin mandar nada**: cuántos son
 *    nuevos, cuántos actualizan uno que ya existe y qué filas hay que corregir.
 * 3. «Cargar N análisis» manda sólo las filas válidas a
 *    `POST /diagnostics/lab/services/import` en modo `CREATE_OR_UPDATE`.
 * 4. Muestra lo que respondió la API fila por fila. La API es la autoridad: lo
 *    que rechace se ve acá con su motivo, aunque la revisión lo haya dejado
 *    pasar.
 *
 * Al cerrarse emite `closed` con `true` si la API respondió a alguna carga, para que
 * la página relea la lista de precios.
 */
@Component({
  selector: 'app-lab-services-import',
  imports: [Alert, AppButton, Badge, ContentDialog, DataTable, FileInput, ViewStateHost],
  templateUrl: './lab-services-import.html',
  styleUrl: './lab-services-import.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabServicesImport {
  /** `true` si se llegó a importar algo: quien lo abrió relee su lista. */
  readonly closed = output<boolean>();

  private readonly lab = inject(LabPortalClient);
  private readonly csv = inject(CsvExportService);
  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly columnsHelp = LAB_IMPORT_COLUMNS;
  protected readonly maxBytes = LAB_IMPORT_MAX_BYTES;
  protected readonly maxRows = LAB_IMPORT_MAX_ROWS;

  /** El catálogo y las categorías actuales, para revisar el archivo. */
  protected readonly context = signal<ViewState<LabImportContext>>(loading());
  protected readonly files = signal<readonly File[]>([]);
  protected readonly reading = signal(false);
  protected readonly review = signal<LabImportReview | null>(null);
  protected readonly fileError = signal<string | null>(null);
  /** `null` mientras no se mandó nada. */
  protected readonly upload = signal<ViewState<LabImportResult> | null>(null);
  /** Lo último que se mandó: «Reintentar» lo vuelve a mandar igual. */
  private sent: readonly LabImportRow[] = [];
  private names = new Map<number, string>();
  /** Si la API respondió a alguna carga desde que se abrió. */
  private imported = false;

  protected readonly categoryNames = computed(() => {
    const state = this.context();
    return state.status === 'ready' ? state.data.categories.map((c) => c.name) : [];
  });

  protected readonly validRows = computed(() => {
    const review = this.review();
    return review === null ? [] : validImportRows(review);
  });
  protected readonly newCount = computed(
    () => (this.review()?.rows ?? []).filter((row) => row.ok && !row.existing).length,
  );
  protected readonly updateCount = computed(
    () => (this.review()?.rows ?? []).filter((row) => row.ok && row.existing).length,
  );
  protected readonly problems = computed<readonly ProblemRow[]>(() =>
    (this.review()?.rows ?? []).flatMap((row) =>
      row.ok ? [] : [{ line: row.line, code: row.code, name: row.name, reason: row.errors.join(' ') }],
    ),
  );
  protected readonly problemState = computed(() => ready(this.problems()));

  protected readonly pending = computed(() => this.upload()?.status === 'loading');
  protected readonly result = computed(() => {
    const state = this.upload();
    return state?.status === 'ready' ? state.data : null;
  });
  /** Un fallo de la petición entera (S4, S5, S8, S9), no de una fila. */
  protected readonly uploadError = computed(() => {
    const state = this.upload();
    return state === null || state.status === 'loading' || state.status === 'ready' ? null : state;
  });
  protected readonly resultState = computed<ViewState<readonly ResultRow[]>>(() =>
    ready(
      (this.result()?.rows ?? []).map((row) => ({
        line: row.line,
        code: row.code,
        name: this.names.get(row.line) ?? '',
        outcome: row.outcome,
        reason: row.reason ?? '',
      })),
    ),
  );

  protected readonly confirmLabel = computed(() => {
    const count = this.validRows().length;
    if (count === 0) {
      return 'Cargar análisis';
    }
    return count === 1 ? 'Cargar 1 análisis' : `Cargar ${count} análisis`;
  });

  private readonly outcomeCell =
    viewChild.required<TemplateRef<{ $implicit: ResultRow }>>('outcomeCell');

  protected readonly problemColumns: readonly ColumnDef<ProblemRow>[] = [
    { key: 'line', header: 'Línea', priority: 1, align: 'end' },
    { key: 'code', header: 'Código', priority: 1 },
    { key: 'name', header: 'Nombre', priority: 2 },
    { key: 'reason', header: 'Qué corregir', priority: 1 },
  ];

  protected readonly resultColumns = computed<readonly ColumnDef<ResultRow>[]>(() => [
    { key: 'line', header: 'Línea', priority: 1, align: 'end' },
    { key: 'code', header: 'Código', priority: 1 },
    { key: 'name', header: 'Análisis', priority: 2 },
    { key: 'outcome', header: 'Resultado', priority: 1, cell: this.outcomeCell() },
    { key: 'reason', header: 'Motivo', priority: 2 },
  ]);

  protected readonly lineOf = (row: { line: number }): string => String(row.line);
  protected outcomeLabel(outcome: LabImportOutcome): string {
    return OUTCOME_LABEL[outcome];
  }

  protected outcomeTone(outcome: LabImportOutcome): BadgeVariant {
    return OUTCOME_TONE[outcome];
  }

  constructor() {
    this.loadContext();
  }

  protected loadContext(): void {
    this.context.set(loading());
    forkJoin([this.lab.listServices(), this.lab.listCategories()]).subscribe({
      next: ([services, categories]) =>
        this.context.set(
          ready({
            existingCodes: services.items.map((service) => service.code),
            categories: categories.items,
          }),
        ),
      error: (error: unknown) => this.context.set(errorToViewState<LabImportContext>(error)),
    });
  }

  protected downloadTemplate(): void {
    const columns: CsvColumn<LabImportSampleRow>[] = LAB_IMPORT_COLUMNS.map((column) => ({
      header: column.header,
      value: (row) => row[column.field],
    }));
    this.csv.download(LAB_IMPORT_SAMPLE_ROWS, columns, LAB_IMPORT_TEMPLATE_NAME);
  }

  protected reject(rejected: readonly RejectedFile[]): void {
    this.fileError.set(
      rejected.length === 0 ? null : 'Ese archivo no sirve: elija un CSV de hasta 1 MB.',
    );
  }

  protected async choose(chosen: readonly File[]): Promise<void> {
    this.files.set(chosen);
    this.review.set(null);
    this.fileError.set(null);
    this.upload.set(null);
    const file = chosen[0];
    const context = this.context();
    if (file === undefined || context.status !== 'ready') {
      return;
    }
    this.reading.set(true);
    try {
      const { texto } = decodificarCsv(await file.arrayBuffer());
      this.review.set(reviewLabServicesCsv(texto, context.data));
    } catch (error) {
      this.fileError.set(
        error instanceof ArchivoInvalido ? error.message : 'No se pudo leer el archivo.',
      );
    } finally {
      this.reading.set(false);
    }
  }

  protected confirm(): void {
    const review = this.review();
    const rows = this.validRows();
    if (review === null || rows.length === 0 || this.pending()) {
      return;
    }
    this.names = new Map(review.rows.map((row) => [row.line, row.name]));
    this.sent = rows;
    this.send();
  }

  protected send(): void {
    if (this.sent.length === 0 || this.pending()) {
      return;
    }
    this.upload.set(loading());
    this.lab.importServices('CREATE_OR_UPDATE', this.sent).subscribe({
      next: (result) => {
        this.imported = true;
        this.upload.set(ready(result));
      },
      error: (error: unknown) => this.upload.set(errorToViewState<LabImportResult>(error)),
    });
  }

  /** Vuelve al paso del archivo, para subir otro. */
  protected again(): void {
    this.files.set([]);
    this.review.set(null);
    this.fileError.set(null);
    this.upload.set(null);
    this.sent = [];
    // El catálogo cambió: lo nuevo ya cuenta como «se actualiza».
    this.loadContext();
  }

  protected finish(): void {
    this.dialog().close(true);
  }

  protected onClosed(): void {
    this.closed.emit(this.imported);
  }
}
