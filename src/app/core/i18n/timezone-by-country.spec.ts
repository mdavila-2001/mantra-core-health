import { describe, expect, it } from 'vitest';

import {
  esPaisMultizona,
  obtenerZonaHorariaDefectoDePais,
  obtenerZonasHorariasDePais,
  ZONAS_HORARIAS_MUNDIALES_POR_PAIS,
} from './timezone-by-country';

describe('timezone-by-country', () => {
  it('Bolivia es zona única y su defecto es America/La_Paz', () => {
    expect(esPaisMultizona('BO')).toBe(false);
    expect(obtenerZonaHorariaDefectoDePais('BO')).toBe('America/La_Paz');
    expect(obtenerZonasHorariasDePais('BO')).toHaveLength(1);
  });

  it('Estados Unidos es multizona, ofrece 7 opciones y el defecto es la del Este', () => {
    expect(esPaisMultizona('US')).toBe(true);
    expect(obtenerZonasHorariasDePais('US')).toHaveLength(7);
    expect(obtenerZonaHorariaDefectoDePais('US')).toBe('America/New_York');
  });

  it('Brasil ofrece 4 opciones con São Paulo como defecto', () => {
    expect(esPaisMultizona('BR')).toBe(true);
    expect(obtenerZonasHorariasDePais('BR')).toHaveLength(4);
    expect(obtenerZonaHorariaDefectoDePais('BR')).toBe('America/Sao_Paulo');
  });

  it('Rusia ofrece sus zonas con Moscú como defecto', () => {
    expect(esPaisMultizona('RU')).toBe(true);
    expect(obtenerZonaHorariaDefectoDePais('RU')).toBe('Europe/Moscow');
  });

  it('México ofrece 5 opciones con Ciudad de México como defecto', () => {
    expect(esPaisMultizona('MX')).toBe(true);
    expect(obtenerZonasHorariasDePais('MX')).toHaveLength(5);
    expect(obtenerZonaHorariaDefectoDePais('MX')).toBe('America/Mexico_City');
  });

  it('un país fuera del catálogo cae en zona única America/La_Paz', () => {
    expect(esPaisMultizona('ZZ')).toBe(false);
    expect(obtenerZonaHorariaDefectoDePais('ZZ')).toBe('America/La_Paz');
  });

  it('normaliza espacios y minúsculas del código de país', () => {
    expect(obtenerZonaHorariaDefectoDePais(' us ')).toBe('America/New_York');
    expect(esPaisMultizona(' bo ')).toBe(false);
  });

  it('cada país del catálogo tiene exactamente una zona marcada por defecto', () => {
    for (const [pais, zonas] of Object.entries(ZONAS_HORARIAS_MUNDIALES_POR_PAIS)) {
      const marcadas = zonas.filter((zona) => zona.isDefault === true);
      expect(marcadas, `${pais} debe tener exactamente una zona por defecto`).toHaveLength(1);
    }
  });

  it('cada IANA del catálogo es un identificador de zona horaria válido', () => {
    for (const [pais, zonas] of Object.entries(ZONAS_HORARIAS_MUNDIALES_POR_PAIS)) {
      for (const zona of zonas) {
        expect(
          () => new Intl.DateTimeFormat('es', { timeZone: zona.iana }),
          `${pais}: ${zona.iana} no es una zona horaria IANA válida`,
        ).not.toThrow();
      }
    }
  });

  it('un país multizona nunca tiene menos de dos opciones', () => {
    for (const [pais, zonas] of Object.entries(ZONAS_HORARIAS_MUNDIALES_POR_PAIS)) {
      if (zonas.length > 1) {
        expect(esPaisMultizona(pais)).toBe(true);
      } else {
        expect(esPaisMultizona(pais)).toBe(false);
      }
    }
  });
});
