/**
 * Tipos de la vista para `iam`. **No son los DTOs de la API**: se mapean en el
 * cliente. Que la API devuelva una fecha como texto ISO es asunto del
 * transporte, no de la pantalla.
 */

import type { NewOwnSite } from '../practice-sites/practice-sites.types';

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
   *
   * **Obligatorio**, como en el DTO del servidor: `RegisterPatientDto` lo
   * declara sin `@IsOptional`, así que un alta sin él vuelve con 400. El tipo lo
   * decía opcional, y esa asimetría hacía que el compilador aceptara construir
   * un alta que la API iba a rechazar — un error que sólo aparecía en runtime.
   */
  readonly residenceMunicipalityConceptId: string;
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
   * **El alta lo vuelve a mandar** (AC-03-1): la página del trabajo pregunta la
   * empresa *y* dónde queda. El JSDoc anterior decía que este formulario «ya no
   * lo manda», y era cierto durante el tiempo en que la empresa reemplazó a la
   * ubicación; el propietario la volvió a pedir y el contrato nunca dejó de
   * aceptarla.
   */
  readonly workMunicipalityConceptId?: string;
  /** Calle y número del lugar de trabajo. Ver {@link PatientRegistration.workMunicipalityConceptId}. */
  readonly workAddressLines?: string;
  /**
   * Latitud del trabajo.
   *
   * Mismo par completo que el domicilio, y sólo viaja si la persona confirmó el
   * punto sobre el mapa. Ver {@link PatientRegistration.workMunicipalityConceptId}.
   */
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
   * Qué es esa persona del paciente: madre, cónyuge, amistad…
   *
   * Concepto del conjunto `related-person-relationship`, que gobierna
   * `profiles.related_persons.relationship_concept_id` y se lee por campo
   * destino (`?target=`). Es un uuid, no un código legible: el cliente ya lee la
   * enumeración para poblar su desplegable, así que devuelve el identificador
   * que esa misma lectura le dio.
   *
   * No se manda sin `guardianName`, por lo mismo que el teléfono: un parentesco
   * sin persona no describe a nadie. Ausente, el backend escribe «tutor o
   * representante legal», que es lo que escribía antes de que existiera.
   */
  readonly guardianRelationshipConceptId?: string;
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
   */
  readonly billingTaxId?: string;
  /**
   * Nombre o Razón Social asociada al NIT para la emisión de facturas.
   */
  readonly billingLegalName?: string;
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

  /**
   * Calle, número y referencia del domicilio.
   *
   * Los mismos tres campos que {@link PatientRegistration} ya declara, con el
   * mismo significado — la localidad ubica, esto es lo que hace falta para
   * llegar a la puerta.
   *
   * **La API todavía no los acepta.** `RegisterPractitionerDto` declara sólo
   * `residenceMunicipalityConceptId`, y con `forbidNonWhitelisted: true` una
   * clave que no declara rechaza el alta entera con 400. Van acá porque el
   * simulador de la rama `mockup` sí los guarda y la pantalla ya los pregunta;
   * lo que falta está anotado en `PENDIENTES-BACKEND.md`.
   */
  readonly homeAddressLines?: string;

  /**
   * Latitud del domicilio, confirmada sobre el mapa.
   *
   * Viaja **con** {@link homeLongitude} o no viaja: media coordenada no ubica
   * nada. Sólo se manda lo confirmado — ver `app-ubicacion-picker`.
   */
  readonly homeLatitude?: number;

  /** Longitud del domicilio. Ver {@link homeLatitude}. */
  readonly homeLongitude?: number;

  /**
   * El consultorio propio, si declaró uno al registrarse.
   *
   * Es el mismo cuerpo que ya recibe `POST /practitioners/me/sites`
   * (ALV-005/006), reutilizado a propósito: el alta pública no puede llamar a
   * esa ruta —termina en el login, sin sesión— así que el dato viaja adentro
   * del alta y el backend usa el servicio que ya tiene.
   *
   * **La API todavía no lo acepta**; ver `PENDIENTES-BACKEND.md`.
   */
  readonly ownSite?: NewOwnSite;

  readonly licenseNumber: string;
  /**
   * Registro del SEDES: la habilitación departamental.
   *
   * Reemplaza a `credentialNumber` en el alta. Aquél archivaba este número como
   * título de grado y el perfil lo mostraba como «Título universitario»; ahora
   * viaja como lo que es y nace como una segunda autorización, al lado de la
   * matrícula nacional.
   */
  readonly sedesLicenseNumber: string;
  /** Autoridad que emitió la matrícula: Ministerio de Salud y Deportes, Colegio de Odontólogos, etc. */
  readonly regulatoryAuthority?: string;
  /** Fecha de inscripción de la matrícula, ISO `YYYY-MM-DD`. */
  readonly licenseIssueDate?: string;
  readonly professionalTitle?: string;
  /**
   * Forma anterior de declarar el teléfono, hoy el del trabajo.
   *
   * El backend la conserva por compatibilidad y la guarda donde el fijo del
   * consultorio. El alta ya no la manda: usa los cuatro campos de abajo.
   *
   * @deprecated Preferí {@link workLandline} o {@link workMobilePhone}.
   */
  readonly phone?: string;
  /** Celular personal; el número por el que se contacta a la persona. */
  readonly mobilePhone?: string;
  /** Celular del trabajo; el que ve quien consulta su ficha. */
  readonly workMobilePhone?: string;
  /** Fijo del trabajo, la línea del consultorio. */
  readonly workLandline?: string;
  /**
   * Correo personal, en su rol de dato de contacto suelto.
   *
   * Ojo: el alta de profesional **ya no lo usa** — desde el cambio de identidad
   * de acceso, el correo personal ES el de acceso y por eso viaja en
   * {@link email}. Queda declarado para los llamadores que separen ambos.
   */
  readonly personalEmail?: string;
  /**
   * Correo del trabajo, el institucional. Es un dato de contacto: **no** sirve
   * para entrar.
   *
   * Pendiente en la API: `RegisterPractitionerDto` todavía no lo declara —y
   * documenta lo contrario, que el de trabajo es el login—, así que con
   * `forbidNonWhitelisted` rechazaría el alta. Tiene que aceptarlo antes de que
   * esto llegue a `dev`. El backend ya sabe guardarlo por uso
   * (`CONTACT_USE_WORK`) y lo devuelve como `workEmail` al leer el perfil.
   */
  readonly workEmail?: string;
  /**
   * Sexo asignado al nacer. Es dato clínico, distinto del género.
   *
   * El DTO del backend lo acepta desde siempre (`RegisterPractitionerDto`); lo
   * que faltaba era **preguntarlo** en el formulario, y eso es AC-05-7 de la
   * TAREA 05. Mismos dos códigos que el alta de paciente: son los que el
   * documento de identidad boliviano registra.
   */
  readonly sexAtBirth?: BirthSexCode;
  /** Foto de perfil en formato Base64 (Data URI o base64 plano). */
  readonly profilePhotoBase64?: string;
  /** Ocupación del catálogo (VS_BO_OCCUPATION). */
  readonly occupationConceptId?: string;
  /** Ocupación en texto libre, para cuando no está en el catálogo. */
  readonly occupationFreeText?: string;
  /**
   * Los títulos académicos declarados en el alta (subtarea 1.6).
   *
   * Cada elemento es una credencial: el alta las crea en la misma transacción
   * que la cuenta y el perfil. **No se manda junto con un `credentialNumber`
   * suelto**: la API responde 422 porque no sabría si es el mismo título dos
   * veces.
   */
  readonly credentials?: readonly NewRegistrationCredential[];
}

