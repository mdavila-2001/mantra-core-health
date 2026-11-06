/* ============================================================================
    A demonstration story for the clinical network.

    Used by this folder's tests and by the component stock scenario
    (`/design-system/stock`, mocked backend only). No product screen imports
    it: the nodes come from the real chart, and this stays for tests only. The
    same facts as the API sends them, for the alerts, live in
    `red-clinica.demo-alertas.ts`.

    The story: a person consults for headache; tension headache and
    hypertension are considered; a blood pressure monitoring confirms the
    second and rules out the first; enalapril is prescribed, and the person is
    referred to cardiology (which receives them but returns no
    counter-referral and orders an echocardiogram still without a result) and
    to nutrition (which did not answer).
    ========================================================================== */

import type { NodoDeRed } from './red-clinica.types';
import type { AristaDeRed } from './red-clinica-vinculos.types';

export const AHORA_DEMO = new Date(2026, 10, 6, 12, 0);

/** A 2026 date: month (1-12), day and hour. */
export const d = (mes: number, dia: number, hora = 9) => new Date(2026, mes - 1, dia, hora, 0);

const rojas = { id: 'pro-rojas', nombre: 'Dra. Ana Rojas' };
const mendez = { id: 'pro-mendez', nombre: 'Dr. Luis Méndez' };
const general = { id: 'esp-mg', nombre: 'Medicina general' };
const cardio = { id: 'esp-cardio', nombre: 'Cardiología' };

