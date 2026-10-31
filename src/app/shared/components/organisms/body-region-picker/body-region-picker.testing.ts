import type { AnatomyPart } from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.types';
import { expandBodyRegions } from '../../../../core/data-access/anatomy-atlas/body-regions.client';
import type {
  BodyRegionCatalogEntry,
  BodyRegionRaw,
  BodyRegionsFile,
} from '../../../../core/data-access/anatomy-atlas/body-regions.types';

/** Un recorte del catálogo y del mapeo, con lo justo para probar el picker. Sólo para specs. */
export const CATALOGO: readonly BodyRegionCatalogEntry[] = [
  { codigo: 'CABEZA', nombre: 'Cabeza', padre: null, tipo: 'grupo', admite_lateralidad: false },
  { codigo: 'CRANEO', nombre: 'Cráneo', padre: 'CABEZA', admite_lateralidad: false },
  { codigo: 'SENOS_PARANASALES', nombre: 'Senos paranasales', padre: 'CABEZA', admite_lateralidad: false },
  { codigo: 'MIEMBRO_SUPERIOR', nombre: 'Miembro superior', padre: null, tipo: 'grupo', admite_lateralidad: true },
  { codigo: 'MANO', nombre: 'Mano', padre: 'MIEMBRO_SUPERIOR', admite_lateralidad: true },
  { codigo: 'MIEMBRO_INFERIOR', nombre: 'Miembro inferior', padre: null, tipo: 'grupo', admite_lateralidad: true },
  { codigo: 'RODILLA', nombre: 'Rodilla', padre: 'MIEMBRO_INFERIOR', admite_lateralidad: true },
  { codigo: 'UTERO', nombre: 'Útero', padre: 'PELVIS_X', admite_lateralidad: false },
];

const base = { tipo: 'propia', capa: 'skeleton', capas: ['skeleton'] } as const;
const REGIONES: Record<string, BodyRegionRaw> = {
  CABEZA: { ...base, tocar: 'solo_select', izq: [], der: [], centro: [0] },
  CRANEO: { ...base, tocar: 'malla', izq: [], der: [], centro: [0] },
  SENOS_PARANASALES: { ...base, tipo: 'contenedora', tocar: 'solo_select', izq: [], der: [], centro: [0] },
  MIEMBRO_SUPERIOR: { ...base, tocar: 'solo_select', izq: [1, 3], der: [2, 4], centro: [] },
  MANO: { ...base, tocar: 'malla', izq: [1], der: [2], centro: [] },
  MIEMBRO_INFERIOR: { ...base, tocar: 'solo_select', izq: [3, 5], der: [4, 6], centro: [] },
  // Fémur (3/4) y tibia (5/6): la rodilla es donde se cruzan. Caja del lado izquierdo en y ≈ 0.
  RODILLA: {
    ...base,
    tocar: 'punto',
    izq: [3, 5],
    der: [4, 6],
    centro: [],
    encuadre: {
      modo: 'interseccion',
      izq: [[3], [5]],
      der: [[4], [6]],
      caja: { izq: [0.05, -0.002, -0.03, 0.12, 0.002, 0.03], der: [-0.12, -0.002, -0.03, -0.05, 0.002, 0.03] },
    },
  },
  UTERO: { ...base, tipo: 'ninguna', tocar: 'solo_select', izq: [], der: [], centro: [] },
};

export const ARCHIVO: BodyRegionsFile = {
  version: 1,
  catalogo: 'test',
  mallas: ['SKULL', 'HAND_L', 'HAND_R', 'FEMUR_L', 'FEMUR_R', 'TIBIA_L', 'TIBIA_R'],
  regiones: REGIONES,
  toque: { CRANEO: [0], MANO: [1, 2], MIEMBRO_INFERIOR: [3, 4, 5, 6] },
};

export const MAPA = expandBodyRegions(ARCHIVO);

const parte = (meshId: string, side: AnatomyPart['side']): AnatomyPart => ({
  meshId,
  layer: 'skeleton',
  sex: 'shared',
  structureId: `UBERON:${meshId}`,
  shard: 0,
  side,
  labelEn: meshId.toLowerCase(),
  match: 'fma_exact',
});

export const PARTES: readonly AnatomyPart[] = [
  parte('SKULL', null),
  parte('HAND_L', 'left'),
  parte('HAND_R', 'right'),
  parte('FEMUR_L', 'left'),
  parte('FEMUR_R', 'right'),
  parte('TIBIA_L', 'left'),
  parte('TIBIA_R', 'right'),
];
