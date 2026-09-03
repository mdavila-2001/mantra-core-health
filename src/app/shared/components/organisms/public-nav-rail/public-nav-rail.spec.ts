import { readFileSync } from 'node:fs';

import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { PublicNavRail } from './public-nav-rail';
import { PUBLIC_NAV_RAIL_SECTIONS } from './public-nav-rail.types';

const RAIL_CSS = 'src/app/shared/components/organisms/public-nav-rail/public-nav-rail.css';

/** Destino de prueba: sin rutas reales no hay `NavigationEnd` que leer. */
@Component({ template: '' })
class RutaVacia {}

@Component({
  imports: [PublicNavRail],
  template: '<app-public-nav-rail />',
})
class HostComponent {}

describe('PublicNavRail', () => {
  let fixture: ComponentFixture<HostComponent>;
  let router: Router;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function enlaces(): HTMLAnchorElement[] {
    return [...root().querySelectorAll<HTMLAnchorElement>('a.public-nav-rail__link')];
  }

  async function ir(url: string): Promise<void> {
    await router.navigateByUrl(url);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([
          { path: 'posts', component: RutaVacia },
          { path: 'search', pathMatch: 'full', component: RutaVacia },
          { path: 'search/practitioners', component: RutaVacia },
          { path: 'search/symptoms', component: RutaVacia },
          { path: 'search/medications', component: RutaVacia },
          { path: 'search/hospitals', component: RutaVacia },
          { path: 'search/diagnostics', component: RutaVacia },
          { path: 'search/insurers', component: RutaVacia },
          { path: 'p/:slug', component: RutaVacia },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    router = TestBed.inject(Router);
    await ir('/posts');
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('estructura (AC-01-2)', () => {
    it('es un nav nombrado, no un tablist', () => {
      const nav = root().querySelector('nav');

      expect(nav?.getAttribute('aria-label')).toBe('Secciones de AloVida');
      // Lo que reemplaza decía `role="tablist"` sobre enlaces que navegaban a
      // otra URL. Que no vuelva.
      expect(root().querySelector('[role="tablist"]')).toBeNull();
      expect(root().querySelector('[role="tab"]')).toBeNull();
    });

    it('las cuatro secciones que pide el propietario van primero y en su orden', () => {
      const primerGrupo = root().querySelector('[data-group="sections"]');
      const rotulos = [...(primerGrupo?.querySelectorAll('a') ?? [])].map((a) =>
        a.getAttribute('aria-label'),
      );

      expect(rotulos).toEqual(['Publicaciones', 'Buscar', 'Profesionales', '¿A quién consulto?']);
    });

    it('los cuatro verticales van en su propio grupo, después', () => {
      const grupos = [...root().querySelectorAll('.public-nav-rail__group')].map((g) =>
        g.getAttribute('data-group'),
      );

      expect(grupos).toEqual(['sections', 'directories']);
    });

    it('cada grupo se anuncia con su rótulo, aunque no se vea', () => {
      const titulos = [...root().querySelectorAll('h2')].map((h) => ({
        texto: h.textContent?.trim(),
        oculto: h.classList.contains('sr-only'),
      }));

      expect(titulos).toEqual([
        { texto: 'Secciones', oculto: true },
        { texto: 'Directorios', oculto: true },
      ]);
    });

    it('dibuja un enlace por entrada declarada', () => {
      const declaradas = PUBLIC_NAV_RAIL_SECTIONS.flatMap((g) => g.entries).length;

      expect(enlaces()).toHaveLength(declaradas);
    });
  });

  describe('nombre accesible y tooltip (AC-01-2)', () => {
    it('cada enlace tiene aria-label con el texto de su entrada', () => {
      const entradas = PUBLIC_NAV_RAIL_SECTIONS.flatMap((g) => g.entries);

      enlaces().forEach((enlace, i) => {
        expect(enlace.getAttribute('aria-label')).toBe(entradas[i]?.label);
      });
    });

    it('el glifo no aporta el nombre: va aria-hidden', () => {
      const iconos = root().querySelectorAll('.public-nav-rail__icon');

      expect(iconos).toHaveLength(enlaces().length);
      iconos.forEach((icono) => {
        expect(icono.getAttribute('aria-hidden')).toBe('true');
      });
    });

    it('el rótulo visible de móvil tampoco lo duplica', () => {
      root()
        .querySelectorAll('.public-nav-rail__label')
        .forEach((rotulo) => {
          expect(rotulo.getAttribute('aria-hidden')).toBe('true');
        });
    });

    it('el ícono sale del set cerrado: ningún svg escrito a mano', () => {
      root()
        .querySelectorAll('.public-nav-rail__icon')
        .forEach((icono) => {
          expect(icono.querySelector('app-nav-icon')).not.toBeNull();
        });
    });
  });

  describe('la página actual (AC-01-3)', () => {
    it('marca la entrada de la ruta activa, y sólo una', async () => {
      await ir('/posts');
      const marcados = enlaces().filter((a) => a.getAttribute('aria-current') === 'page');

      expect(marcados).toHaveLength(1);
      expect(marcados[0]?.getAttribute('aria-label')).toBe('Publicaciones');
    });

    it('gana la coincidencia más específica: la hija, no su padre', async () => {
      await ir('/search/practitioners');
      const marcados = enlaces().filter((a) => a.getAttribute('aria-current') === 'page');

      // Sin esto quedarían marcadas `/search/practitioners` **y** `/search`, y
      // un lector de pantalla anunciaría dos «ésta es la página».
      expect(marcados).toHaveLength(1);
      expect(marcados[0]?.getAttribute('data-route')).toBe('/search/practitioners');
    });

    it('un filtro en la dirección no cambia la sección activa', async () => {
      await ir('/search/practitioners?q=cardio');
      const marcados = enlaces().filter((a) => a.getAttribute('aria-current') === 'page');

      expect(marcados).toHaveLength(1);
      expect(marcados[0]?.getAttribute('data-route')).toBe('/search/practitioners');
    });

    it('una ruta que no está en el rail no marca nada', async () => {
      await ir('/p/dra-lopez');

      expect(enlaces().filter((a) => a.getAttribute('aria-current') === 'page')).toHaveLength(0);
    });

    it('la clase de activo acompaña al aria-current, y no lo reemplaza', async () => {
      await ir('/search/medications');
      const activo = enlaces().find((a) => a.classList.contains('is-active'));

      expect(activo?.getAttribute('aria-current')).toBe('page');
    });
  });

  describe('estilo', () => {
    const css = readFileSync(RAIL_CSS, 'utf8');

    it('es mobile-first: ninguna media query max-width (§0.1)', () => {
      const anchos = [...css.matchAll(/@media\s*\(([^)]*width[^)]*)\)/g)].map((m) => m[1] ?? '');

      expect(anchos.every((consulta) => !consulta.includes('max-width'))).toBe(true);
    });

    it('el área táctil es de 44 px aunque el glifo mida 20', () => {
      expect(css).toContain('min-inline-size: 44px');
      expect(css).toContain('min-block-size: 44px');
    });

    it('la página actual no se distingue sólo por color', () => {
      const activo = css.slice(css.indexOf('.public-nav-rail__link.is-active'));

      expect(activo).toContain('font-weight');
    });

    it('respeta prefers-reduced-motion', () => {
      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    });

    /* ---- las dos que encontró el navegador, no jsdom -------------------- */

    it('el tamaño del glifo se le pide al HOST, no al svg de adentro', () => {
      // `nav-icon` dibuja con `width/height: 100%`, así que la medida la pone
      // quien lo monta. Una regla sobre `svg` **no lo alcanza**: ese elemento
      // pertenece a la vista del átomo, no a ésta, y el selector compilado le
      // exige el atributo de este componente. Sin medida, el `100%` no tiene
      // contra qué resolver y el navegador cae al tamaño por defecto de un
      // reemplazado: 300 px por ícono, medidos a 390 de viewport.
      expect(css).toContain('.public-nav-rail__icon app-nav-icon');
      expect(css).not.toMatch(/\.public-nav-rail__icon\s+svg\s*\{/);
    });

    it('el contenedor de scroll es el bloque contenedor de lo absoluto', () => {
      // El `<h2 class="sr-only">` de cada grupo es `position: absolute`. Con el
      // rail en `static`, su bloque contenedor queda FUERA del contenedor de
      // scroll: se planta en su posición estática dentro del contenido
      // desplazado y el `overflow` de acá no lo recorta. Medido: un rótulo de
      // 1 px, invisible, estirando la página de 390 a 626 y haciéndola
      // scrollear a lo ancho.
      const contenedor = css.slice(css.indexOf('.public-nav-rail {'));
      const bloque = contenedor.slice(0, contenedor.indexOf('}'));

      expect(bloque).toContain('position: relative');
      expect(bloque).toContain('overflow-x: auto');
    });
  });
});
