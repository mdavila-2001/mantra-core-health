import { describe, expect, it } from 'vitest';

import {
  agruparEnEpisodios,
  inferirVinculos,
  type RegistroDeLaRed,
  type VinculoDeLaRed,
} from './red-clinica.model';
import {
  claveDeGrupo,
  DISTANCIA_DEL_TRONCO,
  MEDIDAS_DE_LA_RED,
  ubicarRed,
  type AristaDeLaRed,
  type EstadoDeLaRed,
  type PlanoDeLaRed,
} from './red-clinica.geometria';

// Noon, so the clinical day (La Paz, `dia-clinico.ts`) is the same whatever the machine's zone.
const d = (anio: number, mes: number, dia = 10): Date => new Date(anio, mes - 1, dia, 12);
const r = (
  id: string,
  clase: RegistroDeLaRed['clase'],
  cuando: Date | null,
  extra: Partial<RegistroDeLaRed> = {},
): RegistroDeLaRed => ({ id, clase, titulo: id, detalle: '', estado: '', cuando, ...extra });

function plano(
  registros: readonly RegistroDeLaRed[],
  reales: readonly VinculoDeLaRed[],
  estado: Partial<EstadoDeLaRed> & { todo?: boolean } = {},
): PlanoDeLaRed {
  const vinculos = [...reales, ...inferirVinculos(registros, reales)];
  const red = agruparEnEpisodios(registros, vinculos);
  return ubicarRed(registros, vinculos, red, {
    desplegados: estado.todo ? new Set(red.episodios.map((e) => e.id)) : (estado.desplegados ?? new Set()),
    abiertos: estado.abiertos ?? new Set(),
    visibles: estado.visibles ?? null,
  });
}

/* -- Una historia con todas las clases de línea -------------------------- */

const REGISTROS: readonly RegistroDeLaRed[] = [
  r('e1', 'atencion', d(2025, 5)),
  r('dx-p', 'diagnostico', d(2025, 5), { encuentroId: 'e1', certeza: 'presuntivo', concepto: 'HTA' }),
  r('o1', 'observacion', d(2025, 5), { encuentroId: 'e1' }),
  r('o2', 'observacion', d(2025, 5), { encuentroId: 'e1' }),
  r('o3', 'observacion', d(2025, 5), { encuentroId: 'e1' }),
  r('est', 'estudio', d(2025, 5), { encuentroId: 'e1' }),
  r('e2', 'atencion', d(2025, 6)),
  r('dx-c', 'diagnostico', d(2025, 6), { encuentroId: 'e2', certeza: 'confirmado', concepto: 'HTA' }),
  r('dx-x', 'diagnostico', d(2025, 6), { encuentroId: 'e2', certeza: 'descartado', concepto: 'ANG' }),
  r('rx1', 'medicacion', d(2025, 6), { encuentroId: 'e2' }),
  r('res', 'resultado', d(2025, 6, 20)),
  r('e3', 'atencion', d(2025, 9)),
  r('dx-e', 'diagnostico', d(2025, 9), { encuentroId: 'e3', certeza: 'confirmado', concepto: 'ERGE' }),
  r('rx2', 'medicacion', d(2025, 9), { encuentroId: 'e3' }),
  r('rx3', 'medicacion', d(2025, 9), { encuentroId: 'e3' }),
  r('e4', 'atencion', d(2026, 2)),
  r('o4', 'observacion', d(2026, 2), { encuentroId: 'e4' }),
];
const REALES: readonly VinculoDeLaRed[] = [
  { desde: 'e1', hasta: 'dx-p', motivo: 'registrado-en' },
  { desde: 'e1', hasta: 'o1', motivo: 'registrado-en' },
  { desde: 'e1', hasta: 'o2', motivo: 'registrado-en' },
  { desde: 'e1', hasta: 'o3', motivo: 'registrado-en' },
  { desde: 'e1', hasta: 'est', motivo: 'registrado-en' },
  { desde: 'e2', hasta: 'dx-c', motivo: 'registrado-en' },
  { desde: 'e2', hasta: 'dx-x', motivo: 'registrado-en' },
  { desde: 'e2', hasta: 'rx1', motivo: 'registrado-en' },
  { desde: 'dx-c', hasta: 'rx1', motivo: 'indicado-para' },
  { desde: 'est', hasta: 'res', motivo: 'resultado-de' },
  { desde: 'dx-x', hasta: 'dx-e', motivo: 'reemplazado-por' },
  { desde: 'e3', hasta: 'dx-e', motivo: 'registrado-en' },
  { desde: 'e3', hasta: 'rx2', motivo: 'registrado-en' },
  { desde: 'e3', hasta: 'rx3', motivo: 'registrado-en' },
  { desde: 'dx-e', hasta: 'rx2', motivo: 'indicado-para' },
  { desde: 'dx-c', hasta: 'rx3', motivo: 'indicado-para' },
  { desde: 'rx1', hasta: 'rx3', motivo: 'receta-reemplazada' },
  { desde: 'e4', hasta: 'o4', motivo: 'registrado-en' },
];

