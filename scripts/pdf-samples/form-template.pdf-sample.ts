import { afterEach, beforeEach, test, vi } from 'vitest';

import type { PaginaDeFormulario } from '../../src/app/shared/forms/paginated/paginated-form.types';
import {
  buildFormTemplatePdf,
  type FormularioParaPdf,
} from '../../src/app/shared/utils/form-template-pdf/form-template-pdf';
import { loadBrandFonts, savePdf, useSampleSignature } from './sample-setup';

/**
 * Las muestras del formulario en blanco: uno corto, que entra en una hoja, y
 * uno largo de cuatro páginas del motor con todos los tipos de pregunta que el
 * papel sabe imprimir. Todos los datos son ficticios.
 *
 * La firma de muestra se carga a propósito: el formulario en blanco tiene que
 * salir **sin** ella aunque la sesión tenga una.
 */

const si = (value: string, label = value) => ({ value, label });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 24, 18, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

test('formulario en blanco de una hoja', () => {
  loadBrandFonts();
  useSampleSignature();
  const pagina: PaginaDeFormulario = {
    titulo: 'Tamizaje de riesgo cardiovascular',
    campos: [
      { key: 'fuma', label: '¿Fuma actualmente?', control: 'yes-no', required: true },
      {
        key: 'actividad',
        label: 'Actividad física semanal',
        control: 'radio',
        required: true,
        options: [si('nada', 'Ninguna'), si('poca', 'Menos de 150 min'), si('ok', '150 min o más')],
      },
      { key: 'hta', label: '¿Le diagnosticaron presión alta?', control: 'yes-no' },
      {
        key: 'medicacion',
        label: 'Medicación que toma habitualmente',
        control: 'textarea',
      },
    ],
  };
  const datos: FormularioParaPdf = {
    nombre: 'Tamizaje cardiovascular breve',
    codigo: 'CARDIO_TAMIZAJE',
    version: 2,
    especialidad: 'Cardiología',
    paginas: [pagina],
    camposEstandar: 3,
    camposPropios: 1,
    procedencia: null,
    profesional: 'Dra. Lucía Fernández Rojas',
  };
  console.log(savePdf(buildFormTemplatePdf(datos), 'form-template-short.pdf'));
});

test('formulario en blanco de varias hojas, con todos los tipos de pregunta', () => {
  loadBrandFonts();
  useSampleSignature();
  const paginas: PaginaDeFormulario[] = [
    {
      titulo: 'Datos generales (1 de 2)',
      hint: 'Complete con los datos de la persona evaluada.',
      campos: [
        { key: 'nombre', label: 'Nombre completo', control: 'text', required: true },
        { key: 'nacimiento', label: 'Fecha de nacimiento', control: 'date', required: true },
        { key: 'telefono', label: 'Teléfono de contacto', control: 'tel' },
        { key: 'correo', label: 'Correo electrónico', control: 'email', hint: 'Solo si desea recibir los resultados por correo.' },
      ],
    },
    {
      titulo: 'Datos generales (2 de 2)',
      campos: [
        { key: 'peso', label: 'Peso actual en kilogramos', control: 'number' },
        { key: 'ultima', label: 'Fecha y hora de la última ingesta', control: 'datetime' },
        {
          key: 'cobertura',
          label: 'Cobertura de salud',
          control: 'select',
          options: [
            si('particular', 'Particular'),
            si('cns', 'Caja Nacional de Salud'),
            si('cps', 'Caja Petrolera de Salud'),
            si('seguro', 'Seguro privado'),
            si('sus', 'Sistema Único de Salud'),
          ],
        },
        { key: 'consentimiento', label: 'Acepta ser contactado para control', control: 'switch' },
      ],
    },
    {
      titulo: 'Antecedentes',
      hint: 'Marque lo que corresponda. Si duda, consulte con su médico.',
      campos: [
        { key: 'alergias', label: '¿Tiene alergias a medicamentos?', control: 'yes-no', required: true },
        {
          key: 'cuales',
          label: '¿A cuáles?',
          control: 'textarea',
          showWhen: { key: 'alergias', equals: true },
        },
        {
          key: 'patologias',
          label: 'Antecedentes patológicos',
          control: 'checkboxes',
          otro: true,
          options: [
            si('hta', 'Hipertensión arterial'),
            si('dm', 'Diabetes mellitus'),
            si('asma', 'Asma o enfermedad pulmonar crónica'),
            si('renal', 'Enfermedad renal crónica'),
            si('tiroides', 'Enfermedad de la tiroides'),
          ],
        },
        { key: 'embarazo', label: 'Embarazo en curso', control: 'checkbox', description: 'Solo para personas que pueden gestar.' },
      ],
    },
    {
      titulo: 'Síntomas y prioridades',
      campos: [
        {
          key: 'frecuencia',
          label: '¿Con qué frecuencia presentó estos síntomas en el último mes?',
          control: 'grid-radio',
          required: true,
          rows: [
            si('cefalea', 'Dolor de cabeza'),
            si('mareo', 'Mareos al ponerse de pie'),
            si('disnea', 'Falta de aire al subir escaleras'),
            si('palpitaciones', 'Palpitaciones'),
            si('edema', 'Hinchazón de tobillos'),
          ],
          options: [si('nunca', 'Nunca'), si('aveces', 'A veces'), si('frecuente', 'Frecuente'), si('siempre', 'Siempre')],
        },
        {
          key: 'orden',
          label: 'Ordene sus prioridades para el tratamiento',
          control: 'grid-radio',
          oneResponsePerColumn: true,
          rows: [si('dolor', 'Aliviar el dolor'), si('sueno', 'Dormir mejor'), si('energia', 'Recuperar energía')],
          options: [si('1', 'Primera'), si('2', 'Segunda'), si('3', 'Tercera')],
        },
        { key: 'odontograma', label: 'Odontograma', control: 'custom' },
        { key: 'comentarios', label: 'Comentarios para el profesional', control: 'textarea' },
      ],
    },
  ];
  const datos: FormularioParaPdf = {
    nombre: 'Valoración preoperatoria integral',
    codigo: 'PREOP_INTEGRAL',
    version: 5,
    especialidad: 'Anestesiología',
    paginas,
    camposEstandar: 12,
    camposPropios: 4,
    procedencia: {
      titulo: 'Ficha de valoración preoperatoria de muestra',
      organizacion: 'Organismo ficticio de estandarización',
      licencia: 'Licencia de muestra, sin derechos reales',
    },
    profesional: 'Dra. Lucía Fernández Rojas',
  };
  console.log(savePdf(buildFormTemplatePdf(datos), 'form-template-long.pdf'));
});
