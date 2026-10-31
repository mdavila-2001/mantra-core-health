import {
  afterSelect,
  describeRegion,
  EMPTY_BODY_REGION,
  focusFor,
  groupRegions,
  layersFor,
  meshesOf,
  resolveTouch,
  rootOf,
  type BodyRegionValue,
} from './body-region-picker.logic';
import { ARCHIVO, CATALOGO, MAPA, PARTES } from './body-region-picker.testing';

const catalog = new Map(CATALOGO.map((r) => [r.codigo, r]));
const partById = new Map(PARTES.map((p) => [p.meshId, p]));
const toque = (meshId: string, point: [number, number, number] = [9, 9, 9]) => ({ meshId, point });
const tocar = (meshId: string, current: BodyRegionValue = EMPTY_BODY_REGION, allowed: string[] = [], point?: [number, number, number]) =>
  resolveTouch({ pick: toque(meshId, point), map: MAPA, partById, catalog, allowed: new Set(allowed), current });

describe('resolveTouch', () => {
  it('la lateralidad sale del side de la malla (lado del paciente)', () => {
    expect(tocar('HAND_L')).toEqual({ kind: 'chosen', value: { region: 'MANO', laterality: 'IZQ' } });
    expect(tocar('HAND_R')).toEqual({ kind: 'chosen', value: { region: 'MANO', laterality: 'DER' } });
  });

  it('tocar la otra mano con IZQ ya elegida pasa a DER, nunca a bilateral', () => {
    const r = tocar('HAND_R', { region: 'MANO', laterality: 'IZQ' });
    expect(r).toEqual({ kind: 'chosen', value: { region: 'MANO', laterality: 'DER' } });
  });

  it('una región no lateral deja la lateralidad en null', () => {
    expect(tocar('SKULL', { region: 'MANO', laterality: 'IZQ' })).toEqual({
      kind: 'chosen',
      value: { region: 'CRANEO', laterality: null },
    });
  });

  it('una región fuera de lo que admite el estudio no cambia nada', () => {
    expect(tocar('SKULL', EMPTY_BODY_REGION, ['MANO'])).toEqual({ kind: 'not-allowed', region: 'CRANEO' });
  });

  it('una malla sin región, o de una región sólo-lista, no propone nada', () => {
    expect(tocar('FEMUR_L')).toEqual({ kind: 'select-only' }); // por defecto cae en MIEMBRO_INFERIOR (solo_select)
    expect(resolveTouch({ pick: toque('NADA'), map: MAPA, partById, catalog, allowed: new Set(), current: EMPTY_BODY_REGION })).toEqual({
      kind: 'none',
    });
  });

  it('con el punto dentro de la articulación gana la articulación, con el lado de la caja', () => {
    const r = tocar('FEMUR_L', EMPTY_BODY_REGION, [], [0.08, 0, 0]);
    expect(r).toEqual({ kind: 'chosen', value: { region: 'RODILLA', laterality: 'IZQ' } });
    const derecha = tocar('FEMUR_R', EMPTY_BODY_REGION, [], [-0.08, 0.01, 0]);
    expect(derecha).toEqual({ kind: 'chosen', value: { region: 'RODILLA', laterality: 'DER' } });
  });

  it('con el punto lejos de la articulación vale la región por defecto de la malla', () => {
    expect(tocar('FEMUR_L', EMPTY_BODY_REGION, [], [0.08, 0.3, 0])).toEqual({ kind: 'select-only' });
  });
});

describe('afterSelect', () => {
  it('conserva el lado sólo si la región nueva es lateral; null limpia todo', () => {
    const actual: BodyRegionValue = { region: 'MANO', laterality: 'DER' };
    expect(afterSelect('RODILLA', catalog, actual)).toEqual({ region: 'RODILLA', laterality: 'DER' });
    expect(afterSelect('CRANEO', catalog, actual)).toEqual({ region: 'CRANEO', laterality: null });
    expect(afterSelect(null, catalog, actual)).toEqual(EMPTY_BODY_REGION);
  });
});

