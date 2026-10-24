import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { EMPTY, catchError, concatMap, from, map, of, type Subscription } from 'rxjs';

import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Progress } from '../../../shared/components/atoms/progress/progress';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
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

import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacyProductDraft } from '../../../core/data-access/pharmacy/pharmacy.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import {
  ArchivoInvalido,
  BYTES_MAXIMOS_DEL_ARCHIVO,
  CATEGORIAS,
  COLUMNAS_DEL_CSV,
  ETIQUETAS_DE_CAMPO,
  FILAS_DE_EJEMPLO,
  FILAS_MAXIMAS_POR_CARGA,
  cambiosDelBorrador,
  decodificarCsv,
  leerCsv,
  revisarCarga,
  type CamposDelProducto,
  type CodificacionDelCsv,
  type CsvColumnMapping,
  type FilaRevisada,
  type LecturaDelCsv,
  type ModoDeCarga,
} from '../catalog-rules/catalogo.reglas';
import { PharmacyScope } from '../pharmacy-scope';
import { pharmacyErrorMessage } from '../pharmacy-error-message';

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

/** Cómo terminó el pedido de una fila. */
interface RowResult {
  readonly number: number;
  readonly code: string;
  readonly name: string;
  readonly published: boolean;
  /** Si fue un alta o la actualización de un producto que ya estaba. */
  readonly action: 'CREAR' | 'ACTUALIZAR';
  readonly message: string;
}

/** Una fila que no se mandó, con lo que la tabla de revisión muestra. */
interface RowWithProblem {
  readonly number: number;
  readonly code: string;
  readonly name: string;
  readonly problem: string;
}

/** Qué pasó con una fila del archivo, para la tabla del resultado. */
type RowOutcome = 'CREATED' | 'UPDATED' | 'REJECTED' | 'NOT_SENT' | 'PENDING';

interface ResultRow {
  readonly number: number;
  readonly code: string;
  readonly name: string;
  readonly outcome: RowOutcome;
  readonly message: string;
}

const OUTCOME_BADGE: Readonly<Record<RowOutcome, { variant: BadgeVariant; label: string }>> = {
  CREATED: { variant: 'success', label: 'Creado' },
  UPDATED: { variant: 'info', label: 'Actualizado' },
  REJECTED: { variant: 'error', label: 'Rechazado' },
  NOT_SENT: { variant: 'warning', label: 'No enviada' },
  PENDING: { variant: 'secondary', label: 'Sin enviar' },
};

const MODE_OPTIONS: readonly SelectOption<ModoDeCarga>[] = [
  { value: 'CREAR_Y_ACTUALIZAR', label: 'Crear y actualizar' },
  { value: 'SOLO_CREAR', label: 'Sólo crear' },
  { value: 'SOLO_ACTUALIZAR', label: 'Sólo actualizar' },
];

