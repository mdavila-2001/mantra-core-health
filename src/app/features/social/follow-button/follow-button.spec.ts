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
    fallo: ReturnType<typeof signal<boolean>>;
    estado: (id: string) => boolean | null;
    recargar: ReturnType<typeof vi.fn>;
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
      fallo: signal(false),
      estado: (id) => (!seguimientos.cargado() || seguimientos.fallo() ? null : sigue().has(id)),
      recargar: vi.fn(),
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
    // El nombre no cambia: el estado lo dice `aria-pressed` (no se anuncia dos veces).
    expect(boton()?.getAttribute('aria-label')).toBe('Seguir a Dra. López');
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
    await clic();
    expect(seguimientos.seguir).not.toHaveBeenCalled();
  });

  it('un toque antes de tiempo no se pierde: se cumple cuando llega lo que faltaba, una sola vez', async () => {
    await montar({ cargado: false });

    await clic();
    await clic();
    expect(boton()?.getAttribute('aria-busy')).toBe('true');
    expect(seguimientos.seguir).not.toHaveBeenCalled();

    seguimientos.cargado.set(true);
    await fixture.whenStable();

    expect(seguimientos.seguir).toHaveBeenCalledTimes(1);
    expect(seguimientos.seguir).toHaveBeenCalledWith('perfil-lopez');
    expect(boton()?.textContent).toContain('Siguiendo');
    expect(boton()?.getAttribute('aria-busy')).toBeNull();
  });

  it('si el id todavía se está resolviendo, espera; si no se puede resolver, lo dice', async () => {
    const id = signal<string | null | undefined>(undefined);
    await montar();
    resumenes.idPorSlug.mockImplementation(() => id());
    fixture.componentInstance.slug.set('otra');
    await fixture.whenStable();

    await clic();
    expect(seguimientos.seguir).not.toHaveBeenCalled();

    id.set(null);
    await fixture.whenStable();

    expect(seguimientos.seguir).not.toHaveBeenCalled();
    expect(avisos.error).toHaveBeenCalledWith('No pudimos identificar este perfil. Reintente.');
    expect(boton()?.getAttribute('aria-busy')).toBeNull();
  });

  it('si no se pudo leer a quién sigue, no afirma «no lo sigue» ni manda nada: avisa y relee', async () => {
    await montar();
    seguimientos.fallo.set(true);
    await fixture.whenStable();

    expect(boton()?.hasAttribute('aria-pressed')).toBe(false);
    await clic();

    expect(seguimientos.seguir).not.toHaveBeenCalled();
    expect(avisos.error).toHaveBeenCalledWith('No pudimos saber si ya sigue a este perfil. Vuelva a intentarlo en unos segundos.');
    expect(seguimientos.recargar).toHaveBeenCalledTimes(1);
  });
});
