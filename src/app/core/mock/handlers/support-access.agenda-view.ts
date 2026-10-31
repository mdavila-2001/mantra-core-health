import type { SupportAgenda } from '../../data-access/support-access/support-access.types';
import { fromWireSupportAgenda, type WireSupportAgenda, type WireSupportFreeSlots } from '../../data-access/support-access/support-agenda.wire';
import { BOOKING_STATUS } from '../fixtures/concepts';
import { DOCTORES_POR_TENANT } from '../fixtures/support-hospital';

/**
 * Para las pruebas del simulador: la agenda **como la ve la pantalla**, o sea la respuesta de la API (`/me/support-agenda`, solo
 * citas) más los horarios libres del simulador, pasadas por el mismo adaptador que usa el cliente.
 */
const CODIGO_DE_ESTADO: ReadonlyMap<string, string> = new Map(Object.entries(BOOKING_STATUS).map(([codigo, id]) => [id, codigo]));

export function agendaVista(wire: WireSupportAgenda, libres?: WireSupportFreeSlots): SupportAgenda {
  return fromWireSupportAgenda(wire, (id) => CODIGO_DE_ESTADO.get(id), libres);
}

/** La clave con que la pantalla conoce a un doctor de la agenda: su perfil profesional (no la asignación de rol). */
export function perfilDelDoctor(doctorId: string): string {
  return (
    Object.values(DOCTORES_POR_TENANT)
      .flat()
      .find((d) => d.id === doctorId)?.practitionerProfileId ?? doctorId
  );
}
