export function esVacio(valor: unknown): boolean {
  return (
    valor === undefined ||
    valor === null ||
    valor === '' ||
    // Un odontograma sin ninguna pieza tocada es un mapa vacío: es «no lo
    // llené», no un dato. Sin esto viajaría un `{}` y contaría como respuesta.
    (esMapa(valor) && Object.keys(valor).length === 0) ||
    // Una lista de varias respuestas sin ninguna marcada tampoco es un dato.
    (Array.isArray(valor) && valor.length === 0)
  );
}

/** Si el valor es un objeto plano —el mapa del odontograma, hoy—. */
export function esMapa(valor: unknown): valor is Record<string, unknown> {
  return (
    typeof valor === 'object' && valor !== null && !(valor instanceof Date) && !Array.isArray(valor)
  );
}
