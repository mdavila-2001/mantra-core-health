import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { TENANT_SELECTION_ROUTE } from '../../../core/auth/auth.guard';
import { rolesAlcanzan } from '../../../core/navigation/navigation.types';
import { GETTING_STARTED_ROUTE } from '../../admin/getting-started/getting-started.routes';
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

/** A dónde se entra tras iniciar sesión con la organización ya resuelta. */
const HOME_ROUTE = '/';

/**
 * Dónde aterriza quien entra sin pertenecer a ninguna organización.
 *
 * Su estado vacío ya explica qué hacer —pedir el alta, esperar la invitación—,
 * que es más de lo que le dice un panel donde casi nada tiene datos.
 */
const MY_ORGANIZATIONS_ROUTE = '/my-organizations';

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
   * El campo de MFA **ya no se dibuja**, y el control se queda.
   *
   * Estaba siempre a la vista, rotulado «Código de verificación (opcional)»,
   * porque `LoginDto` acepta `mfaCode` y el backend no emite ninguna señal de
   * cuándo hace falta: no hay código de error propio en el catálogo ni mención
   * de MFA en el servicio de login. Mostrarlo siempre no inventaba nada, pero
   * le pedía a todo el mundo un dato que casi nadie tiene — y en una pantalla
   * de dos campos, un tercero que no te toca es el que te hace dudar de los
   * otros dos.
   *
   * El control sigue declarado a propósito: `credentials()` lo omite mientras
   * esté vacío, así que hoy no cambia nada de lo que viaja, y el día que el
   * backend declare el caso vuelve el campo a la plantilla —pedido, no
   * ofrecido— sin tocar el formulario ni el envío.
   */

  readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues[0]?.message ?? null;
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message ?? 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

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

  /** El destino que corresponde a esta sesión. */
  private destinoDespuesDeEntrar(): string {
    if (this.auth.needsTenantSelection()) {
      return TENANT_SELECTION_ROUTE;
    }
    if (this.auth.tenants().length === 0) {
      return rolesAlcanzan(['SUPERADMIN'], this.auth.roles())
        ? GETTING_STARTED_ROUTE
        : MY_ORGANIZATIONS_ROUTE;
    }
    return this.retornoPedido() ?? HOME_ROUTE;
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
    if (pedido === null || pedido === '') {
      return null;
    }
    const externo = !pedido.startsWith('/') || /^\/[/\\]/.test(pedido);
    return externo ? null : pedido;
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
      if (body?.code === 'UNAUTHENTICATED') {
        return validation([{ message: 'Las credenciales no son válidas.', code: body.code }]);
      }
    }

    return errorToViewState<null>(error);
  }
}
