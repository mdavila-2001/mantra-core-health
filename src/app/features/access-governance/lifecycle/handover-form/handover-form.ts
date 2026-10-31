import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { HandoverPreview } from '../../../../core/data-access/access-governance/access-lifecycle.types';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { handoverKindHelp, handoverKindText, isSupervisedKind } from '../lifecycle.labels';
import type { PersonOption } from '../lifecycle.people';
import { countsOf, type HandoverDraft } from './handover-draft';

/** Valor del selector para «devolver a la bandeja común» (el selector no admite `''`). */
const POOL = '__pool__';

/**
 * **¿A quién se lo pasa?** (CONTRATO-GOBIERNO §9.5, pasos 1 y 2): muestra lo que la persona tiene en las manos (por tipo, con
 * su cantidad) y deja elegir un destino por tipo. Las citas se mantienen; las cuentas que supervisaba exigen un nuevo
 * dueño. Es lo que comparten la baja del administrador y la del jefe de servicio.
 */
@Component({
  selector: 'app-handover-form',
  imports: [Alert, FormField, Select],
  templateUrl: './handover-form.html',
  styleUrl: './handover-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HandoverForm {
  readonly preview = input.required<HandoverPreview>();
  readonly people = input.required<readonly PersonOption[]>();
  readonly draft = input.required<HandoverDraft>();
  /** Se muestra el error de lo que falta (después de intentar continuar). */
  readonly showIssues = input(false);

  readonly draftChange = output<HandoverDraft>();

  protected readonly rows = computed(() =>
    countsOf(this.preview()).map(({ kind, count }) => ({
      kind,
      count,
      supervised: isSupervisedKind(kind),
      text: `${count} ${handoverKindText(kind, count)}`,
      help: handoverKindHelp(kind),
    })),
  );

  protected readonly workOptions = computed<readonly SelectOption<string>[]>(() => [
    { value: POOL, label: 'Devolver a la bandeja común' },
    ...this.people().map((p) => ({ value: p.value, label: p.label })),
  ]);
  protected readonly ownerOptions = computed<readonly SelectOption<string>[]>(() =>
    this.people().map((p) => ({ value: p.value, label: p.label })),
  );

  protected targetOf(kind: string): string {
    const value = this.draft().targets[kind] ?? '';
    return value === '' ? POOL : value;
  }

  protected setTarget(kind: string, value: string | null): void {
    if (value === null) return;
    this.draftChange.emit({
      ...this.draft(),
      targets: { ...this.draft().targets, [kind]: value === POOL ? '' : value },
    });
  }

  protected setOwner(value: string | null): void {
    if (value === null) return;
    this.draftChange.emit({ ...this.draft(), supervisedTo: value });
  }

  protected ownerError(): string {
    return this.showIssues() && this.draft().supervisedTo === ''
      ? 'Elija el nuevo dueño de la cuenta.'
      : '';
  }
}
