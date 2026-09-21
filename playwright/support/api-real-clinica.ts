import type { APIRequestContext } from '@playwright/test';

import { crearPaciente, type Actor } from './actores';

/**
 * Cuentas y datos clínicos creados **contra la API real**, para las
 * microtareas de C-14/C-23 que la maqueta no puede cerrar: no falla a
 * pedido, y nada de lo que guarda lo vio una base de verdad.
 *
 * Reutiliza `crearPaciente` de `actores.ts` tal cual —ya resuelve municipio y
 * departamento contra `/terminology/value-sets/:id/$expand`— en vez de
 * duplicar esa lógica.
 */

const CLAVE = 'S3cret-passw0rd';

let secuencia = 0;

/** Sufijo único por alta, igual criterio que `actores.ts`. */
function sufijo(): string {
  secuencia += 1;
  return `${String(Date.now()).slice(-9)}${secuencia}`;
}

function claims(token: string): Record<string, unknown> {
  const [, cuerpo] = token.split('.');
  return JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as Record<string, unknown>;
}

async function cuerpoDeError(respuesta: { status(): number; text(): Promise<string> }): Promise<string> {
  return `${respuesta.status()}: ${await respuesta.text()}`;
}

export interface MedicoSintetico {
  readonly actor: Actor;
  readonly token: string;
  readonly tenantId: string;
  readonly hpid: string;
}

/**
 * Un profesional **sintético**, dado de alta y logueado contra la API real.
 *
 * Nunca la cuenta de `doctora()` de `actores.ts`: esa es una persona real
 * (`pabliarca@gmail.com`) sembrada en el ambiente. Acá el lote exige
 * «ninguna captura con datos de una persona real» — de ahí el correo
 * `@example.test`, mismo dominio que usan los int-spec de la API.
 */
export async function crearMedicoSintetico(api: APIRequestContext): Promise<MedicoSintetico> {
  const s = sufijo();
  const email = `c14-real-med-${s}@example.test`;
  const alta = await api.post('/iam/auth/register-practitioner', {
    data: {
      email,
      password: CLAVE,
      name: 'Marcelo',
      lastName: 'Ávila',
      licenseNumber: `LIC-PW-${s}`,
      credentialNumber: `CRED-PW-${s}`,
    },
  });
  if (!alta.ok()) {
    throw new Error(`POST /iam/auth/register-practitioner respondió ${await cuerpoDeError(alta)}`);
  }
  const login = await api.post('/iam/auth/login', { data: { email, password: CLAVE } });
  if (!login.ok()) {
    throw new Error(`POST /iam/auth/login (médico) respondió ${await cuerpoDeError(login)}`);
  }
  const token = ((await login.json()) as { accessToken: string }).accessToken;
  const decoded = claims(token);
  return {
    actor: {
      rol: 'doctora',
      identificador: email,
      clave: CLAVE,
      nombre: 'Marcelo Ávila (sintético, Playwright)',
    },
    token,
    tenantId: (decoded['tenants'] as string[])[0],
    hpid: decoded['hpid'] as string,
  };
}

export interface PacienteSintetico {
  readonly actor: Actor;
  readonly token: string;
  readonly pid: string;
}

/** `crearPaciente` de `actores.ts` + su token y `pid`, que esa función no expone. */
export async function crearPacienteConToken(api: APIRequestContext): Promise<PacienteSintetico> {
  const actor = await crearPaciente(api);
  const login = await api.post('/iam/auth/login', {
    data: { nationalId: actor.identificador, password: actor.clave },
  });
  if (!login.ok()) {
    throw new Error(`POST /iam/auth/login (paciente) respondió ${await cuerpoDeError(login)}`);
  }
  const token = ((await login.json()) as { accessToken: string }).accessToken;
  return { actor, token, pid: claims(token)['pid'] as string };
}

/**
 * La guardia de lectura (FT-07) exige turno de hoy **o** relación
 * asistencial vigente. Se resuelve por relación: publicar agenda y confirmar
 * un turno son carriles ajenos.
 */
