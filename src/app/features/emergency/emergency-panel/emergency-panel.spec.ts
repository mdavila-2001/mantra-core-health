import { TestBed } from '@angular/core/testing';

import { NUMEROS_DE_EMERGENCIA, enlaceDeLlamada } from '@core/emergency/emergency-numbers';
import {
  TRUSTED_AMBULANCE_STORAGE,
  TrustedAmbulanceStore,
  type AmbulanciaDeConfianza,
  type TrustedAmbulanceStorageAdapter,
} from '@core/emergency/trusted-ambulance.store';
import { EmergencyPanel } from './emergency-panel';

class MemoryStorage implements TrustedAmbulanceStorageAdapter {
  valor: AmbulanciaDeConfianza | null = null;
  read(): AmbulanciaDeConfianza | null {
    return this.valor;
  }
  write(_clave: string, ambulancia: AmbulanciaDeConfianza | null): void {
    this.valor = ambulancia;
  }
}

describe('EmergencyPanel', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    TestBed.configureTestingModule({
      imports: [EmergencyPanel],
      providers: [{ provide: TRUSTED_AMBULANCE_STORAGE, useValue: storage }],
    });
  });

  it('muestra todos los números oficiales, cada uno con su fuente', () => {
    const fixture = TestBed.createComponent(EmergencyPanel);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    for (const numero of NUMEROS_DE_EMERGENCIA) {
      expect(html.querySelector(`[data-testid="emergencia-${numero.id}"]`)?.getAttribute('href')).toBe(`tel:${numero.numero}`);
      expect(numero.url.startsWith('https://')).toBe(true);
    }
    expect(html.textContent).toContain('Ministerio de Salud y Deportes de Bolivia');
  });

  it('con ambulancia de confianza, la ofrece primero', () => {
    TestBed.inject(TrustedAmbulanceStore).guardar('Clínica del barrio', '+591 3 3334444');
    const fixture = TestBed.createComponent(EmergencyPanel);
    fixture.detectChanges();
    const propia = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="emergencia-llamar-propia"]');
    expect(propia?.textContent).toContain('Llamar a Clínica del barrio');
    expect(propia?.getAttribute('href')).toBe('tel:+59133334444');
  });

  it('el store guarda la ambulancia, usa un nombre por defecto y se puede quitar', () => {
    const store = TestBed.inject(TrustedAmbulanceStore);
    store.guardar('', '+591 70012345');
    expect(store.ambulancia()).toEqual({ nombre: 'Mi ambulancia de confianza', telefono: '+591 70012345' });
    expect(storage.valor?.telefono).toBe('+591 70012345');
    store.quitar();
    expect(store.ambulancia()).toBeNull();
    expect(storage.valor).toBeNull();
  });

  it('el enlace de llamada deja sólo dígitos y el + inicial', () => {
    expect(enlaceDeLlamada(' +591 (3) 333-4444 ')).toBe('tel:+59133334444');
    expect(enlaceDeLlamada('800 125 050')).toBe('tel:800125050');
  });
});
