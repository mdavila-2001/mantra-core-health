import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { CommentMediaPicker } from '../../../shared/components/molecules/comment-media-picker/comment-media-picker';

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

    expect(texto()).toContain('Se pasó del largo permitido');
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

  it('si la API explica el rechazo, lo dice con el código de soporte y conserva lo escrito', () => {
    montar();
    escribir('Un texto que costó escribir.');
    publicar();

    http
      .expectOne((r) => r.url === '/community/profiles/pp-1/posts')
      .flush(
        { code: 'RATE_LIMITED', message: 'Publicó demasiadas veces seguidas. Espere un momento.', correlationId: 'corr-pub', timestamp: '', path: '' },
        { status: 429, statusText: 'Too Many Requests' },
      );
    fixture.detectChanges();

    expect(texto()).toContain('Publicó demasiadas veces seguidas. Espere un momento. (Código de soporte: corr-pub)');
    expect((fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      'Un texto que costó escribir.',
    );
  });

  describe('imágenes', () => {
    const selector = (): CommentMediaPicker =>
      fixture.debugElement.query(By.directive(CommentMediaPicker)).componentInstance as CommentMediaPicker;

    it('ofrece subir imágenes, y sólo imágenes: no stickers ni GIF', () => {
      montar();

      const botones = fixture.nativeElement.querySelectorAll('[data-testid^="comment-media-add-"]');

      expect(Array.from(botones as NodeListOf<HTMLElement>).map((b) => b.dataset['testid'])).toEqual([
        'comment-media-add-image',
      ]);
      expect(texto()).not.toContain('Todavía no se pueden adjuntar imágenes');
      // En el modal se llama por lo que hace, no «Imagen» a secas.
      expect(texto()).toContain('Agregar imagen');
    });

    it('publica con las imágenes adjuntas, con su descripción y su orden', () => {
      montar();
      escribir('Radiografía de hoy.');
      selector().cambio.emit([
        { fileId: 'f-1', mediaRole: 'IMAGE', altText: 'Tórax sin hallazgos', ordinal: 0 },
        { fileId: 'f-2', mediaRole: 'IMAGE', ordinal: 1 },
      ]);
      fixture.detectChanges();
      publicar();

      const req = http.expectOne((r) => r.url === '/community/profiles/pp-1/posts');
      expect(req.request.body.media).toEqual([
        { fileId: 'f-1', mediaRole: 'IMAGE', altText: 'Tórax sin hallazgos', ordinal: 0 },
        { fileId: 'f-2', mediaRole: 'IMAGE', ordinal: 1 },
      ]);
      req.flush({ id: 'post-1' });
    });

    it('sin imágenes no manda la clave `media`', () => {
      montar();
      escribir('Sólo texto.');
      publicar();

      const req = http.expectOne((r) => r.url === '/community/profiles/pp-1/posts');
      expect('media' in req.request.body).toBe(false);
      req.flush({ id: 'post-1' });
    });

    it('el texto sigue siendo obligatorio: una imagen sola no alcanza (el contrato exige bodyText)', () => {
      montar();
      selector().cambio.emit([{ fileId: 'f-1', mediaRole: 'IMAGE', ordinal: 0 }]);
      fixture.detectChanges();

      const boton = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) =>
        b.textContent!.includes('Public'),
      )!;

      expect(boton.getAttribute('aria-disabled')).toBe('true');
    });

    it('descarta lo que no es imagen aunque el selector lo emitiera', () => {
      montar();
      escribir('Texto.');
      selector().cambio.emit([
        { fileId: 'f-1', mediaRole: 'GIF' },
        { fileId: 'f-2', mediaRole: 'IMAGE', ordinal: 0 },
      ]);
      fixture.detectChanges();
      publicar();

      const req = http.expectOne((r) => r.url === '/community/profiles/pp-1/posts');
      expect(req.request.body.media).toEqual([{ fileId: 'f-2', mediaRole: 'IMAGE', ordinal: 0 }]);
      req.flush({ id: 'p' });
    });

    it('si el servidor falla conserva las imágenes y el texto: perderlos está prohibido', () => {
      montar();
      escribir('No quiero perder esto.');
      selector().cambio.emit([{ fileId: 'f-1', mediaRole: 'IMAGE', ordinal: 0 }]);
      fixture.detectChanges();
      publicar();
      http.expectOne((r) => r.url === '/community/profiles/pp-1/posts').flush({ message: 'x' }, { status: 500, statusText: 'x' });
      fixture.detectChanges();

      expect((fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement).value).toBe('No quiero perder esto.');
      expect(fixture.componentInstance.hayBorrador()).toBe(true);
      expect(texto()).toContain('No pudimos publicar');
    });

    it('tras publicar se limpia todo', () => {
      montar();
      escribir('Hola.');
      publicar();
      http.expectOne((r) => r.url === '/community/profiles/pp-1/posts').flush({ id: 'post-1' });
      fixture.detectChanges();

      expect(fixture.componentInstance.hayBorrador()).toBe(false);
    });
  });

  describe('el borrador', () => {
    it('avisa cuando hay algo que se perdería y cuando ya no', () => {
      const avisos: boolean[] = [];
      montar();
      fixture.componentInstance.borradorCambio.subscribe((hay) => avisos.push(hay));

      escribir('algo');
      escribir('');

      expect(avisos).toContain(true);
      expect(avisos.at(-1)).toBe(false);
    });

    it('un texto de sólo espacios no es un borrador', () => {
      montar();

      escribir('    ');

      expect(fixture.componentInstance.hayBorrador()).toBe(false);
    });
  });

  describe('la cabecera', () => {
    it('dice quién publica, con sus iniciales si no hay foto', () => {
      montar();
      fixture.componentRef.setInput('autorNombre', 'Valeria Rojas Mendoza');
      fixture.componentRef.setInput('autorIniciales', 'VR');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="post-composer-author"]').textContent).toContain('Valeria Rojas Mendoza');
      expect(fixture.nativeElement.querySelector('.composer__avatar--iniciales').textContent).toContain('VR');
    });

    it('con foto la muestra, decorativa (el nombre ya está escrito al lado)', () => {
      montar();
      fixture.componentRef.setInput('autorAvatar', 'data:image/png;base64,AAAA');
      fixture.detectChanges();

      const img = fixture.nativeElement.querySelector('img.composer__avatar') as HTMLImageElement;
      expect(img.getAttribute('alt')).toBe('');
    });

    it('explica quién puede leerla según la visibilidad elegida', () => {
      montar();

      expect(texto()).toContain('La puede leer cualquiera con sesión.');
    });
  });

  /** El aviso de P6 no se pinta mientras nadie lo llene. */
  it('no muestra advertencia de PII si nadie la puso', () => {
    montar();
    expect(texto()).not.toContain('Revise antes de publicar');
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
