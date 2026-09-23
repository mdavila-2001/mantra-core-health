import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { ClinicalClient } from '../../../core/data-access/clinical/clinical.client';
import type { ClinicalSummary } from '../../../core/data-access/clinical/clinical.types';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type { Booking } from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { MIS_TURNOS_ROUTE } from '../../account/appointments/appointments.routes';
import { MI_HISTORIA_ROUTE } from '../../account/medical-record/medical-record.routes';
import { SymptomCheck } from '../../symptom-check/symptom-check';

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
 * FT-03-R03 · Con quién y dónde es la próxima cita.
 *
 * La reserva sólo trae `resourceId`; el nombre del profesional y el consultorio
 * viven en el catálogo de recursos. Se resuelven en una lectura aparte porque
 * la jerarquía que pide FT-03 empieza por el «cuándo» —que ya está— y sigue por
 * el «con quién»: sin esto la tarjeta decía la hora y nada más, que es
 * exactamente lo que el pedido llamaba «falta de jerarquía».
 *
 * Los dos campos pueden quedar vacíos y la plantilla omite la línea en vez de
 * mostrar un hueco o el identificador del recurso.
 */
interface DondeYConQuien {
  /** El profesional, o el nombre de la sala/equipo si no hay persona detrás. */
  readonly profesional: string;
  /** El consultorio o sede, en palabras. Vacío si el recurso no tiene sede. */
  readonly lugar: string;
}

/** El vacío de `DondeYConQuien`, para no repetir el literal. */
const SIN_AGENDA: DondeYConQuien = { profesional: '', lugar: '' };

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
 *
 * ## Lo que se quitó
 *
 * La grilla de accesos «Ir a lo tuyo» (F-21), a pedido del doctor (P-03,
 * 22/09/2026: «sacar el panel de abajo»; Pablo confirmó que era esa grilla).
 * Los destinos no se perdieron: turnos e historia se alcanzan desde las
 * tarjetas del resumen, y el resto —guía, laboratorios, mensajes, datos—
 * desde el menú, que es el mismo origen del que la grilla los copiaba.
 */
@Component({
  selector: 'app-patient-home',
  imports: [AppButtonLink, Card, DatePipe, NavIcon, PageHeader, RouterLink, SymptomCheck],
  templateUrl: './patient-home.html',
  styleUrl: './patient-home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientHome {
  private readonly auth = inject(AuthService);
  private readonly scheduling = inject(SchedulingClient);
  private readonly clinical = inject(ClinicalClient);

  protected readonly misTurnos = MIS_TURNOS_ROUTE;
  protected readonly miHistoria = MI_HISTORIA_ROUTE;

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

  /**
   * FT-03-R03 · Con quién y dónde es la próxima cita.
   *
   * Se llena después de saber cuál es la cita: la lectura de recursos exige
   * organización, y pedirla antes de tener un turno sería una petición que casi
   * siempre se descarta. Vacío mientras no se sepa.
   */
  protected readonly dondeYConQuien = signal<DondeYConQuien>(SIN_AGENDA);

  /**
   * FT-03-R06 · Los tres estados del bloque de la próxima cita, en una palabra.
   *
   * La plantilla los necesita separados del `ViewState` general porque el
   * bloque de la cita tiene un vacío propio —«no tenés citas pedidas»— que no
   * es el vacío del panel entero —«tu cuenta no tiene ficha de paciente»—.
   */
  protected readonly estadoDeLaCita = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
    const actual = this.estado();
    if (actual.status === 'loading') return 'loading';
    if (actual.status === 'error') return 'error';
    return this.resumen().proximoTurno === null ? 'empty' : 'ready';
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
        const proximoTurno = proximo(turnos?.items ?? []);
        this.estado.set(
          ready({
            proximoTurno,
            ultimaReceta: ultimaFecha(historia, 'receta'),
            ultimaAtencion: ultimaFecha(historia, 'atencion'),
          }),
        );
        this.resolverAgenda(proximoTurno);
      },
    });
  }

  /**
   * FT-03-R03 · Quién atiende y dónde, para la tarjeta de la próxima cita.
   *
   * Tolerante a propósito: si el catálogo de recursos no se puede leer, la
   * tarjeta muestra igual el cuándo, que es el dato por el que se entra. Un
   * error acá no puede vaciar el bloque entero.
   */
  private resolverAgenda(turno: Booking | null): void {
    this.dondeYConQuien.set(SIN_AGENDA);
    const tenantId = this.auth.activeTenantId();
    const resourceId = turno?.resourceId;
    if (tenantId === null || resourceId === undefined || resourceId === '') {
      return;
    }
    this.scheduling
      .listResources({ tenantId })
      .pipe(catchError(() => of(null)))
      .subscribe((pagina) => {
        const recurso = pagina?.items.find((candidato) => candidato.id === resourceId);
        if (recurso === undefined) {
          return;
        }
        this.dondeYConQuien.set({
          profesional: recurso.practitionerName ?? recurso.name,
          lugar: recurso.site?.name ?? '',
        });
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
