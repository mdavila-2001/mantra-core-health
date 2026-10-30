import { appointmentLinkOf } from './appointment-link';

/**
 * Lo que se fija: el enlace del aviso de agenda se vuelve botón y **cada lado
 * va a su pantalla** — el paciente a «Mis citas», el profesional a su agenda.
 */
const CONFIRMACION = [
  '✅ ¡Su cita quedó confirmada!',
  '🗓️ viernes, 30 de octubre de 2026, 9:35 a. m.\n👩‍⚕️ Bianka Figueredo Peño',
  '⏰ Le recomendamos llegar 10 minutos antes. ¡Lo esperamos! 💙',
  '👉 Ver la cita: https://app.alovida.bo/my-account/appointments?turno=4b1c-9e',
].join('\n\n');

describe('appointmentLinkOf', () => {
  it('el paciente que recibe la confirmación va a «Mis citas», y el enlace sale del texto', () => {
    const cita = appointmentLinkOf(CONFIRMACION, false);

    expect(cita).not.toBeNull();
    expect(cita!.ruta).toBe('/my-account/appointments');
    expect(cita!.parametros).toEqual({ turno: '4b1c-9e' });
    expect(cita!.texto).not.toContain('https://');
    expect(cita!.texto).not.toContain('Ver la cita');
    expect(cita!.texto.endsWith('¡Lo esperamos! 💙')).toBe(true);
  });

  it('el profesional que la mandó (mensaje propio) va a su agenda, a la solapa de citas', () => {
    const cita = appointmentLinkOf(CONFIRMACION, true);

    expect(cita!.ruta).toBe('/schedule');
    expect(cita!.parametros).toEqual({ vista: 'citas', turno: '4b1c-9e' });
  });

  it('un aviso dirigido al profesional (enlace a /schedule) lo lleva a su agenda', () => {
    const cita = appointmentLinkOf(
      '📩 Solicitud de cita recibida\n\n👉 Ver la cita: http://localhost:4200/schedule?vista=citas&turno=b-9',
      false,
    );
    expect(cita!.ruta).toBe('/schedule');
    expect(cita!.parametros['turno']).toBe('b-9');
  });

  it('un enlace cualquiera, o uno a la agenda sin turno, no se vuelve botón', () => {
    expect(appointmentLinkOf('Mirá https://alovida.bo/mi-historia', false)).toBeNull();
    expect(appointmentLinkOf('https://alovida.bo/schedule?vista=citas', false)).toBeNull();
    expect(appointmentLinkOf('', false)).toBeNull();
    expect(appointmentLinkOf(undefined, false)).toBeNull();
  });

  it('reconoce también la URL sola en su propia línea', () => {
    const cita = appointmentLinkOf('Su cita cambió.\nhttps://alovida.bo/my-account/appointments?turno=x1', false);
    expect(cita!.texto).toBe('Su cita cambió.');
  });
});
