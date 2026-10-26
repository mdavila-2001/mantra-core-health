import type { CampoDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';

/**
 * La línea de dirección que viaja a la API: la calle y, si la hay, el distrito
 * o la zona.
 *
 * `common.addresses.lines` es un único `varchar` y no tiene columna de zona
 * (ver el DTO de alta), así que el distrito se escribe en el campo propio del
 * formulario pero viaja **dentro de esa línea**, después de la calle y separado
 * por coma: «Av. Banzer #42, Distrito 5». Si alguien repite en el distrito lo
 * que ya escribió en la calle, no se duplica.
 *
 * @returns La línea, o `''` si ninguna de las dos partes tiene texto.
 */
export function componerDireccion(calle: string, distrito: string): string {
  const partes = [calle.trim(), distrito.trim()].filter((parte) => parte !== '');
  const unicas = partes.filter(
    (parte, i) => partes.findIndex((otra) => otra.toLowerCase() === parte.toLowerCase()) === i,
  );
  return unicas.join(', ');
}

/**
 * «Distrito o zona (opcional)»: el campo que aparece junto a la calle en cuanto
 * hay localidad elegida (`padre` es la clave de esa localidad).
 *
 * No tiene columna propia: viaja dentro de la línea de dirección, ver
 * {@link componerDireccion}.
 */
export function campoDistrito(key: string, testId: string, padre: string): CampoDeFormulario {
  return {
    key,
    label: 'Distrito o zona (opcional)',
    hint: 'El distrito, la zona o el barrio.',
    description: 'Se guarda junto con la calle, en la misma línea de dirección.',
    control: 'text',
    placeholder: 'Distrito 5, Zona Norte',
    testId,
    icono: 'pin',
    showWhen: { key: padre, filled: true },
  };
}
