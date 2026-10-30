import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import { Composer, SUGERENCIAS_POR_OMISION, TOPE_DE_COLA } from './composer';
import { LIENZO, type Lienzo } from './preparar-imagen';
import { ChatStore } from '../../../../core/messaging/chat.store';
import { UPLOAD_MAX_BYTES } from '../../../../core/data-access/files/upload-policy';
import { ImageEditor } from './image-editor/image-editor';
import { PDF_PAGE_COUNTER } from './attachment-preview/pdf-page-count';

/** Firma + IHDR + IEND: el PNG más chico bien armado, sin metadatos. */
const PNG_LIMPIO = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0,
]);

/**
 * Un lienzo que mide 1200×900: ninguna foto de prueba necesita achicarse.
 * Codifica a 1000 bytes, el mismo peso de las fotos de prueba: los JPEG se
 * redibujan siempre (para quitarles el EXIF) y salen de acá.
 */
const LIENZO_DE_PRUEBA: Lienzo = {
  decodificar: async () => ({ ancho: 1200, alto: 900, dibujable: {} as CanvasImageSource, cerrar: () => undefined }),
  codificar: async (_f, _w, _h, tipo) => new Blob([new Uint8Array(1000)], { type: tipo }),
};

/**
 * Lo que estas pruebas fijan del composer como «subir fotos de primera»:
 *
 * - **Pegar** una imagen (Ctrl+V) la suma a la vista previa, y si el
 *   portapapeles también trae texto, el texto se pega igual.
 * - **Varias** fotos por vez, hasta {@link TOPE_DE_COLA}, cada una con su ×; al
 *   enviar salen como un mensaje por archivo y lo escrito viaja con la primera.
 * - Las fotos se **preparan** antes de abrir la vista previa, y mientras tanto
 *   no se envía nada.
 * - **Rechazos** por tipo y por tamaño, con mensaje en castellano.
 * - **Respuestas rápidas**: con el hilo vacío aparecen las de siempre, las que
 *   pasa el hilo mandan, tocar una escribe (no envía) y se retiran al enviar.
 */
