/** Tipos de la vista para `profiles`. Se mapean desde los DTOs, no son ellos. */

import type { BirthSexCode } from '../iam/iam.types';

/**
 * Alta de un perfil de paciente hecha por personal (no auto-registro).
 *
 * ## El código de paciente es opcional acá, y no en el DTO
 *
 * Porque en el mostrador nadie lo sabe. `patient_code` es único en toda la
 * instalación y el servidor ya lo acuña él mismo en el alta que la persona hace
 * de sí misma (`PAT-<uuid>`); pedirle uno al navegador es pedirle que garantice
 * una unicidad que no puede ver. La pantalla de administración —que lo tiene
 * porque viene de una historia clínica en papel— lo sigue mandando.
 *
 * ## El bloque de filiación
 *
 * Los campos desde `name` para abajo son los que el registro de procesos del
 * cliente exige en la recepción del paciente (módulo Paciente §1.1) y que hoy
 * **sólo acepta el alta que la propia persona hace de sí misma**
 * (`RegisterPatientDto`). Están declarados acá porque son los que la pantalla
 * necesita; contra la API de hoy los rechaza `forbidNonWhitelisted` con un 400.
 * Ver `PENDIENTES-BACKEND.md` (P22): el destino no es este endpoint sino el
 * registro asistido, extendido con este mismo bloque.
 */
export interface NewPatientProfile {
  readonly patientCode?: string;
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

  /* -- filiación de mostrador (§1.1) — pendiente en el backend, P22 --------- */

