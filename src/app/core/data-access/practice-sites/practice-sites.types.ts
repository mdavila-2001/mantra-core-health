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
  /**
   * Si es **su** consultorio —su práctica personal— y no la sede de otro.
   *
   * Es la diferencia que la lista no sabía decir: «Consultorio Dra. Rojas» y
   * «Hospital San Lucas» llegaban con la misma forma y se dibujaban idénticos,
   * con el mismo «Retirar» al lado, cuando retirar lo propio y desvincularse de
   * un hospital no son el mismo acto. Uno se crea y se corrige solo; el otro
   * depende de que la organización lo acepte.
   *
   * La API **ya lo manda** (P32-a, cerrado). Sigue declarado opcional a
   * propósito: el frontend puede quedar desplegado contra una API anterior, y
   * ausente se lee como «no sé» —la pantalla lo trata como ajeno, que es la
   * lectura prudente— en vez de romperse.
   */
  readonly isOwnSite?: boolean;

  /**
   * El archivo del **QR bancario** que el profesional quiere cobrar en esta
   * sede, o `null` si todavía no configuró ninguno.
   *
   * Es por sede y no por persona a propósito: un médico que atiende en su
   * consultorio y en una clínica no cobra por la misma cuenta en los dos
   * lugares, y un único QR de perfil lo obligaría a corregirlo cada vez que
   * cambia de establecimiento.
   *
   * Opcional por el mismo motivo que {@link PracticeSite.isOwnSite}: la API
   * **ya lo manda** (P33, cerrado), pero ausente se sigue leyendo como «no
   * hay ninguno configurado», que es lo que la pantalla avisa en ámbar —
   * nunca esconde el camino para cargarlo.
   */
  readonly bankQrFileId?: string | null;
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
 * Corrección de un consultorio propio.
 *
 * Los mismos campos que el alta, todos opcionales: es un `PATCH`, y lo que no
 * viaja no se toca. Sin esto, arreglar un nombre mal tipeado o una mudanza
 * obligaba a retirar el consultorio y crear otro —y el id cambia, que es el que
 * la agenda referencia—.
 *
 * La API expone la ruta desde el cierre del **P32-b**
 * (`PATCH /practitioners/me/sites/:siteId`), que era la mitad del P28: el
 * consultorio propio estaba entre lo que el registro pregunta y el perfil no
 * podía editar.
 */
export interface OwnSitePatch {
  readonly name?: string;
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
  /** Logo de la organización (su ficha pública), o `null` si no tiene uno. */
  readonly avatarUrl: string | null;
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
