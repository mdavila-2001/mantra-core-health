import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { ViewState, ViewStateIssue } from '../../../core/view-state/view-state.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';

interface Shown {
  readonly tone: 'error' | 'warning';
  readonly title: string;
  readonly lines: readonly ViewStateIssue[];
  readonly requestId: string | null;
}

/**
 * El aviso de **por qué no se hizo** lo que la persona acaba de pedir: el rechazo
 * de la API sobre una acción, en el estado M34 que le corresponde, sin reemplazar
 * lo que hay debajo —quien corrige y reintenta no pierde lo escrito—.
 *
 * - S4 (regla de negocio o versión vieja): cada frase, con su campo si lo tiene.
 * - S5 (403): «su rol no permite esta acción», con los roles que sí podrían.
 * - S6, S8 y S9: una frase y, si la API la dio, el código de soporte.
 *
 * Siempre con el código de soporte cuando existe: sin él, quien reporta y quien
 * busca en los registros no se encuentran.
 */
@Component({
  selector: 'app-ops-issue-alert',
  imports: [Alert],
  template: `
    @if (shown(); as s) {
      <app-alert [tone]="s.tone" [title]="s.title" data-testid="ops-issue-alert" role="alert">
        <ul class="issues">
          @for (line of s.lines; track line.message) {
            <li>
              @if (line.field) {
                <strong>{{ line.field }}:</strong>
              }
              {{ line.message }}
            </li>
          }
        </ul>
        @if (s.requestId) {
          <p class="support">Código de soporte: <code class="tabular-nums">{{ s.requestId }}</code></p>
        }
      </app-alert>
    }
  `,
  styles: `
    .issues {
      margin: 0;
      padding-inline-start: var(--sp-5);
    }
    .support {
      margin: var(--sp-2) 0 0;
      font-size: var(--fs-caption);
      line-height: var(--lh-caption);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpsIssueAlert {
  /** El estado devuelto tras el intento; solo los que explican un fallo dibujan algo. */
  readonly state = input<ViewState<unknown> | null>(null);
  /** Qué se estaba intentando, para el título: «No se pudo aplicar el bloqueo». */
  readonly heading = input('No se pudo completar la operación');

  protected readonly shown = computed<Shown | null>(() => {
    const s = this.state();
    if (s === null) return null;
    switch (s.status) {
      case 'validation':
        return { tone: 'error', title: this.heading(), lines: s.issues, requestId: s.requestId ?? null };
      case 'forbidden':
        return {
          tone: 'error',
          title: 'No tiene permiso para esta acción',
          lines: [{ message: s.message ?? 'Su rol no permite esta acción sobre este espacio.' }],
          requestId: s.requestId ?? null,
        };
      case 'offline':
        return { tone: 'warning', title: this.heading(), lines: [{ message: 'Sin conexión: no llegó al servidor. Reintente.' }], requestId: null };
      case 'not-found':
        return { tone: 'error', title: this.heading(), lines: [{ message: 'Ese espacio ya no está disponible para usted.' }], requestId: null };
      case 'error':
        return { tone: 'error', title: this.heading(), lines: [{ message: s.message ?? 'Algo salió mal. Reintente en unos segundos.' }], requestId: s.requestId };
      default:
        return null;
    }
  });
}
