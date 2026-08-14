/** Tipos de la vista para `profiles`. Se mapean desde los DTOs, no son ellos. */

/** Alta de un perfil de paciente hecha por personal (no auto-registro). */
export interface NewPatientProfile {
  readonly patientCode: string;
  readonly displayName?: string;
  /** ISO `YYYY-MM-DD`. */
  readonly birthDate?: string;
  /**
   * Conceptos de terminología: van por identificador, nunca por etiqueta. El
   * modelo prohíbe fijar valores de vocabulario en el código.
   */
  readonly administrativeGenderConceptId?: string;
  readonly sexAtBirthConceptId?: string;
  /** Código del índice maestro de pacientes. Único en toda la instalación. */
  readonly masterPatientIndexCode?: string;
}

export interface PatientProfile {
  readonly profileId: string;
  readonly personId: string;
  readonly patientCode: string;
  readonly recordLinkageStatus: string;
  readonly createdAt: Date;
}

/**
 * Alta de un profesional. La matrícula y la credencial son obligatorias: el
 * backend no admite un profesional sin habilitación comprobable.
 */
export interface NewPractitionerProfile {
  readonly practitionerCode: string;
  readonly licenseNumber: string;
  readonly credentialNumber: string;
  readonly personId?: string;
  readonly displayName?: string;
  readonly professionalTitle?: string;
  readonly practitionerCategoryConceptId?: string;
  readonly jurisdictionConceptId?: string;
  readonly regulatoryAuthority?: string;
}

export interface PractitionerProfile {
  readonly profileId: string;
  readonly personId: string;
  readonly practitionerCode: string;
  readonly verificationStatus: string;
  readonly practiceStatus: string;
  readonly licenseId: string;
  readonly credentialId: string;
  readonly createdAt: Date;
}

/** Vínculo entre una persona del directorio y una cuenta de acceso. */
export interface AccountLink {
  readonly id: string;
  readonly personId: string;
  readonly userId: string;
  readonly status: string;
  readonly validFrom: Date;
}

/* ============================================================================
    Lectura de pacientes (UC-05-13 y UC-05-14)

    Las tres formas de abajo son las de la vista, no las del contrato: las
    fechas llegan ya convertidas y los `*ConceptId` conservan el uuid porque
    la etiqueta la resuelve `terminology`, nunca esta capa.
    ========================================================================== */

/** Filtro del listado. Sin `cursor` pide la primera página. */
export interface PatientSearchQuery {
  /** Texto libre sobre el código de paciente y el nombre. */
  readonly query?: string;
  /** Cursor opaco devuelto por la página anterior. */
  readonly cursor?: string;
  readonly limit?: number;
}

/**
 * Fila del listado. Trae lo justo para decidir a cuál entrar; la ficha
 * completa es {@link PatientDetail}.
 */
export interface PatientListItem {
  readonly profileId: string;
  readonly personId: string;
  readonly patientCode: string;
  readonly displayName?: string;
  readonly birthDate?: Date;
  readonly personStatusConceptId?: string;
  /**
   * Derivado del backend, y booleano a propósito: una lista de pacientes tiene
   * que poder marcar a quien falleció sin resolver terminología antes.
   */
  readonly deceased: boolean;
}

/**
 * Página del listado. Sin total: la paginación es por cursor, y pedir el total
 * obligaría al backend a contar la tabla entera en cada página.
 */
