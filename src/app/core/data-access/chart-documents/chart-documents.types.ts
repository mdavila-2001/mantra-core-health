/* ============================================================================
    El documento del expediente: el papel que alguien trajo, o el que la
    consulta emitió.

    Es la pieza que hace que un estudio de fuera del sistema —el laboratorio de
    la esquina, la placa del hospital público— tenga un lugar en la historia sin
    tener que inventarle una observación ni una nota.
   ========================================================================== */

/** El papel que cumple un archivo dentro del documento. */
export type DocumentFileRole = 'PRIMARY' | 'ATTACHMENT';

/** Un archivo gobernado del documento (UC-15-09). Ya subido a `common.files`. */
export interface NewDocumentFile {
  readonly fileId: string;
  /** `PRIMARY` es el documento en sí; `ATTACHMENT`, lo que lo acompaña. */
  readonly contentRole?: DocumentFileRole;
  /** El orden dentro del documento, desde 0. */
  readonly ordinal?: number;
}

/**
 * Lo que hace falta para registrar un documento (`POST /charts/documents`).
 *
 * ## `tenantId` es del contrato, no una decisión de la pantalla
 *
 * Es obligatorio en el DTO: un documento del expediente queda bajo la custodia
 * de una organización, que es quien responde por él. Sin organización activa no
 * se puede registrar, y el formulario lo dice antes de pedir nada.
 *
 * ## Los archivos no se suben acá
 *
 * `files` recibe identificadores de archivos **ya subidos** por
 * `POST /common/files/upload`. El alta registra el documento; adjuntarle el PDF
 * es el paso siguiente y usa la misma cola de siempre.
 */
export interface NewChartDocument {
  readonly patientProfileId: string;
  readonly tenantId: string;
  /** El título. Lo único que el DTO exige además de los dos identificadores. */
  readonly title: string;
  readonly encounterId?: string;
  readonly categoryConceptId?: string;
  readonly sourceConceptId?: string;
  readonly confidentialityConceptId?: string;
  readonly patientVisibilityConceptId?: string;
  /** Quién lo firma, cuando viene de afuera y no hay perfil que citar. */
  readonly authorText?: string;
  /** `true` si el papel viene de fuera de esta organización. */
  readonly isExternal?: boolean;
  readonly files?: readonly NewDocumentFile[];
}

/** El documento recién registrado. */
export interface ChartDocumentRegistration {
  readonly id: string;
  readonly statusConceptId: string;
  /** Cuántos archivos quedaron ligados. */
  readonly fileCount: number;
  readonly createdAt: Date;
}
