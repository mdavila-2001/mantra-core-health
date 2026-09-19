import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { MyServices } from './my-services';
import type {
  Practice,
  ServiceCatalogItem,
} from '../../core/data-access/services-catalog/services-catalog.types';

/**
 * La vista de quien atiende sobre el catálogo de su práctica. Lo que se prueba
 * acá es lo que la hace útil sin mentir: que la lectura cuelgue de la práctica,
 * que el listado se apile por cursor, y que el vacío diga la verdad — el alta
 * no es suya, así que no se le ofrece.
 */
const RUTA = '/my-services';

/** La forma con la que responde `GET /practices`: el array pelado, sin envoltorio. */
type RespuestaDePracticas = readonly Practice[];

const UNA_PRACTICA: RespuestaDePracticas = [{ id: 'pr1', code: 'P1', name: 'Práctica 1' }];

const DOS_PRACTICAS: RespuestaDePracticas = [
  { id: 'pr1', code: 'P1', name: 'Práctica 1' },
  { id: 'pr2', code: 'P2', name: 'Práctica 2' },
];

function servicio(over: Partial<ServiceCatalogItem> = {}): ServiceCatalogItem {
  return {
    id: 's1',
    practiceId: 'pr1',
    code: 'CONS-01',
    name: 'Consulta general',
    defaultPrice: '150.00',
    isActive: true,
    ...over,
  };
}

function pagina(items: readonly ServiceCatalogItem[], nextCursor: string | null = null) {
  return { items, count: items.length, limit: 24, nextCursor };
}

