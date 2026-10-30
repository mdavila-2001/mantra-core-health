import { historyWithEncountersBlocks } from './history-with-encounters';
import type { HistoryNewSections } from './history-with-encounters';
import type { DocumentoDeHistoria } from './clinical-pdf.types';

/**
 * Carril C6 · las dos secciones que le faltaban a «Descargar tu historia»:
 * los diagnósticos por estado y la línea de cada atención.
 *
 * Se prueba el contenido y no el PDF, igual que sus vecinos: lo que este
 * archivo decide es **qué dice** el documento, y maquetarlo es de
 * `pdf-export.ts`, que tiene sus propias pruebas.
 *
 * Lo que fijan, y por qué duele si se rompe:
 *
 * 1. **Los tres bloques se imprimen siempre, vacíos incluidos.** Misma razón
 *    que las cinco secciones de `bloquesDeHistoria`: un bloque que desaparece
 *    deja a quien lee sin saber si no tiene nada o si el sistema no lo trajo.
 * 2. **Un diagnóstico descartado no se imprime como enfermedad activa.** Es el
 *    kill-test del carril, y en el papel pesa más: el PDF sale del sistema y
 *    circula por su cuenta.
 * 3. **El cuerpo no repite la fecha de generación.** La dicen la portada y el pie;
 *    una tercera fecha en el cuerpo sólo puede contradecirlas.
 * 4. **Cero identificadores internos.** Quien abre el PDF no tiene catálogo con
 *    que resolver un uuid.
 */

/** Todo el texto del documento, para poder buscar campos. */
function textoDe(bloques: readonly { text: string }[]): string {
  return bloques.map((bloque) => bloque.text).join('\n');
}

const HISTORIA_VACIA: DocumentoDeHistoria = {
  paciente: { nombre: 'Ana Quispe' },
  atenciones: [],
  recetas: [],
  formularios: [],
  ordenes: [],
  resultados: [],
};

const NADA: HistoryNewSections = {
  diagnosticos: { enEstudio: [], activas: [], historicos: [] },
  lineas: [],
};

const TRES_DIAGNOSTICOS: HistoryNewSections = {
  diagnosticos: {
    enEstudio: [{ nombre: 'Dislipidemia', certeza: 'Provisional', detalle: null }],
    activas: [
      { nombre: 'Hipertensión', certeza: 'Confirmado', detalle: 'activa hasta el 24/11/2026' },
    ],
    historicos: [{ nombre: 'Faringitis aguda', certeza: 'Descartado', detalle: 'Descartado' }],
  },
  lineas: [
    {
      titulo: 'Dolor de garganta · 1 de marzo de 2026',
      sello: 'Cerrada',
      hechos: [
        { titulo: 'Nota #a1b2', detalle: null, cuando: '1 de marzo de 2026' },
        {
          titulo: 'Análisis de laboratorio: Hemograma',
          detalle: 'resultado disponible',
          cuando: '1 de marzo de 2026',
        },
        { titulo: 'Receta: Losartán', detalle: 'por Hipertensión', cuando: null },
      ],
    },
  ],
};

