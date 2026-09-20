import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import type { OwnCoverage } from '../../../../core/data-access/profiles/profiles.types';
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
 * Dice de entrada **en qué estado están las coberturas** de quien mira: es
 * la primera pregunta de alguien que está por llevarse su historial a otra
 * aseguradora. No las vuelve a pedir a la API —`my-profile` ya las tiene
 * cargadas y las baja por `coverages`—, y el resumen es una línea, no la
 * lista: las tarjetas de cada cobertura ya están arriba, en la misma
 * pestaña, y repetirlas acá sería ruido.
 *
 * El botón sigue apareciendo **con o sin coberturas**: el derecho de
 * portabilidad no depende de haber declarado alguna, y el certificado de
 * quien no tiene ninguna igual deja constancia de su historial.
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

  /** Las coberturas declaradas del titular, tal como ya las cargó `my-profile`. */
  readonly coverages = input<readonly OwnCoverage[]>([]);

  protected readonly ownPatientProfileId = this.auth.patientProfileId;
  protected readonly isActingForDependent = this.patientContext.isActingForDependent;

  /**
   * El estado de las coberturas en una línea.
   *
   * «Vigente» es `validityStatus === 'CURRENT'` y nada más: `UPCOMING`,
   * `EXPIRED`, `INACTIVE` y `UNKNOWN` se cuentan como no vigentes, sin
   * inventarles una categoría propia que la tarjeta no podría sostener.
   */
  protected readonly coverageSummary = computed(() => {
    const total = this.coverages().length;
    if (total === 0) return 'No tenés coberturas declaradas.';

    const vigentes = this.coverages().filter(
      (coverage) => coverage.validityStatus === 'CURRENT',
    ).length;

    if (vigentes === total) {
      return total === 1 ? '1 cobertura vigente.' : `${total} coberturas vigentes.`;
    }
    if (vigentes === 0) {
      return total === 1
        ? '1 cobertura declarada, ninguna vigente.'
        : `${total} coberturas declaradas, ninguna vigente.`;
    }
    return `${vigentes} de ${total} coberturas vigentes.`;
  });

  protected readonly dialogOpen = signal(false);

  protected openDialog(): void {
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
  }
}
