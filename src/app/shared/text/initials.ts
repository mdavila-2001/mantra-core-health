/* ============================================================================
    Las iniciales de un nombre, para el cuadrado que va cuando no hay foto.

    Vivía dos veces —en el mapeador del buscador público y en el directorio de
    médicos— y la segunda copia se había quedado corta: no descartaba el
    tratamiento. En una captura del directorio se veía el resultado, doce
    tarjetas seguidas con «D» de «Dr(a).» y ninguna que distinguiera a nadie
    (evidencia del 23/08/2026). Una sola copia, acá.
    ========================================================================== */

/**
 * Los tratamientos que no aportan una inicial.
 *
 * Se comparan sin punto, sin paréntesis y sin mayúsculas, así que una sola
 * entrada cubre «Dr», «Dr.», «DRA», «dra.» y «Dr(a).» —esta última es la forma
 * que compone el propio backend—.
 */
const TREATMENTS = new Set([
  'dr',
  'dra',
  'dra2',
  'lic',
  'licenciado',
  'licenciada',
  'mgr',
  'mtro',
  'mtra',
  'prof',
  'ing',
  'sr',
  'sra',
  'srta',
]);

/** `Dr(a).` → `dra`, `Dra.` → `dra`: la forma con la que se compara. */
function withoutAdornments(parte: string): string {
  return parte.replace(/[().,]/g, '').toLowerCase();
}

/**
 * Hasta dos iniciales de un nombre, **descartando el tratamiento**.
 *
 * «Dra. Marisol Quispe Ticona» da `MQ`, no `DM`. En un directorio médico casi
 * todos los nombres empiezan con «Dr.» o «Dra.», así que tomarlo como primera
 * inicial pone la misma letra en media pantalla y deja de distinguir a nadie,
 * que es lo único que las iniciales tienen que hacer.
 *
 * Si el nombre es **sólo** un tratamiento —o queda vacío al sacarlo— se cae a
 * las partes con letra: mejor una inicial pobre que un cuadrado en blanco.
 */
export function initialsOf(nombre: string): string {
  const partes = nombre.split(/\s+/).filter((parte) => /^[\p{L}(]/u.test(parte));
  const sinTratamiento = partes.filter((parte) => !TREATMENTS.has(withoutAdornments(parte)));
  const elegidas = sinTratamiento.length > 0 ? sinTratamiento : partes;

  return elegidas
    .slice(0, 2)
    .map((parte) => withoutAdornments(parte)[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Las iniciales de una **persona**: primer nombre y primer apellido.
 *
 * El nombre compuesto del backend es `nombre [segundo nombre] apellido
 * [apellido materno]` y no trae las partes por separado, así que se deduce por
 * la cantidad de palabras (sin contar el tratamiento):
 *
 * - 1 palabra → una inicial.
 * - 2 o 3 palabras → la primera y la segunda («Danny Dávila» → `DD`).
 * - 4 o más → la primera y la tercera («Danny Marcelo Dávila Barrancos» → `DD`).
 *
 * Con tres palabras es una suposición —«Ana Pérez Quiroga» da `AP`, pero «Ana
 * Lucía Pérez» daría `AL`—; con las partes a mano hay que usarlas en vez de esto.
 *
 * El avatar del encabezado y el del perfil usan **esta** función, para que
 * muestren las mismas dos letras (pedido del 01/11/2026).
 */
export function personInitials(nombre: string): string {
  const partes = nombre.split(/\s+/).filter((parte) => /^[\p{L}(]/u.test(parte));
  const sinTratamiento = partes.filter((parte) => !TREATMENTS.has(withoutAdornments(parte)));
  const palabras = sinTratamiento.length > 0 ? sinTratamiento : partes;

  const apellido = palabras.length >= 4 ? palabras[2] : palabras[1];
  return [palabras[0], apellido]
    .map((parte) => (parte === undefined ? '' : ([...withoutAdornments(parte)][0] ?? '').toUpperCase()))
    .join('');
}
