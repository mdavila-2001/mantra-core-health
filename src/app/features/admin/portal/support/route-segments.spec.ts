import { routeSegments, splitAfter } from './route-segments';

describe('splitAfter', () => {
  it('corta tras cada separador configurable', () => {
    expect(splitAfter('catalog-coverage/v1', '/-')).toEqual(['catalog-', 'coverage/', 'v1']);
  });

  it('trata los separadores como caracteres literales', () => {
    expect(splitAfter('a.b_c', '._')).toEqual(['a.', 'b_', 'c']);
  });

  it('reconstruye el texto original al unir los tramos', () => {
    const text = 'accounting.account_determination_rules';
    expect(splitAfter(text, '._').join('')).toBe(text);
  });
});

describe('routeSegments', () => {
  it('termina cada tramo en la barra para cortar sólo ahí', () => {
    expect(routeSegments('/accounting/accounts')).toEqual(['/accounting/', 'accounts']);
  });

  it('conserva los parámetros de ruta enteros', () => {
    expect(routeSegments('/audio-assets/{assetId}/content')).toEqual([
      '/audio-assets/',
      '{assetId}/',
      'content',
    ]);
  });

  it('devuelve los tramos que, unidos, reconstruyen la ruta', () => {
    const route = '/scheduling/slots/';
    expect(routeSegments(route).join('')).toBe(route);
  });

  it('no inventa tramos con una ruta vacía', () => {
    expect(routeSegments('')).toEqual([]);
  });
});
