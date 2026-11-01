import {
  buildUiElementDrafts,
  declareUiElements,
  resetDeclaredUiElementsForTests,
} from '../../core/visibility/ui-element-registry';
import { DASHBOARD_UI, DASHBOARD_UI_ELEMENTS } from './dashboard.ui-elements';

describe('catálogo de visibilidad del panel', () => {
  beforeEach(() => resetDeclaredUiElementsForTests());
  afterEach(() => resetDeclaredUiElementsForTests());

  it('cada clave usada por la plantilla está declarada, y cuelga de la pantalla `nav.dashboard`', () => {
    declareUiElements(DASHBOARD_UI_ELEMENTS);
    const drafts = buildUiElementDrafts(); // lanza si algún padre no existe en el catálogo real (menú + panel)
    const delPanel = drafts.filter((d) => d.key.startsWith('dashboard.'));
    expect(delPanel.map((d) => d.key).sort()).toEqual(Object.values(DASHBOARD_UI).sort());
    for (const d of delPanel) expect(d.parentKey).toBe('nav.dashboard');
  });
});
