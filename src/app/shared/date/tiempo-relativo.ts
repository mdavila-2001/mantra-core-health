/**
 * «Hace 2 min», «hace 3 h», «ayer», «hace 5 d» — para la bandeja de chats.
 *
 * Función plana y no un `@Pipe`: el repo no usa pipes en ningún lado (las
 * pantallas resuelven el texto con un método `protected` llamado desde el
 * template, como `conQuien()` en `messaging.ts`), así que esto sigue el mismo
 * patrón en vez de introducir uno nuevo para una sola etiqueta.
 *
 * Más allá de una semana devuelve `null`: quien llama cae al formato de fecha
 * de siempre (`date:'short'`), que es más útil que «hace 12 d».
 */
export function tiempoRelativo(fecha: Date, ahora = new Date()): string | null {
  const segundos = Math.max(0, Math.round((ahora.getTime() - fecha.getTime()) / 1000));

  if (segundos < 60) {
    return 'ahora';
  }
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) {
    return `hace ${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    return `hace ${horas} h`;
  }
  const dias = Math.floor(horas / 24);
  if (dias === 1) {
    return 'ayer';
  }
  if (dias < 7) {
    return `hace ${dias} d`;
  }
  return null;
}