export interface PatientPage {
  readonly items: readonly PatientListItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Contacto o representante registrado de un paciente (UC-05-10). */
export interface RelatedPerson {
  readonly id: string;
  readonly displayName?: string;
  readonly relationshipConceptId?: string;
  readonly isEmergencyContact: boolean;
  readonly isLegalGuardian: boolean;
}

/**
 * Ficha de filiación F-01 (UC-05-14).
 *
 * **No trae datos clínicos.** Condiciones, alergias y medicación viven en
 * `clinical`, y las notas del expediente en `chart`: la separación es del
 * backend y responde a que filiación y expediente los administran roles
 * distintos.
 */
export interface PatientDetail {
  readonly profileId: string;
  readonly personId: string;
  readonly patientCode: string;
  readonly masterPatientIndexCode?: string;
  readonly displayName?: string;
  readonly birthDate?: Date;
  readonly administrativeGenderConceptId?: string;
  readonly sexAtBirthConceptId?: string;
  readonly genderIdentityConceptId?: string;
  readonly nationalityConceptId?: string;
  readonly preferredLanguageConceptId?: string;
  readonly personStatusConceptId?: string;
  readonly vitalStatusConceptId?: string;
  readonly deceasedAt?: Date;
  readonly aboGroupConceptId?: string;
  readonly rhFactorConceptId?: string;
  readonly insuranceStatusConceptId?: string;
  readonly clinicalLanguageConceptId?: string;
  readonly recordLinkageStatusConceptId?: string;
  readonly relatedPersons: readonly RelatedPerson[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/* ---- historial laboral del profesional (UC-05-16) ------------------------ */

/**
 * Un vínculo laboral del profesional: dónde trabajó, con qué cargo y cuándo.
 *
 * ## Lo que el perfil no sabía decir
 *
 * `credentials` dice dónde se **formó**, `licenses` qué puede **ejercer** y
 * `specialties` en qué. Ninguno dice dónde **trabajó**, que es lo que el
 * cliente pidió por nombre: «hospitales o entidades médicas».
 *
 * ## La institución es texto
 *
 * `organizationName` es una cadena, no un identificador. La mayoría de los
 * hospitales donde alguien trabajó no están en la plataforma, y exigir que
 * existan para poder mencionarlos convertiría un dato de currículum en un alta
 * de organizaciones. Cuando la institución sí está dentro, `practiceSiteId` la
 * ata.
 *
 * ## `current` viene derivado
 *
 * Lo calcula el backend a partir de `endDate`, para que quien lo muestre no
 * tenga que decidir qué significa una fecha ausente.
 */
export interface PractitionerAffiliation {
  readonly id: string;
  readonly practitionerProfileId: string;
  /** Hospital o entidad médica, tal como la declaró el profesional. */
  readonly organizationName: string;
  readonly roleTitle: string;
  readonly departmentText: string | null;
  /** Sede de la plataforma, cuando la institución está dentro. */
  readonly practiceSiteId: string | null;
  /** Tipo de vínculo; se resuelve contra `terminology`. */
  readonly affiliationTypeConceptId: string | null;
  readonly startDate: Date;
  /** `null` mientras siga ejerciendo ahí. */
  readonly endDate: Date | null;
  /** Derivado de `endDate` por el backend: sin fin declarado, sigue vigente. */
  readonly current: boolean;
  /** Concepto del estado del registro, no del vínculo laboral. */
  readonly status: string;
  readonly createdAt: Date;
}

/** El historial laboral completo, del vínculo más reciente al más antiguo. */
export interface PractitionerAffiliationPage {
  readonly items: readonly PractitionerAffiliation[];
  readonly count: number;
}

/**
 * Alta de un vínculo laboral.
 *
 * **No lleva el profesional**: el backend lo resuelve desde la sesión, así que
 * no hay forma de escribir el historial de otro. Las fechas viajan como
 * `YYYY-MM-DD` porque el contrato las declara `date`, no `date-time`: el día en
 * que alguien entró a un hospital no tiene hora.
 */
export interface NewPractitionerAffiliation {
  readonly organizationName: string;
  readonly roleTitle: string;
  readonly departmentText?: string;
  readonly practiceSiteId?: string;
  readonly affiliationTypeConceptId?: string;
  /** ISO `YYYY-MM-DD`. */
  readonly startDate: string;
  /** ISO `YYYY-MM-DD`. Se omite si sigue ejerciendo ahí. */
  readonly endDate?: string;
}

/* ---- personas relacionadas / contactos (UC-05-10) ----------------------- */

/**
 * Alta de una persona relacionada.
 *
 * **Todos los campos son opcionales**, y no es descuido del contrato: sin
 * `personId` el backend **crea** la persona con los datos que se le pasen, y
 * con `personId` reutiliza una que ya existe. Son dos casos de uso en un solo
 * cuerpo.
 */
export interface NewRelatedPerson {
  /** Persona ya registrada. Omitirlo hace que el backend cree una nueva. */
  readonly personId?: string;
  readonly displayName?: string;
  /** ISO `YYYY-MM-DD`. */
  readonly birthDate?: string;
  /** Parentesco. Se resuelve contra `terminology`, nunca texto libre. */
  readonly relationshipConceptId?: string;
  readonly isEmergencyContact?: boolean;
  /** Tutor legal. El modelo admite **uno solo activo** por paciente. */
  readonly isLegalGuardian?: boolean;
}

/** Lo que devuelve el alta de una persona relacionada. */
export interface RelatedPersonCreated {
  readonly id: string;
  readonly patientProfileId: string;
  readonly personId: string;
  /** Concepto del estado del vínculo. */
  readonly status: string;
  readonly createdAt: Date;
}

/* ---- fusión de pacientes duplicados (UC-05-08 y UC-05-09) ---------------- */

/**
 * Petición de fusión. Los dos perfiles son obligatorios y **no son
 * intercambiables**: el que sobrevive conserva su historia y el otro queda
 * absorbido.
 */
export interface PatientMergeRequest {
  readonly survivingPatientProfileId: string;
  readonly mergedPatientProfileId: string;
  /** Concepto de la razón. Opcional en el contrato. */
  readonly reasonConceptId?: string;
}

/**
 * El evento que deja una fusión o su reversión.
 *
 * `id` es lo único con lo que se puede revertir después, y **el backend no
 * expone ningún listado de estos eventos**: si se pierde, la fusión deja de ser
 * reversible desde la interfaz.
 */
/** Filtros de `GET /profiles/patients/merge-events`. Todos opcionales. */
export interface PatientMergeEventQuery {
  /** Paciente involucrado, de cualquiera de los dos lados de la fusión. */
  readonly patientProfileId?: string;
  readonly limit?: number;
}

/** Una página de eventos de fusión, del más reciente al más antiguo. */
export interface PatientMergeEventPage {
  readonly items: readonly PatientMergeEvent[];
  readonly count: number;
  readonly limit: number;
}

export interface PatientMergeEvent {
  readonly id: string;
  readonly survivingPatientProfileId: string;
  readonly mergedPatientProfileId: string;
  /** Concepto del estado de la decisión. */
  readonly decisionStatus: string;
  /** Presente sólo cuando este evento revierte a otro. */
  readonly reversalOfEventId?: string;
  readonly recordedAt: Date;
}

/**
 * Resumen que la persona consulta sobre sí misma (V05-03).
 *
 * El backend exige identidad verificada vigente: sin ella responde `403` con
 * `IDENTITY_VERIFICATION_REQUIRED`, que `errorToViewState` ya convierte en un
 * S5 **con salida** hacia la pantalla de verificación.
 */
export interface OwnPatientSummary {
  readonly personId: string;
  readonly patientProfileId: string;
  readonly patientCode: string;
  readonly displayName?: string;
  readonly birthDate?: Date;
  /** Concepto del estado de la persona; se resuelve contra `terminology`. */
  readonly personStatus: string;
}
