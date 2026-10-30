import { describe, expect, it } from 'vitest';

import {
  claveDeCelda,
  type AristaUbicada,
  type RecorridoUbicado,
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
    expect(observaciones.map((n) => n.id)).toEqual(['ta', 'fc', `grupo:${celda}`]);
    expect(observaciones[2].grupo).toEqual({ accion: 'expandir', celda, ocultos: 3 });
    expect(observaciones[2].principal).toBe('+3 observaciones');
  });

  it('conecta la atención al grupo una sola vez en vez de a cada oculto', () => {
    const plano = ubicarRecorrido(NODOS_LLENOS, ARISTAS_LLENAS);
    expect(plano.aristas.filter((a) => a.hasta === `grupo:${celda}`)).toHaveLength(1);
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

describe('ubicarRecorrido · lo que el revisor encontró', () => {
  it('no rotula «sin atención» un día cuyos registros sí cuelgan de una atención oculta', () => {
    // La atención c9 no está dibujada (filtro o tope), pero el diagnóstico la declara.
    const plano = ubicarRecorrido([nodo('dx', 'diagnosticos', enero, 'c9')], []);
    expect(plano.columnas[0].contexto).toBe('dia');
  });

  it('distingue la atención a la vista y el día sin ninguna atención', () => {
    const plano = ubicarRecorrido(NODOS, ARISTAS);
    expect(plano.columnas.map((c) => c.contexto)).toEqual(['atencion', 'atencion', 'sin-atencion']);
  });

  it('el control de un grupo conserva su id al abrirse: el foco no se pierde', () => {
    const signos = ['a', 'b', 'c', 'd'].map((id) => nodo(id, 'observaciones', enero));
    const celda = ubicarRecorrido(signos, []).columnas[0].clave;
    const clave = claveDeCelda(celda, 'observaciones');
    const cerrado = ubicarRecorrido(signos, []).nodos.find((n) => n.grupo)!;
    const abierto = ubicarRecorrido(signos, [], new Set([clave])).nodos.find((n) => n.grupo)!;
    expect(abierto.id).toBe(cerrado.id);
    expect([cerrado.grupo?.accion, abierto.grupo?.accion]).toEqual(['expandir', 'contraer']);
  });

  it('una receta anterior a su diagnóstico se conecta hacia atrás, de borde a borde', () => {
    const plano = ubicarRecorrido(
      [nodo('rx', 'medicacion', enero), nodo('c', 'encuentros', abril), nodo('dx', 'diagnosticos', abril, 'c')],
      [{ desde: 'dx', hasta: 'rx', motivo: 'indicacion' }],
    );
    const dx = plano.nodos.find((n) => n.id === 'dx')!;
    const rx = plano.nodos.find((n) => n.id === 'rx')!;
    // Sale por la derecha del diagnóstico, baja por su pasillo, cruza hacia
    // atrás por encima de la fila de la receta y entra por su derecha.
    const puntos = plano.aristas[0].puntos!;
    expect(puntos[0]).toEqual([dx.x + MEDIDAS.anchoColumna, dx.y + MEDIDAS.altoNodo / 2]);
    expect(puntos.at(-1)).toEqual([rx.x + MEDIDAS.anchoColumna, rx.y + MEDIDAS.altoNodo * 0.3]);
    verificarTrazado(plano);
  });
});

/* -- Propiedades del trazado de las indicaciones ------------------------- */

interface Segmento {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
}

function segmentos(arista: AristaUbicada): Segmento[] {
  const p = arista.puntos ?? [];
  return p.slice(1).map((b, i) => ({ ax: p[i][0], ay: p[i][1], bx: b[0], by: b[1] }));
}

/**
 * Lo que tiene que cumplir cualquier plano, con cualquier cantidad de
 * indicaciones:
 *
 * 1. dos indicaciones de **distinto** diagnóstico no comparten ningún tramo
 *    paralelo a menos de 6 px —si lo hacen, no se sabe qué receta va con qué
 *    diagnóstico—. Las de un mismo diagnóstico sí pueden compartir la salida:
 *    se abren desde el mismo origen y no hay nada que confundir;
 * 2. ningún tramo pasa a menos de 4 px de una tarjeta que no sea uno de sus
 *    extremos.
 */
function verificarTrazado(plano: RecorridoUbicado): void {
  const indicaciones = plano.aristas.filter((a) => a.motivo === 'indicacion');
  // Pueden converger: las de un mismo diagnóstico (salen del mismo origen) y
  // las que llegan a un mismo nodo de grupo «+N», que reúne varias recetas.
  const pueden = (a: AristaUbicada, b: AristaUbicada): boolean =>
    a.desde === b.desde || (a.hasta === b.hasta && a.hasta.startsWith('grupo:'));
  for (const a of indicaciones) {
    // 3 · La punta de flecha: los ~14 px antes del final, sobre la última
    //     recta. Ninguna otra indicación puede pasar por ahí.
    const p = a.puntos ?? [];
    const [tx, ty] = p[p.length - 1];
    const [px] = p[p.length - 2];
    const punta = { x0: Math.min(tx, tx + Math.sign(px - tx) * 16), x1: Math.max(tx, tx + Math.sign(px - tx) * 16), y0: ty - 6, y1: ty + 6 };
    for (const b of indicaciones) {
      if (b === a || pueden(a, b)) {
        continue;
      }
      for (const sb of segmentos(b)) {
        const enX = Math.max(sb.ax, sb.bx) >= punta.x0 && Math.min(sb.ax, sb.bx) <= punta.x1;
        const enY = Math.max(sb.ay, sb.by) >= punta.y0 && Math.min(sb.ay, sb.by) <= punta.y1;
        expect(enX && enY, `${b.clave} pasa por la punta de ${a.clave}`).toBe(false);
      }
    }
    // 4 · Los troncos de las atenciones: a 8 px o más de cualquier vertical.
    for (const columna of plano.columnas) {
      const tronco = columna.x - 24;
      for (const sg of segmentos(a)) {
        if (sg.ax === sg.bx) {
          expect(Math.abs(sg.ax - tronco), `${a.clave} corre pegado al tronco de ${columna.clave}`).toBeGreaterThanOrEqual(8);
        }
      }
    }
    for (const b of indicaciones) {
      if (a.clave >= b.clave || pueden(a, b)) {
        continue;
      }
      for (const sa of segmentos(a)) {
        for (const sb of segmentos(b)) {
          const horizontales = sa.ay === sa.by && sb.ay === sb.by;
          const verticales = sa.ax === sa.bx && sb.ax === sb.bx;
          if (horizontales) {
            const solapan =
              Math.min(Math.max(sa.ax, sa.bx), Math.max(sb.ax, sb.bx)) -
                Math.max(Math.min(sa.ax, sa.bx), Math.min(sb.ax, sb.bx)) >
              0.5;
            if (solapan) {
              expect(Math.abs(sa.ay - sb.ay), `${a.clave} y ${b.clave} comparten un horizontal`).toBeGreaterThanOrEqual(6);
            }
          }
          if (verticales) {
            const solapan =
              Math.min(Math.max(sa.ay, sa.by), Math.max(sb.ay, sb.by)) -
                Math.max(Math.min(sa.ay, sa.by), Math.min(sb.ay, sb.by)) >
              0.5;
            if (solapan) {
              expect(Math.abs(sa.ax - sb.ax), `${a.clave} y ${b.clave} comparten un vertical`).toBeGreaterThanOrEqual(6);
            }
          }
        }
      }
    }
    for (const n of plano.nodos) {
      if (n.id === a.desde || n.id === a.hasta) {
        continue;
      }
      for (const sg of segmentos(a)) {
        const dentroX = Math.max(sg.ax, sg.bx) > n.x - 4 && Math.min(sg.ax, sg.bx) < n.x + MEDIDAS.anchoColumna + 4;
        const dentroY = Math.max(sg.ay, sg.by) > n.y - 4 && Math.min(sg.ay, sg.by) < n.y + MEDIDAS.altoNodo + 4;
        expect(dentroX && dentroY, `${a.clave} pasa por «${n.id}»`).toBe(false);
      }
    }
  }
}

describe('trazado de las indicaciones', () => {
  it('el caso que encontró la revisión visual: con «Atenciones» filtrado no pasa por detrás de otra receta', () => {
    const plano = ubicarRecorrido(
      [
        nodo('hta', 'diagnosticos', new Date(2025, 8, 23)),
        nodo('atorva', 'medicacion', new Date(2026, 9, 5)),
        nodo('otra', 'medicacion', new Date(2026, 9, 5)),
        nodo('enalapril', 'medicacion', new Date(2026, 9, 8)),
      ],
      [{ desde: 'hta', hasta: 'enalapril', motivo: 'indicacion' }],
    );
    verificarTrazado(plano);
    const arista = plano.aristas[0];
    const hta = plano.nodos.find((n) => n.id === 'hta')!;
    const enalapril = plano.nodos.find((n) => n.id === 'enalapril')!;
    expect(arista.puntos?.[0]).toEqual([hta.x + MEDIDAS.anchoColumna, hta.y + MEDIDAS.altoNodo / 2]);
    expect(arista.puntos?.at(-1)).toEqual([enalapril.x, enalapril.y + MEDIDAS.altoNodo * 0.3]);
  });

  it('el caso de cuatro indicaciones de la cuarta revisión: nadie comparte cruce', () => {
    // Cuatro diagnósticos en una columna, cada uno con su receta en la primera
    // fila de columnas distintas: con carriles por módulo, el 0 y el 3 caían
    // en el mismo cruce y compartían 648 px de recta.
    const dx = ['d1', 'd2', 'd3', 'd4'].map((id) => nodo(id, 'diagnosticos', new Date(2025, 0, 1)));
    const rx = ['r1', 'r2', 'r3', 'r4'].map((id, i) => nodo(id, 'medicacion', new Date(2026, i, 1)));
    const plano = ubicarRecorrido(
      [...dx, ...rx],
      dx.map((d, i) => ({ desde: d.id, hasta: rx[i].id, motivo: 'indicacion' as const })),
      // Abiertas: que no se agrupen los diagnósticos.
      new Set([claveDeCelda('dia:2025-01-01', 'diagnosticos')]),
    );
    expect(plano.aristas.filter((a) => a.motivo === 'indicacion')).toHaveLength(4);
    verificarTrazado(plano);
  });

  it('con muchas indicaciones, corchetes y una hacia atrás, sigue sin compartir tramos', () => {
    const c1 = nodo('c1', 'encuentros', new Date(2026, 0, 10));
    const c2 = nodo('c2', 'encuentros', new Date(2026, 3, 10));
    const nodos = [
      c1,
      c2,
      ...['a', 'b', 'c', 'd', 'e'].map((id) => nodo(id, 'diagnosticos', new Date(2026, 0, 10), 'c1')),
      nodo('ra', 'medicacion', new Date(2026, 0, 10), 'c1'),
      nodo('rb', 'medicacion', new Date(2026, 3, 10), 'c2'),
      nodo('rc', 'medicacion', new Date(2026, 5, 1)),
      nodo('rd', 'medicacion', new Date(2026, 5, 1)),
      nodo('re', 'medicacion', new Date(2025, 5, 1)),
      nodo('d2', 'diagnosticos', new Date(2026, 3, 10), 'c2'),
      nodo('rf', 'medicacion', new Date(2026, 3, 10), 'c2'),
      nodo('rg', 'medicacion', new Date(2026, 5, 1)),
    ];
    const plano = ubicarRecorrido(
      nodos,
      [
        { desde: 'a', hasta: 'ra', motivo: 'indicacion' },
        { desde: 'b', hasta: 'rb', motivo: 'indicacion' },
        { desde: 'c', hasta: 'rc', motivo: 'indicacion' },
        { desde: 'd', hasta: 'rd', motivo: 'indicacion' },
        { desde: 'e', hasta: 're', motivo: 'indicacion' },
        { desde: 'a', hasta: 'rf', motivo: 'indicacion' },
        // Cada receta tiene una sola indicación (`indicationConditionId`).
        { desde: 'd2', hasta: 'rg', motivo: 'indicacion' },
      ],
      new Set([claveDeCelda('enc:c1', 'diagnosticos'), claveDeCelda('dia:2026-06-01', 'medicacion')]),
    );
    expect(plano.aristas.filter((a) => a.motivo === 'indicacion').length).toBeGreaterThanOrEqual(6);
    verificarTrazado(plano);
  });

  it('corchetes y recetas hacia atrás: la punta no cae sobre la línea de otro diagnóstico', () => {
    // El caso de la quinta revisión: un diagnóstico con su receta el mismo día
    // (corchete, entra por la derecha) y otro cuya receta es de una consulta
    // posterior (baja por el mismo pasillo, más adentro).
    const c1 = nodo('c1', 'encuentros', new Date(2026, 0, 10));
    const c2 = nodo('c2', 'encuentros', new Date(2026, 3, 10));
    const plano = ubicarRecorrido(
      [
        c1,
        c2,
        nodo('hta', 'diagnosticos', new Date(2026, 0, 10), 'c1'),
        nodo('erge', 'diagnosticos', new Date(2026, 0, 10), 'c1'),
        nodo('losartan', 'medicacion', new Date(2026, 0, 10), 'c1'),
        nodo('otra', 'medicacion', new Date(2026, 0, 10), 'c1'),
        nodo('aas', 'medicacion', new Date(2026, 3, 10), 'c2'),
        nodo('previa', 'medicacion', new Date(2025, 11, 1)),
      ],
      [
        { desde: 'hta', hasta: 'losartan', motivo: 'indicacion' },
        { desde: 'erge', hasta: 'aas', motivo: 'indicacion' },
        { desde: 'erge', hasta: 'otra', motivo: 'indicacion' },
        { desde: 'hta', hasta: 'previa', motivo: 'indicacion' },
      ],
    );
    expect(plano.aristas.filter((a) => a.motivo === 'indicacion')).toHaveLength(4);
    verificarTrazado(plano);
  });

  it('hacia una celda agrupada convergen en su «+N» y en nada más', () => {
    const recetas = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => nodo(id, 'medicacion', new Date(2026, 3, 10)));
    const plano = ubicarRecorrido(
      [nodo('d1', 'diagnosticos', new Date(2025, 0, 1)), nodo('d2', 'diagnosticos', new Date(2025, 0, 1)), ...recetas],
      [
        { desde: 'd1', hasta: 'r4', motivo: 'indicacion' },
        { desde: 'd2', hasta: 'r5', motivo: 'indicacion' },
        { desde: 'd2', hasta: 'r1', motivo: 'indicacion' },
      ],
    );
    expect(plano.aristas.some((a) => a.hasta.startsWith('grupo:'))).toBe(true);
    verificarTrazado(plano);
  });

  it('el pasillo se ensancha cuando bajan más indicaciones de las que entran', () => {
    const dx = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'].map((id) => nodo(id, 'diagnosticos', new Date(2025, 0, 1)));
    const rx = dx.map((d, i) => nodo(`r${i}`, 'medicacion', new Date(2026, i, 1)));
    const plano = ubicarRecorrido(
      [...dx, ...rx],
      dx.map((d, i) => ({ desde: d.id, hasta: rx[i].id, motivo: 'indicacion' as const })),
      new Set([claveDeCelda('dia:2025-01-01', 'diagnosticos')]),
    );
    expect(plano.columnas[1].hueco).toBeGreaterThan(MEDIDAS.separacionColumnas);
    verificarTrazado(plano);
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

  it('cuenta días de calendario, no tramos de 24 horas', () => {
    expect(describirIntervalo(new Date(2026, 0, 1, 8), new Date(2026, 0, 1, 21))).toBe('el mismo día');
    expect(describirIntervalo(new Date(2026, 0, 1, 23), new Date(2026, 0, 2, 6))).toBe('1 día');
  });
});