  /** Nombre de pila. */
  readonly name?: string;
  /** Los nombres que no son el primero, ya unidos en uno solo. */
  readonly middleName?: string;
  readonly lastName?: string;
  readonly motherLastName?: string;
  /** Cédula de identidad. Va a `common.identifiers` como identificador oficial. */
  readonly nationalId?: string;
  /** Departamento que expidió la cédula (`VS_BO_DEPARTMENT`). */
  readonly issuerAdministrativeAreaConceptId?: string;
  readonly phone?: string;
  /** Ocupación del catálogo `VS_BO_OCCUPATION`. */
  readonly occupationConceptId?: string;
  /** El oficio escrito a mano, sólo cuando se eligió «Otra ocupación». */
  readonly occupationFreeText?: string;
  /** Tutor o persona autorizada, para quien no puede responder por sí mismo. */
  readonly guardianName?: string;
  readonly guardianPhone?: string;
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

/**
 * Una especialidad nueva a agregar al perfil propio.
 *
 * No hay «editar»: una especialidad verificada es un hecho comprobado contra
 * una credencial, y sólo se agrega — vigente, sin tocar las anteriores.
 */
export interface NewSpecialty {
  readonly specialtyConceptId?: string;
  readonly supportingCredentialId?: string;
  readonly isPrimary?: boolean;
  readonly boardCertified?: boolean;
}

/**
 * Una matrícula nueva a agregar al perfil propio.
 *
 * Mismo criterio: es una autorización de un tercero, y se agrega — no se
 * edita una ya cargada.
 */
export interface NewJurisdictionAuthorization {
  readonly licenseNumber: string;
  readonly jurisdictionConceptId?: string;
  readonly regulatoryAuthority?: string;
  readonly practiceScopeConceptId?: string;
  /** ISO `YYYY-MM-DD`. */
  readonly validFrom?: string;
  readonly validTo?: string;
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

/* ============================================================================
    El perfil profesional propio — `GET /profiles/practitioners/me/summary`.

    Es la lectura que le faltaba al módulo. Hasta que existió, la pantalla «Mi
    perfil» llamaba a `GET /profiles/patients/me/summary` para todo el mundo, y
    a un profesional eso le responde 404 —no tiene perfil de paciente— o 403 si
    además no verificó su identidad: la pantalla no funcionaba, y no por un
    defecto de la pantalla.

    Todos los `*ConceptId` viajan como uuid y los traduce quien los muestra.
    ========================================================================== */

/**
 * Una especialidad. Se reciben las vigentes y las pasadas: `validTo` distingue
 * «ya no la ejerce» de «nunca la tuvo», y sin ese dato el perfil no puede decir
 * ninguna de las dos cosas.
 */
export interface PractitionerSpecialty {
  readonly id: string;
  readonly specialtyConceptId: string;
  /** La especialidad con la que se presenta. Hay una sola vigente. */
  readonly isPrimary: boolean;
  /** Certificación del colegio o consejo. */
  readonly boardCertified: boolean;
  readonly practiceScopeText?: string;
  readonly verificationStatusConceptId: string;
  /**
   * Si la plataforma verificó su matrícula.
   *
   * Lo resuelve el servidor: comparar el concepto acá exigiría llevar su uuid
   * escrito en el cliente. La guía lista el padrón entero —quien se registra
   * declara una matrícula, no la prueba— y esto es lo que distingue a quien
   * además la probó.
   */
  readonly verified: boolean;
  readonly validFrom?: Date;
  /** Presente sólo si dejó de ejercerla. */
  readonly validTo?: Date;
}

/** Una credencial: título, posgrado o certificación. Es la formación. */
export interface PractitionerCredential {
  readonly id: string;
  readonly credentialTypeConceptId: string;
  readonly number: string;
  /** Dónde se cursó. Texto libre: la institución no siempre es una organización. */
  readonly issuingInstitutionText?: string;
  readonly issueDate?: Date;
  readonly expiryDate?: Date;
  readonly stateConceptId: string;
  /** Ausente = «sin verificar todavía», que no es «rechazada». */
  readonly verifiedAt?: Date;
  /** Contra qué se comprobó. Ausente antes de verificar. */
  readonly verificationSourceUri?: string;
}

/**
 * Un título nuevo (`POST /profiles/practitioners/me/credentials`).
 *
 * Nace **pendiente de verificación**, siempre: no hay forma de declararlo ya
 * verificado desde acá — eso lo hace `SECURITY_ADMIN` sobre uno existente.
 */
export interface NewOwnCredential {
  /** Uno de los cinco `CREDENTIAL_TYPE_*` del catálogo. */
  readonly credentialTypeConceptId: string;
  readonly number: string;
  readonly issuingInstitutionText?: string;
  /** ISO `YYYY-MM-DD`, mismo criterio que {@link NewJurisdictionAuthorization.validFrom}. */
  readonly issueDate?: string;
  /** El diploma, ya subido con `FilesClient.upload`. */
  readonly fileId?: string;
}

/** Una matrícula: dónde está habilitado a ejercer y con qué número. */
export interface PractitionerLicense {
  readonly id: string;
  readonly jurisdictionConceptId: string;
  readonly licenseNumber: string;
  readonly regulatoryAuthority?: string;
  readonly stateConceptId: string;
  readonly validFrom?: Date;
  readonly validTo?: Date;
}

/**
 * Un idioma en el que atiende. `clinicalInterpretationAllowed` distingue «lo
 * habla» de «puede sostener una consulta clínica en ese idioma».
 */
export interface PractitionerLanguage {
  readonly languageConceptId: string;
  readonly proficiencyConceptId?: string;
  readonly clinicalInterpretationAllowed: boolean;
}

/**
 * Lo que dejó asentado en la plataforma.
 *
 * Son cuentas de su propia actividad, no un ranking: no hay nada comparativo, y
 * el detalle de cada registro vive en el expediente de la persona atendida, con
 * sus permisos.
 */
export interface PractitionerActivity {
  readonly encounters: number;
  readonly medicationRequests: number;
  readonly clinicalNotes: number;
  readonly documents: number;
}

/** El perfil profesional que la persona ve de sí misma. */
export interface OwnPractitionerProfile {
  readonly profileId: string;
  readonly personId: string;
  readonly practitionerCode: string;
  readonly displayName?: string;
  /** «Médica cardióloga», «Kinesiólogo». */
  readonly professionalTitle?: string;
  /** Presentación en prosa: lo que hace que un perfil se lea como una persona. */
  readonly professionalBio?: string;
  readonly photoFileId?: string;
  readonly email?: string;
  /**
   * Forma anterior de leer el teléfono: el primero que haya, sin mirar su uso.
   *
   * @deprecated Preferí {@link workLandline} o {@link workMobilePhone}, que
   * dicen cuál es cuál.
   */
  readonly phone?: string;

