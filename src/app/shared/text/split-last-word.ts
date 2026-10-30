/* ============================================================================
    Un nombre partido en «todo menos la última palabra» y «la última palabra».

    Sirve para que un adorno que va pegado al final de un nombre (la insignia de
    verificación) viaje con la última palabra y no quede solo en una línea
    aparte cuando el nombre se parte en una pantalla angosta. La cola va en un
    `white-space: nowrap`; la cabeza se parte donde quiera.
    ========================================================================== */

export interface SplitName {
  /** Todo menos la última palabra, con su espacio final si lo hay. */
  readonly head: string;
  /** La última palabra, o el nombre entero si es una sola. */
  readonly tail: string;
}

export function splitLastWord(name: string | null | undefined): SplitName {
  const text = (name ?? '').trim();
  const cut = text.lastIndexOf(' ');
  return cut < 0 ? { head: '', tail: text } : { head: text.slice(0, cut + 1), tail: text.slice(cut + 1) };
}
