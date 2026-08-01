import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';

import { nextControlId } from '@shared/forms/form-control.context';
import { TABS_PARENT } from '../tabs.types';

/**
 * Una sección de un `app-tabs`. El host **es** el panel (`role="tabpanel"`);
 * el botón de la pestaña lo dibuja el padre a partir de `label`.
 *
 * ```html
 * <app-tabs>
 *   <app-tab label="Evolución">…</app-tab>
 *   <app-tab label="Laboratorio" [disabled]="sinResultados()">…</app-tab>
 * </app-tabs>
 * ```
 *
 * El contenido de un panel inactivo **no existe en el DOM**: en una ficha de
 * paciente cada panel puede traer su propia consulta, y renderizar los seis
 * para mostrar uno es trabajo tirado.
 */
@Component({
  selector: 'app-tab',
  templateUrl: './tab.html',
  styleUrl: './tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tab',
    role: 'tabpanel',
    '[id]': 'panelId',
    '[attr.aria-labelledby]': 'tabId',
    '[hidden]': '!isActive()',
    // El panel entra en el orden de tabulación: su contenido puede ser texto
    // sin controles y hay que poder alcanzarlo para leerlo con el teclado.
    '[attr.tabindex]': 'isActive() ? 0 : null',
  },
})
export class Tab {
  private readonly tabs = inject(TABS_PARENT, { optional: true });

  readonly label = input.required<string>();
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly baseId = nextControlId('tab');
  readonly tabId = `${this.baseId}-tab`;
  readonly panelId = `${this.baseId}-panel`;

  /** Sin `app-tabs` alrededor el panel se muestra siempre: no hay quién elija. */
  readonly isActive = computed(() => this.tabs === null || this.tabs.activeTab() === this);
}
