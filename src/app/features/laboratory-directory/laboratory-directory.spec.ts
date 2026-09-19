import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

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
  /**
   * Los parámetros de la URL, empujables desde la prueba.
   *
   * La pantalla decide portada o lista mirando `?kind=`, así que el parámetro
   * es una entrada del componente tanto como sus inputs. Mismo arreglo que el
   * directorio de médicos, que tiene la misma portada.
   */
  let parametros: BehaviorSubject<Record<string, string>>;

  beforeEach(() => {
    parametros = new BehaviorSubject<Record<string, string>>({});
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParams: parametros } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function mount(): void {
    fixture = TestBed.createComponent(LaboratoryDirectory);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * Monta la pantalla **dentro de una categoría**, que es donde vive la lista.
   * Sin `?kind=` lo que se dibuja es la portada, no las tarjetas.
   */
  function mountEnCategoria(kind = 'LABORATORY'): void {
    parametros.next({ kind });
    mount();
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

  /** Las líneas de contexto que la tarjeta llegó a dibujar, no las mapeadas. */
  function lineasDibujadas(): string[] {
    const tarjeta = fixture.nativeElement as HTMLElement;
    return [...tarjeta.querySelectorAll<HTMLElement>('.tarjeta-resultado__meta span')].map(
      (linea) => linea.textContent?.trim() ?? '',
    );
  }

  /** Responde la única búsqueda pendiente con una página. */
  function responder(items: readonly unknown[], total = items.length): void {
    http
      .expectOne((request) => request.url === BUSQUEDA)
      .flush({ items, total, limit: 20, offset: 0 });
  }

  describe('the search bar on every level (19/09/2026)', () => {
    it('shows the same search bar on the category cover, above the categories', () => {
      mount();
      responder([LAB, IMAGING]);
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.querySelector('app-filter-bar app-search-field')).not.toBeNull();
      expect(raiz.querySelector('[data-testid="portada-categorias"]')).not.toBeNull();
      expect(raiz.querySelectorAll('li[app-result-card]').length).toBe(0);
    });

    it('a term typed on the cover searches every category and lists the centres grouped', () => {
      parametros.next({ q: 'central' });
      mount();
      const pedido = http.expectOne((request) => request.url === BUSQUEDA);
      expect(pedido.request.params.get('q')).toBe('central');
      expect(pedido.request.params.has('kind')).toBe(false);
      pedido.flush({ items: [LAB, IMAGING], total: 2, limit: 20, offset: 0 });
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.querySelector('[data-testid="portada-categorias"]')).toBeNull();
      expect(raiz.querySelectorAll('li[app-result-card]').length).toBe(2);
      expect(
        [...raiz.querySelectorAll('.directorio__rotulo')].map((rotulo) =>
          rotulo.textContent?.replace(/\d+/g, '').trim(),
        ),
      ).toEqual(['Imagenología diagnóstica', 'Laboratorio clínico']);
    });
  });

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

    expect(groups().map((group) => group.nombre)).toEqual([
      'Imagenología diagnóstica',
      'Laboratorio clínico',
    ]);
    expect(groups().flatMap((group) => group.resultados)).toHaveLength(2);
  });

  it('links each card to the distinct visual detail route', () => {
    mount();
    responder([LAB]);

    expect(groups()[0].resultados[0].link).toBe(`/laboratory-directory/${LAB_ID}`);
    expect(groups()[0].resultados[0].link).not.toContain('/diagnostics');
  });

  it('says "sin calificaciones" instead of a zero the centre never earned', () => {
    mount();
    responder([IMAGING]);

    const textos = (groups()[0].resultados[0].meta ?? []).map((entrada) => entrada.text);
    expect(textos).toContain('Sin calificaciones');
    expect(textos.join(' ')).not.toContain('0,0');
  });

  it('shows the rating with its review count when there is one', () => {
    mount();
    responder([LAB]);

    const textos = (groups()[0].resultados[0].meta ?? []).map((entrada) => entrada.text);
    expect(textos).toContain('4,5 · 12 reseñas');
  });

  it('shows the entry price as "desde" when the centre publishes one', () => {
    mountEnCategoria();
    responder([LAB]);
    fixture.detectChanges();

    // Se afirma sobre lo dibujado y no sobre lo mapeado: la tarjeta corta las
    // líneas de contexto en `maximoDeMeta` (dos, `ResultCard`), así que una
    // entrada que el mapper produce al final nunca llega a la pantalla.
    // «Desde» y no el importe a secas: es el menor de la tarifa pública, y sin
    // esa palabra prometería que cualquier estudio del centro cuesta eso.
    expect(lineasDibujadas()).toContain('desde Bs 90');
  });

  it('says nothing about price when the centre published no tariff', () => {
    mount();
    responder([IMAGING]);

    const textos = (groups()[0].resultados[0].meta ?? []).map((entrada) => entrada.text);
    // Ni «Bs 0» ni «consultar»: un centro sin tarifa publicada no es un centro
    // gratis, y rellenar el hueco haría ver iguales dos situaciones distintas.
    expect(textos.join(' ')).not.toContain('Bs');
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
    mountEnCategoria();
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
