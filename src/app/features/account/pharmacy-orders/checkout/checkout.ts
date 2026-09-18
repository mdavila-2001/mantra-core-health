import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { normalizado } from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.money';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type { BorradorDePedido } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Stepper } from '../../../../shared/components/molecules/stepper/stepper';
import type { StepperStep } from '../../../../shared/components/molecules/stepper/stepper.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { MI_HISTORIA_ROUTE } from '../../medical-record/medical-record.routes';
import { CLAVE_DEL_TRASPASO, type TraspasoDeLaReceta } from '../new-order/new-order.handoff';
import { MIS_PEDIDOS_ROUTE } from '../pharmacy-orders.routes';
import { resumirPedido, type RenglonACobrar } from './checkout.summary';
import { OrderSummary } from './order-summary/order-summary';

/** La orden médica, para volver sin perder el borrador. */
const RUTA_DE_LA_ORDEN = `${MIS_PEDIDOS_ROUTE}/new`;

type Paso = 'ENTREGA' | 'RESUMEN';

const ROTULO_DEL_PASO: Readonly<Record<Paso, string>> = {
  ENTREGA: 'Entrega',
  RESUMEN: 'Resumen',
};

const PASOS: readonly Paso[] = ['ENTREGA', 'RESUMEN'];

/**
 * **El checkout**: lo último antes de que el pedido exista. Entrega y resumen,
 * y la confirmación que lo crea de verdad.
 *
 * ## Acá se crea el pedido
 *
 * Antes de esta pantalla no existe `orderId`. La confirmación final llama a
 * `PharmacyOrdersClient.enviar()` con el borrador vivo y recién el 201 trae el
 * pedido real, con cuyo `id` se navega al detalle. No se inventa ningún
 * identificador en el camino.
 *
 * ## Lo que esta pantalla NO tiene, y por qué
 *
 * El backend todavía no publica nada de esto, así que **no se dibuja**
 * (R-T-E3 · B-REAL-4/5/6):
 *
 * - **Dirección y envío a domicilio.** `common-addresses` sólo expone `POST`
 *   —no hay libreta que leer—, el DTO del pedido no acepta dirección y el
 *   servicio responde un 422 tipado a cualquier modalidad que no sea `RETIRO`
 *   (`pharmacy-orders.service.ts`, `resolveDeliveryMode`). Por eso el retiro es
 *   lo único que se ofrece, y el envío se nombra como lo que es: algo que
 *   todavía no está.
 * - **Medios de pago.** `payments` es back-office: ningún endpoint con rol
 *   `PATIENT`, y el pedido no referencia ningún `payment_intent`. Un QR o una
 *   tarjeta acá serían un cobro que no existe.
 * - **Descuento de red, coaseguro y puntos.** No hay contrato que los produzca
 *   antes de crear el pedido; el coaseguro llega con la liquidación del seguro,
 *   ya adjudicada, sobre un pedido existente.
 *
 * Lo real que sí se conserva: los renglones y los precios que publicó la
 * farmacia, la modalidad `RETIRO` del contrato y la creación del pedido.
 *
 * ## Lo que llega de la orden médica
 *
 * - **El borrador**, de `PharmacyOrdersClient.borradorPreparado()`, copiado al
 *   construir. Sin borrador —recarga o URL directa— sale honesto hacia la
 *   historia clínica y no se inventa pedido.
 * - **El traspaso** (`history.state[CLAVE_DEL_TRASPASO]`), opcional y del que
 *   sólo se usa `cantidad`, que es lo compatible con el contrato
 *   (`lines[].quantity`). Lo demás de ese estado es de la pantalla anterior.
 */
