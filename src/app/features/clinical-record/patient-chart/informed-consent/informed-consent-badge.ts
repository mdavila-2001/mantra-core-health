import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { InformedConsent } from '../../../../core/data-access/informed-consents/informed-consents.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { estadoDeLaFirma, estadoDelConsentimiento } from './informed-consent.textos';

/**
 * El estado del consentimiento de UN ítem —receta, orden, procedimiento,
 * plan o derivación—, como insignia al lado de su nombre.
 *
 * `undefined` es «todavía no se sabe» (la lista no volvió) y no dibuja nada:
 * pintar «Sin consentimiento» mientras se carga es afirmar algo que no se
 * comprobó.
 */
@Component({
  selector: 'app-informed-consent-badge',
  imports: [Badge],
  template: `
    @if (estado(); as e) {
      <app-badge size="sm" [variant]="e.variante" data-testid="consentimiento-estado" [attr.data-estado]="e.clave">
        {{ e.etiqueta }}
      </app-badge>
    }
    @if (firma(); as f) {
      <app-badge size="sm" [variant]="f.variante" data-testid="consentimiento-firma-item">{{ f.etiqueta }}</app-badge>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      gap: var(--sp-1);
      vertical-align: middle;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InformedConsentBadge {
  readonly consent = input<InformedConsent | null | undefined>(undefined);

  protected readonly estado = computed(() => {
    const c = this.consent();
    return c === undefined ? null : estadoDelConsentimiento(c);
  });

  /** «Firmado» / «Firma pendiente», sólo sobre un consentimiento activo. */
  protected readonly firma = computed(() => {
    const c = this.consent();
    return c === undefined ? null : estadoDeLaFirma(c);
  });
}
