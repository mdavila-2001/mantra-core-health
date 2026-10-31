/**
 * Pacientes para el **personal de apoyo**: búsqueda exacta y alta rápida
 * (`POST /me/support-patient-search` y `POST /me/support-patients`).
 *
 * La búsqueda es exacta —documento completo, teléfono completo, o nombre completo
 * con fecha de nacimiento— y cada intento queda auditado; lo parcial es 422
 * `SUPPORT_PATIENT_SEARCH_INEXACT` y pasarse de 20 por minuto o 200 por día, 429 con
 * `details: { limit: 'PER_MINUTE' | 'PER_DAY', scope: 'PERSON' | 'IP' }` (el tope por IP es otro
 * y se lo dice distinto a la persona). Si
 * llegan los dos nombres de un par (`tenantId`/`org`, `nationalId`/`document`) con valores
 * distintos, 400 `SUPPORT_PATIENT_INPUT_CONFLICT`.
 *
 * Lo que vuelve son **datos mínimos**: lo justo para reconocer a la persona
 * (nombre, edad, documento y teléfono enmascarados) y nada clínico.
 */

/** Cómo se busca. Nunca un texto suelto: siempre una de estas tres formas completas. */
export type ExactPatientQuery =
  | { readonly kind: 'DOCUMENT'; readonly document: string }
  | { readonly kind: 'PHONE'; readonly phone: string }
  | { readonly kind: 'NAME_BIRTH'; readonly fullName: string; readonly birthDate: string };

/** Quien puede actuar por un menor: su representante legal o un familiar autorizado. */
export interface PatientRepresentative {
  readonly id: string;
  readonly name: string;
  /** «Madre», «Padre», «Tutor legal», «Abuela autorizada»… */
  readonly relationship: string;
}

/** Un paciente encontrado, con datos mínimos. */
export interface SupportPatientMatch {
  /** `patient_profile_id`. */
  readonly profileId: string;
  readonly displayName: string;
  /** Documento con lo central tapado: `***556`. */
  readonly documentMasked: string;
  /** Teléfono con lo central tapado: `7*****67`. Ausente si no tiene. */
  readonly phoneMasked?: string;
  readonly ageYears: number;
  readonly isMinor: boolean;
  /** Solo en menores: quiénes pueden actuar por él. Vacío = sin representante registrado. */
  readonly representatives?: readonly PatientRepresentative[];
}

export interface SupportPatientSearchResult {
  readonly items: readonly SupportPatientMatch[];
  readonly count?: number;
}

/** El representante que se declara al registrar a un menor. */
export interface NewPatientGuardian {
  readonly name: string;
  readonly document: string;
  readonly phone: string;
  readonly relationship: string;
}

/**
 * Un posible duplicado al registrar. Si es **de la organización**, trae todo lo de un
 * paciente encontrado y permite decir «es esta persona». Si es **de otra organización**
 * (`linkedToOrganization: false`) la API no le da perfil —`profileId` ausente—, ni nombre
 * ni edad del registro ajeno: solo que existe alguien que coincide y con qué
 * (`matchedBy`: `DOCUMENT`, `NAME_AND_BIRTH_DATE`, `PHONE_AND_SURNAME`), así que
 * **no se puede usar**: la pantalla no ofrece «Es esta persona».
 */
export interface PossibleDuplicate extends Omit<SupportPatientMatch, 'profileId' | 'ageYears'> {
  readonly profileId?: string;
  readonly ageYears?: number;
  readonly linkedToOrganization: boolean;
  readonly matchedBy: readonly string[];
}

/**
 * Cómo quedó anotado quien acompaña a un menor registrado en el mostrador. **No** es un
 * representante legal: la API lo guarda como persona relacionada y **pendiente de
 * verificación** (`PENDING_VERIFICATION`). La representación legal la establece la
 * organización con un documento, o la acepta el propio representante desde su cuenta. La
 * respuesta es la misma exista o no una cuenta con el documento que se escribió.
 */
export interface GuardianRecorded {
  readonly recorded: true;
  readonly status: 'PENDING_VERIFICATION';
}

/** Alta rápida de un paciente nuevo. */
export interface NewSupportPatient {
  readonly name: string;
  readonly lastName: string;
  readonly motherLastName?: string;
  readonly document: string;
  /** `YYYY-MM-DD`. */
  readonly birthDate: string;
  readonly phone: string;
  /** Obligatorio si es menor de 18 años. */
  readonly guardian?: NewPatientGuardian;
  /** Si se le manda una invitación para que active su cuenta de paciente. */
  readonly inviteToPortal: boolean;
  /** `true` cuando quien registra ya vio los posibles duplicados y sigue de todos modos. */
  readonly acknowledgeDuplicates?: boolean;
}

export type SupportPatientRegistration =
  | {
      readonly outcome: 'CREATED';
      readonly patient: SupportPatientMatch;
      /** `true` solo quiere decir que la invitación quedó **encolada**, no que llegó. */
      readonly invitationSent: boolean;
      /** El paciente nace con la identidad **sin verificar**: lo escribió el mostrador y nadie comprobó el documento. */
      readonly identityVerified: false;
      /** Solo con un menor: el representante quedó anotado como contacto pendiente de verificación. */
      readonly guardian?: GuardianRecorded;
    }
  | { readonly outcome: 'POSSIBLE_DUPLICATES'; readonly duplicates: readonly PossibleDuplicate[] };
