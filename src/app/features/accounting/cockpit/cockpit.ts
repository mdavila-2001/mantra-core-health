import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, throwError } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

import { AccountingClient } from '../../../core/data-access/accounting/accounting.client';
import { readApiError } from '../../../core/http/api-error';
import type {
  AccrualRegister,
  BalanceSheet,
  ControllingObject,
  FiscalPeriod,
  DocumentFlowNode,
  FiscalYear,
  FixedAssetRegister,
  IncomeStatement,
  JournalTransaction,
  OpenItem,
  OpenItemsPage,
  Practice,
  TrialBalance,
  WorkflowAction,
  WorkflowStatus,
} from '../../../core/data-access/accounting/accounting.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Link } from '../../../shared/components/atoms/link/link';
import { Select } from '../../../shared/components/atoms/select/select';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import {
  ACCION_DEL_ESTADO,
  ETIQUETA_DE_ESTADO,
  TONO_DEL_ESTADO,
  type AccionDisponible,
} from './flujo-del-documento';

/**
 * El **cockpit contable**: la pantalla que responde «¿cómo va el ejercicio?»
 * antes de que nadie abra un libro.
 *
 * ## Por qué existe, y por qué se parece a SAP
 *
 * La contabilidad de este producto ya era grande —42 tablas en el módulo 16,
 * doble partida validada, la máquina de estados del asiento— pero la pantalla
 * mostraba dos listas: balance de sumas y saldos, y libro diario. Eso es el
 * **detalle**, y el detalle no contesta la pregunta con la que alguien entra.
 *
 * Un cockpit contable serio —el de SAP es el ejemplo que el propietario pidió
 * copiar— tiene tres partes, y son las tres que hay acá:
 *
 * 1. **Un contexto explícito.** Qué sociedad, qué ejercicio y qué período, con
 *    su estado. En SAP nadie postea sin saber en qué período cae, porque un
 *    período cerrado rechaza el asiento. Acá es la primera barra de la pantalla.
 * 2. **Indicadores con umbral, no cifras sueltas.** Cada tile dice si algo está
 *    bien o mal —el balance cuadra o no, la ecuación patrimonial cierra o no, la
 *    cartera está vencida o no— y lleva al detalle que lo explica.
 * 3. **Documentos con flujo.** Un asiento no «se guarda»: recorre
 *    DRAFT → AUTO_CLASSIFIED → PENDING_REVIEW → APPROVED → POSTED, y sólo al
 *    postear existe para el mayor. Corregir uno posteado es **revertirlo**,
 *    nunca editarlo.
 *
 * ## De dónde sale cada número
 *
 * De la API, ya calculado. **Acá no se suma dinero**: los importes viajan como
 * texto decimal justamente para no pasar por un `float`, y `0.1 + 0.2` no da
 * `0.3` (ver la cabecera de `accounting.types.ts`). Lo único que hace esta
 * pantalla con un importe es compararlo contra cero para elegir un color, y
 * formatearlo para mostrar.
 *
 * ## De dónde salen las seis lecturas nuevas
 *
 * `fiscal-years`, `open-items`, `dimensions`, `document-flow`, `assets` y
 * `accrual-objects` las publica la API desde el PR #403
 * (`accounting-cockpit.controller.ts`); el interceptor mock (`finance.handlers.ts`)
 * las espeja con los mismos nombres para desarrollar sin la API arriba.
 */
