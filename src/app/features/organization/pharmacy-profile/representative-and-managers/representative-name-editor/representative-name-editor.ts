import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import { LegalRepresentativeClient } from '../../../../../core/data-access/directory/legal-representative.client';
import { describeApiFailure } from '../../../../../core/http/api-failure';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { InlineNameFields } from '../../../../auth/shared-registration/inline-name-fields/inline-name-fields';
import { nameGroup, nameParts } from '../../../../auth/shared-registration/name-fields/person-name';
import { FormActions } from '../../../../../shared/components/organisms/form-actions/form-actions';

/** The name by parts, as the registration declared it; any part may be missing on old rows. */
export interface RepresentativeNameParts {
  readonly name?: string;
  readonly middleName?: string;
  readonly lastName?: string;
  readonly motherLastName?: string;
}

/**
 * Lets whoever administers the organization correct the legal representative's name.
 *
 * It uses the same name block as the registration (first, second and third name, any number of
 * further names, both surnames) and sends it folded into the four parts the API stores. It saves
 * on its own (`PATCH /tenants/{id}/representatives/LEGAL_REPRESENTATIVE/name`) and then says so with
 * `saved`, so the owner of the data reloads it: the screen shows what the server kept, not what
 * was typed. The API re-checks that the person administers the organization; this only decides
 * whether the button is offered.
 */
@Component({
  selector: 'app-representative-name-editor',
  imports: [AppButton, FormActions, InlineNameFields],
  templateUrl: './representative-name-editor.html',
  styleUrl: './representative-name-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepresentativeNameEditor {
  private readonly client = inject(LegalRepresentativeClient);

  readonly tenantId = input.required<string>();
  readonly parts = input<RepresentativeNameParts>({});
  readonly saved = output<void>();

  protected readonly editing = signal(false);
  protected readonly pending = signal(false);
  protected readonly failure = signal('');

  /** Same group as the registration; names travel in parts, so they are folded on save. */
  protected readonly group = nameGroup(true, true);

  protected open(): void {
    const current = this.parts();
    this.group.controls.extraNames.clear();
    this.group.reset({
      name: current.name ?? '',
      middleName: current.middleName ?? '',
      thirdName: '',
      lastName: current.lastName ?? '',
      motherLastName: current.motherLastName ?? '',
    });
    this.failure.set('');
    this.editing.set(true);
  }

  protected cancel(): void {
    this.editing.set(false);
  }

  protected save(): void {
    this.group.markAllAsTouched();
    if (this.pending() || this.group.invalid) return;
    const body = nameParts(this.group.getRawValue());
    this.pending.set(true);
    this.failure.set('');
    this.client.rename(this.tenantId(), body).subscribe({
      next: () => {
        this.pending.set(false);
        this.editing.set(false);
        this.saved.emit();
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.failure.set(describeApiFailure(error, 'No se pudo guardar el nombre. Pruebe de nuevo.'));
      },
    });
  }
}