describe('ubicarRed · plegado (nivel 1)', () => {
  const p = plano(REGISTROS, REALES);

  it('no dibuja nodos ni líneas: sólo las franjas con sus hitos', () => {
    expect(p.nodos).toEqual([]);
    expect(p.aristas).toEqual([]);
    expect(p.hilos.every((h) => !h.desplegado && h.hitos.length > 0)).toBe(true);
  });

  it('todas las columnas son angostas: una historia corta entra en una pantalla', () => {
    expect(p.columnas.every((c) => !c.ancha && c.ancho === MEDIDAS_DE_LA_RED.anchoAngosta)).toBe(true);
    expect(p.ancho).toBeLessThan(1000);
  });

  it('pone los hitos de cada episodio en la columna de su momento, con el de más peso', () => {
    const hta = p.hilos.find((h) => h.episodio.id === 'episodio:dx-p')!;
    const tipos = hta.hitos.map((h) => h.tipo);
    expect(tipos[0]).toBe('presuntivo');
    expect(tipos).toContain('confirmado');
    const hito = hta.hitos[0];
    const columna = p.columnas[hito.columna];
    expect(hito.x).toBe(columna.x + columna.ancho / 2);
  });

  it('los hilos no se superponen', () => {
    for (let i = 1; i < p.hilos.length; i++) {
      expect(p.hilos[i].y).toBeGreaterThanOrEqual(p.hilos[i - 1].y + p.hilos[i - 1].alto);
    }
  });
});

