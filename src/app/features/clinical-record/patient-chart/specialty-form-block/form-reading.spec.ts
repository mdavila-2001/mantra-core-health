import type { ChartTemplate } from '../../../../core/data-access/chart-templates/chart-templates.types';
import type { FormInstanceDetail } from '../../../../core/data-access/forms/forms.types';
import { templateByCoverage } from './form-reading';

function plantilla(id: string, campos: readonly string[]): ChartTemplate {
  return {
    id,
    name: id,
    fields: campos.map((fieldId) => ({ fieldId, name: fieldId })),
  } as unknown as ChartTemplate;
}

function respuesta(campos: readonly string[]): FormInstanceDetail {
  return {
    id: 'fi-1',
    createdAt: '2026-10-03T10:00:00.000Z',
    values: campos.map((fieldId, i) => ({ id: `v-${i}`, fieldId, ordinal: i, masked: false })),
  } as unknown as FormInstanceDetail;
}

describe('plantillaPorCobertura', () => {
  const anamnesis = plantilla('anamnesis', ['motivo', 'antecedentes']);
  const cardiologica = plantilla('cardiologica', ['motivo', 'antecedentes', 'soplo', 'ecg']);

  it('con sólo los campos base, gana la ficha más chica que los contiene', () => {
    // Antes ganaba la primera con más coincidencias: la cardiológica, que
    // trae esos mismos campos y más, se llevaba la anamnesis.
    expect(templateByCoverage(respuesta(['motivo', 'antecedentes']), [cardiologica, anamnesis])).toBe(
      anamnesis,
    );
  });

  it('un campo propio de una ficha la delata', () => {
    expect(templateByCoverage(respuesta(['motivo', 'soplo']), [anamnesis, cardiologica])).toBe(
      cardiologica,
    );
  });

  it('si ninguna los contiene a todos, la que más contiene', () => {
    expect(templateByCoverage(respuesta(['motivo', 'soplo', 'ajeno']), [anamnesis, cardiologica])).toBe(
      cardiologica,
    );
  });

  it('sin coincidencias no inventa una plantilla', () => {
    expect(templateByCoverage(respuesta(['ajeno']), [anamnesis, cardiologica])).toBeNull();
  });
});
