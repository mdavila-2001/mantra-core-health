import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { RECONOCEDOR_DE_VOZ } from './dictado';
import type { EventoDeErrorDeVoz, EventoDeResultadoDeVoz, ReconocedorDeVoz } from './dictado.types';
import { SymptomCheck } from './symptom-check';

/**
 * A dónde manda el chequeo de síntomas.
 *
 * La pantalla recomienda especialidades y ofrece «ver quién atiende». Ese salto
 * es el único punto donde el chequeo deja de ser una conversación y se vuelve
 * una lista de médicos, así que lo que importa es que aterrice **en la
 * especialidad recomendada** y no en una búsqueda de texto que da lo mismo de
 * casualidad.
 *
 * El resto de la pantalla —qué se recomienda y por qué— vive en las funciones
 * puras y ya está cubierto en `motor.spec.ts`, `sintomas.spec.ts` y
 * `corpus.spec.ts`.
 */
describe('SymptomCheck · a dónde lleva «ver quién atiende»', () => {
  let componente: SymptomCheck;
  let fixture: ReturnType<typeof TestBed.createComponent<SymptomCheck>>;
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  function montar(): void {
    fixture = TestBed.createComponent(SymptomCheck);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    // La lista de especialidades con gente se pide recién cuando alguien
    // empieza a escribir —antes no hace falta y sería una consulta al abrir la
    // pantalla de inicio del paciente—. Sin esto no hay nada que responder.
    (componente as unknown as { escribir(v: string): void }).escribir('me duele el pecho');
    fixture.detectChanges();
  }

  /**
   * Resuelve las dos lecturas encadenadas: la guía primero y, con sus
   * conceptos, el catálogo que les pone nombre. En ese orden y no juntas — la
   * segunda no existe hasta que responde la primera.
   */
  function responderCatalogo(): void {
    http
      .expectOne((r) => r.url === '/profiles/practitioners')
      .flush({
        items: [
          {
            profileId: 'per-1',
            practitionerCode: 'MED-1',
            displayName: 'Dra. Salas',
            verificationStatusConceptId: 'st',
            verified: true,
            acceptsNewPatients: true,
            telehealthAvailable: false,
            specialties: [{ specialtyConceptId: 'con-cardio', isPrimary: true }],
          },
        ],
        count: 1,
        limit: 50,
        nextCursor: null,
      });
    fixture.detectChanges();

    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [
          {
            conceptId: 'con-cardio',
            code: 'CARDIOLOGY',
            display: 'Cardiología',
            codeSystemVersionId: 'csv-1',
          },
        ],
        count: 1,
        limit: 200,
      });
    // La señal que guarda el mapa se actualiza con la respuesta: sin otra
    // detección, la navegación se decide sobre el mapa vacío del arranque.
    fixture.detectChanges();
  }

  function verProfesionales(nombre: string): void {
    (componente as unknown as { verProfesionales(n: string): void }).verProfesionales(nombre);
  }

  it('lleva el CONCEPTO de la especialidad, no el texto', () => {
    montar();
    responderCatalogo();

    verProfesionales('Cardiología');

    // El directorio acota por `?especialidad=` contra el servidor; mandarle el
    // nombre funcionaba sólo de rebote, porque el buscador matchea el
    // encabezado del grupo.
    expect(navegar).toHaveBeenCalledWith(['/directory'], {
      queryParams: { especialidad: 'con-cardio' },
    });
  });

  it('sin concepto conocido cae al texto, que es como funcionaba antes', () => {
    montar();
    responderCatalogo();

    // Un nombre de la tabla de síntomas que el catálogo no tiene: peor destino,
    // nunca una pantalla rota.
    verProfesionales('Reumatología');

    expect(navegar).toHaveBeenCalledWith(['/directory'], {
      queryParams: { q: 'Reumatología' },
    });
  });
});

/**
 * La silueta del cuerpo (P-01, doctor 22/09/2026) y las pastillas son dos
 * puertas al mismo estado: lo que se abre desde la figura es lo mismo que se
 * abre desde la pastilla, y la alarma sigue viva venga de donde venga.
 *
 * Nada de esto escribe en el área de texto, así que no se pide el catálogo:
 * el `http.verify()` de abajo es la prueba de que la figura no dispara red.
 */
