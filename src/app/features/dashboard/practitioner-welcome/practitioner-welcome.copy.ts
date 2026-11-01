import type { NavIconName } from '../../../core/navigation/navigation.types';
import { AGENDA_ROUTE } from '../../agenda/agenda.routes';

/**
 * Un atajo de la portada del médico: lo que se viene a hacer, dicho como acción.
 *
 * `sectionPath` es la ruta de la sección en `APP_SECTIONS`: el atajo se muestra
 * sólo si el menú le muestra esa sección a esta sesión. Ofrecer una puerta que
 * el guard cierra sería mandar al médico de vuelta al panel sin explicación.
 */
export interface PractitionerShortcut {
  readonly sectionPath: string;
  readonly route: string;
  readonly icon: NavIconName;
  readonly title: string;
  readonly text: string;
  readonly testId: string;
}

/**
 * Los cuatro atajos, en el orden en que se usan durante una jornada.
 *
 * Cada texto describe una función que existe hoy; si una se retira, su atajo se
 * va con ella. Sin promesas que la aplicación no cumple.
 */
export const PRACTITIONER_SHORTCUTS: readonly PractitionerShortcut[] = [
  {
    sectionPath: 'schedule',
    route: AGENDA_ROUTE,
    icon: 'stethoscope',
    title: 'Atender a mi próximo paciente',
    text: 'Su agenda de hoy, con la consulta lista para iniciar.',
    testId: 'welcome-shortcut-schedule',
  },
  {
    sectionPath: 'medical-records',
    route: '/medical-records',
    icon: 'folder',
    title: 'Abrir una historia clínica',
    text: 'Antecedentes, recetas y estudios de cada paciente.',
    testId: 'welcome-shortcut-records',
  },
  {
    sectionPath: 'my-primary-patients',
    route: '/my-primary-patients',
    icon: 'heart',
    title: 'Mis pacientes de cabecera',
    text: 'Quienes lo eligieron para acompañar su salud.',
    testId: 'welcome-shortcut-primary',
  },
  {
    sectionPath: 'messaging',
    route: '/messaging',
    icon: 'chat',
    title: 'Responder mensajes',
    text: 'Las dudas de sus pacientes, por chat y en un solo lugar.',
    testId: 'welcome-shortcut-messages',
  },
];
