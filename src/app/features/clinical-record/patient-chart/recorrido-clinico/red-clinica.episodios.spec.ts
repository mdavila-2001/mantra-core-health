import { describe, expect, it } from 'vitest';

import { type RegistroDeLaRed, type VinculoDeLaRed } from './red-clinica.model';
import { agruparEnEpisodios } from './red-clinica.episodios';

const cuando = new Date('2026-03-10T15:00:00Z');
const r = (id: string, clase: RegistroDeLaRed['clase'], extra: Partial<RegistroDeLaRed> = {}): RegistroDeLaRed => ({
  id,
  clase,
  titulo: id,
  detalle: '',
  estado: '',
  cuando,
  ...extra,
});

describe('agruparEnEpisodios · inferred links never beat a real one (ADR-0021)', () => {
  /*
   * eA: HTA (dx-hta) and a referral ref from it, received in eB.
   * eB: has no diagnosis of its own, so it only takes an episode through
   *     `recibido-en`, a round after ref does. The study est was entered in eB
   *     (real `registrado-en`) and is also inferred to the presumptive
   *     dx-cef of another encounter (`inferido-misma-atencion`).
   * The real link must win, even though its source takes an episode late.
   */
  const registros: readonly RegistroDeLaRed[] = [
    r('eA', 'atencion'),
    r('dx-hta', 'diagnostico', { encuentroId: 'eA', concepto: 'C-HTA', certeza: 'confirmado' }),
    r('ref', 'derivacion', { encuentroId: 'eA' }),
    r('eC', 'atencion'),
    r('dx-cef', 'diagnostico', { encuentroId: 'eC', concepto: 'C-CEF', certeza: 'presuntivo' }),
    r('eB', 'atencion'),
    r('est', 'estudio', { encuentroId: 'eB' }),
  ];
  // `recibido-en` first, so in a single pass it still finds ref without an episode.
  const vinculos: readonly VinculoDeLaRed[] = [
    { desde: 'ref', hasta: 'eB', motivo: 'recibido-en' },
    { desde: 'eB', hasta: 'est', motivo: 'registrado-en' },
    { desde: 'dx-cef', hasta: 'est', motivo: 'inferido-misma-atencion' },
    { desde: 'eA', hasta: 'dx-hta', motivo: 'registrado-en' },
    { desde: 'eA', hasta: 'ref', motivo: 'derivado-desde' },
    { desde: 'eC', hasta: 'dx-cef', motivo: 'registrado-en' },
  ];

  it('the study goes with the encounter it was entered in, not with the inferred diagnosis', () => {
    const { episodioDe, pertenencias } = agruparEnEpisodios(registros, vinculos);
    expect(episodioDe.get('ref')).toBe('episodio:dx-hta');
    expect(episodioDe.get('eB')).toBe('episodio:dx-hta');
    expect(episodioDe.get('est')).toBe('episodio:dx-hta');
    expect(pertenencias.get('est')).toEqual(['episodio:dx-hta']);
  });

  it('the inferred link still applies when no real link gives the record an episode', () => {
    const sinReal = vinculos.filter((v) => !(v.desde === 'eB' && v.hasta === 'est'));
    const { episodioDe } = agruparEnEpisodios(registros, sinReal);
    expect(episodioDe.get('est')).toBe('episodio:dx-cef');
  });

  it('the result does not depend on the order the links arrive in', () => {
    const alReves = agruparEnEpisodios(registros, [...vinculos].reverse());
    expect(alReves.episodioDe.get('est')).toBe('episodio:dx-hta');
    expect(alReves.episodioDe.get('eB')).toBe('episodio:dx-hta');
  });
});
