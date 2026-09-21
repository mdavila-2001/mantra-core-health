import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type { ActivityTypeOption, Booking } from '@core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '@core/data-access/terminology/terminology.client';
import type { ValueSetOption } from '@core/data-access/terminology/terminology.types';
import { errorToViewState } from '@core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { Chip } from '@shared/components/atoms/chip/chip';
import type { ChipVariant } from '@shared/components/atoms/chip/chip.types';
import { Switch } from '@shared/components/atoms/switch/switch';
import { Tooltip } from '@shared/components/atoms/tooltip/tooltip';
import { Card } from '@shared/components/molecules/card/card';
import { NEUTRAL_TONE, TONES } from '@shared/components/tone/tone.types';
import { StatusSeal } from '@shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';

import { toBookingStatusPresentation } from '../../agenda/booking-status';
import { misRecursosDeAgenda } from '../../agenda/mi-recurso';

/**
 * Reporte de consultas del panel de inicio (C-24, H5 del reparto de Ender
 * 2026-09-20: "El panel dice la verdad").
 *
 * ## De dónde salen las cifras (H5.S1)
 *
 * No hay ningún endpoint de analítica de consultas en la API real: el módulo
 * `reporting` es un motor de definiciones de reporte con verbos `POST`
 * (`data-sources`, `definitions`, `executions`…), no una lectura servida. El
 * único precedente de analítica **servida** es de seguros
 * (`GET /insurance/analytics/loss-ratio`), y ahí el patrón es agregar en el
 * cliente sobre lo que la agenda ya lee — no inventar un endpoint nuevo.
 *
 * Esta pantalla sigue ese mismo camino: agrega en el cliente sobre
 * `GET /scheduling/bookings` (mismo endpoint que ya usa `AgendaDeHoy`), para
 * el mes calendario que contiene «hoy». Consecuencia declarada: **esta cifra
 * hoy sólo existe en la maqueta.** Para que exista fuera de ella hace falta
 * un endpoint de agregación real en `reporting` o en `scheduling` — decisión
 * de negocio, no de este simulador.
 *
 * ## Semana, mes y zona horaria (H5.S1.M4)
 *
 * La semana es lunes a domingo (convención boliviana/ISO), el mes es el
 * calendario del navegador, y las dos ventanas se calculan en la hora local
 * del navegador — la misma que usa el resto de la agenda (no hay un origen de
 * tiempo de servidor con el que contrastar en un simulador).
 */
