import { test } from 'vitest';

import {
  buildBlocksPdf,
  campoDeBloque,
  fieldsBlock,
  listBlock,
  noteBlock,
  panelsBlock,
  totalsBlock,
  type PdfBlock,
} from '../../src/app/shared/utils/pdf-export/pdf-export';
import { qrBlock } from '../../src/app/shared/utils/pdf-export/pdf-qr';
import { fixtureImage, loadBrandFonts, SAMPLE_DATE, savePdf, useSampleSignature } from './sample-setup';

/**
 * La muestra del generador genérico: un documento ficticio que pasa por
 * **todos** los bloques del maquetador, con una tabla que cruza dos hojas y
 * texto largo que envuelve. Todos los datos son sintéticos.
 */
test('muestra del generador genérico', async () => {
  loadBrandFonts();
  useSampleSignature();

  const row = (cells: string[], header = false): PdfBlock => ({
    kind: 'row',
    text: cells.join('\t'),
    cells,
    ...(header ? { header: true } : {}),
  });
  const services = [
    'Consulta de medicina general',
    'Control de presión arterial y frecuencia cardíaca',
    'Electrocardiograma de reposo de 12 derivaciones con informe',
    'Hemograma completo',
    'Glucosa en ayunas',
    'Perfil lipídico (colesterol total, HDL, LDL, triglicéridos)',
    'Curación simple',
    'Aplicación de inyectable intramuscular',
  ];
  const bolivianos = (amount: number): string =>
    `${amount < 0 ? '−' : ''}${Math.abs(amount).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
  const lines = Array.from({ length: 34 }, (_, i) => ({
    service: services[i % services.length],
    unit: 45 + ((i * 37) % 180),
    qty: 1 + (i % 3),
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.unit * line.qty, 0);
  const discount = Math.round(subtotal * 0.05);
  const qr = await qrBlock(
    'https://simulado.invalid/verificar?documento=MUESTRA-000123',
    'Escanee el código para verificar la autenticidad del documento. Este enlace es de muestra y no resuelve.',
    'Verificación del documento',
  );

  const blocks: PdfBlock[] = [
    panelsBlock([
      {
        title: 'Paciente',
        fields: [
          { label: 'Nombre', value: 'María Fernanda Quispe Mamani' },
          { label: 'Documento', value: 'CI 0000000 LP' },
          { label: 'Fecha de nacimiento', value: '14/03/1987 (39 años)' },
        ],
      },
      {
        title: 'Profesional',
        fields: [
          { label: 'Nombre', value: 'Dra. Lucía Fernández Rojas' },
          { label: 'Especialidad', value: 'Medicina interna' },
          { label: 'Matrícula', value: 'MP-4521' },
        ],
      },
    ]),
    { kind: 'heading', level: 2, text: 'Datos de la atención' },
    fieldsBlock([
      { label: 'Fecha de la cita', value: '22/10/2026, 09:15' },
      { label: 'Modalidad', value: 'Presencial' },
      { label: 'Sede', value: 'Consultorio Illimani · Sopocachi' },
      { label: 'Cobertura', value: 'Particular' },
      { label: 'Estado', value: 'Atendida' },
      { label: 'Código de atención', value: 'AT-2026-004812' },
      {
        label: 'Motivo de consulta',
        value:
          'Cefalea tensional de dos semanas de evolución, de predominio vespertino, que cede parcialmente con analgésicos comunes y se acompaña de alteraciones del sueño.',
      },
    ]),
    { kind: 'heading', level: 2, text: 'Lista de datos' },
    campoDeBloque('Diagnóstico principal', 'Cefalea de tipo tensional (G44.2)'),
    campoDeBloque('Diagnóstico secundario', 'Trastorno de ansiedad generalizada, en seguimiento'),
    campoDeBloque(
      'Plan',
      'Control en 30 días con registro diario de episodios, intensidad y desencadenantes. Derivación a psicología para manejo de estrés.',
    ),
    { kind: 'heading', level: 2, text: 'Texto corrido' },
    {
      kind: 'paragraph',
      text: 'La paciente acude a control por cefalea tensional de dos semanas de evolución, de predominio vespertino, sin signos de alarma neurológica. Refiere mejoría parcial con paracetamol y empeoramiento en jornadas de trabajo prolongadas frente a pantalla. Niega fiebre, vómitos, alteraciones visuales o pérdida de fuerza. Al examen físico se encuentra lúcida, orientada, con signos vitales dentro de parámetros normales y examen neurológico sin hallazgos patológicos.',
    },
    { kind: 'heading', level: 3, text: 'Indicaciones' },
    listBlock([
      'Paracetamol 500 mg, un comprimido cada 8 horas por 5 días, solo si hay dolor.',
      'Pausas activas de 5 minutos cada hora de trabajo frente a pantalla.',
      'Higiene del sueño: horario regular, sin pantallas una hora antes de dormir.',
      'Acudir a urgencias si el dolor es súbito e intenso, o si aparece fiebre, rigidez de nuca o pérdida de fuerza.',
    ]),
    noteBlock('Alergia declarada a la penicilina y sus derivados. Verifique antes de indicar antibióticos.', 'alert', 'Alergias'),
    noteBlock('Los resultados de laboratorio se entregan en 48 horas hábiles en la misma sede.', 'info', 'Información'),
    noteBlock('Este documento no reemplaza una factura. Consérvelo como constancia de la atención.'),
    noteBlock('Su solicitud de reembolso fue aprobada el 21/10/2026.', 'success', 'Confirmación'),
    noteBlock('El estudio requiere ayuno de 8 horas. Si no puede cumplirlo, reprograme la cita.', 'warning', 'Preparación'),
    noteBlock('Aviso neutro para aclaraciones administrativas que no requieren atención especial.', 'neutral'),
    { kind: 'divider', text: '' },
    {
      kind: 'paragraph',
      text: 'Un separador marca un cambio de asunto dentro de la misma sección, sin abrir una sección nueva.',
    },
    { kind: 'heading', level: 2, text: 'Detalle de prestaciones' },
    row(['N.º', 'Descripción', 'Cantidad', 'P. unitario', 'Importe'], true),
    ...lines.map((line, i) =>
      row([String(i + 1), line.service, String(line.qty), bolivianos(line.unit), bolivianos(line.unit * line.qty)]),
    ),
    totalsBlock([
      { label: 'Subtotal', value: bolivianos(subtotal) },
      { label: 'Descuento', value: bolivianos(-discount) },
      { label: 'Total a pagar', value: bolivianos(subtotal - discount), emphasis: true },
    ]),
    { kind: 'caption', text: 'Importes en bolivianos. Descuento por convenio institucional del 5 %.' },
    { kind: 'heading', level: 2, text: 'Para completar a mano' },
    { kind: 'heading', level: 4, text: 'Observaciones del paciente' },
    { kind: 'blank', lines: 3 },
    { kind: 'heading', level: 2, text: 'Imagen y verificación' },
    { kind: 'image', text: 'Logo de muestra', image: fixtureImage('practice-logo.png') },
    { kind: 'caption', text: 'Ilustración de muestra: logotipo ficticio, sin relación con un consultorio real.' },
    ...(qr === null ? [] : [qr]),
    { kind: 'caption', text: 'Muestra del sistema de documentos de AloVida. Todos los datos son ficticios.' },
  ];

  const doc = buildBlocksPdf(blocks, {
    title: 'Documento de muestra',
    subtitle: 'Muestra del generador genérico de PDF · Todos los datos son ficticios',
    kind: 'Documento de prueba',
    reference: 'N.º 000123',
    meta: [{ label: 'Válido hasta', value: '23/11/2026' }],
    issuedAt: SAMPLE_DATE,
    issuer: {
      name: 'Consultorio Illimani',
      details: ['NIT 0000000000', 'Av. 6 de Agosto N.º 0000, La Paz', 'Tel. 2 000 0000'],
    },
    logo: fixtureImage('practice-logo.png'),
  });
  console.log(savePdf(doc, 'generic-sample.pdf'));
});

/**
 * La misma base con marca de agua en varias hojas y sobre bloques opacos (una
 * tabla con cabecera, una rejilla, la banda del total), con logo de consultorio
 * pero sin bajada, y un emisor con datos largos que llegan a la píldora del pie.
 */
test('muestra con marca de agua', () => {
  loadBrandFonts();
  const row = (cells: string[], header = false): PdfBlock => ({
    kind: 'row',
    text: cells.join('\t'),
    cells,
    ...(header ? { header: true } : {}),
  });
  const doc = buildBlocksPdf(
    [
      noteBlock(
        'Documento generado por el entorno de pruebas. No tiene validez legal ni fiscal.',
        'alert',
        'Documento sin validez',
      ),
      { kind: 'heading', level: 2, text: 'Resumen' },
      fieldsBlock(
        [
          { label: 'Solicitante', value: 'Juan Carlos Mamani Choque' },
          { label: 'Documento', value: 'CI 0000000 CB' },
          { label: 'Fecha de la solicitud', value: '20/10/2026' },
          { label: 'Ciudad', value: 'Cochabamba' },
        ],
        2,
      ),
      {
        kind: 'paragraph',
        text: 'La marca de agua va encima del contenido, con poca opacidad, en todas las hojas: ningún bloque la tapa y el texto de debajo se sigue leyendo, en pantalla y en una fotocopia en blanco y negro.',
      },
      { kind: 'heading', level: 2, text: 'Detalle' },
      row(['N.º', 'Concepto', 'Importe'], true),
      ...Array.from({ length: 48 }, (_, i) =>
        row([String(i + 1), `Cuota ${i + 1} del plan de pagos`, `${(250 + i * 5).toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs`]),
      ),
      totalsBlock([{ label: 'Total', value: '17.640,00 Bs', emphasis: true }]),
    ],
    {
      title: 'Constancia de prueba',
      kind: 'Documento simulado',
      reference: 'N.º 000045',
      watermark: 'Sin validez',
      issuedAt: SAMPLE_DATE,
      logo: fixtureImage('practice-logo.png'),
      issuer: {
        name: 'Centro Médico Integral de Especialidades Illimani S.R.L.',
        details: [
          'NIT 0000000000',
          'Calle Ficticia N.º 0000, entre Av. Primera y Av. Segunda, zona Central, Cochabamba',
          'Tel. 4 000 0000',
          'contacto@ejemplo.invalid',
        ],
      },
      firma: null,
    },
  );
  console.log(savePdf(doc, 'generic-watermark-sample.pdf'));
});
