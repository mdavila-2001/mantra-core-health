import { firstValueFrom, of } from 'rxjs';

import type {
  PublicPage,
  PublicSearchQuery,
  PublicSearchResult,
} from '@core/data-access/public-directory/public-directory.types';

import {
  publishedCategories,
  publishedCities,
  countByDepartment,
  byCategory,
  byCity,
  byDepartment,
  readWholeDirectory,
  PUBLIC_MAX_PAGES,
} from './public-directory-cuts';

/** Una fila mínima del directorio público; el resto de los campos no se lee acá. */
function row(
  slug: string,
  city: string | null,
  category: { code: string; label: string } | null = null,
): PublicSearchResult {
  return { slug, city, category } as unknown as PublicSearchResult;
}

/** Una página del contrato público; la pista del total no se lee acá. */
function page(
  items: readonly PublicSearchResult[],
  nextCursor: string | null,
): PublicPage<PublicSearchResult> {
  return { items, nextCursor, totalHint: null } as unknown as PublicPage<PublicSearchResult>;
}

const LP = 'dep-lp';
const SC = 'dep-sc';
const CITY_TO_DEPARTMENT: ReadonlyMap<string, string> = new Map([
  ['la paz', LP],
  ['el alto', LP],
  ['santa cruz de la sierra', SC],
]);

const PRIVATE_CLINIC = { code: 'PRIVATE_CLINIC', label: 'Clínica privada' };
const SOCIAL_SECURITY = { code: 'SOCIAL_SECURITY', label: 'Caja de salud' };

const ROWS = [
  row('a', 'La Paz', PRIVATE_CLINIC),
  row('b', 'El Alto', SOCIAL_SECURITY),
  row('c', 'Santa Cruz de la Sierra', PRIVATE_CLINIC),
  row('d', 'La Paz', PRIVATE_CLINIC),
  row('e', null, null),
];

describe('public-directory-cuts (carril 18)', () => {
  it('el departamento acota por la ciudad de cada fila, y una fila sin ciudad no entra', () => {
    expect(byDepartment(ROWS, LP, CITY_TO_DEPARTMENT).map((f) => f.slug)).toEqual(['a', 'b', 'd']);
    expect(byDepartment(ROWS, null, CITY_TO_DEPARTMENT)).toBe(ROWS);
  });

  it('la ciudad no distingue mayúsculas ni tildes — las dos superficies acotan igual', () => {
    expect(byCity(ROWS, 'la paz').map((f) => f.slug)).toEqual(['a', 'd']);
    expect(byCity(ROWS, 'LA PAZ').map((f) => f.slug)).toEqual(['a', 'd']);
  });

  it('la categoría acota por el código, nunca por la etiqueta', () => {
    expect(byCategory(ROWS, SOCIAL_SECURITY.code).map((f) => f.slug)).toEqual(['b']);
    expect(byCategory(ROWS, 'Caja de salud')).toEqual([]);
  });

  it('cuenta por departamento sólo las filas que caen en uno', () => {
    expect(countByDepartment(ROWS, CITY_TO_DEPARTMENT)).toEqual(
      new Map([
        [LP, 3],
        [SC, 1],
      ]),
    );
  });

  it('ciudades y categorías salen de los resultados, la que más tiene primero', () => {
    expect(publishedCities(ROWS)).toEqual(['La Paz', 'El Alto', 'Santa Cruz de la Sierra']);
    expect(publishedCategories(ROWS)).toEqual([PRIVATE_CLINIC, SOCIAL_SECURITY]);
  });

  it('recorre el cursor hasta agotarlo y pide con el tope del contrato', async () => {
    const requests: PublicSearchQuery[] = [];
    const pages: Record<string, PublicPage<PublicSearchResult>> = {
      inicio: page([ROWS[0]], 'c2'),
      c2: page([ROWS[1]], null),
    };
    const result = await firstValueFrom(
      readWholeDirectory((consulta) => {
        requests.push(consulta);
        return of(pages[consulta.cursor ?? 'inicio']);
      }, { q: 'x' }),
    );

    expect(result).toEqual({ rows: [ROWS[0], ROWS[1]], truncated: false });
    expect(requests).toEqual([
      { q: 'x', limit: 50 },
      { q: 'x', limit: 50, cursor: 'c2' },
    ]);
  });

  it('al llegar al techo de páginas para y lo dice', async () => {
    let requested = 0;
    const result = await firstValueFrom(
      readWholeDirectory(() => {
        requested += 1;
        return of(page([ROWS[0]], 'otra'));
      }, {}),
    );

    expect(requested).toBe(PUBLIC_MAX_PAGES);
    expect(result.truncated).toBe(true);
  });
});
