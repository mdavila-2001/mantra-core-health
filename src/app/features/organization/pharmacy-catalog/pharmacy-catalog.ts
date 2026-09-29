import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
  type WritableSignal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { EMPTY, concatMap, from, map, of, catchError, type Observable, type Subscription } from 'rxjs';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Input } from '../../../shared/components/atoms/input/input';
import { Progress } from '../../../shared/components/atoms/progress/progress';
import { Select } from '../../../shared/components/atoms/select/select';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
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
  decodificarCsv,
  CAMPOS_VACIOS,
  COLUMNAS_DEL_CSV,
  CATEGORIAS,
  FILAS_DE_EJEMPLO,
  cambiosDelBorrador,
  FILAS_MAXIMAS_POR_CARGA,
  LARGO_MAXIMO_DEL_CODIGO,
  leerCsv,
  revisarCarga,
  revisarProducto,
  type CamposDelProducto,
  type CodificacionDelCsv,
  type FilaRevisada,
  type ModoDeCarga,
} from './catalogo.reglas';

/** Tope del listado: el máximo que acepta `GET /pharmacy/products`. */
const TOPE_DEL_LISTADO = 500;

/** Las pestañas de la tarjeta, en orden. El índice es el de `app-tabs`. */
export const PESTANAS_DEL_CATALOGO = ['productos', 'nuevo', 'importar'] as const;
type Pestana = (typeof PESTANAS_DEL_CATALOGO)[number];

/**
 * Las acciones de la fila, según si hoy lo tiene o no. «Sin stock» es lo que
 * la farmacia hace en la bandeja de pedidos con un renglón que no tiene: no
 * lleva un conteo, sólo avisa lo que le falta.
 */
const ACCIONES_CON_STOCK: readonly RowAction[] = [
  { code: 'sin-stock', label: 'Marcar sin stock', icon: 'package' },
  { code: 'editar', label: 'Editar', icon: 'edit' },
  { code: 'retirar', label: 'Retirar', icon: 'remove', destructive: true },
];
const ACCIONES_SIN_STOCK: readonly RowAction[] = [
  { code: 'con-stock', label: 'Marcar disponible', icon: 'check' },
  { code: 'editar', label: 'Editar', icon: 'edit' },
  { code: 'retirar', label: 'Retirar', icon: 'remove', destructive: true },
];

/** El filtro de disponibilidad del listado. */
type FiltroDeStock = 'TODOS' | 'CON' | 'SIN';

/** El paso de la importación en que está la pantalla. */
type PasoDeImportacion = 'archivo' | 'revision' | 'publicando' | 'resultado';

