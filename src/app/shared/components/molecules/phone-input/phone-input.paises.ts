/* ============================================================================
    Los países que este campo sabe componer.

    Es un set CERRADO, y corto a propósito. La lista completa de doscientos
    cuarenta países convierte un campo de ocho dígitos en una búsqueda: quien
    se registra desde Bolivia —que es la enorme mayoría— tendría que pasar por
    un desplegable de doscientas entradas para elegir la primera. Acá están
    Bolivia y los destinos desde donde de verdad llega un número a este
    producto: los cinco países vecinos, y los tres con más bolivianos fuera
    (Argentina, España, Estados Unidos).

    Agregar uno es agregar una fila y su bandera. Lo que NO se hace es abrirlo
    a un string libre: un prefijo inventado se guarda igual de bien que uno
    real y se descubre cuando alguien intenta llamar.
    ========================================================================== */

/** Los códigos ISO que este campo dibuja. Cerrado: ver {@link PaisTelefono}. */
export const ISO_PAISES = [
  'BO',
  'AR',
  'BR',
  'CL',
  'PE',
  'PY',
  'UY',
  'CO',
  'EC',
  'VE',
  'ES',
  'US',
  'MX',
] as const;

export type IsoPais = (typeof ISO_PAISES)[number];

/** Un país, tal como el campo necesita conocerlo para componer el número. */
export interface PaisTelefono {
  readonly iso: IsoPais;

  /** Como se lee en el desplegable. En español, que es el idioma del producto. */
  readonly nombre: string;

  /** El prefijo internacional, con el `+` incluido. */
  readonly prefijo: string;

  /** Cuántos dígitos tiene el número nacional, sin el prefijo. */
  readonly digitos: number;

  /**
   * Cómo se agrupan esos dígitos al mostrarlos: `[4, 4]` pinta `7001 2345`.
   *
   * Es ayuda de lectura y no dato — se muestra agrupado y se guarda seguido—,
   * y va por país porque cada uno agrupa distinto: un número boliviano se lee
   * de cuatro en cuatro y uno brasileño como `11 91234 5678`. Agrupar todo de
   * a tres habría sido una sola regla, y una regla que ningún país usa.
   */
  readonly grupos: readonly number[];
}

/**
 * El catálogo. El orden es el del desplegable: Bolivia primero por ser el país
 * del producto, después los vecinos de sur a norte, y al final los de fuera de
 * la región. No se ordena alfabéticamente porque eso pondría a Argentina antes
 * que a Bolivia en un producto boliviano.
 */
export const PAISES_TELEFONO: readonly PaisTelefono[] = [
  { iso: 'BO', nombre: 'Bolivia', prefijo: '+591', digitos: 8, grupos: [4, 4] },
  { iso: 'AR', nombre: 'Argentina', prefijo: '+54', digitos: 10, grupos: [3, 3, 4] },
  { iso: 'BR', nombre: 'Brasil', prefijo: '+55', digitos: 11, grupos: [2, 5, 4] },
  { iso: 'CL', nombre: 'Chile', prefijo: '+56', digitos: 9, grupos: [1, 4, 4] },
  { iso: 'PY', nombre: 'Paraguay', prefijo: '+595', digitos: 9, grupos: [3, 3, 3] },
  { iso: 'PE', nombre: 'Perú', prefijo: '+51', digitos: 9, grupos: [3, 3, 3] },
  { iso: 'UY', nombre: 'Uruguay', prefijo: '+598', digitos: 8, grupos: [4, 4] },
  { iso: 'CO', nombre: 'Colombia', prefijo: '+57', digitos: 10, grupos: [3, 3, 4] },
  { iso: 'EC', nombre: 'Ecuador', prefijo: '+593', digitos: 9, grupos: [2, 3, 4] },
  { iso: 'VE', nombre: 'Venezuela', prefijo: '+58', digitos: 10, grupos: [3, 3, 4] },
  { iso: 'ES', nombre: 'España', prefijo: '+34', digitos: 9, grupos: [3, 3, 3] },
  { iso: 'US', nombre: 'Estados Unidos', prefijo: '+1', digitos: 10, grupos: [3, 3, 4] },
  { iso: 'MX', nombre: 'México', prefijo: '+52', digitos: 10, grupos: [3, 3, 4] },
];

/** Bolivia: el país por defecto, y el que se asume cuando no hay prefijo. */
export const PAIS_POR_DEFECTO: PaisTelefono = PAISES_TELEFONO[0];

