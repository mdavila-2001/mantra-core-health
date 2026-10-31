import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { TENANT_SELECTION_ROUTE } from '../../../core/auth/auth.guard';
import { safeReturnUrl } from '../../../core/auth/return-url';
import { MFA_ENROLLMENT_ROUTE } from '../../../core/auth/mfa-enrollment-route';
import { rolesAlcanzan } from '../../../core/navigation/navigation.types';
import { GETTING_STARTED_ROUTE } from '../../admin/getting-started/getting-started.routes';
import {
  entryDestination,
} from '../../reporting/reporting-access';
import type { LoginCredentials } from '../../../core/data-access/iam/iam.types';
import { loading, ready, validation } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { FormTracing } from '../../../core/observability/business/form-tracing';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { PointerScene } from '../../../shared/motion/pointer-scene.directive';
import { localLoginHint, type LocalLoginHint } from './local-login-hint';
import { loginPolicyOutcome } from './login-policy-reasons';

/**
 * Dónde aterriza quien entra sin pertenecer a ninguna organización.
 *
 * Su estado vacío ya explica qué hacer —pedir el alta, esperar la invitación—,
 * que es más de lo que le dice un panel donde casi nada tiene datos.
 *
 * Desde el 2026-09-10 esa pantalla es **una pestaña** de «Organización médica»
 * («Mis vinculaciones»), y el aterrizaje va directo a ella con `?tab=`. Sin el
 * parámetro, quien entra sin organización caería en la primera pestaña —siete
 * tablas vacías de una organización que no tiene— en vez de en la única que
 * puede usar.
 */
const MY_ORGANIZATIONS_ROUTE = '/administration/medical-organization?tab=memberships';

/**
 * Pantalla de inicio de sesión.
 *
 * **Un solo campo de identificador.** El backend acepta correo *o* documento y
 * nunca ambos (`LoginDto` valida el correo sólo cuando no vino documento), así
 * que pedir dos campos obligaría a la persona a saber cuál le toca. Se detecta
 * por la arroba, que es la misma regla que usaría cualquiera al mirarlo.
 *
 * El enlace de «olvidé mi contraseña» lleva a `/auth/forgot-password`, que consume
 * `POST /iam/auth/forgot-password`. (Este comentario decía lo contrario hasta
 * que el endpoint llegó; la plantilla ya tenía el enlace.)
 */