/** Cómo terminó el `POST` de una fila. */
interface ResultadoDeFila {
  readonly numero: number;
  readonly codigo: string;
  readonly nombre: string;
  readonly publicado: boolean;
  /** Si fue un alta o la actualización de un producto que ya estaba. */
  readonly accion: 'CREAR' | 'ACTUALIZAR';
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
 * (P47).
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
    DecimalPipe,
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
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './pharmacy-catalog.html',
  styleUrl: './pharmacy-catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:beforeunload)': 'alCerrarLaPestana($event)',
  },
})
export class PharmacyCatalog {
  private readonly pharmacy = inject(PharmacyClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly csv = inject(CsvExportService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly categorias = CATEGORIAS;
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
  /** Los productos con un retiro en vuelo: pueden ser varios a la vez. */
  protected readonly retirando = signal<ReadonlySet<string>>(new Set());
  private listado: Subscription | null = null;
  /** Número de la última consulta: una respuesta vieja no pisa a la nueva. */
  private consulta = 0;

  protected readonly hayListado = computed(() => this.productos().status === 'ready');

  protected readonly totalDeProductos = computed(() => dataOf(this.productos())?.length ?? 0);

  protected readonly conReceta = computed(
    () => (dataOf(this.productos()) ?? []).filter((p) => p.requiresPrescription === true).length,
  );

  /** Sin el dato (la API real no lo manda) se cuenta como disponible. */
  protected readonly sinStock = computed(
    () => (dataOf(this.productos()) ?? []).filter((p) => p.inStock === false).length,
  );
  protected readonly conStock = computed(() => this.totalDeProductos() - this.sinStock());
  protected readonly sinPrecio = computed(
    () => (dataOf(this.productos()) ?? []).filter((p) => !p.unitPrice).length,
  );

  protected readonly filtroDeStock = signal<FiltroDeStock>('TODOS');
  protected readonly opcionesDeFiltro: readonly SelectOption<FiltroDeStock>[] = [
    { value: 'TODOS', label: 'Toda la disponibilidad' },
    { value: 'CON', label: 'Con stock' },
    { value: 'SIN', label: 'Sin stock' },
  ];

  /** El listado con el filtro de disponibilidad aplicado. */
  private readonly filtrados = computed<ViewState<readonly PharmacyProduct[]>>(() => {
    const filtro = this.filtroDeStock();
    const estado = this.productos();
    if (filtro === 'TODOS' || estado.status !== 'ready') {
      return estado;
    }
    const lista = estado.data.filter((p) => (filtro === 'SIN') === (p.inStock === false));
    return lista.length > 0
      ? ready(lista)
      : empty(
          { label: 'Mostrar toda la disponibilidad' },
          filtro === 'SIN' ? 'No hay productos marcados sin stock.' : 'No hay productos con stock.',
        );
  });

  protected readonly totalFiltrado = computed(() => dataOf(this.filtrados())?.length ?? 0);

  /** La página visible, como estado: la tabla pinta los nueve estados sola. */
  protected readonly filasDeLaPagina = computed<ViewState<readonly PharmacyProduct[]>>(() => {
    const desde = (this.pagina() - 1) * this.porPagina();
    return mapData(this.filtrados(), (lista) => lista.slice(desde, desde + this.porPagina()));
  });

  /** Los productos con un cambio de disponibilidad en vuelo. */
  protected readonly cambiandoStock = signal<ReadonlySet<string>>(new Set());

  private readonly celdaProducto =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('celdaProducto');
  private readonly celdaCodigo =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('celdaCodigo');
  private readonly celdaPresentacion =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('celdaPresentacion');
  private readonly celdaReceta =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('celdaReceta');
  private readonly celdaPrecio =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('celdaPrecio');
  private readonly celdaStock =
    viewChild.required<TemplateRef<{ $implicit: PharmacyProduct }>>('celdaStock');
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
    { key: 'precio', header: 'Precio', priority: 1, align: 'end', cell: this.celdaPrecio() },
    { key: 'stock', header: 'Disponibilidad', priority: 1, cell: this.celdaStock() },
    { key: 'receta', header: 'Venta', priority: 3, cell: this.celdaReceta() },
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
  /** El producto que se está editando; `null` = el formulario da un alta. */
  protected readonly editando = signal<PharmacyProduct | null>(null);

  protected readonly opcionesDeCategoria = computed<readonly SelectOption<string>[]>(() => [
    { value: '', label: 'Sin categoría' },
    ...CATEGORIAS.map((categoria) => ({ value: categoria, label: categoria })),
  ]);

  protected readonly opcionesDeDisponibilidad: readonly SelectOption<string>[] = [
    { value: 'sí', label: 'Lo tengo (disponible)' },
    { value: 'no', label: 'No lo tengo (sin stock)' },
  ];

  protected readonly opcionesSiNo: readonly SelectOption<string>[] = [
    { value: '', label: 'Sin declarar' },
    { value: 'sí', label: 'Sí' },
    { value: 'no', label: 'No' },
  ];

  /* ─── Importación masiva ──────────────────────────────────────────────── */

  protected readonly modo = signal<ModoDeCarga>('CREAR_Y_ACTUALIZAR');
  protected readonly opcionesDeModo: readonly SelectOption<ModoDeCarga>[] = [
    { value: 'CREAR_Y_ACTUALIZAR', label: 'Crear los nuevos y actualizar los que ya están' },
    { value: 'SOLO_CREAR', label: 'Sólo crear nuevos (los códigos existentes se rechazan)' },
  ];

  protected readonly paso = signal<PasoDeImportacion>('archivo');
  protected readonly archivos = signal<readonly File[]>([]);
  protected readonly nombreDelArchivo = signal('');
  protected readonly analizando = signal(false);
  protected readonly errorDelArchivo = signal<string | null>(null);
  protected readonly columnasIgnoradas = signal<readonly string[]>([]);
  protected readonly revisadas = signal<readonly FilaRevisada[]>([]);
  protected readonly resultados = signal<readonly ResultadoDeFila[]>([]);
  protected readonly detenido = signal(false);
  protected readonly deteniendo = signal(false);
  protected readonly publicando = signal(false);
  protected readonly codificacion = signal<CodificacionDelCsv>('utf-8');
  /** Un error que no es de la fila (permiso, red, servidor) y cortó la carga. */
  protected readonly fallaGeneral = signal<string | null>(null);
  private publicacion: Subscription | null = null;
  /**
   * Pedido de detenerse. Se mira **entre** filas: la que está en vuelo termina
   * y se cuenta, porque cortarla a mitad deja una fila que quizá el servidor
   * guardó y que la pantalla no mostraría en ningún lado.
   */
  private detenerSolicitado = false;
  private detenidoPorLaPersona = false;
  private destruido = false;

  protected readonly listas = computed(() =>
    this.revisadas().flatMap((fila) => (fila.lista ? [fila] : [])),
  );

  /** Las primeras filas listas, para ver antes de publicar que se leyeron bien. */
  protected readonly muestra = computed(() => this.listas().slice(0, 5));

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
  protected readonly creados = computed(
    () => this.publicados().filter((r) => r.accion === 'CREAR').length,
  );
  protected readonly actualizados = computed(
    () => this.publicados().filter((r) => r.accion === 'ACTUALIZAR').length,
  );
  protected readonly aActualizar = computed(
    () => this.listas().filter((fila) => fila.accion === 'ACTUALIZAR').length,
  );
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
    { key: 'fila', header: 'Línea', priority: 1, cell: this.celdaFila() },
    { key: 'codigo', header: 'Código', priority: 2 },
    { key: 'nombre', header: 'Producto', priority: 3 },
    { key: 'problema', header: 'Qué corregir', priority: 1, cell: this.celdaProblema() },
  ]);

