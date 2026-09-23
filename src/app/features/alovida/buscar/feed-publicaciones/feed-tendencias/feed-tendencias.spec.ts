import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';

import { enTendencia } from './feed-tendencias';

function doctor(displayName: string, ratingCount: number, ratingAverage: number | null): PublicSearchResult {
  return { displayName, ratingCount, ratingAverage, slug: displayName } as PublicSearchResult;
}

describe('enTendencia', () => {
  it('ordena por cantidad de reseñas', () => {
    const lista = enTendencia([doctor('A', 3, 5), doctor('B', 10, 4), doctor('C', 7, 4.5)]);
    expect(lista.map((d) => d.displayName)).toEqual(['B', 'C', 'A']);
  });

  it('a igual cantidad gana la mejor calificación, y sin calificación va última', () => {
    const lista = enTendencia([doctor('A', 5, null), doctor('B', 5, 3.2), doctor('C', 5, 4.8)]);
    expect(lista.map((d) => d.displayName)).toEqual(['C', 'B', 'A']);
  });

  it('a igualdad total desempata el nombre, para que la lista no baile', () => {
    const lista = enTendencia([doctor('Zoe', 1, 4), doctor('Ana', 1, 4)]);
    expect(lista.map((d) => d.displayName)).toEqual(['Ana', 'Zoe']);
  });

  it('se queda con los primeros N y no toca la lista original', () => {
    const original = [doctor('A', 1, 1), doctor('B', 2, 1), doctor('C', 3, 1)];
    expect(enTendencia(original, 2).map((d) => d.displayName)).toEqual(['C', 'B']);
    expect(original.map((d) => d.displayName)).toEqual(['A', 'B', 'C']);
  });
});
