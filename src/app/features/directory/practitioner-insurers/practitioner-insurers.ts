import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, filter, map, of, startWith, switchMap } from 'rxjs';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type { PractitionerInsuranceCarrier } from '../../../core/data-access/insurance/insurance.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/**
 * **Con qué seguros trabaja** un profesional, en su ficha.
 *
 * ## Por qué es lo primero después de quién es
 *
 * Es la pregunta con la que el paciente llega a la ficha: «¿mi seguro lo
 * cubre?». Si la respuesta vive debajo de la trayectoria y las credenciales,
 * se reserva primero y se pregunta después — y la sorpresa llega en caja.
 *
 * ## De dónde sale
 *
 * De las redes de prestadores de cada aseguradora
 * (`network_provider_memberships`): es la aseguradora la que da de alta al
 * profesional en su red, no el profesional quien lo afirma de sí mismo. Por eso
 * la sección lo dice: «según la red que publica cada aseguradora».
 *
 * ## Vacío no es «no acepta seguros»
 *
 * Una lista vacía significa que ninguna aseguradora lo informó en su red, no
 * que el profesional rechace seguros. Decir lo segundo sería afirmar algo que
 * nadie dijo; la pantalla dice lo primero y sugiere preguntar.
 *
 * Carga por su cuenta, igual que `app-practitioner-availability`: si esta
 * lectura falla, la ficha sigue en pie y sólo esta sección ofrece reintentar.
 */
@Component({
  selector: 'app-practitioner-insurers',
  imports: [Card, Chip, EmptyState, ViewStateHost],
  templateUrl: './practitioner-insurers.html',
  styleUrl: './practitioner-insurers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerInsurers {
  private readonly insurance = inject(InsuranceClient);

  /** El perfil profesional de la ficha. */
  readonly practitionerProfileId = input.required<string>();

  protected readonly state = signal<ViewState<readonly PractitionerInsuranceCarrier[]>>(loading());

  protected readonly carriers = computed<readonly PractitionerInsuranceCarrier[]>(() => {
    const current = this.state();
    return current.status === 'ready' ? current.data : [];
  });

  /** Cada pedido de «Reintentar» vuelve a leer el mismo perfil. */
  private readonly retries = signal(0);

  constructor() {
    // `switchMap`: al pasar de una ficha a otra, la respuesta tardía de la
    // anterior se descarta en vez de pintar los seguros de otro profesional.
    combineLatest([toObservable(this.practitionerProfileId), toObservable(this.retries)])
      .pipe(
        map(([profileId]) => profileId),
        filter((profileId) => profileId !== ''),
        switchMap((profileId) =>
          this.insurance.listPractitionerCarriers(profileId).pipe(
            map((carriers) => ready(carriers)),
            catchError((error: unknown) =>
              of(errorToViewState<readonly PractitionerInsuranceCarrier[]>(error)),
            ),
            startWith(loading()),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.state.set(state));
  }

  protected retry(): void {
    this.retries.update((count) => count + 1);
  }
}
