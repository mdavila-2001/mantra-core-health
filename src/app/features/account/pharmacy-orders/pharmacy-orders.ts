import { DatePipe } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { PharmacyOrdersClient } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type { PedidoFarmacia } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { MI_HISTORIA_ROUTE } from '../medical-record/medical-record.routes';
import { etiquetaDeModalidad, toPedidoStatusPresentation } from './pedido-status';
import { displayCurrency } from '../../../core/money/display-currency';

/**
 * **Mis pedidos** (carril FAR-I2): los pedidos de farmacia de la persona, del
 * envío al retiro.
 *
 * La lista dice el estado **en palabras y con el tono del sistema**
 * (`pedido-status.ts`); el recorrido completo —línea de tiempo, decisión de
 * sustitución, código de retiro— vive en el detalle. Los datos salen del
 * cliente contract-first de `core/data-access/pharmacy-orders/`, que hasta
 * FAR-E1 es un mock en memoria: la pantalla no sabe ni le importa.
 *
 * Cero identificadores visibles: el uuid del pedido viaja en la URL del
 * detalle y no se pinta jamás — lo que se lee es la farmacia, la fecha y el
 * estado.
 */
@Component({
  selector: 'app-pharmacy-orders',
  imports: [Alert, Badge, DatePipe, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './pharmacy-orders.html',
  styleUrl: './pharmacy-orders.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyOrders {
  /**
   * `true` cuando esta pantalla vive **dentro** de «Farmacia», como una de
   * sus pestañas (`PharmacyHub`).
   *
   * Lo único que cambia es el membrete: adentro lo pone el contenedor. La
   * ruta propia (`/my-account/pharmacy-orders`) sigue existiendo tal cual —
   * el detalle, el checkout y las notificaciones vuelven ahí—, y ahí el
   * membrete se dibuja como siempre.
   */
  readonly embedded = input(false, { transform: booleanAttribute });

  /**
   * La moneda visible de un importe: «Bs» para el boliviano y la UMA del
   * arancel, el código tal cual para cualquier otra. Ver `display-currency.ts`.
   */
  protected moneda(code?: string | null): string {
    return displayCurrency(code);
  }
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /** Sin perfil de paciente no hay pedidos propios que mirar. */
  protected readonly sinPerfilDePaciente = this.auth.patientProfileId() === null;

  protected readonly pedidos = signal<ViewState<readonly PedidoFarmacia[]>>(loading());

  /** Las filas listas, para que la plantilla no destipe el estado. */
  protected readonly lista = computed(() => {
    const estado = this.pedidos();
    return estado.status === 'ready' ? estado.data : [];
  });

  constructor() {
    if (!this.sinPerfilDePaciente) {
      this.cargar();
    }
  }

  protected cargar(): void {
    this.pedidos.set(loading());
    this.ordersClient.misPedidos().subscribe({
      next: (items) => {
        if (items.length === 0) {
          this.pedidos.set(
            empty(
              // La salida es la historia clínica: un pedido nace de una receta,
              // así que la puerta correcta es donde viven las recetas.
              { label: 'Ir a mi historia clínica', route: MI_HISTORIA_ROUTE },
              'Todavía no enviaste ningún pedido. Desde una receta de tu historia clínica podés ver qué farmacias la tienen y mandarles tu pedido.',
            ),
          );
          return;
        }
        this.pedidos.set(ready(items));
      },
      error: (error: unknown) =>
        this.pedidos.set(errorToViewState<readonly PedidoFarmacia[]>(error)),
    });
  }

  protected estadoDe(pedido: PedidoFarmacia) {
    return toPedidoStatusPresentation(pedido.estado);
  }

  protected modalidadDe(pedido: PedidoFarmacia): string {
    return etiquetaDeModalidad(pedido.modalidad);
  }
}
