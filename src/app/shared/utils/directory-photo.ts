/**
 * La foto de una tarjeta de directorio.
 *
 * ## De dónde salen
 *
 * De `public/alovida/directorio/`: fotos con licencia libre (Wikimedia Commons,
 * ver `CREDITOS.md` en esa carpeta), ya recortadas a 16:9 y comprimidas. Van
 * empaquetadas y no enlazadas a un CDN para que el directorio se vea igual sin
 * red y sin depender de que un tercero conserve la URL.
 *
 * ## Por qué se elige por clave y no al azar
 *
 * La misma ficha tiene que mostrar **la misma foto** en la grilla, en la lista
 * y al volver de la ficha: `Math.random()` haría que cada render barajara el
 * directorio. Se deriva de un hash del identificador, así que es estable y
 * reparte parejo entre las fotos del tema.
 *
 * ## Qué es y qué no es
 *
 * Es una **imagen ilustrativa** del tipo de lugar —una farmacia, un laboratorio—
 * y no la foto del establecimiento concreto: la API pública no sirve fotos
 * propias hoy. Por eso la tarjeta la pinta como decorativa (`alt=""`) y una
 * foto real (`coverUrl`) le gana cuando exista.
 */
export type TemaDeFoto = 'medico' | 'laboratorio' | 'imagen' | 'farmacia' | 'clinica';

const CANTIDAD_POR_TEMA: Readonly<Record<TemaDeFoto, number>> = {
  medico: 26,
  laboratorio: 15,
  imagen: 11,
  farmacia: 19,
  clinica: 11,
};

/** FNV-1a de 32 bits: barato, sin dependencias y estable entre ejecuciones. */
function hash(clave: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < clave.length; i++) {
    h ^= clave.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** La ruta de la foto que le toca a `clave` dentro de su `tema`. */
export function fotoDeDirectorio(tema: TemaDeFoto, clave: string): string {
  const numero = (hash(clave) % CANTIDAD_POR_TEMA[tema]) + 1;
  return `/alovida/directorio/${tema}-${String(numero).padStart(2, '0')}.jpg`;
}

/** La foto de la tarjeta de una especialidad de la portada de médicos. */
export function fotoDeEspecialidad(nombre: string): string {
  return fotoDeDirectorio(temaDeCentroDiagnostico(nombre) === 'imagen' ? 'imagen' : 'medico', nombre);
}

/** La foto de cada puerta de la portada «Directorios». */
export function fotoDeVertical(ruta: string): string {
  const tema: TemaDeFoto = ruta.includes('laboratory')
    ? 'laboratorio'
    : ruta.includes('clinic')
      ? 'clinica'
      : ruta.includes('pharmac')
        ? 'farmacia'
        : 'medico';
  return fotoDeDirectorio(tema, ruta);
}

/**
 * El tema de un laboratorio o centro diagnóstico según lo que dice de sí.
 *
 * Mira el texto y no un código porque los dos mapeadores lo tienen a mano en
 * formas distintas —categoría de la API en uno, titular en el otro—.
 */
export function temaDeCentroDiagnostico(texto: string): TemaDeFoto {
  return /imagen|imaging|radiolog|rayos|resonancia|tomograf|ecograf|ultrasonid/i.test(texto)
    ? 'imagen'
    : 'laboratorio';
}
