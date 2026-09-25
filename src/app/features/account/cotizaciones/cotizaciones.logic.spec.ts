import {
  filtrarResultados,
  ordenarResultados,
  type CotizacionResultado,
} from './cotizaciones.logic';

const RESULTADOS: readonly CotizacionResultado[] = [
  {
    id: 'med-1',
    vertical: 'MEDICAMENTOS',
    que: 'Paracetamol',
    donde: 'Farmacia Central',
    price: { amount: 12, currency: 'BOB', source: 'Disponibilidad publicada por la farmacia' },
    distanceKm: 2,
  },
  {
    id: 'img-1',
    vertical: 'IMAGENOLOGIA',
    que: 'Tomografía',
    donde: 'Centro Imagen',
    price: null,
    distanceKm: 1,
  },
  {
    id: 'serv-1',
    vertical: 'SERVICIOS_MEDICOS',
    que: 'Consulta médica',
    donde: 'Clínica Norte',
    price: { amount: 5, currency: 'UMA', source: 'Colegio Médico de Santa Cruz 2025' },
    distanceKm: 5,
  },
];

describe('cotizaciones logic', () => {
  it('busca ignorando mayúsculas y acentos', () => {
    expect(filtrarResultados(RESULTADOS, 'tomografia', 'TODAS').map((item) => item.id)).toEqual([
      'img-1',
    ]);
  });

  it('ordena los precios conocidos antes que los no publicados', () => {
    expect(ordenarResultados(RESULTADOS, 'PRECIO').map((item) => item.id)).toEqual([
      'med-1',
      'serv-1',
      'img-1',
    ]);
  });

  it('no inventa un orden de distancia si todavía no hay origen', () => {
    expect(ordenarResultados(RESULTADOS, 'CERCANIA', false).map((item) => item.id)).toEqual([
      'med-1',
      'img-1',
      'serv-1',
    ]);
  });

  it('a igual distancia desempata por precio, y el orden no depende de la fuente', () => {
    const base = { vertical: 'MEDICAMENTOS' as const, donde: 'Sede', distanceKm: 0.4 };
    const filas: CotizacionResultado[] = [
      { ...base, id: 'c', que: 'C', price: { amount: 163, currency: 'BOB', source: 'x' } },
      { ...base, id: 'a', que: 'A', price: { amount: 153, currency: 'BOB', source: 'x' } },
      { ...base, id: 'b', que: 'B', price: { amount: 157, currency: 'BOB', source: 'x' } },
    ];

    const orden = ordenarResultados(filas, 'CERCANIA').map((fila) => fila.id);
    expect(orden).toEqual(['a', 'b', 'c']);
    expect(ordenarResultados([...filas].reverse(), 'CERCANIA').map((fila) => fila.id)).toEqual(
      orden,
    );
  });
});
