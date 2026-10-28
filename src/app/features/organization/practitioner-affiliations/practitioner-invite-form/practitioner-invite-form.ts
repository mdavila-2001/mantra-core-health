import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { HealthcareServicesClient } from '../../../../core/data-access/healthcare-services/healthcare-services.client';
import type { HealthcareServiceOffer } from '../../../../core/data-access/healthcare-services/healthcare-services.types';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import { RoleAssignmentsClient } from '../../../../core/data-access/role-assignments/role-assignments.client';
import type { RoleAssignmentRow } from '../../../../core/data-access/role-assignments/role-assignments.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';

/** Cuántos médicos se ofrecen en el selector: el contrato no trae una búsqueda propia. */
const PRACTITIONERS_LIMIT = 100;

/**
 * **Invitar a un médico** a una sede del centro, marcando los procedimientos
 * que publica esa sede (CM-07, HU-C3).
 *
 * Las casillas salen solo de lo que la sede publica y tiene activo: no hay otra
 * fuente. La invitación crea una fila «pendiente de aceptación del médico» por
 * procedimiento; nada queda activo hasta que el médico acepte.
 */
@Component({
  selector: 'app-practitioner-invite-form',
  imports: [Alert, AppButton, Checkbox, FormField, Select],
  templateUrl: './practitioner-invite-form.html',
  styleUrl: './practitioner-invite-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerInviteForm {
  private readonly assignments = inject(RoleAssignmentsClient);
  private readonly services = inject(HealthcareServicesClient);
  private readonly profiles = inject(ProfilesClient);

  readonly practiceId = input.required<string>();
  readonly practiceSiteId = input.required<string>();

  /** Las filas que creó la invitación, ya con su estado. */
  readonly invited = output<readonly RoleAssignmentRow[]>();
  readonly cancelled = output<void>();

  protected readonly practitionerOptions = signal<readonly SelectOption<string>[]>([]);
  protected readonly practitionerId = signal<string | null>(null);
  protected readonly procedures = signal<readonly HealthcareServiceOffer[]>([]);
  protected readonly proceduresLoading = signal(true);
  protected readonly checked = signal<ReadonlySet<string>>(new Set());
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canSubmit = computed(
    () => this.practitionerId() !== null && this.checked().size > 0 && !this.saving(),
  );

  constructor() {
    this.profiles.listPractitioners({ limit: PRACTITIONERS_LIMIT }).subscribe({
      next: (page) =>
        this.practitionerOptions.set(
          page.items.map((item) => ({
            value: item.profileId,
            label: item.displayName ?? item.practitionerCode,
          })),
        ),
      error: () => this.error.set('No pudimos cargar la lista de médicos. Cierre y vuelva a abrir el formulario.'),
    });

    effect(() => {
      const practiceId = this.practiceId();
      const siteId = this.practiceSiteId();
      untracked(() => this.loadProcedures(practiceId, siteId));
    });
  }

  protected isChecked(id: string): boolean {
    return this.checked().has(id);
  }

  protected toggle(id: string, on: boolean): void {
    this.checked.update((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected submit(): void {
    const practitionerProfileId = this.practitionerId();
    if (practitionerProfileId === null || !this.canSubmit()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.assignments
      .invite(this.practiceId(), {
        practitionerProfileId,
        practiceSiteId: this.practiceSiteId(),
        healthcareServiceIds: [...this.checked()],
      })
      .subscribe({
        next: (rows) => {
          this.saving.set(false);
          this.invited.emit(rows);
        },
        error: (failure: unknown) => {
          this.saving.set(false);
          this.error.set(this.messageOf(failure));
        },
      });
  }

  private loadProcedures(practiceId: string, siteId: string): void {
    this.proceduresLoading.set(true);
    this.checked.set(new Set());
    this.services.listOffers(practiceId, siteId).subscribe({
      next: (list) => {
        // Solo lo que la sede tiene activo: no hay otra fuente de procedimientos.
        this.procedures.set(list.filter((offer) => offer.active));
        this.proceduresLoading.set(false);
      },
      error: () => {
        this.procedures.set([]);
        this.proceduresLoading.set(false);
        this.error.set('No pudimos cargar los procedimientos de la sede.');
      },
    });
  }

  private messageOf(failure: unknown): string {
    const state = errorToViewState<unknown>(failure);
    return 'message' in state && typeof state.message === 'string' && state.message !== ''
      ? state.message
      : 'No pudimos enviar la invitación. Intente de nuevo.';
  }
}
