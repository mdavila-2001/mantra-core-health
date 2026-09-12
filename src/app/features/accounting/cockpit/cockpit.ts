import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

import { AccountingClient } from '../../../core/data-access/accounting/accounting.client';
import type {
  BalanceSheet,
  ControllingObject,
  FiscalPeriod,
  FiscalYear,
  IncomeStatement,
  JournalTransaction,
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
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Link } from '../../../shared/components/atoms/link/link';
import { Select } from '../../../shared/components/atoms/select/select';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
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
 * ## Lo que hoy sirve el simulador
 *
 * `fiscal-years`, `open-items`, `dimensions` y `document-flow` son lecturas que
 * la API **todavía no publica**: tiene las escrituras equivalentes —cerrar
 * período, compensar, postear, revertir— y ninguna forma de leerlas. En la rama
 * `mockup` las contesta `finance.handlers.ts` con los nombres de las tablas del
 * modelo, para que el día que la API las abra sólo cambie el origen.
 */
@Component({
  selector: 'app-accounting-cockpit',
  imports: [
    Alert,
    DatePipe,
    AppButton,
    Badge,
    Card,
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
  private readonly destroyRef = inject(DestroyRef);

  /** Fuerza una relectura sin tocar la práctica elegida. */
  private readonly recarga = signal(0);

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
    const datos = this.datos();
    if (datos === null) return null;
    const elegido = this.periodoElegido();
    const porId = datos.ejercicio.periods.find((p) => p.id === elegido);
    return porId ?? datos.ejercicio.periods.find((p) => p.id === datos.ejercicio.currentPeriodId) ?? null;
  });

  readonly opcionesDePeriodo = computed(() => {
    const datos = this.datos();
    return datos === null
      ? []
      : datos.ejercicio.periods.map((p) => ({
          value: p.id,
          label: `${String(p.periodNumber).padStart(2, '0')} · ${p.name}`,
        }));
  });

  /**
   * Los documentos agrupados por estado, en el orden del flujo.
   *
   * El orden no es alfabético ni por fecha: es el del recorrido. Quien mira la
   * bandeja está buscando dónde se frenó algo, y eso se lee siguiendo la
   * secuencia.
   */
  readonly bandeja = computed(() => {
    const datos = this.datos();
    if (datos === null) return [];
    const orden: readonly WorkflowStatus[] = [
      'DRAFT',
      'AUTO_CLASSIFIED',
      'PENDING_REVIEW',
      'APPROVED',
      'POSTED',
      'REVERSED',
    ];
    return orden.map((estado) => {
      const todos = datos.diario.filter((a) => (a.status ?? 'POSTED') === estado);
      // Lo cerrado se recorta. La bandeja existe para ver dónde se frenó algo;
      // los posteados y los revertidos ya no se frenan en ningún lado, y
      // listarlos enteros convierte el cockpit en un segundo libro diario
      // —que ya existe, y con filtros—. Se muestran los últimos y se dice
      // cuántos quedan.
      const cerrado = estado === 'POSTED' || estado === 'REVERSED';
      return {
        estado,
        etiqueta: ETIQUETA_DE_ESTADO[estado],
        tono: TONO_DEL_ESTADO[estado],
        accion: ACCION_DEL_ESTADO[estado],
        documentos: cerrado ? todos.slice(0, CERRADOS_A_LA_VISTA) : todos,
        ocultos: cerrado ? Math.max(0, todos.length - CERRADOS_A_LA_VISTA) : 0,
        total: todos.length,
      };
    });
  });

  /** Cuántos documentos están a mitad de camino: ni borrador ni posteados. */
  readonly documentosEnCurso = computed(() => {
    const datos = this.datos();
    if (datos === null) return 0;
    return datos.diario.filter(
      (a) => a.status !== 'POSTED' && a.status !== 'REVERSED',
    ).length;
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
            ejercicio: this.accounting.fiscalYear(practiceId),
            balance: this.accounting.trialBalance(practiceId),
            resultado: this.accounting.incomeStatement(practiceId, {}),
            situacion: this.accounting.balanceSheet(practiceId, {}),
            partidas: this.accounting.openItems(practiceId),
            controlling: this.accounting.controllingObjects(practiceId),
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

  recargar(): void {
    this.recarga.update((n) => n + 1);
  }

  /** Mueve un documento un paso, y vuelve a leer: el mayor pudo cambiar. */
  avanzar(transactionId: string, accion: AccionDisponible): void {
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
  cerrarPeriodo(): void {
    const periodo = this.periodoActivo();
    if (periodo === null) return;
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

  compensar(openItemId: string): void {
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

  /** Negativo se pinta distinto. Se mira el signo del texto, no su valor. */
  esNegativo(valor: string): boolean {
    return valor.trim().startsWith('-');
  }

  claveDeDocumento(a: JournalTransaction): string {
    return a.id;
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

/** Todo lo que el cockpit necesita para pintarse de una sola vez. */
interface Tablero {
  readonly ejercicio: FiscalYear;
  readonly balance: TrialBalance;
  readonly resultado: IncomeStatement;
  readonly situacion: BalanceSheet;
  readonly partidas: OpenItemsPage;
  readonly controlling: readonly ControllingObject[];
  readonly diario: readonly JournalTransaction[];
}