describe('meshesOf / focusFor', () => {
  const mano = MAPA.regiones['MANO'];
  const rodilla = MAPA.regiones['RODILLA'];

  it('IZQ y DER traen su lado; BIL, UNI y null traen todo; una región no lateral ignora el lado', () => {
    expect(meshesOf(mano, true, 'IZQ')).toEqual(['HAND_L']);
    expect(meshesOf(mano, true, 'DER')).toEqual(['HAND_R']);
    expect(meshesOf(mano, true, 'BIL')).toEqual(['HAND_L', 'HAND_R']);
    expect(meshesOf(mano, true, null)).toEqual(['HAND_L', 'HAND_R']);
    expect(meshesOf(mano, false, 'IZQ')).toEqual(['HAND_L', 'HAND_R']);
    expect(meshesOf(null, true, 'IZQ')).toEqual([]);
  });

  it('una articulación con lado se encuadra por intersección; sin lado, por unión', () => {
    expect(focusFor(rodilla, true, 'IZQ')).toEqual({ mode: 'intersection', groups: [['FEMUR_L'], ['TIBIA_L']] });
    expect(focusFor(rodilla, true, 'BIL')?.mode).toBe('union');
  });

  it('una región sin mallas no encuadra nada', () => {
    expect(focusFor(MAPA.regiones['UTERO'], false, null)).toBeNull();
    expect(focusFor(null, false, null)).toBeNull();
  });
});

describe('layersFor', () => {
  it('la modalidad pone la capa base y la región agrega las suyas', () => {
    expect(layersFor('US', null)).toEqual(['organs']);
    expect(layersFor('XA', null)).toEqual(['vessels']);
    expect(layersFor(null, null)).toEqual(['skeleton']);
    const higado = { ...MAPA.regiones['MANO'], capa: 'organs', capas: ['organs'] } as const;
    expect(layersFor('RX', higado)).toEqual(['skeleton', 'organs']);
    expect(layersFor('RM', higado)).toEqual(['organs']);
  });
});

describe('groupRegions / rootOf', () => {
  it('agrupa por región raíz; la raíz es elegible y las sin modelo lo dicen', () => {
    const grupos = groupRegions(CATALOGO, new Set(), MAPA);
    expect(grupos.map((g) => g.label)).toEqual(['Cabeza', 'Miembro superior', 'Miembro inferior', 'Otras']);
    expect(grupos[0].items.map((i) => i.label)).toEqual(['Cabeza (completa)', 'Cráneo', 'Senos paranasales']);
    expect(grupos[0].items[2].hint).toBe('sin modelo 3D');
    expect(grupos[0].items[1].hint).toBeUndefined();
  });

  it('allowed limita las opciones y no deja grupos vacíos', () => {
    const grupos = groupRegions(CATALOGO, new Set(['MANO']), MAPA);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].items.map((i) => i.value)).toEqual(['MANO']);
  });

  it('sin el mapeo cargado no inventa el aviso de «sin modelo»', () => {
    expect(groupRegions(CATALOGO, new Set(), null).flatMap((g) => g.items).some((i) => i.hint)).toBe(false);
  });

  it('un padre que no está en el catálogo no rompe', () => {
    expect(rootOf('UTERO', catalog)).toBeNull();
  });
});

describe('describeRegion', () => {
  it('dice región y lado, y avisa si no hay modelo', () => {
    const e = catalog.get('MANO')!;
    expect(describeRegion({ region: 'MANO', laterality: 'IZQ' }, e, MAPA.regiones['MANO'], true)).toBe('Región: Mano, izquierda.');
    const senos = catalog.get('SENOS_PARANASALES')!;
    expect(describeRegion({ region: senos.codigo, laterality: null }, senos, MAPA.regiones[senos.codigo], true)).toContain(
      'no tiene modelo 3D propio',
    );
    expect(describeRegion(EMPTY_BODY_REGION, null, null, true)).toBe('Ninguna región elegida.');
  });

  it('el archivo de prueba es coherente con el cliente', () => {
    expect(Object.keys(MAPA.regiones)).toEqual(Object.keys(ARCHIVO.regiones));
  });
});
