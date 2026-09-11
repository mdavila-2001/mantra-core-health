import type { ViewState } from '../../../core/view-state/view-state.types';

/**
 * El fallo de un alta del expediente, en palabras — **los nueve estados, no
 * tres**.
 *
 * ## Por qué existe
 *
 * Los bloques de alta traían cada uno su propio `computed` de error, todos con
 * la misma forma: mirar `validation`, mirar si hay `message`, y devolver `null`
 * en cualquier otro caso. Ese `null` es un agujero: `errorToViewState` traduce
 * una petición que nunca llegó a `offline`, y `offline` no tiene `message`.
 * Resultado —lo encontró la prueba de la subida caída del documento—: el
 * formulario se desbloqueaba, no se guardaba nada y **no se decía nada**.
 *
 * Acá se cubren los cinco estados en los que una escritura puede terminar mal.
 * `stale` y `empty` no aplican a una escritura: no hay dato viejo que refrescar
 * ni lista vacía que llenar.
 *
 * @param estado - Lo que devolvió `errorToViewState` sobre la escritura.
 * @param queNoSePudo - La acción en infinitivo: «registrar la observación».
 * @returns El mensaje, o `null` si la escritura no falló.
 */
export function mensajeDeEscritura(estado: ViewState<null>, queNoSePudo: string): string | null {
  const generico = `No pudimos ${queNoSePudo}.`;
  switch (estado.status) {
    case 'validation':
      // El primero y no todos: los demás son del mismo envío y se corrigen
      // igual, y una lista dentro de un aviso se lee como un bloque de texto.
      return estado.issues[0]?.message ?? generico;
    case 'forbidden':
      return estado.message ?? `Tu rol no permite ${queNoSePudo}.`;
    case 'not-found':
      // Sin detalle del recurso a propósito: S6 no confirma que exista.
      return 'El registro ya no está disponible. Recargá la pantalla.';
    case 'offline':
      // No falló el servidor: la petición no llegó, así que reintentar sirve.
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    case 'error':
      // El identificador de petición es obligatorio en S9: sin él, quien
      // reporta el problema y quien lo busca en los registros no se encuentran.
      return `${estado.message || generico} (${estado.requestId})`;
    default:
      return null;
  }
}
