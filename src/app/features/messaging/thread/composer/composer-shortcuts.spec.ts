import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { ChatStore } from '../../../../core/messaging/chat.store';
import { PDF_PAGE_COUNTER } from './attachment-preview/pdf-page-count';
import { AttachmentPreparer } from './attachment-preparer';
import { Composer, SUGERENCIAS_POR_OMISION } from './composer';

/**
 * Lo que esta rama le suma al adjuntar de dev (estilo WhatsApp Web): la foto y
 * la cámara a mano en la píldora, pegar con Ctrl+V, las respuestas rápidas y
 * que todo lo que entra pase por {@link AttachmentPreparer} (achicado y sin
 * EXIF). El flujo de la vista previa en sí lo fija `composer.spec.ts`.
 */
describe('Composer · atajos del marketplace', () => {
  let fixture: ComponentFixture<Composer>;
  let preparados: File[];
  const store = {
    borrador: () => '',
    editando: signal<null>(null),
    respondiendoA: signal<null>(null),
    activaId: signal<string | null>('c-1'),
    hiloCargado: signal(true),
    mensajes: signal<readonly unknown[]>([]),
    pendientes: signal<readonly { conversationId: string }[]>([]),
    enviarAdjunto: vi.fn(),
    enviarAdjuntos: vi.fn(),
    enviar: vi.fn(),
    guardarBorrador: vi.fn(),
    responder: vi.fn(),
    editar: vi.fn(),
    confirmarEdicion: vi.fn(),
    enviarSticker: vi.fn(),
  };

  const consultar = (testid: string): HTMLElement | null =>
    document.querySelector(`[data-testid="${testid}"]`);
  const todos = (testid: string): HTMLElement[] =>
    Array.from(document.querySelectorAll(`[data-testid="${testid}"]`));
  const foto = (nombre: string) => new File(['x'], nombre, { type: 'image/png' });

  async function montar(sugerencias: readonly string[] = []): Promise<void> {
    TestBed.configureTestingModule({
      imports: [Composer],
      providers: [
        { provide: ChatStore, useValue: store },
        { provide: PDF_PAGE_COUNTER, useValue: async () => null },
        {
          provide: AttachmentPreparer,
          useValue: {
            prepare: async (file: File) => {
              preparados.push(file);
              return file;
            },
            prepareAll: async (files: Iterable<File>) => {
              const accepted = Array.from(files);
              preparados.push(...accepted);
              return { accepted, rejection: null };
            },
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of({ get: () => 'c-1' }), queryParamMap: of({ get: () => null }) },
        },
      ],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(Composer);
    fixture.componentRef.setInput('sugerencias', sugerencias);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    preparados = [];
    vi.clearAllMocks();
    store.mensajes.set([]);
  });

  afterEach(() => {
    fixture?.destroy();
    document.body.innerHTML = '';
  });

  it('la foto y la cámara están en la píldora, sin abrir el menú', async () => {
    await montar();
    const camara = consultar('composer-input-camara') as HTMLInputElement;
    expect(consultar('composer-foto')).not.toBeNull();
    expect(consultar('composer-camara')).not.toBeNull();
    expect(camara.getAttribute('capture')).toBe('environment');
    expect(camara.accept).toBe('image/*');

    const abrirCamara = vi.spyOn(camara, 'click').mockImplementation(() => undefined);
    consultar('composer-camara')!.click();
    expect(abrirCamara).toHaveBeenCalled();
  });

  it('pegar una imagen con Ctrl+V la prepara y abre la vista previa', async () => {
    await montar();
    const pegada = foto('captura.png');
    const evento = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(evento, 'clipboardData', { value: { files: [pegada], items: [] } });
    consultar('hilo-texto')!.dispatchEvent(evento);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(preparados).toEqual([pegada]);
    expect(consultar('composer-vista-previa')).not.toBeNull();
    expect(todos('vista-miniatura')).toHaveLength(1);
  });

  it('pegar texto no abre nada: el texto lo maneja el campo', async () => {
    await montar();
    const evento = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(evento, 'clipboardData', { value: { files: [], items: [] } });
    consultar('hilo-texto')!.dispatchEvent(evento);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(preparados).toEqual([]);
    expect(consultar('composer-vista-previa')).toBeNull();
  });

  it('con el hilo vacío ofrece respuestas rápidas; tocar una la escribe, no la manda', async () => {
    await montar();
    expect(todos('composer-sugerencia').map((b) => b.textContent?.trim())).toEqual([
      ...SUGERENCIAS_POR_OMISION,
    ]);
    todos('composer-sugerencia')[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect((consultar('hilo-texto') as HTMLTextAreaElement).value).toBe(SUGERENCIAS_POR_OMISION[0]);
    expect(store.enviar).not.toHaveBeenCalled();
  });

  it('las sugerencias que pasa el hilo mandan sobre las de fábrica', async () => {
    await montar(['¿Cuándo llega mi pedido?']);
    expect(todos('composer-sugerencia').map((b) => b.textContent?.trim())).toEqual([
      '¿Cuándo llega mi pedido?',
    ]);
  });

  it('la sugerencia que pide una foto abre el selector de imágenes', async () => {
    await montar();
    const entrada = consultar('composer-input-archivos') as HTMLInputElement;
    const abrirSelector = vi.spyOn(entrada, 'click').mockImplementation(() => undefined);
    const pideFoto = todos('composer-sugerencia').find((b) => /foto/iu.test(b.textContent ?? ''));
    pideFoto!.click();

    expect(abrirSelector).toHaveBeenCalled();
    expect(entrada.accept).toBe('image/*');
  });

  it('con mensajes en el hilo no hay sugerencias de fábrica', async () => {
    store.mensajes.set([{ id: 'm-1' }]);
    await montar();
    expect(consultar('composer-sugerencias')).toBeNull();
  });
});
