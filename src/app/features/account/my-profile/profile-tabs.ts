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
export const PROFILE_TABS = [
  'Datos personales',
  'Contacto',
  'Facturación',
  'Seguros',
  'Tutores',
  'Mis puntos',
  'Mis direcciones',
] as const;

/** Los índices con nombre, para no escribir `2` donde se quiere decir «Facturación». */
export const TAB = {
  personales: 0,
  contacto: 1,
  facturacion: 2,
  seguros: 3,
  tutores: 4,
  puntos: 5,
  direcciones: 6,
} as const;

/**
 * El índice de la pestaña que nombra una clave de `PESTANA`, o `null`.
 *
 * Es lo que permite abrir la ficha en una pestaña desde la URL
 * (`/my-account?pestana=puntos`): la clave viaja con nombre, no con número,
 * para que reordenar la constante no rompa los enlaces guardados. Una clave
 * desconocida no es un error: es «la primera, como siempre».
 */
export function tabIndex(clave: string | null): number | null {
  if (clave === null) {
    return null;
  }
  return Object.hasOwn(TAB, clave) ? TAB[clave as keyof typeof TAB] : null;
}

/**
 * La pestaña con la que se abre la ficha, según la que pidió la URL.
 *
 * «Tutores» sólo existe si hay tutores, y sin ella las que vienen después
 * —«Mis puntos» y «Mis direcciones» (26/10/2026)— se corren un lugar. Pedir
 * «Tutores» sin tenerlos abre la primera.
 *
 * @param pedida - El índice de {@link TAB} que pidió la URL.
 * @param tieneTutores - Si la pestaña «Tutores» se dibuja.
 */
export function initialTabIndex(pedida: number, tieneTutores: boolean): number {
  if (pedida === TAB.tutores && !tieneTutores) return TAB.personales;
  return pedida > TAB.tutores && !tieneTutores ? pedida - 1 : pedida;
}
