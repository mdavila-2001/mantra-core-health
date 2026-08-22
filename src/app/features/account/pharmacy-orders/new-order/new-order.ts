import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { environment } from '../../../../../environments/environment';
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
const DIRECCION_SIMULADA: Readonly<Record<'DOMICILIO' | 'TRABAJO', string>> = {
  DOMICILIO: 'Av. Ejemplo 123, Santa Cruz de la Sierra',
  TRABAJO: 'Calle Ejemplo 456, oficina 2B, Santa Cruz de la Sierra',
};

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

  protected readonly demoActiva = environment.demoPresets;

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
  protected readonly direccionDeEntrega = computed(() => {
    const modalidad = this.modalidad();
    return modalidad === 'RETIRO' ? null : DIRECCION_SIMULADA[modalidad];
  });

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
    if (borrador === null || this.enviando()) {
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
        // El mock no falla, pero la firma es la del backend real: cuando
        // FAR-E1 conecte, el fallo ya tiene su aviso y su reintento.
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
