import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import type { CarrierSummary } from '../../../core/data-access/insurance/insurance.types';
import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Link } from '../../../shared/components/atoms/link/link';
import { Card } from '../../../shared/components/molecules/card/card';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import type { StatusSealVariant } from '../../../shared/components/organisms/status-seal/status-seal.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { dialable, whatsappDigits } from '../../../shared/utils/telephone/telephone';

/**
 * La ficha de la aseguradora: código, registro ante el regulador,
 * jurisdicción, estado, canales de contacto y verificación.
 *
 * ## Por qué vive en el perfil y no en el catálogo
 *
 * Estaba como cabecera de `/administration/insurance`, repitiendo en cada
 * visita al catálogo datos que describen a la organización y no a sus planes.
 * Ahora la muestra el perfil de la organización, que es donde se mira quién es.
 *
 * ## Cuál de las aseguradoras
 *
 * `GET /insurance-carriers` lista las del tenant activo. Se elige la que tiene
 * el `carrierCode` de la organización que el perfil está mostrando: con más de
 * una organización, tomar la primera sería inventar cuál es.
 */
@Component({
  selector: 'app-insurer-profile-card',
  imports: [Card, Link, StatusSeal, ViewStateHost],
  templateUrl: './insurer-profile-card.html',
  styleUrl: './insurer-profile-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsurerProfileCard {
  private readonly insurance = inject(InsuranceClient);

  /** El código de aseguradora de la organización que muestra el perfil. */
  readonly carrierCode = input.required<string>();

  protected readonly state = signal<ViewState<CarrierSummary>>(loading());
  protected readonly carrier = computed(() => dataOf(this.state()));

  constructor() {
    effect(() => this.load(this.carrierCode()));
  }

  protected retry(): void {
    this.load(this.carrierCode());
  }

  /** Teléfono listo para `tel:` (subtarea 2.3): sólo dígitos y el signo `+`. */
  protected dialable(raw: string): string {
    return dialable(raw);
  }

  /** El enlace de WhatsApp de la propia aseguradora, sin mensaje precargado. */
  protected whatsappHref(raw: string): string {
    return `https://wa.me/${whatsappDigits(raw)}`;
  }

  /**
   * Cómo se lee el estado de verificación.
   *
   * Se traduce el código del catálogo, no el texto: el `display` puede cambiar
   * de redacción sin que cambie el significado. Un código desconocido cae en
   * `unknown` y se muestra con su etiqueta.
   */
  protected verificationVariant(code: string): StatusSealVariant {
    if (code === 'VERIFICATION_VERIFIED') return 'approved';
    if (code === 'VERIFICATION_PENDING') return 'pending';
    return 'unknown';
  }

  private load(carrierCode: string): void {
    this.state.set(loading());
    this.insurance.listCarriers().subscribe({
      next: (directory) => {
        const match = directory.items.find((item) => item.carrierCode === carrierCode);
        this.state.set(
          match === undefined
            ? empty(
                { label: 'Ver catálogo de seguros', route: '/administration/insurance' },
                'Todavía no hay una ficha de aseguradora para esta organización.',
              )
            : ready(match),
        );
      },
      error: (error: unknown) => this.state.set(errorToViewState<CarrierSummary>(error)),
    });
  }
}