describe('Composer', () => {
  let fixture: ComponentFixture<Composer>;
  let composer: Composer;

  const store = {
    editando: signal(null),
    respondiendoA: signal(null),
    activaId: signal<string | null>('c-1'),
    hiloCargado: signal(true),
    mensajes: signal<readonly unknown[]>([]),
    pendientes: signal<readonly { conversationId: string }[]>([]),
    borrador: () => '',
    guardarBorrador: vi.fn(),
    enviar: vi.fn(),
    enviarAdjunto: vi.fn(),
    enviarAdjuntos: vi.fn(),
    enviarSticker: vi.fn(),
    confirmarEdicion: vi.fn(),
    editar: vi.fn(),
    responder: vi.fn(),
  };

  const lienzo = LIENZO_DE_PRUEBA;

  const foto = (nombre: string, tipo = 'image/jpeg', bytes = 1000): File => {
    const f = new File([tipo === 'image/png' ? PNG_LIMPIO : 'x'], nombre, { type: tipo });
    Object.defineProperty(f, 'size', { value: bytes });
    return f;
  };

  const consultar = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  const todos = (testid: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testid}"]`));

  /** Suma archivos y espera a que terminen de prepararse. */
  const agregar = async (archivos: File[]): Promise<void> => {
    await composer.agregar(archivos);
    fixture.detectChanges();
  };

  const errorVisible = (): string =>
    (fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null)?.textContent ?? '';

  beforeEach(async () => {
    vi.clearAllMocks();
    store.mensajes.set([]);
    store.pendientes.set([]);
    store.hiloCargado.set(true);
    TestBed.configureTestingModule({
      imports: [Composer],
      providers: [
        { provide: ChatStore, useValue: store },
        { provide: LIENZO, useValue: lienzo },
        { provide: PDF_PAGE_COUNTER, useValue: async () => null },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => 'c-1' }),
            queryParamMap: of({ get: () => null }),
          },
        },
      ],
    });
    // El panel de emojis va en un `@defer`: sin compilar antes, el componente
    // queda con metadatos pendientes.
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(Composer);
    composer = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('pegar desde el portapapeles', () => {
    const pegar = (archivos: File[], tipos: string[]): Event => {
      const evento = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(evento, 'clipboardData', {
        value: { files: archivos, types: tipos },
      });
      (consultar('hilo-texto') as HTMLTextAreaElement).dispatchEvent(evento);
      return evento;
    };

    it('una imagen pegada se suma a la vista previa y no se pega como texto', async () => {
      const evento = pegar([foto('image.png', 'image/png')], ['Files']);
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(todos('vista-miniatura')).toHaveLength(1);
      });
      expect(evento.defaultPrevented).toBe(true);
      expect(consultar('vista-miniatura')?.getAttribute('aria-label')).toContain('image.png');
    });

    it('si el portapapeles también trae texto, el texto se pega igual', () => {
      const evento = pegar([foto('a.png', 'image/png')], ['text/plain', 'Files']);
      expect(evento.defaultPrevented).toBe(false);
    });

    it('pegar sólo texto no abre la vista previa', () => {
      const evento = pegar([], ['text/plain']);
      expect(evento.defaultPrevented).toBe(false);
      fixture.detectChanges();
      expect(todos('vista-miniatura')).toHaveLength(0);
    });
  });

  describe('varias fotos', () => {
    it('muestra una miniatura por foto, con su × y su nombre accesibles', async () => {
      await agregar([foto('1.jpg'), foto('2.jpg', 'image/png', 2048), foto('3.webp', 'image/webp')]);

      const miniaturas = todos('vista-miniatura');
      expect(miniaturas).toHaveLength(3);
      expect(miniaturas[1].getAttribute('aria-label')).toContain('2.jpg');
      expect(todos('vista-quitar').map((b) => b.getAttribute('aria-label'))).toEqual([
        'Quitar 1.jpg del envío',
        'Quitar 2.jpg del envío',
        'Quitar 3.webp del envío',
      ]);
      expect(consultar('vista-enviar')?.getAttribute('aria-label')).toBe('Enviar 3 archivos');
    });

    it('la × quita sólo esa', async () => {
      await agregar([foto('1.jpg'), foto('2.jpg')]);
      todos('vista-quitar')[0].click();
      fixture.detectChanges();
      const quedan = todos('vista-miniatura');
      expect(quedan).toHaveLength(1);
      expect(quedan[0].getAttribute('aria-label')).toContain('2.jpg');
    });

    it('al enviar sale un mensaje por foto y el texto viaja con la primera', async () => {
      // Lo escrito antes de adjuntar pasa a ser el pie de la primera foto.
      const area = consultar('hilo-texto') as HTMLTextAreaElement;
      area.value = 'La receta, frente y dorso';
      area.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      await agregar([foto('1.jpg'), foto('2.jpg'), foto('3.jpg')]);
      expect(todos('vista-miniatura')).toHaveLength(3);

      consultar('vista-enviar')!.click();
      fixture.detectChanges();

      // Un mensaje por foto, en orden, y el texto sólo con la primera.
      const llamadas = store.enviarAdjunto.mock.calls as [File, string][];
      expect(llamadas.map(([archivo]) => archivo.name)).toEqual(['1.jpg', '2.jpg', '3.jpg']);
      expect(llamadas.map(([, leyenda]) => leyenda)).toEqual(['La receta, frente y dorso', '', '']);
      expect(store.enviar).not.toHaveBeenCalled();
      expect(todos('vista-miniatura')).toHaveLength(0);
    });

    it(`no pasa de ${TOPE_DE_COLA} y avisa`, async () => {
      await agregar(Array.from({ length: TOPE_DE_COLA + 2 }, (_, i) => foto(`${i}.jpg`)));
      expect(todos('vista-miniatura')).toHaveLength(TOPE_DE_COLA);
      expect(errorVisible()).toContain(`hasta ${TOPE_DE_COLA} archivos`);
      // Llena, ya no ofrece sumar otra.
      expect(consultar('vista-sumar')).toBeNull();
    });

    it('no envía mientras una foto se está preparando', async () => {
      let soltar!: () => void;
      const lento: Lienzo = {
        ...lienzo,
        decodificar: () =>
          new Promise((resolver) => {
            soltar = () => resolver({ ancho: 100, alto: 100, dibujable: {} as CanvasImageSource, cerrar: () => undefined });
          }),
      };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
      imports: [Composer],
        providers: [
          { provide: ChatStore, useValue: store },
          { provide: LIENZO, useValue: lento },
          { provide: PDF_PAGE_COUNTER, useValue: async () => null },
          { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => 'c-1' }), queryParamMap: of({ get: () => null }) } },
        ],
      });
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(Composer);
      composer = fixture.componentInstance;
      fixture.detectChanges();

      const area = consultar('hilo-texto') as HTMLTextAreaElement;
      area.value = 'Mi receta';
      area.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const promesa = composer.agregar([foto('lenta.jpg')]);
      fixture.detectChanges();
      const boton = consultar('hilo-enviar') as HTMLButtonElement;
      expect(boton.disabled).toBe(true);
      expect(consultar('composer-preparando')?.getAttribute('aria-busy')).toBe('true');
      expect(todos('vista-miniatura')).toHaveLength(0);

      soltar();
      await promesa;
      fixture.detectChanges();
      expect(consultar('composer-preparando')).toBeNull();
      expect(todos('vista-miniatura')).toHaveLength(1);
      expect((consultar('hilo-enviar') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('rechazos', () => {
    it('rechaza lo que no es foto ni PDF', async () => {
      await agregar([new File(['hola'], 'nota.txt', { type: 'text/plain' })]);
      expect(todos('vista-miniatura')).toHaveLength(0);
      expect(errorVisible()).toContain('«nota.txt» no se puede mandar');
    });

    it('rechaza un PDF de más de 10 MB', async () => {
      await agregar([foto('estudio.pdf', 'application/pdf', UPLOAD_MAX_BYTES + 1)]);
      expect(todos('vista-miniatura')).toHaveLength(0);
      expect(errorVisible()).toContain('«estudio.pdf» pesa más de 10 MB');
    });

    it('rechaza un GIF de más de 10 MB y deja las demás', async () => {
      await agregar([foto('ok.jpg'), foto('largo.gif', 'image/gif', UPLOAD_MAX_BYTES + 1)]);
      expect(todos('vista-miniatura')).toHaveLength(1);
      expect(errorVisible()).toContain('«largo.gif» pesa más de 10 MB');
    });

    it('acepta un PDF chico, con su vista previa grande', async () => {
      await agregar([foto('receta.pdf', 'application/pdf', 5000)]);
      expect(todos('vista-miniatura')).toHaveLength(1);
      expect(consultar('vista-documento')).not.toBeNull();
    });
  });

  describe('botones de foto', () => {
    it('el de foto abre el selector de imágenes, varias a la vez', () => {
      const entrada = consultar('composer-input-archivos') as HTMLInputElement;
      const click = vi.spyOn(entrada, 'click').mockImplementation(() => undefined);
      consultar('composer-foto')!.click();
      expect(click).toHaveBeenCalledOnce();
      expect(entrada.accept).toBe('image/*');
      expect(entrada.multiple).toBe(true);
    });

    it('el de cámara usa la trasera', () => {
      const camara = consultar('composer-input-camara') as HTMLInputElement;
      const click = vi.spyOn(camara, 'click').mockImplementation(() => undefined);
      consultar('composer-camara')!.click();
      expect(click).toHaveBeenCalledOnce();
      expect(camara.getAttribute('capture')).toBe('environment');
      expect(camara.accept).toBe('image/*');
    });

    it('lo elegido en el selector entra en la vista previa', async () => {
      const entrada = consultar('composer-input-archivos') as HTMLInputElement;
      Object.defineProperty(entrada, 'files', { value: [foto('a.jpg'), foto('b.jpg')], configurable: true });
      entrada.dispatchEvent(new Event('change'));
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(todos('vista-miniatura')).toHaveLength(2);
      });
    });
  });

  describe('respuestas rápidas', () => {
    const textos = (): string[] => todos('composer-sugerencia').map((b) => b.textContent!.trim());

    it('con el hilo vacío ofrece las de siempre', () => {
      expect(textos()).toEqual([...SUGERENCIAS_POR_OMISION]);
    });

    it('con mensajes en el hilo y sin sugerencias propias, no ofrece ninguna', () => {
      store.mensajes.set([{}]);
      fixture.detectChanges();
      expect(consultar('composer-sugerencias')).toBeNull();
    });

    it('las que pasa el hilo mandan, aunque ya haya mensajes', () => {
      store.mensajes.set([{}]);
      fixture.componentRef.setInput('sugerencias', ['¿Lo tienen en stock?', '¿Cuánto tarda el envío?']);
      fixture.detectChanges();
      expect(textos()).toEqual(['¿Lo tienen en stock?', '¿Cuánto tarda el envío?']);
    });

    it('tocar una la escribe en el campo y no la envía', async () => {
      todos('composer-sugerencia')[1].click();
      fixture.detectChanges();
      // `ngModel` escribe en el campo en una microtarea.
      await fixture.whenStable();
      expect((consultar('hilo-texto') as HTMLTextAreaElement).value).toBe(SUGERENCIAS_POR_OMISION[1]);
      expect(store.enviar).not.toHaveBeenCalled();
      // Con texto escrito los chips se van: ya se eligió.
      expect(consultar('composer-sugerencias')).toBeNull();
    });

    it('la de la foto de la receta abre el selector de imágenes y queda de leyenda', async () => {
      const entrada = consultar('composer-input-archivos') as HTMLInputElement;
      const click = vi.spyOn(entrada, 'click').mockImplementation(() => undefined);
      const chip = todos('composer-sugerencia').find((b) => /receta/.test(b.textContent ?? ''))!;
      chip.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(click).toHaveBeenCalledOnce();
      expect((consultar('hilo-texto') as HTMLTextAreaElement).value).toContain('foto de mi receta');
    });

    it('se retiran después del primer envío', () => {
      fixture.componentRef.setInput('sugerencias', ['¿Lo tienen en stock?']);
      fixture.detectChanges();
      todos('composer-sugerencia')[0].click();
      fixture.detectChanges();
      consultar('hilo-enviar')!.click();
      fixture.detectChanges();
      expect(store.enviar).toHaveBeenCalledWith('¿Lo tienen en stock?');
      expect(consultar('composer-sugerencias')).toBeNull();
    });
  });

  /**
   * El menú de adjuntar sigue el patrón ARIA de menú. Abierto se muda al
   * <body> (es el `app-menu` del sistema), así que se busca en el documento.
   */
  describe('menú de adjuntar con teclado', () => {
    const items = (): HTMLElement[] =>
      Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const tecla = (destino: Element, key: string): void => {
      destino.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };
    const abrir = async (): Promise<HTMLElement> => {
      const mas = consultar('composer-adjuntar')!;
      mas.click();
      fixture.detectChanges();
      await fixture.whenStable();
      return mas;
    };

    afterEach(() => {
      // Si una prueba falla con el menú abierto, que no quede colgado del body.
      fixture.destroy();
    });

    it('el «+» anuncia que abre un menú y, al abrirlo, el foco entra al primer ítem', async () => {
      const mas = consultar('composer-adjuntar')!;
      expect(mas.getAttribute('aria-haspopup')).toBe('menu');
      expect(mas.getAttribute('aria-expanded')).toBe('false');
      await abrir();
      expect(mas.getAttribute('aria-expanded')).toBe('true');
      expect(items().map((i) => i.textContent?.trim())).toEqual([
        'Fotos y videos',
        'Tomar foto',
        'Documento',
        'Plantilla',
      ]);
      expect(document.activeElement).toBe(items()[0]);
      // Íconos de línea, no emojis.
      expect(items().every((i) => i.querySelector('svg') !== null)).toBe(true);
      expect(items().map((i) => i.textContent).join('')).not.toMatch(/\p{Extended_Pictographic}/u);
    });

    it('↓/↑ recorren con vuelta, Inicio y Fin van a los extremos', async () => {
      await abrir();
      const menu = document.querySelector('[role="menu"]')!;
      tecla(menu, 'ArrowDown');
      expect(document.activeElement).toBe(items()[1]);
      tecla(menu, 'End');
      expect(document.activeElement).toBe(items()[3]);
      tecla(menu, 'ArrowDown');
      expect(document.activeElement).toBe(items()[0]);
      tecla(menu, 'ArrowUp');
      expect(document.activeElement).toBe(items()[3]);
      tecla(menu, 'Home');
      expect(document.activeElement).toBe(items()[0]);
    });

    it('Escape lo cierra y devuelve el foco al «+»', async () => {
      const mas = await abrir();
      tecla(document.querySelector('[role="menu"]')!, 'Escape');
      expect(items()).toHaveLength(0);
      expect(mas.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(mas);
    });

    it('Tab lo cierra', async () => {
      const mas = await abrir();
      tecla(document.querySelector('[role="menu"]')!, 'Tab');
      expect(items()).toHaveLength(0);
      expect(document.activeElement).toBe(mas);
    });

    it('Enter sobre «Documento» abre el selector de PDF y cierra el menú', async () => {
      const entrada = consultar('composer-input-archivos') as HTMLInputElement;
      const click = vi.spyOn(entrada, 'click').mockImplementation(() => undefined);
      await abrir();
      tecla(items()[2], 'Enter');
      expect(click).toHaveBeenCalledOnce();
      expect(entrada.accept.split(',')).toContain('application/pdf');
      expect(items()).toHaveLength(0);
    });

    it('«Plantilla» abre el panel de plantillas', async () => {
      await abrir();
      items()[3].click();
      fixture.detectChanges();
      expect(consultar('hilo-plantilla-nueva')).not.toBeNull();
    });

    it('abrir los emojis con el menú abierto deja un solo panel a la vista', async () => {
      await abrir();
      const emojis = consultar('composer-emojis')!;
      emojis.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      emojis.click();
      fixture.detectChanges();
      expect(items()).toHaveLength(0);
      expect(emojis.getAttribute('aria-expanded')).toBe('true');
    });
  });
});

