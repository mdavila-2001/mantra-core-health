import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { AccountingClient } from '../../../core/data-access/accounting/accounting.client';
import type {
  BalanceSheet,
  FinancialStatementLine,
  FixedAssetRegister,
  IncomeStatement,
  OpenItem,
  OpenItemsPage,
  Practice,
} from '../../../core/data-access/accounting/accounting.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Select } from '../../../shared/components/atoms/select/select';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SectionHeading } from '../../../shared/components/molecules/section-heading/section-heading';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import {
  comparar,
  diasHasta,
  esCero,
  esNegativo,
  importeBs,
  porcentajeDe,
  ventanasDelDia,
  ventanasDelMes,
  ventanasDeLaSemana,
  type Comparacion,
} from './ventanas';

/* ============================================================================
    Cómo se llama cada cuenta cuando la lee un médico.

    El plan de cuentas está bien escrito **para un contador**: «Depreciación»,
    «Intereses bancarios», «Servicios básicos». Ninguno de esos tres nombres
    contesta «¿en qué se me va la plata?» sin que alguien lo traduzca al lado.

    La traducción es de **pantalla**, no de datos: el código de cuenta manda y
    sigue siendo el que viaja. Una cuenta que no esté en esta tabla —porque la
    práctica armó su propio plan— sale con el nombre que le puso la API, que es
    el comportamiento correcto: inventar un nombre llano para una cuenta que no
    conocemos sería peor que mostrar el suyo.
    ========================================================================== */
const NOMBRE_LLANO: Readonly<Record<string, string>> = {
  '4.1': 'Consultas',
  '4.2': 'Estudios y procedimientos',
  '4.3': 'Otros ingresos',
  '5.1': 'Alquiler del consultorio',
  '5.2': 'Insumos y material',
  '5.3': 'Luz, agua e internet',
  '5.4': 'Sueldos y honorarios',
  '5.5': 'Desgaste de los equipos',
  '5.6': 'Intereses del préstamo',
};

/**
 * Las dos líneas que hay que explicar sí o sí, porque no son plata que sale
 * del bolsillo y quien no lleva libros las lee como un cobro sorpresa.
 */
const ACLARACION: Readonly<Record<string, string>> = {
  '5.5':
    'No sale plata de tu cuenta: es lo que tus equipos perdieron de valor este mes por usarlos.',
  '5.6': 'Es sólo el interés del préstamo. La cuota que devuelve el capital no es un gasto.',
};

/** Una línea de «en qué se te va la plata», lista para dibujar. */
export interface FilaDeGasto {
  readonly id: string;
  readonly nombre: string;
  readonly importe: string;
  readonly porcentaje: number;
  readonly aclaracion: string | null;
}

/** Una línea de «de dónde viene la plata». */
export interface FilaDeIngreso {
  readonly id: string;
  readonly nombre: string;
  readonly importe: string;
  readonly porcentaje: number;
}

/** Uno de los tres bloques de arriba: hoy, esta semana, este mes. */
export interface Tramo {
  readonly clave: 'hoy' | 'semana' | 'mes';
  readonly rotulo: string;
  readonly aclaracion: string;
  /** Lo que entró, decimal como texto. */
  readonly entro: string;
  /** Lo que salió, decimal como texto. */
  readonly salio: string;
  /** Lo que quedó: lo declara la API en `netIncome`, acá no se resta nada. */
  readonly quedo: string;
  readonly comparacion: Comparacion | null;
  readonly destacado: boolean;
}

/** Una factura pendiente, ya resuelta para pintar. */
export interface FilaDePartida {
  readonly id: string;
  readonly quien: string;
  readonly documento: string;
  readonly importe: string;
  readonly aviso: string;
  readonly tono: 'error' | 'warning' | 'neutral';
  /** Para ordenar: lo más urgente arriba. */
  readonly urgencia: number;
}

/** Todo lo que la pantalla necesita, pedido de una sola vez. */
interface Dinero {
  readonly hoy: IncomeStatement;
  readonly hoyPrevio: IncomeStatement;
  readonly semana: IncomeStatement;
  readonly semanaPrevia: IncomeStatement;
  readonly mes: IncomeStatement;
  readonly mesPrevio: IncomeStatement;
  readonly partidas: OpenItemsPage;
  readonly situacion: BalanceSheet;
  readonly equipos: FixedAssetRegister;
}

