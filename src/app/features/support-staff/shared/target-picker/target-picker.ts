import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import type { CatalogEntry, SupportCatalog, SupportTarget } from '../../../../core/data-access/support-staff/support-staff.types';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';

/** Lo elegido: doctores por `practitionerRoleAssignmentId`, pisos por `careSpaceId`. */
export interface TargetSelection {
  readonly doctors: readonly string[];
  readonly floors: readonly string[];
}

export const EMPTY_SELECTION: TargetSelection = { doctors: [], floors: [] };

/** Si no se eligió nada: sin doctores ni pisos no hay a quién asistir. */
export function isEmptySelection(selection: TargetSelection): boolean {
  return selection.doctors.length === 0 && selection.floors.length === 0;
}

/** Lo elegido como objetivos de la API: un `PRACTITIONER` por doctor y un `SPACE` por piso. */
export function targetsOf(selection: TargetSelection): readonly SupportTarget[] {
  return [
    ...selection.doctors.map((id) => ({ targetKind: 'PRACTITIONER' as const, practitionerRoleAssignmentId: id })),
    ...selection.floors.map((id) => ({ targetKind: 'SPACE' as const, careSpaceId: id })),
  ];
}

function toggle(list: readonly string[], id: string, on: boolean): readonly string[] {
  return on ? [...new Set([...list, id])] : list.filter((item) => item !== id);
}

function sorted(entries: readonly CatalogEntry[]): readonly CatalogEntry[] {
  return [...entries].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'));
}

/**
 * Elegir **doctores y pisos** de una organización: lo que la secretaria pide,
 * lo que la organización le aprueba y lo que le asigna después. Una sola pieza
 * para los tres lados, para que lo que se pide y lo que se aprueba se lean igual.
 */
@Component({
  selector: 'app-support-target-picker',
  imports: [Checkbox],
  template: `
    <div class="picker">
      <fieldset class="picker__group" data-testid="apoyo-doctores">
        <legend class="picker__legend">Doctores</legend>
        @for (doctor of doctors(); track doctor.id) {
          <app-checkbox
            [label]="doctor.name ?? 'Doctor sin nombre'"
            [disabled]="disabled()"
            [checked]="selection().doctors.includes(doctor.id)"
            (checkedChange)="setDoctor(doctor.id, $event)"
            [attr.data-testid]="'apoyo-doctor-' + doctor.id"
          />
        } @empty {
          <p class="picker__empty">La organización todavía no tiene doctores afiliados.</p>
        }
      </fieldset>
      <fieldset class="picker__group" data-testid="apoyo-pisos">
        <legend class="picker__legend">Pisos</legend>
        @for (floor of floors(); track floor.id) {
          <app-checkbox
            [label]="floor.name ?? 'Piso sin nombre'"
            [disabled]="disabled()"
            [checked]="selection().floors.includes(floor.id)"
            (checkedChange)="setFloor(floor.id, $event)"
            [attr.data-testid]="'apoyo-piso-' + floor.id"
          />
        } @empty {
          <p class="picker__empty">La organización todavía no cargó sus pisos.</p>
        }
      </fieldset>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .picker {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--sp-4);
    }
    @media (min-width: 780px) {
      .picker {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    .picker__group {
      display: grid;
      gap: var(--sp-2);
      margin: 0;
      padding: var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--r-md);
    }
    .picker__legend {
      padding-inline: var(--sp-1);
      font-weight: 600;
      color: var(--text-primary);
    }
    .picker__empty {
      margin: 0;
      color: var(--text-secondary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportTargetPicker {
  readonly catalog = input.required<SupportCatalog>();
  readonly selection = model<TargetSelection>(EMPTY_SELECTION);
  readonly disabled = input(false);

  protected readonly doctors = computed(() => sorted(this.catalog().practitioners));
  protected readonly floors = computed(() => sorted(this.catalog().floors));

  protected setDoctor(id: string, on: boolean): void {
    this.selection.update((current) => ({ ...current, doctors: toggle(current.doctors, id, on) }));
  }

  protected setFloor(id: string, on: boolean): void {
    this.selection.update((current) => ({ ...current, floors: toggle(current.floors, id, on) }));
  }
}
