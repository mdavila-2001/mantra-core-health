/**
 * Los actores del recorrido, **creados de verdad contra la API viva**.
 *
 * ## Por qué se registran en vez de sembrarse
 *
 * `e2e/recorrido/` intercepta la red y devuelve datos de vitrina: sirve para
 * mirar cómo se ve cada pantalla, y por eso vive aparte. Esto es lo contrario —
 * ninguna respuesta está simulada— y responde otra pregunta: *¿la aplicación
 * funciona con una persona real, con los permisos que el backend le da de
 * verdad?*
 *
 * Los tres caminos de alta salen de las suites por actor del backend
 * (`test/smoke/modules/{paciente,medico,organizacion,administrador}.smoke.ts`),
 * que son el contrato vivo de qué puede hacer cada tipo de usuario. Copiar de
 * ahí y no inventar payloads es lo que hace que un cambio de contrato del
 * backend rompa esta suite **en el alta**, que es donde se entiende, y no tres
 * pantallas después.
 *
 * ## Por qué cada corrida crea usuarios nuevos
 *
 * El sufijo único evita el `409` de «ese documento ya está registrado» —que las
 * propias suites del backend fijan como límite— y deja cada corrida
 * independiente de las anteriores. La contrapartida es que la base acumula
 * cuentas de prueba; es el mismo trato que hacen los smokes del backend.
 */

const API = process.env['E2E_API_URL'] ?? 'http://localhost:3000';

/** La contraseña que usan todas las suites por actor del backend. */
export const CLAVE = 'S3cret-passw0rd';

/** Credenciales de la cuenta sembrada por `BOOTSTRAP_ADMIN_*` al arrancar la API. */
export const ADMIN = {
  identificador: process.env['E2E_ADMIN_EMAIL'] ?? 'admin@redesa.test',
  clave: process.env['E2E_ADMIN_PASSWORD'] ?? CLAVE,
};

/** Sufijo único de esta corrida. Va en cada identificador que se crea. */
const CORRIDA = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

/** Un actor listo para entrar por la pantalla de ingreso. */
export interface Actor {
  /** Lo que se escribe en «Correo o documento». */
  readonly identificador: string;
  readonly clave: string;
  /** Rótulo para la evidencia. */
  readonly nombre: string;
  /** Lo que el alta devolvió, para las pantallas que necesitan un id. */
  readonly datos: Record<string, string>;
}

/** Error con el cuerpo de la respuesta adentro: sin eso no se puede diagnosticar. */
class ErrorDeApi extends Error {
  constructor(ruta: string, status: number, cuerpo: string) {
    super(`${ruta} respondió ${status}: ${cuerpo.slice(0, 400)}`);
    this.name = 'ErrorDeApi';
  }
}

/** `POST` contra la API real. Sin token salvo que se pase uno. */
async function post(
  ruta: string,
  cuerpo: unknown,
  token?: string,
): Promise<Record<string, unknown>> {
  const respuesta = await fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(cuerpo),
  });

  const texto = await respuesta.text();
  if (!respuesta.ok) {
    throw new ErrorDeApi(ruta, respuesta.status, texto);
  }
  return texto === '' ? {} : (JSON.parse(texto) as Record<string, unknown>);
}

/** `GET` contra la API real. */
async function get(ruta: string, token?: string): Promise<Record<string, unknown>> {
  const respuesta = await fetch(`${API}${ruta}`, {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });
  const texto = await respuesta.text();
  if (!respuesta.ok) {
    throw new ErrorDeApi(ruta, respuesta.status, texto);
  }
  return JSON.parse(texto) as Record<string, unknown>;
}

/** Texto de una clave de la respuesta, o cadena vacía. */
function campo(cuerpo: Record<string, unknown>, clave: string): string {
  const valor = cuerpo[clave];
  return typeof valor === 'string' ? valor : '';
}

/** Comprueba que la API esté viva antes de intentar nada más. */
export async function apiViva(): Promise<boolean> {
  try {
    const respuesta = await fetch(`${API}/health`);
    return respuesta.ok;
  } catch {
    return false;
  }
}

