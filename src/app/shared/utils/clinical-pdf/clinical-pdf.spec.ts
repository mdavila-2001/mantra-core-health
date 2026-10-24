import type { PdfBlock } from '../pdf-export/pdf-export';
import { setDocumentSignature } from '../../../core/pdf-branding/pdf-signature';
import {
  bloquesDeAtencion,
  bloquesDeFormulario,
  bloquesDeReceta,
  COPIA_DE_TRABAJO,
  formResponsePdfOptions,
  prescriptionPdfOptions,
  VALOR_ENMASCARADO,
  visitPdfOptions,
} from './clinical-pdf';
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

/** Los avisos del documento, con su tono y su título. */
function avisos(bloques: readonly PdfBlock[]): readonly PdfBlock[] {
  return bloques.filter((bloque) => bloque.kind === 'note');
}

/** Las filas de tabla del documento, cabeceras incluidas. */
function filas(bloques: readonly PdfBlock[]): readonly PdfBlock[] {
  return bloques.filter((bloque) => bloque.kind === 'row');
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

  /* ---- la composición: cada dato en el bloque que le corresponde ---------- */

  it('abre con paciente, profesional y la prescripción en tres tarjetas lado a lado', () => {
    const [primero] = bloquesDeReceta({
      ...RECETA,
      creadaEl: new Date(2026, 7, 15, 10, 0),
      firmadaEl: new Date(2026, 7, 15, 10, 5),
      porQueEs: { tipo: 'diagnostico', texto: 'Faringitis aguda' },
    });

    expect(primero?.kind).toBe('panels');
    expect(primero?.panels?.map((tarjeta) => tarjeta.title)).toEqual([
      'Paciente',
      'Profesional',
      'Prescripción',
    ]);
    // Para qué es (C5), cuándo se indicó y cuándo se firmó; la emisión va en la portada.
    expect(primero?.panels?.[2]?.fields).toEqual([
      { label: 'Diagnóstico', value: 'Faringitis aguda' },
      { label: 'Indicada el', value: '15/08/2026, 10:00' },
      { label: 'Firmada el', value: '15/08/2026, 10:05' },
    ]);
    expect(primero?.panels?.[0]?.fields).toEqual([
      { label: 'Nombre', value: 'Ana Quispe' },
      { label: 'Documento', value: '1234567 LP' },
    ]);
    expect(primero?.panels?.[1]?.fields).toEqual([
      { label: 'Nombre', value: 'Dra. Salas' },
      { label: 'Matrícula', value: 'MP 4821' },
      { label: 'Organización', value: 'Consultorio Central' },
    ]);
  });

  it('los medicamentos son una tabla con cabecera y una raya donde falta el dato', () => {
    const tabla = filas(
      bloquesDeReceta({ ...RECETA, medicamentos: [{ medicamento: 'Ibuprofeno', dosis: '400 mg' }] }),
    );

    expect(tabla[0]).toMatchObject({
      header: true,
      cells: ['N.º', 'Medicamento', 'Dosis', 'Frecuencia', 'Vigencia'],
    });
    expect(tabla[1]?.cells).toEqual(['1', 'Ibuprofeno', '400 mg', '—', '—']);
  });

  it('las indicaciones al paciente son una lista, una por oración o renglón', () => {
    const lista = bloquesDeReceta({
      ...RECETA,
      indicaciones: 'Tomar con las comidas. Consultar a la Dra. Salas si hay fiebre.\nNo suspender antes de tiempo.',
    }).find((bloque) => bloque.kind === 'list');

    // «Dra.» no corta la oración: sólo un punto tras una palabra completa.
    expect(lista?.items).toEqual([
      'Tomar con las comidas.',
      'Consultar a la Dra. Salas si hay fiebre.',
      'No suspender antes de tiempo.',
    ]);
  });

  it('sin indicaciones no imprime la sección vacía', () => {
    const { indicaciones: _sin, ...sinIndicaciones } = RECETA;

    expect(textoDe(bloquesDeReceta(sinIndicaciones))).not.toContain('Indicaciones al paciente');
    expect(bloquesDeReceta(sinIndicaciones).some((bloque) => bloque.kind === 'list')).toBe(false);
  });

  it('una receta sin emitir lo advierte en un aviso de alerta, no en una línea más', () => {
    const { emitidaEl: _emitida, ...sinEmitir } = RECETA;

    expect(avisos(bloquesDeReceta(sinEmitir))).toEqual([
      expect.objectContaining({ tone: 'alert', text: expect.stringContaining('Receta sin emitir') }),
    ]);
    expect(avisos(bloquesDeReceta(RECETA))).toEqual([]);
  });

  it('las alergias van en un aviso de alerta, antes de los medicamentos', () => {
    const bloques = bloquesDeReceta({ ...RECETA, alergias: ['Penicilina', ' ', 'Sulfas'] });
    const alergias = bloques.findIndex((bloque) => bloque.kind === 'note' && bloque.title === 'Alergias registradas');
    const tabla = bloques.findIndex((bloque) => bloque.kind === 'row');

    expect(bloques[alergias]?.tone).toBe('alert');
    expect(bloques[alergias]?.text).toContain('Penicilina; Sulfas.');
    expect(alergias).toBeGreaterThan(-1);
    expect(tabla).toBeGreaterThan(alergias);
    // Sin el dato no se imprime nada: no es lo mismo que «sin alergias».
    expect(textoDe(bloquesDeReceta(RECETA))).not.toContain('Alergias');
  });

  it('una copia de trabajo nunca se presenta como firmada sin aclararlo', () => {
    const tarjeta = (receta: DocumentoDeReceta) =>
      bloquesDeReceta(receta)[0]?.panels?.[2]?.fields.slice(2) ?? [];
    const { emitidaEl: _emitida, ...sinEmitir } = RECETA;
    const { firmadaEl: _firmada, ...sinFirmar } = sinEmitir;
    const firmada = new Date(2026, 7, 15, 10, 5);

    expect(tarjeta(sinFirmar)).toEqual([{ label: 'Firma', value: 'Sin firmar' }]);
    expect(tarjeta({ ...sinEmitir, firmadaEl: firmada })).toEqual([
      { label: 'Firma', value: 'Firmada el 15/08/2026, 10:05, sin emitir' },
    ]);
    expect(tarjeta({ ...RECETA, firmadaEl: firmada })).toEqual([
      { label: 'Firmada el', value: '15/08/2026, 10:05' },
    ]);
    // Emitida y sin fecha de firma: no se inventa una.
    expect(tarjeta(RECETA)).toEqual([]);
  });

  it('la fecha de emisión va en la portada y no se repite en el cuerpo', () => {
    expect(textoDe(bloquesDeReceta(RECETA))).not.toContain('Emitida el');
    expect(textoDe(bloquesDeReceta(RECETA))).toContain('Indicada el');
  });
});

