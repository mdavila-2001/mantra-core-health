import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import { FollowStore } from '@core/social/follow.store';
import { OwnProfileStore } from '@core/social/own-profile.store';
import { ProfileSummaryStore } from '@core/social/profile-summary.store';

import { FollowButton } from '../follow-button/follow-button';
import { Network } from './network';

@Component({
  selector: 'app-follow-button',
  template: '<span data-testid="boton-seguir">{{ slug() }}</span>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class SeguirFalso {
  readonly slug = input.required<string>();
  readonly perfilId = input<string | null>(null);
  readonly nombre = input('');
  readonly variante = input('tarjeta');
}

const resumen = (id: string, nombre: string) => ({
  id,
  slug: `slug-${id}`,
  kind: 'PRACTITIONER',
  displayName: nombre,
  headline: `Titular de ${nombre}`,
  avatarUrl: null,
  enlace: ['/p', `slug-${id}`],
});

describe('Network — «Mi red»', () => {
  let fixture: ComponentFixture<Network>;
  const seguidos = signal<readonly string[]>([]);
  const cargado = signal(true);
  const fallo = signal(false);
  const perfilPropio = signal<{ id: string; slug: string } | null>({ id: 'yo', slug: 'yo-mismo' });
  const resumenes = new Map<string, unknown>();
  const recargar = vi.fn();
  let searchPractitioners: ReturnType<typeof vi.fn>;

  function montar(): void {
    searchPractitioners = searchPractitioners ?? vi.fn(() => of({ items: [] }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: FollowStore,
          useValue: { seguidos, total: () => seguidos().length, cargado, fallo, recargar },
        },
        {
          provide: OwnProfileStore,
          useValue: { perfil: perfilPropio, id: () => perfilPropio()?.id ?? null, resuelto: signal(true) },
        },
        { provide: ProfileSummaryStore, useValue: { resumen: (id: string) => resumenes.get(id) } },
        { provide: PublicDirectoryClient, useValue: { searchPractitioners } },
      ],
    });
    TestBed.overrideComponent(Network, {
      remove: { imports: [FollowButton] },
      add: { imports: [SeguirFalso] },
    });
    fixture = TestBed.createComponent(Network);
    fixture.detectChanges();
  }

  const q = (testid: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testid}"]`);

  const pestanaSugerencias = (): void => {
    const tabs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]');
    tabs[1]!.click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    seguidos.set([]);
    cargado.set(true);
    fallo.set(false);
    perfilPropio.set({ id: 'yo', slug: 'yo-mismo' });
    resumenes.clear();
    recargar.mockClear();
    searchPractitioners = vi.fn(() => of({ items: [] }));
  });

  it('lista a quienes sigue, con nombre y titular', () => {
    seguidos.set(['a', 'b']);
    resumenes.set('a', resumen('a', 'Dra. Ana'));
    resumenes.set('b', resumen('b', 'Dr. Beto'));
    montar();

    const filas = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="mi-red-seguido"]');
    expect(filas.length).toBe(2);
    expect(filas[0]!.textContent).toContain('Dra. Ana');
    expect(filas[0]!.textContent).toContain('Titular de Dra. Ana');
  });

  it('vacío: orienta a las sugerencias', () => {
    montar();

    expect(fixture.nativeElement.textContent).toContain('Todavía no sigue a nadie');
    expect(q('mi-red-ir-sugerencias')).not.toBeNull();
  });

  it('sin vitrina propia: dice cómo crearla en vez de mostrar «no sigue a nadie»', () => {
    perfilPropio.set(null);
    montar();

    expect(q('mi-red-sin-vitrina')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Todavía no sigue a nadie');
  });

  it('mientras lee, no afirma que no sigue a nadie', () => {
    cargado.set(false);
    montar();

    expect(fixture.nativeElement.textContent).not.toContain('Todavía no sigue a nadie');
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('error: ofrece reintentar y vuelve a leer', () => {
    fallo.set(true);
    montar();

    const boton = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Reintentar',
    )!;
    boton.click();
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('un perfil que no se pudo leer sigue apareciendo, para poder dejar de seguirlo', () => {
    seguidos.set(['z']);
    resumenes.set('z', null);
    montar();

    const fila = q('mi-red-seguido')!;
    expect(fila.textContent).toContain('Perfil que no pudimos leer');
    expect(fila.querySelector('[data-testid="boton-seguir"]')).not.toBeNull();
  });

  it('las sugerencias se piden al abrir la pestaña, no antes, y sin la propia vitrina', () => {
    searchPractitioners = vi.fn(() =>
      of({
        items: [
          { slug: 'yo-mismo', displayName: 'Yo', headline: null, avatarUrl: null },
          { slug: 'otra', displayName: 'Otra Persona', headline: 'Pediatra', avatarUrl: null },
        ],
      }),
    );
    montar();
    expect(searchPractitioners).not.toHaveBeenCalled();

    pestanaSugerencias();

    expect(searchPractitioners).toHaveBeenCalledTimes(1);
    const lista = q('mi-red-sugerencias')!;
    expect(lista.textContent).toContain('Otra Persona');
    expect(lista.textContent).not.toContain('Yo');
  });

  it('sugerencias con error: dice qué pasó y reintenta', () => {
    searchPractitioners = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('500')))
      .mockReturnValueOnce(of({ items: [{ slug: 'x', displayName: 'Xavier', headline: null, avatarUrl: null }] }));
    montar();
    pestanaSugerencias();
    expect(fixture.nativeElement.textContent).toContain('No pudimos leer las sugerencias');

    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Reintentar')!
      .click();
    fixture.detectChanges();

    expect(q('mi-red-sugerencias')!.textContent).toContain('Xavier');
  });
});
