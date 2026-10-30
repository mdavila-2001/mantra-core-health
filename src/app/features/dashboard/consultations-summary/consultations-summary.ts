import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type {
  ActivityTypeOption,
  AgendaResource,
  Booking,
} from '@core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '@core/data-access/terminology/terminology.client';
import type { ValueSetOption } from '@core/data-access/terminology/terminology.types';
import { describeApiFailure } from '@core/http/api-failure';
import { errorToViewState } from '@core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { Chip } from '@shared/components/atoms/chip/chip';
import type { ChipVariant } from '@shared/components/atoms/chip/chip.types';
import { Switch } from '@shared/components/atoms/switch/switch';
import { Tooltip } from '@shared/components/atoms/tooltip/tooltip';
import { Alert } from '@shared/components/molecules/alert/alert';
import { Card } from '@shared/components/molecules/card/card';
import { NEUTRAL_TONE, TONES } from '@shared/components/tone/tone.types';
import { StatusSeal } from '@shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';

import { toBookingStatusPresentation } from '../../agenda/booking-status';
import { agendaResourcesMy } from '../../agenda/my-resource';

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
  selector: 'app-consultations-summary',
  imports: [Alert, AppButton, Card, Chip, StatusSeal, Switch, Tooltip, ViewStateHost],
  templateUrl: './consultations-summary.html',
  styleUrl: './consultations-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryConsultations {
  private readonly auth = inject(AuthService);
  private readonly scheduling = inject(SchedulingClient);
  private readonly terminology = inject(TerminologyClient);

  protected readonly status = signal<ViewState<DataSummary>>(loading());

  /**
   * Las sedes cuya lectura falló, dichas para la persona.
   *
   * Una sede caída no tumba el resumen, pero sus consultas faltan en las
   * cifras: sin este aviso, «12 este mes» se leía como el total cuando era el
   * total de las sedes que respondieron.
   */
  protected readonly sitesWithoutLoad = signal<readonly string[]>([]);

  /**
   * «Las canceladas se pueden ver» (H5.S2.M1): mismo criterio que
   * `incluirCanceladas()` de la agenda (`features/agenda/agenda.ts`) — no se
   * inventa un estado nuevo, se reusa el mismo booleano con el mismo sentido.
   * Por defecto en `false`: un reporte que abre contando lo cancelado sobre-
   * cuenta la jornada real.
   */
  protected readonly includeCancelled = signal(false);

  protected readonly concepts = signal<ReadonlyMap<string, ValueSetOption>>(new Map());

  private readonly appointmentsNotCancelled = computed(() => {
    const datos = dataOf(this.status());
    if (datos === null) return [] as readonly Booking[];
    return datos.citas.filter((cita) => !this.isCancelled(cita));
  });

  private readonly visibleAppointments = computed(() =>
    this.includeCancelled() ? (dataOf(this.status())?.citas ?? []) : this.appointmentsNotCancelled(),
  );

  protected readonly weekSummary = computed(() => this.countInWindow(this.weekWindow()));
  protected readonly monthSummary = computed(() => this.countInWindow(this.monthWindow()));

  protected readonly monthCancelled = computed(() => {
    const datos = dataOf(this.status());
    if (datos === null) return 0;
    const { desde, hasta } = this.monthWindow();
    return datos.citas.filter(
      (cita) => this.isCancelled(cita) && withinOf(cita, desde, hasta),
    ).length;
  });

  /** Hora × día de la semana, sobre el mes completo, sin contar canceladas. */
  protected readonly heatMap = computed<HeatmapData>(() => {
    const { desde, hasta } = this.monthWindow();
    const celdas = DAYS.map(() => new Array<number>(HOURS.length).fill(0));
    for (const cita of this.appointmentsNotCancelled()) {
      if (!withinOf(cita, desde, hasta) || cita.startAt === undefined) continue;
      const dia = (cita.startAt.getDay() + 6) % 7; // lunes=0 … domingo=6
      const hora = cita.startAt.getHours();
      const columna = hora - START_TIME;
      if (columna < 0 || columna >= HOURS.length) continue;
      celdas[dia]![columna] += 1;
    }
    const maximo = Math.max(0, ...celdas.flat());
    return { celdas, maximo };
  });

  /** Actividades que no son consulta ni control: cirugías, tomas de muestra, etc. (C-24). */
  protected readonly otherVisits = computed<readonly SummaryActivity[]>(() => {
    const datos = dataOf(this.status());
    if (datos === null) return [];
    const { desde, hasta } = this.monthWindow();
    const porTipo = new Map<string, number>();
    for (const cita of this.visibleAppointments()) {
      if (!withinOf(cita, desde, hasta)) continue;
      const tipo = datos.actividades.find((a) => a.conceptId === cita.serviceConceptId);
      if (tipo === undefined || OTHER_EXCLUDED_VISITS.has(tipo.type)) continue;
      porTipo.set(tipo.type, (porTipo.get(tipo.type) ?? 0) + 1);
    }
    return datos.actividades
      .filter((a) => porTipo.has(a.type))
      .map((a) => ({ label: a.label, tone: asChipVariant(a.tone), total: porTipo.get(a.type)! }));
  });

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  private load(): void {
    const perfil = this.auth.practitionerProfileId();
    const tenantId = this.auth.activeTenantId();
    if (perfil === null || tenantId === null) {
      this.status.set(empty({ label: 'Ver la agenda', route: '/schedule' }, 'Esta cuenta no tiene consultas propias.'));
      return;
    }

    this.status.set(loading());
    this.sitesWithoutLoad.set([]);
    const { desde, hasta } = this.monthWindow();

    agendaResourcesMy(this.scheduling, tenantId, perfil)
      .pipe(
        switchMap((recursos) => {
          if (recursos.length === 0) return of(null);
          return forkJoin(
            recursos.map((recurso) =>
              this.scheduling
                .searchBookings({ resourceId: recurso.id, from: desde, to: hasta, includeCancelled: true, limit: 500 })
                .pipe(
                  map((pagina): SiteReading => ({ recurso, citas: pagina.items, fallo: null })),
                  // La sede caída no tumba el resumen, pero su fallo viaja con
                  // ella para avisarlo: si no, sus consultas faltan sin rastro.
                  catchError((error: unknown) => of<SiteReading>({ recurso, citas: [], fallo: { error } })),
                ),
            ),
          );
        }),
      )
      .subscribe({
        next: (lecturas) => {
          if (lecturas === null) {
            this.status.set(empty({ label: 'Publicar mi horario', route: '/schedule' }, 'Todavía no tiene una agenda publicada.'));
            return;
          }
          const fallidas = lecturas.filter((lectura) => lectura.fallo !== null);
          const primerFallo = fallidas[0]?.fallo;
          if (primerFallo != null && fallidas.length === lecturas.length) {
            this.status.set(errorToViewState<DataSummary>(primerFallo.error));
            return;
          }
          this.sitesWithoutLoad.set(
            fallidas.map(({ recurso, fallo }) =>
              describeApiFailure(
                fallo?.error,
                `No se pudieron cargar las consultas de ${recurso.site?.name ?? 'una de sus agendas'}.`,
              ),
            ),
          );
          const citas = lecturas.flatMap((lectura) => lectura.citas);
          this.terminology.readConceptLabels(citas.map((c) => c.statusConceptId)).subscribe({
            next: (etiquetas) => this.concepts.set(etiquetas),
            error: () => undefined,
          });
          this.scheduling.listActivityTypes().subscribe({
            next: ({ items: actividades }) => {
              if (citas.length === 0) {
                this.status.set(
                  empty(
                    { label: 'Agendar una consulta', route: '/schedule' },
                    fallidas.length > 0
                      ? 'No hay consultas este mes en las agendas que se pudieron cargar.'
                      : 'Todavía no hay consultas este mes.',
                  ),
                );
                return;
              }
              this.status.set(ready({ citas, actividades }));
            },
            error: (error: unknown) => this.status.set(errorToViewState<DataSummary>(error)),
          });
        },
        error: (error: unknown) => this.status.set(errorToViewState<DataSummary>(error)),
      });
  }

  protected timeLabel(hora: number): string {
    return `${String(hora).padStart(2, '0')}:00`;
  }

  protected dayLabel(indice: number): string {
    return DAYS[indice]!;
  }

  protected cellAriaLabel(dia: number, hora: number, valor: number): string {
    const cantidad = valor === 1 ? '1 consulta' : `${valor} consultas`;
    return `${LENGTHS_DAYS[dia]} a las ${this.timeLabel(HOURS[hora]!)}: ${cantidad}`;
  }

  protected intensity(valor: number, maximo: number): number {
    if (maximo === 0) return 0;
    return Math.min(4, Math.ceil((valor / maximo) * 4));
  }

  private isCancelled(cita: Booking): boolean {
    const presentacion = toBookingStatusPresentation(this.concepts().get(cita.statusConceptId), '');
    return presentacion.code === 'BOOKING_CANCELLED';
  }

  private weekWindow(): Window {
    const hoy = new Date();
    const diaSemanaLunes0 = (hoy.getDay() + 6) % 7;
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diaSemanaLunes0);
    const hasta = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 7);
    return { desde, hasta };
  }

  private monthWindow(): Window {
    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    return { desde, hasta };
  }

  private countInWindow(ventana: Window): WindowCount {
    const citas = this.visibleAppointments().filter((cita) => withinOf(cita, ventana.desde, ventana.hasta));
    const canceladas = citas.filter((cita) => this.isCancelled(cita)).length;
    return { total: citas.length, canceladas };
  }
}

