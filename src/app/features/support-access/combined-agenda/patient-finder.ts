import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { AccessChallengeCancelledError, withAccessChallenge } from '../../../core/access-challenge/access-challenge';
import type { ExplainMyAccessRequest } from '../../../core/data-access/access-governance/access-explain.types';
import { SupportPatientsClient } from '../../../core/data-access/support-access/support-patients.client';
import type { PatientRepresentative, SupportPatientMatch } from '../../../core/data-access/support-access/support-patients.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AccessWhyNot } from '../../access-governance/why-not/why-not';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { patientFailureMessage } from './patient-failure';
import type { PickedPatient } from './picked-patient';
import { PatientRegister } from './patient-register';
import { SEARCH_HELP, SEARCH_MODES, validateExactSearch, type SearchMode } from './patient-search';

export type { PickedPatient } from './picked-patient';

const MODOS: readonly SegmentedOption<SearchMode>[] = SEARCH_MODES.map((m) => ({ value: m.value, label: m.label }));

/**
 * El buscador de pacientes de la agenda combinada. **Exacto**: documento
 * completo, teléfono completo, o nombre completo con fecha de nacimiento. Lo
 * parcial se rechaza con un mensaje que dice cómo buscar, y la petición ni
 * siquiera sale. El resultado trae datos mínimos (nombre, edad, documento y
 * teléfono tapados). Si no aparece, se lo puede registrar ahí mismo.
 *
 * Un menor no se elige solo: hay que decir quién actúa por él (su representante
 * legal o un familiar autorizado).
 */
@Component({
  selector: 'app-patient-finder',
  imports: [AccessWhyNot, Alert, AppButton, FormField, Input, PatientRegister, SegmentedControl],
  templateUrl: './patient-finder.html',
  styleUrl: './patient-finder.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientFinder {
  private readonly patients = inject(SupportPatientsClient);

  /** La organización en la que se actúa: ahí se audita la búsqueda y se registra. */
  readonly orgId = input.required<string>();
  readonly orgName = input.required<string>();
  /** Si el permiso incluye registrar pacientes nuevos. */
  readonly canRegister = input(false);

  readonly picked = output<PickedPatient>();

  protected readonly modes = MODOS;
  protected readonly mode = signal<SearchMode>('DOCUMENT');
  protected readonly text = signal('');
  protected readonly fullName = signal('');
  protected readonly birthDate = signal('');

  protected readonly searching = signal(false);
  /** Si la API rechazó la búsqueda por falta de permiso: qué preguntarle a «¿Por qué no puedo?». */
  protected readonly explain = signal<ExplainMyAccessRequest | null>(null);
  protected readonly notice = signal<{ readonly message: string; readonly help: string } | null>(null);
  protected readonly results = signal<readonly SupportPatientMatch[] | null>(null);
  protected readonly registering = signal(false);
  /** Para los menores: a quién se eligió como representante, por paciente. */
  protected readonly representative = signal<Readonly<Record<string, string>>>({});

  protected readonly help = computed(() => SEARCH_HELP[this.mode()]);
  protected readonly textLabel = computed(() => (this.mode() === 'DOCUMENT' ? 'Documento de identidad' : 'Teléfono'));

  protected setMode(mode: SearchMode): void {
    this.mode.set(mode);
    this.notice.set(null);
    this.results.set(null);
  }

  protected search(): void {
    const validation = validateExactSearch({ mode: this.mode(), text: this.text(), fullName: this.fullName(), birthDate: this.birthDate() });
    this.results.set(null);
    if (!validation.ok) {
      this.notice.set({ message: validation.message, help: validation.help });
      return;
    }
    this.notice.set(null);
    this.explain.set(null);
    this.searching.set(true);
    // Buscar a un paciente reservado puede pedir el segundo paso: se resuelve en un diálogo y se reintenta la misma búsqueda.
    const desafio = { context: withAccessChallenge({ actionLabel: 'Buscar a un paciente por documento, teléfono o nombre', approval: { tenantId: this.orgId(), atom: 'patients.search.exact' } }) };
    this.patients.searchExact(this.orgId(), validation.query, desafio).subscribe({
      next: ({ items }) => {
        this.searching.set(false);
        this.results.set(items);
      },
      error: (failure: unknown) => {
        this.searching.set(false);
        if (failure instanceof AccessChallengeCancelledError) {
          this.notice.set({ message: 'No se buscó: usted canceló el paso adicional que se pedía.', help: SEARCH_HELP[this.mode()] });
          return;
        }
        this.notice.set({ message: patientFailureMessage(failure, 'No pudimos buscar al paciente.'), help: SEARCH_HELP[this.mode()] });
        // Un rechazo por falta de permiso ofrece «¿Por qué no puedo?» sobre esta misma acción.
        if (failure instanceof HttpErrorResponse && failure.status === 403) this.explain.set({ tenantId: this.orgId(), action: 'patients.search.exact' });
      },
    });
  }

  protected representativeOf(patient: SupportPatientMatch): PatientRepresentative | null {
    const elegido = this.representative()[patient.profileId];
    return patient.representatives?.find((r) => r.id === elegido) ?? null;
  }

  protected chooseRepresentative(patient: SupportPatientMatch, id: string): void {
    this.representative.update((actual) => ({ ...actual, [patient.profileId]: id }));
  }

  protected canPick(patient: SupportPatientMatch): boolean {
    return !patient.isMinor || this.representativeOf(patient) !== null;
  }

  protected pick(patient: SupportPatientMatch): void {
    if (!this.canPick(patient)) return;
    this.picked.emit({ patient, representative: this.representativeOf(patient) });
  }

  protected startRegister(): void {
    this.registering.set(true);
  }

  protected registered(event: PickedPatient): void {
    this.registering.set(false);
    this.picked.emit(event);
  }
}
