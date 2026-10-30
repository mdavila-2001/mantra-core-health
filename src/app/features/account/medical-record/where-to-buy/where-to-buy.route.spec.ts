import { coverageRoute, directionsUrl, type RouteCandidate } from './where-to-buy.route';

type Site = RouteCandidate & { readonly id: string };

const site = (id: string, covers: readonly string[], distanceKm: number | null = null): Site => ({
  id,
  covers: new Set(covers),
  distanceKm,
});

const ids = (stops: readonly Site[]) => stops.map((stop) => stop.id);

describe('coverageRoute', () => {
  it('propone la sede sola cuando una tiene todo, aunque otras queden más cerca', () => {
    const route = coverageRoute(
      [site('A', ['x'], 0.5), site('B', ['x', 'y'], 4), site('C', ['y'], 0.3)],
      ['x', 'y'],
    );
    expect(route.kind).toBe('single');
    expect(route.kind === 'single' && ids(route.stops)).toEqual(['B']);
  });

  it('busca el grupo exacto de menos paradas, no el voraz', () => {
    // La voraz toma Z (cubre cuatro) y después necesita X e Y: tres paradas.
    // X + Y cubren las seis solas.
    const route = coverageRoute(
      [site('Z', ['1', '2', '4', '5']), site('X', ['1', '2', '3']), site('Y', ['4', '5', '6'])],
      ['1', '2', '3', '4', '5', '6'],
    );
    expect(route.kind).toBe('multi');
    expect(route.kind === 'multi' && ids(route.stops)).toEqual(['X', 'Y']);
  });

  it('entre grupos del mismo tamaño elige la menor distancia total', () => {
    const route = coverageRoute(
      [site('A', ['x'], 9), site('B', ['y'], 1), site('C', ['x'], 2), site('D', ['y'], 8)],
      ['x', 'y'],
    );
    expect(route.kind === 'multi' && ids(route.stops)).toEqual(['B', 'C']);
  });

  it('ordena las paradas de la más cercana a la más lejana', () => {
    const route = coverageRoute([site('A', ['x'], 5), site('B', ['y'], 2)], ['x', 'y']);
    expect(route.kind === 'multi' && ids(route.stops)).toEqual(['B', 'A']);
  });

  it('sin distancias se queda con el primer grupo en el orden del backend', () => {
    const route = coverageRoute(
      [site('A', ['x']), site('B', ['y']), site('C', ['x']), site('D', ['y'])],
      ['x', 'y'],
    );
    expect(route.kind === 'multi' && ids(route.stops)).toEqual(['A', 'B']);
  });

  it('una sede sin distancia va al final del recorrido', () => {
    const route = coverageRoute([site('A', ['x']), site('B', ['y'], 3)], ['x', 'y']);
    expect(route.kind === 'multi' && ids(route.stops)).toEqual(['B', 'A']);
  });

  it('dice qué no tiene ninguna sede y cubre el resto', () => {
    const route = coverageRoute([site('A', ['x'], 1), site('B', ['y'], 2)], ['x', 'y', 'z']);
    expect(route.kind).toBe('partial');
    if (route.kind === 'partial') {
      expect(ids(route.stops)).toEqual(['A', 'B']);
      expect(route.uncovered).toEqual(['z']);
    }
  });

  it('sin ninguna sede que confirme algo, no propone recorrido', () => {
    expect(coverageRoute([site('A', [])], ['x'])).toEqual({ kind: 'none', uncovered: ['x'] });
    expect(coverageRoute([], ['x'])).toEqual({ kind: 'none', uncovered: ['x'] });
  });

  it('no modifica la lista recibida', () => {
    const candidates = [site('A', ['x'], 5), site('B', ['y'], 1)];
    const copy = [...candidates];
    coverageRoute(candidates, ['x', 'y']);
    expect(candidates).toEqual(copy);
  });
});

describe('directionsUrl', () => {
  it('arma la ruta en OpenStreetMap con el destino y sin origen', () => {
    expect(directionsUrl(-17.7833, -63.1821)).toBe(
      'https://www.openstreetmap.org/directions?route=%3B-17.7833%2C-63.1821',
    );
  });

  it('sin coordenadas utilizables no hay enlace', () => {
    expect(directionsUrl(null, -63.1)).toBeNull();
    expect(directionsUrl(-17.7, null)).toBeNull();
    expect(directionsUrl(0, 0)).toBeNull();
    expect(directionsUrl(Number.NaN, -63.1)).toBeNull();
  });
});