@Component({
  selector: 'app-accounting-cockpit',
  imports: [
    Alert,
    SegmentedControl,
    DatePipe,
    AppButton,
    AppButtonLink,
    Badge,
    Card,
    EmptyState,
    FormField,
    Link,
    PageHeader,
    RouterLink,
    Select,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './cockpit.html',
  styleUrl: './cockpit.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cockpit {
  private readonly accounting = inject(AccountingClient);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);

  /** Fuerza una relectura sin tocar la práctica elegida. */
  private readonly recarga = signal(0);

  /** Qué corrida está en curso, para apagar su botón mientras tanto. */
  readonly corriendo = signal<'amortizacion' | 'devengo' | null>(null);

  /** El documento cuyo flujo está abierto, y su cadena. */
  readonly flujoAbierto = signal<string | null>(null);
  readonly cadenaDelFlujo = signal<readonly DocumentFlowNode[]>([]);

  /** La pestaña abierta del cockpit: documentos, partidas o controlling. */
  readonly pestana = signal(0);

  readonly practicaElegida = signal<string | null>(null);
  readonly periodoElegido = signal<string | null>(null);

  private readonly practicas = signal<ViewState<readonly Practice[]>>(loading());

  /** Todo el tablero se pide junto: media pantalla cargada no dice nada. */
  private readonly tablero = signal<ViewState<Tablero>>(loading());

  readonly estadoDePracticas = this.practicas.asReadonly();
  readonly estadoDelTablero = this.tablero.asReadonly();

  readonly opcionesDePractica = computed(() => {
    const estado = this.practicas();
    return estado.status !== 'ready'
      ? []
      : estado.data.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }));
  });

  readonly datos = computed<Tablero | null>(() => {
    const estado = this.tablero();
    return estado.status === 'ready' ? estado.data : null;
  });

  /** El período que manda la barra de contexto. */
  readonly periodoActivo = computed<FiscalPeriod | null>(() => {
    const ejercicio = this.datos()?.ejercicio ?? null;
    if (ejercicio === null) return null;
    const elegido = this.periodoElegido();
    const porId = ejercicio.periods.find((p) => p.id === elegido);
    return porId ?? ejercicio.periods.find((p) => p.id === ejercicio.currentPeriodId) ?? null;
  });

  readonly opcionesDePeriodo = computed(() => {
    const ejercicio = this.datos()?.ejercicio ?? null;
    return ejercicio === null
      ? []
      : ejercicio.periods.map((p) => ({
          value: p.id,
          label: `${String(p.periodNumber).padStart(2, '0')} · ${p.name}`,
        }));
  });

  /**
   * Qué muestra la bandeja: los pendientes (los cuatro estados que todavía no
   * llegaron al mayor) o un estado concreto del flujo.
   *
   * Arranca en «pendientes» porque es la pregunta con la que se entra: qué
   * está frenado. Los posteados son la mayoría del diario y, listados de
   * entrada, tapaban a los cinco que pedían una acción.
   */
  readonly filtroDeDocumentos = signal<FiltroDeDocumentos>('PENDIENTES');

  /**
   * Las etapas del flujo con su cuenta, en el orden del recorrido.
   *
   * El orden no es alfabético ni por fecha: es el del recorrido. Quien mira la
   * bandeja está buscando dónde se frenó algo, y eso se lee siguiendo la
   * secuencia.
   */
  readonly etapas = computed(() => {
    const datos = this.datos();
    if (datos === null) return [];
    return ORDEN_DEL_FLUJO.map((estado) => ({
      estado,
      etiqueta: ETIQUETA_DE_ESTADO[estado],
      total: datos.diario.filter((a) => estadoDe(a) === estado).length,
    }));
  });

  /** Los documentos que la bandeja muestra con el filtro elegido. */
  readonly bandeja = computed(() => {
    const datos = this.datos();
    const filtro = this.filtroDeDocumentos();
    if (datos === null) return { filas: [], ocultos: 0, total: 0 };
    const todos = datos.diario.filter((a) =>
      filtro === 'PENDIENTES' ? !ESTADOS_CERRADOS.has(estadoDe(a)) : estadoDe(a) === filtro,
    );
    // Lo cerrado se recorta. La bandeja existe para ver dónde se frenó algo;
    // los posteados y los revertidos ya no se frenan en ningún lado, y
    // listarlos enteros convierte el cockpit en un segundo libro diario
    // —que ya existe, y con filtros—. Se muestran los últimos y se dice
    // cuántos quedan.
    const cerrado = filtro !== 'PENDIENTES' && ESTADOS_CERRADOS.has(filtro);
    const filas = (cerrado ? todos.slice(0, CERRADOS_A_LA_VISTA) : todos).map((doc) => {
      const estado = estadoDe(doc);
      return {
        doc,
        estado,
        etiqueta: ETIQUETA_DE_ESTADO[estado],
        tono: TONO_DEL_ESTADO[estado],
        accion: ACCION_DEL_ESTADO[estado],
      };
    });
    return { filas, ocultos: todos.length - filas.length, total: todos.length };
  });

  /** Cuántos documentos están listos para postear: aprobados, esperando el último paso. */
  readonly listosParaPostear = computed(
    () => this.datos()?.diario.filter((a) => estadoDe(a) === 'APPROVED').length ?? 0,
  );

  /** Qué lado de la cartera se lista: las dos, sólo cobros o sólo pagos. */
  readonly ladoDePartidas = signal<LadoDePartidas>('TODAS');

  readonly opcionesDeLado: readonly SegmentedOption<LadoDePartidas>[] = [
    { value: 'TODAS', label: 'Todas' },
    { value: 'RECEIVABLE', label: 'Por cobrar' },
    { value: 'PAYABLE', label: 'Por pagar' },
  ];

  /** Las partidas del lado elegido, la más vencida primero. */
  readonly partidasVisibles = computed(() => {
    const datos = this.datos();
    if (datos === null) return [];
    const lado = this.ladoDePartidas();
    return datos.partidas.items
      .filter((p) => lado === 'TODAS' || p.side === lado)
      .slice()
      .sort((a, b) => b.overdueDays - a.overdueDays);
  });

  /** Cuántas partidas de cada lado ya pasaron su vencimiento. */
  readonly vencidas = computed(() => {
    const items = this.datos()?.partidas.items ?? [];
    return {
      cobrar: items.filter((p) => p.side === 'RECEIVABLE' && p.overdueDays > 0).length,
      pagar: items.filter((p) => p.side === 'PAYABLE' && p.overdueDays > 0).length,
    };
  });

  /**
   * Margen del período, en porcentaje con un decimal.
   *
   * Es la única cuenta que la pantalla hace con importes, y no produce un
   * importe: produce una proporción para leer. Los montos siguen viajando y
   * mostrándose como texto; acá no se suma ni se resta dinero.
   */
  readonly margen = computed<string | null>(() => {
    const resultado = this.datos()?.resultado;
    if (resultado === undefined) return null;
    const ingresos = Number(resultado.totalRevenue);
    const neto = Number(resultado.netIncome);
    if (!Number.isFinite(ingresos) || !Number.isFinite(neto) || ingresos === 0) return null;
    return `${((neto / ingresos) * 100).toFixed(1).replace('.', ',')} %`;
  });

  /** Los tres tipos de objeto de controlling, cada uno con sus objetos. */
  readonly dimensiones = computed(() => {
    const controlling = this.datos()?.controlling ?? [];
    return TIPOS_DE_DIMENSION.map((tipo) => ({
      ...tipo,
      items: controlling.filter((d) => d.kind === tipo.kind),
    }));
  });

  /** Cuántos documentos están a mitad de camino: ni borrador ni posteados. */
  readonly documentosEnCurso = computed(() => {
    const datos = this.datos();
    if (datos === null) return 0;
    return datos.diario.filter((a) => !ESTADOS_CERRADOS.has(estadoDe(a))).length;
  });

  readonly carteraVencida = computed(() => {
    const datos = this.datos();
    if (datos === null) return null;
    // El dato que importa de una cartera no es el total: es qué parte pasó de
    // los 90 días, que es cuando deja de cobrarse sola.
    return datos.partidas.aging.find((t) => t.bucket === 'D90_MAS') ?? null;
  });

  constructor() {
    this.accounting
      .listPractices()
      .pipe(
        map((items) => ready(items)),
        catchError((error: unknown) => of(errorToViewState<readonly Practice[]>(error))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((estado) => {
        this.practicas.set(estado);
        if (estado.status === 'ready' && estado.data.length > 0 && this.practicaElegida() === null) {
          this.practicaElegida.set(estado.data[0]!.id);
        }
      });

    toObservable(
      computed(() => ({ practiceId: this.practicaElegida(), intento: this.recarga() })),
    )
      .pipe(
        switchMap(({ practiceId }) => {
          if (practiceId === null) return of(loading());
          return forkJoin({
            // Una práctica sin ejercicio fiscal todavía no rompe el tablero
            // entero: esa tarjeta sola cae a `null` y ofrece volver a consultar
            // (S3), en vez de arrastrar a S6 las otras ocho lecturas que sí
            // tienen datos.
            ejercicio: this.accounting.fiscalYear(practiceId).pipe(
              catchError((error: unknown) =>
                this.esEjercicioInexistente(error) ? of(null) : throwError(() => error),
              ),
            ),
            balance: this.accounting.trialBalance(practiceId),
            resultado: this.accounting.incomeStatement(practiceId, {}),
            situacion: this.accounting.balanceSheet(practiceId, {}),
            partidas: this.accounting.openItems(practiceId),
            controlling: this.accounting.controllingObjects(practiceId),
            activos: this.accounting.fixedAssets(practiceId),
            devengos: this.accounting.accrualObjects(practiceId),
            diario: this.accounting.listJournal(practiceId, { limit: 50 }).pipe(map((p) => p.items)),
          }).pipe(
            map((datos): ViewState<Tablero> => ready(datos)),
            startWith(loading()),
            catchError((error: unknown) => of(errorToViewState<Tablero>(error))),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((estado) => this.tablero.set(estado));
  }

  /**
   * Abre —o cierra— el flujo de un documento.
   *
   * El flujo contesta la pregunta que un número de asiento no contesta solo:
   * de dónde salió y qué se hizo después con él. Una reversión sin su original
   * a la vista es un importe negativo sin explicación.
   */
  verFlujo(transactionId: string): void {
    if (this.flujoAbierto() === transactionId) {
      this.flujoAbierto.set(null);
      this.cadenaDelFlujo.set([]);
      return;
    }
    this.flujoAbierto.set(transactionId);
    this.cadenaDelFlujo.set([]);
    this.accounting
      .documentFlow(transactionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cadena) => this.cadenaDelFlujo.set(cadena),
        error: () =>
          this.toasts.show({ type: 'error', message: 'No se pudo leer el flujo del documento.' }),
      });
  }

  recargar(): void {
    this.recarga.update((n) => n + 1);
  }

  /** Lleva a la bandeja con un filtro puesto: es el destino de los atajos. */
  irABandeja(filtro: FiltroDeDocumentos): void {
    this.filtroDeDocumentos.set(filtro);
    this.pestana.set(0);
  }

  /** Mueve un documento un paso, y vuelve a leer: el mayor pudo cambiar. */
  async avanzar(transactionId: string, numero: string, accion: AccionDisponible): Promise<void> {
    // Revertir es lo único del flujo que no tiene vuelta atrás: crea el
    // documento espejo y los dos quedan en el mayor para siempre.
    if (accion.action === 'reverse') {
      const confirmado = await this.dialogs.confirm({
        title: `Revertir ${numero}`,
        message:
          'Se crea un documento espejo que anula el efecto de este en el mayor. Los dos quedan registrados y ninguno se puede editar.',
        confirmLabel: 'Revertir',
        destructive: true,
      });
      if (!confirmado) return;
    }
    this.accounting
      .advanceWorkflow(transactionId, accion.action as WorkflowAction)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.toasts.show({
            type: 'success',
            message: `${accion.hecho}: ${r.transactionNumber}`,
          });
          this.recargar();
        },
        error: () =>
          this.toasts.show({
            type: 'error',
            message: 'No se pudo mover el documento. El período puede estar cerrado.',
          }),
      });
  }

  /** Cerrar el mes. Falla si queda un documento sin postear — y eso es correcto. */
  async cerrarPeriodo(): Promise<void> {
    const periodo = this.periodoActivo();
    if (periodo === null) return;
    const confirmado = await this.dialogs.confirm({
      title: `Cerrar ${periodo.name}`,
      message:
        'Un período cerrado no admite asientos nuevos. Lo que falte habrá que registrarlo en el período abierto siguiente.',
      confirmLabel: 'Cerrar el período',
      destructive: true,
    });
    if (!confirmado) return;
    this.accounting
      .lockFiscalPeriod(periodo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toasts.show({ type: 'success', message: `Período cerrado: ${periodo.name}` });
          this.recargar();
        },
        error: () =>
          this.toasts.show({
            type: 'error',
            message: 'No se cerró: quedan documentos sin postear en el período.',
          }),
      });
  }

  /**
   * La corrida de amortización del período.
   *
   * No es un informe: crea el asiento y mueve los saldos, así que después hay
   * que releer el tablero entero — el resultado del período acaba de cambiar.
   */
  async amortizar(): Promise<void> {
    const practiceId = this.practicaElegida();
    const tablero = this.datos();
    if (practiceId === null || tablero === null) return;
    const confirmado = await this.dialogs.confirm({
      title: 'Correr la amortización',
      message: `Se registra un asiento por ${this.importe(tablero.activos.monthlyCharge)} en el período abierto.`,
      confirmLabel: 'Correr la amortización',
    });
    if (!confirmado) return;
    this.corriendo.set('amortizacion');
    this.accounting
      .runDepreciation(practiceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.corriendo.set(null);
          this.toasts.show({
            type: 'success',
            message: `Amortización de ${r.periodName}: ${this.importe(r.amount)} sobre ${r.assets ?? 0} activos · ${r.transactionNumber}`,
          });
          this.recargar();
        },
        error: () => {
          this.corriendo.set(null);
          this.toasts.show({
            type: 'error',
            message: 'No se corrió la amortización. Revisá que el período esté abierto.',
          });
        },
      });
  }

  /** La corrida de devengos: reconoce el período de cada objeto pendiente. */
  async devengar(): Promise<void> {
    const practiceId = this.practicaElegida();
    const tablero = this.datos();
    if (practiceId === null || tablero === null) return;
    const confirmado = await this.dialogs.confirm({
      title: 'Correr el devengo',
      message: `Se reconocen ${this.importe(tablero.devengos.periodCharge)} en el período abierto.`,
      confirmLabel: 'Correr el devengo',
    });
    if (!confirmado) return;
    this.corriendo.set('devengo');
    this.accounting
      .runAccruals(practiceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.corriendo.set(null);
          this.toasts.show({
            type: 'success',
            message: `Devengo de ${r.periodName}: ${this.importe(r.amount)} en ${r.objects ?? 0} objetos`,
          });
          this.recargar();
        },
        error: () => {
          this.corriendo.set(null);
          this.toasts.show({
            type: 'error',
            message: 'No se corrió el devengo. Revisá que el período esté abierto.',
          });
        },
      });
  }

  async compensar(partida: OpenItem): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: `Compensar ${partida.documentNumber}`,
      message: `Se cancela el saldo abierto de ${this.importe(partida.openAmount)} con ${partida.partnerName}.`,
      confirmLabel: 'Compensar',
    });
    if (!confirmado) return;
    const openItemId = partida.id;
    this.accounting
      .clearOpenItems([openItemId])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.toasts.show({
            type: 'success',
            message: `Compensado ${this.importe(r.clearedAmount)} · documento ${r.clearingDocumentId.slice(0, 8)}`,
          });
          this.recargar();
        },
        error: () =>
          this.toasts.show({ type: 'error', message: 'No se pudo compensar la partida.' }),
      });
  }

  /** Importe en bolivianos, sin convertir a número: sólo se formatea. */
  importe(valor: string): string {
    const partes = valor.split('.');
    const entero = (partes[0] ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `Bs ${entero},${partes[1] ?? '00'}`;
  }

  /** Fecha `AAAA-MM-DD` de la API como `dd/mm/aaaa`, sin pasar por `Date` (y su huso). */
  fecha(iso: string): string {
    const [anio, mes, dia] = iso.slice(0, 10).split('-');
    return anio && mes && dia ? `${dia}/${mes}/${anio}` : iso;
  }

  /** Avance de un devengo, en porcentaje entero para la barra. */
  avance(hechos: number, total: number): number {
    return total > 0 ? Math.round((hechos / total) * 100) : 0;
  }

  /** Un tramo en cero se atenúa: la tabla se lee por lo que sí tiene saldo. */
  esCero(valor: string): boolean {
    return /^-?0*(\.0*)?$/.test(valor.trim());
  }

  /** Negativo se pinta distinto. Se mira el signo del texto, no su valor. */
  esNegativo(valor: string): boolean {
    return valor.trim().startsWith('-');
  }

  claveDeDocumento(a: JournalTransaction): string {
    return a.id;
  }

  /**
   * ¿El 404 es «esta práctica todavía no tiene ejercicio fiscal»?
   *
   * Se ramifica por `body.code`, no por el estado HTTP, mismo criterio que
   * `errorToViewState` (`core/http/error-to-view-state.ts:36-41`): el código
   * es parte del contrato, el mensaje es texto humano que puede cambiar.
   */
  private esEjercicioInexistente(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) return false;
    return readApiError(error)?.code === 'NOT_FOUND';
  }
}

