import { readFileSync } from 'node:fs';

import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type {
  PublicPage,
  PublicPostReaction,
} from '@core/data-access/public-directory/public-directory.types';

import { PublicPostReactions } from './public-post-reactions';

const DIALOG_CSS = 'src/app/shared/components/organisms/content-dialog/content-dialog.css';

function persona(slug: string, displayName = slug, avatarUrl: string | null = null): PublicPostReaction {
  return {
    slug,
    displayName,
    headline: null,
    avatarUrl,
    kind: 'PRACTITIONER',
    reactionType: 'LIKE',
  };
}

function pagina(
  items: readonly PublicPostReaction[],
  nextCursor: string | null = null,
): PublicPage<PublicPostReaction> {
  return { items, nextCursor, totalHint: null, generatedAt: new Date('2026-09-01T00:00:00Z') };
}

@Component({ template: '' })
class RutaVacia {}

@Component({
  imports: [PublicPostReactions],
  template: `
    <button type="button" id="disparador">4</button>
    <app-public-post-reactions postId="post-1" [total]="4" (cerrado)="cierres = cierres + 1" />
  `,
})
class HostComponent {
  cierres = 0;
}

describe('PublicPostReactions', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let pedidos: { cursor?: string }[];

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function montar(
    lectura: (opciones: { cursor?: string }) => Observable<PublicPage<PublicPostReaction>>,
  ): Promise<void> {
    pedidos = [];
    const directorio = {
      postReactions: (_postId: string, opciones: { cursor?: string } = {}) => {
        pedidos.push(opciones);
        return lectura(opciones);
      },
    };

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([
          { path: 'posts', component: RutaVacia },
          { path: 'p/:slug', component: RutaVacia },
        ]),
        { provide: PublicDirectoryClient, useValue: directorio },
      ],
    }).compileComponents();

    await TestBed.inject(Router).navigateByUrl('/posts');
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture?.destroy();
  });

  describe('la lista (AC-01-9)', () => {
    it('el modal se nombra con el recuento', async () => {
      await montar(() => of(pagina([persona('a')])));

      expect(root().querySelector('[data-testid="content-dialog-title"]')?.textContent?.trim()).toBe(
        '4 reacciones',
      );
    });

    it('lista a cada persona con su nombre visible', async () => {
      await montar(() => of(pagina([persona('lopez', 'Dra. López'), persona('gomez', 'Dr. Gómez')])));

      const nombres = [...root().querySelectorAll('.reacciones__nombre')].map((n) =>
        n.textContent?.trim(),
      );
      expect(nombres).toEqual(['Dra. López', 'Dr. Gómez']);
    });

    it('sin avatar cae a las iniciales, no a un hueco', async () => {
      await montar(() => of(pagina([persona('lopez', 'Dra. Marisol Quispe')])));

      const iniciales = root().querySelector('.reacciones__avatar--iniciales');
      // `MQ` y no `DM`: el tratamiento no cuenta, o media pantalla arrancaría
      // con la misma letra. Es lo que ya hace `inicialesDe`.
      expect(iniciales?.textContent?.trim()).toBe('MQ');
      expect(iniciales?.getAttribute('aria-hidden')).toBe('true');
    });

    it('con avatar dibuja la foto con alt vacío: el nombre ya está al lado', async () => {
      await montar(() =>
        of(pagina([persona('lopez', 'Dra. López', 'https://cdn.local/lopez.jpg')])),
      );

      const foto = root().querySelector<HTMLImageElement>('img.reacciones__avatar');
      expect(foto?.getAttribute('src')).toBe('https://cdn.local/lopez.jpg');
      expect(foto?.getAttribute('alt')).toBe('');
    });

    it('cada persona enlaza a su ficha con el prefijo de su vertical', async () => {
      await montar(() => of(pagina([persona('lopez')])));

      expect(root().querySelector('a.reacciones__enlace')?.getAttribute('href')).toBe('/p/lopez');
    });

    it('pagina por cursor y concatena', async () => {
      let primera = true;
      await montar(() => {
        if (primera) {
          primera = false;
          return of(pagina([persona('a')], 'cursor-2'));
        }
        return of(pagina([persona('b')]));
      });

      expect(root().querySelectorAll('.reacciones__persona')).toHaveLength(1);

      root().querySelector<HTMLButtonElement>('[data-testid="reactions-load-more"]')?.click();
      await fixture.whenStable();

      expect(pedidos[1]?.cursor).toBe('cursor-2');
      expect(root().querySelectorAll('.reacciones__persona')).toHaveLength(2);
    });

    it('sin más páginas no ofrece «Ver más»', async () => {
      await montar(() => of(pagina([persona('a')])));

      expect(root().querySelector('[data-testid="reactions-load-more"]')).toBeNull();
    });
  });

  describe('los cuatro estados', () => {
    it('una lista vacía se explica en vez de quedar en blanco', async () => {
      await montar(() => of(pagina([])));

      expect(root().textContent).toContain('perfil público visible');
    });

    it('un fallo se anuncia y se reintenta', async () => {
      let falla = true;
      await montar(() => (falla ? throwError(() => new Error('caído')) : of(pagina([persona('a')]))));

      expect(root().querySelector('[role="alert"]')?.textContent).toContain(
        'No pudimos leer quiénes reaccionaron',
      );

      falla = false;
      root().querySelector<HTMLButtonElement>('[role="alert"] ~ p button')?.click();
      await fixture.whenStable();

      expect(root().querySelectorAll('.reacciones__persona')).toHaveLength(1);
    });
  });

  describe('el contrato del modal (AC-01-10)', () => {
    it('es un dialog nativo nombrado por su título', async () => {
      await montar(() => of(pagina([persona('a')])));

      const dialogo = root().querySelector('dialog');
      const titulo = root().querySelector('[data-testid="content-dialog-title"]');
      expect(dialogo?.getAttribute('aria-labelledby')).toBe(titulo?.id);
    });

    it('el botón de cierre tiene nombre accesible y avisa al cerrar', async () => {
      await montar(() => of(pagina([persona('a')])));

      const cerrar = root().querySelector<HTMLButtonElement>('[data-testid="content-dialog-close"]');
      expect(cerrar?.textContent?.trim()).toBe('Cerrar');

      cerrar?.click();
      await fixture.whenStable();
      expect(host.cierres).toBe(1);
    });

    it('el que scrollea es el cuerpo del modal, no la página de atrás', () => {
      const css = readFileSync(DIALOG_CSS, 'utf8');
      const cuerpo = css.slice(css.indexOf('.content-dialog__cuerpo'));

      // `showModal()` inertiza lo de atrás y el organismo bloquea el `overflow`
      // del documento; lo que falta es que el modal no crezca más que la
      // pantalla, y eso lo hace su propio `overflow`.
      expect(cuerpo).toContain('overflow');
    });
  });
});
