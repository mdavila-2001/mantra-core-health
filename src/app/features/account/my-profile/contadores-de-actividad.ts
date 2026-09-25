import type { PractitionerActivity } from '../../../core/data-access/profiles/profiles.types';

/**
 * Los cuatro contadores de la pestaña «Actividad», descritos una sola vez.
 *
 * ## Por qué existen acá y no dentro de la ficha
 *
 * Los rótulos vivían escritos a mano en `practitioner-profile.ts`. Entre el
 * 21/09/2026 y el 24/09/2026 el editor también los enumeraba, en una pestaña
 * «Actividad» sin campos; el cliente pidió sacarla («es solo estadísticas») y
 * hoy la ficha es la única que los lee. La lista se queda en su archivo: es la
 * descripción de qué cuenta cada cifra, no un detalle de la ficha.
 *
 * ## Por qué ninguno es editable
 *
 * Los cuatro son **cuentas de lo que la persona ya hizo**, no datos que
 * declara. Un contador que se puede escribir a mano deja de contar: pasa a ser
 * una afirmación sin respaldo, y encima sobre actos clínicos —encuentros
 * cerrados, recetas firmadas, evoluciones asentadas—. Por eso el editor no
 * tiene pestaña «Actividad» y la ficha no ofrece el lápiz en ella. La forma de
 * cambiar un número es atender, prescribir o asentar; no corregirlo.
 */
export interface ContadorDeActividad {
  /** Identificador estable de la cifra, para `track` y para los tests. */
  readonly clave: string;
  /** Cómo se llama en pantalla. */
  readonly rotulo: string;
  /** Qué cuenta, en una línea. «275» no dice nada; «275 · recetas» sí. */
  readonly pie: string;
  /** El campo de la API del que sale el número. */
  readonly campo: keyof Pick<
    PractitionerActivity,
    'encounters' | 'medicationRequests' | 'clinicalNotes' | 'documents'
  >;
}

export const CONTADORES_DE_ACTIVIDAD: readonly ContadorDeActividad[] = [
  {
    clave: 'encuentros',
    rotulo: 'Encuentros atendidos',
    pie: 'Consultas que cerraste con una persona atendida.',
    campo: 'encounters',
  },
  {
    clave: 'recetas',
    rotulo: 'Recetas emitidas',
    pie: 'Prescripciones firmadas desde tu cuenta.',
    campo: 'medicationRequests',
  },
  {
    clave: 'notas',
    rotulo: 'Notas clínicas',
    pie: 'Evoluciones asentadas en el expediente.',
    campo: 'clinicalNotes',
  },
  {
    clave: 'documentos',
    rotulo: 'Documentos publicados',
    pie: 'Informes, certificados y adjuntos que emitiste.',
    campo: 'documents',
  },
];
