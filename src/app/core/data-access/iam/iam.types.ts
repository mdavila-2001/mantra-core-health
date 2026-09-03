/**
 * Tipos de la vista para `iam`. **No son los DTOs de la API**: se mapean en el
 * cliente. Que la API devuelva una fecha como texto ISO es asunto del
 * transporte, no de la pantalla.
 */

/**
 * Credenciales de inicio de sesión.
 *
 * Unión discriminada y no un objeto con dos campos opcionales porque el backend
 * exige **uno u otro identificador, nunca ambos** (`LoginDto` valida el correo
 * sólo cuando no vino documento). Con dos opcionales, mandar los dos compilaría
 * y fallaría recién contra el servidor; así no se puede ni escribir.
 */
export type LoginCredentials =
  | {
      readonly kind: 'email';
      /** Alta por correo: personal y administradores. */
      readonly email: string;
      readonly password: string;
      readonly mfaCode?: string;
    }
  | {
      readonly kind: 'nationalId';
      /** Documento de identidad: pacientes auto-registrados. */
      readonly nationalId: string;
      readonly password: string;
      readonly mfaCode?: string;
    };

/** Sesión abierta. `expiresAt` ya es una fecha, no el texto ISO del transporte. */
export interface Session {
  readonly accessToken: string;
  /** Se entrega una sola vez: si se pierde, hay que volver a iniciar sesión. */
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

/** Alta de un paciente por sí mismo. El identificador de acceso es el documento. */
export interface PatientRegistration {
  readonly nationalId: string;
  readonly password: string;
  /** Nombre de pila. */
  readonly name: string;
  /** Segundo nombre. Opcional: mucha gente no tiene. */
  readonly middleName?: string;
  /** Apellido paterno. */
  readonly lastName: string;
  /** Apellido materno. Opcional: no todas las jurisdicciones lo emiten. */
  readonly motherLastName?: string;
  /** Opcional y no condiciona el acceso: la cuenta queda usable igual. */
  readonly email?: string;
  /** Fecha en formato ISO `YYYY-MM-DD`, tal como la valida el backend. */
  readonly birthDate?: string;
  /**
   * Departamento boliviano que emitió el documento (catálogo VS_BO_DEPARTMENT).
   *
   * Va atado al identificador y no a la persona: es el «SC», «LP»… de ESA
   * cédula, lo que distingue dos documentos homónimos de departamentos
   * distintos. Sin `nationalId` no tiene a qué atarse.
   */
  readonly issuerAdministrativeAreaConceptId?: string;
  /**
   * Municipio de residencia (catálogo `VS_BO_MUNICIPALITY`).
   *
   * Viaja **solo**, sin el departamento: el código del INE de un municipio
   * lleva adentro el de su departamento, así que el backend lo deriva y escribe
   * los dos en `common.addresses`. Mandar el par desde acá abriría la puerta a
   * que llegara incoherente —el municipio de uno con el departamento de otro— y
   * no habría criterio para decidir cuál gana.
   */
  readonly residenceMunicipalityConceptId?: string;
  /** Teléfono de contacto, en E.164 o formato nacional. */
  readonly phone?: string;
  /** Género administrativo (HL7 AdministrativeGender). */
  readonly gender?: AdministrativeGenderCode;
  /** Sexo asignado al nacer. Es dato clínico, distinto del género. */
  readonly sexAtBirth?: BirthSexCode;
  /**
   * Ocupación, como concepto de `VS_BO_OCCUPATION`.
   *
   * **Ya es un catálogo.** Lo siembra `BoOccupationsSeedService` en la API y lo
   * lee `BoOccupationsCatalog`; el alta manda el uuid del concepto elegido.
   * Antes iba en `occupationFreeText` porque el conjunto no existía en ninguna
   * base, y cada persona escribía su oficio a mano.
   */
  readonly occupationConceptId?: string;
  /**
   * Ocupación en texto libre, el respaldo de «no está en la lista».
   *
   * El backend lo ignora si viene `occupationConceptId`, así que los dos nunca
   * viajan juntos: el alta manda **éste y no el concepto** cuando se eligió
   * «Otra ocupación» —de los dos datos, el que describe un oficio es el que la
   * persona escribió—, y sólo el concepto en cualquier otro caso.
   */
  readonly occupationFreeText?: string;
  /** Calle y número del domicilio, tal como lo escribe la persona. */
  readonly homeAddressLines?: string;
  /**
   * Latitud del domicilio.
   *
   * El par va completo o no va: media coordenada no ubica nada y el backend
   * rechaza el par incompleto.
   */
  readonly homeLatitude?: number;
  /** Longitud del domicilio. Ver {@link PatientRegistration.homeLatitude}. */
  readonly homeLongitude?: number;
  /**
   * Empresa donde trabaja, como concepto de `VS_BO_EMPLOYER`.
   *
   * **Reemplaza a la ubicación del trabajo** en el alta: preguntar municipio,
   * calle y coordenadas del trabajo eran tres campos para un dato que casi
   * nadie completaba y que no agrupaba a nadie. El empleador es una sola
   * pregunta, se sabe de memoria, y sí agrupa —salud ocupacional, convenios—.
   *
   * Lo siembra `BoEmployersSeedService` en la API y lo lee
   * {@link BoEmployersCatalog}; el alta manda el uuid del concepto elegido.
   */
  readonly workEmployerConceptId?: string;
  /**
   * La empresa escrita a mano, para «no está en la lista».
   *
   * Viaja **sólo** cuando se eligió el concepto `employer:bo:OTRA`: el catálogo
   * cubre a los empleadores grandes del país, y el resto —que en Bolivia es la
   * mayoría de las unidades económicas— se escribe. Ver `bo-employers.catalog.ts`
   * en la API sobre por qué el catálogo no puede ser exhaustivo.
   */
  readonly workEmployerFreeText?: string;
  /**
   * Municipio del lugar de trabajo (catálogo `VS_BO_MUNICIPALITY`).
   *
   * Sigue en el contrato porque otros clientes lo usan; **este formulario ya no
   * lo manda**, desde que la página del trabajo pregunta la empresa.
   */
  readonly workMunicipalityConceptId?: string;
  /** Calle y número del lugar de trabajo. Ver {@link PatientRegistration.workMunicipalityConceptId}. */
  readonly workAddressLines?: string;
  /** Latitud del trabajo. Mismo par completo que el domicilio, y tampoco lo manda ya el alta. */
  readonly workLatitude?: number;
  /** Longitud del trabajo. */
  readonly workLongitude?: number;
  /** Nombre del tutor o persona autorizada que acompaña a la persona. */
  readonly guardianName?: string;
  /**
   * Teléfono del tutor.
   *
   * No se manda sin `guardianName`: sería un contacto sin dueño y el backend
   * lo rechaza.
   */
  readonly guardianPhone?: string;
  /**
   * Plan de la aseguradora privada que la persona declara tener.
   *
   * Viaja el **plan**, no la compañía: la cobertura del paciente apunta al plan
   * y varias compañías publican más de uno.
   */
  readonly privateInsurancePlanId?: string;
  /** Plan del seguro público declarado (CNS, CPS, SUS…). */
  readonly publicInsurancePlanId?: string;
  /**
   * NIT para facturación, sólo el número.
   *
   * La razón social no se pide todavía: el modelo no tiene dónde guardarla.
   */
  readonly billingTaxId?: string;
  readonly timeZone?: string;
}

/**
 * Códigos de género administrativo que acepta la API.
 *
 * Códigos legibles y no uuid del catálogo: los formularios públicos no conocen
 * los identificadores de terminología, y el backend los traduce
 * (`ADMIN_GENDER_CONCEPT_BY_CODE`).
 */
export type AdministrativeGenderCode = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';

/** Códigos de sexo al nacer que acepta la API. */
export type BirthSexCode = 'MALE' | 'FEMALE' | 'INTERSEX' | 'UNKNOWN';

export interface RegisteredPatient {
  readonly userId: string;
  readonly personId: string;
  readonly patientProfileId: string;
  readonly patientCode: string;
  /** `false` cuando no se aportó correo: no es un fallo. */
  readonly emailVerificationSent: boolean;
}

export interface VerifiedEmail {
  readonly userId: string;
  readonly emailVerified: boolean;
}

/** Activación de una cuenta creada por otra persona (registro asistido). */
export interface AccountActivation {
  readonly activationToken: string;
  readonly newPassword: string;
}

export interface ActivationResult {
  readonly userId: string;
  readonly status: string;
  readonly activated: boolean;
}

/**
 * Alta de un profesional por sí mismo.
 *
 * A diferencia del paciente, acá el **correo es obligatorio** —es su
 * identificador de acceso— y hacen falta las dos credenciales que lo habilitan:
 * la matrícula y el número del colegio. Un profesional sin habilitación
 * comprobable no es un profesional.
 */
export interface PractitionerRegistration {
  readonly email: string;
  readonly password: string;
  /**
   * Las especialidades elegidas EN el alta (hasta 3; la primera queda como
   * principal). El registro del cliente las pide junto a la profesión — módulo
   * Médico §1.4.2 — y hasta ahora sólo se podían declarar después, desde el
   * perfil, adonde la mayoría no volvía.
   */
  readonly specialtyConceptIds?: readonly string[];
  /** Nombre de pila. */
  readonly name: string;
  /** Segundo nombre. Opcional: mucha gente no tiene. */
  readonly middleName?: string;
  /** Apellido paterno. */
  readonly lastName: string;
  /** Apellido materno. Opcional: no todas las jurisdicciones lo emiten. */
  readonly motherLastName?: string;
  /** Fecha en formato ISO `YYYY-MM-DD`, tal como la valida el backend. */
  readonly birthDate?: string;
  /** Documento de identidad. Se guarda como identificador oficial, no como login. */
  readonly nationalId?: string;
  /** Departamento boliviano que emitió el documento (catálogo VS_BO_DEPARTMENT). */
  readonly issuerAdministrativeAreaConceptId?: string;
  /**
   * Municipio de residencia (catálogo `VS_BO_MUNICIPALITY`).
   *
   * Viaja **solo**, sin el departamento: el código del INE de un municipio
   * lleva adentro el de su departamento, así que el backend lo deriva y escribe
   * los dos en `common.addresses`. Mandar el par desde acá abriría la puerta a
   * que llegara incoherente —el municipio de uno con el departamento de otro— y
   * no habría criterio para decidir cuál gana.
   */
  readonly residenceMunicipalityConceptId?: string;
  readonly licenseNumber: string;
  readonly credentialNumber: string;
  /** Autoridad que emitió la matrícula: Ministerio de Salud y Deportes, Colegio de Odontólogos, etc. */
  readonly regulatoryAuthority?: string;
  /** Fecha de inscripción de la matrícula, ISO `YYYY-MM-DD`. */
  readonly licenseIssueDate?: string;
  readonly professionalTitle?: string;
  readonly phone?: string;
  /**
   * Sexo asignado al nacer. Es dato clínico, distinto del género.
   *
   * El DTO del backend lo acepta desde siempre (`RegisterPractitionerDto`); lo
   * que faltaba era **preguntarlo** en el formulario, y eso es AC-05-7 de la
   * TAREA 05. Mismos dos códigos que el alta de paciente: son los que el
   * documento de identidad boliviano registra.
   */
  readonly sexAtBirth?: BirthSexCode;
}

export interface RegisteredPractitioner {
  readonly userId: string;
  readonly personId: string;
  readonly practitionerProfileId: string;
  readonly practitionerCode: string;
}

/**
 * Alta de una organización aseguradora por sí misma
 * (`POST /iam/auth/register-organization`).
 *
 * A diferencia del paciente y del profesional, acá nacen **dos cosas a la
 * vez**: el tenant `PAYER` y su usuario owner. El bloque `payer` es
 * obligatorio porque el backend lo exige siempre que el tipo es `PAYER` —la
 * misma regla que el alta administrativa (`NewTenant.payer`)—, y acá no hay
 * otro tipo posible: esta pantalla sólo da de alta aseguradoras.
 */
export interface OrganizationRegistration {
  readonly code: string;
  readonly legalName: string;
  readonly tradeName?: string;
  readonly timeZone?: string;
  readonly payer: {
    readonly carrierCode: string;
    readonly regulatorIdentifier: string;
    readonly sigla: string;
    readonly address: string;
  };
  readonly owner: {
    readonly email: string;
    readonly password: string;
    /** Nombre de pila. */
    readonly name: string;
    /** Segundo nombre. Opcional: mucha gente no tiene. */
    readonly middleName?: string;
    /** Apellido paterno. */
    readonly lastName: string;
    /** Apellido materno. Opcional: no todas las jurisdicciones lo emiten. */
    readonly motherLastName?: string;
  };
}

/** Lo que devuelve el alta de organización: el tenant y su owner recién creados. */
export interface RegisteredOrganization {
  readonly tenantId: string;
  readonly code: string;
  readonly ownerUserId: string;
  /** Concept id del estado del tenant, p. ej. `pending`. */
  readonly status: string;
  /** `false` cuando el owner no tiene correo pendiente de verificar: no es un fallo. */
  readonly emailVerificationSent: boolean;
}

/**
 * Resultado de pedir la recuperación.
 *
 * El backend devuelve **siempre lo mismo**, exista o no la cuenta: decir «ese
 * correo no está registrado» permitiría averiguar quién tiene cuenta probando
 * direcciones.
 */
/**
 * Lo que devuelve el reenvío de la verificación de correo.
 *
 * **El mensaje es siempre el mismo**, exista o no la cuenta: si cambiara,
 * el formulario se convertiría en una forma de averiguar qué correos están
 * registrados en el sistema.
 */
export interface VerificationResent {
  readonly message: string;
}

export interface PasswordResetRequested {
  readonly message: string;
}

/** Fijar la contraseña nueva con el token que llegó por correo. */
export interface PasswordReset {
  readonly token: string;
  readonly newPassword: string;
}

export interface PasswordResetResult {
  readonly userId: string;
  /** Sesiones que se cerraron al cambiar la contraseña. */
  readonly revokedSessions: number;
}

/**
 * Roles con los que puede nacer una cuenta creada por un administrador.
 *
 * Son **los dos que el backend acepta** (`@IsIn(['USER', 'SECURITY_ADMIN'])`), no
 * los 90 y pico del sistema: el resto se concede después, por su propia vía.
 */
export type InitialRole = 'USER' | 'SECURITY_ADMIN';

/** Alta de usuario hecha por un administrador (`POST /iam/users`, UC-01-01). */
export interface NewUser {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly phone?: string;
  readonly timeZone?: string;
  /** Ausente = `USER`, que es el valor con el que el backend completa. */
  readonly initialRole?: InitialRole;
}

/**
 * Lo que devuelve el alta de usuario. `status` es un **concept id**, no una
 * etiqueta: mostrarlo crudo sería exactamente lo que las convenciones prohíben
 * («en lectura se muestra siempre la etiqueta, nunca el UUID»).
 */
export interface CreatedUser {
  readonly id: string;
  readonly displayName: string;
  readonly statusConceptId: string;
  readonly createdAt: Date;
}

/**
 * Alta asistida de un paciente que no puede registrarse por sí mismo
 * (`POST /iam/users/assisted-registration`, C-18 / CAN-IDENT).
 *
 * **No lleva contraseña**: la fija el titular al activar. El `motivo` no es
 * burocracia — queda en la trazabilidad C-18, que es lo que justifica que
 * alguien haya creado una cuenta a nombre de otra persona.
 */
export interface AssistedPatientRegistration {
  /** Nombre de pila. */
  readonly name: string;
  /** Segundo nombre. Opcional: mucha gente no tiene. */
  readonly middleName?: string;
  /** Apellido paterno. */
  readonly lastName: string;
  /** Apellido materno. Opcional: no todas las jurisdicciones lo emiten. */
  readonly motherLastName?: string;
  readonly email: string;
  readonly reason: string;
  readonly timeZone?: string;
  /** Representación legal formal, si está registrada. */
  readonly legalRepresentationId?: string;
  /** El representante, cuando no hay representación formal cargada. */
  readonly legalRepresentativeUserId?: string;
}

/**
 * Resultado del alta asistida.
 *
 * El `activationToken` es **de un solo uso y se muestra una sola vez**: hay que
 * entregárselo al titular por un canal seguro. Nunca es una contraseña.
 */
export interface AssistedRegistrationResult {
  readonly userId: string;
  readonly activationToken: string;
  readonly activationExpiresAt: Date;
  /** Estado de la cuenta recién creada, p. ej. `PENDING_ACTIVATION`. */
  readonly status: string;
}

/**
 * Una fila del listado de usuarios (`GET /iam/users`, UC-01-01 cara de
 * lectura). La fila es angosta a propósito; la ficha completa vive en
 * `GET /iam/users/:id`.
 */
export interface UserListItem {
  readonly id: string;
  readonly displayName: string;
  readonly statusConceptId: string;
  readonly emailVerified: boolean;
  /** Ausente si nunca inició sesión. */
  readonly lastLoginAt?: Date;
  readonly createdAt: Date;
}

/** Página del listado de usuarios. Sin total: paginación por cursor. */
export interface UserPage {
  readonly items: readonly UserListItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Parámetros de `GET /iam/users`. Todos opcionales. */
export interface UserSearchQuery {
  /** Texto sobre el nombre visible o el correo de acceso. */
  readonly query?: string;
  readonly statusConceptId?: string;
  readonly cursor?: string;
  readonly limit?: number;
}
