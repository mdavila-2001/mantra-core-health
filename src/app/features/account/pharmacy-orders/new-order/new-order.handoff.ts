import { InjectionToken } from '@angular/core';

import type { AlternativaDeEjemplo } from './new-order.fixtures';

/**
 * **El traspaso de la orden médica (E) al checkout (G)** — decisión de Ender
 * D-FARMOCK-T-E1-01 = `CHECKOUT_BEFORE_ORDER_CREATION`.
 *
 * ```text
 * receta → borrador → E «Continuar» → checkout → confirmación final
 *        → POST /pharmacy/orders → orderId real
 * ```
 *
 * Lo que E garantiza al continuar:
 *
 * - **No crea el pedido.** No llama a `PharmacyOrdersClient.enviar()` ni a la
 *   API: antes del checkout no hay `orderId`, ni stock reservado, ni evento.
 * - **El borrador sigue vivo.** `PharmacyOrdersClient.borradorPreparado()` lo
 *   conserva intacto —los renglones tal como los armó la sucursal— y el
 *   checkout lo lee de ahí, como hoy lo lee E.
 * - **Las elecciones viajan en el estado de la navegación**, bajo
 *   {@link CLAVE_DEL_TRASPASO}, nunca en la URL: `history.state` o
 *   `Router.getCurrentNavigation()?.extras.state`.
 *
 * Lo que el checkout (T-E3) tiene que saber:
 *
 * - `cantidad` es compatible con el contrato real (`lines[].quantity`), pero
 *   su techo sale de un dato de ejemplo.
 * - `alternativa` y `aprobadoPorSeguro` son **de demostración**: la
 *   alternativa no tiene `productId` y no puede ir en el cuerpo del pedido real.
 *
 * ## La ruta
 *
 * La del checkout de T-E3, sin `:orderId` porque el pedido todavía no existe.
 * Con `null`, E muestra «Continuar» deshabilitado.
 */
export const RUTA_DEL_CHECKOUT = new InjectionToken<string | null>('RUTA_DEL_CHECKOUT', {
  providedIn: 'root',
  factory: () => '/my-account/pharmacy-orders/checkout',
});

/** La clave del traspaso dentro de `NavigationExtras.state`. */
export const CLAVE_DEL_TRASPASO = 'traspasoDeLaReceta';

/** Un renglón tal como la persona lo dejó en E. */
export interface RenglonDelTraspaso {
  /** Posición del renglón en `BorradorDePedido.lineas`. */
  readonly indice: number;
  readonly cantidad: number;
  /** De demostración. `null` si quedó la recetada. */
  readonly alternativa: AlternativaDeEjemplo | null;
  /** De demostración. */
  readonly aprobadoPorSeguro: boolean;
}

export interface TraspasoDeLaReceta {
  /** Si la persona miraba la variante con seguro (demostración). */
  readonly conSeguro: boolean;
  readonly renglones: readonly RenglonDelTraspaso[];
}
