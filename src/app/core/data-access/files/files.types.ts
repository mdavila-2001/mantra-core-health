/* ============================================================================
    Tipos de la vista para el subsistema de archivos (M02 `common`).

    Las categorías y sensibilidades son **uniones de texto y no uuid de
    concepto**, al revés que en casi todo el resto del sistema. No es una
    excepción nuestra: el contrato del backend las declara así
    (`FileCategory`/`FileSensitivity` en `common/dto/enums.ts`), porque son
    valores cerrados del propio subsistema y no catálogo de terminología.
    ========================================================================== */

/** A qué recurso pertenece un adjunto. */
export const OWNER_TYPES = [
  'USER',
  'PATIENT',
  'TENANT',
  'CONDITION',
  'PROCEDURE',
  // Los tres que el pedido de «adjuntos en todos los formularios» necesita. El
  // backend todavía no los declara en su `OwnerType` (P25): la maqueta los
  // sirve y contra la API real el vínculo responde 400 hasta que existan.
  'MEDICATION_REQUEST',
  'ALLERGY_INTOLERANCE',
  'ENCOUNTER',
] as const;

/**
 * El tipo de propietario de un adjunto.
 *
 * `file_links.owner_type_concept_id` es un concepto de terminología, no un
 * enum fijo de la base — cada valor nuevo (como `CONDITION`/`PROCEDURE`,
 * ALV-033) se agrega en código (`CONCEPTS.OWNER_*` del backend) y se siembra
 * solo al arrancar la API. **No hace falta tocar el `.puml` ni el repo de
 * modelo** para sumar un tipo de propietario nuevo; sólo para agregar una
 * columna o tabla, que es un caso distinto.
 */
export type OwnerType = (typeof OWNER_TYPES)[number];

/** Un archivo del sistema, tal como lo devuelve una lectura. */
export interface StoredFile {
  readonly id: string;
  readonly currentVersionId?: string;
  /** El nombre con el que se subió. Puede no venir. */
  readonly originalName?: string;
  readonly category: 'DOCUMENT' | 'IMAGE';
  readonly sensitivity: 'NORMAL' | 'PHI';
  readonly lifecycleStatusConceptId: string;
  readonly createdAt: Date;
}

/** Un archivo adjunto a un recurso: el vínculo y el archivo, juntos. */
export interface LinkedFile {
  /** Id del **vínculo**, no del archivo. Es lo que se borra al desadjuntar. */
  readonly linkId: string;
  readonly ownerId: string;
  readonly ownerType: OwnerType;
  /** Cuándo se adjuntó — que no es cuándo se subió el archivo. */
  readonly linkedAt: Date;
  readonly file: StoredFile;
}

/** Los adjuntos de un recurso. */
export interface LinkedFilePage {
  readonly items: readonly LinkedFile[];
  /**
   * Cuántos vinieron.
   *
   * **No es «cuántos hay».** La lectura tiene tope: si llega justo al tope,
   * puede haber más que no vinieron.
   */
  readonly count: number;
}

/** De qué recurso se piden los adjuntos. Los dos campos son obligatorios. */
export interface LinkedFilesQuery {
  readonly ownerType: OwnerType;
  readonly ownerId: string;
}

/** Lo que hace falta para adjuntar un archivo ya subido a un recurso. */
export interface NewFileLink {
  readonly ownerType: OwnerType;
  readonly ownerId: string;
  /**
   * Si el vínculo es de visibilidad restringida.
   *
   * El backend lo traduce a `VISIBILITY_INTERNAL` cuando es verdadero, y lo
   * deja sin declarar cuando no. Es del **vínculo**, no del archivo: el mismo
   * archivo puede estar adjunto en dos lados con visibilidades distintas.
   */
  readonly visibility?: boolean;
}

/** El vínculo recién creado. */
export interface FileLink {
  readonly id: string;
  readonly fileId: string;
  readonly ownerId: string;
  readonly ownerType: OwnerType;
  readonly createdAt: Date;
}

/**
 * Una URL de descarga de vida corta.
 *
 * Va firmada y vence: no se guarda ni se comparte, se pide en el momento de
 * descargar. Ponerla en un `href` que sobreviva a la sesión es cómo se filtra
 * un estudio clínico por WhatsApp.
 */
export interface DownloadUrl {
  readonly url: string;
  readonly expiresAt: Date;
}

/**
 * El contenido de un archivo almacenado, con la metadata que **viene con él**.
 *
 * ## De dónde sale cada campo
 *
 * De la propia respuesta de `GET /common/files/:id/content`, no de un endpoint
 * de metadata: `mimeType` y `sizeBytes` son el `type` y el `size` del `Blob`
 * —que el navegador rellena con el `Content-Type` y con los bytes recibidos— y
 * `originalName` sale de `Content-Disposition`. Es metadata que el sistema ya
 * emitía y que nadie estaba leyendo.
 *
 * ## Por qué el tipo del Blob es fiable
 *
 * Porque el backend no sirve lo que declaró quien subió: deduce el tipo de los
 * primeros bytes al recibir el archivo y persiste **ese**. Un `.html`
 * renombrado a `.png` llega como `text/plain`, no como `text/html`.
 */
export interface StoredFileContent {
  /** Los bytes, listos para previsualizar o guardar. */
  readonly blob: Blob;
  /** Tipo real, tal como lo sirvió la API. Vacío si la respuesta no lo trajo. */
  readonly mimeType: string;
  /** Tamaño real de lo recibido, en bytes. */
  readonly sizeBytes: number;
  /**
   * El nombre con el que se subió, **sólo si pudo leerse con certeza**.
   *
   * Ausente cuando el archivo no tiene `original_name`, cuando la respuesta no
   * trae la cabecera —el backend simulado no la emite— o cuando venía
   * malformada. Quien lo muestre debe traer su propio texto de reserva: acá no
   * se inventa un nombre.
   */
  readonly originalName?: string;
}
