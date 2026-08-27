import type { APIRequestContext } from '@playwright/test';

import type { Actor } from './actores';

/**
 * Aprobar la identidad de alguien **por la API viva**, para las pruebas que
 * necesitan un titular verificado.
 *
 * Es el mínimo portado de `cypress/support/real/casos.ts` —el único lugar del
 * repositorio donde este trámite estaba resuelto— porque Playwright no tenía
 * forma de producir un paciente verificado: `actores.ts` sólo da de alta, y
 * quien se registra nace sin aserción de identidad.
 *
 * Va por la API y no por pantalla a propósito: el formulario de subida ya lo
 * cubren los recorridos de Cypress, y repetirlo acá agregaría puntos de fallo
 * sin agregar evidencia. Lo que estas pruebas miran es lo que el titular ve
 * **después**.
 *
 * Cada paso falla con el estado y el cuerpo literal que devolvió la API: si el
 * trámite no es reproducible en un entorno, el motivo tiene que quedar escrito,
 * no deducido.
 */

/** El texto de la respuesta, acotado: un cuerpo entero de error tapa el motivo. */
async function detalle(respuesta: { status(): number; text(): Promise<string> }): Promise<string> {
  return `${respuesta.status()}: ${(await respuesta.text()).slice(0, 400)}`;
}

/**
 * Canjea credenciales por un token de acceso.
 *
 * El identificador decide el campo, igual que la pantalla de ingreso: con `@`
 * es correo, sin `@` es documento.
 */
export async function tokenDe(api: APIRequestContext, actor: Actor): Promise<string> {
  const respuesta = await api.post('/iam/auth/login', {
    data: {
      ...(actor.identificador.includes('@')
        ? { email: actor.identificador }
        : { nationalId: actor.identificador }),
      password: actor.clave,
    },
  });

  if (!respuesta.ok()) {
    throw new Error(
      `POST /iam/auth/login rechazó a «${actor.identificador}» — ${await detalle(respuesta)}`,
    );
  }

  const cuerpo = (await respuesta.json()) as { accessToken?: string };
  if (typeof cuerpo.accessToken !== 'string') {
    throw new Error('POST /iam/auth/login respondió sin `accessToken`.');
  }
  return cuerpo.accessToken;
}

/** El `conceptId` de un código del catálogo, **buscado y no inventado**. */
export async function conceptoPorCodigo(
  api: APIRequestContext,
  token: string,
  codigo: string,
): Promise<string> {
  const respuesta = await api.get('/terminology/concepts', {
    params: { q: codigo, limit: 20 },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!respuesta.ok()) {
    throw new Error(`GET /terminology/concepts falló — ${await detalle(respuesta)}`);
  }

  const cuerpo = (await respuesta.json()) as {
    items?: readonly { conceptId: string; code: string }[];
  };
  const encontrado = (cuerpo.items ?? []).find((item) => item.code === codigo);
  if (encontrado === undefined) {
    throw new Error(`El catálogo no trae el concepto «${codigo}».`);
  }
  return encontrado.conceptId;
}

/** Un PNG de 1×1 real: la API valida los bytes del archivo, no el rótulo del multipart. */
const DOCUMENTO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Sube un documento y abre el caso de verificación; devuelve su identificador.
 *
 * El multipart lo arma Playwright: su `multipart` serializa el archivo de
 * verdad, que es justo lo que `cy.request` no hace (la lección está escrita en
 * el recorrido `06`, donde el archivo llegaba vacío).
 */
export async function abrirCaso(api: APIRequestContext, token: string): Promise<string> {
  const subida = await api.post('/common/files/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: 'documento.png',
        mimeType: 'image/png',
        buffer: DOCUMENTO_PNG,
      },
      category: 'DOCUMENT',
      sensitivity: 'PHI',
    },
  });

  if (!subida.ok()) {
    throw new Error(`POST /common/files/upload falló — ${await detalle(subida)}`);
  }

  const archivo = (await subida.json()) as { id?: string };
  if (typeof archivo.id !== 'string') {
    throw new Error('La subida respondió sin el id del archivo.');
  }

  const caso = await api.post('/identity/me/identity-verification', {
    headers: { Authorization: `Bearer ${token}` },
    data: { evidenceFileId: archivo.id },
  });

  if (!caso.ok()) {
    throw new Error(`POST /identity/me/identity-verification falló — ${await detalle(caso)}`);
  }

  const cuerpo = (await caso.json()) as { caseId?: string };
  if (typeof cuerpo.caseId !== 'string') {
    throw new Error('La apertura respondió sin el id del caso.');
  }
  return cuerpo.caseId;
}

