import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MAXIMO_DE_ZONAS } from '../../../core/navigation/access-tree';
import { APP_SECTIONS } from '../../../core/navigation/navigation.map';
import { isVisibleTo, type AppSection } from '../../../core/navigation/navigation.types';
import { AccessTree } from './access-tree';

/**
 * El árbol tiene **dos promesas** y las pruebas de acá son ellas:
 *
 * 1. **La primera pantalla no pasa de cinco puertas.** Es el pedido literal del
 *    28/08/2026 y lo que separa un panel de un cajón de sastre.
 * 2. **Nada de lo que se ofrece rebota.** Cada acceso apunta a una ruta que el
 *    registro declara, porque el árbol no escribe ninguna a mano.
 *
 * Lo demás —quién ve qué, qué sección cae en qué zona— lo fijan
 * `navigation.map.spec.ts` y `access-tree.spec.ts` del registro. Acá se prueba
 * la **interacción**: abrir, volver, saltar y salir con el teclado.
 */
describe('AccessTree', () => {
  let fixture: ComponentFixture<AccessTree>;

  /** Las secciones que un rol alcanza, tal como se las pasa el panel. */
  function seccionesDe(roles: readonly string[]): readonly AppSection[] {
    return APP_SECTIONS.filter((seccion) => isVisibleTo(seccion, roles, ['t-1']));
  }

  function crear(roles: readonly string[] = ['PRACTITIONER']): void {
    fixture = TestBed.createComponent(AccessTree);
    fixture.componentRef.setInput('sections', seccionesDe(roles));
    fixture.detectChanges();
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function zonas(): readonly HTMLButtonElement[] {
    return [...raiz().querySelectorAll<HTMLButtonElement>('[data-testid="panel-zona"]')];
  }

  function accesos(): readonly HTMLAnchorElement[] {
    return [...raiz().querySelectorAll<HTMLAnchorElement>('[data-testid="panel-acceso"]')];
  }

  function abrir(id: string): void {
    zonas()
      .find((zona) => zona.dataset['zona'] === id)
      ?.click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessTree],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('la primera pantalla son zonas, no las treinta y dos secciones sueltas', () => {
    crear();

    expect(zonas().length).toBeGreaterThan(0);
    expect(zonas().length).toBeLessThanOrEqual(MAXIMO_DE_ZONAS);
    // Ni un acceso a la vista antes de abrir: ése era todo el problema.
    expect(accesos()).toHaveLength(0);
  });

  it('cada zona dice cuántas secciones tiene, para no tener que abrirla', () => {
    crear();

    for (const zona of zonas()) {
      const cuenta = zona.querySelector('.arbol__zona-cuenta')?.textContent?.trim() ?? '';
      expect(Number.parseInt(cuenta, 10)).toBeGreaterThan(0);
      // El nombre accesible lleva rótulo, cifra y resumen: quien navega con
      // lector de pantalla decide si entrar sin recorrer el interior.
      expect(zona.getAttribute('aria-label')).toContain('secciones');
    }
  });

  it('abrir una zona muestra sus secciones y guarda las zonas', () => {
    crear();
    abrir('consulta');

    expect(zonas()).toHaveLength(0);
    expect(accesos().length).toBeGreaterThan(0);
    expect(accesos().map((a) => a.dataset['ruta'])).toContain('/schedule');
    expect(raiz().querySelector('[data-zona-abierta="consulta"]')).not.toBeNull();
  });

  it('lo que una zona ofrece apunta a una ruta real, no a un destino inventado', () => {
    crear();

    for (const zona of zonas().map((z) => z.dataset['zona'] ?? '')) {
      abrir(zona);
      for (const acceso of accesos()) {
        expect(acceso.getAttribute('href')).toBe(acceso.dataset['ruta']);
      }
      volver();
    }
  });

  function volver(): void {
    raiz().querySelector<HTMLButtonElement>('[data-testid="panel-zona-volver"]')?.click();
    fixture.detectChanges();
  }

  it('«Todas las zonas» vuelve al principio', () => {
    crear();
    abrir('consulta');
    volver();

    expect(zonas().length).toBeGreaterThan(0);
    expect(accesos()).toHaveLength(0);
  });

  it('Escape sale de la zona: el teclado no queda encerrado adentro', () => {
    crear();
    abrir('consulta');

    const acceso = accesos()[0];
    acceso?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(zonas().length).toBeGreaterThan(0);
  });

  it('se salta de una zona a otra sin rebotar por la primera pantalla', () => {
    crear();
    abrir('consulta');

    const salto = raiz().querySelector<HTMLButtonElement>('[data-zona-salto="cuenta"]');
    expect(salto).not.toBeNull();
    salto?.click();
    fixture.detectChanges();

    expect(raiz().querySelector('[data-zona-abierta="cuenta"]')).not.toBeNull();
    // Y la zona en la que estabas ya no se ofrece como salto: sería un enlace
    // a donde ya estás.
    expect(raiz().querySelector('[data-zona-salto="cuenta"]')).toBeNull();
  });

  it('el resumen de cada sección viaja en el nombre accesible, no sólo en el globo', () => {
    crear();
    abrir('cuenta');

    // Dos caminos a propósito: el globo aparece con el puntero **y con el
    // foco**, y el `aria-label` cubre a quien nunca llega a enfocar el enlace.
    const tutoriales = accesos().find((a) => a.dataset['ruta'] === '/tutorials');
    expect(tutoriales?.getAttribute('aria-label')).toBe(
      'Tutoriales. Aprendé a usar cada sección con recorridos guiados sobre la aplicación real.',
    );
  });

  it('el rótulo se queda: una rejilla de íconos mudos se recorre a ciegas', () => {
    crear();
    abrir('consulta');

    const rotulos = accesos().map((a) => a.querySelector('.arbol__acceso-nombre')?.textContent);
    expect(rotulos).toContain('Evoluciones');
    // «Consultas» desde ALV-016; era «Turnos».
    expect(rotulos).toContain('Consultas');
  });

  it('cada acceso lleva su ícono: la zona se recorre con la vista, no leyendo', () => {
    crear();
    abrir('consulta');

    for (const acceso of accesos()) {
      expect(acceso.querySelector('app-nav-icon svg')).not.toBeNull();
    }
  });

  it('lo que está en construcción no se ofrece como si se pudiera entrar', () => {
    crear(['BILLING']);

    for (const zona of zonas().map((z) => z.dataset['zona'] ?? '')) {
      abrir(zona);
      const planificados = raiz().querySelectorAll('[data-testid="panel-acceso-planificado"]');
      // Ni ancla ni globo: un globo pide foco, y esto no es enfocable
      // justamente porque no se puede entrar.
      for (const planificado of planificados) {
        expect(planificado.tagName.toLowerCase()).not.toBe('a');
        expect(planificado.getAttribute('aria-describedby')).toBeNull();
      }
      volver();
    }
  });

  it('la Guía de profesionales no está en ninguna zona de la doctora', () => {
    // Corrección #2 del 15/08/2026. El árbol sale de `NavigationService`, el
    // mismo origen que el menú, así que esto también fija que no se puedan
    // desincronizar — ahora a través de un escalón más.
    crear(['PRACTITIONER', 'CLINICIAN']);

    for (const zona of zonas().map((z) => z.dataset['zona'] ?? '')) {
      abrir(zona);
      expect(accesos().map((a) => a.dataset['ruta'])).not.toContain('/directory');
      volver();
    }
  });

  it('no ofrece el panel dentro del panel', () => {
    crear();

    for (const zona of zonas().map((z) => z.dataset['zona'] ?? '')) {
      abrir(zona);
      expect(accesos().map((a) => a.dataset['ruta'])).not.toContain('/dashboard');
      volver();
    }
  });

  it('sin secciones no dibuja ninguna zona, y no cinco tarjetas vacías', () => {
    fixture = TestBed.createComponent(AccessTree);
    fixture.componentRef.setInput('sections', []);
    fixture.detectChanges();

    expect(zonas()).toHaveLength(0);
  });
});
