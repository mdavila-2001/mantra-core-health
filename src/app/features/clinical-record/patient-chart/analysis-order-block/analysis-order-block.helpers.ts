import type {
  DiagnosticOrder,
  PatientDiagnostics,
} from '../../../../core/data-access/diagnostics/diagnostics.types';

/** Una orden del histórico, ya sin uuid y con su estado resuelto. */
export interface EstudioEnFicha {
  readonly id: string;
  /** Qué se pidió, en palabras. Nunca el uuid del concepto. */
  readonly estudio: string;
  /** Laboratorio o imagenología. */
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
