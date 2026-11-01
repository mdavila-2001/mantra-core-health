import { APP_SECTIONS } from '../navigation/navigation.map';
import {
  moduleCodeOf,
  navGroupKey,
  navScreenKey,
  slugify,
  UI_ELEMENT_KEY_PATTERN,
} from './ui-element-keys';

describe('claves de elementos de interfaz', () => {
  it('la pantalla del menú es `nav.` + la ruta con puntos', () => {
    expect(navScreenKey('administration/patients')).toBe('nav.administration.patients');
    expect(navScreenKey('dashboard')).toBe('nav.dashboard');
    expect(navScreenKey('my-account/requests')).toBe('nav.my-account.requests');
  });

  it('el grupo va sin tildes ni espacios', () => {
    expect(navGroupKey('Atención')).toBe('nav.group.atencion');
    expect(navGroupKey('Mi cuenta')).toBe('nav.group.mi-cuenta');
    expect(slugify('  Superadministración ')).toBe('superadministracion');
  });

  it('el código de módulo sale del texto de trazabilidad del registro', () => {
    expect(moduleCodeOf('M24 pharmacy')).toBe('pharmacy');
    expect(moduleCodeOf('M29 delegated_access')).toBe('delegated_access');
    expect(moduleCodeOf('M11 system_ops · M46 platform_ops')).toBe('system_ops');
    expect(moduleCodeOf('M00')).toBe('m00');
    expect(moduleCodeOf('—  ayuda en producto')).toBe('ayuda-en-producto');
    expect(moduleCodeOf('')).toBe('general');
  });

  it('TODA sección del registro produce una clave válida y distinta, y un módulo en minúsculas', () => {
    const claves = APP_SECTIONS.map((s) => navScreenKey(s.path));
    for (const clave of claves) expect(clave).toMatch(UI_ELEMENT_KEY_PATTERN);
    expect(new Set(claves).size).toBe(claves.length);
    for (const s of APP_SECTIONS) expect(moduleCodeOf(s.module)).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
  });
});
