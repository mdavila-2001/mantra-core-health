import { describe, expect, it } from 'vitest';

import {
  agruparEnEpisodios,
  ID_SIN_DIAGNOSTICO,
  inferirVinculos,
  relacionesDe,
  type RegistroDeLaRed,
  type VinculoDeLaRed,
} from './red-clinica.model';

/**
 * La regla de episodios (ADR-0021) sobre una historia de dieciocho meses con
 * todos los casos que la regla tiene que resolver:
 *
 *   may 2025  e1: presuntivo de HTA, dos presiones, una nota y un estudio
 *             (MAPA) pedido ahí sin `reasonConditionId` → inferido al
 *             presuntivo; cita b0 el mismo día (inferida a e1).
 *   jun 2025  e2: HTA confirmada (mismo concepto: mismo problema), enalapril
 *             para ella; angina presuntiva descartada; resultado del MAPA;
 *             cita b2 ese día, cancelada (no se le infiere atención).
 *   jul 2025  b1: reconsulta de b0.
 *   ago 2025  e3: ERGE (reemplaza a la angina), omeprazol para ERGE, y
 *             losartán para HTA que reemplaza al enalapril → e3 es de los dos
 *             episodios; derivación ref1 desde e3.
 *   sep 2025  e4: la atención del destino de la derivación (`targetEncounterId`),
 *             dentro de la internación i1.
 *   mar 2026  e5: una atención con una observación y nada más.
 */
const d = (anio: number, mes: number, dia = 10): Date => new Date(anio, mes - 1, dia);
const r = (
  id: string,
  clase: RegistroDeLaRed['clase'],
  cuando: Date | null,
  extra: Partial<RegistroDeLaRed> = {},
): RegistroDeLaRed => ({ id, clase, titulo: id, detalle: '', estado: '', cuando, ...extra });

const REGISTROS: readonly RegistroDeLaRed[] = [
  r('e1', 'atencion', d(2025, 5)),
  r('dx-hta-p', 'diagnostico', d(2025, 5), { encuentroId: 'e1', certeza: 'presuntivo', concepto: 'C-HTA' }),
  r('o1', 'observacion', d(2025, 5), { encuentroId: 'e1' }),
  r('o2', 'observacion', d(2025, 5), { encuentroId: 'e1' }),
  r('n1', 'nota', d(2025, 5), { encuentroId: 'e1' }),
  r('est1', 'estudio', d(2025, 5), { encuentroId: 'e1' }),
  r('b0', 'cita', d(2025, 5)),
  r('e2', 'atencion', d(2025, 6)),
  r('dx-hta-c', 'diagnostico', d(2025, 6), { encuentroId: 'e2', certeza: 'confirmado', concepto: 'C-HTA', titulo: 'Hipertensión' }),
  r('rx1', 'medicacion', d(2025, 6), { encuentroId: 'e2' }),
  r('dx-angina', 'diagnostico', d(2025, 6), { encuentroId: 'e2', certeza: 'descartado', concepto: 'C-ANG' }),
  r('res1', 'resultado', d(2025, 6)),
  r('b2', 'cita', d(2025, 6)),
  r('b1', 'cita', d(2025, 7)),
  r('e3', 'atencion', d(2025, 8)),
  r('dx-erge', 'diagnostico', d(2025, 8), { encuentroId: 'e3', certeza: 'confirmado', concepto: 'C-ERGE', titulo: 'ERGE' }),
  r('rx2', 'medicacion', d(2025, 8), { encuentroId: 'e3' }),
  r('rx3', 'medicacion', d(2025, 8), { encuentroId: 'e3' }),
  r('ref1', 'derivacion', d(2025, 8), { encuentroId: 'e3' }),
  r('e4', 'atencion', d(2025, 9)),
  r('i1', 'internacion', d(2025, 9, 9)),
  r('e5', 'atencion', d(2026, 3)),
  r('o5', 'observacion', d(2026, 3), { encuentroId: 'e5' }),
];

