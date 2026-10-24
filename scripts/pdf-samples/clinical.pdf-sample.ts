import { test } from 'vitest';

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
  DocumentoPaciente,
  DocumentoProfesional,
  HistoriaAtencion,
} from '../../src/app/shared/utils/clinical-pdf/clinical-pdf.types';
import {
  buildHistoriaConEncuentrosPdf,
  type SeccionesNuevasDeLaHistoria,
} from '../../src/app/shared/utils/clinical-pdf/historia-con-encuentros';
import { establecerLogoDeDocumentos } from '../../src/app/shared/utils/pdf-export/pdf-logo';
import { fixtureImage, loadBrandFonts, SAMPLE_DATE, SAMPLE_SIGNATURE, savePdf, useSampleSignature } from './sample-setup';

/**
 * Las muestras de los documentos clínicos: una receta emitida de una hoja, la
 * misma sin emitir (copia de trabajo), la historia de una atención, una orden
 * de laboratorio, un formulario respondido con un valor protegido y la
 * historia clínica completa, de varias hojas. Todos los datos son ficticios.
 *
 * Se cargan la firma y el logo de muestra, como los deja la sesión de un
 * profesional: la historia completa los tiene que rechazar (`firma: null`).
 */

const PACIENTE: DocumentoPaciente = { nombre: 'Valeria Andrea Choque Mamani', documento: 'CI 0000000 LP' };
const PROFESIONAL: DocumentoProfesional = {
  nombre: SAMPLE_SIGNATURE.nombre,
  matricula: SAMPLE_SIGNATURE.matricula ?? undefined,
};
const ORGANIZACION = 'Consultorio Illimani';