  /* --- los cinco contactos, cada uno con su nombre -----------------------
     Vienen separados desde que el alta los pide así. `email` es el de trabajo
     y a la vez el de acceso; el personal viaja aparte. */

  /** Correo de trabajo, el mismo con el que se entra. */
  readonly workEmail?: string;
  /** Correo personal, el que no sirve para entrar. */
  readonly personalEmail?: string;
  /** Celular personal o privado. */
  readonly mobilePhone?: string;
  /** Celular del lugar de trabajo. */
  readonly workMobilePhone?: string;
  /** Fijo del lugar de trabajo. */
  readonly workLandline?: string;

  /* --- los datos personales, sólo en la lectura propia -------------------- */

  /** Las cuatro partes: es lo único con lo que se corrige un apellido. */
  readonly name?: string;
  readonly middleName?: string;
  readonly lastName?: string;
  readonly motherLastName?: string;
  readonly birthDate?: Date;
  /** Su documento. No editable desde el perfil: tiene su circuito propio. */
  readonly nationalId?: string;
  readonly issuerAdministrativeAreaConceptId?: string;
  readonly residenceMunicipalityConceptId?: string;
  /**
   * Su domicilio, si lo declaró (ALV-009). Ausente y no un objeto vacío
   * cuando no hay fila vigente — mismo contrato que {@link OwnPatientProfile}.
   */
  readonly homeAddress?: OwnAddress;

