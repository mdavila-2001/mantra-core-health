import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { ViewState, ViewStateIssue } from '../../../../core/view-state/view-state.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';

/**
 * El aviso de un rechazo del servidor sobre lo que la persona acaba de mandar
 * (S4): qué campo, qué pasó y el código de soporte. Es el mismo contenido que
 * `app-view-state-host` dibuja para S4, pero sin reemplazar el formulario que
 * tiene debajo — acá la persona corrige y reintenta sin perder lo escrito.
 */
@Component({
  selector: 'app-infra-issue-alert',
  imports: [Alert],
  template: `
    @if (problemas(); as p) {
      <app-alert tone="error" [title]="titulo()" data-testid="infra-issue-alert" role="alert">
        <ul class="issues">
          @for (issue of p.issues; track issue.message) {
            <li>
              @if (issue.field) {
                <strong>{{ issue.field }}:</strong>
              }
              {{ issue.message }}
            </li>
          }
        </ul>
        @if (p.requestId) {
          <p class="soporte">Código de soporte: <code class="tabular-nums">{{ p.requestId }}</code></p>
        }
      </app-alert>
    }
  `,
  styles: `
    .issues {
      margin: 0;
      padding-inline-start: var(--sp-5);
    }
    .soporte {
      margin: var(--sp-2) 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfraIssueAlert {
  /** El estado devuelto por el servidor; sólo `validation` dibuja algo. */
  readonly state = input<ViewState<unknown> | null>(null);

  /** Qué se estaba intentando, para el título: «No se pudo crear el espacio». */
  readonly heading = input('No se pudo completar la operación');

  protected readonly titulo = computed(() => this.heading());

  protected readonly problemas = computed<{ issues: readonly ViewStateIssue[]; requestId?: string } | null>(() => {
    const s = this.state();
    return s !== null && s.status === 'validation' ? { issues: s.issues, requestId: s.requestId } : null;
  });
}
