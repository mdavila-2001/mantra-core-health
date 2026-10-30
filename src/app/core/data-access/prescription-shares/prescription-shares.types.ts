/**
 * Tipos del enlace para compartir una receta (FAR-01, `CONTRATO.md` §1).
 *
 * La receta es del paciente: nadie la ve sin su enlace, y el enlace no deja
 * comprar a otro. Por eso la vista pública ({@link PublicPrescriptionShare})
 * no declara ningún campo del paciente ni de los fármacos: lo que no está en
 * el tipo no se puede pintar por error.
 */

/**
 * Qué receta se comparte: la de una consulta entera o un fármaco suelto.
 *
 * Exactamente uno de los dos (la API responde 400 si llegan ninguno o los
 * dos), y la unión lo hace imposible de escribir mal.
 */
export type PrescriptionShareTarget =
  | { readonly encounterId: string }
  | { readonly medicationRequestId: string };

/**
 * Lo que devuelve el alta (`201`). El `token` en claro sale **una sola vez**,
 * acá: la API guarda solo su hash, así que no hay forma de volver a pedirlo.
 */
export interface CreatedPrescriptionShare {
  readonly shareId: string;
  /** `${webAppBaseUrl}/rx/<token>`: lo arma la API, el front no lo recompone. */
  readonly url: string;
  readonly token: string;
  readonly expiresAt: Date;
  readonly itemCount: number;
}

/**
 * El estado del enlace, calculado por la API al leer (S-5): un enlace cuya
 * fecha pasó se lee `EXPIRED` aunque la fila diga activo.
 */
export type PrescriptionShareStatus = 'VALID' | 'EXPIRED' | 'REVOKED';

/** Qué se compartió (S-7): la receta de una consulta o un fármaco suelto. */
export type PrescriptionShareResourceType = 'PRESCRIPTION_ENCOUNTER' | 'MEDICATION_REQUEST';

/** Un enlace del paciente, sin el token (`GET /clinical/prescription-shares`). */
export interface PrescriptionShareSummary {
  readonly shareId: string;
  readonly resourceType: PrescriptionShareResourceType;
  /** El `encounterId` o el `medicationRequestId` de la receta compartida. */
  readonly resourceId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly status: PrescriptionShareStatus;
  /** Cuántas veces la abrió una farmacia (usos `OPENED`). */
  readonly uses: number;
}

/**
 * La respuesta de `GET /clinical/prescription-shares/by-token/:token` (D-1):
 * existe solo si el enlace es de quien pregunta. No registra uso.
 */
export interface PrescriptionShareOwnership {
  readonly shareId: string;
  readonly resourceType: PrescriptionShareResourceType;
  readonly resourceId: string;
}

/**
 * La matrícula de quien recetó, sin ningún otro dato suyo
 * (`PrescriberLicenseDto` de la API, la misma del verify).
 */
export interface PrescriberLicense {
  readonly number: string;
  readonly authority: string | null;
  /**
   * El DTO siempre lo manda y este cliente siempre lo copia. Admite `null`
   * solo porque «Abrir receta» (FAR-02) reusa este tipo y su mapeador lo
   * produce: cerrarlo acá rompería ese cliente, que es de otro carril.
   */
  readonly state: 'ACTIVE' | 'PENDING' | null;
}

/**
 * La vista pública del enlace (`GET /public/prescription-shares/:token`, S-4):
 * si la receta vale, quién la emitió y cuándo, y cuántos ítems tiene.
 *
 * Ni el paciente ni los fármacos: no están en el contrato y no están acá.
 */
export interface PublicPrescriptionShare {
  readonly status: PrescriptionShareStatus;
  readonly issuedAt: Date | null;
  readonly prescriberName: string | null;
  readonly prescriberLicense: PrescriberLicense | null;
  readonly itemCount: number;
}

/** Los estados que expone el verify público de una receta. */
export type PrescriptionVerificationStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'COMPLETED'
  | 'INVALIDATED'
  | 'REPLACED';

/**
 * Lo que responde `GET /public/prescriptions/:id/verify`, que ya existía
 * (`PrescriptionVerificationResponseDto` de la API): sin PHI, ni siquiera el
 * nombre de quien recetó.
 */
export interface PrescriptionVerification {
  readonly id: string;
  readonly status: PrescriptionVerificationStatus;
  readonly issuedAt: Date | null;
  /** El sello SHA-256 recalculado; `null` mientras es borrador. */
  readonly contentHash: string | null;
  readonly prescriberLicense: PrescriberLicense | null;
}
