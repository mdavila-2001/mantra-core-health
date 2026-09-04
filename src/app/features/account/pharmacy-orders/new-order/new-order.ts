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
  type ModalidadDeEntrega,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { notFound, ready } from '../../../../core/view-state/view-state';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { RadioGroup } from '../../../../shared/components/molecules/radio-group/radio-group';
import { Radio } from '../../../../shared/components/molecules/radio/radio';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { MI_HISTORIA_ROUTE } from '../../medical-record/medical-record.routes';

/**
 * La dirección de ejemplo con que la demo ejercita los envíos. El backend no
 * expone todavía las direcciones del paciente (mismo bloqueador que anotó
 * «dónde comprar mi receta»): sin el gate de demostración los envíos se
 * ofrecen deshabilitados y con el porqué escrito.
 */
/**
 * **Confirmá tu pedido** (carril FAR-I2): el paso entre «dónde comprar mi
 * receta» y «Mis pedidos».
 *
 * ## De dónde salen los datos
 *
 * Del **borrador** que la pantalla anterior dejó en el cliente al tocar
 * «Enviar pedido»: renglones ya evaluados contra la sede, con lo que la
 * farmacia no tiene dicho claro. Nada viaja por la URL — ni ids de productos
 * ni datos de la persona— y no se repite ninguna consulta.
 *
 * El borrador se **copia al construir**: `enviar()` lo consume en el cliente,
 * y sin la copia la pantalla parpadearía a «no encontrado» antes de navegar
 * al detalle. Quien recarga o entra por URL directa no tiene borrador y ve la
 * salida honesta hacia su historia.
 *
 * ## La modalidad dice la verdad
 *
 * «Retiro en la farmacia» es el default del contrato y lo único elegible hoy:
 * los envíos existen para que se sepa que vienen, pero sin direcciones del
 * paciente en el backend sólo la demo los ejercita, con dirección de ejemplo
 * y marcada. El pedido no es un pago: se paga al retirar, y el texto lo dice.
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

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /** La copia del borrador (ver el JSDoc de la clase). */
  protected readonly borrador = this.ordersClient.borradorPreparado();

  /** Sin borrador no hay nada que confirmar: salida honesta, no un error. */
  protected readonly estado =
    this.borrador === null
      ? notFound({ label: 'Ir a mi historia clínica', route: MI_HISTORIA_ROUTE })
      : ready(this.borrador);

  /** Medications that block the complete order under the approved policy. */
  protected readonly unresolvedProductNames =
    this.borrador?.lineas
      .filter((line) => line.productId === null)
      .map((line) => line.medicamento) ?? [];

  protected readonly hasUnresolvedProducts = this.unresolvedProductNames.length > 0;

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

  constructor() {
    // Salir sin enviar descarta el borrador: quien vuelve atrás no deja un
    // pedido a medias esperando en la sesión. Tras enviar es un no-op, porque
    // `enviar()` ya lo consumió en el cliente.
    inject(DestroyRef).onDestroy(() => this.ordersClient.descartarBorrador());
  }

  protected readonly modalidad = signal<ModalidadDeEntrega>('RETIRO');
  protected readonly enviando = signal(false);
  protected readonly fallo = signal(false);

  /** La dirección que acompaña un envío; `null` con retiro en mostrador. */
  protected readonly direccionDeEntrega = computed(() => null);

  /** Vuelve a la consulta de sedes de la misma receta. */
  protected readonly rutaDeVuelta =
    this.borrador === null
      ? MI_HISTORIA_ROUTE
      : `/my-account/medical-record/where-to-buy/${this.borrador.requestId}`;

  /** El grupo de radios entrega `unknown`; acá se estrecha o se ignora. */
  protected alElegirModalidad(valor: unknown): void {
    if (esModalidad(valor)) {
      this.modalidad.set(valor);
    }
  }

  protected enviar(): void {
    const borrador = this.borrador;
    if (borrador === null || this.enviando() || this.hasUnresolvedProducts) {
      return;
    }
    this.enviando.set(true);
    this.fallo.set(false);
    this.ordersClient
      .enviar({
        borrador,
        modalidad: this.modalidad(),
        direccionDeEntrega: this.direccionDeEntrega(),
      })
      .subscribe({
        next: (pedido) => {
          void this.router.navigate(['/my-account/pharmacy-orders', pedido.id]);
        },
        // El error real queda visible y permite reintentar sin duplicar la orden.
        error: () => {
          this.enviando.set(false);
          this.fallo.set(true);
        },
      });
  }
}

function esModalidad(valor: unknown): valor is ModalidadDeEntrega {
  return (MODALIDADES_DE_ENTREGA as readonly unknown[]).includes(valor);
}
