import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { SupportStaffProvisioningClient } from '../../../../../core/data-access/support-access/support-staff-provisioning.client';
import type { CreatedSupportStaffResponse } from '../../../../../core/data-access/support-access/support-provisioning.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';

@Component({
  selector: 'app-create-secretary-form',
  imports: [Alert, AppButton, FormField, Input],
  templateUrl: './create-secretary-form.html',
  styleUrl: './create-secretary-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateSecretaryForm {
  private readonly client = inject(SupportStaffProvisioningClient);

  readonly roleAssignmentId = input.required<string>();
  readonly created = output<CreatedSupportStaffResponse>();
  readonly cancelled = output<void>();

  protected readonly nationalId = signal('');
  protected readonly name = signal('');
  protected readonly lastName = signal('');
  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly birthDate = signal('');

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected isValid(): boolean {
    return (
      this.nationalId().trim().length >= 5 &&
      this.name().trim().length >= 2 &&
      this.lastName().trim().length >= 2 &&
      this.email().includes('@') &&
      this.phone().trim().length >= 7 &&
      this.birthDate().trim().length >= 8
    );
  }

  protected submit(): void {
    if (!this.isValid() || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.client
      .createPractitionerSecretary({
        nationalId: this.nationalId().trim(),
        issuerAdministrativeAreaConceptId: 'lp-uuid',
        name: this.name().trim(),
        lastName: this.lastName().trim(),
        email: this.email().trim(),
        phone: this.phone().trim(),
        birthDate: this.birthDate().trim(),
        practitionerRoleAssignmentId: this.roleAssignmentId(),
      })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.created.emit(res);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          const msg =
            (err as { error?: { message?: string } })?.error?.message ??
            'No se pudo crear la cuenta de la secretaria. Verifique los datos ingresados.';
          this.errorMessage.set(msg);
        },
      });
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
