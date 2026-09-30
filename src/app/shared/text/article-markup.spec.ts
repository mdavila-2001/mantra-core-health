import {
  articlePlainText,
  hasArticleStructure,
  htmlToArticle,
  outlineArticle,
  parseArticle,
} from './article-markup';

/** Arma un contenedor con el HTML dado, como lo deja el editor. */
function dom(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

/** Numera las imágenes por orden de aparición, como hace la pantalla al publicar. */
function inOrder(root: HTMLElement): (image: HTMLImageElement) => number | null {
  const images = Array.from(root.querySelectorAll('img'));
  return (image) => images.indexOf(image);
}

describe('parseArticle', () => {
  it('deja un texto plano viejo como párrafos, renglón por renglón', () => {
    const blocks = parseArticle('Hola a todos\nsegundo renglón\n\nOtro párrafo 🙂');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: 'paragraph' });
    expect(blocks[0]!.kind === 'paragraph' && blocks[0]!.lines).toHaveLength(2);
    expect(hasArticleStructure('Hola a todos\nsegundo renglón')).toBe(false);
  });

  it('reconoce títulos, subtítulos, listas e imágenes', () => {
    const body = [
      '## Síntomas',
      '- fiebre',
      '- tos',
      '### Cuándo consultar',
      '1. si dura más de 3 días',
      '2. si hay dificultad para respirar',
      '![Radiografía de tórax](imagen:0)',
    ].join('\n');
    expect(parseArticle(body).map((b) => b.kind)).toEqual(['heading', 'list', 'heading', 'list', 'image']);
    expect(parseArticle(body)[4]).toEqual({ kind: 'image', index: 0, alt: 'Radiografía de tórax' });
  });

  it('no confunde una etiqueta con un título', () => {
    expect(parseArticle('#cardiologia hoy')[0]).toMatchObject({ kind: 'paragraph' });
  });

  it('marca negrita, cursiva y enlaces sin comerse la puntuación', () => {
    const block = parseArticle('Es **importante** y *urgente*: ver https://who.int.')[0]!;
    if (block.kind !== 'paragraph') throw new Error('se esperaba un párrafo');
    const runs = block.lines[0]!;
    expect(runs.find((r) => r.bold)?.text).toBe('importante');
    expect(runs.find((r) => r.italic)?.text).toBe('urgente');
    expect(runs.find((r) => r.href)?.href).toBe('https://who.int');
    expect(runs.at(-1)?.text).toBe('.');
  });

  it('trata el HTML y los esquemas peligrosos como texto', () => {
    const block = parseArticle('<script>alert(1)</script> javascript:alert(1)')[0]!;
    if (block.kind !== 'paragraph') throw new Error('se esperaba un párrafo');
    expect(block.lines[0]!.every((r) => r.href === null)).toBe(true);
    expect(block.lines[0]!.map((r) => r.text).join('')).toContain('<script>');
  });

  it('una imagen con referencia mal formada queda como texto', () => {
    expect(parseArticle('![x](https://evil.example/a.png)')[0]).toMatchObject({ kind: 'paragraph' });
  });
});

describe('outlineArticle', () => {
  it('agrupa por título y anida los subtítulos', () => {
    const outline = outlineArticle(
      parseArticle('Intro\n\n## Uno\ntexto\n### Uno.a\nmás\n## Dos\nfin'),
    );
    expect(outline.intro).toHaveLength(1);
    expect(outline.sections.map((s) => s.heading)).toEqual(['Uno', 'Dos']);
    expect(outline.sections[0]!.blocks).toHaveLength(1);
    expect(outline.sections[0]!.subsections.map((s) => s.heading)).toEqual(['Uno.a']);
  });

  it('promueve a título un subtítulo que no tiene sección', () => {
    const outline = outlineArticle(parseArticle('### Suelto\ntexto'));
    expect(outline.sections.map((s) => s.heading)).toEqual(['Suelto']);
  });
});

describe('articlePlainText', () => {
  it('saca las marcas y las imágenes', () => {
    expect(articlePlainText('## Título\n**Hola** 👋\n- uno\n![foto](imagen:0)')).toBe('Título Hola 👋 uno');
  });
});

describe('htmlToArticle', () => {
  it('convierte lo que produce el editor, y el resultado se vuelve a leer igual', () => {
    const root = dom(
      '<h2>Síntomas</h2><p>Es <strong>importante</strong> y <em>urgente</em> 🙂</p>' +
        '<ul><li>fiebre</li><li>tos</li></ul><h3>Detalle</h3><ol><li>uno</li><li>dos</li></ol>',
    );
    const body = htmlToArticle(root, inOrder(root));
    expect(body).toBe(
      '## Síntomas\n\nEs **importante** y *urgente* 🙂\n\n- fiebre\n- tos\n\n### Detalle\n\n1. uno\n2. dos',
    );
    expect(parseArticle(body).map((b) => b.kind)).toEqual(['heading', 'paragraph', 'list', 'heading', 'list']);
  });

  it('saca una imagen de adentro del párrafo sin cambiar el orden', () => {
    const root = dom('<p>antes<img alt="Foto [1]" src="blob:x">después</p>');
    expect(htmlToArticle(root, inOrder(root))).toBe('antes\n\n![Foto 1](imagen:0)\n\ndespués');
  });

  it('una imagen dentro de un ítem va después de la lista, no se pierde', () => {
    const root = dom('<ul><li>uno<img alt="a" src="blob:x"></li></ul>');
    expect(htmlToArticle(root, inOrder(root))).toBe('- uno\n\n![a](imagen:0)');
  });

  it('respeta los saltos de renglón y los divs de Chrome', () => {
    const root = dom('primera<div>segunda<br>tercera</div>');
    expect(htmlToArticle(root, inOrder(root))).toBe('primera\n\nsegunda\ntercera');
  });

  it('desarma los bloques que el navegador anida dentro de un párrafo (HTML real de Chrome)', () => {
    // Observado en el editor el 30/09/2026 escribiendo título → lista → subtítulo.
    // Se arma con DOM y no con `innerHTML`: el parser de HTML cerraría el `<p>`
    // antes del `<ul>`, y el editor (que construye por DOM) no lo cierra.
    const root = dom('La hipertensión no suele dar síntomas.<h2>Señales de alarma</h2>');
    const parrafo = document.createElement('p');
    const lista = document.createElement('ul');
    for (const texto of ['Dolor de cabeza intenso', 'Visión borrosa']) {
      lista.appendChild(document.createElement('li')).textContent = texto;
    }
    const subtitulo = document.createElement('h3');
    subtitulo.textContent = 'Cuándo ir a urgencias';
    const interno = document.createElement('p');
    interno.textContent = 'Si supera 180/120 \u00a0';
    parrafo.append(lista, subtitulo, interno);
    root.appendChild(parrafo);
    expect(root.innerHTML).toContain('<p><ul>');
    expect(htmlToArticle(root, inOrder(root))).toBe(
      'La hipertensión no suele dar síntomas.\n\n## Señales de alarma\n\n- Dolor de cabeza intenso\n- Visión borrosa' +
        '\n\n### Cuándo ir a urgencias\n\nSi supera 180/120',
    );
  });

  it('omite las imágenes que quien llama descarta', () => {
    const root = dom('<p>texto</p><img alt="a" src="blob:x">');
    expect(htmlToArticle(root, () => null)).toBe('texto');
  });
});
