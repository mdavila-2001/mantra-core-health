import { HttpErrorResponse } from '@angular/common/http';

import { readApiError, type ApiErrorBody } from './api-error';

/**
 * Qué pasó, por qué y qué hacer, para un fallo **sin** explicación de negocio.
 *
 * ## Por qué existe
 *
 * Los textos de los estados S8/S9 y de los toasts de escritura decían
 * «Algo salió mal» o «No se pudo guardar» y nada más: la persona no sabía si
 * el problema era su conexión, sus datos o el servidor, ni si convenía
 * reintentar ya, esperar o avisar a alguien.
 *
 * ## Lo que NO entra (seguridad)
 *
 * Cada texto de este catálogo es **fijo** y se elige por la categoría del
 * fallo (sin red, tiempo agotado, límite de tasa, servicio caído, error del
 * servidor…). Nunca se arma con lo que trae la respuesta: ni el `message` de
 * un 5xx, ni `details`, ni la URL, ni el `statusText`, ni el número de estado,
 * ni la traza. Lo único variable que se muestra en pantalla es el código de
 * soporte, que es opaco y sólo sirve a quien tiene acceso a los registros.
 * El `message` de la API se sigue usando donde ya se usaba: los códigos de
 * `MESSAGE_FOR_PEOPLE` (`api-failure.ts`), escritos para la persona.
 */
export interface ErrorExplanation {
  /** La categoría, para pruebas y para quien quiera ramificar sin leer texto. */
  readonly kind: ErrorKind;
  /** Qué pasó, en una línea: el título del aviso. */
  readonly title: string;
  /** Por qué, en lenguaje simple y sin datos técnicos. */
  readonly cause: string;
  /** Qué puede hacer la persona ahora. */
  readonly action: string;
  /**
   * Causa y acción en una frase, para sumar al texto de un toast sin repetir
   * lo que la pantalla ya dice («No se pudo guardar. Intente de nuevo.»).
   */
  readonly brief: string;
}

export type ErrorKind =
  | 'offline'
  | 'timeout'
  | 'session-expired'
  | 'too-large'
  | 'rate-limited'
  | 'unavailable'
  | 'server'
  | 'rejected'
  | 'client';

const EXPLANATIONS: Readonly<Record<ErrorKind, ErrorExplanation>> = {
  offline: {
    kind: 'offline',
    title: 'Sin conexión con el servidor',
    cause: 'La solicitud no llegó al servidor: su equipo perdió la conexión a internet o la red en la que está bloquea el acceso.',
    action: 'Revise el wifi, los datos móviles o la VPN y vuelva a intentarlo.',
    brief: 'Su equipo no tiene conexión con el servidor; revise la red.',
  },
  timeout: {
    kind: 'timeout',
    title: 'El servidor tardó demasiado en responder',
    cause: 'La operación no terminó dentro del tiempo de espera, por una conexión lenta o porque el servidor está muy ocupado.',
    action: 'Si estaba guardando algo, actualice la pantalla para confirmar si quedó registrado antes de repetirlo.',
    brief: 'El servidor tardó demasiado en responder; actualice para ver si quedó registrado antes de repetirlo.',
  },
  'session-expired': {
    kind: 'session-expired',
    title: 'Su sesión terminó',
    cause: 'Por seguridad, las sesiones vencen después de un tiempo.',
    action: 'Vuelva a ingresar para continuar.',
    brief: 'Su sesión venció; vuelva a ingresar.',
  },
  'too-large': {
    kind: 'too-large',
    title: 'El envío supera el tamaño permitido',
    cause: 'El archivo o los datos enviados son más grandes de lo que el sistema acepta en una sola operación.',
    action: 'Reduzca el tamaño del archivo o divida la carga en partes y vuelva a intentarlo.',
    brief: 'El envío supera el tamaño permitido; reduzca el archivo o divídalo.',
  },
  'rate-limited': {
    kind: 'rate-limited',
    title: 'Demasiados intentos seguidos',
    cause: 'Por protección, el sistema pausa por un momento las solicitudes repetidas.',
    action: 'Espere unos segundos y vuelva a intentarlo.',
    brief: 'Hubo demasiados intentos seguidos; espere unos segundos.',
  },
  unavailable: {
    kind: 'unavailable',
    title: 'El servicio no está disponible en este momento',
    cause: 'Uno de los servicios que necesita esta operación no responde o está en mantenimiento. No es un problema de sus datos.',
    action: 'Intente de nuevo en unos minutos.',
    brief: 'Un servicio necesario no está disponible ahora; intente en unos minutos.',
  },
  server: {
    kind: 'server',
    title: 'No pudimos completar la operación',
    cause: 'El servidor encontró un problema inesperado al procesarla. El fallo no está en lo que usted ingresó.',
    action: 'Intente de nuevo en unos segundos. Si vuelve a pasar, comparta el código de soporte con el equipo de ayuda: con él se encuentra el detalle.',
    brief: 'El problema fue del servidor, no de lo que usted ingresó.',
  },
  rejected: {
    kind: 'rejected',
    title: 'La solicitud no pudo procesarse',
    cause: 'El servidor no aceptó la solicitud tal como se envió.',
    action: 'Actualice la pantalla y vuelva a intentarlo. Si se repite, comparta el código de soporte con el equipo de ayuda.',
    brief: 'El servidor no aceptó la solicitud tal como se envió.',
  },
  client: {
    kind: 'client',
    title: 'Esta pantalla tuvo un problema',
    cause: 'El fallo ocurrió en el navegador al procesar la información, no en el servidor.',
    action: 'Recargue la página. Si se repite, avise al equipo de ayuda.',
    brief: 'Hubo un fallo en esta pantalla; recargue la página.',
  },
};

