/* ============================================================================
    El nombre original de un archivo, leído de la cabecera `Content-Disposition`.

    ## Por qué existe y no se pide a un endpoint

    Porque el nombre **ya viaja** en la respuesta que la aplicación pide de
    todos modos para mostrar el archivo: `GET /common/files/:id/content` emite
    `Content-Disposition: attachment; filename*=UTF-8''<nombre>` cuando el
    archivo tiene `original_name`. Añadir un endpoint de metadata para volver a
    preguntar algo que ya está en la respuesta sería una petición de más por
    cada adjunto.

    ## Por qué es su propio archivo

    Porque parsear esta cabecera es un problema de formato, no de HTTP: tiene
    dos sintaxis (RFC 6266 `filename` y RFC 5987 `filename*`), la segunda
    percent-encodea el nombre, y el valor lo escribió el servidor a partir de
    algo que subió una persona. Aislarlo permite probar los casos raros —sin
    extensión, Unicode, malformado, ausente— sin levantar un `HttpClient`.

    ## La regla que no se negocia

    **Ante la duda, no hay nombre.** Esta función devuelve `undefined` y quien
    llama muestra su propio texto de reserva. Nunca inventa un nombre ni
    devuelve a medias lo que no pudo decodificar: un nombre inventado en una
    pantalla clínica es peor que no mostrar ninguno.
   ========================================================================== */

/**
 * `filename*=UTF-8''algo%20con%20espacios` (RFC 5987).
 *
 * Es la forma que emite esta API, y la única que transporta Unicode sin
 * ambigüedad. El juego de caracteres se captura para rechazar lo que no sea
 * UTF-8: `decodeURIComponent` sólo sabe deshacer ese.
 */
const EXTENDED = /filename\*\s*=\s*([A-Za-z0-9!#$%&+\-^_`{}~]+)'([^']*)'([^;]+)/i;

/** `filename="algo"` o `filename=algo` (RFC 6266), la forma heredada. */
const PLAIN = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i;

/**
 * Caracteres que jamás pueden formar parte de un nombre de archivo servido.
 *
 * Van como escapes y no como bytes literales: escritos a pelo, el archivo
 * contiene un NUL y Git deja de tratarlo como texto —el fuente aparece como
 * `Bin 0 -> 4085 bytes` y no hay diff que revisar—.
 *
 * El `eslint-disable` sigue haciendo falta aunque estén escapados: la regla
 * mira qué caracteres entran en la clase, no cómo se escriben. Y tienen que
 * entrar: un `filename` con un salto de línea es un intento de inyectar una
 * cabecera, y con `/` o `\`, de escribir fuera de donde corresponde.
 */
// eslint-disable-next-line no-control-regex
const PELIGROSOS = /[\u0000-\u001f\u007f/\\]/;

/**
 * Limpia y valida un candidato a nombre.
 *
 * Recorta espacios, descarta lo vacío y rechaza cualquier cosa con separadores
 * de ruta o caracteres de control: un `filename` con `../` o con un salto de
 * línea no es un nombre, es un intento de escribir donde no corresponde.
 *
 * @param bruto - El valor tal como vino en la cabecera.
 * @returns El nombre utilizable, o `undefined` si no lo es.
 */
function saneado(bruto: string | undefined): string | undefined {
  if (bruto === undefined) return undefined;
  const limpio = bruto.trim();
  if (limpio === '' || limpio === '"' || PELIGROSOS.test(limpio)) {
    return undefined;
  }
  return limpio;
}

/**
 * El nombre original del archivo, si la cabecera lo trae de forma fiable.
 *
 * Se prefiere `filename*` sobre `filename` porque es la forma que preserva el
 * Unicode; si la extendida está pero no se puede decodificar, **no** se cae en
 * la heredada: una cabecera contradictoria es motivo para no confiar en
 * ninguna de las dos.
 *
 * @param header - El valor crudo de `Content-Disposition`, o `null` si la
 *   respuesta no la trae —que es lo que pasa hoy con el backend simulado y con
 *   cualquier archivo cuyo `original_name` sea `NULL`—.
 * @returns El nombre, o `undefined` para que quien llama use su reserva.
 */
export function nombreDeContentDisposition(
  header: string | null | undefined,
): string | undefined {
  if (!header) return undefined;

  const extendida = EXTENDED.exec(header);
  if (extendida) {
    const [, charset, , valor] = extendida;
    if (charset.toLowerCase() !== 'utf-8') return undefined;
    try {
      return saneado(decodeURIComponent(valor));
    } catch {
      // `decodeURIComponent` revienta con un `%` suelto o una secuencia
      // incompleta. Es exactamente el caso «malformado»: reserva, no adivinanza.
      return undefined;
    }
  }

  const plana = PLAIN.exec(header);
  if (plana) return saneado(plana[1] ?? plana[2]);

  return undefined;
}