/**
 * **Contabilidad, en cristiano.** La pantalla con la que abre el módulo.
 *
 * ## Qué estaba mal, dicho por quien paga
 *
 * «TODO LO DE CONTABILIDAD ESTÁ PÉSIMO, se supone que es contabilidad para no
 * contadores. El doctor necesita ver cuánto se hizo hoy, la semana y el mes;
 * en qué se está gastando; qué pagos hay pendientes y qué cuentas hay que
 * pagar.» (19/09/2026.)
 *
 * Lo que había en esta ruta era el **cockpit**: «Debe y haber», «Activo =
 * Pasivo + Patrimonio», «Documentos sin postear», una bandeja con
 * Clasificar / Enviar a revisión / Aprobar / Postear / Revertir. Todo eso es
 * correcto y le sirve a quien lleva los libros. A un médico no le contesta
 * ninguna de las cuatro preguntas de arriba, y mucho menos la primera: el
 * número más grande de la pantalla era el resultado **del ejercicio entero**,
 * no el del día.
 *
 * ## Las cuatro preguntas son las cuatro secciones
 *
 * 1. **¿Cuánto hiciste?** Hoy, esta semana y este mes, los tres a la vez y sin
 *    tocar nada. Cada uno dice lo que entró, lo que salió y **lo que te
 *    quedó**, y cómo le fue contra el mismo tramo del período anterior
 *    (ver `ventanas.ts`: se comparan largos iguales, no tres días contra un
 *    mes).
 * 2. **¿En qué se te va?** Los gastos del mes de mayor a menor, con barra y
 *    porcentaje, y con el nombre traducido: «Desgaste de los equipos», no
 *    «Depreciación».
 * 3. **¿Quién te debe?** Y **¿a quién le debés?** Las dos columnas con su
 *    total, lo más vencido arriba, y el botón que lo salda.
 * 4. **¿Qué tenés y qué debés?** Activos y pasivos, que hasta hoy vivían en
 *    una entrada suelta del menú — el propietario pidió el 19/09/2026 que
 *    estuvieran «integrado en contabilidad».
 *
 * ## De dónde sale cada número
 *
 * Ya calculado por la API. Acá **no se suma dinero**: `netIncome`,
 * `totalRevenue`, `totalExpense`, `totalReceivable`, `totalPayable`,
 * `totalAssets`, `totalLiabilities` y `totalEquity` vienen resueltos, por la
 * razón de la cabecera de `accounting.types.ts` — un `float` no representa 0,1
 * y un céntimo de descuadre no se distingue de un error contable. Lo único que
 * esta pantalla calcula sobre un importe es el **ancho de una barra** y un
 * **porcentaje de variación**, que no son plata: viven en `ventanas.ts` con su
 * justificación.
 *
 * ## Los tres tramos son tres lecturas, no una dividida
 *
 * «Hoy» no se saca filtrando en el navegador lo que trajo «este mes»: se pide
 * el estado de resultados con su ventana. Es la misma agregación que usa el
 * libro mayor, así que el número del día y el del mes no pueden contradecirse.
 * Son seis lecturas (tres tramos y sus tres comparables) más cartera, balance
 * general y equipos; todas juntas en un `forkJoin`, porque media pantalla
 * cargada de plata no dice nada.
 *
 * ## Los libros no se borran
 *
 * Quien lleva la contabilidad sigue teniendo todo: el cockpit está a un clic
 * en `administration/accounting/cockpit` y los libros en `.../libros`. Lo que
 * cambió es cuál de las dos abre primero.
 */
@Component({
  selector: 'app-accounting-resumen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppButton,
    AppButtonLink,
    Card,
    Chip,
    FormField,
    PageHeader,
    RouterLink,
    SectionHeading,
    Select,
    ViewStateHost,
  ],
  templateUrl: './resumen.html',
  styleUrl: './resumen.css',
})
export class Resumen {
  private readonly accounting = inject(AccountingClient);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * El día que manda, congelado al construir.
   *
   * No es `new Date()` cada vez que Angular recalcula: si lo fuera, las seis
   * ventanas podrían pedirse con dos días distintos si la pestaña queda
   * abierta cruzando la medianoche, y «hoy» dejaría de coincidir con el
   * encabezado.
   */
  private readonly hoy = new Date();

  private readonly recarga = signal(0);
  readonly practicaElegida = signal<string | null>(null);
  private readonly practicas = signal<ViewState<readonly Practice[]>>(loading());
  private readonly dinero = signal<ViewState<Dinero>>(loading());

  readonly estadoDePracticas = this.practicas.asReadonly();
  readonly estadoDelDinero = this.dinero.asReadonly();

  /** Qué partida se está saldando, para apagar su botón mientras tanto. */
  readonly saldando = signal<string | null>(null);

  readonly opcionesDePractica = computed(() => {
    const estado = this.practicas();
    return estado.status !== 'ready' ? [] : estado.data.map((p) => ({ value: p.id, label: p.name }));
  });

