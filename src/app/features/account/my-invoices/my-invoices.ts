import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NavigationService } from '@core/navigation/navigation.service';

import { BillingSimulatedClient } from '../../../core/data-access/billing-simulated/billing-simulated.client';
import type {
  MyInvoiceItem,
  MyInvoicesView,
  SimulatedInvoice,
  SimulatedInvoiceStatus,
} from '../../../core/data-access/billing-simulated/billing-simulated.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar, type FilterDef } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { ROTULO_DE_ESTADO, ROTULO_DE_ORIGEN, TONO_DE_ESTADO } from '../../billing/billing-summary';
import { bs, fechaYHora, mensajeDeError } from '../../billing/cobros-en-pantalla';
import { FACTURACION_SIMULADA_DISPONIBLE } from '../../billing/facturacion-disponible';
import { descargarRepresentacionGrafica, descargarXml } from '../../billing/representacion-grafica';

const TAMANO_INICIAL = 10;

/** Los períodos del filtro, en días. */
const PERIODOS: readonly { readonly value: string; readonly label: string; readonly dias: number }[] = [
  { value: '30', label: 'Últimos 30 días', dias: 30 },
  { value: '90', label: 'Últimos 90 días', dias: 90 },
  { value: '365', label: 'Último año', dias: 365 },
];

const SUBTITULO: Readonly<Record<MyInvoicesView, string>> = {
  RECEIVED: 'Las facturas que le emitieron por sus consultas y sus compras en farmacia.',
  ISSUED: 'Las facturas que emitió: a quién, por qué y en qué estado quedaron ante el SIAT.',
};

/**
 * **Mis facturas** (propietario, 30/09/2026): las facturas emitidas, para
 * **toda** cuenta, desde el ícono de la barra superior.
 *
 * El paciente ve las que le emitieron; el médico, la farmacia y facturación,
 * las que emitieron. De qué lado está cada cuenta lo decide el backend
 * (`view` de la respuesta): la pantalla sólo cambia el texto y la columna de
 * la contraparte.
 *
 * Es de sólo lectura, con la disciplina de tablas (ADR-0015): buscador y
 * filtros arriba, scroll sólo vertical, paginación abajo y el detalle en un
 * modal. Las facturas salen del SIAT **simulado** (FACT-SIAT-MOCK) y lo dicen.
 */
