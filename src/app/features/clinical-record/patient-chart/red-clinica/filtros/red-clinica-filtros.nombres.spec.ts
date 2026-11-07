import { describe, expect, it } from 'vitest';

import { FILTRO_VACIO } from '../red-clinica-filtro';
import { NODOS_DEMO } from '../red-clinica.demo';
import { filtrosNombrados, unirConY } from './red-clinica-filtros.nombres';

describe('filtrosNombrados', () => {
  it('sin criterios no nombra nada', () => {
    expect(filtrosNombrados(FILTRO_VACIO, NODOS_DEMO)).toEqual([]);
  });

  it('nombra el hilo por su diagnóstico, no por su id', () => {
    expect(filtrosNombrados({ ...FILTRO_VACIO, hiloDeDiagnosticoId: 'dx2' }, NODOS_DEMO)).toEqual([
      'el hilo de Hipertensión arterial esencial',
    ]);
  });

  it('nombra cada criterio puesto, con lo elegido', () => {
    const profesional = NODOS_DEMO[0].profesional!;
    const especialidad = NODOS_DEMO[0].especialidad!;
    const nombres = filtrosNombrados(
      {
        ...FILTRO_VACIO,
        texto: '  pielo ',
        especialidadId: especialidad.id,
        profesionalId: profesional.id,
        desde: new Date(2026, 9, 1),
        tipos: ['estudio', 'diagnostico'],
      },
      NODOS_DEMO,
    );
    expect(nombres).toHaveLength(5);
    expect(nombres[0]).toBe('la búsqueda «pielo»');
    expect(nombres[1]).toBe(`la especialidad ${especialidad.nombre}`);
    expect(nombres[2]).toBe(`el profesional ${profesional.nombre}`);
    expect(nombres[3]).toMatch(/^las fechas desde el 1 .*2026$/);
    expect(nombres[4]).toBe('los tipos Estudios y Diagnósticos');
  });

  it('un rango con las dos puntas dice ambas', () => {
    const [rango] = filtrosNombrados({ ...FILTRO_VACIO, desde: new Date(2026, 9, 1), hasta: new Date(2026, 9, 15) }, NODOS_DEMO);
    expect(rango).toMatch(/^las fechas del 1 .* al 15 .*2026$/);
  });
});

describe('unirConY', () => {
  it('une como se lee', () => {
    expect(unirConY([])).toBe('');
    expect(unirConY(['a'])).toBe('a');
    expect(unirConY(['a', 'b'])).toBe('a y b');
    expect(unirConY(['a', 'b', 'c'])).toBe('a, b y c');
  });
});
