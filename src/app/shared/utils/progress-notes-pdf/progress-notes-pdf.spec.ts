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
  filtro: null,
  atenciones: [
    {
      cuando: new Date('2026-09-01T14:00:00.000Z'),
      paciente: 'Ana Quispe',
      motivo: 'Dolor de garganta',
      estado: 'Completada',
      tipo: 'Consulta',
    },
    {
      cuando: new Date('2026-08-28T09:00:00.000Z'),
      paciente: 'Luis Rojas',
      motivo: null,
      estado: 'Llegó y no se cerró',
      tipo: null,
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
    expect(filas[1]?.cells?.[2]).toBe('No registrado');
  });

  it('la tabla lleva su fila de encabezado, para que las columnas se nombren', () => {
    const cabecera = bloquesDeEvoluciones(PERIODO).find(
      (bloque) => bloque.kind === 'row' && bloque.header === true,
    );

    expect(cabecera?.cells).toEqual(['Cuándo', 'Paciente', 'Motivo', 'Estado', 'Tipo']);
  });

  it('sin atenciones lo dice con palabras y no imprime una tabla vacía', () => {
    const bloques = bloquesDeEvoluciones({ ...PERIODO, atenciones: [] });

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

  /**
   * El papel sale de la pantalla **tal como se está viendo**. Si hay un filtro
   * puesto, quien lo recibe tiene que saber que mira un recorte antes de sacar
   * cuentas: sin eso, «3 atenciones» se lee como «hubo 3».
   */
  it('con un filtro puesto, el papel dice cuál', () => {
    const texto = textoDe(
      bloquesDeEvoluciones({ ...PERIODO, filtro: 'estado Completada · búsqueda «quispe»' }),
    );

    expect(texto).toContain('Filtro aplicado');
    expect(texto).toContain('estado Completada');
  });

  it('un filtro que no deja nada lo dice así, y no como un período vacío', () => {
    const texto = textoDe(
      bloquesDeEvoluciones({ ...PERIODO, atenciones: [], filtro: 'estado En curso' }),
    );

    expect(texto).toContain('coincide con el filtro');
    expect(texto).not.toContain('No hay atenciones registradas');
  });

  it('sin filtro no inventa una línea de filtro', () => {
    expect(textoDe(bloquesDeEvoluciones(PERIODO))).not.toContain('Filtro aplicado');
  });

  it('el estado de cada atención va en el papel', () => {
    const texto = textoDe(bloquesDeEvoluciones(PERIODO));

    expect(texto).toContain('Llegó y no se cerró');
  });
});
