import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../form-support';

/** El `@MaxLength` del DTO: más que esto es 400. */
const MAX_MOTIVO = 500;

/**
 * Revocación inmediata de una delegación (V29-02·A,
 * `POST /practitioner-delegates/:id/revoke`).
 *
 * La ficha la imagina como modal sobre la fila de un listado; sin `GET` de
 * colección no hay fila, así que es una página que pide el identificador. La
 * confirmación destructiva la pone `app-form-actions`, que es la misma pieza
 * que usaría el modal.
 *
 * Revocar lo ya revocado es idempotente en el backend: repetir no rompe nada.
 */
@Component({
  selector: 'app-delegation-revocation',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    Textarea,
  ],
  templateUrl: './delegation-revocation.html',
  styleUrl: '../m29.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DelegationRevocation {
  private readonly client = inject(DelegatedAccessClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly maxMotivo = MAX_MOTIVO;

  protected readonly form = new FormGroup({
    delegationId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
  });

  /** Motivo de auditoría. Fuera del grupo: el textarea trabaja por señal. */
  protected readonly reason = signal('');

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  /** Identificador de la delegación ya revocada, o `null` si sigue el formulario. */
  protected readonly revoked = signal<string | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para revocar delegaciones.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const delegationId = this.form.getRawValue().delegationId.trim();
    const motivo = this.reason().trim();

    this.state.set(loading());

    this.client
      .revokeDelegation(delegationId, motivo === '' ? {} : { reason: motivo })
      .subscribe({
        next: () => {
          this.state.set(ready(null));
          this.revoked.set(delegationId);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otraRevocacion(): void {
    this.form.reset();
    this.reason.set('');
    this.revoked.set(null);
    this.state.set(ready(null));
  }
}
