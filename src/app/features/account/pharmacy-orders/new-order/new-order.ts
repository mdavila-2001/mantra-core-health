import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PharmacyCampaignsClient } from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.client';
import {
  normalizado,
  totalDeRenglones,
} from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.money';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import {
  MODALIDADES_DE_ENTREGA,
  type BorradorDePedido,
  type LineaDePedido,
  type ModalidadDeEntrega,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { RadioGroup } from '../../../../shared/components/molecules/radio-group/radio-group';
import { Radio } from '../../../../shared/components/molecules/radio/radio';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { MI_HISTORIA_ROUTE } from '../../medical-record/medical-record.routes';
import {
  CLAVE_DEL_TRASPASO,
  RUTA_DEL_CHECKOUT,
  type TraspasoDeLaReceta,
} from './new-order.handoff';

/** Un renglón listo para pintar: el del borrador más lo que se eligió. */
interface RenglonVisible {
  readonly indice: number;
  /** La línea del borrador, intacta. */
  readonly linea: LineaDePedido;
  readonly medicamento: string;
  readonly presentacion: string | null;
  /**
   * La cantidad que se pide: la del borrador, sin editar.
   *
   * El contrato de lectura de recetas no publica la cantidad recetada, así que
   * no hay techo demostrable y no se inventa uno (D-R1-1 = A).
   */
  readonly cantidad: number;
  /** El precio unitario de la sede, sin campaña. */
  readonly precioDeLista: string | null;
  /** El precio de campaña (FAR-I7). */
  readonly precioPromocional: string | null;
  readonly subtotal: string | null;
}

/**
 * La dirección de ejemplo con que la demo ejercita los envíos. El backend no
 * expone todavía las direcciones del paciente (mismo bloqueador que anotó
 * «dónde comprar mi receta»): sin el gate de demostración los envíos se
 * ofrecen deshabilitados y con el porqué escrito.
 */
/**
 * **Confirmá tu pedido** (carril FAR-I2), extendida como **la orden médica
 * como pedido** (T-E1): el paso entre «dónde comprar mi receta» y el checkout.
 *
 * ## De dónde salen los datos
 *
 * Del **borrador** que la pantalla anterior dejó en el cliente al tocar
 * «Enviar pedido»: renglones ya evaluados contra la sede, con lo que la
 * farmacia no tiene dicho claro. Nada viaja por la URL — ni ids de productos
 * ni datos de la persona— y no se repite ninguna consulta.
 *
 * El borrador se **copia al construir**. Quien recarga o entra por URL directa
 * no tiene borrador y ve la salida honesta hacia su historia.
 *
 * ## Sólo se dibuja lo que el contrato demuestra (FAR-REAL-T-E1, D-R1-1 = A)
 *
 * La pantalla muestra los renglones del borrador y nada más. Lo que no tiene
 * contrato **no se dibuja**: no hay cabecera de receta —el borrador no trae
 * quién la emitió ni cuándo—, no hay alternativas por renglón —la búsqueda
 * real contra la farmacia no existe— y no hay variante con seguro —la
 * cobertura por ítem sólo se conoce tras la adjudicación, sobre un pedido ya
 * creado—.
 *
 * **La cantidad no se edita.** El borrador trae un envase por renglón y así se
 * pide. Ese 1 es un **fallback conservador del front**, no una cantidad
 * clínica demostrada: `GET /clinical/patients/:id/summary` no publica la
 * cantidad recetada. Antes se ofrecía subirla hasta un techo inventado de 3,
 * y esa cifra viajaba como `quantity` al pedido real.
 *
 * **Residual de API que esto no arregla:** `SERVER_QUANTITY_VALIDATION =
 * MISSING` — `POST /pharmacy/orders` acepta cualquier `quantity > 0` sin
 * contrastarla con la prescripción.
 *
 * ## Desde acá no se crea ningún pedido (D-FARMOCK-T-E1-01)
 *
 * El pedido real se crea en la confirmación final del checkout. «Continuar»
 * conserva el borrador y lleva las elecciones en el estado de la navegación
 * (`new-order.handoff.ts`); mientras el checkout no exista, se ofrece
 * deshabilitado. Ninguna acción de esta pantalla llama a
 * `PharmacyOrdersClient.enviar()`: esa capacidad real sigue intacta en el
 * cliente para la confirmación final.
 *
 * ## La modalidad dice la verdad
 *
 * «Retiro en la farmacia» es el default del contrato y lo único elegible hoy:
 * los envíos existen para que se sepa que vienen, pero sin direcciones del
 * paciente en el backend quedan deshabilitados y con el porqué escrito.
 */
