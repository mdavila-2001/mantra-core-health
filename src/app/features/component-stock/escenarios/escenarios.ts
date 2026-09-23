import { ESCENARIOS_DE_CONTENT_DIALOG } from './content-dialog.escenarios';
import { ESCENARIOS_DE_DATA_TABLE } from './data-table.escenarios';
import type { EscenarioDeComponente } from './escenario.types';
import { ESCENARIOS_DE_VIEW_STATE_HOST } from './view-state-host.escenarios';

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

export const ESCENARIOS: readonly EscenarioDeComponente[] = [
  ...ESCENARIOS_DE_DATA_TABLE,
  ...ESCENARIOS_DE_CONTENT_DIALOG,
  ...ESCENARIOS_DE_VIEW_STATE_HOST,
];

const POR_CLAVE = new Map<string, EscenarioDeComponente[]>();
for (const escenario of ESCENARIOS) {
  const lista = POR_CLAVE.get(escenario.clave) ?? [];
  lista.push(escenario);
  POR_CLAVE.set(escenario.clave, lista);
}

/** Los escenarios de un componente, en el orden en que se declararon. */
export function escenariosDe(clave: string): readonly EscenarioDeComponente[] {
  return POR_CLAVE.get(clave) ?? [];
}

/** Cuántos componentes del índice tienen al menos un escenario. */
export const CLAVES_CON_ESCENARIO: ReadonlySet<string> = new Set(POR_CLAVE.keys());
