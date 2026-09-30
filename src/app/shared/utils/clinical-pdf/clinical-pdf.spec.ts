import { bloquesDeAtencion, bloquesDeFormulario, bloquesDeReceta, VALOR_ENMASCARADO } from './clinical-pdf';
import type {
  DocumentoDeAtencion,
  DocumentoDeFormulario,
  DocumentoDeReceta,
} from './clinical-pdf.types';

/**
 * Los dos documentos de la corrección #16.
 *
 * El criterio de éxito de esta iteración está escrito en el carril: el PDF **se
 * genera desde datos persistidos, no está vacío y contiene los campos mínimos**.
 * Eso es lo que se mira acá: **qué dice el documento**.
 *
 * ## Por qué se prueba el contenido y no el PDF
 *
 * Porque el contenido es lo que este archivo decide; maquetarlo es de
 * `pdf-export.ts`, que tiene sus propias pruebas. Ir hasta el `jsPDF` real
 * obligaba a leer sus estructuras internas —que cambian según qué build resuelve
 * Vitest— y mockear el módulo acoplaba esta prueba con `pdf-export.spec.ts`: los
 * dos archivos mockeaban `jspdf` y, según cómo el pool repartiera los workers,
 * uno se llevaba puesto al otro. Un test que depende del orden en que corren los
 * archivos no prueba nada.
 */

/** Todo el texto del documento, para poder buscar campos. */
function textoDe(bloques: readonly { text: string }[]): string {
  return bloques.map((bloque) => bloque.text).join('\n');
}

const RECETA: DocumentoDeReceta = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  paciente: { nombre: 'Ana Quispe', documento: '1234567 LP' },
  profesional: { nombre: 'Dra. Salas', matricula: 'MP 4821' },
  organizacion: 'Consultorio Central',
  creadaEl: new Date('2026-08-15T14:00:00.000Z'),
  emitidaEl: new Date('2026-08-15T14:10:00.000Z'),
  medicamentos: [
    {
      medicamento: 'Amoxicilina',
      dosis: '500 mg',
      frecuencia: 'cada 8 horas',
      vigencia: '7 días',
    },
  ],
  indicaciones: 'Tomar con las comidas.',
};

const ATENCION: DocumentoDeAtencion = {
  id: '11111111-2222-3333-4444-555555555555',
  paciente: { nombre: 'Ana Quispe' },
  profesional: { nombre: 'Dra. Salas' },
  motivo: 'Dolor de garganta',
  inicio: new Date('2026-08-15T13:00:00.000Z'),
  cierre: new Date('2026-08-15T13:30:00.000Z'),
  bloques: [
    {
      titulo: 'Diagnósticos',
      datos: [{ etiqueta: 'Faringitis aguda', valor: 'Activo' }],
    },
  ],
};

describe('Documento de receta', () => {
  it('no sale vacío y trae paciente, profesional y medicamento', () => {
    const texto = textoDe(bloquesDeReceta(RECETA));

    expect(texto).toContain('Ana Quispe');
    expect(texto).toContain('Dra. Salas');
    expect(texto).toContain('Amoxicilina');
    expect(texto).toContain('500 mg');
    expect(texto).toContain('cada 8 horas');
    // El documento dice de qué organización sale: un papel clínico sin origen
    // no se puede rastrear después.
    expect(texto).toContain('Consultorio Central');
  });

  it('una receta sin emitir lo dice, en vez de aparentar validez', () => {
    const { emitidaEl: _emitida, ...sinEmitir } = RECETA;

    expect(textoDe(bloquesDeReceta(sinEmitir))).toContain('sin emitir');
    expect(textoDe(bloquesDeReceta(RECETA))).not.toContain('sin emitir');
  });

  it('sin medicamentos lo dice: una receta vacía no puede parecer completa', () => {
    expect(textoDe(bloquesDeReceta({ ...RECETA, medicamentos: [] }))).toContain('Sin medicamentos');
  });

  /* ---- C5: la sección "Diagnóstico" nunca sale vacía ------------------------ */

  it('C5: con un diagnóstico confirmado, dice "Diagnóstico: <nombre>"', () => {
    const texto = textoDe(
      bloquesDeReceta({
        ...RECETA,
        porQueEs: { tipo: 'diagnostico', texto: 'Faringitis aguda' },
      }),
    );

    expect(texto).toContain('Diagnóstico');
    expect(texto).toContain('Faringitis aguda');
  });

  it('C5: con un motivo escrito, dice "Motivo: <texto>"', () => {
    const texto = textoDe(
      bloquesDeReceta({
        ...RECETA,
        porQueEs: { tipo: 'motivo', texto: 'Control de síntomas' },
      }),
    );

    expect(texto).toContain('Motivo');
    expect(texto).toContain('Control de síntomas');
  });

  it('C5: sin `porQueEs` (pendiente de integración), la sección no queda vacía ni inventa un dato', () => {
    const { porQueEs: _sinUsar, ...sinPorQueEs } = RECETA;

    expect(textoDe(bloquesDeReceta(sinPorQueEs))).toContain('Sin indicación registrada');
  });

  it('los datos que faltan salen como no registrados, nunca como hueco', () => {
    const texto = textoDe(
      bloquesDeReceta({ ...RECETA, paciente: { nombre: '' }, profesional: { nombre: '' } }),
    );

    expect(texto).toContain('No registrado');
  });

  it('la matrícula y el documento sólo se imprimen si existen', () => {
    const texto = textoDe(
      bloquesDeReceta({
        ...RECETA,
        paciente: { nombre: 'Ana Quispe' },
        profesional: { nombre: 'Dra. Salas' },
      }),
    );

    expect(texto).not.toContain('Matrícula');
    expect(texto).not.toContain('Documento:');
  });

  it('los medicamentos van numerados: una receta se lee por renglón', () => {
    const texto = textoDe(
      bloquesDeReceta({
        ...RECETA,
        medicamentos: [
          { medicamento: 'Amoxicilina' },
          { medicamento: 'Ibuprofeno', dosis: '400 mg' },
        ],
      }),
    );

    expect(texto).toContain('1. Amoxicilina');
    expect(texto).toContain('2. Ibuprofeno · 400 mg');
  });
});

