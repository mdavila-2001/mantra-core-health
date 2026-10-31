import {
  booleanAttribute,
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
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, map, of, type Subscription } from 'rxjs';

import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Progress } from '../../../shared/components/atoms/progress/progress';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import {
  FileInput,
  type RejectedFile,
} from '../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Stepper } from '../../../shared/components/molecules/stepper/stepper';
import type { StepperStep } from '../../../shared/components/molecules/stepper/stepper.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { CsvExportService, type CsvColumn } from '../../../shared/utils/csv-export/csv-export';

import { PharmacyBulkClient } from '../../../core/data-access/pharmacy/pharmacy-bulk.client';
import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import {
  ArchivoInvalido,
  FILE_MAX_BYTES,
  CATEGORIES,
  CSV_COLUMNS,
  FIELD_LABELS,
  EXAMPLE_ROWS,
  MAX_ROWS_BY_LOAD,
  decodificarCsv,
  readCsv,
  reviewLoad,
  type ProductFields,
  type CodificacionDelCsv,
  type CsvColumnMapping,
  type ReviewedRow,
  type CsvReading,
  type LoadMode,
} from '../catalog-rules/catalog.rules';
import { PharmacyScope } from '../pharmacy-scope';
import {
  OUTCOME_BADGE,
  bulkFailureMessage,
  countOutcomes,
  nameOfFields,
  productResultRows,
  sendProducts,
  type FileRowResult,
  type ResultRow,
  type RowOutcome,
} from './bulk-publish';

/** Tope del catálogo que se relee para comparar códigos: el máximo de `GET /pharmacy/products`. */
const CATALOG_READ_LIMIT = 500;

/** A dónde lleva «Ver productos» al terminar. */
const CATALOG_ROUTE = '/administration/pharmacy-catalog';

/**
 * Los pasos internos de la pantalla. Son cinco porque «publicando» es el paso 4
 * del recorrido visible mientras la carga está en curso: el indicador muestra
 * cuatro (subir, asignar columnas, revisar, resultado).
 */
type ImportStep = 'file' | 'columns' | 'review' | 'publishing' | 'result';

/** El orden del recorrido visible, con el rótulo de cada paso. */
const VISIBLE_STEPS: readonly { readonly label: string; readonly steps: readonly ImportStep[] }[] = [
  { label: 'Subir archivo', steps: ['file'] },
  { label: 'Asignar columnas', steps: ['columns'] },
  { label: 'Revisar datos', steps: ['review'] },
  { label: 'Resultado', steps: ['publishing', 'result'] },
];

/** Una fila que no se mandó, con lo que la tabla de revisión muestra. */
interface RowWithProblem {
  readonly number: number;
  readonly code: string;
  readonly name: string;
  readonly problem: string;
}

/** La vista previa del servidor (`dryRun`) de las filas listas. */
type ServerPreview =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'ready'; readonly results: readonly FileRowResult[] }
  | { readonly status: 'failed'; readonly message: string };

const MODE_OPTIONS: readonly SelectOption<LoadMode>[] = [
  { value: 'CREAR_Y_ACTUALIZAR', label: 'Crear y actualizar' },
  { value: 'SOLO_CREAR', label: 'Sólo crear' },
  { value: 'SOLO_ACTUALIZAR', label: 'Sólo actualizar' },
];

const MODE_HINTS: Readonly<Record<LoadMode, string>> = {
  CREAR_Y_ACTUALIZAR:
    'Los códigos nuevos se crean y los que ya están en su catálogo se actualizan con lo que traiga el archivo.',
  SOLO_CREAR: 'Sólo se crean los códigos nuevos; los que ya están en su catálogo se rechazan.',
  SOLO_ACTUALIZAR:
    'Sólo se actualizan los productos que ya están en su catálogo; los códigos nuevos se rechazan.',
};

