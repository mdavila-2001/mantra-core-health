import { HttpErrorResponse } from '@angular/common/http';

import { errorToViewState } from '../../../../core/http/error-to-view-state';

/** Qué estaba haciendo la pantalla cuando falló: cambia qué se le puede pedir a la persona. */
export type ContextoDeFallo = 'practicas' | 'arancel' | 'importar-uno' | 'importar-lote';

/** Un fallo ya traducido a lo que se le dice a la persona: qué pasó y qué hacer. */
export interface Fallo {
  readonly titulo: string;
  /** Incluye siempre la próxima acción. */
  readonly mensaje: string;
  /** El identificador que conecta el reporte con los registros del servidor (S9). */
  readonly idDePeticion?: string;
  /** Una acción con ruta, cuando la hay (p. ej. verificar la identidad). */
  readonly accion?: { readonly label: string; readonly route: string };
}

const SIN_PERMISO: Readonly<Record<ContextoDeFallo, string>> = {
  practicas:
    'No tiene permiso para ver las prácticas de la organización. Pídale acceso a quien administre la organización.',
  arancel:
    'No tiene permiso para ver el arancel. Pídale acceso a quien administre la organización.',
  'importar-uno':
    'Dar de alta servicios exige permiso de administración. Pídale a quien administre la organización que lo haga o que te lo otorgue.',
  'importar-lote':
    'Importar al catálogo exige permiso de administración. Pídale a quien administre la organización que lo haga o que te lo otorgue.',
};

const NO_ENCONTRADO: Readonly<Record<ContextoDeFallo, string>> = {
  practicas:
    'No encontramos las prácticas de su organización. Recargue la página; si sigue igual, avise a soporte.',
  arancel: 'No encontramos el arancel. Recargue la página; si sigue igual, avise a soporte.',
  'importar-uno':
    'La práctica elegida ya no existe o no tiene acceso a ella. Elija otra práctica o recargue la página.',
  'importar-lote':
    'La práctica elegida ya no existe o no tiene acceso a ella. Elija otra práctica o recargue la página.',
};

const TITULO: Readonly<Record<ContextoDeFallo, string>> = {
  practicas: 'No pudimos cargar sus prácticas',
  arancel: 'No pudimos cargar el arancel',
  'importar-uno': 'No pudimos importarlo',
  'importar-lote': 'No pudimos importar el lote',
};

/**
 * Traduce un fallo de HTTP a algo que se pueda leer y actuar.
 *
 * Sale de `errorToViewState` —que ramifica por `error.code` del contrato— y, si
 * la respuesta no trae el cuerpo de la API (un proxy, un 502), cae al **estado
 * HTTP**: un 403 sin cuerpo sigue siendo un 403 para la persona.
 *
 * Distingue sin conexión, sin permiso (403), no encontrado (404), pedido
 * inválido (400) y el resto. Nunca devuelve «exige permiso de administración»
 * para un fallo que no es de permiso.
 *
 * @param error - Lo que emitió el `Observable` al fallar.
 * @param contexto - Qué se estaba haciendo.
 */
export function describirFallo(error: unknown, contexto: ContextoDeFallo): Fallo {
  const titulo = TITULO[contexto];
  const estado = errorToViewState<null>(error);
  const status = error instanceof HttpErrorResponse ? error.status : null;

  if (status === 0 || estado.status === 'offline') {
    return {
      titulo: 'Sin conexión',
      mensaje:
        'No pudimos comunicarnos con el servidor. Revise su conexión y vuelva a intentarlo.',
    };
  }

  if (estado.status === 'forbidden' && estado.nextAction?.route !== undefined) {
    return {
      titulo,
      mensaje: estado.message ?? 'Necesita verificar su identidad para continuar.',
      accion: { label: estado.nextAction.label, route: estado.nextAction.route },
    };
  }

  if (status === 403 || estado.status === 'forbidden') {
    return { titulo, mensaje: SIN_PERMISO[contexto] };
  }

  if (status === 404 || estado.status === 'not-found') {
    return { titulo, mensaje: NO_ENCONTRADO[contexto] };
  }

  if (estado.status === 'validation' && estado.retryAfterSeconds !== undefined) {
    return {
      titulo: 'Demasiados pedidos seguidos',
      mensaje: `Espere ${estado.retryAfterSeconds} segundos y vuelva a intentarlo.`,
    };
  }

  if (estado.status === 'validation' || status === 400) {
    const detalle =
      estado.status === 'validation'
        ? estado.issues
            .map((i) => i.message)
            .filter((m) => m !== '')
            .slice(0, 3)
            .join(' ')
            .replace(/([^.!?])$/, '$1.')
        : '';
    return {
      titulo,
      mensaje:
        `El servidor rechazó el pedido${detalle === '' ? '.' : `: ${detalle}`} ` +
        'Revise el filtro y la práctica elegidos y vuelva a intentarlo.',
    };
  }

  return {
    titulo,
    mensaje:
      'Ocurrió un error inesperado. Vuelva a intentarlo en unos minutos; si sigue pasando, avise a soporte con este código.',
    ...(estado.status === 'error' && estado.requestId !== 'sin-id'
      ? { idDePeticion: estado.requestId }
      : {}),
  };
}
