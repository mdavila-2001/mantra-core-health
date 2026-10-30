import type { NavIconName } from '../../../core/navigation/navigation.types';

/**
 * Los textos del inicio del paciente que no dependen de datos.
 *
 * Los consejos hablan **de cómo usar AloVida**, nunca de salud: un consejo
 * médico escrito por desarrollo sería contenido clínico sin fuente, que la regla
 * 7 de las no negociables prohíbe. Cada uno señala una función que existe —si
 * una se retira, su consejo se va con ella—.
 */
export interface PatientTip {
  readonly icon: NavIconName;
  readonly text: string;
}

export const PATIENT_TIPS: readonly PatientTip[] = [
  {
    icon: 'note',
    text: 'Si escribir le cuesta, en «¿Cómo se siente?» toque «Dictar» y cuéntenos hablando.',
  },
  {
    icon: 'phone',
    text: 'El botón rojo «Emergencia» está siempre arriba: ahí tiene los números de ambulancia.',
  },
  {
    icon: 'calendar',
    text: 'En «Mis citas» puede cambiar el día de una cita sin llamar a nadie.',
  },
  {
    icon: 'pill',
    text: 'En «Farmacia» ve qué farmacia tiene su receta completa y cuál le queda más cerca.',
  },
  {
    icon: 'people',
    text: 'En «Dependientes» puede sumar a sus hijos o a sus padres y pedir citas por ellos.',
  },
  {
    icon: 'heart',
    text: 'Sus recetas quedan guardadas en «Mi historia clínica»: puede verlas y descargarlas.',
  },
  {
    icon: 'chat',
    text: 'Con «Chats», arriba, le escribe a su médico sin salir de casa.',
  },
  {
    icon: 'teach',
    text: '¿Algo no le queda claro? En «Tutoriales» le mostramos paso a paso cómo se hace.',
  },
];

/** «Buenos días» hasta las 12, «Buenas tardes» hasta las 19, después «Buenas noches». */
export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * Los nombres sin los apellidos.
 *
 * En Bolivia el nombre completo lleva dos apellidos al final, así que con tres
 * palabras o más se quitan las dos últimas («Ana Lucía Pérez Quiroga» → «Ana
 * Lucía»); con dos, la última («Juan Pérez» → «Juan»). Con una sola, se usa tal
 * cual. No es exacto para todo nombre, pero se equivoca hacia lo cortés: en el
 * peor caso saluda con un nombre y un apellido.
 */
export function firstNameOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter((word) => word !== '');
  if (words.length >= 3) return words.slice(0, -2).join(' ');
  if (words.length === 2) return words[0];
  return words[0] ?? '';
}
