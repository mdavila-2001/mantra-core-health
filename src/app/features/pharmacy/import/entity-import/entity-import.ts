import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { Router } from '@angular/router';
import type { Subscription } from 'rxjs';

import { PharmacyBulkClient } from '../../../../core/data-access/pharmacy/pharmacy-bulk.client';
import type { BulkMode } from '../../../../core/data-access/pharmacy/pharmacy-bulk.types';
import { empty, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FileInput, type RejectedFile } from '../../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { CsvExportService } from '../../../../shared/utils/csv-export/csv-export';
import { ArchivoInvalido, FILE_MAX_BYTES, decodificarCsv } from '../../catalog-rules/catalog.rules';
import { PharmacyScope } from '../../pharmacy-scope';
import {
  OUTCOME_BADGE,
  bulkFailureMessage,
  countOutcomes,
  toFileRows,
  type FileRowResult,
  type ResultRow,
  type RowOutcome,
} from '../bulk-publish';
import {
  ENTITY_COLUMNS,
  ENTITY_TEMPLATE_FILENAME,
  ENTITY_TEMPLATE_ROWS,
  readEntityCsv,
  type EntityCsvReading,
  type ImportEntity,
} from './entity-csv';

/** Dónde está el paso que sigue: la carga sin escribir, la escrita y su resultado. */
type Phase = 'file' | 'previewing' | 'preview' | 'applying' | 'result';

const MODE_OPTIONS: readonly SelectOption<BulkMode>[] = [
  { value: 'UPSERT', label: 'Crear y actualizar' },
  { value: 'CREATE', label: 'Sólo crear' },
  { value: 'UPDATE', label: 'Sólo actualizar' },
];

const MODE_HINTS: Readonly<Record<BulkMode, string>> = {
  UPSERT: 'Lo nuevo se crea y lo que ya existe se actualiza con lo que traiga el archivo.',
  CREATE: 'Sólo se crea lo nuevo; lo que ya existe se rechaza.',
  UPDATE: 'Sólo se actualiza lo que ya existe; lo nuevo se rechaza.',
};

/** Lo que cambia de una entidad a otra en la pantalla. */
interface EntityCopy {
  readonly title: string;
  readonly keyHeader: string;
  readonly note: string;
  readonly done: { readonly label: string; readonly url: string };
}

const COPY: Readonly<Record<ImportEntity, EntityCopy>> = {
  categories: {
    title: 'Suba su archivo de categorías',
    keyHeader: 'Categoría',
    note: 'Las categorías se reconocen por el nombre sin mayúsculas ni tildes: «analgesicos» renombra a «Analgésicos».',
    done: { label: 'Ver categorías', url: '/administration/pharmacy-catalog?tab=categories' },
  },
  prices: {
    title: 'Suba su archivo de precios',
    keyHeader: 'Código',
    note: 'Cambia el precio de venta vigente de cada producto de su catálogo. El mismo importe queda sin cambios.',
    done: { label: 'Ver precios', url: '/administration/pharmacy-catalog?tab=prices' },
  },
  sites: {
    title: 'Suba su archivo de sucursales',
    keyHeader: 'Código',
    note: 'Se crean como sedes de venta de su farmacia: aparecen en «Horario y turnos» y en «Dónde comprar», no en la pantalla «Sucursales» de su organización.',
    done: { label: 'Ver horario y turnos', url: '/administration/pharmacy-hours' },
  },
};

/**
 * **Importación de categorías, precios o sucursales** con un CSV, por la carga
 * masiva de la API (`POST /pharmacies/:id/{entity}/bulk`): plantilla para
 * descargar, el archivo, el modo, la vista previa del servidor (`dryRun`, no
 * escribe nada), «Aplicar» y el resultado fila por fila.
 *
 * Se manda en lotes de 250, en serie. Un fallo que no es de una fila —sin
 * permiso, la farmacia no activa, sin red, un lote de más de 1 MB— se dice en
 * pantalla; lo que ya se aplicó queda contado.
 */