@Component({
  selector: 'app-my-invoices',
  imports: [
    Alert,
    AppButton,
    Card,
    Chip,
    ContentDialog,
    DataTable,
    FilterBar,
    PageHeader,
    Pagination,
    RowActions,
    ViewStateHost,
  ],
  templateUrl: './my-invoices.html',
  styleUrl: './my-invoices.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyInvoices {
  private readonly client = inject(BillingSimulatedClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly disponible = inject(FACTURACION_SIMULADA_DISPONIBLE)();

  protected readonly estado = signal<ViewState<readonly MyInvoiceItem[]>>(loading());
  protected readonly vista = signal<MyInvoicesView>('RECEIVED');
  protected readonly subtitulo = computed(() => SUBTITULO[this.vista()]);

  protected readonly bs = bs;
  protected readonly fechaYHora = fechaYHora;
  protected readonly rotuloDeEstado = ROTULO_DE_ESTADO;
  protected readonly tonoDeEstado = TONO_DE_ESTADO;

  /* ---- filtros y página ------------------------------------------------------ */

  protected readonly q = signal('');
  protected readonly filtroEstado = signal<string | null>(null);
  protected readonly filtroOrigen = signal<string | null>(null);
  protected readonly filtroPeriodo = signal<string | null>(null);
  protected readonly pagina = signal(1);
  protected readonly tamano = signal(TAMANO_INICIAL);

  /* ---- el detalle ------------------------------------------------------------ */

  protected readonly abierta = signal<MyInvoiceItem | null>(null);
  protected readonly factura = signal<SimulatedInvoice | null>(null);
  protected readonly cargandoFactura = signal(false);
  protected readonly errorDeFactura = signal<string | null>(null);

  constructor() {
    if (this.disponible) {
      this.cargar();
    }
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.client
      .myInvoices()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagina) => {
          this.vista.set(pagina.view);
          if (pagina.items.length === 0) {
            this.estado.set(
              pagina.view === 'RECEIVED'
                ? empty(
                    { label: 'Ver mis gastos', route: '/my-account/spending' },
                    'Todavía no le emitieron facturas. Cuando pague una consulta o un pedido de farmacia y se lo facturen, la factura aparece acá.',
                  )
                : empty(
                    { label: 'Volver al panel', route: '/dashboard' },
                    'Todavía no emitió facturas. Cuando facture una consulta o un pedido, aparece acá con su PDF y su XML.',
                  ),
            );
            return;
          }
          this.estado.set(ready(pagina.items));
        },
        error: (error: unknown) => this.estado.set(errorToViewState<readonly MyInvoiceItem[]>(error)),
      });
  }

  private readonly filas = computed<readonly MyInvoiceItem[]>(() => {
    const estado = this.estado();
    return estado.status === 'ready' ? estado.data : [];
  });

  /** Sólo los estados y orígenes que existen en la lista (C9 §4). */
  protected readonly filtros = computed<readonly FilterDef[]>(() => {
    const estados = [...new Set(this.filas().map((f) => f.invoice.status))];
    const origenes = [...new Set(this.filas().map((f) => f.source))];
    return [
      {
        key: 'estado',
        label: 'Estado',
        placeholder: 'Todos los estados',
        options: estados.map((value) => ({ value, label: ROTULO_DE_ESTADO[value] })),
      },
      {
        key: 'origen',
        label: 'Origen',
        placeholder: 'Consultas y farmacia',
        options: origenes.map((value) => ({ value, label: ROTULO_DE_ORIGEN[value] })),
      },
      {
        key: 'periodo',
        label: 'Período',
        placeholder: 'Desde siempre',
        options: PERIODOS.map((p) => ({ value: p.value, label: p.label })),
      },
    ];
  });

  protected onFiltrosCambiaron(activos: Readonly<Record<string, string>>): void {
    this.q.set(activos['q'] ?? '');
    this.filtroEstado.set(activos['estado'] ?? null);
    this.filtroOrigen.set(activos['origen'] ?? null);
    this.filtroPeriodo.set(activos['periodo'] ?? null);
    this.pagina.set(1);
  }

  /** Buscador multicampo, sin acentos ni mayúsculas. */
  protected readonly filasFiltradas = computed<readonly MyInvoiceItem[]>(() => {
    const termino = normalizarTexto(this.q().trim());
    const estado = this.filtroEstado();
    const origen = this.filtroOrigen();
    const dias = PERIODOS.find((p) => p.value === this.filtroPeriodo())?.dias ?? null;
    const ahora = Date.now();
    return this.filas().filter((fila) => {
      if (estado !== null && fila.invoice.status !== estado) return false;
      if (origen !== null && fila.source !== origen) return false;
      if (dias !== null && (ahora - new Date(fila.invoice.issuedAt).getTime()) / 86_400_000 > dias) return false;
      if (termino === '') return true;
      const campos = [
        String(fila.invoice.invoiceNumber),
        fila.description,
        fila.issuerName,
        fila.issuerNit,
        fila.patientName,
        ROTULO_DE_ESTADO[fila.invoice.status],
      ];
      return campos.some((campo) => normalizarTexto(campo).includes(termino));
    });
  });

  protected readonly totalFiltrado = computed(() => this.filasFiltradas().length);

  protected readonly filasDeTabla = computed<ViewState<readonly MyInvoiceItem[]>>(() => {
    const actual = this.estado();
    if (actual.status !== 'ready') return actual;
    const inicio = (this.pagina() - 1) * this.tamano();
    return ready(this.filasFiltradas().slice(inicio, inicio + this.tamano()));
  });

  /* ---- columnas --------------------------------------------------------------- */

  private readonly celdaNumero = viewChild.required<TemplateRef<{ $implicit: MyInvoiceItem }>>('celdaNumero');
  private readonly celdaFecha = viewChild.required<TemplateRef<{ $implicit: MyInvoiceItem }>>('celdaFecha');
  private readonly celdaConcepto = viewChild.required<TemplateRef<{ $implicit: MyInvoiceItem }>>('celdaConcepto');
  private readonly celdaContraparte = viewChild.required<TemplateRef<{ $implicit: MyInvoiceItem }>>('celdaContraparte');
  private readonly celdaTotal = viewChild.required<TemplateRef<{ $implicit: MyInvoiceItem }>>('celdaTotal');
  private readonly celdaEstado = viewChild.required<TemplateRef<{ $implicit: MyInvoiceItem }>>('celdaEstado');
  private readonly celdaAcciones = viewChild.required<TemplateRef<{ $implicit: MyInvoiceItem }>>('celdaAcciones');

  protected readonly columnas = computed<readonly ColumnDef<MyInvoiceItem>[]>(() => [
    // En pantalla angosta quedan concepto, total y acciones; número, fecha,
    // contraparte y estado se pliegan al detalle de la fila.
    { key: 'numero', header: 'N.º', priority: 2, cell: this.celdaNumero() },
    { key: 'fecha', header: 'Emitida', priority: 2, cell: this.celdaFecha() },
    { key: 'concepto', header: 'Concepto', priority: 1, cell: this.celdaConcepto() },
    {
      key: 'contraparte',
      header: this.vista() === 'RECEIVED' ? 'Emisor' : 'Paciente',
      priority: 2,
      cell: this.celdaContraparte(),
    },
    { key: 'total', header: 'Total', priority: 1, align: 'end', cell: this.celdaTotal() },
    { key: 'estado', header: 'Estado', priority: 2, cell: this.celdaEstado() },
    { key: 'acciones', header: 'Acciones', priority: 1, cell: this.celdaAcciones() },
  ]);

  protected readonly porId = (fila: MyInvoiceItem): string => fila.invoice.id;
  protected readonly nombreDeFila = (fila: MyInvoiceItem): string =>
    `Factura ${fila.invoice.invoiceNumber} · ${fila.description}`;

  /* ---- acciones --------------------------------------------------------------- */

  protected accionesDe(fila: MyInvoiceItem): readonly RowAction[] {
    const acciones: RowAction[] = [{ code: 'ver', label: 'Ver factura', icon: 'eye' }];
    if (fila.invoice.status !== 'REJECTED') {
      acciones.push({ code: 'pdf', label: 'Descargar PDF', icon: 'download' });
    }
    return acciones;
  }

  protected ejecutarAccion(codigo: string, fila: MyInvoiceItem): void {
    if (codigo === 'ver') {
      this.abrir(fila);
      return;
    }
    if (codigo === 'pdf') {
      this.conFactura(fila, (f) => void descargarRepresentacionGrafica(f));
    }
  }

  private abrir(fila: MyInvoiceItem): void {
    this.abierta.set(fila);
    this.factura.set(null);
    this.errorDeFactura.set(null);
    this.cargandoFactura.set(true);
    this.client
      .myInvoice(fila.invoice.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (f) => {
          this.cargandoFactura.set(false);
          this.factura.set(f);
        },
        error: (e: unknown) => {
          this.cargandoFactura.set(false);
          this.errorDeFactura.set(mensajeDeError(e, 'No se pudo leer la factura.'));
        },
      });
  }

  /** La descarga necesita la factura entera (XML, cabecera): se pide y se baja. */
  private conFactura(fila: MyInvoiceItem, hacer: (f: SimulatedInvoice) => void): void {
    this.client
      .myInvoice(fila.invoice.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: hacer, error: () => this.abrir(fila) });
  }

  protected cerrar(): void {
    this.abierta.set(null);
    this.factura.set(null);
  }

  protected descargarPdf(f: SimulatedInvoice): void {
    void descargarRepresentacionGrafica(f);
  }

  protected descargarXml(f: SimulatedInvoice): void {
    descargarXml(f);
  }

  protected estadoDe(fila: MyInvoiceItem): SimulatedInvoiceStatus {
    return fila.invoice.status;
  }

  protected origenDe(fila: MyInvoiceItem): string {
    return ROTULO_DE_ORIGEN[fila.source];
  }
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
