/**
 * Los nombres que no son el primero, y cómo viajan.
 *
 * ## Una sola columna para todos
 *
 * La base guarda todo lo que no es el primer nombre en **`middle_name`**: no
 * hay columna de tercer nombre ni de cuarto, y el `varchar` admite los
 * espacios. Así que el segundo, el tercero y los que se hayan agregado viajan
 * como **una cadena separada por espacios**, y quien la lee la vuelve a partir.
 *
 * ## Por qué vive acá y no en el alta
 *
 * Porque son **dos** pantallas las que tienen que coincidir en esa
 * codificación: el alta de médico —que ya preguntaba tres nombres y dejaba
 * agregar más— y el editor de su perfil, que hasta ahora sólo ofrecía el
 * segundo. Quien tenía tres nombres los declaraba al registrarse y, si después
 * corregía cualquier otra cosa de su perfil, el editor le mandaba de vuelta
 * **sólo el segundo** y le borraba el resto. Es el mismo motivo por el que la
 * lista de títulos salió del alta a `titulos-profesionales`: dos pantallas que
 * escriben el mismo dato no pueden tener cada una su propia idea de cómo se
 * escribe.
 */

/**
 * Une los nombres adicionales en la cadena que espera `middleName`.
 *
 * Descarta los vacíos —una casilla agregada y no llenada no aporta un espacio
 * de más— y recorta cada uno.
 *
 * @param nombres - Segundo, tercero y los que se hayan agregado, en orden.
 * @returns Los no vacíos separados por un espacio; cadena vacía si no hay.
 */
export function unirNombres(nombres: readonly string[]): string {
  return nombres
    .map((nombre) => nombre.trim())
    .filter((nombre) => nombre !== '')
    .join(' ');
}

/**
 * Parte lo guardado en `middleName` en las casillas del formulario.
 *
 * El inverso exacto de {@link unirNombres}: el primer trozo es el segundo
 * nombre, el segundo el tercero, y el resto —si lo hay— son las casillas
 * agregadas. Alguien con un solo nombre adicional abre el formulario con la
 * casilla del tercero vacía, no con una casilla extra vacía de más.
 *
 * @param middleName - Lo que devolvió el perfil, o `undefined` si no declaró.
 * @returns El segundo, el tercero y las casillas extra.
 */
export function separarNombres(middleName: string | undefined): {
  readonly segundo: string;
  readonly tercero: string;
  readonly extra: readonly string[];
} {
  const partes = (middleName ?? '').split(/\s+/).filter((nombre) => nombre !== '');
  return {
    segundo: partes[0] ?? '',
    tercero: partes[1] ?? '',
    extra: partes.slice(2),
  };
}