const day = (month: number, date: number, hours = 9, minutes = 0): Date =>
  new Date(2026, month - 1, date, hours, minutes);

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
    { medicamento: 'Azitromicina 500 mg comprimidos', dosis: '1 comprimido', frecuencia: 'cada 24 horas', vigencia: 'por 3 días' },
    { medicamento: 'Ibuprofeno 400 mg comprimidos', dosis: '1 comprimido', frecuencia: 'cada 8 horas', vigencia: 'por 5 días, solo si hay dolor' },
  ],
  indicaciones:
    'Tome la azitromicina a la misma hora cada día, aunque se sienta mejor. Tome el ibuprofeno con alimentos.\nConsulte de inmediato si aparece dificultad para respirar, fiebre de más de 39 °C o erupción en la piel.',
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
        { etiqueta: 'Faringoamigdalitis aguda bacteriana', valor: 'Activo' },
        { etiqueta: 'Rinitis alérgica', valor: 'Crónico, en seguimiento' },
      ],
    },
    {
      titulo: 'Medicación indicada',
      datos: [
        { etiqueta: 'Azitromicina 500 mg', valor: '1 comprimido · cada 24 horas · del 24 oct 2026 al 26 oct 2026' },
        { etiqueta: 'Ibuprofeno 400 mg', valor: '1 comprimido · cada 8 horas · del 24 oct 2026 al 28 oct 2026' },
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
  titulo: 'Valoración de riesgo cardiovascular',
  completadoEl: day(10, 22, 11, 15),
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

/* ---- la historia larga ----------------------------------------------------- */

const MOTIVOS = [
  'Control de presión arterial',
  'Dolor de garganta y fiebre',
  'Control de laboratorio',
  'Cefalea tensional',
  'Dolor lumbar mecánico',
  'Control anual de salud',
];

const atencionDeLaHistoria = (index: number): HistoriaAtencion => {
  const date = day(10 - index, 6 + index * 3);
  const label = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/2026`;
  const bloques: DocumentoBloque[] = [
    {
      titulo: 'Diagnósticos',
      datos:
        index % 3 === 2
          ? []
          : [
              { etiqueta: MOTIVOS[index] === 'Dolor de garganta y fiebre' ? 'Faringoamigdalitis aguda' : 'Hipertensión arterial esencial', valor: 'Activo' },
              ...(index % 2 === 0 ? [{ etiqueta: 'Sobrepeso', valor: 'Crónico, en seguimiento' }] : []),
            ],
    },
    {
      titulo: 'Medicación indicada',
      datos: [
        { etiqueta: 'Losartán 50 mg', valor: '1 comprimido · cada 24 horas · desde el 2 mar 2026' },
        { etiqueta: 'Paracetamol 500 mg', valor: '1 comprimido · cada 8 horas · solo si hay dolor' },
      ],
    },
    {
      titulo: 'Observaciones',
      datos: [
        { etiqueta: 'Presión arterial', valor: `${128 - index * 2}/${82 - index} mmHg` },
        { etiqueta: 'Peso corporal', valor: `${71 - index * 0.4} kg`.replace('.', ',') },
        { etiqueta: 'Frecuencia cardíaca', valor: `${74 + index} lpm` },
      ],
    },
  ];
  return { titulo: `${MOTIVOS[index]} · ${label}`, bloques };
};

const recetaDeLaHistoria = (index: number): DocumentoDeReceta => ({
  id: `00000000-0000-4000-8000-0000000007${String(index).padStart(2, '0')}`,
  paciente: PACIENTE,
  profesional: PROFESIONAL,
  creadaEl: day(10 - (index % 6), 6 + (index % 6) * 3, 10),
  ...(index === 7 ? {} : { emitidaEl: day(10 - (index % 6), 6 + (index % 6) * 3, 10, 15) }),
  medicamentos: [
    [
      { medicamento: 'Losartán 50 mg', dosis: '1 comprimido', frecuencia: 'cada 24 horas', vigencia: 'por 90 días', estado: 'Activa' },
    ],
    [
      { medicamento: 'Azitromicina 500 mg', dosis: '1 comprimido', frecuencia: 'cada 24 horas', vigencia: 'por 3 días', estado: 'Completada' },
      { medicamento: 'Ibuprofeno 400 mg', dosis: '1 comprimido', frecuencia: 'cada 8 horas', estado: 'Completada' },
    ],
    [{ medicamento: 'Paracetamol 500 mg', dosis: '1 comprimido', frecuencia: 'cada 8 horas', vigencia: 'por 5 días' }],
    [{ medicamento: 'Atorvastatina 20 mg', dosis: '1 comprimido', frecuencia: 'por la noche', vigencia: 'por 180 días', estado: 'Suspendida' }],
  ][index % 4],
  ...(index % 3 === 0
    ? { indicaciones: 'Tome el comprimido siempre a la misma hora. Controle su presión dos veces por semana y anote los valores.' }
    : {}),
});

const HISTORIA: DocumentoDeHistoria = {
  paciente: PACIENTE,
  edad: '41 años',
  organizacion: ORGANIZACION,
  alergias: ['Penicilina (reacción cutánea, 2019)', 'Látex (dermatitis de contacto)'],
  atenciones: Array.from({ length: 6 }, (_, index) => atencionDeLaHistoria(index)),
  recetas: Array.from({ length: 8 }, (_, index) => recetaDeLaHistoria(index)),
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
    ORDEN,
    { ...ORDEN, id: '00000000-0000-4000-8000-000000000502', estudio: 'Hemograma completo', estado: 'Completada', pedidaEl: day(8, 12) },
    { ...ORDEN, id: '00000000-0000-4000-8000-000000000503', estudio: 'Radiografía de tórax, proyección posteroanterior', categoria: 'Imagenología', estado: 'Completada', pedidaEl: day(6, 3) },
    { ...ORDEN, id: '00000000-0000-4000-8000-000000000504', estudio: 'Examen general de orina', estado: 'Cancelada', pedidaEl: day(5, 20) },
    { ...ORDEN, id: '00000000-0000-4000-8000-000000000505', estudio: 'Electrocardiograma de reposo de 12 derivaciones', categoria: 'Cardiología', estado: 'Completada', pedidaEl: day(3, 2) },
  ],
  resultados: [
    { titulo: 'Hemograma completo', datos: [{ etiqueta: 'Liberado', valor: '14/08/2026' }, { etiqueta: 'Conclusión', valor: 'Serie roja, blanca y plaquetaria dentro de los rangos de referencia.' }] },
    { titulo: 'Radiografía de tórax', datos: [{ etiqueta: 'Liberado', valor: '05/06/2026' }, { etiqueta: 'Conclusión', valor: 'Campos pulmonares sin infiltrados ni derrames. Silueta cardíaca de tamaño normal. Senos costofrénicos libres.' }] },
    { titulo: 'Electrocardiograma de reposo', datos: [{ etiqueta: 'Liberado', valor: '03/03/2026' }, { etiqueta: 'Conclusión', valor: 'Ritmo sinusal, 72 lpm. Sin alteraciones de la repolarización.' }] },
  ],
};

const NUEVAS: SeccionesNuevasDeLaHistoria = {
  diagnosticos: {
    enEstudio: [{ nombre: 'Dislipidemia mixta', certeza: 'Provisional', detalle: 'pendiente de perfil lipídico' }],
    activas: [
      { nombre: 'Hipertensión arterial esencial', certeza: 'Confirmado', detalle: 'crónica, desde marzo de 2026' },
      { nombre: 'Sobrepeso', certeza: 'Confirmado', detalle: null },
    ],
    historicos: [
      { nombre: 'Faringoamigdalitis aguda', certeza: 'Confirmado', detalle: 'resuelto el 30/09/2026' },
      { nombre: 'Neumonía adquirida en la comunidad', certeza: 'Descartado', detalle: 'descartado el 05/06/2026' },
    ],
  },
  lineas: [
    {
      titulo: 'Dolor de garganta y fiebre · 9 de septiembre de 2026',
      sello: 'Cerrada',
      hechos: [
        { titulo: 'Diagnóstico: Faringoamigdalitis aguda', detalle: 'confirmado', cuando: '9 de septiembre de 2026' },
        { titulo: 'Receta: Azitromicina 500 mg', detalle: 'por Faringoamigdalitis aguda', cuando: '9 de septiembre de 2026' },
        { titulo: 'Nota de evolución', detalle: null, cuando: '9 de septiembre de 2026' },
      ],
    },
    {
      titulo: 'Control de presión arterial · 6 de octubre de 2026',
      sello: 'Cerrada',
      hechos: [
        { titulo: 'Medición: Presión arterial', detalle: '128/82 mmHg', cuando: '6 de octubre de 2026' },
        { titulo: 'Orden: Perfil lipídico completo', detalle: 'pendiente', cuando: null },
      ],
    },
    { titulo: 'Control anual de salud · 21 de octubre de 2026', sello: 'En curso', hechos: [] },
  ],
};

test('muestras de los documentos clínicos', () => {
  loadBrandFonts();
  useSampleSignature();
  establecerLogoDeDocumentos(fixtureImage('practice-logo.png'));

  const { emitidaEl: _emitida, ...borrador } = RECETA;
  console.log(savePdf(buildPrescriptionPdf(RECETA), 'clinical-prescription.pdf'));
  console.log(savePdf(buildPrescriptionPdf(borrador), 'clinical-prescription-draft.pdf'));
  console.log(savePdf(buildVisitPdf(ATENCION), 'clinical-visit.pdf'));
  console.log(savePdf(buildOrderPdf(ORDEN), 'clinical-order.pdf'));
  console.log(savePdf(buildFormResponsePdf(FORMULARIO), 'clinical-form-response.pdf'));
  console.log(savePdf(buildHistoriaConEncuentrosPdf(HISTORIA, NUEVAS), 'clinical-history.pdf'));

  establecerLogoDeDocumentos(null);
});
