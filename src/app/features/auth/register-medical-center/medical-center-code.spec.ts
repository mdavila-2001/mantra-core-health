import { medicalCenterCodeFromName } from './medical-center-code';

const API_CODE_PATTERN = /^[A-Za-z0-9._-]+$/;

describe('medicalCenterCodeFromName', () => {
  it('quita diacríticos y separa con guiones', () => {
    expect(medicalCenterCodeFromName('Clínica Santa María S.R.L.')).toBe('CM-CLINICA-SANTA-MARIA-S-R-L');
  });

  it('un nombre sin caracteres válidos cae en CM-CENTRO', () => {
    expect(medicalCenterCodeFromName('¡¡¡')).toBe('CM-CENTRO');
  });

  it('nunca pasa de 100 caracteres ni termina en guion', () => {
    const codigo = medicalCenterCodeFromName('a'.repeat(60) + ' ' + 'b'.repeat(60));
    expect(codigo.length).toBeLessThanOrEqual(100);
    expect(codigo.endsWith('-')).toBe(false);
  });

  it.each(['Centro Médico Norte', 'Ñandú & Hijos', '123', 'a'])('cumple el patrón de la API: %s', (nombre) => {
    const codigo = medicalCenterCodeFromName(nombre);
    expect(API_CODE_PATTERN.test(codigo)).toBe(true);
    expect(codigo.length).toBeGreaterThanOrEqual(3);
  });
});
