import { buildPrescriptionPdf, buildVisitPdf } from './clinical-pdf';
import type { DocumentoDeAtencion, DocumentoDeReceta } from './clinical-pdf.types';

/**
 * Los dos documentos de la corrección #16.
 *
 * El criterio de éxito de esta iteración está escrito en el carril: el PDF **se
 * genera desde datos persistidos, no está vacío y contiene los campos mínimos**.
 * Eso es exactamente lo que estas pruebas miran, y por eso leen el texto del
 * documento en vez de comparar bytes: un snapshot de bytes se rompe cuando
 * cambia la versión de la librería, sin que el documento haya cambiado en nada
 * que le importe a nadie.
 */

/** El texto de todas las páginas del PDF, para poder buscar campos. */
function textoDe(doc: ReturnType<typeof buildVisitPdf>): string {
  // `getTextContent` no existe en jsPDF; el texto se recupera del stream
  // interno, que es donde la librería deja lo que va a imprimir.
  const paginas = (doc as unknown as { internal: { pages: string[][] } }).internal.pages;
  return paginas.flat().join('\n');
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

describe('PDF de receta', () => {
  it('no sale vacío y trae paciente, profesional y medicamento', () => {
    const texto = textoDe(buildPrescriptionPdf(RECETA));

    expect(texto).toContain('Receta');
    expect(texto).toContain('Ana Quispe');
    expect(texto).toContain('Salas');
    expect(texto).toContain('Amoxicilina');
    expect(texto).toContain('500 mg');
  });

  it('una receta sin emitir lo dice, en vez de aparentar validez', () => {
    const { emitidaEl: _emitida, ...sinEmitir } = RECETA;
    const texto = textoDe(buildPrescriptionPdf(sinEmitir));

    expect(texto).toContain('sin emitir');
  });

  it('sin medicamentos lo dice: una receta vacía no puede parecer completa', () => {
    const texto = textoDe(buildPrescriptionPdf({ ...RECETA, medicamentos: [] }));

    expect(texto).toContain('Sin medicamentos');
  });

  it('los datos que faltan salen como no registrados, nunca como hueco', () => {
    const texto = textoDe(
      buildPrescriptionPdf({ ...RECETA, paciente: { nombre: '' }, profesional: { nombre: '' } }),
    );

    expect(texto).toContain('No registrado');
  });
});

describe('PDF de la atención', () => {
  it('trae motivo, fechas y los bloques clínicos', () => {
    const texto = textoDe(buildVisitPdf(ATENCION));

    expect(texto).toContain('Dolor de garganta');
    expect(texto).toContain('Diagn');
    expect(texto).toContain('Faringitis aguda');
  });

  it('una atención en curso se declara copia de trabajo', () => {
    const { cierre: _cierre, ...enCurso } = ATENCION;
    const texto = textoDe(buildVisitPdf(enCurso));

    expect(texto).toContain('en curso');
  });

  it('un bloque sin registros lo dice en vez de desaparecer', () => {
    const texto = textoDe(
      buildVisitPdf({ ...ATENCION, bloques: [{ titulo: 'Medicación', datos: [] }] }),
    );

    expect(texto).toContain('Sin registros');
  });

  it('el documento declara cuándo se generó', () => {
    expect(textoDe(buildVisitPdf(ATENCION))).toContain('generado el');
  });
});
