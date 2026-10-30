import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import type { Subscription } from 'rxjs';

import { SurveysClient } from '../data-access/surveys/surveys.client';
import type { PatientInvitation } from '../data-access/surveys/surveys.types';

/**
 * La bandeja de encuestas del paciente, para el ícono de la barra superior
 * (propietario, 28/10/2026).
 *
 * ## Qué cuenta y por qué
 *
 * - **Hay bandeja** cuando el servidor devolvió al menos una invitación, esté
 *   pendiente, respondida o vencida. Una invitación sólo existe porque una
 *   atención terminó y le generó encuesta: sin ninguna, el ícono no se ofrece
 *   (un acceso que lleva a una pantalla vacía es ruido).
 * - **El contador** son las pendientes **no vencidas**: una pendiente cuyo plazo
 *   pasó ya no se puede responder, y contarla prometería una acción imposible.
 *
 * ## Una sola lectura
 *
 * `GET /surveys/me/invitations` devuelve la lista entera: no hay N+1. La
 * pantalla «Mis cuestionarios» ya la pide por su cuenta, así que le **pasa** lo
 * que leyó (`sincronizar`) en vez de que el armazón la vuelva a pedir. Tras
 * responder se relee (`refrescar`) porque el servidor es quien sabe qué quedó.
 *
 * ## Qué no hace
 *
 * No sondea y no autoriza: lo que el paciente puede ver lo decide la API con la
 * sesión; si la lectura falla, la bandeja queda como estaba y el ícono no
 * aparece de más. Bajo SSR no pide nada (no hay sesión de navegador).
 */
@Injectable({ providedIn: 'root' })
export class PatientSurveyInbox {
  private readonly surveys = inject(SurveysClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Lo último que el servidor dijo, más recientes primero. */
  readonly invitaciones = signal<readonly PatientInvitation[]>([]);

  /** Si ya hubo una lectura que terminó bien. */
  readonly cargada = signal(false);

  /** Si el paciente tiene alguna encuesta, de cualquier estado. */
  readonly hayInvitaciones = computed(() => this.invitaciones().length > 0);

  /** Las que se pueden responder hoy: pendientes y dentro del plazo. */
  readonly pendientes = computed(() => {
    const ahora = Date.now();
    return this.invitaciones().filter(
      (invitacion) =>
        invitacion.status === 'PENDING' &&
        (invitacion.expiresAt === null || invitacion.expiresAt.getTime() > ahora),
    ).length;
  });

  private lectura: Subscription | null = null;

  /** Lee la bandeja si todavía no se leyó ni hay una lectura en vuelo. */
  cargarSiHaceFalta(): void {
    if (!this.cargada() && this.lectura === null) {
      this.refrescar();
    }
  }

  /** Vuelve a leer la bandeja. Una lectura en vuelo se reemplaza por la nueva. */
  refrescar(): void {
    if (!this.isBrowser) {
      return;
    }
    this.lectura?.unsubscribe();
    this.lectura = this.surveys.listMyQuestionnaires().subscribe({
      next: (invitaciones) => {
        this.lectura = null;
        this.sincronizar(invitaciones);
      },
      // Sin cartel: la bandeja del encabezado es un atajo, y un fallo de red no
      // es motivo para interrumpir lo que la persona está haciendo. Queda como
      // estaba; la pantalla de cuestionarios sí explica sus propios errores.
      error: () => {
        this.lectura = null;
      },
    });
  }

  /**
   * Adopta una lista que otra pantalla ya leyó, sin pedirla otra vez.
   *
   * @param invitaciones - La respuesta de `GET /surveys/me/invitations`.
   */
  sincronizar(invitaciones: readonly PatientInvitation[]): void {
    this.invitaciones.set(invitaciones);
    this.cargada.set(true);
  }

  /** Olvida todo: la sesión dejó de ser de un paciente (o se cerró). */
  limpiar(): void {
    this.lectura?.unsubscribe();
    this.lectura = null;
    this.invitaciones.set([]);
    this.cargada.set(false);
  }
}
