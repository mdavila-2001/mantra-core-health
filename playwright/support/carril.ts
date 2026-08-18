import {
  test,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  type PlaywrightWorkerArgs,
  type PlaywrightWorkerOptions,
  type TestInfo,
} from '@playwright/test';

import { ACTORES } from '../../src/testing/acceptance/core/contracts/actor.keys';
import type { JourneySpec } from '../../src/testing/acceptance/core/contracts/journey.types';

/**
 * El puente entre el catálogo de journeys y el runner.
 *
 * ## Por qué las credenciales salen del entorno
 *
 * El contrato de semillas exige autenticación **real** y prohíbe fabricar
 * tokens. Las identidades las crea el seed del ambiente E2E y sus credenciales
 * llegan por variables de entorno; escribirlas acá terminaría, tarde o
 * temprano, siendo la clave de un ambiente que no es el de pruebas.
 */
const VARIABLES: Record<string, { email: string; clave: string }> = {
  [ACTORES.adminSecurity]: {
    email: 'E2E_ADMIN_EMAIL',
    clave: 'E2E_ADMIN_PASSWORD',
  },
  [ACTORES.doctorOne]: {
    email: 'E2E_DOCTOR_1_EMAIL',
    clave: 'E2E_DOCTOR_1_PASSWORD',
  },
  [ACTORES.doctorTwo]: {
    email: 'E2E_DOCTOR_2_EMAIL',
    clave: 'E2E_DOCTOR_2_PASSWORD',
  },
  [ACTORES.patientOne]: {
    email: 'E2E_PATIENT_1_EMAIL',
    clave: 'E2E_PATIENT_1_PASSWORD',
  },
  [ACTORES.patientTwo]: {
    email: 'E2E_PATIENT_2_EMAIL',
    clave: 'E2E_PATIENT_2_PASSWORD',
  },
};

/** Las credenciales de un actor sembrado, o `null` si el ambiente no las declaró. */
export function credenciales(
  actor: string,
): { readonly identificador: string; readonly clave: string } | null {
  const nombres = VARIABLES[actor];
  if (nombres === undefined) return null;
  const identificador = process.env[nombres.email];
  const clave = process.env[nombres.clave];
  return identificador && clave ? { identificador, clave } : null;
}

/**
 * Un identificador único por corrida.
 *
 * Va dentro de cada texto que el journey crea. Sin él, dos corridas —o una
 * corrida sobre una base que no se reseteó— se confunden entre sí, y la
 * aserción encuentra la publicación de ayer y pasa.
 */
export function runId(): string {
  return (
    process.env['E2E_RUN_ID'] ??
    `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
  );
}

/**
 * El cuerpo de una prueba, con las fixtures que Playwright inyecta.
 *
 * Se escribe a mano porque `Parameters<typeof test>[1]` resuelve a la sobrecarga
 * equivocada —`TestDetails`— y deja `browser` como `any`, que es justo el tipo
 * que hace falta para que un error de fixture se vea al compilar.
 */
type CuerpoDePrueba = (
  args: PlaywrightTestArgs &
    PlaywrightTestOptions &
    PlaywrightWorkerArgs &
    PlaywrightWorkerOptions,
  testInfo: TestInfo,
) => Promise<void> | void;

/**
 * Registra un journey del catálogo como prueba de Playwright.
 *
 * ## Por qué se saltea en vez de fallar cuando no hay ambiente
 *
 * Sin stack levantado estos journeys **no se pueden ejecutar**: no hay API, ni
 * semillas, ni workers. Hacerlos fallar en esa situación llenaría el informe de
 * rojos que no dicen nada del producto, y el equipo aprendería a ignorarlos —
 * que es peor que no tenerlos.
 *
 * Se saltean con el motivo escrito, así que el informe dice **qué falta** en vez
 * de mentir en cualquiera de las dos direcciones. Cuando el ambiente está, no
 * hay nada que activar: las variables ya están y la prueba corre.
 *
 * @param spec - El journey del catálogo compartido.
 * @param implementacion - Cómo lo ejecuta este adaptador.
 */
export function journeyTest(
  spec: JourneySpec,
  implementacion: CuerpoDePrueba,
): void {
  const faltantes = spec.actors
    .filter((actor) => actor !== 'anonimo')
    .filter((actor) => credenciales(actor) === null);

  test(`${spec.id} · ${spec.title}`, async (args, testInfo) => {
    test.skip(
      faltantes.length > 0,
      `Ambiente E2E incompleto: faltan credenciales de ${faltantes.join(', ')}. ` +
        `Este journey exige ${spec.requiresLive.join(', ')} corriendo de verdad ` +
        `y semillas verificadas por login real; sin eso no se puede afirmar nada.`,
    );
    await implementacion(args, testInfo);
  });
}
