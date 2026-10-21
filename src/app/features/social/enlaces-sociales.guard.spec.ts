import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { firstValueFrom, isObservable, of, throwError, type Observable } from 'rxjs';

import { CommunityClient } from '../../core/data-access/community/community.client';
import { feedHeredadoGuard, publicacionPorIdGuard } from './enlaces-sociales.guard';

type Cliente = Partial<Record<'readPost' | 'readProfile', ReturnType<typeof vi.fn>>>;

function instantanea(
  query: Record<string, string>,
  params: Record<string, string> = {},
): ActivatedRouteSnapshot {
  return {
    queryParamMap: { get: (clave: string) => query[clave] ?? null },
    paramMap: { get: (clave: string) => params[clave] ?? null },
  } as unknown as ActivatedRouteSnapshot;
}

function armar(cliente: Cliente): void {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: CommunityClient, useValue: cliente }],
  });
}

async function correr(
  guard: CanActivateFn,
  query: Record<string, string>,
  params: Record<string, string> = {},
): Promise<string> {
  const resultado = TestBed.runInInjectionContext(() =>
    guard(instantanea(query, params), {} as RouterStateSnapshot),
  );
  const valor = isObservable(resultado)
    ? await firstValueFrom(resultado as Observable<UrlTree | boolean>)
    : await Promise.resolve(resultado);
  return TestBed.inject(Router).serializeUrl(valor as UrlTree);
}

const publicacion = { id: 'post-1', authorPublicProfileId: 'perfil-9' };
const medica = { id: 'perfil-9', slug: 'dra-rojas', kind: 'PRACTITIONER' };

describe('feedHeredadoGuard — la dirección vieja del muro', () => {
  it('/feed a secas lleva a /posts sin leer nada', async () => {
    const readPost = vi.fn();
    armar({ readPost });

    expect(await correr(feedHeredadoGuard, {})).toBe('/posts');
    expect(readPost).not.toHaveBeenCalled();
  });

  it('un `post` vacío se trata como ausente', async () => {
    armar({ readPost: vi.fn() });

    expect(await correr(feedHeredadoGuard, { post: '' })).toBe('/posts');
  });

  it('/feed?post=<id> lleva a la publicación suelta de su autor', async () => {
    const readPost = vi.fn(() => of(publicacion));
    const readProfile = vi.fn(() => of(medica));
    armar({ readPost, readProfile });

    expect(await correr(feedHeredadoGuard, { post: 'post-1' })).toBe('/p/dra-rojas/post/post-1');
    expect(readPost).toHaveBeenCalledWith('post-1');
    expect(readProfile).toHaveBeenCalledWith('perfil-9');
  });

  it('un autor sin ficha pública (paciente) cae en /posts: esa URL no existe', async () => {
    armar({
      readPost: vi.fn(() => of(publicacion)),
      readProfile: vi.fn(() => of({ id: 'perfil-9', slug: 'ana', kind: 'PATIENT' })),
    });

    expect(await correr(feedHeredadoGuard, { post: 'post-1' })).toBe('/posts');
  });

  it('si la publicación ya no existe cae en /posts en vez de dar error', async () => {
    armar({ readPost: vi.fn(() => throwError(() => new Error('404'))) });

    expect(await correr(feedHeredadoGuard, { post: 'post-1' })).toBe('/posts');
  });

  it('si falla la lectura del autor cae en /posts', async () => {
    armar({
      readPost: vi.fn(() => of(publicacion)),
      readProfile: vi.fn(() => throwError(() => new Error('500'))),
    });

    expect(await correr(feedHeredadoGuard, { post: 'post-1' })).toBe('/posts');
  });
});

describe('publicacionPorIdGuard — lo que abre un aviso de la red social', () => {
  it('si el id es una publicación, abre su vista suelta', async () => {
    armar({ readPost: vi.fn(() => of(publicacion)), readProfile: vi.fn(() => of(medica)) });

    expect(await correr(publicacionPorIdGuard, {}, { postId: 'post-1' })).toBe(
      '/p/dra-rojas/post/post-1',
    );
  });

  it('si no es una publicación y se sabe quién actuó, abre la ficha de esa persona', async () => {
    const readPost = vi.fn(() => throwError(() => new Error('404')));
    const readProfile = vi.fn(() => of({ id: 'perfil-3', slug: 'clinica-olivos', kind: 'ORGANIZATION' }));
    armar({ readPost, readProfile });

    expect(await correr(publicacionPorIdGuard, { actor: 'perfil-3' }, { postId: 'seguimiento-7' })).toBe(
      '/o/clinica-olivos',
    );
    expect(readProfile).toHaveBeenCalledWith('perfil-3');
  });

  it('quien actuó es un paciente (sin ficha pública): cae en el inicio, no en una URL inexistente', async () => {
    armar({
      readPost: vi.fn(() => throwError(() => new Error('404'))),
      readProfile: vi.fn(() => of({ id: 'perfil-4', slug: 'ana', kind: 'PATIENT' })),
    });

    expect(await correr(publicacionPorIdGuard, { actor: 'perfil-4' }, { postId: 'x' })).toBe('/posts');
  });

  it('si no es una publicación y no se sabe quién actuó, cae en el inicio', async () => {
    armar({ readPost: vi.fn(() => throwError(() => new Error('404'))) });

    expect(await correr(publicacionPorIdGuard, {}, { postId: 'x' })).toBe('/posts');
  });

  it('si tampoco se puede leer a quien actuó, cae en el inicio', async () => {
    armar({
      readPost: vi.fn(() => throwError(() => new Error('404'))),
      readProfile: vi.fn(() => throwError(() => new Error('500'))),
    });

    expect(await correr(publicacionPorIdGuard, { actor: 'perfil-3' }, { postId: 'x' })).toBe('/posts');
  });
});
