/**
 * Los actores del recorrido, **creados de verdad contra la API viva**.
 *
 * ## Por qué se registran en vez de sembrarse
 *
 * El recorrido visual intercepta la red y devuelve datos de vitrina: sirve para
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
 *
 * ## Por qué `cy.request` y no `fetch`
 *
 * `cy.request` sale del proceso de Cypress, no del navegador: no lo alcanza la
 * política de origen cruzado ni la sesión de la aplicación, que es justo lo que
 * hace falta para dar de alta a alguien **antes** de que exista una sesión.
 */

/** La contraseña que usan todas las suites por actor del backend. */
export const CLAVE = 'S3cret-passw0rd';

function api(): string {
  const url = Cypress.expose('E2E_API_URL') as unknown;
  return typeof url === 'string' && url !== '' ? url : 'http://localhost:3000';
}

/** Credenciales de la cuenta sembrada por `BOOTSTRAP_ADMIN_*` al arrancar la API. */
export function admin(): { identificador: string; clave: string } {
  const correo = Cypress.expose('E2E_ADMIN_EMAIL') as unknown;
  const clave = Cypress.expose('E2E_ADMIN_PASSWORD') as unknown;
  return {
    identificador:
      typeof correo === 'string' && correo !== ''
        ? correo
        : 'cpacentropreparacionacademica@gmail.com',
    clave: typeof clave === 'string' && clave !== '' ? clave : CLAVE,
  };
}

/**
 * Sufijo único de esta corrida. Va en cada identificador que se crea.
 *
 * Sale del identificador de la corrida que publica `cypress.config.ts` en su
 * bloque `expose`, así que
 * todas las specs de una misma ejecución comparten sufijo y dos ejecuciones
 * distintas nunca lo comparten.
 */
function corrida(): string {
  const runId = Cypress.expose('E2E_RUN_ID') as unknown;
  const crudo = typeof runId === 'string' && runId !== '' ? runId : String(Date.now());
  return crudo.replace(/[^0-9a-z]/gi, '').slice(-12);
}

let secuenciaDeAltas = 0;

/**
 * Sufijo único de **un alta**, no de la corrida entera.
 *
 * El documento, la matrícula y el correo son únicos en el backend: dos altas
 * del mismo tipo con el sufijo de la corrida chocan con `409` en la segunda
 * (medido: solo la primera spec que registraba sobrevivía, y la suite entera
 * de un tirón —el objetivo de H-08— era imposible). El reloj distingue specs
 * de la misma ejecución (cada una recarga este módulo) y la secuencia
 * distingue altas dentro de una misma spec.
 */
function sufijoDeAlta(): string {
  secuenciaDeAltas += 1;
  return `${corrida().slice(-6)}${String(Date.now()).slice(-6)}${secuenciaDeAltas}`;
}

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

/** Texto de una clave de la respuesta, o cadena vacía. */
function campo(cuerpo: Record<string, unknown>, clave: string): string {
  const valor = cuerpo[clave];
  return typeof valor === 'string' ? valor : '';
}

/**
 * Comprueba que la API esté viva antes de intentar nada más.
 *
 * Sin `failOnStatusCode: false` un backend caído haría fallar la petición con un
 * error de red y el mensaje no diría que hay que levantar la API.
 */
export function apiViva(): Cypress.Chainable<boolean> {
  return cy
    .request({ url: `${api()}/health`, failOnStatusCode: false, timeout: 10_000 })
    .then((respuesta) => respuesta.status >= 200 && respuesta.status < 300);
}

/**
 * Inicia sesión contra la API y devuelve el access token.
 *
 * El `401` se atrapa a propósito para explicarlo. Sin esto, el fallo es el
 * volcado crudo de `cy.request` —«401: Unauthorized», el cuerpo, las cabeceras—
 * y no dice lo único que hace falta saber: que **la cuenta de administración de
 * este entorno no es la que la suite tiene por defecto**. Los valores por
 * defecto vienen de la configuración de arranque de la API, y una base sembrada
 * de otra forma no los tiene.
 */
export function tokenDe(identificador: string, clave: string): Cypress.Chainable<string> {
  return cy
    .request({
      method: 'POST',
      url: `${api()}/iam/auth/login`,
      failOnStatusCode: false,
      body: {
        ...(identificador.includes('@') ? { email: identificador } : { nationalId: identificador }),
        password: clave,
      },
    })
    .then((respuesta) => {
      if (respuesta.status === 401) {
        throw new Error(
          `La API rechazó las credenciales de «${identificador}».\n` +
            'Esta suite necesita una cuenta con permisos de administración, y la que trae por ' +
            'defecto no existe en esta base. Exportá E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD con ' +
            'las de tu entorno (o declaralas en `.env.e2e`) antes de correrla.',
        );
      }
      if (respuesta.status >= 400) {
        throw new Error(`POST /iam/auth/login respondió ${respuesta.status}.`);
      }
      return campo(respuesta.body as Record<string, unknown>, 'accessToken');
    });
}

/**
 * El nombre del paciente, en las cuatro partes que manda el formulario.
 *
 * Se declara acá y no dentro del alta porque el `displayName` que devuelve la
 * API es la composición de estas cuatro, y el rótulo del actor tiene que decir
 * lo mismo que la pantalla va a mostrar.
 */
