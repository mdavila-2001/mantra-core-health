import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { PharmacyDetail } from '../../../core/data-access/pharmacy/pharmacy.types';
import { SAMPLE_DATA_ENABLED } from '../../../core/mock/sample-data';
import { DOCUMENTOS_DE_EJEMPLO } from './pharmacy-profile.fixtures';
import {
  PharmacyProfile,
  avisoDeLaCarpeta,
  companyFromPharmacyDetail,
  estadoDeLaCarpeta,
} from './pharmacy-profile';
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
        provideHttpClient(),
        provideHttpClientTesting(),
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

  afterEach(() => {
    fixture.destroy();
    // Sobre la maqueta la ficha no toca la red: ni una sola petición.
    TestBed.inject(HttpTestingController).verify();
  });

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

  describe('companyFromPharmacyDetail', () => {
    it('toma la razón social y deja en null lo que el directorio no publica', () => {
      expect(companyFromPharmacyDetail(DETALLE)).toEqual({
        razonSocial: 'Farmacia Andina S.R.L.',
        tipoDeSociedad: null,
        nit: null,
        direccionLegal: null,
        puntoCentral: null,
      });
    });

    it('una sede con dirección y punto no se hace pasar por la central', () => {
      const empresa = companyFromPharmacyDetail(DETALLE);

      expect(empresa.direccionLegal).toBeNull();
      expect(empresa.puntoCentral).toBeNull();
    });
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
      const enOrden = DOCUMENTOS_DE_EJEMPLO.filter(
        (documento) => (documento.diasParaVencer ?? 0) > 60,
      );

      expect(avisoDeLaCarpeta(enOrden)).toBeNull();
    });

    it('un papel sin vencimiento declarado no dispara ningún aviso', () => {
      const recienCargado = {
        ...DOCUMENTOS_DE_EJEMPLO[0],
        emitidoEl: null,
        venceEl: null,
        diasParaVencer: null,
      };

      expect(avisoDeLaCarpeta([recienCargado])).toBeNull();
    });

    it('lo vencido manda sobre lo que está por vencer: interrumpe', () => {
      expect(avisoDeLaCarpeta(DOCUMENTOS_DE_EJEMPLO)?.tono).toBe('error');
    });

    it('sólo con papeles por vencer, el aviso espera su turno', () => {
      const porVencer = DOCUMENTOS_DE_EJEMPLO.filter(
        (documento) =>
          documento.diasParaVencer !== null &&
          documento.diasParaVencer >= 0 &&
          documento.diasParaVencer <= 30,
      );

      expect(avisoDeLaCarpeta(porVencer)?.tono).toBe('warning');
      expect(avisoDeLaCarpeta(porVencer)?.titulo).toBe('Hay documentos por vencer');
    });

    it('cuenta en singular cuando hay uno solo', () => {
      const unoVencido = DOCUMENTOS_DE_EJEMPLO.filter(
        (documento) => (documento.diasParaVencer ?? 0) < 0,
      );

      expect(avisoDeLaCarpeta(unoVencido)?.mensaje).toContain('1 vencido');
    });
  });
});

/** El perfil tal como lo devuelve `GET /pharmacy/pharmacies/:id`. */
const DETALLE: PharmacyDetail = {
  id: '6a1f0c2e-0000-4000-8000-000000000001',
  code: 'FARM_ANDINA',
  name: 'Farmacia Andina',
  legalName: 'Farmacia Andina S.R.L.',
  type: { code: 'PHARM_TYPE_COMMUNITY', display: 'Comunitaria' },
  siteCount: 1,
  productCount: 12,
  homeDeliveryAvailable: false,
  pickupAvailable: true,
  sites: [
    {
      id: '6a1f0c2e-0000-4000-8000-000000000002',
      code: 'SC-01',
      name: 'Sucursal Centro',
      addressText: 'Av. Cañoto 245',
      latitude: -17.7863,
      longitude: -63.1812,
    },
  ],
};

