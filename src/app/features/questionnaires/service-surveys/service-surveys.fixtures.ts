/* Test data for the «Encuestas por servicio» specs. */
/* Bodies as the server sends them: dates as text, optionals null. */

export const STANDARD_CATALOG = {
  items: [
    {
      code: 'STD_PROCEDURE_V1',
      title: 'Procedimientos y estudios',
      description: 'Para procedimientos.',
      serviceKinds: ['PROCEDURE'],
      source: { instrument: 'CG-CAHPS 4.0', license: 'Dominio público (AHRQ)', url: 'https://example.org/cahps' },
      questions: [
        { text: '¿Le explicaron el procedimiento?', answerType: 'BOOLEAN', required: false, dimension: 'claridad_explicacion' },
        { text: '¿Lo recomendaría?', answerType: 'SCALE', required: false, scaleMin: 0, scaleMax: 10, dimension: 'recomendacion' },
      ],
    },
    {
      code: 'STD_IMAGING_V1',
      title: 'Estudios por imágenes',
      description: 'Para ecografías.',
      serviceKinds: ['IMAGING'],
      source: { instrument: 'CG-CAHPS 4.0', license: 'Dominio público (AHRQ)' },
      additionalSources: [{ instrument: 'PSQ-18', license: 'Uso libre (RAND)' }],
      questions: [{ text: '¿Se respetó su privacidad?', answerType: 'SCALE', required: false, scaleMin: 1, scaleMax: 5 }],
    },
  ],
};

export const SERVICE_ASSIGNMENTS = {
  consultation: {
    system: true,
    title: 'Cita médica',
    templateTitle: 'Encuesta de su consulta médica',
    questionCount: 12,
    replaceable: false,
  },
  services: [
    { serviceId: 'svc-eco', serviceName: 'Ecocardiograma Doppler', assignment: null },
    {
      serviceId: 'svc-ecg',
      serviceName: 'Electrocardiograma',
      assignment: {
        assignmentId: 'a-1',
        catalogCode: 'STD_PROCEDURE_V1',
        title: 'Procedimientos y estudios',
        templateId: 't-1',
        versionId: 'v-1',
        assignedAt: '2026-11-01T10:00:00.000Z',
      },
    },
  ],
};
