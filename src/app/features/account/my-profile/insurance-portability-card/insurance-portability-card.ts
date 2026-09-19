import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { PatientContextService } from '../../../../core/patient-context/patient-context.service';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { PortabilityExportDialog } from './portability-export-dialog/portability-export-dialog';

/**
 * Portabilidad de póliza y siniestralidad a 1 clic (subtarea 3.3, registro de
 * procesos 6.3 · ítem 5): la tarjeta que ofrece al titular exportar su
 * historial de seguros para llevarlo a otra aseguradora.
 *
 * Va al pie de la pestaña «Seguros y tutores» de `/my-account`, **siempre
 * visible** — el derecho de portabilidad existe aunque el titular no haya
 * declarado ninguna cobertura todavía.
 *
 * Exporta **siempre el perfil propio** del titular (`auth.patientProfileId()`),
 * nunca el de un dependiente elegido en `PatientContextService`: la
 * portabilidad es un trámite personal, y el representante legal de un
 * dependiente queda como deuda declarada (T-27 sigue abierto en esa parte).
 * Si la sesión está actuando por un dependiente, se avisa en vez de exportar
 * el historial equivocado en silencio.
 */
@Component({
  selector: 'app-insurance-portability-card',
  imports: [AppButton, Alert, Card, PortabilityExportDialog],
  templateUrl: './insurance-portability-card.html',
  styleUrl: './insurance-portability-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsurancePortabilityCard {
  private readonly auth = inject(AuthService);
  private readonly patientContext = inject(PatientContextService);

  protected readonly ownPatientProfileId = this.auth.patientProfileId;
  protected readonly isActingForDependent = this.patientContext.isActingForDependent;

  protected readonly dialogOpen = signal(false);

  protected openDialog(): void {
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
  }
}
