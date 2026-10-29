import { test, vi } from 'vitest';

import {
  buildFormResponsePdf,
  buildOrderPdf,
  buildPrescriptionPdf,
  buildVisitPdf,
} from '../../src/app/shared/utils/clinical-pdf/clinical-pdf';
import type {
  DocumentoBloque,
  DocumentoDeAtencion,
  DocumentoDeFormulario,
  DocumentoDeHistoria,
  DocumentoDeOrden,
  DocumentoDeReceta,
  DocumentoDato,
  DocumentoMedicamento,
  DocumentoPaciente,
  DocumentoProfesional,
  HistoriaAtencion,
} from '../../src/app/shared/utils/clinical-pdf/clinical-pdf.types';
import {
  buildHistoryWithEncountersPdf,
  type HistoryNewSections,
} from '../../src/app/shared/utils/clinical-pdf/history-with-encounters';
import { establecerLogoDeDocumentos } from '../../src/app/core/pdf-branding/pdf-logo';
import { fixtureImage, loadBrandFonts, SAMPLE_DATE, SAMPLE_SIGNATURE, savePdf, useSampleSignature } from './sample-setup';

/**
 * Las muestras de los documentos clínicos: una receta emitida de una hoja, la
 * misma sin emitir ni firmar (copia de trabajo), la historia de una atención,
 * una orden de laboratorio, un formulario respondido con un valor protegido y
 * la historia clínica completa, de varias hojas. Todos los datos son ficticios
 * y coherentes entre sí: la medicación, las órdenes y la cronología de cada
 * atención cuentan la misma historia.
 *
 * Se cargan la firma y el logo de muestra, como los deja la sesión de un
 * profesional: la historia completa los tiene que rechazar (`firma: null`). El
 * reloj se fija a las 18:00 del día de la muestra, después de todo lo que
 * cuentan los datos, para que la fecha de generación no contradiga a ninguna.
 */

const PACIENTE: DocumentoPaciente = { nombre: 'Valeria Andrea Choque Mamani', documento: 'CI 0000000 LP' };
const PROFESIONAL: DocumentoProfesional = {
  nombre: SAMPLE_SIGNATURE.nombre,
  matricula: SAMPLE_SIGNATURE.matricula ?? undefined,
};
const ORGANIZACION = 'Consultorio Illimani';
const NOW = new Date(2026, 9, 24, 18, 0);

const day = (month: number, date: number, hours = 9, minutes = 0): Date =>
  new Date(2026, month - 1, date, hours, minutes);

/* ---- los papeles de un hecho clínico --------------------------------------- */

const RECETA: DocumentoDeReceta = {
  id: '00000000-0000-4000-8000-000000000201',
  paciente: PACIENTE,
  profesional: PROFESIONAL,
  organizacion: ORGANIZACION,
  creadaEl: day(10, 24, 10, 5),
  firmadaEl: day(10, 24, 10, 20),
  emitidaEl: SAMPLE_DATE,
  porQueEs: { tipo: 'diagnostico', texto: 'Faringoamigdalitis aguda' },
  alergias: ['Penicilina (reacción cutánea, 2019)'],
  medicamentos: [
    { medicamento: 'Azitromicina 500 mg comprimidos', dosis: '1 comprimido', frecuencia: 'cada 24 horas', vigencia: 'del 24/10/2026 al 26/10/2026' },
    { medicamento: 'Ibuprofeno 400 mg comprimidos', dosis: '1 comprimido', frecuencia: 'cada 8 horas', vigencia: 'del 24/10/2026 al 28/10/2026' },
  ],
  indicaciones:
    'Tome la azitromicina a la misma hora cada día, aunque se sienta mejor. Tome el ibuprofeno con alimentos y solo si hay dolor.\nConsulte de inmediato si aparece dificultad para respirar, fiebre de más de 39 °C o erupción en la piel.',
};

