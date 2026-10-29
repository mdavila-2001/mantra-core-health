import { CONTENT_DIALOG_SCENARIOS } from './content-dialog.scenarios';
import { DATA_TABLE_SCENARIOS } from './data-table.scenarios';
import type { ComponentScenario } from './scenario.types';
import { VIEW_STATE_HOST_SCENARIOS } from './view-state-host.scenarios';

/* ============================================================================
    El registro de escenarios: qué componentes del índice generado tienen un
    anfitrión escrito a mano, y con qué variantes.

    Está en TypeScript y no en el índice generado a propósito: un escenario es
    una clase con plantillas, funciones y proyección, y eso no cabe en un JSON.
    El índice sigue diciendo *qué existe*; esto dice *cómo se monta de verdad*.

    Un componente sin escenario se sigue montando como antes, con los valores
    del generador. La ficha lo dice: «montado con valores generados», que no
    es lo mismo que «montado con un contrato válido».
    ========================================================================== */

export const SCENARIOS: readonly ComponentScenario[] = [
  ...DATA_TABLE_SCENARIOS,
  ...CONTENT_DIALOG_SCENARIOS,
  ...VIEW_STATE_HOST_SCENARIOS,
];

const BY_KEY = new Map<string, ComponentScenario[]>();
for (const escenario of SCENARIOS) {
  const lista = BY_KEY.get(escenario.clave) ?? [];
  lista.push(escenario);
  BY_KEY.set(escenario.clave, lista);
}

/** Los escenarios de un componente, en el orden en que se declararon. */
export function scenariosOf(clave: string): readonly ComponentScenario[] {
  return BY_KEY.get(clave) ?? [];
}

/** Cuántos componentes del índice tienen al menos un escenario. */
export const KEYS_WITH_SCENARIO: ReadonlySet<string> = new Set(BY_KEY.keys());