  readonly practitionerCategoryConceptId: string;
  readonly verificationStatusConceptId: string;
  readonly practiceStatusConceptId: string;
  readonly acceptsNewPatients: boolean;
  readonly telehealthAvailable: boolean;
  readonly specialties: readonly PractitionerSpecialty[];
  readonly credentials: readonly PractitionerCredential[];
  readonly licenses: readonly PractitionerLicense[];
  readonly languages: readonly PractitionerLanguage[];
  /** Historial laboral (UC-05-16), del más reciente al más antiguo. */
  readonly affiliations: readonly PractitionerAffiliation[];
  readonly activity: PractitionerActivity;
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

/**
 * Filtro del listado. Sin `cursor` pide la primera página.
 *
 * `nationalId` y `issuerAdministrativeAreaConceptId` son el camino de la
 * TAREA-07: encontrar a alguien por su documento aunque su nombre o su código
 * de paciente no contengan el texto buscado. El departamento sólo tiene
 * efecto junto al documento — un carnet sin departamento no es único en
 * Bolivia, y `issuerAdministrativeAreaConceptId` es nullable en el modelo.
 */
export interface PatientSearchQuery {
  /** Texto libre sobre el código de paciente y el nombre. */
  readonly query?: string;
  /** Documento de identidad exacto (`common.identifiers.value`). */
  readonly nationalId?: string;
  /** Departamento que lo expidió (`VS_BO_DEPARTMENT`). */
  readonly issuerAdministrativeAreaConceptId?: string;
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
  /** Cargo, o `null` si el vínculo no lo declara (ALV-007: opcional). */
  readonly roleTitle: string | null;
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
  /**
   * El mismo estado, legible. El concept id sigue en `status` y es la verdad;
   * esto evita que la pantalla compare uuids escritos a mano.
   *
   * `desconocido` cuando el backend informa un estado que este cliente todavía
   * no distingue —como el `declarado` que viene—: mejor decir que no se
   * reconoce que mentir sobre él.
   */
  readonly statusKind:
    'pendiente' | 'declarado' | 'aprobado' | 'rechazado' | 'revocado' | 'desconocido';
  /**
   * Por qué la organización rechazó o dio de baja el vínculo.
   *
   * Lo escribe quien decide sabiendo que el profesional lo lee. `null` en
   * cualquier otro estado.
   */
  readonly decisionReasonText: string | null;
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
  /** Opcional desde ALV-007: un consultorio propio no tiene cargo. */
  readonly roleTitle?: string;
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
 * **El perfil ya no depende de verificarse** (F-34): el backend responde `200`
 * a todo paciente, verificado o no, y es él quien decide qué campos viajan. Lo
 * único que la verificación gobierna es `patientCode`.
 *
 * Una API anterior a F-34 todavía puede responder `403` con
 * `IDENTITY_VERIFICATION_REQUIRED`, que `errorToViewState` convierte en un S5
 * **con salida** hacia la pantalla de verificación. La pantalla tolera los dos
 * contratos mientras dure el despliegue.
 */
export interface OwnPatientSummary {
  readonly personId: string;
  readonly patientProfileId: string;
  /**
   * El código con el que la persona se identifica en el centro. **Sólo viaja
   * con identidad verificada**: su ausencia es la respuesta del servidor, no
   * un filtro de la vista.
   */
  readonly patientCode?: string;
  readonly displayName?: string;
  readonly birthDate?: Date;
  /** Concepto del estado de la persona; se resuelve contra `terminology`. */
  readonly personStatus: string;
  /** Si hay una aserción de identidad vigente. Lo decide el backend. */
  readonly identityVerified: boolean;
}

/**
 * Los datos que la persona dio al registrarse, tal como ella los ve
 * (`GET /profiles/patients/me`).
 *
 * No es el resumen: {@link OwnPatientSummary} responde «quién soy y en qué
 * estado estoy» con el nombre ya compuesto por el backend, y con eso no se
 * puede corregir nada — para editar hacen falta las **cuatro partes** del
 * nombre por separado, que es como las guarda el modelo y como las pidió el
 * alta. `displayName` sigue viniendo, pero es derivado: se muestra, no se
 * escribe.
 *
 * Lo que no está acá tampoco se edita desde acá: documento, correo,
 * contraseña, género administrativo y código de paciente son trámites propios
 * —o datos que decide el servidor—, no campos de un formulario.
 */
/** Una dirección del paciente, con su punto en el mapa si lo declaró. */
export interface OwnAddress {
  readonly lines?: string;
  readonly city?: string;
  readonly municipalityConceptId?: string;
  /** Latitud y longitud viajan juntas o no viajan: media coordenada no ubica nada. */
  readonly latitude?: number;
  readonly longitude?: number;
}

export type CoverageValidity = 'CURRENT' | 'UPCOMING' | 'EXPIRED' | 'INACTIVE' | 'UNKNOWN';

/** Una regla del plan de seguro, sin convertir ausencias en ceros. */
export interface CoverageBenefitSummary {
  readonly id: string;
  readonly categoryCode?: string;
  readonly categoryName?: string;
  readonly serviceConceptId?: string;
  readonly serviceName?: string;
  readonly coveragePercent?: string;
  readonly copayAmount?: string;
  readonly deductibleAmount?: string;
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly validityStatus?: CoverageValidity;
  readonly statusCode?: string;
}

/** Un seguro declarado por el paciente. */
export interface OwnCoverage {
  readonly id: string;
  readonly planId?: string;
  readonly coverageOrder?: number;
  readonly carrierName: string;
  readonly planName?: string;
  readonly isPublic: boolean;
  readonly policyIdentifier?: string;
  readonly memberIdentifier?: string;
  readonly verified: boolean;
  readonly status?: string;
  readonly statusCode?: string;
  readonly validityStatus?: CoverageValidity;
  readonly referenceDate?: string;
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly currencyCode?: string;
  readonly carrierWhatsappNumber?: string;
  readonly carrierCallCenterPhone?: string;
  readonly benefits: readonly CoverageBenefitSummary[];
}

/** Un tutor o persona autorizada, con su teléfono. */
export interface OwnGuardian {
  readonly displayName?: string;
  readonly relationshipConceptId?: string;
  readonly isEmergencyContact: boolean;
  readonly isLegalGuardian: boolean;
  readonly phone?: string;
}

export interface OwnPatientProfile {
  readonly personId: string;
  readonly patientProfileId: string;
  readonly name?: string;
  readonly middleName?: string;
  readonly lastName?: string;
  readonly motherLastName?: string;
  /** Compuesto por el backend a partir de las cuatro partes. Sólo lectura. */
  readonly displayName?: string;
  readonly birthDate?: Date;
  /** Sexo asignado al nacer, por código legible. Ver `BirthSexCode`. */
  readonly sexAtBirth?: BirthSexCode;
  /**
   * Ocupación como **texto libre**, tal como la escribió el alta anterior al
   * catálogo. Convive con {@link OwnPatientProfile.occupationConceptId} y a lo
   * sumo uno de los dos trae valor: el backend deja el texto en `null` en
   * cuanto se asigna un concepto.
   */
  readonly occupationFreeText?: string;
  /**
   * Ocupación como concepto de `VS_BO_OCCUPATION`, que es lo que declara el
   * alta desde que el campo pasó a ser un desplegable. Un uuid, nunca una
   * etiqueta: el texto que se muestra sale del catálogo.
   */
  readonly occupationConceptId?: string;
  readonly phone?: string;
  /**
   * Municipio de residencia. Viaja **solo**, sin el departamento: el backend lo
   * deriva del código del INE, igual que en el alta.
   */
  readonly residenceMunicipalityConceptId?: string;
  readonly identityVerified: boolean;
  /** Sólo con identidad verificada, igual que en el resumen. */
  readonly patientCode?: string;