@Component({
  selector: 'app-checkout',
  imports: [Alert, AppButton, OrderSummary, PageHeader, Stepper, ViewStateHost],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Checkout {
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly documento = inject(DOCUMENT);
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly rutaDeLaOrden = RUTA_DE_LA_ORDEN;

  /** La copia del borrador (ver el JSDoc de la clase). */
  protected readonly borrador = this.ordersClient.borradorPreparado();

  /** Las cantidades elegidas en la orden médica, o `null` si no llegaron. */
  protected readonly traspaso = traspasoValido(this.leerTraspaso(), this.borrador);

  /** Lo que la farmacia no puede recibir: bloquea la confirmación, como en E. */
  protected readonly productosSinPublicar =
    this.borrador?.lineas.filter((linea) => linea.productId === null).map((l) => l.medicamento) ??
    [];

  /**
   * El borrador que se envía: el vivo, con las cantidades elegidas. Se arma
   * **una vez**: el cliente asocia la clave de idempotencia al objeto, así que
   * un reintento no duplica el pedido.
   */
  private readonly borradorAEnviar = conCantidadesElegidas(this.borrador, this.traspaso);

  protected readonly estado = computed<ViewState<BorradorDePedido>>(() => {
    const borrador = this.borrador;
    if (borrador === null) {
      return notFound({ label: 'Ir a mi historia clínica', route: MI_HISTORIA_ROUTE });
    }
    if (borrador.lineas.length === 0) {
      return empty(
        { label: 'Volver a mis pedidos', route: MIS_PEDIDOS_ROUTE },
        'Este pedido no tiene medicamentos para confirmar.',
      );
    }
    return ready(borrador);
  });

  /* ---- los pasos ------------------------------------------------------------ */

  private readonly indiceActual = signal(0);

  protected readonly pasoActual = computed<Paso>(
    () => PASOS[Math.min(this.indiceActual(), PASOS.length - 1)] ?? 'ENTREGA',
  );

  protected readonly pasosDelStepper = computed<readonly StepperStep[]>(() => {
    const actual = Math.min(this.indiceActual(), PASOS.length - 1);
    return PASOS.map((paso, indice) => ({
      label: ROTULO_DEL_PASO[paso],
      status: indice < actual ? 'complete' : indice === actual ? 'current' : 'upcoming',
      disabled: indice > actual,
      disabledReason: indice > actual ? 'Completá el paso actual primero' : undefined,
    }));
  });

  /* ---- el resumen ----------------------------------------------------------- */

  protected readonly resumen = computed(() =>
    resumirPedido({
      renglones: this.renglonesACobrar,
      moneda: this.borrador?.moneda ?? null,
    }),
  );

  private readonly renglonesACobrar: readonly RenglonACobrar[] = this.armarRenglones();

  /* ---- la confirmación final ------------------------------------------------ */

  protected readonly enviando = signal(false);
  protected readonly falloAlConfirmar = signal(false);

  protected readonly puedeConfirmar = computed(
    () =>
      this.productosSinPublicar.length === 0 && this.borradorAEnviar !== null && !this.enviando(),
  );

  /** `true` desde que se vuelve a la orden médica: el borrador no se descarta. */
  private volviendoALaOrden = false;

  constructor() {
    // Salir sin confirmar ni volver a la orden descarta el borrador, como en
    // la orden médica. Tras confirmar ya lo limpió el cliente.
    this.destroyRef.onDestroy(() => {
      if (!this.volviendoALaOrden) {
        this.ordersClient.descartarBorrador();
      }
    });
  }

  protected siguiente(): void {
    this.irAlPaso(this.indiceActual() + 1);
  }

  protected anterior(): void {
    this.irAlPaso(this.indiceActual() - 1);
  }

  /** El stepper sólo propone: se va hacia atrás, nunca se saltea un paso. */
  protected alPedirPaso(indice: number): void {
    if (indice < this.indiceActual()) {
      this.irAlPaso(indice);
    }
  }

  protected volverALaOrden(): void {
    this.volviendoALaOrden = true;
    void this.router.navigateByUrl(RUTA_DE_LA_ORDEN).then(
      (navego) => {
        if (!navego) {
          this.volviendoALaOrden = false;
        }
      },
      () => {
        this.volviendoALaOrden = false;
      },
    );
  }

  /**
   * La confirmación final: crea el pedido real y lleva a su detalle. Una sola
   * vez aunque se pulse dos veces.
   */
  protected confirmar(): void {
    const borrador = this.borradorAEnviar;
    if (borrador === null || !this.puedeConfirmar()) {
      return;
    }
    this.enviando.set(true);
    this.falloAlConfirmar.set(false);
    this.ordersClient
      .enviar({ borrador, modalidad: 'RETIRO', direccionDeEntrega: null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pedido) => {
          void this.router.navigate([MIS_PEDIDOS_ROUTE, pedido.id]);
        },
        error: () => {
          this.enviando.set(false);
          this.falloAlConfirmar.set(true);
        },
      });
  }

  private irAlPaso(indice: number): void {
    const destino = Math.max(0, Math.min(indice, PASOS.length - 1));
    this.indiceActual.set(destino);
    if (!this.esBrowser) {
      return;
    }
    // El paso nuevo reemplaza al anterior: el foco va a su título, no al body.
    // Después del render, cuando el título que existe ya es el del paso nuevo.
    afterNextRender(() => this.documento.getElementById('checkout-paso-titulo')?.focus(), {
      injector: this.injector,
    });
  }

  private leerTraspaso(): unknown {
    const deLaNavegacion = this.router.currentNavigation()?.extras.state;
    if (deLaNavegacion !== undefined) {
      return deLaNavegacion[CLAVE_DEL_TRASPASO];
    }
    if (!this.esBrowser) {
      return undefined;
    }
    const estado: unknown = this.documento.defaultView?.history.state;
    return typeof estado === 'object' && estado !== null
      ? (estado as Record<string, unknown>)[CLAVE_DEL_TRASPASO]
      : undefined;
  }

  /** Los renglones del borrador, con la cantidad elegida y el precio publicado. */
  private armarRenglones(): readonly RenglonACobrar[] {
    const borrador = this.borrador;
    if (borrador === null) {
      return [];
    }
    return borrador.lineas.map((linea, indice): RenglonACobrar => {
      const cantidad = this.traspaso?.renglones.find((r) => r.indice === indice)?.cantidad;
      return {
        indice,
        medicamento: linea.medicamento,
        presentacion: linea.presentacion,
        cantidad: cantidad ?? linea.cantidad,
        precioUnitario: linea.precio === null ? null : (normalizado(linea.precio) ?? linea.precio),
        disponible: linea.disponible,
      };
    });
  }
}

/**
 * El traspaso llega por `history.state`, que cualquiera puede escribir: se
 * acepta sólo con la forma que la orden médica produce y con renglones que
 * existen en el borrador. Si no, se ignora entero y valen las cantidades del
 * borrador.
 */
export function traspasoValido(
  valor: unknown,
  borrador: BorradorDePedido | null,
): TraspasoDeLaReceta | null {
  if (borrador === null || typeof valor !== 'object' || valor === null) {
    return null;
  }
  const candidato = valor as Partial<TraspasoDeLaReceta>;
  if (typeof candidato.conSeguro !== 'boolean' || !Array.isArray(candidato.renglones)) {
    return null;
  }
  const renglonesValidos = candidato.renglones.every(
    (renglon) =>
      typeof renglon === 'object' &&
      renglon !== null &&
      Number.isInteger(renglon.indice) &&
      renglon.indice >= 0 &&
      renglon.indice < borrador.lineas.length &&
      Number.isInteger(renglon.cantidad) &&
      renglon.cantidad >= 1,
  );
  return renglonesValidos ? (candidato as TraspasoDeLaReceta) : null;
}

/** El borrador con las cantidades elegidas; el resto queda intacto. */
function conCantidadesElegidas(
  borrador: BorradorDePedido | null,
  traspaso: TraspasoDeLaReceta | null,
): BorradorDePedido | null {
  if (borrador === null || traspaso === null) {
    return borrador;
  }
  const lineas = borrador.lineas.map((linea, indice) => {
    const cantidad = traspaso.renglones.find((renglon) => renglon.indice === indice)?.cantidad;
    return cantidad === undefined || cantidad === linea.cantidad ? linea : { ...linea, cantidad };
  });
  return lineas.every((linea, indice) => linea === borrador.lineas[indice])
    ? borrador
    : { ...borrador, lineas };
}
