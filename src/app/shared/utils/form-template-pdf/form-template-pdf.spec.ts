import {
  bloquesDeFormulario,
  CONSTANCIA_DE_LLENADO,
  formTemplatePdfOptions,
  INSTRUCCIONES_DE_LLENADO,
  type FormularioParaPdf,
} from './form-template-pdf';
import type { PdfBlock } from '../pdf-export/pdf-export';
import type { PaginaDeFormulario } from '../../forms/paginated/paginated-form.types';

/**
 * Se prueba **qué dice el papel**, no cómo se dibuja: la maquetación —el
 * membrete, la filigrana, el corte de página— ya tiene sus pruebas en
 * `pdf-export.spec.ts`, y repetirlas acá ataría este archivo a jsPDF sin
 * comprobar nada nuevo.
 */

const PAGINA: PaginaDeFormulario = {
  titulo: 'Valoración preanestésica (1 de 2)',
  campos: [
    { key: 'motivo', label: 'Motivo de consulta', control: 'textarea', required: true },
    { key: 'fuma', label: 'Fuma', control: 'radio', options: [
      { value: 'no', label: 'Nunca' },
      { value: 'ex', label: 'Ex fumador' },
    ] },
  ],
};

const SEGUNDA: PaginaDeFormulario = {
  titulo: 'Valoración preanestésica (2 de 2)',
  campos: [
    { key: 'alergias', label: 'Alergias', control: 'text', hint: 'Separadas por coma' },
  ],
};

const FORMULARIO: FormularioParaPdf = {
  nombre: 'Valoración preanestésica',
  codigo: 'ANEST_VALORACION',
  version: 1,
  especialidad: 'Anestesiología',
  paginas: [PAGINA, SEGUNDA],
  camposEstandar: 2,
  camposPropios: 1,
  procedencia: {
    titulo: 'Ficha de valoración preanestésica',
    organizacion: 'Ministerio de Salud del Perú (MINSA)',
    licencia: 'Norma técnica estatal de acceso público',
  },
  profesional: 'Dra. Daniela Vargas',
};

/** Los bloques de las preguntas: todo menos la constancia de llenado del final. */
function preguntas(bloques: readonly PdfBlock[]): readonly PdfBlock[] {
  return bloques.slice(0, bloques.length - CONSTANCIA_DE_LLENADO.length);
}

/** Todo el texto del documento, en orden. */
function texto(bloques: readonly PdfBlock[]): string {
  return bloques.map((bloque) => bloque.text).join('\n');
}

