import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SessionStore } from '@core/auth/session.store';
import { FollowStore } from '@core/social/follow.store';
import { OwnProfileStore } from '@core/social/own-profile.store';
import { ProfileSummaryStore } from '@core/social/profile-summary.store';
import { ToastService } from '@shared/components/molecules/toast/toast.service';

import { FollowButton } from './follow-button';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class RutaVacia {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FollowButton],
  template: `<app-follow-button [slug]="slug()" [perfilId]="perfilId()" nombre="Dra. López" />`,
})
class Host {
  readonly slug = signal('dra-lopez');
  readonly perfilId = signal<string | null>(null);
}

describe('FollowButton', () => {
  let fixture: ComponentFixture<Host>;
  const sigue = signal(new Set<string>());
  let seguimientos: {
    sigue: (id: string) => boolean;
    ocupado: () => boolean;
    cargado: ReturnType<typeof signal<boolean>>;
    seguir: ReturnType<typeof vi.fn>;
    dejarDeSeguir: ReturnType<typeof vi.fn>;
  };
  let avisos: { error: ReturnType<typeof vi.fn> };
  let resumenes: { idPorSlug: ReturnType<typeof vi.fn> };

  async function montar(opciones: { autenticado?: boolean; propio?: { id: string; slug: string } | null; cargado?: boolean } = {}): Promise<void> {
    sigue.set(new Set());
    seguimientos = {
      sigue: (id) => sigue().has(id),
      ocupado: () => false,
      cargado: signal(opciones.cargado ?? true),
      seguir: vi.fn((id: string) => {
        sigue.update((s) => new Set(s).add(id));
        return of(undefined);
      }),
      dejarDeSeguir: vi.fn((id: string) => {
        sigue.update((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        return of(undefined);
      }),
    };
    avisos = { error: vi.fn() };
    resumenes = { idPorSlug: vi.fn(() => 'perfil-lopez') };
    const propio = opciones.propio === undefined ? { id: 'pp-1', slug: 'yo' } : opciones.propio;

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideRouter([
          { path: 'auth', component: RutaVacia },
          { path: 'my-account/profile/edit', component: RutaVacia },
        ]),
        { provide: SessionStore, useValue: { isAuthenticated: signal(opciones.autenticado ?? true) } },
        { provide: OwnProfileStore, useValue: { id: signal(propio?.id ?? null), perfil: signal(propio) } },
        { provide: FollowStore, useValue: seguimientos },
        { provide: ProfileSummaryStore, useValue: resumenes },
        { provide: ToastService, useValue: avisos },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  }

  afterEach(() => fixture?.destroy());

  const boton = (): HTMLButtonElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector('[data-testid="follow-button"]');
  const clic = async (): Promise<void> => {
    boton()?.click();
    await fixture.whenStable();
  };

  it('dice «Seguir» con nombre accesible que nombra a la persona', async () => {
    await montar();

    expect(boton()?.textContent).toContain('Seguir');
    expect(boton()?.getAttribute('aria-label')).toBe('Seguir a Dra. López');
    expect(boton()?.getAttribute('aria-pressed')).toBe('false');
  });

  it('seguir resuelve el id por slug, lo sigue y pasa a «Siguiendo»', async () => {
    await montar();

    await clic();

    expect(resumenes.idPorSlug).toHaveBeenCalledWith('dra-lopez');
    expect(seguimientos.seguir).toHaveBeenCalledWith('perfil-lopez');
    expect(boton()?.textContent).toContain('Siguiendo');
    expect(boton()?.getAttribute('aria-pressed')).toBe('true');
    expect(boton()?.getAttribute('aria-label')).toBe('Dejar de seguir a Dra. López');
  });

  it('volver a tocarlo deja de seguir', async () => {
    await montar();
    await clic();

    await clic();

    expect(seguimientos.dejarDeSeguir).toHaveBeenCalledWith('perfil-lopez');
    expect(boton()?.textContent).toContain('Seguir');
  });

  it('si ya se conoce el id no lo resuelve por slug', async () => {
    await montar();
    fixture.componentInstance.perfilId.set('perfil-conocido');
    await fixture.whenStable();
    // Antes de conocerlo el botón sí lo había resuelto por slug; desde que se lo pasan, no.
    resumenes.idPorSlug.mockClear();

    await clic();

    expect(seguimientos.seguir).toHaveBeenCalledWith('perfil-conocido');
    expect(resumenes.idPorSlug).not.toHaveBeenCalled();
  });

  it('si falla lo dice con un aviso accionable', async () => {
    await montar();
    seguimientos.seguir.mockReturnValue(throwError(() => new Error('500')));

    await clic();

    expect(avisos.error).toHaveBeenCalledWith(expect.stringContaining('No pudimos seguir'));
  });

  it('no se dibuja en el propio perfil', async () => {
    await montar({ propio: { id: 'pp-1', slug: 'dra-lopez' } });

    expect(boton()).toBeNull();
  });

  it('sin sesión se ve igual y manda a entrar con retorno, sin resolver nada', async () => {
    await montar({ autenticado: false, propio: null });

    await clic();

    expect(TestBed.inject(Router).url).toContain('/auth');
    expect(resumenes.idPorSlug).not.toHaveBeenCalled();
    expect(seguimientos.seguir).not.toHaveBeenCalled();
  });

  it('con sesión pero sin vitrina pública lleva a crearla', async () => {
    await montar({ propio: null });

    await clic();

    expect(TestBed.inject(Router).url).toBe('/my-account/profile/edit');
    expect(seguimientos.seguir).not.toHaveBeenCalled();
  });

  it('mientras no se leyó a quién sigue queda bloqueado (aria-disabled) y no envía', async () => {
    await montar({ cargado: false });

    expect(boton()?.getAttribute('aria-disabled')).toBe('true');
  });
});
