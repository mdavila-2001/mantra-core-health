import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { concatMap, from, map, of, catchError, type Subscription } from 'rxjs';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Input } from '../../../shared/components/atoms/input/input';
import { Progress } from '../../../shared/components/atoms/progress/progress';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FileInput, type RejectedFile } from '../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { Stepper } from '../../../shared/components/molecules/stepper/stepper';
import type { StepperStep } from '../../../shared/components/molecules/stepper/stepper.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { CsvExportService, type CsvColumn } from '../../../shared/utils/csv-export/csv-export';

import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type {
  PharmacyProduct,
  PharmacyProductDraft,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import {
  ArchivoInvalido,
  BYTES_MAXIMOS_DEL_ARCHIVO,
  CAMPOS_VACIOS,
  COLUMNAS_DEL_CSV,
  FILAS_DE_EJEMPLO,
  FILAS_MAXIMAS_POR_CARGA,
  LARGO_MAXIMO_DEL_CODIGO,
  leerCsv,
  revisarCarga,
  revisarProducto,
  type CamposDelProducto,
  type FilaRevisada,
} from './catalogo.reglas';

/** Tope del listado: el máximo que acepta `GET /pharmacy/products`. */
const TOPE_DEL_LISTADO = 500;

/** Las pestañas de la tarjeta, en orden. El índice es el de `app-tabs`. */
export const PESTANAS_DEL_CATALOGO = ['productos', 'nuevo', 'importar'] as const;
type Pestana = (typeof PESTANAS_DEL_CATALOGO)[number];

/** Las acciones de la fila. Hoy sólo retirar: el backend no publica edición. */
const ACCIONES_DE_LA_FILA: readonly RowAction[] = [
  { code: 'retirar', label: 'Retirar', icon: 'remove', destructive: true },
];

/** El paso de la importación en que está la pantalla. */
type PasoDeImportacion = 'archivo' | 'revision' | 'publicando' | 'resultado';

/** Cómo terminó el `POST` de una fila. */
interface ResultadoDeFila {
  readonly numero: number;
  readonly codigo: string;
  readonly nombre: string;
  readonly publicado: boolean;
  readonly mensaje: string;
}

/** Una fila que no se mandó, con lo que la tabla de revisión muestra. */
interface FilaConProblema {
  readonly numero: number;
  readonly codigo: string;
  readonly nombre: string;
  readonly problema: string;
}

/**
 * **Catálogo de productos** de la farmacia: la empresa sube lo que vende, uno
 * por uno o de a cientos con un CSV, y retira lo que dejó de vender.
 *
 * ## Una tarjeta, tres pestañas
 *
 * Regla del cliente (composition-rules §5): la pantalla es UNA `app-card` con
 * `app-tabs` —Productos, Nuevo producto, Importación masiva—, centrada y a lo
 * ancho. Como `app-tab` no dibuja el panel cerrado, el formulario y la carga en
 * curso viven en señales del componente: cambiar de pestaña no pierde nada.
 *
 * ## Contra qué habla
 *
 * - Lectura: `GET /pharmacy/products?pharmacyId=` — lo publicado por esta
 *   farmacia, hasta 500.
 * - Alta: `POST /pharmacies/:pharmacyId/products`. El producto nace activo, así
 *   que después del 201 se relee el listado y aparece: la prueba es la lista
 *   recargada, no el toast.
 * - Retiro: `DELETE /pharmacies/:pharmacyId/products/:productId`, borrado
 *   lógico.
 *
 * La importación masiva no tiene endpoint propio en el backend: es el mismo
 * alta, fila por fila y **en serie** —una farmacia con 300 productos no debe
 * abrir 300 conexiones a la vez— con el resultado de cada una a la vista.
 *
 * ## Lo que el mockup pedía y el backend todavía no tiene
 *
 * Precio, stock, categoría, descripción, imágenes, borradores y edición. No se
 * dibujan campos que no se guardan: están pedidos en `PENDIENTES-BACKEND.md`
 * (P46).
 *
 * ## De qué farmacia es el catálogo
 *
 * Mismo criterio que las promociones: se elige de `GET /pharmacy/pharmacies`
 * porque el front no conoce el mapeo tenant → farmacia. Con una sola queda
 * elegida sola.
 */
@Component({
  selector: 'app-pharmacy-catalog',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    DataTable,
    FileInput,
    FormField,
    Input,
    PageHeader,
    Pagination,
    Progress,
    RowActions,
    SearchField,
    Select,
    Stepper,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './pharmacy-catalog.html',
  styleUrl: './pharmacy-catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyCatalog {
  private readonly pharmacy = inject(PharmacyClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly csv = inject(CsvExportService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly acciones = ACCIONES_DE_LA_FILA;
  protected readonly largoDelCodigo = LARGO_MAXIMO_DEL_CODIGO;
  protected readonly filasMaximas = FILAS_MAXIMAS_POR_CARGA;
  protected readonly bytesMaximos = BYTES_MAXIMOS_DEL_ARCHIVO;
  protected readonly columnasDelCsv = COLUMNAS_DEL_CSV;

  /* ─── Qué farmacia ────────────────────────────────────────────────────── */

  protected readonly farmacias = signal<ViewState<readonly SelectOption<string>[]>>(loading());
  protected readonly farmaciaElegida = signal<string | null>(null);

  protected readonly opcionesDeFarmacia = computed<readonly SelectOption<string>[]>(
    () => dataOf(this.farmacias()) ?? [],
  );

  protected readonly hayVariasFarmacias = computed(() => this.opcionesDeFarmacia().length > 1);

  protected readonly nombreDeLaFarmacia = computed(() => {
    const id = this.farmaciaElegida();
    return this.opcionesDeFarmacia().find((opcion) => opcion.value === id)?.label ?? '';
  });

  /* ─── Pestañas ────────────────────────────────────────────────────────── */

  protected readonly pestana = signal(0);

  /* ─── Productos ───────────────────────────────────────────────────────── */

  protected readonly productos = signal<ViewState<readonly PharmacyProduct[]>>(loading());
  protected readonly truncado = signal(false);
  protected readonly busqueda = signal('');
  protected readonly pagina = signal(1);
  protected readonly porPagina = signal(10);
  protected readonly retirando = signal<string | null>(null);

  protected readonly totalDeProductos = computed(() => dataOf(this.productos())?.length ?? 0);

  protected readonly conReceta = computed(
    () => (dataOf(this.productos()) ?? []).filter((p) => p.requiresPrescription === true).length,
  );

  /** La página visible, como estado: la tabla pinta los nueve estados sola. */
  protected readonly filasDeLaPagina = computed<ViewState<readonly PharmacyProduct[]>>(() => {
    const desde = (this.pagina() - 1) * this.porPagina();
    return mapData(this.productos(), (lista) => lista.slice(desde, desde + this.porPagina()));
  });

  private readonly celdaProducto =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('celdaProducto');
  private readonly celdaCodigo =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('celdaCodigo');
  private readonly celdaPresentacion =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('celdaPresentacion');
  private readonly celdaReceta =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('celdaReceta');
  private readonly celdaAcciones =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('celdaAcciones');

  protected readonly columnas = computed<readonly ColumnDef<PharmacyProduct>[]>(() => [
    { key: 'producto', header: 'Producto', priority: 1, cell: this.celdaProducto() },
    { key: 'codigo', header: 'Código', priority: 2, cell: this.celdaCodigo() },
    {
      key: 'presentacion',
      header: 'Concentración y presentación',
      priority: 3,
      cell: this.celdaPresentacion(),
    },
    { key: 'receta', header: 'Venta', priority: 2, cell: this.celdaReceta() },
    {
      key: 'acciones',
      header: 'Acciones',
      priority: 1,
      align: 'end',
      sticky: 'end',
      cell: this.celdaAcciones(),
    },
  ]);

  protected readonly idDe = (producto: PharmacyProduct): string => producto.id;
  protected readonly etiquetaDe = (producto: PharmacyProduct): string => nombreVisible(producto);

  /* ─── Nuevo producto ──────────────────────────────────────────────────── */

  protected readonly campos = signal<CamposDelProducto>(CAMPOS_VACIOS);
  protected readonly erroresDelAlta = signal<readonly string[]>([]);
  protected readonly guardando = signal(false);

  protected readonly opcionesSiNo: readonly SelectOption<string>[] = [
    { value: '', label: 'Sin declarar' },
    { value: 'sí', label: 'Sí' },
    { value: 'no', label: 'No' },
  ];

  /* ─── Importación masiva ──────────────────────────────────────────────── */

  protected readonly paso = signal<PasoDeImportacion>('archivo');
  protected readonly archivos = signal<readonly File[]>([]);
  protected readonly nombreDelArchivo = signal('');
  protected readonly analizando = signal(false);
  protected readonly errorDelArchivo = signal<string | null>(null);
  protected readonly columnasIgnoradas = signal<readonly string[]>([]);
  protected readonly revisadas = signal<readonly FilaRevisada[]>([]);
  protected readonly resultados = signal<readonly ResultadoDeFila[]>([]);
  protected readonly detenido = signal(false);
  private publicacion: Subscription | null = null;

  protected readonly listas = computed(() =>
    this.revisadas().flatMap((fila) => (fila.lista ? [fila] : [])),
  );

  protected readonly conProblemas = computed<ViewState<readonly FilaConProblema[]>>(() => {
    const filas = this.revisadas().flatMap((fila) =>
      fila.lista
        ? []
        : [
            {
              numero: fila.numero,
              codigo: fila.campos.codigo.trim(),
              nombre: nombreDeLosCampos(fila.campos),
              problema: fila.errores.join(' '),
            },
          ],
    );
    return filas.length === 0 ? empty({ label: 'Todas las filas están listas' }) : ready(filas);
  });

  protected readonly cuantosConProblemas = computed(
    () => this.revisadas().length - this.listas().length,
  );

  protected readonly publicados = computed(() => this.resultados().filter((r) => r.publicado));
  protected readonly rechazadosPorLaApi = computed<ViewState<readonly ResultadoDeFila[]>>(() => {
    const filas = this.resultados().filter((r) => !r.publicado);
    return filas.length === 0 ? empty({ label: 'La API aceptó todas las filas' }) : ready(filas);
  });

  protected readonly avance = computed(() => {
    const total = this.listas().length;
    return total === 0 ? 0 : Math.round((this.resultados().length / total) * 100);
  });

  protected readonly pasos = computed<readonly StepperStep[]>(() => {
    const orden: readonly PasoDeImportacion[] = ['archivo', 'revision', 'publicando', 'resultado'];
    const actual = orden.indexOf(this.paso());
    const etiquetas = ['Subir archivo', 'Revisar filas', 'Publicar', 'Resultado'];
    return etiquetas.map((label, i) => ({
      label,
      status: i < actual ? 'complete' : i === actual ? 'current' : 'upcoming',
    }));
  });

  private readonly celdaFila =
    viewChild.required<TemplateRef<{ $implicit: FilaConProblema }>>('celdaFila');
  private readonly celdaProblema =
    viewChild.required<TemplateRef<{ $implicit: FilaConProblema }>>('celdaProblema');
  private readonly celdaResultado =
    viewChild.required<TemplateRef<{ $implicit: ResultadoDeFila }>>('celdaResultado');

  protected readonly columnasDeProblemas = computed<readonly ColumnDef<FilaConProblema>[]>(() => [
    { key: 'fila', header: 'Fila', priority: 1, cell: this.celdaFila() },
    { key: 'codigo', header: 'Código', priority: 2 },
    { key: 'nombre', header: 'Producto', priority: 3 },
    { key: 'problema', header: 'Qué corregir', priority: 1, cell: this.celdaProblema() },
  ]);

  protected readonly columnasDeResultado = computed<readonly ColumnDef<ResultadoDeFila>[]>(() => [
    { key: 'numero', header: 'Fila', priority: 1 },
    { key: 'codigo', header: 'Código', priority: 2 },
    { key: 'nombre', header: 'Producto', priority: 3 },
    { key: 'mensaje', header: 'Respuesta de la API', priority: 1, cell: this.celdaResultado() },
  ]);

  protected readonly numeroDeFila = (fila: FilaConProblema): string => String(fila.numero);
  protected readonly numeroDeResultado = (fila: ResultadoDeFila): string => String(fila.numero);

  constructor() {
    this.cargarFarmacias();
    this.destroyRef.onDestroy(() => this.publicacion?.unsubscribe());
  }

  /* ─── Carga ───────────────────────────────────────────────────────────── */

  private cargarFarmacias(): void {
    this.pharmacy.listPharmacies().subscribe({
      next: (pagina) => {
        const opciones = pagina.items.map((item) => ({ value: item.id, label: item.name }));
        this.farmacias.set(
          opciones.length === 0
            ? empty(
                {
                  label: 'Ir al panel de mi organización',
                  route: '/administration/my-organization',
                },
                'Tu organización todavía no tiene una farmacia publicada.',
              )
            : ready(opciones),
        );
        if (opciones.length === 1) {
          this.elegirFarmacia(opciones[0]!.value);
        }
      },
      error: (error: unknown) =>
        this.farmacias.set(errorToViewState<readonly SelectOption<string>[]>(error)),
    });
  }

  protected reintentarFarmacias(): void {
    this.farmacias.set(loading());
    this.cargarFarmacias();
  }

  protected elegirFarmacia(id: string | null): void {
    if (id === this.farmaciaElegida()) {
      return;
    }
    this.farmaciaElegida.set(id);
    this.busqueda.set('');
    this.reiniciarImportacion();
    this.campos.set(CAMPOS_VACIOS);
    this.erroresDelAlta.set([]);
    if (id !== null) {
      this.recargarProductos();
    }
  }

  protected recargarProductos(): void {
    const pharmacyId = this.farmaciaElegida();
    if (pharmacyId === null) {
      return;
    }
    const busqueda = this.busqueda().trim();
    this.productos.set(loading());
    this.pharmacy
      .searchProducts({ pharmacyId, search: busqueda, limit: TOPE_DEL_LISTADO })
      .subscribe({
        next: (pagina) => {
          // La respuesta de otra farmacia no pisa a la elegida después.
          if (this.farmaciaElegida() !== pharmacyId) {
            return;
          }
          this.truncado.set(pagina.truncated);
          this.pagina.set(1);
          this.productos.set(
            pagina.items.length > 0
              ? ready(pagina.items)
              : busqueda === ''
                ? empty(
                    { label: 'Usá «Nuevo producto» o «Importación masiva»' },
                    'Tu catálogo todavía no tiene productos.',
                  )
                : empty({ label: 'Probá con otra palabra' }, `Nada coincide con «${busqueda}».`),
          );
        },
        error: (error: unknown) =>
          this.productos.set(errorToViewState<readonly PharmacyProduct[]>(error)),
      });
  }

  protected buscar(termino: string): void {
    this.busqueda.set(termino);
    this.recargarProductos();
  }

  /* ─── Retirar ─────────────────────────────────────────────────────────── */

  protected async alElegirAccion(codigo: string, producto: PharmacyProduct): Promise<void> {
    if (codigo === 'retirar') {
      await this.retirar(producto);
    }
  }

  private async retirar(producto: PharmacyProduct): Promise<void> {
    const pharmacyId = this.farmaciaElegida();
    if (pharmacyId === null) {
      return;
    }
    const confirmado = await this.dialogs.confirm({
      title: '¿Retirar este producto del catálogo?',
      message:
        `«${nombreVisible(producto)}» (${producto.productCode}) deja de publicarse y sus precios ` +
        'vigentes quedan reemplazados. Los pedidos ya hechos no cambian.',
      confirmLabel: 'Retirar',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }
    this.retirando.set(producto.id);
    this.pharmacy.retireProduct(pharmacyId, producto.id).subscribe({
      next: () => {
        this.retirando.set(null);
        this.toasts.success(`«${nombreVisible(producto)}» ya no se publica.`);
        this.recargarProductos();
      },
      error: (error: unknown) => {
        this.retirando.set(null);
        this.toasts.error(mensajeDeError(error, 'No se pudo retirar el producto.'));
      },
    });
  }

  /* ─── Nuevo producto ──────────────────────────────────────────────────── */

  protected fijarCampo(campo: keyof CamposDelProducto, valor: string | number | null): void {
    this.campos.update((actuales) => ({ ...actuales, [campo]: valor === null ? '' : String(valor) }));
  }

  protected guardarProducto(): void {
    const pharmacyId = this.farmaciaElegida();
    if (pharmacyId === null) {
      return;
    }
    const revision = revisarProducto(this.campos());
    if (!revision.valido) {
      this.erroresDelAlta.set(revision.errores);
      return;
    }
    this.erroresDelAlta.set([]);
    this.guardando.set(true);
    this.pharmacy.publishProduct(pharmacyId, revision.borrador).subscribe({
      next: () => {
        this.guardando.set(false);
        this.campos.set(CAMPOS_VACIOS);
        this.toasts.success(`«${nombreDelBorrador(revision.borrador)}» ya está en tu catálogo.`);
        // La prueba del alta es verla en el listado, releído de la API.
        this.busqueda.set('');
        this.recargarProductos();
        this.pestana.set(PESTANAS_DEL_CATALOGO.indexOf('productos'));
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.erroresDelAlta.set([mensajeDeError(error, 'No se pudo publicar el producto.')]);
      },
    });
  }

  protected limpiarFormulario(): void {
    this.campos.set(CAMPOS_VACIOS);
    this.erroresDelAlta.set([]);
  }

  /* ─── Importación masiva ──────────────────────────────────────────────── */

  protected descargarPlantilla(): void {
    this.csv.download(FILAS_DE_EJEMPLO, columnasDePlantilla(), 'plantilla-catalogo-farmacia.csv');
  }

  protected avisarRechazo(rechazos: readonly RejectedFile[]): void {
    const primero = rechazos[0];
    if (primero === undefined) {
      return;
    }
    this.errorDelArchivo.set(
      primero.reason === 'tamaño'
        ? 'El archivo pasa de 1 MB. Partilo en varios.'
        : 'Subí un archivo .csv (en Excel: Guardar como → CSV UTF-8).',
    );
  }

  protected async alElegirArchivo(archivos: readonly File[]): Promise<void> {
    this.archivos.set(archivos);
    const archivo = archivos[0];
    const pharmacyId = this.farmaciaElegida();
    if (archivo === undefined || pharmacyId === null) {
      return;
    }
    this.errorDelArchivo.set(null);
    this.analizando.set(true);
    this.nombreDelArchivo.set(archivo.name);

    let lectura: ReturnType<typeof leerCsv>;
    try {
      lectura = leerCsv(await archivo.text());
    } catch (error: unknown) {
      this.analizando.set(false);
      this.errorDelArchivo.set(
        error instanceof ArchivoInvalido ? error.message : 'No se pudo leer el archivo.',
      );
      return;
    }

    // Los códigos se comparan contra el catálogo **releído ahora**, no contra
    // la pestaña de productos: esa puede estar filtrada por una búsqueda.
    this.pharmacy
      .searchProducts({ pharmacyId, limit: TOPE_DEL_LISTADO })
      .pipe(
        map((pagina) => new Set(pagina.items.map((producto) => producto.productCode))),
        // Sin catálogo para comparar, la API igual rechaza el repetido con un
        // 409: se sigue, y el resultado lo dice fila por fila.
        catchError(() => of(new Set<string>())),
      )
      .subscribe((codigos) => {
        // Se cambió de farmacia o de archivo mientras se releía: este análisis
        // ya no es de la pantalla que se está mirando.
        if (this.farmaciaElegida() !== pharmacyId || this.archivos()[0] !== archivo) {
          return;
        }
        this.analizando.set(false);
        this.columnasIgnoradas.set(lectura.ignoradas);
        this.revisadas.set(revisarCarga(lectura.filas, codigos));
        this.paso.set('revision');
      });
  }

  protected publicarCarga(): void {
    const pharmacyId = this.farmaciaElegida();
    const filas = this.listas();
    if (pharmacyId === null || filas.length === 0) {
      return;
    }
    this.resultados.set([]);
    this.detenido.set(false);
    this.paso.set('publicando');

    this.publicacion = from(filas)
      .pipe(
        // En serie: una fila por vez, y la siguiente sale cuando vuelve la anterior.
        concatMap((fila) =>
          this.pharmacy.publishProduct(pharmacyId, fila.borrador).pipe(
            map(
              (): ResultadoDeFila => ({
                numero: fila.numero,
                codigo: fila.borrador.productCode,
                nombre: nombreDelBorrador(fila.borrador),
                publicado: true,
                mensaje: 'Publicado',
              }),
            ),
            catchError((error: unknown) =>
              of<ResultadoDeFila>({
                numero: fila.numero,
                codigo: fila.borrador.productCode,
                nombre: nombreDelBorrador(fila.borrador),
                publicado: false,
                mensaje: mensajeDeError(error, 'La API rechazó la fila.'),
              }),
            ),
          ),
        ),
      )
      .subscribe({
        next: (resultado) => this.resultados.update((lista) => [...lista, resultado]),
        complete: () => this.terminarCarga(),
      });
  }

  protected detenerCarga(): void {
    this.publicacion?.unsubscribe();
    this.detenido.set(true);
    this.terminarCarga();
  }

  private terminarCarga(): void {
    this.publicacion = null;
    this.paso.set('resultado');
    if (this.publicados().length > 0) {
      this.busqueda.set('');
      this.recargarProductos();
    }
  }

  protected descargarProblemas(): void {
    const filas = [
      ...this.revisadas().flatMap((fila) =>
        fila.lista ? [] : [{ campos: fila.campos, problema: fila.errores.join(' ') }],
      ),
      ...this.resultados().flatMap((resultado) => {
        if (resultado.publicado) {
          return [];
        }
        const fila = this.revisadas().find((r) => r.numero === resultado.numero);
        return fila === undefined ? [] : [{ campos: fila.campos, problema: resultado.mensaje }];
      }),
    ];
    const columnas: CsvColumn<{ campos: CamposDelProducto; problema: string }>[] = [
      ...COLUMNAS_DEL_CSV.map((columna) => ({
        header: columna.encabezado,
        value: (fila: { campos: CamposDelProducto }) => fila.campos[columna.campo],
      })),
      { header: 'problema', value: (fila) => fila.problema },
    ];
    this.csv.download(filas, columnas, 'catalogo-filas-a-corregir.csv');
  }

  protected irAlCatalogo(): void {
    this.pestana.set(PESTANAS_DEL_CATALOGO.indexOf('productos'));
  }

  protected reiniciarImportacion(): void {
    this.publicacion?.unsubscribe();
    this.publicacion = null;
    this.paso.set('archivo');
    this.archivos.set([]);
    this.nombreDelArchivo.set('');
    this.errorDelArchivo.set(null);
    this.columnasIgnoradas.set([]);
    this.revisadas.set([]);
    this.resultados.set([]);
    this.detenido.set(false);
    this.analizando.set(false);
  }

  /* ─── Lo que la plantilla necesita ────────────────────────────────────── */

  protected nombreDe(producto: PharmacyProduct): string {
    return nombreVisible(producto);
  }

  protected presentacionDe(producto: PharmacyProduct): string {
    const partes = [producto.strengthText, producto.packageSizeText, producto.dosageForm?.display];
    const visibles = partes.filter((parte): parte is string => parte !== null && parte !== undefined && parte !== '');
    return visibles.length === 0 ? '—' : visibles.join(' · ');
  }

  protected irAPestana(pestana: Pestana): void {
    this.pestana.set(PESTANAS_DEL_CATALOGO.indexOf(pestana));
  }
}

/** El nombre con que se lee un producto: marca, y si no, genérico. */
function nombreVisible(producto: PharmacyProduct): string {
  return producto.brandName ?? producto.genericName ?? producto.productCode;
}

function nombreDelBorrador(borrador: PharmacyProductDraft): string {
  return borrador.brandName ?? borrador.genericName ?? borrador.productCode;
}

function nombreDeLosCampos(campos: CamposDelProducto): string {
  return campos.marca.trim() || campos.generico.trim() || '—';
}

/** Las columnas de la plantilla: el encabezado canónico de cada una. */
function columnasDePlantilla(): CsvColumn<CamposDelProducto>[] {
  return COLUMNAS_DEL_CSV.map((columna) => ({
    header: columna.encabezado,
    value: (fila: CamposDelProducto) => fila[columna.campo],
  }));
}

/**
 * El texto de un error de la API para la persona.
 *
 * Pasa por `errorToViewState`, que ya sabe leer el cuerpo del contrato: un 409
 * trae «Ya existe un producto con ese código en la farmacia», un 403 dice que
 * la sesión no puede publicar y un 5xx trae el identificador de la petición.
 */
function mensajeDeError(error: unknown, porDefecto: string): string {
  const estado = errorToViewState<never>(error);
  switch (estado.status) {
    case 'validation':
      return estado.issues.map((issue) => issue.message).join(' ') || porDefecto;
    case 'forbidden':
      return estado.message ?? 'Tu usuario no tiene permiso para cambiar el catálogo de esta farmacia.';
    case 'not-found':
      return 'La farmacia o el producto ya no existen.';
    case 'offline':
      return 'Sin conexión con el servidor. Revisá tu red y probá de nuevo.';
    case 'error':
      return `${estado.message ?? porDefecto} (petición ${estado.requestId})`;
    default:
      return porDefecto;
  }
}