const ATENCION: DocumentoDeAtencion = {
  id: '00000000-0000-4000-8000-000000000301',
  paciente: PACIENTE,
  profesional: PROFESIONAL,
  organizacion: ORGANIZACION,
  motivo: 'Dolor de garganta de tres días de evolución, con fiebre de 38,5 °C y dificultad para tragar.',
  inicio: day(10, 24, 9, 40),
  cierre: day(10, 24, 10, 25),
  alergias: ['Penicilina (reacción cutánea, 2019)'],
  bloques: [
    {
      titulo: 'Diagnósticos',
      datos: [
        { etiqueta: 'Faringoamigdalitis aguda', valor: 'Activo' },
        { etiqueta: 'Rinitis alérgica', valor: 'Crónico, en seguimiento' },
      ],
    },
    {
      titulo: 'Medicación indicada',
      datos: [
        { etiqueta: 'Azitromicina 500 mg', valor: '1 comprimido · cada 24 horas · del 24/10/2026 al 26/10/2026' },
        { etiqueta: 'Ibuprofeno 400 mg', valor: '1 comprimido · cada 8 horas · del 24/10/2026 al 28/10/2026' },
      ],
    },
    {
      titulo: 'Observaciones',
      datos: [
        { etiqueta: 'Temperatura axilar', valor: '38,4 °C' },
        { etiqueta: 'Presión arterial', valor: '118/76 mmHg' },
        { etiqueta: 'Frecuencia cardíaca', valor: '92 lpm' },
        { etiqueta: 'Saturación de oxígeno', valor: '97 %' },
        { etiqueta: 'Examen de orofaringe', valor: 'Amígdalas hipertróficas con exudado blanquecino bilateral; adenopatías cervicales dolorosas.' },
      ],
    },
  ],
  formularios: [
    {
      id: '00000000-0000-4000-8000-000000000401',
      titulo: 'Tamizaje de síntomas respiratorios',
      completadoEl: day(10, 24, 9, 35),
      respuestas: [
        { etiqueta: 'Tos', texto: 'No', masked: false },
        { etiqueta: 'Contacto con casos confirmados', texto: 'No refiere', masked: false },
        { etiqueta: 'Vacunación antigripal 2026', texto: 'Sí, en abril', masked: false },
      ],
    },
  ],
};

const ORDEN: DocumentoDeOrden = {
  id: '00000000-0000-4000-8000-000000000501',
  paciente: PACIENTE,
  profesional: PROFESIONAL,
  organizacion: ORGANIZACION,
  estudio: 'Perfil lipídico completo (colesterol total, HDL, LDL y triglicéridos) y glucosa en ayunas',
  categoria: 'Laboratorio',
  estado: 'Activa',
  pedidaEl: SAMPLE_DATE,
  preparacion:
    'Ayuno de 12 horas: puede beber solo agua. No consuma alcohol las 72 horas previas ni realice actividad física intensa el día anterior. Presente esta orden y su documento de identidad en ventanilla, de 07:00 a 10:00.',
};

const FORMULARIO: DocumentoDeFormulario = {
  id: '00000000-0000-4000-8000-000000000601',
  paciente: PACIENTE,
  profesional: PROFESIONAL,
  organizacion: ORGANIZACION,
  titulo: 'Valoración de riesgo cardiovascular',
  completadoEl: day(10, 21, 11, 15),
  respuestas: [
    { etiqueta: 'Antecedentes familiares de enfermedad coronaria', texto: 'Padre con infarto agudo de miocardio a los 58 años.', masked: false },
    { etiqueta: 'Tabaquismo', texto: 'Exfumadora desde 2021 (10 paquetes-año).', masked: false },
    { etiqueta: 'Actividad física semanal', texto: 'Caminata de 30 minutos, tres veces por semana.', masked: false },
    { etiqueta: 'Presión arterial habitual', texto: '125/80 mmHg en controles domiciliarios.', masked: false },
    { etiqueta: 'Serología para VIH', texto: '', masked: true },
    { etiqueta: 'Índice de masa corporal', texto: '27,4 kg/m²', masked: false },
    {
      etiqueta: 'Observaciones del profesional',
      texto:
        'Riesgo cardiovascular a 10 años estimado como moderado. Se recomienda control de perfil lipídico, reducción de sal en la dieta y aumento progresivo de la actividad física hasta 150 minutos semanales.',
      masked: false,
    },
  ],
};

/* ---- la historia larga: seis atenciones de 2026 ---------------------------- */

const LOSARTAN = { etiqueta: 'Losartán 50 mg', valor: '1 comprimido · cada 24 horas · desde el 02/03/2026' };
const HTA = { etiqueta: 'Hipertensión arterial esencial', valor: 'Activo' };

