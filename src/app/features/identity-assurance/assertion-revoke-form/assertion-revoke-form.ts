import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type {
  AssertionRevocation,
  RevokedAssertion,
} from '../../../core/data-access/identity/identity-admin.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import { errorMessageOf, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

/**
 * Revocar una aserción (V27-08·A, `POST /identity/assertions/:id/revoke`).
 *
 * La aserción no se borra nunca: se revoca, y la revocación queda en el
 * historial del caso. Si el motivo es fraude, la misma operación puede derivar
 * la señal — el interruptor lo pide explícito y los conceptos de la señal
 * viajan con él.
 */
@Component({
  selector: 'app-assertion-revoke-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './assertion-revoke-form.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssertionRevokeForm {
  private readonly client = inject(IdentityAdminClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Qué aserción',
      hint: 'La credencial emitida que deja de valer.',
      campos: [
        { key: 'assertionId', label: 'Aserción', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'revocationReasonConceptId', label: 'Motivo de revocación (concepto)', hint: 'Opcional: por defecto, fraude.', control: 'text', mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Señal derivada',
      hint: 'Si la revocación es por fraude, la misma operación puede registrar la señal.',
      campos: [
        { key: 'fraudSignalTypeConceptId', label: 'Tipo de señal (concepto)', hint: 'Opcional: qué se sospecha, si se deriva la señal.', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'fraudSeverityConceptId', label: 'Severidad de la señal (concepto)', hint: 'Opcional: con qué gravedad, si se deriva la señal.', control: 'text', mensajeDeError: UUID_ERROR },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    assertionId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    revocationReasonConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    raiseFraudSignal: new FormControl(false, { nonNullable: true }),
    fraudSignalTypeConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    fraudSeverityConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly revoked = signal<RevokedAssertion | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la verificación de identidad.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { assertionId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.revokeAssertion(assertionId.trim(), this.datos()).subscribe({
      next: (assertion) => {
        this.state.set(ready(null));
        this.revoked.set(assertion);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraRevocacion(): void {
    this.form.reset();
    this.revoked.set(null);
    this.state.set(ready(null));
  }

  private datos(): AssertionRevocation {
    const valores = this.form.getRawValue();
    const motivo = valores.revocationReasonConceptId.trim();
    const tipo = valores.fraudSignalTypeConceptId.trim();
    const severidad = valores.fraudSeverityConceptId.trim();

    return {
      ...(motivo === '' ? {} : { revocationReasonConceptId: motivo }),
      ...(tipo === '' ? {} : { fraudSignalTypeConceptId: tipo }),
      ...(severidad === '' ? {} : { fraudSeverityConceptId: severidad }),
      // El interruptor viaja siempre, apagado o prendido: es decisión explícita.
      raiseFraudSignal: valores.raiseFraudSignal,
    };
  }
}