describe('bloquesDeHistoriaConEncuentros', () => {
  it('imprime los tres bloques de diagnósticos aunque no haya ninguno', () => {
    const texto = textoDe(historyWithEncountersBlocks(HISTORIA_VACIA, NADA));

    expect(texto).toContain('Diagnósticos por estado');
    expect(texto).toContain('En estudio');
    expect(texto).toContain('Enfermedades activas');
    expect(texto).toContain('Históricos');
  });

  it('dice con palabras que un bloque está vacío', () => {
    const texto = textoDe(historyWithEncountersBlocks(HISTORIA_VACIA, NADA));

    expect(texto).toContain('Sin diagnósticos en estudio.');
    expect(texto).toContain('Sin enfermedades activas registradas.');
    expect(texto).toContain('Sin diagnósticos históricos.');
    expect(texto).toContain('Sin atenciones registradas.');
  });

  it('imprime cada diagnóstico con su certeza y su detalle', () => {
    const texto = textoDe(historyWithEncountersBlocks(HISTORIA_VACIA, TRES_DIAGNOSTICOS));

    expect(texto).toContain('Hipertensión (Confirmado) — activa hasta el 24/11/2026');
    expect(texto).toContain('Dislipidemia (Provisional) — —');
    expect(texto).toContain('Faringitis aguda (Descartado) — Descartado');
  });

  /**
   * El kill-test, en el papel: el descartado tiene que estar **después** del
   * encabezado «Históricos» y **antes** del de «Cronología por atención», nunca
   * dentro del tramo de «Enfermedades activas».
   */
  it('un diagnóstico descartado no cae en el tramo de las enfermedades activas', () => {
    const bloques = historyWithEncountersBlocks(HISTORIA_VACIA, TRES_DIAGNOSTICOS);
    const indices = bloques.map((bloque) => bloque.text);

    const activas = indices.indexOf('Enfermedades activas');
    const historicos = indices.indexOf('Históricos');
    const descartado = indices.findIndex((texto) => texto.includes('Faringitis aguda'));

    expect(activas).toBeGreaterThan(-1);
    expect(historicos).toBeGreaterThan(activas);
    expect(descartado).toBeGreaterThan(historicos);
  });

  it('imprime la línea de cada atención con su estado y sus hechos, en orden', () => {
    const texto = textoDe(historyWithEncountersBlocks(HISTORIA_VACIA, TRES_DIAGNOSTICOS));

    expect(texto).toContain('Cronología por atención');
    expect(texto).toContain('Dolor de garganta · 1 de marzo de 2026');
    expect(texto).toContain('Estado de la atención: Cerrada');
    expect(texto).toContain('Nota #a1b2 (1 de marzo de 2026)');
    expect(texto).toContain('Análisis de laboratorio: Hemograma — resultado disponible');
    // Sin instante, el hecho se imprime igual: no se inventa una fecha.
    expect(texto).toContain('Receta: Losartán — por Hipertensión');
  });

  it('una atención sin nada registrado lo dice en vez de quedar en blanco', () => {
    const texto = textoDe(
      historyWithEncountersBlocks(HISTORIA_VACIA, {
        ...NADA,
        lineas: [{ titulo: 'Control · 2 de marzo de 2026', sello: 'En curso', hechos: [] }],
      }),
    );

    expect(texto).toContain('Sin registros clínicos en esta atención.');
  });

  /** El pie de cada hoja fecha el documento: el cuerpo no lo repite. */
  it('el cuerpo no repite la fecha de generación', () => {
    const bloques = historyWithEncountersBlocks(HISTORIA_VACIA, TRES_DIAGNOSTICOS);

    expect(bloques.some((bloque) => bloque.kind === 'caption')).toBe(false);
    expect(bloques.map((bloque) => bloque.text).join('\n')).not.toContain('generado el');
  });

  it('los tres bloques son una sola tabla, con una banda por bloque y rayas en los vacíos', () => {
    const filas = historyWithEncountersBlocks(HISTORIA_VACIA, {
      ...TRES_DIAGNOSTICOS,
      diagnosticos: { ...TRES_DIAGNOSTICOS.diagnosticos, enEstudio: [] },
    })
      .filter((bloque) => bloque.kind === 'row')
      .map((fila) => [fila.header === true, fila.cells]);

    expect(filas).toEqual([
      [true, ['En estudio', 'Certeza', 'Detalle']],
      [false, ['Sin diagnósticos en estudio', '—', '—']],
      [true, ['Enfermedades activas', 'Certeza', 'Detalle']],
      [false, ['Hipertensión', 'Confirmado', 'activa hasta el 24/11/2026']],
      [true, ['Históricos', 'Certeza', 'Detalle']],
      [false, ['Faringitis aguda', 'Descartado', 'Descartado']],
    ]);
  });

  /** Y las cinco secciones de siempre siguen en pie: esto agrega, no reemplaza. */
  it('conserva las cinco secciones originales de la historia', () => {
    const texto = textoDe(historyWithEncountersBlocks(HISTORIA_VACIA, NADA));

    expect(texto).toContain('Atenciones');
    expect(texto).toContain('Recetas');
    expect(texto).toContain('Formularios');
    expect(texto).toContain('Órdenes de estudio');
    expect(texto).toContain('Resultados');
  });

  /**
   * Cada sección donde se lee: los diagnósticos por estado abren la historia
   * —antes de las atenciones— y la línea de cada atención sigue a las
   * atenciones, antes de las recetas.
   */
  it('ubica los diagnósticos antes de las atenciones y la línea antes de las recetas', () => {
    const textos = historyWithEncountersBlocks(HISTORIA_VACIA, TRES_DIAGNOSTICOS).map(
      (bloque) => bloque.text,
    );
    const paciente = textos.indexOf('Datos del paciente');
    const diagnosticos = textos.indexOf('Diagnósticos por estado');
    const atenciones = textos.indexOf('Atenciones');
    const lineas = textos.indexOf('Cronología por atención');
    const recetas = textos.indexOf('Recetas');

    expect(paciente).toBeGreaterThan(-1);
    expect(diagnosticos).toBeGreaterThan(paciente);
    expect(atenciones).toBeGreaterThan(diagnosticos);
    expect(lineas).toBeGreaterThan(atenciones);
    expect(recetas).toBeGreaterThan(lineas);
  });

  describe('servicios recibidos', () => {
    const SERVICIOS = [
      {
        date: '12/08/2026',
        title: 'Infiltración articular',
        type: 'Intervención médica',
        performer: 'Dra. Ana Rojas',
        site: 'Clínica Los Olivos',
        status: 'Realizada',
        result: '',
        cost: '350.00 Bs',
      },
    ];

    it('sin servicios en los datos no imprime la sección: no afirma que no hubo', () => {
      const textos = historyWithEncountersBlocks(HISTORIA_VACIA, TRES_DIAGNOSTICOS).map((bloque) => bloque.text);
      expect(textos).not.toContain('Servicios recibidos');
    });

    it('con servicios los imprime al final, después de lo que se habló y se pidió', () => {
      const bloques = historyWithEncountersBlocks(HISTORIA_VACIA, { ...TRES_DIAGNOSTICOS, servicios: SERVICIOS });
      const textos = bloques.map((bloque) => bloque.text);
      expect(textos.indexOf('Servicios recibidos')).toBeGreaterThan(textos.indexOf('Recetas'));
      expect(bloques.at(-1)).toMatchObject({ kind: 'row' });
    });

    it('con una lista vacía imprime la sección y dice que no hubo', () => {
      const textos = historyWithEncountersBlocks(HISTORIA_VACIA, { ...TRES_DIAGNOSTICOS, servicios: [] }).map((bloque) => bloque.text);
      expect(textos).toContain('Servicios recibidos');
      expect(textos).toContain('Sin servicios recibidos.');
    });

    it('ningún identificador llega al papel con servicios', () => {
      const texto = textoDe(historyWithEncountersBlocks(HISTORIA_VACIA, { ...TRES_DIAGNOSTICOS, servicios: SERVICIOS }));
      expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    });
  });

  it('los hechos de una atención son una lista, en el orden dado', () => {
    const lista = historyWithEncountersBlocks(HISTORIA_VACIA, TRES_DIAGNOSTICOS).find(
      (bloque) => bloque.kind === 'list',
    );

    expect(lista?.items).toEqual([
      'Nota #a1b2 (1 de marzo de 2026)',
      'Análisis de laboratorio: Hemograma — resultado disponible (1 de marzo de 2026)',
      'Receta: Losartán — por Hipertensión',
    ]);
  });

  it('ningún identificador interno llega al papel', () => {
    const texto = textoDe(historyWithEncountersBlocks(HISTORIA_VACIA, TRES_DIAGNOSTICOS));

    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
