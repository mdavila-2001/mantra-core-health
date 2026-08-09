import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DesignSystemSample } from './design-system-sample';

/**
 * La vitrina es la superficie de observación del sistema: lo que se verifica
 * acá es que **cada pieza esté expuesta**. Una pieza que se deja de mostrar
 * deja de mirarse, y lo que no se mira se pudre.
 */
describe('DesignSystemSample', () => {
  let fixture: ComponentFixture<DesignSystemSample>;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function secciones(): string[] {
    return [...root().querySelectorAll('h2')].map((titulo) => (titulo.textContent ?? '').trim());
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesignSystemSample],
      // El breadcrumb usa `routerLink`: sin router, la vitrina ni se crea.
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DesignSystemSample);
    await fixture.whenStable();
  });

  it('expone las 28 secciones del sistema, numeradas y en orden', () => {
    const titulos = secciones();

    expect(titulos).toHaveLength(28);
    titulos.forEach((titulo, indice) => {
      expect(titulo).toMatch(new RegExp(`^${String(indice + 1).padStart(2, '0')} · `));
    });
  });

  it('cada átomo y molécula del sistema aparece al menos una vez', () => {
    const piezas = [
      'app-badge',
      'app-avatar',
      'app-reference-combobox',
      'app-input',
      'app-textarea',
      'app-spinner',
      'app-chip',
      'app-divider',
      'app-skeleton',
      'app-progress',
      'app-card',
      'app-search-field',
      'app-alert',
      'app-menu',
      'app-tabs',
      'app-tab',
      'app-pagination',
      'app-breadcrumb',
      'app-empty-state',
      'app-accordion',
      'app-accordion-panel',
    ];

    const ausentes = piezas.filter((pieza) => root().querySelector(pieza) === null);
    expect(ausentes).toEqual([]);
  });

  /** Los ítems no existen hasta abrir: el menú no paga por lo que no se ve. */
  it('el menú de la vitrina abre con sus acciones', async () => {
    const disparador = root().querySelector<HTMLButtonElement>('[aria-haspopup="menu"]');
    disparador?.click();
    await fixture.whenStable();

    expect(document.querySelectorAll('app-menu-item').length).toBeGreaterThan(0);
  });

  it('el enlace y el tooltip, que son de atributo, también están', () => {
    expect(root().querySelector('a[app-link]')).not.toBeNull();
    expect(root().querySelector('[appTooltip], [ng-reflect-app-tooltip]')).not.toBeNull();
  });

  it('la acción que navega se exhibe sobre un ancla, no sobre un botón', () => {
    // Es la diferencia que motiva `a[app-button]`: sobre un <button> se pierden
    // el clic con la rueda y «abrir en pestaña nueva».
    const ancla = root().querySelector('a[app-button]');

    expect(ancla).not.toBeNull();
    expect(ancla?.className).toContain('btn--primary');
  });

  it('el selector de tema sigue expuesto: es la única UI del ThemeService', () => {
    const grupo = root().querySelector('[role="group"][aria-label="Tema de la interfaz"]');

    expect(grupo?.querySelectorAll('button')).toHaveLength(3);
  });
});
