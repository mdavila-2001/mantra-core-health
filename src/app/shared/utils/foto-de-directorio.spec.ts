import {
  fotoDeDirectorio,
  fotoDeEspecialidad,
  fotoDeVertical,
  temaDeCentroDiagnostico,
} from './foto-de-directorio';

describe('fotoDeDirectorio', () => {
  it('es estable: la misma clave da siempre la misma foto', () => {
    expect(fotoDeDirectorio('farmacia', 'PHARMACY:farmacorp-america')).toBe(
      fotoDeDirectorio('farmacia', 'PHARMACY:farmacorp-america'),
    );
  });

  it('siempre cae dentro de las fotos que existen del tema', () => {
    for (let i = 0; i < 500; i++) {
      expect(fotoDeDirectorio('farmacia', `k${i}`)).toMatch(
        /^\/alovida\/directorio\/farmacia-(0[1-9]|1[0-9])\.jpg$/,
      );
    }
  });

  it('reparte: 200 claves distintas usan más de una foto', () => {
    const usadas = new Set(
      Array.from({ length: 200 }, (_, i) => fotoDeDirectorio('medico', `m${i}`)),
    );
    expect(usadas.size).toBeGreaterThan(8);
  });
});

describe('temas', () => {
  it('distingue imagenología de laboratorio por lo que dice el texto', () => {
    expect(temaDeCentroDiagnostico('DU_TYPE_IMAGING')).toBe('imagen');
    expect(temaDeCentroDiagnostico('Laboratorio · Hematología')).toBe('laboratorio');
  });

  it('la especialidad de imágenes usa fotos de imagen y el resto de médico', () => {
    expect(fotoDeEspecialidad('Radiología e Imagenología')).toContain('/imagen-');
    expect(fotoDeEspecialidad('Cardiología')).toContain('/medico-');
  });

  it('cada puerta de Directorios tiene su tema', () => {
    expect(fotoDeVertical('/pharmacies-directory')).toContain('/farmacia-');
    expect(fotoDeVertical('/clinics-directory')).toContain('/clinica-');
    expect(fotoDeVertical('/laboratory-directory')).toContain('/laboratorio-');
    expect(fotoDeVertical('/directory')).toContain('/medico-');
  });
});
