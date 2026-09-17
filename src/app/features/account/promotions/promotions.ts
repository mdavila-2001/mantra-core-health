import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  InjectionToken,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { PromotionCard } from './promotion-card/promotion-card';
import { promocionesRecibidasDeEjemplo, type PromocionRecibida } from './promotions.fixtures';

/**
 * De dónde salen las promociones recibidas.
 *
 * Hoy, de `promotions.fixtures.ts` bajo `environment.campaignsDemo`: no hay
 * lectura en la API. Es un token y no una llamada directa para que el día que
 * exista el endpoint cambie un solo lugar, y para que las pruebas recorran la
 * carga y el error sin tocar la pantalla.
 */
export const PROMOCIONES_RECIBIDAS = new InjectionToken<
  () => Observable<readonly PromocionRecibida[]>
>('PROMOCIONES_RECIBIDAS', {
  providedIn: 'root',
  factory: () => () => of(environment.campaignsDemo ? promocionesRecibidasDeEjemplo() : []),
});

/**
 * **Promociones** (T-E7 · pantalla K, cara paciente): lo que las farmacias le
 * mandaron a la persona, y un ejemplo de cómo llega como notificación.
 *
 * Cada tarjeta enlaza al detalle público que ya existe (`/promotions/:id`); esta
 * pantalla no repite productos ni precios. Con los datos de ejemplo ese detalle
 * todavía no encuentra la campaña: ver `promotions.fixtures.ts`.
 *
 * Los datos son de demostración, con chip DEMO: ver el encabezado de
 * `promotions.fixtures.ts`.
 */
@Component({
  selector: 'app-promotions',
  imports: [Badge, PageHeader, PromotionCard, ViewStateHost],
  templateUrl: './promotions.html',
  styleUrl: './promotions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Promotions {
  private readonly fuente = inject(PROMOCIONES_RECIBIDAS);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly state = signal<ViewState<readonly PromocionRecibida[]>>(loading());

  protected readonly promociones = computed(() => dataOf(this.state()) ?? []);

  /** La que se usa de ejemplo de notificación: la primera que sigue vigente. */
  protected readonly ejemploDeNotificacion = computed(
    () => this.promociones().find((promocion) => promocion.estado !== 'vencida') ?? null,
  );

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.state.set(loading());
    this.fuente()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promociones) =>
          this.state.set(
            promociones.length === 0
              ? empty(
                  { label: 'Buscar farmacias', route: '/search/medications' },
                  'Todavía no recibiste promociones de ninguna farmacia.',
                )
              : ready(promociones),
          ),
        error: (error: unknown) =>
          this.state.set(errorToViewState<readonly PromocionRecibida[]>(error)),
      });
  }
}
