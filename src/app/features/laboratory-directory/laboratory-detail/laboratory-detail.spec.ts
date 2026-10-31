import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';

import { LaboratoryDetail } from './laboratory-detail';

const UNIT_ID = '11111111-1111-4111-8111-111111111111';
const SITE_ID = '22222222-2222-4222-8222-222222222222';
const DETAIL = {
  id: UNIT_ID,
  code: 'LAB-CENTRAL',
  name: 'Laboratorio Central Mantra',
  type: { code: 'DU_TYPE_LAB', display: 'Clinical laboratory unit' },
  siteCount: 1,
  equipmentCount: 1,
  studyCount: 1,
  acceptsExternalOrders: true,
  walkInAvailable: true,
  homeCollectionAvailable: true,
  sites: [
    {
      id: SITE_ID,
      code: 'CENTRO',
      name: 'Sede Centro',
      role: { code: 'DU_SITE_PRIMARY', display: 'Sede principal' },
      sampleCollectionAvailable: true,
      imagingAvailable: false,
    },
  ],
  equipment: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      siteId: SITE_ID,
      type: { code: 'DU_EQ_ANALYZER', display: 'Analizador automatizado' },
      manufacturer: 'DemoLab',
      model: 'Analyzer 500',
      modality: { code: 'DU_MODALITY_LAB', display: 'Laboratorio' },
      operationalStatus: { code: 'DU_EQ_OPERATIONAL', display: 'Operativo' },
      lastCalibrationAt: '2026-07-01T10:00:00.000Z',
      nextCalibrationDueAt: '2027-07-01T10:00:00.000Z',
    },
  ],
  studies: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      code: 'HEM-COMP',
      name: 'Hemograma completo',
      description: 'Conteo automatizado.',
      siteId: SITE_ID,
      modality: { code: 'DU_MODALITY_LAB', display: 'Laboratorio' },
      preparationInstructions: 'No requiere ayuno.',
      expectedDurationMinutes: 15,
      expectedTurnaroundMinutes: 240,
      requiresMedicalOrder: false,
      prices: [
        {
          amount: '85.00',
          currency: { code: 'DU_CUR_BOB', display: 'Boliviano' },
          scheduleCode: 'PUBLIC-LAB',
          siteId: SITE_ID,
        },
      ],
    },
  ],
  accreditations: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      type: { code: 'DU_ACC_ISO15189', display: 'ISO 15189' },
      number: 'ISO-DEMO',
      siteId: SITE_ID,
      validFrom: '2026-01-01',
      validTo: '2028-01-01',
    },
  ],
};

