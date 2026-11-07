import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import type { PatientOrderRow } from './diagnostic-orders.types';

/** Pending or active: the only states in which an order can still be sent to a center. */
const isOpen = (row: PatientOrderRow): boolean => row.stateCode.includes('PENDING') || row.stateCode.includes('ACTIVE');

/** The row actions of one order (C9 §4); each one only appears when its condition holds. */
export function rowActionsOf(fila: PatientOrderRow): readonly RowAction[] {
  const actions: RowAction[] = [];
  // What waits for the patient's decision comes first: a pending referral from the doctor.
  if (fila.referral?.status === 'PENDING') {
    actions.push({ code: 'aceptar-derivacion', label: 'Aceptar la derivación', icon: 'check' });
    actions.push({ code: 'rechazar-derivacion', label: 'Rechazar la derivación', icon: 'close' });
  }
  if (fila.hasResult) actions.push({ code: 'ver-resultado', label: 'Ver resultado', icon: 'eye' });
  if (fila.preparation !== null) actions.push({ code: 'ver-preparacion', label: 'Ver preparación', icon: 'clipboard' });
  if (fila.insuranceSettlement) actions.push({ code: 'ver-liquidacion', label: 'Ver liquidación', icon: 'billing' });
  // Quote and book belong to the laboratory/imaging circuit: a procedure does not enter it.
  if (fila.type === 'PROCEDURE') return actions;
  // Kept from the 2026-09-13 UX refactor: removing it would lose a delivered capability.
  actions.push({ code: 'cotizar', label: 'Comparar precio y distancia', icon: 'billing' });
  if (fila.bookable) actions.push({ code: 'reservar', label: 'Reservar hora en un laboratorio', icon: 'calendar' });
  if (fila.appointment !== null) actions.push({ code: 'ver-turno', label: 'Ver cita', icon: 'calendar' });
  // Way 1 of three to create an order: the QR the patient sends to the center.
  if ((fila.type === 'LAB' || fila.type === 'IMAGING') && isOpen(fila)) {
    actions.push({ code: 'mostrar-qr', label: 'Mostrar QR para el laboratorio', icon: 'orders' });
  }
  return actions;
}
