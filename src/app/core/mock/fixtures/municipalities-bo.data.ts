/* Bolivia's municipalities seeded in the mock (`VS_BO_MUNICIPALITY`, `concepts.ts`). */

export const MUNICIPIOS_BO: readonly (readonly [code: string, display: string])[] = [
  ['SC-SCZ', 'Santa Cruz de la Sierra'],
  ['SC-MON', 'Montero'],
  ['SC-WAR', 'Warnes'],
  ['SC-COT', 'Cotoca'],
  ['SC-LGD', 'La Guardia'],
  // Con el código del catálogo real (`03_terminology.seeds.json`): los traen
  // los consultorios de la red de Nacional Seguros en la frontera con Brasil.
  ['SC-PUERTO_SUAREZ', 'Puerto Suárez'],
  ['SC-PUERTO_QUIJARRO', 'Puerto Quijarro'],
  ['LP-LPZ', 'La Paz'],
  ['LP-ELA', 'El Alto'],
  ['LP-VIA', 'Viacha'],
  ['CB-CBB', 'Cochabamba'],
  ['CB-QUI', 'Quillacollo'],
  ['CB-SAC', 'Sacaba'],
  ['OR-ORU', 'Oruro'],
  ['PT-PTS', 'Potosí'],
  ['CH-SRE', 'Sucre'],
  ['TJ-TJA', 'Tarija'],
  ['BE-TRI', 'Trinidad'],
  ['PD-COB', 'Cobija'],
];
