import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { AccountingClient } from '../../../core/data-access/accounting/accounting.client';
import type {
  GeneralLedgerEntry,
  GeneralLedgerPage,
  JournalTransaction,
  LedgerAccount,
} from '../../../core/data-access/accounting/accounting.types';
import { BillingSimulatedClient } from '../../../core/data-access/billing-simulated/billing-simulated.client';
import type {
  MyInvoiceItem,
  SimulatedInvoiceStatus,
} from '../../../core/data-access/billing-simulated/billing-simulated.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import type { ChipVariant } from '../../../shared/components/atoms/chip/chip.types';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Select } from '../../../shared/components/atoms/select/select';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { CsvExportService, type CsvColumn } from '../../../shared/utils/csv-export/csv-export';
import { cents, fromCents } from '../../billing/on-screen-charges';
import { SIMULATED_AVAILABLE_INVOICING } from '../../billing/invoicing-availability';
import { amountBs } from '../summary/windows';
import { ESTADO_DEL_COMPROBANTE } from './comprobante-pdf';

const TAMANO_INICIAL = 10;

/** Un cobro facturado: la factura y el ingreso que dejó en caja. */
interface FilaDeCobro {
  readonly id: string;
  readonly fecha: string;
  readonly numero: string;
  readonly paciente: string;
  readonly concepto: string;
  readonly monto: string;
  readonly estado: string;
  readonly tono: ChipVariant;
  readonly item: MyInvoiceItem;
}

/** Un comprobante contable del historial. */
interface FilaDeComprobante {
  readonly id: string;
  readonly fecha: string;
  readonly numero: string;
  readonly concepto: string;
  readonly monto: string;
  readonly estado: string;
  readonly tono: ChipVariant;
  readonly asiento: JournalTransaction;
}

/** Un movimiento de la cuenta de caja o banco elegida. */
interface FilaDeMovimiento {
  readonly id: string;
  readonly fecha: string;
  readonly comprobante: string;
  readonly detalle: string;
  readonly entro: string;
  readonly salio: string;
  readonly saldo: string;
  readonly movimiento: GeneralLedgerEntry;
}

type Celda<Fila> = TemplateRef<{ $implicit: Fila }>;

/** Qué le pasó al ingreso según cómo quedó la factura. */
const INGRESO_SEGUN_FACTURA: Readonly<
  Record<SimulatedInvoiceStatus, { readonly texto: string; readonly tono: ChipVariant }>
> = {
  VALIDATED: { texto: 'Ingreso registrado', tono: 'success' },
  OBSERVED: { texto: 'Factura observada', tono: 'warning' },
  REJECTED: { texto: 'Factura rechazada · sin ingreso', tono: 'error' },
  ANNULLED: { texto: 'Factura anulada · ingreso revertido', tono: 'neutral' },
};

const TONO_DEL_COMPROBANTE: Readonly<
  Record<NonNullable<JournalTransaction['status']>, ChipVariant>
> = {
  DRAFT: 'neutral',
  AUTO_CLASSIFIED: 'warning',
  PENDING_REVIEW: 'warning',
  APPROVED: 'info',
  POSTED: 'success',
  REVERSED: 'neutral',
};

const FORMATO_DIA = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/**
 * **Flujo de dinero** (propietario, 17/10/2026): el dinero que entró y salió
 * de una cuenta de caja o banco, y de dónde salió cada movimiento.
 *
 * Una tarjeta con tres pestañas (regla 6), cada una con la disciplina de
 * tablas de la casa —buscador arriba, tabla, paginación abajo, descarga de la
 * lista— (ADR-0015, igual que «Mis facturas»):
 *
 * 1. **Cobros facturados**: cada factura emitida es un ingreso que se anota
 *    solo en caja. Se ve con su factura, que se descarga en PDF o XML.
 * 2. **Comprobantes**: el historial de comprobantes contables, cada uno
 *    descargable en PDF.
 * 3. **Movimientos de la cuenta**: lo que entró y salió de la cuenta elegida,
 *    con el saldo después de cada movimiento.
 *
 * Reemplaza al botón «Ver movimientos de caja y banco», que mandaba a los
 * libros contables: lo que el médico buscaba ahí ahora está acá mismo.
 */
