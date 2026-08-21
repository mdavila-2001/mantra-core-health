import { request, type APIRequestContext, type APIResponse } from '@playwright/test';

import { urlDeApi } from './actores';

/**
 * Soporte de la suite de auditoría (TJ-4).
 *
 * ## Qué es esta suite, y qué NO es
 *
 * Es una **auditoría**, no una prueba de regresión: toma los criterios de
 * aceptación de los 12 prompts y los ejercita contra la API viva para descubrir
 * qué cumplimos y qué no. Un rojo acá **no es una prueba rota**: es un defecto
 * encontrado, y va al registro con su evidencia literal.
 *
 * Por eso el soporte no tiene aserciones propias ni «hace que pase»: sólo sabe
 * hablar con la API, crear datos con nombres propios y contar lo que respondió.
 *
 * ## Los datos son propios, no sembrados
 *
 * Todo lo que la suite necesita lo crea ella con prefijo `tj4-`. Depender de
 * seeds haría que un rojo dependiera de qué paquete tiene cargado la máquina
 * —y eso ya nos pasó: esta base no tiene el catálogo de v4.0.11—.
 */

/** Prefijo de todo lo que crea la suite, para reconocerlo y no chocar. */
export const PREFIJO = 'tj4';

/** La contraseña de las cuentas que la suite da de alta. */
export const CLAVE_AUDITORIA = 'S3cret-passw0rd';

/** Sufijo único por corrida y por llamada: el backend exige documentos únicos. */
let secuencia = 0;
export function sufijo(): string {
  secuencia += 1;
  return `${String(Date.now()).slice(-9)}${secuencia}`;
}

/** Una sesión abierta contra la API, con su token y su tenant. */
export interface Sesion {
  readonly api: APIRequestContext;
  readonly accessToken: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly roles: readonly string[];
}

/** Lee el cuerpo de un token JWT sin verificarlo: sólo para saber tenant y roles. */
function cuerpoDelToken(token: string): Record<string, unknown> {
  const partes = token.split('.');
  if (partes.length < 2) return {};
  try {
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

/**
 * El limitador de ingresos contestó.
 *
 * Es un tipo propio y no un `Error` cualquiera para que las pruebas puedan
 * distinguir «no pude medir» de «el producto falló»: confundirlos llenaría el
 * registro de defectos con hallazgos inventados.
 */
export class LimitadorActivo extends Error {
  constructor(detalle: string) {
    super(`El limitador de /iam/auth/login está activo: ${detalle}`);
    this.name = 'LimitadorActivo';
  }
}

/** Con qué se identifica quien entra: correo o documento. */
export type Credencial = { readonly email: string } | { readonly nationalId: string };

/**
 * Abre una sesión.
 *
 * Los campos son `email` / `nationalId`, no `identifier`: verificado contra la
 * API viva —`identifier` vuelve 400 «property identifier should not exist»—.
 *
 * Los pacientes recién dados de alta entran **por documento**: el correo con el
 * que se registraron devuelve 401. Eso es un hallazgo de la auditoría, no una
 * decisión de este arnés, y tiene su propio criterio; acá simplemente se usa el
 * camino que funciona para poder medir todo lo demás.
 */
export async function entrar(credencial: Credencial, password: string): Promise<Sesion> {
  const anonimo = await request.newContext({ baseURL: urlDeApi() });
  const respuesta = await anonimo.post('/iam/auth/login', {
    data: { ...credencial, password },
  });
  if (respuesta.status() === 429) {
    // El limitador de `/iam/auth/login` (10 por minuto y por IP) es una defensa
    // sana. Si la suite lo toca —porque una corrida anterior lo dejó caliente—,
    // lo que corresponde es NO MEDIR, no anotar un defecto que no existe.
    throw new LimitadorActivo(await respuesta.text());
  }
  if (!respuesta.ok()) {
    throw new Error(
      `login ${JSON.stringify(credencial)} → ${respuesta.status()}: ${await respuesta.text()}`,
    );
  }
  const cuerpo = (await respuesta.json()) as { accessToken: string };
  await anonimo.dispose();

  const datos = cuerpoDelToken(cuerpo.accessToken);
  const tenants = Array.isArray(datos['tenants']) ? (datos['tenants'] as string[]) : [];
  const tenantId = tenants[0] ?? '';

  return {
    api: await request.newContext({
      baseURL: urlDeApi(),
      extraHTTPHeaders: {
        Authorization: `Bearer ${cuerpo.accessToken}`,
        // Sin la cabecera de tenant el interceptor responde 403 antes del
        // handler: no es opcional aunque el token ya lo declare.
        ...(tenantId === '' ? {} : { 'X-Tenant-Id': tenantId }),
      },
    }),
    accessToken: cuerpo.accessToken,
    tenantId,
    userId: String(datos['sub'] ?? ''),
    roles: Array.isArray(datos['roles']) ? (datos['roles'] as string[]) : [],
  };
}

/** La sesión del administrador de arranque, que es quien puede crear cosas. */
export async function entrarComoAdmin(): Promise<Sesion> {
  return entrar(
    { email: process.env['E2E_ADMIN_EMAIL'] ?? 'justin.admin@redesa.test' },
    process.env['E2E_ADMIN_PASSWORD'] ?? 'Alovida2026!',
  );
}

/** Da de alta un paciente nuevo y abre su sesión. */
export async function crearPacienteYEntrar(): Promise<{
  sesion: Sesion;
  email: string;
  nationalId: string;
}> {
  const s = sufijo();
  const email = `${PREFIJO}-paciente-${s}@example.test`;
  const nationalId = `CI-${PREFIJO.toUpperCase()}-${s}`;
  const anonimo = await request.newContext({ baseURL: urlDeApi() });
  const alta = await anonimo.post('/iam/auth/register-patient', {
    data: {
      nationalId,
      password: CLAVE_AUDITORIA,
      name: 'Auditoria',
      middleName: 'De',
      lastName: 'Criterios',
      motherLastName: 'Prompts',
      email,
      phone: '+591 70044444',
      gender: 'FEMALE',
      sexAtBirth: 'FEMALE',
    },
  });
  if (!alta.ok()) {
    throw new Error(`register-patient → ${alta.status()}: ${await alta.text()}`);
  }
  await anonimo.dispose();
  return { sesion: await entrar({ nationalId }, CLAVE_AUDITORIA), email, nationalId };
}

/**
 * El resultado de una llamada, con el cuerpo ya leído.
 *
 * Se guarda el texto crudo además del JSON porque la evidencia que va al
 * registro de defectos tiene que ser **literal**: un objeto reformateado no
 * prueba lo mismo que lo que contestó el servidor.
 */
export interface Respuesta {
  readonly status: number;
  readonly texto: string;
  readonly json: unknown;
}

export async function leer(respuesta: APIResponse): Promise<Respuesta> {
  const texto = await respuesta.text();
  // Un cuerpo que no es JSON no es un error: un 404 de Express llega como HTML
  // y la evidencia literal sigue sirviendo igual.
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    json = null;
  }
  return { status: respuesta.status(), texto, json };
}

/** Recorta la evidencia para que entre en el registro sin tapar todo lo demás. */
export function evidencia(r: Respuesta, tope = 400): string {
  const cuerpo = r.texto.length > tope ? `${r.texto.slice(0, tope)}…` : r.texto;
  return `HTTP ${r.status} · ${cuerpo}`;
}