/**
 * Contra la API real (`production-api`): la empresa sale del directorio de
 * farmacias y nada de la maqueta se asoma — ni el cartel, ni la carpeta, ni
 * la gente.
 */
describe('PharmacyProfile contra la API real', () => {
  let fixture: ComponentFixture<PharmacyProfile>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SAMPLE_DATA_ENABLED, useValue: false },
        {
          provide: CARGADOR_DE_LEAFLET,
          useValue: (() => Promise.resolve(leafletDoblado())) as CargadorDeLeaflet,
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PharmacyProfile);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(): string {
    return root().textContent ?? '';
  }

  function responderDirectorio(items: readonly { id: string; name: string }[]): void {
    const request = http.expectOne('/pharmacy/pharmacies');
    expect(request.request.method).toBe('GET');
    request.flush({
      items: items.map((item) => ({ ...item, code: 'X', siteCount: 1, productCount: 0 })),
      count: items.length,
    });
  }

  function pestanas(): HTMLButtonElement[] {
    return Array.from(root().querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  }

  it('pide la farmacia del tenant y muestra su razón social, sin rótulo de maqueta', () => {
    responderDirectorio([{ id: DETALLE.id, name: DETALLE.name }]);
    http.expectOne(`/pharmacy/pharmacies/${DETALLE.id}`).flush(DETALLE);
    fixture.detectChanges();

    expect(texto()).toContain('Farmacia Andina S.R.L.');
    expect(texto()).not.toContain('Datos de ejemplo');
    // Lo que el directorio no publica se dice, no se rellena.
    expect(texto()).toContain('No disponible');
    expect(texto()).not.toContain('1028394027');
    // Y no se ofrece editar lo que no se puede guardar.
    expect(root().querySelector('[data-testid="ficha-editar-empresa"]')).toBeNull();
  });

  it('mientras llega la respuesta, la empresa está cargando', () => {
    expect(texto()).not.toContain('Farmacia Andina S.R.L.');
    responderDirectorio([{ id: DETALLE.id, name: DETALLE.name }]);
    http.expectOne(`/pharmacy/pharmacies/${DETALLE.id}`).flush(DETALLE);
  });

  it('una farmacia que todavía no está publicada es un vacío con salida, no un error', () => {
    responderDirectorio([]);
    fixture.detectChanges();

    expect(texto()).toContain('Tu farmacia todavía no figura en el directorio publicado');
    expect(texto()).toContain('Ver tu organización');
  });

  it('si el directorio falla, ofrece reintentar y el reintento vuelve a pedir', () => {
    http
      .expectOne('/pharmacy/pharmacies')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const reintentar = Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(
      (boton) => (boton.textContent ?? '').includes('Reintentar'),
    );
    expect(reintentar).toBeDefined();
    reintentar?.click();
    fixture.detectChanges();

    responderDirectorio([]);
  });

  it('la carpeta legal y la gente se dicen no disponibles, sin papeles de ejemplo', () => {
    responderDirectorio([{ id: DETALLE.id, name: DETALLE.name }]);
    http.expectOne(`/pharmacy/pharmacies/${DETALLE.id}`).flush(DETALLE);
    fixture.detectChanges();

    // Ningún aviso de vencimiento: no hay papeles que venzan.
    expect(root().querySelector('[data-testid="ficha-aviso-documentos"]')).toBeNull();

    pestanas()[1].click();
    fixture.detectChanges();
    expect(root().querySelector('[data-testid="profile-documents-unavailable"]')).not.toBeNull();
    expect(root().querySelector('[data-testid="ficha-cargar-primer-documento"]')).toBeNull();
    expect(texto()).not.toContain('Certificado SEDES');

    pestanas()[2].click();
    fixture.detectChanges();
    expect(root().querySelector('[data-testid="profile-people-unavailable"]')).not.toBeNull();
    expect(texto()).not.toContain('María Elena Ortiz Camacho');
  });
});
