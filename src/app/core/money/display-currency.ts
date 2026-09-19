/* ============================================================================
    La moneda que se muestra junto a un precio.

    ## Por qué una sola función

    Hasta el 19/09/2026 cada pantalla pegaba al importe el código que traía el
    dato: `Bs` en unas, `BOB` en otras, y `UMA` en las que leen el arancel de
    referencia. Pedido del propietario del producto mirando el directorio de
    clínicas: **de momento, en todos lados, «Bs»**.

    ## Qué se traduce y qué no

    · **`BOB`** — es el boliviano. Se escribe «Bs», como en Bolivia.
    · **`UMA`** — la unidad de cuenta del arancel del Colegio Médico de Santa
      Cruz. **No es dinero** y su factor a bolivianos no está declarado en
      ninguna parte (ver `fee-schedules.generated.ts`), así que «100 UMA» pasa
      a leerse «100 Bs» **sin convertir**. Es la decisión del pedido, tomada
      sobre la maqueta; cuando haya un factor o precios propios en bolivianos,
      se revisa acá y en un solo lugar.
    · **Cualquier otro código** —`USD`, y el arancel odontológico está en
      dólares— **se muestra tal cual**. Decir «Bs» sobre un precio en dólares
      no es un rótulo distinto: es otro precio, siete veces más barato.
    ========================================================================== */

/** El símbolo del boliviano, tal como se escribe en Bolivia. */
export const DISPLAY_CURRENCY = 'Bs';

/** Los códigos que se muestran como «Bs». Ver el comentario de arriba. */
const COMO_BOLIVIANO: readonly string[] = ['BOB', 'Bs', 'UMA', 'Boliviano', 'Bolivianos'];

/**
 * La moneda visible para un precio.
 *
 * @param code - El código o la etiqueta que trae el dato. `null` o `undefined`
 *   cuando no viaja ninguno: se asume el boliviano, que es la moneda del
 *   producto.
 * @returns «Bs» para el boliviano y la UMA del arancel; el código tal cual
 *   para cualquier otra moneda.
 */
export function displayCurrency(code?: string | null): string {
  if (code === null || code === undefined || code.trim() === '') return DISPLAY_CURRENCY;
  return COMO_BOLIVIANO.includes(code) ? DISPLAY_CURRENCY : code;
}

/**
 * El importe con su moneda visible detrás: `'150.00 Bs'`.
 *
 * No reformatea el número: cada pantalla decide su separador decimal, y
 * rehacerlo acá con `Number()` volvería a meter el redondeo que la cadena
 * exacta evita.
 *
 * @param amount - El importe tal como lo muestra la pantalla.
 * @param code - La moneda del dato, si viaja alguna.
 * @returns El importe seguido de la moneda visible.
 */
export function withDisplayCurrency(amount: string, code?: string | null): string {
  return `${amount} ${displayCurrency(code)}`;
}
