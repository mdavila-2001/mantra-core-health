import type { PractitionerActivity } from '../../../core/data-access/profiles/profiles.types';

/**
 * Los cuatro contadores de la pestaña «Actividad», descritos una sola vez.
 *
 * ## Por qué existen acá y no dentro de la ficha
 *
 * Los rótulos vivían escritos a mano en `practitioner-profile.ts`, que es el
 * único lugar que los mostraba. Desde el 21/09/2026 hay un segundo: el editor
 * también tiene la pestaña «Actividad» —el cliente pidió que el editor tenga
 * las mismas que la ficha— y ahí se enumera **qué** se cuenta para decir que
 * nada de eso se edita. Dos listas escritas a mano se despegan en el primer
 * retoque que se haga en una sola, así que la lista es una y las dos
 * superficies la leen.
 *
 * La ficha le pone el valor; el editor no, porque no es un tablero.
 *
 * ## Por qué ninguno es editable
 *
 * Los cuatro son **cuentas de lo que la persona ya hizo**, no datos que
 * declara. Un contador que se puede escribir a mano deja de contar: pasa a ser
 * una afirmación sin respaldo, y encima sobre actos clínicos —encuentros
 * cerrados, recetas firmadas, evoluciones asentadas—. Por eso la pestaña del
 * editor los nombra uno por uno y dice de cada uno de dónde sale, en vez de
 * ofrecer un campo. La forma de cambiar un número es atender, prescribir o
 * asentar; no corregirlo.
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
  /** Qué hay que hacer para que el número cambie. Es la respuesta a «¿y esto no lo puedo corregir?». */
  readonly seMueveCon: string;
}

export const CONTADORES_DE_ACTIVIDAD: readonly ContadorDeActividad[] = [
  {
    clave: 'encuentros',
    rotulo: 'Encuentros atendidos',
    pie: 'Consultas que cerraste con una persona atendida.',
    campo: 'encounters',
    seMueveCon: 'Sube cada vez que cerrás una consulta.',
  },
  {
    clave: 'recetas',
    rotulo: 'Recetas emitidas',
    pie: 'Prescripciones firmadas desde tu cuenta.',
    campo: 'medicationRequests',
    seMueveCon: 'Sube cada vez que firmás una receta.',
  },
  {
    clave: 'notas',
    rotulo: 'Notas clínicas',
    pie: 'Evoluciones asentadas en el expediente.',
    campo: 'clinicalNotes',
    seMueveCon: 'Sube cada vez que asentás una evolución.',
  },
  {
    clave: 'documentos',
    rotulo: 'Documentos publicados',
    pie: 'Informes, certificados y adjuntos que emitiste.',
    campo: 'documents',
    seMueveCon: 'Sube cada vez que emitís un informe, un certificado o un adjunto.',
  },
];
