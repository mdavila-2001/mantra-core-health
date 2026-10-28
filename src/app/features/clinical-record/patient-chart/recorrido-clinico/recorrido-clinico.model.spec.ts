import { describe, expect, it } from 'vitest';

import {
  claveDeCelda,
  conectadosA,
  describirIntervalo,
  MEDIDAS,
  ubicarRecorrido,
  type AristaDelRecorrido,
  type NodoDelRecorrido,
} from './recorrido-clinico.model';

const nodo = (
  id: string,
  tipo: NodoDelRecorrido['tipo'],
  cuando: Date | null,
  encuentroId?: string,
): NodoDelRecorrido => ({
  id,
  tipo,
  principal: id,
  secundario: '',
  estado: '',
  cuando,
  ...(encuentroId === undefined ? {} : { encuentroId }),
});

/**
 * Una historia mínima con las dos clases de vínculo:
 *
 *   enero:  consulta c1 → diagnóstico d1 → receta r1 (indicada para d1)
 *   abril:  consulta c2 → receta r2 (renovación, indicada para d1)
 *   junio:  una observación suelta, sin consulta
 */
const enero = new Date(2026, 0, 10);
const abril = new Date(2026, 3, 12);
const junio = new Date(2026, 5, 1);

const NODOS: readonly NodoDelRecorrido[] = [
  nodo('c1', 'encuentros', enero),
  // El inicio de la enfermedad es anterior a la consulta: igual va en enero.
  nodo('d1', 'diagnosticos', new Date(2025, 5, 1), 'c1'),
  nodo('r1', 'medicacion', enero, 'c1'),
  nodo('c2', 'encuentros', abril),
  nodo('r2', 'medicacion', abril, 'c2'),
  nodo('o1', 'observaciones', junio),
];

const ARISTAS: readonly AristaDelRecorrido[] = [
  { desde: 'c1', hasta: 'd1', motivo: 'atencion' },
  { desde: 'c1', hasta: 'r1', motivo: 'atencion' },
  { desde: 'c2', hasta: 'r2', motivo: 'atencion' },
  { desde: 'd1', hasta: 'r1', motivo: 'indicacion' },
  { desde: 'd1', hasta: 'r2', motivo: 'indicacion' },
];

describe('ubicarRecorrido', () => {
  const plano = ubicarRecorrido(NODOS, ARISTAS);
  const ubicado = (id: string) => plano.nodos.find((n) => n.id === id)!;

  it('arma una columna por atención o día suelto, en orden cronológico', () => {
    expect(plano.columnas.map((c) => c.clave)).toEqual(['enc:c1', 'enc:c2', expect.stringMatching(/^dia:2026-06-01$/)]);
    expect(plano.columnas[2].encuentroId).toBeNull();
  });

  it('pone lo decidido en una atención en la columna de esa atención, aunque su fecha sea otra', () => {
    expect(ubicado('d1').columna).toBe(ubicado('c1').columna);
  });

  it('ordena los carriles como se razona y omite los tipos sin registros', () => {
    expect(plano.carriles.map((c) => c.tipo)).toEqual([
      'encuentros',
      'observaciones',
      'diagnosticos',
      'medicacion',
    ]);
  });

  it('no superpone dos nodos', () => {
    for (const a of plano.nodos) {
      for (const b of plano.nodos) {
        if (a.id !== b.id && a.x === b.x) {
          expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(MEDIDAS.altoNodo);
        }
      }
    }
  });

  it('apila los nodos de un mismo tipo y columna y agranda el carril', () => {
    const doble = ubicarRecorrido(
      [nodo('c', 'encuentros', enero), nodo('a', 'medicacion', enero, 'c'), nodo('b', 'medicacion', enero, 'c')],
      [],
    );
    const [a, b] = doble.nodos.filter((n) => n.tipo === 'medicacion');
    expect(b.y - a.y).toBe(MEDIDAS.altoNodo + MEDIDAS.separacionNodos);
    const carril = doble.carriles.find((c) => c.tipo === 'medicacion')!;
    expect(carril.alto).toBeGreaterThanOrEqual(2 * MEDIDAS.altoNodo + MEDIDAS.separacionNodos);
  });

  it('escribe el intervalo entre columnas', () => {
    expect(plano.columnas.map((c) => c.intervalo)).toEqual(['', '3 meses', '7 semanas']);
  });

  it('traza sólo las conexiones cuyos dos extremos están dibujados', () => {
    expect(plano.aristas).toHaveLength(ARISTAS.length);
    const sinDiagnostico = ubicarRecorrido(
      NODOS.filter((n) => n.tipo !== 'diagnosticos'),
      ARISTAS,
    );
    expect(sinDiagnostico.aristas.some((a) => a.motivo === 'indicacion')).toBe(false);
  });

  it('arranca y termina cada trazo en el borde de sus nodos', () => {
    const indicacion = plano.aristas.find((a) => a.clave === 'indicacion:d1>r2')!;
    const [inicio] = indicacion.trazo.match(/^M [\d.]+ [\d.]+/) ?? [];
    expect(inicio).toBe(`M ${ubicado('d1').x + MEDIDAS.anchoColumna} ${ubicado('d1').y + MEDIDAS.altoNodo / 2}`);
    expect(indicacion.trazo.endsWith(`${ubicado('r2').x} ${ubicado('r2').y + MEDIDAS.altoNodo * 0.3}`)).toBe(true);
  });

  it('lleva lo que no tiene fecha al final', () => {
    const conSinFecha = ubicarRecorrido([nodo('x', 'documentos', null), ...NODOS], []);
    expect(conSinFecha.columnas.at(-1)?.clave).toBe('sin-fecha');
  });

  it('un plano vacío no se rompe', () => {
    const vacio = ubicarRecorrido([], []);
    expect(vacio.columnas).toEqual([]);
    expect(vacio.ancho).toBeGreaterThan(0);
  });
});

