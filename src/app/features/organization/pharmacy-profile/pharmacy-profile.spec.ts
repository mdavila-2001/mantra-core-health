import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type {
  PharmacyContacts,
  PharmacyDetail,
  PharmacyLicensePage,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import { SAMPLE_DATA_ENABLED } from '../../../core/mock/sample-data';
import { DOCUMENTOS_DE_EJEMPLO } from './pharmacy-profile.fixtures';
import {
  PharmacyProfile,
  avisoDeLaCarpeta,
  companyFromPharmacyDetail,
  documentsFromLicenses,
  estadoDeLaCarpeta,
  peopleFromContacts,
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
    it('toma la razón social y deja en null lo que la organización no registró', () => {
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

    it('trae NIT, forma societaria, dirección legal y punto de la central del contrato', () => {
      expect(companyFromPharmacyDetail(DETALLE_CON_FICHA_LEGAL)).toEqual({
        razonSocial: 'Farmacia Andina S.R.L.',
        tipoDeSociedad: 'S.A.',
        nit: '1020304025',
        direccionLegal: 'Calle Comercio 45, Santa Cruz de la Sierra',
        puntoCentral: { lat: -17.7652, lng: -63.1826 },
      });
    });

    it('una forma societaria de otra jurisdicción no se fuerza a una de las ocho', () => {
      const empresa = companyFromPharmacyDetail({
        ...DETALLE_CON_FICHA_LEGAL,
        companyType: { code: 'US_LLC', display: 'Limited liability company (LLC)' },
      });

      expect(empresa.tipoDeSociedad).toBeNull();
    });
  });

  describe('documentsFromLicenses', () => {
    it('pone las licencias en palabras, con número, sede, fechas y el plazo del servidor', () => {
      const [general, deSede, rechazada] = documentsFromLicenses(LICENCIAS.items);

      expect(general).toEqual({
        clave: 'licencia-1',
        nombre: 'Licencia de funcionamiento N.º LF-2026-0187',
        archivo: 'Respaldo cargado',
        emitidoEl: new Date(2026, 0, 15),
        venceEl: new Date(2027, 0, 14),
        diasParaVencer: 110,
        verificacion: 'VERIFICADO',
      });
      expect(deSede?.nombre).toBe('Licencia de funcionamiento N.º SEDES-SC-4411 · Sucursal Centro');
      expect(deSede?.archivo).toBe('Sin respaldo cargado');
      expect(deSede?.verificacion).toBe('PENDIENTE');
      // Un tipo desconocido se nombra con su etiqueta, y sin fechas no hay plazo.
      expect(rechazada?.nombre).toBe('Permiso especial N.º X-1');
      expect(rechazada?.verificacion).toBe('RECHAZADO');
      expect(rechazada?.venceEl).toBeNull();
      expect(rechazada?.diasParaVencer).toBeNull();
    });

    it('la clave es la posición: ningún identificador técnico llega a la pantalla', () => {
      const claves = documentsFromLicenses(LICENCIAS.items).map((documento) => documento.clave);

      expect(claves).toEqual(['licencia-1', 'licencia-2', 'licencia-3']);
      expect(claves.join(' ')).not.toContain(LICENCIAS.items[0]!.id);
    });
  });

  describe('peopleFromContacts', () => {
    it('pone los cargos en palabras y deja null lo que la persona no registró', () => {
      const gente = peopleFromContacts(CONTACTOS);

      expect(gente.status).toBe('ready');
      expect(gente.status === 'ready' ? gente.data : null).toEqual({
        representante: {
          cargo: 'Representante legal',
          nombre: 'María Elena Ortiz Camacho',
          celular: null,
          correo: 'legal@farmaciaandina.bo',
        },
        gerentes: [
          {
            cargo: 'Gerente General',
            nombre: 'Jorge Antonio Vaca Suárez',
            celular: '+591 70011223',
            correo: null,
          },
        ],
      });
    });

    it('sin representante legal registrado es un vacío con salida', () => {
      const gente = peopleFromContacts({ legalRepresentative: null, executives: [] });

      expect(gente.status).toBe('empty');
      expect(gente.status === 'empty' ? gente.message : '').toContain(
        'todavía no registró a su representante legal',
      );
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
  taxId: null,
  companyType: null,
  legalAddressText: null,
  headquarters: null,
};

/** El mismo perfil, con la ficha legal que la organización sí registró. */
const DETALLE_CON_FICHA_LEGAL: PharmacyDetail = {
  ...DETALLE,
  taxId: '1020304025',
  companyType: { code: 'SA', display: 'Corporation (S.A.)' },
  legalAddressText: 'Calle Comercio 45, Santa Cruz de la Sierra',
  headquarters: { latitude: -17.7652, longitude: -63.1826 },
};

/** La carpeta, tal como la devuelve `GET /pharmacy/pharmacies/:id/licenses`. */
const LICENCIAS: PharmacyLicensePage = {
  items: [
    {
      id: '6a1f0c2e-0000-4000-8000-0000000000a1',
      type: { code: 'PHARM_LICENSE_TYPE_OPERATING', display: 'Operating license' },
      number: 'LF-2026-0187',
      siteId: null,
      siteName: null,
      jurisdiction: null,
      validFrom: '2026-01-15',
      validTo: '2027-01-14',
      daysToExpiry: 110,
      verificationStatus: { code: 'PHARM_VERIFICATION_VERIFIED', display: 'Verification verified' },
      evidenceFileId: '6a1f0c2e-0000-4000-8000-0000000000f1',
    },
    {
      id: '6a1f0c2e-0000-4000-8000-0000000000a2',
      type: { code: 'PHARM_LICENSE_TYPE_OPERATING', display: 'Operating license' },
      number: 'SEDES-SC-4411',
      siteId: '6a1f0c2e-0000-4000-8000-000000000002',
      siteName: 'Sucursal Centro',
      jurisdiction: null,
      validFrom: '2025-10-10',
      validTo: '2026-10-09',
      daysToExpiry: 13,
      verificationStatus: { code: 'PHARM_VERIFICATION_PENDING', display: 'Verification pending' },
      evidenceFileId: null,
    },
    {
      id: '6a1f0c2e-0000-4000-8000-0000000000a3',
      type: { code: 'PHARM_LICENSE_TYPE_SPECIAL', display: 'Permiso especial' },
      number: 'X-1',
      siteId: null,
      siteName: null,
      jurisdiction: null,
      validFrom: null,
      validTo: null,
      daysToExpiry: null,
      verificationStatus: { code: 'PHARM_VERIFICATION_REJECTED', display: 'Verification rejected' },
      evidenceFileId: null,
    },
  ],
  count: 3,
};

/** La gente, tal como la devuelve `GET /pharmacy/pharmacies/:id/contacts`. */
const CONTACTOS: PharmacyContacts = {
  legalRepresentative: {
    role: 'LEGAL_REPRESENTATIVE',
    fullName: 'María Elena Ortiz Camacho',
    email: 'legal@farmaciaandina.bo',
    phone: null,
  },
  executives: [
    {
      role: 'GENERAL_MANAGER',
      fullName: 'Jorge Antonio Vaca Suárez',
      email: null,
      phone: '+591 70011223',
    },
  ],
};

/**
 * Contra la API real (`production-api`): cada pestaña lee su parte del
 * contrato, de lectura, y nada de la maqueta se asoma.
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

  /** Las tres partes de la ficha, cada una con lo suyo. */
  function responderFicha(
    detalle: PharmacyDetail = DETALLE_CON_FICHA_LEGAL,
    licencias: PharmacyLicensePage = LICENCIAS,
    contactos: PharmacyContacts = CONTACTOS,
  ): void {
    responderDirectorio([{ id: detalle.id, name: detalle.name }]);
    http.expectOne(`/pharmacy/pharmacies/${detalle.id}`).flush(detalle);
    http.expectOne(`/pharmacy/pharmacies/${detalle.id}/licenses`).flush(licencias);
    http.expectOne(`/pharmacy/pharmacies/${detalle.id}/contacts`).flush(contactos);
    fixture.detectChanges();
  }

  function pestanas(): HTMLButtonElement[] {
    return Array.from(root().querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  }

  it('muestra la ficha legal del contrato, sin rótulo de maqueta ni edición', () => {
    responderFicha();

    expect(texto()).toContain('Farmacia Andina S.R.L.');
    expect(texto()).toContain('1020304025');
    expect(texto()).toContain('S.A.');
    expect(texto()).toContain('Calle Comercio 45, Santa Cruz de la Sierra');
    expect(texto()).not.toContain('Datos de ejemplo');
    expect(texto()).not.toContain('No disponible');
    // Y no se ofrece editar lo que no se puede guardar.
    expect(root().querySelector('[data-testid="ficha-editar-empresa"]')).toBeNull();
  });

  it('lo que la organización no registró se dice, no se rellena', () => {
    responderFicha(DETALLE);

    expect(texto()).toContain('Sin registrar');
    expect(texto()).toContain('Tu organización todavía no registró el punto de la central.');
    expect(texto()).not.toContain('1028394027');
  });

  it('mientras llega la respuesta, la empresa está cargando', () => {
    expect(texto()).not.toContain('Farmacia Andina S.R.L.');
    responderFicha();
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

  it('la carpeta son las licencias, de lectura, con el aviso del plazo que declara el servidor', () => {
    responderFicha();

    // La licencia por vencer (13 días) dispara el aviso, nombrándola.
    const aviso = root().querySelector('[data-testid="ficha-aviso-documentos"]');
    expect(aviso?.textContent).toContain('SEDES-SC-4411');

    pestanas()[1]!.click();
    fixture.detectChanges();
    expect(texto()).toContain('Licencia de funcionamiento N.º LF-2026-0187');
    expect(texto()).toContain('Rechazado');
    // De lectura: ni cargar, ni reemplazar, ni la nota de estados provisionales.
    expect(root().querySelector('[data-testid="ficha-agregar-documento"]')).toBeNull();
    expect(root().querySelector('[data-testid="ficha-nota-verificacion"]')).toBeNull();
    expect(root().querySelector('[data-testid^="ficha-reemplazar-"]')).toBeNull();
    expect(texto()).not.toContain('Datos de ejemplo');
    expect(texto()).not.toContain('Certificado SEDES');
  });

  it('sin licencias registradas, la carpeta lo dice sin ofrecer una carga que no se guarda', () => {
    responderFicha(DETALLE_CON_FICHA_LEGAL, { items: [], count: 0 });

    pestanas()[1]!.click();
    fixture.detectChanges();
    expect(root().querySelector('[data-testid="profile-licenses-empty"]')).not.toBeNull();
    expect(texto()).toContain('Tu farmacia todavía no tiene licencias registradas.');
    expect(root().querySelector('[data-testid="ficha-cargar-primer-documento"]')).toBeNull();
  });

  it('la gente sale del contrato, sin el salto al poder ni rótulo de ejemplo', () => {
    responderFicha();

    pestanas()[2]!.click();
    fixture.detectChanges();
    expect(texto()).toContain('María Elena Ortiz Camacho');
    expect(texto()).toContain('Gerente General');
    expect(root().querySelector('[data-testid="ficha-ver-poder"]')).toBeNull();
    expect(texto()).not.toContain('Datos de ejemplo');
  });

  it('si la carpeta falla (alguien que no es de la farmacia), la empresa se ve igual', () => {
    responderDirectorio([{ id: DETALLE.id, name: DETALLE.name }]);
    http.expectOne(`/pharmacy/pharmacies/${DETALLE.id}`).flush(DETALLE_CON_FICHA_LEGAL);
    http
      .expectOne(`/pharmacy/pharmacies/${DETALLE.id}/licenses`)
      .flush({ message: 'Farmacia no encontrada' }, { status: 404, statusText: 'Not Found' });
    http.expectOne(`/pharmacy/pharmacies/${DETALLE.id}/contacts`).flush(CONTACTOS);
    fixture.detectChanges();

    expect(texto()).toContain('1020304025');
  });
});