/**
 * **Importación masiva** del catálogo de la farmacia: un CSV con una fila por
 * producto, en cuatro pasos —subir el archivo, asignar columnas, revisar los
 * datos y ver el resultado— dentro de UNA tarjeta centrada y a lo ancho
 * (composition-rules §5).
 *
 * ## Contra qué habla
 *
 Con la carga masiva, `POST /pharmacies/:id/products/bulk` ({@link sendProducts}),
 * en lotes de 250 y en serie: «Revisar datos» pide la vista previa (`dryRun`) y
 * «Cargar» manda lo mismo sin ella. Ninguna llamada por fila. La revisión local
 * relee el catálogo con `managed: true` (con borradores y retirados, que también
 * reservan el código) para saber qué fila es un alta y cuál un cambio.
 *
 * ## El modo, las categorías y la farmacia
 *
 * Cada modo lo describe `MODE_HINTS`. Las categorías son de cada farmacia
 * (`GET /pharmacies/:id/categories`): se cargan al elegir la farmacia y la
 * revisión valida contra ellas; hasta que llegan no se puede subir el archivo,
 * porque revisar contra otra lista daría errores falsos. La farmacia la elige
 * {@link PharmacyScope}: con una sola queda elegida sola.
 *
 * Es la pestaña «Importación» de `PharmacyCatalogHub` (`embedded`).
 */
