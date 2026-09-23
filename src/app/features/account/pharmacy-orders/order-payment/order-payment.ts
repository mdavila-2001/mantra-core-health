import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { estaPagado } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type { PedidoFarmacia } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Spinner } from '../../../../shared/components/atoms/spinner/spinner';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { dibujarQr } from '../../../../shared/utils/qr/dibujar-qr';
import { displayCurrency } from '../../../../core/money/display-currency';
import { withDisplayCurrency } from '../../../../core/money/display-currency';

/** Lado del QR de pago: el mismo tamaño legible que el QR de retiro. */
const LADO_DEL_QR = 176;

/**
 * **La pantalla de pago del pedido** (carril FAR-I5). Presentacional: recibe
 * el pedido, emite la simulación; el detalle (su contenedor) habla con el
 * cliente.
 *
 * ## Los dos caminos, sin mentir
 *
 * - **«En mostrador»** (default) es el flujo real de hoy: pagás al retirar,
 *   y el comprobante llega cuando la farmacia registra el pago.
 * - **«QR»** existe sólo con `environment.paymentDemo`: la pasarela no está,
 *   así que la pestaña lo dice con el chip **DEMO fijo** — quemado en la
 *   plantilla, sin ningún input que lo apague — y el «pago aprobado» es un
 *   botón que dispara el mismo puerto que usará la pasarela real.
 *
 * Pagado el pedido, las pestañas desaparecen: queda el resumen del pago con
 * su medio y su fecha, que es lo único que importa después.
 */
@Component({
  selector: 'app-order-payment',
  imports: [AppButton, Badge, DatePipe, Spinner, Tab, Tabs],
  templateUrl: './order-payment.html',
  styleUrl: './order-payment.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderPayment {

  /**
   * La moneda visible de un importe: «Bs» para el boliviano y la UMA del
   * arancel, el código tal cual para cualquier otra. Ver `display-currency.ts`.
   */
  protected moneda(code?: string | null): string {
    return displayCurrency(code);
  }
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly pedido = input.required<PedidoFarmacia>();
  /** El detalle lo enciende mientras una acción está en vuelo. */
  readonly ocupado = input(false);

  /** «Simular pago aprobado»: el contenedor dispara el puerto de la demo. */
  readonly pagoSimulado = output<void>();

  protected readonly qrDemoActiva = environment.paymentDemo;
  protected readonly ladoDelQr = LADO_DEL_QR;

  protected readonly pagado = computed(() => estaPagado(this.pedido()));

  /** «Pagado en mostrador» / «Pagado por QR (demo)», para el resumen. */
  protected readonly medioDePago = computed(() => {
    const origen = this.pedido().pago?.origen ?? null;
    if (origen === 'QR_DEMO') {
      return 'Pagado por QR (demo)';
    }
    return origen === 'MOSTRADOR' ? 'Pagado en mostrador' : 'Pagado';
  });

  /** `false` si la lib del QR no cargó: queda el total y el camino real. */
  protected readonly qrDisponible = signal(true);

  private readonly lienzoQr = viewChild<ElementRef<HTMLCanvasElement>>('lienzoQrPago');

  constructor() {
    // El lienzo existe sólo con la pestaña QR seleccionada: el efecto espera
    // a que lienzo y pedido estén, y dibuja recién ahí.
    effect(() => {
      const lienzo = this.lienzoQr();
      const pedido = this.pedido();
      if (!this.esBrowser || lienzo === undefined) {
        return;
      }
      dibujarQr(lienzo.nativeElement, contenidoDelQr(pedido), LADO_DEL_QR).catch(() =>
        this.qrDisponible.set(false),
      );
    });
  }
}

/**
 * El payload del QR de la demo. Es un texto propio y a propósito: la
 * pasarela real (FAR-E4) definirá el formato del banco; mientras, escanear
 * esto muestra un texto legible que dice lo que es — no un link a nada.
 */
function contenidoDelQr(pedido: PedidoFarmacia): string {
  const monto =
    pedido.totalEstimado === null
      ? 'sin-total'
      : withDisplayCurrency(pedido.totalEstimado, pedido.moneda);
  return `ALOVIDA-PAGO-DEMO|${pedido.id}|${monto}`;
}