  /** Si hay más de una: con una sola, preguntar cuál es preguntar de más. */
  readonly hayVariasPracticas = computed(() => this.opcionesDePractica().length > 1);

  readonly datos = computed<Dinero | null>(() => {
    const estado = this.dinero();
    return estado.status === 'ready' ? estado.data : null;
  });

  /* ---- 1 · ¿Cuánto hiciste? ------------------------------------------------ */

  readonly tramos = computed<readonly Tramo[]>(() => {
    const d = this.datos();
    if (d === null) return [];
    const dia = ventanasDelDia(this.hoy);
    const semana = ventanasDeLaSemana(this.hoy);
    const mes = ventanasDelMes(this.hoy);
    return [
      this.tramo('hoy', 'Hoy', 'Lo de este día', d.hoy, d.hoyPrevio, dia.rotuloPrevio, false),
      this.tramo(
        'semana',
        'Esta semana',
        'Desde el lunes',
        d.semana,
        d.semanaPrevia,
        semana.rotuloPrevio,
        false,
      ),
      this.tramo(
        'mes',
        'Este mes',
        'Desde el día 1',
        d.mes,
        d.mesPrevio,
        mes.rotuloPrevio,
        true,
      ),
    ];
  });

  private tramo(
    clave: Tramo['clave'],
    rotulo: string,
    aclaracion: string,
    actual: IncomeStatement,
    previo: IncomeStatement,
    rotuloPrevio: string,
    destacado: boolean,
  ): Tramo {
    return {
      clave,
      rotulo,
      aclaracion,
      entro: actual.totalRevenue,
      salio: actual.totalExpense,
      quedo: actual.netIncome,
      comparacion: comparar(actual.totalRevenue, previo.totalRevenue, rotuloPrevio),
      destacado,
    };
  }

  /* ---- 2 · ¿En qué se te va? ----------------------------------------------- */

  readonly gastosDelMes = computed<readonly FilaDeGasto[]>(() => {
    const d = this.datos();
    if (d === null) return [];
    return d.mes.expenseItems
      .filter((linea) => !esCero(linea.amount))
      .map((linea) => ({
        id: linea.accountId,
        nombre: this.nombreDe(linea),
        importe: linea.amount,
        porcentaje: porcentajeDe(linea.amount, d.mes.totalExpense),
        aclaracion: linea.code === undefined ? null : (ACLARACION[linea.code] ?? null),
      }))
      .sort((a, b) => Number(b.importe) - Number(a.importe));
  });

  readonly ingresosDelMes = computed<readonly FilaDeIngreso[]>(() => {
    const d = this.datos();
    if (d === null) return [];
    return d.mes.revenueItems
      .filter((linea) => !esCero(linea.amount))
      .map((linea) => ({
        id: linea.accountId,
        nombre: this.nombreDe(linea),
        importe: linea.amount,
        porcentaje: porcentajeDe(linea.amount, d.mes.totalRevenue),
      }))
      .sort((a, b) => Number(b.importe) - Number(a.importe));
  });

  /**
   * La frase que resume los gastos del mes.
   *
   * Una lista de seis barras dice qué hay; no dice qué mirar. El gasto más
   * grande sí, y es lo único que un médico puede accionar sin abrir un libro.
   */
  readonly gastoMasGrande = computed(() => this.gastosDelMes()[0] ?? null);

  /* ---- 3 · ¿Quién te debe y a quién le debés? ------------------------------ */

  readonly teDeben = computed<readonly FilaDePartida[]>(() =>
    this.partidasDe('RECEIVABLE'),
  );

  readonly tenesQuePagar = computed<readonly FilaDePartida[]>(() =>
    this.partidasDe('PAYABLE'),
  );

  private partidasDe(lado: OpenItem['side']): readonly FilaDePartida[] {
    const d = this.datos();
    if (d === null) return [];
    return d.partidas.items
      .filter((p) => p.side === lado)
      .map((p) => {
        const faltan = diasHasta(p.dueDate, this.hoy);
        return {
          id: p.id,
          quien: p.partnerName,
          documento: p.documentNumber,
          importe: p.openAmount,
          ...this.avisoDeVencimiento(faltan),
          urgencia: -faltan,
        };
      })
      .sort((a, b) => b.urgencia - a.urgencia);
  }