/**
 * El composer contra un store de mentira: lo que se fija es el contrato con
 * el hilo, que no cambió —cada adjunto sale por `enviarAdjunto(archivo,
 * leyenda)` y después se avisa `enviado`— y el camino nuevo hasta ahí: el
 * menú «+» flotante, la vista previa con varios archivos, el pie de foto que
 * viaja con cada uno y la edición que reemplaza el archivo que se sube.
 */
describe('Composer · adjuntos', () => {
  let fixture: ComponentFixture<Composer>;
  let store: {
    activaId: ReturnType<typeof signal<string | null>>;
    hiloCargado: ReturnType<typeof signal<boolean>>;
    mensajes: ReturnType<typeof signal<readonly unknown[]>>;
    pendientes: ReturnType<typeof signal<readonly { conversationId: string }[]>>;
    borrador: () => string;
    editando: ReturnType<typeof signal<null>>;
    respondiendoA: ReturnType<typeof signal<null>>;
    enviarAdjunto: ReturnType<typeof vi.fn>;
    enviar: ReturnType<typeof vi.fn>;
    guardarBorrador: ReturnType<typeof vi.fn>;
    responder: ReturnType<typeof vi.fn>;
    editar: ReturnType<typeof vi.fn>;
    confirmarEdicion: ReturnType<typeof vi.fn>;
    enviarSticker: ReturnType<typeof vi.fn>;
  };
  let enviados: number;

  const consultar = (testid: string): HTMLElement | null =>
    document.querySelector(`[data-testid="${testid}"]`);
  const todos = (testid: string): HTMLElement[] =>
    Array.from(document.querySelectorAll(`[data-testid="${testid}"]`));
  // Un PNG bien armado y sin metadatos: la preparación lo deja tal cual, así
  // que el archivo que se sube es el mismo que se eligió.
  const foto = (nombre: string) => new File([PNG_LIMPIO], nombre, { type: 'image/png' });

  /** Lo que haría el selector del sistema al volver con archivos. */
  const elegir = async (archivos: File[]) => {
    const entrada = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(entrada, 'files', { configurable: true, value: archivos });
    entrada.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const escribirPie = (valor: string) => {
    const campo = consultar('vista-comentario') as HTMLTextAreaElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    store = {
      // Con mensajes en el hilo: las respuestas rápidas no se meten en estas pruebas.
      activaId: signal<string | null>('c-1'),
      hiloCargado: signal(true),
      mensajes: signal<readonly unknown[]>([{}]),
      pendientes: signal<readonly { conversationId: string }[]>([]),
      borrador: () => '',
      editando: signal(null),
      respondiendoA: signal(null),
      enviarAdjunto: vi.fn(),
      enviar: vi.fn(),
      guardarBorrador: vi.fn(),
      responder: vi.fn(),
      editar: vi.fn(),
      confirmarEdicion: vi.fn(),
      enviarSticker: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [Composer],
      providers: [
        { provide: ChatStore, useValue: store },
        { provide: PDF_PAGE_COUNTER, useValue: async () => null },
        { provide: LIENZO, useValue: LIENZO_DE_PRUEBA },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => 'c-1' }),
            queryParamMap: of({ get: () => null }),
          },
        },
      ],
    });
    // El panel de emojis va en un `@defer`: sin compilar antes, el TestBed no
    // sabe resolver sus dependencias diferidas.
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(Composer);
    document.body.appendChild(fixture.nativeElement);
    enviados = 0;
    fixture.componentInstance.enviado.subscribe(() => (enviados += 1));
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
  });

  it('el «+» abre un menú flotante con Documento, Fotos y videos y Plantilla', async () => {
    const mas = consultar('composer-adjuntar')!;
    expect(mas.getAttribute('aria-haspopup')).toBe('menu');
    mas.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mas.getAttribute('aria-expanded')).toBe('true');
    // El panel se muda al <body>: flota, no empuja el composer.
    const menu = document.body.querySelector(':scope > app-menu[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain('Documento');
    expect(menu?.textContent).toContain('Fotos y videos');
    expect(menu?.textContent).toContain('Plantilla');

    menu!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(mas.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(mas);
  });

  it('«Fotos y videos» abre el selector con varias a la vez y sólo fotos y videos', async () => {
    const entrada = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const abrirSelector = vi.spyOn(entrada, 'click').mockImplementation(() => undefined);
    consultar('composer-adjuntar')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    consultar('composer-fotos')!.click();

    expect(abrirSelector).toHaveBeenCalled();
    expect(entrada.multiple).toBe(true);
    expect(entrada.accept).toBe('image/*,video/*');
  });

  it('elegir varias fotos abre la vista previa con una miniatura por foto', async () => {
    await elegir([foto('a.png'), foto('b.png'), foto('c.png')]);
    expect(consultar('composer-vista-previa')).not.toBeNull();
    expect(todos('vista-miniatura')).toHaveLength(3);
  });

  it('lo que no se puede mandar no entra, y se dice por qué', async () => {
    await elegir([new File(['x'], 'nota.txt', { type: 'text/plain' })]);
    expect(consultar('composer-vista-previa')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Puede mandar imágenes, videos, audios y PDF.');
  });

  it('cada foto sale por enviarAdjunto con su propio pie de foto', async () => {
    const a = foto('a.png');
    const b = foto('b.png');
    await elegir([a, b]);
    escribirPie('El lunar');
    todos('vista-miniatura')[1].click();
    fixture.detectChanges();
    escribirPie('La receta');

    consultar('vista-enviar')!.click();
    fixture.detectChanges();

    expect(store.enviarAdjunto.mock.calls).toEqual([
      [a, 'El lunar'],
      [b, 'La receta'],
    ]);
    expect(enviados).toBe(1);
    expect(consultar('composer-vista-previa')).toBeNull();
  });

  it('lo que ya estaba escrito pasa a ser el pie de la primera foto', async () => {
    const campo = consultar('hilo-texto') as HTMLTextAreaElement;
    campo.value = 'Le mando el análisis';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await elegir([foto('a.png')]);
    expect((consultar('vista-comentario') as HTMLTextAreaElement).value).toBe('Le mando el análisis');

    // Salió con la foto: el campo y el borrador quedan vacíos.
    consultar('vista-enviar')!.click();
    fixture.detectChanges();
    // `ngModel` escribe el campo en una microtarea.
    await fixture.whenStable();
    fixture.detectChanges();
    expect(store.enviarAdjunto).toHaveBeenCalledWith(expect.any(File), 'Le mando el análisis');
    expect((consultar('hilo-texto') as HTMLTextAreaElement).value).toBe('');
    expect(store.guardarBorrador).toHaveBeenLastCalledWith('');
  });

  it('descartar cierra la vista previa sin mandar nada y deja lo escrito', async () => {
    const campo = consultar('hilo-texto') as HTMLTextAreaElement;
    campo.value = 'Borrador';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await elegir([foto('a.png')]);
    consultar('vista-descartar')!.click();
    fixture.detectChanges();

    expect(consultar('composer-vista-previa')).toBeNull();
    expect(store.enviarAdjunto).not.toHaveBeenCalled();
    expect(enviados).toBe(0);
    expect((consultar('hilo-texto') as HTMLTextAreaElement).value).toBe('Borrador');
  });

  it('la imagen editada es la que se sube, con el pie de foto intacto', async () => {
    const original = foto('1792710466504_image.png');
    await elegir([original]);
    escribirPie('Así está hoy');
    consultar('vista-dibujar')!.click();
    fixture.detectChanges();

    const editada = new File(['editada'], 'imagen-editada.png', { type: 'image/png' });
    (fixture.debugElement.query(By.directive(ImageEditor)).componentInstance as ImageEditor).applied.emit(editada);
    fixture.detectChanges();
    consultar('vista-enviar')!.click();

    expect(store.enviarAdjunto).toHaveBeenCalledTimes(1);
    expect(store.enviarAdjunto).toHaveBeenCalledWith(editada, 'Así está hoy');
  });

  it('si parte de lo elegido no entra, se abre igual y lo avisa adentro', async () => {
    const grande = new File(['x'], 'video.mp4', { type: 'video/mp4' });
    Object.defineProperty(grande, 'size', { value: 25 * 1024 * 1024 });
    await elegir([foto('a.png'), grande]);
    expect(todos('vista-miniatura')).toHaveLength(1);
    expect(consultar('composer-vista-previa')!.textContent).toContain('El archivo pesa más de 20 MB.');
  });

  it('editando un mensaje no se adjunta, ni soltando un archivo', async () => {
    store.editando.set({ id: 'm-1', bodyText: 'Texto ya enviado' } as never);
    fixture.detectChanges();
    await elegir([foto('a.png')]);
    expect(consultar('composer-vista-previa')).toBeNull();
    expect(consultar('composer-adjuntar')).toBeNull();
  });

  it('si se quita la foto que heredó lo escrito, la frase queda en el campo', async () => {
    const campo = consultar('hilo-texto') as HTMLTextAreaElement;
    campo.value = 'Le mando el análisis';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await elegir([foto('a.png'), foto('b.png')]);
    todos('vista-quitar')[0].click();
    fixture.detectChanges();
    consultar('vista-enviar')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(store.enviarAdjunto).toHaveBeenCalledTimes(1);
    expect((consultar('hilo-texto') as HTMLTextAreaElement).value).toBe('Le mando el análisis');
  });

  it('un documento muestra su tarjeta y sale igual que una foto', async () => {
    const pdf = new File([new Uint8Array(10)], 'Historia.pdf', { type: 'application/pdf' });
    await elegir([pdf]);
    expect(consultar('vista-documento')).not.toBeNull();
    consultar('vista-enviar')!.click();
    expect(store.enviarAdjunto).toHaveBeenCalledWith(pdf, '');
  });
});