/** Una atención de la historia, con sus tres bloques como los arma `historiaDesdeFuentes`. */
const atencion = (
  inicio: Date,
  motivo: string,
  diagnosticos: readonly DocumentoDato[],
  medicacion: readonly DocumentoDato[],
  observaciones: readonly DocumentoDato[],
): HistoriaAtencion => {
  const bloques: DocumentoBloque[] = [
    { titulo: 'Diagnósticos', datos: diagnosticos },
    { titulo: 'Medicación indicada', datos: medicacion },
    { titulo: 'Observaciones', datos: observaciones },
  ];
  const fecha = `${String(inicio.getDate()).padStart(2, '0')}/${String(inicio.getMonth() + 1).padStart(2, '0')}/2026`;
  return { titulo: `Atención del ${fecha}`, inicio, motivo, bloques };
};

const ATENCIONES: readonly HistoriaAtencion[] = [
  // En el orden en que las devuelve la API: el papel las ordena por fecha.
  atencion(day(3, 2), 'Cefalea y control de presión', [HTA], [LOSARTAN], [
    { etiqueta: 'Presión arterial', valor: '148/94 mmHg' },
    { etiqueta: 'Peso corporal', valor: '71,8 kg' },
  ]),
  atencion(day(6, 3), 'Tos y dificultad respiratoria', [{ etiqueta: 'Bronquitis aguda', valor: 'Activo' }], [
    LOSARTAN,
    { etiqueta: 'Salbutamol 100 mcg inhalador', valor: '2 inhalaciones · cada 6 horas · del 03/06/2026 al 10/06/2026' },
  ], [
    { etiqueta: 'Temperatura axilar', valor: '37,6 °C' },
    { etiqueta: 'Saturación de oxígeno', valor: '95 %' },
  ]),
  atencion(day(8, 12), 'Control de laboratorio', [], [LOSARTAN], [{ etiqueta: 'Presión arterial', valor: '126/81 mmHg' }]),
  atencion(day(9, 9), 'Dolor de garganta y fiebre', [{ etiqueta: 'Faringoamigdalitis aguda', valor: 'Activo' }], [
    LOSARTAN,
    { etiqueta: 'Azitromicina 500 mg', valor: '1 comprimido · cada 24 horas · del 09/09/2026 al 11/09/2026' },
    { etiqueta: 'Ibuprofeno 400 mg', valor: '1 comprimido · cada 8 horas · del 09/09/2026 al 13/09/2026' },
  ], [
    { etiqueta: 'Temperatura axilar', valor: '38,4 °C' },
    { etiqueta: 'Frecuencia cardíaca', valor: '92 lpm' },
  ]),
  atencion(day(10, 6), 'Control de presión arterial', [HTA], [LOSARTAN], [
    { etiqueta: 'Presión arterial', valor: '128/82 mmHg' },
    { etiqueta: 'Peso corporal', valor: '70,6 kg' },
  ]),
  atencion(day(10, 21), 'Control anual de salud', [HTA, { etiqueta: 'Sobrepeso', valor: 'Crónico, en seguimiento' }], [LOSARTAN], [
    { etiqueta: 'Presión arterial', valor: '124/80 mmHg' },
    { etiqueta: 'Peso corporal', valor: '70,2 kg' },
    { etiqueta: 'Índice de masa corporal', valor: '27,4 kg/m²' },
  ]),
];

const receta = (
  id: number,
  creadaEl: Date,
  medicamentos: readonly DocumentoMedicamento[],
  indicaciones?: string,
): DocumentoDeReceta => ({
  id: `00000000-0000-4000-8000-0000000007${String(id).padStart(2, '0')}`,
  paciente: PACIENTE,
  profesional: PROFESIONAL,
  creadaEl,
  emitidaEl: new Date(creadaEl.getTime() + 15 * 60_000),
  medicamentos,
  ...(indicaciones === undefined ? {} : { indicaciones }),
});

