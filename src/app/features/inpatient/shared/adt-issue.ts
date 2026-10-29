import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { ViewState } from '../../../core/view-state/view-state.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';

/**
 * El resultado de una escritura que NO ocupa toda la pantalla: S4 (el servidor
 * rechazó lo mandado y dice por qué), S8 (sin conexión) y S9 (con su código de
 * soporte). El formulario o la ficha queda debajo, con lo escrito. S5 y S6 los
 * resuelve cada pantalla, porque cambian lo que se puede ver.
 */
@Component({
  selector: 'app-adt-issue',
  imports: [Alert],
  template: `
    @if (vista(); as v) {
      <app-alert tone="error" [title]="heading()" role="alert" data-testid="adt-problema" [attr.data-m34]="v.m34">
        @for (m of v.mensajes; track m) {
          <p class="adt-problema__linea">{{ m }}</p>
        }
        @if (v.requestId) {
          <p class="adt-problema__soporte">Código de soporte: <code class="tabular-nums" data-testid="adt-problema-request-id">{{ v.requestId }}</code></p>
        }
      </app-alert>
    }
  `,
  styles: `
    .adt-problema__linea { margin: 0; }
    .adt-problema__linea + .adt-problema__linea { margin-block-start: var(--sp-1); }
    .adt-problema__soporte { margin: var(--sp-2) 0 0; font-size: var(--fs-caption); line-height: var(--lh-caption); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdtIssue {
  readonly state = input<ViewState<unknown> | null>(null);
  readonly heading = input('No se pudo completar la operación');

  protected readonly vista = computed(() => {
    const s = this.state();
    if (s === null) return null;
    switch (s.status) {
      case 'validation':
        return { m34: 'S4', mensajes: s.issues.map((i) => i.message), requestId: s.requestId };
      case 'offline':
        return { m34: 'S8', mensajes: ['Sin conexión. No se cambió nada: revise su red y reintente.'], requestId: undefined };
      case 'error':
        return { m34: 'S9', mensajes: [s.message ?? 'Ocurrió un error inesperado.'], requestId: s.requestId };
      default:
        return null;
    }
  });
}
