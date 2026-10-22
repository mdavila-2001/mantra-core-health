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

  it('cerrar deja el diálogo cerrado', () => {
    const { fixture, html } = montar(null);
    html.querySelector<HTMLButtonElement>('[data-testid="boton-emergencia"]')!.click();
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('[data-testid="dialogo-emergencia-cerrar"]')!.click();
    fixture.detectChanges();
    expect(html.querySelector('[data-testid="dialogo-emergencia"]')?.hasAttribute('open')).toBe(false);
  });
});
