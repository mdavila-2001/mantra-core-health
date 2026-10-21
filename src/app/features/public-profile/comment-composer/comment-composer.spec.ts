import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';

import { CommunityClient } from '@core/data-access/community/community.client';
import { CommentMediaPicker } from '@shared/components/molecules/comment-media-picker/comment-media-picker';

import { CommentComposer } from './comment-composer';

/** El selector real sube archivos; acá sólo importa si está montado y qué emite. */
@Component({
  selector: 'app-comment-media-picker',
  template: '<button type="button" data-testid="adjuntar" (click)="cambio.emit([{ fileId: \'f-1\', ordinal: 0 }])">Agregar imagen</button>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class SelectorDoble {
  readonly disabled = input(false);
  readonly cambio = output<{ fileId: string; ordinal: number }[]>();
}

describe('CommentComposer', () => {
  let fixture: ComponentFixture<CommentComposer>;
  let creados: Record<string, unknown>[];

  function montar(crear: (datos: Record<string, unknown>) => Observable<{ id: string }> = () => of({ id: 'c-1' }), padre: string | null = null): void {
    creados = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CommunityClient,
          useValue: {
            createComment: (datos: Record<string, unknown>) => {
              creados.push(datos);
              return crear(datos);
            },
          },
        },
      ],
    });
    TestBed.overrideComponent(CommentComposer, {
      remove: { imports: [CommentMediaPicker] },
      add: { imports: [SelectorDoble] },
    });
    fixture = TestBed.createComponent(CommentComposer);
    fixture.componentRef.setInput('postId', 'post-1');
    fixture.componentRef.setInput('actorProfileId', 'yo');
    fixture.componentRef.setInput('parentCommentId', padre);
    fixture.detectChanges();
  }

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const campo = (): HTMLTextAreaElement => root().querySelector('textarea')!;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);

  function escribir(texto: string): void {
    campo().value = texto;
    campo().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function enfocar(): void {
    campo().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();
  }

  it('sin foco ni texto no ofrece adjuntos (la fila queda liviana)', () => {
    montar();

    expect(q('adjuntar')).toBeNull();
  });

  it('con el campo vacío, tocar «Agregar imagen» no lo desmonta: el clic llega', () => {
    montar();
    enfocar();
    const boton = q('adjuntar')!;

    // El orden real del navegador: pointerdown dentro → el campo pierde el foco
    // (Safari: sin `relatedTarget`) → clic.
    boton.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    campo().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    fixture.detectChanges();

    expect(q('adjuntar')).not.toBeNull();
    q('adjuntar')!.click();
    fixture.detectChanges();
    // Con un adjunto y sin texto sigue montado.
    expect(q('adjuntar')).not.toBeNull();
  });

  it('el foco que pasa a otro control del formulario (Tab) no lo desmonta', () => {
    montar();
    enfocar();

    campo().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: q('adjuntar') }));
    fixture.detectChanges();

    expect(q('adjuntar')).not.toBeNull();
  });

  it('el foco que se va del formulario, sin nada escrito, lo oculta', () => {
    montar();
    enfocar();

    campo().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    fixture.detectChanges();

    expect(q('adjuntar')).toBeNull();
  });

  it('manda el texto recortado con el actor y, si responde, con el padre', () => {
    montar(() => of({ id: 'c-1' }), 'padre-1');
    escribir('  Hola  ');

    q('comment-composer-submit')!.click();
    fixture.detectChanges();

    expect(creados).toEqual([
      { authorProfileId: 'yo', commentableRefId: 'post-1', bodyText: 'Hola', parentCommentId: 'padre-1' },
    ]);
  });

  it('sin texto no se puede enviar', () => {
    montar();

    root().querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(creados).toEqual([]);
  });

  it('si falla conserva lo escrito, lo dice y lo vincula al campo', () => {
    montar(() => throwError(() => new Error('500')));
    escribir('Mi comentario');

    q('comment-composer-submit')!.click();
    fixture.detectChanges();

    const error = q('comment-composer-error')!;
    expect(campo().value).toBe('Mi comentario');
    expect(error.getAttribute('role')).toBe('alert');
    expect(campo().getAttribute('aria-invalid')).toBe('true');
    expect(campo().getAttribute('aria-describedby')).toBe(error.id);
  });

  it('al confirmarse limpia el campo y avisa con el id', () => {
    montar();
    const enviados: string[] = [];
    fixture.componentInstance.enviado.subscribe((id) => enviados.push(id));
    escribir('Listo');

    q('comment-composer-submit')!.click();
    fixture.detectChanges();

    expect(enviados).toEqual(['c-1']);
    expect(campo().value).toBe('');
    expect(campo().hasAttribute('aria-describedby')).toBe(false);
  });
});
