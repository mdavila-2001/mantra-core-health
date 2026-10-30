import type {
  GlossaryNeighbor,
  GlossaryNeighborhood,
} from '../../core/data-access/terminology/terminology.types';
import { compareNeighborhoods } from './glossary-compare.logic';

const sintoma = { internalCode: 'glossary-category-signs-symptoms', name: 'Signos y síntomas' };
const estudio = { internalCode: 'glossary-category-lab', name: 'Laboratorio' };
const enfermedad = { internalCode: 'glossary-category-disease', name: 'Enfermedades' };

const v = (id: string, category: GlossaryNeighbor['category'], extra: Partial<GlossaryNeighbor> = {}): GlossaryNeighbor => ({
  conceptId: id,
  slug: id,
  display: id,
  category,
  ...extra,
});

function vecindario(id: string, groups: GlossaryNeighborhood['groups']): GlossaryNeighborhood {
  return { focus: { conceptId: id, slug: id, display: id, category: enfermedad, shortDefinition: '' }, groups };
}

const A = vecindario('Neumonía', [
  {
    type: 'SYMPTOM',
    direction: 'outgoing',
    total: 3,
    items: [v('Fiebre', sintoma, { strength: 0.9 }), v('Tos', sintoma, { strength: 0.7 }), v('Dolor torácico', sintoma)],
  },
  { type: 'DIAGNOSTIC_CRITERION', direction: 'outgoing', total: 1, items: [v('Crepitantes', sintoma)] },
  { type: 'REQUIRED_TEST', direction: 'outgoing', total: 2, items: [v('Radiografía de tórax', estudio), v('Hemograma', estudio)] },
  { type: 'RELATED_TERM', direction: 'outgoing', total: 1, items: [v('Bronquitis', enfermedad)] },
]);

const B = vecindario('Bronquitis', [
  {
    type: 'SYMPTOM',
    direction: 'outgoing',
    total: 3,
    items: [v('Tos', sintoma, { strength: 0.95 }), v('Sibilancias', sintoma), v('Fiebre', sintoma, { strength: 0.4 })],
  },
  { type: 'DIAGNOSTIC_TEST', direction: 'outgoing', total: 1, items: [v('Hemograma', estudio)] },
  { type: 'RELATED_TERM', direction: 'outgoing', total: 1, items: [v('Neumonía', enfermedad)] },
]);

describe('compareNeighborhoods', () => {
  it('separa los hallazgos compartidos de los propios de cada lado', () => {
    const { findings } = compareNeighborhoods(A, B);

    expect(findings.shared.map((s) => s.display)).toEqual(['Tos', 'Fiebre']);
    expect(findings.onlyA.map((n) => n.display)).toEqual(['Crepitantes', 'Dolor torácico']);
    expect(findings.onlyB.map((n) => n.display)).toEqual(['Sibilancias']);
  });

  it('cada hallazgo compartido conserva la evidencia de cada lado', () => {
    const fiebre = compareNeighborhoods(A, B).findings.shared.find((s) => s.conceptId === 'Fiebre');
    expect(fiebre?.inA.strength).toBe(0.9);
    expect(fiebre?.inB.strength).toBe(0.4);
  });

  it('los estudios que discriminan son los que pide uno solo; los comunes quedan aparte', () => {
    const { studies } = compareNeighborhoods(A, B);

    expect(studies.onlyA.map((n) => n.display)).toEqual(['Radiografía de tórax']);
    expect(studies.onlyB).toEqual([]);
    expect(studies.shared.map((s) => s.display)).toEqual(['Hemograma']);
  });

  it('los dos términos comparados no aparecen como hallazgo ni estudio del otro', () => {
    const { findings, studies } = compareNeighborhoods(A, B);
    const todos = [...findings.onlyA, ...findings.onlyB, ...studies.onlyA, ...studies.onlyB].map((n) => n.conceptId);
    expect(todos).not.toContain('Neumonía');
    expect(todos).not.toContain('Bronquitis');
  });

  it('avisa si algún grupo llegó recortado', () => {
    expect(compareNeighborhoods(A, B).truncated).toBe(false);
    const recortado = vecindario('X', [{ type: 'SYMPTOM', direction: 'outgoing', total: 120, items: [v('Tos', sintoma)] }]);
    expect(compareNeighborhoods(A, recortado).truncated).toBe(true);
  });
});
