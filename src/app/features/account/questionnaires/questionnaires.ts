import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, timeout } from 'rxjs';

import { CommunityClient } from '../../../core/data-access/community/community.client';
import type { ReviewableCare } from '../../../core/data-access/community/community.types';
import { PatientSurveyInbox } from '../../../core/patient-surveys/patient-survey-inbox';
import { SurveysClient } from '../../../core/data-access/surveys/surveys.client';
import type {
  InvitationStatus,
  PatientInvitation,
} from '../../../core/data-access/surveys/surveys.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { RateEncounterDialog } from '../../public-profile/rate-encounter-dialog/rate-encounter-dialog';
import { MIS_TURNOS_ROUTE } from '../appointments/appointments.routes';
import { MedicalAspects } from './medical-aspects/medical-aspects';
import { responderCuestionarioRoute } from './questionnaires.routes';

/* ---- FT-22 · las dos pestañas -------------------------------------------- */

/** El parámetro que dice qué pestaña se está mirando. */
const PARAM_DE_SECCION = 'seccion';

/**
 * Las pestañas, en el orden en que se dibujan.
 *
 * Aspectos médicos primero: es lo que la persona puede completar cuando quiera,
 * mientras que las encuestas aparecen sólo cuando alguien se las manda. Entrar a
 * la pestaña de las encuestas y encontrarla vacía se lee como «esta pantalla no
 * sirve».
 */
const SECCIONES = ['aspectos', 'encuestas'] as const;

/**
 * Cuántas encuestas respondidas se consultan, como mucho, para ofrecer
 * «Dejar reseña pública». La pregunta es una por reserva (no hay lectura en
 * lote), así que se acota a las más recientes: quien tiene muchas respondidas
 * no dispara una ráfaga de peticiones al abrir la pantalla.
 */
const MAX_CONSULTAS_DE_RESENA = 5;

/** Cuánto se espera la respuesta de cada una; es un extra de la lista. */
const ESPERA_DE_RESENA_MS = 5_000;

/** Cómo se pinta cada estado del cuestionario. */
const PRESENTACION: Readonly<
  Record<InvitationStatus, { readonly palabra: string; readonly tono: BadgeVariant }>
> = {
  PENDING: { palabra: 'Pendiente', tono: 'warning' },
  ANSWERED: { palabra: 'Respondido', tono: 'success' },
  EXPIRED: { palabra: 'Vencido', tono: 'secondary' },
};

/** Un cuestionario del paciente, listo para mostrarse. */
interface CuestionarioVisible {
  readonly id: string;
  readonly titulo: string;
  readonly consigna: string;
  readonly estado: InvitationStatus;
  readonly palabra: string;
  readonly tono: BadgeVariant;
  readonly vence: Date | null;
  readonly respondido: Date | null;
  /** La reserva de la atención: con ella se pregunta si se puede reseñar. */
  readonly reservaId: string;
  /** Solo los pendientes se pueden abrir para responder. */
  readonly sePuedeResponder: boolean;
  readonly ruta: string;
}

/**
 * «Mis cuestionarios»: las encuestas que el paciente tiene para responder.
 *
 * ## Qué corrige esta pantalla
 *
 * La corrección #9 del usuario decía «se sigue sin poder ver cuestionarios», y
 * el diagnóstico era más simple de lo que parecía: **no había nada que ver**.
 * El dominio de encuestas no existía en ninguna capa —ni tabla, ni endpoint, ni
 * pantalla—, así que no era una vista rota sino una ausente.
 *
 * ## Por qué el listado no filtra por estado
 *
 * Se muestran los tres estados juntos, pendientes primero. Un cuestionario ya
 * respondido sigue siendo información útil —«esto ya lo contesté»— y uno
 * vencido explica por qué desapareció la posibilidad de contestarlo; esconderlos
 * dejaría a la persona sin forma de distinguir «nunca me lo pidieron» de «se me
 * pasó el plazo».
 */