/** La explicación fija de una categoría. */
export function explanationOf(kind: ErrorKind): ErrorExplanation {
  return EXPLANATIONS[kind];
}

/**
 * `true` si el `HttpErrorResponse` de estado 0 es el límite de espera de
 * `timeoutInterceptor` y no una caída de red. Los dos llegan como estado 0
 * (ninguno trae respuesta), pero para la persona son cosas distintas: en uno
 * la petición nunca salió; en el otro pudo haberse completado igual.
 */
export function isTimeout(error: HttpErrorResponse): boolean {
  return error.status === 0 && error.statusText === 'Timeout';
}

/**
 * Clasifica un fallo en una categoría con explicación fija.
 *
 * Decide primero por `code` (el contrato), y sólo si la respuesta no lo trae
 * —un proxy, un balanceador— por el estado HTTP. Los fallos que ya tienen su
 * propio estado y texto (validación, 403, 404, conflicto) devuelven `rejected`
 * como reserva: quien llama los atiende antes.
 */
export function classifyFailure(error: unknown, body: ApiErrorBody | null = null): ErrorKind {
  if (!(error instanceof HttpErrorResponse)) {
    return 'client';
  }
  if (error.status === 0) {
    return isTimeout(error) ? 'timeout' : 'offline';
  }

  const code = (body ?? readApiError(error))?.code;
  switch (code) {
    case 'UNAUTHENTICATED':
      return 'session-expired';
    case 'PAYLOAD_TOO_LARGE':
      return 'too-large';
    case 'RATE_LIMITED':
      return 'rate-limited';
    case 'DEPENDENCY_UNAVAILABLE':
      return 'unavailable';
    case 'INTERNAL':
      return 'server';
    case undefined:
      break;
    default:
      return 'rejected';
  }

  // Sin el contrato: lo único confiable es el estado.
  if (error.status === 401) return 'session-expired';
  if (error.status === 408 || error.status === 504) return 'timeout';
  if (error.status === 413) return 'too-large';
  if (error.status === 429) return 'rate-limited';
  if (error.status === 502 || error.status === 503) return 'unavailable';
  if (error.status >= 500) return 'server';
  return 'rejected';
}

/** Atajo: clasifica y devuelve la explicación. */
export function explainFailure(error: unknown, body: ApiErrorBody | null = null): ErrorExplanation {
  return explanationOf(classifyFailure(error, body));
}
