import { readFileSync } from 'node:fs';

import { Component, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { PublicPostSummary } from '@core/data-access/public-directory/public-directory.types';

import { PublicacionPost } from './publicacion-post';

const POST_CSS = 'src/app/features/public-profile/publicacion-post/publicacion-post.css';

function unPost(mediaUrls: readonly string[]): PublicPostSummary {
  return {
    id: 'post-1',
    bodyText: 'Tres consejos para cuidar la presión.',
    publishedAt: new Date('2026-08-14T12:00:00.000Z'),
    mediaUrls,
    reactionCount: 4,
    commentCount: 2,
  } as PublicPostSummary;
}

@Component({ template: '' })
class RutaVacia {}

@Component({
  imports: [PublicacionPost],
  template: `
    <app-publicacion-post
      [post]="post()"
      slug="dra-lopez"
      autorNombre="Dra. López"
      autorIniciales="DL"
      [autorEnlazado]="true"
    />
  `,
})
class HostComponent {
  readonly post = signal<PublicPostSummary>(unPost([]));
}

describe('PublicacionPost', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function boton(testId: string): HTMLButtonElement | null {
    return root().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  }

  async function conImagenes(cuantas: number): Promise<void> {
    host.post.set(
      unPost(Array.from({ length: cuantas }, (_, i) => `https://cdn.local/foto-${i}.jpg`)),
    );
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
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('la fecha (AC-01-1)', () => {
    it('no es un enlace', () => {
      const fecha = root().querySelector('.publicacion__fecha');

      expect(fecha).not.toBeNull();
      expect(fecha?.tagName.toLowerCase()).toBe('time');
      expect(fecha?.closest('a')).toBeNull();
    });

    it('conserva el time con datetime, que lo leen el buscador y el lector', () => {
      const fecha = root().querySelector('.publicacion__fecha');

      expect(fecha?.getAttribute('datetime')).toBe('2026-08-14T12:00:00.000Z');
    });

    it('no entra en el orden de tabulación', () => {
      const fecha = root().querySelector('.publicacion__fecha');

      expect(fecha?.hasAttribute('tabindex')).toBe(false);
      expect(fecha?.hasAttribute('href')).toBe(false);
    });
  });

  describe('la galería (AC-01-7, AC-01-8)', () => {
    it('con una sola imagen no dibuja los pasos', async () => {
      await conImagenes(1);

      expect(boton('imagen-anterior')).toBeNull();
      expect(boton('imagen-siguiente')).toBeNull();
    });

    it('con dos o más dibuja los dos botones y el «n de N»', async () => {
      await conImagenes(3);

      expect(boton('imagen-anterior')).not.toBeNull();
      expect(boton('imagen-siguiente')).not.toBeNull();
      expect(root().querySelector('.publicacion__contador')?.textContent?.trim()).toBe('1 de 3');
    });

    it('los botones tienen nombre accesible en castellano', async () => {
      await conImagenes(2);

      expect(boton('imagen-anterior')?.getAttribute('aria-label')).toBe('Imagen anterior');
      expect(boton('imagen-siguiente')?.getAttribute('aria-label')).toBe('Imagen siguiente');
    });

    it('avanza y retrocede, y el contador acompaña', async () => {
      await conImagenes(3);

      boton('imagen-siguiente')?.click();
      await fixture.whenStable();
      expect(root().querySelector('.publicacion__contador')?.textContent?.trim()).toBe('2 de 3');

      boton('imagen-anterior')?.click();
      await fixture.whenStable();
      expect(root().querySelector('.publicacion__contador')?.textContent?.trim()).toBe('1 de 3');
    });

    it('muestra la imagen del índice actual, una sola', async () => {
      await conImagenes(3);
      const imagenes = () => root().querySelectorAll('img.publicacion__imagen');

      expect(imagenes()).toHaveLength(1);
      expect(imagenes()[0]?.getAttribute('src')).toBe('https://cdn.local/foto-0.jpg');

      boton('imagen-siguiente')?.click();
      await fixture.whenStable();
      expect(imagenes()[0]?.getAttribute('src')).toBe('https://cdn.local/foto-1.jpg');
    });

    it('en el primer paso «anterior» queda deshabilitado', async () => {
      await conImagenes(2);

      expect(boton('imagen-anterior')?.disabled).toBe(true);
      expect(boton('imagen-siguiente')?.disabled).toBe(false);
    });

    it('en el último paso «siguiente» queda deshabilitado: no da la vuelta', async () => {
      await conImagenes(2);
      boton('imagen-siguiente')?.click();
      await fixture.whenStable();

      expect(boton('imagen-siguiente')?.disabled).toBe(true);
      expect(boton('imagen-anterior')?.disabled).toBe(false);
    });

    it('el índice se acota si la publicación cambia por otra con menos imágenes', async () => {
      await conImagenes(5);
      boton('imagen-siguiente')?.click();
      boton('imagen-siguiente')?.click();
      boton('imagen-siguiente')?.click();
      await fixture.whenStable();
      expect(root().querySelector('.publicacion__contador')?.textContent?.trim()).toBe('4 de 5');

      // El componente se reutiliza al paginar el feed: sin acotar, acá quedaría
      // pidiendo la imagen 4 de una publicación que tiene 2.
      await conImagenes(2);
      expect(root().querySelector('.publicacion__contador')?.textContent?.trim()).toBe('2 de 2');
      expect(root().querySelector('img.publicacion__imagen')?.getAttribute('src')).toBe(
        'https://cdn.local/foto-1.jpg',
      );
    });

    it('el contador es texto, no sólo un punto de color', async () => {
      await conImagenes(4);

      expect(root().querySelector('.publicacion__contador')?.textContent).toContain('de 4');
    });
  });

  describe('el menú de preferencias (AC-01-15)', () => {
    it('está en la tarjeta, con nombre accesible', () => {
      const disparador = boton('post-preferences-trigger');

      expect(disparador).not.toBeNull();
      expect(disparador?.getAttribute('aria-label')).toBe('Preferencias de la publicación');
    });
  });

  describe('estilo', () => {
    const css = readFileSync(POST_CSS, 'utf8');

    it('no queda scroll libre en la galería (AC-01-7)', () => {
      // Si estas tres vuelven, vuelve el carrusel sin controles que el pedido
      // señala como defecto.
      const reglas = css.replace(/\/\*[\s\S]*?\*\//g, '');

      expect(reglas).not.toContain('scroll-snap-type');
      expect(reglas).not.toContain('overflow-x: auto');
    });

    it('los pasos tienen 44 px de área táctil', () => {
      const paso = css.slice(css.indexOf('.publicacion__paso {'));

      expect(paso).toContain('inline-size: 44px');
      expect(paso).toContain('block-size: 44px');
    });
  });
});