describe('SymptomCheck · la silueta', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<SymptomCheck>>;
  let html: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SymptomCheck);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  function tocar(testId: string): void {
    const control = html.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (control === null) throw new Error(`no está ${testId}`);
    control.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
  }

  function presionada(testId: string): string | null {
    return html.querySelector(`[data-testid="${testId}"]`)?.getAttribute('aria-pressed') ?? null;
  }

  it('tocar el pecho en la figura abre sus síntomas', () => {
    tocar('body-map-pecho');

    expect(html.querySelector('[data-testid="zona-abierta"]')?.textContent).toContain(
      'dolor de pecho',
    );
  });

  it('tocar una zona la resalta en la figura y suelta la anterior', () => {
    tocar('body-map-pecho');
    tocar('body-map-estomago');

    expect(presionada('body-map-estomago')).toBe('true');
    expect(presionada('body-map-pecho')).toBe('false');
  });

  /** Zonas finas: cada parte ofrece lo suyo, y lleva a especialidades distintas. */
  it('la rodilla ofrece la rodilla, no el hombro', () => {
    tocar('body-map-rodillas');
    const opciones = html.querySelector('[data-testid="zona-abierta"]')?.textContent ?? '';

    expect(opciones).toContain('dolor de rodilla');
    expect(opciones).not.toContain('dolor de hombro');
  });

  it('de frente, tocar la cabeza acerca la cara para elegir los ojos', () => {
    tocar('body-map-cabeza');
    tocar('body-map-ojos');

    expect(html.querySelector('[data-testid="zona-abierta"]')?.textContent).toContain(
      'visión borrosa',
    );
  });

  it('volver a tocar la zona en la figura la cierra', () => {
    tocar('body-map-pecho');
    tocar('body-map-pecho');

    expect(html.querySelector('[data-testid="zona-abierta"]')).toBeNull();
  });

  /** La alarma es el único camino que no puede romperse: el aviso de urgencia sigue saliendo. */
  it('un síntoma de alarma elegido desde la figura sigue disparando el aviso', () => {
    tocar('body-map-pecho');
    const opcion = Array.from(
      html.querySelectorAll<HTMLButtonElement>('[data-testid="zona-abierta"] button'),
    ).find((boton) => boton.textContent?.trim() === 'dolor de pecho');
    if (opcion === undefined) throw new Error('no está «dolor de pecho»');

    opcion.click();
    fixture.detectChanges();

    expect(html.querySelector('app-alert')?.textContent).toContain('guardia');
  });

  /**
   * Las pastillas son el camino de «piel», «ánimo» y «general», que no tienen
   * forma; lo que se señala en el cuerpo no se repite como pastilla.
   */
  it('las pastillas son sólo lo que no tiene forma', () => {
    expect(html.querySelector('[data-testid="zona-piel"]')).not.toBeNull();
    expect(html.querySelector('[data-testid="body-map-piel"]')).toBeNull();
    expect(html.querySelector('[data-testid="zona-pecho"]')).toBeNull();
  });
});

/**
 * El área de texto es un panel a la vista (P-02, doctor 22/09/2026): no hay
 * nada que desplegar para escribir, y el rótulo está asociado al control.
 */
describe('SymptomCheck · el área de texto', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<SymptomCheck>>;
  let html: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SymptomCheck);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  function area(): HTMLTextAreaElement {
    const control = html.querySelector<HTMLTextAreaElement>(
      '[data-testid="sintomas-texto"] textarea',
    );
    if (control === null) throw new Error('no está el área de texto');
    return control;
  }

  it('se ve sin desplegar nada, con su rótulo asociado al control', () => {
    expect(html.querySelector('details')).toBeNull();

    const rotulo = html.querySelector<HTMLLabelElement>(`label[for="${area().id}"]`);
    expect(rotulo?.textContent).toContain('Contanos con tus palabras');
  });

  it('lo que se escribe llega a `texto()`', () => {
    const control = area();
    control.value = 'me duele la cabeza';
    control.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect((fixture.componentInstance as unknown as { texto(): string }).texto()).toBe(
      'me duele la cabeza',
    );
    // Escribir pide el catálogo de especialidades —es lo previsto—; se lo da
    // por atendido para que `verify()` no lo cuente como una petición olvidada.
    http.match(() => true);
  });
});

