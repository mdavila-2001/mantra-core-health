import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type { PedidoFarmacia } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { Link } from '../../../../shared/components/atoms/link/link';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { MIS_PEDIDOS_ROUTE } from '../../pharmacy-orders/pharmacy-orders.routes';
import { presentacionDePedido } from '../../pharmacy-orders/pedido-status';
import { PHARMACY_ROUTE } from '../pharmacy.routes';

/** Cuántos pedidos entran en el bloque: es un recordatorio, no un listado. */
const CUANTOS = 3;

/** Un pedido, ya en palabras de mostrador. */
interface PedidoVisible {
  readonly id: string;
  readonly farmacia: string;
  readonly sede: string;
  readonly cuando: Date;
  readonly estado: string;
  readonly tono: BadgeVariant;
}

/**
 * **Tus últimos pedidos** — el bloque de la tienda que recuerda lo que ya se
 * pidió, con «Ver todos» a «Mis pedidos», que sigue siendo la pantalla dueña
 * del listado completo.
 *
 * Tres filas como máximo: no es un listado, es un recordatorio. El estado se
 * dice con las palabras de `pedido-status.ts` —la misma tabla que usan «Mis
 * pedidos» y el detalle—, nunca con el código del contrato.
 *
 * Sin perfil de paciente no consulta nada: la lectura es de los pedidos de esa
 * persona, y sin persona no hay pregunta que hacer.
 */
@Component({
  selector: 'app-recent-orders',
  imports: [Badge, DatePipe, Link, RouterLink, ViewStateHost],
  templateUrl: './recent-orders.html',
  styleUrl: './recent-orders.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentOrders {
  private readonly auth = inject(AuthService);
  private readonly orders = inject(PharmacyOrdersClient);

  private readonly perfil = this.auth.patientProfileId();

  protected readonly sinPerfilDePaciente = this.perfil === null;
  protected readonly rutaDePedidos = MIS_PEDIDOS_ROUTE;
  protected readonly rutaDeLaTienda = PHARMACY_ROUTE;

  private readonly pedidos = signal<ViewState<readonly PedidoVisible[]>>(loading());

  protected readonly estado = this.pedidos.asReadonly();

  /**
   * Las filas ya listas. Existe además del estado porque una plantilla de
   * Angular no estrecha la unión al comparar `status`: sin esto, `data` no
   * compila dentro del `@if`.
   */
  protected readonly filas = computed<readonly PedidoVisible[]>(
    () => dataOf(this.pedidos()) ?? [],
  );

  /** `true` cuando la lectura salió bien y no hay ningún pedido todavía. */
  protected readonly sinPedidos = computed(() => {
    const actual = this.pedidos();
    return actual.status === 'ready' && actual.data.length === 0;
  });

  constructor() {
    if (this.perfil === null) {
      this.pedidos.set(ready([]));
      return;
    }
    this.cargar();
  }

  protected cargar(): void {
    this.pedidos.set(loading());
    this.orders
      .misPedidos()
      .pipe(
        map((pedidos) => ready(ultimos(pedidos))),
        catchError((error: unknown) => of(errorToViewState<readonly PedidoVisible[]>(error))),
      )
      .subscribe((estado) => this.pedidos.set(estado));
  }

  protected readonly porId = (pedido: PedidoVisible): string => pedido.id;
}

/** Los tres más recientes, ya traducidos. */
function ultimos(pedidos: readonly PedidoFarmacia[]): readonly PedidoVisible[] {
  return [...pedidos]
    .sort((a, b) => b.creadoEl.getTime() - a.creadoEl.getTime())
    .slice(0, CUANTOS)
    .map((pedido) => {
      const presentacion = presentacionDePedido(pedido);
      return {
        id: pedido.id,
        farmacia: pedido.farmacia,
        sede: pedido.sede,
        cuando: pedido.creadoEl,
        estado: presentacion.label,
        tono: presentacion.tone,
      };
    });
}
