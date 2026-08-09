import type { Page, Route } from '@playwright/test';

/**
 * Simulación de **toda** la API para el recorrido visual.
 *
 * `e2e/support/api.ts` simula los cinco endpoints que los journeys de sesión
 * necesitan, y hace bien en no simular más: una prueba que declara respuestas
 * que no usa esconde cuál le importa. El recorrido tiene el problema opuesto
 * —entra a las veinte pantallas, y cada una pide lo suyo— así que acá están
 * todas, con datos que se ven bien en una captura.
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

export interface ApiSimulada {
  readonly refrescos: () => number;
  readonly logins: () => number;
}

/**
 * Intercepta todas las rutas de la API y responde datos de vitrina.
 *
 * Se registra **antes** de navegar: una ruta interceptada después de que la
 * petición salió no intercepta nada.
 */
export async function simularApiTotal(
  page: Page,
  opciones: OpcionesApi = {},
): Promise<ApiSimulada> {
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

  let refrescos = 0;
  let logins = 0;

  const sesion = () => ({
    accessToken: tokenDe(claims),
    refreshToken: 'r-recorrido',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  });

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  const error = (route: Route, code: string, message: string, status: number, path: string) =>
    json(route, { code, message, timestamp: '2026-08-07T12:00:00.000Z', path }, status);

  /* -- Sesión ------------------------------------------------------------- */

  await page.route('**/iam/auth/login', (route) => {
    logins += 1;
    return loginValido
      ? json(route, sesion())
      : error(route, 'UNAUTHENTICATED', 'Credenciales inválidas', 401, '/iam/auth/login');
  });

  await page.route('**/iam/auth/token/refresh', (route) => {
    refrescos += 1;
    return refrescoValido
      ? json(route, sesion())
      : error(route, 'UNAUTHENTICATED', 'Refresh token inválido', 401, '/iam/auth/token/refresh');
  });

  await page.route('**/iam/auth/logout', (route) => json(route, {}));

  /* -- Alta de cuenta y recuperación -------------------------------------- */

  await page.route('**/iam/auth/register-patient', (route) =>
    json(route, { userId: 'u-nuevo', email: 'nueva@mantra.test', status: 'PENDING' }, 201),
  );

  await page.route('**/iam/auth/register-practitioner', (route) =>
    json(route, { userId: 'u-nuevo-prof', email: 'prof@mantra.test', status: 'PENDING' }, 201),
  );

  await page.route('**/iam/auth/verify-email', (route) => json(route, { verified: true }));

  await page.route('**/iam/auth/activate', (route) => json(route, { activated: true }));

  await page.route('**/iam/auth/forgot-password', (route) =>
    json(route, { message: 'Si la cuenta existe, te enviamos un enlace.' }),
  );

  await page.route('**/iam/auth/reset-password', (route) =>
    json(route, { message: 'Tu contraseña quedó actualizada.' }),
  );

  /* -- Administración de cuentas ------------------------------------------ */

  await page.route('**/iam/users/assisted-registration', (route) =>
    json(
      route,
      {
        userId: 'u-asistida',
        personId: 'per-asistida',
        patientProfileId: 'p-asistida',
        email: 'asistida@mantra.test',
        status: 'PENDING',
      },
      201,
    ),
  );

  await page.route('**/iam/users', (route) =>
    json(
      route,
      {
        userId: 'u-creado',
        displayName: 'Nuevo Usuario',
        email: 'nuevo@mantra.test',
        status: 'ACTIVE',
        createdAt: '2026-08-07T12:00:00.000Z',
      },
      201,
    ),
  );

  /* -- Perfiles ------------------------------------------------------------ */

  await page.route('**/profiles/patients/me/summary', (route) =>
    identidadSinVerificar
      ? error(
          route,
          'IDENTITY_VERIFICATION_REQUIRED',
          'Necesitás verificar tu identidad para ver tus datos.',
          403,
          '/profiles/patients/me/summary',
        )
      : json(route, {
          personId: 'per-001',
          patientProfileId: 'p-001',
          patientCode: 'PAC-00001',
          displayName: 'Ana Salas',
          birthDate: '1988-03-14',
          personStatus: 'c-est-act',
        }),
  );

  // El orden importa: la ficha (`/profiles/patients/p-001`) tiene que
  // registrarse antes que el listado, porque el patrón del listado también
  // coincidiría con ella. Playwright evalúa las rutas de la más nueva a la más
  // vieja, así que la específica va después para quedar arriba.
  await page.route('**/profiles/patients?**', (route) =>
    json(route, {
      items: sinPacientes ? [] : PACIENTES,
      count: sinPacientes ? 0 : PACIENTES.length,
      limit: 25,
      nextCursor: null,
    }),
  );

  await page.route(/\/profiles\/patients\/p-[0-9]+$/, (route) => json(route, FICHA));

  await page.route('**/profiles/patients', (route) => {
    if (route.request().method() === 'POST') {
      return json(
        route,
        {
          profileId: 'p-nuevo',
          personId: 'per-nuevo',
          patientCode: 'PAC-00099',
          recordLinkageStatus: 'LINKED',
          createdAt: '2026-08-07T12:00:00.000Z',
        },
        201,
      );
    }
    return json(route, {
      items: sinPacientes ? [] : PACIENTES,
      count: sinPacientes ? 0 : PACIENTES.length,
      limit: 25,
      nextCursor: null,
    });
  });

  await page.route('**/profiles/practitioners', (route) =>
    json(
      route,
      {
        profileId: 'pr-nuevo',
        personId: 'per-nuevo',
        practitionerCode: 'PRO-00042',
        verificationStatus: 'PENDING',
        practiceStatus: 'ACTIVE',
        licenseId: 'lic-1',
        credentialId: 'cred-1',
        createdAt: '2026-08-07T12:00:00.000Z',
      },
      201,
    ),
  );

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
  await page.route('**/terminology/concepts**', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const ids = params.get('ids');
    if (ids !== null) {
      const pedidos = new Set(ids.split(','));
      const encontrados = CONCEPTOS.filter((c) => pedidos.has(c.conceptId));
      return json(route, { items: encontrados, count: encontrados.length, limit: 200 });
    }

    const texto = (params.get('q') ?? '').trim().toLowerCase();
    const coinciden =
      texto === ''
        ? CONCEPTOS
        : CONCEPTOS.filter(
            (c) => c.display.toLowerCase().includes(texto) || c.code.toLowerCase().includes(texto),
          );

    return json(route, { items: coinciden, count: coinciden.length, limit: 100 });
  });

  /* -- Identidad ----------------------------------------------------------- */

  // El historial del titular. Va **antes** que las rutas de verificación para
  // que el patrón más específico quede arriba: Playwright evalúa de la más nueva
  // a la más vieja, así que la que se registra después gana.
  await page.route('**/identity/me/verification-cases', (route) =>
    json(route, [
      {
        id: 'caso-0',
        status: CASO_VERIFICADO,
        openedAt: '2026-05-02T09:00:00.000Z',
        completedAt: '2026-05-06T14:30:00.000Z',
      },
      { id: 'caso-1', status: CASO_EN_VERIFICACION, openedAt: '2026-08-01T09:00:00.000Z' },
    ]),
  );

  await page.route('**/identity/me/identity-verification', (route) =>
    route.request().method() === 'POST'
      ? json(route, { caseId: 'caso-1', checkId: 'chk-1', status: CASO_EN_VERIFICACION }, 201)
      : json(route, {
          id: 'caso-1',
          status: CASO_EN_VERIFICACION,
          openedAt: '2026-08-01T09:00:00.000Z',
        }),
  );

  await page.route('**/identity/me/practitioner/**', (route) =>
    json(route, { caseId: 'caso-2', checkId: 'chk-2', status: 'PENDING' }),
  );

  /* -- Archivos ------------------------------------------------------------ */

  await page.route('**/common/files/upload', (route) =>
    json(route, { fileId: 'file-1', url: '/files/file-1' }, 201),
  );

  /* -- Agenda (M41) --------------------------------------------------------- */

  await page.route('**/scheduling/resources**', (route) =>
    json(route, { items: sinAgenda ? [] : RECURSOS, count: sinAgenda ? 0 : RECURSOS.length }),
  );

  /**
   * Los cupos, con instantes **fijos**.
   *
   * Calcularlos desde `Date.now()` haría que cada corrida capturara otras horas
   * y ninguna captura se pudiera comparar con la anterior — el mismo motivo por
   * el que las fechas de la ficha son literales.
   */
  await page.route('**/scheduling/slots**', (route) =>
    json(route, {
      items: sinAgenda ? [] : CUPOS,
      count: sinAgenda ? 0 : CUPOS.length,
      limit: 100,
      truncated: false,
    }),
  );

  // La ficha de una cita va antes que el listado: Playwright evalúa de la más
  // nueva a la más vieja, así que la específica se registra después para ganar.
  await page.route('**/scheduling/bookings**', (route) =>
    json(route, {
      items: sinAgenda ? [] : CITAS,
      count: sinAgenda ? 0 : CITAS.length,
      limit: 100,
      truncated: false,
    }),
  );

  /* -- Archivo clínico (M08 + M15) ------------------------------------------ */

  await page.route(/\/clinical\/patients\/[^/]+\/summary/, (route) =>
    json(route, {
      patientProfileId: 'p-001',
      conditions: sinExpediente ? [] : CONDICIONES,
      allergies: sinExpediente ? [] : ALERGIAS,
      medicationRequests: [],
      observations: sinExpediente ? [] : OBSERVACIONES,
      encounters: [],
      limit: 50,
      truncated: [],
    }),
  );

  await page.route(/\/charts\/patients\/[^/]+\/chart/, (route) =>
    json(route, {
      patientProfileId: 'p-001',
      notes: sinExpediente ? [] : NOTAS,
      carePlans: [],
      documents: [],
      limit: 50,
      truncated: [],
    }),
  );

  /* -- Bases legítimas de acceso (M06) -------------------------------------- */

  await page.route('**/authz/care-relationships**', (route) => json(route, RELACIONES));

  /* -- Directorio público -------------------------------------------------- */

  await page.route('**/public/directory*', (route) =>
    directorioRoto
      ? error(route, 'INTERNAL', 'No se pudo leer el directorio.', 500, '/public/directory')
      : json(route, {
          slug: 'directory',
          records: [
            { id: 'd-1', name: 'Clínica Norte', kind: 'ORGANIZATION' },
            { id: 'd-2', name: 'Centro Sur', kind: 'ORGANIZATION' },
          ],
          refreshedAt: '2026-08-07T06:00:00.000Z',
          generatedAt: '2026-08-07T06:00:00.000Z',
        }),
  );

  return { refrescos: () => refrescos, logins: () => logins };
}

/**
 * Entra con las credenciales de prueba y espera a estar dentro.
 *
 * La contraseña se localiza por `type="password"` y no por su etiqueta: el
 * campo lleva dentro un botón de mostrar/ocultar cuyo nombre accesible también
 * dice «contraseña», así que buscar por etiqueta devuelve dos elementos.
 */
export async function iniciarSesion(page: Page): Promise<void> {
  await page.goto('/auth');
  await page.getByLabel(/correo o documento/i).fill('ana@mantra.test');
  await page.locator('input[type="password"]').fill('secreto-de-prueba');
  await page.getByRole('button', { name: /^entrar$/i }).click();
  await page.waitForURL(/\/(panel|auth\/organizacion)$/, { timeout: 15_000 });
}
