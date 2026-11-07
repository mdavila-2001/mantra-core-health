/* ============================================================================
    International equipment catalog.

    What a center picks in «Agregar equipo» instead of typing maker and model:
    imaging devices and lab analyzers from manufacturers sold in the region.
    Picking one only prefills the form (name, manufacturer, modality); the
    center can still rename it and adds its serial number. No prices: this is
    not a store.

    Modality codes are the ones the API accepts for a device (`CON_TIPO` in the
    form). `null` is an analyzer: it never limits appointments.
    ========================================================================== */

import type { CenterEquipmentInput } from './center-schedule.types';
import { modalidad, type ModalityCode } from './modalidades';

export interface CatalogEquipment {
  readonly id: string;
  readonly manufacturer: string;
  readonly model: string;
  /** Manufacturer's country of origin. */
  readonly country: string;
  /** `null`: lab analyzer, never limits appointments. */
  readonly modalityCode: ModalityCode | null;
  /** What sets it apart, in one line. */
  readonly highlight: string;
}

const e = (
  id: string,
  manufacturer: string,
  model: string,
  country: string,
  modalityCode: ModalityCode | null,
  highlight: string,
): CatalogEquipment => ({ id, manufacturer, model, country, modalityCode, highlight });

export const EQUIPMENT_CATALOG: readonly CatalogEquipment[] = [
  // Ultrasound
  e('ge-voluson-e10', 'GE HealthCare', 'Voluson E10', 'Estados Unidos', 'ECO', 'Obstetricia y ginecología, 3D/4D'),
  e('ge-logiq-e10', 'GE HealthCare', 'LOGIQ E10', 'Estados Unidos', 'ECO', 'Uso general, abdomen y vascular'),
  e('philips-epiq-elite', 'Philips', 'EPIQ Elite', 'Países Bajos', 'ECO', 'Alta gama, uso general y cardiología'),
  e('siemens-acuson-sequoia', 'Siemens Healthineers', 'ACUSON Sequoia', 'Alemania', 'ECO', 'Alta gama, penetración profunda'),
  e('samsung-hera-w10', 'Samsung Medison', 'HERA W10', 'Corea del Sur', 'ECO', 'Obstetricia y ginecología'),
  e('canon-aplio-i800', 'Canon Medical', 'Aplio i800', 'Japón', 'ECO', 'Uso general y elastografía'),
  e('mindray-resona-i9', 'Mindray', 'Resona I9', 'China', 'ECO', 'Uso general, buena relación precio-prestación'),
  e('esaote-mylab-x9', 'Esaote', 'MyLab X9', 'Italia', 'ECO', 'Uso general y musculoesquelético'),

  // X-ray
  e('siemens-multix-impact', 'Siemens Healthineers', 'Multix Impact', 'Alemania', 'RX', 'Radiografía digital de sala'),
  e('philips-digitaldiagnost-c90', 'Philips', 'DigitalDiagnost C90', 'Países Bajos', 'RX', 'Radiografía digital con tubo en techo'),
  e('ge-definium-656', 'GE HealthCare', 'Definium 656 HD', 'Estados Unidos', 'RX', 'Radiografía digital de sala'),
  e('fujifilm-fdr-smart-x', 'Fujifilm', 'FDR Smart X', 'Japón', 'RX', 'Radiografía digital compacta'),
  e('carestream-drx-evolution', 'Carestream', 'DRX-Evolution Plus', 'Estados Unidos', 'RX', 'Radiografía digital de sala'),
  e('shimadzu-radspeed-pro', 'Shimadzu', 'RADspeed Pro', 'Japón', 'RX', 'Radiografía digital de sala'),

  // MRI
  e('siemens-magnetom-vida', 'Siemens Healthineers', 'MAGNETOM Vida', 'Alemania', 'RM', '3 T, túnel de 70 cm'),
  e('siemens-magnetom-altea', 'Siemens Healthineers', 'MAGNETOM Altea', 'Alemania', 'RM', '1,5 T, túnel de 70 cm'),
  e('ge-signa-pioneer', 'GE HealthCare', 'SIGNA Pioneer', 'Estados Unidos', 'RM', '3 T, túnel de 70 cm'),
  e('philips-ingenia-ambition', 'Philips', 'Ingenia Ambition', 'Países Bajos', 'RM', '1,5 T, imán casi sin helio'),
  e('canon-vantage-orian', 'Canon Medical', 'Vantage Orian', 'Japón', 'RM', '1,5 T'),
  e('united-umr-780', 'United Imaging', 'uMR 780', 'China', 'RM', '3 T'),

  // CT
  e('siemens-somatom-go-top', 'Siemens Healthineers', 'SOMATOM go.Top', 'Alemania', 'TC', 'Multicorte, uso general'),
  e('ge-revolution-evo', 'GE HealthCare', 'Revolution EVO', 'Estados Unidos', 'TC', 'Multicorte, uso general'),
  e('philips-incisive-ct', 'Philips', 'Incisive CT', 'Países Bajos', 'TC', 'Multicorte, uso general'),
  e('canon-aquilion-one-prism', 'Canon Medical', 'Aquilion ONE PRISM', 'Japón', 'TC', '320 filas, cardiología'),
  e('united-uct-760', 'United Imaging', 'uCT 760', 'China', 'TC', 'Multicorte, uso general'),

  // Mammography
  e('hologic-selenia-dimensions', 'Hologic', 'Selenia Dimensions', 'Estados Unidos', 'MG', 'Mamografía digital con tomosíntesis 3D'),
  e('hologic-3dimensions', 'Hologic', '3Dimensions', 'Estados Unidos', 'MG', 'Tomosíntesis 3D'),
  e('siemens-mammomat-revelation', 'Siemens Healthineers', 'MAMMOMAT Revelation', 'Alemania', 'MG', 'Tomosíntesis 3D'),
  e('ge-senographe-pristina', 'GE HealthCare', 'Senographe Pristina', 'Estados Unidos', 'MG', 'Tomosíntesis 3D, compresión asistida'),
  e('fujifilm-amulet-innovality', 'Fujifilm', 'AMULET Innovality', 'Japón', 'MG', 'Tomosíntesis 3D'),
  e('ims-giotto-class', 'IMS Giotto', 'Giotto Class', 'Italia', 'MG', 'Tomosíntesis 3D'),

  // Bone densitometry
  e('hologic-horizon', 'Hologic', 'Horizon A', 'Estados Unidos', 'DXA', 'DXA de cuerpo entero'),
  e('ge-lunar-idxa', 'GE HealthCare', 'Lunar iDXA', 'Estados Unidos', 'DXA', 'DXA de cuerpo entero'),
  e('ge-lunar-prodigy', 'GE HealthCare', 'Lunar Prodigy Advance', 'Estados Unidos', 'DXA', 'DXA de columna y cadera'),
  e('dms-stratos-dr', 'DMS Imaging', 'Stratos dR', 'Francia', 'DXA', 'DXA de cuerpo entero'),

  // Lab analyzers (never limit appointments)
  e('sysmex-xn-1000', 'Sysmex', 'XN-1000', 'Japón', null, 'Hematología'),
  e('roche-cobas-c311', 'Roche', 'cobas c 311', 'Suiza', null, 'Química clínica'),
  e('abbott-alinity-ci', 'Abbott', 'Alinity ci', 'Estados Unidos', null, 'Química clínica e inmunoensayo'),
  e('beckman-dxh-900', 'Beckman Coulter', 'DxH 900', 'Estados Unidos', null, 'Hematología'),
  e('mindray-bc-6800', 'Mindray', 'BC-6800 Plus', 'China', null, 'Hematología'),
  e('siemens-atellica-solution', 'Siemens Healthineers', 'Atellica Solution', 'Alemania', null, 'Química clínica e inmunoensayo'),
];

