import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { RichTextEditor } from './rich-text-editor';
import {
  ETIQUETAS_DE_ARTICULO,
  ETIQUETAS_PERMITIDAS,
  HERRAMIENTAS,
  HERRAMIENTAS_DE_ARTICULO,
} from './rich-text-editor.types';

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

  describe('imágenes (opt-in)', () => {
    it('por omisión no admite imágenes: la nota clínica no cambia', () => {
      const limpio = saneadoDe('<p>hola<img src="blob:http://x/1" alt="a"></p>');
      expect(limpio).not.toContain('<img');
    });

    it('con allowImages conserva sólo la vista previa local, el alt y la clave', () => {
      fixture.componentRef.setInput('allowImages', true);
      fixture.detectChanges();
      const limpio = saneadoDe(
        '<p><img src="blob:http://x/1" alt="Foto" data-image-key="k1" onerror="robar()" class="x"></p>',
      );
      expect(limpio).toContain('src="blob:http://x/1"');
      expect(limpio).toContain('alt="Foto"');
      expect(limpio).toContain('data-image-key="k1"');
      expect(limpio).not.toContain('onerror');
      expect(limpio).not.toContain('class');
    });

    it('descarta una imagen de origen remoto aunque las imágenes estén permitidas', () => {
      fixture.componentRef.setInput('allowImages', true);
      fixture.detectChanges();
      expect(saneadoDe('<p><img src="https://evil.example/x.png" alt="x"></p>')).not.toContain('<img');
    });

    it('inserta, renombra y quita una imagen por su clave', () => {
      fixture.componentRef.setInput('allowImages', true);
      fixture.detectChanges();
      const editor = fixture.componentInstance;
      editor.insertImage({ key: 'k1', src: 'data:image/png;base64,AA==', alt: '' });
      expect(editor.html()).toContain('data-image-key="k1"');

      editor.setImageAlt('k1', 'Radiografía');
      expect(editor.html()).toContain('alt="Radiografía"');

      editor.removeImage('k1');
      expect(editor.html()).not.toContain('<img');
    });

    it('una hoja con sólo una imagen no se da por vacía', () => {
      fixture.componentRef.setInput('allowImages', true);
      fixture.detectChanges();
      fixture.componentInstance.insertImage({ key: 'k1', src: 'data:image/png;base64,AA==', alt: 'x' });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.editor__marcador')).toBeNull();
    });
  });

  it('presionar un botón de la barra no le saca el foco (ni la selección) a la hoja', () => {
    const boton = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="herramienta-h2"]')!;
    const presion = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    boton.dispatchEvent(presion);
    expect(presion.defaultPrevented).toBe(true);
  });

  it('ofrece sólo las herramientas que se le piden', () => {
    fixture.componentRef.setInput('tools', HERRAMIENTAS.filter((h) => h.comando !== 'underline'));
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="herramienta-underline"]')).toBeNull();
    expect(html.querySelector('[data-testid="herramienta-bold"]')).not.toBeNull();
  });

  it('clear() deja la hoja en blanco', () => {
    saneadoDe('<p>algo</p>');
    fixture.componentInstance.clear();
    fixture.detectChanges();
    expect(fixture.componentInstance.html()).toBe('');
    expect((fixture.nativeElement as HTMLElement).querySelector('.editor__marcador')).not.toBeNull();
  });

  describe('barra completa del artículo', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('tools', HERRAMIENTAS_DE_ARTICULO);
      fixture.componentRef.setInput('extraTags', ETIQUETAS_DE_ARTICULO);
      fixture.detectChanges();
    });

    it('agrupa con separadores y dibuja íconos con nombre accesible', () => {
      const html = fixture.nativeElement as HTMLElement;
      expect(html.querySelectorAll('.editor__separador').length).toBe(3);
      const negrita = html.querySelector('[data-testid="herramienta-bold"]')!;
      expect(negrita.querySelector('svg')).not.toBeNull();
      expect(negrita.getAttribute('aria-label')).toBe('Negrita (Ctrl+B)');
      expect(negrita.getAttribute('aria-pressed')).toBe('false');
      // Deshacer no es un interruptor: no lleva aria-pressed.
      expect(html.querySelector('[data-testid="herramienta-undo"]')!.hasAttribute('aria-pressed')).toBe(false);
      expect(html.querySelector('[data-testid="herramienta-h4"]')?.textContent?.trim()).toBe('Apartado');
    });

    it('conserva citas, apartados, separadores, tachado y enlaces seguros', () => {
      const limpio = saneadoDe(
        '<h4>Apartado</h4><blockquote>cita</blockquote><hr><p><s>viejo</s> ' +
          '<a href="https://who.int" onclick="x()" target="_blank">ok</a> <a href="javascript:x()">malo</a></p>',
      );
      expect(limpio).toContain('<h4>Apartado</h4>');
      expect(limpio).toContain('<blockquote>cita</blockquote>');
      expect(limpio).toContain('<hr>');
      expect(limpio).toContain('<s>viejo</s>');
      expect(limpio).toContain('<a href="https://who.int">ok</a>');
      expect(limpio).not.toContain('javascript');
      expect(limpio).toContain('malo');
    });

    it('insertLink inserta un enlace con texto y rechaza esquemas peligrosos', () => {
      const editor = fixture.componentInstance;
      expect(editor.insertLink('javascript:alert(1)', 'x')).toBe(false);
      expect(editor.insertLink('https://who.int/guia', 'la guía')).toBe(true);
      expect(editor.html()).toContain('<a href="https://who.int/guia">la guía</a>');
    });

    it('load() carga un borrador saneado', () => {
      fixture.componentInstance.load('<h2>Borrador</h2><script>x()</script><p>texto</p>');
      expect(fixture.componentInstance.html()).toBe('<h2>Borrador</h2><p>texto</p>');
    });
  });
});
