import type { ViewState } from '../../core/view-state/view-state.types';

/**
 * Cómo se llama, en palabras, lo que la escritura no pudo hacer.
 *
 * Sólo `accion` es obligatoria. Los otros dos existen porque un 403 y un 404
 * dicen cosas distintas según el bloque —«tu rol no permite recetar» no es «tu
 * rol no permite dar de alta internaciones»— y porque un texto genérico en esos
 * dos casos deja a quien lo lee sin saber qué recargar.
 */
export interface TextosDelFallo {
  /** La acción en infinitivo: «registrar la alergia», «pedir estudios». */
  readonly accion: string;
  /** Qué decir en un 403. Sin él: «Tu rol no permite {accion}.» */
  readonly sinPermiso?: string;
  /** Qué decir en un 404. Sin él: el expediente ya no existe. */
  readonly yaNoExiste?: string;
}

/**
 * El fallo de una escritura clínica **que no es de validación**, en palabras.
 *
 * ## Por qué existe
 *
 * Siete bloques del expediente traían cada uno su propia cadena de `if` con los
 * mismos cuatro estados y las mismas cuatro frases. Copiada seis veces, una
 * cadena así garantiza dos cosas: que la séptima copia se escriba distinta, y
 * que la que salió mal no se note. Las dos pasaron —`allergy-block` se quedó en
 * tres ramas y devolvía `null` en `offline`, así que una petición que nunca
 * llegaba desbloqueaba el formulario **sin decir nada**—.
 *
 * ## La validación se queda en el bloque, a propósito
 *
 * Porque es lo único que **no** es igual entre bloques: el `409` del
 * diagnóstico duplicado es un aviso y no un error, el `422` de la receta
 * distingue la firma que falta de la indicación ajena, y el de la internación
 * apunta a la estancia ya abierta. Eso es lógica de dominio y vive donde está el
 * dominio. Lo que se comparte es la cola —permiso, ausencia, conexión, fallo
 * inesperado—, que es exactamente la parte que no tiene nada de clínica.
 *
 * @param estado - Lo que devolvió `errorToViewState` sobre la escritura.
 * @param textos - Cómo nombrar la acción y, si hace falta, el 403 y el 404.
 * @returns El mensaje, o `null` si el estado no es uno de esos cuatro fallos.
 */
export function mensajeDeFalloDeEscritura(
  estado: ViewState<null>,
  textos: TextosDelFallo,
): string | null {
  switch (estado.status) {
    case 'forbidden':
      // El del servidor gana **si dice algo**: nombra el permiso concreto que
      // faltó. Con `??` bastaba un `message: ''` —que es lo que manda el
      // backend cuando el 403 no trae detalle— para pintar un aviso en blanco:
      // un recuadro rojo vacío no es un mensaje, es un susto.
      return estado.message || textos.sinPermiso || `Tu rol no permite ${textos.accion}.`;
    case 'not-found':
      // Sin detalle del recurso a propósito: S6 no confirma que exista.
      return textos.yaNoExiste ?? 'El expediente ya no existe. Recargá la pantalla.';
    case 'offline':
      // No falló el servidor: la petición no llegó, así que reintentar sirve.
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    case 'error':
      // El identificador de petición es obligatorio en S9: sin él, quien
      // reporta el problema y quien lo busca en los registros no se encuentran.
      return `${estado.message || 'Ocurrió un error inesperado.'} (${estado.requestId})`;
    default:
      // `ready`, `loading` y los demás no son fallos. `stale` y `empty` no
      // aplican a una escritura: no hay dato viejo que refrescar ni lista
      // vacía que llenar.
      return null;
  }
}

/**
 * El fallo de una escritura clínica **con su validación**, para el bloque que
 * no le da a la validación ningún trato propio.
 *
 * Es {@link mensajeDeFalloDeEscritura} más la rama `validation` resuelta de la
 * forma corriente: el primer problema y no todos. Los demás son del mismo envío
 * y se corrigen igual, y una lista dentro de un aviso se lee como un bloque de
 * texto que se saltea.
 *
 * @param estado - Lo que devolvió `errorToViewState` sobre la escritura.
 * @param textos - Cómo nombrar la acción y, si hace falta, el 403 y el 404.
 * @returns El mensaje, o `null` si la escritura no falló.
 */
export function mensajeDeEscritura(
  estado: ViewState<null>,
  textos: TextosDelFallo,
): string | null {
  if (estado.status === 'validation') {
    return estado.issues[0]?.message ?? `No pudimos ${textos.accion}.`;
  }
  return mensajeDeFalloDeEscritura(estado, textos);
}
