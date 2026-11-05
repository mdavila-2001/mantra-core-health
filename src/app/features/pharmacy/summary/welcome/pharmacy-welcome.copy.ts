import type { NavIconName } from '../../../../core/navigation/navigation.types';

/**
 * A pharmacy home shortcut, worded as an action.
 *
 * `sectionPath` is the section path in `APP_SECTIONS`: the shortcut is shown
 * only when the menu shows that section to this session.
 */
export interface PharmacyShortcut {
  readonly sectionPath: string;
  readonly route: string;
  readonly icon: NavIconName;
  readonly title: string;
  readonly text: string;
  readonly testId: string;
}

/** The four shortcuts, in the order they are used during a counter day. */
export const PHARMACY_SHORTCUTS: readonly PharmacyShortcut[] = [
  {
    sectionPath: 'administration/pharmacy-orders',
    route: '/administration/pharmacy-orders',
    icon: 'bag',
    title: 'Atender solicitudes de retiro',
    text: 'Revise recetas, prepare pedidos y entregue con su código.',
    testId: 'pharmacy-welcome-orders',
  },
  {
    sectionPath: 'administration/pharmacy-catalog',
    route: '/administration/pharmacy-catalog',
    icon: 'package',
    title: 'Actualizar mi catálogo',
    text: 'Productos, precios e inventario, en una sola pantalla.',
    testId: 'pharmacy-welcome-catalog',
  },
  {
    sectionPath: 'administration/pharmacy-campaigns',
    route: '/administration/pharmacy-campaigns',
    icon: 'megaphone',
    title: 'Lanzar una promoción',
    text: 'Qué productos, con qué descuento y hasta cuándo.',
    testId: 'pharmacy-welcome-campaigns',
  },
  {
    sectionPath: 'administration/pharmacy-hours',
    route: '/administration/pharmacy-hours',
    icon: 'clock',
    title: 'Horario y turnos',
    text: 'Las sucursales 24 horas y sus turnos de guardia.',
    testId: 'pharmacy-welcome-hours',
  },
];
