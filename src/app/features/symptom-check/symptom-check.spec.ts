import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';

import { BodyMap } from '@shared/components/organisms/body-map/body-map';
import { RECONOCEDOR_DE_VOZ } from './dictado';
import type { EventoDeErrorDeVoz, EventoDeResultadoDeVoz, ReconocedorDeVoz } from './dictado.types';
import { SymptomCheck } from './symptom-check';

/**
 * Responde el `GET /profiles/patients/me` que se pide al abrir, con sesión
 * (P-04, 2026-09-25): sin él, `http.verify()` de cada `describe` de acá abajo
 * se queja de una petición sin responder. Sin `sexAtBirth`, responde como un
 * perfil sin ese dato: no filtra nada, que es el comportamiento de siempre
 * para las pruebas que no son sobre el sexo del paciente.
 */
function responderSexoPropio(
  http: HttpTestingController,
  sexAtBirth?: 'MALE' | 'FEMALE' | 'INTERSEX' | 'UNKNOWN',
): void {
  http.expectOne('/profiles/patients/me').flush(sexAtBirth === undefined ? {} : { sexAtBirth });
}

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
    responderSexoPropio(http);
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
    responderSexoPropio(http);
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
    responderSexoPropio(http);
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
    responderSexoPropio(http);
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
    // Dice las tres cosas que la persona tiene que saber antes de hablar: quién
    // transcribe, que el texto se analiza para entenderla y que no se guarda.
    expect(aviso?.textContent).toContain('lo transcribe tu navegador');
    expect(aviso?.textContent).toContain('lo analizamos para entenderte');
    expect(aviso?.textContent).toContain('no lo guardamos');
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

/**
 * Lo que suma el servicio de triage (AlovidaAIService): partes del cuerpo que
 * la tabla no tiene. La respuesta es la real del servicio desplegado para la
 * frase del pedido (2026-09-23); ver `lectura-ia.spec.ts` para la combinación
 * aislada.
 */
