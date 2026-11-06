import { describe, expect, it } from 'vitest';

import type {
  PractitionerDiagnosticResult,
  PractitionerResultValue,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import { resultadoDelInforme, valorDelInforme } from './red-clinica-informe';
import { estaFueraDeRango, leerValor } from './red-clinica-valores';

const valor = (extra: Partial<PractitionerResultValue> = {}): PractitionerResultValue => ({
  observationId: 'o-1',
  codeConceptId: 'c-tsh',
  name: 'TSH',
  value: '8.9',
  valueKind: 'QUANTITY',
  valueConceptId: null,
  unitConceptId: null,
  unit: 'mUI/L',
  referenceRange: { low: '0.4', high: '4.0', text: null, unitConceptId: null, unit: 'mUI/L' },
  interpretationConceptId: 'i-h',
  interpretationCode: 'H',
  interpretation: 'Alto',
  statusConceptId: 'st',
  effectiveAt: null,
  ...extra,
});

describe('valorDelInforme', () => {
  it('un numérico pasa a número y se compara con el rango; el rótulo del laboratorio va tal cual', () => {
    const v = valorDelInforme(valor());
    expect(v).toEqual({ nombre: 'TSH', valor: 8.9, unidad: 'mUI/L', rango: { bajo: 0.4, alto: 4 }, interpretacionDelInforme: 'Alto' });
    // El código «H» no se traduce: lo que marca «fuera» es el número contra el rango.
    expect(v.interpretacion).toBeUndefined();
    expect(leerValor(v)).toBe('alto');
    expect(estaFueraDeRango(v)).toBe(true);
  });

  it('dentro del rango no se marca, aunque traiga rótulo', () => {
    const v = valorDelInforme(valor({ value: '2.1', interpretation: 'Normal', interpretationCode: 'N' }));
    expect(estaFueraDeRango(v)).toBe(false);
    expect(v.interpretacionDelInforme).toBe('Normal');
  });

  it('un texto queda texto, con su rango impreso, y no se compara', () => {
    const v = valorDelInforme(
      valor({ value: 'Más de 100.000 UFC/mL', valueKind: 'TEXT', unit: null, referenceRange: { low: null, high: null, text: 'Menos de 10.000 UFC/mL', unitConceptId: null, unit: null }, interpretation: 'Anormal' }),
    );
    expect(v.valor).toBe('Más de 100.000 UFC/mL');
    expect(v.rango).toEqual({ texto: 'Menos de 10.000 UFC/mL' });
    expect(leerValor(v)).toBe('sin-referencia');
  });

  it('booleanos en palabras; sin nombre ni valor, lo dice', () => {
    expect(valorDelInforme(valor({ value: 'true', valueKind: 'BOOLEAN', referenceRange: null })).valor).toBe('Sí');
    const vacio = valorDelInforme(valor({ name: null, value: null, interpretation: null, referenceRange: null, unit: null }));
    expect(vacio).toEqual({ nombre: 'Valor sin nombre', valor: 'Sin valor' });
  });
});

describe('resultadoDelInforme', () => {
  const informe: PractitionerDiagnosticResult = {
    reportId: 'dr-1',
    patientProfileId: 'p-1',
    serviceRequestId: 'sr-1',
    codeConceptId: 'c',
    codeDisplay: 'TSH',
    categoryConceptId: null,
    versionId: 'v',
    versionNumber: 1,
    clinicalStatusConceptId: 'st',
    issuedAt: null,
    releasedAt: new Date('2026-08-16T16:00:00Z'),
    patientVisible: false,
    conclusionText: '  ',
    values: [valor()],
    files: [
      { id: 'b', fileId: 'f-2', name: null, contentRoleConceptId: 'r', presentationFormatConceptId: null, ordinal: 2 },
      { id: 'a', fileId: 'f-1', name: 'Informe.pdf', contentRoleConceptId: 'r', presentationFormatConceptId: null, ordinal: 1 },
    ],
  };

  it('fecha de liberación real, sin conclusión vacía, archivos en orden y si se publicó al paciente', () => {
    const r = resultadoDelInforme(informe);
    expect(r.liberadoEn).toEqual(new Date('2026-08-16T16:00:00Z'));
    expect(r.conclusion).toBeUndefined();
    expect(r.archivos).toEqual([
      { fileId: 'f-1', nombre: 'Informe.pdf' },
      { fileId: 'f-2', nombre: 'Informe 2.pdf' },
    ]);
    expect(r.informeId).toBe('dr-1');
    expect(r.publicadoAlPaciente).toBe(false);
    expect(r.valores).toHaveLength(1);
  });
});