describe('LaboratoryDetail', () => {
  let fixture: ComponentFixture<LaboratoryDetail>;
  let http: HttpTestingController;
  /** El `?tab=` de la URL, que el spec puede mover como lo haría el router. */
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function mount(unitId: string | null = UNIT_ID, tab: string | null = null): void {
    query = new BehaviorSubject(convertToParamMap(tab === null ? {} : { tab }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ unitId: unitId ?? '' })),
            queryParamMap: query,
            snapshot: { fragment: null },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LaboratoryDetail);
    fixture.detectChanges();
  }

  /** Monta la ficha con el centro de la prueba (o una variante) ya cargado. */
  function mountLoaded(detail: object = DETAIL, tab: string | null = null): void {
    mount(UNIT_ID, tab);
    http.expectOne(`/diagnostic-units/${UNIT_ID}`).flush(detail);
    fixture.detectChanges();
  }

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const tabButtons = (): HTMLButtonElement[] => [
    ...host().querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  ];
  const rotulosDePestanas = (): string[] => tabButtons().map((b) => b.textContent?.trim() ?? '');
  const pestanaAbierta = (): string =>
    tabButtons()
      .find((b) => b.getAttribute('aria-selected') === 'true')
      ?.textContent?.trim() ?? '';

  /** Abre una pestaña con un clic, como lo haría quien mira la ficha. */
  function abrir(rotulo: RegExp): void {
    const boton = tabButtons().find((b) => rotulo.test(b.textContent ?? ''));
    expect(boton, String(rotulo)).toBeDefined();
    boton!.click();
    fixture.detectChanges();
  }

  /** El texto de la ficha entera: lo que hay en cada pestaña, una tras otra. */
  function textoDeTodasLasPestanas(): string {
    let texto = '';
    for (const boton of tabButtons()) {
      boton.click();
      fixture.detectChanges();
      texto += ` ${host().textContent ?? ''}`;
    }
    return texto;
  }

  beforeEach(() => {
    // La navegación real no importa acá: lo que se prueba es lo que la ficha
    // le pide al router, y la pestaña abierta la gobierna `?tab=` que mueve
    // cada prueba.
    vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => vi.restoreAllMocks());

  afterEach(() => http?.verify());

  it('renders sites, equipment, studies, public prices and accreditation', () => {
    mountLoaded();

    // Cada colección vive en su pestaña: se recorren todas, y lo que se
    // afirma es lo mismo de antes.
    const text = textoDeTodasLasPestanas();
    expect(text).toContain('Sede Centro');
    expect(text).toContain('Analyzer 500');
    expect(text).toContain('Hemograma completo');
    // Con coma decimal: la API sirve `85.00` porque es un decimal exacto en
    // cadena, y la ficha lo escribe como se lee en es-BO — la misma coma que la
    // puntuación de al lado.
    expect(text).toContain('85,00 Bs');
    expect(text).toContain('ISO-DEMO');
  });

  it('draws the four collections as the card grid, not as stacked fact tables', () => {
    mountLoaded();

    // La anatomía de `clinic-detail` y `pharmacy-detail`: una rejilla por
    // colección, cada ficha una `.rejilla__tarjeta`. Es lo que el cliente pidió
    // el 17/09/2026 —«lo mismo que en los directorios de farmacia y de
    // clínicas»— y lo que la regla §5 de composición exige en vez de las cuatro
    // cards apiladas que había antes.
    const pestanaDe = {
      'unit-studies': /^Estudios/,
      'unit-equipment': /^Equipos/,
      'unit-sites': /^Sedes/,
      'unit-accreditations': /^Acreditaciones/,
    } as const;
    for (const testId of ['unit-studies', 'unit-equipment', 'unit-sites', 'unit-accreditations'] as const) {
      abrir(pestanaDe[testId]);
      const rejilla = host().querySelector(`[data-testid="${testId}"]`);
      expect(rejilla, testId).not.toBeNull();
      expect(rejilla?.classList.contains('rejilla'), testId).toBe(true);
      expect(rejilla?.querySelectorAll('.rejilla__tarjeta').length, testId).toBe(1);
    }

    // El precio vive en el pie de la tarjeta, con su rótulo — no en una fila de
    // tabla. `PUBLIC-LAB` no es la tarifa de maqueta, así que es público.
    abrir(/^Estudios/);
    const precio = host().querySelector('[data-testid="unit-study-price"]');
    expect(precio?.textContent?.trim()).toBe('85,00 Bs');
    expect(host().textContent).toContain('Precio público');
  });

  it('keeps the price label honest when the schedule is the mock one', () => {
    mount();
    http.expectOne(`/diagnostic-units/${UNIT_ID}`).flush({
      ...DETAIL,
      studies: [
        {
          ...DETAIL.studies[0],
          prices: [{ ...DETAIL.studies[0]!.prices[0], scheduleCode: 'MAQUETA' }],
        },
      ],
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Precio de demostración');
    expect(text).not.toContain('Precio público');
  });

  it('says so, instead of drawing an empty grid, when the centre published no study', () => {
    mount();
    http.expectOne(`/diagnostic-units/${UNIT_ID}`).flush({ ...DETAIL, studies: [] });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="unit-studies"]')).toBeNull();
    expect(host.textContent).toContain('todavía no publicó su lista de estudios');
  });

  /**
   * El buscador es lo único que `app-fact-section` traía y que la rejilla
   * conserva, y no es adorno: CENETROP, un laboratorio del corpus, publica 106
   * estudios. Sin él la rejilla los dibuja a los 106 seguidos.
   */
  describe('el buscador de estudios', () => {
    /** Un centro con los estudios suficientes para que el buscador aparezca. */
    function conEstudios(cuantos: number) {
      const base = DETAIL.studies[0]!;
      return {
        ...DETAIL,
        studies: Array.from({ length: cuantos }, (_, i) => ({
          ...base,
          id: `4444444${i}-4444-4444-8444-44444444444${i}`,
          code: `EST-${i}`,
          name: i === 0 ? 'Glucosa basal' : `Estudio ${i}`,
        })),
      };
    }

    it('no aparece mientras los estudios entren todos en pantalla', () => {
      mount();
      http.expectOne(`/diagnostic-units/${UNIT_ID}`).flush(conEstudios(6));
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('app-search-field')).toBeNull();
    });

    it('aparece desde siete y acota la rejilla', () => {
      mount();
      http.expectOne(`/diagnostic-units/${UNIT_ID}`).flush(conEstudios(7));
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('app-search-field')).not.toBeNull();
      expect(host.querySelectorAll('[data-testid="unit-study"]').length).toBe(7);

      const componente = fixture.componentInstance as unknown as {
        terminoDeEstudio: { set: (valor: string) => void };
      };
      componente.terminoDeEstudio.set('GLUCOSA');
      fixture.detectChanges();

      // Sin tildes y sin mayúsculas, como buscaba `fact-section`.
      const tarjetas = host.querySelectorAll('[data-testid="unit-study"]');
      expect(tarjetas.length).toBe(1);
      expect(tarjetas[0]?.textContent).toContain('Glucosa basal');

      // La cuenta del encabezado sigue siendo la del catálogo entero —es lo que
      // el centro publica, no lo que quedó del filtro—, así que el `[cuantos]`
      // de la sección no se mueve al teclear.
      const cuenta = host.querySelector('app-section-heading [data-testid="cuantos"]');
      expect((cuenta ?? host).textContent).toContain('7');
    });

    it('dice que no hay coincidencias en vez de dejar la rejilla vacía', () => {
      mount();
      http.expectOne(`/diagnostic-units/${UNIT_ID}`).flush(conEstudios(7));
      fixture.detectChanges();

      const componente = fixture.componentInstance as unknown as {
        terminoDeEstudio: { set: (valor: string) => void };
      };
      componente.terminoDeEstudio.set('resonancia de tobillo');
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('[data-testid="unit-studies"]')).toBeNull();
      expect(host.textContent).toContain('Ningún estudio coincide');
    });
  });

  it('does not expose any technical UUID in visible profile text', () => {
    mountLoaded();

    const text = textoDeTodasLasPestanas();
    expect(text).not.toContain(UNIT_ID);
    expect(text).not.toContain(SITE_ID);
  });

  /**
   * UNA tarjeta con pestañas, centrada y a lo ancho (`composition-rules.md` §5),
   * con la pestaña abierta en `?tab=` como en el catálogo de la farmacia.
   */
  describe('la ficha en una tarjeta con pestañas', () => {
    /** Las pantallas montadas: una rejilla por colección, sólo la de la pestaña abierta. */
    const rejillasMontadas = (): string[] =>
      ['unit-studies', 'unit-equipment', 'unit-sites', 'unit-accreditations'].filter(
        (testId) => host().querySelector(`[data-testid="${testId}"]`) !== null,
      );

    it('es UNA app-card con las pestañas de marco de ventana, y ninguna otra card apilada', () => {
      mountLoaded();

      expect(host().querySelectorAll('app-card')).toHaveLength(1);
      expect(host().querySelectorAll('[data-testid="unit-card"]')).toHaveLength(1);
      const tabs = host().querySelector('[data-testid="unit-tabs"]');
      expect(tabs?.classList).toContain('tabs--browser');
      expect(tabs?.closest('app-card')).not.toBeNull();
      expect(host().querySelector('app-fact-section')).toBeNull();
    });

    it('dibuja una pestaña por colección, con su cuenta, en orden', () => {
      mountLoaded();

      expect(rotulosDePestanas()).toEqual([
        'Estudios (1)',
        'Equipos (1)',
        'Sedes (1)',
        'Acreditaciones (1)',
      ]);
    });

    it('el resumen del centro y sus modalidades quedan a la vista en cualquier pestaña', () => {
      mountLoaded();

      for (const rotulo of [/^Estudios/, /^Sedes/]) {
        abrir(rotulo);
        expect(host().textContent).toContain('LAB-CENTRAL');
        expect(host().textContent).toContain('Atención sin cita');
        expect(host().textContent).toContain('Toma de muestras a domicilio');
        expect(host().textContent).toContain('Recibe órdenes externas');
      }
    });

    it('sin `?tab=` abre Estudios, monta sólo esa colección y conserva el ancla #estudios', () => {
      mountLoaded();

      expect(pestanaAbierta()).toBe('Estudios (1)');
      expect(rejillasMontadas()).toEqual(['unit-studies']);
      // «Ver estudios y precios» llega con `#estudios`: tiene que existir.
      expect(host().querySelector('section#estudios')).not.toBeNull();
    });

    it.each([
      ['equipos', 'Equipos (1)', 'unit-equipment'],
      ['sedes', 'Sedes (1)', 'unit-sites'],
      ['acreditaciones', 'Acreditaciones (1)', 'unit-accreditations'],
    ])('con `?tab=%s` abre esa pestaña y sólo esa colección está en el DOM', (tab, rotulo, testId) => {
      mountLoaded(DETAIL, tab);

      expect(pestanaAbierta()).toBe(rotulo);
      expect(rejillasMontadas()).toEqual([testId]);
    });

    it('con `?tab=` desconocido cae en Estudios', () => {
      mountLoaded(DETAIL, 'foo');

      expect(pestanaAbierta()).toBe('Estudios (1)');
      expect(rejillasMontadas()).toEqual(['unit-studies']);
    });

    it('no ofrece una pestaña vacía, y `?tab=equipos` de un centro sin equipos cae en Estudios', () => {
      mountLoaded({ ...DETAIL, equipment: [], accreditations: [] }, 'equipos');

      expect(rotulosDePestanas()).toEqual(['Estudios (1)', 'Sedes (1)']);
      expect(pestanaAbierta()).toBe('Estudios (1)');
      expect(rejillasMontadas()).toEqual(['unit-studies']);
    });

    it('un clic en «Sedes» escribe sólo `?tab=sedes`, con replaceUrl, y muestra las sedes', () => {
      mountLoaded();
      const navigate = vi.mocked(TestBed.inject(Router).navigate);

      abrir(/^Sedes/);

      expect(navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { tab: 'sedes' }, replaceUrl: true }),
      );
      expect(navigate.mock.calls[0]![1]).not.toHaveProperty('queryParamsHandling');
      expect(pestanaAbierta()).toBe('Sedes (1)');
      expect(rejillasMontadas()).toEqual(['unit-sites']);
    });

    it('un cambio de `?tab=` en la misma ficha cambia de pestaña sin recargarla', () => {
      mountLoaded();
      const ficha = host().querySelector('[data-testid="unit-card"]');

      query.next(convertToParamMap({ tab: 'acreditaciones' }));
      fixture.detectChanges();
      expect(pestanaAbierta()).toBe('Acreditaciones (1)');
      expect(rejillasMontadas()).toEqual(['unit-accreditations']);

      query.next(convertToParamMap({}));
      fixture.detectChanges();
      expect(pestanaAbierta()).toBe('Estudios (1)');
      expect(host().querySelector('[data-testid="unit-card"]')).toBe(ficha);
    });

    it('el buscador de estudios sigue en la pestaña Estudios y no aparece en las otras', () => {
      const base = DETAIL.studies[0]!;
      mountLoaded({
        ...DETAIL,
        studies: Array.from({ length: 7 }, (_, i) => ({
          ...base,
          id: `4444444${i}-4444-4444-8444-44444444444${i}`,
          code: `EST-${i}`,
          name: `Estudio ${i}`,
        })),
      });

      expect(host().querySelector('app-search-field')).not.toBeNull();
      abrir(/^Sedes/);
      expect(host().querySelector('app-search-field')).toBeNull();
    });

    it('el vacío de Estudios orienta: dice por qué y adónde ir', () => {
      mountLoaded({ ...DETAIL, studies: [] });

      expect(pestanaAbierta()).toBe('Estudios (0)');
      expect(host().textContent).toContain('todavía no publicó su lista de estudios');
      expect(host().textContent).toContain('Vuelva al directorio');
    });
  });

  it('maps a cross-tenant/not-found response to the neutral not-found state', () => {
    mount();
    http
      .expectOne(`/diagnostic-units/${UNIT_ID}`)
      .flush({ code: 'NOT_FOUND', message: 'not found' }, { status: 404, statusText: 'Not Found' });

    const component = fixture.componentInstance as unknown as Record<
      string,
      () => { status: string }
    >;
    expect(component['state']().status).toBe('not-found');
  });

  it('does not call the API when the route has no id', () => {
    mount(null);
    http.verify();
  });
});
