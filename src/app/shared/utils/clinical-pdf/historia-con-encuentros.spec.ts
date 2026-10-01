import { bloquesDeHistoriaConEncuentros } from './historia-con-encuentros';
import type { SeccionesNuevasDeLaHistoria } from './historia-con-encuentros';
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
 * 3. **Las secciones nuevas van ANTES del pie.** Algo impreso después de la
 *    línea que fecha el documento se lee como el anexo de otro papel.
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

const NADA: SeccionesNuevasDeLaHistoria = {
  diagnosticos: { enEstudio: [], activas: [], historicos: [] },
  lineas: [],
};

const TRES_DIAGNOSTICOS: SeccionesNuevasDeLaHistoria = {
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
    const texto = textoDe(bloquesDeHistoriaConEncuentros(HISTORIA_VACIA, NADA));

    expect(texto).toContain('Diagnósticos por estado');
    expect(texto).toContain('En estudio');
    expect(texto).toContain('Enfermedades activas');
    expect(texto).toContain('Históricos');
  });

  it('dice con palabras que un bloque está vacío', () => {
    const texto = textoDe(bloquesDeHistoriaConEncuentros(HISTORIA_VACIA, NADA));

    expect(texto).toContain('Sin diagnósticos en estudio.');
    expect(texto).toContain('Sin enfermedades activas registradas.');
    expect(texto).toContain('Sin diagnósticos históricos.');
    expect(texto).toContain('Sin atenciones registradas.');
  });

  it('imprime cada diagnóstico con su certeza y su detalle', () => {
    const texto = textoDe(bloquesDeHistoriaConEncuentros(HISTORIA_VACIA, TRES_DIAGNOSTICOS));

    expect(texto).toContain('Hipertensión (Confirmado) — activa hasta el 24/11/2026');
    expect(texto).toContain('Dislipidemia (Provisional) — —');
    expect(texto).toContain('Faringitis aguda (Descartado) — Descartado');
  });

  /**
   * El kill-test, en el papel: el descartado tiene que estar **después** del
   * encabezado «Históricos» y **antes** del de «Línea de cada atención», nunca
   * dentro del tramo de «Enfermedades activas».
   */
  it('un diagnóstico descartado no cae en el tramo de las enfermedades activas', () => {
    const bloques = bloquesDeHistoriaConEncuentros(HISTORIA_VACIA, TRES_DIAGNOSTICOS);
    const indices = bloques.map((bloque) => bloque.text);

    const activas = indices.indexOf('Enfermedades activas');
    const historicos = indices.indexOf('Históricos');
    const descartado = indices.findIndex((texto) => texto.includes('Faringitis aguda'));

    expect(activas).toBeGreaterThan(-1);
    expect(historicos).toBeGreaterThan(activas);
    expect(descartado).toBeGreaterThan(historicos);
  });

  it('imprime la línea de cada atención con su estado y sus hechos, en orden', () => {
    const texto = textoDe(bloquesDeHistoriaConEncuentros(HISTORIA_VACIA, TRES_DIAGNOSTICOS));

    expect(texto).toContain('Línea de cada atención');
    expect(texto).toContain('Dolor de garganta · 1 de marzo de 2026');
    expect(texto).toContain('Estado de la atención: Cerrada');
    expect(texto).toContain('Nota #a1b2 (1 de marzo de 2026)');
    expect(texto).toContain('Análisis de laboratorio: Hemograma — resultado disponible');
    // Sin instante, el hecho se imprime igual: no se inventa una fecha.
    expect(texto).toContain('Receta: Losartán — por Hipertensión');
  });

  it('una atención sin nada registrado lo dice en vez de quedar en blanco', () => {
    const texto = textoDe(
      bloquesDeHistoriaConEncuentros(HISTORIA_VACIA, {
        ...NADA,
        lineas: [{ titulo: 'Control · 2 de marzo de 2026', sello: 'En curso', hechos: [] }],
      }),
    );

    expect(texto).toContain('De esta atención no quedó nada registrado.');
  });

  /** El pie fecha el documento: nada se imprime después de esa línea. */
  it('las secciones nuevas van antes del pie del documento', () => {
    const bloques = bloquesDeHistoriaConEncuentros(HISTORIA_VACIA, TRES_DIAGNOSTICOS);

    expect(bloques.at(-1)?.kind).toBe('caption');
    expect(bloques.at(-1)?.text).toContain('Documento generado el');
  });

  /** Y las cinco secciones de siempre siguen en pie: esto agrega, no reemplaza. */
  it('conserva las cinco secciones originales de la historia', () => {
    const texto = textoDe(bloquesDeHistoriaConEncuentros(HISTORIA_VACIA, NADA));

    expect(texto).toContain('Atenciones');
    expect(texto).toContain('Recetas');
    expect(texto).toContain('Formularios');
    expect(texto).toContain('Órdenes de estudio');
    expect(texto).toContain('Resultados');
  });

  it('ningún identificador interno llega al papel', () => {
    const texto = textoDe(bloquesDeHistoriaConEncuentros(HISTORIA_VACIA, TRES_DIAGNOSTICOS));

    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
