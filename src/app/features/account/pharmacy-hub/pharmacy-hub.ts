import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NavigationService } from '../../../core/navigation/navigation.service';
import { Spinner } from '../../../shared/components/atoms/spinner/spinner';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { Cotizaciones } from '../cotizaciones/cotizaciones';
import { PharmacyOrders } from '../pharmacy-orders/pharmacy-orders';

/** Las dos pestañas, en el orden en que se usan: primero lo ya pedido, después cuánto cuesta lo próximo. */
const PESTANAS = ['Mis pedidos', 'Cotizaciones'] as const;

/** El índice con nombre, para no escribir `1` donde se quiere decir «cotizaciones». */
const PESTANA = { pedidos: 0, cotizaciones: 1 } as const;

/**
 * **Farmacia** — los pedidos del paciente y cuánto cuesta comprar, en una
 * pantalla (pedido del propietario, 24/09/2026: «mis pedidos y cotizaciones
 * deben estar dentro de farmacia», sin confundirla con «Directorios ·
 * Farmacias» —la vitrina pública de sedes, que sigue en pie sin cambios—).
 *
 * ## Qué NO se reescribió
 *
 * «Mis pedidos» y «Cotizaciones» siguen siendo las mismas clases, con su
 * lógica, sus pruebas y sus rutas propias intactas: el detalle de un pedido,
 * el checkout, el recibo y los enlaces de notificación
 * (`notification-routes.ts`) siguen navegando a
 * `/my-account/pharmacy-orders/...`. Acá se montan como pestañas y se les
 * pide, con `embedded`, que no dibujen su propio membrete — el membrete es
 * uno solo y es de esta pantalla. Mismo patrón que `IdentityHub`.
 *
 * ## Cotizaciones entra sólo con lo de farmacia
 *
 * La pestaña fija `fixedVertical="MEDICAMENTOS"`: sin selector de vertical
 * — el comparador completo de las otras tres (Análisis, Imagenología,
 * Servicios médicos) sigue siendo su propio renglón de «Mi cuenta», sin
 * tocar. No es un recorte: es que acá adentro sólo tiene sentido lo que se
 * compra en una farmacia.
 *
 * ## La pestaña vive en la URL
 *
 * `?tab=cotizaciones` la abre directo — un enlace guardado sigue abriendo lo
 * que abría.
 */
@Component({
  selector: 'app-pharmacy-hub',
  imports: [Card, Cotizaciones, PageHeader, PharmacyOrders, Spinner, Tab, Tabs],
  templateUrl: './pharmacy-hub.html',
  styleUrl: './pharmacy-hub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyHub {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly navigation = inject(NavigationService);

  protected readonly pestanas = PESTANAS;
  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly pestana = signal<number>(
    this.route.snapshot.queryParamMap.get('tab') === 'cotizaciones'
      ? PESTANA.cotizaciones
      : PESTANA.pedidos,
  );

  /**
   * Cambia de pestaña y lo deja escrito en la URL.
   *
   * `replaceUrl` para no llenar el historial: volver atrás desde acá tiene
   * que salir de la pantalla, no recorrer las pestañas que se miraron.
   */
  protected elegirPestana(indice: number): void {
    this.pestana.set(indice);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: indice === PESTANA.cotizaciones ? 'cotizaciones' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
