import { PatientInsuranceSettlement } from '../../../../shared/components/molecules/patient-insurance-settlement/patient-insurance-settlement';
import { DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';

import {
  estaPagado,
  PharmacyOrdersClient,
  puedeCancelarse,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type { PedidoFarmacia } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { dataOf, loading, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Chip } from '../../../../shared/components/atoms/chip/chip';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { Stepper } from '../../../../shared/components/molecules/stepper/stepper';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { dibujarQr } from '../../../../shared/utils/qr/dibujar-qr';
import {
  conSeguimientoDeEjemplo,
  facturaDelPedido,
  NOTA_DE_EJEMPLO,
} from '../order-invoice/order-invoice.fixtures';
import { TuFactura } from '../order-invoice/tu-factura/tu-factura';
import {
  etiquetaDeMedioDePago,
  etiquetaDeModalidad,
  pasosDeLaLineaDeTiempo,
  presentacionDePedido,
} from '../pedido-status';

/** A dónde vuelve quien llegó a un pedido que no existe. */
const LISTA_ROUTE = '/my-account/pharmacy-orders';

/** Lado del QR en píxeles CSS: legible por un lector de mostrador a un brazo. */
const LADO_DEL_QR = 176;

/** Los finales que cortan el recorrido: no tienen ni tendrán factura. */
const SIN_FACTURA_POSIBLE: readonly PedidoFarmacia['estado'][] = ['RECHAZADO', 'VENCIDO', 'CANCELADO'];

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
 * ## Seguimiento y factura (T-E4)
 *
 * El pago, el hito del envío y la factura no viajan en el contrato. La
 * pantalla lee `vista`: el pedido del contrato más lo que la maqueta aporta
 * para un pedido conocido (`conSeguimientoDeEjemplo`), rotulado. Las acciones
 * siguen hablando con el cliente real por identificador: la maqueta sólo pinta.
 *
 * Por `paramMap` y no snapshot: si el router reutiliza el componente para
 * otro pedido (re-pedir navega de un detalle a otro), la pantalla recarga.
 */
@Component({
  selector: 'app-order-detail',
  imports: [PatientInsuranceSettlement,
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    Chip,
    DatePipe,
    PageHeader,
    RouterLink,
    Stepper,
    TuFactura,
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
  protected readonly ladoDelQr = LADO_DEL_QR;
  protected readonly notaDeEjemplo = NOTA_DE_EJEMPLO;

  protected readonly state = signal<ViewState<PedidoFarmacia>>(loading());
  protected readonly pedido = computed(() => dataOf(this.state()));

  /** El pedido que se pinta: el del contrato, más lo que la maqueta aporta. */
  protected readonly vista = computed(() => {
    const pedido = this.pedido();
    return pedido === null ? null : conSeguimientoDeEjemplo(pedido);
  });

  protected readonly pagado = computed(() => {
    const vista = this.vista();
    return vista !== null && estaPagado(vista);
  });

  /** El pago lo aportó la maqueta, no el contrato: se rotula. */
  protected readonly pagoDeEjemplo = computed(
    () => this.pedido()?.pago === null && this.vista()?.pago !== null,
  );

  protected readonly medioDePago = computed(() => etiquetaDeMedioDePago(this.vista()?.pago ?? null));

  protected readonly presentacion = computed(() => {
    const vista = this.vista();
    // Por pedido y no por estado: con envío, el cierre se dice «Entregado».
    return vista === null ? null : presentacionDePedido(vista, this.pagado());
  });
  protected readonly pasos = computed(() => {
    const vista = this.vista();
    return vista === null ? [] : pasosDeLaLineaDeTiempo(vista, this.pagado());
  });
  protected readonly modalidad = computed(() => {
    const vista = this.vista();
    return vista === null ? '' : etiquetaDeModalidad(vista.modalidad);
  });

  /** La factura del pedido, o `null`: sin factura, el bloque lo dice. */
  protected readonly factura = computed(() => {
    const pedido = this.pedido();
    return pedido === null ? null : facturaDelPedido(pedido);
  });

  /** Un pedido que terminó antes de tiempo no tiene bloque de factura. */
  protected readonly mostrarFactura = computed(() => {
    const pedido = this.pedido();
    return pedido !== null && !SIN_FACTURA_POSIBLE.includes(pedido.estado);
  });

  /** La propuesta a decidir: la última, sólo mientras la decisión existe. */
  protected readonly propuestaPendiente = computed(() => {
    const pedido = this.pedido();
    if (pedido?.estado !== 'ACEPTACION_PENDIENTE') {
      return null;
    }
    return pedido.sustituciones.at(0) ?? null;
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

  /**
   * Cancelar vale mientras el pedido no terminó NI está pagado (la
   * devolución no existe todavía — FAR-E4); en la decisión ya hay CTA.
   */
  protected readonly puedeCancelar = computed(() => {
    const pedido = this.pedido();
    return (
      pedido !== null &&
      puedeCancelarse(pedido.estado) &&
      pedido.estado !== 'ACEPTACION_PENDIENTE' &&
      !this.pagado()
    );
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

  }

  protected cargar(): void {
    const orderId = this.orderId;
    if (orderId === null || orderId === '') {
      this.state.set(notFound({ label: 'Volver a mis pedidos', route: LISTA_ROUTE }));
      return;
    }
    this.state.set(loading());
    this.ordersClient.pedido(orderId).subscribe({
      next: (pedido) => this.refrescar(pedido),
      error: (error: unknown) => this.state.set(errorToViewState<PedidoFarmacia>(error)),
    });
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
    this.ordersClient.reintentar(id).subscribe({
      next: (nuevo) => {
        this.ocupado.set(false);
        void this.router.navigate([LISTA_ROUTE, nuevo.id]);
      },
      error: (error: unknown) => {
        this.ocupado.set(false);
        this.state.set(errorToViewState<PedidoFarmacia>(error));
      },
    });
  }

  /** La ruta al mapa de sedes de la receta que originó este pedido. */
  protected rutaDeAlternativas(pedido: PedidoFarmacia): string {
    return pedido.requestId === null
      ? LISTA_ROUTE
      : `/my-account/medical-record/where-to-buy/${pedido.requestId}`;
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
    accion(id).subscribe({
      next: (pedido) => {
        this.ocupado.set(false);
        this.refrescar(pedido);
        alTerminar?.();
      },
      error: (error: unknown) => {
        this.ocupado.set(false);
        this.state.set(errorToViewState<PedidoFarmacia>(error));
      },
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
