import { bloquesDeFormulario, type FormularioParaPdf } from './form-template-pdf';
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

/** Todo el texto del documento, en orden. */
function texto(bloques: readonly PdfBlock[]): string {
  return bloques.map((bloque) => bloque.text).join('\n');
}

describe('bloquesDeFormulario', () => {
  it('numera las preguntas de corrido a lo largo de las páginas', () => {
    const bloques = bloquesDeFormulario(FORMULARIO);
    const enunciados = bloques
      .filter((bloque) => bloque.kind === 'heading' && bloque.level === 4)
      .map((bloque) => bloque.text);

    expect(enunciados).toEqual(['1. Motivo de consulta *', '2. Fuma', '3. Alergias']);
  });

  it('conserva los rótulos de página del motor, con su «(1 de 2)»', () => {
    const secciones = bloquesDeFormulario(FORMULARIO)
      .filter((bloque) => bloque.kind === 'heading' && bloque.level === 2)
      .map((bloque) => bloque.text);

    expect(secciones).toEqual([
      'El formulario',
      'Valoración preanestésica (1 de 2)',
      'Valoración preanestésica (2 de 2)',
    ]);
  });

  it('deja renglones para escribir donde la respuesta es libre, y más en un texto largo', () => {
    const renglones = bloquesDeFormulario(FORMULARIO).filter(
      (bloque) => bloque.kind === 'blank',
    );

    // Uno por el texto largo del motivo y otro por la línea de alergias.
    expect(renglones.map((bloque) => bloque.lines)).toEqual([3, 1]);
  });

  it('imprime las opciones con casillas ASCII, que es lo que la fuente del PDF codifica', () => {
    const cuerpo = texto(bloquesDeFormulario(FORMULARIO));

    expect(cuerpo).toContain('( ) Nunca');
    expect(cuerpo).toContain('( ) Ex fumador');
    // Un `☐` sale como un garabato en Latin-1: el defecto sólo se ve impreso.
    expect(cuerpo).not.toMatch(/[☐◯]/);
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
    expect(bloques.some((bloque) => bloque.kind === 'blank')).toBe(true);
  });

  it('dice cuántas preguntas son del estándar y cuántas del consultorio', () => {
    expect(texto(bloquesDeFormulario(FORMULARIO))).toContain(
      '3 preguntas · 2 del estándar y 1 de tu organización',
    );
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
              label: 'Ordená estas tres',
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
    expect(texto(bloques)).toContain('Sólo una respuesta por columna.');
  });

  it('un sí/no en botones sigue saliendo como dos casillas en papel', () => {
    // En papel no hay botones. Lo que importa es que las dos respuestas estén
    // impresas, que es justamente lo que la casilla suelta no daba.
    const bloques = bloquesDeFormulario({
      ...FORMULARIO,
      paginas: [
        {
          titulo: 'Antecedentes',
          campos: [{ key: 'fuma', label: '¿Fumás?', control: 'yes-no' }],
        },
      ],
    });

    expect(texto(bloques)).toContain('[ ] Sí    [ ] No');
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

    expect(bloques.some((bloque) => bloque.kind === 'blank')).toBe(false);
    expect(texto(bloques)).toContain('Este campo se completa en el sistema.');
  });
});
