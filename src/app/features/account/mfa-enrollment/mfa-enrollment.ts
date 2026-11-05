import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { MfaClient } from '../../../core/data-access/iam/mfa.client';
import type { MfaFactor, MfaReauth, MfaTotpStarted } from '../../../core/data-access/iam/mfa.types';
import { TokenRefreshService } from '../../../core/http/token-refresh.service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { LoadingState } from '../../../shared/components/molecules/loading-state/loading-state';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { CONFIRM_FAILURE_TEXT, cleanCode, confirmFailureOf, groupSecret, isCodeShape, safeReturnUrl } from './mfa-code';
import { MfaReauthForm } from './mfa-reauth-form';
import { REAUTH_FAILURE_TEXT, reauthFailureOf } from './mfa-reauth';
import { QR_DRAWER } from './qr-drawer';

const LADO_DEL_QR = 200;

/**
 * `cargando` lee `GET /iam/me/mfa`; `inicio` ofrece activar o quitar; `reautenticar` pide la contraseña o el código antes de dar de alta
 * (la API lo exige); `configurando` muestra QR y pide el código; `listo` lo da por activado.
 */
type Fase = 'cargando' | 'error' | 'inicio' | 'reautenticar' | 'configurando' | 'listo';

/**
 * **Verificación en dos pasos**: dar de alta la aplicación autenticadora de la
 * propia cuenta (TOTP) y confirmarla con un código.
 *
 * Se abre de dos maneras. Quien entró sin el segundo paso que su organización
 * exige llega acá solo —la API lo deja entrar y el cliente restringe el resto
 * de la aplicación hasta que termine (`mfaEnrollmentGuard`)—; cualquier persona
 * también puede venir desde «Seguridad de la cuenta» a activarlo por su cuenta.
 *
 * Un solo flujo, en una tarjeta: instalar la aplicación, escanear el QR (o
 * escribir el código a mano) y confirmar con el código que la aplicación muestra.
 *
 * **El secreto se ve una sola vez.** La API lo entrega en la respuesta de
 * `POST /iam/me/mfa/totp` y no lo guarda en claro: si la persona recarga antes
 * de confirmar, hay que empezar de nuevo y se genera otro (la API retira el
 * intento anterior). El QR se dibuja en el navegador, con el mismo mecanismo que
 * los demás QR de la aplicación: el secreto no sale a ningún servicio externo.
 *
 * Es presentación: nada de esto autoriza. Confirmar el factor lo hace la API.
 */
