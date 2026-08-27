/**
 * Simulación de **toda** la API para el recorrido visual.
 *
 * El arnés de Node (`cypress/harness/api-simulada.ts`) simula los endpoints que
 * los journeys funcionales necesitan, y hace bien en no simular más: una prueba
 * que declara respuestas que no usa esconde cuál le importa. El recorrido tiene
 * el problema opuesto —entra a las veinte pantallas, y cada una pide lo suyo—
 * así que acá están todas, con datos que se ven bien en una captura.
 *
 * ## Por qué acá sí se intercepta desde el navegador
 *
 * El recorrido no verifica el servidor: verifica **cómo se ve cada pantalla**.
 * Interceptar con `cy.intercept` deja declarar veinte respuestas en un archivo
 * sin que el arnés tenga que implementar veinte endpoints, y de paso permite que
 * una prueba pida un caso raro —identidad sin verificar, agenda vacía— sin
 * inventar un escenario de cookie por cada uno.
 *
 * ## Por qué los datos son fijos y no aleatorios
 *
 * Las capturas se comparan entre corridas: la de hoy contra la de la semana
 * pasada, para ver qué cambió en el diseño. Con nombres o fechas aleatorias
 * **todas** las capturas difieren siempre y la comparación no dice nada. Los
 * datos de acá son inventados pero constantes.
 *
 * ## Por qué las fechas se congelan
 *
 * Un `createdAt` que sale de `Date.now()` se imprime en la ficha del paciente y
 * cambia cada día, lo que vuelve a romper la comparación. Las fechas visibles
 * son literales; las únicas que se calculan son las del token, porque un `exp`
 * en el pasado haría que la sesión no arranque.
 */

/** base64url sobre UTF-8, como el token real. */
function b64(valor: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(valor));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Un access token con los claims que la interfaz lee.
 *
 * `exp` una hora adelante: sin él, el refresco proactivo del interceptor
 * dispararía en cada petición y el recorrido capturaría estados de carga en
 * lugar de pantallas.
 */
