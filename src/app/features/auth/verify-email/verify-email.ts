import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';

/** Resultado de canjear el token del correo. */
type Estado = 'verificando' | 'verificado' | 'sin-token' | 'invalido';

/**
 * Landing a la que lleva el enlace del correo de verificación.
 *
 * **Verificar el correo no desbloquea nada**: la cuenta ya está activa desde el
 * registro. Sólo deja constancia de que la dirección es alcanzable por su
 * titular. Por eso, cuando el token no sirve, el mensaje no es alarmante — no se
 * perdió el acceso a nada.
 */
@Component({
  selector: 'app-verify-email',
  imports: [AppButton, AnnounceOnAppear],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmail {
  private readonly iam = inject(IamClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly estado = signal<Estado>('verificando');
  readonly isVerifying = computed(() => this.estado() === 'verificando');

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (token === null || token.trim() === '') {
      this.estado.set('sin-token');
      return;
    }

    this.iam.verifyEmail(token).subscribe({
      next: (resultado) => this.estado.set(resultado.emailVerified ? 'verificado' : 'invalido'),
      // Cualquier fallo se cuenta igual: el token venció, ya se usó o no existe.
      // Distinguirlos no le cambia nada a quien está mirando la pantalla.
      error: () => this.estado.set('invalido'),
    });
  }

  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }
}