describe('ubicarRed · desplegado (nivel 2 y 3)', () => {
  const p = plano(REGISTROS, REALES, { todo: true });

  it('las columnas con registros a la vista se ensanchan', () => {
    expect(p.columnas.every((c) => c.ancha)).toBe(true);
  });

  it('el detalle se agrupa tras un «+N» por momento, y el vínculo converge en él', () => {
    const grupo = p.nodos.find((n) => n.forma === 'grupo')!;
    expect(grupo.grupo?.ocultos.map((o) => o.id)).toEqual(['o1', 'o2', 'o3']);
    expect(p.nodos.some((n) => n.id === 'o1')).toBe(false);
    expect(p.aristas.filter((a) => a.hasta === grupo.id)).toHaveLength(1);
  });

  it('un único registro de detalle se muestra sin grupo', () => {
    expect(p.nodos.some((n) => n.id === 'o4' && n.forma === 'tarjeta')).toBe(true);
  });

  it('el descartado se ve plegado, como marcador compacto con su id real', () => {
    const descartado = p.nodos.find((n) => n.id === 'dx-x')!;
    expect(descartado.forma).toBe('descartado');
    expect(descartado.alto).toBe(MEDIDAS_DE_LA_RED.altoCompacto);
  });

  it('abierto, el descartado muestra su tarjeta y un control para volver a plegarlo', () => {
    const abierto = plano(REGISTROS, REALES, { todo: true, abiertos: new Set(['dx-x']) });
    expect(abierto.nodos.find((n) => n.id === 'dx-x')?.forma).toBe('tarjeta');
    expect(abierto.nodos.some((n) => n.id === 'plegar:dx-x')).toBe(true);
    verificarTrazado(abierto);
  });

  it('abierto el grupo, muestra todo el detalle y conserva el id del control', () => {
    const grupo = p.nodos.find((n) => n.forma === 'grupo')!;
    const abierto = plano(REGISTROS, REALES, { todo: true, abiertos: new Set([grupo.grupo!.clave]) });
    expect(['o1', 'o2', 'o3'].every((id) => abierto.nodos.some((n) => n.id === id))).toBe(true);
    expect(abierto.nodos.find((n) => n.id === grupo.id)?.grupo?.accion).toBe('contraer');
    verificarTrazado(abierto);
  });

  it('el vínculo inferido se dibuja como enlace, con su etiqueta, y nunca por el tronco', () => {
    const inferida = p.aristas.find((a) => a.motivo === 'inferido-misma-atencion')!;
    expect(inferida.inferido).toBe(true);
    expect(inferida.familia).toBe('enlace');
    expect(inferida.etiqueta).toBeDefined();
    expect(p.aristas.filter((a) => !a.inferido).every((a) => a.etiqueta === undefined)).toBe(true);
  });

  it('la atención compartida se dibuja una vez y su tronco llega al otro hilo', () => {
    expect(p.nodos.filter((n) => n.id === 'e3')).toHaveLength(1);
    const e3 = p.nodos.find((n) => n.id === 'e3')!;
    const rx3 = p.nodos.find((n) => n.id === 'rx3')!;
    expect(rx3.episodio).not.toBe(e3.episodio);
    const tronco = p.aristas.find((a) => a.desde === 'e3' && a.hasta === 'rx3')!;
    expect(tronco.familia).toBe('tronco');
    expect(tronco.puntos[1][0]).toBe(e3.x - DISTANCIA_DEL_TRONCO);
  });

  it('cumple las reglas del trazado', () => {
    verificarTrazado(p);
  });

  it('un hilo plegado entre desplegados no lleva nodos ni líneas propias', () => {
    const red = agruparEnEpisodios(REGISTROS, [...REALES, ...inferirVinculos(REGISTROS, REALES)]);
    const solo = plano(REGISTROS, REALES, { desplegados: new Set([red.episodios[0].id]) });
    expect(solo.nodos.every((n) => n.episodio === red.episodios[0].id)).toBe(true);
    verificarTrazado(solo);
  });
});

