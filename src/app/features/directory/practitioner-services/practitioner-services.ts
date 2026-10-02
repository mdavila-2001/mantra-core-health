import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type { ServiceOffering } from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { withDisplayCurrency } from '../../../core/money/display-currency';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { pedirConProfesionalRoute } from '../../account/appointments/appointments.routes';

/**
 * Los servicios que un profesional deja pedir, en su ficha (v4.2.40).
 *
 * ## Qué resuelve
 *
 * La ficha decía quién es el profesional y cuándo atiende, pero no **qué más hace**:
 * un estudio o un procedimiento que no es una consulta no tenía dónde verse, y
 * pedirlo exigía saber de antemano que existía. Acá cada servicio dice cuánto dura
 * —un rango, porque depende de cada paciente—, cuánto sale, y lleva directo a
 * pedirlo con el profesional y el servicio ya elegidos.
 *
 * ## Qué no hace
 *
 * **No dibuja nada si el profesional no ofrece servicios.** Una sección que dice
 * «sin servicios» en cada ficha de médico que sólo da consultas es ruido, y la
 * mayoría sólo da consultas. Sin sesión tampoco pide nada: la lectura la exige y
 * un 401 sería peor que no mostrarla.
 *
 * La API devuelve a un paciente sólo lo activo y reservable, así que lo que se
 * lista acá es exactamente lo que se puede pedir.
 */
@Component({
  selector: 'app-practitioner-services',
  imports: [Alert, AppButtonLink, Card, RouterLink],
  templateUrl: './practitioner-services.html',
  styleUrl: './practitioner-services.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerServices {
  private readonly scheduling = inject(SchedulingClient);
  private readonly auth = inject(AuthService);

  /** El perfil del profesional cuya ficha se mira. */
  readonly practitionerProfileId = input.required<string>();

  protected readonly estado = signal<ViewState<readonly ServiceOffering[]>>(loading());

  protected readonly servicios = computed<readonly ServiceOffering[]>(() => {
    const actual = this.estado();
    return actual.status === 'ready' ? actual.data : [];
  });

  constructor() {
    effect(() => {
      const perfil = this.practitionerProfileId();
      if (perfil === '' || !this.auth.isAuthenticated()) return;
      untracked(() => this.cargar(perfil));
    });
  }

  protected recargar(): void {
    const perfil = this.practitionerProfileId();
    if (perfil !== '') this.cargar(perfil);
  }

  /** «30–45 min», o «20 min» cuando el mínimo y el máximo coinciden. */
  protected duracion(oferta: ServiceOffering): string {
    return oferta.minDurationMinutes === oferta.maxDurationMinutes
      ? `${oferta.maxDurationMinutes} min`
      : `${oferta.minDurationMinutes}–${oferta.maxDurationMinutes} min`;
  }

  /** El precio de referencia con la moneda del producto. */
  protected precio(oferta: ServiceOffering): string {
    return withDisplayCurrency(oferta.price);
  }

  /** A «Agendar una cita», con este profesional y este servicio ya elegidos. */
  protected destino(oferta: ServiceOffering) {
    return pedirConProfesionalRoute(this.practitionerProfileId(), oferta.id);
  }

  private cargar(perfil: string): void {
    this.estado.set(loading());
    this.scheduling.listServiceOfferings(perfil).subscribe({
      // Una lista vacía es `ready`: «no ofrece servicios» no es un estado de la
      // pantalla sino la ausencia de la sección, y la plantilla lo resuelve.
      next: (lista) => this.estado.set(ready(lista)),
      error: (error: unknown) =>
        this.estado.set(errorToViewState<readonly ServiceOffering[]>(error)),
    });
  }
}
