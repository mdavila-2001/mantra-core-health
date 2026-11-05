import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import {
  LegalRepresentativeClient,
  type LegalRepresentativeName,
} from '../../../../../core/data-access/directory/legal-representative.client';
import { describeApiFailure } from '../../../../../core/http/api-failure';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
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
 * It saves on its own (`PATCH /tenants/{id}/legal-representative`) and then says so with
 * `saved`, so the owner of the data reloads it: the screen shows what the server kept, not what
 * was typed. The API re-checks that the person administers the organization; this only decides
 * whether the button is offered.
 */
@Component({
  selector: 'app-representative-name-editor',
  imports: [AppButton, FormActions, FormField, Input],
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
  protected readonly attempted = signal(false);
  protected readonly failure = signal('');

  protected readonly name = signal('');
  protected readonly middleName = signal('');
  protected readonly lastName = signal('');
  protected readonly motherLastName = signal('');

  protected open(): void {
    const current = this.parts();
    this.name.set(current.name ?? '');
    this.middleName.set(current.middleName ?? '');
    this.lastName.set(current.lastName ?? '');
    this.motherLastName.set(current.motherLastName ?? '');
    this.attempted.set(false);
    this.failure.set('');
    this.editing.set(true);
  }

  protected cancel(): void {
    this.editing.set(false);
  }

  protected missing(value: string): string {
    return this.attempted() && value.trim() === '' ? 'Este dato es obligatorio.' : '';
  }

  protected save(): void {
    this.attempted.set(true);
    if (this.pending() || this.name().trim() === '' || this.lastName().trim() === '') return;
    const body: LegalRepresentativeName = {
      name: this.name().trim(),
      lastName: this.lastName().trim(),
      ...(this.middleName().trim() ? { middleName: this.middleName().trim() } : {}),
      ...(this.motherLastName().trim() ? { motherLastName: this.motherLastName().trim() } : {}),
    };
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
