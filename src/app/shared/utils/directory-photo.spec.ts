import {
  directoryPhoto,
  specialtyPhoto,
  verticalPhoto,
  diagnosisCenterTheme,
} from './directory-photo';

describe('fotoDeDirectorio', () => {
  it('es estable: la misma clave da siempre la misma foto', () => {
    expect(directoryPhoto('farmacia', 'PHARMACY:farmacorp-america')).toBe(
      directoryPhoto('farmacia', 'PHARMACY:farmacorp-america'),
    );
  });

  it('siempre cae dentro de las fotos que existen del tema', () => {
    for (let i = 0; i < 500; i++) {
      expect(directoryPhoto('farmacia', `k${i}`)).toMatch(
        /^\/alovida\/directorio\/farmacia-(0[1-9]|1[0-9])\.jpg$/,
      );
    }
  });

  it('reparte: 200 claves distintas usan más de una foto', () => {
    const usadas = new Set(
      Array.from({ length: 200 }, (_, i) => directoryPhoto('medico', `m${i}`)),
    );
    expect(usadas.size).toBeGreaterThan(8);
  });
});

describe('temas', () => {
  it('distingue imagenología de laboratorio por lo que dice el texto', () => {
    expect(diagnosisCenterTheme('DU_TYPE_IMAGING')).toBe('imagen');
    expect(diagnosisCenterTheme('Laboratorio · Hematología')).toBe('laboratorio');
  });

  it('la especialidad de imágenes usa fotos de imagen y el resto de médico', () => {
    expect(specialtyPhoto('Radiología e Imagenología')).toContain('/imagen-');
    expect(specialtyPhoto('Cardiología')).toContain('/medico-');
  });

  it('cada puerta de Directorios tiene su tema', () => {
    expect(verticalPhoto('/pharmacies-directory')).toContain('/farmacia-');
    expect(verticalPhoto('/clinics-directory')).toContain('/clinica-');
    expect(verticalPhoto('/laboratory-directory')).toContain('/laboratorio-');
    expect(verticalPhoto('/directory')).toContain('/medico-');
  });
});
