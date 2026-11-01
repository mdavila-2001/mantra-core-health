import {
  buildUiElementDrafts,
  declareUiElements,
  resetDeclaredUiElementsForTests,
} from '../../../core/visibility/ui-element-registry';
import { INSURANCE_ANALYTICS_UI, INSURANCE_ANALYTICS_UI_ELEMENTS } from './insurance-analytics.ui-elements';

describe('catálogo de visibilidad de «Siniestralidad y analítica»', () => {
  beforeEach(() => resetDeclaredUiElementsForTests());
  afterEach(() => resetDeclaredUiElementsForTests());

  it('cada clave que usa la plantilla está declarada y cuelga de la pantalla del menú', () => {
    declareUiElements(INSURANCE_ANALYTICS_UI_ELEMENTS);
    const drafts = buildUiElementDrafts(); // lanza si el padre no existe en el catálogo real (el menú)
    const propios = drafts.filter((d) => d.key.startsWith('insurance.analytics.'));
    expect(propios.map((d) => d.key).sort()).toEqual(Object.values(INSURANCE_ANALYTICS_UI).sort());
    for (const d of propios) {
      expect(d.parentKey).toBe('nav.administration.insurance-analytics');
      expect(d.moduleCode).toBe('insurance');
    }
  });
});