@Component({
  selector: 'app-new-order',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    FormField,
    PageHeader,
    Radio,
    RadioGroup,
    RouterLink,
    Skeleton,
    ViewStateHost,
  ],
  templateUrl: './new-order.html',
  styleUrl: './new-order.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewOrder {
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /** La copia del borrador (ver el JSDoc de la clase). */
  protected readonly borrador = this.ordersClient.borradorPreparado();

  /** Medications that block the complete order under the approved policy. */
  protected readonly unresolvedProductNames =
    this.borrador?.lineas
      .filter((line) => line.productId === null)
      .map((line) => line.medicamento) ?? [];

  protected readonly hasUnresolvedProducts = this.unresolvedProductNames.length > 0;

  /** Vuelve a la consulta de sedes de la misma receta. */
  protected readonly rutaDeVuelta =
    this.borrador === null
      ? MI_HISTORIA_ROUTE
      : `/my-account/medical-record/where-to-buy/${this.borrador.requestId}`;

  /**
   * Sin borrador, la salida honesta hacia la historia; con un borrador vacío,
   * la vuelta a las sucursales.
   */
  protected readonly estado = computed<ViewState<BorradorDePedido>>(() => {
    const borrador = this.borrador;
    if (borrador === null) {
      return notFound({ label: 'Ir a mi historia clínica', route: MI_HISTORIA_ROUTE });
    }
    if (borrador.lineas.length === 0) {
      return empty(
        { label: 'Volver a las sucursales', route: this.rutaDeVuelta },
        'Este pedido no tiene medicamentos para confirmar.',
      );
    }
    return ready(borrador);
  });

  /* ---- las promociones del pedido (FAR-I7) --------------------------------- */

  private readonly campaigns = inject(PharmacyCampaignsClient);

  /**
   * Los renglones que alguna campaña vigente de esta farmacia alcanza.
   *
   * Se resuelve una sola vez al construir, como el borrador: el pedido ya está
   * congelado y nada de esta pantalla lo cambia.
   */
  protected readonly renglonesEnPromocion = this.resolverPromociones();

  /** El total con los precios promocionales aplicados, o `null`. */
  protected readonly totalConPromocion = this.calcularTotalConPromocion();

  /**
   * El total del borrador **no se reescribe**: se muestra al lado del
   * promocional.
   *
   * El precio congelado es del backend, y el cálculo de FAR-E1 es de Ender (la
   * regla que tiene que agregar está en `COORDINACION-AGENTES.md`). Bakear el
   * descuento en el borrador haría que la cifra enviada difiera de la que la
   * API vuelve a calcular y congelar.
   */
  private resolverPromociones(): ReadonlyMap<string, string> {
    const borrador = this.borrador;
    if (borrador === null) {
      return new Map();
    }
    const enPromocion = new Map<string, string>();
    for (const linea of borrador.lineas) {
      if (linea.productId === null || !linea.disponible) {
        continue;
      }
      const promocional = this.campaigns.precioPromocional(borrador.pharmacyId, linea.productId);
      if (promocional !== null) {
        enPromocion.set(linea.productId, promocional.precioPromocional);
      }
    }
    return enPromocion;
  }

  private calcularTotalConPromocion(): string | null {
    const borrador = this.borrador;
    if (borrador === null || this.renglonesEnPromocion.size === 0) {
      return null;
    }
    return totalDeRenglones(
      borrador.lineas
        .filter((linea) => linea.disponible)
        .map((linea) => ({
          precio:
            (linea.productId === null
              ? null
              : (this.renglonesEnPromocion.get(linea.productId) ?? null)) ??
            linea.precio ??
            '',
          cantidad: linea.cantidad,
        })),
    );
  }

  /** El precio de campaña de un renglón, o `null` si ninguna lo alcanza. */
  protected precioPromocionalDe(productId: string | null): string | null {
    return productId === null ? null : (this.renglonesEnPromocion.get(productId) ?? null);
  }

  /**
   * El precio de lista con el mismo formato que el promocional.
   *
   * `GET /pharmacy-inventory/availability` devuelve el `numeric` tal cual —
   * `"22.5"`—, y el promocional sale de la aritmética en centavos, siempre con
   * dos decimales. Sueltos no molesta; puestos uno al lado del otro, «antes
   * 22.5 · ahora 14.62» se lee como un descuido, y el descuido está sobre el
   * número que la paciente va a pagar.
   *
   * Lo que no es un importe vuelve **como vino**: mejor un formato raro que un
   * precio que desaparece de la pantalla.
   */
  protected precioNormalizado(importe: string | null): string | null {
    return importe === null ? null : (normalizado(importe) ?? importe);
  }

  /** `true` si hay al menos un renglón en promoción: gobierna el banner. */
  protected readonly hayPromocion = this.renglonesEnPromocion.size > 0;

  /* ---- la receta como pedido (FAR-REAL-T-E1) ------------------------------- */

  /**
   * Los renglones tal como los dejó la sucursal: sin cantidad editable, sin
   * alternativas y sin variante con seguro (D-R1-1 = A).
   */
  protected readonly renglones = computed<readonly RenglonVisible[]>(() => {
    const borrador = this.borrador;
    if (borrador === null) {
      return [];
    }
    return borrador.lineas.map((linea, indice): RenglonVisible => {
      const precioDeLista = this.precioNormalizado(linea.precio);
      const precioPromocional = this.precioPromocionalDe(linea.productId);
      const precioUnitario = precioPromocional ?? precioDeLista;
      return {
        indice,
        linea,
        medicamento: linea.medicamento,
        presentacion: linea.presentacion,
        cantidad: linea.cantidad,
        precioDeLista,
        precioPromocional,
        subtotal:
          linea.disponible && precioUnitario !== null
            ? totalDeRenglones([{ precio: precioUnitario, cantidad: linea.cantidad }])
            : null,
      };
    });
  });

  /* ---- el paso siguiente (D-FARMOCK-T-E1-01) ------------------------------- */

  /** La ruta del checkout, o `null` mientras T-E3 no la publique. */
  protected readonly rutaDelCheckout = inject(RUTA_DEL_CHECKOUT);

  protected readonly puedeContinuar = computed(
    () => this.rutaDelCheckout !== null && !this.hasUnresolvedProducts,
  );

  /** `true` desde que «Continuar» navega: el borrador ya no se descarta. */
  private continuando = false;

  constructor() {
    // Salir sin continuar descarta el borrador: quien vuelve atrás no deja un
    // pedido a medias esperando en la sesión. Tras continuar no se toca,
    // porque el checkout lo necesita.
    this.destroyRef.onDestroy(() => {
      if (!this.continuando) {
        this.ordersClient.descartarBorrador();
      }
    });
  }

  /**
   * Lleva al checkout con el borrador intacto y las elecciones en el estado de
   * la navegación. No crea el pedido ni llama a la API.
   */
  protected continuar(): void {
    const ruta = this.rutaDelCheckout;
    if (ruta === null || !this.puedeContinuar()) {
      return;
    }
    // Sin alternativas ni cobertura demostrables, el traspaso lleva la cantidad
    // del borrador y nada más: los dos campos de demostración viajan vacíos.
    const traspaso: TraspasoDeLaReceta = {
      conSeguro: false,
      renglones: this.renglones().map((renglon) => ({
        indice: renglon.indice,
        cantidad: renglon.cantidad,
        alternativa: null,
        aprobadoPorSeguro: false,
      })),
    };
    this.continuando = true;
    this.router.navigate([ruta], { state: { [CLAVE_DEL_TRASPASO]: traspaso } }).then(
      (navego) => {
        if (!navego) {
          this.continuando = false;
        }
      },
      () => {
        this.continuando = false;
      },
    );
  }

  protected readonly modalidad = signal<ModalidadDeEntrega>('RETIRO');

  /** El grupo de radios entrega `unknown`; acá se estrecha o se ignora. */
  protected alElegirModalidad(valor: unknown): void {
    if (esModalidad(valor)) {
      this.modalidad.set(valor);
    }
  }

}

function esModalidad(valor: unknown): valor is ModalidadDeEntrega {
  return (MODALIDADES_DE_ENTREGA as readonly unknown[]).includes(valor);
}
