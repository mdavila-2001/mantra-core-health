/* ============================================================================
    Tipos de la vista para los consultorios de `practice` (M14).

    Responden una sola pregunta —«¿dónde atiende este profesional?»— que hasta
    ahora el sistema no sabía contestar: la agenda sabía *cuándo*, y el lugar
    había que averiguarlo por fuera.
    ========================================================================== */

/**
 * Una sede donde se atiende.
 *
 * `addressText` viene compuesto desde el backend: la dirección se guarda en
 * piezas (`common.addresses`) y decidir cómo se juntan es del dato, no de cada
 * pantalla que la muestre. `null` cuando la sede no tiene ninguna cargada — es
 * corriente y no es un error.
 */
export interface PracticeSite {
  readonly id: string;
  readonly practiceId: string;
  /** Código único dentro de la práctica. */
  readonly code: string;
  readonly name: string;
  /** Zona horaria IANA de la sede, p. ej. `America/La_Paz`. */
  readonly timeZone: string | null;
  /** Dirección en una línea, o `null` si la sede no tiene ninguna. */
  readonly addressText: string | null;
  /** Punto de la sede, si la dirección lo tiene cargado (ALV-006). `null` si no. */
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly status: string;
}

/**
 * La dirección de un consultorio propio, tal como la manda el alta.
 *
 * Es un subconjunto de `NewAddress` (`common`): el dueño lo pone el backend
 * desde la sesión, y el país no se ofrece porque el único sembrado es Bolivia.
 */
export interface NewOwnSiteAddress {
  /** Líneas de la dirección (calle, número, referencia). Al menos una. */
  readonly lines: readonly string[];
  readonly city?: string;
  /** Municipio, miembro de `VS_BO_MUNICIPALITY`. */
  readonly municipalityConceptId?: string;
  /** Departamento, miembro de `VS_BO_DEPARTMENT`. */
  readonly administrativeAreaConceptId?: string;
  /** Punto marcado en el mapa. Van siempre los dos o ninguno. */
  readonly latitude?: number;
  readonly longitude?: number;
}

/**
 * Alta de un consultorio propio (ALV-005/006).
 *
 * **No lleva práctica ni organización**: el backend crea —o reutiliza— la
 * práctica personal del profesional. Es justo el caso que el alta dejaba sin
 * resolver: «atiendo en mi propio consultorio, sin estar afiliado a nadie».
 */
export interface NewOwnSite {
  readonly name: string;
  /** Zona horaria IANA. Por defecto la de La Paz. */
  readonly timeZone?: string;
  readonly address?: NewOwnSiteAddress;
}

/**
 * Los consultorios de un profesional.
 *
 * Una lista vacía significa «no tiene asignación vigente con sede», no «el
 * profesional no existe»: quien la consuma tiene que tratarla como ausencia de
 * dato y no como error.
 */
export interface PracticeSitePage {
  readonly items: readonly PracticeSite[];
  readonly count: number;
}

/* ============================================================================
    Carril 18 — «mis organizaciones»: en qué organizaciones el profesional
    tiene una vinculación, y en qué estado está cada una. Pertenecer a una
    organización NO da acceso a sus pacientes; eso depende de una relación
    asistencial concreta (cita, derivación, intervención, autorización), no de
    esta pantalla.
    ========================================================================== */

/** Una vinculación del profesional con una organización, en cualquier estado. */
export interface MyRoleAssignment {
  readonly id: string;
  readonly practiceId: string;
  readonly practiceName: string;
  readonly practiceType?: string;
  readonly practiceSiteId?: string;
  readonly roleConceptId: string;
  readonly specialtyConceptId?: string;
  /** Concepto de estado: pendiente / activa / suspendida / rechazada / finalizada. */
  readonly status: string;
  readonly isPrimary: boolean;
  readonly validFrom?: Date;
  readonly validTo?: Date;
  readonly createdAt: Date;
}

/** Cuerpo de "pedir vincularme a esta organización". */
export interface SelfRequestAffiliationInput {
  readonly practiceSiteId?: string;
  readonly roleConceptId?: string;
  readonly specialtyConceptId?: string;
  /** `YYYY-MM-DD`. */
  readonly validFrom?: string;
  readonly note?: string;
}

/** Resultado de solicitar/transicionar una vinculación. */
export interface RoleAssignmentResult {
  readonly id: string;
  readonly practiceId: string;
  readonly practitionerProfileId: string;
  readonly status: string;
  readonly createdAt: Date;
}
