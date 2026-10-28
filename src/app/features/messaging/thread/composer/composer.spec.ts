import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { Composer, SUGERENCIAS_POR_OMISION, TOPE_DE_COLA } from './composer';
import { LIENZO, type Lienzo } from './preparar-imagen';
import { ChatStore } from '../../../../core/messaging/chat.store';
import { UPLOAD_MAX_BYTES } from '../../../../core/data-access/files/upload-policy';

/**
 * Lo que estas pruebas fijan del composer como «subir fotos de primera»:
 *
 * - **Pegar** una imagen (Ctrl+V) la suma a la cola, y si el portapapeles
 *   también trae texto, el texto se pega igual.
 * - **Varias** fotos por vez, hasta {@link TOPE_DE_COLA}, cada una con su ×; al
 *   enviar salen como un mensaje por archivo y el texto viaja con la primera.
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

  /** Un lienzo que mide 1200×900: ninguna foto de prueba necesita achicarse. */
  const lienzo: Lienzo = {
    decodificar: async () => ({ ancho: 1200, alto: 900, dibujable: {} as CanvasImageSource, cerrar: () => undefined }),
    codificar: async () => new Blob(['y'], { type: 'image/jpeg' }),
  };

  const foto = (nombre: string, tipo = 'image/jpeg', bytes = 1000): File => {
    const f = new File(['x'], nombre, { type: tipo });
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

    it('una imagen pegada se suma a la cola y no se pega como texto', async () => {
      const evento = pegar([foto('image.png', 'image/png')], ['Files']);
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(todos('composer-miniatura')).toHaveLength(1);
      });
      expect(evento.defaultPrevented).toBe(true);
      expect(consultar('composer-miniatura')?.textContent).toContain('image.png');
    });

    it('si el portapapeles también trae texto, el texto se pega igual', () => {
      const evento = pegar([foto('a.png', 'image/png')], ['text/plain', 'Files']);
      expect(evento.defaultPrevented).toBe(false);
    });

    it('pegar sólo texto no toca la cola', () => {
      const evento = pegar([], ['text/plain']);
      expect(evento.defaultPrevented).toBe(false);
      fixture.detectChanges();
      expect(todos('composer-miniatura')).toHaveLength(0);
    });
  });

  describe('varias fotos', () => {
    it('muestra una miniatura por foto, con su × y su nombre y peso accesibles', async () => {
      await agregar([foto('1.jpg'), foto('2.jpg', 'image/png', 2048), foto('3.webp', 'image/webp')]);

      const miniaturas = todos('composer-miniatura');
      expect(miniaturas).toHaveLength(3);
      expect(miniaturas[1].textContent).toContain('2.jpg, 2 KB');
      expect(todos('composer-miniatura-quitar').map((b) => b.getAttribute('aria-label'))).toEqual([
        'Quitar 1.jpg',
        'Quitar 2.jpg',
        'Quitar 3.webp',
      ]);
      expect(consultar('hilo-enviar')?.getAttribute('aria-label')).toBe('Enviar 3 archivos');
    });

    it('la × quita sólo esa', async () => {
      await agregar([foto('1.jpg'), foto('2.jpg')]);
      todos('composer-miniatura-quitar')[0].click();
      fixture.detectChanges();
      expect(todos('composer-miniatura').map((m) => m.title)).toEqual(['2.jpg, 1000 bytes']);
    });

    it('al enviar sale un mensaje por foto y el texto viaja con la primera', async () => {
      const archivos = [foto('1.jpg'), foto('2.jpg'), foto('3.jpg')];
      await agregar(archivos);
      const area = consultar('hilo-texto') as HTMLTextAreaElement;
      area.value = 'La receta, frente y dorso';
      area.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      consultar('hilo-enviar')!.click();
      fixture.detectChanges();

      expect(store.enviarAdjuntos).toHaveBeenCalledOnce();
      const [enviados, leyenda] = store.enviarAdjuntos.mock.calls[0];
      expect((enviados as File[]).map((f) => f.name)).toEqual(['1.jpg', '2.jpg', '3.jpg']);
      expect(leyenda).toBe('La receta, frente y dorso');
      expect(store.enviar).not.toHaveBeenCalled();
      expect(todos('composer-miniatura')).toHaveLength(0);
    });

    it(`no pasa de ${TOPE_DE_COLA} y avisa`, async () => {
      await agregar(Array.from({ length: TOPE_DE_COLA + 2 }, (_, i) => foto(`${i}.jpg`)));
      expect(todos('composer-miniatura')).toHaveLength(TOPE_DE_COLA);
      expect(errorVisible()).toContain(`hasta ${TOPE_DE_COLA} archivos`);
      // Llena, ya no ofrece sumar otra.
      expect(consultar('composer-sumar-foto')).toBeNull();
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
          { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => 'c-1' }), queryParamMap: of({ get: () => null }) } },
        ],
      });
      await TestBed.compileComponents();
      fixture = TestBed.createComponent(Composer);
      composer = fixture.componentInstance;
      fixture.detectChanges();

      const promesa = composer.agregar([foto('lenta.jpg')]);
      fixture.detectChanges();
      const boton = consultar('hilo-enviar') as HTMLButtonElement;
      expect(boton.disabled).toBe(true);
      expect(consultar('composer-miniatura')?.getAttribute('aria-busy')).toBe('true');

      soltar();
      await promesa;
      fixture.detectChanges();
      expect((consultar('hilo-enviar') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('rechazos', () => {
    it('rechaza lo que no es foto ni PDF', async () => {
      await agregar([new File(['hola'], 'nota.txt', { type: 'text/plain' })]);
      expect(todos('composer-miniatura')).toHaveLength(0);
      expect(errorVisible()).toContain('«nota.txt» no se puede mandar');
    });

    it('rechaza un PDF de más de 10 MB', async () => {
      await agregar([foto('estudio.pdf', 'application/pdf', UPLOAD_MAX_BYTES + 1)]);
      expect(todos('composer-miniatura')).toHaveLength(0);
      expect(errorVisible()).toContain('«estudio.pdf» pesa más de 10 MB');
    });

    it('rechaza un GIF de más de 10 MB y deja las demás', async () => {
      await agregar([foto('ok.jpg'), foto('largo.gif', 'image/gif', UPLOAD_MAX_BYTES + 1)]);
      expect(todos('composer-miniatura')).toHaveLength(1);
      expect(errorVisible()).toContain('«largo.gif» pesa más de 10 MB');
    });

    it('acepta un PDF chico, con su vista previa grande', async () => {
      await agregar([foto('receta.pdf', 'application/pdf', 5000)]);
      expect(todos('composer-miniatura')).toHaveLength(1);
      expect(fixture.nativeElement.querySelector('app-file-preview')).not.toBeNull();
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

    it('lo elegido en el selector entra en la cola', async () => {
      const entrada = consultar('composer-input-archivos') as HTMLInputElement;
      Object.defineProperty(entrada, 'files', { value: [foto('a.jpg'), foto('b.jpg')], configurable: true });
      entrada.dispatchEvent(new Event('change'));
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(todos('composer-miniatura')).toHaveLength(2);
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
});
