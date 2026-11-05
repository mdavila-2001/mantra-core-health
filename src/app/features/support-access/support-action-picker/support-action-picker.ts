import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import {
  SUPPORT_ACTION_CODES,
  SUPPORT_ACTION_LABELS,
  type SupportActionCode,
} from '../../../core/data-access/support-access/support-access.types';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';

/** Las acciones agrupadas como la persona las piensa, no como las nombra el contrato. */
export const ACTION_GROUPS: readonly { readonly title: string; readonly actions: readonly SupportActionCode[] }[] = [
  {
    title: 'Agenda',
    actions: [
      'schedule.view',
      'schedule.create',
      'schedule.reschedule',
      'schedule.cancel',
      'schedule.confirm',
      'schedule.check_in',
      'schedule.walk_in',
      'schedule.waitlist',
      'schedule.send_reminders',
      'schedule.block_time',
      'schedule.edit_hours',
    ],
  },
  { title: 'Cobro', actions: ['billing.collect', 'billing.issue_receipt'] },
  { title: 'Pacientes y mensajes', actions: ['patient.register', 'messages.reply_on_behalf'] },
];

/**
 * Casillas de las acciones que se pueden otorgar, en grupos.
 *
 * Es un campo de formulario común: recibe las acciones elegidas y las
 * devuelve. No decide qué se puede otorgar —eso lo valida la API—. «Ver la
 * agenda» se avisa si falta, porque sin ella el resto no se puede usar.
 */
@Component({
  selector: 'app-support-action-picker',
  imports: [Checkbox],
  template: `
    @for (grupo of grupos; track grupo.title) {
      <fieldset class="picker__grupo">
        <legend class="picker__titulo">{{ grupo.title }}</legend>
        <div class="picker__casillas">
          @for (accion of grupo.actions; track accion) {
            <app-checkbox
              [label]="etiqueta(accion)"
              [checked]="estaElegida(accion)"
              [disabled]="disabled()"
              (checkedChange)="alternar(accion, $event)"
              [attr.data-testid]="idPrefix() + '-' + accion"
            />
          }
        </div>
      </fieldset>
    }
    @if (faltaVer()) {
      <p class="picker__aviso" role="note">
        Sin «Ver la agenda», las demás acciones no se pueden usar.
      </p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--sp-3);
    }
    .picker__grupo {
      margin: 0;
      padding: 0;
      border: 0;
      min-inline-size: 0;
    }
    .picker__titulo {
      padding: 0;
      margin-block-end: var(--sp-2);
      font-size: var(--fs-caption);
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .picker__casillas {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
      gap: var(--sp-2) var(--sp-4);
    }
    .picker__aviso {
      margin: 0;
      font-size: var(--fs-caption);
      color: var(--st-warning-fg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportActionPicker {
  /** Las acciones elegidas. */
  readonly actions = model<readonly SupportActionCode[]>([]);
  readonly disabled = input<boolean>(false);
  /** Prefijo de los `data-testid` de cada casilla. */
  readonly idPrefix = input<string>('accion');

  protected readonly grupos = ACTION_GROUPS;
  protected readonly faltaVer = computed(
    () => this.actions().length > 0 && !this.actions().includes('schedule.view'),
  );

  protected etiqueta(accion: SupportActionCode): string {
    return SUPPORT_ACTION_LABELS[accion];
  }

  protected estaElegida(accion: SupportActionCode): boolean {
    return this.actions().includes(accion);
  }

  protected alternar(accion: SupportActionCode, marcada: boolean): void {
    const actuales = this.actions();
    if (marcada === actuales.includes(accion)) return;
    this.actions.set(
      marcada
        ? SUPPORT_ACTION_CODES.filter((codigo) => codigo === accion || actuales.includes(codigo))
        : actuales.filter((codigo) => codigo !== accion),
    );
  }
}
