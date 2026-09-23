import { Location } from '@angular/common';
import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { NavigationHistoryService } from '../../../../core/navigation/navigation-history.service';
import { BackLink } from './back-link';

@Component({ template: 'listado' })
class Listado {}

@Component({ template: 'detalle' })
class Detalle {}

@Component({
  imports: [BackLink],
  template: `<app-back-link [fallback]="fallback()" [label]="label()" />`,
})
class Host {
  readonly fallback = signal<string | readonly unknown[]>('/questionnaires');
  readonly label = signal('Volver a las encuestas');
}

/** Sin `label`: el caso que fija el texto por omisión. */
@Component({
  imports: [BackLink],
  template: `<app-back-link fallback="/questionnaires" />`,
})
class HostSinTexto {}

describe('BackLink', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let hayHistorial: WritableSignal<boolean>;
  let volverAtras: ReturnType<typeof vi.spyOn>;
  let router: Router;

  function ancla(): HTMLAnchorElement {
    const element = fixture.nativeElement.querySelector('a');
    if (!(element instanceof HTMLAnchorElement)) {
      throw new Error('el <a> del control no está en el DOM');
    }
    return element;
  }

  /** Un clic como el que hace cualquiera: botón principal y sin modificadores. */
  function clic(init: MouseEventInit = {}): MouseEvent {
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...init,
    });
    ancla().dispatchEvent(event);
    return event;
  }

  beforeEach(async () => {
    hayHistorial = signal(false);

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideRouter([
          { path: 'questionnaires', component: Listado },
          { path: 'questionnaires/:id', component: Detalle },
        ]),
        { provide: NavigationHistoryService, useValue: { hasInternalHistory: hayHistorial } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    volverAtras = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);

    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('es un enlace de verdad', () => {
    it('dibuja un ancla con el destino de respaldo escrito', () => {
      // Es lo que hace que sobreviva al clic con la rueda, a «abrir en pestaña
      // nueva» y al HTML del servidor sin JavaScript.
      expect(ancla().tagName).toBe('A');
      expect(ancla().getAttribute('href')).toBe('/questionnaires');
    });

    it('conserva el destino aunque haya historial que deshacer', async () => {
      hayHistorial.set(true);
      await fixture.whenStable();

      expect(ancla().getAttribute('href')).toBe('/questionnaires');
    });

    it('acepta el destino en forma de comandos, como `routerLink`', async () => {
      host.fallback.set(['/questionnaires', '42']);
      await fixture.whenStable();

      expect(ancla().getAttribute('href')).toBe('/questionnaires/42');
    });

    it('se viste con el mismo botón secundario que las vueltas ya escritas a mano', () => {
      expect(ancla().className).toContain('btn');
      expect(ancla().className).toContain('btn--secondary');
    });

    it('lleva la flecha hacia atrás del set cerrado de íconos', () => {
      expect(ancla().querySelector('app-nav-icon svg')).not.toBeNull();
    });
  });

  describe('sin navegación previa dentro de la aplicación', () => {
    it('no retrocede: no hay paso propio que deshacer', async () => {
      clic();
      await fixture.whenStable();

      expect(volverAtras).not.toHaveBeenCalled();
    });

    it('lleva al destino de respaldo', async () => {
      clic();
      await fixture.whenStable();

      expect(router.url).toBe('/questionnaires');
    });
  });

  describe('con navegación previa dentro de la aplicación', () => {
    beforeEach(async () => {
      hayHistorial.set(true);
      await fixture.whenStable();
    });

    it('intercepta el enlace y deshace el paso que se dio', async () => {
      const event = clic();
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(true);
      expect(volverAtras).toHaveBeenCalledTimes(1);
    });

    it('no navega al respaldo: volver es deshacer, no ir a algo parecido', async () => {
      clic();
      await fixture.whenStable();

      expect(router.url).toBe('/');
    });
  });

  describe('los pedidos que son del navegador y no de la aplicación', () => {
    beforeEach(async () => {
      hayHistorial.set(true);
      await fixture.whenStable();
    });

    it.each([
      ['Ctrl', { ctrlKey: true }],
      ['Meta', { metaKey: true }],
      ['Shift', { shiftKey: true }],
      ['Alt', { altKey: true }],
    ])('no toca el clic con %s: es una pestaña o una descarga', async (_nombre, modificador) => {
      const event = clic(modificador);
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(false);
      expect(volverAtras).not.toHaveBeenCalled();
    });

    it('no toca el clic que no es del botón principal', async () => {
      const event = clic({ button: 1 });
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(false);
      expect(volverAtras).not.toHaveBeenCalled();
    });
  });

  describe('el texto', () => {
    it('es el que le pasa la pantalla', () => {
      expect(ancla().textContent?.trim()).toBe('Volver a las encuestas');
    });

    it('por omisión dice «Volver»', async () => {
      const sinTexto = TestBed.createComponent(HostSinTexto);
      await sinTexto.whenStable();

      const enlace = sinTexto.nativeElement.querySelector('a') as HTMLAnchorElement;
      expect(enlace.textContent?.trim()).toBe('Volver');
    });
  });
});
