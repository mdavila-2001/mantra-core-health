import { APP_SECTIONS } from '../navigation/navigation.map';
import type { AppSection } from '../navigation/navigation.types';
import { NAV_GROUPS } from '../navigation/navigation.groups';
import { navGroupKey, navScreenKey } from './ui-element-keys';
import {
  buildUiElementDrafts,
  collectUiElementDrafts,
  declaredUiElements,
  declareUiElements,
  deriveNavElements,
  resetDeclaredUiElementsForTests,
  validateUiElementDrafts,
} from './ui-element-registry';

const SECCION: AppSection = {
  path: 'pharmacy/orders',
  label: 'Pedidos',
  group: 'Atención',
  icon: 'orders',
  availability: 'disponible',
  summary: 'Los pedidos de la farmacia.',
  module: 'M24 pharmacy',
};

describe('registro del catálogo de visibilidad', () => {
  beforeEach(() => resetDeclaredUiElementsForTests());
  afterEach(() => resetDeclaredUiElementsForTests());

  describe('derivación del menú (APP_SECTIONS)', () => {
    it('un MENU_SECTION por grupo y un SCREEN por sección, colgado de su grupo', () => {
      const derivados = deriveNavElements([SECCION]);
      expect(derivados).toEqual([
        {
          key: 'nav.group.atencion',
          kind: 'MENU_SECTION',
          moduleCode: 'nav',
          parentKey: null,
          label: 'Atención',
          description: expect.any(String),
          defaultVisible: true,
        },
        {
          key: 'nav.pharmacy.orders',
          kind: 'SCREEN',
          moduleCode: 'pharmacy',
          parentKey: 'nav.group.atencion',
          label: 'Pedidos',
          description: 'Los pedidos de la farmacia.',
          defaultVisible: true,
        },
      ]);
    });

    it('cubre el registro entero: ninguna sección queda sin elemento y todo padre existe', () => {
      const derivados = deriveNavElements();
      const pantallas = derivados.filter((d) => d.kind === 'SCREEN');
      expect(pantallas).toHaveLength(APP_SECTIONS.length);
      expect(derivados.filter((d) => d.kind === 'MENU_SECTION').length).toBeLessThanOrEqual(NAV_GROUPS.length);
      expect(validateUiElementDrafts(derivados)).toEqual([]);
      for (const s of APP_SECTIONS) {
        const d = derivados.find((x) => x.key === navScreenKey(s.path));
        expect(d?.parentKey).toBe(navGroupKey(s.group));
        expect(d?.label).toBe(s.label);
      }
    });
  });

  describe('declareUiElements (WIDGET/SECTION/FIELD/ACTION)', () => {
    const widget = {
      key: 'pharmacy.orders.export-button',
      kind: 'ACTION',
      moduleCode: 'pharmacy',
      parentKey: 'nav.pharmacy.orders',
      label: 'Exportar pedidos',
    } as const;

    it('lo declarado entra al catálogo con los valores por omisión', () => {
      declareUiElements([widget]);
      const drafts = collectUiElementDrafts([SECCION]);
      expect(drafts.find((d) => d.key === widget.key)).toEqual({
        key: widget.key,
        kind: 'ACTION',
        moduleCode: 'pharmacy',
        parentKey: 'nav.pharmacy.orders',
        label: 'Exportar pedidos',
        description: null,
        defaultVisible: true,
      });
    });

    it('declarar dos veces lo mismo es inofensivo; declarar la misma clave con otro contenido, no', () => {
      declareUiElements([widget]);
      expect(() => declareUiElements([widget])).not.toThrow();
      expect(declaredUiElements()).toHaveLength(1);
      expect(() => declareUiElements([{ ...widget, label: 'Otro nombre' }])).toThrow(/ya está declarado/);
    });

    it('rechaza una clave mal formada', () => {
      for (const key of ['Exportar', 'sin-puntos', 'Mayusculas.aqui', 'a..b', '.a.b']) {
        expect(() => declareUiElements([{ ...widget, key }])).toThrow(/inválida/);
      }
    });
  });

  describe('buildUiElementDrafts (lo que se sincroniza)', () => {
    it('arma el catálogo = menú + declarado, listo para `elements/sync`', () => {
      declareUiElements([
        { key: 'pharmacy.orders.export-button', kind: 'ACTION', moduleCode: 'pharmacy', parentKey: 'nav.pharmacy.orders', label: 'Exportar' },
      ]);
      const drafts = buildUiElementDrafts([SECCION]);
      expect(drafts.map((d) => d.key)).toEqual([
        'nav.group.atencion',
        'nav.pharmacy.orders',
        'pharmacy.orders.export-button',
      ]);
    });

    it('se niega a sincronizar un catálogo con un padre que no existe', () => {
      declareUiElements([
        { key: 'pharmacy.orders.huerfano', kind: 'WIDGET', moduleCode: 'pharmacy', parentKey: 'nav.no.existe', label: 'Huérfano' },
      ]);
      expect(() => buildUiElementDrafts([SECCION])).toThrow(/no existe en el catálogo/);
    });

    it('detecta claves repetidas y ciclos de padres', () => {
      const base = { kind: 'WIDGET', moduleCode: 'm', label: 'x', description: null, defaultVisible: true } as const;
      expect(
        validateUiElementDrafts([
          { ...base, key: 'm.a.uno', parentKey: null },
          { ...base, key: 'm.a.uno', parentKey: null },
        ]),
      ).toEqual(['clave repetida: «m.a.uno»']);
      const ciclo = validateUiElementDrafts([
        { ...base, key: 'm.a.uno', parentKey: 'm.a.dos' },
        { ...base, key: 'm.a.dos', parentKey: 'm.a.uno' },
      ]);
      expect(ciclo.some((p) => p.startsWith('ciclo de padres'))).toBe(true);
    });
  });
});
