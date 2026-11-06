import type { SimulatedNoteRow } from './clinic';

/**
 * Las filas que una médica anota en una consulta, campo por campo. Cinco
 * juegos realistas de cuatro a siete filas: la semilla elige uno por paciente
 * y por visita, así dos notas de la misma persona nunca dicen lo mismo.
 */
export const NOTE_ROWS: readonly (readonly SimulatedNoteRow[])[] = [
  [
    { label: 'Presión arterial', value: '120/80 mmHg' },
    { label: 'Frecuencia cardíaca', value: '72 lpm' },
    { label: 'Peso', value: '68 kg' },
    { label: 'Exploración', value: 'Abdomen blando, depresible, no doloroso' },
    { label: 'Conducta', value: 'Continuar tratamiento. Control en 3 meses con laboratorio.' },
  ],
  [
    { label: 'Dolor', value: 'Región lumbar, 6/10' },
    { label: 'Duración', value: '3 días' },
    { label: 'Irradiación', value: 'No' },
    { label: 'Desencadenante', value: 'Esfuerzo al levantar peso' },
    { label: 'Exploración', value: 'Contractura paravertebral, Lasègue negativo' },
    { label: 'Conducta', value: 'Reposo relativo, analgesia, control en 7 días' },
  ],
  [
    { label: 'Motivo', value: 'Cansancio y dolor de cabeza' },
    { label: 'Tiempo de evolución', value: '2 semanas' },
    { label: 'Presión arterial', value: '134/88 mmHg' },
    { label: 'Temperatura', value: '36,6 °C' },
    { label: 'Impresión', value: 'Cefalea tensional probable. Descartar anemia.' },
    { label: 'Estudios pedidos', value: 'Hemograma, perfil tiroideo' },
    { label: 'Conducta', value: 'Paracetamol a demanda. Control en 2 semanas.' },
  ],
  [
    { label: 'Glucemia en ayunas', value: '112 mg/dL' },
    { label: 'Hemoglobina glicosilada', value: '6,8 %' },
    { label: 'Peso', value: '81 kg' },
    { label: 'Adherencia', value: 'Buena, sin olvidos' },
  ],
  [
    { label: 'Tos', value: 'Seca, de predominio nocturno' },
    { label: 'Duración', value: '5 días' },
    { label: 'Fiebre', value: 'No' },
    { label: 'Saturación', value: '97 %' },
    { label: 'Auscultación', value: 'Murmullo vesicular conservado, sin ruidos agregados' },
    { label: 'Conducta', value: 'Antitusivo, hidratación, control si empeora' },
  ],
];
