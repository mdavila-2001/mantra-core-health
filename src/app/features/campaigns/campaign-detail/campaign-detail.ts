import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { Badge } from '../../../shared/components/atoms/badge/badge';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import {
  PharmacyCampaignsClient,
  ahorroDe,
} from '../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.client';
import type {
  CampanaPublica,
  ProductoEnCampana,
} from '../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.types';

/** Un producto de la campaña con su ahorro ya derivado. */
interface ProductoVisible {
  readonly producto: ProductoEnCampana;
  readonly ahorro: number | null;
}

/**
 * **El detalle de una promoción** (carril FAR-I7): qué incluye, a qué precio y
 * hasta cuándo.
 *
 * ## Por qué es pública y con URL propia
 *
 * La tarjeta pide que se pueda compartir. Cuelga del marco público del
 * buscador, así que el enlace abre sin sesión: quien lo recibe por mensaje ve
 * la promoción, no una pantalla de login.
 *
 * ## Una promoción vencida no muestra precios
 *
 * Ni siquiera con su URL exacta. El cliente devuelve una **unión
 * discriminada** (`CampanaPublica`), de modo que fuera de la rama vigente los
 * productos y sus precios no existen para la plantilla: no hay `@if` que
 * pueda filtrarlos por descuido. Lo que se ve es que la promoción terminó y
 * cuándo.
 *
 * Un id que no existe es `not-found`, que es distinto de una campaña vencida:
 * confundirlos haría que un enlace roto y una promoción que se cumplió dijeran
 * lo mismo.
 */
@Component({
  selector: 'app-campaign-detail',
  imports: [Badge, DatePipe, ViewStateHost],
  templateUrl: './campaign-detail.html',
  styleUrl: './campaign-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignDetail {
  private readonly campaigns = inject(PharmacyCampaignsClient);

  /**
   * El id llega por `ActivatedRoute` y no por un `input()` de ruta: la
   * aplicación **no** habilita `withComponentInputBinding`, así que un input
   * atado al parámetro no se poblaría nunca. Es el mismo patrón que la ficha
   * del pedido en el mostrador.
   */
  private readonly campaignId = signal('');

  protected readonly state = signal<ViewState<CampanaPublica>>(loading());

  protected readonly resuelta = computed(() => dataOf(this.state()));

  protected readonly vigente = computed(() => {
    const publica = this.resuelta();
    return publica?.tipo === 'vigente' ? publica.campana : null;
  });

  protected readonly productos = computed<readonly ProductoVisible[]>(() => {
    const campana = this.vigente();
    if (campana === null) {
      return [];
    }
    return campana.productos.map((producto) => ({ producto, ahorro: ahorroDe(producto) }));
  });

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        this.campaignId.set(params.get('campaignId') ?? '');
        this.cargar();
      });
  }

  protected cargar(): void {
    const id = this.campaignId();
    if (id === '') {
      this.state.set(notFound());
      return;
    }
    this.state.set(loading());
    this.campaigns.campanaPublica(id).subscribe({
      next: (publica) =>
        this.state.set(
          publica === null
            ? notFound({ label: 'Buscar farmacias', route: '/search/medications' })
            : ready(publica),
        ),
      error: (error: unknown) => this.state.set(errorToViewState<CampanaPublica>(error)),
    });
  }
}
