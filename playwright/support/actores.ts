import { request, type APIRequestContext } from '@playwright/test';

/**
 * Las cuentas con las que se recorre la aplicación, **creadas o verificadas
 * contra la API viva**.
 *
 * Mismo criterio que `cypress/support/real/actores.ts`, y por el mismo motivo:
 * un barrido de rutas que corre contra respuestas simuladas no dice nada de si
 * el producto funciona. Lo que cambia acá es que se necesita **una sesión por
 * rol a la vez**, porque los carriles 01/02/19 comparan qué ve cada uno.
 */

/** La contraseña que usan todas las suites por actor del backend. */
export const CLAVE = 'S3cret-passw0rd';

/** Los roles que el barrido recorre. */
export type Rol =
  | 'administrador'
  | 'doctora'
  | 'paciente'
  | 'operadora de facturación';

export interface Actor {
  readonly rol: Rol;
  /** Lo que se escribe en «Correo o documento». */
  readonly identificador: string;
  readonly clave: string;
  /** Rótulo para la evidencia y los informes. */
  readonly nombre: string;
}

/**
 * Dónde escucha la API.
 *
 * El 3005 es el puerto del entorno local documentado, y sobre todo **es el que
 * el front espera**: su contenedor arranca con
 * `BACKEND_ORIGIN=http://host.docker.internal:3005` y de ahí sale el
 * `proxy.generated.json`. Apuntar esta suite a otro puerto que el del proxy
 * produce el peor fallo posible — el alta del paciente funciona, el ingreso por
 * pantalla no, y el error que se ve es un tiempo de espera agotado en
 * `waitForURL` que no menciona ningún puerto.
 *
 * `E2E_API_URL` lo sobreescribe: el `docker-compose.yml` del backend publica
 * `"${PORT:-3000}:3000"`, así que un stack levantado sin `PORT` la deja en el
 * 3000 y hay que decírselo a las dos puntas.
 *
 * Sólo lo usa el alta del paciente y la comprobación de que la API vive: el
 * navegador nunca la llama directo, va por el proxy del servidor de desarrollo.
 */
export function urlDeApi(): string {
  return process.env['E2E_API_URL'] ?? 'http://localhost:3005';
}

/** Contexto de peticiones fuera del navegador, para dar de alta antes de entrar. */
export async function contextoDeApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: urlDeApi() });
}

/**
 * Comprueba que la API esté viva.
 *
 * Se llama antes que nada: un backend caído hace fallar cada prueba por un
 * motivo distinto y ninguno dice la verdad, que es que no hay API.
 */
export async function apiViva(api: APIRequestContext): Promise<boolean> {
  try {
    const respuesta = await api.get('/health', { timeout: 10_000 });
    return respuesta.ok();
  } catch {
    return false;
  }
}

/**
 * La operadora de facturación del prestador (`BILLING_OPERATOR`).
 *
 * La siembra `tools/redesa/seed-solicitudes-seguro.mjs` en el repositorio de la
 * API, con membresía en la organización y el rol acotado a ese tenant.
 *
 * **Existe para no certificar T16 con el administrador.** El admin entra a
 * cualquier lado por el comodín `SUPERADMIN`, así que probar con él no dice
 * nada del único rol que un usuario real va a tener — y la pantalla de
 * solicitudes es justamente la del operador de facturación (TAREA-16 · D1.b).
 */
export function operadoraDeFacturacion(): Actor {
  return {
    rol: 'operadora de facturación',
    identificador:
      process.env['E2E_BILLING_OPERATOR_EMAIL'] ??
      'facturacion.demo@alovida.test',
    clave: process.env['E2E_BILLING_OPERATOR_PASSWORD'] ?? 'D3mo-passw0rd!',
    nombre: 'Operadora de facturación',
  };
}

/** Credenciales de la cuenta sembrada por `BOOTSTRAP_ADMIN_*` al arrancar la API. */
export function administrador(): Actor {
  return {
    rol: 'administrador',
    identificador:
      process.env['E2E_ADMIN_EMAIL'] ?? 'admin@alovida.com',
    clave: process.env['E2E_ADMIN_PASSWORD'] ?? '12345678',
    nombre: 'Administrador',
  };
}

/**
 * La profesional de demostración que siembra
 * `tools/redesa/cuenta-doctor-demo.mjs`.
 *
 * No se registra una nueva en cada corrida —como sí se hace con el paciente—
 * porque un profesional recién registrado nace **sin perfil completo ni
 * matrícula aprobada**, y entonces el barrido mediría las pantallas de alguien
 * a medio dar de alta en vez de las de quien ejerce.
 */
export function doctora(): Actor {
  return {
    rol: 'doctora',
    identificador: process.env['E2E_DOCTOR_EMAIL'] ?? 'pabliarca@gmail.com',
    clave: process.env['E2E_DOCTOR_PASSWORD'] ?? 'D3mo-passw0rd!',
    nombre: 'Dra. Valeria Fuentes Aramayo',
  };
}

/**
 * El nombre del paciente, en las cuatro partes que manda el formulario.
 *
 * `displayName` está deprecado en `RegisterPatientDto`: el backend compone el
 * nombre a partir de estas cuatro, y dar de alta por el campo viejo produciría
 * datos que ninguna persona real produce.
 */
const NOMBRE_PACIENTE = Object.freeze({
  name: 'Ana',
  middleName: 'Lucía',
  lastName: 'Quispe',
  motherLastName: 'Mamani',
});

let secuenciaDeAltas = 0;

/**
 * Sufijo único de un alta.
 *
 * El documento y el correo son únicos en el backend: dos altas con el mismo
 * sufijo chocan con `409`. El reloj distingue corridas y la secuencia distingue
 * altas dentro de una misma corrida.
 */
function sufijoDeAlta(): string {
  secuenciaDeAltas += 1;
  return `${String(Date.now()).slice(-9)}${secuenciaDeAltas}`;
}

/**
 * **Paciente** — se da de alta solo, sin admin ni token.
 *
 * Se crea uno por corrida en vez de reutilizar una cuenta fija porque las
 * cuentas de paciente de la base de desarrollo no tienen contraseña conocida
 * (se guardan con argon2), y probar a ciegas gasta intentos contra un
 * `ACCOUNT_LOCK_THRESHOLD` de cinco.
 *
 * Entra con su **documento**, no con su correo: es el camino que la pantalla de
 * ingreso resuelve por la ausencia de `@`.
 */
export async function crearPaciente(api: APIRequestContext): Promise<Actor> {
  const sufijo = sufijoDeAlta();
  const nationalId = `CI-PW-${sufijo}`;

  const respuesta = await api.post('/iam/auth/register-patient', {
    data: {
      nationalId,
      password: CLAVE,
      ...NOMBRE_PACIENTE,
      email: `paciente-pw-${sufijo}@example.test`,
      phone: '+591 70055555',
      gender: 'FEMALE',
      sexAtBirth: 'FEMALE',
    },
  });

  if (!respuesta.ok()) {
    throw new Error(
      `POST /iam/auth/register-patient respondió ${respuesta.status()}: ${await respuesta.text()}`,
    );
  }

  return {
    rol: 'paciente',
    identificador: nationalId,
    clave: CLAVE,
    nombre: Object.values(NOMBRE_PACIENTE).join(' '),
  };
}
