import { registerLocaleData } from '@angular/common';
import localeEsBo from '@angular/common/locales/es-BO';

import type { BookingConReconsulta } from '../../../core/data-access/scheduling/follow-up.types';
import {
  detalleDeLaCita,
  pacienteDeLaCita,
  SIN_NOMBRE_DE_PACIENTE,
} from './detalle-de-la-cita';

/**
 * Los pares del globo de una cita, con el foco puesto en «Qué es» (C4).
 *
 * El día y la semana comparten esta función a propósito: si una armara su
 * propia lista, la misma cita se leería distinto según dónde se la mirara.
 * Estas pruebas fijan lo que dice y lo que **calla**.
 */

// El idioma del producto. Se registra acá porque `app.config.ts` lo hace al
// arrancar la aplicación y estas pruebas no la levantan: sin esto,
// `formatDate` muere con «Missing locale data for es-BO».
registerLocaleData(localeEsBo);

const IDIOMA = 'es-BO';

function cita(extra: Partial<BookingConReconsulta> = {}): BookingConReconsulta {
  return {
    id: 'b-1',
    statusConceptId: 'c-confirmada',
    startAt: new Date('2026-09-25T13:00:00.000Z'),
    endAt: new Date('2026-09-25T13:30:00.000Z'),
    patientName: 'Ana Pérez',
    reasonText: 'Control anual',
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    ...extra,
  };
}

function valorDe(pares: readonly { label: string; value: string }[], label: string): string | undefined {
  return pares.find((p) => p.label === label)?.value;
}

describe('detalleDeLaCita', () => {
  it('una cita común dice «Cita» en «Qué es» y no habla de ninguna consulta previa', () => {
    const pares = detalleDeLaCita(cita(), 'Confirmada', IDIOMA);

    expect(valorDe(pares, 'Qué es')).toBe('Cita');
    expect(pares.map((p) => p.label)).not.toContain('De la cita del');
  });

  it('una reconsulta lo dice en «Qué es», que es lo primero que hay que saber', () => {
    const pares = detalleDeLaCita(
      cita({
        followUpOf: {
          bookingId: 'b-origen',
          encounterId: null,
          startAt: new Date('2026-09-12T13:00:00.000Z'),
        },
      }),
      'Confirmada',
      IDIOMA,
    );

    expect(valorDe(pares, 'Qué es')).toBe('Reconsulta');
    expect(valorDe(pares, 'De la cita del')).toContain('12');
  });

  /**
   * El contrato admite una cita sin cupo: la de origen puede no tener horario.
   * Un par con un guión no dice nada que valga la línea.
   */
  it('sin la fecha del origen sigue diciendo «Reconsulta», pero omite el par', () => {
    const pares = detalleDeLaCita(
      cita({ followUpOf: { bookingId: 'b-origen', encounterId: null } }),
      'Confirmada',
      IDIOMA,
    );

    expect(valorDe(pares, 'Qué es')).toBe('Reconsulta');
    expect(pares.map((p) => p.label)).not.toContain('De la cita del');
  });

  it('el orden no cambia: el origen va después del paciente y antes del motivo', () => {
    const pares = detalleDeLaCita(
      cita({
        followUpOf: {
          bookingId: 'b-origen',
          encounterId: null,
          startAt: new Date('2026-09-12T13:00:00.000Z'),
        },
      }),
      'Confirmada',
      IDIOMA,
    );

    expect(pares.map((p) => p.label)).toEqual([
      'Cuándo',
      'Qué es',
      'Estado',
      'Paciente',
      'De la cita del',
      'Motivo',
    ]);
  });

  it('sin nombre de paciente no inventa un relleno: dice que no está', () => {
    expect(pacienteDeLaCita(cita({ patientName: undefined }))).toBe(SIN_NOMBRE_DE_PACIENTE);
  });
});