/** Accent- and case-insensitive: «ecografo» finds «Ecógrafo». */
function plain(query: string): string {
  return query.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Devices of a modality (`'ALL'` does not filter, `'ANALYZER'` keeps the
 * `modalityCode: null` ones) whose maker, model, country, highlight or
 * modality name contain every searched word.
 */
export function searchCatalog(
  catalog: readonly CatalogEquipment[],
  filter: ModalityCode | 'ALL' | 'ANALYZER',
  query: string,
  modalityName: (code: ModalityCode | null) => string,
): CatalogEquipment[] {
  const words = plain(query).split(/\s+/).filter((p) => p !== '');
  return catalog.filter((item) => {
    if (filter === 'ANALYZER' && item.modalityCode !== null) return false;
    if (filter !== 'ALL' && filter !== 'ANALYZER' && item.modalityCode !== filter) return false;
    const haystack = plain([item.manufacturer, item.model, item.country, item.highlight, modalityName(item.modalityCode)].join(' '));
    return words.every((p) => haystack.includes(p));
  });
}

/** The form input a pick starts with, named after its type and model: «Mamógrafo Selenia Dimensions». */
export function inputFromCatalog(item: CatalogEquipment): CenterEquipmentInput {
  const kind = item.modalityCode === null ? 'analizador' : modalidad(item.modalityCode).equipmentLabel[0];
  const name = `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${item.model}`;
  return { name, manufacturer: item.manufacturer, serialNumber: null, modalityCode: item.modalityCode };
}
