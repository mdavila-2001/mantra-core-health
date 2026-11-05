import { bookingToast } from './booking-toast';

describe('bookingToast — lo que se le dice a quien reserva', () => {
  it('el mostrador confirma a nombre del paciente', () => {
    expect(bookingToast(false, { id: 'b-1' }, 'Ana Salas')).toEqual({
      message: 'La cita de Ana Salas quedó confirmada.',
      title: 'Reserva confirmada',
    });
  });

  it('el paciente que solicita y queda pendiente: falta la respuesta del profesional', () => {
    expect(bookingToast(true, { id: 'b-1' }, 'Ana').title).toBe('Cita solicitada');
  });

  it('el paciente cuya solicitud nació confirmada (v4.2.88) no lee «el profesional la confirma»', () => {
    const toast = bookingToast(true, { id: 'b-1', confirmedAt: '2026-11-05T12:00:00.000Z' }, 'Ana');
    expect(toast.title).toBe('Reserva confirmada');
    expect(toast.message).toContain('quedó confirmada');
    expect(toast.message).not.toContain('El profesional la confirma');
  });
});