@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AppButton,
    Input,
    Link,
    FormField,
    NavIcon,
    Alert,
    AuthSplit,
    AnnounceOnAppear,
    PointerScene,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formTracing = inject(FormTracing);

  /**
   * La cuenta local de desarrollo, o `null` (ver `local-login-hint.ts`).
   *
   * Se resuelve **después del primer render, en el navegador**: depende de dónde
   * se sirve la página (`location`), que en el servidor no existe, y decidirlo
   * antes dibujaría en el cliente algo que el HTML del servidor no trae.
   */
  protected readonly localHint = signal<LocalLoginHint | null>(null);

  readonly form = new FormGroup({
    identifier: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    mfaCode: new FormControl('', { nonNullable: true }),
  });

  /**
   * Estado del envío, en los términos del M34. Arranca en `ready` sin datos
   * porque el formulario ya está utilizable: no hay nada que esperar todavía.
   */
  readonly state = signal<ViewState<null>>(ready(null));

  readonly isSubmitting = computed(() => this.state().status === 'loading');

  /**
   * El campo de MFA **se dibuja sólo cuando la API lo pide** (TX-29).
   *
   * Antes no había señal: `LoginDto` aceptaba `mfaCode` y nada decía cuándo hacía
   * falta, así que se lo escondió. Ahora, con `AUTH_MFA_CHALLENGE_ENABLED` en la
   * API, una cuenta con factor verificado responde `401 details.reason =
   * MFA_REQUIRED` a un login sin código (y `MFA_INVALID` a uno que no valida): la
   * pantalla pasa a pedir el código, **pedido y no ofrecido**, y reenvía el mismo
   * formulario.
   */
  readonly mfaRequired = signal(false);

  readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues[0]?.message ?? null;
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revise su conexión y reintente.';
    }
    if (state.status === 'error') {
      return `${state.message ?? 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  constructor() {
    afterNextRender(() => this.localHint.set(localLoginHint()));
  }

  /** Rellena el formulario con la cuenta local; no envía: entrar sigue siendo un clic. */
  protected usarCuentaLocal(cuenta: LocalLoginHint): void {
    this.form.patchValue({ identifier: cuenta.identifier, password: cuenta.password });
    this.form.markAsDirty();
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    /**
     * El envío se envuelve en un span `angular.form.submit`, que cuelga de la
     * navegación en curso y del que cuelga el `auth.login` del servicio y la
     * petición HTTP. Con eso, una traza responde «cuánto tardó entrar» separando
     * lo que fue red de lo que fue backend.
     *
     * De aquí no sale ningún valor del formulario: solo su nombre y cuántos
     * controles estaban inválidos. Ver `observability/business/form-tracing.ts`.
     */
    this.formTracing
      .traceSubmit('login', 'auth', this.form, () => this.auth.login(this.credentials()))
      .subscribe({
        next: () => this.goAfterLogin(),
        error: (error: unknown) => this.state.set(this.toState(error)),
      });
  }

  /**
   * La arroba decide si el identificador es correo o documento. El backend
   * exige uno u otro, así que hay que elegir antes de mandar.
   */
  private credentials(): LoginCredentials {
    const { identifier, password, mfaCode } = this.form.getRawValue();
    const trimmed = identifier.trim();
    const mfa = mfaCode.trim() === '' ? {} : { mfaCode: mfaCode.trim() };

    return trimmed.includes('@')
      ? { kind: 'email', email: trimmed, password, ...mfa }
      : { kind: 'nationalId', nationalId: trimmed, password, ...mfa };
  }

  /**
   * A dónde va cada quien después de entrar.
   *
   * Tres casos, y el del medio faltaba. Con **más de una** organización hay que
   * elegir. Con **ninguna** no hay nada que elegir pero tampoco nada que hacer
   * en el panel: a quien puede aprovisionar organizaciones le corresponde el
   * recorrido de puesta en marcha, y al resto la pantalla que le explica que
   * todavía no pertenece a ninguna. Con **una** se entra derecho.
   */
  private goAfterLogin(): void {
    this.state.set(ready(null));
    void this.router.navigateByUrl(this.destinoDespuesDeEntrar());
  }

  /**
   * El destino que corresponde a esta sesión.
   *
   * Si una política de la organización exige el segundo paso y la cuenta no lo
   * tiene, la API **deja entrar** (`mfaEnrollmentRequired`): lo primero es darlo de
   * alta, y la aplicación queda restringida hasta entonces. Al terminar se vuelve
   * al destino que habría correspondido.
   */
  private destinoDespuesDeEntrar(): string {
    // Con el token de alcance limitado no hay organizaciones que mirar (el token no las trae): se vuelve al destino pedido o al
    // inicio, y el destino real lo decide el token completo que se emite al confirmar el factor.
    if (this.auth.mfaEnrollmentRequired()) {
      return `${MFA_ENROLLMENT_ROUTE}?returnUrl=${encodeURIComponent(this.retornoPedido() ?? '/')}`;
    }
    return this.destinoNormal();
  }

  private destinoNormal(): string {
    if (this.auth.needsTenantSelection()) {
      return TENANT_SELECTION_ROUTE;
    }
    if (this.auth.tenants().length === 0) {
      if (rolesAlcanzan(['SUPERADMIN'], this.auth.roles())) {
        return GETTING_STARTED_ROUTE;
      }
      // Alcance de plataforma sin ninguna organización: opera sin ella, entra al Centro de la plataforma.
      return this.auth.hasPlatformScope() ? '/' : MY_ORGANIZATIONS_ROUTE;
    }
    // Un enlace pedido a mano manda sobre la pantalla de elección: quien venía
    // a una página concreta no tiene que elegir portal para llegar a ella.
    const requested = this.retornoPedido();
    if (requested !== null) {
      return requested;
    }
    // El alcance de plataforma no pasa por la elección de organización (arriba, `needsTenantSelection`). Ver
    // `entryDestination`: sin la maqueta de reportería todos entran a `/` (el Centro de la plataforma), salvo marketing puro.
    return entryDestination(this.auth.roles());
  }

  /**
   * A dónde volver después de entrar, si alguien lo pidió (AC-01-17).
   *
   * Lo escribe quien manda acá desde una superficie pública: el menú de
   * preferencias de una publicación ofrece «Denunciar» sin sesión y necesita
   * devolver a la persona a la publicación que estaba leyendo, no al panel.
   *
   * ## Por qué se valida, y con qué criterio
   *
   * Un `returnUrl` que llegue por la barra de direcciones es entrada de
   * usuario, y navegar a él a ciegas es una redirección abierta: basta un
   * enlace `/auth?returnUrl=https://otro-sitio` para que un login legítimo
   * termine en una pantalla ajena que copia la marca.
   *
   * Se acepta **sólo** una ruta interna: empieza con `/` y **no** con `//`
   * —`//evil.com` es una URL protocol-relative, y el navegador la resuelve
   * como host externo aunque parezca una ruta—. Tampoco se acepta `/\`, que
   * varios navegadores normalizan igual que `//`.
   *
   * Se ignora cuando hay que elegir organización o cuando no hay ninguna: en
   * los dos casos el destino no es negociable.
   */
  private retornoPedido(): string | null {
    const pedido = this.route.snapshot.queryParamMap.get('returnUrl');
    return safeReturnUrl(pedido);
  }

  /**
   * Traduce el fallo con el mapeo compartido del catálogo, con **una sola
   * excepción propia del login**.
   *
   * En cualquier otra pantalla un `UNAUTHENTICATED` significa que la sesión se
   * venció, y el interceptor ya se encargó de cerrarla. Acá significa que las
   * credenciales que la persona acaba de escribir no sirven, que es un mensaje
   * distinto y accionable.
   */
  private toState(error: unknown): ViewState<null> {
    if (error instanceof HttpErrorResponse) {
      const body = readApiError(error);
      // La política de sesión de la organización: pide el código o bloquea la
      // entrada con una razón que se le explica a la persona. Ver
      // `login-policy-reasons.ts`.
      const politica = loginPolicyOutcome(body?.details?.['reason']);
      if (body !== null && politica !== null) {
        this.mfaRequired.set(politica.kind === 'ask-code');
        return validation([{ message: politica.message, code: body.code }]);
      }
      if (body?.code === 'UNAUTHENTICATED') {
        return validation([{ message: 'Las credenciales no son válidas.', code: body.code }]);
      }
    }

    return errorToViewState<null>(error);
  }
}