const MODE_HINTS: Readonly<Record<ModoDeCarga, string>> = {
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
 * No hay endpoint de importación: cada fila es el alta
 * (`POST /pharmacies/:id/products`) o la actualización
 * (`PATCH /pharmacies/:id/products/:productId`) del producto, **en serie** —una
 * farmacia con 300 productos no debe abrir 300 conexiones a la vez— con el
 * resultado de cada una a la vista. Para saber si un código ya existe se relee
 * el catálogo con `managed: true`, que lista también borradores y retirados: un
 * producto retirado sigue reservando su código.
 *
 * ## El modo
 *
 * - *Crear y actualizar*: el código nuevo se crea, el existente se actualiza.
 * - *Sólo crear*: el código existente se rechaza.
 * - *Sólo actualizar*: el código que no está en el catálogo se rechaza.
 *
 * ## Las categorías
 *
 * Son de cada farmacia (`GET /pharmacies/:id/categories`): se cargan al elegir
 * la farmacia y la revisión valida contra ellas. Hasta que llegan no se puede
 * subir el archivo, porque revisar contra otra lista daría errores falsos.
 *
 * ## De qué farmacia
 *
 * La elige {@link PharmacyScope}: con una sola queda elegida sola.
 */
@Component({
  selector: 'app-pharmacy-import',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
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
  protected readonly scope = inject(PharmacyScope);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly toasts = inject(ToastService);
  private readonly csv = inject(CsvExportService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxRows = FILAS_MAXIMAS_POR_CARGA;
  protected readonly maxBytes = BYTES_MAXIMOS_DEL_ARCHIVO;
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
    () => dataOf(this.categories()) ?? CATEGORIAS,
  );

  protected readonly categoriesReady = computed(() => this.categories().status === 'ready');

  /* ─── El recorrido ────────────────────────────────────────────────────── */

  protected readonly mode = signal<ModoDeCarga>('CREAR_Y_ACTUALIZAR');
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
  protected readonly reading = signal<LecturaDelCsv | null>(null);
  /** Los productos que la farmacia ya tiene, por código → id. */
  private readonly catalog = signal<ReadonlyMap<string, string>>(new Map());
  /** El catálogo pasó del tope de lectura: puede haber códigos que no se compararon. */
  protected readonly catalogTruncated = signal(false);

  /**
   * Las filas revisadas. Es derivado, no guardado: cambiar el modo con el
   * archivo ya leído recalcula la revisión sin volver a subir nada.
   */
  protected readonly reviewed = computed<readonly FilaRevisada[]>(() => {
    const reading = this.reading();
    return reading === null
      ? []
      : revisarCarga(reading.filas, this.catalog(), this.mode(), this.allowedCategories());
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
    return COLUMNAS_DEL_CSV.filter((column) => !present.has(column.campo)).map(
      (column) => ETIQUETAS_DE_CAMPO[column.campo],
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

  protected readonly results = signal<readonly RowResult[]>([]);
  protected readonly stopped = signal(false);
  protected readonly stopping = signal(false);
  protected readonly publishing = signal(false);
  /** Un error que no es de la fila (permiso, red, servidor) y cortó la carga. */
  protected readonly generalFailure = signal<string | null>(null);
  private publication: Subscription | null = null;
  /**
   * Pedido de detenerse. Se mira **entre** filas: la que está en vuelo termina
   * y se cuenta, porque cortarla a mitad deja una fila que quizá el servidor
   * guardó y que la pantalla no mostraría en ningún lado.
   */
  private stopRequested = false;
  private stoppedByPerson = false;
  private destroyed = false;

  protected readonly published = computed(() => this.results().filter((result) => result.published));
  protected readonly created = computed(
    () => this.published().filter((result) => result.action === 'CREAR').length,
  );
  protected readonly updated = computed(
    () => this.published().filter((result) => result.action === 'ACTUALIZAR').length,
  );
  protected readonly rejectedByApi = computed(() => this.results().length - this.published().length);

  protected readonly progress = computed(() => {
    const total = this.readyRows().length;
    return total === 0 ? 0 : Math.round((this.results().length / total) * 100);
  });

  /** Una fila por cada fila del archivo, con lo que pasó con ella. */
  protected readonly resultRows = computed<ViewState<readonly ResultRow[]>>(() => {
    const byNumber = new Map(this.results().map((result) => [result.number, result] as const));
    const rows = this.reviewed().map((row): ResultRow => {
      if (!row.lista) {
        return {
          number: row.numero,
          code: row.campos.codigo.trim(),
          name: nameOfFields(row.campos),
          outcome: 'NOT_SENT',
          message: row.errores.join(' '),
        };
      }
      const result = byNumber.get(row.numero);
      const base = { number: row.numero, code: row.borrador.productCode, name: draftName(row.borrador) };
      if (result === undefined) {
        return { ...base, outcome: 'PENDING', message: 'No se envió: la carga se detuvo antes.' };
      }
      return {
        ...base,
        outcome: result.published ? (result.action === 'CREAR' ? 'CREATED' : 'UPDATED') : 'REJECTED',
        message: result.message,
      };
    });
    return rows.length === 0 ? empty({ label: 'Importar otro archivo' }) : ready(rows);
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
    return COLUMNAS_DEL_CSV.map((column) =>
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
  private readonly templateRows = computed<readonly CamposDelProducto[]>(() => {
    const first = dataOf(this.categories())?.[0] ?? '';
    return FILAS_DE_EJEMPLO.map((row) => ({ ...row, categoria: first }));
  });

  protected readonly fieldLabel = (field: keyof CamposDelProducto | null): string =>
    field === null ? '—' : ETIQUETAS_DE_CAMPO[field];

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
      // Salir de la pantalla no corta una fila a mitad: la carga se detiene
      // entre filas y, al terminar, un aviso dice cuántas se publicaron.
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

  protected setMode(mode: ModoDeCarga | null): void {
    this.mode.set(mode ?? 'CREAR_Y_ACTUALIZAR');
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

    let reading: LecturaDelCsv;
    try {
      reading = leerCsv(texto);
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
    }
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

    this.publication = from(rows)
      .pipe(
        // En serie: una fila por vez, y la siguiente sale cuando vuelve la
        // anterior. El pedido de detenerse se mira acá, antes de cada fila.
        concatMap((row) =>
          this.stopRequested
            ? EMPTY
            : (row.accion === 'ACTUALIZAR' && row.productId !== null
                ? this.pharmacy
                    .updateProduct(pharmacyId, row.productId, cambiosDelBorrador(row.borrador, false))
                    .pipe(map(() => 'Actualizado'))
                : this.pharmacy
                    .publishProduct(pharmacyId, row.borrador)
                    .pipe(map(() => 'Publicado'))
              ).pipe(
                map(
                  (message): RowResult => ({
                    number: row.numero,
                    code: row.borrador.productCode,
                    name: draftName(row.borrador),
                    published: true,
                    action: row.accion,
                    message,
                  }),
                ),
                catchError((error: unknown) =>
                  of<RowResult>({
                    number: row.numero,
                    code: row.borrador.productCode,
                    name: draftName(row.borrador),
                    published: false,
                    action: row.accion,
                    message: this.rowRejection(error),
                  }),
                ),
              ),
        ),
      )
      .subscribe({
        next: (result) => this.results.update((list) => [...list, result]),
        complete: () => this.finish(),
      });
  }

  /**
   * El mensaje de una fila rechazada y, si el error no es de la fila, el corte.
   *
   * Un 409 o un 422 son de **esa** fila: la siguiente puede andar. Un 403, un
   * 412 de farmacia inactiva, la falta de red o un 5xx van a fallar igual en
   * todas: seguir sería mandar 500 peticiones para leer 500 veces lo mismo.
   */
  private rowRejection(error: unknown): string {
    const state = errorToViewState<never>(error);
    const message = pharmacyErrorMessage(error, 'La API rechazó la fila.');
    const belongsToRow =
      state.status === 'validation' &&
      !state.issues.some((issue) => issue.code === 'PRECONDITION_FAILED');
    if (!belongsToRow) {
      this.stopRequested = true;
      this.generalFailure.set(message);
      return message;
    }
    return state.issues.some((issue) => issue.code === 'CONFLICT')
      ? `${message} Un código retirado también sigue reservado: use otro.`
      : message;
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
    const published = this.published().length;
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
        if (result.published) {
          return [];
        }
        const row = this.reviewed().find((reviewed) => reviewed.numero === result.number);
        return row === undefined ? [] : [{ campos: row.campos, problema: result.message }];
      }),
    ];
    const columns: CsvColumn<{ campos: CamposDelProducto; problema: string }>[] = [
      ...COLUMNAS_DEL_CSV.map((column) => ({
        header: column.encabezado,
        value: (row: { campos: CamposDelProducto }) => row.campos[column.campo],
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

  protected badgeOf(outcome: RowOutcome): { variant: BadgeVariant; label: string } {
    return OUTCOME_BADGE[outcome];
  }

  private reset(): void {
    // Con una carga en curso no se ofrece reiniciar; si igual llega acá, se
    // detiene entre filas y el resultado queda a la vista.
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
  }
}

function draftName(draft: PharmacyProductDraft): string {
  return draft.brandName ?? draft.genericName ?? draft.productCode;
}

function nameOfFields(fields: CamposDelProducto): string {
  return fields.marca.trim() || fields.generico.trim() || '—';
}

/** Las columnas de la plantilla: el encabezado canónico de cada una. */
function templateColumns(): CsvColumn<CamposDelProducto>[] {
  return COLUMNAS_DEL_CSV.map((column) => ({
    header: column.encabezado,
    value: (row: CamposDelProducto) => row[column.campo],
  }));
}