const REALES: readonly VinculoDeLaRed[] = [
  { desde: 'e1', hasta: 'dx-hta-p', motivo: 'registrado-en' },
  { desde: 'e1', hasta: 'o1', motivo: 'registrado-en' },
  { desde: 'e1', hasta: 'o2', motivo: 'registrado-en' },
  { desde: 'e1', hasta: 'n1', motivo: 'registrado-en' },
  { desde: 'e1', hasta: 'est1', motivo: 'registrado-en' },
  { desde: 'e2', hasta: 'dx-hta-c', motivo: 'registrado-en' },
  { desde: 'e2', hasta: 'rx1', motivo: 'registrado-en' },
  { desde: 'e2', hasta: 'dx-angina', motivo: 'registrado-en' },
  { desde: 'dx-hta-c', hasta: 'rx1', motivo: 'indicado-para' },
  { desde: 'est1', hasta: 'res1', motivo: 'resultado-de' },
  { desde: 'b0', hasta: 'b1', motivo: 'reconsulta-de' },
  { desde: 'e3', hasta: 'dx-erge', motivo: 'registrado-en' },
  { desde: 'e3', hasta: 'rx2', motivo: 'registrado-en' },
  { desde: 'e3', hasta: 'rx3', motivo: 'registrado-en' },
  { desde: 'dx-angina', hasta: 'dx-erge', motivo: 'reemplazado-por' },
  { desde: 'dx-erge', hasta: 'rx2', motivo: 'indicado-para' },
  { desde: 'dx-hta-c', hasta: 'rx3', motivo: 'indicado-para' },
  { desde: 'rx1', hasta: 'rx3', motivo: 'receta-reemplazada' },
  { desde: 'e3', hasta: 'ref1', motivo: 'derivado-desde' },
  { desde: 'ref1', hasta: 'e4', motivo: 'recibido-en' },
  { desde: 'i1', hasta: 'e4', motivo: 'durante-internacion' },
  { desde: 'e5', hasta: 'o5', motivo: 'registrado-en' },
];

const ATENDIBLE = (id: string): boolean => id !== 'b2';
const INFERIDOS = inferirVinculos(REGISTROS, REALES, ATENDIBLE);
const VINCULOS = [...REALES, ...INFERIDOS];
const RED = agruparEnEpisodios(REGISTROS, VINCULOS);

const episodioDe = (id: string): string | undefined => RED.episodioDe.get(id);
const HTA = 'episodio:dx-hta-p';
const ERGE = 'episodio:dx-angina';

describe('inferirVinculos', () => {
  it('infiere el estudio pedido en la atención de un presuntivo y la cita del mismo día que una atención', () => {
    expect(INFERIDOS).toEqual([
      { desde: 'dx-hta-p', hasta: 'est1', motivo: 'inferido-misma-atencion' },
      { desde: 'b0', hasta: 'e1', motivo: 'inferido-mismo-dia' },
    ]);
  });

  it('no infiere a una cita cancelada o ausente', () => {
    expect(INFERIDOS.some((v) => v.desde === 'b2')).toBe(false);
  });

  it('no infiere si el estudio ya tiene su diagnóstico guardado', () => {
    const conMotivo: VinculoDeLaRed[] = [...REALES, { desde: 'dx-hta-p', hasta: 'est1', motivo: 'pedido-para' }];
    expect(inferirVinculos(REGISTROS, conMotivo).some((v) => v.hasta === 'est1')).toBe(false);
  });

  it('con dos presuntivos en la misma atención no elige ninguno', () => {
    const dos = [...REGISTROS, r('dx-otro', 'diagnostico', d(2025, 5), { encuentroId: 'e1', certeza: 'presuntivo' })];
    expect(inferirVinculos(dos, REALES).some((v) => v.motivo === 'inferido-misma-atencion')).toBe(false);
  });

  it('con dos atenciones el mismo día no le asigna ninguna a la cita', () => {
    const dos = [...REGISTROS, r('e1-bis', 'atencion', d(2025, 5))];
    expect(inferirVinculos(dos, REALES).some((v) => v.desde === 'b0')).toBe(false);
  });

  it('no infiere atención a una cita que ya está atada a una', () => {
    // Un vínculo guardado cita → atención, o atención → cita, ya la ata.
    const atada: VinculoDeLaRed[] = [...REALES, { desde: 'b0', hasta: 'e1', motivo: 'reconsulta-de' }];
    const conOrigen: VinculoDeLaRed[] = [...REALES, { desde: 'e2', hasta: 'b2', motivo: 'registrado-en' }];
    expect(inferirVinculos(REGISTROS, atada).filter((v) => v.desde === 'b0')).toHaveLength(0);
    expect(inferirVinculos(REGISTROS, conOrigen).some((v) => v.desde === 'b2')).toBe(false);
  });
});

