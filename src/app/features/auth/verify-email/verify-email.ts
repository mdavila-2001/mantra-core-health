import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import { describeApiFailure } from '../../../core/http/api-failure';
import { RouterLink } from '@angular/router';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Link } from '../../../shared/components/atoms/link/link';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';

/**
 * Resultado de canjear el token del correo.
 *
 * `no-se-pudo` es la red caída, el servidor que falló o el límite de intentos:
 * el enlace puede seguir sirviendo, así que no se lo declara inválido.
 */
type Estado = 'verificando' | 'verificado' | 'sin-token' | 'invalido' | 'no-se-pudo';

/** Estados HTTP 4xx que no hablan del token sino del momento: se reintentan. */
const REINTENTABLES_4XX: ReadonlySet<number> = new Set([408, 429]);

/**
 * Si el fallo dice algo del enlace (vencido, usado, inexistente) o sólo que no
 * se pudo preguntar. Sólo un 4xx de la API habla del token; todo lo demás —sin
 * conexión, 5xx, un error que ni siquiera es HTTP— deja la pregunta abierta.
 */
function hablaDelEnlace(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status >= 400 &&
    error.status < 500 &&
    !REINTENTABLES_4XX.has(error.status)
  );
}

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
  imports: [AppButton, AnnounceOnAppear, Link, RouterLink],
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

  /** Qué pasó cuando no se pudo preguntar, con el código de soporte si hay. */
  readonly motivoDelFallo = signal('');

  private readonly token = this.route.snapshot.queryParamMap.get('token');

  constructor() {
    if (this.token === null || this.token.trim() === '') {
      this.estado.set('sin-token');
      return;
    }
    this.verificar(this.token);
  }

  /** Vuelve a canjear el mismo enlace, después de un fallo que no era del token. */
  reintentar(): void {
    if (this.token === null || this.isVerifying()) {
      return;
    }
    this.verificar(this.token);
  }

  private verificar(token: string): void {
    this.estado.set('verificando');
    this.motivoDelFallo.set('');
    this.iam.verifyEmail(token).subscribe({
      next: (resultado) => this.estado.set(resultado.emailVerified ? 'verificado' : 'invalido'),
      // Vencido, ya usado o inexistente se cuentan igual: distinguirlos no le
      // cambia nada a quien mira. Lo que NO se cuenta igual es un corte de red
      // o un 500: antes también decían «ese enlace ya no sirve», y la persona
      // descartaba un enlace bueno de un solo uso.
      error: (error: unknown) => {
        if (hablaDelEnlace(error)) {
          this.estado.set('invalido');
          return;
        }
        this.motivoDelFallo.set(
          describeApiFailure(error, 'No pudimos comunicarnos con el servidor para confirmar su correo.'),
        );
        this.estado.set('no-se-pudo');
      },
    });
  }

  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }
}
