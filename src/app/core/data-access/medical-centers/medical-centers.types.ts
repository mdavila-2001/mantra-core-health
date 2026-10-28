/* ============================================================================
    Búsqueda de centros médicos por procedimiento.

    Los campos y las rutas son los de `CONTRATO.md` §4, tal cual: los escribe la
    API (CM-05) y los consume la pestaña «Centros médicos» del paciente (CM-09).
    El orden de `items` lo decide la API —completos, distancia, precio total,
    nombre— y es el mismo para todos: nada de acá lo reordena.
    ========================================================================== */

/** Lo que un centro cobra por un procedimiento, con la referencia del nomenclador. */
export interface MedicalCenterOffer {
  readonly procedureConceptId: string;
  readonly procedureDisplay: string;
  readonly price: number;
  readonly currencyConceptId: string;
  readonly referencePrice: number | null;
  readonly referenceUnit: 'UMA' | 'USD' | null;
  /** Siempre `null` hoy (A-1/A-2): la API todavía no calcula el sobreprecio. */
  readonly overMargin: boolean | null;
}

/** Una sede, evaluada contra los procedimientos pedidos. */
export interface MedicalCenterItem {
  readonly practiceId: string;
  readonly practiceSiteId: string;
  readonly name: string;
  readonly addressText: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  /** Distancia en línea recta desde el origen; `null` sin origen o sin coordenadas. */
  readonly distanceKm: number | null;
  /** Si la sede ofrece todos los procedimientos pedidos. */
  readonly complete: boolean;
  readonly missingProcedureConceptIds: readonly string[];
  readonly offers: readonly MedicalCenterOffer[];
  readonly totalPrice: number | null;
  /** Solo en `/for-my-orders`. No cambia el orden. */
  readonly practitionerWorksHere?: boolean;
  /** Solo en `/for-my-orders`. No cambia el orden. */
  readonly suggestedByPractitioner?: boolean;
}

/** Página de la búsqueda, cortada **después** de ordenar. */
export interface MedicalCenterPage {
  readonly items: readonly MedicalCenterItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/** Los filtros comunes de las dos búsquedas. */
interface MedicalCenterQueryBase {
  /**
   * Desde dónde medir la distancia. `lat` y `lng` viajan juntos o ninguno:
   * uno solo se descarta, porque la API lo rechaza con 400.
   */
  readonly lat?: number;
  readonly lng?: number;
  /** `false` devuelve solo los completos. Siempre explícito: el valor por defecto de la API no se hereda. */
  readonly includePartial: boolean;
  readonly offset?: number;
  readonly limit?: number;
}

/** `GET /medical-centers/search` — pública, por procedimiento. */
export interface MedicalCenterSearchQuery extends MedicalCenterQueryBase {
  /** De 1 a 50 conceptos de procedimiento; los repetidos se descartan. */
  readonly procedureConceptIds: readonly string[];
  readonly specialty?: string;
  readonly city?: string;
}

/** `GET /medical-centers/search/for-my-orders` — autenticada, solo el paciente titular. */
export interface MedicalCentersForMyOrdersQuery extends MedicalCenterQueryBase {
  /** De 1 a 50 órdenes propias. Los procedimientos salen de las órdenes, no de la URL. */
  readonly serviceRequestIds: readonly string[];
}