describe('bloquesDeFormulario', () => {
  it('numera las preguntas de corrido a lo largo de las páginas', () => {
    const bloques = bloquesDeFormulario(FORMULARIO);
    const enunciados = preguntas(bloques)
      .filter((bloque) => bloque.kind === 'heading' && bloque.level === 4)
      .map((bloque) => bloque.text);

    expect(enunciados).toEqual(['1. Motivo de consulta *', '2. Fuma', '3. Alergias']);
  });

  it('conserva los rótulos de página del motor, con su «(1 de 2)»', () => {
    const secciones = bloquesDeFormulario(FORMULARIO)
      .filter((bloque) => bloque.kind === 'heading' && bloque.level === 2)
      .map((bloque) => bloque.text);

    // Sin sección «El formulario»: el nombre, el código y la versión van en la
    // portada, y repetirlos en el cuerpo era decir dos veces lo mismo.
    expect(secciones).toEqual([
      'Valoración preanestésica (1 de 2)',
      'Valoración preanestésica (2 de 2)',
    ]);
  });

  it('deja renglones para escribir donde la respuesta es libre, y más en un texto largo', () => {
    const renglones = preguntas(bloquesDeFormulario(FORMULARIO)).filter(
      (bloque) => bloque.kind === 'blank',
    );

    // Cuatro por el texto largo del motivo y dos por el texto corto de
    // alergias: a mano se escribe más grande que en el teclado.
    expect(renglones.map((bloque) => bloque.lines)).toEqual([4, 2]);
  });

  it('cierra con la constancia de llenado: nombre, firma y fecha, con renglones', () => {
    const bloques = bloquesDeFormulario(FORMULARIO);

    expect(bloques.slice(-CONSTANCIA_DE_LLENADO.length)).toEqual(CONSTANCIA_DE_LLENADO);
    expect(CONSTANCIA_DE_LLENADO[0]).toMatchObject({ kind: 'heading', text: 'Nombre y firma de quien completa · Fecha (DD/MM/AAAA)' });
    expect(CONSTANCIA_DE_LLENADO[1]).toMatchObject({ kind: 'blank', lines: 2 });
    // Sin preguntas no hay nada que constar.
    expect(texto(bloquesDeFormulario({ ...FORMULARIO, paginas: [] }))).not.toContain('Nombre y firma');
  });

  it('las opciones van en un bloque de casillas dibujadas, redondas si se elige una', () => {
    const bloques = bloquesDeFormulario(FORMULARIO);
    const opciones = bloques.filter((bloque) => bloque.kind === 'choices');
    const cuerpo = texto(bloques);

    expect(opciones).toHaveLength(1);
    expect(opciones[0]).toMatchObject({ items: ['Nunca', 'Ex fumador'], multiple: false });
    // El texto canónico del bloque sigue diciendo las casillas en ASCII.
    expect(cuerpo).toContain('( ) Nunca');
    expect(cuerpo).toContain('( ) Ex fumador');
    // Un `☐` sale como un garabato en Latin-1: el defecto sólo se ve impreso.
    // Tampoco las flechas, los puntos ni las tildes de verificación, que las
    // fuentes del documento no traen.
    expect(cuerpo).not.toMatch(/[☐◯→●✓]/);
  });

  it('marca con cuadrado lo que admite varias respuestas y deja renglón para «Otro»', () => {
    const bloques = bloquesDeFormulario({
      ...FORMULARIO,
      paginas: [
        {
          titulo: 'Antecedentes',
          campos: [
            {
              key: 'patologias',
              label: 'Antecedentes patológicos',
              control: 'checkboxes',
              otro: true,
              options: [{ value: 'hta', label: 'Hipertensión' }],
            },
          ],
        },
      ],
    });

    expect(texto(bloques)).toContain('[ ] Hipertensión');
    expect(texto(bloques)).toContain('[ ] Otro:');
    // El renglón de «Otro» va justo después de las casillas.
    const opciones = bloques.findIndex((bloque) => bloque.kind === 'choices');
    expect(bloques[opciones]).toMatchObject({ multiple: true, items: ['Hipertensión', 'Otro:'] });
    expect(bloques[opciones + 1]).toMatchObject({ kind: 'blank', lines: 1 });
  });

  it('dice en la portada cuántas preguntas son del estándar y cuántas del consultorio', () => {
    const preguntas = (datos: FormularioParaPdf) =>
      formTemplatePdfOptions(datos).meta?.find((entrada) => entrada.label === 'Preguntas')?.value;

    expect(preguntas(FORMULARIO)).toBe('3 · 2 del estándar y 1 propia');
    expect(preguntas({ ...FORMULARIO, camposEstandar: 11, camposPropios: 3 })).toBe('14 · 11 del estándar y 3 propias');
    expect(preguntas({ ...FORMULARIO, camposPropios: 0 })).toBe('2 · todas del estándar');
    expect(preguntas({ ...FORMULARIO, camposEstandar: 0 })).toBe('1 · todas propias');
  });

  /**
   * La licencia del formulario estándar no puede quedarse en la pantalla: la
   * copia impresa circula sola, y muchos de estos formularios tienen derechos
   * de autor.
   */
  it('lleva la procedencia del estándar al papel', () => {
    expect(texto(bloquesDeFormulario(FORMULARIO))).toContain(
      'Ficha de valoración preanestésica · Ministerio de Salud del Perú (MINSA) · Norma técnica estatal de acceso público',
    );
  });

  it('un formulario sin preguntas lo dice, en vez de salir con la hoja vacía', () => {
    const bloques = bloquesDeFormulario({
      ...FORMULARIO,
      paginas: [],
      camposEstandar: 0,
      camposPropios: 0,
      procedencia: null,
    });

    expect(texto(bloques)).toContain('Este formulario todavía no tiene preguntas.');
  });

  it('una cuadrícula sale como tabla, con una casilla por celda', () => {
    // Imprimirla como una lista de opciones sacaría la escala una sola vez y
    // dejaría las filas —que es lo que hay que contestar— fuera del papel.
    const bloques = bloquesDeFormulario({
      ...FORMULARIO,
      paginas: [
        {
          titulo: 'Síntomas',
          campos: [
            {
              key: 'frecuencia',
              label: '¿Con qué frecuencia?',
              control: 'grid-radio',
              rows: [
                { value: 'tos', label: 'Tos' },
                { value: 'fiebre', label: 'Fiebre' },
              ],
              options: [
                { value: 'nunca', label: 'Nunca' },
                { value: 'siempre', label: 'Siempre' },
              ],
            },
          ],
        },
      ],
    });

    const filas = bloques.filter((bloque) => bloque.kind === 'row');
    expect(filas[0]?.cells).toEqual(['', 'Nunca', 'Siempre']);
    expect(filas[0]?.header).toBe(true);
    expect(filas[1]?.cells).toEqual(['Tos', '( )', '( )']);
    expect(filas[2]?.cells).toEqual(['Fiebre', '( )', '( )']);
  });

  it('la cuadrícula de casillas usa el cuadrado, y la restricción se dice', () => {
    // En papel no hay nada que impida repetir una columna: si la regla no está
    // escrita, el formulario impreso pide algo distinto del servido.
    const bloques = bloquesDeFormulario({
      ...FORMULARIO,
      paginas: [
        {
          titulo: 'Prioridades',
          campos: [
            {
              key: 'orden',
              label: 'Ordene estas tres',
              control: 'grid-checkboxes',
              oneResponsePerColumn: true,
              rows: [{ value: 'a', label: 'Dolor' }],
              options: [{ value: '1', label: 'Primero' }],
            },
          ],
        },
      ],
    });

    expect(bloques.filter((b) => b.kind === 'row')[1]?.cells).toEqual(['Dolor', '[ ]']);
    // La regla se lee **antes** de la tabla, junto con cómo marcar.
    // Dicha sin contradecir el «todas las que correspondan» de la fila.
    const regla = bloques.findIndex((b) => b.text.includes('Cada columna se marca en una sola fila.'));
    const cabecera = bloques.findIndex((b) => b.kind === 'row' && b.header === true);
    expect(regla).toBeGreaterThanOrEqual(0);
    expect(regla).toBeLessThan(cabecera);
    expect(bloques[regla]?.kind).toBe('caption');
  });

  it('un sí/no en botones sigue saliendo como dos casillas redondas en papel', () => {
    // En papel no hay botones. Lo que importa es que las dos respuestas estén
    // impresas, que es justamente lo que la casilla suelta no daba. Redondas:
    // se contesta una sola, como dicen las instrucciones del papel.
    const bloques = bloquesDeFormulario({
      ...FORMULARIO,
      paginas: [
        {
          titulo: 'Antecedentes',
          campos: [{ key: 'fuma', label: '¿Fuma?', control: 'yes-no' }],
        },
      ],
    });

    const opciones = bloques.filter((b) => b.kind === 'choices');
    expect(opciones).toHaveLength(1);
    expect(opciones[0]).toMatchObject({ items: ['Sí', 'No'], multiple: false });
    expect(texto(bloques)).not.toContain('[ ] Sí');
  });

  it('no inventa un renglón para un campo que sólo se completa en el sistema', () => {
    const bloques = bloquesDeFormulario({
      ...FORMULARIO,
      paginas: [
        {
          titulo: 'Odontograma',
          campos: [{ key: 'odonto', label: 'Odontograma', control: 'custom' }],
        },
      ],
    });

    expect(preguntas(bloques).some((bloque) => bloque.kind === 'blank')).toBe(false);
    expect(texto(bloques)).toContain('Este campo se completa en el sistema.');
  });

  it('un «¿cuál?» dice en papel de qué pregunta depende y con qué respuesta', () => {
    const conCondicion: FormularioParaPdf = {
      ...FORMULARIO,
      paginas: [
        {
          titulo: 'Antecedentes',
          campos: [
            { key: 'alergias', label: '¿Tiene alergias?', control: 'yes-no' },
            {
              key: 'cual',
              label: '¿A qué?',
              control: 'text',
              showWhen: { key: 'alergias', equals: true },
            },
          ],
        },
      ],
    };

    const textos = bloquesDeFormulario(conCondicion).map((bloque) => bloque.text);

    expect(textos).toContain('Solo si en la 1 («¿Tiene alergias?») respondió «Sí».');
  });

  it('abre con las instrucciones de llenado, en un aviso informativo', () => {
    const [primero] = bloquesDeFormulario(FORMULARIO);

    expect(primero?.kind).toBe('note');
    expect(primero?.tone).toBe('info');
    expect(primero?.title).toBe('Cómo completar este formulario');
    expect(primero?.text).toBe(INSTRUCCIONES_DE_LLENADO);
    // Las instrucciones explican las dos casillas que el papel usa.
    expect(INSTRUCCIONES_DE_LLENADO).toContain('Casilla redonda: una sola respuesta');
    expect(INSTRUCCIONES_DE_LLENADO).toContain('casilla cuadrada: varias');
  });

  it('no repite en el cuerpo lo que ya dice la portada', () => {
    const cuerpo = texto(bloquesDeFormulario(FORMULARIO));

    expect(cuerpo).not.toContain('ANEST_VALORACION');
    expect(cuerpo).not.toContain('Dra. Daniela Vargas');
    expect(cuerpo).not.toMatch(/Documento generado el/);
  });

  it('la portada lleva el nombre, el código, la versión y quién lo bajó, sin firma ni fecha de emisión', () => {
    const opciones = formTemplatePdfOptions(FORMULARIO);

    expect(opciones.title).toBe('Valoración preanestésica');
    expect(opciones.kind).toBe('Formulario en blanco');
    expect(opciones.reference).toBe('ANEST_VALORACION');
    // La versión va en la bajada: en los metadatos alargaba la portada.
    expect(opciones.subtitle).toBe('Anestesiología · Versión 1 · Para completar a mano');
    expect(opciones.meta?.some((m) => m.label === 'Versión')).toBe(false);
    expect(opciones.meta).toContainEqual({ label: 'Descargado por', value: 'Dra. Daniela Vargas' });
    // Un formulario en blanco no se emite: el motor rotula «Fecha de generación».
    expect(opciones.issuedAt).toBeUndefined();
    // Ni la firma del médico de la sesión: avalaría respuestas que no existen.
    expect(opciones.firma).toBeNull();
    // Se imprime por tandas en blanco y negro: portada clara.
    expect(opciones.plainPaper).toBe(true);
    expect(formTemplatePdfOptions({ ...FORMULARIO, especialidad: null }).subtitle).toBe('Versión 1 · Para completar a mano');
  });

  it('corta la hoja antes de cada página del formulario, de la segunda en adelante', () => {
    const bloques = bloquesDeFormulario(FORMULARIO);
    const cortes = bloques
      .map((bloque, indice) => ({ bloque, indice }))
      .filter(({ bloque }) => bloque.kind === 'pagebreak');

    expect(cortes).toHaveLength(FORMULARIO.paginas.length - 1);
    expect(bloques[cortes[0]!.indice + 1]).toMatchObject({
      kind: 'heading',
      level: 2,
      text: 'Valoración preanestésica (2 de 2)',
    });
  });

  it('las opciones dicen cuántas marcar y van con casillas redondas o cuadradas según el tipo', () => {
    const conOpciones = (control: 'radio' | 'select' | 'checkboxes', etiquetas: readonly string[]) =>
      bloquesDeFormulario({
        ...FORMULARIO,
        paginas: [
          {
            titulo: 'Opciones',
            campos: [
              {
                key: 'p',
                label: 'Pregunta',
                control,
                options: etiquetas.map((label) => ({ value: label, label })),
              },
            ],
          },
        ],
      });

    const una = conOpciones('radio', ['Nunca', 'A veces', 'Siempre']);
    expect(una.find((b) => b.kind === 'choices')).toMatchObject({ items: ['Nunca', 'A veces', 'Siempre'], multiple: false });
    expect(texto(una)).toContain('Marque una sola opción.');
    // Un desplegable en papel no existe: sus opciones salen igual, redondas.
    expect(conOpciones('select', ['A', 'B']).find((b) => b.kind === 'choices')).toMatchObject({ multiple: false });

    const varias = conOpciones('checkboxes', ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco']);
    expect(varias.find((b) => b.kind === 'choices')).toMatchObject({
      items: ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'],
      multiple: true,
    });
    expect(texto(varias)).toContain('Marque todas las que correspondan.');
    // Las opciones ya no van como párrafos de texto.
    expect(preguntas(varias).some((b) => b.kind === 'paragraph')).toBe(false);
  });

  it('una fecha dice en papel cómo escribirla', () => {
    const bloques = bloquesDeFormulario({
      ...FORMULARIO,
      paginas: [
        {
          titulo: 'Fechas',
          campos: [
            { key: 'f', label: 'Fecha de la cirugía', control: 'date' },
            { key: 'h', label: 'Ingreso', control: 'datetime' },
          ],
        },
      ],
    });

    expect(texto(bloques)).toContain('Formato: DD/MM/AAAA.');
    expect(texto(bloques)).toContain('Formato: DD/MM/AAAA, HH:MM (24 horas).');
    expect(preguntas(bloques).filter((b) => b.kind === 'blank').map((b) => b.lines)).toEqual([1, 1]);
  });

  it('escribe «solo» sin tilde en todo el papel', () => {
    const conCondicion = bloquesDeFormulario({
      ...FORMULARIO,
      paginas: [
        {
          titulo: 'Antecedentes',
          campos: [
            { key: 'a', label: '¿Fuma?', control: 'yes-no' },
            { key: 'b', label: '¿Cuánto?', control: 'text', showWhen: { key: 'a', equals: true } },
            {
              key: 'c',
              label: 'Orden',
              control: 'grid-radio',
              oneResponsePerColumn: true,
              rows: [{ value: 'x', label: 'X' }],
              options: [{ value: '1', label: '1' }],
            },
          ],
        },
      ],
    });

    expect(texto(conCondicion)).not.toMatch(/Sólo/);
  });
});