/**
 * Los prefijos ordenados de más largo a más corto.
 *
 * El orden importa: `+591` (Bolivia) empieza igual que `+59`, y `+1` (Estados
 * Unidos) es prefijo de casi todo. Buscando de corto a largo, un número
 * boliviano se reconocería como estadounidense y el campo le borraría cuatro
 * dígitos al reformatearlo. De largo a corto, gana siempre la coincidencia más
 * específica, que es la correcta.
 */
const PREFIJOS_POR_ESPECIFICIDAD: readonly PaisTelefono[] = [...PAISES_TELEFONO].sort(
  (a, b) => b.prefijo.length - a.prefijo.length,
);

/**
 * De qué país es un número ya escrito.
 *
 * Se usa en `writeValue`: el formulario entrega `+54 11 3456 7890` y el campo
 * tiene que abrir con la bandera de Argentina, no con la de Bolivia y diez
 * dígitos que no caben. Sin prefijo reconocible se asume Bolivia, que es de
 * donde viene el número que alguien escribió sin pensar en el país.
 */
export function paisDelNumero(valor: string): PaisTelefono {
  const digitos = valor.replace(/\D/g, '');
  if (digitos === '') {
    return PAIS_POR_DEFECTO;
  }
  const encontrado = PREFIJOS_POR_ESPECIFICIDAD.find((pais) =>
    digitos.startsWith(pais.prefijo.slice(1)),
  );
  return encontrado ?? PAIS_POR_DEFECTO;
}

/**
 * Quita el prefijo del país, si venía, y corta al largo que ese país usa.
 *
 * El prefijo sólo se quita cuando **sobran** dígitos para el país. Sin esa
 * guarda, alguien tecleando un número boliviano que empieza por `591` vería
 * desaparecer sus tres primeros dígitos tecla a tecla, porque `591` es también
 * el prefijo de Bolivia. Con ella, `591` suelto son tres dígitos de un número
 * de ocho —no hay nada que quitar— y `+591 70012345` son once para un país de
 * ocho, que es la señal de que los tres primeros son el país.
 */
export function nacionalDelNumero(valor: string, pais: PaisTelefono): string {
  const digitos = valor.replace(/\D/g, '');
  const sinMas = pais.prefijo.slice(1);
  const sobran = digitos.length > pais.digitos;
  const sinPais = sobran && digitos.startsWith(sinMas) ? digitos.slice(sinMas.length) : digitos;
  return sinPais.slice(0, pais.digitos);
}

/**
 * Si un valor ya compuesto es un teléfono completo de alguno de los países.
 *
 * Vive con el catálogo y no en la pantalla que lo valida, por lo mismo que el
 * prefijo dejó de vivir ahí: el largo del número es del país, y una pantalla
 * que lo repita queda desincronizada en cuanto se agregue uno. El alta de
 * paciente traía `/^\+591 [0-9]{8}$/` escrito a mano —correcto mientras el
 * campo sólo componía Bolivia, y un rechazo silencioso de todo número
 * extranjero apenas dejó de hacerlo.
 *
 * Vacío cuenta como válido: el campo es opcional en las pantallas que lo usan,
 * y quien lo quiera obligatorio suma `Validators.required`, que es lo que
 * corresponde. Ver `PhoneInput`: con el campo vacío se guarda cadena vacía y no
 * un prefijo suelto, justamente para que esto pueda distinguirlos.
 */
export function esTelefonoCompleto(valor: string): boolean {
  if (valor === '') {
    return true;
  }
  return PAISES_TELEFONO.some((pais) => {
    const digitos = valor.startsWith(`${pais.prefijo} `)
      ? valor.slice(pais.prefijo.length + 1)
      : null;
    return digitos !== null && new RegExp(`^[0-9]{${pais.digitos}}$`).test(digitos);
  });
}

/** `70012345` + `[4,4]` -> `7001 2345`. Ayuda de lectura, no dato. */
export function agrupar(digitos: string, grupos: readonly number[]): string {
  const partes: string[] = [];
  let resto = digitos;
  for (const largo of grupos) {
    if (resto === '') {
      break;
    }
    partes.push(resto.slice(0, largo));
    resto = resto.slice(largo);
  }
  if (resto !== '') {
    partes.push(resto);
  }
  return partes.join(' ');
}

/** El marcador del campo para un país: su propio número de ejemplo, agrupado. */
export function ejemploDe(pais: PaisTelefono): string {
  const ejemplos: Record<IsoPais, string> = {
    BO: '70012345',
    AR: '1134567890',
    BR: '11912345678',
    CL: '912345678',
    PY: '981123456',
    PE: '912345678',
    UY: '91234567',
    CO: '3011234567',
    EC: '991234567',
    VE: '4121234567',
    ES: '612345678',
    US: '2025550123',
    MX: '5512345678',
  };
  return agrupar(ejemplos[pais.iso], pais.grupos);
}