  /* --- lo que el alta captura y el perfil ahora muestra ------------------- */

  /** Su documento. No se edita desde el perfil: es su usuario de acceso. */
  readonly nationalId?: string;
  /** Departamento que lo emitió (VS_BO_DEPARTMENT). */
  readonly issuerAdministrativeAreaConceptId?: string;
  /** NIT para facturación. */
  readonly taxId?: string;
  /** A nombre de quién sale el comprobante — la razón social del NIT. */
  readonly taxHolderName?: string;
  readonly email?: string;
  /**
   * Foto de perfil (`profiles.persons.photo_file_id`).
   *
   * Es la foto de la **persona**, no del perfil de paciente: la misma que,
   * de tener perfil profesional, comparte con `health_practitioner_profiles`
   * sólo si esta cuenta la fija por acá — son columnas independientes.
   */
  readonly photoFileId?: string;
  readonly homeAddress?: OwnAddress;
  readonly workAddress?: OwnAddress;
  /** Siempre presentes, vacías si no declaró nada. */
  readonly coverages: readonly OwnCoverage[];
  readonly guardians: readonly OwnGuardian[];
}

/**
 * Lo que se puede corregir de {@link OwnPatientProfile}
 * (`PATCH /profiles/patients/me`).
 *
 * Es un subconjunto **cerrado**: el backend valida con `forbidNonWhitelisted`,
 * así que una clave de más —`displayName`, `patientCode`, `identityVerified`—
 * no es un campo ignorado, es un `400`. Por eso el tipo se declara aparte y no
 * como `Partial<OwnPatientProfile>`.
 *
 * Un campo presente con `''` **borra** el dato: el segundo nombre y el apellido
 * materno se vacían cuando la persona descubre que no lleva ninguno. Ausente y
 * vacío no son lo mismo, y quien arme los cambios tiene que respetar esa
 * diferencia.
 */
export interface OwnPatientProfileChanges {
  readonly name?: string;
  readonly middleName?: string;
  readonly lastName?: string;
  readonly motherLastName?: string;
  /** Se serializa a `YYYY-MM-DD` en la frontera; acá es una fecha de verdad. */
  readonly birthDate?: Date;
  readonly sexAtBirth?: BirthSexCode;
  readonly occupationFreeText?: string;
  /**
   * Ocupación por concepto de `VS_BO_OCCUPATION`.
   *
   * Un uuid la asigna y **el catálogo gana**: el backend deja
   * `occupationFreeText` en `null`, así que no hay forma de quedarse con las
   * dos. `''` la vacía, como en cualquier otro campo de este contrato. Un uuid
   * que no exista en el catálogo vuelve `422`.
   */
  readonly occupationConceptId?: string;
  readonly phone?: string;
  readonly residenceMunicipalityConceptId?: string;
  /**
   * NIT de facturación (registro · PACIENTE §1.15.2). `''` lo quita.
   *
   * Se declaraba al registrarse y el editor no lo ofrecía: la ficha mostraba el
   * valor viejo y no había forma de corregirlo.
   */
  readonly taxId?: string;
  /** A nombre de quién sale el comprobante. Viaja CON el NIT. `''` la quita. */
  readonly taxHolderName?: string;
  /**
   * El texto del domicilio (§1.8) y el de la dirección de trabajo (§1.10).
   *
   * El municipio viaja aparte, por `residenceMunicipalityConceptId`, porque
   * sale de un catálogo. `''` quita la dirección.
   */
  readonly homeAddressLines?: string;
  readonly workAddressLines?: string;
  /**
   * El punto en el mapa de cada dirección.
   *
   * Antes no existían y el comentario de este bloque decía que «las coordenadas
   * las conserva el backend de la dirección anterior» — que es otra forma de
   * decir que **el paciente no tenía cómo cambiarlas**: el alta las manda una
   * vez y después quedaban congeladas para siempre, aunque se mudara.
   *
   * Van de a pares y nunca sueltas: media coordenada no ubica nada. Para
   * **quitar** el punto se mandan los dos en `null`, que es una afirmación
   * distinta de no mandarlos —eso es «no lo toqué»—.
   */
  readonly homeLatitude?: number | null;
  readonly homeLongitude?: number | null;
  readonly workLatitude?: number | null;
  readonly workLongitude?: number | null;
}

/* ============================================================================
    La guía de profesionales (carril R2-1).
    ========================================================================== */

/** Una especialidad en la fila de la guía: lo justo para agrupar y rotular. */
export interface PractitionerListSpecialty {
  readonly specialtyConceptId: string;
  readonly isPrimary: boolean;
}

/**
 * Una fila de la guía de profesionales.
 *
 * Datos de presentación —lo que una guía médica publica—, nunca PHI. **No hay
 * teléfono**: el modelo no declara un teléfono profesional con marca de
 * visibilidad, y derivarlo de los datos de la persona publicaría un dato
 * personal. Es un bloqueador declarado del carril del modelo, no un olvido.
 */
export interface PractitionerListItem {
  /** Con este id se abre la ficha. */
  readonly profileId: string;
  readonly practitionerCode: string;
  readonly displayName?: string;
  readonly professionalTitle?: string;
  readonly photoFileId?: string;
  readonly verificationStatusConceptId: string;
  /**
   * Si la plataforma verificó su matrícula.
   *
   * Lo resuelve el servidor: comparar el concepto acá exigiría llevar su uuid
   * escrito en el cliente. La guía lista el padrón entero —quien se registra
   * declara una matrícula, no la prueba— y esto distingue a quien la probó.
   */
  readonly verified: boolean;
  readonly acceptsNewPatients: boolean;
  readonly telehealthAvailable: boolean;
  /** Sólo las vigentes, la principal primero. */
  readonly specialties: readonly PractitionerListSpecialty[];
  /**
   * Dónde atiende, en palabras.
   *
   * Texto plano porque es lo que el modelo guarda: la afiliación tiene el
   * nombre de la organización —con la dirección pegada, tal como vino del
   * padrón— y casi ninguna apunta a una sede registrada. Sólo las publicables.
   */
  readonly workplaces: readonly string[];
}

/**
 * Una página de la guía.
 *
 * Cursor sin total, como todos los listados del sistema: `nextCursor` en
 * `null` significa que no hay más — la ausencia acá SÍ es información.
 */
/**
 * Cuántos profesionales visibles ejerce una especialidad.
 *
 * Sale de `GET /profiles/practitioners/specialty-counts`, que aplica los mismos
 * filtros que el listado: el número de una tarjeta es el largo de la lista que
 * abre.
 */
export interface SpecialtyPractitionerCount {
  readonly specialtyConceptId: string;
  readonly practitionerCount: number;
}

/** El recuento de la guía por especialidad, con el total sin repetir. */
export interface SpecialtyCounts {
  readonly items: readonly SpecialtyPractitionerCount[];
  /**
   * Profesionales visibles sin repetir. **No es la suma de `items`**: quien
   * ejerce tres especialidades cuenta una vez acá y tres entre las tarjetas.
   */
  readonly practitionerTotal: number;
  /**
   * Cuántos no declaran ninguna especialidad vigente.
   *
   * La portada les da su propia tarjeta: quien recorre la guía por especialidad
   * no llega nunca a quien no tiene ninguna, y así nace **todo el que se
   * registra solo** — los médicos con cuenta, que son justamente los que
   * atienden por la app.
   */
  readonly withoutSpecialtyCount: number;
}

export interface PractitionerDirectoryPage {
  readonly items: readonly PractitionerListItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/**
 * Una etapa del alta del profesional (TJ-1).
 *
 * `missing` viene en claves estables y no en prosa: el texto que lee la persona
 * es del front, y la API dice **qué** falta, no cómo pedírselo.
 */
export interface OnboardingStep {
  readonly key: OnboardingStepKey;
  readonly complete: boolean;
  readonly missing: readonly string[];
}

/** Las cinco etapas, en el orden en que se recorren. */
export type OnboardingStepKey =
  'professional-data' | 'photo' | 'organizations' | 'schedule' | 'review';

/**
 * En qué punto del alta está el profesional.
 *
 * No hay «paso guardado»: el servidor lo **deriva** de los datos que ya
 * existen, así que volver a entrar recalcula y aterriza donde corresponde.
 */
export interface PractitionerOnboarding {
  readonly practitionerProfileId: string;
  readonly steps: readonly OnboardingStep[];
  readonly firstIncomplete: OnboardingStepKey | 'done';
}

/**
 * Un establecimiento del padrón oficial, para elegir dónde se trabaja.
 *
 * El municipio **no es decoración**: el padrón repite nombres —cuatro «SAN
 * LUIS», tres «EL CARMEN»— y sólo el municipio los separa. Una lista que lo
 * omitiera mostraría opciones idénticas.
 */
export interface LinkableOrganization {
  /** El concepto del establecimiento en el catálogo. */
  readonly facilityConceptId: string;
  /** Código del padrón, el que un humano puede cotejar. */
  readonly code: string;
  /** Nombre canónico. Es el que conviene guardar como institución. */
  readonly name: string;
  /** Municipio donde está. */
  readonly municipality: string | null;
  /** `CLINICA_PRIVADA`, `HOSPITAL`, `CAJA_SALUD`, `CENTRO_SALUD`… */
  readonly type: string | null;
  /** Dirección declarada en el padrón. */
  readonly address: string | null;
}

/** Resultado de buscar en el padrón. Sin cursor: es un autocompletar. */
export interface LinkableOrganizationPage {
  readonly items: readonly LinkableOrganization[];
  readonly count: number;
  readonly limit: number;
}
