import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { type Params, RouterLink, RouterLinkActive } from '@angular/router';

import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { INSIGHTS_BASE, MODULE_BY_ID } from '../insights-nav';
import type { InsightModuleId } from '../domain/insights.types';

const TABS: readonly InsightModuleId[] = ['home', 'campaigns', 'alerts'];

/** Barra inferior para pantallas angostas: Panel, Campañas, Alertas y «Más» (abre el menú). */
@Component({
  selector: 'app-ins-tabbar',
  imports: [RouterLink, RouterLinkActive, NavIcon],
  template: `
    <nav class="tb" aria-label="Navegación principal">
      @for (t of tabs; track t.id) {
        <a class="tb__item" [routerLink]="[base, t.path]" [queryParams]="query()" routerLinkActive="tb__item--on">
          <app-nav-icon [name]="t.icon" />
          <span>{{ t.short }}</span>
          @if (t.id === 'alerts' && alerts() > 0) { <span class="tb__badge" [attr.aria-label]="alerts() + ' alertas abiertas'">{{ alerts() }}</span> }
        </a>
      }
      <button type="button" class="tb__item" (click)="more.emit()"><span aria-hidden="true">☰</span><span>Más</span></button>
    </nav>
  `,
  styleUrl: './mobile-tabbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileTabbar {
  readonly query = input<Params>({});
  readonly alerts = input(0);
  readonly more = output<void>();
  protected readonly base = INSIGHTS_BASE;
  protected readonly tabs = TABS.map((id) => MODULE_BY_ID.get(id)!);
}
