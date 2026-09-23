import type { WorkflowStatus } from '../../../core/data-access/accounting/accounting.types';

/* ============================================================================
    El flujo del documento contable, dicho en castellano.

    Los seis estados y las cinco transiciones son los de la API
    (`accounting.concepts.ts`, `ACCT_TXN_*`): no hay más caminos ni atajos, y el
    backend rechaza con 422 cualquier salto. Este archivo sólo les pone nombre,
    tono y el rótulo del botón que corresponde, para que la pantalla no repita
    esa tabla en cada plantilla.

    Por qué importa el orden: un asiento **no existe para el mayor** hasta que
    llega a POSTED. Los cinco estados anteriores son trabajo en curso, y los
    saldos no se enteran de ellos. Por eso la bandeja los muestra en secuencia
    —se lee dónde se frenó algo— y no por fecha.
    ========================================================================== */

/** Cómo se llama cada estado para quien lleva los libros. */
export const ETIQUETA_DE_ESTADO: Readonly<Record<WorkflowStatus, string>> = {
  DRAFT: 'Borrador',
  AUTO_CLASSIFIED: 'Clasificado',
  PENDING_REVIEW: 'En revisión',
  APPROVED: 'Aprobado',
  POSTED: 'Posteado',
  REVERSED: 'Revertido',
};

/**
 * El tono del sello de estado.
 *
 * `POSTED` es el único en verde: es el único que significa «esto ya está en los
 * libros». `REVERSED` va en gris y no en rojo — revertir no es un error, es el
 * procedimiento correcto para corregir algo posteado.
 */
export const TONO_DEL_ESTADO: Readonly<Record<WorkflowStatus, 'info' | 'warning' | 'success' | 'secondary'>> = {
  DRAFT: 'secondary',
  AUTO_CLASSIFIED: 'info',
  PENDING_REVIEW: 'warning',
  APPROVED: 'info',
  POSTED: 'success',
  REVERSED: 'secondary',
};

/** La acción que saca a un documento de su estado, si hay alguna. */
export interface AccionDisponible {
  /** El verbo de la API: es el segmento de la ruta. */
  readonly action: string;
  /** Lo que dice el botón. */
  readonly rotulo: string;
  /** Lo que se anuncia cuando salió bien. */
  readonly hecho: string;
  /** Una acción que mueve dinero en el mayor se ve distinta. */
  readonly principal: boolean;
}

export const ACCION_DEL_ESTADO: Readonly<Record<WorkflowStatus, AccionDisponible | null>> = {
  DRAFT: { action: 'classify', rotulo: 'Clasificar', hecho: 'Clasificado', principal: false },
  AUTO_CLASSIFIED: {
    action: 'submit-review',
    rotulo: 'Enviar a revisión',
    hecho: 'Enviado a revisión',
    principal: false,
  },
  PENDING_REVIEW: { action: 'approve', rotulo: 'Aprobar', hecho: 'Aprobado', principal: false },
  // Postear es lo único que toca los saldos: es la acción principal del flujo.
  APPROVED: { action: 'post', rotulo: 'Postear', hecho: 'Posteado en el mayor', principal: true },
  // Un posteado no se edita nunca; se revierte con su espejo.
  POSTED: { action: 'reverse', rotulo: 'Revertir', hecho: 'Revertido', principal: false },
  REVERSED: null,
};
