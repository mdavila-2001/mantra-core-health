/* Literal catalogs of the diagnostics mock (`diagnostics.handlers.ts`): the seeded reports' conclusions and each study's imaging modality. */

export const CONCLUSIONES: Readonly<Record<string, string>> = {
  'Hemograma completo': 'Hemoglobina 13,8 g/dL, leucocitos 6.400/µL, plaquetas 245.000/µL. Sin alteraciones.',
  'Perfil lipídico': 'Colesterol total 212 mg/dL, LDL 138 mg/dL, HDL 48 mg/dL, triglicéridos 160 mg/dL. LDL por encima de la meta.',
  Electrocardiograma: 'Ritmo sinusal a 72 lpm, eje normal, sin alteraciones de la repolarización.',
  'Glucosa en ayunas': 'Glucemia 96 mg/dL. Normal.',
  TSH: 'TSH 3,1 mUI/L. Normal.',
  'Ecografía abdominal': 'Hígado de tamaño y ecogenicidad conservados. Vesícula sin litiasis. Riñones normales.',
};

export const MODALIDAD_DE_ESTUDIO: Readonly<Record<string, readonly [code: string, display: string]>> = {
  'STUDY-RX-TORAX': ['CR', 'Radiografía'],
  'STUDY-RX-COLUMNA': ['CR', 'Radiografía'],
  'STUDY-ECO-ABD': ['US', 'Ecografía'],
  'STUDY-ECO-OBSTETRICA': ['US', 'Ecografía'],
  'STUDY-ECG': ['ECG', 'Electrocardiografía'],
  'STUDY-RMN-RODILLA': ['MR', 'Resonancia magnética'],
  'STUDY-RMN-CEREBRO': ['MR', 'Resonancia magnética'],
  'STUDY-TAC-CRANEO': ['CT', 'Tomografía computarizada'],
  'STUDY-TAC-ABDOMEN': ['CT', 'Tomografía computarizada'],
  'STUDY-MAMOGRAFIA': ['MG', 'Mamografía'],
  'STUDY-DENSITOMETRIA': ['BMD', 'Densitometría ósea'],
};
