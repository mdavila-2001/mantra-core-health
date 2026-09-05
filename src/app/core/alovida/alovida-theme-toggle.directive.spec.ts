/* ============================================================================
    El interruptor de tema es el único punto donde el marcado de la bóveda y el
    ThemeService del front se tocan. Lo que se fija acá es ese contrato: que el
    clic llegue al servicio, y que el botón cuente la verdad de lo que se está
    pintando —no lo que quedó escrito en la maqueta el día que se dibujó.
    ========================================================================== */

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThemeService } from '@core/tokens/theme.service';
import { AlovidaThemeToggleDirective } from './alovida-theme-toggle.directive';

@Component({
  imports: [AlovidaThemeToggleDirective],
  template: `<button class="app-theme-toggle" app-theme-toggle>
    <span class="app-theme-toggle__pista"></span>
  </button>`,
})
class Anfitrion {}

describe('AlovidaThemeToggleDirective', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let theme: ThemeService;

  function boton(): HTMLButtonElement {
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    theme = TestBed.inject(ThemeService);
    theme.setTheme('light');
  });

  it('se anuncia como interruptor, sin que la plantilla lo escriba', () => {
    // El rol lo pone la directiva: escrito a mano en 126 archivos, se
    // desincronizaría del estado en cuanto alguien cambiara a oscuro.
    expect(boton().getAttribute('role')).toBe('switch');
    expect(boton().type).toBe('button');
  });

  it('refleja el tema que se está pintando', () => {
    expect(boton().getAttribute('aria-checked')).toBe('false');
    expect(boton().getAttribute('aria-label')).toBe('Cambiar a modo oscuro');

    theme.setTheme('dark');

    expect(boton().getAttribute('aria-checked')).toBe('true');
    expect(boton().getAttribute('aria-label')).toBe('Cambiar a modo claro');
  });

  it('el clic alterna el tema de verdad, no sólo el botón', () => {
    boton().click();

    expect(theme.resolvedTheme()).toBe('dark');
    expect(boton().getAttribute('aria-checked')).toBe('true');
  });

  it('vuelve a claro al segundo clic', () => {
    boton().click();
    boton().click();

    expect(theme.resolvedTheme()).toBe('light');
  });
});
