import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import { Composer } from './composer';
import { ChatStore } from '../../../../core/messaging/chat.store';
import { partitionFiles } from './attachment-draft';
import { AttachmentPreparer } from './attachment-preparer';
import { ImageEditor } from './image-editor/image-editor';
import { PDF_PAGE_COUNTER } from './attachment-preview/pdf-page-count';

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
    borrador: () => string;
    editando: ReturnType<typeof signal<null>>;
    respondiendoA: ReturnType<typeof signal<null>>;
    enviarAdjunto: ReturnType<typeof vi.fn>;
    enviarAdjuntos: ReturnType<typeof vi.fn>;
    activaId: ReturnType<typeof signal<string | null>>;
    hiloCargado: ReturnType<typeof signal<boolean>>;
    mensajes: ReturnType<typeof signal<readonly unknown[]>>;
    pendientes: ReturnType<typeof signal<readonly { conversationId: string }[]>>;
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
  const foto = (nombre: string) => new File(['x'], nombre, { type: 'image/png' });

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
      borrador: () => '',
      editando: signal(null),
      respondiendoA: signal(null),
      enviarAdjunto: vi.fn(),
      enviarAdjuntos: vi.fn(),
      activaId: signal<string | null>('c-1'),
      hiloCargado: signal(true),
      mensajes: signal<readonly unknown[]>([]),
      pendientes: signal<readonly { conversationId: string }[]>([]),
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
        // Acá se prueba el flujo; el achicado y la limpieza de EXIF tienen su
        // propia prueba en `prepare-image.spec.ts`. La validación es la real.
        {
          provide: AttachmentPreparer,
          useValue: {
            prepare: async (file: File) => file,
            prepareAll: async (files: Iterable<File>, room?: number) => partitionFiles(files, room),
          },
        },
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

  it('el «+» abre un menú flotante con Documento, Fotos y Plantilla', async () => {
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
    expect(menu?.textContent).toContain('Fotos');
    // La API sólo guarda imágenes y documentos: no se ofrecen videos.
    expect(menu?.textContent).not.toContain('videos');
    expect(menu?.textContent).toContain('Plantilla');

    menu!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(mas.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(mas);
  });

  it('«Fotos» abre el selector con varias a la vez y sólo imágenes', async () => {
    const entrada = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const abrirSelector = vi.spyOn(entrada, 'click').mockImplementation(() => undefined);
    consultar('composer-adjuntar')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    consultar('composer-fotos')!.click();

    expect(abrirSelector).toHaveBeenCalled();
    expect(entrada.multiple).toBe(true);
    expect(entrada.accept).toBe('image/*');
  });

  it('elegir varias fotos abre la vista previa con una miniatura por foto', async () => {
    await elegir([foto('a.png'), foto('b.png'), foto('c.png')]);
    expect(consultar('composer-vista-previa')).not.toBeNull();
    expect(todos('vista-miniatura')).toHaveLength(3);
  });

  it('lo que no se puede mandar no entra, y se dice por qué', async () => {
    await elegir([new File(['x'], 'clip.mp4', { type: 'video/mp4' })]);
    expect(consultar('composer-vista-previa')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      '«clip.mp4» no se puede mandar. Puede mandar fotos, PDF, documentos de Word o Excel y archivos de texto.',
    );
  });

  it('las fotos salen juntas por enviarAdjuntos, cada una con su propio pie de foto', async () => {
    const a = foto('a.png');
    const b = foto('b.png');
    await elegir([a, b]);
    escribirPie('El lunar');
    todos('vista-miniatura')[1].click();
    fixture.detectChanges();
    escribirPie('La receta');

    consultar('vista-enviar')!.click();
    fixture.detectChanges();

    // Un solo lote: el store las sube en orden y con el perfil fijado al encolar.
    expect(store.enviarAdjuntos.mock.calls).toEqual([
      [
        [
          { archivo: a, leyenda: 'El lunar', vistaPrevia: null },
          { archivo: b, leyenda: 'La receta', vistaPrevia: null },
        ],
      ],
    ]);
    expect(store.enviarAdjunto).not.toHaveBeenCalled();
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
    expect(store.enviarAdjuntos).toHaveBeenCalledWith([
      expect.objectContaining({ archivo: expect.any(File), leyenda: 'Le mando el análisis' }),
    ]);
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
    expect(store.enviarAdjuntos).not.toHaveBeenCalled();
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
    // Lo que devuelve el editor también se prepara (sin EXIF) antes de quedar.
    await fixture.whenStable();
    fixture.detectChanges();
    consultar('vista-enviar')!.click();

    expect(store.enviarAdjuntos).toHaveBeenCalledTimes(1);
    expect(store.enviarAdjuntos).toHaveBeenCalledWith([
      { archivo: editada, leyenda: 'Así está hoy', vistaPrevia: null },
    ]);
  });

  it('si parte de lo elegido no entra, se abre igual y lo avisa adentro', async () => {
    const grande = new File(['x'], 'estudio.pdf', { type: 'application/pdf' });
    Object.defineProperty(grande, 'size', { value: 25 * 1024 * 1024 });
    await elegir([foto('a.png'), grande]);
    expect(todos('vista-miniatura')).toHaveLength(1);
    // El tope es el de la API (10 MB), no uno propio del front.
    expect(consultar('composer-vista-previa')!.textContent).toContain('«estudio.pdf» pesa más de 10 MB.');
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

    expect(store.enviarAdjuntos).toHaveBeenCalledTimes(1);
    expect((store.enviarAdjuntos.mock.calls[0] as [unknown[]])[0]).toHaveLength(1);
    expect((consultar('hilo-texto') as HTMLTextAreaElement).value).toBe('Le mando el análisis');
  });

  it('un documento muestra su tarjeta y sale igual que una foto', async () => {
    const pdf = new File([new Uint8Array(10)], 'Historia.pdf', { type: 'application/pdf' });
    await elegir([pdf]);
    expect(consultar('vista-documento')).not.toBeNull();
    consultar('vista-enviar')!.click();
    expect(store.enviarAdjuntos).toHaveBeenCalledWith([{ archivo: pdf, leyenda: '', vistaPrevia: null }]);
  });
});
