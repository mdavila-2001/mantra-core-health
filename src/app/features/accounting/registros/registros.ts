import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  type TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SimpleAccountingClient } from '../../../core/data-access/simple-accounting/simple-accounting.client';
import type {
  PractitionerSummary,
  RecordKind,
  SimpleAccount,
  SimpleRecord,
  SimpleTransaction,
  SummaryPeriod,
} from '../../../core/data-access/simple-accounting/simple-accounting.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { SectionHeading } from '../../../shared/components/molecules/section-heading/section-heading';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { importeBs } from '../resumen/ventanas';
import { CuentaDialog } from './cuenta-dialog';
import { motivoDelError } from './errores';
import { RegistroDialog } from './registro-dialog';
import {
  diaLegible,
  EXPLICACION_DE_CUENTAS,
  EXPLICACION_DE_TRANSACCIONES,
  glosarioDe,
  NOMBRE_DE_CLASE,
  rotuloDeCuenta,
  TEXTOS,
} from './registros.formato';
import type { VersionContable } from '../version-contable';
import { TransaccionDialog } from './transaccion-dialog';

/** Una fila de la tabla de gastos, activos o deudas, ya en palabras. */
interface FilaDeRegistro {
  readonly id: string;
  readonly fecha: string;
  readonly tipo: string;
  readonly descripcion: string;
  readonly monto: string;
  readonly registro: SimpleRecord;
}

interface FilaDeTransaccion {
  readonly id: string;
  readonly fecha: string;
  readonly descripcion: string;
  readonly debe: string;
  readonly haber: string;
  readonly monto: string;
  readonly transaccion: SimpleTransaction;
}

interface FilaDeCuenta {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly clase: string;
  readonly origen: string;
  readonly cuenta: SimpleAccount;
}

type Celda<Fila> = TemplateRef<{ $implicit: Fila }>;

/** Qué modal está abierto, con lo que necesita. */
type Modal =
  | { readonly tipo: 'registro'; readonly kind: RecordKind; readonly registro: SimpleRecord | null }
  | { readonly tipo: 'transaccion'; readonly transaccion: SimpleTransaction | null }
  | { readonly tipo: 'cuenta'; readonly cuenta: SimpleAccount | null };

/** Ver {@link ContabilidadSimple.parte}. */
export type ParteDeLaContabilidad = 'todo' | 'numeros' | 'registros';

const PERIODOS: readonly SegmentedOption<SummaryPeriod>[] = [
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
];

const ACCIONES: readonly RowAction[] = [
  { code: 'editar', label: 'Editar', icon: 'edit' },
  { code: 'borrar', label: 'Borrar', icon: 'remove', destructive: true },
];

const SIN_BORRAR: readonly RowAction[] = [{ code: 'editar', label: 'Editar', icon: 'edit' }];

const KINDS: readonly RecordKind[] = ['EXPENSE', 'ASSET', 'DEBT'];

/** Cada tabla de la tarjeta, para su búsqueda y su página. */
type Tabla = RecordKind | 'TX' | 'CUENTAS';
const TAMANO_INICIAL = 10;
const PORTABLAS = <T,>(valor: T): Record<Tabla, T> => ({
  EXPENSE: valor,
  ASSET: valor,
  DEBT: valor,
  TX: valor,
  CUENTAS: valor,
});

/**
 * **La contabilidad simple del doctor** (28/09/2026), arriba del resumen de
 * «Contabilidad».
 *
 * Lo que pidió el propietario, en su orden:
 *
 * 1. **Tres números a la vista**: cuántos pacientes se atendieron, cuánto
 *    dinero se hizo y cuánto se espera recibir de las aseguradoras —los dos
 *    importes separados, «como dos números»—.
 * 2. **Gasto → tipo, activo → tipo, deuda → tipo, transacción debe/haber** y
 *    nada más: sin centros de costo, sin flujo de aprobación. Cada uno con su
 *    alta, edición y baja.
 * 3. **Cuentas con modal y tabla**, con las generales ya sembradas y la
 *    posibilidad de crear las propias «ahí mismo» (también desde el
 *    formulario de un gasto, un activo o una deuda).
 *
 * Una tarjeta con cinco pestañas (regla 6) y la misma tabla y el mismo modal
 * del sistema en las cinco. El resto de la pantalla de Contabilidad no cambia.
 */