const RECETAS: readonly DocumentoDeReceta[] = [
  receta(1, day(3, 2, 10), [{ medicamento: 'Losartán 50 mg', dosis: '1 comprimido', frecuencia: 'cada 24 horas', vigencia: 'por 90 días', estado: 'Completada' }],
    'Tome el comprimido cada mañana, a la misma hora. Controle su presión dos veces por semana y anote los valores.'),
  receta(2, day(6, 3, 10), [{ medicamento: 'Salbutamol 100 mcg inhalador', dosis: '2 inhalaciones', frecuencia: 'cada 6 horas', vigencia: 'por 7 días', estado: 'Completada' }],
    'Agite el inhalador antes de cada uso y enjuáguese la boca después de usarlo.'),
  receta(3, day(9, 9, 10), [
    { medicamento: 'Azitromicina 500 mg', dosis: '1 comprimido', frecuencia: 'cada 24 horas', vigencia: 'por 3 días', estado: 'Completada' },
    { medicamento: 'Ibuprofeno 400 mg', dosis: '1 comprimido', frecuencia: 'cada 8 horas', vigencia: 'por 5 días', estado: 'Completada' },
  ], 'Tome la azitromicina a la misma hora cada día, aunque se sienta mejor. Tome el ibuprofeno con alimentos.'),
  receta(4, day(6, 3, 10, 30), [{ medicamento: 'Losartán 50 mg', dosis: '1 comprimido', frecuencia: 'cada 24 horas', vigencia: 'por 90 días', estado: 'Completada' }]),
  receta(5, day(10, 21, 10), [{ medicamento: 'Losartán 50 mg', dosis: '1 comprimido', frecuencia: 'cada 24 horas', vigencia: 'por 90 días', estado: 'Activa' }],
    'Continúe con el comprimido cada mañana. Reduzca la sal en las comidas y traiga su registro de presión al próximo control.'),
];

const orden = (id: number, estudio: string, categoria: string, estado: string, pedidaEl: Date): DocumentoDeOrden => ({
  ...ORDEN,
  id: `00000000-0000-4000-8000-0000000005${String(id).padStart(2, '0')}`,
  estudio,
  categoria,
  estado,
  pedidaEl,
});

const HISTORIA: DocumentoDeHistoria = {
  paciente: PACIENTE,
  edad: '41 años',
  organizacion: ORGANIZACION,
  alergias: ['Penicilina (reacción cutánea, 2019)', 'Látex (dermatitis de contacto)'],
  atenciones: ATENCIONES,
  recetas: RECETAS,
  formularios: [
    FORMULARIO,
    {
      id: '00000000-0000-4000-8000-000000000602',
      titulo: 'Cuestionario de calidad del sueño',
      respuestas: [
        { etiqueta: 'Horas de sueño por noche', texto: 'Entre 5 y 6 horas', masked: false },
        { etiqueta: 'Despertares nocturnos', texto: 'Dos o tres por noche', masked: false },
        { etiqueta: 'Somnolencia diurna', texto: 'Moderada, sobre todo después del almuerzo', masked: false },
      ],
    },
  ],
  ordenes: [
    orden(1, 'Electrocardiograma de reposo de 12 derivaciones', 'Cardiología', 'Completada', day(3, 2, 10)),
    orden(2, 'Radiografía de tórax, proyección posteroanterior', 'Imagenología', 'Completada', day(6, 3, 10)),
    orden(3, 'Hemograma completo', 'Laboratorio', 'Completada', day(8, 12, 9, 30)),
    orden(4, 'Perfil lipídico completo y glucosa en ayunas', 'Laboratorio', 'Activa', day(10, 21, 10, 10)),
  ],
  resultados: [
    { titulo: 'Hemograma completo', datos: [{ etiqueta: 'Liberado', valor: '14/08/2026' }, { etiqueta: 'Conclusión', valor: 'Serie roja, blanca y plaquetaria dentro de los rangos de referencia.' }] },
    { titulo: 'Radiografía de tórax', datos: [{ etiqueta: 'Liberado', valor: '05/06/2026' }, { etiqueta: 'Conclusión', valor: 'Campos pulmonares sin infiltrados ni derrames. Silueta cardíaca de tamaño normal. Senos costofrénicos libres.' }] },
    { titulo: 'Electrocardiograma de reposo', datos: [{ etiqueta: 'Liberado', valor: '03/03/2026' }, { etiqueta: 'Conclusión', valor: 'Ritmo sinusal, 72 lpm. Sin alteraciones de la repolarización.' }] },
  ],
};

