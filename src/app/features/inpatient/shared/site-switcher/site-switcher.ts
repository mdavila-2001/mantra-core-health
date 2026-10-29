import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Select } from '../../../../shared/components/atoms/select/select';
import { InpatientSites } from '../inpatient-sites';

/**
 * Elige el establecimiento cuando la organización tiene más de uno; con uno solo
 * dice cuál es. Va en las acciones del encabezado de cada pantalla de internación.
 */
@Component({
  selector: 'app-site-switcher',
  imports: [Select],
  template: `
    @if (sites.sites().length > 1) {
      <app-select
        class="sede"
        ariaLabel="Establecimiento"
        [options]="opciones()"
        [value]="sites.siteId()"
        (valueChange)="elegir($event)"
        data-testid="internacion-sede"
      />
    } @else if (sites.site(); as s) {
      <span class="sede-unica" data-testid="internacion-sede-unica">{{ s.name }}</span>
    }
  `,
  styles: `
    :host { display: inline-block; min-inline-size: 14rem; }
    .sede-unica { color: var(--text-secondary); font-size: var(--fs-caption); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteSwitcher {
  protected readonly sites = inject(InpatientSites);
  protected readonly opciones = computed<readonly SelectOption<string>[]>(() =>
    this.sites.sites().map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })),
  );

  protected elegir(id: string | null): void {
    if (id !== null) this.sites.select(id);
  }
}
