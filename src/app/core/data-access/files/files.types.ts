/* ============================================================================
    Tipos de la vista para el subsistema de archivos (M02 `common`).

    Las categorías y sensibilidades son **uniones de texto y no uuid de
    concepto**, al revés que en casi todo el resto del sistema. No es una
    excepción nuestra: el contrato del backend las declara así
    (`FileCategory`/`FileSensitivity` en `common/dto/enums.ts`), porque son
    valores cerrados del propio subsistema y no catálogo de terminología.
    ========================================================================== */

/** A qué recurso pertenece un adjunto. Son los tres que el modelo admite. */
export const OWNER_TYPES = ['USER', 'PATIENT', 'TENANT'] as const;

/**
 * El tipo de propietario de un adjunto.
 *
 * **No existe `ENCOUNTER`.** `file_links.owner_type` admite estos tres y nada
 * más, así que los adjuntos de la ficha cuelgan del **paciente**, no del
 * encuentro concreto. Es una restricción del modelo, no una decisión de la
 * pantalla: quien quiera adjuntos por episodio tiene que promoverlo al `.puml`
 * primero.
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