@Component({
  selector: 'app-entity-import',
  imports: [Alert, AppButton, Badge, Card, DataTable, FileInput, FormField, Select, ViewStateHost],
  providers: [PharmacyScope],
  templateUrl: './entity-import.html',
  styleUrl: './entity-import.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityImport {
  readonly entity = input.required<ImportEntity>();

  protected readonly scope = inject(PharmacyScope);
  private readonly bulk = inject(PharmacyBulkClient);
  private readonly csv = inject(CsvExportService);
  private readonly router = inject(Router);

  protected readonly maxBytes = FILE_MAX_BYTES;
  protected readonly modeOptions = MODE_OPTIONS;
  protected readonly copy = computed(() => COPY[this.entity()]);
  protected readonly columns = computed(() => ENTITY_COLUMNS[this.entity()]);

  protected readonly mode = signal<BulkMode>('UPSERT');
  protected readonly modeHint = computed(() => MODE_HINTS[this.mode()]);
  protected readonly phase = signal<Phase>('file');
  protected readonly files = signal<readonly File[]>([]);
  protected readonly fileName = signal('');
  protected readonly fileError = signal<string | null>(null);
  protected readonly reading = signal<EntityCsvReading | null>(null);
  /** Lo que contestó el servidor: la vista previa o la carga escrita. */
  protected readonly results = signal<readonly FileRowResult[]>([]);
  /** Un fallo que no es de una fila y cortó el pedido. */
  protected readonly failure = signal<string | null>(null);
  private request: Subscription | null = null;

  /** Las filas que se pueden mandar, en el orden del archivo. */
  private readonly sendable = computed(() => (this.reading()?.rows ?? []).filter((row) => row.payload !== null));
  protected readonly sendableCount = computed(() => this.sendable().length);
  protected readonly blockedCount = computed(() => (this.reading()?.rows.length ?? 0) - this.sendableCount());
  protected readonly counts = computed(() => countOutcomes(this.results()));
  protected readonly applied = computed(() => this.phase() === 'result');

  /** Una fila por renglón del archivo con su resultado. */
  protected readonly rows = computed<ViewState<readonly ResultRow[]>>(() => {
    const byLine = new Map(this.results().map((result) => [result.number, result] as const));
    const rows = (this.reading()?.rows ?? []).map((row): ResultRow => {
      const base = { number: row.line, code: row.key || '—', name: '' };
      if (row.payload === null) {
        return { ...base, outcome: 'NOT_SENT', message: row.errors.join(' ') };
      }
      const result = byLine.get(row.line);
      return result === undefined
        ? { ...base, outcome: 'PENDING', message: 'No se envió: la carga se cortó antes.' }
        : { ...base, outcome: result.outcome, message: result.message };
    });
    return rows.length === 0 ? empty({ label: 'Elegir otro archivo' }) : ready(rows);
  });

  private readonly outcomeCell = viewChild.required<TemplateRef<{ $implicit: ResultRow }>>('outcomeCell');
  private readonly messageCell = viewChild.required<TemplateRef<{ $implicit: ResultRow }>>('messageCell');
  protected readonly tableColumns = computed<readonly ColumnDef<ResultRow>[]>(() => [
    { key: 'number', header: 'Línea', priority: 1 },
    { key: 'code', header: this.copy().keyHeader, priority: 1 },
    { key: 'outcome', header: this.applied() ? 'Resultado' : 'Qué pasaría', priority: 1, cell: this.outcomeCell() },
    // El motivo es lo que hay que corregir en el archivo: en el teléfono va en la
    // ficha de cada fila, no detrás del botón de detalle.
    { key: 'message', header: 'Motivo', priority: 1, cell: this.messageCell() },
  ]);
  protected readonly rowKey = (row: ResultRow): string => String(row.number);

  constructor() {
    effect(() => {
      this.scope.pharmacyId();
      untracked(() => this.reset());
    });
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  protected badgeOf(outcome: RowOutcome): (typeof OUTCOME_BADGE)[RowOutcome] {
    return OUTCOME_BADGE[outcome];
  }

  protected downloadTemplate(): void {
    const columns = this.columns().map((column, index) => ({
      header: column.header,
      value: (row: readonly string[]) => row[index] ?? '',
    }));
    this.csv.download(ENTITY_TEMPLATE_ROWS[this.entity()], columns, ENTITY_TEMPLATE_FILENAME[this.entity()]);
  }

  protected showRejection(rejections: readonly RejectedFile[]): void {
    const first = rejections[0];
    if (first !== undefined) {
      this.fileError.set(
        first.reason === 'tamaño'
          ? 'El archivo pasa de 1 MB. Divídalo en varios.'
          : 'Suba un archivo .csv (en Excel: Guardar como → CSV UTF-8).',
      );
    }
  }

  protected setMode(mode: BulkMode | null): void {
    this.mode.set(mode ?? 'UPSERT');
    if (this.phase() === 'preview' || this.phase() === 'previewing') {
      this.send(true);
    }
  }

  protected async onFilesChange(files: readonly File[]): Promise<void> {
    this.files.set(files);
    const file = files[0];
    this.reset(false);
    if (file === undefined) {
      return;
    }
    const bytes = await file.arrayBuffer();
    if (this.files()[0] !== file) {
      return;
    }
    try {
      this.reading.set(readEntityCsv(this.entity(), decodificarCsv(bytes).texto));
    } catch (error: unknown) {
      this.fileError.set(error instanceof ArchivoInvalido ? error.message : 'No se pudo leer el archivo.');
      return;
    }
    this.fileName.set(file.name);
    this.send(true);
  }

  /** «Aplicar»: lo mismo que la vista previa, ahora escrito. */
  protected apply(): void {
    if (this.phase() === 'preview' && this.sendableCount() > 0) {
      this.send(false);
    }
  }

  /** Manda las filas en lotes de 250, en serie; con `dryRun` el servidor no escribe nada. */
  protected send(dryRun: boolean): void {
    const pharmacyId = this.scope.pharmacyId();
    const rows = this.sendable();
    this.request?.unsubscribe();
    this.results.set([]);
    this.failure.set(null);
    if (pharmacyId === null || rows.length === 0) {
      this.phase.set(this.reading() === null ? 'file' : 'preview');
      return;
    }
    this.phase.set(dryRun ? 'previewing' : 'applying');
    const lines = rows.map((row) => row.line);
    this.request = this.bulk
      .chunked(pharmacyId, this.entity(), {
        mode: this.mode(),
        ...(dryRun ? { dryRun: true } : {}),
        rows: rows.map((row) => row.payload!),
      })
      .subscribe({
        next: (progress) => this.results.set(toFileRows(lines, progress.results)),
        error: (error: unknown) => {
          this.failure.set(bulkFailureMessage(error));
          this.phase.set(dryRun ? 'preview' : 'result');
        },
        complete: () => this.phase.set(dryRun ? 'preview' : 'result'),
      });
  }

  protected viewDone(): void {
    void this.router.navigateByUrl(this.copy().done.url);
  }

  protected reset(clearFiles = true): void {
    // Una carga escrita en vuelo no se corta: el servidor quizá ya guardó el lote.
    if (this.phase() === 'applying') {
      return;
    }
    this.request?.unsubscribe();
    if (clearFiles) {
      this.files.set([]);
    }
    this.phase.set('file');
    this.fileName.set('');
    this.fileError.set(null);
    this.reading.set(null);
    this.results.set([]);
    this.failure.set(null);
  }
}