@Component({
  selector: 'app-consultas-resumen',
  imports: [Card, Chip, StatusSeal, Switch, Tooltip, ViewStateHost],
  templateUrl: './consultas-resumen.html',
  styleUrl: './consultas-resumen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultasResumen {
  private readonly auth = inject(AuthService);
  private readonly scheduling = inject(SchedulingClient);
  private readonly terminology = inject(TerminologyClient);

  protected readonly estado = signal<ViewState<ResumenDatos>>(loading());

  /**
   * «Las canceladas se pueden ver» (H5.S2.M1): mismo criterio que
   * `incluirCanceladas()` de la agenda (`features/agenda/agenda.ts`) — no se
   * inventa un estado nuevo, se reusa el mismo booleano con el mismo sentido.
   * Por defecto en `false`: un reporte que abre contando lo cancelado sobre-
   * cuenta la jornada real.
   */
  protected readonly incluirCanceladas = signal(false);

  protected readonly conceptos = signal<ReadonlyMap<string, ValueSetOption>>(new Map());

  private readonly citasNoCanceladas = computed(() => {
    const datos = dataOf(this.estado());
    if (datos === null) return [] as readonly Booking[];
    return datos.citas.filter((cita) => !this.esCancelada(cita));
  });

  private readonly citasVisibles = computed(() =>
    this.incluirCanceladas() ? (dataOf(this.estado())?.citas ?? []) : this.citasNoCanceladas(),
  );

  protected readonly resumenSemana = computed(() => this.contarEnVentana(this.ventanaSemana()));
  protected readonly resumenMes = computed(() => this.contarEnVentana(this.ventanaMes()));

  protected readonly canceladasDelMes = computed(() => {
    const datos = dataOf(this.estado());
    if (datos === null) return 0;
    const { desde, hasta } = this.ventanaMes();
    return datos.citas.filter(
      (cita) => this.esCancelada(cita) && dentroDe(cita, desde, hasta),
    ).length;
  });

  /** Hora × día de la semana, sobre el mes completo, sin contar canceladas. */
  protected readonly mapaDeCalor = computed<HeatmapData>(() => {
    const { desde, hasta } = this.ventanaMes();
    const celdas = DIAS.map(() => new Array<number>(HORAS.length).fill(0));
    for (const cita of this.citasNoCanceladas()) {
      if (!dentroDe(cita, desde, hasta) || cita.startAt === undefined) continue;
      const dia = (cita.startAt.getDay() + 6) % 7; // lunes=0 … domingo=6
      const hora = cita.startAt.getHours();
      const columna = hora - HORA_INICIO;
      if (columna < 0 || columna >= HORAS.length) continue;
      celdas[dia]![columna] += 1;
    }
    const maximo = Math.max(0, ...celdas.flat());
    return { celdas, maximo };
  });

  /** Actividades que no son consulta ni control: cirugías, tomas de muestra, etc. (C-24). */
  protected readonly otrasAtenciones = computed<readonly ActividadResumen[]>(() => {
    const datos = dataOf(this.estado());
    if (datos === null) return [];
    const { desde, hasta } = this.ventanaMes();
    const porTipo = new Map<string, number>();
    for (const cita of this.citasVisibles()) {
      if (!dentroDe(cita, desde, hasta)) continue;
      const tipo = datos.actividades.find((a) => a.conceptId === cita.serviceConceptId);
      if (tipo === undefined || OTRAS_ATENCIONES_EXCLUIDAS.has(tipo.type)) continue;
      porTipo.set(tipo.type, (porTipo.get(tipo.type) ?? 0) + 1);
    }
    return datos.actividades
      .filter((a) => porTipo.has(a.type))
      .map((a) => ({ label: a.label, tone: asChipVariant(a.tone), total: porTipo.get(a.type)! }));
  });

  constructor() {
    this.cargar();
  }

  protected reintentar(): void {
    this.cargar();
  }

  private cargar(): void {
    const perfil = this.auth.practitionerProfileId();
    const tenantId = this.auth.activeTenantId();
    if (perfil === null || tenantId === null) {
      this.estado.set(empty({ label: 'Ver la agenda', route: '/schedule' }, 'Esta cuenta no tiene consultas propias.'));
      return;
    }

    this.estado.set(loading());
    const { desde, hasta } = this.ventanaMes();

    misRecursosDeAgenda(this.scheduling, tenantId, perfil)
      .pipe(
        switchMap((recursos) => {
          if (recursos.length === 0) return of(null);
          return forkJoin(
            recursos.map((recurso) =>
              this.scheduling
                .searchBookings({ resourceId: recurso.id, from: desde, to: hasta, includeCancelled: true, limit: 500 })
                .pipe(catchError(() => of({ items: [] as readonly Booking[], count: 0, limit: 500, truncated: false }))),
            ),
          );
        }),
      )
      .subscribe({
        next: (paginas) => {
          if (paginas === null) {
            this.estado.set(empty({ label: 'Publicar mi horario', route: '/schedule' }, 'Todavía no tenés una agenda publicada.'));
            return;
          }
          const citas = paginas.flatMap((pagina) => pagina.items);
          this.terminology.readConceptLabels(citas.map((c) => c.statusConceptId)).subscribe({
            next: (etiquetas) => this.conceptos.set(etiquetas),
            error: () => undefined,
          });
          this.scheduling.listActivityTypes().subscribe({
            next: ({ items: actividades }) => {
              if (citas.length === 0) {
                this.estado.set(empty({ label: 'Agendar una consulta', route: '/schedule' }, 'Todavía no hay consultas este mes.'));
                return;
              }
              this.estado.set(ready({ citas, actividades }));
            },
            error: (error: unknown) => this.estado.set(errorToViewState<ResumenDatos>(error)),
          });
        },
        error: (error: unknown) => this.estado.set(errorToViewState<ResumenDatos>(error)),
      });
  }

  protected labelDeHora(hora: number): string {
    return `${String(hora).padStart(2, '0')}:00`;
  }

  protected labelDeDia(indice: number): string {
    return DIAS[indice]!;
  }

  protected celdaAriaLabel(dia: number, hora: number, valor: number): string {
    const cantidad = valor === 1 ? '1 consulta' : `${valor} consultas`;
    return `${DIAS_LARGOS[dia]} a las ${this.labelDeHora(HORAS[hora]!)}: ${cantidad}`;
  }

  protected intensidad(valor: number, maximo: number): number {
    if (maximo === 0) return 0;
    return Math.min(4, Math.ceil((valor / maximo) * 4));
  }

  private esCancelada(cita: Booking): boolean {
    const presentacion = toBookingStatusPresentation(this.conceptos().get(cita.statusConceptId), '');
    return presentacion.code === 'BOOKING_CANCELLED';
  }

  private ventanaSemana(): Ventana {
    const hoy = new Date();
    const diaSemanaLunes0 = (hoy.getDay() + 6) % 7;
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diaSemanaLunes0);
    const hasta = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 7);
    return { desde, hasta };
  }

  private ventanaMes(): Ventana {
    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    return { desde, hasta };
  }

  private contarEnVentana(ventana: Ventana): ConteoDeVentana {
    const citas = this.citasVisibles().filter((cita) => dentroDe(cita, ventana.desde, ventana.hasta));
    const canceladas = citas.filter((cita) => this.esCancelada(cita)).length;
    return { total: citas.length, canceladas };
  }
}

