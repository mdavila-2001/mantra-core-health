/* ============================================================================
    El portal de la cuenta de laboratorio (30/09/2026).

    Es el espejo del portal de la farmacia (`pharmacy.types.ts`, carril B del
    29/09) con una diferencia de fondo: el laboratorio **vende servicios**, no
    productos. No hay existencias ni umbral; hay un estudio que se hace o no se
    hace hoy (`available`), cuánto tarda en salir el resultado y qué preparación
    le pide al paciente. Y hay algo que la farmacia no tiene: **el resultado**,
    el archivo que el laboratorio le devuelve al médico y al paciente.

    Todas las rutas cuelgan de `/diagnostics/lab/…` y no llevan el id del
    laboratorio: lo decide el servidor con el tenant del contexto
    (`X-Tenant-Id`), igual que la recepción de muestras. La API real todavía no
    tiene ninguna: están en `PENDIENTES-BACKEND.md` P52.
    ========================================================================== */

/** En qué punto de su vida está un servicio del catálogo. */
export type LabServiceStatus = 'PUBLISHED' | 'DRAFT' | 'WITHDRAWN';

/** Un servicio (estudio o perfil) que el laboratorio ofrece. */
export interface LabService {
  readonly id: string;
  /** Código interno del laboratorio; único dentro de su catálogo. */
  readonly code: string;
  readonly name: string;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  /** Qué muestra se toma: «Sangre venosa», «Orina», «Heces»… */
  readonly sampleType: string | null;
  /** Lo que el paciente tiene que hacer antes («Ayuno de 8 horas»). */
  readonly preparation: string | null;
  readonly description: string | null;
  /** Horas hasta que el resultado está listo, si el laboratorio lo publica. */
  readonly turnaroundHours: number | null;
  readonly requiresMedicalOrder: boolean;
  readonly homeCollection: boolean;
  /** Precio de lista, como texto exacto con dos decimales. */
  readonly price: string;
  /** El descuento para usuarios de AloVida (registro de procesos §2.1.6). */
  readonly alovidaDiscountPercent: number | null;
  /** Lo que paga un usuario de AloVida: el precio menos el descuento. */
  readonly alovidaPrice: string;
  readonly currency: 'BOB';
  readonly status: LabServiceStatus;
  /**
   * Si hoy se puede hacer. Es el «hay / no hay» de un servicio: el reactivo se
   * agotó o el equipo está en mantenimiento. Un servicio no disponible sigue
   * publicado, pero la vitrina lo muestra como no disponible.
   */
  readonly available: boolean;
  readonly updatedAt: string;
}

/** Lo que se manda para dar de alta un servicio. */
export interface LabServiceDraft {
  readonly code: string;
  readonly name: string;
  readonly categoryId?: string | null;
  readonly sampleType?: string | null;
  readonly preparation?: string | null;
  readonly description?: string | null;
  readonly turnaroundHours?: number | null;
  readonly requiresMedicalOrder?: boolean;
  readonly homeCollection?: boolean;
  readonly price: string;
  readonly alovidaDiscountPercent?: number | null;
  readonly status?: Exclude<LabServiceStatus, 'WITHDRAWN'>;
  readonly available?: boolean;
}

/** Un cambio parcial sobre un servicio existente. */
export type LabServiceChanges = Partial<Omit<LabServiceDraft, 'status'>> & {
  readonly status?: LabServiceStatus;
};

export interface LabServiceQuery {
  readonly q?: string;
  readonly categoryId?: string;
  readonly status?: LabServiceStatus;
  readonly available?: boolean;
}

export interface LabServicePage {
  readonly items: readonly LabService[];
  readonly count: number;
}

/** Una categoría del catálogo: Hematología, Química sanguínea… */
export interface LabCategory {
  readonly id: string;
  readonly name: string;
  /** Cuántos servicios la usan; con alguno, no se puede borrar (409). */
  readonly serviceCount: number;
}

export interface LabCategoryPage {
  readonly items: readonly LabCategory[];
  readonly count: number;
}

/* ---- carga masiva ------------------------------------------------------- */

/** Crear lo nuevo y actualizar lo que existe, o sólo actualizar. */
export type LabImportMode = 'CREATE_OR_UPDATE' | 'UPDATE_ONLY';

/** Una fila ya leída del CSV, con el número de línea para poder señalarla. */
export interface LabImportRow {
  readonly line: number;
  readonly service: LabServiceDraft;
}

