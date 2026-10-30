import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
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

      expect(texto()).toContain('Defina el precio');
      expect(texto()).not.toContain('0.00');
    });

    it('el importe se muestra en «Bs», el código de moneda que traiga el dato', () => {
      responderPracticas();
      // `UMA` a propósito: el arancel de referencia no está en bolivianos y la
      // pantalla igual dice «Bs». Ver `core/money/display-currency.ts`.
      peticionDelCatalogo().flush(pagina([servicio({ currencyCode: 'UMA' })]));
      harness.detectChanges();

      expect(texto()).toContain('150.00 Bs');
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

      expect(texto()).toContain('200.50 Bs');
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

/* ==========================================================================
   v4.2.40 — cómo ofrece cada profesional un servicio
   ========================================================================== */

/**
 * Reemplaza a «Programar horario» (C-12), que sólo bloqueaba la agenda con el
 * motivo «Otros servicios»: un servicio que el paciente no puede reservar no se
 * ofrece, se esconde. Sus cuatro pruebas dejaron de tener de qué hablar.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **La duración la declara el profesional, no el catálogo**: el mismo servicio
 *    lo hacen dos médicos con tiempos distintos.
 * 2. **Mínimo y máximo, y se reserva el máximo.** El mínimo sólo informa.
 * 3. **El cuerpo se arma campo a campo**: un opcional en `undefined` viaja como
 *    clave declarada y el backend lo rechaza.
 * 4. **Decide el servidor.** La validación de la pantalla avisa mientras se
 *    escribe; el rechazo de la API se muestra tal cual.
 */
describe('MyServices · cómo ofrezco un servicio (v4.2.40)', () => {
  const PERFIL = '22222222-2222-2222-2222-222222222222';

  let harness: RouterTestingHarness;
  let componente: MyServices;
  let http: HttpTestingController;

  const oferta = (over: Record<string, unknown> = {}) => ({
    id: 'of-1',
    practitionerProfileId: PERFIL,
    serviceCatalogId: 's1',
    serviceCode: 'CONS-01',
    serviceName: 'Consulta general',
    price: '150.00',
    minDurationMinutes: 30,
    maxDurationMinutes: 45,
    prepMinutes: 0,
    cleanupMinutes: 0,
    isPatientBookable: true,
    requiresApproval: false,
    isActive: true,
    ...over,
  });

  async function montar(
    ofertas: readonly unknown[] = [],
    perfil: string | null = PERFIL,
  ): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'my-services', component: MyServices }]),
        {
          provide: AuthService,
          useValue: {
            practitionerProfileId: signal<string | null>(perfil),
            activeTenantId: signal<string | null>('t-1'),
            roles: signal<readonly string[]>(['PRACTITIONER']),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl('/my-services', MyServices);
    http.expectOne((r) => r.url === '/practices').flush(UNA_PRACTICA);
    if (perfil !== null) {
      http.expectOne((r) => r.url === '/scheduling/service-offerings').flush({ items: ofertas });
    }
    harness.detectChanges();
    http.expectOne((r) => r.url === '/billing/service-catalog').flush(pagina([servicio()]));
    harness.detectChanges();
  }

  function api<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /** Una señal ES una función: se toma la propiedad cruda para poder escribirla. */
  function escribir(campo: string, valor: string | boolean): void {
    (componente as unknown as Record<string, { set(v: string | boolean): void }>)[campo].set(valor);
  }

  function texto(): string {
    return (harness.routeNativeElement as HTMLElement).textContent ?? '';
  }

  function enDocumento(testId: string): Element | null {
    return (harness.routeNativeElement as HTMLElement).ownerDocument.querySelector(`[data-testid="${testId}"]`);
  }

  afterEach(() => {
    for (const req of http.match(() => true)) req.flush({ items: [], count: 0 });
    http.verify();
  });

  it('la tarjeta dice cuánto dura lo que el profesional declaró', async () => {
    await montar([oferta()]);
    expect(enDocumento('my-services-duration')?.textContent).toContain('Dura 30–45 min');
    expect(enDocumento('my-services-duration-missing')).toBeNull();
  });

  it('cuando mínimo y máximo coinciden dice un solo número', async () => {
    await montar([oferta({ minDurationMinutes: 20, maxDurationMinutes: 20 })]);
    expect(enDocumento('my-services-duration')?.textContent).toContain('Dura 20 min');
    expect(enDocumento('my-services-duration')?.textContent).not.toContain('–');
  });

  it('un servicio sin declarar lo dice, en vez de dejar un hueco', async () => {
    await montar([]);
    expect(enDocumento('my-services-duration-missing')?.textContent).toContain(
      'Todavía no declaró cuánto dura',
    );
    expect(enDocumento('my-services-offer')?.textContent).toContain('Declarar duración');
  });

  it('avisa si el paciente no puede pedirlo solo', async () => {
    await montar([oferta({ isPatientBookable: false })]);
    expect(texto()).toContain('el paciente no lo pide solo');
  });

  it('declarar por primera vez crea la oferta, con el cuerpo armado campo a campo', async () => {
    await montar([]);
    api<(s: ServiceCatalogItem) => void>('abrirOferta')(servicio());
    harness.detectChanges();
    escribir('minimo', '30');
    escribir('maximo', '45');
    escribir('preparacion', '5');
    api<() => void>('guardarOferta')();

    const req = http.expectOne(
      (r) => r.url === '/scheduling/service-offerings' && r.method === 'POST',
    );
    expect(req.request.body).toEqual({
      serviceCatalogId: 's1',
      minDurationMinutes: 30,
      maxDurationMinutes: 45,
      prepMinutes: 5,
      cleanupMinutes: 0,
      isPatientBookable: true,
      requiresApproval: false,
    });
    // «Sin declarar» no viaja: ausente ≡ lo de siempre.
    expect(req.request.body).not.toHaveProperty('channel');

    req.flush(oferta({ prepMinutes: 5 }));
    harness.detectChanges();
    // El diálogo se cierra y la tarjeta ya dice cuánto dura.
    expect(api<() => unknown>('ofreciendo')()).toBeNull();
    expect(enDocumento('my-services-duration')?.textContent).toContain('Dura 30–45 min');
  });

  it('la modalidad elegida viaja, y la de siempre no', async () => {
    await montar([]);
    api<(s: ServiceCatalogItem) => void>('abrirOferta')(servicio());
    escribir('minimo', '20');
    escribir('maximo', '30');
    api<(v: string) => void>('fijarModalidad')('TELECONSULTA');
    api<() => void>('guardarOferta')();

    const req = http.expectOne((r) => r.url === '/scheduling/service-offerings' && r.method === 'POST');
    expect(req.request.body.channel).toBe('TELECONSULTA');
  });

  it('con una oferta ya declarada el diálogo abre con sus valores y guarda con PATCH', async () => {
    await montar([oferta({ prepMinutes: 5, requiresApproval: true })]);
    api<(s: ServiceCatalogItem) => void>('abrirOferta')(servicio());

    expect(api<() => string>('minimo')()).toBe('30');
    expect(api<() => string>('maximo')()).toBe('45');
    expect(api<() => string>('preparacion')()).toBe('5');
    expect(api<() => boolean>('requiereAprobacion')()).toBe(true);

    escribir('maximo', '60');
    api<() => void>('guardarOferta')();

    const req = http.expectOne((r) => r.url === '/scheduling/service-offerings/of-1' && r.method === 'PATCH');
    expect(req.request.body.maxDurationMinutes).toBe(60);
    expect(req.request.body.minDurationMinutes).toBe(30);
    // La editada no es la creación: no se pide un POST.
    http.expectNone((r) => r.method === 'POST');
    req.flush(oferta({ maxDurationMinutes: 60 }));
  });

  it('un mínimo mayor que el máximo no manda nada y lo dice', async () => {
    await montar([]);
    api<(s: ServiceCatalogItem) => void>('abrirOferta')(servicio());
    escribir('minimo', '60');
    escribir('maximo', '30');
    api<() => void>('guardarOferta')();

    http.expectNone((r) => r.method === 'POST');
    expect(api<() => string | null>('errorDeLaOferta')()).toContain('mínimo no puede ser mayor');
  });

  it('sin minutos escritos no manda nada', async () => {
    await montar([]);
    api<(s: ServiceCatalogItem) => void>('abrirOferta')(servicio());
    api<() => void>('guardarOferta')();

    http.expectNone((r) => r.method === 'POST');
    expect(api<() => string | null>('errorDeLaOferta')()).toContain('Escriba cuántos minutos');
  });

  it.each([['720.5'], ['abc'], ['-5'], ['0']])('rechaza la duración «%s» antes de viajar', async (valor) => {
    await montar([]);
    api<(s: ServiceCatalogItem) => void>('abrirOferta')(servicio());
    escribir('minimo', valor);
    escribir('maximo', valor);
    api<() => void>('guardarOferta')();

    http.expectNone((r) => r.method === 'POST');
    expect(api<() => string | null>('errorDeLaOferta')()).not.toBeNull();
  });

  it('un máximo por encima del techo no viaja', async () => {
    await montar([]);
    api<(s: ServiceCatalogItem) => void>('abrirOferta')(servicio());
    escribir('minimo', '30');
    escribir('maximo', '721');
    api<() => void>('guardarOferta')();

    http.expectNone((r) => r.method === 'POST');
    expect(api<() => string | null>('errorDeLaOferta')()).toContain('720');
  });

  it('el rechazo del servidor se muestra tal cual y el diálogo sigue abierto con lo escrito', async () => {
    await montar([]);
    api<(s: ServiceCatalogItem) => void>('abrirOferta')(servicio());
    escribir('minimo', '30');
    escribir('maximo', '45');
    api<() => void>('guardarOferta')();

    http
      .expectOne((r) => r.url === '/scheduling/service-offerings' && r.method === 'POST')
      .flush(
        {
          code: 'CONFLICT',
          message: 'Ya ofrece ese servicio. Edite la oferta que ya tiene.',
          timestamp: '2026-10-01T12:00:00.000Z',
          path: '/scheduling/service-offerings',
        },
        { status: 409, statusText: 'Conflict' },
      );
    harness.detectChanges();

    expect(api<() => string | null>('errorDeLaOferta')()).toContain('Ya ofrece ese servicio');
    expect(api<() => unknown>('ofreciendo')()).not.toBeNull();
    expect(api<() => string>('minimo')()).toBe('30');
    expect(api<() => boolean>('guardandoOferta')()).toBe(false);
  });

  it('quien no tiene perfil profesional no pide ofertas', async () => {
    await montar([], null);
    http.expectNone((r) => r.url === '/scheduling/service-offerings');
    expect(enDocumento('my-services-duration-missing')).not.toBeNull();
  });

  it('un fallo al leer las ofertas no rompe el catálogo', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'my-services', component: MyServices }]),
        { provide: AuthService, useValue: { practitionerProfileId: signal<string | null>(PERFIL), activeTenantId: signal<string | null>('t-1'), roles: signal<readonly string[]>(['PRACTITIONER']) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl('/my-services', MyServices);
    http.expectOne((r) => r.url === '/practices').flush(UNA_PRACTICA);
    http
      .expectOne((r) => r.url === '/scheduling/service-offerings')
      .flush({ message: 'caído' }, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();
    http.expectOne((r) => r.url === '/billing/service-catalog').flush(pagina([servicio()]));
    harness.detectChanges();

    expect(texto()).toContain('Consulta general');
  });
});