export const NODOS_DEMO: readonly NodoDeRed[] = [
  {
    id: 'c1',
    tipo: 'cita',
    titulo: 'Consulta de medicina general',
    subtitulo: 'Presencial · Sede Centro',
    cuando: d(8, 4, 8),
    profesional: rojas,
    especialidad: general,
    estado: { etiqueta: 'Atendida', tono: 'success' },
    detalle: { tipo: 'cita', motivo: 'Cefalea persistente', modalidad: 'Presencial', lugar: 'Sede Centro' },
  },
  {
    id: 'a1',
    tipo: 'atencion',
    titulo: 'Atención ambulatoria',
    subtitulo: 'Motivo: cefalea persistente',
    cuando: d(8, 4),
    profesional: rojas,
    especialidad: general,
    estado: { etiqueta: 'Finalizada', tono: 'success' },
    buscable: 'cefalea persistente',
    detalle: {
      tipo: 'general',
      resumen: 'Cefalea occipital de tres semanas, peor por la mañana. PA en consultorio 150/96.',
    },
  },
  {
    id: 'dx1',
    tipo: 'diagnostico',
    titulo: 'Cefalea tensional',
    cuando: d(8, 4),
    profesional: rojas,
    especialidad: general,
    estado: { etiqueta: 'Rechazado', tono: 'info' },
    detalle: {
      tipo: 'diagnostico',
      certeza: 'descartado',
      nota: 'Dolor opresivo bilateral; sin signos de alarma neurológicos.',
      decision: {
        resultado: 'descartado',
        decididoEn: d(8, 25),
        decididoPor: 'Dra. Ana Rojas',
        motivo: 'El monitoreo ambulatorio muestra hipertensión sostenida que explica la cefalea.',
        evidencia: { tipo: 'analisis', etiqueta: 'Monitoreo ambulatorio de presión (MAPA)', nodoId: 'e1' },
      },
      reemplazadoPor: { nodoId: 'dx2', etiqueta: 'Hipertensión arterial esencial' },
    },
  },
  {
    id: 'dx2',
    tipo: 'diagnostico',
    titulo: 'Hipertensión arterial esencial',
    cuando: d(8, 4),
    profesional: rojas,
    especialidad: general,
    estado: { etiqueta: 'Enfermedad activa', tono: 'success' },
    detalle: {
      tipo: 'diagnostico',
      certeza: 'confirmado',
      nota: 'PA 150/96 en consultorio, repetida 148/94. Antecedente familiar de primer grado.',
      inicio: d(8, 4),
      decision: {
        resultado: 'confirmado',
        decididoEn: d(8, 25),
        decididoPor: 'Dra. Ana Rojas',
        motivo: 'Promedio diurno 148/94 mmHg en MAPA de 24 horas.',
        evidencia: { tipo: 'analisis', etiqueta: 'Monitoreo ambulatorio de presión (MAPA)', nodoId: 'e1' },
      },
    },
  },
  {
    id: 'e1',
    tipo: 'estudio',
    titulo: 'Monitoreo ambulatorio de presión (MAPA)',
    subtitulo: 'Laboratorio Central',
    cuando: d(8, 4),
    profesional: rojas,
    especialidad: general,
    estado: { etiqueta: 'Resultado liberado', tono: 'success' },
    detalle: {
      tipo: 'estudio',
      categoria: 'Otro estudio',
      prioridad: 'Rutina',
      motivo: 'Confirmar o descartar hipertensión arterial.',
      resultado: {
        liberadoEn: d(8, 20),
        conclusion: 'Patrón hipertensivo diurno y nocturno, sin descenso nocturno fisiológico.',
        valores: [
          { nombre: 'Sistólica media diurna', valor: 148, unidad: 'mmHg', rango: { alto: 135 } },
          { nombre: 'Diastólica media diurna', valor: 94, unidad: 'mmHg', rango: { alto: 85 } },
          { nombre: 'Frecuencia cardíaca media', valor: 78, unidad: 'lpm', rango: { bajo: 60, alto: 100 } },
        ],
        archivos: [{ fileId: 'file-mapa', nombre: 'Informe MAPA.pdf' }],
        informeId: 'inf-mapa',
      },
    },
  },
  {
    id: 'e2',
    tipo: 'estudio',
    titulo: 'Perfil lipídico',
    subtitulo: 'Laboratorio Central',
    cuando: d(8, 4),
    profesional: rojas,
    especialidad: general,
    estado: { etiqueta: 'Resultado liberado', tono: 'success' },
    detalle: {
      tipo: 'estudio',
      categoria: 'Laboratorio',
      prioridad: 'Rutina',
      resultado: {
        liberadoEn: d(8, 8),
        valores: [
          { nombre: 'Colesterol total', valor: 232, unidad: 'mg/dL', rango: { alto: 200 } },
          { nombre: 'Colesterol LDL', valor: 158, unidad: 'mg/dL', rango: { alto: 130 } },
          { nombre: 'Colesterol HDL', valor: 44, unidad: 'mg/dL', rango: { bajo: 40 } },
          { nombre: 'Triglicéridos', valor: 180, unidad: 'mg/dL', rango: { alto: 150 } },
        ],
        archivos: [],
      },
    },
  },
  {
    id: 'r1',
    tipo: 'reconsulta',
    titulo: 'Reconsulta de medicina general',
    subtitulo: 'Presencial · Sede Centro',
    cuando: d(8, 25, 8),
    profesional: rojas,
    especialidad: general,
    estado: { etiqueta: 'Atendida', tono: 'success' },
    detalle: { tipo: 'reconsulta', motivo: 'Control de resultados', modalidad: 'Presencial', lugar: 'Sede Centro' },
  },
  {
    id: 'a2',
    tipo: 'atencion',
    titulo: 'Atención ambulatoria',
    subtitulo: 'Motivo: cefalea persistente',
    cuando: d(8, 25),
    profesional: rojas,
    especialidad: general,
    estado: { etiqueta: 'Finalizada', tono: 'success' },
    buscable: 'cefalea persistente',
  },
  {
    id: 'm1',
    tipo: 'medicacion',
    titulo: 'Enalapril 10 mg comprimidos',
    subtitulo: '1 comprimido cada 12 horas',
    cuando: d(8, 25),
    profesional: rojas,
    especialidad: general,
    estado: { etiqueta: 'Emitida', tono: 'success' },
  },
  {
    id: 'd1',
    tipo: 'derivacion',
    titulo: 'Derivación a Cardiología',
    subtitulo: 'Clínica Norte',
    cuando: d(8, 25),
    profesional: rojas,
    especialidad: general,
    estado: { etiqueta: 'Aceptada', tono: 'primary' },
    detalle: {
      tipo: 'derivacion',
      tipoDeDerivacion: 'Interconsulta',
      destino: 'Dr. Luis Méndez · Clínica Norte',
      motivo: 'Evaluar daño de órgano blanco en hipertensión de reciente diagnóstico.',
      resumenClinico: 'HTA confirmada por MAPA (148/94). Dislipidemia. Inicia enalapril 10 mg c/12 h.',
      respuesta: { decision: 'aceptada', en: d(8, 27) },
      llegada: { en: d(9, 2, 10), atencionNodoId: 'a3' },
      contrarreferencia: null,
    },
  },
  {
    id: 'd2',
    tipo: 'derivacion',
    titulo: 'Derivación a Nutrición',
    subtitulo: 'Centro de Nutrición Vida',
    cuando: d(10, 10),
    profesional: rojas,
    especialidad: general,
    estado: { etiqueta: 'Pendiente', tono: 'warning' },
    detalle: {
      tipo: 'derivacion',
      tipoDeDerivacion: 'Tratamiento',
      destino: 'Centro de Nutrición Vida',
      motivo: 'Plan alimentario por dislipidemia e hipertensión.',
      respuesta: null,
      llegada: null,
      contrarreferencia: null,
    },
  },
  {
    id: 'a3',
    tipo: 'atencion',
    titulo: 'Atención de cardiología',
    subtitulo: 'Clínica Norte',
    cuando: d(9, 2, 10),
    profesional: mendez,
    especialidad: cardio,
    estado: { etiqueta: 'Finalizada', tono: 'success' },
  },
  {
    id: 'e3',
    tipo: 'estudio',
    titulo: 'Ecocardiograma transtorácico',
    subtitulo: 'Clínica Norte',
    cuando: d(9, 2, 11),
    profesional: mendez,
    especialidad: cardio,
    estado: { etiqueta: 'Pedido', tono: 'warning' },
    detalle: { tipo: 'estudio', categoria: 'Imagen', prioridad: 'Rutina', resultado: null },
  },
  {
    id: 'dx3',
    tipo: 'diagnostico',
    titulo: 'Hipertrofia ventricular izquierda',
    cuando: d(9, 2, 11),
    profesional: mendez,
    especialidad: cardio,
    estado: { etiqueta: 'En estudio', tono: 'warning' },
    detalle: {
      tipo: 'diagnostico',
      certeza: 'presuntivo',
      nota: 'Índice de Sokolow-Lyon 38 mm en el ECG de la consulta.',
      decision: null,
    },
  },
];