describe('ubicarRed · filtro y casos borde', () => {
  it('con `visibles`, sólo dibuja esos registros; vacío no filtra nada', () => {
    const todos = plano(REGISTROS, REALES, { todo: true });
    const vacio = plano(REGISTROS, REALES, { todo: true, visibles: new Set() });
    expect(vacio.nodos.length).toBe(todos.nodos.length);
    const filtrado = plano(REGISTROS, REALES, { todo: true, visibles: new Set(['dx-c', 'rx1', 'rx3']) });
    expect(filtrado.nodos.map((n) => n.id).sort()).toEqual(['dx-c', 'rx1', 'rx3']);
    verificarTrazado(filtrado);
  });

  it('sin la atención a la vista, sus registros van a una columna del día que no se rotula «sin atención»', () => {
    const filtrado = plano(REGISTROS, REALES, { todo: true, visibles: new Set(['dx-c']) });
    expect(filtrado.columnas[0].contexto).toBe('dia');
  });

  it('lleva lo que no tiene fecha al final', () => {
    const p = plano([r('a', 'nota', d(2025, 1)), r('b', 'nota', null)], [], { todo: true });
    expect(p.columnas.map((c) => c.clave)).toEqual(['dia:2025-01-10', 'sin-fecha']);
  });

  it('un plano vacío no se rompe', () => {
    const p = plano([], []);
    expect(p.columnas).toEqual([]);
    expect(p.hilos).toEqual([]);
    expect(p.ancho).toBeGreaterThan(0);
  });

  it('escribe el intervalo entre columnas', () => {
    const p = plano(REGISTROS, REALES, { todo: true });
    expect(p.columnas[1].intervalo).toBe('4 semanas');
  });

  it('una receta anterior a su diagnóstico se conecta hacia atrás, de borde a borde', () => {
    const p = plano(
      [r('rx', 'medicacion', d(2025, 1)), r('x', 'nota', d(2025, 2)), r('c', 'atencion', d(2025, 4)), r('dx', 'diagnostico', d(2025, 4), { encuentroId: 'c', certeza: 'confirmado' })],
      [
        { desde: 'c', hasta: 'dx', motivo: 'registrado-en' },
        { desde: 'dx', hasta: 'rx', motivo: 'indicado-para' },
      ],
      { todo: true },
    );
    const arista = p.aristas.find((a) => a.motivo === 'indicado-para')!;
    const dx = p.nodos.find((n) => n.id === 'dx')!;
    const rx = p.nodos.find((n) => n.id === 'rx')!;
    expect(arista.puntos[0]).toEqual([dx.x + dx.ancho, dx.y + dx.alto / 2]);
    expect(arista.puntos.at(-1)![0]).toBe(rx.x);
    verificarTrazado(p);
  });
});

describe('ubicarRed · muchas líneas', () => {
  it('seis diagnósticos en una atención con recetas en columnas distintas, corchetes y una hacia atrás', () => {
    const regs: RegistroDeLaRed[] = [r('c1', 'atencion', d(2026, 1)), r('c2', 'atencion', d(2026, 4))];
    const vins: VinculoDeLaRed[] = [];
    ['a', 'b', 'c', 'e', 'f', 'g'].forEach((id) => {
      regs.push(r(id, 'diagnostico', d(2026, 1), { encuentroId: 'c1', certeza: 'confirmado' }));
      vins.push({ desde: 'c1', hasta: id, motivo: 'registrado-en' });
    });
    regs.push(
      r('ra', 'medicacion', d(2026, 1), { encuentroId: 'c1' }),
      r('rb', 'medicacion', d(2026, 4), { encuentroId: 'c2' }),
      r('rc', 'medicacion', d(2026, 6)),
      r('re', 'medicacion', d(2025, 6)),
      r('rf', 'medicacion', d(2026, 4), { encuentroId: 'c2' }),
      r('rg', 'medicacion', d(2026, 8)),
    );
    vins.push(
      { desde: 'c1', hasta: 'ra', motivo: 'registrado-en' },
      { desde: 'c2', hasta: 'rb', motivo: 'registrado-en' },
      { desde: 'c2', hasta: 'rf', motivo: 'registrado-en' },
      { desde: 'a', hasta: 'ra', motivo: 'indicado-para' },
      { desde: 'b', hasta: 'rb', motivo: 'indicado-para' },
      { desde: 'c', hasta: 'rc', motivo: 'indicado-para' },
      { desde: 'e', hasta: 're', motivo: 'indicado-para' },
      { desde: 'a', hasta: 'rf', motivo: 'indicado-para' },
      { desde: 'g', hasta: 'rg', motivo: 'indicado-para' },
    );
    const p = plano(regs, vins, { todo: true });
    expect(p.aristas.filter((a) => a.familia === 'enlace').length).toBe(6);
    verificarTrazado(p);
  });

  it('el pasillo se ensancha cuando bajan más líneas de las que entran', () => {
    const regs: RegistroDeLaRed[] = [];
    const vins: VinculoDeLaRed[] = [];
    // Ocho registros del mismo problema en un mismo momento, cada uno con su
    // receta en un momento distinto: las ocho bajadas comparten pasillo y
    // altura, y no entran en el ancho de siempre. (En hilos distintos se
    // apilarían en alturas que no se solapan y compartirían carril.)
    for (let i = 0; i < 8; i++) {
      regs.push(r(`d${i}`, 'diagnostico', d(2025, 1), { certeza: 'confirmado', concepto: 'k' }));
      regs.push(r(`r${i}`, 'medicacion', d(2025, 2 + i)));
      vins.push({ desde: `d${i}`, hasta: `r${i}`, motivo: 'indicado-para' });
    }
    const p = plano(regs, vins, { todo: true });
    expect(p.columnas[1].hueco).toBeGreaterThan(MEDIDAS_DE_LA_RED.huecoAncho);
    verificarTrazado(p);
  });

  it.each(Array.from({ length: 16 }, (_, i) => i + 1))('una historia generada (semilla %i) cumple las reglas del trazado', (semilla) => {
    const { registros, vinculos } = historiaGenerada(semilla);
    verificarTrazado(plano(registros, vinculos, { todo: true }));
    // Y con todo abierto: descartados y grupos.
    const abiertos = new Set(registros.map((x) => x.id));
    const red = agruparEnEpisodios(registros, vinculos);
    for (const e of red.episodios) for (const x of registros) abiertos.add(claveDeGrupo(e.id, `enc:${x.id}`));
    verificarTrazado(plano(registros, vinculos, { todo: true, abiertos }));
    // La verificación compara cada tramo con todos los demás: con la máquina
    // cargada pasaba los 5 s por omisión sin que nada estuviera mal.
  }, 30_000);
});

