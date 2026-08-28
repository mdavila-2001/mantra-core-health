import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { ClinicalClient } from '../../../core/data-access/clinical/clinical.client';
import type { ClinicalSummary } from '../../../core/data-access/clinical/clinical.types';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type { Booking } from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { MIS_TURNOS_ROUTE } from '../../account/appointments/appointments.routes';
import { MI_HISTORIA_ROUTE } from '../../account/medical-record/medical-record.routes';
import { SymptomCheck } from '../../symptom-check/symptom-check';

/** Un lugar al que el paciente puede ir desde su panel. */
interface AccesoDelPaciente {
  readonly ruta: string;
  readonly etiqueta: string;
  readonly icono: NavIconName;
  /** Qué hace, para el globo y para el nombre accesible. */
  readonly resumen: string;
}

/**
 * Las secciones del menú que además son del paciente.
 *
 * Allowlist y no denylist: una sección nueva del producto no aparece sola en el
 * panel de quien viene a atenderse —aparecería la de facturación el día que se
 * habilite—, y sumarla es una decisión, no un efecto.
 */
const SECCIONES_DEL_PACIENTE: readonly string[] = [
  'directory',
  'laboratory-directory',
  'messaging',
];

/** Cuántas filas se piden de la historia: acá sólo se muestra lo último. */
const TOPE = 20;

/** Lo que el panel necesita saber, ya resuelto. */
interface Resumen {
  /** El turno que viene, o `null` si no hay ninguno por delante. */
  readonly proximoTurno: Booking | null;
  /** La última receta emitida, o `null` si todavía no le recetaron nada. */
  readonly ultimaReceta: Date | null;
  /** La última atención cerrada, o `null` si nunca se atendió. */
  readonly ultimaAtencion: Date | null;
}

/**
 * El panel de quien viene a atenderse — «Mi salud».
 *
 * ## Por qué existe
 *
 * El panel era uno solo y estaba escrito para quien administra: «Organizaciones:
 * 1», «Secciones disponibles: 12», «Tu organización, tus accesos y el estado del
 * sistema». Un paciente entraba y leía el tablero de otra persona, con
 * vocabulario que no es el suyo —organización, secciones, roles, estado del
 * sistema—. Lo marcó la analista (F-16 y F-17) y tiene razón: el paciente no
 * viene a administrar nada, viene a ver **lo suyo**.
 *
 * ## Qué muestra, y de dónde sale
 *
 * Nada que no exista ya: el próximo turno sale del mismo listado que la pantalla
 * de turnos, y la última atención y la última receta del resumen clínico que la
 * historia ya lee. No hay lectura nueva ni endpoint nuevo — es la misma
 * información puesta donde alguien la busca al entrar.
 *
 * ## Lo que todavía no está
 *
 * Los avisos (P1) y las órdenes de laboratorio (J1) tienen su lugar reservado y
 * dicho en pantalla. Se prefiere decir «acá va a aparecer» a no mostrar nada:
 * una tarjeta ausente no se distingue de una función que no existe.
 */
