import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { SiteContextStore } from '../../../core/data-access/operating-rooms/site-context.store';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';

/**
 * La sede sobre la que trabaja la pantalla (quirófanos, tarifas, día-cama,
 * contabilidad). Con una sola sede muestra su nombre; con varias, un selector.
 * Elegir cambia la sede del `SiteContextStore`, y las pantallas releen porque
 * su lectura está atada a `siteId()`.
 */
@Component({
  selector: 'app-site-switch',
  imports: [Select],
  template: `
    @if (options().length > 1) {
      <div class="site-switch" data-testid="site-switch">
        <app-select [options]="options()" [value]="store.siteId()" ariaLabel="Establecimiento" (valueChange)="choose($event)" />
      </div>
    } @else if (store.site(); as site) {
      <p class="site-switch__single" data-testid="site-switch-single">{{ site.code }} · {{ site.name }}</p>
    }
  `,
  styles: `
    :host { display: block; }
    .site-switch { max-width: 22rem; }
    .site-switch__single { margin: 0; color: var(--text-secondary); font-size: var(--fs-caption); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteSwitch {
  protected readonly store = inject(SiteContextStore);
  protected readonly options = computed<readonly SelectOption<string>[]>(() => this.store.sites().map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })));

  protected choose(id: string | null): void {
    if (id !== null) this.store.select(id);
  }
}