export const ARISTAS_DEMO: readonly AristaDeRed[] = [
  { desde: 'a1', hasta: 'c1', tipo: 'registrado-en' },
  { desde: 'dx1', hasta: 'a1', tipo: 'registrado-en' },
  { desde: 'dx2', hasta: 'a1', tipo: 'registrado-en' },
  { desde: 'e1', hasta: 'a1', tipo: 'registrado-en' },
  { desde: 'e2', hasta: 'a1', tipo: 'registrado-en', inferido: true },
  { desde: 'e1', hasta: 'dx2', tipo: 'pedido-para' },
  { desde: 'e2', hasta: 'dx2', tipo: 'pedido-para' },
  { desde: 'e1', hasta: 'dx2', tipo: 'evidencia-de' },
  { desde: 'e1', hasta: 'dx1', tipo: 'evidencia-de' },
  { desde: 'dx1', hasta: 'dx2', tipo: 'reemplazado-por' },
  { desde: 'r1', hasta: 'c1', tipo: 'reconsulta-de' },
  { desde: 'a2', hasta: 'r1', tipo: 'registrado-en' },
  { desde: 'm1', hasta: 'a2', tipo: 'registrado-en' },
  { desde: 'm1', hasta: 'dx2', tipo: 'indicado-para' },
  { desde: 'd1', hasta: 'a2', tipo: 'derivada-desde' },
  { desde: 'd1', hasta: 'a3', tipo: 'recibida-en' },
  { desde: 'd2', hasta: 'a2', tipo: 'derivada-desde' },
  { desde: 'e3', hasta: 'a3', tipo: 'registrado-en' },
  { desde: 'e3', hasta: 'dx2', tipo: 'pedido-para' },
  { desde: 'dx3', hasta: 'a3', tipo: 'registrado-en' },
];