/* -- Una historia pseudoaleatoria y reproducible --------------------------- */

function historiaGenerada(semilla: number): { registros: RegistroDeLaRed[]; vinculos: VinculoDeLaRed[] } {
  let s = semilla * 7919;
  const azar = (n: number): number => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % n;
  };
  const registros: RegistroDeLaRed[] = [];
  const vinculos: VinculoDeLaRed[] = [];
  const dxs: string[] = [];
  const rxs: string[] = [];
  for (let i = 0; i < 9; i++) {
    const e = `e${i}`;
    registros.push(r(e, 'atencion', d(2025, 1 + i * 2)));
    const cuantos = 1 + azar(3);
    for (let j = 0; j < cuantos; j++) {
      const dx = `dx${i}-${j}`;
      const certeza = (['presuntivo', 'confirmado', 'descartado'] as const)[azar(3)];
      registros.push(r(dx, 'diagnostico', d(2025, 1 + i * 2), { encuentroId: e, certeza, concepto: `k${azar(5)}` }));
      vinculos.push({ desde: e, hasta: dx, motivo: 'registrado-en' });
      if (certeza === 'descartado' && dxs.length > 0) {
        vinculos.push({ desde: dx, hasta: dxs[azar(dxs.length)], motivo: 'reemplazado-por' });
      }
      dxs.push(dx);
    }
    for (let j = 0; j < 1 + azar(3); j++) {
      const rx = `rx${i}-${j}`;
      registros.push(r(rx, 'medicacion', d(2025, 1 + i * 2), { encuentroId: e }));
      vinculos.push({ desde: e, hasta: rx, motivo: 'registrado-en' });
      vinculos.push({ desde: dxs[azar(dxs.length)], hasta: rx, motivo: 'indicado-para' });
      if (rxs.length > 0 && azar(3) === 0) vinculos.push({ desde: rxs[azar(rxs.length)], hasta: rx, motivo: 'receta-reemplazada' });
      rxs.push(rx);
    }
    if (azar(2) === 0) {
      const est = `est${i}`;
      registros.push(r(est, 'estudio', d(2025, 1 + i * 2), { encuentroId: e }));
      vinculos.push({ desde: e, hasta: est, motivo: 'registrado-en' });
      if (azar(2) === 0) vinculos.push({ desde: dxs[azar(dxs.length)], hasta: est, motivo: 'pedido-para' });
      const res = `res${i}`;
      registros.push(r(res, 'resultado', d(2025, 2 + i * 2, 1)));
      vinculos.push({ desde: est, hasta: res, motivo: 'resultado-de' });
    }
    for (let j = 0; j < azar(4); j++) {
      const o = `o${i}-${j}`;
      registros.push(r(o, 'observacion', d(2025, 1 + i * 2), { encuentroId: e }));
      vinculos.push({ desde: e, hasta: o, motivo: 'registrado-en' });
    }
    if (azar(3) === 0) {
      const ref = `ref${i}`;
      registros.push(r(ref, 'derivacion', d(2025, 1 + i * 2), { encuentroId: e }));
      vinculos.push({ desde: e, hasta: ref, motivo: 'derivado-desde' });
    }
    if (azar(2) === 0) registros.push(r(`b${i}`, 'cita', d(2025, 1 + i * 2)));
  }
  return { registros, vinculos: [...vinculos, ...inferirVinculos(registros, vinculos)] };
}

