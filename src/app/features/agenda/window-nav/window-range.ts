import { formatDate } from '@angular/common';

/**
 * El rango de la ventana en texto: «13 – 19 sept. 2026». Un día solo se
 * escribe completo, con el día de la semana.
 */
export function rangoDeVentana(desde: Date, dias: number, idioma: string): string {
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + dias - 1);
  const fin = formatDate(hasta, 'd MMM y', idioma);
  if (dias === 1) return formatDate(desde, 'EEEE d MMM y', idioma);
  const inicio =
    desde.getMonth() === hasta.getMonth() && desde.getFullYear() === hasta.getFullYear()
      ? formatDate(desde, 'd', idioma)
      : formatDate(desde, desde.getFullYear() === hasta.getFullYear() ? 'd MMM' : 'd MMM y', idioma);
  return `${inicio} – ${fin}`;
}
