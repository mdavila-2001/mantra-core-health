/**
 * Claves estables de los elementos de la interfaz que se pueden mostrar u ocultar por regla.
 *
 * Viven aparte del servicio y del registro a propósito: el servicio y la guarda viajan en el paquete inicial y
 * sólo necesitan **calcular una clave**, no conocer el catálogo entero. **La visibilidad no es autorización**: la
 * clave identifica qué se presenta, nunca qué se permite.
 */

/** La forma de una clave: `<modulo>.<pantalla>.<elemento>`, en minúsculas y separada por puntos (mínimo dos tramos). */
export const UI_ELEMENT_KEY_PATTERN = /^[a-z][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)+$/;

/** Prefijo de lo que se deriva solo del menú (`APP_SECTIONS`). */
export const NAV_KEY_PREFIX = 'nav';

/** Minúsculas, sin tildes y con guiones: `Atención` → `atencion`, `Mi cuenta` → `mi-cuenta`. */
export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** La clave de una pantalla del menú: `administration/patients` → `nav.administration.patients`. */
export function navScreenKey(sectionPath: string): string {
  const tramos = sectionPath
    .split('/')
    .map((tramo) => slugify(tramo))
    .filter((tramo) => tramo !== '');
  return [NAV_KEY_PREFIX, ...tramos].join('.');
}

/** La clave del grupo del menú (la sección que lo contiene): `Mi cuenta` → `nav.group.mi-cuenta`. */
export function navGroupKey(group: string): string {
  return `${NAV_KEY_PREFIX}.group.${slugify(group)}`;
}

/**
 * El código de módulo de una sección, a partir del texto de trazabilidad del registro.
 *
 * `M24 pharmacy` → `pharmacy`; `M11 system_ops · M46 platform_ops` → `system_ops` (manda el primero);
 * `M00` → `m00`; `—  ayuda en producto` → `ayuda-en-producto`. Siempre en minúsculas, sin espacios.
 */
export function moduleCodeOf(module: string): string {
  const primero = module.split('·')[0]?.trim() ?? '';
  const conNombre = /^M[\w-]*\s+([a-z][a-z0-9_]*)/i.exec(primero);
  if (conNombre?.[1] !== undefined) {
    return conNombre[1].toLowerCase();
  }
  const code = slugify(primero);
  return code === '' ? 'general' : code;
}