/* -- Las reglas del trazado ------------------------------------------------ */

interface Segmento {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
}

function segmentos(arista: AristaDeLaRed): Segmento[] {
  const p = arista.puntos;
  return p.slice(1).map((b, i) => ({ ax: p[i][0], ay: p[i][1], bx: b[0], by: b[1] }));
}

/**
 * Lo que tiene que cumplir cualquier plano (las mismas reglas que se le
 * exigían al recorrido por carriles, más las de los hilos):
 *
 * 1. dos nodos no se superponen;
 * 2. cada enlace arranca y termina en el borde de sus nodos;
 * 3. dos enlaces de **distinto** origen no comparten un tramo paralelo a menos
 *    de 6 px (los de un mismo origen sí pueden abrirse desde la misma salida;
 *    y los que llegan a un mismo «+N» pueden converger);
 * 4. ningún tramo de enlace pasa a menos de 4 px de una tarjeta que no sea
 *    uno de sus extremos, y ningún tronco atraviesa una tarjeta;
 * 5. la punta de flecha (los ~16 px finales) no la pisa otro enlace;
 * 6. los tramos verticales de los enlaces corren a 8 px o más de los troncos;
 * 7. todo nodo queda dentro de su hilo y del plano.
 */
function verificarTrazado(p: PlanoDeLaRed): void {
  // 1 y 7
  for (const a of p.nodos) {
    const hilo = p.hilos.find((h) => h.episodio.id === a.episodio)!;
    expect(a.y, `${a.id} dentro de su hilo`).toBeGreaterThanOrEqual(hilo.y);
    expect(a.y + a.alto, `${a.id} dentro de su hilo`).toBeLessThanOrEqual(hilo.y + hilo.alto);
    expect(a.x + a.ancho).toBeLessThanOrEqual(p.ancho);
    for (const b of p.nodos) {
      if (a === b) continue;
      const enX = a.x < b.x + b.ancho && b.x < a.x + a.ancho;
      const enY = a.y < b.y + b.alto && b.y < a.y + a.alto;
      expect(enX && enY, `${a.id} se superpone con ${b.id}`).toBe(false);
    }
  }
  const porId = new Map(p.nodos.map((n) => [n.id, n]));
  const enlaces = p.aristas.filter((a) => a.familia === 'enlace');
  const pueden = (a: AristaDeLaRed, b: AristaDeLaRed): boolean =>
    a.desde === b.desde || (a.hasta === b.hasta && a.hasta.startsWith('grupo:'));
  const troncos = p.columnas.map((c) => c.x - DISTANCIA_DEL_TRONCO);

  for (const a of enlaces) {
    const desde = porId.get(a.desde)!;
    const hasta = porId.get(a.hasta)!;
    // 2
    const [x0, y0] = a.puntos[0];
    expect(x0 === desde.x + desde.ancho, `${a.clave} sale del borde`).toBe(true);
    expect(y0 > desde.y && y0 < desde.y + desde.alto).toBe(true);
    const [x1, y1] = a.puntos.at(-1)!;
    expect(x1 === hasta.x || x1 === hasta.x + hasta.ancho, `${a.clave} llega al borde`).toBe(true);
    expect(y1 > hasta.y && y1 < hasta.y + hasta.alto).toBe(true);
    // 5
    const [px] = a.puntos.at(-2)!;
    const sentido = Math.sign(px - x1);
    const punta = { x0: Math.min(x1, x1 + sentido * 16), x1: Math.max(x1, x1 + sentido * 16), y0: y1 - 6, y1: y1 + 6 };
    for (const b of enlaces) {
      if (b === a || pueden(a, b)) continue;
      for (const sb of segmentos(b)) {
        const enX = Math.max(sb.ax, sb.bx) >= punta.x0 && Math.min(sb.ax, sb.bx) <= punta.x1;
        const enY = Math.max(sb.ay, sb.by) >= punta.y0 && Math.min(sb.ay, sb.by) <= punta.y1;
        expect(enX && enY, `${b.clave} pasa por la punta de ${a.clave}`).toBe(false);
      }
    }
    // 6
    for (const sg of segmentos(a)) {
      if (sg.ax === sg.bx) {
        for (const t of troncos) {
          expect(Math.abs(sg.ax - t), `${a.clave} corre pegado a un tronco`).toBeGreaterThanOrEqual(8);
        }
      }
    }
    // 3
    for (const b of enlaces) {
      if (a.clave >= b.clave || pueden(a, b)) continue;
      for (const sa of segmentos(a)) {
        for (const sb of segmentos(b)) {
          if (sa.ay === sa.by && sb.ay === sb.by) {
            const solapan =
              Math.min(Math.max(sa.ax, sa.bx), Math.max(sb.ax, sb.bx)) - Math.max(Math.min(sa.ax, sa.bx), Math.min(sb.ax, sb.bx)) > 0.5;
            if (solapan) expect(Math.abs(sa.ay - sb.ay), `${a.clave} y ${b.clave} comparten un horizontal`).toBeGreaterThanOrEqual(6);
          }
          if (sa.ax === sa.bx && sb.ax === sb.bx) {
            const solapan =
              Math.min(Math.max(sa.ay, sa.by), Math.max(sb.ay, sb.by)) - Math.max(Math.min(sa.ay, sa.by), Math.min(sb.ay, sb.by)) > 0.5;
            if (solapan) expect(Math.abs(sa.ax - sb.ax), `${a.clave} y ${b.clave} comparten un vertical`).toBeGreaterThanOrEqual(6);
          }
        }
      }
    }
    // 4
    for (const n of p.nodos) {
      if (n.id === a.desde || n.id === a.hasta) continue;
      for (const sg of segmentos(a)) {
        const dentroX = Math.max(sg.ax, sg.bx) > n.x - 4 && Math.min(sg.ax, sg.bx) < n.x + n.ancho + 4;
        const dentroY = Math.max(sg.ay, sg.by) > n.y - 4 && Math.min(sg.ay, sg.by) < n.y + n.alto + 4;
        expect(dentroX && dentroY, `${a.clave} pasa por «${n.id}»`).toBe(false);
      }
    }
  }
  for (const t of p.aristas.filter((a) => a.familia === 'tronco')) {
    const [, [tx, ty0], [, ty1]] = t.puntos;
    for (const n of p.nodos) {
      const cruza = tx > n.x && tx < n.x + n.ancho && Math.max(ty0, ty1) > n.y && Math.min(ty0, ty1) < n.y + n.alto;
      expect(cruza, `el tronco ${t.clave} atraviesa «${n.id}»`).toBe(false);
    }
  }
}