export async function crearRelacionAsistencial(
  api: APIRequestContext,
  medico: MedicoSintetico,
  paciente: PacienteSintetico,
): Promise<void> {
  const solicitud = await api.post('/authz/care-relationships/request', {
    headers: { Authorization: `Bearer ${medico.token}` },
    data: {
      tenantId: medico.tenantId,
      patientProfileId: paciente.pid,
      relationshipType: 'TREATING',
      reasonText: 'C-14/C-23 · evidencia contra API real (Playwright)',
    },
  });
  if (!solicitud.ok()) {
    throw new Error(`POST /authz/care-relationships/request respondió ${await cuerpoDeError(solicitud)}`);
  }
  const { id } = (await solicitud.json()) as { id: string };
  const respuesta = await api.post(`/authz/care-relationships/${id}/respond`, {
    headers: { Authorization: `Bearer ${paciente.token}` },
    data: { decision: 'ACCEPT' },
  });
  if (!respuesta.ok()) {
    throw new Error(`POST /authz/care-relationships/${id}/respond respondió ${await cuerpoDeError(respuesta)}`);
  }
}

/**
 * Abre un encuentro y registra una observación por API, para que la
 * cuadrícula ya tenga **una columna existente** al abrirla en el navegador.
 *
 * Necesario porque el selector «Agregar columna» depende de
 * `GET /system-context/dynamic-enums?target=clinical.observations.code_concept_id`,
 * y esta base de Neon no tiene sembrado ningún value set de clínica (hallazgo
 * de la Fase 0): el `<select>` de esa columna sale vacío. La columna que ya
 * viene de una observación previa no depende de ese catálogo — sale de
 * `observations().map(obs => obs.codeConceptId)` (`note-grid.ts`).
 */
export interface ObservacionSembrada {
  readonly codeConceptId: string;
  readonly encounterId: string;
}

export async function sembrarObservacionPrevia(
  api: APIRequestContext,
  medico: MedicoSintetico,
  paciente: PacienteSintetico,
): Promise<ObservacionSembrada> {
  const conceptos = await api.get('/terminology/concepts?limit=1', {
    headers: { Authorization: `Bearer ${medico.token}` },
  });
  if (!conceptos.ok()) {
    throw new Error(`GET /terminology/concepts respondió ${await cuerpoDeError(conceptos)}`);
  }
  const codeConceptId = ((await conceptos.json()) as { items: { conceptId: string }[] }).items[0]
    .conceptId;

  const checkIn = await api.post('/clinical/encounters/check-in', {
    headers: { Authorization: `Bearer ${medico.token}` },
    data: { patientProfileId: paciente.pid, tenantId: medico.tenantId },
  });
  if (!checkIn.ok()) {
    throw new Error(`POST /clinical/encounters/check-in respondió ${await cuerpoDeError(checkIn)}`);
  }
  const { id: encounterId } = (await checkIn.json()) as { id: string };

  const observacion = await api.post('/clinical/observations', {
    headers: { Authorization: `Bearer ${medico.token}` },
    data: {
      custodianTenantId: medico.tenantId,
      patientProfileId: paciente.pid,
      encounterId,
      codeConceptId,
      quantityValue: 65,
    },
  });
  if (!observacion.ok()) {
    throw new Error(`POST /clinical/observations respondió ${await cuerpoDeError(observacion)}`);
  }

  // Este encuentro NO se cierra a propósito, y no por elección: se intentó
  // (`POST /clinical/encounters/:id/close`) y esta base de Neon lo responde
  // con 500 — `InvalidFieldNameException: column "content_hash" of relation
  // "encounters" does not exist` (`EncountersService.close`, código Postgres
  // 42703). Es deriva de esquema real: la entidad ORM declara una columna
  // que este ambiente no tiene materializada. Se documenta como defecto para
  // el dueño del modelo/infra; no se toca desde acá.
  //
  // Consecuencia para quien llama: el encuentro queda ABIERTO, así que si la
  // UI abre uno nuevo para el mismo paciente puede terminar habiendo DOS
  // simultáneos, y `encuentroActual` (`consultation.ts`,
  // `encuentrosEnCurso()[0]`) elige uno de los dos sin garantía de cuál —se
  // reprodujo con el sembrado ganando ese lugar, y entonces la cuadrícula
  // trataba «esta consulta» como si ya tuviera su fila. Por eso se devuelve
  // también `encounterId`: quien llama puede optar por NO abrir un segundo
  // encuentro y trabajar directamente sobre este.
  return { codeConceptId, encounterId };
}