/**
 * Un título declarado en el alta pública.
 *
 * Es el subconjunto que el alta persiste por fila. El nombre del título, el
 * país y la ciudad **no viajan** porque el contrato no los almacena.
 */
export interface NewRegistrationCredential {
  /** Uno de los cinco `CREDENTIAL_TYPE_*` del catálogo, por concept id. */
  readonly credentialTypeConceptId: string;
  /** Número o código del diploma. Obligatorio: la columna es NOT NULL. */
  readonly number: string;
  /** Dónde se cursó, como texto libre. */
  readonly issuingInstitutionText?: string;
  /** PDF ya subido anónimamente y reclamado al crear la cuenta. */
  readonly fileId?: string;
}

export interface RegisteredPractitioner {
  readonly userId: string;
  readonly personId: string;
  readonly practitionerProfileId: string;
  readonly practitionerCode: string;
  readonly photoFileId?: string;
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
  /**
   * Tipo societario del diccionario internacional (subtarea 1.1), p. ej.
   * `SRL`, `US_LLC`. El backend deriva de él el país de constitución cuando
   * no se declara `countryConceptId` (que `PAYER` no exige: no es un tipo
   * territorial).
   */
  readonly legalEntityType: string;
  readonly tradeName?: string;
  readonly timeZone?: string;
  readonly payer: {
    readonly carrierCode: string;
    readonly regulatorIdentifier: string;
    readonly sigla: string;
    readonly address: string;
    /**
     * Coordenadas de la casa matriz (subtarea 1.3). Ambas o ninguna: el
     * backend rechaza con 400 una sola de las dos (`PayerProfileDto`).
     */
    readonly latitude?: number;
    readonly longitude?: number;
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
  /**
   * Documentos legales de afiliación en PDF (subtarea 1.2), ya subidos por
   * `IamClient.uploadRegistrationDocument`. Opcional en el contrato —igual
   * que `legalEntityType`—; obligatorio en el formulario público.
   */
  readonly legalDocuments?: OrganizationLegalDocuments;
  /**
   * El representante legal de la organización, con su poder notariado
   * (subtarea 1.4). Va acá y no dentro de `payer`: el registro de procesos
   * repite el mismo bloque para farmacia, laboratorio e imagenología — es
   * onboarding del tenant, no de la aseguradora. Opcional en el contrato,
   * obligatorio en el formulario.
   */
  readonly legalRepresentative?: OrganizationLegalRepresentative;
  /**
   * Las tres gerencias de contacto (subtarea 1.4). Ver
   * {@link OrganizationRegistration.legalRepresentative}.
   */
  readonly executives?: OrganizationExecutives;
}

/** Nombre, celular y correo de una gerencia de contacto (subtarea 1.4). */
export interface OrganizationContactPerson {
  readonly fullName: string;
  readonly phone: string;
  readonly email: string;
}

/** El representante legal declarado en el alta, con su poder notariado ya subido. */
export interface OrganizationLegalRepresentative {
  readonly fullName: string;
  readonly idNumber: string;
  readonly email: string;
  /** Opcional: el registro de procesos no lo pide, pero si se captura no se tira. */
  readonly phone?: string;
  /** `fileId` del poder, ya subido por `IamClient.uploadRegistrationDocument`. */
  readonly powerOfAttorneyFileId: string;
}

/** Las tres gerencias de contacto de la organización (subtarea 1.4). */
export interface OrganizationExecutives {
  readonly generalManager: OrganizationContactPerson;
  readonly commercialManager: OrganizationContactPerson;
  readonly marketingManager: OrganizationContactPerson;
}

/**
 * Los cinco documentos que el registro de procesos exige (1.1.2 · 1.2.1 ·
 * 1.3 · 1.4 · 1.5): cada valor es el `fileId` de una pre-carga ya subida.
 */
export interface OrganizationLegalDocuments {
  readonly constitutionFileId: string;
  readonly taxIdentifierFileId: string;
  readonly commerceRegistryFileId: string;
  readonly operatingLicenseFileId: string;
  readonly healthAuthorityCertificateFileId: string;
}

/** Lo que devuelve la pre-carga de un documento legal, listo para reenviar en el alta. */
export interface UploadedRegistrationDocument {
  readonly fileId: string;
  readonly originalName: string;
  readonly sizeBytes: number;
  readonly mimeType: string;
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
  /**
   * Cuántos documentos legales quedaron registrados, pendientes de
   * verificación. Ausente si el alta no declaró `legalDocuments`.
   */
  readonly legalDocumentsRegistered?: number;
  /**
   * Cuántos vínculos de representación quedaron registrados —el representante
   * legal más las tres gerencias— (subtarea 1.4). Ausente si el alta no
   * declaró ninguno de los dos bloques.
   */
  readonly representativesRegistered?: number;
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
