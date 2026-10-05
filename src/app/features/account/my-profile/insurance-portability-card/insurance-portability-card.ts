import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { finalize, map, switchMap } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { blobToDataUrl } from '../../../../core/data-access/files/blob-to-data-url';
import { FileDownloader } from '../../../../core/data-access/files/file-downloader';
import { InsurancePortabilityClient } from '../../../../core/data-access/insurance/insurance-portability.client';
import type { OwnCoverage } from '../../../../core/data-access/profiles/profiles.types';
import { readApiError } from '../../../../core/http/api-error';
import { PatientContextService } from '../../../../core/patient-context/patient-context.service';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';

/**
 * Portabilidad de póliza y siniestralidad a 1 clic (subtarea 3.3, registro de
 * procesos 6.3 · ítem 5): la tarjeta que ofrece al titular exportar su
 * historial de seguros para llevarlo a otra aseguradora.
 *
 * Va al pie de la pestaña «Seguros» de `/my-account` (separada de «Tutores»
 * el 24/09/2026), **siempre visible** — el derecho de portabilidad existe
 * aunque el titular no haya declarado ninguna cobertura todavía.
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
  imports: [AnnounceOnAppear, AppButton, Alert, Card],
  templateUrl: './insurance-portability-card.html',
  styleUrl: './insurance-portability-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsurancePortabilityCard {
  private readonly auth = inject(AuthService);
  private readonly patientContext = inject(PatientContextService);
  private readonly portability = inject(InsurancePortabilityClient);
  private readonly downloader = inject(FileDownloader);
  private readonly destroyRef = inject(DestroyRef);

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

    const currentCount = this.coverages().filter(
      (coverage) => coverage.validityStatus === 'CURRENT',
    ).length;

    if (currentCount === total) {
      return total === 1 ? '1 cobertura vigente.' : `${total} coberturas vigentes.`;
    }
    if (currentCount === 0) {
      return total === 1
        ? '1 cobertura declarada, ninguna vigente.'
        : `${total} coberturas declaradas, ninguna vigente.`;
    }
    return `${currentCount} de ${total} coberturas vigentes.`;
  });

  protected readonly isDownloading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected downloadPdf(): void {
    const patientProfileId = this.ownPatientProfileId();
    if (!patientProfileId || this.isDownloading()) return;

    this.isDownloading.set(true);
    this.errorMessage.set(null);

    this.portability
      .exportPortability({ patientProfileId, format: 'PDF' })
      .pipe(
        switchMap((result) =>
          this.portability.downloadCertificatePdf(result.certificateId).pipe(
            switchMap(({ blob, fileName }) =>
              blobToDataUrl(blob).pipe(
                map((dataUrl) => ({
                  dataUrl,
                  fileName: fileName ?? `portabilidad-${result.certificateId}.pdf`,
                })),
              ),
            ),
          ),
        ),
        finalize(() => this.isDownloading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ dataUrl, fileName }) => this.downloader.trigger(dataUrl, fileName),
        error: (error: unknown) => this.errorMessage.set(this.downloadErrorMessage(error)),
      });
  }

  private downloadErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return readApiError(error)?.message ?? 'No se pudo descargar el PDF. Probá de nuevo.';
    }
    return 'No se pudo descargar el PDF. Probá de nuevo.';
  }
}
