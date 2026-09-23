import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { InsurancePortabilityClient } from '../../../core/data-access/insurance/insurance-portability.client';
import type { PortabilityVerification } from '../../../core/data-access/insurance/insurance-portability.types';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';

/**
 * Un SHA-256 en hexadecimal: 64 dígitos, **sin distinguir mayúsculas**.
 *
 * El QR del certificado siempre trae el sello en minúsculas, que es como lo
 * emite y lo guarda el servidor. Pero la dirección también se escribe a mano
 * —el PDF muestra el sello para poder copiarlo, y quien lo teclea o lo pega
 * desde una planilla lo trae tan seguido en mayúsculas como en minúsculas—,
 * y un sello legítimo en mayúsculas no es inválido: es el mismo número. Se
 * acepta, se pasa a minúsculas y recién ahí se consulta, para que no termine
 * en un 404 que diría «no existe» de algo que sí existe.
 */
const SHA256_HEX_PATTERN = /^[0-9a-fA-F]{64}$/;

type VerifyState = 'loading' | 'invalid' | 'ready' | 'notFound' | 'error';

/**
 * Verificación pública del certificado de portabilidad de póliza y
 * siniestralidad, por su sello SHA-256 (subtarea 3.3).
 *
 * Es adonde apunta el código QR del certificado, y no requiere sesión: quien
 * escanea el QR —una nueva aseguradora, un auditor— confirma que el
 * certificado existe y con qué se emitió, sin exponer ningún dato clínico ni
 * personal. `GET /public/portability/verify/:manifestHash` es el mismo tipo
 * de endpoint que verifica una receta oficial por su sello.
 *
 * Ruta literal `verify/portability/:manifestHash`, sin sección ni guard
 * (`sinSeccionAProposito`, igual que `feed`): se llega por el QR, no por el
 * menú.
 */
@Component({
  selector: 'app-portability-verify',
  imports: [AppButtonLink, Alert, Skeleton, DatePipe, RouterLink],
  templateUrl: './portability-verify.html',
  styleUrl: './portability-verify.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortabilityVerify {
  private readonly route = inject(ActivatedRoute);
  private readonly portability = inject(InsurancePortabilityClient);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<VerifyState>('loading');
  protected readonly result = signal<PortabilityVerification | null>(null);

  constructor() {
    const enLaDireccion = this.route.snapshot.paramMap.get('manifestHash') ?? '';

    if (!SHA256_HEX_PATTERN.test(enLaDireccion)) {
      this.state.set('invalid');
      return;
    }

    const manifestHash = enLaDireccion.toLowerCase();
    const subscription = this.portability.verifyCertificate(manifestHash).subscribe({
      next: (result) => {
        this.result.set(result);
        this.state.set('ready');
      },
      error: (error: unknown) => {
        const status = (error as { status?: number } | null)?.status;
        this.state.set(status === 404 ? 'notFound' : 'error');
      },
    });
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }
}
