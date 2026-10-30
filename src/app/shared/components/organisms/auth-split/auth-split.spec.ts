import { readFileSync } from 'node:fs';

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AuthSplit, type AuthSplitScene } from './auth-split';
import { ACCOUNT_ICON_NAMES } from '../../atoms/account-icon/account-icon.types';
import { ThemeService } from '../../../../core/tokens/theme.service';
import type { ThemeMode } from '../../../../core/tokens/design-tokens.types';

/** Doble del servicio de tema: jsdom no da `localStorage` con origen opaco. */
class ThemeServiceFalso {
  readonly currentTheme = signal<ThemeMode>('light');

  setTheme(mode: ThemeMode): void {
    this.currentTheme.set(mode);
  }
}

@Component({
  imports: [AuthSplit],
  template: `
    <app-auth-split
      [claim]="claim()"
      [tagline]="tagline()"
      [scene]="scene()"
      [contentWidth]="width()"
    >
      <p class="proyectado">formulario</p>
    </app-auth-split>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly claim = signal('Su salud, conectada');
  readonly tagline = signal('La red más grande');
  readonly scene = signal<AuthSplitScene>('split');
  readonly width = signal<'wide' | 'full'>('wide');
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
    expect(el().querySelector('.auth-split__claim')?.textContent).toContain('Su salud, conectada');
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

      host.claim.set('Potencie su práctica médica');
      await fixture.whenStable();

      const despues = el().querySelector('.auth-split__claim');
      expect(despues?.textContent).toContain('Potencie su práctica médica');
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
    it('ofrece los dos modos', () => {
      // Son botones de ícono: el nombre va en `aria-label`, no en texto visible.
      expect(botonesTema().map((b) => b.getAttribute('aria-label'))).toEqual([
        'Claro',
        'Oscuro',
      ]);
    });

    it('cada botón lleva su ícono', () => {
      expect(botonesTema().every((b) => b.querySelector('svg') !== null)).toBe(true);
    });

    it('marca el activo con aria-pressed, no solo con color', () => {
      // Quien no distingue el matiz del `secondary` necesita otra señal.
      const pressed = () => botonesTema().map((b) => b.getAttribute('aria-pressed'));

      expect(pressed()).toEqual(['true', 'false']);
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

  describe('puesta en escena', () => {
    const escenario = (): Element | null => el().querySelector('app-auth-stage');

    it('por defecto es la estructura partida: sin escenario y con las auroras de cada columna', () => {
      expect(escenario()).toBeNull();
      expect(el().querySelector('.auth-split--stage')).toBeNull();
      expect(el().querySelectorAll('.auth-split__aurora')).toHaveLength(2);
    });

    it('con `stage` monta el escenario del latido y retira las auroras de la partida', async () => {
      host.scene.set('stage');
      await fixture.whenStable();

      expect(el().querySelector('.auth-split--stage')).not.toBeNull();
      expect(escenario()).not.toBeNull();
      expect(el().querySelectorAll('.auth-split__aurora')).toHaveLength(0);
      // El titular sigue: el escenario cambia el fondo, no el mensaje.
      expect(el().querySelector('.auth-split__claim')?.textContent).toContain(
        'Su salud, conectada',
      );
    });

    it('con `stage` la marca trae los dos logos: el blanco y el petróleo del escenario claro', async () => {
      host.scene.set('stage');
      await fixture.whenStable();

      const logos = Array.from(el().querySelectorAll<HTMLImageElement>('.auth-split__wordmark img'));
      expect(logos.map((img) => img.getAttribute('src'))).toEqual([
        '/alovida/imagenes/alovida-logo-blanco.svg',
        '/alovida/imagenes/alovida-logo.svg',
      ]);
      expect(logos[1].classList).toContain('auth-split__wordmark-ink');
      // Decorativos los dos: el nombre ya lo dice el texto de al lado.
      expect(logos.every((img) => img.getAttribute('alt') === '')).toBe(true);
    });

    it('la hoja del escenario claro esconde el logo petróleo fuera de claro y nunca usa literales de color', () => {
      const css = readFileSync(
        'src/app/shared/components/organisms/auth-split/auth-split-light-stage.css',
        'utf8',
      );
      expect(css).toMatch(/^\.auth-split__wordmark-ink \{\s*display: none;/m);
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
      // Todo lo demás es override de claro: el oscuro no cambia.
      const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{/g) ?? [];
      const unscoped = rules
        .map((r) => r.replace('{', '').trim())
        .filter((r) => !r.startsWith('@media') && !r.startsWith(":host-context(:root[data-tema='claro'])"));
      expect(unscoped).toEqual(['.auth-split__wordmark-ink']);
    });
  });
});

describe('AuthSplit · escena calm', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: ThemeService, useClass: ThemeServiceFalso }],
    }).compileComponents();

    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    host.scene.set('calm');
    await fixture.whenStable();
  });

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('no dibuja escenario, aurora ni constelación: nada se mueve solo', () => {
    expect(root().querySelector('.auth-split')?.classList).toContain('auth-split--calm');
    expect(root().querySelector('app-auth-stage')).toBeNull();
    expect(root().querySelector('.auth-split__aurora')).toBeNull();
    expect(root().querySelector('.auth-split__pulse')).toBeNull();
  });

  it('la marca lleva el glifo y «AloVida» con «Alo» y «Vida» en tonos distintos', () => {
    const marca = root().querySelector('.auth-split__wordmark app-brand-mark');

    expect(marca?.querySelector('.brand-mark__glyph')).not.toBeNull();
    expect(marca?.querySelector('.brand-mark__alo')?.textContent).toBe('Alo');
    expect(marca?.querySelector('.brand-mark__vida')?.textContent).toBe('Vida');
    // Dos `<span>` contiguos, sin espacio: el lector anuncia «AloVida» de corrido.
    expect(marca?.querySelector('.brand-mark__word')?.textContent?.trim()).toBe('AloVida');
  });

  it('en calm la marca va grande y late una vez', () => {
    const marca = root().querySelector('.auth-split__wordmark .brand-mark');

    expect(marca?.classList).toContain('brand-mark--lg');
    expect(marca?.classList).toContain('brand-mark--beat');
  });

  it('la píldora de la cabecera trae la marca completa, no un ícono suelto', () => {
    const pildora = root().querySelector('.auth-split__marca-mini');

    expect(pildora?.querySelector('.brand-mark__glyph')?.getAttribute('aria-hidden')).toBe('true');
    expect(pildora?.querySelector('.brand-mark__word')?.textContent?.trim()).toBe('AloVida');
    expect(pildora?.querySelector('.brand-mark')?.classList).not.toContain('brand-mark--beat');
  });

  it('muestra las puertas de la red, una por tipo de cuenta', () => {
    expect(root().querySelectorAll('.auth-split__role')).toHaveLength(ACCOUNT_ICON_NAMES.length);
    expect(root().querySelectorAll('.auth-split__role app-account-icon')).toHaveLength(
      ACCOUNT_ICON_NAMES.length,
    );
  });

  it('la onda del latido está en la columna de marca: la línea y el pulso que la recorre', () => {
    expect(root().querySelector('.auth-split__brand .auth-split__ecg-base')).not.toBeNull();
    expect(root().querySelector('.auth-split__brand .auth-split__ecg-pulse')).not.toBeNull();
  });

  describe('franja de onda de las altas', () => {
    it('a ancho completo la columna de marca no se pinta, así que la onda sale en una franja propia', () => {
      host.width.set('full');
      fixture.detectChanges();

      const banda = root().querySelector('.auth-split__banda');
      expect(banda?.getAttribute('aria-hidden')).toBe('true');
      expect(banda?.querySelector('.auth-split__banda-base')).not.toBeNull();
      expect(banda?.querySelector('.auth-split__banda-pulse')).not.toBeNull();
    });

    it('la franja dibuja el pulso sobre la MISMA curva que la línea', () => {
      host.width.set('full');
      fixture.detectChanges();

      const trazos = Array.from(root().querySelectorAll('.auth-split__banda path'));
      expect(new Set(trazos.map((t) => t.getAttribute('d'))).size).toBe(1);
      expect(trazos.every((t) => t.getAttribute('pathLength') === '1000')).toBe(true);
    });

    it('con la columna de marca visible (ancho `wide`) no hay franja: la onda ya está en la columna', () => {
      expect(root().querySelector('.auth-split__banda')).toBeNull();
    });

    it('en las otras escenas tampoco: el escenario ya tiene su latido', () => {
      host.width.set('full');
      host.scene.set('stage');
      fixture.detectChanges();

      expect(root().querySelector('.auth-split__banda')).toBeNull();
    });
  });

  it('las otras escenas no cambian: el logo blanco sigue siendo una imagen', () => {
    host.scene.set('split');
    fixture.detectChanges();

    expect(root().querySelector('.auth-split__wordmark img')).not.toBeNull();
    expect(root().querySelector('.auth-split__wordmark app-brand-mark')).toBeNull();
    expect(root().querySelector('.auth-split__roles')).toBeNull();
  });

  /**
   * jsdom no calcula estilos de componente, así que ningún `querySelector`
   * descubre una clase de la plantilla a la que su hoja dejó sin regla: la
   * lista de puertas se vería apilada y todas las pruebas de arriba pasarían.
   * Esta guarda lee la hoja y exige una regla por cada clase que la escena
   * `calm` dibuja.
   */
  it('cada clase que dibuja la escena tiene su regla en la hoja', () => {
    const css = readFileSync('src/app/shared/components/organisms/auth-split/auth-split.css', 'utf8');
    const clases = [
      'auth-split--calm',
      'auth-split__ecg',
      'auth-split__roles',
      'auth-split__role',
      'auth-split__ecg-base',
      'auth-split__ecg-pulse',
      'auth-split__banda',
      'auth-split__banda-base',
      'auth-split__banda-pulse',
    ];

    for (const clase of clases) {
      expect(css, `falta una regla para .${clase}`).toMatch(new RegExp(`\\.${clase}(?![\\w-])`));
    }
  });
});