@Component({
  selector: 'app-pharmacy-import',
  imports: [
    Alert,
    AppButton,
    Badge,
    DataTable,
    DecimalPipe,
    FileInput,
    FormField,
    PageHeader,
    Progress,
    Select,
    Stepper,
    ViewStateHost,
  ],
  providers: [PharmacyScope],
  templateUrl: './pharmacy-import.html',
  styleUrl: './pharmacy-import.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class PharmacyImport {
  /** Montada como pestaña de «Catálogo»: el membrete lo pone el contenedor. */
  readonly embedded = input(false, { transform: booleanAttribute });

  protected readonly scope = inject(PharmacyScope);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly bulk = inject(PharmacyBulkClient);
  private readonly toasts = inject(ToastService);
  private readonly csv = inject(CsvExportService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxRows = MAX_ROWS_BY_LOAD;
  protected readonly maxBytes = FILE_MAX_BYTES;
  protected readonly modeOptions = MODE_OPTIONS;

  protected readonly pharmacyOptions = computed<readonly SelectOption<string>[]>(
    () => dataOf(this.scope.options()) ?? [],
  );

  /* ─── Categorías de la farmacia ───────────────────────────────────────── */

  /** Los nombres de las categorías de la farmacia elegida, con el estado de la carga. */
  protected readonly categories = signal<ViewState<readonly string[]>>(loading());
  private categoriesRequest: Subscription | null = null;

  /** Con las categorías sin cargar no hay contra qué revisar: se usa la lista fija sólo de relleno. */
  private readonly allowedCategories = computed<readonly string[]>(
    () => dataOf(this.categories()) ?? CATEGORIES,
  );

  protected readonly categoriesReady = computed(() => this.categories().status === 'ready');

  /* ─── El recorrido ────────────────────────────────────────────────────── */

  protected readonly mode = signal<LoadMode>('CREAR_Y_ACTUALIZAR');
  protected readonly modeHint = computed(() => MODE_HINTS[this.mode()]);
  protected readonly modeLabel = computed(
    () => MODE_OPTIONS.find((option) => option.value === this.mode())?.label ?? '',
  );

  protected readonly step = signal<ImportStep>('file');
  protected readonly files = signal<readonly File[]>([]);
  protected readonly fileName = signal('');
  protected readonly analyzing = signal(false);
  protected readonly fileError = signal<string | null>(null);
  protected readonly encoding = signal<CodificacionDelCsv>('utf-8');

  /** Lo que salió del archivo; `null` mientras no hay uno leído. */
  protected readonly reading = signal<CsvReading | null>(null);
  /** Los productos que la farmacia ya tiene, por código → id. */
  private readonly catalog = signal<ReadonlyMap<string, string>>(new Map());
  /** El catálogo pasó del tope de lectura: puede haber códigos que no se compararon. */
  protected readonly catalogTruncated = signal(false);

  /**
   * Las filas revisadas. Es derivado, no guardado: cambiar el modo con el
   * archivo ya leído recalcula la revisión sin volver a subir nada.
   */
  protected readonly reviewed = computed<readonly ReviewedRow[]>(() => {
    const reading = this.reading();
    return reading === null
      ? []
      : reviewLoad(reading.filas, this.catalog(), this.mode(), this.allowedCategories());
  });

  protected readonly mappings = computed<readonly CsvColumnMapping[]>(
    () => this.reading()?.columns ?? [],
  );
  protected readonly mappingState = computed<ViewState<readonly CsvColumnMapping[]>>(() => {
    const mappings = this.mappings();
    return mappings.length === 0 ? empty({ label: 'Elegir otro archivo' }) : ready(mappings);
  });
  protected readonly mappedCount = computed(
    () => this.mappings().filter((mapping) => mapping.field !== null).length,
  );
  protected readonly ignoredColumns = computed(() => this.reading()?.ignoradas ?? []);

  /** Los campos de Mantra que el archivo no trae. */
  protected readonly missingFields = computed<readonly string[]>(() => {
    const present = new Set(this.mappings().flatMap((mapping) => (mapping.field ? [mapping.field] : [])));
    return CSV_COLUMNS.filter((column) => !present.has(column.campo)).map(
      (column) => FIELD_LABELS[column.campo],
    );
  });

  /**
   * Sin la columna «disponible», toda fila se lee como «disponible» (vacío =
   * sí) y una actualización volvería a poner a la venta un producto marcado sin
   * stock. Se avisa en el paso de columnas.
   */
  protected readonly lacksAvailability = computed(
    () => this.reading() !== null && !this.mappings().some((mapping) => mapping.field === 'disponible'),
  );

  protected readonly readyRows = computed(() =>
    this.reviewed().flatMap((row) => (row.lista ? [row] : [])),
  );
  /** Las primeras filas listas, para ver antes de publicar que se leyeron bien. */
  protected readonly sample = computed(() => this.readyRows().slice(0, 5));
  protected readonly toUpdate = computed(
    () => this.readyRows().filter((row) => row.accion === 'ACTUALIZAR').length,
  );
  protected readonly toCreate = computed(() => this.readyRows().length - this.toUpdate());
  protected readonly withProblems = computed(() => this.reviewed().length - this.readyRows().length);
  protected readonly duplicatedInFile = computed(
    () => this.reviewed().filter((row) => !row.lista && row.motivo === 'REPETIDA_EN_EL_ARCHIVO').length,
  );
  protected readonly notInCatalog = computed(
    () => this.reviewed().filter((row) => !row.lista && row.motivo === 'NO_EN_EL_CATALOGO').length,
  );
  protected readonly alreadyInCatalog = computed(
    () => this.reviewed().filter((row) => !row.lista && row.motivo === 'YA_EN_EL_CATALOGO').length,
  );

  protected readonly problemRows = computed<ViewState<readonly RowWithProblem[]>>(() => {
    const rows = this.reviewed().flatMap((row) =>
      row.lista
        ? []
        : [
            {
              number: row.numero,
              code: row.campos.codigo.trim(),
              name: nameOfFields(row.campos),
              problem: row.errores.join(' '),
            },
          ],
    );
    return rows.length === 0 ? empty({ label: 'Todas las filas están listas' }) : ready(rows);
  });

  /** «Sólo actualizar» sobre un catálogo vacío deja todo rechazado: se dice en vez de dejar la tabla sola. */
  protected readonly nothingToLoad = computed(
    () => this.reviewed().length > 0 && this.readyRows().length === 0,
  );

  /* ─── Publicación ─────────────────────────────────────────────────────── */

  protected readonly results = signal<readonly FileRowResult[]>([]);
  protected readonly stopped = signal(false);
  protected readonly stopping = signal(false);
  protected readonly publishing = signal(false);
  /** Un error que no es de la fila (permiso, red, servidor, tamaño) y cortó la carga. */
  protected readonly generalFailure = signal<string | null>(null);
  private publication: Subscription | null = null;
  /**
   * Pedido de detenerse. Se mira **entre** lotes: el que está en vuelo termina
   * y se cuenta, porque cortarlo a mitad deja filas que quizá el servidor
   * guardó y que la pantalla no mostraría en ningún lado.
   */
  private stopRequested = false;
  private stoppedByPerson = false;
  private destroyed = false;

  protected readonly counts = computed(() => countOutcomes(this.results()));

  protected readonly progress = computed(() => {
    const total = this.readyRows().length;
    return total === 0 ? 0 : Math.round((this.results().length / total) * 100);
  });

  /** Una fila por cada fila del archivo, con lo que pasó con ella. */
  protected readonly resultRows = computed<ViewState<readonly ResultRow[]>>(() => {
    const rows = productResultRows(this.reviewed(), this.results());
    return rows.length === 0 ? empty({ label: 'Importar otro archivo' }) : ready(rows);
  });

  /* ─── Vista previa del servidor ───────────────────────────────────────── */

  protected readonly serverPreview = signal<ServerPreview>({ status: 'idle' });
  private previewRequest: Subscription | null = null;
  protected readonly previewFailure = computed(() => {
    const preview = this.serverPreview();
    return preview.status === 'failed' ? preview.message : '';
  });
  protected readonly previewCounts = computed(() => {
    const preview = this.serverPreview();
    return countOutcomes(preview.status === 'ready' ? preview.results : []);
  });
  /** Las filas listas que el servidor rechazaría, con su motivo. */
  protected readonly previewRejected = computed<ViewState<readonly ResultRow[]>>(() => {
    const preview = this.serverPreview();
    const rejected = preview.status === 'ready' ? preview.results.filter((r) => r.outcome === 'REJECTED') : [];
    const rows = productResultRows(this.reviewed(), rejected).filter((row) => row.outcome === 'REJECTED');
    return rows.length === 0 ? empty({ label: 'Cargar' }) : ready(rows);
  });
  /** Cuántas filas se cargarían con un aviso (p. ej. «pide receta y no tiene medicamento»). */
  protected readonly previewWarned = computed(() => {
    const preview = this.serverPreview();
    return preview.status === 'ready'
      ? preview.results.filter((r) => r.outcome !== 'REJECTED' && r.message !== '').length
      : 0;
  });

  protected readonly steps = computed<readonly StepperStep[]>(() => {
    const current = VISIBLE_STEPS.findIndex((visible) => visible.steps.includes(this.step()));
    return VISIBLE_STEPS.map((visible, index) => ({
      label: visible.label,
      status: index < current ? 'complete' : index === current ? 'current' : 'upcoming',
    }));
  });

  /* ─── Tablas ──────────────────────────────────────────────────────────── */

  private readonly mappingHeaderCell =
    viewChild.required<TemplateRef<{ $implicit: CsvColumnMapping }>>('mappingHeaderCell');
  private readonly mappingFieldCell =
    viewChild.required<TemplateRef<{ $implicit: CsvColumnMapping }>>('mappingFieldCell');
  private readonly mappingStatusCell =
    viewChild.required<TemplateRef<{ $implicit: CsvColumnMapping }>>('mappingStatusCell');
  private readonly problemRowCell =
    viewChild.required<TemplateRef<{ $implicit: RowWithProblem }>>('problemRowCell');
  private readonly problemMessageCell =
    viewChild.required<TemplateRef<{ $implicit: RowWithProblem }>>('problemMessageCell');
  private readonly outcomeCell =
    viewChild.required<TemplateRef<{ $implicit: ResultRow }>>('outcomeCell');
  private readonly resultMessageCell =
    viewChild.required<TemplateRef<{ $implicit: ResultRow }>>('resultMessageCell');

  protected readonly mappingColumns = computed<readonly ColumnDef<CsvColumnMapping>[]>(() => [
    { key: 'header', header: 'Columna del archivo', priority: 1, cell: this.mappingHeaderCell() },
    { key: 'field', header: 'Campo de Mantra', priority: 1, cell: this.mappingFieldCell() },
    { key: 'status', header: 'Qué pasa', priority: 1, cell: this.mappingStatusCell() },
  ]);

  protected readonly problemColumns = computed<readonly ColumnDef<RowWithProblem>[]>(() => [
    { key: 'row', header: 'Línea', priority: 1, cell: this.problemRowCell() },
    { key: 'code', header: 'Código', priority: 2 },
    { key: 'name', header: 'Producto', priority: 3 },
    { key: 'problem', header: 'Qué corregir', priority: 1, cell: this.problemMessageCell() },
  ]);

  protected readonly resultColumns = computed<readonly ColumnDef<ResultRow>[]>(() => [
    { key: 'number', header: 'Línea', priority: 1 },
    { key: 'code', header: 'Código', priority: 2 },
    { key: 'name', header: 'Producto', priority: 3 },
    { key: 'outcome', header: 'Resultado', priority: 1, cell: this.outcomeCell() },
    { key: 'message', header: 'Respuesta', priority: 2, cell: this.resultMessageCell() },
  ]);

  protected readonly mappingKey = (mapping: CsvColumnMapping): string => mapping.header;
  protected readonly problemKey = (row: RowWithProblem): string => String(row.number);
  protected readonly resultKey = (row: ResultRow): string => String(row.number);

  /* ─── Lo que la plantilla del archivo y la ayuda necesitan ────────────── */

  /** Las columnas de la ayuda; la categoría dice las de **esta** farmacia. */
  protected readonly csvColumns = computed(() => {
    const categories = dataOf(this.categories());
    return CSV_COLUMNS.map((column) =>
      column.campo !== 'categoria' || categories === null
        ? column
        : {
            ...column,
            descripcion:
              categories.length === 0
                ? 'Su farmacia todavía no tiene categorías: déjela vacía.'
                : `Una de las suyas: ${categories.join(' · ')}.`,
          },
    );
  });

  /**
   * Las filas de ejemplo de la plantilla. Su categoría es la primera de la
   * farmacia (o ninguna): con la de siempre, la plantilla bajada y subida tal
   * cual se rechazaría en una farmacia que no la tiene.
   */
  private readonly templateRows = computed<readonly ProductFields[]>(() => {
    const first = dataOf(this.categories())?.[0] ?? '';
    return EXAMPLE_ROWS.map((row) => ({ ...row, categoria: first }));
  });

  protected readonly fieldLabel = (field: keyof ProductFields | null): string =>
    field === null ? '—' : FIELD_LABELS[field];

  constructor() {
    // Cada vez que cambia la farmacia —incluida la que se elige sola al
    // cargar la lista— se suelta lo que había y se cargan sus categorías.
    effect(() => {
      const pharmacyId = this.scope.pharmacyId();
      untracked(() => this.onPharmacyChanged(pharmacyId));
    });
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.categoriesRequest?.unsubscribe();
      this.previewRequest?.unsubscribe();
      // Salir de la pantalla no corta un lote a mitad: la carga se detiene
      // entre lotes y, al terminar, un aviso dice cuántas se publicaron.
      this.stopRequested = true;
    });
  }

  /** Cerrar o recargar la pestaña con una carga en curso pide confirmación. */
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.publishing()) {
      event.preventDefault();
    }
  }

  /* ─── Farmacia y categorías ───────────────────────────────────────────── */

  protected choosePharmacy(id: string | null): void {
    // Con una carga en curso el selector está deshabilitado; esto es la red.
    if (this.publishing()) {
      return;
    }
    this.scope.choose(id);
  }

  private onPharmacyChanged(pharmacyId: string | null): void {
    this.reset();
    this.categoriesRequest?.unsubscribe();
    this.categories.set(loading());
    if (pharmacyId !== null) {
      this.loadCategories(pharmacyId);
    }
  }

  protected loadCategories(pharmacyId: string | null = this.scope.pharmacyId()): void {
    if (pharmacyId === null) {
      return;
    }
    this.categoriesRequest?.unsubscribe();
    this.categories.set(loading());
    this.categoriesRequest = this.pharmacy.listCategories(pharmacyId).subscribe({
      next: (page) => this.categories.set(ready(page.items.map((category) => category.name))),
      error: (error: unknown) =>
        this.categories.set(errorToViewState<readonly string[]>(error)),
    });
  }

  /* ─── Paso 1: el archivo ──────────────────────────────────────────────── */

  protected downloadTemplate(): void {
    this.csv.download(this.templateRows(), templateColumns(), 'plantilla-catalogo-farmacia.csv');
  }

  protected showRejection(rejections: readonly RejectedFile[]): void {
    const first = rejections[0];
    if (first === undefined) {
      return;
    }
    this.fileError.set(
      first.reason === 'tamaño'
        ? 'El archivo pasa de 1 MB. Divídalo en varios.'
        : 'Suba un archivo .csv (en Excel: Guardar como → CSV UTF-8).',
    );
  }

  protected setMode(mode: LoadMode | null): void {
    this.mode.set(mode ?? 'CREAR_Y_ACTUALIZAR');
    if (this.step() === 'review') {
      this.requestPreview();
    }
  }

  protected async onFilesChange(files: readonly File[]): Promise<void> {
    this.files.set(files);
    const file = files[0];
    const pharmacyId = this.scope.pharmacyId();
    if (file === undefined) {
      this.clearReading();
      return;
    }
    if (pharmacyId === null || !this.categoriesReady()) {
      return;
    }
    this.fileError.set(null);
    this.reading.set(null);
    this.analyzing.set(true);
    this.fileName.set(file.name);

    const bytes = await file.arrayBuffer();
    if (this.isStale(pharmacyId, file)) {
      return;
    }
    const { texto, codificacion } = decodificarCsv(bytes);
    this.encoding.set(codificacion);

    let reading: CsvReading;
    try {
      reading = readCsv(texto);
    } catch (error: unknown) {
      this.analyzing.set(false);
      this.fileError.set(
        error instanceof ArchivoInvalido ? error.message : 'No se pudo leer el archivo.',
      );
      return;
    }

    // Los códigos se comparan contra el catálogo **releído ahora**, completo
    // (`managed`: con borradores y retirados, que también reservan el código).
    this.pharmacy
      .searchProducts({ pharmacyId, managed: true, limit: CATALOG_READ_LIMIT })
      .pipe(
        map((page) => ({
          catalog: {
            codes: new Map(page.items.map((product) => [product.productCode, product.id] as const)),
            truncated: page.truncated,
          },
          failed: false,
        })),
        catchError(() =>
          of({ catalog: { codes: new Map<string, string>(), truncated: false }, failed: true }),
        ),
      )
      .subscribe(({ catalog, failed }) => {
        // Se cambió de farmacia o de archivo mientras se releía: este análisis
        // ya no es de la pantalla que se está mirando.
        if (this.isStale(pharmacyId, file)) {
          return;
        }
        this.analyzing.set(false);
        if (failed) {
          // Sin catálogo no hay qué comparar, y en «sólo actualizar» todas las
          // filas saldrían «no está»: mejor no seguir que mostrar eso.
          this.fileError.set(
            'No pudimos leer su catálogo para comparar los códigos. Pruebe de nuevo en un momento.',
          );
          return;
        }
        this.catalog.set(catalog.codes);
        this.catalogTruncated.set(catalog.truncated);
        this.reading.set(reading);
        this.step.set('columns');
      });
  }

  private isStale(pharmacyId: string, file: File): boolean {
    return this.scope.pharmacyId() !== pharmacyId || this.files()[0] !== file;
  }

  private clearReading(): void {
    this.reading.set(null);
    this.fileName.set('');
    this.fileError.set(null);
    this.analyzing.set(false);
    this.encoding.set('utf-8');
  }

  /* ─── Navegación entre pasos ──────────────────────────────────────────── */

  protected goTo(step: 'file' | 'columns' | 'review'): void {
    if (!this.publishing()) {
      this.step.set(step);
      if (step === 'review') {
        this.requestPreview();
      }
    }
  }

  /**
   * Pide al servidor qué pasaría con cada fila lista (`dryRun`: no escribe
   * nada). Se repite al cambiar el modo; una vista previa vieja se descarta.
   */
  protected requestPreview(): void {
    const pharmacyId = this.scope.pharmacyId();
    const rows = this.readyRows();
    this.previewRequest?.unsubscribe();
    if (pharmacyId === null || rows.length === 0) {
      this.serverPreview.set({ status: 'idle' });
      return;
    }
    this.serverPreview.set({ status: 'loading' });
    this.previewRequest = sendProducts(this.bulk, pharmacyId, this.mode(), rows, { dryRun: true })
      .subscribe({
        next: (results) => this.serverPreview.set({ status: 'ready', results }),
        error: (error: unknown) =>
          this.serverPreview.set({ status: 'failed', message: bulkFailureMessage(error) }),
      });
  }

  /* ─── Paso 4: publicar ────────────────────────────────────────────────── */

  protected publish(): void {
    const pharmacyId = this.scope.pharmacyId();
    const rows = this.readyRows();
    // Un doble clic no lanza dos cargas.
    if (pharmacyId === null || rows.length === 0 || this.publication !== null) {
      return;
    }
    this.results.set([]);
    this.stopped.set(false);
    this.generalFailure.set(null);
    this.stopRequested = false;
    this.stoppedByPerson = false;
    this.publishing.set(true);
    this.step.set('publishing');

    this.publication = sendProducts(this.bulk, pharmacyId, this.mode(), rows, {
      proceed: () => !this.stopRequested,
    }).subscribe({
      next: (results) => this.results.set(results),
      error: (error: unknown) => {
        this.generalFailure.set(bulkFailureMessage(error));
        this.finish();
      },
      complete: () => this.finish(),
    });
  }

  protected stop(): void {
    this.stopRequested = true;
    this.stoppedByPerson = true;
    this.stopping.set(true);
  }

  private finish(): void {
    this.publication = null;
    this.publishing.set(false);
    this.stopping.set(false);
    const published = this.counts().created + this.counts().updated;
    if (this.destroyed) {
      // La persona se fue de la pantalla: lo que se alcanzó a publicar se dice
      // igual, porque nadie va a ver el paso «Resultado».
      if (published > 0) {
        this.toasts.info(
          `La importación se detuvo al salir: ${published} de ${this.readyRows().length} productos quedaron cargados.`,
        );
      }
      return;
    }
    this.stopped.set(this.stoppedByPerson);
    this.step.set('result');
  }

  /* ─── Resultado ───────────────────────────────────────────────────────── */

  protected downloadProblems(): void {
    const rows = [
      ...this.reviewed().flatMap((row) =>
        row.lista ? [] : [{ campos: row.campos, problema: row.errores.join(' ') }],
      ),
      ...this.results().flatMap((result) => {
        if (result.outcome !== 'REJECTED') {
          return [];
        }
        const row = this.reviewed().find((reviewed) => reviewed.numero === result.number);
        return row === undefined ? [] : [{ campos: row.campos, problema: result.message }];
      }),
    ];
    const columns: CsvColumn<{ campos: ProductFields; problema: string }>[] = [
      ...CSV_COLUMNS.map((column) => ({
        header: column.encabezado,
        value: (row: { campos: ProductFields }) => row.campos[column.campo] ?? '',
      })),
      { header: 'problema', value: (row) => row.problema },
    ];
    this.csv.download(rows, columns, 'catalogo-filas-a-corregir.csv');
  }

  protected viewProducts(): void {
    void this.router.navigateByUrl(CATALOG_ROUTE);
  }

  protected startOver(): void {
    this.reset();
  }

  protected badgeOf(outcome: RowOutcome): (typeof OUTCOME_BADGE)[RowOutcome] {
    return OUTCOME_BADGE[outcome];
  }

  private reset(): void {
    // Con una carga en curso no se ofrece reiniciar; si igual llega acá, se
    // detiene entre lotes y el resultado queda a la vista.
    if (this.publication !== null) {
      this.stopRequested = true;
      return;
    }
    this.step.set('file');
    this.files.set([]);
    this.clearReading();
    this.catalog.set(new Map());
    this.catalogTruncated.set(false);
    this.results.set([]);
    this.stopped.set(false);
    this.generalFailure.set(null);
    this.previewRequest?.unsubscribe();
    this.serverPreview.set({ status: 'idle' });
  }
}

/** Las columnas de la plantilla: el encabezado canónico de cada una. */
function templateColumns(): CsvColumn<ProductFields>[] {
  return CSV_COLUMNS.map((column) => ({
    header: column.encabezado,
    value: (row: ProductFields) => row[column.campo] ?? '',
  }));
}
