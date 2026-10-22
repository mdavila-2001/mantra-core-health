import type {
  GlossaryNeighbor,
  GlossaryNeighborGroup,
  GlossaryNeighborhood,
} from '../../core/data-access/terminology/terminology.types';
import { buildClinicalRoute, mergeFullGroups } from './glossary-clinical-route';

const categoria = (key: string, name: string) => ({ internalCode: `glossary-category-${key}`, name });
const SINTOMA = categoria('signs-symptoms', 'Signos y síntomas');
const ENFERMEDAD = categoria('disease', 'Enfermedades');
const ESTUDIO = categoria('diagnostic-test', 'Pruebas diagnósticas');
const FARMACO = categoria('pharmacology', 'Farmacología');
const ESPECIALIDAD = categoria('specialty', 'Especialidades');
const OTRO = categoria('other', 'Otro');

const vecino = (id: string, display: string, category: GlossaryNeighbor['category']): GlossaryNeighbor => ({
  conceptId: id,
  slug: id,
  display,
  category,
});

function vecindario(
  focusCategory: GlossaryNeighbor['category'],
  groups: readonly GlossaryNeighborGroup[],
): GlossaryNeighborhood {
  return {
    focus: { conceptId: 'foco', slug: 'foco', display: 'Foco', category: focusCategory, shortDefinition: '' },
    groups,
  };
}

describe('buildClinicalRoute', () => {
  it('reparte una enfermedad en lo que se observa, lo que sigue y el contexto', () => {
    const ruta = buildClinicalRoute(
      vecindario(ENFERMEDAD, [
        { type: 'SYMPTOM', direction: 'outgoing', total: 2, items: [vecino('s2', 'Tos', SINTOMA), vecino('s1', 'Fiebre', SINTOMA)] },
        { type: 'DIAGNOSTIC_TEST', direction: 'outgoing', total: 1, items: [vecino('t1', 'Radiografía de tórax', ESTUDIO)] },
        { type: 'TREATMENT', direction: 'outgoing', total: 1, items: [vecino('f1', 'Amoxicilina', FARMACO)] },
        { type: 'SPECIALTY', direction: 'outgoing', total: 1, items: [vecino('e1', 'Neumología', ESPECIALIDAD)] },
        { type: 'DISEASE', direction: 'outgoing', total: 1, items: [vecino('d1', 'Bronquitis', ENFERMEDAD)] },
      ]),
    );

    expect(ruta.findings.map((c) => c.title)).toEqual(['Síntomas y signos']);
    expect(ruta.findings[0]?.items.map((i) => i.display)).toEqual(['Fiebre', 'Tos']);
    expect(ruta.next.map((c) => c.title)).toEqual(['Estudios', 'Tratamientos', 'Especialidades']);
    expect(ruta.context.map((c) => c.title)).toEqual(['Enfermedades relacionadas']);
    expect(ruta.neighborCount).toBe(6);
  });

  it('en un síntoma, las enfermedades que lo presentan van a «lo que sigue», una sola vez', () => {
    // El corpus guarda la misma relación en los dos sentidos con tipos distintos.
    const neumonia = vecino('d1', 'Neumonía', ENFERMEDAD);
    const ruta = buildClinicalRoute(
      vecindario(SINTOMA, [
        { type: 'DISEASE', direction: 'outgoing', total: 1, items: [neumonia] },
        { type: 'SYMPTOM', direction: 'incoming', total: 1, items: [neumonia] },
      ]),
    );

    expect(ruta.next).toHaveLength(1);
    expect(ruta.next[0]?.title).toBe('Enfermedades que lo presentan');
    expect(ruta.next[0]?.items).toEqual([neumonia]);
    expect(ruta.next[0]?.sources).toHaveLength(2);
    expect(ruta.neighborCount).toBe(1);
  });

  it('un término relacionado que ya está en una columna tipada no se repite abajo', () => {
    const tos = vecino('s1', 'Tos', SINTOMA);
    const ruta = buildClinicalRoute(
      vecindario(ENFERMEDAD, [
        { type: 'RELATED_TERM', direction: 'outgoing', total: 2, items: [tos, vecino('r1', 'Vacunas', OTRO)] },
        { type: 'SYMPTOM', direction: 'outgoing', total: 1, items: [tos] },
      ]),
    );

    expect(ruta.findings[0]?.items).toEqual([tos]);
    expect(ruta.context.map((c) => c.title)).toEqual(['Términos relacionados']);
    expect(ruta.context[0]?.items.map((i) => i.display)).toEqual(['Vacunas']);
  });

  it('sin categoría útil decide el tipo y el sentido de la relación', () => {
    const ruta = buildClinicalRoute(
      vecindario(FARMACO, [
        { type: 'TREATMENT', direction: 'incoming', total: 1, items: [vecino('d1', 'Gripe', OTRO)] },
      ]),
    );

    expect(ruta.next[0]?.key).toBe('diseases');
    expect(ruta.next[0]?.title).toBe('Se usa en');
  });

  it('marca incompleta la columna de un grupo que vino recortado', () => {
    const ruta = buildClinicalRoute(
      vecindario(ESPECIALIDAD, [
        { type: 'DISEASE', direction: 'outgoing', total: 187, items: [vecino('d1', 'Arritmia', ENFERMEDAD)] },
      ]),
    );

    expect(ruta.next[0]?.title).toBe('Enfermedades que atiende');
    expect(ruta.next[0]?.complete).toBe(false);
  });

  it('nunca pone al término central entre sus propios vecinos', () => {
    const ruta = buildClinicalRoute(
      vecindario(ENFERMEDAD, [
        { type: 'DISEASE', direction: 'incoming', total: 1, items: [vecino('foco', 'Foco', ENFERMEDAD)] },
      ]),
    );

    expect(ruta.neighborCount).toBe(0);
    expect([...ruta.findings, ...ruta.next, ...ruta.context]).toHaveLength(0);
  });
});

describe('mergeFullGroups', () => {
  it('el grupo entero pisa a su muestra y deja los demás como estaban', () => {
    const base = vecindario(ESPECIALIDAD, [
      { type: 'DISEASE', direction: 'outgoing', total: 3, items: [vecino('d1', 'A', ENFERMEDAD)] },
      { type: 'RELATED_TERM', direction: 'outgoing', total: 1, items: [vecino('r1', 'R', OTRO)] },
    ]);
    const entero: GlossaryNeighborGroup = {
      type: 'DISEASE',
      direction: 'outgoing',
      total: 3,
      items: [vecino('d1', 'A', ENFERMEDAD), vecino('d2', 'B', ENFERMEDAD), vecino('d3', 'C', ENFERMEDAD)],
    };

    const fusionado = mergeFullGroups(base, [entero]);

    expect(fusionado.groups[0]).toBe(entero);
    expect(fusionado.groups[1]).toBe(base.groups[1]);
    expect(buildClinicalRoute(fusionado).next[0]?.complete).toBe(true);
  });
});
