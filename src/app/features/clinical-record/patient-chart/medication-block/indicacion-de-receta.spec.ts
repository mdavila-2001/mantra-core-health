import { describe, expect, it } from 'vitest';

import { diagnosticoParaReceta, vinculoDeReceta } from './medication-block';

/**
 * Lo que el expediente y «Atención» le pasan al formulario de receta.
 *
 * El defecto: ninguna de las dos pantallas decía qué diagnósticos estaban
 * confirmados, y el formulario —que sólo ofrece confirmados— quedaba siempre
 * en «Otro motivo». Una receta no se podía atar a un diagnóstico registrado.
 */
const CODIGOS: Readonly<Record<string, string>> = {
  'v-confirmado': 'COND_CONFIRMED',
  'v-provisional': 'COND_PROVISIONAL',
  'v-descartado': 'COND_REFUTED',
};
const codigo = (id: string | undefined): string | undefined => (id === undefined ? undefined : CODIGOS[id]);

const decision = (outcome: 'CONFIRMED' | 'REFUTED') => ({
  outcome,
  decidedAt: '2026-03-12T15:00:00.000Z',
  decidedByProfileId: 'pr-1',
  reasonText: 'ECG compatible',
  basedOn: null,
});

describe('diagnosticoParaReceta', () => {
  it('confirmado con la decisión registrada: se ofrece con su fecha', () => {
    const opcion = diagnosticoParaReceta(
      { id: 'c1', verificationStatusConceptId: 'v-confirmado', verification: decision('CONFIRMED') },
      'Hipertensión',
      codigo,
    );
    expect(opcion).toEqual({
      id: 'c1',
      etiqueta: 'Hipertensión',
      confirmado: true,
      confirmadoEl: '2026-03-12T15:00:00.000Z',
    });
  });

  it('confirmado sin registro de la decisión: confirmado, sin fecha inventada', () => {
    const opcion = diagnosticoParaReceta({ id: 'c1', verificationStatusConceptId: 'v-confirmado' }, 'HTA', codigo);
    expect(opcion.confirmado).toBe(true);
    expect(opcion.confirmadoEl).toBeNull();
  });

  it('en estudio o descartado: no se ofrece', () => {
    expect(diagnosticoParaReceta({ id: 'c1', verificationStatusConceptId: 'v-provisional' }, 'X', codigo).confirmado).toBe(false);
    expect(
      diagnosticoParaReceta(
        // La certeza de hoy manda sobre una decisión vieja.
        { id: 'c2', verificationStatusConceptId: 'v-descartado', verification: decision('CONFIRMED') },
        'X',
        codigo,
      ).confirmado,
    ).toBe(false);
  });

  it('sin poder leer el código (catálogo caído), vale la última decisión registrada', () => {
    const sinCatalogo = (): undefined => undefined;
    expect(
      diagnosticoParaReceta({ id: 'c1', verificationStatusConceptId: 'v-x', verification: decision('CONFIRMED') }, 'X', sinCatalogo)
        .confirmado,
    ).toBe(true);
    expect(
      diagnosticoParaReceta({ id: 'c1', verificationStatusConceptId: 'v-x', verification: decision('REFUTED') }, 'X', sinCatalogo)
        .confirmado,
    ).toBe(false);
    expect(diagnosticoParaReceta({ id: 'c1' }, 'X', sinCatalogo).confirmado).toBe(false);
  });

  it('dice «Resuelto» en la etiqueta cuando corresponde', () => {
    const opcion = diagnosticoParaReceta(
      { id: 'c1', verificationStatusConceptId: 'v-confirmado', resolvedAt: new Date(2026, 0, 1) },
      'Faringitis',
      codigo,
    );
    expect(opcion.etiqueta).toBe('Faringitis · Resuelto');
  });
});

describe('vinculoDeReceta', () => {
  const diagnosticos = [{ id: 'c1', etiqueta: 'Hipertensión', confirmado: true, confirmadoEl: null }];

  it('atada a un diagnóstico: su nombre, y marcada como diagnóstico', () => {
    expect(vinculoDeReceta({ indicationConditionId: 'c1' }, diagnosticos)).toEqual({
      vinculo: 'Hipertensión',
      vinculoEsDiagnostico: true,
      indicationConditionId: 'c1',
    });
  });

  it('atada a un diagnóstico que quedó fuera de la lectura: lo dice, no lo calla', () => {
    expect(vinculoDeReceta({ indicationConditionId: 'c9' }, diagnosticos).vinculo).toBe('Diagnóstico de la historia');
  });

  it('con el motivo escrito a mano: el motivo, y no es un diagnóstico', () => {
    expect(vinculoDeReceta({ indicationText: ' Control sintomático ' }, diagnosticos)).toEqual({
      vinculo: 'Control sintomático',
      vinculoEsDiagnostico: false,
      indicationConditionId: null,
    });
  });

  it('sin nada: sin vínculo', () => {
    expect(vinculoDeReceta({}, diagnosticos).vinculo).toBeNull();
  });
});