describe('Documento de la atención', () => {
  it('trae motivo, fechas y los bloques clínicos', () => {
    const texto = textoDe(bloquesDeAtencion(ATENCION));

    expect(texto).toContain('Dolor de garganta');
    expect(texto).toContain('Diagnósticos');
    expect(texto).toContain('Faringitis aguda');
  });

  it('una atención en curso se declara copia de trabajo', () => {
    const { cierre: _cierre, ...enCurso } = ATENCION;

    expect(textoDe(bloquesDeAtencion(enCurso))).toContain('en curso');
    expect(textoDe(bloquesDeAtencion(ATENCION))).not.toContain('en curso');
  });

  it('un bloque sin registros lo dice en vez de desaparecer', () => {
    const texto = textoDe(
      bloquesDeAtencion({ ...ATENCION, bloques: [{ titulo: 'Medicación', datos: [] }] }),
    );

    expect(texto).toContain('Medicación');
    expect(texto).toContain('Sin registros');
  });

  it('el documento declara cuándo se generó', () => {
    expect(textoDe(bloquesDeAtencion(ATENCION))).toContain('generado el');
  });

  it('sin motivo registrado lo dice, en vez de dejar el renglón colgado', () => {
    const { motivo: _motivo, ...sinMotivo } = ATENCION;

    expect(textoDe(bloquesDeAtencion(sinMotivo))).toContain('Motivo de consulta: No registrado');
  });

  it('incorpora los formularios respondidos, una sección legible por formulario', () => {
    const texto = textoDe(
      bloquesDeAtencion({
        ...ATENCION,
        formularios: [
          {
            id: 'fi-1',
            titulo: 'Ficha de cardiología',
            completadoEl: new Date('2026-08-17T15:00:00.000Z'),
            respuestas: [
              { etiqueta: 'Tolerancia al ejercicio', texto: 'Buena', masked: false },
              { etiqueta: 'Serología', texto: 'SECRETO', masked: true },
            ],
          },
        ],
      }),
    );

    expect(texto).toContain('Formulario: Ficha de cardiología');
    expect(texto).toContain('Completado el');
    expect(texto).toContain('Tolerancia al ejercicio: Buena');
    // El enmascarado no cede tampoco dentro de la historia.
    expect(texto).toContain(`Serología: ${VALOR_ENMASCARADO}`);
    expect(texto).not.toContain('SECRETO');
  });

  it('sin formularios el documento es el mismo de antes: cero regresión', () => {
    const texto = textoDe(bloquesDeAtencion(ATENCION));

    expect(texto).not.toContain('Formulario:');
  });
});

const FORMULARIO: DocumentoDeFormulario = {
  id: '99999999-8888-7777-6666-555555555555',
  titulo: 'Ficha de cardiología',
  completadoEl: new Date('2026-08-17T15:00:00.000Z'),
  respuestas: [
    { etiqueta: 'Tolerancia al ejercicio', texto: 'Buena', masked: false },
    { etiqueta: 'Edema', texto: 'No', masked: false },
    { etiqueta: 'Serología', texto: 'SECRETO', masked: true },
  ],
};

describe('Documento del formulario respondido', () => {
  it('trae las respuestas en el orden en que se respondieron', () => {
    const lineas = bloquesDeFormulario(FORMULARIO).map((bloque) => bloque.text);

    const tolerancia = lineas.findIndex((linea) => linea.includes('Tolerancia al ejercicio'));
    const edema = lineas.findIndex((linea) => linea.includes('Edema'));
    expect(tolerancia).toBeGreaterThan(-1);
    expect(edema).toBeGreaterThan(tolerancia);
    expect(textoDe(bloquesDeFormulario(FORMULARIO))).toContain(
      'Tolerancia al ejercicio: Buena',
    );
  });

  it('un valor enmascarado imprime el marcador y jamás el contenido', () => {
    const texto = textoDe(bloquesDeFormulario(FORMULARIO));

    expect(texto).toContain(`Serología: ${VALOR_ENMASCARADO}`);
    // Aunque el llamador haya pasado texto por error, la bandera manda.
    expect(texto).not.toContain('SECRETO');
  });

  it('declara la fecha de completado, o su ausencia con todas las letras', () => {
    const { completadoEl: _fecha, ...sinFecha } = FORMULARIO;

    expect(textoDe(bloquesDeFormulario(FORMULARIO))).toContain('Completado el');
    expect(textoDe(bloquesDeFormulario(sinFecha))).toContain('sin fecha de completado');
  });

  it('sin respuestas lo dice en vez de salir un papel vacío', () => {
    const texto = textoDe(bloquesDeFormulario({ ...FORMULARIO, respuestas: [] }));

    expect(texto).toContain('Sin respuestas registradas');
    expect(texto).toContain('generado el');
  });
});
