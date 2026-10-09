import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  PLATFORM_ID,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { environment } from '../../../../../environments/environment';
import {
  PharmacyCampaignsClient,
  etiquetaDeCampana,
} from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.client';
import {
  aCentavos,
  aTexto,
  normalizado,
} from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.money';
import type { OrderLine } from '../../../../core/promotions-engine/promotion-mechanics.types';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import { describeApiFailure } from '../../../../core/http/api-failure';
import type { BorradorDePedido } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { RadioGroup } from '../../../../shared/components/molecules/radio-group/radio-group';
import { Radio } from '../../../../shared/components/molecules/radio/radio';
import { Stepper } from '../../../../shared/components/molecules/stepper/stepper';
import type { StepperStep } from '../../../../shared/components/molecules/stepper/stepper.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { dibujarQr } from '../../../../shared/utils/qr/draw-qr';
import { MI_HISTORIA_ROUTE } from '../../medical-record/medical-record.routes';
import { NOTA_DE_DATOS_DE_EJEMPLO } from '../new-order/new-order.fixtures';
import { CLAVE_DEL_TRASPASO, type TraspasoDeLaReceta } from '../new-order/new-order.handoff';
import { MIS_PEDIDOS_ROUTE } from '../pharmacy-orders.routes';
import { contenidoDelQrDeEjemplo, TARJETA_DE_EJEMPLO } from './checkout.fixtures';
import { resumirPedido, type RenglonACobrar } from './checkout.summary';
import { OrderSummary } from './order-summary/order-summary';

/** La orden médica, para volver sin perder el borrador. */
const RUTA_DE_LA_ORDEN = `${MIS_PEDIDOS_ROUTE}/new`;

/** Lado del QR de ejemplo: el mismo que el QR de pago de `order-payment`. */
const LADO_DEL_QR = 176;

export const MEDIOS_DE_PAGO = ['QR', 'TARJETA'] as const;
export type MedioDePago = (typeof MEDIOS_DE_PAGO)[number];

type Paso = 'ENTREGA' | 'PAGO' | 'RESUMEN';

const ROTULO_DEL_PASO: Readonly<Record<Paso, string>> = {
  ENTREGA: 'Entrega',
  PAGO: 'Medio de pago',
  RESUMEN: 'Resumen',
};

/** Lo que el checkout necesita para estar listo. */
interface DatosDelCheckout {
  readonly borrador: BorradorDePedido;
}

/** Los pasos del checkout, en orden: el pedido sólo se retira en la farmacia. */
const PASOS: readonly Paso[] = ['ENTREGA', 'PAGO', 'RESUMEN'];

/**
 * **El checkout** (T-E3 · pantalla G): entrega → medio de pago → resumen →
 * confirmación final.
 *
 * ## Acá se crea el pedido (D-FARMOCK-T-E1-01)
 *
 * Antes de esta pantalla no existe `orderId`. La confirmación final llama a
 * `PharmacyOrdersClient.enviar()` con el borrador vivo y recién el 201 trae el
 * pedido real, con cuyo `id` se navega al detalle. No se inventa ningún
 * identificador en el camino, y por eso `OrderPayment` —que necesita un
 * pedido ya creado— **no** se monta acá: el paso de pago reutiliza sólo el
 * dibujo del QR (`dibujarQr`) con un contenido de ejemplo.
 *
 * ## Lo que llega de la orden médica
 *
 * - **El borrador**, de `PharmacyOrdersClient.borradorPreparado()`, copiado al
 *   construir. Sin borrador —recarga o URL directa— sale honesto hacia la
 *   historia clínica y no se inventa pedido.
 * - **El traspaso** (`history.state[CLAVE_DEL_TRASPASO]`), opcional. Si falta
 *   o no tiene la forma esperada, el checkout funciona con el borrador tal
 *   cual. `cantidad` es compatible con el contrato y viaja en el pedido;
 *   `alternativa` y `aprobadoPorSeguro` son de demostración y sólo se muestran.
 *
 * ## Lo que dice la verdad
 *
 * - **El pedido sólo se retira en la farmacia.** No hay envío a domicilio: ni
 *   se ofrece ni se simula, y el pedido se crea siempre con `RETIRO`.
 * - **La tarjeta** es una maqueta marcada; ningún paso cobra nada.
 * - El pedido se crea **una sola vez**: el borrador que se envía es siempre el
 *   mismo objeto, y el cliente reutiliza su clave de idempotencia al reintentar.
 */
