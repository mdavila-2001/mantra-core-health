import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DOCUMENTOS_DE_EJEMPLO } from './pharmacy-profile.fixtures';
import { PharmacyProfile, avisoDeLaCarpeta, estadoDeLaCarpeta } from './pharmacy-profile';
import { CARGADOR_DE_LEAFLET } from '../../../shared/components/organisms/map/map';
import type { CargadorDeLeaflet } from '../../../shared/components/organisms/map/map';

/** Leaflet doblado: acá se prueba la ficha, no la cartografía. */
function leafletDoblado(): unknown {
  const marcador = {
    bindPopup: () => marcador,
    on: () => marcador,
    addTo: () => marcador,
    getElement: () => document.createElement('div'),
  };
  return {
    map: () => ({
      setView: () => undefined,
      fitBounds: () => undefined,
      remove: () => undefined,
    }),
    tileLayer: () => ({ addTo: () => undefined }),
    layerGroup: () => ({ addTo: () => undefined, remove: () => undefined }),
    marker: () => marcador,
    divIcon: (opciones: unknown) => opciones,
    latLngBounds: (limites: unknown) => limites,
  };
}

describe('PharmacyProfile', () => {
  let fixture: ComponentFixture<PharmacyProfile>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: CARGADOR_DE_LEAFLET,
          useValue: (() => Promise.resolve(leafletDoblado())) as CargadorDeLeaflet,
        },
      ],
    });
    fixture = TestBed.createComponent(PharmacyProfile);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => fixture.destroy());

  function pestanas(): HTMLButtonElement[] {
    return Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  }

  function pestanaActiva(): string {
    return pestanas().find((boton) => boton.getAttribute('aria-selected') === 'true')?.textContent?.trim() ?? '';
  }

  it('tiene un solo encabezado de página y las tres pestañas de la ficha', () => {
    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(pestanas().map((boton) => boton.textContent?.trim())).toEqual([
      'Empresa',
      'Documentos',
      'Representante y gerentes',
    ]);
  });

  it('se abre en «Empresa», que es lo que se viene a mirar', () => {
    expect(pestanaActiva()).toBe('Empresa');
    expect(root.textContent ?? '').toContain('Farmacia Andina S.R.L.');
  });

  it('rotula la ficha entera como maqueta, arriba de todo', () => {
    expect(root.querySelector('app-page-header')?.textContent ?? '').toContain('Datos de ejemplo');
  });

  it('el aviso de la carpeta se ve desde «Empresa» y nombra los papeles', () => {
    const aviso = root.querySelector('[data-testid="ficha-aviso-documentos"]');

    expect(aviso?.textContent ?? '').toContain('Certificado SEDES');
    expect(aviso?.textContent ?? '').toContain('Licencia de funcionamiento');
    expect(aviso?.className).toContain('alert--error');
  });

  it('el aviso lleva a la carpeta, que es de lo que habla', () => {
    root.querySelector<HTMLButtonElement>('[data-testid="ficha-ir-a-documentos"]')?.click();
    fixture.detectChanges();

    expect(pestanaActiva()).toBe('Documentos');
    expect(root.querySelector('[data-testid="ficha-documentos"]')).not.toBeNull();
  });

  it('el poder del representante no se copia: lleva a la carpeta donde está', () => {
    pestanas()[2].click();
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('[data-testid="ficha-ver-poder"]')?.click();
    fixture.detectChanges();

    expect(pestanaActiva()).toBe('Documentos');
    expect(root.textContent ?? '').toContain('Poder del representante legal');
  });

  it('la pestaña que no se ve no existe en el DOM: cada una trae su propio estado', () => {
    expect(root.querySelector('[data-testid="ficha-documentos"]')).toBeNull();
    expect(root.querySelector('[data-testid="ficha-representante"]')).toBeNull();
  });

  describe('estadoDeLaCarpeta', () => {
    it('una carpeta vacía exige una próxima acción, nunca un cartel sin salida', () => {
      const vacia = estadoDeLaCarpeta([]);

      expect(vacia.status).toBe('empty');
      expect(vacia.status === 'empty' ? vacia.nextAction.label : '').toBe(
        'Cargar el primer documento',
      );
    });

    it('con papeles, la carpeta está lista', () => {
      expect(estadoDeLaCarpeta(DOCUMENTOS_DE_EJEMPLO).status).toBe('ready');
    });
  });

  describe('avisoDeLaCarpeta', () => {
    it('sin nada vencido ni por vencer, no hay aviso que dar', () => {
      const enOrden = DOCUMENTOS_DE_EJEMPLO.filter((documento) => documento.diasParaVencer > 60);

      expect(avisoDeLaCarpeta(enOrden)).toBeNull();
    });

    it('lo vencido manda sobre lo que está por vencer: interrumpe', () => {
      expect(avisoDeLaCarpeta(DOCUMENTOS_DE_EJEMPLO)?.tono).toBe('error');
    });

    it('sólo con papeles por vencer, el aviso espera su turno', () => {
      const porVencer = DOCUMENTOS_DE_EJEMPLO.filter(
        (documento) => documento.diasParaVencer >= 0 && documento.diasParaVencer <= 30,
      );

      expect(avisoDeLaCarpeta(porVencer)?.tono).toBe('warning');
      expect(avisoDeLaCarpeta(porVencer)?.titulo).toBe('Hay documentos por vencer');
    });

    it('cuenta en singular cuando hay uno solo', () => {
      const unoVencido = DOCUMENTOS_DE_EJEMPLO.filter(
        (documento) => documento.diasParaVencer < 0,
      );

      expect(avisoDeLaCarpeta(unoVencido)?.mensaje).toContain('1 vencido');
    });
  });
});