  /**
   * Cómo se dice que algo venció, o que está por vencer.
   *
   * El tono no va solo: el texto dice lo mismo que el color, que es la regla
   * de la casa para no depender de distinguir rojo.
   */
  private avisoDeVencimiento(faltan: number): { aviso: string; tono: FilaDePartida['tono'] } {
    if (faltan < 0) {
      const dias = Math.abs(faltan);
      return {
        aviso: `Venció hace ${dias} ${dias === 1 ? 'día' : 'días'}`,
        tono: dias > 30 ? 'error' : 'warning',
      };
    }
    if (faltan === 0) return { aviso: 'Vence hoy', tono: 'warning' };
    if (faltan === 1) return { aviso: 'Vence mañana', tono: 'warning' };
    return { aviso: `Vence en ${faltan} días`, tono: 'neutral' };
  }

  /** Cuántas de las que te deben ya están vencidas. */
  readonly vencidasQueTeDeben = computed(
    () => this.teDeben().filter((p) => p.tono !== 'neutral').length,
  );

  /** Cuántas de las que debés ya están vencidas. */
  readonly vencidasQueDebes = computed(
    () => this.tenesQuePagar().filter((p) => p.tono !== 'neutral').length,
  );

  /* ---- 4 · ¿Qué tenés y qué debés? ----------------------------------------- */

  /**
   * Los equipos que todavía valen algo.
   *
   * Los dados de baja se dejan fuera: un activo en cero en una lista de «lo que
   * tenés» es una línea que ocupa lugar y no suma nada. El registro completo
   * está en la pantalla de activos y pasivos, a un clic.
   */
  readonly equiposConValor = computed(() => {
    const d = this.datos();
    if (d === null) return [];
    return d.equipos.items
      .filter((a) => a.status === 'ACTIVE' && !esCero(a.netBookValue))
      .sort((a, b) => Number(b.netBookValue) - Number(a.netBookValue));
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

    toObservable(computed(() => ({ practiceId: this.practicaElegida(), intento: this.recarga() })))
      .pipe(
        switchMap(({ practiceId }) => {
          if (practiceId === null) return of(loading() as ViewState<Dinero>);
          const dia = ventanasDelDia(this.hoy);
          const semana = ventanasDeLaSemana(this.hoy);
          const mes = ventanasDelMes(this.hoy);
          return forkJoin({
            hoy: this.accounting.incomeStatement(practiceId, dia.actual),
            hoyPrevio: this.accounting.incomeStatement(practiceId, dia.previa),
            semana: this.accounting.incomeStatement(practiceId, semana.actual),
            semanaPrevia: this.accounting.incomeStatement(practiceId, semana.previa),
            mes: this.accounting.incomeStatement(practiceId, mes.actual),
            mesPrevio: this.accounting.incomeStatement(practiceId, mes.previa),
            partidas: this.accounting.openItems(practiceId),
            situacion: this.accounting.balanceSheet(practiceId, {}),
            equipos: this.accounting.fixedAssets(practiceId),
          }).pipe(
            map((datos): ViewState<Dinero> => ready(datos)),
            startWith(loading() as ViewState<Dinero>),
            catchError((error: unknown) => of(errorToViewState<Dinero>(error))),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((estado) => this.dinero.set(estado));
  }

  recargar(): void {
    this.recarga.update((n) => n + 1);
  }

  /**
   * Dar por saldada una factura: cobrada, o pagada.
   *
   * Por debajo es `POST /accounting/clearing-documents` —compensar la partida—,
   * que es lo mismo que hace el cockpit con el botón «Compensar». El verbo
   * cambia porque el lector cambia: «compensar una partida abierta» no es algo
   * que un médico diga nunca.
   */
  saldar(partida: FilaDePartida, lado: 'cobro' | 'pago'): void {
    if (this.saldando() !== null) return;
    this.saldando.set(partida.id);
    this.accounting
      .clearOpenItems([partida.id])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saldando.set(null);
          this.toasts.show({
            type: 'success',
            message:
              lado === 'cobro'
                ? `Cobrado: ${partida.quien} · ${importeBs(partida.importe)}`
                : `Pagado: ${partida.quien} · ${importeBs(partida.importe)}`,
          });
          this.recargar();
        },
        error: () => {
          this.saldando.set(null);
          this.toasts.show({
            type: 'error',
            message: 'No se pudo registrar. Probá de nuevo en un momento.',
          });
        },
      });
  }

  /** El nombre de una cuenta como lo lee un médico. Ver `NOMBRE_LLANO`. */
  nombreDe(linea: FinancialStatementLine): string {
    if (linea.code !== undefined && NOMBRE_LLANO[linea.code] !== undefined) {
      return NOMBRE_LLANO[linea.code]!;
    }
    return linea.name ?? linea.code ?? 'Sin nombre';
  }

  readonly importe = importeBs;
  readonly enCero = esCero;
  readonly negativo = esNegativo;

  claveDePartida(fila: FilaDePartida): string {
    return fila.id;
  }
}
