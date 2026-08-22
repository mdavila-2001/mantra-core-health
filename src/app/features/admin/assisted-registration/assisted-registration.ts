import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
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
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';

/** Largos que exige `AssistedRegistrationDto` en el backend. */
const MAX_MOTIVO = 500;
const MAX_PARTE_NOMBRE = 100;

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
 * Una sola petición y una sola transacción: o quedó la cuenta con su token de
 * activación, o no quedó nada. Esta vía crea la cuenta y nada más —la persona y
 * su perfil se registran después, cuando el titular completa su filiación—, así
 * que el nombre que se declara acá sólo alimenta el nombre visible de la
 * cuenta. El doble envío lo frena `app-form-actions`.
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
    Alert,
    AnnounceOnAppear,
    AppButton,
    DatePipe,
    Link,
    PageHeader,
    PaginatedForm,
    RouterLink,
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

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Datos del paciente',
      hint: 'Lo mínimo para crear la cuenta; el resto lo completa su filiación.',
      campos: [
        { key: 'name', label: 'Nombre', control: 'text', required: true, mensajeDeError: 'Escribí el nombre del paciente.' },
        { key: 'middleName', label: 'Segundo nombre', hint: 'Si no tiene, dejalo vacío.', control: 'text' },
        { key: 'lastName', label: 'Apellido paterno', control: 'text', required: true, mensajeDeError: 'Escribí el apellido paterno del paciente.' },
        { key: 'motherLastName', label: 'Apellido materno', hint: 'Si no lleva, dejalo vacío.', control: 'text' },
        { key: 'email', label: 'Correo', hint: 'Con este correo va a activar la cuenta e iniciar sesión.', control: 'email', required: true, mensajeDeError: 'Ingresá un correo válido.' },
      ],
    },
    {
      titulo: 'Justificación',
      hint: 'Estás creando una cuenta a nombre de otra persona: queda registrado quién y por qué.',
      campos: [
        { key: 'reason', label: 'Motivo del registro asistido', hint: 'Queda en la trazabilidad. Máximo 500 caracteres.', control: 'textarea', required: true, mensajeDeError: 'Explicá por qué el paciente no puede registrarse por sí mismo (máximo 500 caracteres).' },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    // El nombre va en sus cuatro partes, no en un campo libre: es como lo emite
    // el documento de identidad y como se comparan dos personas al buscar
    // duplicados.
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_PARTE_NOMBRE)],
    }),
    middleName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_PARTE_NOMBRE)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_PARTE_NOMBRE)],
    }),
    motherLastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_PARTE_NOMBRE)],
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
    const { name, middleName, lastName, motherLastName, email, reason } =
      this.form.getRawValue();
    const segundoNombre = middleName.trim();
    const apellidoMaterno = motherLastName.trim();

    return {
      name: name.trim(),
      lastName: lastName.trim(),
      // Ausente si no se completó: `forbidNonWhitelisted` rechaza lo que sobra,
      // y una cadena vacía no es lo mismo que la ausencia del campo.
      ...(segundoNombre === '' ? {} : { middleName: segundoNombre }),
      ...(apellidoMaterno === '' ? {} : { motherLastName: apellidoMaterno }),
      email: email.trim(),
      reason: reason.trim(),
    };
  }
}