describe('MyServices', () => {
  let harness: RouterTestingHarness;
  let componente: MyServices;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'my-services', component: MyServices }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, MyServices);
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /** La práctica siempre se pide primero: sin ella no hay catálogo que pedir. */
  function responderPracticas(respuesta: RespuestaDePracticas = UNA_PRACTICA) {
    http.expectOne((r) => r.url === '/practices').flush(respuesta);
    harness.detectChanges();
  }

  function peticionDelCatalogo() {
    return http.expectOne((r) => r.url === '/billing/service-catalog');
  }

  function estado() {
    return interno<() => { status: string }>('estado')();
  }

  function servicios() {
    return interno<() => readonly ServiceCatalogItem[]>('servicios')();
  }

  function texto(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  function boton(testId: string): Element | null {
    return harness.routeNativeElement?.querySelector(`[data-testid="${testId}"]`) ?? null;
  }

  it('mientras las prácticas viajan, la pantalla está cargando y no pide catálogo', () => {
    // S1 ≠ S2 del M34 al revés: el esqueleto ya corresponde —la ruta autorizó—,
    // pero pedir el catálogo sin `practiceId` sería un 400 asegurado.
    expect(estado().status).toBe('loading');

    http.expectOne((r) => r.url === '/practices').flush(UNA_PRACTICA);
    harness.detectChanges();
    peticionDelCatalogo().flush(pagina([]));
  });

  it('pide el catálogo de la práctica preseleccionada, sin parámetros de más', () => {
    responderPracticas();

    const req = peticionDelCatalogo();
    expect(req.request.params.get('practiceId')).toBe('pr1');
    expect(req.request.params.get('limit')).toBe('24');
    // Un opcional presente en `undefined` viaja como clave declarada y el
    // backend lo rechaza con 400: la primera página no lleva cursor.
    expect(req.request.params.keys().sort()).toEqual(['limit', 'practiceId']);

    req.flush(pagina([]));
  });

  it('con servicios, queda en `ready` y muestra nombre, código y precio de referencia', () => {
    responderPracticas();
    peticionDelCatalogo().flush(pagina([servicio()]));
    harness.detectChanges();

    expect(estado().status).toBe('ready');
    expect(texto()).toContain('Consulta general');
    expect(texto()).toContain('CONS-01');
    expect(texto()).toContain('Precio de referencia');
    expect(texto()).toContain('150.00');
  });

  it('sólo lo inactivo lleva distintivo: un «Activo» en cada tarjeta no informa', () => {
    responderPracticas();
    peticionDelCatalogo().flush(pagina([servicio(), servicio({ id: 's2', isActive: false })]));
    harness.detectChanges();

    const distintivos = harness.routeNativeElement?.querySelectorAll('app-badge') ?? [];
    expect(distintivos).toHaveLength(1);
    expect(texto()).toContain('Inactivo');
  });

  it('sin servicios, el vacío dice de quién es el alta y no la ofrece', () => {
    responderPracticas();
    peticionDelCatalogo().flush(pagina([]));
    harness.detectChanges();

    const vacio = estado() as {
      status: string;
      message?: string;
      nextAction: { label: string; route?: string };
    };
    expect(vacio.status).toBe('empty');
    expect(vacio.message).toBe('Esta práctica todavía no tiene servicios en su catálogo.');
    expect(vacio.nextAction.label).toContain('cuenta administradora');
    // Sin ruta a propósito: `administration/services-catalog` exige
    // `SECURITY_ADMIN` y el enlace sería una puerta que rebota.
    expect(vacio.nextAction.route).toBeUndefined();
  });

  it('sin prácticas, lo dice en vez de fingir un catálogo vacío', () => {
    responderPracticas([]);

    const vacio = estado() as { status: string; message?: string };
    expect(vacio.status).toBe('empty');
    expect(vacio.message).toContain('todavía no tiene prácticas');
    // Y no pide nada: sin práctica no hay catálogo.
    http.verify();
  });

  it('un fallo del catálogo se muestra como error, y reintentar vuelve a pedir', () => {
    responderPracticas();
    peticionDelCatalogo().flush(
      { code: 'INTERNAL', message: 'Falló' },
      { status: 500, statusText: 'Server Error' },
    );
    harness.detectChanges();

    expect(estado().status).toBe('error');

    interno<() => void>('recargar')();
    harness.detectChanges();

    expect(estado().status).toBe('loading');
    peticionDelCatalogo().flush(pagina([servicio()]));
    harness.detectChanges();
    expect(estado().status).toBe('ready');
  });

  it('si fallan las prácticas, reintentar las vuelve a pedir a ellas', () => {
    http
      .expectOne((r) => r.url === '/practices')
      .flush({ code: 'INTERNAL', message: 'Falló' }, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    expect(estado().status).toBe('error');

    interno<() => void>('recargar')();
    harness.detectChanges();

    responderPracticas();
    peticionDelCatalogo().flush(pagina([]));
  });

  it('«Cargar más» apila la página siguiente y desaparece sin cursor', () => {
    responderPracticas();
    peticionDelCatalogo().flush(pagina([servicio()], 'cursor-2'));
    harness.detectChanges();

    expect(boton('my-services-load-more')).not.toBeNull();

    interno<() => void>('cargarMas')();
    const segunda = peticionDelCatalogo();
    expect(segunda.request.params.get('cursor')).toBe('cursor-2');
    segunda.flush(pagina([servicio({ id: 's2', name: 'Control anual' })]));
    harness.detectChanges();

    expect(servicios().map((s) => s.id)).toEqual(['s1', 's2']);
    expect(texto()).toContain('Consulta general');
    expect(texto()).toContain('Control anual');
    expect(boton('my-services-load-more')).toBeNull();
  });

  it('si falla al cargar más, lo dice y el reintento arranca de la primera página', () => {
    responderPracticas();
    peticionDelCatalogo().flush(pagina([servicio()], 'cursor-2'));
    harness.detectChanges();

    interno<() => void>('cargarMas')();
    peticionDelCatalogo().flush(
      { code: 'INTERNAL', message: 'Falló' },
      { status: 500, statusText: 'Server Error' },
    );
    harness.detectChanges();

    expect(estado().status).toBe('error');

    interno<() => void>('recargar')();
    const req = peticionDelCatalogo();
    // Sin cursor: mezclar dos lecturas de momentos distintos mostraría una
    // lista que la API nunca devolvió.
    expect(req.request.params.get('cursor')).toBeNull();
    req.flush(pagina([servicio()]));
  });

  it('sin cursor no hay botón: la lista está completa', () => {
    responderPracticas();
    peticionDelCatalogo().flush(pagina([servicio()]));
    harness.detectChanges();

    expect(boton('my-services-load-more')).toBeNull();
  });

  it('cambiar de práctica descarta lo acumulado y pide la primera página de la otra', () => {
    responderPracticas(DOS_PRACTICAS);
    peticionDelCatalogo().flush(pagina([servicio()], 'cursor-2'));
    harness.detectChanges();

    interno<(id: string | null) => void>('cambiarPractica')('pr2');
    harness.detectChanges();

    const req = peticionDelCatalogo();
    expect(req.request.params.get('practiceId')).toBe('pr2');
    // El cursor era de la lista anterior: seguirlo devolvería una página del
    // catálogo viejo mezclada con el nuevo.
    expect(req.request.params.get('cursor')).toBeNull();

    req.flush(pagina([servicio({ id: 's9', practiceId: 'pr2', name: 'Consulta pr2' })]));
    harness.detectChanges();

    expect(servicios().map((s) => s.id)).toEqual(['s9']);
    expect(texto()).not.toContain('Consulta general');
  });

  it('sin práctica elegida no pide nada y dice qué hacer, en vez de cargar para siempre', () => {
    responderPracticas(DOS_PRACTICAS);
    peticionDelCatalogo().flush(pagina([servicio()]));
    harness.detectChanges();

    interno<(id: string | null) => void>('cambiarPractica')(null);
    harness.detectChanges();

    const vacio = estado() as { status: string; nextAction: { label: string } };
    expect(vacio.status).toBe('empty');
    expect(vacio.nextAction.label).toBe('Elegir una práctica');
    http.verify();
  });

  it('la página lenta de la práctica anterior no pisa a la que se está mirando', () => {
    responderPracticas(DOS_PRACTICAS);
    const dePr1 = peticionDelCatalogo();

    interno<(id: string | null) => void>('cambiarPractica')('pr2');
    harness.detectChanges();

    const dePr2 = http.match((r) => r.url === '/billing/service-catalog')[0];
    dePr2.flush(pagina([servicio({ id: 's9', practiceId: 'pr2', name: 'Consulta pr2' })]));
    harness.detectChanges();

    // La lectura de pr1 termina después: la red no garantiza el orden.
    dePr1.flush(pagina([servicio()]));
    harness.detectChanges();

    expect(servicios().map((s) => s.id)).toEqual(['s9']);
    expect(texto()).not.toContain('Consulta general');
  });

  it('con una sola práctica no hay selector: elegir entre una no es elegir', () => {
    responderPracticas();
    peticionDelCatalogo().flush(pagina([servicio()]));
    harness.detectChanges();

    expect(boton('my-services-practice')).toBeNull();
  });

  it('con varias prácticas sí lo hay, con la primera preseleccionada', () => {
    responderPracticas(DOS_PRACTICAS);
    peticionDelCatalogo().flush(pagina([servicio()]));
    harness.detectChanges();

    expect(boton('my-services-practice')).not.toBeNull();
    expect(interno<() => string | null>('practicaElegida')()).toBe('pr1');
  });

  /**
   * FT-22-R05. El precio de lo que ofrece quien atiende es suyo, y hasta acá no
   * había forma de ponerlo desde ninguna pantalla que él pudiera abrir.
   */
  describe('editar el precio', () => {
    function abrirEdicionDe(item: ServiceCatalogItem) {
      responderPracticas();
      peticionDelCatalogo().flush(pagina([item]));
      harness.detectChanges();

      interno<(s: ServiceCatalogItem) => void>('editar')(item);
      harness.detectChanges();
    }

    function peticionDeGuardado() {
      return http.expectOne((r) => r.url === '/billing/service-catalog/s1');
    }

    it('un precio en cero se dice con palabras, no con un «0.00» que parece gratis', () => {
      responderPracticas();
      peticionDelCatalogo().flush(pagina([servicio({ defaultPrice: '0.00' })]));
      harness.detectChanges();

      expect(texto()).toContain('Definí el precio');
      expect(texto()).not.toContain('0.00');
    });

    it('el importe se muestra con su moneda cuando la API la resolvió', () => {
      responderPracticas();
      peticionDelCatalogo().flush(pagina([servicio({ currencyCode: 'BOB' })]));
      harness.detectChanges();

      expect(texto()).toContain('150.00 BOB');
    });

    it('guardar manda un PATCH con el importe y actualiza la tarjeta con lo que devolvió la API', () => {
      abrirEdicionDe(servicio());
      interno<(v: string) => void>('escribirPrecio')('200.50');

      interno<(s: ServiceCatalogItem) => void>('guardarPrecio')(servicio());
      const req = peticionDeGuardado();
      expect(req.request.method).toBe('PATCH');
      // Sólo la clave que cambió: el backend valida con `forbidNonWhitelisted`.
      expect(req.request.body).toEqual({ defaultPrice: '200.50' });

      req.flush(servicio({ defaultPrice: '200.50', currencyCode: 'BOB' }));
      harness.detectChanges();

      expect(texto()).toContain('200.50 BOB');
      expect(boton('my-services-price-input')).toBeNull();
    });

    it('el campo arranca vacío cuando nunca hubo precio, y con el valor cuando lo hubo', () => {
      abrirEdicionDe(servicio({ defaultPrice: '0.00' }));
      expect(interno<() => string>('borrador')()).toBe('');

      interno<() => void>('cancelar')();
      interno<(s: ServiceCatalogItem) => void>('editar')(servicio());
      expect(interno<() => string>('borrador')()).toBe('150.00');
    });

    it('un importe con tres decimales no llega a viajar y lo dice en el campo', () => {
      abrirEdicionDe(servicio());
      interno<(v: string) => void>('escribirPrecio')('10.123');

      interno<(s: ServiceCatalogItem) => void>('guardarPrecio')(servicio());
      harness.detectChanges();

      expect(interno<() => string | null>('errorDelPrecio')()).toContain('dos decimales');
      // No se gastó un viaje: `afterEach` verifica que no queda ninguno pendiente.
    });

    /**
     * El rechazo del servidor llega como **400**, no 422.
     *
     * Se comprobó contra la API viva: el importe lo rechaza el `ValidationPipe`
     * por el patrón del DTO, y eso en esta API es `VALIDATION_FAILED` con 400.
     * El 422 está reservado a las precondiciones de dominio
     * (`PreconditionFailedException`), que es otra cosa. La pantalla no se
     * ramifica por el código: muestra el mensaje que venga, así que serviría
     * igual — pero la prueba dice lo que de verdad pasa.
     */
    it('el rechazo del servidor se muestra en el campo y conserva lo escrito', () => {
      abrirEdicionDe(servicio());
      interno<(v: string) => void>('escribirPrecio')('99.00');

      interno<(s: ServiceCatalogItem) => void>('guardarPrecio')(servicio());
      // El envoltorio real: se ramifica por `code` —de la lista cerrada del
      // contrato— y el `message` es el que se muestra.
      peticionDeGuardado().flush(
        {
          code: 'VALIDATION_FAILED',
          message: 'El precio debe ser un número positivo con hasta dos decimales',
          timestamp: '2026-09-04T12:00:00.000Z',
          path: '/billing/service-catalog/s1',
        },
        { status: 400, statusText: 'Bad Request' },
      );
      harness.detectChanges();

      expect(interno<() => string | null>('errorDelPrecio')()).toBe(
        'El precio debe ser un número positivo con hasta dos decimales',
      );
      // Lo escrito no se pierde: corregirlo es escribir dos teclas, no todo de nuevo.
      expect(interno<() => string>('borrador')()).toBe('99.00');
      expect(interno<() => string | null>('enEdicion')()).toBe('s1');
    });

    it('cancelar no manda nada y deja el precio como estaba', () => {
      abrirEdicionDe(servicio());
      interno<(v: string) => void>('escribirPrecio')('1.00');

      interno<() => void>('cancelar')();
      harness.detectChanges();

      expect(interno<() => string | null>('enEdicion')()).toBeNull();
      expect(texto()).toContain('150.00');
    });
  });
  /* ---- buscador y filtro de estado ---------------------------------------- */

  describe('buscador y filtro', () => {
    /** Navega publicando los filtros en la URL, que es como los publica la barra. */
    async function irA(filtros: Record<string, string>): Promise<void> {
      const query = new URLSearchParams(filtros).toString();
      componente = await harness.navigateByUrl(`${RUTA}?${query}`, MyServices);
      await harness.fixture.whenStable();
    }

    it('lo escrito viaja como `q` y vuelve a la primera página', async () => {
      responderPracticas();
      peticionDelCatalogo().flush(pagina([servicio()]));
      harness.detectChanges();

      await irA({ q: 'holter' });

      const req = peticionDelCatalogo();
      expect(req.request.params.get('q')).toBe('holter');
      expect(req.request.params.get('practiceId')).toBe('pr1');
      // La primera página de una lista nueva: el cursor de la anterior no vale.
      expect(req.request.params.get('cursor')).toBeNull();
      req.flush(pagina([servicio({ id: 's2', name: 'Holter de 24 horas' })]));
    });

    it('«Inactivos» viaja como `isActive=false`, y sin filtro no viaja nada', async () => {
      responderPracticas();
      peticionDelCatalogo().flush(pagina([servicio()]));
      harness.detectChanges();

      await irA({ estado: 'inactivos' });
      const conFiltro = peticionDelCatalogo();
      expect(conFiltro.request.params.get('isActive')).toBe('false');
      conFiltro.flush(pagina([]));
      harness.detectChanges();

      await irA({});
      const sinFiltro = peticionDelCatalogo();
      // Un opcional presente en `undefined` viaja como clave declarada y el
      // backend lo rechaza con 400.
      expect(sinFiltro.request.params.keys().sort()).toEqual(['limit', 'practiceId']);
      sinFiltro.flush(pagina([servicio()]));
    });

    it('lo vacío del filtro no se disfraza de catálogo vacío', async () => {
      responderPracticas();
      peticionDelCatalogo().flush(pagina([servicio()]));
      harness.detectChanges();

      await irA({ q: 'inexistente' });
      peticionDelCatalogo().flush(pagina([]));
      harness.detectChanges();

      // Decir «esta práctica todavía no tiene servicios» sería falso —los
      // tiene— y mandaría a pedirle un alta a una cuenta administradora.
      expect(estado().status).toBe('empty');
      expect(texto()).toContain('coincide');
    });
  });
});
