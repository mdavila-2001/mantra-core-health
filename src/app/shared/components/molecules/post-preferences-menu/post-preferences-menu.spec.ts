import { Component, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { PostPreferencesMenu } from './post-preferences-menu';
import { POST_PREFERENCE_ENTRIES } from './post-preferences-menu.types';

@Component({ template: '' })
class RutaVacia {}

@Component({
  imports: [PostPreferencesMenu],
  template: `
    <app-post-preferences-menu
      [postLink]="['/p', 'dra-lopez', 'post', 'post-1']"
      [profileLink]="['/p', 'dra-lopez']"
      [hasSession]="haySesion()"
      (hideSimilarRequested)="ocultados = ocultados + 1"
      (reportRequested)="denuncias = denuncias + 1"
      (contactRequested)="contactos = contactos + 1"
    />
  `,
})
class HostComponent {
  readonly haySesion = signal(false);
  ocultados = 0;
  denuncias = 0;
  contactos = 0;
}

describe('PostPreferencesMenu', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let router: Router;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function disparador(): HTMLButtonElement {
    return root().querySelector<HTMLButtonElement>('[data-testid="post-preferences-trigger"]')!;
  }

  /** Los ítems se mudan al `<body>` mientras el menú está abierto. */
  function items(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>('app-menu-item')];
  }

  function item(action: string): HTMLElement | undefined {
    return items().find((i) => i.getAttribute('data-action') === action);
  }

  async function abrir(): Promise<void> {
    disparador().click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([
          { path: 'p/:slug', component: RutaVacia },
          { path: 'p/:slug/post/:postId', component: RutaVacia },
          { path: 'auth', component: RutaVacia },
          { path: 'posts', component: RutaVacia },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    router = TestBed.inject(Router);
    await router.navigateByUrl('/posts');
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('las siete entradas (AC-01-15)', () => {
    it('el disparador tiene nombre accesible y anuncia que abre un menú', () => {
      expect(disparador().getAttribute('aria-label')).toBe('Preferencias de la publicación');
      expect(disparador().getAttribute('aria-haspopup')).toBe('menu');
    });

    it('son exactamente siete, en el orden del pedido', async () => {
      await abrir();
      const rotulos = items().map((i) => i.textContent?.trim());

      expect(rotulos).toEqual([
        'No ver más este tipo de publicaciones',
        'Denunciar',
        'Ir a la publicación',
        'Compartir',
        'Copiar enlace',
        'Contactarme con este doctor',
        'Ir al perfil del doctor',
      ]);
    });

    it('la lista declarada y la dibujada no se separan', async () => {
      await abrir();

      expect(items()).toHaveLength(POST_PREFERENCE_ENTRIES.length);
    });

    it('abrir cambia aria-expanded del disparador', async () => {
      expect(disparador().getAttribute('aria-expanded')).toBe('false');
      await abrir();
      expect(disparador().getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('navegación (AC-01-16)', () => {
    it('«Ir a la publicación» va a la publicación', async () => {
      await abrir();
      item('openPost')?.click();
      await fixture.whenStable();

      expect(router.url).toBe('/p/dra-lopez/post/post-1');
    });

    it('«Ir al perfil del doctor» va al perfil', async () => {
      await abrir();
      item('openProfile')?.click();
      await fixture.whenStable();

      expect(router.url).toBe('/p/dra-lopez');
    });
  });

  describe('sin sesión, las que la exigen mandan a entrar (AC-01-17)', () => {
    it('«Denunciar» lleva a /auth con retorno a donde estaba', async () => {
      await abrir();
      item('report')?.click();
      await fixture.whenStable();

      expect(router.url).toBe('/auth?returnUrl=%2Fposts');
      expect(host.denuncias).toBe(0);
    });

    it('«No ver más» y «Contactarme» hacen lo mismo', async () => {
      await abrir();
      item('hideSimilar')?.click();
      await fixture.whenStable();

      expect(router.url.startsWith('/auth')).toBe(true);
      expect(host.ocultados).toBe(0);
    });

    it('las que NO exigen sesión siguen funcionando sin ella', async () => {
      await abrir();
      item('openProfile')?.click();
      await fixture.whenStable();

      expect(router.url).toBe('/p/dra-lopez');
    });

    it('ninguna entrada se esconde por falta de sesión', async () => {
      await abrir();

      // Esconderlas dejaría a alguien sin sesión sin saber que denunciar existe.
      expect(items()).toHaveLength(7);
    });
  });

  describe('con sesión, las de dominio suben a quien monte el menú', () => {
    beforeEach(async () => {
      host.haySesion.set(true);
      await fixture.whenStable();
    });

    it('«Denunciar» emite en vez de navegar', async () => {
      await abrir();
      item('report')?.click();
      await fixture.whenStable();

      expect(host.denuncias).toBe(1);
      expect(router.url).toBe('/posts');
    });

    it('«No ver más» emite', async () => {
      await abrir();
      item('hideSimilar')?.click();
      await fixture.whenStable();

      expect(host.ocultados).toBe(1);
    });

    it('«Contactarme con este doctor» emite', async () => {
      await abrir();
      item('contactPractitioner')?.click();
      await fixture.whenStable();

      expect(host.contactos).toBe(1);
    });
  });

  describe('teclado (AC-01-18)', () => {
    it('Escape cierra y devuelve el foco al disparador', async () => {
      await abrir();
      expect(disparador().getAttribute('aria-expanded')).toBe('true');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      items()[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();

      expect(disparador().getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(disparador());
    });
  });
});
