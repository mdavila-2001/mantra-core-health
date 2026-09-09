import { bloquesDeEvoluciones, type EvolucionesParaPdf } from './progress-notes-pdf';

/**
 * Lo que estas pruebas fijan es **qué dice el papel de Evoluciones**.
 *
 * Cómo se ve —membrete, filigrana, columnas— lo decide `pdf-export.ts`, que
 * tiene sus propias pruebas. Ir hasta el `jsPDF` real acá obligaría a leer sus
 * estructuras internas, que cambian según qué build resuelve Vitest, y a
 * mockear el módulo, que acopla este archivo con `pdf-export.spec.ts`.
 */

/** Todo el texto del documento, para poder buscar campos. */
function textoDe(bloques: readonly { text: string }[]): string {
  return bloques.map((bloque) => bloque.text).join('\n');
}

const PERIODO: EvolucionesParaPdf = {
  profesional: 'Dra. Valeria Salas',
  dias: 30,
  personas: [
    {
      nombre: 'Ana Quispe',
      motivo: 'Dolor de garganta',
      ultima: new Date('2026-09-01T14:00:00.000Z'),
      cuantas: 3,
    },
    {
      nombre: 'Luis Rojas',
      motivo: null,
      ultima: new Date('2026-08-28T09:00:00.000Z'),
      cuantas: 1,
    },
  ],
};

describe('Documento de Evoluciones', () => {
  it('no sale vacío y trae al profesional, la ventana y a cada paciente', () => {
    const texto = textoDe(bloquesDeEvoluciones(PERIODO));

    expect(texto).toContain('Dra. Valeria Salas');
    expect(texto).toContain('Últimos 30 días');
    expect(texto).toContain('Ana Quispe');
    expect(texto).toContain('Luis Rojas');
    expect(texto).toContain('Dolor de garganta');
  });

  /**
   * Es la advertencia que da la pantalla. Un PDF que la omitiera se leería
   * como la lista de las notas escritas, que es justo lo que no es.
   */
  it('avisa que no trae el texto de las evoluciones', () => {
    const texto = textoDe(bloquesDeEvoluciones(PERIODO));

    expect(texto).toContain('no el texto de cada evolución');
  });

  it('un motivo ausente se dice, en vez de dejar la celda vacía', () => {
    const filas = bloquesDeEvoluciones(PERIODO).filter(
      (bloque) => bloque.kind === 'row' && bloque.header !== true,
    );

    expect(filas).toHaveLength(2);
    expect(filas[1]?.cells?.[1]).toBe('No registrado');
  });

  it('la tabla lleva su fila de encabezado, para que las columnas se nombren', () => {
    const cabecera = bloquesDeEvoluciones(PERIODO).find(
      (bloque) => bloque.kind === 'row' && bloque.header === true,
    );

    expect(cabecera?.cells).toEqual([
      'Paciente',
      'Motivo de la última',
      'Última atención',
      'Atenciones',
    ]);
  });

  it('sin atenciones lo dice con palabras y no imprime una tabla vacía', () => {
    const bloques = bloquesDeEvoluciones({ ...PERIODO, personas: [] });

    expect(textoDe(bloques)).toContain('No hay atenciones registradas');
    expect(bloques.some((bloque) => bloque.kind === 'row')).toBe(false);
  });

  it('sin nombre de profesional no imprime una etiqueta a medias', () => {
    const texto = textoDe(bloquesDeEvoluciones({ ...PERIODO, profesional: '' }));

    expect(texto).not.toContain('Profesional:');
  });

  it('deja constancia de cuándo se generó', () => {
    expect(textoDe(bloquesDeEvoluciones(PERIODO))).toContain('Documento generado el');
  });
});
