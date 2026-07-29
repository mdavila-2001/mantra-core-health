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

/** MediaQueryList mínima: solo lo que el servicio realmente usa. */
function stubPrefersDark(matches: boolean): (dark: boolean) => void {
  let listener: ((event: MediaQueryListEvent) => void) | null = null;
  const query = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, handler: (event: MediaQueryListEvent) => void) => {
      listener = handler;
    },
    removeEventListener: () => {
      listener = null;
    },
  };
  window.matchMedia = (() => query) as unknown as typeof window.matchMedia;

  return (dark: boolean) => {
    query.matches = dark;
    listener?.({ matches: dark } as MediaQueryListEvent);
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
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
    storage = createFakeStorage();
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });

    document.documentElement.removeAttribute('data-theme');
    stubPrefersDark(false);
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    if (originalStorage) {
      Object.defineProperty(window, 'localStorage', originalStorage);
    } else {
      Reflect.deleteProperty(window, 'localStorage');
    }
    document.documentElement.removeAttribute('data-theme');
  });

  describe('preferencia inicial', () => {
    it('sin nada guardado arranca en system y NO estampa atributo', () => {
      const service = createService();

      expect(service.currentTheme()).toBe('system');
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });

    it('restaura una preferencia explícita guardada', () => {
      storage.setItem(THEME_STORAGE_KEY, 'dark');

      const service = createService();

      expect(service.currentTheme()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('descarta un valor que no es ThemeMode', () => {
      storage.setItem(THEME_STORAGE_KEY, 'neón');

      expect(createService().currentTheme()).toBe('system');
    });
  });

  describe('resolución contra el sistema', () => {
    it('en system sigue la preferencia del sistema operativo', () => {
      stubPrefersDark(true);

      const service = createService();

      expect(service.currentTheme()).toBe('system');
      expect(service.resolvedTheme()).toBe('dark');
      expect(service.isDark()).toBe(true);
    });

    it('reacciona a un cambio del sistema en caliente', () => {
      const emitirCambio = stubPrefersDark(false);
      const service = createService();
      expect(service.resolvedTheme()).toBe('light');

      emitirCambio(true);

      expect(service.resolvedTheme()).toBe('dark');
    });

    it('una preferencia explícita gana sobre el sistema', () => {
      stubPrefersDark(true);
      const service = createService();

      service.setTheme('light');
      TestBed.tick();

      expect(service.resolvedTheme()).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('persistencia', () => {
    it('guarda la preferencia explícita', () => {
      const service = createService();

      service.setTheme('dark');
      TestBed.tick();

      expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('system se guarda como ausencia de clave y quita el atributo', () => {
      storage.setItem(THEME_STORAGE_KEY, 'dark');
      const service = createService();

      service.useSystemTheme();
      TestBed.tick();

      expect(storage.getItem(THEME_STORAGE_KEY)).toBeNull();
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });
  });

  describe('toggleTheme', () => {
    it('desde system claro fija oscuro explícito', () => {
      stubPrefersDark(false);
      const service = createService();

      service.toggleTheme();
      TestBed.tick();

      expect(service.currentTheme()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('desde system oscuro fija claro explícito', () => {
      stubPrefersDark(true);
      const service = createService();

      service.toggleTheme();

      expect(service.currentTheme()).toBe('light');
    });

    it('alterna de vuelta', () => {
      const service = createService();
      service.setTheme('dark');

      service.toggleTheme();

      expect(service.currentTheme()).toBe('light');
    });
  });
});
