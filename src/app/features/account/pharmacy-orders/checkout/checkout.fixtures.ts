import { InjectionToken } from '@angular/core';
import { of, type Observable } from 'rxjs';

/**
 * **Los datos de ejemplo del checkout** (T-E3 · F2.1.6, F2.1.7, F2.1.8,
 * F2.1.10, F2.2.3, F2.2.5, F3.2, F3.4, F4.2).
 *
 * Nada de esto tiene contrato todavía, y por eso vive acá y no en `core/`:
 *
 * - **Las direcciones registradas.** El backend no expone direcciones del
 *   paciente; «dónde comprar mi receta» y la orden médica anotan el mismo hueco.
 * - **La tarjeta.** `ORIGENES_DE_PAGO` sólo conoce `MOSTRADOR` y `QR_DEMO`; no se
 *   amplía desde una maqueta.
 * - **El descuento de red, el coaseguro previo, el costo de envío y los
 *   puntos.** La liquidación real del seguro llega recién sobre un pedido ya
 *   creado, y antes de la confirmación final no hay pedido
 *   (D-FARMOCK-T-E1-01).
 *
 * Reglas que este archivo respeta:
 *
 * - **Nada de pedidos.** Ni `orderId`, ni pedido persistido, ni respuesta de
 *   `POST /pharmacy/orders`: el pedido real lo crea la confirmación final con
 *   `PharmacyOrdersClient.enviar()`.
 * - **El QR de ejemplo no identifica nada.** Su contenido dice que es de
 *   ejemplo y no lleva ningún identificador: no se envía al backend ni
 *   representa un pago.
 * - **Los importes son texto**; los porcentajes, enteros.
 */

/** Una dirección de la persona, tal como la maqueta la muestra. */
export interface DireccionDeEjemplo {
  /** Identificador de ejemplo, local a esta pantalla. No viaja a la API. */
  readonly id: string;
  readonly rotulo: string;
  readonly linea: string;
  readonly referencia: string | null;
}

export const DIRECCIONES_DE_EJEMPLO: readonly DireccionDeEjemplo[] = [
  {
    id: 'direccion-de-ejemplo-casa',
    rotulo: 'Casa',
    linea: 'Av. Busch 1250, Santa Cruz de la Sierra',
    referencia: 'Portón verde, frente a la plaza',
  },
  {
    id: 'direccion-de-ejemplo-trabajo',
    rotulo: 'Trabajo',
    linea: 'Calle Junín 380, piso 4, Santa Cruz de la Sierra',
    referencia: null,
  },
];

export type FuenteDeDirecciones = () => Observable<readonly DireccionDeEjemplo[]>;

/**
 * De dónde lee el checkout las direcciones de ejemplo.
 *
 * Asíncrono aunque hoy responda en el acto: la fuente real lo va a ser, y la
 * pantalla ya cubre cargando, error y «sin dirección registrada» sobre esta
 * costura. Las pruebas la sustituyen.
 */
export const DIRECCIONES_REGISTRADAS = new InjectionToken<FuenteDeDirecciones>(
  'DIRECCIONES_REGISTRADAS',
  {
    providedIn: 'root',
    factory: () => () => of(DIRECCIONES_DE_EJEMPLO),
  },
);

/** La tarjeta de la maqueta: enmascarada, sin ningún dato real. */
export const TARJETA_DE_EJEMPLO = Object.freeze({
  numero: '•••• •••• •••• 4242',
  titular: 'NOMBRE DE EJEMPLO',
  vence: '12/28',
});

/** Descuento red AloVida sobre lo que paga la persona. De ejemplo. */
export const PORCENTAJE_DE_DESCUENTO_DE_RED = 10;

/** Parte de lo aprobado por el seguro que queda a cargo de la persona. De ejemplo. */
export const PORCENTAJE_DE_COASEGURO = 20;

/** Costo del envío con delivery, texto exacto. De ejemplo. */
export const COSTO_DE_ENVIO_DE_EJEMPLO = '15.00';

/** Un punto AloVida por cada tantos centavos del total. De ejemplo. */
export const CENTAVOS_POR_PUNTO = 1000;

/**
 * El contenido del QR de la maqueta. A propósito no lleva identificador: no
 * hay pedido todavía y el QR no representa ningún cobro.
 */
export function contenidoDelQrDeEjemplo(total: string | null, moneda: string | null): string {
  const monto = total === null ? 'sin-total' : `${total} ${moneda ?? ''}`.trim();
  return `ALOVIDA-QR-DE-EJEMPLO|sin-pedido|${monto}`;
}