/** Lunes a las 06:00 hasta domingo 19:00 — mismo horario clínico que declara `AgendaDeHoy`. */
const START_TIME = 6;
const END_TIME = 19;
const HOURS: readonly number[] = Array.from({ length: END_TIME - START_TIME }, (_, i) => START_TIME + i);
const DAYS: readonly string[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const LENGTHS_DAYS: readonly string[] = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

/** `PROCEDURE`, `TELEHEALTH` y `EXAM` son "otras atenciones"; consulta y control no. */
const OTHER_EXCLUDED_VISITS = new Set(['CONSULTATION', 'FOLLOW_UP']);

interface Window {
  readonly desde: Date;
  readonly hasta: Date;
}

interface DataSummary {
  readonly citas: readonly Booking[];
  readonly actividades: readonly ActivityTypeOption[];
}

interface WindowCount {
  readonly total: number;
  readonly canceladas: number;
}

interface SummaryActivity {
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

function withinOf(cita: Booking, desde: Date, hasta: Date): boolean {
  const inicio = cita.startAt;
  return inicio !== undefined && inicio >= desde && inicio < hasta;
}

/** Lo que trajo la lectura de una agenda: sus citas, o el fallo que la dejó vacía. */
interface SiteReading {
  readonly recurso: AgendaResource;
  readonly citas: readonly Booking[];
  readonly fallo: { readonly error: unknown } | null;
}
