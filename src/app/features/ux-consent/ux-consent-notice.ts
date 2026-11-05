import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { UxConsent } from '../../core/observability/consent/ux-consent.service';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Alert } from '../../shared/components/molecules/alert/alert';

/**
 * El aviso de una sola vez sobre la medición de interacciones.
 *
 * Aparece cuando hay sesión, la captura está encendida, ni DNT ni Global
 * Privacy Control están activos y la API dice que la persona nunca decidió. Se
 * va con cualquiera de las dos respuestas y no vuelve en este navegador;
 * retirar el permiso después se hace en «Mi cuenta › Mi privacidad».
 *
 * Dice qué se mide y qué no, y qué pasa si responde «Ahora no»: se siguen
 * contando pantallas visitadas, de forma anónima, y nunca clics.
 */
@Component({
  selector: 'app-ux-consent-notice',
  imports: [Alert, AppButton, RouterLink],
  templateUrl: './ux-consent-notice.html',
  styleUrl: './ux-consent-notice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UxConsentNotice {
  protected readonly consent = inject(UxConsent);
}