@Component({
  selector: 'app-checkout',
  imports: [
    Alert,
    AppButton,
    Badge,
    FormField,
    Input,
    OrderSummary,
    PageHeader,
    Radio,
    RadioGroup,
    Skeleton,
    Stepper,
    ViewStateHost,
  ],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Checkout {
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly campaigns = inject(PharmacyCampaignsClient);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly documento = inject(DOCUMENT);
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly notaDeEjemplo = NOTA_DE_DATOS_DE_EJEMPLO;
  protected readonly tarjeta = TARJETA_DE_EJEMPLO;
  protected readonly rutaDeLaOrden = RUTA_DE_LA_ORDEN;
  protected readonly qrDemoActiva = environment.paymentDemo;
  protected readonly ladoDelQr = LADO_DEL_QR;

  /** La copia del borrador (ver el JSDoc de la clase). */
  protected readonly borrador = this.ordersClient.borradorPreparado();

  /** Las elecciones de la orden médica, o `null` si no llegaron. */
  protected readonly traspaso = traspasoValido(this.leerTraspaso(), this.borrador);

  /** Lo que la farmacia no puede recibir: bloquea la confirmación, como en E. */
  protected readonly productosSinPublicar =
    this.borrador?.lineas.filter((linea) => linea.productId === null).map((l) => l.medicamento) ??
    [];

  /**
   * El borrador que se envía: el vivo, con las cantidades elegidas en la orden
   * médica. Se arma **una vez**: el cliente asocia la clave de idempotencia al
   * objeto, así que un reintento no duplica el pedido.
   */
  private readonly borradorAEnviar = conCantidadesElegidas(this.borrador, this.traspaso);

  /* ---- estado --------------------------------------------------------------- */

  protected readonly estado = computed<ViewState<DatosDelCheckout>>(() => {
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
    return ready({ borrador });
  });

  /* ---- los pasos ------------------------------------------------------------ */

  protected readonly medioDePago = signal<MedioDePago>('QR');

  protected readonly pasos = PASOS;

  private readonly indiceActual = signal(0);

  protected readonly pasoActual = computed<Paso>(
    () => this.pasos[Math.min(this.indiceActual(), this.pasos.length - 1)] ?? 'ENTREGA',
  );

  /** Lo que el paso actual necesita para seguir. */
  protected readonly puedeSeguir = computed(() => this.pasoActual() !== 'RESUMEN');

  protected readonly pasosDelStepper = computed<readonly StepperStep[]>(() => {
    const actual = Math.min(this.indiceActual(), this.pasos.length - 1);
    return this.pasos.map((paso, indice) => ({
      label: ROTULO_DEL_PASO[paso],
      status: indice < actual ? 'complete' : indice === actual ? 'current' : 'upcoming',
      disabled: indice > actual,
      disabledReason: indice > actual ? 'Complete el paso actual primero' : undefined,
    }));
  });

  /* ---- el resumen ----------------------------------------------------------- */

  protected readonly conSeguro = this.traspaso?.conSeguro ?? false;

  protected readonly hayAlternativas =
    this.traspaso?.renglones.some((renglon) => renglon.alternativa !== null) ?? false;

  protected readonly resumen = computed(() =>
    resumirPedido({
      renglones: this.renglonesACobrar,
      moneda: this.borrador?.moneda ?? null,
      conSeguro: this.conSeguro,
      descuentoDeCampanaDelTotal: this.cobro.descuentoDelTotal,
    }),
  );

  /**
   * El pedido a cobrar, ya evaluado contra las campañas de la farmacia. El
   * checkout recibe un pedido **congelado** del paso anterior: se evalúa una
   * sola vez, al construir.
   */
  private readonly cobro = this.armarCobro();
  private readonly renglonesACobrar: readonly RenglonACobrar[] = this.cobro.renglones;

  /* ---- la confirmación final ------------------------------------------------ */

  protected readonly enviando = signal(false);
  /**
   * Por qué no se pudo confirmar —el motivo de la API o el texto de la
   * pantalla, con el código de soporte— o `null` si no falló. El carrito no se
   * toca: el reintento manda el mismo borrador con la misma clave.
   */
  protected readonly falloAlConfirmar = signal<string | null>(null);

  protected readonly puedeConfirmar = computed(
    () =>
      this.productosSinPublicar.length === 0 && this.borradorAEnviar !== null && !this.enviando(),
  );

  /** `true` desde que se vuelve a la orden médica: el borrador no se descarta. */
  private volviendoALaOrden = false;

  private readonly lienzoQr = viewChild<ElementRef<HTMLCanvasElement>>('lienzoQr');
  protected readonly qrDisponible = signal(true);

  constructor() {
    // Salir sin confirmar ni volver a la orden descarta el borrador, como en
    // la orden médica. Tras confirmar ya lo limpió el cliente.
    this.destroyRef.onDestroy(() => {
      if (!this.volviendoALaOrden) {
        this.ordersClient.descartarBorrador();
      }
    });
    // El lienzo existe sólo con «QR» elegido en el paso de pago.
    effect(() => {
      const lienzo = this.lienzoQr();
      const resumen = this.resumen();
      if (!this.esBrowser || lienzo === undefined) {
        return;
      }
      dibujarQr(
        lienzo.nativeElement,
        contenidoDelQrDeEjemplo(resumen.total, resumen.moneda),
        LADO_DEL_QR,
      ).catch(() => this.qrDisponible.set(false));
    });
  }

  protected alElegirMedioDePago(valor: unknown): void {
    if ((MEDIOS_DE_PAGO as readonly unknown[]).includes(valor)) {
      this.medioDePago.set(valor as MedioDePago);
    }
  }

  protected siguiente(): void {
    if (!this.puedeSeguir()) {
      return;
    }
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
    this.falloAlConfirmar.set(null);
    this.ordersClient
      .enviar({ borrador, modalidad: 'RETIRO', direccionDeEntrega: null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pedido) => {
          void this.router.navigate([MIS_PEDIDOS_ROUTE, pedido.id]);
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.falloAlConfirmar.set(describeApiFailure(error, 'No se pudo enviar el pedido a la farmacia.'));
        },
      });
  }

  private irAlPaso(indice: number): void {
    const destino = Math.max(0, Math.min(indice, this.pasos.length - 1));
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

  /**
   * Los renglones a cobrar y lo que las campañas descuentan sobre el total.
   *
   * Cada renglón conserva su precio **de lista**; lo que una campaña descuenta
   * va aparte, en `descuentoDeCampana`, porque un 2x1 o un combo no se
   * expresan como un precio por unidad. Una alternativa elegida entra al motor
   * con un identificador propio: ninguna campaña de la recetada la alcanza,
   * pero suma al total sobre el que se mide una compra mínima.
   */
  private armarCobro(): { renglones: readonly RenglonACobrar[]; descuentoDelTotal: string | null } {
    const borrador = this.borrador;
    if (borrador === null) {
      return { renglones: [], descuentoDelTotal: null };
    }
    const base = borrador.lineas.map((linea, indice) => {
      const eleccion = this.traspaso?.renglones.find((renglon) => renglon.indice === indice);
      const alternativa = eleccion?.alternativa ?? null;
      const deLista = linea.precio === null ? null : (normalizado(linea.precio) ?? linea.precio);
      const renglon: RenglonACobrar = {
        indice,
        medicamento: alternativa?.nombre ?? linea.medicamento,
        presentacion: alternativa?.presentacion ?? linea.presentacion,
        cantidad: eleccion?.cantidad ?? linea.cantidad,
        precioUnitario: alternativa?.precio ?? deLista,
        esAlternativa: alternativa !== null,
        aprobadoPorSeguro: eleccion?.aprobadoPorSeguro ?? false,
        disponible: linea.disponible,
      };
      const itemId =
        alternativa === null && linea.productId !== null ? linea.productId : `renglon-${indice}`;
      return { renglon, itemId };
    });

    const lineas: OrderLine[] = base.flatMap(({ renglon, itemId }) =>
      renglon.disponible && renglon.precioUnitario !== null
        ? [{ itemId, quantity: renglon.cantidad, unitPrice: renglon.precioUnitario }]
        : [],
    );
    const evaluacion = this.campaigns.evaluarPedido(borrador.pharmacyId, lineas);

    // Dos renglones del mismo producto el motor los suma en uno: el resultado se
    // asigna al primero.
    const yaVistos = new Set<string>();
    const renglones = base.map(({ renglon, itemId }): RenglonACobrar => {
      const resultado = yaVistos.has(itemId)
        ? undefined
        : evaluacion.lines.find((candidato) => candidato.itemId === itemId);
      yaVistos.add(itemId);
      if (resultado === undefined || resultado.campaignId === null) {
        return renglon;
      }
      const campana = this.campaigns.campanaPorId(resultado.campaignId);
      return {
        ...renglon,
        descuentoDeCampana: resultado.discount,
        promocion: campana === null ? null : etiquetaDeCampana(campana),
      };
    });
    const descuentoDelTotal = evaluacion.orderDiscounts.reduce(
      (suma, descuento) => suma + (aCentavos(descuento.amount) ?? 0),
      0,
    );
    return {
      renglones,
      descuentoDelTotal: descuentoDelTotal > 0 ? aTexto(descuentoDelTotal) : null,
    };
  }
}

/**
 * El traspaso llega por `history.state`, que cualquiera puede escribir: se
 * acepta sólo con la forma que E produce y renglones que existen en el
 * borrador. Si no, se ignora entero.
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
      renglon.cantidad >= 1 &&
      typeof renglon.aprobadoPorSeguro === 'boolean' &&
      alternativaValida(renglon.alternativa),
  );
  return renglonesValidos ? (candidato as TraspasoDeLaReceta) : null;
}

/** Una alternativa se muestra y se suma: tiene que traer texto donde se lee texto. */
function alternativaValida(valor: unknown): boolean {
  if (valor === null) {
    return true;
  }
  if (typeof valor !== 'object') {
    return false;
  }
  const alternativa = valor as Record<string, unknown>;
  return (
    typeof alternativa['nombre'] === 'string' &&
    typeof alternativa['precio'] === 'string' &&
    (alternativa['presentacion'] === null || typeof alternativa['presentacion'] === 'string')
  );
}

/**
 * El borrador con las cantidades elegidas. Las alternativas **no** entran: no
 * tienen `productId` y el pedido real lleva lo recetado.
 */
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
