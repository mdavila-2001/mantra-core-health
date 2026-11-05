import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { BrandMark } from '../../shared/components/atoms/brand-mark/brand-mark';
import { NavIcon } from '../../shared/components/atoms/nav-icon/nav-icon';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { LoadingState } from '../../shared/components/molecules/loading-state/loading-state';
import {
  accesoAPortales,
  cantidadDePortales,
  PORTAL_ADMINISTRACION_ROUTE,
  PORTAL_INSIGHTS_ROUTE,
  PORTAL_REPORTERIA_ROUTE,
  puedeVerInsights,
} from '../reporting/reporting-access';

/** Qué pinta la pantalla según los accesos de la sesión. */
export type SelectorView = 'elegir' | 'redirigiendo' | 'sin-permiso';

/**
 * La pantalla donde quien administra **y** consulta reportes elige a qué portal
 * entra.
 *
 * ## Quién la ve
 *
 * Solo quien tiene dos o más accesos. Con uno solo no hay nada que elegir: se
 * redirige directo, sin mostrar una pantalla de paso (se reemplaza la entrada
 * del historial para que «Atrás» no devuelva a una pantalla que solo redirige).
 * Sin ninguno, el estado «sin permiso» orienta a quién pedirlo.
 *
 * ## Qué NO es
 *
 * Ocultar una tarjeta no es seguridad. La tarjeta que falta es una puerta que
 * no se ofrece; la que sí está lleva a una ruta cuyo guard y cuya API validan el
 * rol por su cuenta. Un enlace guardado a `/reports` entra por esa ruta, no
 * por esta pantalla.
 */
@Component({
  selector: 'app-portal-selector',
  imports: [RouterLink, Badge, BrandMark, NavIcon, EmptyState, LoadingState],
  templateUrl: './portal-selector.html',
  styleUrl: './portal-selector.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalSelector {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly administracionRoute = PORTAL_ADMINISTRACION_ROUTE;
  protected readonly reporteriaRoute = PORTAL_REPORTERIA_ROUTE;
  protected readonly insightsRoute = PORTAL_INSIGHTS_ROUTE;

  protected readonly acceso = computed(() => accesoAPortales(this.auth.roles()));

  /** Tarjeta de AloVida Insights: el portal de marketing, de alcance plataforma. */
  protected readonly insights = computed(() => puedeVerInsights(this.auth.roles()));

  /** Cuántas tarjetas se ofrecen; con dos o más hay algo que elegir. */
  protected readonly cantidad = computed(() => cantidadDePortales(this.acceso()));

  /** Primer nombre si la sesión lo trae; sin nombre el saludo es genérico. */
  protected readonly nombre = computed(() => {
    const completo = this.auth.displayName()?.trim() ?? '';
    return completo === '' ? null : completo.split(/\s+/)[0];
  });

  readonly view = computed<SelectorView>(() => {
    const cantidad = this.cantidad();
    if (cantidad >= 2) {
      return 'elegir';
    }
    return cantidad === 1 ? 'redirigiendo' : 'sin-permiso';
  });

  /** A dónde va quien tiene un solo acceso. `null` cuando hay que elegir o no hay nada. */
  readonly destinoDirecto = computed<string | null>(() => {
    const { administracion, reporteria, insights } = this.acceso();
    if (this.cantidad() !== 1) {
      return null;
    }
    if (administracion) {
      return PORTAL_ADMINISTRACION_ROUTE;
    }
    return reporteria ? PORTAL_REPORTERIA_ROUTE : insights ? PORTAL_INSIGHTS_ROUTE : null;
  });

  constructor() {
    effect(() => {
      const destino = this.destinoDirecto();
      if (destino !== null) {
        void this.router.navigateByUrl(destino, { replaceUrl: true });
      }
    });
  }
}
