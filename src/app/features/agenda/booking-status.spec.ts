import { toBookingStatusPresentation } from './booking-status';
import type { ValueSetOption } from '../../core/data-access/terminology/terminology.types';

/**
 * El estado de una cita, en los tres canales que la identidad exige: tono,
 * forma y palabra. Lo que estas pruebas fijan:
 *
 * 1. **Se mapea por código, no por uuid.** El identificador se deriva de la
 *    identidad semántica; un re-seed lo cambia y `BOOKING_CONFIRMED` no.
 * 2. **Un estado desconocido no rompe la agenda.** Sale neutro con su palabra.
 */

function concepto(code: string, display = 'Etiqueta'): ValueSetOption {
  return { conceptId: 'c-1', code, display, codeSystemVersionId: 'csv-1' };
}

describe('toBookingStatusPresentation', () => {
  it('mapea los cuatro estados del catálogo a su sello', () => {
    expect(toBookingStatusPresentation(concepto('BOOKING_CONFIRMED'), '—').variant).toBe(
      'approved',
    );
    expect(toBookingStatusPresentation(concepto('BOOKING_CHECKED_IN'), '—').variant).toBe(
      'in-review',
    );
    expect(toBookingStatusPresentation(concepto('BOOKING_CANCELLED'), '—').variant).toBe(
      'rejected',
    );
    expect(toBookingStatusPresentation(concepto('BOOKING_RESCHEDULED'), '—').variant).toBe(
      'expired',
    );
  });

  /**
   * El catálogo no es consistente: los estados de cita llegan sin prefijo y los
   * de encuentro como `clinical:ENCOUNTER_…`. Comparar el sufijo funciona con
   * los dos y no obliga a saber cuál usa cada módulo.
   */
  it('reconoce el código venga con prefijo de módulo o sin él', () => {
    expect(
      toBookingStatusPresentation(concepto('scheduling:BOOKING_CANCELLED'), '—').variant,
    ).toBe('rejected');
  });

  it('la palabra sale del catálogo, no del código', () => {
    expect(
      toBookingStatusPresentation(concepto('BOOKING_CONFIRMED', 'Confirmada'), '—').label,
    ).toBe('Confirmada');
  });

  /** Un quinto estado futuro no puede tumbar la agenda del día. */
  it('un estado que esta versión no conoce sale neutro, con su palabra', () => {
    const sello = toBookingStatusPresentation(concepto('BOOKING_INVENTADO', 'Inventado'), '—');

    expect(sello.variant).toBe('unknown');
    expect(sello.label).toBe('Inventado');
  });

  /** Sin concepto resuelto —el catálogo falló— queda el texto de ausencia. */
  it('sin concepto usa el texto de reserva', () => {
    expect(toBookingStatusPresentation(undefined, 'Sin registrar')).toEqual({
      variant: 'unknown',
      label: 'Sin registrar',
    });
  });

  /** Un `display` vacío no puede dejar el sello mudo. */
  it('un display vacío cae al texto de reserva', () => {
    expect(toBookingStatusPresentation(concepto('BOOKING_CONFIRMED', ''), 'Sin registrar').label).toBe(
      'Sin registrar',
    );
  });
});
