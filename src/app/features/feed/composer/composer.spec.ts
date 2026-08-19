import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Composer, etiquetasDe, POST_BODY_MAX } from './composer';

/**
 * Lo que estas pruebas fijan.
 *
 * Cuatro cosas que no se ven leyendo el HTML: que el tope de caracteres es **el
 * del servidor** y no uno inventado acá; que dos pulsaciones rápidas no publican
 * dos veces; que una visibilidad fuera del contrato **no** cae en `PUBLIC` —
 * publicar más abierto de lo que se pidió es el peor error de esta pantalla—; y
 * que si el envío falla, el texto no se pierde.
 */
describe('Composer', () => {
  let fixture: ComponentFixture<Composer>;
  let http: HttpTestingController;

  const texto = (): string => fixture.nativeElement.textContent as string;

  const montar = (): void => {
    fixture = TestBed.createComponent(Composer);
    fixture.componentRef.setInput('profileId', 'pp-1');
    fixture.detectChanges();
  };

  const escribir = (valor: string): void => {
    const area: HTMLTextAreaElement =
      fixture.nativeElement.querySelector('textarea');
    area.value = valor;
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  /**
   * Pulsa «Publicar». Busca por el prefijo porque el rótulo cambia a
   * «Publicando…» mientras hay un envío en vuelo — y eso es justamente lo que se
   * quiere poder pulsar de nuevo en la prueba de single-flight.
   */
  const publicar = (): void => {
    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    botones.find((b) => b.textContent!.includes('Public'))!.click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Composer],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('publica el texto con la visibilidad elegida', () => {
    montar();
    escribir('  Un caso de la guardia de anoche.  ');
    publicar();

    const req = http.expectOne(
      (r) => r.url === '/community/profiles/pp-1/posts',
    );
    expect(req.request.method).toBe('POST');
    // El texto va recortado: los espacios de los extremos no son contenido.
    expect(req.request.body).toEqual({
      bodyText: 'Un caso de la guardia de anoche.',
      visibility: 'PUBLIC',
      hashtags: undefined,
    });
    req.flush({ id: 'post-9' });
  });

  /**
   * Se deduplica por caso, **no** por acento: `#Cardiología` y `#cardiología`
   * son la misma etiqueta, pero `#cardiologia` sin tilde es otra. Normalizar
   * acentos acá divergiría del `upsert` que hace el servidor con el texto que
   * recibe.
   */
  it('deriva las etiquetas del cuerpo, sin el numeral y sin repetir', () => {
    montar();
    escribir('Sobre #Cardiología y #cardiología otra vez #guardia');
    publicar();

    const req = http.expectOne(
      (r) => r.url === '/community/profiles/pp-1/posts',
    );
    expect(req.request.body.hashtags).toEqual(['cardiología', 'guardia']);
    req.flush({ id: 'post-9' });
  });

  /**
   * Una publicación duplicada no se puede deshacer desde esta pantalla, así que
   * la guarda no puede depender sólo del `disabled` del botón.
   */
  it('dos pulsaciones seguidas publican una sola vez', () => {
    montar();
    escribir('Algo para compartir.');
    publicar();
    publicar();

    http.expectOne((r) => r.url === '/community/profiles/pp-1/posts').flush({
      id: 'post-9',
    });
  });

  it('no publica un cuerpo vacío ni uno de sólo espacios', () => {
    montar();
    escribir('    ');
    publicar();

    http.expectNone((r) => r.url === '/community/profiles/pp-1/posts');
  });

  /**
   * El tope sale del DTO (`@MaxLength(5000)`). Si el cliente permitiera más, la
   * persona escribiría un texto que el servidor rechaza y lo perdería al enviar.
   */
  it('avisa al pasarse del largo del servidor y no envía', () => {
    montar();
    escribir('x'.repeat(POST_BODY_MAX + 1));
    publicar();

    expect(texto()).toContain('Te pasaste del largo permitido');
    http.expectNone((r) => r.url === '/community/profiles/pp-1/posts');
  });

  /**
   * Si falló, el texto escrito es lo único que no se puede recuperar.
   */
  it('si el servidor falla, avisa y conserva lo escrito', () => {
    montar();
    escribir('Un texto que costó escribir.');
    publicar();

    http
      .expectOne((r) => r.url === '/community/profiles/pp-1/posts')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos publicar');
    const area: HTMLTextAreaElement =
      fixture.nativeElement.querySelector('textarea');
    expect(area.value).toBe('Un texto que costó escribir.');
  });

  /**
   * El punto de extensión de P5 tiene que estar visible y apagado, con el motivo
   * escrito. Un selector de archivos que no sube nada sería peor.
   */
  it('el botón de imágenes está presente y deshabilitado, con su motivo', () => {
    montar();

    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const imagenes = botones.find((b) =>
      b.textContent!.includes('Agregar imágenes'),
    )!;

    expect(imagenes).toBeDefined();
    // `aria-disabled` y no el atributo nativo: es como deshabilita `app-button`,
    // para que el botón siga siendo alcanzable por teclado y anuncie por qué no
    // se puede usar en vez de desaparecer del recorrido de foco.
    expect(imagenes.getAttribute('aria-disabled')).toBe('true');
    expect(texto()).toContain('Todavía no se pueden adjuntar imágenes');
  });

  /** El aviso de P6 no se pinta mientras nadie lo llene. */
  it('no muestra advertencia de PII si nadie la puso', () => {
    montar();
    expect(texto()).not.toContain('Revisá antes de publicar');
  });

  it('muestra la advertencia de PII cuando se la pasan', () => {
    montar();
    fixture.componentRef.setInput(
      'avisoPii',
      'El texto parece incluir el nombre de un paciente.',
    );
    fixture.detectChanges();

    expect(texto()).toContain('El texto parece incluir el nombre de un paciente');
  });
});

describe('etiquetasDe', () => {
  it('normaliza a minúsculas y quita el numeral', () => {
    expect(etiquetasDe('#Guardia y #GUARDIA')).toEqual(['guardia']);
  });

  it('acepta acentos, números y guiones', () => {
    expect(etiquetasDe('#pediatría-2026 #uti_3')).toEqual([
      'pediatría-2026',
      'uti_3',
    ]);
  });

  it('un numeral solo no es una etiqueta', () => {
    expect(etiquetasDe('El # no dice nada')).toEqual([]);
  });
});