describe('agruparEnEpisodios', () => {
  it('arma un episodio por problema, en orden de inicio, y el hilo sin diagnóstico al final', () => {
    expect(RED.episodios.map((e) => e.id)).toEqual([HTA, ERGE, ID_SIN_DIAGNOSTICO]);
    expect(RED.episodios.at(-1)?.nombre).toBe('Atenciones sin diagnóstico asociado');
  });

  it('une el presuntivo y el confirmado del mismo concepto en una cadena, con el nombre del vigente', () => {
    const hta = RED.episodios[0];
    expect(hta.diagnosticos).toEqual(['dx-hta-p', 'dx-hta-c']);
    expect(hta.nombre).toBe('Hipertensión');
  });

  it('une el descartado con el que lo reemplazó y lo cuenta como descartado', () => {
    const erge = RED.episodios[1];
    expect(erge.diagnosticos).toEqual(['dx-angina', 'dx-erge']);
    expect(erge.nombre).toBe('ERGE');
    expect(erge.descartados).toBe(1);
  });

  it('lleva recetas, estudios y resultados al episodio de su diagnóstico', () => {
    expect(episodioDe('rx1')).toBe(HTA);
    expect(episodioDe('rx2')).toBe(ERGE);
    expect(episodioDe('est1')).toBe(HTA); // por el vínculo inferido
    expect(episodioDe('res1')).toBe(HTA); // resultado del estudio
  });

  it('la receta que reemplaza a otra sigue en el episodio de la reemplazada', () => {
    expect(episodioDe('rx3')).toBe(HTA);
  });

  it('una atención que toca dos episodios se dibuja una vez, en el que tiene más registros suyos, y pertenece a los dos', () => {
    expect(episodioDe('e3')).toBe(ERGE); // ERGE + omeprazol (2) contra losartán (1)
    expect(RED.pertenencias.get('e3')).toEqual([ERGE, HTA]);
    expect(RED.episodios[0].compartidos).toContain('e3');
    expect(RED.episodios[1].miembros).toContain('e3');
  });

  it('con empate, la atención va al episodio que empezó antes', () => {
    const empate = agruparEnEpisodios(
      [
        r('e', 'atencion', d(2026, 1)),
        r('viejo', 'diagnostico', d(2024, 1), { encuentroId: 'e', certeza: 'confirmado' }),
        r('nuevo', 'diagnostico', d(2025, 1), { encuentroId: 'e', certeza: 'confirmado' }),
      ],
      [
        { desde: 'e', hasta: 'viejo', motivo: 'registrado-en' },
        { desde: 'e', hasta: 'nuevo', motivo: 'registrado-en' },
      ],
    );
    expect(empate.episodioDe.get('e')).toBe('episodio:viejo');
    expect(empate.pertenencias.get('e')).toEqual(['episodio:viejo', 'episodio:nuevo']);
  });

  it('lo que sólo cuelga de una atención va donde se dibuja esa atención', () => {
    expect(episodioDe('o1')).toBe(HTA);
    expect(episodioDe('n1')).toBe(HTA);
    expect(episodioDe('ref1')).toBe(ERGE);
  });

  it('la atención del destino de una derivación y su internación siguen a la derivación', () => {
    expect(episodioDe('e4')).toBe(ERGE);
    expect(episodioDe('i1')).toBe(ERGE);
  });

  it('las reconsultas se encadenan a la cita origen, y ésta a su atención inferida', () => {
    expect(episodioDe('b0')).toBe(HTA);
    expect(episodioDe('b1')).toBe(HTA);
  });

  it('lo que no cuelga de ningún diagnóstico va al hilo sin diagnóstico', () => {
    expect(episodioDe('b2')).toBe(ID_SIN_DIAGNOSTICO);
    expect(episodioDe('e5')).toBe(ID_SIN_DIAGNOSTICO);
    expect(episodioDe('o5')).toBe(ID_SIN_DIAGNOSTICO);
  });

  it('cada registro está en exactamente un episodio', () => {
    const contados = RED.episodios.flatMap((e) => e.miembros);
    expect(contados).toHaveLength(REGISTROS.length);
    expect(new Set(contados).size).toBe(REGISTROS.length);
  });

  it('el resumen trae rango de fechas, conteos e hitos clave', () => {
    const hta = RED.episodios[0];
    expect(hta.desde).toEqual(d(2025, 5));
    expect(hta.hasta).toEqual(d(2025, 8)); // incluye la atención compartida
    expect(hta.conteos.medicacion).toBe(2);
    expect(hta.conteos.estudio).toBe(1);
    expect(hta.hitos.filter((h) => h.tipo === 'presuntivo').map((h) => h.id)).toEqual(['dx-hta-p']);
    expect(hta.hitos.filter((h) => h.tipo === 'confirmado').map((h) => h.id)).toEqual(['dx-hta-c']);
    expect(RED.episodios[1].hitos.some((h) => h.tipo === 'descartado' && h.id === 'dx-angina')).toBe(true);
    expect(RED.episodios[1].hitos.some((h) => h.tipo === 'derivacion')).toBe(true);
  });

  it('un episodio con todos sus diagnósticos descartados lo dice en su estado', () => {
    const red = agruparEnEpisodios(
      [r('dx', 'diagnostico', d(2025, 1), { certeza: 'descartado', titulo: 'Asma' })],
      [],
    );
    expect(red.episodios[0].nombre).toBe('Asma');
    expect(red.episodios[0].estado).toBe('Descartado');
  });

  it('no se cuelga con un ciclo de reemplazos ni con vínculos a registros ausentes', () => {
    const red = agruparEnEpisodios(
      [r('a', 'diagnostico', d(2025, 1)), r('b', 'diagnostico', d(2025, 2)), r('rx', 'medicacion', d(2025, 3))],
      [
        { desde: 'a', hasta: 'b', motivo: 'reemplazado-por' },
        { desde: 'b', hasta: 'a', motivo: 'reemplazado-por' },
        { desde: 'fantasma', hasta: 'rx', motivo: 'indicado-para' },
      ],
    );
    expect(red.episodios.map((e) => e.miembros.length)).toEqual([2, 1]);
    expect(red.episodioDe.get('rx')).toBe(ID_SIN_DIAGNOSTICO);
  });

  it('un expediente vacío no tiene episodios', () => {
    expect(agruparEnEpisodios([], []).episodios).toEqual([]);
  });
});

describe('relacionesDe', () => {
  const porId = new Map(REGISTROS.map((x) => [x.id, x]));

  it('dice en palabras cada vínculo, y los inferidos con esa palabra', () => {
    const frases = relacionesDe('est1', VINCULOS, porId);
    expect(frases).toContain('registrado en la atención e1');
    expect(frases.some((f) => f.startsWith('vínculo inferido') && f.includes('dx-hta-p'))).toBe(true);
  });

  it('nombra el reemplazo de un descartado en los dos sentidos', () => {
    expect(relacionesDe('dx-angina', VINCULOS, porId)).toContain('descartado y reemplazado por ERGE');
    expect(relacionesDe('dx-erge', VINCULOS, porId)).toContain('reemplaza al diagnóstico descartado dx-angina');
  });
});
