import { DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import {
  PharmacyOrdersClient,
  puedeCancelarse,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type {
  PedidoFarmacia,
  SimulacionDeFarmacia,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { dataOf, loading, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { Stepper } from '../../../../shared/components/molecules/stepper/stepper';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  etiquetaDeModalidad,
  pasosDeLaLineaDeTiempo,
  presentacionDePedido,
} from '../pedido-status';

/** A dónde vuelve quien llegó a un pedido que no existe. */
const LISTA_ROUTE = '/my-account/pharmacy-orders';

/** Lado del QR en píxeles CSS: legible por un lector de mostrador a un brazo. */
const LADO_DEL_QR = 176;

/**
 * Lo que haría la contraparte, en palabras de la barra de demo. Es la única
 * superficie que consume `simular()` y sólo existe con `demoPresets`.
 */
const ETIQUETA_DE_SIMULACION: Readonly<Record<SimulacionDeFarmacia, string>> = {
  REVISAR: 'Tomar en revisión',
  CONFIRMAR: 'Confirmar el pedido',
  PROPONER_SUSTITUCION: 'Proponer un genérico',
  MARCAR_LISTO: 'Marcar listo para retirar',
  DISPENSAR: 'Entregar en mostrador',
  RECHAZAR: 'Rechazar el pedido',
  VENCER: 'Dejar vencer la reserva',
};

/**
 * **El detalle del pedido** (carril FAR-I2): la línea de tiempo, la decisión
 * de sustitución y el código de retiro.
 *
 * ## Los tres momentos que importan
 *
 * 1. **`ACEPTACION_PENDIENTE`** — la comparación línea por línea con el
 *    ahorro visible y las tres salidas: aceptar, preferir el original o
 *    cancelar. La decisión es de la persona; la pantalla sólo la transporta.
 * 2. **`LISTO_PARA_RETIRO`** — el código GRANDE en cifras tabulares más su QR
 *    de **identificación** (no de pago: se paga al retirar). El QR se dibuja
 *    en el navegador con `qrcode` cargado perezoso — el bundle inicial no lo
 *    conoce — y en negro sobre blanco a propósito: un lector de mostrador no
 *    tiene por qué lidiar con el modo oscuro.
 * 3. **Los finales anticipados** — `VENCIDO` re-pide con un toque,
 *    `RECHAZADO` dice el motivo y devuelve al mapa de sedes, y cancelar vale
 *    mientras el pedido no haya terminado, con confirmación.
 *
 * Por `paramMap` y no snapshot: si el router reutiliza el componente para
 * otro pedido (re-pedir navega de un detalle a otro), la pantalla recarga.
 */
@Component({
  selector: 'app-order-detail',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    DatePipe,
    PageHeader,
    RouterLink,
    Stepper,
    ViewStateHost,
  ],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetail {
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);
  private readonly dialogs = inject(DialogService);
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly documento = inject(DOCUMENT);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly listaRoute = LISTA_ROUTE;
  protected readonly demoActiva = environment.demoPresets;
  protected readonly ladoDelQr = LADO_DEL_QR;

  protected readonly state = signal<ViewState<PedidoFarmacia>>(loading());
  protected readonly pedido = computed(() => dataOf(this.state()));
  protected readonly presentacion = computed(() => {
    const pedido = this.pedido();
    // Por pedido y no por estado: con envío, el cierre se dice «Entregado».
    return pedido === null ? null : presentacionDePedido(pedido);
  });
  protected readonly pasos = computed(() => {
    const pedido = this.pedido();
    return pedido === null ? [] : pasosDeLaLineaDeTiempo(pedido);
  });
  protected readonly modalidad = computed(() => {
    const pedido = this.pedido();
    return pedido === null ? '' : etiquetaDeModalidad(pedido.modalidad);
  });

  /** La propuesta a decidir: la última, sólo mientras la decisión existe. */
  protected readonly propuestaPendiente = computed(() => {
    const pedido = this.pedido();
    if (pedido?.estado !== 'ACEPTACION_PENDIENTE') {
      return null;
    }
    return pedido.sustituciones.at(-1) ?? null;
  });

  /** «35.00 BOB» — o `null` si algún precio no está publicado. */
  protected readonly ahorro = computed(() => {
    const propuesta = this.propuestaPendiente();
    const original = Number(propuesta?.original.precio);
    const alternativa = Number(propuesta?.propuesta.precio);
    if (!Number.isFinite(original) || !Number.isFinite(alternativa)) {
      return null;
    }
    const diferencia = original - alternativa;
    if (diferencia <= 0) {
      return null;
    }
    return `${diferencia.toFixed(2)} ${propuesta?.moneda ?? ''}`.trim();
  });

  /** Cancelar vale mientras el pedido no terminó; en la decisión ya hay CTA. */
  protected readonly puedeCancelar = computed(() => {
    const pedido = this.pedido();
    return (
      pedido !== null && puedeCancelarse(pedido.estado) && pedido.estado !== 'ACEPTACION_PENDIENTE'
    );
  });

  protected readonly simulaciones = computed(() => {
    const pedido = this.pedido();
    return pedido === null ? [] : this.ordersClient.simulacionesPara(pedido.estado);
  });

  /** Evita el doble toque mientras una acción está en vuelo. */
  protected readonly ocupado = signal(false);

  /** `false` si la lib del QR no cargó: queda el código grande, que alcanza. */
  protected readonly qrDisponible = signal(true);

  private readonly lienzoQr = viewChild<ElementRef<HTMLCanvasElement>>('lienzoQr');

  private orderId: string | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.orderId = params.get('orderId');
      this.cargar();
    });

    // El lienzo aparece recién cuando el estado es LISTO_PARA_RETIRO: el
    // efecto observa el pedido y el lienzo, y dibuja cuando los dos están.
    effect(() => {
      const lienzo = this.lienzoQr();
      const codigo = this.pedido()?.codigoDeRetiro ?? null;
      if (!this.esBrowser || lienzo === undefined || codigo === null) {
        return;
      }
      dibujarQr(lienzo.nativeElement, codigo, LADO_DEL_QR).catch(() =>
        this.qrDisponible.set(false),
      );
    });

    // El reflejo en vivo de la demo de dos ventanas (FAR-I3): si la farmacia
    // mueve el pedido en otra pestaña, esta ficha se entera sin recargar.
    // Con FAR-E1 esto será polling o la campana.
    effect(() => {
      const vivos = this.ordersClient.pedidosEnVivo();
      const actual = untracked(() => this.pedido());
      const fresco = actual === null ? undefined : vivos.find((p) => p.id === actual.id);
      if (fresco !== undefined && fresco !== actual) {
        this.state.set(ready(fresco));
      }
    });
  }

  protected cargar(): void {
    const orderId = this.orderId;
    if (orderId === null || orderId === '') {
      this.state.set(notFound({ label: 'Volver a mis pedidos', route: LISTA_ROUTE }));
      return;
    }
    this.state.set(loading());
    this.ordersClient.pedido(orderId).subscribe((pedido) => this.refrescar(pedido));
  }

  protected aceptarPropuesta(): void {
    this.ejecutar((id) => this.ordersClient.aceptarSustituciones(id), this.enfocarEstado);
  }

  protected preferirOriginal(): void {
    this.ejecutar((id) => this.ordersClient.preferirOriginal(id), this.enfocarEstado);
  }

  protected async cancelar(): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: 'Cancelar el pedido',
      message: 'La farmacia deja de prepararlo y tu receta sigue disponible en tu historia.',
      confirmLabel: 'Cancelar el pedido',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }
    this.ejecutar((id) => this.ordersClient.cancelar(id), this.enfocarEstado);
  }

  /** Re-crea un pedido vencido y navega al nuevo. */
  protected rePedir(): void {
    const id = this.orderId;
    if (id === null || this.ocupado()) {
      return;
    }
    this.ocupado.set(true);
    this.ordersClient.reintentar(id).subscribe((nuevo) => {
      this.ocupado.set(false);
      if (nuevo !== null) {
        void this.router.navigate([LISTA_ROUTE, nuevo.id]);
      }
    });
  }

  protected simular(paso: SimulacionDeFarmacia): void {
    this.ejecutar((id) => this.ordersClient.simular(id, paso));
  }

  protected etiquetaDeSimulacion(paso: SimulacionDeFarmacia): string {
    return ETIQUETA_DE_SIMULACION[paso];
  }

  /** La ruta al mapa de sedes de la receta que originó este pedido. */
  protected rutaDeAlternativas(pedido: PedidoFarmacia): string {
    return `/my-account/medical-record/where-to-buy/${pedido.requestId}`;
  }

  private ejecutar(
    accion: (id: string) => Observable<PedidoFarmacia | null>,
    alTerminar?: () => void,
  ): void {
    const id = this.orderId;
    if (id === null || this.ocupado()) {
      return;
    }
    this.ocupado.set(true);
    accion(id).subscribe((pedido) => {
      this.ocupado.set(false);
      this.refrescar(pedido);
      alTerminar?.();
    });
  }

  /**
   * Decidir o cancelar desmonta el propio botón que tenía el foco: sin esto,
   * el foco cae al `body` y quien navega con teclado vuelve a empezar de
   * arriba. El estado es lo que cambió — el foco aterriza ahí.
   */
  private readonly enfocarEstado = (): void => {
    if (!this.esBrowser) {
      return;
    }
    // Microtask: el render síncrono ya pasó (mismo criterio que el S4 del host).
    queueMicrotask(() => this.documento.getElementById('pedido-estado')?.focus());
  };

  private refrescar(pedido: PedidoFarmacia | null): void {
    if (pedido === null) {
      this.state.set(notFound({ label: 'Volver a mis pedidos', route: LISTA_ROUTE }));
      return;
    }
    this.state.set(ready(pedido));
  }
}

/**
 * Dibuja el QR con la lib cargada perezoso. Negro sobre blanco siempre: es
 * para un lector de mostrador, no para el tema de la interfaz.
 */
async function dibujarQr(
  lienzo: HTMLCanvasElement,
  codigo: string,
  lado: number,
): Promise<void> {
  // Interop CJS (mismo caso que leaflet): según el empaquetado, la API llega
  // como namespace o colgada de `default`.
  const modulo = (await import('qrcode')) as typeof import('qrcode') & {
    readonly default?: typeof import('qrcode');
  };
  const qr = modulo.default ?? modulo;
  await qr.toCanvas(lienzo, codigo, {
    width: lado,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
