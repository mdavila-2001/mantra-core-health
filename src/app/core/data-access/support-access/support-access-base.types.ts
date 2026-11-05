/**
 * Los tipos de base del personal de apoyo que también usa la agenda combinada
 * (`support-agenda.types.ts`). Viven en un archivo hoja para que la agenda no
 * importe de `support-access.types.ts`, que a su vez la reexporta: eso era un
 * ciclo que `check-architecture` rechaza. `support-access.types.ts` reexporta
 * todo lo de acá, así que sus consumidores no cambian de import.
 */

/** Las 15 acciones otorgables (13 de agenda y cobro, más 2 de paciente y mensajes). */
export const SUPPORT_ACTION_CODES = [
  'schedule.view',
  'schedule.create',
  'schedule.reschedule',
  'schedule.cancel',
  'schedule.confirm',
  'schedule.check_in',
  'schedule.walk_in',
  'schedule.waitlist',
  'schedule.send_reminders',
  'schedule.block_time',
  'schedule.edit_hours',
  'billing.collect',
  'billing.issue_receipt',
  'patient.register',
  'messages.reply_on_behalf',
] as const;
export type SupportActionCode = (typeof SUPPORT_ACTION_CODES)[number];

export type LocationKind = 'SITE' | 'BUILDING' | 'LEVEL' | 'WING' | 'CONSULTING_ROOM' | 'OPERATING_ROOM' | 'PROCEDURE_ROOM' | 'BED';

/** Un nodo de la jerarquía de ubicaciones. `path` es la ruta materializada (`/sede/edificio/piso/`). */
export interface LocationNode {
  /** `practice_site_id` si es una sede, `care_space_id` en cualquier otro caso. */
  readonly id: string;
  readonly kind: LocationKind;
  readonly name: string;
  readonly parentId: string | null;
  readonly path: string;
}

export interface CatalogService {
  readonly id: string;
  readonly name: string;
}
