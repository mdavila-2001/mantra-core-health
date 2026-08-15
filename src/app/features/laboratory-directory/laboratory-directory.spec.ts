import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import {
  aConsulta,
  LaboratoryDirectory,
  type LaboratoryCategoryGroup,
} from './laboratory-directory';

const LAB_ID = '11111111-1111-4111-8111-111111111111';
const IMAGE_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_ID = '33333333-3333-4333-8333-333333333333';
const LAB = {
  id: LAB_ID,
  tenantId: TENANT_ID,
  code: 'LAB-CENTRAL',
  name: 'Laboratorio Central',
  type: { code: 'DU_TYPE_LAB', display: 'Clinical laboratory unit' },
  siteCount: 2,
  equipmentCount: 1,
  studyCount: 3,
  acceptsExternalOrders: true,
  walkInAvailable: true,
  homeCollectionAvailable: true,
  rating: 4.5,
  ratingCount: 12,
  minAmount: 90,
};
const IMAGING = {
  ...LAB,
  id: IMAGE_ID,
  code: 'IMG-CENTRAL',
  name: 'Imagen Diagnóstica',
  type: { code: 'DU_TYPE_IMAGING', display: 'Diagnostic imaging unit' },
  siteCount: 1,
  equipmentCount: 2,
  studyCount: 2,
  homeCollectionAvailable: false,
  rating: null,
  ratingCount: 0,
  minAmount: null,
};

/** La ruta del buscador. El directorio del tenant es otra y no la usa esta pantalla. */
const BUSQUEDA = '/diagnostic-units/search';

describe('LaboratoryDirectory', () => {
  let fixture: ComponentFixture<LaboratoryDirectory>;
  let component: LaboratoryDirectory;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function mount(): void {
    fixture = TestBed.createComponent(LaboratoryDirectory);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function internal<T>(name: string): T {
    const value = (component as unknown as Record<string, unknown>)[name];
    return (typeof value === 'function' ? value.bind(component) : value) as T;
  }

  function status(): string {
    return internal<() => { status: string }>('state')().status;
  }

  function groups(): readonly LaboratoryCategoryGroup[] {
    return internal<() => readonly LaboratoryCategoryGroup[]>('groups')();
  }

  /** Responde la única búsqueda pendiente con una página. */
  function responder(items: readonly unknown[], total = items.length): void {
    http
      .expectOne((request) => request.url === BUSQUEDA)
      .flush({ items, total, limit: 20, offset: 0 });
  }

  it('starts in loading state while the server is authoritative', () => {
    mount();
    expect(status()).toBe('loading');
    responder([]);
  });

  it('asks the platform-wide search, not the tenant directory', () => {
    mount();
    // Es la diferencia que da sentido a la pantalla: el directorio devuelve los
    // laboratorios de la organización de la sesión, y quien busca dónde hacerse
    // un estudio busca en la red entera.
    const pedido = http.expectOne((request) => request.url === BUSQUEDA);
    expect(pedido.request.url).not.toBe('/diagnostic-units');
    pedido.flush({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it('groups units by the existing category codes', () => {
    mount();
    responder([LAB, IMAGING]);

    expect(groups().map((group) => group.name)).toEqual([
      'Imagenología diagnóstica',
      'Laboratorio clínico',
    ]);
    expect(groups().flatMap((group) => group.units)).toHaveLength(2);
  });

  it('links each card to the distinct visual detail route', () => {
    mount();
    responder([LAB]);

    expect(groups()[0].units[0].link).toBe(`/laboratory-directory/${LAB_ID}`);
    expect(groups()[0].units[0].link).not.toContain('/diagnostics');
  });

  it('says "sin calificaciones" instead of a zero the centre never earned', () => {
    mount();
    responder([IMAGING]);

    const textos = (groups()[0].units[0].meta ?? []).map((entrada) => entrada.text);
    expect(textos).toContain('Sin calificaciones');
    expect(textos.join(' ')).not.toContain('0,0');
  });

  it('shows the rating with its review count when there is one', () => {
    mount();
    responder([LAB]);

    const textos = (groups()[0].units[0].meta ?? []).map((entrada) => entrada.text);
    expect(textos).toContain('4,5 · 12 reseñas');
  });

  it('uses the explicit empty state when no unit is publishable', () => {
    mount();
    responder([]);
    expect(status()).toBe('empty');
  });

  it('uses the shared error state when the GET fails', () => {
    mount();
    http
      .expectOne((request) => request.url === BUSQUEDA)
      .flush(
        { message: 'falló', requestId: 'req-labs' },
        { status: 500, statusText: 'Server Error' },
      );
    expect(status()).toBe('error');
  });

  it('does not print technical UUIDs in the directory', () => {
    mount();
    responder([LAB]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Laboratorio Central');
    expect(fixture.nativeElement.textContent).not.toContain(LAB_ID);
  });

  describe('aConsulta', () => {
    it('drops keys the contract does not declare instead of sending them', () => {
      // El backend valida con `forbidNonWhitelisted`: una clave de más vuelve
      // 400 y tira abajo la búsqueda entera.
      expect(aConsulta({ inventado: 'x', q: 'central' })).toEqual({ q: 'central' });
    });

    it('turns the text of the bar into the types the contract expects', () => {
      expect(
        aConsulta({ kind: 'IMAGING', homeCollection: 'true', walkIn: 'false', minRating: '4' }),
      ).toEqual({
        kind: 'IMAGING',
        homeCollection: true,
        walkIn: false,
        minRating: 4,
      });
    });

    it('ignores a cleared filter rather than sending an empty value', () => {
      expect(aConsulta({ q: '', kind: '', minRating: '' })).toEqual({});
    });
  });
});
