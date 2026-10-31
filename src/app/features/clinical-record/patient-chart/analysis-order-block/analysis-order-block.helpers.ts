import type {
  DiagnosticOrder,
  PatientDiagnostics,
} from '../../../../core/data-access/diagnostics/diagnostics.types';

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
  /**
   * Lo pedido con precisión: componentes marcados (laboratorio) o modalidad,
   * región, lado y contraste (imagen). `null` en una orden sin detalle.
   */
  readonly detalle: string | null;
  /** La consulta en la que se pidió, si la orden la trae. Ata su consentimiento informado. */
  readonly encounterId?: string;
}

/** Cuántos componentes se nombran en la línea de detalle antes de resumir. */
const COMPONENTES_VISIBLES = 4;

/**
 * La línea de detalle de una orden: «Hemoglobina, Hematocrito y 1 más · Muestra:
 * Sangre venosa» o «Radiografía · Mano · Izquierda · Sin contraste».
 *
 * Una orden vieja (`componentsSpecified: false`) es «estudio completo, sin
 * detalle»: no se inventa nada y la línea no aparece.
 */
export function detalleDeLaOrden(orden: DiagnosticOrder): string | null {
  const partes: string[] = [];
  const componentes = [...(orden.components ?? [])].sort((a, b) => a.ordinal - b.ordinal);
  if (componentes.length > 0) {
    const nombres = componentes.slice(0, COMPONENTES_VISIBLES).map((c) => c.display);
    const resto = componentes.length - nombres.length;
    partes.push(resto > 0 ? `${nombres.join(', ')} y ${resto} más` : nombres.join(', '));
  }
  if (orden.specimenTypeDisplay) {
    partes.push(`Muestra: ${orden.specimenTypeDisplay}`);
  }
  const imagen = orden.imaging;
  if (imagen !== undefined && imagen !== null) {
    for (const parte of [
      imagen.modalityDisplay,
      imagen.bodySiteDisplay,
      imagen.lateralityDisplay,
      imagen.contrastDisplay,
    ]) {
      if (parte) partes.push(parte);
    }
  }
  return partes.length === 0 ? null : partes.join(' · ');
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
