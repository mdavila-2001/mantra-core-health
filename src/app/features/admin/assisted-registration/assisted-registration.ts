import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import type {
  AssistedPatientRegistration,
  AssistedRegistrationResult,
} from '../../../core/data-access/iam/iam.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';

/** Largos que exige `AssistedRegistrationDto` en el backend. */
const MAX_MOTIVO = 500;
const MAX_NOMBRE = 200;

/**
 * Alta asistida de un paciente que no puede registrarse por sí mismo
 * (`POST /iam/users/assisted-registration`, C-18 / CAN-IDENT).
 *
 * ## Lo que hace distinta a esta alta
 *
 * **Nadie fija la contraseña de otro.** El backend devuelve un token de
 * activación de un solo uso y es el titular quien elige su clave al activar. La
 * pantalla existe en buena medida para resolver bien ese momento: mostrar el
 * token una vez, decir cuándo vence y dejar claro que se entrega por un canal
 * seguro.
 *
 * **El motivo es obligatorio y no es burocracia.** Queda en la trazabilidad
 * C-18: es lo que justifica que alguien haya creado una cuenta a nombre de otra
 * persona, y lo que se mira si después hay que auditarlo.
 *
 * ## Sin orquestación ni reanudación
 *
 * Una sola petición: el backend crea persona, perfil y cuenta en la misma
 * transacción (regla 11 del modelo, registro CTI atómico). No hay estado
 * intermedio de «perfil sin cuenta» que reanudar — o quedó todo, o no quedó
 * nada—, y el doble envío lo frena `app-form-actions`.
 *
 * > **Pendiente de contrato:** el DTO acepta `legalRepresentationId` y
 * > `legalRepresentativeUserId`, los dos uuid de referencia. Las convenciones
 * > exigen para eso un buscador con autocompletado, y hoy no hay endpoint de
 * > búsqueda de representaciones ni de usuarios que lo alimente. Pedirlos como
 * > uuid a mano sería peor que no ofrecerlos: quedan afuera hasta que exista el
 * > listado (la misma deuda «Listado pendiente» que el vault marca en 674 de las
 * > 693 vistas).
 */
@Component({
  selector: 'app-assisted-registration',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    DatePipe,
    FormActions,
    FormField,
    FormSection,
    Input,
    Link,
    PageHeader,
    RouterLink,
    Textarea,
  ],
  templateUrl: './assisted-registration.html',
  styleUrl: './assisted-registration.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistedRegistration {
  private readonly iam = inject(IamClient);
  private readonly navigation = inject(NavigationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly form = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_MOTIVO)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  /** El resultado con el token, o `null` mientras el formulario sigue abierto. */
  protected readonly result = signal<AssistedRegistrationResult | null>(null);

  /** Si el token ya se copió, para confirmarlo sin quitarlo de la vista. */
  protected readonly copied = signal(false);

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'No tenés permiso para registrar pacientes.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.iam.assistedRegistration(this.datos()).subscribe({
      next: (resultado) => {
        this.state.set(ready(null));
        this.result.set(resultado);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  /**
   * Copia el token. Si el navegador no deja —contexto no seguro—, el token
   * sigue visible y seleccionable: copiar es comodidad, verlo es el requisito.
   */
  protected async copiarToken(): Promise<void> {
    const token = this.result()?.activationToken;
    if (token === undefined || !this.isBrowser || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
      this.copied.set(true);
    } catch {
      // El token queda a la vista: no hay nada que recuperar acá.
    }
  }

  /** Deja la pantalla lista para otra alta y saca el token de la vista. */
  protected altaNueva(): void {
    this.form.reset();
    this.result.set(null);
    this.copied.set(false);
    this.state.set(ready(null));
  }

  private datos(): AssistedPatientRegistration {
    const { displayName, email, reason } = this.form.getRawValue();

    return {
      displayName: displayName.trim(),
      email: email.trim(),
      reason: reason.trim(),
    };
  }
}
