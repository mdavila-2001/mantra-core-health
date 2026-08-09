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
    <app-auth-split [claim]="claim()" [tagline]="tagline()">
      <p class="proyectado">formulario</p>
    </app-auth-split>
  `,
})
class Host {
  readonly claim = signal('Tu salud, conectada');
  readonly tagline = signal('La red más grande');
}

describe('AuthSplit', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let theme: ThemeServiceFalso;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: ThemeService, useClass: ThemeServiceFalso }],
    }).compileComponents();

    theme = TestBed.inject(ThemeService) as unknown as ThemeServiceFalso;
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
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

  describe('cambio de titular', () => {
    it('rehace el nodo al cambiar el texto, para que la animación de entrada vuelva a correr', async () => {
      // Si se reusara el nodo —lo que hace una interpolación a secas— el texto
      // se reemplazaría de golpe y no habría transición que ver.
      const antes = el().querySelector('.auth-split__claim');

      host.claim.set('Potenciá tu práctica médica');
      await fixture.whenStable();

      const despues = el().querySelector('.auth-split__claim');
      expect(despues?.textContent).toContain('Potenciá tu práctica médica');
      expect(despues).not.toBe(antes);
    });

    it('conserva el nodo si el texto no cambió', async () => {
      const antes = el().querySelector('.auth-split__claim');

      host.tagline.set('Otra bajada');
      await fixture.whenStable();

      // Cambiar la bajada no debe reiniciar la animación del titular.
      expect(el().querySelector('.auth-split__claim')).toBe(antes);
    });

    it('sin bajada no renderiza el párrafo', async () => {
      host.tagline.set('');
      await fixture.whenStable();

      expect(el().querySelector('.auth-split__tagline')).toBeNull();
    });
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
