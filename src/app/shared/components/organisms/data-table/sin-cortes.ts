/**
 * Cambia por espacios duros (U+00A0) los espacios que no deben partir un dato
 * corto: los de una hora con su meridiano («12:00 a. m.») y, si se pide, todos.
 *
 * `toLocaleString('es-BO', { timeStyle: 'short' })` devuelve «12:00 a. m.» con
 * espacios comunes, y en una columna angosta eso se partía en «12:00 a.» /
 * «m.», que se lee como dos datos. CSS (`nowrap` de la columna) lo evita en la
 * tabla; esto lo evita en cualquier lugar donde el texto se dibuje.
 */
export function sinCortes(texto: string, todo = false): string {
  if (todo) return texto.replace(/ +/g, '\u00a0');
  return texto.replace(/(\d)\s([ap])\.\s?m\./gi, (_m, d: string, ap: string) => `${d}\u00a0${ap}.\u00a0m.`);
}

/**
 * EL formato de fecha y hora del portal: «1 nov de 2026, 6:34 p. m.», en la
 * zona del navegador y con la hora unida a su meridiano. Uno solo para todas
 * las pantallas: convivían «1 nov de 2026, 5:31 p. m.», «01/11/2026 20:37» y
 * el formato del navegador. Sin dato → «Sin dato».
 */
export function fechaHora(valor: Date | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return 'Sin dato';
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return 'Sin dato';
  return sinCortes(fecha.toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' }));
}

/** Sólo la fecha, en el mismo estilo: «1 nov de 2026». */
export function fecha(valor: Date | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return 'Sin dato';
  const f = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(f.getTime()) ? 'Sin dato' : f.toLocaleDateString('es-BO', { dateStyle: 'medium' });
}