/**
 * Dictar (P-02, Q-12), con un doble del reconocedor en los tres niveles de
 * la regla 65: con soporte y una frase que llega al texto; sin soporte, sin
 * botón; y el error de permiso con su frase accionable. La prueba contra el
 * reconocedor real está en `evidencia/h3/dictado/`, no acá.
 */
describe('SymptomCheck · dictar', () => {
  class ReconocedorDoble implements ReconocedorDeVoz {
    static ultimo: ReconocedorDoble | null = null;
    lang = '';
    continuous = false;
    interimResults = false;
    onresult: ((evento: EventoDeResultadoDeVoz) => void) | null = null;
    onerror: ((evento: EventoDeErrorDeVoz) => void) | null = null;
    onend: (() => void) | null = null;
    constructor() {
      ReconocedorDoble.ultimo = this;
    }
    start(): void {
      // el doble no escucha: los resultados se disparan a mano
    }
    stop(): void {
      this.onend?.();
    }
    abort(): void {
      this.onend?.();
    }
  }

  let fixture: ReturnType<typeof TestBed.createComponent<SymptomCheck>>;
  let html: HTMLElement;
  let http: HttpTestingController;

  function montar(constructor: (new () => ReconocedorDeVoz) | null): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: RECONOCEDOR_DE_VOZ, useValue: constructor },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SymptomCheck);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  function boton(): HTMLButtonElement {
    const control = html.querySelector<HTMLButtonElement>('[data-testid="sintomas-dictar"]');
    if (control === null) throw new Error('no está el botón de dictar');
    return control;
  }

  function fraseFinal(texto: string): EventoDeResultadoDeVoz {
    const results = [Object.assign([{ transcript: texto, confidence: 1 }], { isFinal: true })];
    return { resultIndex: 0, results: results as unknown as SpeechRecognitionResultList };
  }

  it('sin reconocedor en el navegador no ofrece el botón, y el área de texto sigue', () => {
    montar(null);

    expect(html.querySelector('[data-testid="sintomas-dictado"]')).toBeNull();
    expect(html.querySelector('[data-testid="sintomas-texto"] textarea')).not.toBeNull();
  });

  it('con reconocedor ofrece «Dictar» con ícono y texto, y el aviso antes', () => {
    montar(ReconocedorDoble);

    expect(boton().textContent).toContain('Dictar');
    expect(boton().querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    const aviso = html.querySelector('#sintomas-dictado-aviso');
    expect(aviso?.textContent).toContain('lo transcribe tu navegador; no lo guardamos');
    expect(boton().getAttribute('aria-describedby')).toBe('sintomas-dictado-aviso');
    // El aviso está ANTES del botón en el DOM: el botón «sigue» al aviso.
    const posicion = aviso?.compareDocumentPosition(boton()) ?? 0;
    expect(posicion & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('lo dictado se agrega al final de lo escrito, sin pisarlo', () => {
    montar(ReconocedorDoble);
    (fixture.componentInstance as unknown as { escribir(v: string): void }).escribir(
      'me duele la cabeza',
    );
    fixture.detectChanges();

    boton().click();
    fixture.detectChanges();
    expect(boton().textContent).toContain('Detener');
    expect(html.querySelector('[data-testid="sintomas-dictado-estado"]')?.textContent).toContain(
      'Escuchando',
    );

    ReconocedorDoble.ultimo?.onresult?.(fraseFinal('y tengo tos'));
    fixture.detectChanges();

    expect((fixture.componentInstance as unknown as { texto(): string }).texto()).toBe(
      'me duele la cabeza y tengo tos',
    );
    // Escribir pide el catálogo, como al teclear: se lo da por atendido.
    http.match(() => true);
  });

  it('sin permiso de micrófono dice qué hacer', () => {
    montar(ReconocedorDoble);
    boton().click();
    fixture.detectChanges();

    ReconocedorDoble.ultimo?.onerror?.({ error: 'not-allowed' });
    ReconocedorDoble.ultimo?.onend?.();
    fixture.detectChanges();

    expect(html.querySelector('[data-testid="sintomas-dictado-estado"]')?.textContent).toContain(
      'Activá el micrófono en el navegador o escribí',
    );
    expect(boton().textContent).toContain('Dictar');
  });
});