@Component({
  selector: 'app-mfa-enrollment',
  imports: [Alert, AppButton, Card, FormField, Input, LoadingState, MfaReauthForm, PageHeader],
  templateUrl: './mfa-enrollment.html',
  styleUrl: './mfa-enrollment.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaEnrollment implements OnInit {
  private readonly mfa = inject(MfaClient);
  private readonly refresher = inject(TokenRefreshService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly navigation = inject(NavigationService);
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly ladoDelQr = LADO_DEL_QR;

  protected readonly fase = signal<Fase>('cargando');
  protected readonly factores = signal<readonly MfaFactor[]>([]);
  /** La organización lo exige y esta cuenta todavía no lo tiene. */
  protected readonly obligatorio = signal(false);
  protected readonly yaActivado = signal(false);
  /** Alguna política de sus organizaciones le exige el segundo paso: quitar el último método la deja sin acceso a ella. */
  protected readonly exigida = signal(false);

  /** La contraseña o el código con que se prueba quién es, antes de dar de alta o quitar un método. */
  protected readonly falloDeReauth = signal<string | null>(null);
  protected readonly quitando = signal<MfaFactor | null>(null);
  protected readonly quitandoEnCurso = signal(false);

  protected readonly iniciando = signal(false);
  protected readonly falloDeInicio = signal<string | null>(null);
  protected readonly intento = signal<MfaTotpStarted | null>(null);
  protected readonly secretoAgrupado = signal('');
  /** `false` si la librería del QR no cargó: queda el código escrito, que alcanza. */
  protected readonly qrDisponible = signal(true);

  protected readonly codigo = signal('');
  protected readonly confirmando = signal(false);
  protected readonly falloDeCodigo = signal<string | null>(null);
  protected readonly intentoDeConfirmar = signal(false);

  private readonly dibujarQr = inject(QR_DRAWER);
  private readonly lienzoQr = viewChild<ElementRef<HTMLCanvasElement>>('lienzoQrMfa');

  constructor() {
    effect(() => {
      const lienzo = this.lienzoQr();
      const actual = this.intento();
      if (!this.esBrowser || lienzo === undefined || actual === null) return;
      this.qrDisponible.set(true);
      this.dibujarQr(lienzo.nativeElement, actual.otpauthUri, LADO_DEL_QR).catch(() => this.qrDisponible.set(false));
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.mfa.getStatus().subscribe({
      next: (estado) => {
        this.factores.set(estado.factors.filter((f) => f.state === 'VERIFIED'));
        this.yaActivado.set(estado.enrolled);
        this.obligatorio.set(estado.enrollmentRequired);
        this.exigida.set(estado.required);
        // Quien tiene el token limitado sigue restringido hasta confirmar; con un token completo no hay nada que restringir.
        if (!this.session.limitedToEnrollment()) this.session.mfaEnrollment.set('done');
        this.fase.set('inicio');
      },
      error: () => this.fase.set('error'),
    });
  }

  /** El primer paso del alta: probar quién es. La API exige la contraseña actual o el código de un método ya activo. */
  protected pedirAlta(): void {
    this.intento.set(null);
    this.falloDeReauth.set(null);
    this.falloDeInicio.set(null);
    this.fase.set('reautenticar');
  }

  /** `POST /iam/me/mfa/totp` con la reautenticación: pide el factor y su secreto. Repetirlo retira el intento anterior. */
  protected empezar(reauth: MfaReauth): void {
    if (this.iniciando()) return;
    this.iniciando.set(true);
    this.falloDeReauth.set(null);
    this.mfa.startTotp(reauth).subscribe({
      next: (factor) => {
        this.iniciando.set(false);
        this.intento.set(factor);
        this.secretoAgrupado.set(groupSecret(factor.secret));
        this.codigo.set('');
        this.falloDeCodigo.set(null);
        this.intentoDeConfirmar.set(false);
        this.fase.set('configurando');
      },
      error: (failure: unknown) => {
        this.iniciando.set(false);
        this.falloDeReauth.set(REAUTH_FAILURE_TEXT[reauthFailureOf(failure)]);
      },
    });
  }

  /** «Quitar este método»: pide confirmar quién es y avisa lo que pasa si era el último. */
  protected pedirQuitar(factor: MfaFactor): void {
    this.falloDeReauth.set(null);
    this.quitando.set(factor);
  }

  protected cancelarQuitar(): void {
    this.quitando.set(null);
    this.falloDeReauth.set(null);
  }

  /** `POST /iam/me/mfa/:factorId/revoke` con la reautenticación; después se vuelve a leer lo que le queda. */
  protected quitar(reauth: MfaReauth): void {
    const factor = this.quitando();
    if (factor === null || this.quitandoEnCurso()) return;
    this.quitandoEnCurso.set(true);
    this.falloDeReauth.set(null);
    this.mfa.revokeFactor(factor.id, reauth).subscribe({
      next: (resultado) => {
        this.quitandoEnCurso.set(false);
        this.quitando.set(null);
        this.toasts.success(
          resultado.remainingVerified === 0 ? 'Método quitado. La verificación en dos pasos quedó apagada.' : 'Método quitado.',
        );
        this.cargar();
      },
      error: (failure: unknown) => {
        this.quitandoEnCurso.set(false);
        this.falloDeReauth.set(REAUTH_FAILURE_TEXT[reauthFailureOf(failure)]);
      },
    });
  }

  protected cancelar(): void {
    this.intento.set(null);
    this.falloDeReauth.set(null);
    this.fase.set('inicio');
  }

  /** `POST /iam/me/mfa/totp/:factorId/confirm`: con el código bueno el factor queda verificado. */
  protected confirmar(): void {
    this.intentoDeConfirmar.set(true);
    const factor = this.intento();
    if (factor === null || this.confirmando() || !isCodeShape(this.codigo())) return;
    this.confirmando.set(true);
    this.falloDeCodigo.set(null);
    this.mfa.confirmTotp(factor.factorId, cleanCode(this.codigo())).subscribe({
      next: () => {
        this.confirmando.set(false);
        this.intento.set(null);
        this.yaActivado.set(true);
        this.obligatorio.set(false);
        this.session.mfaEnrollment.set('done');
        // Con el token limitado, el refresco reemite el token **completo** al confirmar el factor: se pide ahora para que la
        // sesión deje de ser la de alcance limitado y el resto de la aplicación vuelva a responder.
        this.refresher.refresh().subscribe({ error: () => undefined });
        this.fase.set('listo');
        this.toasts.success('Verificación en dos pasos activada.');
      },
      error: (failure: unknown) => {
        this.confirmando.set(false);
        const motivo = confirmFailureOf(failure);
        this.falloDeCodigo.set(CONFIRM_FAILURE_TEXT[motivo]);
        if (motivo === 'WRONG_CODE') this.codigo.set('');
      },
    });
  }

  protected async copiarSecreto(): Promise<void> {
    const factor = this.intento();
    if (factor === null) return;
    try {
      await this.document.defaultView?.navigator.clipboard.writeText(factor.secret);
      this.toasts.success('Código copiado.');
    } catch {
      this.toasts.error('No pudimos copiarlo: selecciónelo y cópielo a mano.');
    }
  }

  /** Después del alta: el destino que se pidió, o el panel. */
  protected continuar(): void {
    const destino = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')) ?? '/dashboard';
    void this.router.navigateByUrl(destino);
  }

  /** Lo que se avisa antes de quitar un método: si era el último y una organización lo exige, se queda sin acceso a ella. */
  protected avisoDeQuitar(): string {
    const ultimo = this.factores().length <= 1;
    if (!ultimo) return 'Le quedará al menos otro método activo: para entrar se le seguirá pidiendo su código.';
    return this.exigida()
      ? 'Es su único método y su organización exige la verificación en dos pasos: si lo quita, no podrá entrar a esa organización hasta que active uno nuevo.'
      : 'Es su único método: si lo quita, la verificación en dos pasos quedará apagada y para entrar solo se le pedirá la contraseña.';
  }

  protected faltaCodigo(): boolean {
    return this.intentoDeConfirmar() && !isCodeShape(this.codigo());
  }
}
