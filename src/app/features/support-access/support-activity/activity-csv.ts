import {
  activityActionLabel,
  localDay,
  type ActivityAudience,
} from '../../../core/data-access/support-access/support-activity';
import type { SupportActivityEntry } from '../../../core/data-access/support-access/support-access.types';
import type { CsvColumn } from '../../../shared/utils/csv-export/csv-export';

/** Fecha y hora completas para el CSV: ISO local legible, sin segundos. */
function csvDate(value: string): string {
  const d = new Date(value);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Las columnas del CSV: las de la tabla más el permiso con el que se actuó y el
 * resultado. Nada de pacientes: la bitácora de la API no trae ni su nombre ni una
 * etiqueta, solo identificadores, nombres de quien actuó y verbos.
 */
export const ACTIVITY_CSV_COLUMNS: readonly CsvColumn<SupportActivityEntry>[] = [
  { header: 'Fecha y hora', value: (e) => csvDate(e.createdAt) },
  { header: 'Persona', value: (e) => e.personName },
  { header: 'Acción', value: (e) => activityActionLabel(e.action) },
  { header: 'Detalle', value: (e) => e.summary },
  { header: 'Doctor', value: (e) => e.practitionerName ?? '' },
  { header: 'Resultado', value: (e) => (e.success ? 'Hecho' : 'No se pudo') },
  { header: 'Código', value: (e) => e.action },
];

/** Nombre del archivo: `actividad-equipo-apoyo-2026-10-30`. */
export function activityFileName(audience: ActivityAudience, today: Date = new Date()): string {
  const base = audience === 'person' ? 'mi-actividad' : audience === 'doctor' ? 'actividad-de-mi-equipo' : 'actividad-equipo-apoyo';
  return `${base}-${localDay(today.toISOString())}`;
}