describe('SymptomCheck · lo que entiende el servicio de triage', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<SymptomCheck>>;
  let http: HttpTestingController;
  let html: HTMLElement;

  const MANCHAS = {
    symptoms: [
      {
        code: 'mancha:espalda',
        label: 'manchas en la espalda',
        kind: 'anatomy',
        zones: ['espalda', 'piel'],
        bodyPart: { code: 'espalda', label: 'espalda', side: null },
        alarm: false,
        especialidades: [
          { nombre: 'Dermatología', peso: 3 },
          { nombre: 'Medicina general', peso: 1 },
        ],
      },
    ],
    urgency: 'programada',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SymptomCheck);
    fixture.detectChanges();
    responderSexoPropio(http);
    html = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  function escribir(texto: string): void {
    (fixture.componentInstance as unknown as { escribir(v: string): void }).escribir(texto);
    fixture.detectChanges();
    // La lista de especialidades con gente se pide al escribir; vacía = sin filtro.
    for (const req of http.match((r) => r.url === '/profiles/practitioners')) {
      req.flush({ items: [], count: 0, limit: 50, nextCursor: null });
    }
  }

  it('pregunta después de una pausa y suma lo que el motor local no reconoce', () => {
    escribir('Me salieron unas manchas raras en la espalda');
    expect(html.textContent).not.toContain('manchas en la espalda');
    http.expectNone('/ai/v1/triage/analyze');

    vi.advanceTimersByTime(600);
    const req = http.expectOne('/ai/v1/triage/analyze');
    expect(req.request.body).toEqual({ text: 'Me salieron unas manchas raras en la espalda' });
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(MANCHAS);
    fixture.detectChanges();

    expect(html.querySelector('.sintomas__chips')?.textContent).toContain('manchas en la espalda');
    expect(html.querySelector('.sintomas__recomendaciones')?.textContent).toContain('Dermatología');
  });

  it('si el servicio no responde, la pantalla sigue con lo que reconoce sola', () => {
    escribir('me duele la cabeza');
    vi.advanceTimersByTime(600);
    http.expectOne('/ai/v1/triage/analyze').flush('caído', { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();

    expect(html.querySelector('.sintomas__chips')?.textContent).toContain('dolor de cabeza');
  });

  it('lo que se cuenta ilumina la silueta y las pastillas, sin abrir ninguna zona', () => {
    escribir('me duele la rodilla y ando triste');
    fixture.detectChanges();

    expect(html.querySelector('[data-testid="body-map-marcadas"]')?.textContent).toContain('Rodillas');
    expect(
      html.querySelector('[data-testid="body-map-rodillas"]')?.closest('g')?.classList,
    ).toContain('body-map__zona--marcada');
    expect(html.querySelector('[data-testid="zona-animo"]')?.classList).toContain('is-marcada');
    expect(html.querySelector('[data-testid="zona-abierta"]')).toBeNull();

    // La lectura del servicio se pide igual; se la da por atendida.
    vi.advanceTimersByTime(600);
    http.match('/ai/v1/triage/analyze').forEach((req) => req.flush({ symptoms: [], urgency: 'programada' }));
  });

  it('con menos de tres letras no pregunta nada', () => {
    escribir('me');
    vi.advanceTimersByTime(2_000);
    http.expectNone('/ai/v1/triage/analyze');
  });
});

/**
 * «Salud íntima» respeta el sexo del propio perfil (P-04, 2026-09-25): quien
 * busca ahí no puede elegir lo que corresponde al otro sexo, ni por la
 * pastilla, ni por el texto reconocido, ni por la sugerencia. Sin ese dato
 * —perfil `INTERSEX`/`UNKNOWN`, sin sesión, o un fallo al leerlo— se ve todo,
 * como hasta ahora: mejor mostrar de más que esconder un síntoma real.
 */
describe('SymptomCheck · «Salud íntima» respeta el sexo del paciente', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<SymptomCheck>>;
  let componente: SymptomCheck;
  let html: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SymptomCheck);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  /** Abre la zona íntima tocándola en la figura, como en «la silueta». */
  function abrirZonaIntima(): void {
    html = fixture.nativeElement as HTMLElement;
    const forma = html.querySelector<HTMLElement>('[data-testid="body-map-intima"]');
    if (forma === null) throw new Error('la figura no dibuja «intima»');
    forma.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  }

  function pastillasDeLaZona(): readonly string[] {
    return Array.from(
      html.querySelectorAll('[data-testid="zona-abierta"] .sintomas__opcion-chip'),
    ).map((boton) => boton.textContent?.trim() ?? '');
  }

  function siluetaHija(): BodyMap {
    return fixture.debugElement.query(By.directive(BodyMap)).componentInstance as BodyMap;
  }

  it('con perfil `FEMALE`, no ofrece los síntomas exclusivos de varón', () => {
    responderSexoPropio(http, 'FEMALE');
    abrirZonaIntima();

    const pastillas = pastillasDeLaZona();
    expect(pastillas).toContain('dolor menstrual');
    expect(pastillas).toContain('control de embarazo');
    expect(pastillas).not.toContain('consulta de próstata');
    expect(pastillas).not.toContain('problemas de erección');
    expect(pastillas).not.toContain('dolor o bulto en los testículos');
  });

  it('con perfil `MALE`, no ofrece los síntomas exclusivos de mujer', () => {
    responderSexoPropio(http, 'MALE');
    abrirZonaIntima();

    const pastillas = pastillasDeLaZona();
    expect(pastillas).toContain('consulta de próstata');
    expect(pastillas).toContain('problemas de erección');
    expect(pastillas).not.toContain('dolor menstrual');
    expect(pastillas).not.toContain('control de embarazo');
    expect(pastillas).not.toContain('flujo o picazón vaginal');
  });

  it('con perfil `INTERSEX`, no filtra: se ve todo', () => {
    responderSexoPropio(http, 'INTERSEX');
    abrirZonaIntima();

    const pastillas = pastillasDeLaZona();
    expect(pastillas).toContain('dolor menstrual');
    expect(pastillas).toContain('consulta de próstata');
  });

  it('sin sexo resuelto todavía (la lectura no respondió), no filtra: se ve todo', () => {
    // A propósito no se responde `http.expectOne(...)`: mientras está en
    // vuelo, `sexoAlNacer` sigue en su valor inicial (`undefined`).
    abrirZonaIntima();

    const pastillas = pastillasDeLaZona();
    expect(pastillas).toContain('dolor menstrual');
    expect(pastillas).toContain('consulta de próstata');

    // Se responde al final para que `http.verify()` no se queje.
    http.expectOne('/profiles/patients/me').flush({});
  });

  it('si la lectura del propio perfil falla, no filtra: se ve todo', () => {
    http
      .expectOne('/profiles/patients/me')
      .flush('error', { status: 500, statusText: 'Internal Server Error' });
    fixture.detectChanges();
    abrirZonaIntima();

    const pastillas = pastillasDeLaZona();
    expect(pastillas).toContain('dolor menstrual');
    expect(pastillas).toContain('consulta de próstata');
  });

  it('el texto reconocido tampoco ofrece lo que no corresponde al sexo', () => {
    responderSexoPropio(http, 'MALE');
    (componente as unknown as { escribir(v: string): void }).escribir(
      'tengo dolor menstrual y me duele la cabeza',
    );
    fixture.detectChanges();
    http.match(() => true); // el catálogo de especialidades, atendido sin más.

    const nombres = (componente as unknown as { sintomas(): { nombre: string }[] })
      .sintomas()
      .map((s) => s.nombre);
    expect(nombres).toContain('dolor de cabeza');
    expect(nombres).not.toContain('dolor menstrual');
  });

  it('no filtra las alarmas: siguen viéndose pase lo que pase con el sexo', () => {
    responderSexoPropio(http, 'FEMALE');
    (componente as unknown as { escribir(v: string): void }).escribir('me duele el pecho');
    fixture.detectChanges();
    http.match(() => true);

    html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('app-alert')?.textContent).toContain('guardia');
  });

  it('pasa el sexo del propio perfil a la silueta', () => {
    responderSexoPropio(http, 'FEMALE');
    fixture.detectChanges();

    expect(siluetaHija().sexo()).toBe('FEMALE');
  });

  it('sin sexo conocido, la silueta queda neutra', () => {
    responderSexoPropio(http, 'UNKNOWN');
    fixture.detectChanges();

    expect(siluetaHija().sexo()).toBeUndefined();
  });
});
