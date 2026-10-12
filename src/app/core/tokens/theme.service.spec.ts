import { TestBed } from '@angular/core/testing';

import { ThemeService, THEME_STORAGE_KEY } from './theme.service';

/**
 * jsdom corre con origen opaco, así que `localStorage` no está disponible como
 * global. Se inyecta uno falso: además vuelve determinista lo que se persiste.
 */
function createFakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function createService(): ThemeService {
  const service = TestBed.inject(ThemeService);
  TestBed.tick(); // el atributo se estampa en un effect
  return service;
}

describe('ThemeService', () => {
  let storage: Storage;
  let originalStorage: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
    storage = createFakeStorage();
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });

    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-tema');
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    if (originalStorage) {
      Object.defineProperty(window, 'localStorage', originalStorage);
    } else {
      Reflect.deleteProperty(window, 'localStorage');
    }
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-tema');
  });

  describe('preferencia inicial', () => {
    it('sin nada guardado arranca en light y estampa atributo', () => {
      const service = createService();

      expect(service.currentTheme()).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
    });

    it('restaura una preferencia explícita guardada', () => {
      storage.setItem(THEME_STORAGE_KEY, 'dark');

      const service = createService();

      expect(service.currentTheme()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro');
    });

    it('descarta un valor que no es ThemeMode (incluyendo "system") y cae a light', () => {
      storage.setItem(THEME_STORAGE_KEY, 'neón');

      expect(createService().currentTheme()).toBe('light');

      storage.setItem(THEME_STORAGE_KEY, 'system');
      expect(createService().currentTheme()).toBe('light');
    });
  });

  describe('persistencia', () => {
    it('guarda la preferencia explícita', () => {
      const service = createService();

      service.setTheme('dark');
      TestBed.tick();

      expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('toggleTheme', () => {
    it('desde claro fija oscuro', () => {
      const service = createService();

      service.toggleTheme();
      TestBed.tick();

      expect(service.currentTheme()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro');
    });

    it('desde oscuro fija claro', () => {
      storage.setItem(THEME_STORAGE_KEY, 'dark');
      const service = createService();

      service.toggleTheme();
      TestBed.tick();

      expect(service.currentTheme()).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
    });
  });
});
