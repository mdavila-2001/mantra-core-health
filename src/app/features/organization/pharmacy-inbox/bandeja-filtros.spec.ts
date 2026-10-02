import type { PharmacyDetail } from '../../../core/data-access/pharmacy/pharmacy.types';
import {
  TODAS_LAS_SEDES,
  cerradoEnElRecorte,
  diaDelMostrador,
  recorteDeLaUrl,
  sedeElegida,
  sedePorDefecto,
  sedesDeFarmacias,
  type SedeDeBandeja,
} from './bandeja-filtros';

function sede(code: string, esMatriz = false): SedeDeBandeja {
  return { id: `id-${code}`, code, nombre: `Sede ${code}`, farmacia: 'Farmacia', esMatriz };
}

describe('sedePorDefecto', () => {
  it('prefiere la casa matriz, esté donde esté en la lista', () => {
    expect(sedePorDefecto([sede('S1'), sede('S2', true), sede('S3')])).toEqual({
      id: 'id-S2',
      sinMatrizMarcada: false,
    });
  });

  it('con una sola sede la usa y no avisa de nada', () => {
    expect(sedePorDefecto([sede('S1')])).toEqual({ id: 'id-S1', sinMatrizMarcada: false });
  });

  it('con varias y ninguna matriz, toma la de código más bajo y lo marca', () => {
    // El orden es numérico dentro del código: S2 antes que S10.
    expect(sedePorDefecto([sede('S10'), sede('S2'), sede('S3')])).toEqual({
      id: 'id-S2',
      sinMatrizMarcada: true,
    });
  });

  it('sin sedes no hay default', () => {
    expect(sedePorDefecto([])).toEqual({ id: null, sinMatrizMarcada: false });
  });
});

describe('sedeElegida', () => {
  const sedes = [sede('S1'), sede('S2', true)];

  it('respeta una sede válida de la URL', () => {
    expect(sedeElegida('id-S1', sedes)).toBe('id-S1');
  });

  it('respeta «todas»', () => {
    expect(sedeElegida(TODAS_LAS_SEDES, sedes)).toBe(TODAS_LAS_SEDES);
  });

  it('una sede ajena o inventada vuelve al default en vez de romper', () => {
    expect(sedeElegida('de-otra-organizacion', sedes)).toBe('id-S2');
  });

  it('sin parámetro usa el default', () => {
    expect(sedeElegida(null, sedes)).toBe('id-S2');
  });
});

describe('sedesDeFarmacias', () => {
  it('aplana las sedes y lee la marca de casa matriz sólo si viene en true', () => {
    const farmacia = {
      name: 'Farmacia Andina',
      sites: [
        { id: 'a', code: 'S1', name: 'Norte', isHeadOffice: true },
        { id: 'b', code: 'S2', name: 'Sur' },
      ],
    } as unknown as PharmacyDetail;

    expect(sedesDeFarmacias([farmacia]).map((s) => [s.id, s.esMatriz, s.farmacia])).toEqual([
      ['a', true, 'Farmacia Andina'],
      ['b', false, 'Farmacia Andina'],
    ]);
  });
});

describe('recorteDeLaUrl', () => {
  it('cae a «hoy» con un valor ausente o desconocido', () => {
    expect(recorteDeLaUrl(null)).toBe('today');
    expect(recorteDeLaUrl('ayer-por-la-noche')).toBe('today');
    expect(recorteDeLaUrl('7d')).toBe('7d');
  });
});

describe('diaDelMostrador', () => {
  it('cuenta el día en Bolivia (UTC−4), no en UTC', () => {
    // 01:00 UTC del 5 aún es la noche del 4 en La Paz.
    expect(diaDelMostrador(new Date('2026-10-05T01:00:00.000Z'))).toBe('2026-10-04');
    expect(diaDelMostrador(new Date('2026-10-05T04:00:00.000Z'))).toBe('2026-10-05');
  });
});

describe('cerradoEnElRecorte', () => {
  // Mediodía en La Paz del 10 de octubre.
  const ahora = new Date('2026-10-10T16:00:00.000Z');
  const el = (dia: string) => new Date(`${dia}T16:00:00.000Z`);

  it('«hoy» y «ayer» miran un solo día', () => {
    expect(cerradoEnElRecorte(el('2026-10-10'), 'today', ahora)).toBe(true);
    expect(cerradoEnElRecorte(el('2026-10-09'), 'today', ahora)).toBe(false);
    expect(cerradoEnElRecorte(el('2026-10-09'), 'yesterday', ahora)).toBe(true);
    expect(cerradoEnElRecorte(el('2026-10-10'), 'yesterday', ahora)).toBe(false);
  });

  it('«hoy» no se corre por la hora UTC: 22:00 en La Paz sigue siendo hoy', () => {
    // 02:00 UTC del 11 = 22:00 del 10 en La Paz.
    expect(cerradoEnElRecorte(new Date('2026-10-11T02:00:00.000Z'), 'today', ahora)).toBe(true);
  });

  it('«últimos 7 días» cuenta hoy y los seis anteriores', () => {
    expect(cerradoEnElRecorte(el('2026-10-04'), '7d', ahora)).toBe(true);
    expect(cerradoEnElRecorte(el('2026-10-03'), '7d', ahora)).toBe(false);
  });

  it('«últimos 30 días» cuenta hoy y los 29 anteriores', () => {
    expect(cerradoEnElRecorte(el('2026-09-11'), '30d', ahora)).toBe(true);
    expect(cerradoEnElRecorte(el('2026-09-10'), '30d', ahora)).toBe(false);
  });

  it('un pedido del futuro no entra en un rango que termina hoy', () => {
    expect(cerradoEnElRecorte(el('2026-10-12'), '7d', ahora)).toBe(false);
  });

  it('«todos» no recorta nada', () => {
    expect(cerradoEnElRecorte(el('2020-01-01'), 'all', ahora)).toBe(true);
  });
});
