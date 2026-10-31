import type {
  ServiceRequestComponent,
  ServiceRequestImaging,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { CardDetailRow } from '../card-detail-panel/card-detail-panel.types';

/** Lo que se dice cuando se pidió el estudio entero y no se marcó ningún componente. */
export const FULL_STUDY_TEXT = 'Estudio completo, sin detalle';

/** Lo mínimo que {@link studyDetailRows} necesita; todo opcional como en la API. */
export interface StudyDetailInput {
  readonly specimen?: string | null;
  readonly components?: readonly ServiceRequestComponent[] | null;
  /** `false` = «estudio completo, sin detalle», no «ningún componente». */
  readonly componentsSpecified?: boolean;
  readonly imaging?: ServiceRequestImaging | null;
}

/** Los componentes en el orden en que se marcaron, separados por coma. */
export function componentsText(components: readonly ServiceRequestComponent[]): string {
  return [...components]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((component) => component.display)
    .join(', ');
}

/**
 * Las filas del panel de detalle: muestra, componentes (o «estudio completo»)
 * y, en imagenología, modalidad · región · lateralidad · contraste. Una fila
 * sin valor no se construye.
 */
export function studyDetailRows(input: StudyDetailInput): readonly CardDetailRow[] {
  const rows: CardDetailRow[] = [];
  const push = (label: string, value: string | null | undefined): void => {
    if (value !== null && value !== undefined && value.trim() !== '') rows.push({ label, value });
  };
  const imaging = input.imaging ?? null;
  const components = input.components ?? [];

  push('Muestra', input.specimen);
  if (imaging === null) {
    if (components.length > 0) {
      push(
        components.length === 1
          ? 'Componente pedido'
          : `Componentes pedidos (${components.length})`,
        componentsText(components),
      );
    } else if (input.componentsSpecified === false) {
      push('Componentes', FULL_STUDY_TEXT);
    }
  } else {
    push('Modalidad', imaging.modalityDisplay);
    push('Región', imaging.bodySiteDisplay);
    push('Lateralidad', imaging.lateralityDisplay);
    push('Contraste', imaging.contrastDisplay);
  }
  return rows;
}