@Component({
  selector: 'app-questionnaires',
  imports: [
    AppButton,
    AppButtonLink,
    Badge,
    Card,
    DatePipe,
    MedicalAspects,
    PageHeader,
    RateEncounterDialog,
    RouterLink,
    Skeleton,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './questionnaires.html',
  styleUrl: './questionnaires.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Questionnaires {
  private readonly surveys = inject(SurveysClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly community = inject(CommunityClient);
  private readonly bandeja = inject(PatientSurveyInbox);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /* ---- FT-22 · qué pestaña se está mirando ------------------------------- */

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: null });

  /**
   * La pestaña abierta, como índice.
   *
   * En la URL y por nombre, igual que en la historia clínica: el enlace apunta a
   * lo que se estaba mirando y «atrás» deshace el cambio de pestaña.
   */
  protected readonly seccion = computed(() => {
    const nombre = this.params()?.get(PARAM_DE_SECCION) ?? '';
    const indice = (SECCIONES as readonly string[]).indexOf(nombre);
    return indice < 0 ? 0 : indice;
  });

  protected elegirSeccion(indice: number): void {
    const nombre = SECCIONES[indice] ?? SECCIONES[0];
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [PARAM_DE_SECCION]: indice === 0 ? null : nombre },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** A dónde manda el estado vacío: a los turnos, que es de donde salen. */
  protected readonly rutaDeTurnos = MIS_TURNOS_ROUTE;

  private readonly estado = signal<ViewState<readonly CuestionarioVisible[]>>(loading());

  protected readonly vista = this.estado.asReadonly();

  /**
   * Las atenciones que se pueden reseñar, por invitación respondida.
   *
   * Sólo entran las que el servidor dijo `canReview`: ya terminadas, con un
   * médico que acepta reseñas y sin reseña previa. Quien dijo «Ahora no» en
   * la encuesta vuelve a verla acá.
   */
  protected readonly resenables = signal<ReadonlyMap<string, ReviewableCare>>(new Map());

  /** La atención cuyo diálogo de reseña está abierto, si lo hay. */
  protected readonly resenando = signal<ReviewableCare | null>(null);

  protected abrirResena(invitacionId: string): void {
    this.resenando.set(this.resenables().get(invitacionId) ?? null);
  }

  protected cerrarResena(): void {
    this.resenando.set(null);
  }

  /** Quedó publicada: la acción desaparece (una reseña por atención). */
  protected resenaPublicada(): void {
    const publicada = this.resenando();
    this.resenando.set(null);
    if (publicada === null) return;
    this.resenables.update((actuales) => {
      const siguientes = new Map(actuales);
      for (const [id, atencion] of actuales) {
        if (atencion.encounterId === publicada.encounterId) siguientes.delete(id);
      }
      return siguientes;
    });
  }

  /** Cuántos quedan por responder, para el resumen de la cabecera. */
  protected readonly pendientes = computed(() => {
    const actual = this.estado();
    if (actual.status !== 'ready') return 0;
    return actual.data.filter((c) => c.sePuedeResponder).length;
  });

  constructor() {
    this.cargar();
  }

  /** Trae los cuestionarios del paciente de la sesión. */
  protected cargar(): void {
    this.estado.set(loading());
    this.surveys.listMyQuestionnaires().subscribe({
      next: (invitaciones) => {
        // El ícono de la barra superior cuenta con lo que acaba de leerse: no
        // hace falta una segunda petición para saber cuántas esperan.
        this.bandeja.sincronizar(invitaciones);
        this.consultarResenas(invitaciones);
        if (invitaciones.length === 0) {
          this.estado.set(
            empty(
              { label: 'Ver mis citas', route: this.rutaDeTurnos },
              'Todavía no tiene cuestionarios. Aparecen acá cuando el profesional cierra una consulta que tiene encuesta asociada.',
            ),
          );
          return;
        }

        // Pendientes primero: son los únicos sobre los que hay algo que hacer.
        // Dentro de cada grupo, lo más reciente arriba.
        const ordenados = invitaciones
          .map((invitacion) => this.aVisible(invitacion))
          .sort((a, b) => {
            if (a.sePuedeResponder !== b.sePuedeResponder) {
              return a.sePuedeResponder ? -1 : 1;
            }
            return (b.vence?.getTime() ?? 0) - (a.vence?.getTime() ?? 0);
          });
        this.estado.set(ready(ordenados));
      },
      error: (error: unknown) => this.estado.set(errorToViewState(error)),
    });
  }

  /**
   * Pregunta, por cada encuesta respondida reciente, si su atención se puede
   * reseñar. Un fallo de una consulta la descarta sin ruido: la lista no
   * depende de esto.
   */
  private consultarResenas(invitaciones: readonly PatientInvitation[]): void {
    const reservas = new Map<string, string>();
    [...invitaciones]
      .filter((invitacion) => invitacion.status === 'ANSWERED')
      .sort((a, b) => (b.answeredAt?.getTime() ?? 0) - (a.answeredAt?.getTime() ?? 0))
      .forEach((invitacion) => {
        if (!reservas.has(invitacion.appointmentBookingId)) {
          reservas.set(invitacion.appointmentBookingId, invitacion.id);
        }
      });

    const consultas = [...reservas.entries()].slice(0, MAX_CONSULTAS_DE_RESENA).map(
      ([reservaId, invitacionId]) =>
        this.community.getReviewableCare(reservaId).pipe(
          timeout(ESPERA_DE_RESENA_MS),
          map((atencion) => [invitacionId, atencion] as const),
          catchError(() => of(null)),
        ),
    );
    if (consultas.length === 0) {
      this.resenables.set(new Map());
      return;
    }
    forkJoin(consultas).subscribe((resultados) => {
      const siguientes = new Map<string, ReviewableCare>();
      for (const resultado of resultados) {
        if (resultado !== null && resultado[1].canReview) {
          siguientes.set(resultado[0], resultado[1]);
        }
      }
      this.resenables.set(siguientes);
    });
  }

  /** Proyecta el contrato de la API a lo que la plantilla necesita. */
  private aVisible(invitacion: PatientInvitation): CuestionarioVisible {
    const presentacion = PRESENTACION[invitacion.status];
    return {
      id: invitacion.id,
      titulo: invitacion.title,
      consigna: invitacion.description ?? '',
      estado: invitacion.status,
      palabra: presentacion.palabra,
      tono: presentacion.tono,
      vence: invitacion.expiresAt,
      respondido: invitacion.answeredAt,
      reservaId: invitacion.appointmentBookingId,
      sePuedeResponder: invitacion.status === 'PENDING',
      ruta: responderCuestionarioRoute(invitacion.id),
    };
  }
}
