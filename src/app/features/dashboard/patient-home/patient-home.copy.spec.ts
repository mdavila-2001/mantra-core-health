import { firstNameOf, greetingFor, PATIENT_TIPS } from './patient-home.copy';

describe('Textos del inicio del paciente', () => {
  it('saluda según la hora', () => {
    expect(greetingFor(new Date(2026, 9, 22, 8))).toBe('Buenos días');
    expect(greetingFor(new Date(2026, 9, 22, 12))).toBe('Buenas tardes');
    expect(greetingFor(new Date(2026, 9, 22, 19))).toBe('Buenas noches');
    expect(greetingFor(new Date(2026, 9, 22, 3))).toBe('Buenas noches');
  });

  it('se queda con los nombres y deja los dos apellidos', () => {
    expect(firstNameOf('Ana Lucía Pérez Quiroga')).toBe('Ana Lucía');
    expect(firstNameOf('Jorge Salazar Vaca')).toBe('Jorge');
    expect(firstNameOf('Ana Quispe')).toBe('Ana');
    expect(firstNameOf('Ana')).toBe('Ana');
    expect(firstNameOf('   ')).toBe('');
  });

  it('cada consejo es breve y habla de la aplicación', () => {
    expect(PATIENT_TIPS.length).toBeGreaterThanOrEqual(5);
    for (const tip of PATIENT_TIPS) {
      expect(tip.text.length).toBeLessThanOrEqual(120);
    }
  });
});
