import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import type { OwnPublicProfile } from '@core/data-access/community/community.types';

import { FeedCrearPublicacion } from './feed-crear-publicacion';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class RutaVacia {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FeedCrearPublicacion],
  template: `<app-feed-crear-publicacion
    [perfil]="perfil"
    [resuelto]="resuelto"
    (publicado)="publicados.push($event)"
  />`,
})
class Host {
  perfil: OwnPublicProfile | null = { id: 'pp-1', displayName: 'Valeria Rojas', slug: 'vrojas' } as OwnPublicProfile;
  resuelto = true;
  publicados: string[] = [];
}

describe('FeedCrearPublicacion — la barra «Crear publicación»', () => {
  let fixture: ComponentFixture<Host>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);

  async function montar(opciones: Partial<Pick<Host, 'perfil' | 'resuelto'>> = {}, roles: string[] = ['PRACTITIONER']): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideRouter([{ path: 'my-account/profile/edit', component: RutaVacia }, { path: 'my-account/articles', component: RutaVacia }]),
        { provide: SessionStore, useValue: { displayName: () => 'Valeria', roles: () => roles } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    Object.assign(fixture.componentInstance, opciones);
    await fixture.whenStable();
  }

  afterEach(() => fixture?.destroy());

  it('la pastilla abre el modal de crear (no un formulario en la página)', async () => {
    await montar();
    expect(q('content-dialog')).toBeNull();

    q('feed-crear-abrir')?.click();
    await fixture.whenStable();

    expect(q('content-dialog')).not.toBeNull();
    expect(q('post-composer')).not.toBeNull();
    expect(q('post-composer-author')?.textContent).toContain('Valeria Rojas');
  });

  it('«Foto» abre el mismo modal', async () => {
    await montar();

    q('feed-crear-foto')?.click();
    await fixture.whenStable();

    expect(q('post-composer-media')).not.toBeNull();
  });

  it('cerrar el modal vuelve a la barra y la deja lista para abrir de nuevo', async () => {
    await montar();
    q('feed-crear-abrir')?.click();
    await fixture.whenStable();

    q('content-dialog-close')?.click();
    await fixture.whenStable();

    expect(q('content-dialog')).toBeNull();
    expect(q('feed-crear-abrir')).not.toBeNull();
  });

  it('mientras no se sabe si hay vitrina muestra un esqueleto, no un «cree su vitrina» falso', async () => {
    await montar({ resuelto: false, perfil: null });

    expect(q('feed-crear-abrir')).toBeNull();
    expect(q('feed-crear-sin-vitrina')).toBeNull();
    expect(root().querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('sin vitrina pública invita a crearla, con enlace', async () => {
    await montar({ perfil: null });

    const enlace = q('feed-crear-sin-vitrina');
    expect(enlace?.getAttribute('href')).toBe('/my-account/profile/edit');
    expect(q('feed-crear-abrir')).toBeNull();
  });

  it('quien escribe artículos ve «Escribir artículo» como enlace a su pantalla', async () => {
    await montar({}, ['PRACTITIONER']);

    expect(q('feed-escribir-articulo')?.getAttribute('href')).toBe('/my-account/articles');
  });
});
