import { espacios } from './infrastructure.store';
import { PERSONAS } from './infrastructure-ops.personas';
import { drift, occupancies, openOrderOf, opsStates, orders, pushEvent, type OrderSim } from './infrastructure-ops.store';

/* ============================================================================
    El tiempo pasa en el tablero simulado (franja F2).

    Un tablero real cambia solo: alguien termina una limpieza, admisión ocupa
    una cama reservada. Para poder ver el **sondeo** cambiando el estado sin que
    nadie toque la pantalla, el simulador aplica un guion corto, una sola vez
    por sesión, a medida que pasan los segundos desde la primera visita:

    | A los | Qué pasa                                                         |
    |------:|------------------------------------------------------------------|
    | 45 s  | Limpieza termina la orden de 303-B (en limpieza → limpia)        |
    | 100 s | Admisión ocupa la reserva de 303-A (reservada → ocupada)         |

    Cada paso deja su evento A20 y sube `ops_version`. `mock:infra-ops-drift` =
    `off` lo apaga (las pruebas y el flujo de evidencia lo apagan para que el
    estado sea determinista).
    ========================================================================== */

const START_KEY = 'mock:infra-ops-t0';
const SWITCH_KEY = 'mock:infra-ops-drift';

const SCRIPT: readonly { readonly id: string; readonly afterSeconds: number }[] = [
  { id: 'finish-cleaning-303-B', afterSeconds: 45 },
  { id: 'admit-reservation-303-A', afterSeconds: 100 },
];

function read(key: string): string | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function startedAt(): number {
  const stored = Number(read(START_KEY));
  if (Number.isFinite(stored) && stored > 0) return stored;
  const now = Date.now();
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(START_KEY, String(now));
  } catch {
    // Sin almacenamiento el guion arranca de cero en cada carga: no rompe nada.
  }
  return now;
}

const byCode = (code: string) => espacios.todos().find((e) => e.code === code);

function bump(spaceId: string, patch: Record<string, unknown>): void {
  const st = opsStates.get(spaceId);
  if (st === undefined) return;
  opsStates.actualizar(spaceId, { ...patch, opsVersion: st.opsVersion + 1, lastEventAt: new Date().toISOString() });
}

function finishCleaning(): void {
  const e = byCode('303-B');
  const order = e === undefined ? undefined : openOrderOf(e.id);
  if (e === undefined || order === undefined || order.status !== 'CLN_IN_PROGRESS') return;
  const crew = PERSONAS['housekeeping']!;
  orders.actualizar(order.id, {
    status: 'CLN_DONE',
    finishedAt: new Date().toISOString(),
    finishedByUserId: crew.userId,
    rowVersion: order.rowVersion + 1,
  } as Partial<OrderSim>);
  bump(e.id, { hygiene: 'HYG_CLEAN', hygieneSince: new Date().toISOString() });
  pushEvent(e, 'AXIS_HYGIENE', 'HYG_CLEANING', 'HYG_CLEAN', { source: 'SRC_CLEANING', sourceRefId: order.id, by: crew.displayName });
}

function admitReservation(): void {
  const e = byCode('303-A');
  const occ = e === undefined ? undefined : occupancies.get(e.id);
  if (e === undefined || occ === undefined || occ.code !== 'OCC_RESERVED') return;
  occupancies.actualizar(e.id, { code: 'OCC_OCCUPIED', since: new Date().toISOString() });
  bump(e.id, {});
  pushEvent(e, 'AXIS_OCCUPANCY', 'OCC_RESERVED', 'OCC_OCCUPIED', { source: 'SRC_ADT', by: 'Internación' });
}

const ACTIONS: Readonly<Record<string, () => void>> = {
  'finish-cleaning-303-B': finishCleaning,
  'admit-reservation-303-A': admitReservation,
};

/** Aplica los pasos del guion que ya les toca y todavía no se aplicaron. */
export function applyDrift(now: number = Date.now()): void {
  if (read(SWITCH_KEY) === 'off') return;
  const elapsed = now - startedAt();
  for (const step of SCRIPT) {
    if (drift.has(step.id) || elapsed < step.afterSeconds * 1000) continue;
    ACTIONS[step.id]?.();
    drift.agregar({ id: step.id, appliedAt: new Date(now).toISOString() });
  }
}
