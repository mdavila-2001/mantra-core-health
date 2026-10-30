import type { GlossaryNeighbor } from '@core/data-access/terminology/terminology.types';
import { compareNeighbors, neighborEvidenceView } from './relation-evidence.logic';

const neighbor = (display: string, extra: Partial<GlossaryNeighbor> = {}): GlossaryNeighbor => ({
  conceptId: display,
  slug: display.toLowerCase(),
  display,
  category: null,
  ...extra,
});

describe('neighborEvidenceView', () => {
  it('devuelve null si la relación no trae evidencia (contrato anterior a F1)', () => {
    expect(neighborEvidenceView(neighbor('Neumonía'))).toBeNull();
  });

  it('dice la fuerza con barra, frecuencia en palabras y sello de la fuente', () => {
    expect(
      neighborEvidenceView(
        neighbor('Neumonía', { strength: 0.85, frequency: 'VERY_FREQUENT', evidenceTier: 'NATIONAL_STANDARD' }),
      ),
    ).toEqual({
      strengthPercent: 85,
      frequencyLabel: 'Muy frecuente',
      tierLabel: 'Norma nacional',
      tierDescription: 'Nivel 1 de 4, el más alto. La relación consta en una norma nacional.',
      excluded: false,
    });
  });

  it('un hallazgo descartado no lleva barra: no es una relación positiva débil', () => {
    const view = neighborEvidenceView(neighbor('Fiebre', { strength: 0.9, frequency: 'EXCLUDED' }));
    expect(view?.strengthPercent).toBeNull();
    expect(view?.frequencyLabel).toBe('La fuente lo descarta');
    expect(view?.excluded).toBe(true);
  });

  it('acota la barra entre 0 y 100', () => {
    expect(neighborEvidenceView(neighbor('A', { strength: 1.4 }))?.strengthPercent).toBe(100);
    expect(neighborEvidenceView(neighbor('A', { strength: -0.2 }))?.strengthPercent).toBe(0);
  });

  it('sólo con nivel de evidencia muestra el sello sin barra', () => {
    expect(neighborEvidenceView(neighbor('A', { evidenceTier: 'STATISTICAL_LITERATURE' }))).toEqual({
      strengthPercent: null,
      frequencyLabel: null,
      tierLabel: 'Bibliografía estadística',
      tierDescription: expect.stringContaining('Nivel 4 de 4'),
      excluded: false,
    });
  });

  it('el globo del sello agrega las fuentes que trae la relación', () => {
    const view = neighborEvidenceView(
      neighbor('A', { evidenceTier: 'CURATED_REFERENCE', sourceCodes: ['FUENTE-A', 'FUENTE-B'] }),
    );
    expect(view?.tierDescription).toMatch(/^Nivel 2 de 4\..* Fuentes: FUENTE-A, FUENTE-B\.$/);
  });
});

describe('compareNeighbors', () => {
  it('ordena por fuerza descendente, sin fuerza al final y luego por nombre', () => {
    const sorted = [
      neighbor('Bronquitis'),
      neighbor('Asma', { strength: 0.3 }),
      neighbor('Neumonía', { strength: 0.9 }),
      neighbor('Anemia'),
    ].sort(compareNeighbors);
    expect(sorted.map((n) => n.display)).toEqual(['Neumonía', 'Asma', 'Anemia', 'Bronquitis']);
  });

  it('sin evidencia el orden es el alfabético de siempre', () => {
    const sorted = [neighbor('Úlcera'), neighbor('Absceso'), neighbor('Edema')].sort(compareNeighbors);
    expect(sorted.map((n) => n.display)).toEqual(['Absceso', 'Edema', 'Úlcera']);
  });
});