/**
 * Cuántos documentos ya cerrados se muestran en la bandeja.
 *
 * Cinco: los suficientes para reconocer los últimos movimientos, pocos como
 * para que no tapen a los que sí piden una acción. El resto vive en el libro
 * diario, que es la pantalla que sabe filtrar y paginar.
 */
const CERRADOS_A_LA_VISTA = 5;

const ORDEN_DEL_FLUJO: readonly WorkflowStatus[] = [
  'DRAFT',
  'AUTO_CLASSIFIED',
  'PENDING_REVIEW',
  'APPROVED',
  'POSTED',
  'REVERSED',
];

/** Los estados que ya no esperan nada: están en el mayor, o anulados en él. */
const ESTADOS_CERRADOS: ReadonlySet<WorkflowStatus> = new Set<WorkflowStatus>(['POSTED', 'REVERSED']);

/** Un asiento sin estado publicado se lee como posteado (ver `JournalTransaction.status`). */
function estadoDe(asiento: JournalTransaction): WorkflowStatus {
  return asiento.status ?? 'POSTED';
}

type FiltroDeDocumentos = 'PENDIENTES' | WorkflowStatus;
type LadoDePartidas = 'TODAS' | 'RECEIVABLE' | 'PAYABLE';

const TIPOS_DE_DIMENSION = [
  { kind: 'COST_CENTER', titulo: 'Centros de coste', ayuda: 'Dónde se gasta' },
  { kind: 'PROFIT_CENTER', titulo: 'Centros de beneficio', ayuda: 'Qué línea deja margen' },
  { kind: 'SEGMENT', titulo: 'Segmentos', ayuda: 'Resultado por línea de negocio' },
] as const;

/** Todo lo que el cockpit necesita para pintarse de una sola vez. */
interface Tablero {
  /** `null` si la práctica todavía no tiene ejercicio fiscal abierto. */
  readonly ejercicio: FiscalYear | null;
  readonly balance: TrialBalance;
  readonly resultado: IncomeStatement;
  readonly situacion: BalanceSheet;
  readonly partidas: OpenItemsPage;
  readonly activos: FixedAssetRegister;
  readonly devengos: AccrualRegister;
  readonly controlling: readonly ControllingObject[];
  readonly diario: readonly JournalTransaction[];
}
