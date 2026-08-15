import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

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
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { MIS_TURNOS_ROUTE } from '../appointments/appointments.routes';
import { responderCuestionarioRoute } from './questionnaires.routes';

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
    AppButtonLink,
    Badge,
    Card,
    DatePipe,
    PageHeader,
    RouterLink,
    Skeleton,
    ViewStateHost,
  ],
  templateUrl: './questionnaires.html',
  styleUrl: './questionnaires.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Questionnaires {
  private readonly surveys = inject(SurveysClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /** A dónde manda el estado vacío: a los turnos, que es de donde salen. */
  protected readonly rutaDeTurnos = MIS_TURNOS_ROUTE;

  private readonly estado = signal<ViewState<readonly CuestionarioVisible[]>>(loading());

  protected readonly vista = this.estado.asReadonly();

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
        if (invitaciones.length === 0) {
          this.estado.set(
            empty(
              { label: 'Ver mis turnos', route: this.rutaDeTurnos },
              'Todavía no tenés cuestionarios. Aparecen acá cuando el profesional cierra una consulta que tiene encuesta asociada.',
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
      sePuedeResponder: invitacion.status === 'PENDING',
      ruta: responderCuestionarioRoute(invitacion.id),
    };
  }
}
