import type {
  DiagnosticOrder,
  DiagnosticReport,
  PatientDiagnostics,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { OrderReferral } from '../../../../core/data-access/diagnostics/order-referral.types';

/**
 * Las prioridades en castellano, por código estable.
 *
 * El catálogo trae su `display` en inglés técnico porque es terminología, no
 * copy de producto, y mapear por **código** —no por uuid— es lo que permite
 * traducir sin atarse a un identificador que un re-seed puede mover.
 */
export const PRIORITY_LABELS: Readonly<Record<string, string>> = {
  SR_ROUTINE: 'De rutina',
};

/**
 * Antiduplicación de estudios (v4.2.17, T-26): la ventana que aplicó el
 * detector cuando el 422 de la carrera check→alta no la informa de vuelta.
 * Es el mismo default que fija `DuplicateStudyDetector` del lado del
 * servidor — sólo se usa acá para reconstruir el diálogo, nunca para decidir.
 */
export const DEFAULT_DUPLICATE_STUDY_WINDOW_DAYS = 30;

/** Una orden del histórico, ya sin uuid y con su estado resuelto. */
export interface EstudioEnFicha {
  readonly id: string;
  /** Qué se pidió, en palabras. Nunca el uuid del concepto. */
  readonly estudio: string;
  /** A quién va: laboratorio, imagen, cardiología, patología, procedimiento u otro. */
  readonly categoria: string;
  readonly estado: string;
  readonly pedidoEl: Date;
  /** Si ya hay un informe liberado que cuelgue de esta orden. */
  readonly conResultado: boolean;
  /**
   * Antiduplicación de estudios (v4.2.17): `'reused'` si la orden nació
   * satisfecha por un informe previo (no se llegó a pedir de nuevo),
   * `'repeated'` si se repitió con justificación clínica, o `null` en
   * cualquier otro caso. Gobierna qué línea reemplaza a «Sin resultado
   * todavía» / «Resultado listo» en el histórico.
   */
  readonly duplicado: 'reused' | 'repeated' | null;
  /** La fecha del informe previo. Sólo presente cuando `duplicado === 'reused'`. */
  readonly informePrevioDel: Date | null;
  /** La justificación clínica guardada al repetir el estudio (v4.2.47); `null` si no hubo. */
  readonly justificacion: string | null;
  /** F5b: el punto de toma sugerido, «LAB-TM1 · Toma de muestras 1»; `null` sin sugerencia. */
  readonly collectionPoint: string | null;
  /** La consulta en la que se pidió, si la orden la trae. Ata su consentimiento informado. */
  readonly encounterId?: string;
  /** Only laboratory and imaging orders can be referred to a center. */
  readonly category?: DiagnosticOrder['category'];
  /** Code of the order status (not its label): what tells whether it is still open. */
  readonly statusCode: string;
  /** The referral to a center and what the patient decided; `null` = never referred. */
  readonly referral: OrderReferral | null;
}

/**
 * Cómo nació la orden respecto de la antiduplicación: con justificación guardada
 * es una repetición (sobre un informe previo o sobre una orden activa sin
 * informe, v4.2.47); con informe previo y sin justificación, reutilizó el informe.
 */
export function duplicadoDe(orden: DiagnosticOrder): EstudioEnFicha['duplicado'] {
  if (orden.duplicateOverrideReason !== undefined) {
    return 'repeated';
  }
  return orden.previousDiagnosticReportId === undefined ? null : 'reused';
}

/**
 * Los conceptos que el histórico necesita traducir.
 *
 * Se juntan de los dos bloques en una sola lista porque `readConceptLabels` ya
 * deduplica y trocea: dos llamadas separadas pedirían dos veces los códigos que
 * la orden y su informe comparten.
 */
export function conceptosDe(circuito: PatientDiagnostics): readonly string[] {
  const ids: string[] = [];
  for (const orden of circuito.orders) {
    ids.push(orden.codeConceptId, orden.statusConceptId);
    if (orden.categoryConceptId !== undefined) {
      ids.push(orden.categoryConceptId);
    }
  }
  for (const informe of circuito.reports) {
    ids.push(informe.codeConceptId, informe.lifecycleStatusConceptId);
  }
  return ids;
}

/**
 * El toast de éxito, según qué decisión de antiduplicación se mandó (o
 * ninguna). Devuelve `[mensaje, título]`, el orden que espera
 * `ToastService.success`.
 */
export function mensajeDeAlta(decision: {
  readonly reusePreviousReport?: true;
  readonly duplicateOverrideReason?: string;
}): readonly [string, string] {
  if (decision.reusePreviousReport === true) {
    return [
      'Quedó registrado como cubierto por el informe previo. No se pide un estudio nuevo.',
      'Antiduplicación',
    ];
  }
  if (decision.duplicateOverrideReason !== undefined) {
    return ['Queda pedido con su justificación; la aseguradora la va a ver.', 'Estudio solicitado'];
  }
  return ['Queda pedido y va a verlo acá abajo con su resultado.', 'Estudio solicitado'];
}

const NO_DATA = '—';

/** An order translated to the row the chart shows. */
export function toStudyRow(
  orden: DiagnosticOrder,
  conResultado: ReadonlySet<string>,
  informesPorId: ReadonlyMap<string, DiagnosticReport>,
  labels: ReadonlyMap<string, { readonly display?: string; readonly code?: string }>,
): EstudioEnFicha {
  const duplicado = duplicadoDe(orden);
  const label = (id: string | undefined): string => (id === undefined ? NO_DATA : (labels.get(id)?.display ?? NO_DATA));
  return {
    id: orden.id,
    estudio: label(orden.codeConceptId),
    categoria: label(orden.categoryConceptId),
    estado: label(orden.statusConceptId),
    pedidoEl: orden.createdAt,
    conResultado: conResultado.has(orden.id),
    duplicado,
    informePrevioDel:
      duplicado === 'reused' && orden.previousDiagnosticReportId !== undefined
        ? (informesPorId.get(orden.previousDiagnosticReportId)?.createdAt ?? null)
        : null,
    justificacion: orden.duplicateOverrideReason ?? null,
    collectionPoint: orden.suggestedCareSpace ? `${orden.suggestedCareSpace.code} · ${orden.suggestedCareSpace.name}` : null,
    ...(orden.encounterId === undefined ? {} : { encounterId: orden.encounterId }),
    category: orden.category,
    statusCode: labels.get(orden.statusConceptId)?.code ?? '',
    referral: orden.referral ?? null,
  };
}
