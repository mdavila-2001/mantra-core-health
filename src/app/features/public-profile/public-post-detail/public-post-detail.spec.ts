import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import type { PublicProfileDetail } from '@core/data-access/public-directory/public-directory.types';
import { PublicPostDetail } from './public-post-detail';

/**
 * Una publicación suelta de una ficha pública (`/p/:slug/post/:postId`). La
 * ficha llega resuelta por el resolver; si el post no está en ella se dice
 * («no está disponible») con un enlace al perfil, y si la ficha no existe,
 * al buscador. Nunca una pantalla en blanco.
 */

const PERFIL = {
  slug: 'dra-lopez',
  displayName: 'Dra. Ana López',
  headline: 'Cardióloga',
  avatarUrl: null,
  posts: [
    { id: 'post-1', bodyText: 'Cuide su presión.', publishedAt: new Date('2026-10-01T12:00:00Z'), mediaUrls: [], reactionCount: 0, commentCount: 0 },
  ],
} as unknown as PublicProfileDetail;

describe('PublicPostDetail', () => {
  let fixture: ComponentFixture<PublicPostDetail>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function pintar(perfil: PublicProfileDetail | null, postId: string): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            data: new BehaviorSubject({ perfil }),
            paramMap: new BehaviorSubject(convertToParamMap({ slug: 'dra-lopez', postId })),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(PublicPostDetail);
    fixture.detectChanges();
  }

  it('con el post en la ficha lo muestra con su autor y enlace de vuelta al perfil', () => {
    pintar(PERFIL, 'post-1');
    expect(root().querySelector('app-public-post-card')).not.toBeNull();
    expect(root().textContent).toContain('Cuide su presión.');
    const volver = root().querySelector('a')!;
    expect(volver.getAttribute('href')).toBe('/p/dra-lopez');
    expect(volver.textContent).toContain('Volver al perfil de Dra. Ana López');
  });

  it('un post que no está en la ficha se dice, con enlace al perfil', () => {
    pintar(PERFIL, 'otro');
    expect(root().querySelector('app-public-post-card')).toBeNull();
    expect(root().textContent).toContain('Esta publicación no está disponible.');
    expect(Array.from(root().querySelectorAll('a')).some((a) => a.textContent?.trim() === 'Ver el perfil')).toBe(true);
  });

  it('sin ficha: título que lo dice y vuelta al buscador', () => {
    pintar(null, 'post-1');
    expect(root().querySelector('h1')?.textContent).toBe('Esa publicación no está disponible');
    expect(root().querySelector('a')?.getAttribute('href')).toBe('/search');
  });
});
