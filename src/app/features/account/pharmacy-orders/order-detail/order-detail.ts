import { PatientInsuranceSettlement } from '../../../../shared/components/molecules/patient-insurance-settlement/patient-insurance-settlement';
import { DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { Observable, Subscription } from 'rxjs';

import { NotificationsClient } from '../../../../core/data-access/notifications/notifications.client';
import type { InAppNotification } from '../../../../core/data-access/notifications/notifications.types';
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
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { Stepper } from '../../../../shared/components/molecules/stepper/stepper';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { dibujarQr } from '../../../../shared/utils/qr/dibujar-qr';
import { facturaDelPedido } from '../order-invoice/order-invoice.fixtures';
import { TuFactura } from '../order-invoice/tu-factura/tu-factura';
import {
  etiquetaDeMedioDePago,
  etiquetaDeModalidad,
  pasosDeLaLineaDeTiempo,
  presentacionDePedido,
} from '../pedido-status';
import { displayCurrency } from '../../../../core/money/display-currency';
import { withDisplayCurrency } from '../../../../core/money/display-currency';

/** A dónde vuelve quien llegó a un pedido que no existe. */
const LISTA_ROUTE = '/my-account/pharmacy-orders';

/** Lado del QR en píxeles CSS: legible por un lector de mostrador a un brazo. */
const LADO_DEL_QR = 176;

/** Los finales que cortan el recorrido: no tienen ni tendrán factura. */
const SIN_FACTURA_POSIBLE: readonly PedidoFarmacia['estado'][] = ['RECHAZADO', 'VENCIDO', 'CANCELADO'];

/**
 * El destino con que el backend marca un aviso de pedido de farmacia
 * (`api:pharmacy_inventory/services/pharmacy-order-notifications.service.ts:216`).
 * Es el mismo tipo que la campana usa para navegar acá
 * (`core/notifications/notification-routes.ts:37`).
 */
const DESTINO_DE_PEDIDO = 'PHARMACY_ORDER';

/** Cuántos avisos se piden de la bandeja: una página alcanza para un pedido. */
const TOPE_DE_AVISOS = 50;

/** Un aviso de la bandeja, ya recortado a lo que la pantalla muestra. */
interface AvisoDelPedido {
  readonly id: string;
  readonly titulo: string;
  readonly detalle: string | null;
  readonly fecha: Date;
}

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
 * ## Seguimiento real (R-T-E4)
 *
 * El seguimiento sale **entero del contrato**: estado, fechas, código de
 * retiro, sustituciones y renglones. El pedido de ejemplo ya no se consulta —
 * la pantalla no completa con la maqueta lo que el backend no publica, así que
 * el pago (que el contrato deja en `null`, `pharmacy-orders.adapter.ts:98`) no
 * se muestra en vez de mostrarse inventado.
 *
 * Los **avisos** son la única historia demostrable del pedido: los emite el
 * backend en cada transición con destino `PHARMACY_ORDER`
 * (`api:…/pharmacy-order-notifications.service.ts:216`) y se leen de la bandeja
 * que ya existe. Es una lectura de una sola vez —la campana es la que sondea
 * (`core/notifications/notifications.store.ts:20`)— y por eso el bloque se
 * titula «Avisos de este pedido» y no «historial»: la bandeja es best-effort y
 * paginada, y no prueba que estén todos.
 *
 * La factura sigue fuera de este carril: su bloque se alimenta como antes.
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

  /**
   * La moneda visible de un importe: «Bs» para el boliviano y la UMA del
   * arancel, el código tal cual para cualquier otra. Ver `display-currency.ts`.
   */
  protected moneda(code?: string | null): string {
    return displayCurrency(code);
  }
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly notificationsClient = inject(NotificationsClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);
  private readonly dialogs = inject(DialogService);
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly documento = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly listaRoute = LISTA_ROUTE;
  protected readonly ladoDelQr = LADO_DEL_QR;

  protected readonly state = signal<ViewState<PedidoFarmacia>>(loading());
  protected readonly pedido = computed(() => dataOf(this.state()));

  /**
   * Los avisos que el backend emitió por este pedido. Vacío mientras no se
   * leyeron, si la bandeja falla o si no hay ninguno: nunca se rellena.
   */
  protected readonly avisos = signal<readonly AvisoDelPedido[]>([]);

  /**
   * Sin pago en el contrato esto es siempre `false`; se conserva porque el
   * tipo del pedido publica `pago` y el día que llegue, la pantalla ya lo dice.
   */
  protected readonly pagado = computed(() => {
    const pedido = this.pedido();
    return pedido !== null && estaPagado(pedido);
  });

  protected readonly medioDePago = computed(() =>
    etiquetaDeMedioDePago(this.pedido()?.pago ?? null),
  );

  protected readonly presentacion = computed(() => {
    const pedido = this.pedido();
    // Por pedido y no por estado: con envío, el cierre se dice «Entregado».
    return pedido === null ? null : presentacionDePedido(pedido, this.pagado());
  });
  protected readonly pasos = computed(() => {
    const pedido = this.pedido();
    return pedido === null ? [] : pasosDeLaLineaDeTiempo(pedido, this.pagado());
  });
  protected readonly modalidad = computed(() => {
    const pedido = this.pedido();
    return pedido === null ? '' : etiquetaDeModalidad(pedido.modalidad);
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
    return withDisplayCurrency(diferencia.toFixed(2), propuesta?.moneda);
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

  /** Las lecturas en vuelo, para cancelarlas al cambiar de pedido. */
  private pedidoEnVuelo: Subscription | null = null;
  private avisosEnVuelo: Subscription | null = null;

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

  /**
   * Carga el pedido abierto y sus avisos.
   *
   * Las dos lecturas siguen la misma disciplina, y por el mismo motivo: el
   * router **reutiliza** esta instancia al pasar de un pedido a otro, así que
   * una respuesta del pedido anterior puede llegar después de la del nuevo.
   * Cada carga cancela la anterior —lo que aborta su petición— y descarta
   * cualquier respuesta cuyo pedido ya no sea el abierto. Sin esto, el detalle
   * podría mostrar el pedido A bajo la URL de B mientras los avisos ya son de
   * B: dos mitades de dos pedidos distintos en la misma pantalla.
   */
  protected cargar(): void {
    const orderId = this.orderId;
    if (orderId === null || orderId === '') {
      this.pedidoEnVuelo?.unsubscribe();
      this.pedidoEnVuelo = null;
      this.state.set(notFound({ label: 'Volver a mis pedidos', route: LISTA_ROUTE }));
      this.cargarAvisos(null);
      return;
    }
    this.pedidoEnVuelo?.unsubscribe();
    // Un pedido recién abierto nunca nace ocupado, aunque quedara una acción
    // del anterior en vuelo: su resultado ya no se va a pintar acá.
    this.ocupado.set(false);
    this.state.set(loading());
    this.pedidoEnVuelo = this.ordersClient
      .pedido(orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pedido) => {
          if (this.orderId !== orderId) {
            return;
          }
          this.refrescar(pedido);
        },
        error: (error: unknown) => {
          if (this.orderId !== orderId) {
            return;
          }
          this.state.set(errorToViewState<PedidoFarmacia>(error));
        },
      });
    this.cargarAvisos(orderId);
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
    this.ordersClient
      .reintentar(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (nuevo) => {
          if (this.orderId !== id) {
            return;
          }
          this.ocupado.set(false);
          void this.router.navigate([LISTA_ROUTE, nuevo.id]);
        },
        error: (error: unknown) => {
          if (this.orderId !== id) {
            return;
          }
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

  /**
   * Corre una acción sobre el pedido abierto y pinta lo que devuelve.
   *
   * La respuesta se descarta si mientras tanto se abrió otro pedido: la
   * acción era de aquél, y su pedido bajo la URL de éste sería el mismo
   * engaño que la lectura tardía. **La petición no se cancela**, a diferencia
   * de las lecturas: aceptar, preferir o cancelar cambian datos en el
   * servidor, y abortar la conexión no desharía nada — sólo dejaría de mirar
   * el resultado. Lo que se descarta es pintarlo, no hacerlo.
   */
  private ejecutar(
    accion: (id: string) => Observable<PedidoFarmacia | null>,
    alTerminar?: () => void,
  ): void {
    const id = this.orderId;
    if (id === null || this.ocupado()) {
      return;
    }
    this.ocupado.set(true);
    accion(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pedido) => {
          if (this.orderId !== id) {
            return;
          }
          this.ocupado.set(false);
          this.refrescar(pedido);
          alTerminar?.();
        },
        error: (error: unknown) => {
          if (this.orderId !== id) {
            return;
          }
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

  /**
   * Los avisos de ESTE pedido, de la bandeja que ya existe.
   *
   * Una sola lectura por pedido y sólo en el navegador: quien sondea es la
   * campana, y un sondeo paralelo acá sería la misma bandeja pedida dos veces.
   * Un fallo se traga —el detalle no depende de la bandeja para existir— y
   * deja la lista vacía: el bloque desaparece en vez de inventar avisos.
   *
   * ## Por qué hay cancelación y no sólo un `set([])`
   *
   * El router **reutiliza** este componente al pasar de un pedido a otro
   * (cambia el `paramMap`, no la instancia). Vaciar la lista al empezar evita
   * que los avisos del pedido anterior se queden a la vista, pero no impide lo
   * otro: que la respuesta del pedido anterior llegue **después** de la del
   * nuevo y lo pise. Por eso la lectura en vuelo se cancela —lo que además
   * aborta la petición HTTP, que ya no le sirve a nadie— y, por si acaso, la
   * respuesta se descarta si el pedido abierto dejó de ser el que la pidió. La
   * invalidación es por `orderId`: no hay estado global de por medio.
   *
   * Sin pedido —una URL sin identificador— no hay bandeja que pedir, pero la
   * lista igual se vacía: los avisos del anterior no sobreviven a un destino
   * que no existe.
   */
  private cargarAvisos(orderId: string | null): void {
    this.avisosEnVuelo?.unsubscribe();
    this.avisosEnVuelo = null;
    this.avisos.set([]);
    if (!this.esBrowser || orderId === null) {
      return;
    }
    this.avisosEnVuelo = this.notificationsClient
      .listMine({ limit: TOPE_DE_AVISOS })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagina) => {
          if (this.orderId !== orderId) {
            return;
          }
          this.avisos.set(avisosDelPedido(pagina.items, orderId));
        },
        error: () => {
          if (this.orderId !== orderId) {
            return;
          }
          this.avisos.set([]);
        },
      });
  }
}

/**
 * Los avisos de la bandeja que pertenecen a este pedido.
 *
 * El filtro es el destino que el backend ya escribe —`PHARMACY_ORDER` más el
 * id del pedido—, no el texto del aviso: un aviso de otro pedido, de una receta
 * o de un mensaje no entra. Sin asunto ni cuerpo no hay nada que mostrar, así
 * que ese aviso también queda fuera.
 */
function avisosDelPedido(
  items: readonly InAppNotification[],
  orderId: string,
): readonly AvisoDelPedido[] {
  return items
    .filter(
      (aviso) =>
        aviso.destination?.type === DESTINO_DE_PEDIDO && aviso.destination.id === orderId,
    )
    .map((aviso) => ({
      id: aviso.id,
      titulo: aviso.subject ?? aviso.bodyText ?? '',
      detalle: aviso.subject === undefined ? null : (aviso.bodyText ?? null),
      fecha: aviso.availableAt,
    }))
    .filter((aviso) => aviso.titulo !== '');
}
