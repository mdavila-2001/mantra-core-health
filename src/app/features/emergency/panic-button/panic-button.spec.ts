import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  TRUSTED_AMBULANCE_STORAGE,
  type AmbulanciaDeConfianza,
  type TrustedAmbulanceStorageAdapter,
} from '@core/emergency/trusted-ambulance.store';
import { PHONE_DIALER, PanicButton } from './panic-button';

class MemoryStorage implements TrustedAmbulanceStorageAdapter {
  constructor(private valor: AmbulanciaDeConfianza | null = null) {}
  read(): AmbulanciaDeConfianza | null {
    return this.valor;
  }
  write(_clave: string, ambulancia: AmbulanciaDeConfianza | null): void {
    this.valor = ambulancia;
  }
}

describe('PanicButton', () => {
  let llamadas: string[];

  function montar(guardada: AmbulanciaDeConfianza | null) {
    llamadas = [];
    TestBed.configureTestingModule({
      imports: [PanicButton],
      providers: [
        { provide: TRUSTED_AMBULANCE_STORAGE, useValue: new MemoryStorage(guardada) },
        { provide: PHONE_DIALER, useValue: (enlace: string) => llamadas.push(enlace) },
      ],
    });
    const fixture = TestBed.createComponent(PanicButton);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  it('con ambulancia de confianza, un toque llama directo y no muestra la lista', () => {
    const { fixture, html } = montar({ nombre: 'Ambulancias de mi seguro', telefono: '+591 70012345' });
    const boton = html.querySelector<HTMLButtonElement>('[data-testid="boton-emergencia"]')!;
    expect(boton.getAttribute('aria-label')).toBe('Emergencia: llamar a Ambulancias de mi seguro');
    boton.click();
    fixture.detectChanges();
    expect(llamadas).toEqual(['tel:+59170012345']);
    expect(html.querySelector('[data-testid="dialogo-emergencia"]')?.hasAttribute('open')).toBe(false);
  });

  it('sin ambulancia de confianza, un toque abre los números oficiales, cada uno con su enlace tel:', () => {
    const { fixture, html } = montar(null);
    html.querySelector<HTMLButtonElement>('[data-testid="boton-emergencia"]')!.click();
    fixture.detectChanges();
    expect(llamadas).toEqual([]);
    expect(html.querySelector('[data-testid="dialogo-emergencia"]')?.hasAttribute('open')).toBe(true);
    expect(html.querySelector('[data-testid="emergencia-emergencias-168"]')?.getAttribute('href')).toBe('tel:168');
    expect(html.querySelector('[data-testid="emergencia-sisme-santa-cruz"]')?.getAttribute('href')).toBe('tel:160');
  });

  it('compacto queda en el ícono, sin perder el nombre ni el comportamiento', () => {
    const { fixture, html } = montar(null);
    fixture.componentRef.setInput('compacto', true);
    fixture.detectChanges();
    const boton = html.querySelector<HTMLButtonElement>('[data-testid="boton-emergencia"]')!;
    expect(boton.textContent?.trim()).toBe('');
    expect(boton.querySelector('svg')).not.toBeNull();
    expect(boton.getAttribute('aria-label')).toBe('Emergencia: ver los números de ambulancia');
    boton.click();
    fixture.detectChanges();
    expect(html.querySelector('[data-testid="dialogo-emergencia"]')?.hasAttribute('open')).toBe(true);
  });

  it('sin un clic no llama: montarse con ambulancia de confianza no marca nada', async () => {
    const { fixture } = montar({ nombre: 'Ambulancias de mi seguro', telefono: '+591 70012345' });

    // Que corran los efectos y los `afterNextRender` del montaje: nada de eso es un gesto.
    await fixture.whenStable();
    fixture.detectChanges();

    expect(llamadas).toEqual([]);
  });

  it('cerrar deja el diálogo cerrado', () => {
    const { fixture, html } = montar(null);
    html.querySelector<HTMLButtonElement>('[data-testid="boton-emergencia"]')!.click();
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('[data-testid="dialogo-emergencia-cerrar"]')!.click();
    fixture.detectChanges();
    expect(html.querySelector('[data-testid="dialogo-emergencia"]')?.hasAttribute('open')).toBe(false);
  });
});

/**
 * La ambulancia de confianza leída de `localStorage`, como en el navegador: es el caso que
 * convertía la carga de «Mi perfil» en «¿Abrir Teléfono?» si algo llamaba sin un gesto.
 */
describe('PanicButton con la ambulancia guardada en el dispositivo', () => {
  /** La clave de `trusted-ambulance.store.ts`: el dato tal como lo deja el registro. */
  const TRUSTED_AMBULANCE_KEY = 'alovida.ambulancia-de-confianza';
  let dialed: string[];

  beforeEach(() => {
    dialed = [];
    localStorage.setItem(
      TRUSTED_AMBULANCE_KEY,
      JSON.stringify({ nombre: 'Ambulancias de mi seguro', telefono: '+591 70012345' }),
    );
    TestBed.configureTestingModule({
      imports: [PanicButton],
      providers: [{ provide: PHONE_DIALER, useValue: (link: string) => dialed.push(link) }],
    });
  });

  afterEach(() => {
    localStorage.removeItem(TRUSTED_AMBULANCE_KEY);
  });

  it('montarse no llama; el clic sí, al número guardado', async () => {
    const fixture = TestBed.createComponent(PanicButton);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dialed).toEqual([]);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="boton-emergencia"]')!
      .click();

    expect(dialed).toEqual(['tel:+59170012345']);
  });
});

/**
 * El marcador de verdad: `location.assign` sólo ocurre cuando alguien lo invoca, nunca al
 * resolverlo. Con eso y el `activar()` de arriba, `tel:` sólo se abre detrás de un clic.
 */
describe('PHONE_DIALER', () => {
  it('resolverlo no navega; invocarlo navega al enlace que recibe', () => {
    const assigned: string[] = [];
    const fakeDocument = {
      defaultView: { location: { assign: (link: string) => assigned.push(link) } },
    };
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: fakeDocument }] });

    const dial = TestBed.inject(PHONE_DIALER);
    expect(assigned).toEqual([]);

    dial('tel:+59170012345');
    expect(assigned).toEqual(['tel:+59170012345']);
  });
});