/** Inicia sesión contra la API y devuelve el access token. */
export async function tokenDe(identificador: string, clave: string): Promise<string> {
  const cuerpo = await post('/iam/auth/login', {
    ...(identificador.includes('@') ? { email: identificador } : { nationalId: identificador }),
    password: clave,
  });
  return campo(cuerpo, 'accessToken');
}

/**
 * **Paciente** — se da de alta solo, sin admin ni token.
 *
 * Entra con su **documento**, no con su correo: es el camino que la pantalla de
 * ingreso resuelve por la ausencia de `@`, y el que ninguna otra prueba recorre.
 */
export async function crearPaciente(): Promise<Actor> {
  const nationalId = `CI-E2E-${CORRIDA}`;
  const cuerpo = await post('/iam/auth/register-patient', {
    nationalId,
    password: CLAVE,
    displayName: 'Paciente de recorrido',
    email: `paciente-${CORRIDA}@example.test`,
    phone: '+591 70055555',
    gender: 'MALE',
    sexAtBirth: 'MALE',
  });

  return {
    identificador: nationalId,
    clave: CLAVE,
    nombre: 'Paciente de recorrido',
    datos: {
      userId: campo(cuerpo, 'userId'),
      personId: campo(cuerpo, 'personId'),
      patientProfileId: campo(cuerpo, 'patientProfileId'),
    },
  };
}

/**
 * **Médico** — se registra declarando su matrícula.
 *
 * La licencia nace PENDIENTE: registrarse no es estar habilitado, y el
 * recorrido tiene que poder mostrar qué ve alguien en ese estado.
 */
export async function crearMedico(): Promise<Actor> {
  const email = `medico-${CORRIDA}@example.test`;
  const cuerpo = await post('/iam/auth/register-practitioner', {
    email,
    password: CLAVE,
    displayName: 'Dra. Recorrido',
    licenseNumber: `MP-${CORRIDA}`,
    credentialNumber: `TIT-${CORRIDA}`,
    phone: '+591 70012345',
    gender: 'FEMALE',
    sexAtBirth: 'FEMALE',
    birthDate: '1985-04-12',
  });

  return {
    identificador: email,
    clave: CLAVE,
    nombre: 'Dra. Recorrido',
    datos: {
      userId: campo(cuerpo, 'userId'),
      practitionerProfileId: campo(cuerpo, 'practitionerProfileId'),
      verificationStatus: campo(cuerpo, 'verificationStatus'),
    },
  };
}

/**
 * **Organización** — se registra con su cuenta owner en una transacción.
 *
 * País y jurisdicción exigen un `conceptId` que exista de verdad. Se resuelve
 * del catálogo en vez de escribirse: los uuid de los conceptos son deterministas
 * pero **no se escriben en el cliente**, que es la regla del propio vault.
 */
export async function crearOrganizacion(tokenAdmin: string): Promise<Actor> {
  const catalogo = await get('/terminology/concepts?limit=1', tokenAdmin);
  const items = Array.isArray(catalogo['items']) ? catalogo['items'] : [];
  const primero = items[0] as Record<string, unknown> | undefined;
  const conceptId = primero === undefined ? '' : campo(primero, 'conceptId');

  if (conceptId === '') {
    throw new Error(
      'El catálogo de terminología está vacío: no hay concepto con el que registrar una organización.',
    );
  }

  const email = `owner-${CORRIDA}@example.test`;
  const cuerpo = await post('/iam/auth/register-organization', {
    organization: {
      code: `ORG-E2E-${CORRIDA}`,
      legalName: `Organización de recorrido ${CORRIDA}`,
      tenantType: 'HOSPITAL',
      countryConceptId: conceptId,
      jurisdictionConceptId: conceptId,
    },
    owner: { email, password: CLAVE, displayName: 'Owner de recorrido' },
  });

  return {
    identificador: email,
    clave: CLAVE,
    nombre: 'Owner de recorrido',
    datos: {
      tenantId: campo(cuerpo, 'tenantId'),
      ownerUserId: campo(cuerpo, 'ownerUserId'),
      membershipId: campo(cuerpo, 'membershipId'),
    },
  };
}
