import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import { NavIcon } from '../../shared/components/atoms/nav-icon/nav-icon';
import { accesoAPortales, cantidadDePortales, PORTAL_SELECTOR_ROUTE } from '../reporting/reporting-access';
import { SYNTHETIC_NOTICE } from './domain/campaigns.data';
import { longDate, PROTOTYPE_TODAY } from './domain/dates';
import { InsightsContext } from './insights-context';
import { InsightsData } from './insights-data';
import { InsightsWorkflow } from './insights-workflow';
import { INSIGHTS_BASE, INSIGHTS_MODULES } from './insights-nav';
import { openAlertCount } from './insights-summary';
import { SavedViews } from './components/saved-views';

const KEY_COLLAPSED = 'insights.nav.collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(KEY_COLLAPSED) === '1';
  } catch {
    return false;
  }
}

/**
 * Marco de AloVida Insights: barra lateral con los 8 módulos (expandible o solo
 * íconos), cabecera con ruta, módulo y pregunta de negocio, y la zona de trabajo.
 *
 * El contexto de análisis (campaña, periodo, canal, métrica) se conserva al
 * cambiar de módulo: viaja en la URL. Ocultar un módulo no sería seguridad; la
 * autoridad de los permisos es la API.
 */
@Component({
  selector: 'app-insights-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NavIcon, SavedViews, ViewStateHost],
  providers: [InsightsContext, InsightsData, InsightsWorkflow],
  templateUrl: './insights-shell.html',
  styleUrl: './insights-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsightsShell {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly ctx = inject(InsightsContext);
  protected readonly data = inject(InsightsData);

  protected readonly selectorRoute = PORTAL_SELECTOR_ROUTE;
  /** «Cambiar de portal» solo se ofrece a quien tiene otro acceso además de Insights. */
  protected readonly canSwitchPortal = computed(
    () => cantidadDePortales(accesoAPortales(this.auth.roles())) >= 2,
  );

  protected readonly modules = INSIGHTS_MODULES;
  protected readonly base = INSIGHTS_BASE;
  protected readonly notice = SYNTHETIC_NOTICE;
  protected readonly asOf = longDate(PROTOTYPE_TODAY);
  protected readonly alertCount = openAlertCount();

  protected readonly collapsed = signal(readCollapsed());
  protected readonly drawer = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.router.url.split('?')[0] ?? ''),
    ),
    { initialValue: '' },
  );

  protected readonly current = computed(() => this.modules.find((m) => this.url().includes(`/${m.path}`)) ?? this.modules[0]!);
  protected readonly query = computed(() => this.ctx.carry());

  protected toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(KEY_COLLAPSED, next ? '1' : '0');
    } catch {
      /* el estado del menú es una conveniencia, no un requisito */
    }
  }
}
