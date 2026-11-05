import { toCsv } from '../../../shared/utils/csv-export/csv-export';
import type { SupportActivityEntry } from '../../../core/data-access/support-access/support-access.types';
import { ACTIVITY_CSV_COLUMNS, activityFileName } from './activity-csv';

const ENTRADA: SupportActivityEntry = {
  id: '1',
  userId: 'u-1',
  personName: 'Ana Gutiérrez',
  action: 'schedule.create',
  auditAction: 'DIRECT_APPOINTMENT_CREATED',
  permission: 'schedule.create',
  entity: 'appointment',
  createdAt: new Date(2026, 9, 29, 8, 42).toISOString(),
  summary: 'Creó una cita, con "comillas"',
  practitionerName: 'Dr. Andrés Pérez',
  success: true,
  result: 'SUCCESS',
};

describe('el CSV de la actividad', () => {
  it('trae las columnas de la tabla, la acción en palabras, el resultado y el código', () => {
    const [encabezado, fila] = toCsv([ENTRADA], ACTIVITY_CSV_COLUMNS).split('\r\n');
    expect(encabezado).toBe('Fecha y hora,Persona,Acción,Detalle,Doctor,Resultado,Código');
    expect(fila).toBe('2026-10-29 08:42,Ana Gutiérrez,Crear citas,"Creó una cita, con ""comillas""",Dr. Andrés Pérez,Hecho,schedule.create');
  });

  it('no trae ninguna columna de paciente: la bitácora de la API no lo tiene', () => {
    expect(toCsv([ENTRADA], ACTIVITY_CSV_COLUMNS).split('\r\n')[0]).not.toMatch(/paciente/i);
  });

  it('un asiento fallido lo dice, y sin doctor deja la celda vacía', () => {
    const fila = toCsv([{ ...ENTRADA, practitionerName: undefined, success: false, result: 'FAILURE' } as SupportActivityEntry], ACTIVITY_CSV_COLUMNS).split('\r\n')[1]!;
    expect(fila).toContain(',,No se pudo,');
  });

  it('un detalle que empieza como fórmula se neutraliza', () => {
    const fila = toCsv([{ ...ENTRADA, summary: '=HYPERLINK("x")' }], ACTIVITY_CSV_COLUMNS).split('\r\n')[1]!;
    expect(fila).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('el archivo se llama según la pantalla y el día', () => {
    const hoy = new Date(2026, 9, 30, 12);
    expect(activityFileName('org', hoy)).toBe('actividad-equipo-apoyo-2026-10-30');
    expect(activityFileName('doctor', hoy)).toBe('actividad-de-mi-equipo-2026-10-30');
    expect(activityFileName('person', hoy)).toBe('mi-actividad-2026-10-30');
  });
});