export type LabImportOutcome = 'CREATED' | 'UPDATED' | 'UNCHANGED' | 'REJECTED';

export interface LabImportRowResult {
  readonly line: number;
  readonly code: string;
  readonly outcome: LabImportOutcome;
  /** Por qué se rechazó, en palabras de persona. */
  readonly reason: string | null;
}

export interface LabImportResult {
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly rejected: number;
  readonly rows: readonly LabImportRowResult[];
}

/* ---- resumen ------------------------------------------------------------ */

export type LabActivityKind =
  | 'SERVICE_CREATED'
  | 'SERVICE_UPDATED'
  | 'SERVICE_WITHDRAWN'
  | 'SERVICES_IMPORTED'
  | 'RESULT_UPLOADED'
  | 'RESULT_WITHDRAWN';

export interface LabActivityEntry {
  readonly id: string;
  readonly at: string;
  readonly kind: LabActivityKind;
  /** La frase lista para mostrar: «Subiste hemograma-ana.pdf (2,4 MB)». */
  readonly text: string;
}

export interface LabSummary {
  readonly labName: string;
  readonly published: number;
  readonly drafts: number;
  readonly withdrawn: number;
  readonly unavailable: number;
  /** Órdenes de la bandeja que todavía no tienen ningún resultado subido. */
  readonly ordersWithoutResults: number;
  readonly resultFiles: number;
  /** Bytes de todo lo subido (sin los retirados). */
  readonly resultBytes: number;
  readonly byCategory: readonly { readonly category: string; readonly count: number }[];
  readonly recentActivity: readonly LabActivityEntry[];
}

/* ---- resultados --------------------------------------------------------- */

/**
 * Cómo se puede mirar un archivo en el navegador. Lo decide el servidor por el
 * tipo MIME y la extensión, para que la pantalla no adivine.
 */
export type LabResultKind = 'PDF' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'TEXT' | 'DICOM' | 'OTHER';

export type LabResultStatus = 'AVAILABLE' | 'WITHDRAWN';

/** Un archivo de resultados que el laboratorio subió. */
export interface LabResultFile {
  readonly id: string;
  readonly fileName: string;
  /** El tipo que declaró el navegador; puede venir vacío. */
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly kind: LabResultKind;
  readonly uploadedAt: string;
  readonly uploadedBy: string;
  /** La orden de la bandeja a la que responde, si se eligió una. */
  readonly orderId: string | null;
  /** «Hemograma completo · pedido por Dra. Valeria Rojas». */
  readonly orderLabel: string | null;
  readonly patientName: string | null;
  readonly note: string | null;
  /** Si se avisó al médico y al paciente (registro de procesos §2.1.9). */
  readonly notified: boolean;
  readonly status: LabResultStatus;
  readonly withdrawnReason: string | null;
}

export interface LabResultFileQuery {
  readonly q?: string;
  readonly kind?: LabResultKind;
  readonly orderId?: string;
  /** Con `true` también vuelven los retirados. */
  readonly includeWithdrawn?: boolean;
}

export interface LabResultFilePage {
  readonly items: readonly LabResultFile[];
  readonly count: number;
  /** Bytes de lo listado. */
  readonly totalBytes: number;
}

/** Lo que se declara al empezar una subida. No hay tope de tamaño. */
export interface LabResultUploadStart {
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly orderId?: string | null;
  readonly note?: string | null;
  /** Avisar al médico y al paciente cuando termine. */
  readonly notify?: boolean;
}

/**
 * La sesión de una subida por partes: el archivo viaja en trozos de
 * `chunkSizeBytes` y ninguna petición lleva más que eso, así que el tamaño
 * total no choca con el límite de cuerpo de nginx ni con la memoria.
 */
export interface LabResultUploadSession {
  readonly uploadId: string;
  readonly chunkSizeBytes: number;
  readonly totalParts: number;
  /** Partes que el servidor ya tiene: una subida reanudada arranca desde acá. */
  readonly receivedParts: readonly number[];
}

/** Una orden de la bandeja a la que se le puede atar un resultado. */
export interface LabResultTarget {
  readonly orderId: string;
  readonly studyName: string;
  readonly patientName: string;
  readonly requesterName: string;
  readonly requestedAt: string;
  /** Cuántos archivos ya tiene subidos. */
  readonly fileCount: number;
}

export interface LabResultTargetPage {
  readonly items: readonly LabResultTarget[];
  readonly count: number;
}
