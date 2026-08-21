import { type APIRequestContext } from '@playwright/test';
import { CLAVE } from './actores';

/**
 * Cuentas **organización** (broker, laboratorio, consultorio) — el otro medio
 * de la mensajería en tiempo real, además de doctor y paciente.
 *
 * Las tres nacen del mismo endpoint (`register-organization`), que crea el
 * tenant y la cuenta owner **en una sola transacción**, ya ACTIVA: no hace
 * falta esperar la verificación de la plataforma para poder loguearse ni para
 * chatear — eso lo confirma el propio smoke del backend
 * (`test/smoke/modules/organizacion.smoke.ts`).
 *
 * `countryConceptId`/`jurisdictionConceptId` son obligatorios para los tipos
 * territoriales (PROVIDER, MEDICAL_OFFICE) pero **no** necesitan ser
 * conceptos geográficos reales — el propio smoke del backend usa
 * `CONCEPTS.STATE_ACTIVE` como relleno, «lo que importa es que exista». Acá
 * se usa el mismo id, calculado del mismo namespace UUIDv5 que usa el backend
 * (`deterministicId('state:active')`, `src/common/constants/concepts.ts`) y
 * confirmado contra la base compartida.
 */
const CONCEPT_RELLENO = '38a1d301-f40d-5b17-a695-5e6d605f8b19';

let secuencia = 0;

function sufijo(): string {
  secuencia += 1;
  return `${String(Date.now()).slice(-9)}${secuencia}`;
}

/**
 * El resultado de dar de alta una organización: las credenciales de su owner
 * —con las que entra por la pantalla de ingreso, como cualquier actor— y su
 * tenant.
 *
 * No extiende `Actor` (de `actores.ts`): ese tipo fija `rol` a
 * `'administrador' | 'doctora' | 'paciente'`, y una organización no es
 * ninguno de los tres — es una cuenta owner de un tenant, no un rol clínico.
 */
export interface ActorOrganizacion {
  readonly identificador: string;
  readonly clave: string;
  readonly nombre: string;
  readonly tenantId: string;
}

async function registrarOrganizacion(
  api: APIRequestContext,
  nombre: string,
  organization: Record<string, unknown>,
): Promise<ActorOrganizacion> {
  const suf = sufijo();
  const email = `org-${nombre}-pw-${suf}@example.test`;

  const respuesta = await api.post('/iam/auth/register-organization', {
    data: {
      organization: {
        code: `ORG-${nombre.toUpperCase()}-${suf}`,
        legalName: `${nombre} de prueba ${suf}`,
        ...organization,
      },
      owner: {
        email,
        password: CLAVE,
        name: nombre,
        lastName: 'Organización',
      },
    },
  });

  if (!respuesta.ok()) {
    throw new Error(
      `POST /iam/auth/register-organization (${nombre}) respondió ${respuesta.status()}: ${await respuesta.text()}`,
    );
  }
  const cuerpo = (await respuesta.json()) as { tenantId: string };

  return {
    identificador: email,
    clave: CLAVE,
    nombre: `${nombre} de prueba ${suf}`,
    tenantId: cuerpo.tenantId,
  };
}

/** Un broker: `tenantType: 'BROKER'`, con su bloque `broker` obligatorio. */
export async function crearBroker(api: APIRequestContext): Promise<ActorOrganizacion> {
  const suf = sufijo();
  return registrarOrganizacion(api, 'Broker', {
    tenantType: 'BROKER',
    broker: { brokerCode: `BRO-${suf}`, licenseNumber: `LIC-BRO-${suf}` },
  });
}

/** Un laboratorio: no hay tipo de tenant dedicado, cae bajo PROVIDER. */
export async function crearLaboratorio(
  api: APIRequestContext,
): Promise<ActorOrganizacion> {
  return registrarOrganizacion(api, 'Laboratorio', {
    tenantType: 'PROVIDER',
    countryConceptId: CONCEPT_RELLENO,
    jurisdictionConceptId: CONCEPT_RELLENO,
  });
}

/** Un consultorio: `tenantType: 'MEDICAL_OFFICE'` — la cuenta organización. */
export async function crearConsultorio(
  api: APIRequestContext,
): Promise<ActorOrganizacion> {
  return registrarOrganizacion(api, 'Consultorio', {
    tenantType: 'MEDICAL_OFFICE',
    countryConceptId: CONCEPT_RELLENO,
    jurisdictionConceptId: CONCEPT_RELLENO,
  });
}