export function tokenDe(claims: Record<string, unknown> = {}): string {
  const payload = {
    sub: 'u-recorrido',
    sid: 's-recorrido',
    roles: ['PATIENT'],
    tenants: ['t-1'],
    name: 'Ana Salas',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

/** Roles con los que se ve el menú completo de administración. */
export const CLAIMS_ADMIN = {
  roles: ['SECURITY_ADMIN', 'PATIENT'],
  tenants: ['t-1', 't-2'],
  tenantNames: { 't-1': 'Clínica Norte', 't-2': 'Centro Sur' },
  name: 'Ana Salas',
} as const;

/* -- Datos de vitrina ------------------------------------------------------ */

/**
 * Estados de un caso de verificación, como UUID de concepto.
 *
 * El backend los emite así —UUIDv5 determinista de `identity_assurance`— y no
 * como `'APPROVED'`. La primera versión de este simulador usaba las palabras, y
 * el recorrido capturó la pantalla diciendo «Desconocido»: no era un defecto de
 * la pantalla, era el simulador mintiendo sobre la forma del dato. Los valores
 * son los mismos que mapea `features/identity-verification/case-status.ts`.
 */
const CASO_VERIFICADO = '6fb20fdf-1c92-502c-8e1f-54a9bb85ff98';
const CASO_EN_VERIFICACION = 'ba5a0b9d-8a27-5379-8662-eea142b98a22';

const CONCEPTOS = [
  { conceptId: 'c-gen-f', code: 'F', display: 'Femenino', codeSystemVersionId: 'csv-1' },
  { conceptId: 'c-gen-m', code: 'M', display: 'Masculino', codeSystemVersionId: 'csv-1' },
  { conceptId: 'c-est-act', code: 'ACTIVE', display: 'Activa', codeSystemVersionId: 'csv-2' },
  { conceptId: 'c-est-fin', code: 'DECEASED', display: 'Fallecida', codeSystemVersionId: 'csv-2' },
  { conceptId: 'c-abo-o', code: 'O', display: 'O', codeSystemVersionId: 'csv-3' },
  { conceptId: 'c-rh-pos', code: '+', display: 'Positivo', codeSystemVersionId: 'csv-4' },
  { conceptId: 'c-nac-bo', code: 'BO', display: 'Bolivia', codeSystemVersionId: 'csv-5' },
  { conceptId: 'c-idi-es', code: 'es', display: 'Español', codeSystemVersionId: 'csv-6' },
  { conceptId: 'c-seg-si', code: 'INSURED', display: 'Con seguro', codeSystemVersionId: 'csv-7' },
  { conceptId: 'c-vin-ok', code: 'LINKED', display: 'Vinculado', codeSystemVersionId: 'csv-8' },
  { conceptId: 'c-rel-mad', code: 'MOTHER', display: 'Madre', codeSystemVersionId: 'csv-9' },
  { conceptId: 'c-rel-her', code: 'SIBLING', display: 'Hermano/a', codeSystemVersionId: 'csv-9' },
  // Agenda y expediente. Sin estos, las capturas de las dos secciones nuevas
  // dirían «Sin registrar» en cada estado y se leerían como una pantalla rota.
  {
    conceptId: 'c-rec-cons',
    code: 'CONSULT_ROOM',
    display: 'Consultorio',
    codeSystemVersionId: 'csv-10',
  },
  {
    conceptId: 'c-rec-sala',
    code: 'PROCEDURE_ROOM',
    display: 'Sala',
    codeSystemVersionId: 'csv-10',
  },
  {
    conceptId: 'c-cit-conf',
    code: 'CONFIRMED',
    display: 'Confirmada',
    codeSystemVersionId: 'csv-11',
  },
  { conceptId: 'c-cit-pend', code: 'PENDING', display: 'Pendiente', codeSystemVersionId: 'csv-11' },
  { conceptId: 'c-cup-abierto', code: 'OPEN', display: 'Abierto', codeSystemVersionId: 'csv-12' },
  { conceptId: 'c-cup-lleno', code: 'FULL', display: 'Completo', codeSystemVersionId: 'csv-12' },
  {
    conceptId: 'c-dx-hta',
    code: 'I10',
    display: 'Hipertensión esencial',
    codeSystemVersionId: 'csv-13',
  },
  { conceptId: 'c-alg-pen', code: 'PEN', display: 'Penicilina', codeSystemVersionId: 'csv-14' },
  { conceptId: 'c-crit-alta', code: 'HIGH', display: 'Alta', codeSystemVersionId: 'csv-15' },
  {
    conceptId: 'c-obs-peso',
    code: '29463-7',
    display: 'Peso corporal',
    codeSystemVersionId: 'csv-16',
  },
  { conceptId: 'c-obs-final', code: 'FINAL', display: 'Final', codeSystemVersionId: 'csv-17' },
  { conceptId: 'c-uni-kg', code: 'kg', display: 'kg', codeSystemVersionId: 'csv-18' },
  {
    conceptId: 'c-nota-firmada',
    code: 'SIGNED',
    display: 'Firmada',
    codeSystemVersionId: 'csv-19',
  },
  {
    conceptId: 'c-rel-tratante',
    code: 'ATTENDING',
    display: 'Médico tratante',
    codeSystemVersionId: 'csv-20',
  },
];

const PACIENTES = [
  {
    profileId: 'p-001',
    personId: 'per-001',
    patientCode: 'PAC-00001',
    displayName: 'Andrea Peña Rojas',
    birthDate: '1988-03-14',
    personStatusConceptId: 'c-est-act',
    deceased: false,
  },
  {
    profileId: 'p-002',
    personId: 'per-002',
    patientCode: 'PAC-00002',
    displayName: 'Bruno Salas Vargas',
    birthDate: '1975-11-02',
    personStatusConceptId: 'c-est-act',
    deceased: false,
  },
  {
    profileId: 'p-003',
    personId: 'per-003',
    patientCode: 'PAC-00003',
    displayName: 'Carla Ruiz Mamani',
    birthDate: '1992-07-25',
    personStatusConceptId: 'c-est-act',
    deceased: false,
  },
  {
    profileId: 'p-004',
    personId: 'per-004',
    patientCode: 'PAC-00004',
    displayName: 'Diego Mamani Quispe',
    birthDate: '1960-01-09',
    personStatusConceptId: 'c-est-fin',
    deceased: true,
  },
  {
    profileId: 'p-005',
    personId: 'per-005',
    patientCode: 'PAC-00005',
    displayName: 'Elena Vaca Terrazas',
    birthDate: '2001-05-30',
    personStatusConceptId: 'c-est-act',
    deceased: false,
  },
];

const FICHA = {
  profileId: 'p-001',
  personId: 'per-001',
  patientCode: 'PAC-00001',
  masterPatientIndexCode: 'MPI-77120',
  displayName: 'Andrea Peña Rojas',
  birthDate: '1988-03-14',
  administrativeGenderConceptId: 'c-gen-f',
  sexAtBirthConceptId: 'c-gen-f',
  nationalityConceptId: 'c-nac-bo',
  preferredLanguageConceptId: 'c-idi-es',
  personStatusConceptId: 'c-est-act',
  aboGroupConceptId: 'c-abo-o',
  rhFactorConceptId: 'c-rh-pos',
  insuranceStatusConceptId: 'c-seg-si',
  clinicalLanguageConceptId: 'c-idi-es',
  recordLinkageStatusConceptId: 'c-vin-ok',
  relatedPersons: [
    {
      id: 'rp-1',
      displayName: 'Marta Rojas Céspedes',
      relationshipConceptId: 'c-rel-mad',
      isEmergencyContact: true,
      isLegalGuardian: true,
    },
    {
      id: 'rp-2',
      displayName: 'Iván Peña Rojas',
      relationshipConceptId: 'c-rel-her',
      isEmergencyContact: true,
      isLegalGuardian: false,
    },
  ],
  createdAt: '2026-01-15T10:30:00.000Z',
  updatedAt: '2026-07-28T16:45:00.000Z',
};

/* -- Datos de agenda y de expediente ---------------------------------------
   Los conceptos de estado se agregan a `CONCEPTOS` de arriba: la pantalla los
   resuelve con `?ids=`, y un identificador que el catálogo no conozca sale como
   «Sin registrar» — que es lo correcto, pero en una captura se lee como si la
   pantalla no supiera traducir. */

const RECURSOS = [
  {
    id: 'r-1',
    name: 'Consultorio 1 · Dra. Salas',
    resourceTypeConceptId: 'c-rec-cons',
    resourceRefType: 'practitioner_profiles',
    resourceRefId: 'pr-1',
    practiceId: null,
    timeZone: 'America/La_Paz',
    capacity: 1,
    stateConceptId: 'c-est-act',
  },
  {
    id: 'r-2',
    name: 'Sala de curaciones',
    resourceTypeConceptId: 'c-rec-sala',
    resourceRefType: 'practice_locations',
    resourceRefId: 'pl-1',
    practiceId: null,
    timeZone: 'America/La_Paz',
    capacity: 3,
    stateConceptId: 'c-est-act',
  },
];

const CITAS = [
  {
    id: 'b-1',
    patientProfileId: 'p-001',
    resourceId: 'r-1',
    bookableSlotId: 's-1',
    statusConceptId: 'c-cit-conf',
    startAt: '2026-08-10T13:00:00.000Z',
    endAt: '2026-08-10T13:30:00.000Z',
    reasonText: 'Control anual',
    createdAt: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'b-2',
    patientProfileId: 'p-002',
    resourceId: 'r-1',
    bookableSlotId: 's-2',
    statusConceptId: 'c-cit-pend',
    startAt: '2026-08-10T14:00:00.000Z',
    endAt: '2026-08-10T14:30:00.000Z',
    reasonText: 'Primera consulta',
    createdAt: '2026-08-02T09:15:00.000Z',
  },
  {
    // Sin cupo: el contrato lo admite y la pantalla tiene que decirlo.
    id: 'b-3',
    patientProfileId: 'p-003',
    resourceId: 'r-2',
    statusConceptId: 'c-cit-conf',
    startAt: null,
    endAt: null,
    createdAt: '2026-08-03T11:00:00.000Z',
  },
];

const CUPOS = [
  {
    id: 's-3',
    resourceId: 'r-1',
    scheduleTemplateId: 'st-1',
    startAt: '2026-08-11T13:00:00.000Z',
    endAt: '2026-08-11T13:30:00.000Z',
    capacity: 1,
    remainingCapacity: 1,
    statusConceptId: 'c-cup-abierto',
    serviceConceptId: null,
  },
  {
    // Completo: el otro camino del badge de disponibilidad.
    id: 's-4',
    resourceId: 'r-2',
    scheduleTemplateId: 'st-2',
    startAt: '2026-08-11T15:00:00.000Z',
    endAt: '2026-08-11T16:00:00.000Z',
    capacity: 3,
    remainingCapacity: 0,
    statusConceptId: 'c-cup-lleno',
    serviceConceptId: null,
  },
];

const CONDICIONES = [
  {
    id: 'cond-1',
    codeConceptId: 'c-dx-hta',
    clinicalStatusConceptId: 'c-est-act',
    onsetAt: '2024-03-01T00:00:00.000Z',
    createdAt: '2024-03-02T10:00:00.000Z',
  },
];

const ALERGIAS = [
  {
    id: 'alg-1',
    substanceConceptId: 'c-alg-pen',
    criticalityConceptId: 'c-crit-alta',
    clinicalStatusConceptId: 'c-est-act',
    createdAt: '2023-11-10T08:00:00.000Z',
  },
];

const OBSERVACIONES = [
  {
    id: 'obs-1',
    codeConceptId: 'c-obs-peso',
    statusConceptId: 'c-obs-final',
    quantityValue: '78.5',
    quantityUnitConceptId: 'c-uni-kg',
    effectiveStartAt: '2026-07-20T14:00:00.000Z',
  },
];

const NOTAS = [
  {
    noteId: 'nota-1',
    lifecycleStatusConceptId: 'c-nota-firmada',
    chiefComplaintText: 'Cefalea de dos días',
    assessmentText: 'Probable tensional',
    releasedToPatient: true,
    signedAt: '2026-07-20T15:00:00.000Z',
    createdAt: '2026-07-20T14:30:00.000Z',
  },
];

const RELACIONES = [
  {
    id: 'cr-1',
    patientProfileId: 'p-001',
    practitionerProfileId: 'pr-1',
    relationshipTypeConceptId: 'c-rel-tratante',
    statusConceptId: 'c-est-act',
    validFrom: '2025-01-15T00:00:00.000Z',
  },
];

/* -- El interceptor -------------------------------------------------------- */

export interface OpcionesApi {
  /** Claims del token que devuelve el login. */
  readonly claims?: Record<string, unknown>;
  /** `false` hace fallar el login con credenciales inválidas. */
  readonly loginValido?: boolean;
  /** `false` hace fallar el canje del refresh token. */
  readonly refrescoValido?: boolean;
  /** Listado de pacientes vacío: sirve para capturar el estado S3 (sin datos). */
  readonly sinPacientes?: boolean;
  /**
   * `403 IDENTITY_VERIFICATION_REQUIRED` en el resumen propio.
   *
   * Es el caso que enciende la puerta hacia la verificación de identidad, y no
   * se llega a él por ninguna otra vía: hay que pedirlo.
   */
  readonly identidadSinVerificar?: boolean;
  /** Fuerza un `500` en el directorio del panel, para capturar el estado de error. */
  readonly directorioRoto?: boolean;
  /**
   * Organización sin recursos agendables: el estado que ve un tenant recién
   * creado. No se alcanza con datos cargados, hay que pedirlo.
   */
  readonly sinAgenda?: boolean;
  /** Expediente sin ningún registro: el vacío de los ocho bloques a la vez. */
  readonly sinExpediente?: boolean;
}

/** Sobre de error de la API, tal como lo declara `docs/api/error-model.md`. */
function sobreDeError(code: string, message: string, path: string): Record<string, unknown> {
  return { code, message, timestamp: '2026-08-07T12:00:00.000Z', path };
}

/**
 * Intercepta todas las rutas de la API y responde datos de vitrina.
 *
 * Se registra **antes** de navegar: una ruta interceptada después de que la
 * petición salió no intercepta nada.
 *
 * ## Sobre el orden de registro
 *
 * Cypress usa el interceptor **registrado más tarde** entre los que coinciden,
 * igual que Playwright evaluaba de la más nueva a la más vieja. Así que donde el
 * original ponía la ruta específica después de la genérica para que ganara, acá
 * hay que conservar exactamente ese orden — no es estilo, es precedencia.
 */
export function simularApiTotal(opciones: OpcionesApi = {}): void {
  const {
    claims = {},
    loginValido = true,
    refrescoValido = true,
    sinPacientes = false,
    identidadSinVerificar = false,
    directorioRoto = false,
    sinAgenda = false,
    sinExpediente = false,
  } = opciones;

  const sesion = (): Record<string, unknown> => ({
    accessToken: tokenDe(claims),
    refreshToken: 'r-recorrido',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });

  /* -- Sesión ------------------------------------------------------------- */

  cy.intercept('POST', '**/iam/auth/login', (peticion) => {
    peticion.reply(
      loginValido
        ? { statusCode: 200, body: sesion() }
        : {
            statusCode: 401,
            body: sobreDeError('UNAUTHENTICATED', 'Credenciales inválidas', '/iam/auth/login'),
          },
    );
  }).as('login');

  cy.intercept('POST', '**/iam/auth/token/refresh', (peticion) => {
    peticion.reply(
      refrescoValido
        ? { statusCode: 200, body: sesion() }
        : {
            statusCode: 401,
            body: sobreDeError(
              'UNAUTHENTICATED',
              'Refresh token inválido',
              '/iam/auth/token/refresh',
            ),
          },
    );
  }).as('refresco');

  cy.intercept('POST', '**/iam/auth/logout', { statusCode: 200, body: {} });

  /* -- Alta de cuenta y recuperación -------------------------------------- */

  cy.intercept('POST', '**/iam/auth/register-patient', {
    statusCode: 201,
    body: { userId: 'u-nuevo', email: 'nueva@mantra.test', status: 'PENDING' },
  });

  cy.intercept('POST', '**/iam/auth/register-practitioner', {
    statusCode: 201,
    body: { userId: 'u-nuevo-prof', email: 'prof@mantra.test', status: 'PENDING' },
  });

  cy.intercept('POST', '**/iam/auth/verify-email', { statusCode: 200, body: { verified: true } });

  cy.intercept('POST', '**/iam/auth/activate', { statusCode: 200, body: { activated: true } });

  cy.intercept('POST', '**/iam/auth/forgot-password', {
    statusCode: 200,
    body: { message: 'Si la cuenta existe, te enviamos un enlace.' },
  });

  cy.intercept('POST', '**/iam/auth/reset-password', {
    statusCode: 200,
    body: { message: 'Tu contraseña quedó actualizada.' },
  });

  /* -- Administración de cuentas ------------------------------------------ */

  cy.intercept('POST', '**/iam/users/assisted-registration', {
    statusCode: 201,
    body: {
      userId: 'u-asistida',
      personId: 'per-asistida',
      patientProfileId: 'p-asistida',
      email: 'asistida@mantra.test',
      status: 'PENDING',
    },
  });

  cy.intercept('**/iam/users', {
    statusCode: 201,
    body: {
      userId: 'u-creado',
      displayName: 'Nuevo Usuario',
      email: 'nuevo@mantra.test',
      status: 'ACTIVE',
      createdAt: '2026-08-07T12:00:00.000Z',
    },
  });

  /* -- Perfiles ------------------------------------------------------------ */

  cy.intercept('**/profiles/patients/me/summary', (peticion) => {
    peticion.reply(
      identidadSinVerificar
        ? {
            statusCode: 403,
            body: sobreDeError(
              'IDENTITY_VERIFICATION_REQUIRED',
              'Necesitás verificar tu identidad para ver tus datos.',
              '/profiles/patients/me/summary',
            ),
          }
        : {
            statusCode: 200,
            body: {
              personId: 'per-001',
              patientProfileId: 'p-001',
              patientCode: 'PAC-00001',
              displayName: 'Ana Salas',
              birthDate: '1988-03-14',
              personStatus: 'c-est-act',
            },
          },
    );
  });

  /**
   * El listado y el alta comparten ruta y se distinguen por el método.
   *
   * Va **antes** que la ficha para que la ficha —el patrón más específico—
   * quede registrada después y gane la precedencia.
   */
  cy.intercept('**/profiles/patients*', (peticion) => {
    if (peticion.method === 'POST') {
      peticion.reply({
        statusCode: 201,
        body: {
          profileId: 'p-nuevo',
          personId: 'per-nuevo',
          patientCode: 'PAC-00099',
          recordLinkageStatus: 'LINKED',
          createdAt: '2026-08-07T12:00:00.000Z',
        },
      });
      return;
    }
    peticion.reply({
      statusCode: 200,
      body: {
        items: sinPacientes ? [] : PACIENTES,
        count: sinPacientes ? 0 : PACIENTES.length,
        limit: 25,
        nextCursor: null,
      },
    });
  });

  cy.intercept({ method: 'GET', url: /\/profiles\/patients\/p-[0-9]+$/ }, { statusCode: 200, body: FICHA });

  cy.intercept('POST', '**/profiles/practitioners', {
    statusCode: 201,
    body: {
      profileId: 'pr-nuevo',
      personId: 'per-nuevo',
      practitionerCode: 'PRO-00042',
      verificationStatus: 'PENDING',
      practiceStatus: 'ACTIVE',
      licenseId: 'lic-1',
      credentialId: 'cred-1',
      createdAt: '2026-08-07T12:00:00.000Z',
    },
  });

  /* -- Terminología -------------------------------------------------------- */

  /**
   * El catálogo, **filtrado de verdad** por el texto buscado.
   *
   * La primera versión devolvía la lista entera pasara lo que pasara, y la
   * captura del recorrido mostraba doce conceptos bajo la palabra «femenino»:
   * una evidencia que dice que el buscador no filtra, cuando el que no filtraba
   * era el simulador. Un simulador que miente sobre el comportamiento produce
   * capturas que hacen desconfiar de una pantalla sana.
   *
   * `ids` no filtra por texto: es el camino inverso —de identificador a
   * etiqueta— y quien manda 120 ids espera los 120 de vuelta.
   */
  cy.intercept('**/terminology/concepts**', (peticion) => {
    const params = new URL(peticion.url).searchParams;
    const ids = params.get('ids');
    if (ids !== null) {
      const pedidos = new Set(ids.split(','));
      const encontrados = CONCEPTOS.filter((c) => pedidos.has(c.conceptId));
      peticion.reply({
        statusCode: 200,
        body: { items: encontrados, count: encontrados.length, limit: 200 },
      });
      return;
    }

    const texto = (params.get('q') ?? '').trim().toLowerCase();
    const coinciden =
      texto === ''
        ? CONCEPTOS
        : CONCEPTOS.filter(
            (c) => c.display.toLowerCase().includes(texto) || c.code.toLowerCase().includes(texto),
          );

    peticion.reply({
      statusCode: 200,
      body: { items: coinciden, count: coinciden.length, limit: 100 },
    });
  });

  /* -- Identidad ----------------------------------------------------------- */

  // El historial del titular. Va **antes** que las rutas de verificación para
  // que el patrón más específico quede registrado después y gane.
  cy.intercept('**/identity/me/verification-cases', {
    statusCode: 200,
    body: [
      {
        id: 'caso-0',
        status: CASO_VERIFICADO,
        openedAt: '2026-05-02T09:00:00.000Z',
        completedAt: '2026-05-06T14:30:00.000Z',
      },
      { id: 'caso-1', status: CASO_EN_VERIFICACION, openedAt: '2026-08-01T09:00:00.000Z' },
    ],
  });

  cy.intercept('**/identity/me/identity-verification', (peticion) => {
    peticion.reply(
      peticion.method === 'POST'
        ? {
            statusCode: 201,
            body: { caseId: 'caso-1', checkId: 'chk-1', status: CASO_EN_VERIFICACION },
          }
        : {
            statusCode: 200,
            body: {
              id: 'caso-1',
              status: CASO_EN_VERIFICACION,
              openedAt: '2026-08-01T09:00:00.000Z',
            },
          },
    );
  });

  cy.intercept('**/identity/me/practitioner/**', {
    statusCode: 200,
    body: { caseId: 'caso-2', checkId: 'chk-2', status: 'PENDING' },
  });

  /* -- Archivos ------------------------------------------------------------ */

  // `id`, no `fileId`: es lo que devuelve `POST /common/files/upload` de verdad
  // y lo único que `FilesClient.upload` lee. Con `fileId`, el `evidenceFileId`
  // de la petición siguiente viajaba `undefined` y la pantalla igual mostraba
  // «Tu solicitud quedó registrada», porque el intercept del alta responde 201
  // pase lo que pase: el simulador tapaba justo el eslabón que encadena las dos
  // llamadas.
  cy.intercept('POST', '**/common/files/upload', {
    statusCode: 201,
    body: { id: 'file-1', url: '/files/file-1' },
  });

  /* -- Agenda (M41) --------------------------------------------------------- */

  cy.intercept('**/scheduling/resources**', {
    statusCode: 200,
    body: { items: sinAgenda ? [] : RECURSOS, count: sinAgenda ? 0 : RECURSOS.length },
  });

  /**
   * Los cupos, con instantes **fijos**.
   *
   * Calcularlos desde `Date.now()` haría que cada corrida capturara otras horas
   * y ninguna captura se pudiera comparar con la anterior — el mismo motivo por
   * el que las fechas de la ficha son literales.
   */
  cy.intercept('**/scheduling/slots**', {
    statusCode: 200,
    body: {
      items: sinAgenda ? [] : CUPOS,
      count: sinAgenda ? 0 : CUPOS.length,
      limit: 100,
      truncated: false,
    },
  });

  cy.intercept('**/scheduling/bookings**', {
    statusCode: 200,
    body: {
      items: sinAgenda ? [] : CITAS,
      count: sinAgenda ? 0 : CITAS.length,
      limit: 100,
      truncated: false,
    },
  });

  /* -- Archivo clínico (M08 + M15) ------------------------------------------ */

  cy.intercept(/\/clinical\/patients\/[^/]+\/summary/, {
    statusCode: 200,
    body: {
      patientProfileId: 'p-001',
      conditions: sinExpediente ? [] : CONDICIONES,
      allergies: sinExpediente ? [] : ALERGIAS,
      medicationRequests: [],
      observations: sinExpediente ? [] : OBSERVACIONES,
      encounters: [],
      limit: 50,
      truncated: [],
    },
  });

  cy.intercept(/\/charts\/patients\/[^/]+\/chart/, {
    statusCode: 200,
    body: {
      patientProfileId: 'p-001',
      notes: sinExpediente ? [] : NOTAS,
      carePlans: [],
      documents: [],
      limit: 50,
      truncated: [],
    },
  });

  /**
   * Los formularios propios (M09).
   *
   * «Mi historia clínica» los lee al abrirse aunque no los liste: son lo que
   * incorporan los documentos que ofrece descargar. La lista va vacía porque el
   * recorrido no captura formularios; lo que hace falta es que la lectura tenga
   * su respuesta declarada, como el resto de la API simulada.
   */
  cy.intercept('**/forms/me/instances*', {
    statusCode: 200,
    body: { items: [], limit: 50, truncated: false },
  });

  /* -- Bases legítimas de acceso (M06) -------------------------------------- */

  cy.intercept('**/authz/care-relationships**', { statusCode: 200, body: RELACIONES });

  /* -- Directorio público -------------------------------------------------- */

  cy.intercept('**/public/directory*', (peticion) => {
    peticion.reply(
      directorioRoto
        ? {
            statusCode: 500,
            body: sobreDeError('INTERNAL', 'No se pudo leer el directorio.', '/public/directory'),
          }
        : {
            statusCode: 200,
            body: {
              slug: 'directory',
              records: [
                { id: 'd-1', name: 'Clínica Norte', kind: 'ORGANIZATION' },
                { id: 'd-2', name: 'Centro Sur', kind: 'ORGANIZATION' },
              ],
              refreshedAt: '2026-08-07T06:00:00.000Z',
              generatedAt: '2026-08-07T06:00:00.000Z',
            },
          },
    );
  });
}

/**
 * Entra con las credenciales de prueba y espera a estar dentro.
 *
 * La contraseña se localiza por `type="password"` y no por su etiqueta: el campo
 * lleva dentro un botón de mostrar/ocultar cuyo nombre accesible también dice
 * «contraseña», así que buscar por etiqueta devuelve dos elementos.
 */
export function iniciarSesionEnRecorrido(): void {
  cy.visit('/auth');
  cy.esperarAplicacionLista();
  cy.porTestId('login-identifier').clear().type('ana@mantra.test');
  cy.get('input[type="password"]').first().clear().type('secreto-de-prueba');
  cy.porTestId('login-submit').click();
  cy.location('pathname').should('match', /^\/(panel|auth\/organizacion)$/);
}
