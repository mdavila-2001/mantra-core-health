import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { RichTextEditor } from './rich-text-editor';
import { ETIQUETAS_PERMITIDAS, HERRAMIENTAS } from './rich-text-editor.types';

/**
 * La hoja en blanco de la historia clínica. Lo que estas pruebas fijan:
 *
 * 1. **El saneado deja estructura y nada más.** Lo que se guarda se vuelve a
 *    pintar y además se firma por el hash de su contenido: si el texto guardado
 *    dependiera de lo que trajo el portapapeles de Word, dos notas iguales a la
 *    vista darían hashes distintos.
 * 2. **Aplana en vez de borrar.** Un `<div>` de Word envuelve texto de verdad;
 *    tirar el nodo entero perdería la frase.
 * 3. **No hay color.** Es la única petición que se dejó fuera a propósito, y
 *    conviene que romperlo cueste una prueba en rojo y no una discusión.
 */
describe('RichTextEditor', () => {
  let fixture: ComponentFixture<RichTextEditor>;

  /** Lo que el componente publicaría si el área tuviera este HTML dentro. */
  function saneadoDe(sucio: string): string {
    const area = fixture.nativeElement.querySelector(
      '[data-testid="editor-area"]',
    ) as HTMLElement;
    area.innerHTML = sucio;
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    return fixture.componentInstance.html();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RichTextEditor] }).compileComponents();
    fixture = TestBed.createComponent(RichTextEditor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('conserva las marcas que sobreviven a una impresión', () => {
    const limpio = saneadoDe(
      '<p>Paciente con <strong>fiebre</strong> y <em>tos</em>.</p><ul><li>Uno</li></ul>',
    );
    expect(limpio).toContain('<strong>fiebre</strong>');
    expect(limpio).toContain('<em>tos</em>');
    expect(limpio).toContain('<li>Uno</li>');
  });

  it('descarta el estilo en línea pero se queda con el texto', () => {
    // El caso real: pegar desde Word. El `<span style>` no significa nada acá,
    // pero «cefalea» sí.
    const limpio = saneadoDe('<p><span style="color:red">cefalea</span></p>');
    expect(limpio).toContain('cefalea');
    expect(limpio).not.toContain('style');
    expect(limpio).not.toContain('<span');
  });

  it('no deja pasar un script aunque venga dentro de una etiqueta permitida', () => {
    const limpio = saneadoDe('<p onclick="robar()">hola<script>robar()</script></p>');
    expect(limpio).not.toContain('onclick');
    expect(limpio).not.toContain('<script');
    expect(limpio).toContain('hola');
  });

  it('aplana lo desconocido en vez de borrarlo', () => {
    // Un `<div>` de un procesador de textos envuelve una frase de verdad.
    const limpio = saneadoDe('<div><table><tr><td>dolor abdominal</td></tr></table></div>');
    expect(limpio).toContain('dolor abdominal');
    expect(limpio).not.toContain('<table');
  });

  it('sabe cuándo está vacío para pintar el marcador de posición', () => {
    saneadoDe('<p><br></p>');
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.editor__marcador')).not.toBeNull();

    saneadoDe('<p>algo</p>');
    fixture.detectChanges();
    expect(html.querySelector('.editor__marcador')).toBeNull();
  });

  it('la barra no ofrece color ni tamaños libres', () => {
    // Decisión, no olvido: un rojo que se pierde al imprimir se lleva el énfasis
    // sin avisar, y «letra 18» no significa nada fuera de esta pantalla.
    const comandos = HERRAMIENTAS.map((h) => h.comando.toString());
    expect(comandos).not.toContain('foreColor');
    expect(comandos).not.toContain('fontSize');
    expect(ETIQUETAS_PERMITIDAS).not.toContain('FONT');
    expect(ETIQUETAS_PERMITIDAS).not.toContain('SPAN');
  });

  it('en sólo lectura no dibuja la barra ni deja editar', () => {
    fixture.componentRef.setInput('readOnly', true);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.editor__barra')).toBeNull();
    const area = html.querySelector('[data-testid="editor-area"]');
    expect(area?.getAttribute('contenteditable')).toBeNull();
    expect(area?.getAttribute('aria-readonly')).toBe('true');
  });

  it('el área se anuncia como campo de escritura de varias líneas', () => {
    fixture.componentRef.setInput('label', 'Nota de evolución');
    fixture.detectChanges();
    const area = fixture.nativeElement.querySelector('[data-testid="editor-area"]');
    expect(area.getAttribute('role')).toBe('textbox');
    expect(area.getAttribute('aria-multiline')).toBe('true');
    expect(area.getAttribute('aria-label')).toBe('Nota de evolución');
  });
});
