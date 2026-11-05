import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { hasNationalIdContent } from '../../../core/data-access/support-access/national-id';
import { SupportPatientsClient } from '../../../core/data-access/support-access/support-patients.client';
import type { NewSupportPatient, PossibleDuplicate, SupportPatientMatch } from '../../../core/data-access/support-access/support-patients.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { patientFailureMessage } from './patient-failure';
import type { PickedPatient } from './picked-patient';
import { isMinorOn, MIN_DOCUMENT_LENGTH, MIN_PHONE_DIGITS } from './patient-search';

/**
 * Registro rápido de un paciente nuevo, para quien tiene permiso de registrar.
 *
 * - Pide lo mínimo: nombre, apellido, documento, nacimiento y teléfono.
 * - Si ya hay alguien **parecido** (mismo nombre y nacimiento, o mismo teléfono y
 *   apellido) **avisa antes de crear**: «¿es esta persona?». Se puede seguir
 *   igual, pero a propósito.
 * - Si es menor de 18 años, **exige** a su representante legal o familiar
 *   autorizado, con nombre, documento, teléfono y parentesco.
 * - Puede **invitarlo** a activar su cuenta de paciente.
 */
@Component({
  selector: 'app-patient-register',
  imports: [Alert, AppButton, FormField, Input],
  templateUrl: './patient-register.html',
  styleUrl: './patient-register.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRegister {
  private readonly patients = inject(SupportPatientsClient);
  private readonly toasts = inject(ToastService);

  readonly orgId = input.required<string>();
  readonly orgName = input.required<string>();
  /** Un documento que ya se había escrito en el buscador: no se pide dos veces. */
  readonly document = input('');

  readonly created = output<PickedPatient>();
  readonly cancelled = output<void>();

  protected readonly name = signal('');
  protected readonly lastName = signal('');
  protected readonly motherLastName = signal('');
  protected readonly documentValue = signal('');
  protected readonly birthDate = signal('');
  protected readonly phone = signal('');
  protected readonly invite = signal(true);

  protected readonly guardianName = signal('');
  protected readonly guardianDocument = signal('');
  protected readonly guardianPhone = signal('');
  protected readonly guardianRelationship = signal('');

  protected readonly saving = signal(false);
  protected readonly touched = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly duplicates = signal<readonly PossibleDuplicate[] | null>(null);

  protected readonly minor = computed(() => isMinorOn(this.birthDate(), new Date()));

  constructor() {
    queueMicrotask(() => {
      if (this.document() !== '' && this.documentValue() === '') this.documentValue.set(this.document());
    });
  }

  /** Lo que falta, en palabras; vacío si se puede guardar. */
  protected readonly missing = computed<readonly string[]>(() => {
    const faltan: string[] = [];
    if (this.name().trim() === '') faltan.push('el nombre');
    if (this.lastName().trim() === '') faltan.push('el apellido');
    const documento = this.documentValue().trim().replace(/\s/g, '');
    if (documento.length < MIN_DOCUMENT_LENGTH) faltan.push('el documento completo');
    else if (!hasNationalIdContent(documento)) faltan.push('un documento con contenido (no solo ceros, puntos o guiones)');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.birthDate())) faltan.push('la fecha de nacimiento');
    if (this.phone().replace(/\D/g, '').length < MIN_PHONE_DIGITS) faltan.push('el teléfono completo (8 dígitos)');
    if (this.minor()) {
      if (this.guardianName().trim() === '') faltan.push('el nombre del representante');
      if (this.guardianDocument().trim().replace(/\s/g, '').length < MIN_DOCUMENT_LENGTH) faltan.push('el documento del representante');
      if (this.guardianPhone().replace(/\D/g, '').length < MIN_PHONE_DIGITS) faltan.push('el teléfono del representante (8 dígitos)');
      if (this.guardianRelationship().trim() === '') faltan.push('el parentesco del representante');
    }
    return faltan;
  });

  protected submit(acknowledge = false): void {
    this.touched.set(true);
    this.failure.set(null);
    if (this.missing().length > 0 || this.saving()) return;
    const patient: NewSupportPatient = {
      name: this.name().trim(),
      lastName: this.lastName().trim(),
      ...(this.motherLastName().trim() === '' ? {} : { motherLastName: this.motherLastName().trim() }),
      document: this.documentValue().trim().replace(/\s/g, ''),
      birthDate: this.birthDate(),
      phone: this.phone().replace(/\D/g, ''),
      ...(this.minor()
        ? {
            guardian: {
              name: this.guardianName().trim(),
              document: this.guardianDocument().trim().replace(/\s/g, ''),
              phone: this.guardianPhone().replace(/\D/g, ''),
              relationship: this.guardianRelationship().trim(),
            },
          }
        : {}),
      inviteToPortal: this.invite(),
      ...(acknowledge ? { acknowledgeDuplicates: true } : {}),
    };
    this.saving.set(true);
    this.patients.register(this.orgId(), patient).subscribe({
      next: (result) => {
        this.saving.set(false);
        if (result.outcome === 'POSSIBLE_DUPLICATES') {
          this.duplicates.set(result.duplicates);
          return;
        }
        this.duplicates.set(null);
        this.toasts.success(
          result.invitationSent ? 'Paciente registrado. Quedó pedida la invitación para activar su cuenta.' : 'Paciente registrado.',
          result.patient.displayName,
        );
        const representative = result.patient.representatives?.[0] ?? null;
        this.created.emit({
          patient: result.patient,
          representative,
          registration: { identityVerified: false, guardianPending: result.guardian?.status === 'PENDING_VERIFICATION' },
        });
      },
      error: (failureResponse: unknown) => {
        this.saving.set(false);
        this.failure.set(patientFailureMessage(failureResponse, 'No pudimos registrar al paciente.'));
      },
    });
  }

  /** «Es esta persona»: se usa la que ya existía, sin crear otra. */
  protected useExisting(duplicate: PossibleDuplicate): void {
    // Una persona de otra organización no tiene perfil que usar: la API no se lo da y acá no se ofrece.
    if (!duplicate.linkedToOrganization || duplicate.profileId === undefined) return;
    const patient: SupportPatientMatch = { ...duplicate, profileId: duplicate.profileId, ageYears: duplicate.ageYears ?? 0 };
    this.created.emit({ patient, representative: patient.representatives?.[0] ?? null });
  }

  /** Con qué coincide, en palabras: la API lo dice con códigos. */
  protected coincide(duplicate: PossibleDuplicate): string {
    const motivos = duplicate.matchedBy.map((m) => ({ DOCUMENT: 'el documento', NAME_AND_BIRTH_DATE: 'el nombre y la fecha de nacimiento', PHONE_AND_SURNAME: 'el teléfono y el apellido' })[m] ?? 'otros datos');
    return motivos.join(' y ');
  }

  protected set(signalToSet: { set(value: string): void }, value: string | number | null): void {
    signalToSet.set('' + (value ?? ''));
  }
}
