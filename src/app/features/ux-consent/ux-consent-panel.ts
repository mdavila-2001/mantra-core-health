import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { UxConsent } from '../../core/observability/consent/ux-consent.service';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { Alert } from '../../shared/components/molecules/alert/alert';

/**
 * «Mi cuenta › Mi privacidad»: ver y cambiar el permiso de medición de
 * interacciones. Va dentro de la tarjeta de «Mis consentimientos»; se oculta si
 * la captura no existe (apagada o sin esquema) y avisa, sin ofrecer nada, si el
 * navegador pide no ser rastreado (DNT / Global Privacy Control).
 */
@Component({
  selector: 'app-ux-consent-panel',
  imports: [Alert, AppButton, Badge],
  templateUrl: './ux-consent-panel.html',
  styleUrl: './ux-consent-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UxConsentPanel {
  protected readonly consent = inject(UxConsent);

  protected readonly rotulo = computed(() => {
    switch (this.consent.decision()) {
      case 'otorgada':
        return 'Permitido';
      case 'retirada':
        return 'Retirado';
      case 'ninguna':
        return 'Sin decidir';
      default:
        return 'No disponible';
    }
  });
}