@Component({
  selector: 'app-patient-home',
  imports: [
    AppButtonLink,
    Card,
    DatePipe,
    NavIcon,
    PageHeader,
    RouterLink,
    SymptomCheck,
    Tooltip,
  ],
  templateUrl: './patient-home.html',
  styleUrl: './patient-home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientHome {
  private readonly auth = inject(AuthService);
  private readonly scheduling = inject(SchedulingClient);
  private readonly clinical = inject(ClinicalClient);

  private readonly navigation = inject(NavigationService);

  protected readonly misTurnos = MIS_TURNOS_ROUTE;
  protected readonly miHistoria = MI_HISTORIA_ROUTE;

  /**
   * Los lugares a los que va un paciente, como grilla de tarjetas con ícono.
   *
   * **Por qué existe así (F-21).** El panel anterior tenía esta grilla y la
   * gente ya la conocía; «Mi salud» los dejó como una fila de texto abajo y se
   * sintió como una pérdida. No se vuelve al panel viejo: se recupera su forma
   * —el mismo ícono, la misma tarjeta— para los destinos del paciente.
   *
   * Son de dos orígenes y por eso se arman acá:
   *
   * - **Lo suyo** (turnos, historia, datos) no son secciones del menú: son
   *   pantallas de su cuenta, y ningún registro de navegación las declara.
   * - **Las secciones** (guía, laboratorios, mensajes) sí, y se toman de
   *   `NavigationService` —el mismo origen que el menú— en vez de copiarlas:
   *   si mañana una deja de estar disponible para un paciente, desaparece de
   *   los dos lados a la vez. Se filtran por ruta porque el panel del paciente
   *   es una selección curada, no el menú entero.
   */
  protected readonly accesos = computed<readonly AccesoDelPaciente[]>(() => {
    const propios: AccesoDelPaciente[] = [
      {
        ruta: MIS_TURNOS_ROUTE,
        etiqueta: 'Mis citas',
        icono: 'calendar',
        resumen: 'Los turnos que pediste y los horarios que podés pedir.',
      },
      {
        ruta: MI_HISTORIA_ROUTE,
        etiqueta: 'Mi historia',
        icono: 'results',
        resumen: 'Tus atenciones y tus recetas, para ver y descargar.',
      },
    ];

    const secciones = this.navigation
      .visibleSections()
      .filter((seccion) => SECCIONES_DEL_PACIENTE.includes(seccion.path))
      .map((seccion) => ({
        ruta: `/${seccion.path}`,
        etiqueta: seccion.label,
        icono: seccion.icon,
        resumen: seccion.summary,
      }));

    return [
      ...propios,
      ...secciones,
      {
        ruta: '/my-account',
        etiqueta: 'Mis datos',
        icono: 'settings' as NavIconName,
        resumen: 'Tu información personal y la de contacto.',
      },
    ];
  });

  /** El nombre con el que saludar. Vacío si el token no lo trae. */
  protected readonly nombre = computed(() => this.auth.displayName() ?? '');

  protected readonly estado = signal<ViewState<Resumen>>(loading());

  /** Lo cargado, o el vacío de quien todavía no tiene nada. */
  protected readonly resumen = computed<Resumen>(() => {
    const actual = this.estado();
    return actual.status === 'ready'
      ? actual.data
      : { proximoTurno: null, ultimaReceta: null, ultimaAtencion: null };
  });

  /** Quien no tiene nada todavía ve una invitación, no una pantalla vacía. */
  protected readonly primeraVez = computed(() => {
    const datos = this.resumen();
    return (
      datos.proximoTurno === null && datos.ultimaReceta === null && datos.ultimaAtencion === null
    );
  });

  constructor() {
    this.cargar();
  }

  /**
   * Las dos lecturas del panel, en paralelo y tolerantes.
   *
   * Si una falla, la otra se muestra igual: media pantalla útil es mejor que un
   * error que tapa lo que sí se pudo leer. El caso en que las dos fallan sí se
   * dice, porque entonces no hay nada que mirar.
   */
  private cargar(): void {
    const perfil = this.auth.patientProfileId();
    if (perfil === null) {
      this.estado.set(
        empty(
          { label: 'Ir a mis turnos', route: MIS_TURNOS_ROUTE },
          'Tu cuenta todavía no tiene una ficha de paciente.',
        ),
      );
      return;
    }

    this.estado.set(loading());
    forkJoin({
      turnos: this.scheduling
        .searchBookings({ patientProfileId: perfil, limit: TOPE })
        .pipe(catchError(() => of(null))),
      historia: this.clinical.getSummary(perfil, TOPE).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ turnos, historia }) => {
        if (turnos === null && historia === null) {
          this.estado.set(errorToViewState(new Error('sin datos')));
          return;
        }
        this.estado.set(
          ready({
            proximoTurno: proximo(turnos?.items ?? []),
            ultimaReceta: ultimaFecha(historia, 'receta'),
            ultimaAtencion: ultimaFecha(historia, 'atencion'),
          }),
        );
      },
    });
  }
}

/**
 * El turno más próximo de los que todavía no pasaron.
 *
 * Se resuelve acá y no se confía en el orden de la respuesta: el listado trae
 * las citas del paciente sin garantizar cuál viene primero.
 */
function proximo(citas: readonly Booking[]): Booking | null {
  const ahora = Date.now();
  const futuras = citas
    .filter((cita) => cita.startAt !== undefined && cita.startAt.getTime() >= ahora)
    .sort((a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0));
  return futuras[0] ?? null;
}

/** La fecha más reciente de las recetas emitidas o de las atenciones cerradas. */
function ultimaFecha(historia: ClinicalSummary | null, que: 'receta' | 'atencion'): Date | null {
  if (historia === null) return null;
  const fechas =
    que === 'receta'
      ? historia.medicationRequests.map((receta) => receta.issuedAt ?? receta.signedAt)
      : historia.encounters.map((atencion) => atencion.endAt ?? atencion.startAt);
  const validas = fechas.filter((fecha): fecha is Date => fecha instanceof Date);
  if (validas.length === 0) return null;
  return validas.reduce((mayor, fecha) => (fecha.getTime() > mayor.getTime() ? fecha : mayor));
}
