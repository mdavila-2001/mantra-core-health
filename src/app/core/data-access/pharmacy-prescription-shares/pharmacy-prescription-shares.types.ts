import type { PrescriberLicense } from '../prescription-shares/prescription-shares.types';

/**
 * La receta compartida tal como la ve una farmacia (FAR-02, `CONTRATO.md` §2):
 * `GET /pharmacy/prescription-shares/:token`.
 *
 * Del paciente llega **solo** lo enmascarado (S-4). El tipo no declara ninguna
 * otra clave suya, y el mapeador del cliente copia solo estas dos: si la API
 * mandara algo de más, no llega a la pantalla.
 */
export interface PharmacyPrescriptionShare {
  readonly shareId: string;
  /** Emisión más antigua de los ítems vigentes. */
  readonly issuedAt: Date | null;
  /** `valid_to` más próximo de los ítems vigentes. */
  readonly validTo: Date | null;
  readonly prescriber: PharmacyPrescriptionPrescriber;
  readonly patient: MaskedPatient;
  readonly items: readonly PharmacyPrescriptionItem[];
}

/** Quién emitió la receta: nombre y matrícula (no son datos del paciente, D-2). */
export interface PharmacyPrescriptionPrescriber {
  readonly name: string | null;
  readonly license: PrescriberLicense | null;
}

/** El paciente, enmascarado (REQ-FAR-02-004). */
export interface MaskedPatient {
  /** Iniciales de cada parte del nombre: `L. P. Q.`. */
  readonly maskedName: string | null;
  /** Los últimos 3 dígitos del documento nacional vigente. */
  readonly documentLast3: string | null;
}

/** Un ítem vigente de la receta, cruzado con el catálogo de la farmacia. */
export interface PharmacyPrescriptionItem {
  readonly medicationRequestId: string;
  readonly medicationConceptId: string;
  /** Nombre del fármaco en el vademécum. */
  readonly display: string | null;
  /** Dosis y frecuencia, en una línea. */
  readonly dosageText: string | null;
  readonly prescribedQuantity: number | null;
  /** Código del concepto de unidad: `UNIT_{bottle}`, `UNIT_{tube}`… */
  readonly unitCode: string | null;
  /** `null` sin control de cantidad (D-5). */
  readonly dispensedQuantity: number | null;
  /** Recetado − entregado − reservado; `null` = «Sin control de cantidad». */
  readonly remainingQuantity: number | null;
  /** Vacío si ninguna farmacia del tenant tiene el fármaco. */
  readonly matches: readonly PrescriptionProductMatch[];
}

/** Un producto del catálogo de la farmacia que surte el fármaco del ítem. */
export interface PrescriptionProductMatch {
  /** Sin él no se puede llamar al `PUT` de disponibilidad (§4). */
  readonly pharmacyId: string;
  readonly pharmacyProductId: string;
  readonly name: string;
  /** El `numeric` tal como lo manda la API; `null` sin lista general. */
  readonly price: string | null;
  readonly currencyCode: string | null;
  readonly requiresPrescription: boolean;
  /**
   * Marcado «no tengo» para toda la farmacia en el catálogo: ninguna sede lo
   * ofrece y una sede no apaga esa marca (R-02-2). La pantalla no ofrece el
   * interruptor.
   */
  readonly outOfStockDeclared: boolean;
  readonly sites: readonly PrescriptionProductSite[];
}

/** Una sede activa de la farmacia, con la disponibilidad del producto. */
export interface PrescriptionProductSite {
  readonly siteId: string;
  readonly siteName: string;
  readonly available: boolean;
  /** `null` si está disponible pero la sede no lleva conteo. */
  readonly quantity: number | null;
  readonly stockUpdatedAt: Date | null;
}

/** Qué sede, qué producto y de qué farmacia: la ruta del `PUT` de §4. */
export interface SiteProductRef {
  readonly pharmacyId: string;
  readonly siteId: string;
  readonly productId: string;
}

/**
 * 200 de `PUT /pharmacies/:pharmacyId/sites/:siteId/products/:productId/availability`
 * (FAR-06, `CONTRATO.md` §4): el producto en la sede después de escribir.
 */
export interface SiteProductAvailability {
  readonly siteId: string;
  readonly productId: string;
  readonly available: boolean;
  readonly quantity: number;
  readonly stockUpdatedAt: Date | null;
}