  protected readonly columnasDeResultado = computed<readonly ColumnDef<ResultadoDeFila>[]>(() => [
    { key: 'numero', header: 'Línea', priority: 1 },
    { key: 'codigo', header: 'Código', priority: 2 },
    { key: 'nombre', header: 'Producto', priority: 3 },
    { key: 'mensaje', header: 'Respuesta de la API', priority: 1, cell: this.celdaResultado() },
  ]);

  protected readonly numeroDeFila = (fila: FilaConProblema): string => String(fila.numero);
  protected readonly numeroDeResultado = (fila: ResultadoDeFila): string => String(fila.numero);

  constructor() {
    this.cargarFarmacias();
    this.destroyRef.onDestroy(() => {
      this.destruido = true;
      this.listado?.unsubscribe();
      // Salir de la pantalla no corta una fila a mitad: la carga se detiene
      // entre filas y, al terminar, un aviso dice cuántas se publicaron.
      this.detenerSolicitado = true;
    });
  }

  /** Cerrar o recargar la pestaña con una carga en curso pide confirmación. */
  protected alCerrarLaPestana(evento: BeforeUnloadEvent): void {
    if (this.publicando()) {
      evento.preventDefault();
    }
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
    // Con una carga en curso el selector está deshabilitado; esto es la red.
    if (id === this.farmaciaElegida() || this.publicando()) {
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

  /**
   * Relee el catálogo. Cada consulta cancela la anterior y lleva su número:
   * con la búsqueda, «amox» puede volver después de «amoxi», y sin esto la
   * lista mostraría lo que el campo ya no dice.
   */
  protected recargarProductos(conservarPagina = false): void {
    const pharmacyId = this.farmaciaElegida();
    if (pharmacyId === null) {
      return;
    }
    const busqueda = this.busqueda().trim();
    const consulta = ++this.consulta;
    this.listado?.unsubscribe();
    this.truncado.set(false);
    this.productos.set(loading());
    this.listado = this.pharmacy
      .searchProducts({ pharmacyId, search: busqueda, limit: TOPE_DEL_LISTADO })
      .subscribe({
        next: (pagina) => {
          if (consulta !== this.consulta) {
            return;
          }
          this.truncado.set(pagina.truncated);
          const paginas = Math.max(1, Math.ceil(pagina.items.length / this.porPagina()));
          this.pagina.set(conservarPagina ? Math.min(this.pagina(), paginas) : 1);
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
        error: (error: unknown) => {
          if (consulta !== this.consulta) {
            return;
          }
          this.productos.set(errorToViewState<readonly PharmacyProduct[]>(error));
        },
      });
  }

  protected buscar(termino: string): void {
    this.busqueda.set(termino);
    this.recargarProductos();
  }

  /* ─── Retirar ─────────────────────────────────────────────────────────── */

  protected accionesDe(producto: PharmacyProduct): readonly RowAction[] {
    return producto.inStock === false ? ACCIONES_SIN_STOCK : ACCIONES_CON_STOCK;
  }

  protected async alElegirAccion(codigo: string, producto: PharmacyProduct): Promise<void> {
    switch (codigo) {
      case 'retirar':
        await this.retirar(producto);
        return;
      case 'editar':
        this.editar(producto);
        return;
      case 'sin-stock':
        this.cambiarStock(producto, false);
        return;
      case 'con-stock':
        this.cambiarStock(producto, true);
        return;
    }
  }

  protected filtrarPorStock(filtro: FiltroDeStock | null): void {
    this.filtroDeStock.set(filtro ?? 'TODOS');
    this.pagina.set(1);
  }

  /**
   * «No lo tengo» / «ya lo tengo». Lo que se marca sin stock deja de
   * ofrecerse: no aparece en la vitrina de la farmacia ni cuenta para «dónde
   * comprar mi receta», igual que el renglón «no disponible» de un pedido.
   */
  private cambiarStock(producto: PharmacyProduct, inStock: boolean): void {
    const pharmacyId = this.farmaciaElegida();
    if (pharmacyId === null) {
      return;
    }
    this.marcar(this.cambiandoStock, producto.id, true);
    this.pharmacy.updateProduct(pharmacyId, producto.id, { inStock }).subscribe({
      next: () => {
        this.marcar(this.cambiandoStock, producto.id, false);
        this.toasts.success(
          inStock
            ? `«${nombreVisible(producto)}» vuelve a estar disponible.`
            : `«${nombreVisible(producto)}» quedó sin stock: los pacientes ya no lo ven disponible.`,
        );
        this.recargarProductos(true);
      },
      error: (error: unknown) => {
        this.marcar(this.cambiandoStock, producto.id, false);
        this.toasts.error(mensajeDeError(error, 'No se pudo cambiar la disponibilidad.'));
      },
    });
  }

  protected editar(producto: PharmacyProduct): void {
    this.editando.set(producto);
    this.erroresDelAlta.set([]);
    this.campos.set({
      ...CAMPOS_VACIOS,
      codigo: producto.productCode,
      marca: producto.brandName ?? '',
      generico: producto.genericName ?? '',
      concentracion: producto.strengthText ?? '',
      presentacion: producto.packageSizeText ?? '',
      receta:
        producto.requiresPrescription === true ? 'sí' : producto.requiresPrescription === false ? 'no' : '',
      precio: producto.unitPrice ?? '',
      categoria: producto.category ?? '',
      descripcion: producto.description ?? '',
      disponible: producto.inStock === false ? 'no' : 'sí',
    });
    this.irAPestana('nuevo');
  }

  /** «Nuevo producto» desde el listado: si había una edición a medias, se suelta. */
  protected cancelarEdicionSinSalir(): void {
    if (this.editando() !== null) {
      this.editando.set(null);
      this.campos.set(CAMPOS_VACIOS);
      this.erroresDelAlta.set([]);
    }
  }

  protected cancelarEdicion(): void {
    this.editando.set(null);
    this.limpiarFormulario();
    this.irAPestana('productos');
  }

  private marcar(
    conjunto: WritableSignal<ReadonlySet<string>>,
    productId: string,
    enVuelo: boolean,
  ): void {
    conjunto.update((actuales) => {
      const siguientes = new Set(actuales);
      if (enVuelo) {
        siguientes.add(productId);
      } else {
        siguientes.delete(productId);
      }
      return siguientes;
    });
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
        'vigentes quedan reemplazados. Los pedidos ya hechos no cambian. El código queda ' +
        'reservado: no se puede volver a usar para otro producto.',
      confirmLabel: 'Retirar',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }
    this.marcar(this.retirando, producto.id, true);
    this.pharmacy.retireProduct(pharmacyId, producto.id).subscribe({
      next: () => {
        this.marcar(this.retirando, producto.id, false);
        this.toasts.success(`«${nombreVisible(producto)}» ya no se publica.`);
        this.recargarProductos(true);
      },
      error: (error: unknown) => {
        this.marcar(this.retirando, producto.id, false);
        this.toasts.error(mensajeDeError(error, 'No se pudo retirar el producto.'));
        // Un 412 dice que ya estaba retirado: la lista que se ve está vieja.
        this.recargarProductos(true);
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
    const editando = this.editando();
    const guardado: Observable<unknown> =
      editando === null
        ? this.pharmacy.publishProduct(pharmacyId, revision.borrador)
        : this.pharmacy.updateProduct(
            pharmacyId,
            editando.id,
            cambiosDelBorrador(revision.borrador, true),
          );
    guardado.subscribe({
      next: () => {
        this.guardando.set(false);
        this.campos.set(CAMPOS_VACIOS);
        this.editando.set(null);
        this.toasts.success(
          editando === null
            ? `«${nombreDelBorrador(revision.borrador)}» ya está en tu catálogo.`
            : `Guardaste los cambios de «${nombreDelBorrador(revision.borrador)}».`,
        );
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
    // En edición, «limpiar» no puede soltar el código: es la identidad.
    const editando = this.editando();
    this.campos.set(
      editando === null ? CAMPOS_VACIOS : { ...CAMPOS_VACIOS, codigo: editando.productCode },
    );
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

    const bytes = await archivo.arrayBuffer();
    if (this.farmaciaElegida() !== pharmacyId || this.archivos()[0] !== archivo) {
      return;
    }
    const { texto, codificacion } = decodificarCsv(bytes);
    this.codificacion.set(codificacion);

    let lectura: ReturnType<typeof leerCsv>;
    try {
      lectura = leerCsv(texto);
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
        map(
          (pagina) =>
            new Map(pagina.items.map((producto) => [producto.productCode, producto.id] as const)),
        ),
        // Sin catálogo para comparar, la API igual rechaza el repetido con un
        // 409: se sigue, y el resultado lo dice fila por fila.
        catchError(() => of(new Map<string, string>())),
      )
      .subscribe((codigos) => {
        // Se cambió de farmacia o de archivo mientras se releía: este análisis
        // ya no es de la pantalla que se está mirando.
        if (this.farmaciaElegida() !== pharmacyId || this.archivos()[0] !== archivo) {
          return;
        }
        this.analizando.set(false);
        this.columnasIgnoradas.set(lectura.ignoradas);
        this.revisadas.set(revisarCarga(lectura.filas, codigos, this.modo()));
        this.paso.set('revision');
      });
  }

  protected publicarCarga(): void {
    const pharmacyId = this.farmaciaElegida();
    const filas = this.listas();
    // Un doble clic no lanza dos cargas.
    if (pharmacyId === null || filas.length === 0 || this.publicacion !== null) {
      return;
    }
    this.resultados.set([]);
    this.detenido.set(false);
    this.fallaGeneral.set(null);
    this.detenerSolicitado = false;
    this.detenidoPorLaPersona = false;
    this.publicando.set(true);
    this.paso.set('publicando');

    this.publicacion = from(filas)
      .pipe(
        // En serie: una fila por vez, y la siguiente sale cuando vuelve la
        // anterior. El pedido de detenerse se mira acá, antes de cada fila.
        concatMap((fila) =>
          this.detenerSolicitado
            ? EMPTY
            : (fila.accion === 'ACTUALIZAR' && fila.productId !== null
                ? this.pharmacy
                    .updateProduct(pharmacyId, fila.productId, cambiosDelBorrador(fila.borrador, false))
                    .pipe(map(() => 'Actualizado'))
                : this.pharmacy
                    .publishProduct(pharmacyId, fila.borrador)
                    .pipe(map(() => 'Publicado'))
              ).pipe(
                map(
                  (mensaje): ResultadoDeFila => ({
                    numero: fila.numero,
                    codigo: fila.borrador.productCode,
                    nombre: nombreDelBorrador(fila.borrador),
                    publicado: true,
                    accion: fila.accion,
                    mensaje,
                  }),
                ),
                catchError((error: unknown) =>
                  of<ResultadoDeFila>({
                    numero: fila.numero,
                    codigo: fila.borrador.productCode,
                    nombre: nombreDelBorrador(fila.borrador),
                    publicado: false,
                    accion: fila.accion,
                    mensaje: this.rechazoDeFila(error),
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

  /**
   * El mensaje de una fila rechazada y, si el error no es de la fila, el corte.
   *
   * Un 409 o un 422 son de **esa** fila: la siguiente puede andar. Un 403, un
   * 412 de farmacia inactiva, la falta de red o un 5xx van a fallar igual en
   * todas: seguir sería mandar 500 peticiones para leer 500 veces lo mismo.
   */
  private rechazoDeFila(error: unknown): string {
    const estado = errorToViewState<never>(error);
    const mensaje = mensajeDeError(error, 'La API rechazó la fila.');
    const deLaFila =
      estado.status === 'validation' &&
      !estado.issues.some((issue) => issue.code === 'PRECONDITION_FAILED');
    if (!deLaFila) {
      this.detenerSolicitado = true;
      this.fallaGeneral.set(mensaje);
      return mensaje;
    }
    return estado.issues.some((issue) => issue.code === 'CONFLICT')
      ? `${mensaje} Un código retirado también sigue reservado: usá otro.`
      : mensaje;
  }

  protected detenerCarga(): void {
    this.detenerSolicitado = true;
    this.detenidoPorLaPersona = true;
    this.deteniendo.set(true);
  }

  private terminarCarga(): void {
    this.publicacion = null;
    this.publicando.set(false);
    this.deteniendo.set(false);
    const publicados = this.publicados().length;
    if (this.destruido) {
      // La persona se fue de la pantalla: lo que se alcanzó a publicar se dice
      // igual, porque nadie va a ver el paso «Resultado».
      if (publicados > 0) {
        this.toasts.info(
          `La importación se detuvo al salir: ${publicados} de ${this.listas().length} productos quedaron publicados.`,
        );
      }
      return;
    }
    this.detenido.set(this.detenidoPorLaPersona);
    this.paso.set('resultado');
    if (publicados > 0) {
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
    // Con una carga en curso no se ofrece reiniciar; si igual llega acá, se
    // detiene entre filas y el resultado queda a la vista.
    if (this.publicacion !== null) {
      this.detenerSolicitado = true;
      return;
    }
    this.paso.set('archivo');
    this.archivos.set([]);
    this.nombreDelArchivo.set('');
    this.errorDelArchivo.set(null);
    this.columnasIgnoradas.set([]);
    this.revisadas.set([]);
    this.resultados.set([]);
    this.detenido.set(false);
    this.fallaGeneral.set(null);
    this.codificacion.set('utf-8');
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
