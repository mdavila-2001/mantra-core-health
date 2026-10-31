import type { BodyRegionCatalogEntry } from '../../../../../core/data-access/anatomy-atlas/body-regions.types';
import type { ContrastOption, ImagingModalityOption, ImagingStudyOption } from './imaging-study-picker.logic';

/** Catálogo recortado para las pruebas (no se usa en producción). */
export const MODALITIES: readonly ImagingModalityOption[] = [
  { codigo: 'RX', nombre: 'Radiografía simple', conceptId: 'm-rx' },
  { codigo: 'TC', nombre: 'Tomografía computarizada', conceptId: 'm-tc' },
  { codigo: 'RM', nombre: 'Resonancia magnética', conceptId: 'm-rm' },
];

export const REGIONS: readonly BodyRegionCatalogEntry[] = [
  { codigo: 'TORAX', nombre: 'Tórax', padre: null, tipo: 'grupo', admite_lateralidad: false },
  { codigo: 'PULMONES', nombre: 'Pulmones', padre: 'TORAX', admite_lateralidad: false },
  { codigo: 'COSTILLAS', nombre: 'Costillas', padre: 'TORAX', admite_lateralidad: true },
  { codigo: 'MIEMBRO_SUPERIOR', nombre: 'Miembro superior', padre: null, tipo: 'grupo', admite_lateralidad: true },
  { codigo: 'MANO', nombre: 'Mano', padre: 'MIEMBRO_SUPERIOR', admite_lateralidad: true },
  { codigo: 'CABEZA', nombre: 'Cabeza', padre: null, tipo: 'grupo', admite_lateralidad: false },
  { codigo: 'CRANEO', nombre: 'Cráneo', padre: 'CABEZA', admite_lateralidad: false },
];

export const REGION_CONCEPTS: Readonly<Record<string, string>> = {
  TORAX: 'r-torax',
  PULMONES: 'r-pulmones',
  COSTILLAS: 'r-costillas',
  MANO: 'r-mano',
  CRANEO: 'r-craneo',
};

export const LATERALITY_CONCEPTS: Readonly<Record<string, string>> = {
  IZQ: 'l-izq',
  DER: 'l-der',
  BIL: 'l-bil',
  UNI: 'l-uni',
};

export const CONTRAST: readonly ContrastOption[] = [
  { conceptId: 'c-sin', label: 'Sin contraste', isDefault: true },
  { conceptId: 'c-con', label: 'Con contraste', isDefault: false },
  { conceptId: 'c-ambos', label: 'Sin y con contraste', isDefault: false },
];

const base = { sinonimos: [], proyecciones: [], preparacion: null, requiereLateralidad: false, viaContraste: null } as const;

export const RX_TORAX: ImagingStudyOption = {
  ...base,
  conceptId: 's-rx-torax',
  codigo: 'RX_TORAX_PA_LAT',
  nombre: 'Radiografía de tórax PA y lateral',
  sinonimos: ['Placa de tórax', 'Rx tórax'],
  proyecciones: ['PA', 'LAT'],
  modalidad: 'RX',
  region: 'TORAX',
  contraste: 'sin',
};

export const RX_MANO: ImagingStudyOption = {
  ...base,
  conceptId: 's-rx-mano',
  codigo: 'RX_MANO',
  nombre: 'Radiografía de mano',
  proyecciones: ['AP', 'Oblicua'],
  modalidad: 'RX',
  region: 'MANO',
  requiereLateralidad: true,
  contraste: 'sin',
};

export const TC_CRANEO: ImagingStudyOption = {
  ...base,
  conceptId: 's-tc-craneo',
  codigo: 'TC_CRANEO_SIN_CON',
  nombre: 'TC de cráneo sin y con contraste IV',
  sinonimos: ['TAC de cráneo', 'Tomografía cerebral'],
  modalidad: 'TC',
  region: 'CRANEO',
  contraste: 'sin_y_con',
  viaContraste: 'IV',
  preparacion: 'Ayuno de 4 h. Traer creatinina reciente.',
};

export const RM_TORAX: ImagingStudyOption = {
  ...base,
  conceptId: 's-rm-torax',
  codigo: 'RM_TORAX',
  nombre: 'Resonancia de tórax',
  modalidad: 'RM',
  region: 'TORAX',
  contraste: 'opcional',
};

/** Exige lado en una región que no lo ofrece (caso real: eco guiada de toracocentesis). */
export const ECO_TORACOCENTESIS: ImagingStudyOption = {
  ...base,
  conceptId: 's-eco-toraco',
  codigo: 'ECO_GUIA_TORACOCENTESIS',
  nombre: 'Estudio guiado de toracocentesis',
  modalidad: 'RX',
  region: 'PULMONES',
  requiereLateralidad: true,
  contraste: 'sin',
};

export const STUDIES: readonly ImagingStudyOption[] = [RX_TORAX, RX_MANO, TC_CRANEO, RM_TORAX, ECO_TORACOCENTESIS];

/** Catálogo sintético del tamaño real: 475 estudios en las 3 modalidades. */
export function bigStudies(n = 475): readonly ImagingStudyOption[] {
  return Array.from({ length: n }, (_, i) => ({
    ...base,
    conceptId: `s-${i}`,
    codigo: `EST_${i}`,
    nombre: `Estudio número ${i}`,
    modalidad: MODALITIES[i % 3]!.codigo,
    region: 'TORAX',
    contraste: 'sin' as const,
  }));
}