/** Como las arma `seccionesNuevasDeLaHistoria`: de la atención más reciente a la más vieja. */
const NUEVAS: HistoryNewSections = {
  diagnosticos: {
    enEstudio: [{ nombre: 'Dislipidemia mixta', certeza: 'Provisional', detalle: 'pendiente de perfil lipídico' }],
    activas: [
      { nombre: 'Hipertensión arterial esencial', certeza: 'Confirmado', detalle: 'crónica, desde el 02/03/2026' },
      { nombre: 'Sobrepeso', certeza: 'Confirmado', detalle: null },
    ],
    historicos: [
      { nombre: 'Faringoamigdalitis aguda', certeza: 'Confirmado', detalle: 'resuelto el 16/09/2026' },
      { nombre: 'Bronquitis aguda', certeza: 'Confirmado', detalle: 'resuelto el 12/06/2026' },
      { nombre: 'Neumonía adquirida en la comunidad', certeza: 'Descartado', detalle: 'descartado el 05/06/2026' },
    ],
  },
  lineas: [
    {
      titulo: 'Control anual de salud · 21/10/2026',
      sello: 'Cerrada',
      hechos: [
        { titulo: 'Diagnóstico en estudio: Dislipidemia mixta', detalle: null, cuando: '21/10/2026' },
        { titulo: 'Análisis de laboratorio: Perfil lipídico completo', detalle: 'pendiente', cuando: '21/10/2026' },
        { titulo: 'Receta: Losartán 50 mg', detalle: 'por Hipertensión arterial esencial', cuando: '21/10/2026' },
      ],
    },
    {
      titulo: 'Control de presión arterial · 06/10/2026',
      sello: 'Cerrada',
      hechos: [{ titulo: 'Nota de evolución', detalle: null, cuando: '06/10/2026' }],
    },
    {
      titulo: 'Dolor de garganta y fiebre · 09/09/2026',
      sello: 'Cerrada',
      hechos: [
        { titulo: 'Diagnóstico confirmado: Faringoamigdalitis aguda', detalle: null, cuando: '09/09/2026' },
        { titulo: 'Receta: Azitromicina 500 mg', detalle: 'por Faringoamigdalitis aguda', cuando: '09/09/2026' },
        { titulo: 'Receta: Ibuprofeno 400 mg', detalle: 'por Faringoamigdalitis aguda', cuando: '09/09/2026' },
      ],
    },
    {
      titulo: 'Control de laboratorio · 12/08/2026',
      sello: 'Cerrada',
      hechos: [{ titulo: 'Análisis de laboratorio: Hemograma completo', detalle: 'resultado disponible', cuando: '12/08/2026' }],
    },
    {
      titulo: 'Tos y dificultad respiratoria · 03/06/2026',
      sello: 'Cerrada',
      hechos: [
        { titulo: 'Diagnóstico confirmado: Bronquitis aguda', detalle: null, cuando: '03/06/2026' },
        { titulo: 'Diagnóstico descartado: Neumonía adquirida en la comunidad', detalle: null, cuando: '05/06/2026' },
        { titulo: 'Imagenología: Radiografía de tórax', detalle: 'resultado disponible', cuando: '03/06/2026' },
        { titulo: 'Receta: Salbutamol 100 mcg inhalador', detalle: 'por Bronquitis aguda', cuando: '03/06/2026' },
      ],
    },
    {
      titulo: 'Cefalea y control de presión · 02/03/2026',
      sello: 'Cerrada',
      hechos: [
        { titulo: 'Diagnóstico confirmado: Hipertensión arterial esencial', detalle: null, cuando: '02/03/2026' },
        { titulo: 'Cardiología: Electrocardiograma de reposo', detalle: 'resultado disponible', cuando: '02/03/2026' },
        { titulo: 'Receta: Losartán 50 mg', detalle: 'por Hipertensión arterial esencial', cuando: '02/03/2026' },
      ],
    },
  ],
};

test('muestras de los documentos clínicos', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  loadBrandFonts();
  useSampleSignature();
  establecerLogoDeDocumentos(fixtureImage('practice-logo.png'));

  try {
    const { emitidaEl: _emitida, firmadaEl: _firmada, ...borrador } = RECETA;
    console.log(savePdf(buildPrescriptionPdf(RECETA), 'clinical-prescription.pdf'));
    console.log(savePdf(buildPrescriptionPdf(borrador), 'clinical-prescription-draft.pdf'));
    console.log(savePdf(buildVisitPdf(ATENCION), 'clinical-visit.pdf'));
    console.log(savePdf(buildOrderPdf(ORDEN), 'clinical-order.pdf'));
    console.log(savePdf(buildFormResponsePdf(FORMULARIO), 'clinical-form-response.pdf'));
    console.log(savePdf(buildHistoryWithEncountersPdf(HISTORIA, NUEVAS), 'clinical-history.pdf'));
  } finally {
    establecerLogoDeDocumentos(null);
    vi.useRealTimers();
  }
});
