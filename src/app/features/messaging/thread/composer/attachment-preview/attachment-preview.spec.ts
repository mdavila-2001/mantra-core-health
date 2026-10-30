import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { AttachmentPreview } from './attachment-preview';
import { PDF_PAGE_COUNTER } from './pdf-page-count';
import { type AttachmentDraft, createDraft } from '../attachment-draft';
import { ImageEditor } from '../image-editor/image-editor';

/** El dueño de la lista, como el composer: la vista previa la edita por `model`. */
@Component({
  imports: [AttachmentPreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" data-testid="origen">+</button>
    @if (drafts().length > 0) {
      <app-attachment-preview [(drafts)]="drafts" [notice]="notice()" (send)="sent = sent + 1" (discard)="discarded = discarded + 1" />
    }
  `,
})
class Host {
  readonly drafts = signal<readonly AttachmentDraft[]>([]);
  readonly notice = signal('');
  sent = 0;
  discarded = 0;
}

/**
 * Lo que estas pruebas fijan: que cada archivo guarda su propio pie de foto,
 * que se cambia de archivo desde las miniaturas, que quitar el último es
 * descartar, que la edición reemplaza el archivo (y se puede deshacer), que
 * un documento se muestra como tarjeta con sus páginas y que la capa se
 * comporta como un modal: foco adentro, Escape y fondo inerte.
 */
describe('AttachmentPreview', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  const foto = (nombre: string) => new File(['x'], nombre, { type: 'image/png' });
  const consultar = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  const todos = (testid: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testid}"]`));
  const comentario = () => consultar('vista-comentario') as HTMLTextAreaElement;
  const escribir = (valor: string) => {
    comentario().value = valor;
    comentario().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const abrir = async (archivos: File[]) => {
    host.drafts.set(archivos.map((archivo) => createDraft(archivo)));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: PDF_PAGE_COUNTER, useValue: async () => 12 }],
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
  });

  it('se presenta como un diálogo con nombre y el foco entra al pie de foto', async () => {
    await abrir([foto('a.png'), foto('b.png')]);
    const capa = consultar('composer-vista-previa')!;
    expect(capa.getAttribute('role')).toBe('dialog');
    expect(capa.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(capa.getAttribute('aria-labelledby')!)?.textContent).toContain('2 archivos');
    expect(document.activeElement).toBe(comentario());
    expect(comentario().placeholder).toBe('Añada un comentario…');
  });

  it('cada archivo guarda su pie de foto al cambiar de miniatura', async () => {
    await abrir([foto('a.png'), foto('b.png')]);
    escribir('Primera');
    todos('vista-miniatura')[1].click();
    fixture.detectChanges();
    expect(comentario().value).toBe('');
    expect(todos('vista-miniatura')[1].getAttribute('aria-current')).toBe('true');
    escribir('Segunda');

    todos('vista-miniatura')[0].click();
    fixture.detectChanges();
    expect(comentario().value).toBe('Primera');
    expect(host.drafts().map((d) => d.caption)).toEqual(['Primera', 'Segunda']);
  });

  it('el botón de enviar cuenta los archivos y Enter en el pie también envía', async () => {
    await abrir([foto('a.png'), foto('b.png'), foto('c.png')]);
    expect(consultar('vista-cuenta')?.textContent?.trim()).toBe('3');
    expect(consultar('vista-enviar')?.getAttribute('aria-label')).toBe('Enviar 3 archivos');

    comentario().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(host.sent).toBe(1);
    consultar('vista-enviar')!.click();
    expect(host.sent).toBe(2);
  });

  it('quitar un archivo lo saca; quitar el último es descartar', async () => {
    await abrir([foto('a.png'), foto('b.png')]);
    todos('vista-quitar')[0].click();
    fixture.detectChanges();
    expect(host.drafts().map((d) => d.file.name)).toEqual(['b.png']);
    expect(consultar('vista-cuenta')).toBeNull();

    todos('vista-quitar')[0].click();
    expect(host.discarded).toBe(1);
  });

  it('la ✕ y Escape descartan; el foco vuelve a donde estaba', async () => {
    const origen = consultar('origen')!;
    origen.focus();
    await abrir([foto('a.png')]);
    expect(document.activeElement).toBe(comentario());

    consultar('vista-descartar')!.click();
    expect(host.discarded).toBe(1);

    consultar('composer-vista-previa')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.discarded).toBe(2);

    host.drafts.set([]);
    fixture.detectChanges();
    expect(document.activeElement).toBe(origen);
  });

  it('deja inerte lo de atrás mientras está abierta y lo devuelve al cerrar', async () => {
    const origen = consultar('origen')!;
    await abrir([foto('a.png')]);
    expect(origen.closest('[inert]')).not.toBeNull();
    host.drafts.set([]);
    fixture.detectChanges();
    expect(origen.closest('[inert]')).toBeNull();
  });

  it('la edición reemplaza el archivo y «Deshacer» trae el anterior', async () => {
    const original = foto('lunar.png');
    await abrir([original]);
    escribir('El lunar');
    consultar('vista-dibujar')!.click();
    fixture.detectChanges();

    const editor = fixture.debugElement.query(By.directive(ImageEditor));
    expect(editor).not.toBeNull();
    expect(consultar('vista-comentario')).toBeNull();

    const editado = new File(['y'], 'lunar-editada.png', { type: 'image/png' });
    (editor.componentInstance as ImageEditor).applied.emit(editado);
    fixture.detectChanges();

    expect(host.drafts()[0].file).toBe(editado);
    expect(host.drafts()[0].caption).toBe('El lunar');
    expect(fixture.debugElement.query(By.directive(ImageEditor))).toBeNull();

    consultar('vista-deshacer')!.click();
    fixture.detectChanges();
    expect(host.drafts()[0].file).toBe(original);
    expect(consultar('vista-deshacer')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('una edición que pasa el tope de 20 MB no reemplaza el archivo y lo dice', async () => {
    const original = foto('lunar.png');
    await abrir([original]);
    consultar('vista-dibujar')!.click();
    fixture.detectChanges();
    const enorme = new File(['y'], 'lunar-editada.png', { type: 'image/png' });
    Object.defineProperty(enorme, 'size', { value: 21 * 1024 * 1024 });
    (fixture.debugElement.query(By.directive(ImageEditor)).componentInstance as ImageEditor).applied.emit(enorme);
    fixture.detectChanges();

    expect(host.drafts()[0].file).toBe(original);
    expect(fixture.nativeElement.textContent).toContain('No se pudo usar la edición: El archivo pesa más de 20 MB.');
  });

  it('lo que quedó afuera al elegir se avisa dentro de la vista previa', async () => {
    host.notice.set('El archivo pesa más de 20 MB.');
    await abrir([foto('a.png')]);
    expect(consultar('composer-vista-previa')!.querySelector('[role="alert"]')?.textContent).toContain('El archivo pesa más de 20 MB.');
  });

  it('soltar archivos mientras se edita no cambia la imagen bajo el editor', async () => {
    await abrir([foto('a.png')]);
    consultar('vista-dibujar')!.click();
    fixture.detectChanges();
    const soltar = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(soltar, 'dataTransfer', { value: { files: [foto('b.png')], types: ['Files'] } });
    consultar('composer-vista-previa')!.dispatchEvent(soltar);
    fixture.detectChanges();
    expect(host.drafts()).toHaveLength(1);
  });

  it('cancelar el editor deja el archivo como estaba', async () => {
    const original = foto('lunar.png');
    await abrir([original]);
    consultar('vista-recortar')!.click();
    fixture.detectChanges();
    (fixture.debugElement.query(By.directive(ImageEditor)).componentInstance as ImageEditor).cancelled.emit();
    fixture.detectChanges();
    expect(host.drafts()[0].file).toBe(original);
    expect(consultar('vista-comentario')).not.toBeNull();
  });

  it('un documento se ve como tarjeta, con páginas, tipo y tamaño, y sin editor', async () => {
    await abrir([new File([new Uint8Array(2048)], 'Historia clínica.pdf', { type: 'application/pdf' })]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(consultar('vista-documento-nombre')?.textContent).toContain('Historia clínica.pdf');
    expect(consultar('vista-documento-detalle')?.textContent).toBe('12 páginas · PDF · 2 KB');
    expect(consultar('vista-dibujar')).toBeNull();
    expect(consultar('vista-imagen')).toBeNull();
  });

  it('sumar archivos desde el «+» los agrega al final y elige el primero nuevo', async () => {
    await abrir([foto('a.png')]);
    const selector = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(selector, 'files', {
      configurable: true,
      value: [foto('b.png'), new File(['x'], 'nota.txt', { type: 'text/plain' })],
    });
    selector.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(host.drafts().map((d) => d.file.name)).toEqual(['a.png', 'b.png']);
    expect(todos('vista-miniatura')[1].getAttribute('aria-current')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Puede mandar imágenes, videos, audios y PDF.');
  });
});