describe('ubicarRecorrido · celdas agrupadas', () => {
  // Una consulta de control con cinco signos vitales y un diagnóstico.
  const signos = ['ta', 'fc', 'peso', 'talla', 'sat'].map((id) => nodo(id, 'observaciones', enero, 'c'));
  const NODOS_LLENOS = [nodo('c', 'encuentros', enero), ...signos, nodo('dx', 'diagnosticos', enero, 'c')];
  const ARISTAS_LLENAS: AristaDelRecorrido[] = [
    ...signos.map((s) => ({ desde: 'c', hasta: s.id, motivo: 'atencion' as const })),
    { desde: 'c', hasta: 'dx', motivo: 'atencion' },
  ];
  const celda = claveDeCelda('enc:c', 'observaciones');

  it('muestra los primeros y un nodo de grupo con los ocultos', () => {
    const plano = ubicarRecorrido(NODOS_LLENOS, ARISTAS_LLENAS);
    const observaciones = plano.nodos.filter((n) => n.tipo === 'observaciones');
    expect(observaciones.map((n) => n.id)).toEqual(['ta', 'fc', `expandir:${celda}`]);
    expect(observaciones[2].grupo).toEqual({ accion: 'expandir', celda, ocultos: 3 });
    expect(observaciones[2].principal).toBe('+3 observaciones');
  });

  it('conecta la atención al grupo una sola vez en vez de a cada oculto', () => {
    const plano = ubicarRecorrido(NODOS_LLENOS, ARISTAS_LLENAS);
    expect(plano.aristas.filter((a) => a.hasta === `expandir:${celda}`)).toHaveLength(1);
    expect(plano.aristas.some((a) => a.hasta === 'peso')).toBe(false);
  });

  it('abierta, muestra todos y un nodo para volver a agrupar', () => {
    const plano = ubicarRecorrido(NODOS_LLENOS, ARISTAS_LLENAS, new Set([celda]));
    const observaciones = plano.nodos.filter((n) => n.tipo === 'observaciones');
    expect(observaciones).toHaveLength(6);
    expect(observaciones.at(-1)?.grupo?.accion).toBe('contraer');
    expect(plano.aristas.filter((a) => a.motivo === 'atencion')).toHaveLength(6);
  });
});

describe('conectadosA', () => {
  it('desde una receta ilumina su diagnóstico y su atención, no a sus hermanas', () => {
    const { nodos } = conectadosA('r1', ARISTAS);
    expect([...nodos].sort()).toEqual(['c1', 'd1', 'r1']);
  });

  it('desde un diagnóstico ilumina lo que derivó de él', () => {
    const { nodos, aristas } = conectadosA('d1', ARISTAS);
    expect([...nodos].sort()).toEqual(['c1', 'd1', 'r1', 'r2']);
    expect(aristas.has('indicacion:d1>r2')).toBe(true);
    expect(aristas.has('atencion:c2>r2')).toBe(false);
  });

  it('no se cuelga con un ciclo', () => {
    const ciclo: AristaDelRecorrido[] = [
      { desde: 'a', hasta: 'b', motivo: 'atencion' },
      { desde: 'b', hasta: 'a', motivo: 'indicacion' },
    ];
    expect(conectadosA('a', ciclo).nodos.size).toBe(2);
  });
});

describe('describirIntervalo', () => {
  const desde = new Date(2026, 0, 1);
  const mas = (dias: number) => new Date(desde.getTime() + dias * 86_400_000);

  it.each([
    [0, 'el mismo día'],
    [1, '1 día'],
    [9, '9 días'],
    [21, '3 semanas'],
    [95, '3 meses'],
    [365, '1 año'],
    [548, '1,5 años'],
  ])('%i días → %s', (dias, esperado) => {
    expect(describirIntervalo(desde, mas(dias))).toBe(esperado);
  });
});
