/**
 * Las pestañas de la ficha del paciente, en lectura y en edición.
 *
 * ## Por qué una constante compartida
 *
 * La ficha de «Mi perfil» y el editor de datos propios son dos componentes,
 * pero para la persona son **la misma tarjeta** en dos estados: entra en sólo
 * lectura y el lápiz habilita los campos ahí mismo (FT-11-R04). Si cada uno
 * declarara sus pestañas, en el primer retoque que se hiciera en uno solo la
 * pestaña «Contacto» quedaría en el segundo lugar de un lado y en el tercero
 * del otro, y pulsar el lápiz cambiaría de pestaña sin que nadie lo pidiera.
 *
 * El orden es el del alta: lo que identifica a la persona, cómo ubicarla, a
 * nombre de quién factura, y lo que declaró de terceros. «Mis puntos» va al
 * final: no es un dato declarado sino la billetera del programa de fidelidad,
 * y el editor no la ofrece porque ahí no hay nada que editar (desde el
 * 25/09/2026 la saca de la tira en vez de mostrarla apagada; «Seguros» lleva
 * el mismo tratamiento y el mismo motivo).
 *
 * Pedido del cliente del 09/09/2026: «un solo card grande con distintas
 * pestañas», en vez de tres tarjetas apiladas.
 *
 * **«Seguros» y «Tutores» se separaron el 24/09/2026** (pedido del
 * propietario): eran una sola pestaña «Seguros y tutores» con dos listas
 * adentro, y son dos categorías de dato distintas —una póliza no es un
 * contacto de emergencia—. Van consecutivas, en el mismo lugar que ocupaba la
 * pestaña combinada.
 */
export const PESTANAS_DEL_PERFIL = [
  'Datos personales',
  'Contacto',
  'Facturación',
  'Seguros',
  'Tutores',
  'Mis puntos',
] as const;

/** Los índices con nombre, para no escribir `2` donde se quiere decir «Facturación». */
export const PESTANA = {
  personales: 0,
  contacto: 1,
  facturacion: 2,
  seguros: 3,
  tutores: 4,
  puntos: 5,
} as const;

/**
 * El índice de la pestaña que nombra una clave de `PESTANA`, o `null`.
 *
 * Es lo que permite abrir la ficha en una pestaña desde la URL
 * (`/my-account?pestana=puntos`): la clave viaja con nombre, no con número,
 * para que reordenar la constante no rompa los enlaces guardados. Una clave
 * desconocida no es un error: es «la primera, como siempre».
 */
export function indiceDePestana(clave: string | null): number | null {
  if (clave === null) {
    return null;
  }
  return Object.hasOwn(PESTANA, clave) ? PESTANA[clave as keyof typeof PESTANA] : null;
}