/** Lunes a las 06:00 hasta domingo 19:00 — mismo horario clínico que declara `AgendaDeHoy`. */
const HORA_INICIO = 6;
const HORA_FIN = 19;
const HORAS: readonly number[] = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);
const DIAS: readonly string[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIAS_LARGOS: readonly string[] = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

/** `PROCEDURE`, `TELEHEALTH` y `EXAM` son "otras atenciones"; consulta y control no. */
const OTRAS_ATENCIONES_EXCLUIDAS = new Set(['CONSULTATION', 'FOLLOW_UP']);

interface Ventana {
  readonly desde: Date;
  readonly hasta: Date;
}

interface ResumenDatos {
  readonly citas: readonly Booking[];
  readonly actividades: readonly ActivityTypeOption[];
}

interface ConteoDeVentana {
  readonly total: number;
  readonly canceladas: number;
}

interface ActividadResumen {
  readonly label: string;
  readonly tone: ChipVariant;
  readonly total: number;
}

/**
 * `ActivityTypeOption.tone` es `string` porque lo declara la API sin acotar
 * (`tone: string`, no un enum). Un tono que esta versión del sistema de
 * diseño no reconozca cae a `neutral` — igual que un estado de reserva que el
 * catálogo todavía no resolvió cae a su variante neutra en `booking-status.ts`.
 */
function asChipVariant(tone: string): ChipVariant {
  return (TONES as readonly string[]).includes(tone) ? (tone as ChipVariant) : NEUTRAL_TONE;
}

interface HeatmapData {
  readonly celdas: readonly (readonly number[])[];
  readonly maximo: number;
}

function dentroDe(cita: Booking, desde: Date, hasta: Date): boolean {
  const inicio = cita.startAt;
  return inicio !== undefined && inicio >= desde && inicio < hasta;
}
