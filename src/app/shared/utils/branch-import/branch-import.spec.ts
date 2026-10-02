import { ArchivoInvalido } from '../csv-import/csv-import';

import {
  BRANCH_IMPORT_MAX_ROWS,
  branchCodeFromName,
  coordinatesFromMapUrl,
  isWebUrl,
  reviewBranchCsv,
  validDrafts,
} from './branch-import';

describe('reviewBranchCsv', () => {
  it('lee las tres columnas pedidas y saca el punto del enlace', () => {
    const review = reviewBranchCsv(
      'nombre,descripcion,url_ubicacion\n' +
        // Excel entrecomilla la celda porque el enlace lleva una coma.
        'Sucursal Norte,Planta baja,"https://www.google.com/maps?q=-17.7690,-63.1960"\n',
    );

    expect(review.ignoredColumns).toEqual([]);
    expect(validDrafts(review)).toEqual([
      {
        name: 'Sucursal Norte',
        description: 'Planta baja',
        locationUrl: 'https://www.google.com/maps?q=-17.7690,-63.1960',
        address: '',
        code: '',
        coordinates: { latitude: -17.769, longitude: -63.196 },
      },
    ]);
  });

  it('acepta el separador de Excel en castellano, encabezados con tildes y en inglés', () => {
    const review = reviewBranchCsv(
      'Name;Descripción;URL de ubicación;Dirección;Código\n' +
        'Sede Sur;"Toma de muestras; desde 6:30";https://maps.app.goo.gl/abc;Av. Santos Dumont 12;SUR\n',
    );

    const [row] = review.rows;
    expect(row?.ok).toBe(true);
    if (row?.ok) {
      expect(row.draft.description).toBe('Toma de muestras; desde 6:30');
      expect(row.draft.address).toBe('Av. Santos Dumont 12');
      expect(row.draft.code).toBe('SUR');
      // Un enlace acortado no trae el punto: se guarda y se avisa.
      expect(row.draft.coordinates).toBeNull();
      expect(row.notes.length).toBe(1);
    }
  });

  it('marca la fila sin nombre y deja pasar las buenas', () => {
    const review = reviewBranchCsv('nombre,descripcion\n,sin nombre\nCentral,ok\n');

    expect(review.rows[0]).toEqual({
      line: 2,
      ok: false,
      name: '',
      errors: ['Le falta el nombre.'],
    });
    expect(validDrafts(review).map((d) => d.name)).toEqual(['Central']);
  });

  it('rechaza un enlace que no es web (un javascript: nunca llega a ser un link)', () => {
    const review = reviewBranchCsv('nombre,url_ubicacion\nNorte,javascript:alert(1)\n');

    expect(review.rows[0]?.ok).toBe(false);
  });

  it('detecta repetidas contra lo ya cargado y dentro del archivo, sin mirar tildes ni mayúsculas', () => {
    const review = reviewBranchCsv('nombre\nSucursal Norte\nsucursal  norte\nCentral\n', ['CENTRAL']);

    expect(review.rows.map((row) => row.ok)).toEqual([true, false, false]);
  });

  it('avisa las columnas que no usa', () => {
    const review = reviewBranchCsv('nombre,telefono\nNorte,7000000\n');

    expect(review.ignoredColumns).toEqual(['telefono']);
  });

  it('rechaza el archivo sin columna nombre', () => {
    expect(() => reviewBranchCsv('descripcion\nalgo\n')).toThrow(ArchivoInvalido);
  });

  it('rechaza dos encabezados que apuntan al mismo dato', () => {
    expect(() => reviewBranchCsv('nombre,url,url_ubicacion\nA,https://a.bo,https://b.bo\n')).toThrow(
      /mismo dato/,
    );
  });

  it(`rechaza más de ${BRANCH_IMPORT_MAX_ROWS} filas`, () => {
    const rows = Array.from({ length: BRANCH_IMPORT_MAX_ROWS + 1 }, (_, i) => `S${i}`).join('\n');

    expect(() => reviewBranchCsv(`nombre\n${rows}\n`)).toThrow(ArchivoInvalido);
  });
});

describe('coordinatesFromMapUrl', () => {
  it.each([
    ['https://www.google.com/maps/place/X/@-17.78,-63.18,17z/data=!3m1!4b1!4m6!3m5!3d-17.7833!4d-63.1821', -17.7833, -63.1821],
    ['https://www.google.com/maps/@-17.78,-63.18,17z', -17.78, -63.18],
    ['https://maps.google.com/?q=-17.78%2C-63.18', -17.78, -63.18],
    ['https://www.google.com/maps/dir/?api=1&destination=-16.5,-68.15', -16.5, -68.15],
    ['https://www.openstreetmap.org/?mlat=-17.82&mlon=-63.12#map=17/-17.82/-63.12', -17.82, -63.12],
    ['https://www.openstreetmap.org/#map=16/-19.04/-65.26', -19.04, -65.26],
    ['geo:-17.78,-63.18', -17.78, -63.18],
  ])('%s', (url, latitude, longitude) => {
    expect(coordinatesFromMapUrl(url)).toEqual({ latitude, longitude });
  });

  it('devuelve null si el enlace no trae el punto o está fuera de rango', () => {
    expect(coordinatesFromMapUrl('https://maps.app.goo.gl/xyz')).toBeNull();
    expect(coordinatesFromMapUrl('https://www.google.com/maps?q=Farmacia+Chávez')).toBeNull();
    expect(coordinatesFromMapUrl('https://www.google.com/maps?q=95,10')).toBeNull();
  });
});

describe('isWebUrl', () => {
  it('sólo http y https', () => {
    expect(isWebUrl('https://maps.google.com')).toBe(true);
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl('maps.google.com')).toBe(false);
  });
});

describe('branchCodeFromName', () => {
  it('arma el código del nombre y lo desambigua', () => {
    expect(branchCodeFromName('Sucursal Equipetrol', new Set())).toBe('SUCURSAL-EQUIPETROL');
    expect(branchCodeFromName('Peña Ñandú', new Set())).toBe('PENA-NANDU');
    expect(branchCodeFromName('Norte', new Set(['norte', 'NORTE-2']))).toBe('NORTE-3');
    expect(branchCodeFromName('***', new Set())).toBe('SUCURSAL');
  });
});
