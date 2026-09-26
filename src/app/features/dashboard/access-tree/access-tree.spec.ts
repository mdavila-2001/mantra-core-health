import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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

  /** Las secciones que un rol (y, opcionalmente, un tipo de organización) alcanza, tal como se las pasa el panel. */
  function seccionesDe(
    roles: readonly string[],
    tipo: string | null = null,
  ): readonly AppSection[] {
    return APP_SECTIONS.filter((seccion) => isVisibleTo(seccion, roles, ['t-1'], tipo));
  }

  function crear(roles: readonly string[] = ['PRACTITIONER'], tipo: string | null = null): void {
    fixture = TestBed.createComponent(AccessTree);
    fixture.componentRef.setInput('sections', seccionesDe(roles, tipo));
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
      // El modal de Comunidades lee temas y grupos: el cliente HTTP hace falta
      // aunque estas pruebas no comprueben esas lecturas.
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
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
        // Desde el 10/09/2026 hay dos clases de acceso, y las dos son honestas:
        // el que navega es un `<a>` cuyo `href` es su ruta, y el que abre un
        // modal es un `<button>` sin `href` —un enlace sin destino que abre una
        // ventana rompe «abrir en otra pestaña» y engaña al lector de pantalla—.
        if (acceso.dataset['modal'] === undefined) {
          expect(acceso.getAttribute('href')).toBe(acceso.dataset['ruta']);
        } else {
          expect(acceso.tagName).toBe('BUTTON');
          expect(acceso.getAttribute('aria-haspopup')).toBe('dialog');
          // Sigue declarando su ruta: es la misma sección, y la pantalla
          // completa se sigue alcanzando por el menú lateral.
          expect(acceso.dataset['ruta']).toBeTruthy();
        }
      }
      volver();
    }
  });

  /**
   * Corrección del 10/09/2026 · «Grupos y foros» abre Comunidades en un modal.
   *
   * La aserción importante es la segunda: el contenido **no** aparece dentro de
   * la lista de accesos. Un panel que se expandiera debajo de la tarjeta es
   * exactamente lo que el pedido prohíbe.
   */
  it('«Grupos y foros» abre un modal y no un panel debajo de la tarjeta', () => {
    crear();
    abrir('gente');

    const grupos = accesos().find((acceso) => acceso.dataset['ruta'] === '/groups');
    expect(grupos).toBeDefined();
    expect(grupos!.dataset['modal']).toBe('comunidades');

    const accesosAntes = accesos().length;
    grupos!.click();
    fixture.detectChanges();

    // El modal se monta sobre el `<dialog>` nativo, que vive en el documento.
    expect(document.querySelector('[data-testid="content-dialog"]')).not.toBeNull();
    expect(
      document.querySelector('[data-testid="content-dialog-title"]')?.textContent?.trim(),
    ).toBe('Comunidades');
    // La lista de accesos quedó igual: nada se desplegó adentro de ella.
    expect(accesos().length).toBe(accesosAntes);
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

    const salto = raiz().querySelector<HTMLButtonElement>('[data-zona-salto="organizacion"]');
    expect(salto).not.toBeNull();
    salto?.click();
    fixture.detectChanges();

    expect(raiz().querySelector('[data-zona-abierta="organizacion"]')).not.toBeNull();
    // Y la zona en la que estabas ya no se ofrece como salto: sería un enlace
    // a donde ya estás.
    expect(raiz().querySelector('[data-zona-salto="organizacion"]')).toBeNull();
  });

  it('el resumen de cada sección viaja en el nombre accesible, no sólo en el globo', () => {
    crear();
    abrir('consulta');

    // Dos caminos a propósito: el globo aparece con el puntero **y con el
    // foco**, y el `aria-label` cubre a quien nunca llega a enfocar el enlace.
    const agenda = accesos().find((a) => a.dataset['ruta'] === '/schedule');
    expect(agenda?.getAttribute('aria-label')).toBe(
      'Consultas médicas. Gestioná disponibilidad, reservas y confirmaciones de turno.',
    );
  });

  it('el rótulo se queda: una rejilla de íconos mudos se recorre a ciegas', () => {
    crear();
    abrir('consulta');

    const rotulos = accesos().map((a) => a.querySelector('.arbol__acceso-nombre')?.textContent);
    expect(rotulos).toContain('Evoluciones');
    // «Consultas médicas» desde ALV-016; era «Turnos».
    expect(rotulos).toContain('Consultas médicas');
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

  it('la doctora encuentra el Directorio de médicos en sus zonas (24/09/2026)', () => {
    // La corrección #2 del 15/08/2026 se lo había quitado; el cliente pidió
    // devolvérselo. El árbol sale de `NavigationService`, el mismo origen que
    // el guard, así que esto también fija que no se puedan desincronizar.
    crear(['PRACTITIONER', 'CLINICIAN']);

    const rutas = zonas()
      .map((z) => z.dataset['zona'] ?? '')
      .flatMap((zona) => {
        abrir(zona);
        const deLaZona = accesos().map((a) => a.dataset['ruta']);
        volver();
        return deLaZona;
      });
    expect(rutas).toContain('/directory');
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

  it('la aseguradora ve exactamente dos zonas: Chats, y las tres de seguros (2026-09-25)', () => {
    crear(['USER'], 'PAYER');

    const ids = zonas().map((z) => z.dataset['zona']);
    expect(ids).toEqual(['gente', 'organizacion']);

    abrir('gente');
    expect(accesos().map((a) => a.dataset['ruta'])).toEqual(['/messaging']);
    volver();

    abrir('organizacion');
    expect(accesos().map((a) => a.dataset['ruta'])).toEqual([
      '/administration/insurance-analytics',
      '/administration/my-organization',
      '/administration/insurance',
    ]);
  });
});
