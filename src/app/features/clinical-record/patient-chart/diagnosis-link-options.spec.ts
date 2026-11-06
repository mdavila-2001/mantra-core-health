import { describe, expect, it } from 'vitest';

import { diagnosisLinkOptions, replacementOptions } from './diagnosis-link-options';

const DIAGNOSTICOS = [
  { id: 'propio', etiqueta: 'Angina', confirmado: false },
  { id: 'erge', etiqueta: 'ERGE', confirmado: true },
  { id: 'ansiedad', etiqueta: 'Ansiedad', confirmado: false },
  { id: 'anemia', etiqueta: 'Anemia', confirmado: true, descartado: true },
];

describe('diagnosisLinkOptions', () => {
  it('ofrece confirmados y en estudio, nunca descartados (el «para qué» de un estudio)', () => {
    expect(diagnosisLinkOptions(DIAGNOSTICOS).map((o) => o.label)).toEqual([
      'Angina · En estudio',
      'ERGE · Confirmado',
      'Ansiedad · En estudio',
    ]);
  });
});

describe('replacementOptions', () => {
  it('«Se confirmó en su lugar» sólo ofrece confirmados, sin el propio ni los descartados', () => {
    expect(replacementOptions(DIAGNOSTICOS, 'propio')).toEqual([{ value: 'erge', label: 'ERGE · Confirmado' }]);
    expect(replacementOptions(DIAGNOSTICOS, 'erge')).toEqual([]);
  });
});