const NOMBRE_PACIENTE = Object.freeze({
  name: 'Ana',
  middleName: 'Lucía',
  lastName: 'Quispe',
  motherLastName: 'Mamani',
});

/**
 * **Paciente** — se da de alta solo, sin admin ni token.
 *
 * Entra con su **documento**, no con su correo: es el camino que la pantalla de
 * ingreso resuelve por la ausencia de `@`, y el que ninguna otra prueba recorre.
 *
 * ## Por qué las cuatro partes del nombre y no `displayName`
 *
 * `displayName` está **deprecado** en `RegisterPatientDto`: la pantalla de
 * registro manda `name`, `middleName`, `lastName` y `motherLastName` desde que
 * el modelo los declara, y el backend compone el nombre para mostrar. Un actor
 * dado de alta por el campo viejo recorría la aplicación con datos que ninguna
 * persona real produce, así que la composición del nombre —lo que se ve en el
 * encabezado y en la reserva del portal— no la ejercitaba nadie.
 */
export function crearPaciente(): Cypress.Chainable<Actor> {
  const sufijo = sufijoDeAlta();
  const nationalId = `CI-E2E-${sufijo}`;
  const nombre = [
    NOMBRE_PACIENTE.name,
    NOMBRE_PACIENTE.middleName,
    NOMBRE_PACIENTE.lastName,
    NOMBRE_PACIENTE.motherLastName,
  ].join(' ');

  return cy
    .request({
      method: 'POST',
      url: `${api()}/iam/auth/register-patient`,
      body: {
        nationalId,
        password: CLAVE,
        ...NOMBRE_PACIENTE,
        email: `paciente-${sufijo}@example.test`,
        phone: '+591 70055555',
        gender: 'FEMALE',
        sexAtBirth: 'FEMALE',
      },
    })
    .then((respuesta): Actor => {
      const cuerpo = respuesta.body as Record<string, unknown>;
      return {
        identificador: nationalId,
        clave: CLAVE,
        nombre,
        datos: {
          userId: campo(cuerpo, 'userId'),
          personId: campo(cuerpo, 'personId'),
          patientProfileId: campo(cuerpo, 'patientProfileId'),
        },
      };
    });
}

/**
 * **Médico** — se registra declarando su matrícula.
 *
 * La licencia nace PENDIENTE: registrarse no es estar habilitado, y el recorrido
 * tiene que poder mostrar qué ve alguien en ese estado.
 */
export function crearMedico(): Cypress.Chainable<Actor> {
  const sufijo = sufijoDeAlta();
  const email = `medico-${sufijo}@example.test`;
  return cy
    .request({
      method: 'POST',
      url: `${api()}/iam/auth/register-practitioner`,
      body: {
        email,
        password: CLAVE,
        displayName: 'Dra. Recorrido',
        licenseNumber: `MP-${sufijo}`,
        credentialNumber: `TIT-${sufijo}`,
        phone: '+591 70012345',
        gender: 'FEMALE',
        sexAtBirth: 'FEMALE',
        birthDate: '1985-04-12',
      },
    })
    .then((respuesta): Actor => {
      const cuerpo = respuesta.body as Record<string, unknown>;
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
    });
}

/**
 * **Organización** — se registra con su cuenta owner en una transacción.
 *
 * País y jurisdicción exigen un `conceptId` que exista de verdad. Se resuelve del
 * catálogo en vez de escribirse: los uuid de los conceptos son deterministas pero
 * **no se escriben en el cliente**, que es la regla del propio vault.
 */
export function crearOrganizacion(tokenAdmin: string): Cypress.Chainable<Actor> {
  return cy
    .request({
      url: `${api()}/terminology/concepts?limit=1`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    })
    .then((catalogo) => {
      const cuerpo = catalogo.body as Record<string, unknown>;
      const items = Array.isArray(cuerpo['items']) ? cuerpo['items'] : [];
      const primero = items[0] as Record<string, unknown> | undefined;
      const conceptId = primero === undefined ? '' : campo(primero, 'conceptId');

      if (conceptId === '') {
        throw new Error(
          'El catálogo de terminología está vacío: no hay concepto con el que registrar una organización.',
        );
      }

      const sufijo = sufijoDeAlta();
      const email = `owner-${sufijo}@example.test`;
      return cy
        .request({
          method: 'POST',
          url: `${api()}/iam/auth/register-organization`,
          body: {
            organization: {
              code: `ORG-E2E-${sufijo}`,
              legalName: `Organización de recorrido ${sufijo}`,
              tenantType: 'HOSPITAL',
              countryConceptId: conceptId,
              jurisdictionConceptId: conceptId,
            },
            owner: { email, password: CLAVE, displayName: 'Owner de recorrido' },
          },
        })
        .then((respuesta): Actor => {
          const alta = respuesta.body as Record<string, unknown>;
          return {
            identificador: email,
            clave: CLAVE,
            nombre: 'Owner de recorrido',
            datos: {
              tenantId: campo(alta, 'tenantId'),
              ownerUserId: campo(alta, 'ownerUserId'),
              membershipId: campo(alta, 'membershipId'),
            },
          };
        });
    });
}