/**
 * Escala el caso a revisión manual y lo decide. Son las dos transiciones que
 * mueven el trámite, y las dos exigen una cuenta con permisos de revisión.
 */
export async function escalarYDecidir(
  api: APIRequestContext,
  tokenRevisor: string,
  caseId: string,
  motivoConceptId: string,
  decision: 'APPROVED' | 'REJECTED',
  motivo: string,
): Promise<void> {
  const escalada = await api.post(`/identity/verification-cases/${caseId}/manual-review`, {
    headers: { Authorization: `Bearer ${tokenRevisor}` },
    data: { reviewReasonConceptId: motivoConceptId },
  });

  if (!escalada.ok()) {
    throw new Error(`Escalar el caso ${caseId} falló — ${await detalle(escalada)}`);
  }

  const revision = (await escalada.json()) as { id?: string };
  if (typeof revision.id !== 'string') {
    throw new Error('Escalar respondió sin el id de la revisión.');
  }

  const decidida = await api.post(`/identity/manual-review/${revision.id}/decision`, {
    headers: { Authorization: `Bearer ${tokenRevisor}` },
    data: { decision, decisionReason: motivo },
  });

  if (!decidida.ok()) {
    throw new Error(`Decidir la revisión ${revision.id} falló — ${await detalle(decidida)}`);
  }
}

/**
 * El intento de ingreso de un revisor: o su token, o el **motivo literal** del
 * rechazo.
 *
 * Existe porque las credenciales del revisor las declara el entorno
 * (`E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`) y las de `actores.ts` son sólo un
 * valor por defecto. Una máquina que no las exporta no tiene un defecto del
 * producto que reportar: tiene un tramo que no puede ejecutar, y la diferencia
 * entre las dos cosas se pierde si el rechazo llega como una excepción más.
 */
export type AccesoDeRevisor = { readonly token: string } | { readonly motivo: string };

export async function accesoDeRevisor(
  api: APIRequestContext,
  revisor: Actor,
): Promise<AccesoDeRevisor> {
  try {
    return { token: await tokenDe(api, revisor) };
  } catch (fallo) {
    return { motivo: fallo instanceof Error ? fallo.message : String(fallo) };
  }
}

/**
 * El trámite completo, de punta a punta: el titular abre su caso y el revisor
 * lo aprueba. Al volver, ese titular tiene identidad verificada vigente.
 *
 * El token del revisor lo trae quien llama —ya lo tuvo que resolver para saber
 * si el tramo era ejecutable— y así el trámite no gasta un ingreso de más
 * contra el límite de diez por minuto del backend.
 */
export async function aprobarIdentidad(
  api: APIRequestContext,
  titular: Actor,
  tokenRevisor: string,
): Promise<void> {
  const tokenTitular = await tokenDe(api, titular);
  // `ACTIVE` es el motivo de revisión que usa el recorrido real `08`: sale del
  // catálogo, no de una constante inventada acá.
  const motivo = await conceptoPorCodigo(api, tokenRevisor, 'ACTIVE');

  const caso = await abrirCaso(api, tokenTitular);
  await escalarYDecidir(api, tokenRevisor, caso, motivo, 'APPROVED', 'Documento legible');
}
