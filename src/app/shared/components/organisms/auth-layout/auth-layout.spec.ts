import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AuthLayout } from './auth-layout';

@Component({
  imports: [AuthLayout],
  template: `
    <app-auth-layout [title]="title()" [subtitle]="subtitle()" [showBrand]="showBrand()">
      <form class="formulario">campos</form>
      <nav auth-footer class="legales">Privacidad</nav>
    </app-auth-layout>
  `,
})
class HostComponent {
  readonly title = signal('Ingresá a tu cuenta');
  readonly subtitle = signal('');
  readonly showBrand = signal(true);
}

describe('AuthLayout', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('estructura', () => {
    it('el título es el único h1 de la página', () => {
      const encabezados = root().querySelectorAll('h1');

      expect(encabezados).toHaveLength(1);
      expect(encabezados[0].textContent?.trim()).toBe('Ingresá a tu cuenta');
    });

    it('el contenido vive dentro de un main con una card', () => {
      const main = root().querySelector('main');

      expect(main).not.toBeNull();
      expect(main?.querySelector('app-card .formulario')).not.toBeNull();
    });

    it('no hay nav de aplicación ni header autenticado', () => {
      expect(root().querySelector('app-side-nav')).toBeNull();
      expect(root().querySelector('app-header')).toBeNull();
      // el único nav permitido es el de los enlaces legales del pie
      expect(root().querySelector('main nav.legales')).not.toBeNull();
    });
  });

  describe('slots e inputs', () => {
    it('el pie proyecta los enlaces legales', () => {
      expect(root().querySelector('.auth-layout__footer .legales')).not.toBeNull();
    });

    it('el subtítulo es opcional', async () => {
      expect(root().querySelector('.auth-layout__subtitle')).toBeNull();

      host.subtitle.set('Red SALUD');
      await fixture.whenStable();

      expect(root().querySelector('.auth-layout__subtitle')?.textContent?.trim()).toBe(
        'Red SALUD',
      );
    });

    it('la marca se puede apagar', async () => {
      expect(root().querySelector('.auth-layout__brand')).not.toBeNull();

      host.showBrand.set(false);
      await fixture.whenStable();

      expect(root().querySelector('.auth-layout__brand')).toBeNull();
    });
  });

  describe('tema', () => {
    it('el selector de tema está disponible antes de entrar', () => {
      const grupo = root().querySelector('[role="group"][aria-label="Tema de la interfaz"]');

      expect(grupo?.querySelectorAll('button')).toHaveLength(3);
    });

    it('el selector vive fuera del main: es chrome, no contenido', () => {
      const grupo = root().querySelector('[role="group"][aria-label="Tema de la interfaz"]');

      expect(grupo?.closest('main')).toBeNull();
    });
  });
});
