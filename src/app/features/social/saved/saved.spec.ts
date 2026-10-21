import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CommunityClient } from '@core/data-access/community/community.client';
import { BookmarkStore } from '@core/social/bookmark.store';
import { OwnProfileStore } from '@core/social/own-profile.store';
import { ProfileSummaryStore } from '@core/social/profile-summary.store';

import { PublicPostCard } from '../../public-profile/public-post-card/public-post-card';
import { Saved } from './saved';

@Component({
  selector: 'app-public-post-card',
  template: '<p data-testid="tarjeta">{{ post().bodyText }}</p><button type="button" data-testid="denunciar" (click)="pedidoDeDenuncia.emit(post().id)">Denunciar</button>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TarjetaFalsa {
  readonly post = input.required<{ id: string; bodyText: string }>();
  readonly slug = input('');
  readonly autorNombre = input('');
  readonly autorHeadline = input<string | null>(null);
  readonly autorAvatar = input<string | null>(null);
  readonly autorIniciales = input('');
  readonly autorPerfilId = input<string | null>(null);
  readonly visibilidad = input<string | null>(null);
  readonly reaccionesPorTipo = input<unknown>(null);
  readonly autorEnlazado = input(false);
  readonly actorProfileId = input<string | null>(null);
  readonly conAcciones = input(false);
  readonly pedidoDeDenuncia = output<string>();
  readonly pedidoDeOcultar = output<string>();
  readonly pedidoDeContacto = output<string>();
}

const detalle = (id: string, texto: string) => ({
  id,
  authorPublicProfileId: 'autor-1',
  postTypeConceptId: 't',
  bodyText: texto,
  reactions: { total: 0, tallies: [] },
  commentCount: 0,
  media: [],
  hashtags: [],
  mentions: [],
});

describe('Saved — «Guardados»', () => {
  let fixture: ComponentFixture<Saved>;
  const guardados = signal<readonly string[]>([]);
  const cargado = signal(true);
  const fallo = signal(false);
  const perfil = signal<{ id: string } | null>({ id: 'yo' });
  const recargar = vi.fn();
  const quitar = vi.fn(() => of(undefined));
  let readPost: ReturnType<typeof vi.fn>;

  function montar(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BookmarkStore, useValue: { guardados, cargado, fallo, recargar, quitar } },
        { provide: OwnProfileStore, useValue: { id: () => perfil()?.id ?? null, resuelto: signal(true) } },
        { provide: ProfileSummaryStore, useValue: { resumen: () => undefined } },
        { provide: CommunityClient, useValue: { readPost } },
      ],
    });
    TestBed.overrideComponent(Saved, {
      remove: { imports: [PublicPostCard] },
      add: { imports: [TarjetaFalsa] },
    });
    fixture = TestBed.createComponent(Saved);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  }

  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    guardados.set([]);
    cargado.set(true);
    fallo.set(false);
    perfil.set({ id: 'yo' });
    recargar.mockClear();
    quitar.mockClear();
    readPost = vi.fn((id: string) => of(detalle(id, `texto ${id}`)));
  });

  it('lee cada publicación guardada por su id y la dibuja', () => {
    guardados.set(['p1', 'p2']);
    montar();

    expect(readPost).toHaveBeenCalledWith('p1');
    expect(readPost).toHaveBeenCalledWith('p2');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="tarjeta"]').length).toBe(2);
  });

  it('vacío: dice por qué y qué hacer', () => {
    montar();

    expect(texto()).toContain('Todavía no guardó nada');
    expect(texto()).toContain('Ver publicaciones');
  });

  it('sin vitrina: orienta a crearla', () => {
    perfil.set(null);
    montar();

    expect(texto()).toContain('Cree su vitrina pública');
  });

  it('mientras lee no afirma que está vacío', () => {
    cargado.set(false);
    montar();

    expect(texto()).not.toContain('Todavía no guardó nada');
  });

  it('error: reintentar vuelve a leer', () => {
    fallo.set(true);
    montar();

    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Reintentar')!
      .click();
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('una publicación que ya no se puede leer queda como fila y deja quitarla', () => {
    guardados.set(['p1']);
    readPost = vi.fn(() => throwError(() => new Error('404')));
    montar();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="guardado-no-disponible"]')).not.toBeNull();
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Quitar de guardados')!
      .click();
    expect(quitar).toHaveBeenCalledWith('p1');
  });

  it('no vuelve a leer una publicación que ya tiene', () => {
    guardados.set(['p1']);
    montar();
    guardados.set(['p1', 'p2']);
    fixture.detectChanges();
    TestBed.tick();

    expect(readPost.mock.calls.filter(([id]) => id === 'p1').length).toBe(1);
    expect(readPost).toHaveBeenCalledWith('p2');
  });

  it('denunciar desde una guardada abre el formulario en su lugar', () => {
    guardados.set(['p1']);
    montar();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="denunciar"]')!.click();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('app-report-post')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="tarjeta"]')).toBeNull();
  });
});
