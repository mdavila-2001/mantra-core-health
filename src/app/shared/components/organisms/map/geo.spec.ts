/**
 * Fija la geodesia del mapa: la distancia «en línea recta» que PAC-MED-005
 * permite prometer, y el orden por cercanía que las pantallas muestran.
 */
import { distanciaEnLineaRectaKm, ordenarPorCercania } from './geo';

const SANTA_CRUZ = { lat: -17.7833, lng: -63.1821 };
const COCHABAMBA = { lat: -17.3895, lng: -66.1568 };
const LA_PAZ = { lat: -16.4957, lng: -68.1335 };

describe('distanciaEnLineaRectaKm', () => {
  it('dos puntos iguales distan cero', () => {
    expect(distanciaEnLineaRectaKm(SANTA_CRUZ, SANTA_CRUZ)).toBe(0);
  });

  it('un grado de latitud sobre el ecuador son ~111,19 km', () => {
    expect(distanciaEnLineaRectaKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });

  it('es simétrica: ida y vuelta miden lo mismo', () => {
    expect(distanciaEnLineaRectaKm(SANTA_CRUZ, LA_PAZ)).toBe(
      distanciaEnLineaRectaKm(LA_PAZ, SANTA_CRUZ),
    );
  });

  it('Santa Cruz–Cochabamba ronda los 320 km en línea recta', () => {
    const distancia = distanciaEnLineaRectaKm(SANTA_CRUZ, COCHABAMBA);
    expect(distancia).toBeGreaterThan(300);
    expect(distancia).toBeLessThan(340);
  });
});

describe('ordenarPorCercania', () => {
  const casiAlLado = { id: 'cerca', lat: -17.79, lng: -63.19 };
  const cochabamba = { id: 'media', ...COCHABAMBA };
  const laPaz = { id: 'lejos', ...LA_PAZ };

  it('ordena del más cercano al más lejano respecto del origen', () => {
    const orden = ordenarPorCercania(SANTA_CRUZ, [laPaz, cochabamba, casiAlLado]);
    expect(orden.map((punto) => punto.id)).toEqual(['cerca', 'media', 'lejos']);
  });

  it('no muta la lista recibida', () => {
    const original = [laPaz, casiAlLado];
    ordenarPorCercania(SANTA_CRUZ, original);
    expect(original.map((punto) => punto.id)).toEqual(['lejos', 'cerca']);
  });

  it('entre equidistantes conserva el orden recibido', () => {
    const gemeloA = { id: 'primero', ...COCHABAMBA };
    const gemeloB = { id: 'segundo', ...COCHABAMBA };
    const orden = ordenarPorCercania(SANTA_CRUZ, [gemeloA, gemeloB]);
    expect(orden.map((punto) => punto.id)).toEqual(['primero', 'segundo']);
  });
});