@Component({
  selector: 'app-flujo-de-dinero',
  imports: [
    AppButton,
    Card,
    Chip,
    DataTable,
    FilterBar,
    FormField,
    Pagination,
    RowActions,
    Select,
    Tab,
    Tabs,
  ],
  templateUrl: './flujo-de-dinero.html',
  styleUrl: './flujo-de-dinero.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlujoDeDinero {
  readonly practiceId = input.required<string>();
  /** El plan de cuentas de la práctica: de acá salen la caja, el banco y los nombres del PDF. */
  readonly cuentas = input.required<readonly LedgerAccount[]>();

  private readonly accounting = inject(AccountingClient);
  private readonly facturacion = inject(BillingSimulatedClient);
  private readonly csv = inject(CsvExportService);
  private readonly avisos = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly facturacionDisponible = inject(SIMULATED_AVAILABLE_INVOICING)();
  protected readonly pestana = signal(0);
  protected readonly importe = amountBs;

  /* ---- la cuenta de caja o banco ------------------------------------------- */

  protected readonly opcionesDeCaja = computed(() =>
    this.cuentas()
      .filter((cuenta) => cuenta.code === '1.1' || cuenta.code === '1.2')
      .map((cuenta) => ({ value: cuenta.id, label: `${cuenta.code} · ${cuenta.name}` })),
  );
  protected readonly cajaElegida = signal<string | null>(null);
  protected readonly cajaId = computed(() => {
    const opciones = this.opcionesDeCaja();
    const elegida = this.cajaElegida();
    return opciones.find((o) => o.value === elegida)?.value ?? opciones[0]?.value ?? null;
  });

  private readonly mayor = toSignal(
    toObservable(
      computed(() => ({ practiceId: this.practiceId(), accountId: this.cajaId() })),
    ).pipe(
      switchMap(({ practiceId, accountId }) =>
        accountId === null
          ? of(loading() as ViewState<GeneralLedgerPage>)
          : this.accounting.generalLedger(practiceId, { accountId, limit: 500 }).pipe(
              map((pagina) => ready(pagina)),
              startWith(loading() as ViewState<GeneralLedgerPage>),
              catchError((error: unknown) => of(errorToViewState<GeneralLedgerPage>(error))),
            ),
      ),
    ),
    { initialValue: loading() as ViewState<GeneralLedgerPage> },
  );

  /** Lo que entró, lo que salió y lo que queda. Las sumas van en cents enteros. */
  protected readonly totales = computed(() => {
    const estado = this.mayor();
    if (estado.status !== 'ready') return null;
    const entro = estado.data.items.reduce((suma, m) => suma + cents(m.debit), 0);
    const salio = estado.data.items.reduce((suma, m) => suma + cents(m.credit), 0);
    return { entro: fromCents(entro), salio: fromCents(salio), neto: fromCents(entro - salio) };
  });

  /* ---- 1 · cobros facturados ---------------------------------------------- */

  private readonly facturas = signal<ViewState<readonly MyInvoiceItem[]>>(loading());
  protected readonly qCobros = signal('');
  protected readonly paginaCobros = signal(1);
  protected readonly tamanoCobros = signal(TAMANO_INICIAL);

  private readonly cobros = computed<readonly FilaDeCobro[]>(() => {
    const estado = this.facturas();
    if (estado.status !== 'ready') return [];
    return estado.data.map((item) => ({
      id: item.invoice.id,
      fecha: FORMATO_DIA.format(new Date(item.invoice.issuedAt)),
      numero: `N.º ${item.invoice.invoiceNumber}`,
      paciente: item.patientName,
      concepto: item.description,
      monto: sinCortes(amountBs(item.invoice.total)),
      estado: INGRESO_SEGUN_FACTURA[item.invoice.status].texto,
      tono: INGRESO_SEGUN_FACTURA[item.invoice.status].tono,
      item,
    }));
  });

  protected readonly cobrosFiltrados = computed(() =>
    filtrar(this.cobros(), this.qCobros(), (f) => [
      f.numero,
      f.paciente,
      f.concepto,
      f.fecha,
      f.estado,
    ]),
  );
  protected readonly tablaDeCobros = computed(() =>
    pagina(this.facturas(), this.cobrosFiltrados(), this.paginaCobros(), this.tamanoCobros()),
  );
  /** Lo que entró por facturas vigentes: las anuladas y rechazadas no suman. */
  protected readonly totalFacturado = computed(() =>
    fromCents(
      this.cobros()
        .filter(
          (f) => f.item.invoice.status === 'VALIDATED' || f.item.invoice.status === 'OBSERVED',
        )
        .reduce((suma, f) => suma + cents(f.item.invoice.total), 0),
    ),
  );

  /* ---- 2 · comprobantes ----------------------------------------------------- */

  private readonly asientos = signal<ViewState<readonly JournalTransaction[]>>(loading());
  protected readonly qComprobantes = signal('');
  protected readonly paginaComprobantes = signal(1);
  protected readonly tamanoComprobantes = signal(TAMANO_INICIAL);
  protected readonly descargando = signal<string | null>(null);

  private readonly comprobantes = computed<readonly FilaDeComprobante[]>(() => {
    const estado = this.asientos();
    if (estado.status !== 'ready') return [];
    return estado.data.map((asiento) => {
      const status = asiento.status ?? 'POSTED';
      return {
        id: asiento.id,
        fecha: FORMATO_DIA.format(asiento.transactionDate),
        numero: asiento.transactionNumber ?? 'Sin número',
        concepto: asiento.description?.trim() || 'Sin concepto',
        monto: sinCortes(amountBs(asiento.totalAmount ?? '0')),
        estado: ESTADO_DEL_COMPROBANTE[status],
        tono: TONO_DEL_COMPROBANTE[status],
        asiento,
      };
    });
  });

  protected readonly comprobantesFiltrados = computed(() =>
    filtrar(this.comprobantes(), this.qComprobantes(), (f) => [
      f.numero,
      f.concepto,
      f.fecha,
      f.estado,
    ]),
  );
  protected readonly tablaDeComprobantes = computed(() =>
    pagina(
      this.asientos(),
      this.comprobantesFiltrados(),
      this.paginaComprobantes(),
      this.tamanoComprobantes(),
    ),
  );

  /* ---- 3 · movimientos de la cuenta ---------------------------------------- */

  protected readonly qMovimientos = signal('');
  protected readonly paginaMovimientos = signal(1);
  protected readonly tamanoMovimientos = signal(TAMANO_INICIAL);

  private readonly movimientos = computed<readonly FilaDeMovimiento[]>(() => {
    const estado = this.mayor();
    if (estado.status !== 'ready') return [];
    // El más reciente arriba: es el que se viene a mirar.
    return [...estado.data.items].reverse().map((m) => ({
      id: m.id,
      fecha: FORMATO_DIA.format(m.transactionDate),
      comprobante: m.transactionNumber ?? '—',
      detalle: m.memo?.trim() || 'Sin detalle',
      entro: cents(m.debit) === 0 ? '' : sinCortes(amountBs(m.debit)),
      salio: cents(m.credit) === 0 ? '' : sinCortes(amountBs(m.credit)),
      saldo: sinCortes(amountBs(m.runningBalance)),
      movimiento: m,
    }));
  });

  protected readonly movimientosFiltrados = computed(() =>
    filtrar(this.movimientos(), this.qMovimientos(), (f) => [f.comprobante, f.detalle, f.fecha]),
  );
  protected readonly tablaDeMovimientos = computed(() =>
    pagina(
      this.mayor(),
      this.movimientosFiltrados(),
      this.paginaMovimientos(),
      this.tamanoMovimientos(),
    ),
  );

  /* ---- columnas --------------------------------------------------------------- */

  private readonly celdaEstadoCobro = viewChild.required<Celda<FilaDeCobro>>('celdaEstadoCobro');
  private readonly celdaAccionesCobro =
    viewChild.required<Celda<FilaDeCobro>>('celdaAccionesCobro');
  private readonly celdaEstadoComprobante =
    viewChild.required<Celda<FilaDeComprobante>>('celdaEstadoComprobante');
  private readonly celdaAccionesComprobante = viewChild.required<Celda<FilaDeComprobante>>(
    'celdaAccionesComprobante',
  );

  protected readonly columnasDeCobros = computed<readonly ColumnDef<FilaDeCobro>[]>(() => [
    { key: 'fecha', header: 'Fecha', priority: 2 },
    { key: 'numero', header: 'Factura', priority: 1 },
    { key: 'paciente', header: 'Paciente', priority: 1 },
    { key: 'concepto', header: 'Concepto', priority: 3 },
    { key: 'monto', header: 'Monto', priority: 1, align: 'end' },
    { key: 'estado', header: 'Entrada en caja', priority: 2, cell: this.celdaEstadoCobro() },
    { key: 'acciones', header: 'Factura', priority: 1, cell: this.celdaAccionesCobro() },
  ]);

  protected readonly columnasDeComprobantes = computed<readonly ColumnDef<FilaDeComprobante>[]>(
    () => [
      { key: 'fecha', header: 'Fecha', priority: 2 },
      { key: 'numero', header: 'Comprobante', priority: 1 },
      { key: 'concepto', header: 'Concepto', priority: 1 },
      { key: 'monto', header: 'Monto', priority: 1, align: 'end' },
      { key: 'estado', header: 'Estado', priority: 2, cell: this.celdaEstadoComprobante() },
      { key: 'acciones', header: 'Descargar', priority: 1, cell: this.celdaAccionesComprobante() },
    ],
  );

  protected readonly columnasDeMovimientos: readonly ColumnDef<FilaDeMovimiento>[] = [
    { key: 'fecha', header: 'Fecha', priority: 2 },
    { key: 'comprobante', header: 'Comprobante', priority: 2 },
    { key: 'detalle', header: 'Detalle', priority: 1 },
    { key: 'entro', header: 'Entró', priority: 1, align: 'end' },
    { key: 'salio', header: 'Salió', priority: 1, align: 'end' },
    { key: 'saldo', header: 'Saldo', priority: 3, align: 'end' },
  ];

  protected readonly porId = (fila: { readonly id: string }): string => fila.id;

  protected readonly accionesDeCobro = (fila: FilaDeCobro): readonly RowAction[] =>
    fila.item.invoice.status === 'REJECTED'
      ? [{ code: 'xml', label: 'XML', icon: 'download' }]
      : [
          { code: 'pdf', label: 'Factura PDF', icon: 'download' },
          { code: 'xml', label: 'XML', icon: 'download' },
        ];

  protected readonly accionesDeComprobante: readonly RowAction[] = [
    { code: 'pdf', label: 'Descargar PDF', icon: 'download' },
  ];

  constructor() {
    toObservable(this.practiceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.cargarComprobantes();
        this.cargarFacturas();
      });
  }

  /* ---- lecturas ---------------------------------------------------------------- */

  protected cargarFacturas(): void {
    if (!this.facturacionDisponible) {
      this.facturas.set(ready([]));
      return;
    }
    this.facturas.set(loading());
    this.facturacion
      .myInvoices()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => {
          const deConsultas = respuesta.items.filter((item) => item.source === 'CONSULTATION');
          this.facturas.set(
            deConsultas.length === 0
              ? empty(
                  { label: 'Ir a facturación', route: '/billing' },
                  'Todavía no emitió facturas. Cuando facture una consulta, el cobro aparece aquí con su factura.',
                )
              : ready(deConsultas),
          );
        },
        error: (error: unknown) =>
          this.facturas.set(errorToViewState<readonly MyInvoiceItem[]>(error)),
      });
  }

  protected cargarComprobantes(): void {
    this.asientos.set(loading());
    this.accounting
      .listJournal(this.practiceId(), { limit: 500 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagina) =>
          this.asientos.set(
            pagina.items.length === 0
              ? empty(
                  { label: 'Ir a facturación', route: '/billing' },
                  'Todavía no hay comprobantes. Cada cobro, gasto o pago que registre deja uno aquí.',
                )
              : ready(pagina.items),
          ),
        error: (error: unknown) =>
          this.asientos.set(errorToViewState<readonly JournalTransaction[]>(error)),
      });
  }

  /* ---- búsqueda: cada tabla vuelve a la primera página ------------------------ */

  protected buscarCobros(termino: string): void {
    this.qCobros.set(termino);
    this.paginaCobros.set(1);
  }

  protected buscarComprobantes(termino: string): void {
    this.qComprobantes.set(termino);
    this.paginaComprobantes.set(1);
  }

  protected buscarMovimientos(termino: string): void {
    this.qMovimientos.set(termino);
    this.paginaMovimientos.set(1);
  }

  protected elegirCaja(id: string | null): void {
    this.cajaElegida.set(id);
    this.paginaMovimientos.set(1);
  }

  /* ---- descargas ---------------------------------------------------------------- */

  protected chargeAction(fila: FilaDeCobro, codigo: string): void {
    this.facturacion
      .myInvoice(fila.item.invoice.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (factura) => {
          const { downloadGraphicRepresentation, downloadXml } =
            await import('../../billing/graphic-representation');
          if (codigo === 'pdf') await downloadGraphicRepresentation(factura);
          else downloadXml(factura);
        },
        error: () =>
          this.avisos.error('No se pudo leer la factura. Intente de nuevo.', 'Sin descarga'),
      });
  }

  protected accionDeComprobante(fila: FilaDeComprobante): void {
    if (this.descargando() !== null) return;
    this.descargando.set(fila.id);
    this.accounting
      .getJournalTransaction(fila.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (detalle) => {
          try {
            const { downloadComprobantePdf } = await import('./comprobante-pdf');
            // El listado trae el concepto aunque el detalle no lo repita.
            downloadComprobantePdf(
              { ...detalle, description: detalle.description ?? fila.asiento.description },
              this.cuentas(),
            );
          } finally {
            this.descargando.set(null);
          }
        },
        error: () => {
          this.descargando.set(null);
          this.avisos.error('No se pudo leer el comprobante. Intente de nuevo.', 'Sin descarga');
        },
      });
  }

  protected descargarListaDeCobros(): void {
    const columnas: readonly CsvColumn<FilaDeCobro>[] = [
      { header: 'Fecha', value: (f) => f.fecha },
      { header: 'Factura', value: (f) => String(f.item.invoice.invoiceNumber) },
      { header: 'Paciente', value: (f) => f.paciente },
      { header: 'Concepto', value: (f) => f.concepto },
      { header: 'Monto (Bs)', value: (f) => f.item.invoice.total },
      { header: 'Entrada en caja', value: (f) => f.estado },
    ];
    this.csv.download(this.cobrosFiltrados(), columnas, 'cobros-facturados');
  }

  protected descargarListaDeComprobantes(): void {
    const columnas: readonly CsvColumn<FilaDeComprobante>[] = [
      { header: 'Fecha', value: (f) => f.fecha },
      { header: 'Comprobante', value: (f) => f.numero },
      { header: 'Concepto', value: (f) => f.concepto },
      { header: 'Monto (Bs)', value: (f) => f.asiento.totalAmount ?? '0.00' },
      { header: 'Estado', value: (f) => f.estado },
    ];
    this.csv.download(this.comprobantesFiltrados(), columnas, 'historial-de-comprobantes');
  }

  protected descargarListaDeMovimientos(): void {
    const columnas: readonly CsvColumn<FilaDeMovimiento>[] = [
      { header: 'Fecha', value: (f) => f.fecha },
      { header: 'Comprobante', value: (f) => f.comprobante },
      { header: 'Detalle', value: (f) => f.detalle },
      { header: 'Entró (Bs)', value: (f) => f.movimiento.debit },
      { header: 'Salió (Bs)', value: (f) => f.movimiento.credit },
      { header: 'Saldo (Bs)', value: (f) => f.movimiento.runningBalance },
    ];
    this.csv.download(this.movimientosFiltrados(), columnas, 'movimientos-de-la-cuenta');
  }

  protected readonly cuantosCobros = computed(() => this.cobrosFiltrados().length);
  protected readonly cuantosComprobantes = computed(() => this.comprobantesFiltrados().length);
  protected readonly cuantosMovimientos = computed(() => this.movimientosFiltrados().length);
}

/** Un importe que no se parte en dos renglones en la columna angosta. */
function sinCortes(importe: string): string {
  return importe.replace(/ /gu, ' ');
}

/** Buscador multicampo, sin tildes ni mayúsculas. */
function filtrar<T>(
  filas: readonly T[],
  termino: string,
  campos: (fila: T) => readonly string[],
): readonly T[] {
  const buscado = normalizar(termino.trim());
  if (buscado === '') return filas;
  return filas.filter((fila) => campos(fila).some((campo) => normalizar(campo).includes(buscado)));
}

/** La página pedida de las filas ya filtradas; los estados que no son «listo» pasan igual. */
function pagina<T>(
  estado: ViewState<unknown>,
  filas: readonly T[],
  numero: number,
  tamano: number,
): ViewState<readonly T[]> {
  if (estado.status !== 'ready') return estado as ViewState<readonly T[]>;
  const inicio = (numero - 1) * tamano;
  return ready(filas.slice(inicio, inicio + tamano));
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLowerCase();
}
