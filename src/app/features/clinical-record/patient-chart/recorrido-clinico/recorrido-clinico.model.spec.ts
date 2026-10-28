import { describe, expect, it } from 'vitest';

import {
  claveDeCelda,
  conectadosA,
  describirIntervalo,
  MEDIDAS,
  puntosDeIndicacion,
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
    const trazo = plano.aristas[0].trazo;
    expect(trazo.startsWith(`M ${dx.x} `)).toBe(true);
    expect(trazo.endsWith(`${rx.x + MEDIDAS.anchoColumna} ${rx.y + MEDIDAS.altoNodo * 0.3}`)).toBe(true);
  });
});

describe('trazado de las indicaciones entre columnas', () => {
  /**
   * El caso que encontró la revisión visual: con «Atenciones» filtrado, el
   * diagnóstico queda en su propia fecha, lejos, y entre él y su receta hay
   * otra receta. Una curva directa pasaba por detrás de ella y parecía que la
   * flecha salía de ahí.
   */
  const plano = ubicarRecorrido(
    [
      nodo('hta', 'diagnosticos', new Date(2025, 8, 23)),
      nodo('atorva', 'medicacion', new Date(2026, 9, 5)),
      nodo('otra', 'medicacion', new Date(2026, 9, 5)),
      nodo('enalapril', 'medicacion', new Date(2026, 9, 8)),
    ],
    [{ desde: 'hta', hasta: 'enalapril', motivo: 'indicacion' }],
  );
  const por = (id: string) => plano.nodos.find((n) => n.id === id)!;

  it('no atraviesa ninguna tarjeta que no sea uno de sus extremos', () => {
    const puntos = puntosDeIndicacion(por('hta'), por('enalapril'));
    const otras = plano.nodos.filter((n) => n.id !== 'hta' && n.id !== 'enalapril');
    for (let i = 0; i < puntos.length - 1; i++) {
      const [[ax, ay], [bx, by]] = [puntos[i], puntos[i + 1]];
      for (const n of otras) {
        const dentroX = Math.max(ax, bx) > n.x && Math.min(ax, bx) < n.x + MEDIDAS.anchoColumna;
        const dentroY = Math.max(ay, by) > n.y && Math.min(ay, by) < n.y + MEDIDAS.altoNodo;
        expect(dentroX && dentroY, `el tramo ${i} cruza «${n.id}»`).toBe(false);
      }
    }
  });

  it('con dos indicaciones, cada una va por su propio carril', () => {
    // Dos diagnósticos lejanos, cada uno con su receta en la misma fila de
    // columnas posteriores: antes compartían el cruce y la bajada y no se
    // sabía cuál iba a cuál.
    const dos = ubicarRecorrido(
      [
        nodo('hta', 'diagnosticos', new Date(2025, 8, 23)),
        nodo('dlp', 'diagnosticos', new Date(2025, 8, 23)),
        nodo('atorva', 'medicacion', new Date(2026, 9, 5)),
        nodo('enalapril', 'medicacion', new Date(2026, 9, 8)),
      ],
      [
        { desde: 'hta', hasta: 'enalapril', motivo: 'indicacion' },
        { desde: 'dlp', hasta: 'atorva', motivo: 'indicacion' },
      ],
    );
    const n = (id: string) => dos.nodos.find((x) => x.id === id)!;
    const a = puntosDeIndicacion(n('hta'), n('enalapril'), 0);
    const b = puntosDeIndicacion(n('dlp'), n('atorva'), 1);
    // Bajadas por x distintas y cruces a alturas distintas.
    expect(a[1][0]).not.toBe(b[1][0]);
    expect(a[2][1]).not.toBe(b[2][1]);
    // Y los trazos que dibuja el plano son distintos entre sí.
    const trazos = dos.aristas.map((x) => x.trazo);
    expect(new Set(trazos).size).toBe(2);
  });

  it('el cruce deja al menos 6 px de aire con cualquier tarjeta', () => {
    const puntos = puntosDeIndicacion(por('hta'), por('enalapril'), 2);
    const horizontal = puntos[2][1];
    for (const n of plano.nodos) {
      const arriba = n.y + MEDIDAS.altoNodo;
      const distancia = horizontal < n.y ? n.y - horizontal : horizontal - arriba;
      if (horizontal >= n.y && horizontal <= arriba) {
        throw new Error(`el cruce atraviesa «${n.id}»`);
      }
      expect(distancia).toBeGreaterThanOrEqual(6);
    }
  });

  it('sale del borde del diagnóstico y entra por el borde de la receta', () => {
    const puntos = puntosDeIndicacion(por('hta'), por('enalapril'));
    expect(puntos[0]).toEqual([por('hta').x + MEDIDAS.anchoColumna, por('hta').y + MEDIDAS.altoNodo / 2]);
    expect(puntos.at(-1)).toEqual([por('enalapril').x, por('enalapril').y + MEDIDAS.altoNodo * 0.3]);
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