@Component({
  selector: 'app-contabilidad-simple',
  imports: [
    AppButton,
    Card,
    CuentaDialog,
    DataTable,
    FilterBar,
    NavIcon,
    Pagination,
    RegistroDialog,
    RowActions,
    SectionHeading,
    SegmentedControl,
    Tab,
    Tabs,
    TransaccionDialog,
    ViewStateHost,
  ],
  templateUrl: './registros.html',
  styleUrl: './registros.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContabilidadSimple {
  /** La práctica cuyos números y registros se muestran. */
  readonly practiceId = input.required<string>();

  /**
   * Qué parte de la contabilidad simple se pinta.
   *
   * La pantalla de Contabilidad separa **tableros** de **registros** en dos
   * pestañas (30/09/2026): los tres números son un tablero y van con el resto
   * del resumen; las tablas con su alta, edición y baja van en «Registros».
   * Cada instancia sólo lee lo que pinta. `todo` es el comportamiento de
   * antes de la separación.
   */
  readonly parte = input<ParteDeLaContabilidad>('todo');

  /**
   * Qué versión de la pantalla se lee. En «doctor», los registros son los tres
   * que un médico anota —gastos, activos y deudas— y el glosario trae sólo esas
   * palabras; «contador» suma las transacciones (debe y haber) y el plan de
   * cuentas. Las dos versiones leen y guardan los mismos datos: es qué se ve,
   * no qué se puede. Quién puede escribir lo resuelve la API.
   */
  readonly version = input<VersionContable>('doctor');
  protected readonly esContador = computed(() => this.version() === 'contador');

  private readonly contabilidad = inject(SimpleAccountingClient);
  private readonly dialogos = inject(DialogService);
  private readonly avisos = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly periodos = PERIODOS;
  protected readonly periodo = signal<SummaryPeriod>('month');
  protected readonly pestana = signal(0);
  protected readonly textos = TEXTOS;
  protected readonly kinds = KINDS;
  protected readonly modal = signal<Modal | null>(null);
  protected readonly glosario = computed(() => glosarioDe(this.esContador()));
  protected readonly explicacionDeTransacciones = EXPLICACION_DE_TRANSACCIONES;
  protected readonly explicacionDeCuentas = EXPLICACION_DE_CUENTAS;

  /* ---- búsqueda y página de cada tabla ------------------------------------ */

  protected readonly busqueda = signal<Record<Tabla, string>>(PORTABLAS(''));
  protected readonly pagina = signal<Record<Tabla, number>>(PORTABLAS(1));
  protected readonly tamano = signal<Record<Tabla, number>>(PORTABLAS(TAMANO_INICIAL));

  protected readonly resumen = signal<ViewState<PractitionerSummary>>(loading());
  protected readonly cuentas = signal<ViewState<readonly SimpleAccount[]>>(loading());
  protected readonly registros = signal<
    Readonly<Record<RecordKind, ViewState<readonly SimpleRecord[]>>>
  >({
    EXPENSE: loading(),
    ASSET: loading(),
    DEBT: loading(),
  });
  protected readonly transacciones = signal<ViewState<readonly SimpleTransaction[]>>(loading());

  protected readonly numeros = computed(() => dataOf(this.resumen()));
  protected readonly listaDeCuentas = computed(() => dataOf(this.cuentas()) ?? []);
  private readonly cuentaPorId = computed(
    () => new Map(this.listaDeCuentas().map((cuenta) => [cuenta.id, cuenta] as const)),
  );

  /* ---- las celdas de acciones, una por tabla ---------------------------- */

  private readonly accionesDeRegistro = viewChild<Celda<FilaDeRegistro>>('accionesDeRegistro');
  private readonly accionesDeTransaccion =
    viewChild<Celda<FilaDeTransaccion>>('accionesDeTransaccion');
  private readonly accionesDeCuenta = viewChild<Celda<FilaDeCuenta>>('accionesDeCuenta');

  protected readonly columnasDeRegistro = computed<readonly ColumnDef<FilaDeRegistro>[]>(() => [
    { key: 'fecha', header: 'Fecha', priority: 2 },
    { key: 'tipo', header: 'Tipo', priority: 1 },
    { key: 'descripcion', header: 'Descripción', priority: 1 },
    { key: 'monto', header: 'Monto', priority: 1, align: 'end' },
    { key: 'acciones', header: 'Acciones', priority: 1, cell: this.accionesDeRegistro() },
  ]);

  protected readonly columnasDeTransaccion = computed<readonly ColumnDef<FilaDeTransaccion>[]>(
    () => [
      { key: 'fecha', header: 'Fecha', priority: 2 },
      { key: 'descripcion', header: 'Descripción', priority: 1 },
      { key: 'debe', header: 'Debe (llega a)', priority: 1 },
      { key: 'haber', header: 'Haber (sale de)', priority: 1 },
      { key: 'monto', header: 'Monto', priority: 1, align: 'end' },
      { key: 'acciones', header: 'Acciones', priority: 1, cell: this.accionesDeTransaccion() },
    ],
  );

  protected readonly columnasDeCuenta = computed<readonly ColumnDef<FilaDeCuenta>[]>(() => [
    { key: 'codigo', header: 'Código', priority: 2 },
    { key: 'nombre', header: 'Nombre', priority: 1 },
    { key: 'clase', header: 'Tipo', priority: 1 },
    { key: 'origen', header: 'Origen', priority: 3 },
    { key: 'acciones', header: 'Acciones', priority: 1, cell: this.accionesDeCuenta() },
  ]);

  protected readonly porId = (fila: { readonly id: string }): string => fila.id;

  /* ---- las filas, ya en palabras ---------------------------------------- */

  private nombreDeCuenta(id: string): string {
    const cuenta = this.cuentaPorId().get(id);
    return cuenta === undefined ? 'Cuenta borrada' : rotuloDeCuenta(cuenta);
  }

  protected filasDe(kind: RecordKind): ViewState<readonly FilaDeRegistro[]> {
    return mapear(this.registros()[kind], (registro) => ({
      id: registro.id,
      fecha: diaLegible(registro.date),
      tipo: this.nombreDeCuenta(registro.accountId),
      descripcion: registro.description,
      monto: sinCortes(importeBs(registro.amount)),
      registro,
    }));
  }

  protected readonly filasDeTransacciones = computed(() =>
    mapear(this.transacciones(), (transaccion) => ({
      id: transaccion.id,
      fecha: diaLegible(transaccion.date),
      descripcion: transaccion.description,
      debe: this.nombreDeCuenta(transaccion.debitAccountId),
      haber: this.nombreDeCuenta(transaccion.creditAccountId),
      monto: sinCortes(importeBs(transaccion.amount)),
      transaccion,
    })),
  );

  protected readonly filasDeCuentas = computed(() =>
    mapear(this.cuentas(), (cuenta) => ({
      id: cuenta.id,
      codigo: cuenta.code,
      nombre: cuenta.name,
      clase: NOMBRE_DE_CLASE[cuenta.accountClass],
      origen: cuenta.seeded ? 'Del sistema' : 'Creada por usted',
      cuenta,
    })),
  );

  /* ---- lo filtrado y la página visible de cada tabla ------------------------ */

  private filasFiltradas(tabla: Tabla): readonly { readonly id: string }[] {
    const estado: ViewState<readonly { readonly id: string }[]> =
      tabla === 'TX'
        ? this.filasDeTransacciones()
        : tabla === 'CUENTAS'
          ? this.filasDeCuentas()
          : this.filasDe(tabla);
    const filas = dataOf(estado) ?? [];
    const buscado = normalizar(this.busqueda()[tabla].trim());
    if (buscado === '') return filas;
    return filas.filter((fila) =>
      Object.values(fila).some((valor) => typeof valor === 'string' && normalizar(valor).includes(buscado)),
    );
  }

  /** La página visible; los estados que no son «listo» pasan igual. */
  private paginaDe<T>(tabla: Tabla, estado: ViewState<readonly T[]>): ViewState<readonly T[]> {
    if (estado.status !== 'ready') return estado;
    const filtradas = this.filasFiltradas(tabla) as readonly T[];
    const inicio = (this.pagina()[tabla] - 1) * this.tamano()[tabla];
    return ready(filtradas.slice(inicio, inicio + this.tamano()[tabla]));
  }

  protected paginaDeRegistros(kind: RecordKind): ViewState<readonly FilaDeRegistro[]> {
    return this.paginaDe(kind, this.filasDe(kind));
  }

  protected readonly paginaDeTransacciones = computed(() =>
    this.paginaDe('TX', this.filasDeTransacciones()),
  );

  protected readonly paginaDeCuentas = computed(() => this.paginaDe('CUENTAS', this.filasDeCuentas()));

  protected totalDe(tabla: Tabla): number {
    return this.filasFiltradas(tabla).length;
  }

  protected buscar(tabla: Tabla, termino: string): void {
    this.busqueda.update((todas) => ({ ...todas, [tabla]: termino }));
    this.pagina.update((todas) => ({ ...todas, [tabla]: 1 }));
  }

  protected irAPagina(tabla: Tabla, numero: number): void {
    this.pagina.update((todas) => ({ ...todas, [tabla]: numero }));
  }

  protected cambiarTamano(tabla: Tabla, tamano: number): void {
    this.tamano.update((todos) => ({ ...todos, [tabla]: tamano }));
    this.pagina.update((todas) => ({ ...todas, [tabla]: 1 }));
  }

  /** Cuántos hay de cada cosa, para el rótulo de la pestaña. */
  protected cuantos(estado: ViewState<readonly unknown[]>): string {
    const datos = dataOf(estado);
    return datos === null ? '' : ` (${datos.length})`;
  }

  protected accionesDe(cuenta: SimpleAccount): readonly RowAction[] {
    return cuenta.seeded ? SIN_BORRAR : ACCIONES;
  }

  protected readonly acciones = ACCIONES;
  protected readonly importe = importeBs;

  constructor() {
    // Cada vez que cambia la práctica elegida, se vuelve a leer todo.
    effect(() => {
      this.practiceId();
      untracked(() => this.cargarTodo());
    });

    // Transacciones y Cuentas sólo existen en la versión Contador. Si se vuelve
    // a Doctor estando en una de ellas, se vuelve a la primera pestaña: dejar
    // el índice apuntando a una pestaña que ya no está deja el panel en blanco.
    effect(() => {
      if (!this.esContador() && this.pestana() >= KINDS.length) {
        untracked(() => this.pestana.set(0));
      }
    });
  }

  /* ---- lecturas ---------------------------------------------------------- */

  private cargarTodo(): void {
    const parte = this.parte();
    if (parte !== 'registros') this.cargarResumen();
    if (parte === 'numeros') return;
    this.cargarCuentas();
    for (const kind of KINDS) this.cargarRegistros(kind);
    this.cargarTransacciones();
  }

  protected elegirPeriodo(periodo: SummaryPeriod): void {
    this.periodo.set(periodo);
    this.cargarResumen();
  }

  protected cargarResumen(): void {
    this.resumen.set(loading());
    this.contabilidad
      .summary(this.practiceId(), this.periodo())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => this.resumen.set(ready(datos)),
        error: (error: unknown) => this.resumen.set(errorToViewState<PractitionerSummary>(error)),
      });
  }

  protected cargarCuentas(): void {
    this.contabilidad
      .listAccounts(this.practiceId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cuentas) => this.cuentas.set(ready(cuentas)),
        error: (error: unknown) =>
          this.cuentas.set(errorToViewState<readonly SimpleAccount[]>(error)),
      });
  }

  protected cargarRegistros(kind: RecordKind): void {
    this.contabilidad
      .listRecords(this.practiceId(), kind)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (registros) =>
          this.registros.update((todos) => ({ ...todos, [kind]: ready(registros) })),
        error: (error: unknown) =>
          this.registros.update((todos) => ({
            ...todos,
            [kind]: errorToViewState<readonly SimpleRecord[]>(error),
          })),
      });
  }

  protected cargarTransacciones(): void {
    this.contabilidad
      .listTransactions(this.practiceId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (transacciones) => this.transacciones.set(ready(transacciones)),
        error: (error: unknown) =>
          this.transacciones.set(errorToViewState<readonly SimpleTransaction[]>(error)),
      });
  }

  /* ---- altas y ediciones ------------------------------------------------- */

  protected nuevoRegistro(kind: RecordKind): void {
    this.modal.set({ tipo: 'registro', kind, registro: null });
  }

  protected accionDeRegistro(fila: FilaDeRegistro, accion: string): void {
    if (accion === 'editar') {
      this.modal.set({ tipo: 'registro', kind: fila.registro.kind, registro: fila.registro });
      return;
    }
    void this.borrar(
      `Borrar ${TEXTOS[fila.registro.kind].conArticulo}`,
      `«${fila.descripcion}», ${fila.monto}. No se puede deshacer.`,
      () => this.contabilidad.deleteRecord(fila.id),
      () => this.cargarRegistros(fila.registro.kind),
    );
  }

  protected accionDeTransaccion(fila: FilaDeTransaccion, accion: string): void {
    if (accion === 'editar') {
      this.modal.set({ tipo: 'transaccion', transaccion: fila.transaccion });
      return;
    }
    void this.borrar(
      'Borrar la transacción',
      `«${fila.descripcion}», ${fila.monto}. No se puede deshacer.`,
      () => this.contabilidad.deleteTransaction(fila.id),
      () => this.cargarTransacciones(),
    );
  }

  protected accionDeCuenta(fila: FilaDeCuenta, accion: string): void {
    if (accion === 'editar') {
      this.modal.set({ tipo: 'cuenta', cuenta: fila.cuenta });
      return;
    }
    void this.borrar(
      'Borrar la cuenta',
      `«${fila.nombre}». Sólo se puede si ningún registro la usa.`,
      () => this.contabilidad.deleteAccount(fila.id),
      () => this.cargarCuentas(),
    );
  }

  private async borrar(
    titulo: string,
    mensaje: string,
    pedido: () => ReturnType<SimpleAccountingClient['deleteRecord']>,
    despues: () => void,
  ): Promise<void> {
    const confirmado = await this.dialogos.confirm({
      title: titulo,
      message: mensaje,
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!confirmado) return;
    pedido()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.avisos.success('Se borró.', titulo.replace('Borrar', 'Borrado:'));
          despues();
        },
        error: (error: unknown) => this.avisos.error(motivoDelError(error), 'No se pudo borrar'),
      });
  }

  /* ---- al guardar un modal ------------------------------------------------ */

  protected registroGuardado(registro: SimpleRecord): void {
    this.avisos.success(TEXTOS[registro.kind].guardado, 'Guardado');
    this.cargarRegistros(registro.kind);
  }

  protected transaccionGuardada(): void {
    this.avisos.success('La transacción quedó guardada.', 'Guardado');
    this.cargarTransacciones();
  }

  protected cuentaGuardada(): void {
    this.avisos.success('La cuenta quedó guardada.', 'Guardado');
    this.cargarCuentas();
    // Un nombre cambiado se ve también en las tablas que la usan: ya las
    // traduce `nombreDeCuenta` desde la lista de cuentas recién leída.
  }
}

/** Un importe que no se parte en dos renglones en la columna angosta. */
function sinCortes(importe: string): string {
  return importe.replace(/ /gu, '\u00a0');
}

/** Aplica `fn` a los datos de un estado listo; los demás estados pasan igual. */
function mapear<T, U>(
  estado: ViewState<readonly T[]>,
  fn: (fila: T) => U,
): ViewState<readonly U[]> {
  return estado.status === 'ready'
    ? ready(estado.data.map(fn))
    : (estado as ViewState<readonly U[]>);
}

/** Para buscar sin tildes ni mayúsculas. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();
}
