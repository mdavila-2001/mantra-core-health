import { firstValueFrom, of } from 'rxjs';

import type {
  PublicPage,
  PublicSearchQuery,
  PublicSearchResult,
} from '@core/data-access/public-directory/public-directory.types';

import {
  categoriasPublicadas,
  ciudadesPublicadas,
  cuentaPorDepartamento,
  deLaCategoria,
  deLaCiudad,
  delDepartamento,
  leerDirectorioEntero,
  MAX_PAGINAS_PUBLICAS,
} from './public-directory-cuts';

/** Una fila mínima del directorio público; el resto de los campos no se lee acá. */
function fila(
  slug: string,
  city: string | null,
  category: { code: string; label: string } | null = null,
): PublicSearchResult {
  return { slug, city, category } as unknown as PublicSearchResult;
}

/** Una página del contrato público; la pista del total no se lee acá. */
function pagina(
  items: readonly PublicSearchResult[],
  nextCursor: string | null,
): PublicPage<PublicSearchResult> {
  return { items, nextCursor, totalHint: null } as unknown as PublicPage<PublicSearchResult>;
}

const LP = 'dep-lp';
const SC = 'dep-sc';
const POR_CIUDAD: ReadonlyMap<string, string> = new Map([
  ['la paz', LP],
  ['el alto', LP],
  ['santa cruz de la sierra', SC],
]);

const CLINICA = { code: 'PRIVATE_CLINIC', label: 'Clínica privada' };
const CAJA = { code: 'SOCIAL_SECURITY', label: 'Caja de salud' };

const FILAS = [
  fila('a', 'La Paz', CLINICA),
  fila('b', 'El Alto', CAJA),
  fila('c', 'Santa Cruz de la Sierra', CLINICA),
  fila('d', 'La Paz', CLINICA),
  fila('e', null, null),
];

describe('public-directory-cuts (carril 18)', () => {
  it('el departamento acota por la ciudad de cada fila, y una fila sin ciudad no entra', () => {
    expect(delDepartamento(FILAS, LP, POR_CIUDAD).map((f) => f.slug)).toEqual(['a', 'b', 'd']);
    expect(delDepartamento(FILAS, null, POR_CIUDAD)).toBe(FILAS);
  });

  it('la ciudad no distingue mayúsculas ni tildes — las dos superficies acotan igual', () => {
    expect(deLaCiudad(FILAS, 'la paz').map((f) => f.slug)).toEqual(['a', 'd']);
    expect(deLaCiudad(FILAS, 'LA PAZ').map((f) => f.slug)).toEqual(['a', 'd']);
  });

  it('la categoría acota por el código, nunca por la etiqueta', () => {
    expect(deLaCategoria(FILAS, CAJA.code).map((f) => f.slug)).toEqual(['b']);
    expect(deLaCategoria(FILAS, 'Caja de salud')).toEqual([]);
  });

  it('cuenta por departamento sólo las filas que caen en uno', () => {
    expect(cuentaPorDepartamento(FILAS, POR_CIUDAD)).toEqual(
      new Map([
        [LP, 3],
        [SC, 1],
      ]),
    );
  });

  it('ciudades y categorías salen de los resultados, la que más tiene primero', () => {
    expect(ciudadesPublicadas(FILAS)).toEqual(['La Paz', 'El Alto', 'Santa Cruz de la Sierra']);
    expect(categoriasPublicadas(FILAS)).toEqual([CLINICA, CAJA]);
  });

  it('recorre el cursor hasta agotarlo y pide con el tope del contrato', async () => {
    const pedidos: PublicSearchQuery[] = [];
    const paginas: Record<string, PublicPage<PublicSearchResult>> = {
      inicio: pagina([FILAS[0]], 'c2'),
      c2: pagina([FILAS[1]], null),
    };
    const resultado = await firstValueFrom(
      leerDirectorioEntero((consulta) => {
        pedidos.push(consulta);
        return of(paginas[consulta.cursor ?? 'inicio']);
      }, { q: 'x' }),
    );

    expect(resultado).toEqual({ filas: [FILAS[0], FILAS[1]], recortado: false });
    expect(pedidos).toEqual([
      { q: 'x', limit: 50 },
      { q: 'x', limit: 50, cursor: 'c2' },
    ]);
  });

  it('al llegar al techo de páginas para y lo dice', async () => {
    let pedidas = 0;
    const resultado = await firstValueFrom(
      leerDirectorioEntero(() => {
        pedidas += 1;
        return of(pagina([FILAS[0]], 'otra'));
      }, {}),
    );

    expect(pedidas).toBe(MAX_PAGINAS_PUBLICAS);
    expect(resultado.recortado).toBe(true);
  });
});
