import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AuthSplit } from './auth-split';
import { ThemeService } from '../../../../core/tokens/theme.service';
import type { ThemeMode } from '../../../../core/tokens/design-tokens.types';

/** Doble del servicio de tema: jsdom no da `localStorage` con origen opaco. */
class ThemeServiceFalso {
  readonly currentTheme = signal<ThemeMode>('system');

  setTheme(mode: ThemeMode): void {
    this.currentTheme.set(mode);
  }
}

@Component({
  imports: [AuthSplit],
  template: `
    <app-auth-split claim="Tu salud, conectada" tagline="La red más grande">
      <p class="proyectado">formulario</p>
    </app-auth-split>
  `,
})
class Host {}

describe('AuthSplit', () => {
  let fixture: ComponentFixture<Host>;
  let theme: ThemeServiceFalso;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: ThemeService, useClass: ThemeServiceFalso }],
    }).compileComponents();

    theme = TestBed.inject(ThemeService) as unknown as ThemeServiceFalso;
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  const botonesTema = (): HTMLButtonElement[] =>
    Array.from(el().querySelectorAll('.auth-split__theme button'));

  it('muestra el titular y la bajada de la columna de marca', () => {
    expect(el().querySelector('.auth-split__claim')?.textContent).toContain('Tu salud, conectada');
    expect(el().querySelector('.auth-split__tagline')?.textContent).toContain('La red más grande');
  });

  it('proyecta el contenido del formulario', () => {
    expect(el().querySelector('.proyectado')?.textContent).toBe('formulario');
  });

  it('la columna de marca es decorativa: no la anuncia un lector de pantalla', () => {
    // Todo lo que dice está también en el formulario; anunciarla lo duplicaría.
    expect(el().querySelector('.auth-split__brand')?.getAttribute('aria-hidden')).toBe('true');
  });

  describe('selector de tema', () => {
    it('ofrece los tres modos', () => {
      // Son botones de ícono: el nombre va en `aria-label`, no en texto visible.
      expect(botonesTema().map((b) => b.getAttribute('aria-label'))).toEqual([
        'Claro',
        'Oscuro',
        'Sistema',
      ]);
    });

    it('cada botón lleva su ícono', () => {
      expect(botonesTema().every((b) => b.querySelector('svg') !== null)).toBe(true);
    });

    it('marca el activo con aria-pressed, no solo con color', () => {
      // Quien no distingue el matiz del `secondary` necesita otra señal.
      const pressed = () => botonesTema().map((b) => b.getAttribute('aria-pressed'));

      expect(pressed()).toEqual(['false', 'false', 'true']);
    });

    it('cambia el tema al elegir uno', async () => {
      botonesTema()[1]?.click();
      await fixture.whenStable();

      // Existe acá y no solo en la vitrina porque una persona ajusta claro/oscuro
      // ANTES de entrar.
      expect(theme.currentTheme()).toBe('dark');
    });

    it('el grupo tiene nombre accesible', () => {
      const grupo = el().querySelector('.auth-split__theme');

      expect(grupo?.getAttribute('role')).toBe('group');
      expect(grupo?.getAttribute('aria-label')).toBe('Tema de la interfaz');
    });
  });
});