describe('Portada de la receta', () => {
  it('la fecha de emisión es la de la receta, no la de la descarga', () => {
    const opciones = prescriptionPdfOptions(RECETA);

    expect(opciones.issuedAt).toEqual(RECETA.emitidaEl);
    expect(opciones.watermark).toBeUndefined();
    expect(opciones.meta).toEqual([{ label: 'Estado', value: 'Emitida' }]);
    expect(opciones.title).toBe('Receta médica');
    // El nombre va en la tarjeta del paciente, no repetido en la bajada.
    expect(opciones).not.toHaveProperty('subtitle');
  });

  it('sin emitir no declara fecha de emisión y sale con la marca de copia de trabajo', () => {
    const { emitidaEl: _emitida, ...sinEmitir } = RECETA;
    const opciones = prescriptionPdfOptions(sinEmitir);

    expect(opciones).not.toHaveProperty('issuedAt');
    expect(opciones.watermark).toBe(COPIA_DE_TRABAJO);
    expect(opciones.meta).toEqual([{ label: 'Estado', value: 'Sin emitir' }]);
  });

  /** Una receta sin emitir con la firma escaneada estampada pasaría por firmada. */
  it('sin emitir, el bloque de firma va sin las imágenes de la firma y el sello', () => {
    const imagen = { dataUrl: 'data:image/png;base64,AA==', formato: 'PNG' as const, ancho: 1, alto: 1 };
    setDocumentSignature({ nombre: 'Dra. Salas', matricula: 'M-1', firma: imagen, sello: imagen });
    const { emitidaEl: _emitida, ...sinEmitir } = RECETA;

    expect(prescriptionPdfOptions(sinEmitir).firma).toEqual({
      nombre: 'Dra. Salas',
      matricula: 'M-1',
      firma: null,
      sello: null,
    });
    setDocumentSignature(null);
    expect(prescriptionPdfOptions(sinEmitir).firma).toBeNull();
  });

  it('la firma es la del profesional de la sesión: la receta no la apaga', () => {
    // Sin `firma` en las opciones el motor usa la de la sesión; `null` la
    // quitaría, y una receta es justo el papel que firma un médico.
    expect(prescriptionPdfOptions(RECETA)).not.toHaveProperty('firma');
  });

  it('el pie lo emite la organización, si se conoce', () => {
    const { organizacion: _org, ...sinOrganizacion } = RECETA;

    expect(prescriptionPdfOptions(RECETA).issuer).toEqual({ name: 'Consultorio Central' });
    expect(prescriptionPdfOptions(sinOrganizacion)).not.toHaveProperty('issuer');
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

  it('la fecha de generación no se repite en el cuerpo: la dicen la portada y el pie', () => {
    const { cierre: _cierre, ...enCurso } = ATENCION;

    expect(textoDe(bloquesDeAtencion(ATENCION))).not.toContain('generado el');
    expect(bloquesDeAtencion(ATENCION).some((bloque) => bloque.kind === 'caption')).toBe(false);
    // Sin fecha de emisión la portada no inventa una: el motor rotula la de generación.
    expect(visitPdfOptions(enCurso)).not.toHaveProperty('issuedAt');
  });

  it('las fechas van en un solo formato, con hora de 24 horas', () => {
    const texto = textoDe(
      bloquesDeAtencion({
        ...ATENCION,
        inicio: new Date(2026, 9, 24, 21, 40),
        formularios: [
          { id: 'f', titulo: 'Tamizaje', completadoEl: new Date(2026, 9, 24, 9, 5), respuestas: [] },
        ],
      }),
    );

    expect(texto).toContain('Inicio de la atención: 24/10/2026, 21:40');
    expect(texto).toContain('Estado: Completado el 24/10/2026, 09:05');
    expect(texto).not.toMatch(/a\. m\.|p\. m\.|de octubre/);
  });

  it('un formulario sin fecha de completado se declara pendiente', () => {
    const texto = textoDe(
      bloquesDeAtencion({
        ...ATENCION,
        formularios: [{ id: 'f', titulo: 'Tamizaje', respuestas: [] }],
      }),
    );

    expect(texto).toContain('Estado: Pendiente de completar');
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

  it('abre con paciente y profesional en tarjetas, y cada bloque es una tabla con cabecera', () => {
    const bloques = bloquesDeAtencion(ATENCION);

    expect(bloques[0]?.kind).toBe('panels');
    expect(filas(bloques)).toEqual([
      expect.objectContaining({ header: true, cells: ['Diagnóstico', 'Estado clínico'] }),
      expect.objectContaining({ text: 'Faringitis aguda: Activo', cells: ['Faringitis aguda', 'Activo'] }),
    ]);
  });

  it('en curso, lo advierte en un aviso; cerrada, no hay aviso', () => {
    const { cierre: _cierre, ...enCurso } = ATENCION;

    expect(avisos(bloquesDeAtencion(enCurso))).toEqual([
      expect.objectContaining({ tone: 'warning', title: 'Atención sin cerrar' }),
    ]);
    expect(avisos(bloquesDeAtencion(ATENCION))).toEqual([]);
  });

  it('las alergias de la persona van en un aviso de alerta', () => {
    const [alergia] = avisos(bloquesDeAtencion({ ...ATENCION, alergias: ['Látex'] }));

    expect(alergia).toMatchObject({ tone: 'alert', title: 'Alergias registradas' });
    expect(alergia?.text).toContain('Látex');
  });

  it('se emite al cerrarse: la portada lleva la fecha de cierre; en curso, la marca de copia', () => {
    const { cierre: _cierre, ...enCurso } = ATENCION;

    expect(visitPdfOptions(ATENCION).issuedAt).toEqual(ATENCION.cierre);
    expect(visitPdfOptions(ATENCION).meta).toEqual([{ label: 'Estado', value: 'Cerrada' }]);
    expect(visitPdfOptions(ATENCION).watermark).toBeUndefined();
    expect(visitPdfOptions(enCurso)).not.toHaveProperty('issuedAt');
    expect(visitPdfOptions(enCurso).watermark).toBe(COPIA_DE_TRABAJO);
    expect(visitPdfOptions(enCurso).meta).toEqual([{ label: 'Estado', value: 'En curso' }]);
    // La firma es la de la sesión: la atención la firma quien atendió.
    expect(visitPdfOptions(ATENCION)).not.toHaveProperty('firma');
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

    // Completado: es su fecha de emisión, en la portada, con su estado.
    expect(formResponsePdfOptions(FORMULARIO).issuedAt).toEqual(FORMULARIO.completadoEl);
    expect(formResponsePdfOptions(FORMULARIO).meta).toEqual([{ label: 'Estado', value: 'Completado' }]);
    expect(avisos(bloquesDeFormulario(FORMULARIO))).toEqual([]);
    // Sin fecha: la portada no la inventa y el cuerpo lo advierte.
    expect(formResponsePdfOptions(sinFecha)).not.toHaveProperty('issuedAt');
    expect(formResponsePdfOptions(sinFecha).meta).toEqual([
      { label: 'Estado', value: 'Pendiente de completar' },
    ]);
    expect(textoDe(bloquesDeFormulario(sinFecha))).toContain('sin fecha de completado');
    expect(avisos(bloquesDeFormulario(sinFecha))).toEqual([
      expect.objectContaining({ tone: 'warning' }),
    ]);
  });

  it('el título de la portada es el del formulario', () => {
    expect(formResponsePdfOptions(FORMULARIO)).toMatchObject({
      title: 'Ficha de cardiología',
      kind: 'Formulario clínico',
    });
  });

  it('sin respuestas lo dice en vez de salir un papel vacío', () => {
    const texto = textoDe(bloquesDeFormulario({ ...FORMULARIO, respuestas: [] }));

    expect(texto).toContain('Sin respuestas registradas');
    expect(texto).not.toContain('generado el');
  });

  it('identifica al paciente con su tarjeta, si el dato lo trae', () => {
    const conPaciente = bloquesDeFormulario({
      ...FORMULARIO,
      paciente: { nombre: 'Ana Quispe', documento: '1234567 LP' },
      profesional: { nombre: 'Dra. Salas', matricula: 'MP 4821' },
      organizacion: 'Consultorio Central',
    });

    expect(conPaciente[0]).toMatchObject({ kind: 'panels' });
    expect(conPaciente[0]?.panels).toEqual([
      {
        title: 'Paciente',
        fields: [
          { label: 'Nombre', value: 'Ana Quispe' },
          { label: 'Documento', value: '1234567 LP' },
        ],
      },
      {
        title: 'Profesional',
        fields: [
          { label: 'Nombre', value: 'Dra. Salas' },
          { label: 'Matrícula', value: 'MP 4821' },
          { label: 'Organización', value: 'Consultorio Central' },
        ],
      },
    ]);
    // Sin el dato no se inventa una tarjeta vacía.
    expect(bloquesDeFormulario(FORMULARIO).some((bloque) => bloque.kind === 'panels')).toBe(false);
  });

  it('el pie lo emite la organización, como en los demás papeles clínicos', () => {
    expect(formResponsePdfOptions({ ...FORMULARIO, organizacion: 'Consultorio Central' }).issuer).toEqual({
      name: 'Consultorio Central',
    });
    expect(formResponsePdfOptions(FORMULARIO)).not.toHaveProperty('issuer');
  });
});
